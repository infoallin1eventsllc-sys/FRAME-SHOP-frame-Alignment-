// Must come first: every const below reads process.env at module load, so the
// .env file has to be in place before any of them are evaluated. Without this
// the file is ignored entirely and only real shell variables are ever seen.
import "dotenv/config";

import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import {
  shopifyEnabled,
  createDraftOrder,
  sendDraftOrderInvoice,
  verifyWebhook,
  bookingIdFromOrder,
  applyPayment,
  type PaymentRecord,
} from "./shopify";
import { writeJsonAtomic, readJsonWithRecovery } from "./storage";
import { SERVICES as PUBLIC_SERVICE_PRICES, SHOP_INFO } from "./src/data/shopData";
import { acceptInvoice, recomputePayments, balanceDue, shopifyCharge } from "./invoice";
import { renderInvoicePdf } from "./invoicePdf";
import { emailEnabled, sendEmail, looksLikeEmail } from "./mailer";
import { registerMarketing } from "./marketing";
import { SITE_PAGES, isKnownPage } from "./src/data/routes";
import { logEvent, errorFields, alertsConfigured } from "./logger";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

/** Kept in step with SHOP_INFO.phone in src/data/shopData.ts. */
const SHOP_INFO_PHONE = "(832) 628-5226";


/**
 * Helmet's default policy only lets the page load from this server, which on
 * the live site blanked every photo, embedded video and the map. Each outside
 * source the page really uses is named here, and nothing else.
 */
const SUPABASE_ORIGIN = (() => {
  try { return process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : null; }
  catch { return null; }
})();
const withSupabase = (list: string[]) => (SUPABASE_ORIGIN ? [...list, SUPABASE_ORIGIN] : list);

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" && {
    directives: {
      // Stock photos, YouTube thumbnails, and Paul's own uploads (data: / blob:).
      "img-src": withSupabase(["'self'", "data:", "blob:", "https://images.unsplash.com", "https://i.ytimg.com"]),
      // Video files Paul uploads are played from his storage bucket.
      "media-src": withSupabase(["'self'", "blob:"]),
      // YouTube and Vimeo players, and the map once a visitor asks for it.
      "frame-src": [
        "https://www.youtube-nocookie.com", "https://www.youtube.com",
        "https://player.vimeo.com", "https://www.google.com",
      ],
    },
  },
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
/**
 * Behind a host's load balancer — Railway, Render, Vercel — every request
 * arrives from the balancer's address. Without this, req.ip is that one
 * address for every visitor, so the per-IP rate limits below become limits on
 * the whole site: the eleventh booking in any minute, from anyone, refused.
 *
 * It must be the number of proxy hops, never `true`. `true` believes whatever
 * X-Forwarded-For a client sends, so anyone could claim a fresh address per
 * request and walk straight past the limiter. One hop is right for the hosts
 * above. Off outside production, where there is no proxy and a trusted header
 * would be the client's own invention.
 */
const TRUST_PROXY_HOPS = process.env.TRUST_PROXY !== undefined
  ? Number(process.env.TRUST_PROXY) || 0
  : process.env.NODE_ENV === "production" ? 1 : 0;
app.set("trust proxy", TRUST_PROXY_HOPS);

// gzip every response big enough to benefit. The JavaScript bundle is 767 KB
// raw and 223 KB compressed, and a customer on a phone downloads all of it.
app.use(compression());

app.post("/api/shopify/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const hmac = String(req.headers["x-shopify-hmac-sha256"] || "");
  if (!verifyWebhook(req.body as Buffer, hmac)) {
    logEvent("warn", "shopify.webhook.bad_signature");
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
    if (idx === -1) {
      // Paid for a booking that is no longer on file. Money came in, so this
      // must reach a person rather than vanish.
      logEvent("error", "shopify.payment.unmatched", { order: order.name, bookingId });
      return;
    }

    // No invoice yet (a deposit): hold the payment on the booking. It moves
    // onto the invoice when Paul creates one.
    const target = bks[idx].invoice ?? { totalAmount: 0, paymentStatus: "unpaid" as const, payments: (bks[idx].prepayments ??= []) };

    // Accumulates across orders (deposit, then balance) and ignores an order
    // already recorded, so a retried webhook cannot count a payment twice.
    const result = applyPayment(target, order);
    if (!result.applied) {
      logEvent("info", "shopify.payment.retry_ignored", { order: order.name, bookingId });
      return;
    }
    saveBookings(bks);
    logEvent("info", "shopify.payment.recorded", { order: order.name, bookingId, amountPaid: result.amountPaid, status: result.status });
  } catch (err) {
    // The 200 has already gone back to Shopify, so it will not retry: this log
    // line (and the alert it raises) is the only record the payment was missed.
    logEvent("error", "shopify.webhook.failed", errorFields(err));
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

// Per visitor per minute. Overridable so a test run — every request from one
// address — does not trip limits meant for many different customers.
const diagLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.DIAGNOSTIC_RATE_LIMIT) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many diagnostic requests. Please wait a moment and try again." },
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.BOOKING_RATE_LIMIT) || 10,
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
        // A 200 MB clip on a slow link takes a while; ten minutes is generous,
        // and still stops a stalled upload holding the connection forever.
        signal: AbortSignal.timeout(10 * 60_000),
      });

      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => "");
        logEvent("error", "video.upload.rejected", { status: upstream.status, detail });
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
      logEvent("error", "video.upload.failed", errorFields(err));
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
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
        signal: AbortSignal.timeout(15_000),
      }
    );
    // A file already gone is a success from the caller's point of view.
    if (!upstream.ok && upstream.status !== 404) {
      return res.status(502).json({ error: "Storage rejected the delete." });
    }
    res.json({ ok: true });
  } catch (err) {
    logEvent("error", "video.delete.failed", errorFields(err));
    res.status(500).json({ error: "Could not reach storage." });
  }
});

