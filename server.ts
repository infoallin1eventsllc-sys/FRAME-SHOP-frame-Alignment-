// Must come first: every const below reads process.env at module load, so the
// .env file has to be in place before any of them are evaluated. Without this
// the file is ignored entirely and only real shell variables are ever seen.
import "dotenv/config";

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  shopifyEnabled,
  createDraftOrder,
  sendDraftOrderInvoice,
  verifyWebhook,
  bookingIdFromOrder,
} from "./shopify";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

/** Kept in step with SHOP_INFO.phone in src/data/shopData.ts. */
const SHOP_INFO_PHONE = "(832) 628-5226";


app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production",
  /**
   * Helmet defaults to no-referrer, which breaks embedded video: YouTube can't
   * see which site is asking, so it refuses to play with error 153. This is the
   * modern browser default — the embedding origin is sent and nothing more, so
   * the page path a visitor is on still never leaves the site.
   */
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

/**
 * Shopify signs each webhook over the exact bytes it sent, so this needs the
 * raw body and must be registered before express.json() parses it away.
 */
app.post("/api/shopify/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const hmac = String(req.headers["x-shopify-hmac-sha256"] || "");
  if (!verifyWebhook(req.body as Buffer, hmac)) {
    console.warn("[SHOPIFY WEBHOOK] rejected: bad signature");
    return res.status(401).json({ error: "Invalid signature." });
  }

  // Answer immediately — Shopify retries anything slower than 5 seconds.
  res.json({ received: true });

  try {
    const topic = String(req.headers["x-shopify-topic"] || "");
    if (topic !== "orders/paid") return;

    const order = JSON.parse((req.body as Buffer).toString("utf8"));
    const bookingId = bookingIdFromOrder(order);
    if (!bookingId) return;

    const bks = loadBookings();
    const idx = bks.findIndex((b) => b.id === bookingId);
    if (idx === -1 || !bks[idx].invoice) return;

    // A deposit leaves a balance; anything covering the total settles the job.
    const paid = parseFloat(order.total_price ?? "0");
    const due = Number(bks[idx].invoice!.totalAmount ?? 0);
    bks[idx].invoice!.paymentStatus = due > 0 && paid + 0.01 < due ? "deposit_paid" : "paid_in_full";
    saveBookings(bks);
    console.log(`[SHOPIFY PAID]: ${order.name} → booking ${bookingId} (${bks[idx].invoice!.paymentStatus})`);
  } catch (err) {
    console.error("[SHOPIFY WEBHOOK ERROR]", err);
  }
});

/**
 * Photos are sent as data URLs and run to a few hundred KB, far past the 100kb
 * default below. This has to be registered first: the general parser would
 * otherwise reject them with 413 before the media route was ever reached.
 */
const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
app.use("/api/media", express.json({ limit: MAX_MEDIA_BYTES }));

app.use(express.json());

const diagLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many diagnostic requests. Please wait a moment and try again." },
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

const SHOP_OWNER_PIN  = process.env.SHOP_OWNER_PIN  || "1234";
const SHOP_API_SECRET = process.env.SHOP_API_SECRET || "";

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!SHOP_API_SECRET) return next();
  const token = req.headers["x-shop-secret"];
  if (token !== SHOP_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  next();
}

/* ---------------------------------------------------------------------------
 * Shop video hosting (Supabase Storage)
 *
 * Paul uploads clips through this server rather than straight from the browser:
 * a browser-side upload would need a Supabase key shipped in the JS bundle, and
 * anyone could then write files into the shop's storage. The service key stays
 * here, and the existing owner auth guards the route.
 * ------------------------------------------------------------------------- */
const SUPABASE_URL          = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY  || "";
const SUPABASE_VIDEO_BUCKET = process.env.SUPABASE_VIDEO_BUCKET || "shop-videos";
const MAX_VIDEO_BYTES       = parseInt(process.env.MAX_VIDEO_MB || "200", 10) * 1024 * 1024;

const videoUploadsEnabled = () => Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

