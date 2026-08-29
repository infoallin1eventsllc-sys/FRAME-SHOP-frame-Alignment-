import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY     || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_URL               = process.env.APP_URL               || `http://localhost:${PORT}`;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production",
}));

// Stripe webhook needs the raw request body — must be registered BEFORE express.json()
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(200).json({ received: true });
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      const bks = loadBookings();
      const idx = bks.findIndex((b) => b.id === bookingId);
      if (idx !== -1 && bks[idx].invoice) {
        bks[idx].invoice!.paymentStatus = "deposit_paid";
        saveBookings(bks);
      }
    }
  }

  if (event.type === "invoice.paid") {
    const inv = event.data.object as Stripe.Invoice;
    const bookingId = (inv.metadata as any)?.bookingId;
    if (bookingId) {
      const bks = loadBookings();
      const idx = bks.findIndex((b) => b.id === bookingId);
      if (idx !== -1 && bks[idx].invoice) {
        bks[idx].invoice!.paymentStatus = "paid_in_full";
        saveBookings(bks);
      }
    }
  }

  res.json({ received: true });
});

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

// In-memory + local JSON file persistence for appointment bookings & transactions
const DATA_DIR = path.join(process.cwd(), "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");
const TRANSACTIONS_FILE = path.join(DATA_DIR, "transactions.json");
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

export interface TransactionLineItem {
  id: string;
  description: string;
  category: "labor" | "parts" | "laser_scan" | "supplies" | "sublet" | "deposit";
  quantity: number;
  rate: number;
  amount: number;
}

export interface Transaction {
  id: string;
  timestamp: string;
  type: "work_order_payment" | "service_deposit" | "laser_scan_walkin" | "parts_sale" | "custom_fabrication";
  bookingId?: string;
  ticketNumber?: string;
  invoiceNumber?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  motorcycle: string;
  items: TransactionLineItem[];
  subtotal: number;
  shopSuppliesAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeGiven: number;
  paymentMethod: "card" | "cash" | "check" | "split" | "bnpl";
  paymentDetails?: {
    cardBrand?: string;
    cardLast4?: string;
    authCode?: string;
    checkNumber?: string;
    splitCashAmount?: number;
    splitCardAmount?: number;
    notes?: string;
  };
  status: "completed" | "refunded" | "voided";
  processedBy: string;
  refundReason?: string;
  refundTimestamp?: string;
}

// Initial mock seed transactions
const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "TXN-882031",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    type: "work_order_payment",
    bookingId: "bk-103",
    ticketNumber: "FS-993102",
    invoiceNumber: "INV-993102",
    customerName: "Colton Hayes",
    customerPhone: "(713) 555-3910",
    customerEmail: "chayes@example.com",
    motorcycle: "2021 Indian Challenger Dark Horse",
    items: [
      {
        id: "li-1",
        description: "Triple Tree Alignment & Fork Stiction Anti-Bind Calibration",
        category: "labor",
        quantity: 2.0,
        rate: 125.0,
        amount: 250.0,
      },
      {
        id: "li-2",
        description: "Performance Fork Fluid & Anti-Stiction Seal Kit",
        category: "parts",
        quantity: 1,
        rate: 55.0,
        amount: 55.0,
      },
    ],
    subtotal: 305.0,
    shopSuppliesAmount: 15.25,
    taxAmount: 26.42,
    totalAmount: 346.67,
    amountPaid: 346.67,
    changeGiven: 0.0,
    paymentMethod: "card",
    paymentDetails: {
      cardBrand: "Visa",
      cardLast4: "4920",
      authCode: "AUTH-89210",
      notes: "Customer swiped card on shop terminal."
    },
    status: "completed",
    processedBy: "Paul Heary (Owner)"
  },
  {
    id: "TXN-104922",
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
    type: "laser_scan_walkin",
    customerName: "Brad 'Gator' Vance",
    customerPhone: "(281) 555-9012",
    customerEmail: "gator.vance@example.com",
    motorcycle: "2023 Harley-Davidson Street Glide ST 117",
    items: [
      {
        id: "li-walk-1",
        description: "Express Walk-In 3D Laser Alignment & Frame Shooter Geometry Scan",
        category: "laser_scan",
        quantity: 1,
        rate: 75.0,
        amount: 75.0,
      }
    ],
    subtotal: 75.0,
    shopSuppliesAmount: 3.75,
    taxAmount: 6.50,
    totalAmount: 85.25,
    amountPaid: 100.0,
    changeGiven: 14.75,
    paymentMethod: "cash",
    paymentDetails: {
      notes: "Cash payment. $100 bill tendered, $14.75 change given from register."
    },
    status: "completed",
    processedBy: "Paul Heary (Owner)"
  }
];