// In-memory + local JSON file persistence for appointment bookings
// Where bookings, invoices, messages and settings live. On a host this must be
// a permanent disk (a Railway/Render volume) — anything else is wiped on every
// deploy. DATA_DIR points at it; locally it defaults to ./data.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
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
    return readJsonWithRecovery<ShopVideoRecord[]>(VIDEOS_FILE, {
      whenMissing: [],
      valid: (v): v is ShopVideoRecord[] => Array.isArray(v),
    }).data;
  } catch (err) {
    // The public video list is not worth taking the page down over.
    logEvent("error", "videos.unreadable", { message: (err as Error).message });
    return [];
  }
}

function writeVideos(list: ShopVideoRecord[]) {
  writeJsonAtomic(VIDEOS_FILE, list, { backups: 5 });
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
    return readJsonWithRecovery<SiteMedia>(MEDIA_FILE, {
      whenMissing: {},
      valid: (v): v is SiteMedia => !!v && typeof v === "object" && !Array.isArray(v),
    }).data;
  } catch (err) {
    logEvent("error", "media.unreadable", { message: (err as Error).message });
    return {};
  }
}

function writeMedia(media: SiteMedia) {
  writeJsonAtomic(MEDIA_FILE, media, { backups: 5 });
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
    logEvent("error", "media.write.failed", errorFields(err));
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
    logEvent("error", "videos.write.failed", errorFields(err));
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
  /** Every Shopify order applied to this invoice, keyed by order id. */
  payments?: PaymentRecord[];
  /** Sum of payments. Optional so bookings saved before the ledger still load. */
  amountPaid?: number;
  internalOwnerNotes?: string;
}

interface Booking {
  id: string;
  ticketNumber: string;
  /** The key the form sent; a repeat of it returns this booking, not a new one. */
  idempotencyKey?: string;
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
  /**
   * Payments received before an invoice exists — the online deposit, usually.
   * They used to be dropped: the webhook ignored any booking without an
   * invoice, so a paid deposit was never recorded and the final invoice
   * charged the full amount again. They move onto the invoice when it is made.
   */
  prepayments?: PaymentRecord[];
  /** Every time the invoice PDF was emailed: to whom, when, and the balance it showed. */
  invoiceEmails?: { to: string; at: string; balanceDue: number; id?: string }[];
  /** "How did you hear about us?" — optional, from the booking form. */
  source?: string;
  /** Set when the status first becomes completed. */
  completedAt?: string;
  /** When the review-request email went out, so it is only ever sent once. */
  reviewRequestedAt?: string;
  /**
   * Present only when the customer ticked the (unticked-by-default) box to hear
   * about offers. Keeps the exact words they agreed to and when, because that
   * record is what consent actually rests on. Absent means no.
   */
  marketingConsent?: { given: true; at: string; wording: string };
}




// A new install starts with no bookings. It used to start with three invented
// customers — names, phone numbers, bikes — which would have been the first
// thing Paul saw in his portal on the live site.
const INITIAL_BOOKINGS: Booking[] = [];

// Twenty rolling snapshots: enough to step back past a burst of edits, and at a
// few KB each, negligible on disk.
const BOOKING_BACKUPS = 20;

function loadBookings(): Booking[] {
  const { data, source } = readJsonWithRecovery<Booking[]>(BOOKINGS_FILE, {
    whenMissing: INITIAL_BOOKINGS,
    valid: (v): v is Booking[] => Array.isArray(v),
  });
  if (source === "missing") {
    writeJsonAtomic(BOOKINGS_FILE, data);
  } else if (source !== "file") {
    // Recovered, not read. Say so loudly, and heal the live file.
    logEvent("error", "bookings.recovered", { from: source, count: data.length });
    writeJsonAtomic(BOOKINGS_FILE, data, { backups: BOOKING_BACKUPS });
  }
  return data;
}

/**
 * Throws on failure. It used to log and carry on, so a booking that was never
 * written still came back to the customer as confirmed, with a ticket number.
 */
function saveBookings(bookings: Booking[]) {
  writeJsonAtomic(BOOKINGS_FILE, bookings, { backups: BOOKING_BACKUPS });
}

/** A trimmed, length-capped string from untrusted input; "" for anything else. */
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// -----------------------------------------------------------------------------
// API Routes
// -----------------------------------------------------------------------------

// Health Check
/**
 * What an uptime monitor polls. It used to answer "ok" unconditionally, so a
 * monitor would have called the site healthy with the bookings file unreadable
 * or the disk full — the two failures that actually lose customers. Now it
 * checks both, and answers 503 if either fails, which is what makes a monitor
 * raise the alarm.
 *
 * Deliberately says nothing about configuration: this route is public, and
 * "owner routes unprotected" is not something to announce to the internet.
 */