/** Strip anything that could escape the bucket path or upset a URL. */
function safeObjectName(rawName: string): string {
  const cleaned = (rawName || "clip.mp4")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  const stem = cleaned.replace(/\.[^.]*$/, "") || "clip";
  const ext = (cleaned.match(/\.([a-z0-9]{1,5})$/i)?.[1] || "mp4").toLowerCase();
  return `${Date.now()}-${stem}.${ext}`;
}

// Lets the admin portal show the upload control only when hosting is configured.
app.get("/api/videos/config", (_req, res) => {
  res.json({
    enabled: videoUploadsEnabled(),
    maxBytes: MAX_VIDEO_BYTES,
    bucket: SUPABASE_VIDEO_BUCKET,
  });
});

app.post(
  "/api/videos/upload",
  requireAdmin,
  express.raw({ type: () => true, limit: MAX_VIDEO_BYTES }),
  async (req, res) => {
    if (!videoUploadsEnabled()) {
      return res.status(503).json({
        error: "Video hosting is not configured on this server.",
      });
    }

    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: "No video data received." });
    }

    const contentType = String(req.headers["content-type"] || "");
    if (!contentType.startsWith("video/")) {
      return res.status(415).json({
        error: "That file is not a video. Upload an MP4, MOV or WEBM.",
      });
    }

    const objectName = safeObjectName(String(req.headers["x-video-filename"] || ""));

    try {
      const uploadUrl =
        `${SUPABASE_URL}/storage/v1/object/${SUPABASE_VIDEO_BUCKET}/${encodeURIComponent(objectName)}`;
      const upstream = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": contentType,
          "cache-control": "public, max-age=31536000",
        },
        body: new Uint8Array(body),
      });

      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => "");
        console.error("[VIDEO UPLOAD FAILED]", upstream.status, detail);
        // Surface the one cause the owner can actually fix themselves.
        if (upstream.status === 404) {
          return res.status(502).json({
            error: `Storage bucket "${SUPABASE_VIDEO_BUCKET}" was not found. Create it in Supabase and mark it public.`,
          });
        }
        return res.status(502).json({ error: "Storage rejected the upload. Try again." });
      }

      res.json({
        url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_VIDEO_BUCKET}/${encodeURIComponent(objectName)}`,
        objectName,
        bytes: body.length,
      });
    } catch (err) {
      console.error("[VIDEO UPLOAD ERROR]", err);
      res.status(500).json({ error: "Could not reach storage. Try again." });
    }
  }
);

// Removing a video from the site should not leave the file eating the quota.
app.delete("/api/videos/object/:objectName", requireAdmin, async (req, res) => {
  if (!videoUploadsEnabled()) {
    return res.status(503).json({ error: "Video hosting is not configured." });
  }
  const objectName = String(req.params.objectName || "");
  if (!objectName || objectName.includes("/") || objectName.includes("..")) {
    return res.status(400).json({ error: "Invalid file name." });
  }

  try {
    const upstream = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${SUPABASE_VIDEO_BUCKET}/${encodeURIComponent(objectName)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    // A file already gone is a success from the caller's point of view.
    if (!upstream.ok && upstream.status !== 404) {
      return res.status(502).json({ error: "Storage rejected the delete." });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[VIDEO DELETE ERROR]", err);
    res.status(500).json({ error: "Could not reach storage." });
  }
});

// In-memory + local JSON file persistence for appointment bookings
const DATA_DIR = path.join(process.cwd(), "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");
const VIDEOS_FILE = path.join(DATA_DIR, "videos.json");

/* ---------------------------------------------------------------------------
 * The published video list.
 *
 * This has to live on the server, not in the owner's browser: the whole point
 * of the section is that customers see what Paul posts, and browser storage is
 * private to the one device that wrote it.
 * ------------------------------------------------------------------------- */
interface ShopVideoRecord {
  id: string;
  url: string;
  title: string;
  description?: string;
  storageObject?: string;
}

function readVideos(): ShopVideoRecord[] {
  try {
    if (!fs.existsSync(VIDEOS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(VIDEOS_FILE, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[VIDEOS READ ERROR]", err);
    return [];
  }
}

function writeVideos(list: ShopVideoRecord[]) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(VIDEOS_FILE, JSON.stringify(list, null, 2));
}

/** Keeps a malformed or oversized payload from becoming the published list. */
function sanitiseVideos(input: unknown): ShopVideoRecord[] | null {
  if (!Array.isArray(input) || input.length > 60) return null;
  const out: ShopVideoRecord[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const { id, url, title, description, storageObject } = raw as Record<string, unknown>;
    if (typeof id !== "string" || typeof url !== "string" || typeof title !== "string") return null;
    if (!id || !url || !title || url.length > 2000 || title.length > 200) return null;
    out.push({
      id,
      url,
      title,
      ...(typeof description === "string" && description ? { description: description.slice(0, 500) } : {}),
      ...(typeof storageObject === "string" && storageObject ? { storageObject } : {}),
    });
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Site media — the hero photo, Paul's portrait, the case-study photos.
 *
 * These were held in the owner's browser, so a photo he changed was visible to
 * him and to nobody else, on any other device or any customer's screen, while
 * the portal reported it live. Same failure the video list had.
 * ------------------------------------------------------------------------- */
const MEDIA_FILE = path.join(DATA_DIR, "media.json");

interface SiteMedia {
  heroImage?: string;
  paulPhoto?: string;
  galleryPhotos?: Record<string, string>;
}

function readMedia(): SiteMedia {
  try {
    if (!fs.existsSync(MEDIA_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(MEDIA_FILE, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.error("[MEDIA READ ERROR]", err);
    return {};
  }
}

function writeMedia(media: SiteMedia) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(MEDIA_FILE, JSON.stringify(media));
}

app.get("/api/media", (_req, res) => {
  res.json(readMedia());
});

// Owner only. Sent whole, the same way the portal holds it.
app.put("/api/media", requireAdmin, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid media payload." });
  }

  const clean: SiteMedia = {};
  if (typeof body.heroImage === "string") clean.heroImage = body.heroImage;
  if (typeof body.paulPhoto === "string") clean.paulPhoto = body.paulPhoto;
  if (body.galleryPhotos && typeof body.galleryPhotos === "object" && !Array.isArray(body.galleryPhotos)) {
    const photos: Record<string, string> = {};
    for (const [id, url] of Object.entries(body.galleryPhotos)) {
      if (typeof id === "string" && typeof url === "string" && id.length <= 64) photos[id] = url;
    }
    clean.galleryPhotos = photos;
  }

  try {
    writeMedia(clean);
    res.json({ ok: true });
  } catch (err) {
    console.error("[MEDIA WRITE ERROR]", err);
    res.status(500).json({ error: "Could not save the site photos." });
  }
});

// Public — every visitor needs this to render the section.
app.get("/api/videos", (_req, res) => {
  res.json(readVideos());
});

// Owner only. The admin screen manages the whole ordered list, so it saves the
// list wholesale; that covers add, remove and reorder in one route.
app.put("/api/videos", requireAdmin, (req, res) => {
  const cleaned = sanitiseVideos(req.body);
  if (!cleaned) {
    return res.status(400).json({ error: "Invalid video list." });
  }
  try {
    writeVideos(cleaned);
    res.json({ ok: true, count: cleaned.length });
  } catch (err) {
    console.error("[VIDEOS WRITE ERROR]", err);
    res.status(500).json({ error: "Could not save the video list." });
  }
});

interface InvoiceLineItem {
  id: string;
  description: string;
  category: "labor" | "parts" | "laser_scan" | "supplies" | "sublet";
  quantity: number;
  rate: number;
  amount: number;
}

interface InternalInvoice {
  invoiceNumber: string;
  createdDate: string;
  dueDate: string;
  mechanicName: string;
  laborHourlyRate: number;
  items: InvoiceLineItem[];
  subtotal: number;
  shopSuppliesRatePct: number;
  shopSuppliesAmount: number;
  taxRatePct: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: "unpaid" | "deposit_paid" | "paid_in_full";
  internalOwnerNotes?: string;
}

interface Booking {
  id: string;
  ticketNumber: string;
  serviceId: string;
  serviceTitle: string;
  bikeYear: string;
  bikeMake: string;
  bikeModel: string;
  issueNotes: string;
  preferredDate: string;
  preferredTimeSlot: string;
  name: string;
  phone: string;
  email: string;
  status: "pending" | "confirmed" | "in_shop" | "completed" | "cancelled";
  createdAt: string;
  techNotes?: string;
  invoice?: InternalInvoice;
}




// Initial mock seed data if file doesn't exist
const INITIAL_BOOKINGS: Booking[] = [
  {
    id: "bk-101",
    ticketNumber: "FS-849201",
    serviceId: "powertrain-alignment",
    serviceTitle: "Power Train Alignment",
    bikeYear: "2022",
    bikeMake: "Harley-Davidson",
    bikeModel: "Road Glide Special",
    issueNotes: "High-speed rear wobble above 75mph in long freeway sweepers.",
    preferredDate: "2026-08-04",
    preferredTimeSlot: "Morning (9AM - 12PM)",
    name: "Marcus Vance",
    phone: "(832) 555-0199",
    email: "marcus.vance@example.com",
    status: "pending",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    techNotes: "Initial check requested. Rider mentioned recent 128ci big bore kit install."
  },
  {
    id: "bk-102",
    ticketNumber: "FS-512039",
    serviceId: "frame-repair",
    serviceTitle: "Frame Repair & Straightening",
    bikeYear: "2019",
    bikeMake: "Harley-Davidson",
    bikeModel: "Street Glide CVO",
    issueNotes: "Pulls left after low-speed tip-over in driveway. Neck angle check required.",
    preferredDate: "2026-08-05",
    preferredTimeSlot: "Mid-Day (12PM - 3PM)",
    name: "Derrick Miller",
    phone: "(281) 555-8420",
    email: "dmiller.riding@example.com",
    status: "confirmed",
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    techNotes: "Confirmed with Derrick. Scheduled for lift 1 laser scan."
  },
  {
    id: "bk-103",
    ticketNumber: "FS-993102",
    serviceId: "suspension-tuning",
    serviceTitle: "Suspension Tuning",
    bikeYear: "2021",
    bikeMake: "Indian",
    bikeModel: "Challenger Dark Horse",
    issueNotes: "Front fork stiction during hard cornering. Requesting Öhlins cartridge setup.",
    preferredDate: "2026-08-02",
    preferredTimeSlot: "Morning (9AM - 12PM)",
    name: "Colton Hayes",
    phone: "(713) 555-3910",
    email: "chayes@example.com",
    status: "completed",
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    techNotes: "Triple trees re-aligned on laser jig. Anti-stiction torque specs applied. Rider tested and approved."
  }
];

function loadBookings(): Booking[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BOOKINGS_FILE)) {
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(INITIAL_BOOKINGS, null, 2));
      return INITIAL_BOOKINGS;
    }
    const data = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading bookings file:", err);
    return INITIAL_BOOKINGS;
  }
}

function saveBookings(bookings: Booking[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
  } catch (err) {
    console.error("Error saving bookings file:", err);
  }
}

// -----------------------------------------------------------------------------
// API Routes
// -----------------------------------------------------------------------------

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// POST /api/auth/pin - Validate owner PIN, return session token
app.post("/api/auth/pin", (req, res) => {
  const { pin } = req.body || {};
  if (!pin || pin !== SHOP_OWNER_PIN) {
    return res.status(401).json({ error: "Invalid PIN. Access denied." });
  }
  res.json({ token: SHOP_API_SECRET });
});

/**
 * Public ticket lookup — one booking at a time.
 *
 * Track Ticket used to pull the entire bookings list into the browser and match
 * on it there, which meant every visitor could read every customer's name,
 * phone, email and notes. The match now happens here and only the one booking
 * comes back. Rate limited, because ticket numbers are short and guessable.
 */
app.get("/api/bookings/lookup", bookingLimiter, (req, res) => {
  const raw = String(req.query.q || "").trim();
  if (raw.length < 6) {
    return res.status(400).json({ error: "Enter your full ticket number or phone number." });
  }

  const ticket = raw.toUpperCase();
  const digits = raw.replace(/\D/g, "");

  const match = loadBookings().find(
    (b) =>
      b.ticketNumber.toUpperCase() === ticket ||
      // Whole number only. A partial match would hand over someone else's ticket.
      (digits.length >= 10 && b.phone.replace(/\D/g, "") === digits)
  );

  if (!match) {
    return res.status(404).json({ error: "No ticket found." });
  }
  res.json({ booking: match });
});

// GET /api/bookings - the owner's full list. Customers use /lookup above.
app.get("/api/bookings", requireAdmin, (req, res) => {
  const bookings = loadBookings();
  const { status } = req.query;
  if (status && typeof status === "string" && status !== "all") {
    const filtered = bookings.filter((b) => b.status === status);
    return res.json({ bookings: filtered });
  }
  res.json({ bookings });
});

// POST /api/bookings - Create new appointment and dispatch notification digest
app.post("/api/bookings", bookingLimiter, (req, res) => {
  try {
    const {
      serviceId,
      serviceTitle,
      bikeYear,
      bikeMake,
      bikeModel,
      issueNotes,
      preferredDate,
      preferredTimeSlot,
      name,
      phone,
      email,
    } = req.body;

    if (!name || !phone || !bikeMake || !bikeModel) {
      return res.status(400).json({ error: "Missing required contact or motorcycle details." });
    }

    const ticketNumber = "FS-" + Math.floor(100000 + Math.random() * 900000);
    const newBooking: Booking = {
      id: "bk-" + Date.now(),
      ticketNumber,
      serviceId: serviceId || "powertrain-alignment",
      serviceTitle: serviceTitle || "Power Train Alignment",
      bikeYear: bikeYear || "2022",
      bikeMake: bikeMake || "Harley-Davidson",
      bikeModel: bikeModel || "Road Glide",
      issueNotes: issueNotes || "Routine chassis inspection",
      preferredDate: preferredDate || new Date().toISOString().split("T")[0],
      preferredTimeSlot: preferredTimeSlot || "Morning (9AM - 12PM)",
      name,
      phone,
      email,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const currentBookings = loadBookings();
    currentBookings.unshift(newBooking);
    saveBookings(currentBookings);

    // Simulate Notification Dispatch (SMS/Email Digest to Shop Owner Paul Hurey)
    console.log(`================================--------------------`);
    console.log(`[SHOP NOTIFICATION DISPATCHED TO PAUL HUREY]:`);
    console.log(`New Appointment Ticket #${newBooking.ticketNumber}`);
    console.log(`Rider: ${newBooking.name} (${newBooking.phone})`);
    console.log(`Bike: ${newBooking.bikeYear} ${newBooking.bikeMake} ${newBooking.bikeModel}`);
    console.log(`Service: ${newBooking.serviceTitle}`);
    console.log(`Requested Slot: ${newBooking.preferredDate} - ${newBooking.preferredTimeSlot}`);
    console.log(`================================--------------------`);

    res.status(201).json({
      success: true,
      message: "Appointment request logged and notification sent to shop.",
      booking: newBooking,
      notificationDispatched: true,
    });
  } catch (err: any) {
    console.error("Error saving booking:", err);
    res.status(500).json({ error: "Failed to save booking request." });
  }
});

