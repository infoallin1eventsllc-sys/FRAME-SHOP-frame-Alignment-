import React, { useState, useEffect } from "react";
import { exportSingleInvoiceToExcel, exportAllInvoicesToExcel } from "../utils/spreadsheets";
import { saveFile, openPrintable } from "../utils/saveFile";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  Wrench,
  X,
  AlertCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Trash2,
  FileText,
  Lock,
  Unlock,
  Printer,
  Plus,
  Save,
  CreditCard,
  Calculator,
  FileSpreadsheet,
  Download,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Wifi,
  Camera,
  HelpCircle,
} from "lucide-react";
import { SHOP_INFO } from "../data/shopData";
import { Booking, InternalInvoice, InvoiceLineItem, ShopRates } from "../types";
import { RatesPanel, fetchRates } from "./RatesPanel";
import { recalcInvoice, newInvoiceForBooking, balanceDue, normalizeInvoice, PAYMENT_METHOD_LABEL } from "../utils/invoiceMath";
import { safeFetch } from "../utils/api";
import { OWNER_GUIDE } from "../data/ownerGuide";
import { MessagesPanel, fetchMessages } from "./MessagesPanel";
import { MarketingPanel } from "./MarketingPanel";
import { SecurityPanel } from "./SecurityPanel";
import { OwnerMediaPanel } from "./OwnerMediaPanel";
import {
  connectBluetoothPrinter,
  sendPayloadToBluetoothPrinter,
  buildEscPosWorkOrderPayload,
  getActiveBluetoothDeviceName,
} from "../utils/bluetoothPrinter";