function loadTransactions(): Transaction[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(TRANSACTIONS_FILE)) {
      fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(INITIAL_TRANSACTIONS, null, 2));
      return INITIAL_TRANSACTIONS;
    }
    const data = fs.readFileSync(TRANSACTIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading transactions file:", err);
    return INITIAL_TRANSACTIONS;
  }
}

function saveTransactions(transactions: Transaction[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  } catch (err) {
    console.error("Error saving transactions file:", err);
  }
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

// GET /api/bookings - Fetch all appointments
app.get("/api/bookings", (req, res) => {
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

// -----------------------------------------------------------------------------
// Transaction / POS API Routes
// -----------------------------------------------------------------------------

// GET /api/transactions - Retrieve transaction history
app.get("/api/transactions", (req, res) => {
  try {
    const transactions = loadTransactions();
    const { status, type } = req.query;
    let filtered = transactions;
    if (status && typeof status === "string" && status !== "all") {
      filtered = filtered.filter((t) => t.status === status);
    }
    if (type && typeof type === "string" && type !== "all") {
      filtered = filtered.filter((t) => t.type === type);
    }
    res.json({ transactions: filtered });
  } catch (err) {
    res.status(500).json({ error: "Failed to load transaction ledger." });
  }
});

// POST /api/transactions - Process & record new customer payment transaction
app.post("/api/transactions", requireAdmin, (req, res) => {
  try {
    const {
      type,
      bookingId,
      ticketNumber,
      invoiceNumber,
      customerName,
      customerPhone,
      customerEmail,
      motorcycle,
      items,
      subtotal,
      shopSuppliesAmount,
      taxAmount,
      totalAmount,
      amountPaid,
      changeGiven,
      paymentMethod,
      paymentDetails,
    } = req.body;

    if (!customerName || !items || !totalAmount || !paymentMethod) {
      return res.status(400).json({ error: "Missing required transaction fields." });
    }

    const txnId = "TXN-" + Math.floor(100000 + Math.random() * 900000);
    const newTxn: Transaction = {
      id: txnId,
      timestamp: new Date().toISOString(),
      type: type || "work_order_payment",
      bookingId,
      ticketNumber,
      invoiceNumber,
      customerName,
      customerPhone: customerPhone || "N/A",
      customerEmail: customerEmail || "N/A",
      motorcycle: motorcycle || "Customer Bike",
      items,
      subtotal: parseFloat(subtotal) || 0,
      shopSuppliesAmount: parseFloat(shopSuppliesAmount) || 0,
      taxAmount: parseFloat(taxAmount) || 0,
      totalAmount: parseFloat(totalAmount) || 0,
      amountPaid: parseFloat(amountPaid) || parseFloat(totalAmount) || 0,
      changeGiven: parseFloat(changeGiven) || 0,
      paymentMethod,
      paymentDetails,
      status: "completed",
      processedBy: "Paul Heary (Owner)",
    };

    const txns = loadTransactions();
    txns.unshift(newTxn);
    saveTransactions(txns);

    // If associated with a booking work order, update booking invoice status
    if (bookingId) {
      const bookings = loadBookings();
      const bIdx = bookings.findIndex((b) => b.id === bookingId);
      if (bIdx !== -1) {
        const newStatus = type === "service_deposit" ? "deposit_paid" : "paid_in_full";
        if (bookings[bIdx].invoice) {
          bookings[bIdx].invoice!.paymentStatus = newStatus;
        }
        if (newStatus === "paid_in_full" && bookings[bIdx].status === "in_shop") {
          bookings[bIdx].status = "completed";
        }
        saveBookings(bookings);
      }
    }

    console.log(`================================--------------------`);
    console.log(`[CUSTOMER TRANSACTION PROCESSED - THE FRAME SHOP]:`);
    console.log(`Txn ID: ${newTxn.id} | Amount: $${newTxn.totalAmount.toFixed(2)} | Method: ${newTxn.paymentMethod.toUpperCase()}`);
    console.log(`Rider: ${newTxn.customerName} (${newTxn.motorcycle})`);
    console.log(`================================--------------------`);

    res.status(201).json({
      success: true,
      message: "Customer payment transaction executed and recorded successfully.",
      transaction: newTxn,
    });
  } catch (err: any) {
    console.error("Error logging transaction:", err);
    res.status(500).json({ error: "Failed to record customer transaction." });
  }
});

// PATCH /api/transactions/:id/refund - Issue refund or void transaction
app.patch("/api/transactions/:id/refund", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const txns = loadTransactions();
    const idx = txns.findIndex((t) => t.id === id);

    if (idx === -1) {
      return res.status(404).json({ error: "Transaction record not found." });
    }

    txns[idx].status = "refunded";
    txns[idx].refundReason = reason || "Customer requested refund / service adjustment.";
    txns[idx].refundTimestamp = new Date().toISOString();

    saveTransactions(txns);

    console.log(`[TRANSACTION REFUNDED]: ${id} -> Reason: ${txns[idx].refundReason}`);

    res.json({ success: true, transaction: txns[idx] });
  } catch (err) {
    res.status(500).json({ error: "Failed to process refund." });
  }
});

// POST /api/diagnostic - AI Motorcycle Chassis & Handling Diagnostics powered by Gemini
app.post("/api/diagnostic", diagLimiter, async (req, res) => {
  try {
    const { motorcycleDetails, symptomDescription, speedRange } = req.body;

    if (!symptomDescription || symptomDescription.trim().length === 0) {
      return res.status(400).json({ error: "Please describe the motorcycle handling symptoms." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured.",
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

// -----------------------------------------------------------------------------
// Stripe Payment Routes
// -----------------------------------------------------------------------------

// POST /api/stripe/checkout — Create Stripe Checkout session for booking deposit
app.post("/api/stripe/checkout", bookingLimiter, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Online payment not yet configured. Please call the shop to pay your deposit." });
  }
  try {
    const { bookingId, amount, description, customerEmail } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount." });
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: customerEmail || undefined,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: description || "Service Deposit – The Frame Shop" },
          unit_amount: Math.round(parseFloat(amount) * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${APP_URL}?deposit=success&booking=${bookingId || ""}`,
      cancel_url: `${APP_URL}?deposit=cancelled`,
      metadata: { bookingId: bookingId || "" },
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: "Failed to create payment session.", details: err.message });
  }
});

// POST /api/stripe/invoice/send — Create & email a Stripe invoice to a customer (owner only)
app.post("/api/stripe/invoice/send", requireAdmin, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to your environment." });
  }
  try {
    const { customerName, customerEmail, items, dueDays, bookingId, ticketNumber } = req.body;
    if (!customerEmail || !items?.length) {
      return res.status(400).json({ error: "Customer email and at least one line item are required." });
    }

    // Find or create the Stripe customer record
    const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
    let customerId: string;
    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
      if (customerName) await stripe.customers.update(customerId, { name: customerName });
    } else {
      const cust = await stripe.customers.create({ name: customerName || customerEmail, email: customerEmail });
      customerId = cust.id;
    }

    // Create the invoice shell
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: dueDays || 30,
      description: ticketNumber ? `The Frame Shop – Work Order ${ticketNumber}` : "The Frame Shop – Service Invoice",
      metadata: { bookingId: bookingId || "" },
      footer: "Thank you for trusting The Frame Shop with your motorcycle. Zero Tolerance. Pure Alignment.",
    });

    // Add each line item
    for (const item of items as Array<{ description: string; amount: number }>) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: Math.round(parseFloat(String(item.amount)) * 100),
        currency: "usd",
        description: item.description,
      });
    }

    // Finalize then send — customer receives an email with a Pay Now link
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(finalized.id);

    console.log(`[STRIPE INVOICE SENT]: ${finalized.id} → ${customerEmail} | Ticket: ${ticketNumber || "N/A"}`);

    res.json({
      success: true,
      invoiceId: finalized.id,
      invoiceUrl: finalized.hosted_invoice_url,
      invoiceNumber: finalized.number,
    });
  } catch (err: any) {
    console.error("Stripe invoice send error:", err);
    res.status(500).json({ error: "Failed to send Stripe invoice.", details: err.message });
  }
});

// Start Express + Vite Server
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
  });
}

start();