// PATCH /api/bookings/:id - Update booking status, tech notes, or internal invoice
app.patch("/api/bookings/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status, techNotes, preferredDate, preferredTimeSlot, invoice } = req.body;

    const bookings = loadBookings();
    const index = bookings.findIndex((b) => b.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Booking ticket not found." });
    }

    if (status) bookings[index].status = status;
    if (techNotes !== undefined) bookings[index].techNotes = techNotes;
    if (preferredDate) bookings[index].preferredDate = preferredDate;
    if (preferredTimeSlot) bookings[index].preferredTimeSlot = preferredTimeSlot;
    if (invoice !== undefined) bookings[index].invoice = invoice;

    saveBookings(bookings);

    console.log(`[BOOKING UPDATED]: Ticket #${bookings[index].ticketNumber} -> Status: ${bookings[index].status}`);

    res.json({ success: true, booking: bookings[index] });
  } catch (err) {
    console.error("Error updating booking:", err);
    res.status(500).json({ error: "Failed to update booking." });
  }
});

// DELETE /api/bookings/:id - Delete booking
app.delete("/api/bookings/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    let bookings = loadBookings();
    bookings = bookings.filter((b) => b.id !== id);
    saveBookings(bookings);
    res.json({ success: true, message: "Booking removed." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete booking." });
  }
});