app.get("/api/health", (_req, res) => {
  const checks: Record<string, "ok" | "fail"> = {};

  try {
    loadBookings();
    checks.bookings = "ok";
  } catch {
    checks.bookings = "fail";
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const probe = path.join(DATA_DIR, `.health-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe, { force: true });
    checks.storage = "ok";
  } catch {
    checks.storage = "fail";
  }

  const healthy = Object.values(checks).every((c) => c === "ok");
  if (!healthy) logEvent("error", "health.failed", checks);
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    checks,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
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
/**
 * The owner's booking list. Pass ?limit= (and ?offset=) to page through it;
 * with neither, the whole list comes back, as it always has.
 *
 * Paging is opt-in rather than on by default because the owner portal filters
 * and searches the list in the browser. A default page size would silently hide
 * older bookings from Paul with nothing on screen to say so. `total` is always
 * returned, so a client that pages knows how far it has to go.
 */
const MAX_PAGE = 500;
app.get("/api/bookings", requireAdmin, (req, res) => {
  const { status, limit, offset } = req.query;
  let bookings = loadBookings();
  if (status && typeof status === "string" && status !== "all") {
    bookings = bookings.filter((b) => b.status === status);
  }
  const total = bookings.length;

  if (limit !== undefined) {
    const size = Math.min(Math.max(parseInt(String(limit), 10) || 0, 1), MAX_PAGE);
    const from = Math.max(parseInt(String(offset ?? "0"), 10) || 0, 0);
    return res.json({ bookings: bookings.slice(from, from + size), total, limit: size, offset: from });
  }
  res.json({ bookings, total });
});

/** The answers the booking form offers to "How did you hear about us?". Anything else is ignored. */
const BOOKING_SOURCES = ["Google search", "Google Maps", "Instagram", "Facebook", "TikTok", "Friend or another rider", "Returning customer", "Saw the shop", "Other"];

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
      idempotencyKey,
      marketingConsent,
      marketingConsentWording,
      source,
    } = req.body;

    if (!name || !phone || !bikeMake || !bikeModel) {
      return res.status(400).json({ error: "Missing required contact or motorcycle details." });
    }

    const key = typeof idempotencyKey === "string" && idempotencyKey.length <= 100 ? idempotencyKey : undefined;
    const currentBookings = loadBookings();

    // The same booking attempt, sent again — a double tap, or a retry after the
    // reply was lost on a bad signal. Hand back the booking already saved
    // rather than creating a second one with a second ticket number.
    if (key) {
      const existing = currentBookings.find((b) => b.idempotencyKey === key);
      if (existing) {
        logEvent("info", "booking.duplicate_ignored", { ticket: existing.ticketNumber });
        return res.status(200).json({ success: true, message: "Appointment request received.", booking: existing, duplicate: true });
      }
    }

    // Unique against every existing ticket. Six random digits give 900,000
    // numbers, which by the birthday bound is roughly even odds of a clash
    // within the first thousand bookings — and ticket lookup returns the first
    // match, so a clash would show one customer another customer's booking.
    const taken = new Set(currentBookings.map((b) => b.ticketNumber));
    let ticketNumber = "";
    do {
      ticketNumber = "FS-" + crypto.randomInt(100000, 1000000);
    } while (taken.has(ticketNumber));
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
      ...(key ? { idempotencyKey: key } : {}),
      ...(BOOKING_SOURCES.includes(source) ? { source } : {}),
      // Strictly true, never truthy: "yes", 1 or a missing field are not consent.
      ...(marketingConsent === true
        ? {
            marketingConsent: {
              given: true as const,
              at: new Date().toISOString(),
              wording: clean(marketingConsentWording, 500) || "Marketing consent (wording not supplied)",
            },
          }
        : {}),
    };

    currentBookings.unshift(newBooking);
    saveBookings(currentBookings);

    // No customer contact details here: host logs are kept, and searchable.
    logEvent("info", "booking.created", {
      ticket: newBooking.ticketNumber,
      service: newBooking.serviceTitle,
      date: newBooking.preferredDate,
    });

    res.status(201).json({
      success: true,
      message: "Appointment request received.",
      booking: newBooking,
      // Nothing is actually sent to Paul yet: no email or SMS service is wired
      // up. This used to say true, and the message said "notification sent to
      // shop", while the code only printed to the server console. Paul sees new
      // bookings only when he opens the owner portal.
      notificationDispatched: false,
    });
  } catch (err: any) {
    logEvent("error", "booking.save.failed", errorFields(err));
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

    if (status !== undefined) {
      if (!["pending", "confirmed", "in_shop", "completed", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Unknown status." });
      }
      if (status === "completed" && !bookings[index].completedAt) bookings[index].completedAt = new Date().toISOString();
      bookings[index].status = status;
    }
    if (techNotes !== undefined) bookings[index].techNotes = techNotes;
    if (preferredDate) bookings[index].preferredDate = preferredDate;
    if (preferredTimeSlot) bookings[index].preferredTimeSlot = preferredTimeSlot;
    if (invoice !== undefined) {
      if (!invoice || typeof invoice !== "object") {
        return res.status(400).json({ error: "Invalid invoice." });
      }
      // Totals are recomputed here and the payment ledger is kept from what is
      // on file — never taken from the browser, which may be holding a copy
      // from before a payment arrived.
      const b = bookings[index];
      b.invoice = acceptInvoice(invoice, [...(b.invoice?.payments ?? []), ...(b.prepayments ?? [])]) as InternalInvoice;
      delete b.prepayments;
    }

    saveBookings(bookings);

    logEvent("info", "booking.updated", { ticket: bookings[index].ticketNumber, status: bookings[index].status });

    res.json({ success: true, booking: bookings[index] });
  } catch (err) {
    logEvent("error", "booking.update.failed", errorFields(err));
    res.status(500).json({ error: "Failed to update booking." });
  }
});

// DELETE /api/bookings/:id - Delete booking
app.delete("/api/bookings/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const bookings = loadBookings();
    const index = bookings.findIndex((b) => b.id === id);

    // Without this check the route reported success for a ticket it never
    // deleted, and rewrote the whole file to do nothing. PATCH already 404s
    // on a missing id; DELETE now matches it.
    if (index === -1) {
      return res.status(404).json({ error: "Booking ticket not found." });
    }

    bookings.splice(index, 1);
    saveBookings(bookings);
    res.json({ success: true, message: "Booking removed." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete booking." });
  }
});

/* ---------------------------------------------------------------------------
 * Payments taken in the shop — cash, check, card on the shop's own reader.
 *
 * Payment status used to be a dropdown Paul could set to anything. It is now
 * worked out from the payments on record, so taking money in person needs a
 * way onto that record. Online (Shopify) payments arrive by webhook and cannot
 * be removed here; a payment entered by hand can, to correct a typing mistake.
 * ------------------------------------------------------------------------- */
const MANUAL_METHODS = ["cash", "check", "card_in_person", "other"] as const;

app.post("/api/bookings/:id/payments", requireAdmin, (req, res) => {
  try {
    const amount = Math.round(parseFloat(String(req.body?.amount)) * 100) / 100;
    const method = req.body?.method;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return res.status(400).json({ error: "Enter the amount received." });
    }
    if (!MANUAL_METHODS.includes(method)) {
      return res.status(400).json({ error: "Choose how it was paid." });
    }

    const bookings = loadBookings();
    const b = bookings.find((x) => x.id === req.params.id);
    if (!b) return res.status(404).json({ error: "Booking ticket not found." });

    const record: PaymentRecord = {
      orderId: `manual-${crypto.randomUUID()}`,
      orderName: method === "check" ? "Check" : method === "cash" ? "Cash" : method === "card_in_person" ? "Card (in shop)" : "Other",
      amount,
      paidAt: new Date().toISOString(),
      method,
      ...(typeof req.body?.note === "string" && req.body.note.trim() ? { note: req.body.note.trim().slice(0, 200) } : {}),
    };

    if (b.invoice) {
      (b.invoice.payments ??= []).push(record);
      recomputePayments(b.invoice);
    } else {
      (b.prepayments ??= []).push(record);
    }
    saveBookings(bookings);
    logEvent("info", "payment.recorded", { ticket: b.ticketNumber, method, amount });
    res.status(201).json({ success: true, booking: b });
  } catch (err) {
    logEvent("error", "payment.record.failed", errorFields(err));
    res.status(500).json({ error: "The payment could not be saved." });
  }
});

app.delete("/api/bookings/:id/payments/:paymentId", requireAdmin, (req, res) => {
  try {
    const bookings = loadBookings();
    const b = bookings.find((x) => x.id === req.params.id);
    if (!b) return res.status(404).json({ error: "Booking ticket not found." });

    const list = b.invoice ? (b.invoice.payments ??= []) : (b.prepayments ??= []);
    const i = list.findIndex((p) => p.orderId === req.params.paymentId);
    if (i === -1) return res.status(404).json({ error: "Payment not found." });
    if (!list[i].orderId.startsWith("manual-")) {
      return res.status(409).json({ error: "Online payments are recorded by Shopify. Refund them in Shopify instead." });
    }
    list.splice(i, 1);
    if (b.invoice) recomputePayments(b.invoice);
    saveBookings(bookings);
    res.json({ success: true, booking: b });
  } catch (err) {
    logEvent("error", "payment.delete.failed", errorFields(err));
    res.status(500).json({ error: "The payment could not be removed." });
  }
});

/* ---------------------------------------------------------------------------
 * The invoice as a PDF — to download, or to email to the customer.
 *
 * Without this the only way to get an invoice to a customer was Shopify. Now
 * Paul can email the PDF directly (replies go to the shop's inbox), or
 * download it to text, print or hand over himself.
 * ------------------------------------------------------------------------- */
function invoicePdfFor(b: Booking) {
  return renderInvoicePdf(
    b.invoice as any,
    { name: SHOP_INFO.name, address: SHOP_INFO.address, phone: SHOP_INFO.phone, email: SHOP_INFO.email },
    {
      name: b.name,
      phone: b.phone,
      email: b.email,
      ticketNumber: b.ticketNumber,
      bike: [b.bikeYear, b.bikeMake, b.bikeModel].filter(Boolean).join(" "),
    }
  );
}

const pdfName = (b: Booking) => `Invoice-${b.invoice!.invoiceNumber.replace(/[^\w-]+/g, "")}-TheFrameShop.pdf`;

app.get("/api/email/config", requireAdmin, (_req, res) => {
  res.json({ enabled: emailEnabled(), replyTo: process.env.INVOICE_REPLY_TO || SHOP_INFO.email });
});

app.get("/api/bookings/:id/invoice.pdf", requireAdmin, async (req, res) => {
  try {
    const b = loadBookings().find((x) => x.id === req.params.id);
    if (!b) return res.status(404).json({ error: "Booking ticket not found." });
    if (!b.invoice || b.invoice.items.length === 0) {
      return res.status(400).json({ error: "Save the invoice with at least one line first." });
    }
    const pdf = await invoicePdfFor(b);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pdfName(b)}"`);
    res.send(pdf);
  } catch (err) {
    logEvent("error", "invoice.pdf.failed", errorFields(err));
    res.status(500).json({ error: "The PDF could not be made." });
  }
});

