import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(helmet());
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

// In-memory + local JSON file persistence for appointment bookings & transactions
const DATA_DIR = path.join(process.cwd(), "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");
const TRANSACTIONS_FILE = path.join(DATA_DIR, "transactions.json");

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