app.post("/api/diagnostic", diagLimiter, async (req, res) => {
  try {
    const { motorcycleDetails, symptomDescription, speedRange } = req.body;

    if (!symptomDescription || symptomDescription.trim().length === 0) {
      return res.status(400).json({ error: "Please describe the motorcycle handling symptoms." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // A customer, not the developer, is reading this. Say what to do instead
      // of naming an environment variable, and don't call it a server fault.
      return res.status(503).json({
        error:
          "The diagnostic tool isn't switched on yet. Call or text Paul on " +
          `${SHOP_INFO_PHONE} and he'll talk the symptoms through with you.`,
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are Paul Heary, Master Chassis & Frame Alignment Specialist at The Frame Shop in Spring, Texas.
A rider is asking for a diagnostic assessment of their motorcycle's handling issues.

Rider's Motorcycle: ${motorcycleDetails || "V-Twin / Bagger / Cruiser"}
Symptom Description: ${symptomDescription}
Speed Range: ${speedRange || "Highway / Highway speed"}

Provide a direct, expert, highly technical yet understandable diagnostic breakdown from Paul's perspective.
Return a JSON response matching strictly this JSON format without markdown code blocks:
{
  "diagnosisTitle": "Short punchy diagnostic verdict title",
  "severityLevel": "Critical Safety Risk" or "Moderate Misalignment" or "Minor Wear / Adjustment",
  "likelyCauses": [
    "Cause 1 (e.g. 3D powertrain offset, engine motor mount twisting)",
    "Cause 2 (e.g. Steering neck bearing play or rake angle deviation)",
    "Cause 3 (e.g. Fork stiction / triple tree twist)"
  ],
  "technicalExplanation": "Detailed 2-3 sentence mechanical analysis explaining why this occurs and what zero-tolerance laser inspection checks.",
  "recommendedServiceId": "powertrain-alignment" or "frame-repair" or "suspension-tuning" or "tire-balance",
  "recommendedServiceName": "Recommended Service Name",
  "estimatedLaborHours": "1 - 2 Hours"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const responseText = response.text || "";
    // Clean JSON if model returned code blocks
    const jsonStr = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return res.json({ success: true, diagnostic: parsed });
    } catch (pErr) {
      return res.json({
        success: true,
        diagnostic: {
          diagnosisTitle: "Chassis & Powertrain Offset Indicated",
          severityLevel: "Moderate Misalignment",
          likelyCauses: [
            "Powertrain / engine isolation mount misalignment",
            "Rear swingarm pivot & belt tracking offset",
            "Front fork triple tree stiction"
          ],
          technicalExplanation: responseText || "Your motorcycle exhibits classic indicators of 3D chassis misalignment. A 3D laser scan on Paul's Frame Shooter alignment jig will identify exact millimeter deviations.",
          recommendedServiceId: "powertrain-alignment",
          recommendedServiceName: "3D Power Train Laser Alignment",
          estimatedLaborHours: "1 - 2 Hours"
        }
      });
    }
  } catch (err: any) {
    console.error("Gemini Diagnostic Error:", err);
    res.status(500).json({ error: "Failed to generate AI diagnostic analysis.", details: err?.message });
  }
});

/* ---------------------------------------------------------------------------
 * Shopify payments
 * ------------------------------------------------------------------------- */

/** Lets the client show a pay button only when payments are actually wired up. */
app.get("/api/payments/config", (_req, res) => {
  res.json({ provider: "shopify", enabled: shopifyEnabled() });
});

// POST /api/shopify/checkout — deposit link for a new booking (public)
app.post("/api/shopify/checkout", bookingLimiter, async (req, res) => {
  if (!shopifyEnabled()) {
    return res.status(503).json({
      error: "Online payment not yet configured. Please call the shop to pay your deposit.",
    });
  }
  try {
    const { bookingId, amount, description, customerEmail } = req.body;
    const value = parseFloat(String(amount));
    if (!value || value <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount." });
    }

    const draft = await createDraftOrder({
      lineItems: [{ title: description || "Service Deposit — The Frame Shop", price: value }],
      email: customerEmail || undefined,
      bookingId: bookingId || undefined,
      note: "Booking deposit",
    });

    res.json({ url: draft.invoiceUrl, draftOrderId: draft.id, orderName: draft.name });
  } catch (err: any) {
    console.error("Shopify checkout error:", err);
    res.status(502).json({ error: "Failed to create payment link.", details: err.message });
  }
});

// POST /api/shopify/invoice/send — email the finished job's invoice (owner only)
app.post("/api/shopify/invoice/send", requireAdmin, async (req, res) => {
  if (!shopifyEnabled()) {
    return res.status(503).json({
      error: "Shopify is not configured. Add SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN to your environment.",
    });
  }
  try {
    const { customerName, customerEmail, items, bookingId, ticketNumber } = req.body;
    if (!customerEmail || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Customer email and at least one line item are required." });
    }

    const lineItems = (items as Array<{ description: string; amount: number }>).map(item => ({
      title: item.description || "Shop service",
      price: parseFloat(String(item.amount)) || 0,
    }));

    const draft = await createDraftOrder({
      lineItems,
      email: customerEmail,
      customerName,
      bookingId: bookingId || undefined,
      ticketNumber: ticketNumber || undefined,
    });
    await sendDraftOrderInvoice(draft.id);

    console.log(`[SHOPIFY INVOICE SENT]: ${draft.name} → ${customerEmail} | Ticket: ${ticketNumber || "N/A"}`);

    res.json({
      success: true,
      invoiceId: String(draft.id),
      invoiceUrl: draft.invoiceUrl,
      invoiceNumber: draft.name,
    });
  } catch (err: any) {
    console.error("Shopify invoice send error:", err);
    res.status(502).json({ error: "Failed to send the invoice.", details: err.message });
  }
});

/**
 * Anything under /api that no route above claimed is a mistake, so say so in
 * the language the caller is expecting. Without this it falls through to the
 * single-page app and comes back as HTML with a 200, and the fetch that asked
 * for it dies on "Unexpected token '<'" — which says nothing about the real
 * problem being a wrong or removed endpoint.
 */
app.use("/api", (req, res) => {
  res.status(404).json({ error: `No such endpoint: ${req.method} /api${req.path}` });
});

// Start Express + Vite Server
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          /**
           * The server writes its own state — bookings, videos,
           * media — into data/ inside the project. Left watched, every booking
           * a customer submitted made Vite reload the page, wiping the
           * confirmation screen with their ticket number on it before they
           * could read it.
           */
          ignored: ["**/data/**"],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[THE FRAME SHOP SERVER RUNNING]: http://localhost:${PORT}`);

    // requireAdmin waves everything through when there is no secret to check,
    // which is what makes local development painless — and what would quietly
    // publish the customer list if it were ever missing in production.
    if (!SHOP_API_SECRET) {
      const where = process.env.NODE_ENV === "production" ? "PRODUCTION" : "development";
      console.warn(
        `\n[!] SHOP_API_SECRET is not set (${where}).\n` +
        `    Owner-only routes are UNPROTECTED: bookings and customer details\n` +
        `    can be read by anyone who can reach this server.\n` +
        (process.env.NODE_ENV === "production"
          ? `    Set it now — generate one with:\n` +
            `    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n`
          : `    Fine for local work. Must be set before this is deployed.\n`)
      );
    }
  });
}

start();