app.post("/api/bookings/:id/invoice/email", requireAdmin, async (req, res) => {
  if (!emailEnabled()) {
    return res.status(503).json({
      error: "Emailing invoices is not switched on yet. Download the PDF and send it yourself, or ask Otis to connect the email service.",
    });
  }
  try {
    const bookings = loadBookings();
    const b = bookings.find((x) => x.id === req.params.id);
    if (!b) return res.status(404).json({ error: "Booking ticket not found." });
    if (!b.invoice || b.invoice.items.length === 0) {
      return res.status(400).json({ error: "Save the invoice with at least one line before sending it." });
    }
    const to = (b.email || "").trim();
    if (!looksLikeEmail(to)) {
      return res.status(400).json({ error: "This booking has no valid email address on file." });
    }

    const owed = balanceDue(b.invoice as any);
    const bike = [b.bikeYear, b.bikeMake, b.bikeModel].filter(Boolean).join(" ");
    const pdf = await invoicePdfFor(b);
    const first = b.name.split(" ")[0] || b.name;
    const text = [
      `Hi ${first},`,
      "",
      `Your invoice ${b.invoice.invoiceNumber} from ${SHOP_INFO.name} is attached${bike ? `, for your ${bike}` : ""}.`,
      "",
      owed > 0 ? `Balance due: $${owed.toFixed(2)}` : "This invoice is paid in full — thank you.",
      "",
      `Questions, or to arrange payment? Reply to this email or call ${SHOP_INFO.phone}.`,
      "",
      SHOP_INFO.name,
      SHOP_INFO.address,
    ].join("\n");

    const { id } = await sendEmail({
      to,
      replyTo: process.env.INVOICE_REPLY_TO || SHOP_INFO.email,
      subject: `Invoice ${b.invoice.invoiceNumber} from ${SHOP_INFO.name}`,
      text,
      attachment: { filename: pdfName(b), content: pdf },
    });

    (b.invoiceEmails ??= []).push({ to, at: new Date().toISOString(), balanceDue: owed, ...(id ? { id } : {}) });
    saveBookings(bookings);
    // The address is not logged: host logs are kept, and searchable.
    logEvent("info", "invoice.emailed", { ticket: b.ticketNumber, balanceDue: owed });
    res.json({ success: true, to, balanceDue: owed, booking: b });
  } catch (err) {
    logEvent("error", "invoice.email.failed", errorFields(err));
    res.status(502).json({ error: "The invoice email did not send. Nothing was sent to the customer; try again, or download the PDF and send it yourself." });
  }
});