interface ShopAdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShopAdminPortal: React.FC<ShopAdminPortalProps> = ({ isOpen, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  useEffect(() => {
    const expired = () => {
      setIsAuthenticated(false);
      setPinError("Your login timed out. Enter your PIN again.");
    };
    window.addEventListener("shop-session-expired", expired);
    return () => window.removeEventListener("shop-session-expired", expired);
  }, []);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");

  // Navigation Tab State
  const [activeMainTab, setActiveMainTab] = useState<"bookings" | "messages" | "marketing" | "pricematrix" | "media" | "security" | "help">("bookings");
  const [unhandledMessages, setUnhandledMessages] = useState(0);
  // Marketing drafts waiting for Paul, shown on the tab so he sees them without opening it.
  const [draftsWaiting, setDraftsWaiting] = useState(0);

  /**
   * Opens the guide as its own plain page so Paul can print it or save it as a
   * PDF for his phone. Printing the portal itself would drag the whole dashboard
   * along with it.
   */
  const printOwnerGuide = () => {
    const sections = OWNER_GUIDE.map(section => `
      <section>
        <h2>${section.heading}</h2>
        ${section.blurb ? `<p class="blurb">${section.blurb}</p>` : ""}
        ${section.items.map(item => `
          <div class="task">
            <h3>${item.task}</h3>
            <ol>${item.steps.map(s => `<li>${s}</li>`).join("")}</ol>
            ${item.note ? `<p class="note">${item.note}</p>` : ""}
          </div>`).join("")}
      </section>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>The Frame Shop — Running Your Website</title>
      <style>
        body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
             color:#18181b;max-width:44rem;margin:2.5rem auto;padding:0 1.5rem}
        h1{font-size:1.9rem;margin:0 0 .25rem;font-style:italic;text-transform:uppercase;letter-spacing:-.02em}
        .sub{color:#71717a;margin:0 0 2rem;font-size:.9rem}
        h2{font-size:.78rem;text-transform:uppercase;letter-spacing:.18em;color:#ea580c;
           border-bottom:1px solid #e4e4e7;padding-bottom:.4rem;margin:2.2rem 0 .8rem}
        .blurb{color:#52525b;font-size:.88rem;margin:0 0 1rem}
        .task{margin:0 0 1.3rem;break-inside:avoid}
        h3{font-size:1rem;margin:0 0 .35rem}
        ol{margin:.2rem 0;padding-left:1.3rem}
        li{margin:.2rem 0}
        .note{background:#fafafa;border-left:3px solid #ea580c;padding:.5rem .75rem;
              margin:.5rem 0 0;font-size:.85rem;color:#3f3f46}
        @media print{body{margin:0;max-width:none}}
      </style></head><body>
      <h1>Running Your Website</h1>
      <p class="sub">The Frame Shop &middot; Spring, Texas &middot; prepared by Meridian Interface</p>
      ${sections}
      </body></html>`;
    void openPrintable(html, "The-Frame-Shop-Owner-Guide.html", 900, 1000);
  };


  // Paul's own rates — the starting point for every new invoice.
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [portalError, setPortalError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingTechNoteId, setEditingTechNoteId] = useState<string | null>(null);
  const [techNoteText, setTechNoteText] = useState<string>("");

  // Invoice Builder State
  const [activeInvoiceBooking, setActiveInvoiceBooking] = useState<Booking | null>(null);
  const [invoiceFormState, setInvoiceFormState] = useState<InternalInvoice | null>(null);
  const [invoiceNotice, setInvoiceNotice] = useState<string>("");
  const [pdfBusy, setPdfBusy] = useState<"" | "email" | "download">("");
  const [emailConfig, setEmailConfig] = useState<{ enabled: boolean; replyTo: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "check" | "card_in_person" | "other">("cash");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [invoiceSendStatus, setInvoiceSendStatus] = useState<{ loading: boolean; url: string | null; error: string | null }>({ loading: false, url: null, error: null });

  // POS Modal State

  // Bluetooth Printer Capabilities State
  const [btDeviceName, setBtDeviceName] = useState<string>(getActiveBluetoothDeviceName());
  const [btStatus, setBtStatus] = useState<"idle" | "connecting" | "connected" | "printing" | "success" | "error">("idle");
  const [btMessage, setBtMessage] = useState<string>("");

  const handleConnectBluetooth = async () => {
    setBtStatus("connecting");
    setBtMessage("Scanning for Bluetooth thermal work order printers...");
    const res = await connectBluetoothPrinter();
    if (res.success) {
      setBtDeviceName(res.deviceName);
      setBtStatus("connected");
      setBtMessage(`Connected to ${res.deviceName}! Ready for direct wireless thermal work order printing.`);
    } else {
      setBtStatus("error");
      setBtMessage(res.error || "Could not pair with Bluetooth printer.");
    }
  };

  const handlePrintBluetoothWorkOrder = async () => {
    if (!activeInvoiceBooking || !invoiceFormState) return;

    let deviceToUse = btDeviceName;
    if (!deviceToUse) {
      setBtStatus("connecting");
      setBtMessage("Pairing Bluetooth printer...");
      const conn = await connectBluetoothPrinter();
      if (!conn.success) {
        setBtStatus("error");
        setBtMessage(conn.error || "Bluetooth printer pairing required.");
        return;
      }
      deviceToUse = conn.deviceName;
      setBtDeviceName(conn.deviceName);
    }

    setBtStatus("printing");
    setBtMessage(`Transmitting ESC/POS work order bytes to ${deviceToUse}...`);

    const payload = buildEscPosWorkOrderPayload(
      SHOP_INFO.name,
      activeInvoiceBooking.ticketNumber,
      invoiceFormState.invoiceNumber,
      invoiceFormState.createdDate,
      activeInvoiceBooking.name,
      activeInvoiceBooking.phone,
      `${activeInvoiceBooking.bikeYear} ${activeInvoiceBooking.bikeMake} ${activeInvoiceBooking.bikeModel}`,
      activeInvoiceBooking.serviceTitle,
      invoiceFormState.items,
      invoiceFormState.subtotal,
      invoiceFormState.shopSuppliesAmount,
      invoiceFormState.taxAmount,
      invoiceFormState.totalAmount,
      invoiceFormState.amountPaid ?? 0,
      balanceDue(invoiceFormState)
    );

    const res = await sendPayloadToBluetoothPrinter(payload);
    if (res.success) {
      setBtStatus("success");
      setBtMessage(`Work order successfully printed to ${deviceToUse}!`);
      setTimeout(() => {
        setBtStatus("idle");
        setBtMessage("");
      }, 5000);
    } else {
      setBtStatus("error");
      setBtMessage(res.error || "Failed to transmit payload to Bluetooth printer.");
    }
  };

  /** Reads the error a failed request carries, for showing to Paul. */
  const failure = async (res: Response, fallback: string) => {
    const data = await res.json().catch(() => ({}));
    return data?.error || `${fallback} (error ${res.status})`;
  };

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await safeFetch("/api/bookings");
      if (!res.ok) {
        // An empty list here used to look exactly like "no bookings".
        setPortalError(await failure(res, "Could not load bookings"));
        return;
      }
      const data = await res.json();
      const list: Booking[] = Array.isArray(data) ? data : data.bookings || [];
      setBookings(list.map((b) => (b.invoice ? { ...b, invoice: normalizeInvoice(b.invoice) } : b)));
      setPortalError("");
      // The messages tab carries a count, so Paul sees new ones without opening it.
      const msgs = await fetchMessages();
      if (msgs) setUnhandledMessages(msgs.unhandled);
      const mk = await safeFetch("/api/marketing/summary").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (mk) setDraftsWaiting(mk.toApprove);
    } catch {
      setPortalError("Could not reach the website to load bookings. Check your connection and press Refresh.");
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    fetchBookings();
    fetchRates().then((r) => r && setRates(r));
    safeFetch("/api/email/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setEmailConfig(c))
      .catch(() => {});
    // New requests show up without pressing Refresh.
    const timer = window.setInterval(fetchBookings, 60_000);
    return () => window.clearInterval(timer);
  }, [isOpen, isAuthenticated]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) {
      setPinError("Please enter your PIN.");
      return;
    }
    try {
      const res = await safeFetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPinError(body?.error || "Invalid PIN. Access denied.");
        return;
      }
      const data = await res.json();
      sessionStorage.setItem("shop_admin_token", data.token);
      setIsAuthenticated(true);
      setPinError("");
      fetchBookings();
    } catch {
      setPinError("Connection error. Check your network and try again.");
    }
  };

  /** Every change to a booking goes through here, so a failure is always shown. */
  const patchBooking = async (id: string, body: object, what: string): Promise<Booking | null> => {
    try {
      const res = await safeFetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setPortalError(await failure(res, `Could not ${what}`));
        return null;
      }
      setPortalError("");
      const data = await res.json();
      fetchBookings();
      return data.booking ?? null;
    } catch {
      setPortalError(`Could not ${what}: the website could not be reached.`);
      return null;
    }
  };

  const handleStatusUpdate = (id: string, newStatus: Booking["status"]) =>
    patchBooking(id, { status: newStatus }, "update the status");

  const handleSaveTechNotes = async (id: string) => {
    if (await patchBooking(id, { techNotes: techNoteText }, "save the notes")) setEditingTechNoteId(null);
  };

  const openInvoiceModal = (booking: Booking) => {
    setActiveInvoiceBooking(booking);
    setInvoiceSendStatus({ loading: false, url: null, error: null });
    setInvoiceNotice("");
    setInvoiceFormState(booking.invoice ? recalcInvoice(booking.invoice) : newInvoiceForBooking(booking, rates));
  };

  const updateInvoiceStateAndRecalculate = (updated: InternalInvoice) => {
    setInvoiceFormState(recalcInvoice(updated));
    setInvoiceNotice("");
  };

  const handleInvoiceItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    if (!invoiceFormState) return;
    const newItems = [...invoiceFormState.items];
    newItems[index] = { ...newItems[index], [field]: value };
    updateInvoiceStateAndRecalculate({ ...invoiceFormState, items: newItems });
  };

  const handleAddInvoiceItem = () => {
    if (!invoiceFormState) return;
    const rate = invoiceFormState.laborHourlyRate || 0;
    updateInvoiceStateAndRecalculate({
      ...invoiceFormState,
      items: [
        ...invoiceFormState.items,
        { id: `li-${Date.now()}`, description: "Labor", category: "labor", quantity: 1, rate, amount: rate },
      ],
    });
  };

  /** Adds one of Paul's own services, at his price. */
  const handleAddFromRates = (rateId: string) => {
    if (!invoiceFormState || !rates) return;
    const line = rates.lines.find((l) => l.id === rateId);
    if (!line) return;
    const hourly = line.unit === "per hour";
    updateInvoiceStateAndRecalculate({
      ...invoiceFormState,
      items: [
        ...invoiceFormState.items,
        {
          id: `li-${Date.now()}`,
          description: line.name,
          category: hourly ? "labor" : "service",
          quantity: 1,
          rate: line.price ?? 0,
          amount: line.price ?? 0,
        },
      ],
    });
  };

  const handleRemoveInvoiceItem = (index: number) => {
    if (!invoiceFormState) return;
    updateInvoiceStateAndRecalculate({
      ...invoiceFormState,
      items: invoiceFormState.items.filter((_, i) => i !== index),
    });
  };

  /** Saves the invoice. Returns the booking as the server now holds it, or null. */
  const saveInvoice = async (): Promise<Booking | null> => {
    if (!activeInvoiceBooking || !invoiceFormState) return null;
    const saved = await patchBooking(activeInvoiceBooking.id, { invoice: invoiceFormState }, "save the invoice");
    if (saved?.invoice) {
      setActiveInvoiceBooking(saved);
      setInvoiceFormState(recalcInvoice(saved.invoice));
    }
    return saved;
  };

  const handleSaveInvoice = async () => {
    if (await saveInvoice()) setInvoiceNotice("Invoice saved.");
  };

  const handleSendInvoice = async () => {
    if (!activeInvoiceBooking || !invoiceFormState) return;
    if (!activeInvoiceBooking.email) {
      setInvoiceSendStatus({ loading: false, url: null, error: "This booking has no email address on file. Add the customer's email before sending." });
      return;
    }
    setInvoiceSendStatus({ loading: true, url: null, error: null });
    // Save first, and stop if that fails: the customer is billed from the saved copy.
    const saved = await saveInvoice();
    if (!saved) {
      setInvoiceSendStatus({ loading: false, url: null, error: "The invoice could not be saved, so it was not sent." });
      return;
    }
    try {
      const res = await safeFetch("/api/shopify/invoice/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: saved.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvoiceSendStatus({ loading: false, url: null, error: data.error || "Failed to send the invoice." });
        return;
      }
      setInvoiceSendStatus({ loading: false, url: data.invoiceUrl, error: null });
      setInvoiceNotice(`Emailed to ${saved.email} for $${Number(data.amountCharged ?? 0).toFixed(2)}.`);
      fetchBookings();
    } catch {
      setInvoiceSendStatus({ loading: false, url: null, error: "Network error. Check your connection and try again." });
    }
  };

  /**
   * The customer's PDF. Saved first, because the PDF is made from the saved
   * invoice — unsaved edits would otherwise be missing from it.
   */
  const handleDownloadPdf = async () => {
    if (!activeInvoiceBooking || pdfBusy) return;
    setPdfBusy("download");
    try {
      const saved = await saveInvoice();
      if (!saved) return;
      const res = await safeFetch(`/api/bookings/${saved.id}/invoice.pdf`);
      if (!res.ok) {
        setInvoiceNotice(await failure(res, "The PDF could not be made"));
        return;
      }
      const outcome = await saveFile(`Invoice-${saved.invoice!.invoiceNumber}-TheFrameShop.pdf`, await res.blob());
      setInvoiceNotice(outcome === "saved" ? "PDF downloaded." : outcome === "declined" ? "Download cancelled." : "The PDF could not be saved. Try again.");
    } catch {
      setInvoiceNotice("The PDF could not be downloaded: the website could not be reached.");
    } finally {
      setPdfBusy("");
    }
  };

  const handleEmailPdf = async () => {
    if (!activeInvoiceBooking || pdfBusy) return;
    if (!activeInvoiceBooking.email) {
      setInvoiceNotice("This booking has no email address on file.");
      return;
    }
    if (!window.confirm(`Email this invoice as a PDF to ${activeInvoiceBooking.email}?`)) return;
    setPdfBusy("email");
    try {
      const saved = await saveInvoice();
      if (!saved) return;
      const res = await safeFetch(`/api/bookings/${saved.id}/invoice/email`, { method: "POST" });
      if (!res.ok) {
        setInvoiceNotice(await failure(res, "The invoice email did not send"));
        return;
      }
      const data = await res.json();
      setActiveInvoiceBooking(data.booking);
      setInvoiceNotice(
        `PDF invoice emailed to ${data.to}${data.balanceDue > 0 ? ` — balance due $${Number(data.balanceDue).toFixed(2)}` : " — marked paid in full"}. Replies go to ${emailConfig?.replyTo || SHOP_INFO.email}.`
      );
      fetchBookings();
    } catch {
      setInvoiceNotice("The invoice email did not send: the website could not be reached.");
    } finally {
      setPdfBusy("");
    }
  };

  /** Money taken in person — cash, check, the shop's own card reader. */
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoiceBooking) return;
    const amount = parseFloat(paymentAmount);
    if (!(amount > 0)) {
      setInvoiceNotice("Enter the amount received.");
      return;
    }
    // Unsaved line changes would be lost when the saved invoice comes back.
    if (invoiceFormState && activeInvoiceBooking.invoice && JSON.stringify(recalcInvoice(activeInvoiceBooking.invoice).items) !== JSON.stringify(invoiceFormState.items)) {
      setInvoiceNotice("Save the invoice first, then record the payment.");
      return;
    }
    try {
      const res = await safeFetch(`/api/bookings/${activeInvoiceBooking.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method: paymentMethod, note: paymentNote }),
      });
      if (!res.ok) {
        setInvoiceNotice(await failure(res, "The payment was not recorded"));
        return;
      }
      const { booking } = await res.json();
      setActiveInvoiceBooking(booking);
      setInvoiceFormState(booking.invoice ? recalcInvoice(booking.invoice) : newInvoiceForBooking(booking, rates));
      setPaymentAmount("");
      setPaymentNote("");
      setInvoiceNotice(`Recorded $${amount.toFixed(2)} (${PAYMENT_METHOD_LABEL[paymentMethod]}).`);
      fetchBookings();
    } catch {
      setInvoiceNotice("The payment was not recorded: the website could not be reached.");
    }
  };

  const handleRemovePayment = async (paymentId: string) => {
    if (!activeInvoiceBooking || !window.confirm("Remove this payment? Only do this to correct a mistake.")) return;
    try {
      const res = await safeFetch(`/api/bookings/${activeInvoiceBooking.id}/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE" });
      if (!res.ok) {
        setInvoiceNotice(await failure(res, "The payment was not removed"));
        return;
      }
      const { booking } = await res.json();
      setActiveInvoiceBooking(booking);
      setInvoiceFormState(booking.invoice ? recalcInvoice(booking.invoice) : newInvoiceForBooking(booking, rates));
      setInvoiceNotice("Payment removed.");
      fetchBookings();
    } catch {
      setInvoiceNotice("The payment was not removed: the website could not be reached.");
    }
  };

  const handleDeleteBooking = async (id: string) => {
    const b = bookings.find((x) => x.id === id);
    const paid = (b?.invoice?.amountPaid ?? 0) > 0 || (b?.prepayments?.length ?? 0) > 0;
    const question = paid
      ? `Ticket ${b?.ticketNumber} has payments recorded against it. Delete it anyway? Its invoice and payment history go with it.`
      : "Are you sure you want to delete this appointment ticket?";
    if (!window.confirm(question)) return;
    try {
      const res = await safeFetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setPortalError(await failure(res, "Could not delete the ticket"));
        return;
      }
      setPortalError("");
      fetchBookings();
    } catch {
      setPortalError("Could not delete the ticket: the website could not be reached.");
    }
  };

  // Filter & Search Logic
  const filteredBookings = bookings.filter((b) => {
    const matchesFilter = activeFilter === "all" || b.status === activeFilter;
    const matchesSearch =
      b.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bikeMake.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bikeModel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.phone.includes(searchQuery) ||
      (b.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const inShopCount = bookings.filter((b) => b.status === "in_shop").length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/95 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-zinc-900 border border-zinc-800 rounded-none max-w-5xl w-full p-4 sm:p-8 shadow-2xl relative max-h-[94vh] flex flex-col">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-600 flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5" />
              <span>SHOP MANAGEMENT PORTAL</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 uppercase italic tracking-tighter">
              PAUL'S SHOP <span className="text-orange-600">COMMAND CENTER</span>
            </h2>

            {isAuthenticated && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveMainTab("bookings")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeMainTab === "bookings"
                      ? "bg-orange-600 text-white shadow"
                      : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  📋 Work Orders &amp; Appointments ({bookings.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("messages")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeMainTab === "messages"
                      ? "bg-orange-600 text-white shadow"
                      : unhandledMessages > 0
                        ? "bg-zinc-950 text-orange-300 hover:text-white border border-orange-600"
                        : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  ✉️ Customer Messages ({unhandledMessages} new)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("marketing")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeMainTab === "marketing"
                      ? "bg-orange-600 text-white shadow"
                      : draftsWaiting > 0
                        ? "bg-zinc-950 text-orange-200 hover:text-white border border-orange-500"
                        : "bg-zinc-950 text-orange-300 hover:text-white border border-orange-600/50"
                  }`}
                >
                  ✨ Marketing{draftsWaiting > 0 ? ` (${draftsWaiting} to approve)` : ""}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("pricematrix")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMainTab === "pricematrix"
                      ? "bg-amber-500 text-zinc-950 font-black shadow"
                      : "bg-zinc-950 text-amber-400 hover:text-amber-300 border border-amber-600/40"
                  }`}
                  title="Your prices — the starting point for every invoice"
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>🔒 My Rates</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("media")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMainTab === "media"
                      ? "bg-orange-600 text-white shadow"
                      : "bg-zinc-950 text-orange-400 hover:text-white border border-orange-600/40"
                  }`}
                  title="Owner Website Photo & Media Control Portal (Owner Only)"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>📸 Owner Photo Control</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("security")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeMainTab === "security"
                      ? "bg-orange-600 text-white shadow"
                      : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  🛡️ Security
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("help")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMainTab === "help"
                      ? "bg-orange-600 text-white shadow"
                      : "bg-zinc-950 text-zinc-300 hover:text-white border border-zinc-700"
                  }`}
                  title="How to run your website"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>How Do I…?</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAuthenticated && (
              <>

                {activeMainTab === "bookings" && (
                  <button
                    onClick={() => exportAllInvoicesToExcel(bookings)}
                    className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Export All Invoices to Microsoft Excel Workbook"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Invoices Excel</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    fetchBookings();
                                }}
                  className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close Portal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isAuthenticated ? (
          /* Login PIN Prompt */
          <div className="py-16 px-4 max-w-md mx-auto text-center space-y-6 my-auto">
            <div className="w-16 h-16 bg-zinc-950 text-orange-600 border border-zinc-800 rounded-none flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-zinc-100 uppercase italic">
                SHOP OWNER AUTHENTICATION
              </h3>
              <p className="text-zinc-400 text-xs font-normal">
                Enter your 4-digit mechanic PIN to access live customer appointment tickets and alignment schedule.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">
                  Shop Owner PIN
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter PIN"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 p-3 text-center text-lg font-mono tracking-widest focus:outline-none"
                  autoFocus
                />
              </div>

              {pinError && (
                <div className="text-xs text-red-500 font-bold flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{pinError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-none uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Unlock className="w-4 h-4" />
                <span>Unlock Shop Portal</span>
              </button>
            </form>

            <div className="pt-2 text-[11px] text-zinc-500">
              Contact the shop owner for PIN access.
            </div>
          </div>
        ) : (
          /* Logged-In Admin Content */
          <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
            {portalError && (
              <div role="alert" className="p-3 bg-red-950/80 border border-red-600/60 text-red-200 text-sm font-bold flex items-start justify-between gap-3">
                <span className="flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{portalError}</span>
                <button type="button" onClick={() => setPortalError("")} aria-label="Dismiss" className="text-red-300 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Kept mounted so a video upload keeps going while another tab is open. */}
            <div hidden={activeMainTab !== "media"}>
              <OwnerMediaPanel />
            </div>

            {activeMainTab === "messages" ? (
              <MessagesPanel onCountChange={setUnhandledMessages} />
            ) : activeMainTab === "marketing" ? (
              <MarketingPanel onDataChanged={fetchBookings} />
            ) : activeMainTab === "security" ? (
              <SecurityPanel />
            ) : activeMainTab === "pricematrix" ? (
              <RatesPanel onSaved={setRates} />
            ) : activeMainTab === "media" ? null : activeMainTab === "help" ? (
              /* Plain-language owner's guide */
              <div className="space-y-6 font-sans">
                <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" />
                        <span>Owner's Guide</span>
                      </div>
                      <h3 className="text-2xl font-black text-zinc-100 uppercase italic">
                        RUNNING YOUR WEBSITE
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={printOwnerGuide}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-black px-4 py-2.5 text-[11px] uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2 flex-shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / Save PDF</span>
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Everything you can change on your own, in the order you're likely to need it.
                    Print it for the shop wall, or save it as a PDF and keep it on your phone.
                  </p>
                </div>

                {OWNER_GUIDE.map((section) => (
                  <div key={section.heading} className="bg-zinc-950 border border-zinc-800 p-5 space-y-4">
                    <div className="border-b border-zinc-800 pb-2.5">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500">
                        {section.heading}
                      </h4>
                      {section.blurb && (
                        <p className="text-[11px] text-zinc-500 mt-1">{section.blurb}</p>
                      )}
                    </div>

                    <div className="space-y-5">
                      {section.items.map((item) => (
                        <div key={item.task} className="space-y-1.5">
                          <div className="text-sm font-black uppercase italic text-zinc-100">
                            {item.task}
                          </div>
                          <ol className="space-y-1 list-decimal list-inside">
                            {item.steps.map((step, i) => (
                              <li key={i} className="text-xs text-zinc-300 leading-relaxed">
                                {step}
                              </li>
                            ))}
                          </ol>
                          {item.note && (
                            <p className="text-[11px] text-zinc-400 italic border-l-2 border-orange-600 pl-2.5 leading-relaxed">
                              {item.note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Work Orders & Appointments View */
              <div className="space-y-6">
                {/* Stats Overview Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-zinc-950 p-4 border border-zinc-800">
                <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
                  Pending Review
                </div>
                <div className="text-3xl font-black text-zinc-100 italic mt-1">
                  {pendingCount}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Needs confirmation</div>
              </div>

              <div className="bg-zinc-950 p-4 border border-zinc-800">
                <div className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">
                  Confirmed Lifts
                </div>
                <div className="text-3xl font-black text-zinc-100 italic mt-1">
                  {confirmedCount}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Scheduled &amp; locked</div>
              </div>

              <div className="bg-zinc-950 p-4 border border-zinc-800">
                <div className="text-[10px] font-black uppercase text-blue-500 tracking-widest">
                  Bikes In Shop
                </div>
                <div className="text-3xl font-black text-zinc-100 italic mt-1">
                  {inShopCount}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Under inspection/work</div>
              </div>

              <div className="bg-zinc-950 p-4 border border-zinc-800">
                <div className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                  Completed Builds
                </div>
                <div className="text-3xl font-black text-zinc-100 italic mt-1">
                  {completedCount}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">Zero-tolerance certified</div>
              </div>
            </div>

            {/* Controls Bar: Filters & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-950 p-3 border border-zinc-800">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs font-bold uppercase tracking-wider">
                {[
                  { id: "all", label: `All (${bookings.length})` },
                  { id: "pending", label: `Pending (${pendingCount})` },
                  { id: "confirmed", label: `Confirmed (${confirmedCount})` },
                  { id: "in_shop", label: `In Shop (${inShopCount})` },
                  { id: "completed", label: `Completed (${completedCount})` },
                  { id: "cancelled", label: `Cancelled (${cancelledCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-none whitespace-nowrap cursor-pointer transition-all ${
                      activeFilter === tab.id
                        ? "bg-orange-600 text-white font-black"
                        : "text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, ticket #, model..."
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-orange-600 text-zinc-100 text-xs pl-8 pr-3 py-2 focus:outline-none rounded-none"
                />
              </div>
            </div>

            {/* Bookings List Cards */}
            {filteredBookings.length === 0 ? (
              <div className="text-center py-12 bg-zinc-950 border border-zinc-800 space-y-3">
                <Wrench className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="text-sm font-bold text-zinc-300 uppercase tracking-widest">
                  No appointment tickets found
                </div>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  No bookings match your current filter or search. New requests from the website appear here within a minute, or press Refresh.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((b) => {
                  let statusBadgeClass = "bg-zinc-800 text-zinc-300 border-zinc-700";
                  if (b.status === "pending") statusBadgeClass = "bg-orange-950/80 text-orange-400 border-orange-600/60";
                  if (b.status === "confirmed") statusBadgeClass = "bg-emerald-950/80 text-emerald-400 border-emerald-600/60";
                  if (b.status === "in_shop") statusBadgeClass = "bg-blue-950/80 text-blue-400 border-blue-600/60";
                  if (b.status === "completed") statusBadgeClass = "bg-zinc-900 text-zinc-400 border-zinc-800";
                  if (b.status === "cancelled") statusBadgeClass = "bg-red-950/80 text-red-400 border-red-600/60";

                  return (
                    <div
                      key={b.id}
                      className="bg-zinc-950 border border-zinc-800 p-5 space-y-4 hover:border-zinc-700 transition-all"
                    >
                      {/* Ticket Header Line */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-900">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black uppercase tracking-widest text-zinc-100 bg-zinc-900 px-2.5 py-1 border border-zinc-800">
                            Ticket #{b.ticketNumber}
                          </span>
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 border ${statusBadgeClass}`}
                          >
                            {b.status.replace("_", " ")}
                          </span>
                        </div>

                        <div className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-orange-600" />
                          <span>Submitted: {new Date(b.createdAt).toLocaleDateString()} at {new Date(b.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        {/* Rider & Contact */}
                        <div className="space-y-1.5 bg-zinc-900/60 p-3 border border-zinc-900">
                          <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                            Rider Info
                          </div>
                          <div className="text-sm font-bold text-zinc-100">{b.name}</div>
                          <div className="flex items-center gap-1.5 text-zinc-300">
                            <Phone className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                            <a href={`tel:${b.phone}`} className="hover:text-orange-400 font-mono font-bold">
                              {b.phone}
                            </a>
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                            <Mail className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                            <a href={`mailto:${b.email}`} className="hover:text-zinc-200 truncate">
                              {b.email}
                            </a>
                          </div>
                          {/* Only customers who ticked the box may be sent offers. */}
                          <div
                            className={`text-[10px] font-bold uppercase tracking-wider ${b.marketingConsent ? "text-emerald-400" : "text-zinc-500"}`}
                            title={b.marketingConsent ? `Agreed ${new Date(b.marketingConsent.at).toLocaleString()}: "${b.marketingConsent.wording}"` : undefined}
                          >
                            {b.marketingConsent ? "✓ OK to send offers" : "No marketing — booking only"}
                          </div>
                          {b.source && (
                            <div className="text-[10px] text-zinc-500">Heard about us: {b.source}</div>
                          )}
                        </div>

                        {/* Bike & Requested Service */}
                        <div className="space-y-1.5 bg-zinc-900/60 p-3 border border-zinc-900">
                          <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                            Motorcycle &amp; Service
                          </div>
                          <div className="text-sm font-bold text-zinc-100 italic">
                            {b.bikeYear} {b.bikeMake} {b.bikeModel}
                          </div>
                          <div className="text-orange-500 font-bold uppercase tracking-wide">
                            {b.serviceTitle}
                          </div>
                          <div className="text-zinc-400 flex items-center gap-1 font-bold">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Requested: {b.preferredDate} ({b.preferredTimeSlot})</span>
                          </div>
                        </div>

                        {/* Reported Symptoms */}
                        <div className="space-y-1.5 bg-zinc-900/60 p-3 border border-zinc-900">
                          <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                            Customer Notes / Handling Symptoms
                          </div>
                          <p className="text-zinc-300 italic leading-relaxed text-[11px]">
                            "{b.issueNotes || "No specific symptom notes provided."}"
                          </p>
                        </div>
                      </div>

                      {/* Technician Alignment Notes Section */}
                      <div className="bg-zinc-900/40 p-3 border border-zinc-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-orange-600" />
                            <span>Paul's Technician Alignment &amp; Scan Measurements</span>
                          </span>

                          {editingTechNoteId !== b.id && (
                            <button
                              onClick={() => {
                                setEditingTechNoteId(b.id);
                                setTechNoteText(b.techNotes || "");
                              }}
                              className="text-[10px] text-orange-500 hover:text-orange-400 uppercase font-black tracking-widest cursor-pointer"
                            >
                              {b.techNotes ? "Edit Tech Notes" : "+ Add Tech Notes"}
                            </button>
                          )}
                        </div>

                        {editingTechNoteId === b.id ? (
                          <div className="space-y-2">
                            <textarea
                              aria-label={`Tech notes for ticket ${b.ticketNumber}`}
                              value={techNoteText}
                              onChange={(e) => setTechNoteText(e.target.value)}
                              placeholder="e.g., Laser scan measurement: Rear wheel offset 8mm left. Swingarm torque verified..."
                              rows={2}
                              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs p-2 focus:outline-none focus:border-orange-600"
                            />
                            <div className="flex justify-end gap-2 text-xs">
                              <button
                                onClick={() => setEditingTechNoteId(null)}
                                className="px-3 py-1 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white uppercase font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveTechNotes(b.id)}
                                className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-wider"
                              >
                                Save Measurements
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-300 font-mono">
                            {b.techNotes ? (
                              <span className="text-zinc-200">{b.techNotes}</span>
                            ) : (
                              <span className="text-zinc-600 italic">No technician notes saved yet.</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Internal Owner Invoice & Work Order Bar */}
                      <div className="bg-zinc-900/80 p-3 border border-zinc-800 space-y-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-orange-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                              Internal Work Order &amp; Invoice (Owner View Only)
                            </span>
                          </div>

                          {b.invoice ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-bold text-orange-400 bg-zinc-950 px-2 py-0.5 border border-zinc-800">
                                Total: ${b.invoice.totalAmount.toFixed(2)}
                              </span>
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 border ${
                                  b.invoice.paymentStatus === "paid_in_full"
                                    ? "bg-emerald-950 text-emerald-400 border-emerald-600/40"
                                    : b.invoice.paymentStatus === "deposit_paid"
                                    ? "bg-amber-950 text-amber-400 border-amber-600/40"
                                    : "bg-red-950 text-red-400 border-red-600/40"
                                }`}
                              >
                                {b.invoice.paymentStatus === "paid_in_full"
                                  ? "Paid in full"
                                  : b.invoice.paymentStatus === "deposit_paid"
                                  ? `Part paid — $${balanceDue(b.invoice).toFixed(2)} due`
                                  : "Unpaid"}
                              </span>
                              <button
                                onClick={() => openInvoiceModal(b)}
                                className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                              >
                                Edit Invoice
                              </button>
                              <button
                                onClick={() => exportSingleInvoiceToExcel(b, b.invoice!)}
                                className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                                title="Export single invoice to Excel (.xlsx)"
                              >
                                <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                                <span>Excel</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openInvoiceModal(b)}
                                className="bg-zinc-950 hover:bg-orange-600/20 text-orange-400 hover:text-orange-300 border border-orange-600/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Create Owner Invoice</span>
                              </button>
                              {(b.prepayments?.length ?? 0) > 0 && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 border bg-amber-950 text-amber-400 border-amber-600/40">
                                  ${b.prepayments!.reduce((s, p) => s + p.amount, 0).toFixed(2)} paid in advance
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Controls Toolbar */}
                      <div className="pt-2 border-t border-zinc-900 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-zinc-500 mr-1">Update Status:</span>

                          <button
                            onClick={() => handleStatusUpdate(b.id, "confirmed")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              b.status === "confirmed"
                                ? "bg-emerald-600 text-white"
                                : "bg-zinc-900 hover:bg-emerald-950/80 text-emerald-400 border border-zinc-800"
                            }`}
                          >
                            ✓ Confirm Lift
                          </button>

                          <button
                            onClick={() => handleStatusUpdate(b.id, "in_shop")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              b.status === "in_shop"
                                ? "bg-blue-600 text-white"
                                : "bg-zinc-900 hover:bg-blue-950/80 text-blue-400 border border-zinc-800"
                            }`}
                          >
                            🔧 In Shop
                          </button>

                          <button
                            onClick={() => handleStatusUpdate(b.id, "completed")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              b.status === "completed"
                                ? "bg-zinc-700 text-white"
                                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                            }`}
                          >
                            🏁 Mark Completed
                          </button>

                          <button
                            onClick={() => handleStatusUpdate(b.id, "cancelled")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                              b.status === "cancelled"
                                ? "bg-red-800 text-white"
                                : "bg-zinc-900 hover:bg-red-950/80 text-red-400 border border-zinc-800"
                            }`}
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${b.phone}`}
                            className="px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-600/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call Rider</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDeleteBooking(b.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
                            title="Delete Ticket"
                            aria-label={`Delete ticket ${b.ticketNumber}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>

      {/* Internal Invoice & Work Order Editor Overlay Modal */}
      {activeInvoiceBooking && invoiceFormState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-950 border-2 border-orange-600 rounded-none max-w-4xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[95vh] flex flex-col space-y-4 text-zinc-100 overflow-y-auto font-sans">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-400 bg-amber-950/80 px-2.5 py-0.5 border border-amber-600/40 tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>INTERNAL OWNER INVOICE &amp; WORK ORDER (CONFIDENTIAL)</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-zinc-100 uppercase italic mt-1">
                  WORK ORDER <span className="text-orange-500">#{invoiceFormState.invoiceNumber}</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  This financial invoice is strictly internal for Paul's accounting and physical lift work orders. No pricing is exposed on the public website.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveInvoiceBooking(null);
                  setInvoiceFormState(null);
                }}
                className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Close invoice"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer & Bike Info Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-900/80 p-3 border border-zinc-800 text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500">Rider Info</span>
                <div className="font-bold text-zinc-100">{activeInvoiceBooking.name}</div>
                <div className="text-zinc-400">{activeInvoiceBooking.phone} • {activeInvoiceBooking.email}</div>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500">Motorcycle</span>
                <div className="font-bold text-zinc-100 italic">
                  {activeInvoiceBooking.bikeYear} {activeInvoiceBooking.bikeMake} {activeInvoiceBooking.bikeModel}
                </div>
                <div className="text-zinc-400">Ticket #{activeInvoiceBooking.ticketNumber}</div>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-orange-500">Service Requested</span>
                <div className="font-bold text-orange-400">{activeInvoiceBooking.serviceTitle}</div>
                <div className="text-zinc-400">{activeInvoiceBooking.preferredDate} ({activeInvoiceBooking.preferredTimeSlot})</div>
              </div>
            </div>

            {/* Add one of Paul's own services, at his price */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <label htmlFor="invoice-add-rate" className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Add from my rates:
              </label>
              {rates && rates.lines.length > 0 ? (
                <select
                  id="invoice-add-rate"
                  value=""
                  onChange={(e) => handleAddFromRates(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs p-1.5 focus:outline-none focus:border-orange-500 rounded-none"
                >
                  <option value="">Choose a service…</option>
                  {rates.lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}{l.price != null ? ` — $${l.price.toFixed(2)}${l.unit === "per hour" ? "/hr" : ""}` : " — no price set"}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-zinc-500">Set up your services in the My Rates tab.</span>
              )}
              {rates && !rates.confirmedAt && (
                <span className="text-amber-400">Your rates are not saved yet — check them in My Rates.</span>
              )}
            </div>

            {/* Itemized Line Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                  Itemized Work Order Charges
                </span>
                <button
                  onClick={handleAddInvoiceItem}
                  className="text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-orange-400 px-2.5 py-1 uppercase font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Item</span>
                </button>
              </div>

              <div className="border border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-zinc-900 text-[10px] font-black uppercase text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="p-2">Category</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 w-20 text-center">Qty / Hrs</th>
                      <th className="p-2 w-24 text-right">Rate ($)</th>
                      <th className="p-2 w-24 text-right">Amount ($)</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
                    {invoiceFormState.items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="p-2">
                          <select
                            aria-label={`Line ${idx + 1} category`}
                            value={item.category}
                            onChange={(e) => handleInvoiceItemChange(idx, "category", e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs p-1 focus:outline-none focus:border-orange-500 rounded-none"
                          >
                            <option value="service">Service (flat price)</option>
                            <option value="labor">Labor ($/hr)</option>
                            <option value="laser_scan">Laser Scan Fee</option>
                            <option value="parts">Parts &amp; Hardware</option>
                            <option value="supplies">Shop Consumables</option>
                            <option value="sublet">Sublet / Welding</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            aria-label={`Line ${idx + 1} description`}
                            value={item.description}
                            onChange={(e) => handleInvoiceItemChange(idx, "description", e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs p-1 focus:outline-none focus:border-orange-500 rounded-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            aria-label={`Line ${idx + 1} quantity or hours`}
                            value={item.quantity}
                            onChange={(e) => handleInvoiceItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs p-1 text-center font-mono focus:outline-none focus:border-orange-500 rounded-none"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            aria-label={`Line ${idx + 1} rate in dollars`}
                            value={item.rate}
                            onChange={(e) => handleInvoiceItemChange(idx, "rate", parseFloat(e.target.value) || 0)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs p-1 text-right font-mono focus:outline-none focus:border-orange-500 rounded-none"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-orange-400">
                          ${item.amount.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveInvoiceItem(idx)}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Remove Line Item"
                            aria-label={`Remove line ${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calculations & Surcharges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-3 bg-zinc-900/60 p-3 border border-zinc-800 text-xs">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                  Rates &amp; payments
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="invoice-labor-rate" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Labor rate ($/hr)
                    </label>
                    <input
                      id="invoice-labor-rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceFormState.laborHourlyRate}
                      onChange={(e) => {
                        const val = Math.max(parseFloat(e.target.value) || 0, 0);
                        // Applies to the labor lines on this invoice. It used to change nothing.
                        updateInvoiceStateAndRecalculate({
                          ...invoiceFormState,
                          laborHourlyRate: val,
                          items: invoiceFormState.items.map((it) => (it.category === "labor" ? { ...it, rate: val } : it)),
                        });
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="invoice-supplies" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Shop supplies (%)
                    </label>
                    <input
                      id="invoice-supplies"
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={invoiceFormState.shopSuppliesRatePct}
                      onChange={(e) =>
                        updateInvoiceStateAndRecalculate({ ...invoiceFormState, shopSuppliesRatePct: Math.max(parseFloat(e.target.value) || 0, 0) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="invoice-tax" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Sales tax (%)
                    </label>
                    <input
                      id="invoice-tax"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={invoiceFormState.taxRatePct}
                      onChange={(e) =>
                        updateInvoiceStateAndRecalculate({ ...invoiceFormState, taxRatePct: Math.max(parseFloat(e.target.value) || 0, 0) })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                    />
                  </div>
                </div>

                {/* Payments on record. Status follows from these — it is not set by hand. */}
                <div className="space-y-2" data-testid="invoice-payments">
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Payments received</div>
                  {(invoiceFormState.payments ?? []).length === 0 ? (
                    <div className="text-zinc-500">None yet.</div>
                  ) : (
                    <ul className="space-y-1">
                      {(invoiceFormState.payments ?? []).map((p) => (
                        <li key={p.orderId} className="flex items-center justify-between gap-2 font-mono">
                          <span className="text-zinc-300">
                            {p.paidAt.slice(0, 10)} · {PAYMENT_METHOD_LABEL[p.method ?? "shopify"]}
                            {p.method === "shopify" || !p.method ? ` ${p.orderName}` : ""}
                            {p.note ? ` · ${p.note}` : ""}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">${p.amount.toFixed(2)}</span>
                            {p.orderId.startsWith("manual-") && (
                              <button
                                type="button"
                                onClick={() => handleRemovePayment(p.orderId)}
                                aria-label={`Remove ${PAYMENT_METHOD_LABEL[p.method ?? "other"]} payment of $${p.amount.toFixed(2)}`}
                                className="p-0.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form onSubmit={handleRecordPayment} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end pt-1">
                    <div>
                      <label htmlFor="payment-amount" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Amount ($)</label>
                      <input
                        id="payment-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="payment-method" className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Paid by</label>
                      <select
                        id="payment-method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 text-xs rounded-none"
                      >
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="card_in_person">Card in shop</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <button type="submit" className="bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-2 text-[10px] font-black uppercase tracking-wider cursor-pointer">
                      Record payment
                    </button>
                    <div className="col-span-3">
                      <label htmlFor="payment-note" className="sr-only">Payment note</label>
                      <input
                        id="payment-note"
                        type="text"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder="Note, e.g. check number (optional)"
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 text-xs"
                      />
                    </div>
                  </form>
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="bg-zinc-900/90 p-4 border border-zinc-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal (Labor &amp; Parts):</span>
                  <span>${invoiceFormState.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Shop Supplies ({invoiceFormState.shopSuppliesRatePct}%):</span>
                  <span>${invoiceFormState.shopSuppliesAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Sales Tax ({invoiceFormState.taxRatePct}%):</span>
                  <span>${invoiceFormState.taxAmount.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex justify-between font-bold text-zinc-100">
                  <span className="uppercase font-black font-sans">Invoice total:</span>
                  <span>${invoiceFormState.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Paid:</span>
                  <span>−${(invoiceFormState.amountPaid ?? 0).toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex justify-between text-base font-bold text-zinc-100" data-testid="invoice-balance">
                  <span className="text-orange-500 uppercase font-black font-sans">Balance due:</span>
                  <span className="text-orange-400">${balanceDue(invoiceFormState).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Internal Mechanic Notes */}
            <div>
              <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1 tracking-wider">
                Private notes (Paul only — never printed or sent to the customer)
              </label>
              <textarea
                value={invoiceFormState.internalOwnerNotes || ""}
                onChange={(e) =>
                  setInvoiceFormState({
                    ...invoiceFormState,
                    internalOwnerNotes: e.target.value,
                  })
                }
                rows={2}
                placeholder="e.g. Parts ordered from Drag Specialties, arriving Tuesday."
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs p-2 focus:outline-none focus:border-orange-500 rounded-none"
              />
            </div>

            {/* Bluetooth Thermal Printer Hardware Control Box */}
            <div className="bg-zinc-900/90 border border-blue-900/50 p-3 space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Bluetooth className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-zinc-200 uppercase tracking-wide">
                    Bluetooth Work Order Printer:
                  </span>
                  {btDeviceName ? (
                    <span className="inline-flex items-center gap-1 font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 border border-emerald-600/40 text-[11px]">
                      <BluetoothConnected className="w-3 h-3" />
                      {btDeviceName}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 border border-zinc-800 text-[11px]">
                      <BluetoothOff className="w-3 h-3 text-zinc-500" />
                      No Direct Bluetooth Paired
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleConnectBluetooth}
                  className="bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-600/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
                  <span>{btDeviceName ? "Re-Pair / Change Printer" : "Pair Bluetooth Printer"}</span>
                </button>
              </div>

              {btMessage && (
                <div
                  className={`p-2 border text-[11px] font-mono flex items-center gap-1.5 ${
                    btStatus === "error"
                      ? "bg-red-950/80 border-red-800 text-red-300"
                      : btStatus === "success"
                      ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                      : "bg-blue-950/80 border-blue-800 text-blue-300"
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5 animate-pulse" />
                  <span>{btMessage}</span>
                </div>
              )}
            </div>

            {/* Action Toolbar */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrintBluetoothWorkOrder}
                  disabled={btStatus === "printing"}
                  className="bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-600/60 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                  title="Send direct ESC/POS Bluetooth raw stream to thermal printer"
                >
                  <Bluetooth className={`w-4 h-4 text-blue-400 ${btStatus === "printing" ? "animate-spin" : ""}`} />
                  <span>{btStatus === "printing" ? "Transmitting..." : "Bluetooth Print"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportSingleInvoiceToExcel(activeInvoiceBooking, invoiceFormState)}
                  className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export to Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer"
                  title="Print using System Print Spooler / AirPrint / Windows / Android Bluetooth printer driver"
                >
                  <Printer className="w-4 h-4 text-orange-500" />
                  <span>System Print</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setActiveInvoiceBooking(null);
                    setInvoiceFormState(null);
                    setInvoiceSendStatus({ loading: false, url: null, error: null });
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-4 py-2 text-xs uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={!!pdfBusy}
                  className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-zinc-200 border border-zinc-700 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer"
                  title="Save, then download the customer's PDF copy"
                >
                  <Download className="w-4 h-4 text-orange-500" />
                  <span>{pdfBusy === "download" ? "Making PDF…" : "Download PDF"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleEmailPdf}
                  disabled={!!pdfBusy}
                  className="bg-sky-800 hover:bg-sky-700 disabled:opacity-60 text-white font-black px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  title={`Save, then email the customer a PDF of this invoice. Replies go to ${emailConfig?.replyTo || SHOP_INFO.email}.`}
                >
                  <Mail className="w-4 h-4" />
                  <span>{pdfBusy === "email" ? "Sending…" : "Email PDF"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveInvoice}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendInvoice}
                  disabled={invoiceSendStatus.loading}
                  className="bg-violet-700 hover:bg-violet-600 disabled:bg-zinc-800 text-white font-black px-6 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors"
                  title="Save, then have Shopify email the customer a link to pay online"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{invoiceSendStatus.loading ? "Sending..." : "Email Pay Link"}</span>
                </button>
              </div>

              <div className="w-full text-[11px] text-zinc-400 space-y-0.5" data-testid="invoice-email-status">
                {emailConfig && !emailConfig.enabled && (
                  <div>Email PDF is not switched on yet — use Download PDF and send it yourself.</div>
                )}
                {(activeInvoiceBooking.invoiceEmails ?? []).slice(-1).map((e) => (
                  <div key={e.at}>
                    Last emailed {new Date(e.at).toLocaleString()} to {e.to} (balance then ${e.balanceDue.toFixed(2)}).
                  </div>
                ))}
              </div>

              {invoiceNotice && (
                <div role="status" className="w-full mt-3 p-2 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs">
                  {invoiceNotice}
                </div>
              )}

              {/* Invoice send status */}
              {invoiceSendStatus.error && (
                <div className="w-full mt-3 p-3 bg-red-950/80 border border-red-600/60 text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{invoiceSendStatus.error}</span>
                </div>
              )}
              {invoiceSendStatus.url && (
                <div className="w-full mt-3 p-3 bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-200">Invoice sent.</strong> Shopify emailed the customer a payment link for the balance due.{" "}
                    <a href={invoiceSendStatus.url} target="_blank" rel="noopener noreferrer" className="underline text-emerald-400 hover:text-emerald-300 ml-1">
                      View invoice →
                    </a>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Hidden Printable Work Order Container for window.print() / System Bluetooth Spoolers */}
      {activeInvoiceBooking && invoiceFormState && (
        <div id="printable-work-order" className="hidden print:block">
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>THE FRAME SHOP</h1>
            <h3 style={{ fontSize: "14px", margin: "4px 0", letterSpacing: "1px" }}>3D LASER FRAME & CHASSIS ALIGNMENT</h3>
            <p style={{ fontSize: "12px", margin: 0 }}>{SHOP_INFO.address} • Phone: {SHOP_INFO.phone} • {SHOP_INFO.email}</p>
            <hr style={{ border: "none", borderTop: "2px solid #000", margin: "10px 0" }} />
          </div>

          <table style={{ width: "100%", fontSize: "12px", marginBottom: "15px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "4px" }}><strong>WORK ORDER #:</strong> {invoiceFormState.invoiceNumber}</td>
                <td style={{ padding: "4px" }}><strong>DATE:</strong> {invoiceFormState.createdDate}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px" }}><strong>TICKET #:</strong> {activeInvoiceBooking.ticketNumber}</td>
                <td style={{ padding: "4px" }}><strong>TECHNICIAN:</strong> {invoiceFormState.mechanicName}</td>
              </tr>
              <tr>
                <td style={{ padding: "4px" }}><strong>RIDER:</strong> {activeInvoiceBooking.name} ({activeInvoiceBooking.phone})</td>
                <td style={{ padding: "4px" }}><strong>MOTORCYCLE:</strong> {activeInvoiceBooking.bikeYear} {activeInvoiceBooking.bikeMake} {activeInvoiceBooking.bikeModel}</td>
              </tr>
            </tbody>
          </table>

          <h4 style={{ fontSize: "12px", borderBottom: "1px solid #000", paddingBottom: "4px", margin: "10px 0 5px 0" }}>ITEMIZED SERVICE & PARTS CHARGES</h4>
          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse", marginBottom: "15px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #000", textAlign: "left" }}>
                <th style={{ padding: "4px" }}>Item Description</th>
                <th style={{ padding: "4px", textAlign: "center" }}>Qty/Hrs</th>
                <th style={{ padding: "4px", textAlign: "right" }}>Rate ($)</th>
                <th style={{ padding: "4px", textAlign: "right" }}>Amount ($)</th>
              </tr>
            </thead>
            <tbody>
              {invoiceFormState.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "4px" }}>{item.description}</td>
                  <td style={{ padding: "4px", textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ padding: "4px", textAlign: "right" }}>${item.rate.toFixed(2)}</td>
                  <td style={{ padding: "4px", textAlign: "right" }}>${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ width: "260px", marginLeft: "auto", fontSize: "12px", textAlign: "right" }}>
            <p style={{ margin: "2px 0" }}>Subtotal: ${invoiceFormState.subtotal.toFixed(2)}</p>
            <p style={{ margin: "2px 0" }}>Shop Supplies ({invoiceFormState.shopSuppliesRatePct}%): ${invoiceFormState.shopSuppliesAmount.toFixed(2)}</p>
            <p style={{ margin: "2px 0" }}>Sales Tax ({invoiceFormState.taxRatePct}%): ${invoiceFormState.taxAmount.toFixed(2)}</p>
            <p style={{ margin: "6px 0 0 0", borderTop: "2px solid #000", paddingTop: "4px" }}>
              Total: ${invoiceFormState.totalAmount.toFixed(2)}
            </p>
            {(invoiceFormState.amountPaid ?? 0) > 0 && (
              <p style={{ margin: "2px 0" }}>Paid: −${(invoiceFormState.amountPaid ?? 0).toFixed(2)}</p>
            )}
            <h3 style={{ margin: "4px 0 0 0" }}>BALANCE DUE: ${balanceDue(invoiceFormState).toFixed(2)}</h3>
          </div>

          {/* Paul's private notes are deliberately not printed: this is the customer's copy. */}

          <div style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px dashed #000", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <div>Customer Signature: ___________________________</div>
            <div>Date: _______________</div>
          </div>
        </div>
      )}

    </div>
  );
};