/* ---------------------------------------------------------------------------
 * Paul's rate sheet.
 *
 * The portal's "Price Matrix" was a page of invented numbers — hourly rates,
 * overheads, margins, engine packages — presented as his. This is his own:
 * nothing in it until he saves it, except the starting prices the website
 * already advertises, offered as a first draft for him to confirm.
 * ------------------------------------------------------------------------- */
const RATES_FILE = path.join(DATA_DIR, "rates.json");

interface RateLine {
  id: string;
  name: string;
  price: number | null;
  unit: string;
  note: string;
}
interface ShopRates {
  laborRate: number | null;
  suppliesPct: number;
  taxPct: number | null;
  overheadPerHour: number | null;
  lines: RateLine[];
  /** Set the first time Paul saves. Until then the sheet is a draft. */
  confirmedAt?: string;
}

/** The only prices on record: the "starting at" figures the site shows customers. */
function draftRatesFromWebsite(): ShopRates {
  const lines: RateLine[] = PUBLIC_SERVICE_PRICES.map((svc) => {
    const n = svc.startingPrice.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    return {
      id: svc.id,
      name: svc.title,
      price: n ? parseFloat(n[1].replace(/,/g, "")) : null,
      unit: /hr|hour/i.test(svc.startingPrice) ? "per hour" : /wheel/i.test(svc.startingPrice) ? "per wheel" : /from/i.test(svc.startingPrice) ? "starting at" : "flat",
      note: `Website lists: ${svc.startingPrice}`,
    };
  });
  const general = lines.find((l) => l.id === "general-repair");
  return { laborRate: general?.price ?? null, suppliesPct: 0, taxPct: null, overheadPerHour: null, lines };
}

function loadRates(): ShopRates {
  return readJsonWithRecovery<ShopRates>(RATES_FILE, {
    whenMissing: draftRatesFromWebsite(),
    valid: (v): v is ShopRates => !!v && typeof v === "object" && Array.isArray((v as ShopRates).lines),
  }).data;
}

const moneyOrNull = (v: unknown, max = 1_000_000) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : undefined;
};

app.get("/api/rates", requireAdmin, (_req, res) => {
  try {
    res.json(loadRates());
  } catch (err) {
    logEvent("error", "rates.read.failed", errorFields(err));
    res.status(500).json({ error: "Could not read the rate sheet." });
  }
});

app.put("/api/rates", requireAdmin, (req, res) => {
  const body = req.body || {};
  const laborRate = moneyOrNull(body.laborRate);
  const taxPct = moneyOrNull(body.taxPct, 100);
  const overheadPerHour = moneyOrNull(body.overheadPerHour);
  const suppliesPct = moneyOrNull(body.suppliesPct, 100);
  if (laborRate === undefined || taxPct === undefined || overheadPerHour === undefined || suppliesPct === undefined) {
    return res.status(400).json({ error: "Rates must be numbers of zero or more (percentages up to 100)." });
  }
  if (!Array.isArray(body.lines) || body.lines.length > 200) {
    return res.status(400).json({ error: "Invalid rate list." });
  }
  const lines: RateLine[] = [];
  for (const [i, raw] of body.lines.entries()) {
    const name = clean(raw?.name, 120);
    const price = moneyOrNull(raw?.price);
    if (!name) return res.status(400).json({ error: `Line ${i + 1} needs a name.` });
    if (price === undefined) return res.status(400).json({ error: `"${name}" has an invalid price.` });
    lines.push({
      id: clean(raw?.id, 60) || `rate-${Date.now()}-${i}`,
      name,
      price,
      unit: clean(raw?.unit, 40) || "flat",
      note: clean(raw?.note, 300),
    });
  }
  const rates: ShopRates = {
    laborRate,
    suppliesPct: suppliesPct ?? 0,
    taxPct,
    overheadPerHour,
    lines,
    confirmedAt: new Date().toISOString(),
  };
  try {
    writeJsonAtomic(RATES_FILE, rates, { backups: 10 });
    res.json(rates);
  } catch (err) {
    logEvent("error", "rates.save.failed", errorFields(err));
    res.status(500).json({ error: "The rate sheet could not be saved." });
  }
});

/* ---------------------------------------------------------------------------
 * Contact-form messages.
 *
 * The "Send a message" form used to show "Message Sent To The Shop!" and send
 * nothing at all — no request, no storage. Every message a customer typed there
 * was lost, while the site told them Paul would read it. Messages are now saved
 * here, durably, and Paul reads them in the owner portal.
 * ------------------------------------------------------------------------- */
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

interface ContactMessage {
  id: string;
  name: string;
  /** Phone or email, as the customer typed it. */
  reach: string;
  message: string;
  createdAt: string;
  handled: boolean;
  idempotencyKey?: string;
}

function loadMessages(): ContactMessage[] {
  const { data, source } = readJsonWithRecovery<ContactMessage[]>(MESSAGES_FILE, {
    whenMissing: [],
    valid: (v): v is ContactMessage[] => Array.isArray(v),
  });
  if (source !== "file" && source !== "missing") {
    logEvent("error", "messages.recovered", { from: source, count: data.length });
    writeJsonAtomic(MESSAGES_FILE, data, { backups: BOOKING_BACKUPS });
  }
  return data;
}

function saveMessages(list: ContactMessage[]) {
  writeJsonAtomic(MESSAGES_FILE, list, { backups: BOOKING_BACKUPS });
}

app.post("/api/messages", bookingLimiter, (req, res) => {
  try {
    const name = clean(req.body?.name, 120);
    const reach = clean(req.body?.reach, 200);
    const message = clean(req.body?.message, 4000);
    if (!name || !reach || !message) {
      return res.status(400).json({ error: "Please fill in your name, a phone or email, and your message." });
    }

    const rawKey = req.body?.idempotencyKey;
    const key = typeof rawKey === "string" && rawKey.length <= 100 ? rawKey : undefined;
    const list = loadMessages();
    if (key) {
      const existing = list.find((m) => m.idempotencyKey === key);
      if (existing) return res.status(200).json({ success: true, id: existing.id, duplicate: true });
    }

    const entry: ContactMessage = {
      id: "msg-" + Date.now() + "-" + crypto.randomInt(1000, 10000),
      name,
      reach,
      message,
      createdAt: new Date().toISOString(),
      handled: false,
      ...(key ? { idempotencyKey: key } : {}),
    };
    list.unshift(entry);
    saveMessages(list);

    // As with bookings: no customer details in the log.
    logEvent("info", "message.received", { id: entry.id, length: message.length });
    res.status(201).json({ success: true, id: entry.id });
  } catch (err) {
    logEvent("error", "message.save.failed", errorFields(err));
    res.status(500).json({ error: "Your message could not be saved." });
  }
});

app.get("/api/messages", requireAdmin, (_req, res) => {
  try {
    const messages = loadMessages();
    res.json({ messages, unhandled: messages.filter((m) => !m.handled).length });
  } catch (err) {
    logEvent("error", "messages.read.failed", errorFields(err));
    res.status(500).json({ error: "Could not read messages." });
  }
});

app.patch("/api/messages/:id", requireAdmin, (req, res) => {
  try {
    const list = loadMessages();
    const found = list.find((m) => m.id === req.params.id);
    if (!found) return res.status(404).json({ error: "Message not found." });
    if (typeof req.body?.handled === "boolean") found.handled = req.body.handled;
    saveMessages(list);
    res.json({ success: true, message: found });
  } catch (err) {
    logEvent("error", "message.update.failed", errorFields(err));
    res.status(500).json({ error: "Failed to update message." });
  }
});

app.delete("/api/messages/:id", requireAdmin, (req, res) => {
  try {
    const list = loadMessages();
    const index = list.findIndex((m) => m.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Message not found." });
    list.splice(index, 1);
    saveMessages(list);
    res.json({ success: true });
  } catch (err) {
    logEvent("error", "message.delete.failed", errorFields(err));
    res.status(500).json({ error: "Failed to delete message." });
  }
});

/**
 * A hard daily ceiling on AI diagnostic calls, across every visitor.
 *
 * diagLimiter caps each IP at 5 a minute, which stops one person hammering the
 * button — but a scraper rotating addresses walks straight past a per-IP limit
 * and every call is billed to Paul's Gemini account. This bounds the worst day
 * no matter where the traffic comes from.
 *
 * Counted in memory and reset at UTC midnight. A restart resets it too, which
 * is acceptable for a bound on abuse; it is not an accounting system. The real
 * backstop is a budget cap on the Gemini account itself — see the handoff doc.
 */
const DIAGNOSTIC_DAILY_CAP = Math.max(1, Number(process.env.DIAGNOSTIC_DAILY_CAP) || 200);
const diagnosticUsage = { day: "", count: 0, warned: false };

function claimDiagnosticCall(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (diagnosticUsage.day !== today) Object.assign(diagnosticUsage, { day: today, count: 0, warned: false });
  if (diagnosticUsage.count >= DIAGNOSTIC_DAILY_CAP) {
    if (!diagnosticUsage.warned) {
      diagnosticUsage.warned = true;
      logEvent("error", "diagnostic.daily_cap_reached", { cap: DIAGNOSTIC_DAILY_CAP, day: today });
    }
    return false;
  }
  diagnosticUsage.count++;
  return true;
}

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

    // Checked only once there is a key and a real question, so an empty or
    // unkeyed request never uses up the day's allowance.
    if (!claimDiagnosticCall()) {
      return res.status(429).json({
        error:
          "The diagnostic tool is resting for today. Call or text Paul on " +
          `${SHOP_INFO_PHONE} and he'll talk the symptoms through with you.`,
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are ${SHOP_INFO.owner}, Master Chassis & Frame Alignment Specialist at The Frame Shop in Spring, Texas.
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
      // A customer is watching a spinner. Past 30s, give up and let the catch
      // tell them to call the shop, rather than leaving them waiting forever.
      config: { abortSignal: AbortSignal.timeout(30_000) },
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
    logEvent("error", "diagnostic.failed", errorFields(err));
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
/** The online inspection deposit, in dollars. Matches the booking form and the refunds page. */
const DEPOSIT_AMOUNT = 75;

app.post("/api/shopify/checkout", bookingLimiter, async (req, res) => {
  if (!shopifyEnabled()) {
    return res.status(503).json({
      error: "Online payment not yet configured. Please call the shop to pay your deposit.",
    });
  }
  try {
    // The amount and wording are set here, not by the browser. This route is
    // public; it used to take both from the request.
    const booking = loadBookings().find((b) => b.id === String(req.body?.bookingId || ""));
    if (!booking) {
      return res.status(404).json({ error: "Booking not found. Please call the shop to pay your deposit." });
    }

    const draft = await createDraftOrder({
      lineItems: [{ title: `Inspection deposit – ${booking.serviceTitle} (${booking.ticketNumber})`, price: DEPOSIT_AMOUNT }],
      email: booking.email || undefined,
      bookingId: booking.id,
      ticketNumber: booking.ticketNumber,
      note: "Booking deposit",
    });

    res.json({ url: draft.invoiceUrl, draftOrderId: draft.id, orderName: draft.name });
  } catch (err: any) {
    logEvent("error", "shopify.checkout.failed", errorFields(err));
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
    // Built from the invoice as saved, not from what the browser sends, so
    // the customer is charged exactly what the invoice says.
    const booking = loadBookings().find((b) => b.id === String(req.body?.bookingId || ""));
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    const inv = booking.invoice;
    if (!inv || inv.items.length === 0) {
      return res.status(400).json({ error: "Save the invoice with at least one line before sending it." });
    }
    if (!booking.email) {
      return res.status(400).json({ error: "This booking has no email address on file." });
    }
    const owed = balanceDue(inv);
    if (owed <= 0) {
      return res.status(400).json({ error: "Nothing is owed on this invoice — it is already paid in full." });
    }

    const { lines, alreadyPaid } = shopifyCharge(inv as any);
    const draft = await createDraftOrder({
      lineItems: lines,
      email: booking.email,
      customerName: booking.name,
      bookingId: booking.id,
      ticketNumber: booking.ticketNumber,
      alreadyPaid,
    });
    await sendDraftOrderInvoice(draft.id);
    const ticketNumber = booking.ticketNumber;

    logEvent("info", "shopify.invoice.sent", { order: draft.name, ticket: ticketNumber, amount: owed });

    res.json({
      success: true,
      amountCharged: owed,
      invoiceId: String(draft.id),
      invoiceUrl: draft.invoiceUrl,
      invoiceNumber: draft.name,
    });
  } catch (err: any) {
    logEvent("error", "shopify.invoice.failed", errorFields(err));
    res.status(502).json({ error: "Failed to send the invoice.", details: err.message });
  }
});

registerMarketing(app, {
  dataDir: DATA_DIR,
  shop: SHOP_INFO,
  services: PUBLIC_SERVICE_PRICES,
  loadBookings,
  saveBookings,
  loadMessages,
  saveMessages,
  loadRates,
  requireAdmin,
  limiter: bookingLimiter,
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

/**
 * Anything a route throws and does not catch lands here. Express's default
 * answers with an HTML stack trace; this logs it, raises the alert, and gives
 * the caller a plain JSON error with no internals in it.
 */
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logEvent("error", "request.unhandled", { method: req.method, path: req.path, ...errorFields(err) });
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on our side. Please try again, or call the shop." });
});

process.on("unhandledRejection", (reason) => logEvent("error", "process.unhandled_rejection", errorFields(reason)));
process.on("uncaughtException", (err) => {
  logEvent("error", "process.uncaught_exception", errorFields(err));
  // State is unknown after this. Exit and let the host restart a clean process.
  setTimeout(() => process.exit(1), 250);
});

/**
 * The site's public address, for search engines and link previews. APP_URL
 * when it is set; otherwise the address the visitor actually used. index.html
 * carries %SITE_URL% where it goes — it used to say localhost:3000, which on
 * the live site told Google and Facebook the shop lived on a developer's laptop.
 */
function siteOrigin(req: express.Request): string {
  const configured = process.env.APP_URL || "";
  if (/^https?:\/\/[^\s/]+/.test(configured)) return new URL(configured).origin;
  return `${req.protocol}://${req.get("host")}`;
}

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
    `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteOrigin(req)}/sitemap.xml\n`
  );
});

app.get("/sitemap.xml", (req, res) => {
  const origin = siteOrigin(req);
  const urls = SITE_PAGES.map((p) => `  <url><loc>${origin}${p === "/" ? "/" : p}</loc></url>`).join("\n");
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
});

/**
 * Settings the live site cannot run safely without. Missing any of them used
 * to mean a warning in a log nobody reads — and, for the secret, the customer
 * list open to anyone. In production the server now refuses to start instead,
 * and says exactly what to set.
 */
export function productionProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  if (!env.SHOP_API_SECRET || env.SHOP_API_SECRET.length < 32 || /generate|random-hex|here/i.test(env.SHOP_API_SECRET)) {
    problems.push(
      "SHOP_API_SECRET is missing, shorter than 32 characters, or still the example text. Owner pages would be open to anyone.\n" +
      "      Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (!env.SHOP_OWNER_PIN || env.SHOP_OWNER_PIN === "1234") {
    problems.push("SHOP_OWNER_PIN is missing or still the demo PIN 1234. Set Paul's own PIN.");
  }
  if (!/^https:\/\/[^\s/]+/.test(env.APP_URL || "")) {
    problems.push(
      "APP_URL must be the site's https:// address (e.g. https://theframeshop.com).\n" +
      "      Google, link previews and every unsubscribe link use it."
    );
  }
  if (!env.DATA_DIR) {
    problems.push(
      "DATA_DIR is not set. Point it at the host's permanent disk (e.g. a volume mounted at /data).\n" +
      "      Without it, bookings, invoices and messages are wiped on every deploy."
    );
  }
  return problems;
}

// Start Express + Vite Server
async function start() {
  if (process.env.NODE_ENV === "production") {
    const problems = productionProblems(process.env);
    if (problems.length) {
      console.error(
        "\n[!] The Frame Shop will not start until these are set on the host:\n\n" +
        problems.map((p) => `  - ${p}`).join("\n\n") + "\n"
      );
      process.exit(1);
    }
  }
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

    // Vite puts a content hash in every file under assets/, so a changed file
    // gets a new name. That makes them safe to cache for a year: a returning
    // visitor downloads the bundle once, not on every visit.
    app.use(
      "/assets",
      express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "1y" })
    );

    // index.html is the one file whose name never changes, so it must always be
    // revalidated — cache it and a deploy stays invisible until the cache expires.
    const noCache = (res: express.Response) => res.setHeader("Cache-Control", "no-cache");
    // The raw file still has %SITE_URL% in it; the page itself lives at "/".
    app.get("/index.html", (_req, res) => res.redirect(301, "/"));
    app.use(
      express.static(distPath, {
        maxAge: "1h",
        // index.html is never served as a plain file: it needs the site's
        // address filled in, and a 404 status on pages that don't exist.
        index: false,
        setHeaders: (res, file) => {
          if (file.endsWith(".html")) noCache(res);
        },
      })
    );
    const indexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
    app.get("*", (req, res) => {
      noCache(res);
      res
        .status(isKnownPage(req.path) ? 200 : 404)
        .type("html")
        .send(indexHtml.replaceAll("%SITE_URL%", siteOrigin(req)));
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
