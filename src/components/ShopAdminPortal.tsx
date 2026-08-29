import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  Wrench,
  X,
  AlertCircle,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Trash2,
  FileText,
  DollarSign,
  Lock,
  Unlock,
  Printer,
  Plus,
  Minus,
  Save,
  FileCheck,
  CreditCard,
  Calculator,
  Tag,
  Sparkles,
  FileSpreadsheet,
  Download,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Wifi,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Coins,
  Camera,
  Upload,
  Link as LinkIcon,
} from "lucide-react";
import { SHOP_INFO, WORK_PROJECTS } from "../data/shopData";
import { Transaction, Booking, InternalInvoice, InvoiceLineItem } from "../types";
import { TransactionPOSModal } from "./TransactionPOSModal";
import { safeFetch } from "../utils/api";
import { HERO_IMAGE_KEY, DEFAULT_HERO_IMAGE } from "./Hero";
import {
  processImage,
  formatBytes,
  HERO_PRESET,
  PORTRAIT_PRESET,
  GALLERY_PRESET,
} from "../utils/imageProcessor";
import {
  connectBluetoothPrinter,
  sendPayloadToBluetoothPrinter,
  buildEscPosWorkOrderPayload,
  isWebBluetoothSupported,
  getActiveBluetoothDeviceName,
} from "../utils/bluetoothPrinter";

interface ShopAdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getDefaultInvoiceForBooking(booking: Booking): InternalInvoice {
  const invoiceNum = `INV-${booking.ticketNumber.replace("FS-", "")}`;
  const today = new Date().toISOString().split("T")[0];
  const defaultLaborRate = 125.0; // Industry standard labor rate for specialty frame/laser alignment

  let defaultItems: InvoiceLineItem[] = [];

  if (booking.serviceId === "powertrain-alignment") {
    defaultItems = [
      {
        id: "li-1",
        description: "3D Laser Powertrain & Engine Alignment Scan (Zero-Tolerance Jig Setup)",
        category: "laser_scan",
        quantity: 1,
        rate: 75.0,
        amount: 75.0,
      },
      {
        id: "li-2",
        description: "Power Train Motor Mount & Linkage Alignment Labor",
        category: "labor",
        quantity: 2.0,
        rate: defaultLaborRate,
        amount: 250.0,
      },
      {
        id: "li-3",
        description: "Heavy-Duty Urethane Stabilizer Bushing Hardware",
        category: "parts",
        quantity: 1,
        rate: 68.0,
        amount: 68.0,
      },
    ];
  } else if (booking.serviceId === "frame-repair") {
    defaultItems = [
      {
        id: "li-1",
        description: "Hydraulic 3D Frame Shooter Alignment & Neck Angle Scan",
        category: "laser_scan",
        quantity: 1,
        rate: 150.0,
        amount: 150.0,
      },
      {
        id: "li-2",
        description: "Chassis Straightening, Neck Tube Sleeve Welding & Heat Stress Relief",
        category: "labor",
        quantity: 4.5,
        rate: defaultLaborRate,
        amount: 562.5,
      },
      {
        id: "li-3",
        description: "Specialty Steel Sleeve & Gusset Hardware",
        category: "parts",
        quantity: 1,
        rate: 45.0,
        amount: 45.0,
      },
    ];
  } else if (booking.serviceId === "suspension-tuning") {
    defaultItems = [
      {
        id: "li-1",
        description: "Triple Tree Alignment & Fork Stiction Anti-Bind Calibration",
        category: "labor",
        quantity: 2.0,
        rate: defaultLaborRate,
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
    ];
  } else {
    defaultItems = [
      {
        id: "li-1",
        description: `Custom Mechanical Labor - ${booking.serviceTitle}`,
        category: "labor",
        quantity: 2.0,
        rate: defaultLaborRate,
        amount: 250.0,
      },
      {
        id: "li-2",
        description: "Digital Laser Frame Geometry Check",
        category: "laser_scan",
        quantity: 1,
        rate: 50.0,
        amount: 50.0,
      },
    ];
  }

  const subtotal = defaultItems.reduce((acc, item) => acc + item.amount, 0);
  const shopSuppliesRatePct = 5.0; // Standard 5% shop environmental fee
  const shopSuppliesAmount = Math.round(subtotal * (shopSuppliesRatePct / 100) * 100) / 100;
  const taxRatePct = 8.25; // Texas Standard Sales Tax
  const taxAmount = Math.round((subtotal + shopSuppliesAmount) * (taxRatePct / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + shopSuppliesAmount + taxAmount) * 100) / 100;

  return {
    invoiceNumber: invoiceNum,
    createdDate: today,
    dueDate: today,
    mechanicName: "Paul Heary (Owner/Master Fabricator)",
    laborHourlyRate: defaultLaborRate,
    items: defaultItems,
    subtotal,
    shopSuppliesRatePct,
    shopSuppliesAmount,
    taxRatePct,
    taxAmount,
    totalAmount,
    paymentStatus: "unpaid",
    internalOwnerNotes: `Internal Work Order for #${booking.ticketNumber}. Customer reported: "${booking.issueNotes || "Routine inspection"}".`,
  };
}

export function exportSingleInvoiceToExcel(booking: Booking, invoice: InternalInvoice) {
  const wb = XLSX.utils.book_new();

  const invoiceData: any[][] = [
    ["THE FRAME SHOP - 3D LASER FRAME & CHASSIS ALIGNMENT"],
    ["INTERNAL OWNER WORK ORDER & INVOICE"],
    [""],
    ["Invoice #:", invoice.invoiceNumber, "", "Invoice Date:", invoice.createdDate],
    ["Ticket #:", booking.ticketNumber, "", "Due Date:", invoice.dueDate],
    ["Technician:", invoice.mechanicName, "", "Payment Status:", invoice.paymentStatus.toUpperCase()],
    [""],
    ["CUSTOMER & MOTORCYCLE DETAILS"],
    ["Customer Name:", booking.name, "", "Phone:", booking.phone],
    ["Email:", booking.email, "", "Requested Service:", booking.serviceTitle],
    ["Motorcycle:", `${booking.bikeYear} ${booking.bikeMake} ${booking.bikeModel}`],
    ["Customer Issue Notes:", booking.issueNotes || "N/A"],
    [""],
    ["ITEMIZED CHARGES"],
    ["Item #", "Category", "Description", "Qty / Hours", "Rate ($)", "Line Total ($)"]
  ];

  invoice.items.forEach((item, index) => {
    invoiceData.push([
      index + 1,
      item.category.toUpperCase(),
      item.description,
      item.quantity,
      item.rate,
      item.amount
    ]);
  });

  invoiceData.push([""]);
  invoiceData.push(["", "", "", "", "Subtotal ($):", invoice.subtotal]);
  invoiceData.push(["", "", "", "", `Shop Supplies (${invoice.shopSuppliesRatePct}%):`, invoice.shopSuppliesAmount]);
  invoiceData.push(["", "", "", "", `Sales Tax (${invoice.taxRatePct}%):`, invoice.taxAmount]);
  invoiceData.push(["", "", "", "", "TOTAL DUE ($):", invoice.totalAmount]);
  invoiceData.push([""]);
  if (invoice.internalOwnerNotes) {
    invoiceData.push(["Internal Accounting Notes:", invoice.internalOwnerNotes]);
  }

  const ws = XLSX.utils.aoa_to_sheet(invoiceData);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 16 },
    { wch: 45 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Work Order Invoice");
  XLSX.writeFile(wb, `${invoice.invoiceNumber}_${booking.ticketNumber}_TheFrameShop.xlsx`);
}

export function exportAllInvoicesToExcel(bookings: Booking[]) {
  const wb = XLSX.utils.book_new();

  const summaryRows: any[][] = [
    ["THE FRAME SHOP - ALL INTERNAL WORK ORDERS & INVOICES SUMMARY"],
    ["Export Date:", new Date().toLocaleString()],
    [""],
    ["Invoice #", "Ticket #", "Date", "Customer Name", "Phone", "Motorcycle", "Service", "Subtotal ($)", "Supplies ($)", "Tax ($)", "Total Amount ($)", "Status"]
  ];

  const detailRows: any[][] = [
    ["Invoice #", "Ticket #", "Customer", "Item Category", "Item Description", "Qty/Hrs", "Rate ($)", "Amount ($)"]
  ];

  let grandTotal = 0;

  bookings.forEach((b) => {
    if (b.invoice) {
      const inv = b.invoice;
      grandTotal += inv.totalAmount;
      summaryRows.push([
        inv.invoiceNumber,
        b.ticketNumber,
        inv.createdDate,
        b.name,
        b.phone,
        `${b.bikeYear} ${b.bikeMake} ${b.bikeModel}`,
        b.serviceTitle,
        inv.subtotal,
        inv.shopSuppliesAmount,
        inv.taxAmount,
        inv.totalAmount,
        inv.paymentStatus.toUpperCase()
      ]);

      inv.items.forEach((item) => {
        detailRows.push([
          inv.invoiceNumber,
          b.ticketNumber,
          b.name,
          item.category.toUpperCase(),
          item.description,
          item.quantity,
          item.rate,
          item.amount
        ]);
      });
    }
  });

  summaryRows.push([""]);
  summaryRows.push(["TOTAL INVOICED SHOP REVENUE ($):", "", "", "", "", "", "", "", "", "", grandTotal]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Invoices Summary");

  const wsDetails = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetails['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDetails, "Itemized Charges");

  XLSX.writeFile(wb, `TheFrameShop_MasterInvoices_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function exportAllTransactionsToExcel(transactions: Transaction[]) {
  const wb = XLSX.utils.book_new();

  const summaryRows: any[][] = [
    ["THE FRAME SHOP - MASTER FINANCIAL TRANSACTIONS LEDGER"],
    ["Export Date:", new Date().toLocaleString()],
    [""],
    ["Txn ID", "Date/Time", "Type", "Customer Name", "Phone", "Motorcycle", "Payment Method", "Subtotal ($)", "Supplies ($)", "Tax ($)", "Total Amount ($)", "Status"]
  ];

  let grandTotal = 0;

  transactions.forEach((t) => {
    if (t.status === "completed") {
      grandTotal += t.totalAmount;
    }
    summaryRows.push([
      t.id,
      new Date(t.timestamp).toLocaleString(),
      t.type.replace(/_/g, " ").toUpperCase(),
      t.customerName,
      t.customerPhone,
      t.motorcycle,
      t.paymentMethod.toUpperCase(),
      t.subtotal,
      t.shopSuppliesAmount,
      t.taxAmount,
      t.totalAmount,
      t.status.toUpperCase()
    ]);
  });

  summaryRows.push([""]);
  summaryRows.push(["TOTAL COMPLETED TRANSACTION REVENUE ($):", "", "", "", "", "", "", "", "", "", grandTotal]);

  const ws = XLSX.utils.aoa_to_sheet(summaryRows);
  ws['!cols'] = [
    { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Financial Transactions");
  XLSX.writeFile(wb, `TheFrameShop_TransactionsLedger_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function exportPriceMatrixToExcel() {
  const wb = XLSX.utils.book_new();

  const data: any[][] = [
    ["THE FRAME SHOP - CONFIDENTIAL OWNER PRICE MATRIX & RATE SHEET"],
    ["For Paul Hurey (Owner / Head Mechanic) - Personal Eyes Only"],
    ["Location:", "7531 Unit C Root Road, Spring, TX 77389"],
    ["Export Date:", new Date().toLocaleDateString()],
    [""],
    ["MASTER LABOR RATES & OPERATING BASELINES"],
    ["Rate Category", "Billable Retail Rate ($/hr)", "Estimated Overhead Cost ($/hr)", "Target Gross Margin (%)", "Notes"],
    ["Standard V-Twin Mechanical Labor", 150.00, 45.00, "70.0%", "Houston independent specialist rate (Dealer $190-$210/hr)"],
    ["Master Frame & Chassis Straightening", 165.00, 45.00, "72.7%", "Laser jig setup, hydraulic frame puller, neck rake & trail correction"],
    ["Custom TIG Welding & Fabrication", 185.00, 50.00, "73.0%", "Steel, Chromoly, Aluminum structural TIG & gusseting"],
    ["Emergency / Priority Diagnostic", 225.00, 45.00, "80.0%", "Same-day scan & emergency event teardown priority"],
    [""],
    ["3D LASER ALIGNMENT & FRAME STRAIGHTENING TIERS"],
    ["Service Name", "Retail Price Range ($)", "Avg Labor Hrs", "Est Overhead Cost ($)", "Est Net Profit ($)", "Gross Margin (%)"],
    ["3D Laser Diagnostic Chassis Scan", "$250.00", 1.0, "$45.00", "$205.00", "82.0%"],
    ["3D Powertrain Laser Alignment & Wobble Elimination", "$380.00", 2.25, "$101.25", "$278.75", "73.4%"],
    ["Frame Straightening Tier 1 (Minor Neck/Swingarm Offset)", "$750 - $950", 4.5, "$202.50", "$647.50", "76.2%"],
    ["Frame Straightening Tier 2 (Crash Bend / Rake Restoration)", "$1,450 - $1,850", 9.0, "$405.00", "$1,245.00", "75.5%"],
    ["Frame Straightening Tier 3 (Heavy Structural Restoration + TIG)", "$2,500 - $3,800", 18.0, "$810.00", "$2,340.00", "74.3%"],
    [""],
    ["HARLEY ENGINE & PERFORMANCE UPGRADES MATRIX"],
    ["Upgrade Package", "Labor Hours", "Billable Labor ($)", "Avg Parts Wholesale ($)", "Parts Markup (%)", "Est Total Retail ($)", "Est Net Profit ($)"],
    ["Stage 1 (Intake, Exhaust, Tuner/Dyno Map)", 3.0, "$450.00", "$750.00", "35.0%", "$1,462.50", "$712.50"],
    ["Stage 2 Camshaft & Adjustable Pushrods", 6.0, "$950.00", "$850.00", "30.0%", "$2,055.00", "$1,205.00"],
    ["Stage 3/4 Big Bore Cylinder & Head Kit (114ci->128ci)", 15.0, "$2,400.00", "$2,600.00", "25.0%", "$5,650.00", "$3,050.00"],
    ["Primary Chain Drive Conversion & HD Clutch", 3.5, "$550.00", "$520.00", "30.0%", "$1,226.00", "$706.00"],
    ["Transmission Gearset & Top Trapdoor Refresh", 5.5, "$850.00", "$820.00", "30.0%", "$1,916.00", "$1,096.00"],
    [""],
    ["MAINTENANCE, SUSPENSION & BRAKE SERVICES"],
    ["Service Item", "Retail Price ($)", "Estimated Cost ($)", "Net Profit ($)", "Margin (%)"],
    ["Full 3-Hole Synthetic Fluid Flush (20W-50 V-Twin)", "$220.00", "$62.00", "$158.00", "71.8%"],
    ["Scratch-Free Tire Change & Dynamic Balance (Off Bike)", "$75.00 / wheel", "$12.00", "$63.00", "84.0%"],
    ["Scratch-Free Tire Change & Dynamic Balance (On Bike)", "$135.00 / wheel", "$28.00", "$107.00", "79.3%"],
    ["Triple Tree Anti-Stiction & Suspension Tuning", "$280.00", "$45.00", "$235.00", "83.9%"],
    ["Brake Digital Audit & High-Temp DOT Fluid Flush", "$140.00", "$22.00", "$118.00", "84.3%"]
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 48 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Owner Price Matrix");
  XLSX.writeFile(wb, `TheFrameShop_OwnerPriceMatrix_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export const ShopAdminPortal: React.FC<ShopAdminPortalProps> = ({ isOpen, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");

  // Navigation Tab State
  const [activeMainTab, setActiveMainTab] = useState<"bookings" | "transactions" | "pricematrix" | "media">("bookings");

  // Media Control State (Owner Only)
  const DEFAULT_PAUL_IMG = 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=1200&auto=format&fit=crop';
  const [paulPhoto, setPaulPhoto] = useState<string>(() => {
    try {
      return localStorage.getItem('paul_custom_photo') || DEFAULT_PAUL_IMG;
    } catch {
      return DEFAULT_PAUL_IMG;
    }
  });
  const [paulUrlInput, setPaulUrlInput] = useState<string>('');
  const [paulMsg, setPaulMsg] = useState<string>('');
  const [paulBusy, setPaulBusy] = useState<boolean>(false);

  const [heroImage, setHeroImage] = useState<string>(() => {
    try {
      return localStorage.getItem(HERO_IMAGE_KEY) || DEFAULT_HERO_IMAGE;
    } catch {
      return DEFAULT_HERO_IMAGE;
    }
  });
  const [heroUrlInput, setHeroUrlInput] = useState<string>('');
  const [heroMsg, setHeroMsg] = useState<string>('');
  const [heroBusy, setHeroBusy] = useState<boolean>(false);

  const saveHeroImage = (newUrl: string, note?: string) => {
    setHeroImage(newUrl);
    try {
      localStorage.setItem(HERO_IMAGE_KEY, newUrl);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('hero_image_updated'));
    } catch (e) {
      console.error(e);
      alert(
        'This browser ran out of local storage room, so the hero image could not be saved. Try resetting an image you are no longer using, then upload again.'
      );
      return;
    }
    setHeroMsg(note || 'Landing page hero background updated!');
    setTimeout(() => setHeroMsg(''), 6000);
  };

  const handleHeroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setHeroBusy(true);
    try {
      const shot = await processImage(file, HERO_PRESET);
      saveHeroImage(
        shot.dataUrl,
        `Hero updated — ${
          shot.fittedWhole
            ? `kept whole at ${shot.width}×${shot.height} (too tall to crop to a banner)`
            : `auto-cropped to ${shot.width}×${shot.height}`
        }, sharpened, ${formatBytes(shot.originalBytes)} → ${formatBytes(shot.bytes)}`
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'That image could not be processed.');
    } finally {
      setHeroBusy(false);
    }
  };

  const handleHeroReset = () => {
    setHeroImage(DEFAULT_HERO_IMAGE);
    try {
      localStorage.removeItem(HERO_IMAGE_KEY);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('hero_image_updated'));
    } catch (e) {
      console.error(e);
    }
    setHeroMsg('Hero photo removed — headline now shows on the plain dark background.');
    setTimeout(() => setHeroMsg(''), 3000);
  };

  const [galleryPhotos, setGalleryPhotos] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('theframeshop_gallery_photos');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [galleryUrlInputs, setGalleryUrlInputs] = useState<Record<string, string>>({});
  const [galleryMsg, setGalleryMsg] = useState<string>('');
  const [galleryBusyId, setGalleryBusyId] = useState<string | null>(null);

  const savePaulPhoto = (newUrl: string, note?: string) => {
    setPaulPhoto(newUrl);
    try {
      localStorage.setItem('paul_custom_photo', newUrl);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('paul_photo_updated'));
    } catch (e) {
      console.error(e);
      alert(
        'This browser ran out of local storage room, so the photo could not be saved. Try resetting an image you are no longer using, then upload again.'
      );
      return;
    }
    setPaulMsg(note || "Paul's website biopic photo updated!");
    setTimeout(() => setPaulMsg(''), 6000);
  };

  const handlePaulFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setPaulBusy(true);
    try {
      const shot = await processImage(file, PORTRAIT_PRESET);
      savePaulPhoto(
        shot.dataUrl,
        `Photo updated — auto-cropped to ${shot.width}×${shot.height}, sharpened, ${formatBytes(
          shot.originalBytes
        )} → ${formatBytes(shot.bytes)}`
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'That image could not be processed.');
    } finally {
      setPaulBusy(false);
    }
  };

  const handlePaulReset = () => {
    setPaulPhoto(DEFAULT_PAUL_IMG);
    try {
      localStorage.removeItem('paul_custom_photo');
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('paul_photo_updated'));
    } catch (e) {
      console.error(e);
    }
    setPaulMsg("Paul's photo reset to original shop default.");
    setTimeout(() => setPaulMsg(''), 3000);
  };

  const saveGalleryPhoto = (projId: string, newUrl: string, note?: string) => {
    const updated = { ...galleryPhotos, [projId]: newUrl };
    setGalleryPhotos(updated);
    try {
      localStorage.setItem('theframeshop_gallery_photos', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('gallery_photos_updated'));
    } catch (e) {
      console.error(e);
      alert(
        'This browser ran out of local storage room, so the gallery photo could not be saved. Try resetting a case study photo you are no longer using, then upload again.'
      );
      return;
    }
    setGalleryMsg(note || 'Case Study gallery photo updated!');
    setTimeout(() => setGalleryMsg(''), 6000);
  };

  const handleGalleryFileUpload = async (
    projId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setGalleryBusyId(projId);
    try {
      const shot = await processImage(file, GALLERY_PRESET);
      saveGalleryPhoto(
        projId,
        shot.dataUrl,
        `Case study photo updated — auto-cropped to ${shot.width}×${shot.height}, sharpened, ${formatBytes(
          shot.originalBytes
        )} → ${formatBytes(shot.bytes)}`
      );
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'That image could not be processed.');
    } finally {
      setGalleryBusyId(null);
    }
  };

  const handleGalleryReset = (projId: string) => {
    const updated = { ...galleryPhotos };
    delete updated[projId];
    setGalleryPhotos(updated);
    try {
      localStorage.setItem('theframeshop_gallery_photos', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('gallery_photos_updated'));
    } catch (e) {
      console.error(e);
    }
    setGalleryMsg('Gallery project photo reset to default.');
    setTimeout(() => setGalleryMsg(''), 3000);
  };

  // Estimator State for Owner Price Matrix
  const [calcLaborTier, setCalcLaborTier] = useState<number>(165);
  const [calcLaborHours, setCalcLaborHours] = useState<number>(6.0);
  const [calcPartsWholesale, setCalcPartsWholesale] = useState<number>(850);
  const [calcPartsMarkupPct, setCalcPartsMarkupPct] = useState<number>(30);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingTechNoteId, setEditingTechNoteId] = useState<string | null>(null);
  const [techNoteText, setTechNoteText] = useState<string>("");

  // Invoice Builder State
  const [activeInvoiceBooking, setActiveInvoiceBooking] = useState<Booking | null>(null);
  const [invoiceFormState, setInvoiceFormState] = useState<InternalInvoice | null>(null);
  const [stripeInvoiceStatus, setStripeInvoiceStatus] = useState<{ loading: boolean; url: string | null; error: string | null }>({ loading: false, url: null, error: null });

  // POS Modal State
  const [isPOSModalOpen, setIsPOSModalOpen] = useState<boolean>(false);
  const [posInitialBooking, setPosInitialBooking] = useState<Booking | null>(null);

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
      invoiceFormState.internalOwnerNotes
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

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await safeFetch("/api/bookings");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.bookings || []);
        setBookings(list);
      }
    } catch {
      // Gracefully handle network/sandboxing constraints
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await safeFetch("/api/transactions");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.transactions || []);
        setTransactions(list);
      }
    } catch {
      // Gracefully handle network/sandboxing constraints
    }
  };

  const handleRefundTransaction = async (txnId: string) => {
    const reason = window.prompt("Enter internal refund / void audit reason for Paul's accounting:");
    if (reason === null) return;
    try {
      const res = await safeFetch(`/api/transactions/${txnId}/refund`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "Customer refund issued by owner." }),
      });
      if (res.ok) {
        fetchTransactions();
        fetchBookings();
      }
    } catch {
      // Silent error handler
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchBookings();
      fetchTransactions();
    }
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
        setPinError("Invalid PIN. Access denied.");
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

  const handleStatusUpdate = async (id: string, newStatus: Booking["status"]) => {
    try {
      const res = await safeFetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchBookings();
      }
    } catch {
      // Silent error handler
    }
  };

  const handleSaveTechNotes = async (id: string) => {
    try {
      const res = await safeFetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ techNotes: techNoteText }),
      });
      if (res.ok) {
        setEditingTechNoteId(null);
        fetchBookings();
      }
    } catch {
      // Silent error handler
    }
  };

  const openInvoiceModal = (booking: Booking) => {
    setActiveInvoiceBooking(booking);
    setStripeInvoiceStatus({ loading: false, url: null, error: null });
    if (booking.invoice) {
      setInvoiceFormState(booking.invoice);
    } else {
      setInvoiceFormState(getDefaultInvoiceForBooking(booking));
    }
  };

  const updateInvoiceStateAndRecalculate = (updated: InternalInvoice) => {
    const items = updated.items.map((item) => ({
      ...item,
      amount: Math.round(item.quantity * item.rate * 100) / 100,
    }));
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    const shopSuppliesAmount = Math.round(subtotal * (updated.shopSuppliesRatePct / 100) * 100) / 100;
    const taxAmount = Math.round((subtotal + shopSuppliesAmount) * (updated.taxRatePct / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + shopSuppliesAmount + taxAmount) * 100) / 100;

    setInvoiceFormState({
      ...updated,
      items,
      subtotal,
      shopSuppliesAmount,
      taxAmount,
      totalAmount,
    });
  };

  const handleInvoiceItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    if (!invoiceFormState) return;
    const newItems = [...invoiceFormState.items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    updateInvoiceStateAndRecalculate({
      ...invoiceFormState,
      items: newItems,
    });
  };

  const handleAddInvoiceItem = () => {
    if (!invoiceFormState) return;
    const newItem: InvoiceLineItem = {
      id: `li-${Date.now()}`,
      description: "Additional Shop Labor / Parts / Laser Target Setup",
      category: "labor",
      quantity: 1,
      rate: invoiceFormState.laborHourlyRate || 125.0,
      amount: invoiceFormState.laborHourlyRate || 125.0,
    };
    updateInvoiceStateAndRecalculate({
      ...invoiceFormState,
      items: [...invoiceFormState.items, newItem],
    });
  };

  const handleRemoveInvoiceItem = (index: number) => {
    if (!invoiceFormState) return;
    const newItems = invoiceFormState.items.filter((_, i) => i !== index);
    updateInvoiceStateAndRecalculate({
      ...invoiceFormState,
      items: newItems,
    });
  };

  const handleSaveInvoice = async () => {
    if (!activeInvoiceBooking || !invoiceFormState) return;
    try {
      const res = await safeFetch(`/api/bookings/${activeInvoiceBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice: invoiceFormState }),
      });
      if (res.ok) {
        setActiveInvoiceBooking(null);
        setInvoiceFormState(null);
        fetchBookings();
      }
    } catch {
      // Silent error handler
    }
  };

  const handleSendStripeInvoice = async () => {
    if (!activeInvoiceBooking || !invoiceFormState) return;
    if (!activeInvoiceBooking.email) {
      setStripeInvoiceStatus({ loading: false, url: null, error: "This booking has no email address on file. Add the customer's email before sending." });
      return;
    }
    setStripeInvoiceStatus({ loading: true, url: null, error: null });
    try {
      // First save the invoice to the booking record
      await safeFetch(`/api/bookings/${activeInvoiceBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice: invoiceFormState }),
      });

      // Send via Stripe — one line item per invoice item
      const res = await safeFetch("/api/stripe/invoice/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: activeInvoiceBooking.name,
          customerEmail: activeInvoiceBooking.email,
          bookingId: activeInvoiceBooking.id,
          ticketNumber: activeInvoiceBooking.ticketNumber,
          dueDays: 30,
          items: invoiceFormState.items.map((item) => ({
            description: item.description,
            amount: item.amount,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStripeInvoiceStatus({ loading: false, url: null, error: data.error || "Failed to send Stripe invoice." });
        return;
      }
      setStripeInvoiceStatus({ loading: false, url: data.invoiceUrl, error: null });
      fetchBookings();
    } catch {
      setStripeInvoiceStatus({ loading: false, url: null, error: "Network error. Check your connection and try again." });
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this appointment ticket?")) return;
    try {
      const res = await safeFetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchBookings();
      }
    } catch {
      // Silent error handler
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
      b.phone.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const inShopCount = bookings.filter((b) => b.status === "in_shop").length;
  const completedCount = bookings.filter((b) => b.status === "completed").length;

  // Transaction Financial Ledger Calculations
  const completedTxns = transactions.filter((t) => t.status === "completed");
  const totalTxnRevenue = completedTxns.reduce((sum, t) => sum + t.totalAmount, 0);
  const cardTxns = completedTxns.filter((t) => t.paymentMethod === "card");
  const cardRevenue = cardTxns.reduce((sum, t) => sum + t.totalAmount, 0);
  const cashTxns = completedTxns.filter((t) => t.paymentMethod === "cash");
  const cashRevenue = cashTxns.reduce((sum, t) => sum + t.totalAmount, 0);
  const taxRevenue = completedTxns.reduce((sum, t) => sum + t.taxAmount, 0);

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
                  onClick={() => setActiveMainTab("transactions")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeMainTab === "transactions"
                      ? "bg-orange-600 text-white shadow"
                      : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  💳 Customer POS &amp; Transactions ({transactions.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab("pricematrix")}
                  className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeMainTab === "pricematrix"
                      ? "bg-amber-500 text-zinc-950 font-black shadow"
                      : "bg-zinc-950 text-amber-400 hover:text-amber-300 border border-amber-600/40"
                  }`}
                  title="Owner Confidential Price Matrix & Rate Sheet (Personal Eyes Only)"
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>🔒 Owner Price Matrix</span>
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
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAuthenticated && (
              <>
                <button
                  onClick={() => {
                    setPosInitialBooking(null);
                    setIsPOSModalOpen(true);
                  }}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg"
                  title="Process New Customer POS Transaction"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>+ Process Customer Transaction</span>
                </button>

                {activeMainTab === "bookings" ? (
                  <button
                    onClick={() => exportAllInvoicesToExcel(bookings)}
                    className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Export All Invoices to Microsoft Excel Workbook"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Invoices Excel</span>
                  </button>
                ) : activeMainTab === "transactions" ? (
                  <button
                    onClick={() => exportAllTransactionsToExcel(transactions)}
                    className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Export Transactions Ledger to Microsoft Excel Workbook"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Transactions Excel</span>
                  </button>
                ) : (
                  <button
                    onClick={() => exportPriceMatrixToExcel()}
                    className="bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-300 px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Export Confidential Owner Price Matrix to Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                    <span>Matrix Excel</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    fetchBookings();
                    fetchTransactions();
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
            
            {activeMainTab === "pricematrix" ? (
              /* Confidential Owner Price Matrix & Rate Sheet View */
              <div className="space-y-6 font-sans">
                {/* Security Banner & Master Rates KPI Bar */}
                <div className="bg-amber-950/40 border-2 border-amber-600/60 p-4 space-y-3 relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-600/30 pb-3">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-400 bg-amber-950 px-2.5 py-0.5 border border-amber-500/50 tracking-widest">
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>CONFIDENTIAL • PAUL'S PERSONAL SHOP PRICE MATRIX (OWNER EYES ONLY)</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-amber-100 uppercase italic mt-1.5 flex items-center gap-2">
                        <span>HOUSTON METRO V-TWIN &amp; FRAME JIG INDUSTRY PRICE SHEET</span>
                      </h3>
                      <p className="text-xs text-amber-200/80 mt-0.5">
                        Established benchmark rates for Spring / Houston, TX custom motorcycle repair, 3D laser alignment, hydraulic frame straightening, and Harley-Davidson performance upgrades.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black px-3 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Matrix</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => exportPriceMatrixToExcel()}
                        className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 font-bold px-3 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Excel Export</span>
                      </button>
                    </div>
                  </div>

                  {/* Hourly Rate KPI Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    <div className="bg-zinc-950/90 p-3 border border-amber-600/40">
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">Standard Mechanical</div>
                      <div className="text-2xl font-black text-zinc-100 font-mono mt-0.5">$150.00 / hr</div>
                      <div className="text-[10px] text-zinc-400 mt-1">General V-Twin Repair (Dealer: $190-$210/hr)</div>
                    </div>

                    <div className="bg-zinc-950/90 p-3 border border-amber-600/40">
                      <div className="text-[10px] font-black uppercase tracking-wider text-orange-400">Master Frame &amp; Laser Jig</div>
                      <div className="text-2xl font-black text-orange-400 font-mono mt-0.5">$165.00 / hr</div>
                      <div className="text-[10px] text-zinc-400 mt-1">Laser scan, hydraulic pull, neck &amp; rake fix</div>
                    </div>

                    <div className="bg-zinc-950/90 p-3 border border-amber-600/40">
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-400">Custom TIG Welding</div>
                      <div className="text-2xl font-black text-zinc-100 font-mono mt-0.5">$185.00 / hr</div>
                      <div className="text-[10px] text-zinc-400 mt-1">Steel, Chromoly, Aluminum structural TIG</div>
                    </div>

                    <div className="bg-zinc-950/90 p-3 border border-amber-600/40">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Emergency Priority Scan</div>
                      <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">$225.00 / hr</div>
                      <div className="text-[10px] text-zinc-400 mt-1">Same-day diagnostic &amp; emergency teardown</div>
                    </div>
                  </div>
                </div>

                {/* Section 1: 3D Laser Alignment & Hydraulic Frame Jig Price Tiers */}
                <div className="bg-zinc-950 border border-zinc-800 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>CHASSIS &amp; FRAME JIG SPECIALIST RATES</span>
                      </div>
                      <h4 className="text-base font-black text-zinc-100 uppercase italic">
                        1. 3D Laser Alignment &amp; Hydraulic Frame Straightening Matrix
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 uppercase font-mono">
                      Target Gross Margin: 72% - 82%
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-zinc-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-900 text-zinc-400 font-black uppercase text-[10px] border-b border-zinc-800">
                        <tr>
                          <th className="p-2.5">Service Tier</th>
                          <th className="p-2.5">Scope &amp; Technical Procedure</th>
                          <th className="p-2.5 text-center">Avg Hours</th>
                          <th className="p-2.5 text-right">Retail Price</th>
                          <th className="p-2.5 text-right">Direct Cost</th>
                          <th className="p-2.5 text-right">Est Net Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70 font-mono">
                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-orange-400">
                            3D Laser Diagnostic Scan
                          </td>
                          <td className="p-2.5 font-sans text-zinc-300">
                            Full chassis &amp; powertrain baseline scan, neck angle tilt test, wheel tracking report.
                          </td>
                          <td className="p-2.5 text-center text-zinc-400">1.0 hrs</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$250.00</td>
                          <td className="p-2.5 text-right text-zinc-500">$45.00</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$205.00 (82%)</td>
                        </tr>

                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-orange-400">
                            Powertrain 3D Laser Alignment
                          </td>
                          <td className="p-2.5 font-sans text-zinc-300">
                            Laser align motor, transmission, primary &amp; swingarm. Isolation mount torque lock. Wobble fix.
                          </td>
                          <td className="p-2.5 text-center text-zinc-400">2.25 hrs</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$380.00</td>
                          <td className="p-2.5 text-right text-zinc-500">$101.25</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$278.75 (73%)</td>
                        </tr>

                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-orange-400">
                            Frame Tier 1 (Minor Adjust)
                          </td>
                          <td className="p-2.5 font-sans text-zinc-300">
                            Neck rake adjustment (&lt;2° deviation), minor swingarm pivot or rear axle pull on hydraulic jig.
                          </td>
                          <td className="p-2.5 text-center text-zinc-400">4.5 hrs</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$750 - $950</td>
                          <td className="p-2.5 text-right text-zinc-500">$202.50</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$647.50 (76%)</td>
                        </tr>

                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-orange-400">
                            Frame Tier 2 (Crash Bend)
                          </td>
                          <td className="p-2.5 font-sans text-zinc-300">
                            Post-crash twisted backbone correction, heavy neck pull, front fork &amp; triple tree anti-stiction reset.
                          </td>
                          <td className="p-2.5 text-center text-zinc-400">9.0 hrs</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$1,450 - $1,850</td>
                          <td className="p-2.5 text-right text-zinc-500">$405.00</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$1,245.00 (75%)</td>
                        </tr>

                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-orange-400">
                            Frame Tier 3 (Structural TIG)
                          </td>
                          <td className="p-2.5 font-sans text-zinc-300">
                            Complete teardown alignment, custom chromoly gussets, TIG crack repair, stress relief &amp; stretch.
                          </td>
                          <td className="p-2.5 text-center text-zinc-400">18.0 hrs</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$2,500 - $3,800</td>
                          <td className="p-2.5 text-right text-zinc-500">$810.00</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$2,340.00 (74%)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 2: Harley Engine & Upgrade Packages Price Matrix */}
                <div className="bg-zinc-950 border border-zinc-800 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2 flex-wrap gap-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        <span>HARLEY-DAVIDSON MILWAUKEE-EIGHT / TWIN CAM / EVO UPGRADES</span>
                      </div>
                      <h4 className="text-base font-black text-zinc-100 uppercase italic">
                        2. Engine &amp; Performance Package Pricing (Labor + Wholesale Parts Markup)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-2 py-0.5 uppercase font-mono">
                      Standard Parts Markup: +30% to +35%
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-zinc-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-900 text-zinc-400 font-black uppercase text-[10px] border-b border-zinc-800">
                        <tr>
                          <th className="p-2.5">Package Name</th>
                          <th className="p-2.5">Included Components &amp; Work</th>
                          <th className="p-2.5 text-right">Labor ($)</th>
                          <th className="p-2.5 text-right">Parts Wholesale</th>
                          <th className="p-2.5 text-right">Parts Retail (+30%)</th>
                          <th className="p-2.5 text-right">Total Retail Quote</th>
                          <th className="p-2.5 text-right">Net Shop Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70 font-mono">
                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-zinc-100">Stage 1 Performance</td>
                          <td className="p-2.5 font-sans text-zinc-300">High-flow intake, Vance &amp; Hines/S&amp;S exhaust, flash tuner map</td>
                          <td className="p-2.5 text-right font-bold text-orange-400">$450.00</td>
                          <td className="p-2.5 text-right text-zinc-500">$750.00</td>
                          <td className="p-2.5 text-right text-zinc-300">$1,012.50</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$1,462.50</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$712.50</td>
                        </tr>

                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-zinc-100">Stage 2 Camshaft Upgrade</td>
                          <td className="p-2.5 font-sans text-zinc-300">Performance torque cam, inner bearings, quick-adjust pushrods, tappets</td>
                          <td className="p-2.5 text-right font-bold text-orange-400">$950.00</td>
                          <td className="p-2.5 text-right text-zinc-500">$850.00</td>
                          <td className="p-2.5 text-right text-zinc-300">$1,105.00</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$2,055.00</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$1,205.00</td>
                        </tr>

                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-zinc-100">Stage 3/4 Big Bore (114-&gt;128ci)</td>
                          <td className="p-2.5 font-sans text-zinc-300">Big bore cylinders, forged pistons, ported heads, throttle body &amp; clutch spring</td>
                          <td className="p-2.5 text-right font-bold text-orange-400">$2,400.00</td>
                          <td className="p-2.5 text-right text-zinc-500">$2,600.00</td>
                          <td className="p-2.5 text-right text-zinc-300">$3,250.00</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$5,650.00</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$3,050.00</td>
                        </tr>

                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-zinc-100">Primary Chain Drive &amp; Clutch</td>
                          <td className="p-2.5 font-sans text-zinc-300">530 O-ring chain conversion, heavy-duty clutch basket, primary tensioner</td>
                          <td className="p-2.5 text-right font-bold text-orange-400">$550.00</td>
                          <td className="p-2.5 text-right text-zinc-500">$520.00</td>
                          <td className="p-2.5 text-right text-zinc-300">$676.00</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$1,226.00</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$706.00</td>
                        </tr>

                        <tr className="hover:bg-zinc-900/50">
                          <td className="p-2.5 font-sans font-bold text-zinc-100">Transmission &amp; Trapdoor Refresh</td>
                          <td className="p-2.5 font-sans text-zinc-300">6-speed gearset overhaul, heavy-duty door bearings, shift forks &amp; seals</td>
                          <td className="p-2.5 text-right font-bold text-orange-400">$850.00</td>
                          <td className="p-2.5 text-right text-zinc-500">$820.00</td>
                          <td className="p-2.5 text-right text-zinc-300">$1,066.00</td>
                          <td className="p-2.5 text-right font-bold text-zinc-100">$1,916.00</td>
                          <td className="p-2.5 text-right font-bold text-emerald-400">$1,096.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3: Interactive Job Profit & Quote Estimator for Paul */}
                <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 border-2 border-orange-600/80 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-orange-500" />
                        <span>PAUL'S INTERACTIVE JOB PROFIT &amp; QUOTE ESTIMATOR</span>
                      </div>
                      <h4 className="text-lg font-black text-zinc-100 uppercase italic mt-0.5">
                        Calculate Customer Quote, Wholesale Margin &amp; Net Profit
                      </h4>
                    </div>
                    <span className="text-xs text-zinc-400 italic">
                      Adjust parameters below to see exact customer quotes and shop bottom-line profit.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                        Labor Rate Tier ($/hr)
                      </label>
                      <select
                        value={calcLaborTier}
                        onChange={(e) => setCalcLaborTier(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-500 text-zinc-100 p-2 text-xs font-mono font-bold focus:outline-none"
                      >
                        <option value={150}>$150.00 - Standard Mechanical</option>
                        <option value={165}>$165.00 - Master Frame Jig</option>
                        <option value={185}>$185.00 - Custom TIG Welding</option>
                        <option value={225}>$225.00 - Priority Emergency Scan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                        Billable Labor Hours
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="100"
                        value={calcLaborHours}
                        onChange={(e) => setCalcLaborHours(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-500 text-zinc-100 p-2 text-xs font-mono font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                        Parts Wholesale Cost ($)
                      </label>
                      <input
                        type="number"
                        step="10"
                        min="0"
                        value={calcPartsWholesale}
                        onChange={(e) => setCalcPartsWholesale(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-500 text-zinc-100 p-2 text-xs font-mono font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                        Target Parts Markup (%)
                      </label>
                      <select
                        value={calcPartsMarkupPct}
                        onChange={(e) => setCalcPartsMarkupPct(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-500 text-zinc-100 p-2 text-xs font-mono font-bold focus:outline-none"
                      >
                        <option value={25}>+25% Markup (Major Assemblies)</option>
                        <option value={30}>+30% Markup (Standard Engine Parts)</option>
                        <option value={35}>+35% Markup (Exhaust, Intake &amp; Accessories)</option>
                        <option value={50}>+50% Markup (Hardware &amp; Small Parts)</option>
                      </select>
                    </div>
                  </div>

                  {/* Calculator Outputs Summary */}
                  {(() => {
                    const laborRev = calcLaborHours * calcLaborTier;
                    const partsRetail = calcPartsWholesale * (1 + calcPartsMarkupPct / 100);
                    const subtotal = laborRev + partsRetail;
                    const supplies = subtotal * 0.075;
                    const totalCustomerQuote = subtotal + supplies;
                    const directLaborCost = calcLaborHours * 45; // Overhead cost baseline
                    const totalJobCost = directLaborCost + calcPartsWholesale;
                    const netProfit = totalCustomerQuote - totalJobCost;
                    const marginPct = totalCustomerQuote > 0 ? (netProfit / totalCustomerQuote) * 100 : 0;

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-950 p-4 border border-zinc-800 mt-2 font-mono">
                        <div>
                          <div className="text-[10px] font-black uppercase text-zinc-400 font-sans">Billable Labor</div>
                          <div className="text-xl font-black text-orange-400 mt-0.5">${laborRev.toFixed(2)}</div>
                          <div className="text-[9px] text-zinc-500 font-sans mt-0.5">{calcLaborHours} hrs @ ${calcLaborTier}/hr</div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase text-zinc-400 font-sans">Retail Parts Price</div>
                          <div className="text-xl font-black text-zinc-100 mt-0.5">${partsRetail.toFixed(2)}</div>
                          <div className="text-[9px] text-zinc-500 font-sans mt-0.5">Wholesale: ${calcPartsWholesale.toFixed(2)} (+{calcPartsMarkupPct}%)</div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase text-amber-400 font-sans">Total Customer Quote</div>
                          <div className="text-xl font-black text-amber-400 mt-0.5">${totalCustomerQuote.toFixed(2)}</div>
                          <div className="text-[9px] text-zinc-500 font-sans mt-0.5">Includes 7.5% shop supplies (${supplies.toFixed(2)})</div>
                        </div>

                        <div className="bg-emerald-950/60 p-2.5 border border-emerald-600/40">
                          <div className="text-[10px] font-black uppercase text-emerald-400 font-sans">Estimated Net Profit</div>
                          <div className="text-xl font-black text-emerald-400 mt-0.5">${netProfit.toFixed(2)}</div>
                          <div className="text-[9px] text-emerald-300/80 font-sans mt-0.5">Net Margin: {marginPct.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Section 4: Routine Maintenance & Chassis Flat Rates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-950 border border-zinc-800 p-4 space-y-3">
                    <div className="border-b border-zinc-800 pb-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                        ROUTINE V-TWIN FLUID &amp; TIRE FLAT-RATES
                      </div>
                      <h4 className="text-sm font-black text-zinc-100 uppercase italic">
                        3. Maintenance &amp; Tire Services
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between bg-zinc-900/60 p-2 border border-zinc-800/80">
                        <div>
                          <div className="font-sans font-bold text-zinc-100">Full 3-Hole Synthetic Fluid Flush</div>
                          <div className="text-[10px] text-zinc-400 font-sans">20W-50 Engine + Primary + 75W-140 Gear Lube + Filter</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-400">$220.00</div>
                          <div className="text-[9px] text-emerald-400 font-sans">Net: $158.00</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-zinc-900/60 p-2 border border-zinc-800/80">
                        <div>
                          <div className="font-sans font-bold text-zinc-100">Tire Mount &amp; Electronic Balance (Off Bike)</div>
                          <div className="text-[10px] text-zinc-400 font-sans">Scratch-free rim mount &amp; high-speed spin balance</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-400">$75.00 / wheel</div>
                          <div className="text-[9px] text-emerald-400 font-sans">Net: $63.00</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-zinc-900/60 p-2 border border-zinc-800/80">
                        <div>
                          <div className="font-sans font-bold text-zinc-100">Tire Mount &amp; Electronic Balance (On Bike)</div>
                          <div className="text-[10px] text-zinc-400 font-sans">Includes wheel removal, axle inspection &amp; re-torque</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-400">$135.00 / wheel</div>
                          <div className="text-[9px] text-emerald-400 font-sans">Net: $107.00</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800 p-4 space-y-3">
                    <div className="border-b border-zinc-800 pb-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                        SUSPENSION, BRAKE &amp; CHASSIS FLAT-RATES
                      </div>
                      <h4 className="text-sm font-black text-zinc-100 uppercase italic">
                        4. Chassis &amp; Brake Diagnostics
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between bg-zinc-900/60 p-2 border border-zinc-800/80">
                        <div>
                          <div className="font-sans font-bold text-zinc-100">Triple Tree Anti-Stiction &amp; Sag Setup</div>
                          <div className="text-[10px] text-zinc-400 font-sans">Fork leg anti-bind alignment &amp; rider sag calibration</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-400">$280.00</div>
                          <div className="text-[9px] text-emerald-400 font-sans">Net: $235.00</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-zinc-900/60 p-2 border border-zinc-800/80">
                        <div>
                          <div className="font-sans font-bold text-zinc-100">Brake Audit &amp; High-Temp DOT Flush</div>
                          <div className="text-[10px] text-zinc-400 font-sans">Digital rotor runout test, caliper piston lube &amp; bleed</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-400">$140.00</div>
                          <div className="text-[9px] text-emerald-400 font-sans">Net: $118.00</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-zinc-900/60 p-2 border border-zinc-800/80">
                        <div>
                          <div className="font-sans font-bold text-zinc-100">50-Point Pre-Purchase / Event Safety Audit</div>
                          <div className="text-[10px] text-zinc-400 font-sans">Complete belt tracking, charging test &amp; chassis scan</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-400">$150.00</div>
                          <div className="text-[9px] text-emerald-400 font-sans">Net: $125.00</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 5: Wholesale Vendor Margin Rules */}
                <div className="bg-zinc-950 border border-zinc-800 p-4 space-y-2 text-xs text-zinc-400">
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>WHOLESALE VENDOR MARKUP &amp; MARGIN GUIDELINES FOR PAUL</span>
                  </div>
                  <p className="text-zinc-300">
                    <strong className="text-zinc-100">Drag Specialties / Custom Chrome / V-Twin Mfg:</strong> Standard retail margin target is 30%-35% over wholesale dealer cost.
                  </p>
                  <p className="text-zinc-300">
                    <strong className="text-zinc-100">Öhlins / Legends Suspension / Brembo:</strong> Premium custom assemblies retain a 25% parts markup + full billable labor ($165/hr).
                  </p>
                  <p className="text-zinc-400 text-[11px] italic">
                    Note: Always add 7.5% Shop Supplies to covers shop chemicals, TIG gas, laser calibration targets, and disposal fees.
                  </p>
                </div>
              </div>
            ) : activeMainTab === "media" ? (
              /* Internal Owner Photo & Gallery Media Manager */
              <div className="space-y-6 font-sans">
                {/* Header Banner */}
                <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-500 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-orange-500" />
                    <span>INTERNAL OWNER MEDIA &amp; WEBSITE PHOTO CONTROL PORTAL</span>
                  </div>
                  <h3 className="text-2xl font-black text-zinc-100 uppercase italic">
                    WEBSITE PHOTO &amp; CASE STUDY GALLERY MANAGER
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    As shop owner Paul Heary, you have sole administrative control over all customer-facing images. Any photo uploaded or changed here updates the website immediately without exposing public upload buttons to customers.
                  </p>
                </div>

                {/* Section 1: Landing Page Hero Background */}
                <div className="bg-zinc-950 border border-orange-600/40 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
                    <div>
                      <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
                        Landing Page Headline Image
                      </div>
                      <h4 className="text-lg font-black text-zinc-100 uppercase italic">
                        1. HERO BACKGROUND IMAGE (TOP OF HOMEPAGE)
                      </h4>
                    </div>
                    {heroMsg && (
                      <span className="text-xs font-bold text-orange-400 bg-orange-950/80 px-3 py-1 border border-orange-500/50 uppercase tracking-wider">
                        ✓ {heroMsg}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Current Live Hero Background:
                      </div>
                      <div className="relative h-56 bg-zinc-900 border border-zinc-800 overflow-hidden">
                        {heroImage ? (
                          <img
                            src={heroImage}
                            alt="Hero background"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain bg-zinc-950"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-4 bg-zinc-950">
                            <Camera className="w-6 h-6 text-zinc-700" />
                            <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                              No hero photo set
                            </div>
                            <div className="text-[10px] text-zinc-600 leading-relaxed">
                              The homepage headline is showing on the plain dark background
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-zinc-950/90 text-orange-500 text-[10px] font-black px-2 py-1 uppercase tracking-widest border border-zinc-800">
                          Live On Website
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-zinc-200 tracking-wider flex items-center gap-2">
                          <Upload className="w-3.5 h-3.5 text-orange-500" />
                          <span>Option A: Upload Hero Image from Device</span>
                        </label>
                        <label
                          className={`border-2 border-dashed p-4 flex items-center justify-center gap-3 transition-colors text-center group ${
                            heroBusy
                              ? "border-orange-600 bg-orange-950/30 cursor-wait"
                              : "border-zinc-800 hover:border-orange-600 bg-zinc-900/60 cursor-pointer"
                          }`}
                        >
                          <Upload
                            className={`w-5 h-5 transition-colors ${
                              heroBusy
                                ? "text-orange-500 animate-pulse"
                                : "text-zinc-400 group-hover:text-orange-500"
                            }`}
                          />
                          <div>
                            <div className="text-xs font-bold text-zinc-200 group-hover:text-white uppercase tracking-wider">
                              {heroBusy
                                ? "Optimizing image…"
                                : "Click to select image file from computer / device"}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              {heroBusy
                                ? "Fitting, sharpening and compressing for the web"
                                : "Auto-fitted, sharpened and compressed — JPG, PNG, WEBP"}
                            </div>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleHeroFileUpload}
                            disabled={heroBusy}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-zinc-200 tracking-wider flex items-center gap-2">
                          <LinkIcon className="w-3.5 h-3.5 text-orange-500" />
                          <span>Option B: Paste Web Image URL</span>
                        </label>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (heroUrlInput.trim()) {
                              saveHeroImage(heroUrlInput.trim());
                              setHeroUrlInput("");
                            }
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="url"
                            placeholder="https://example.com/motorcycle.jpg"
                            value={heroUrlInput}
                            onChange={(e) => setHeroUrlInput(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-orange-600"
                          />
                          <button
                            type="submit"
                            className="bg-orange-600 hover:bg-orange-500 text-white font-black px-5 text-[11px] uppercase tracking-widest transition-colors cursor-pointer"
                          >
                            Apply
                          </button>
                        </form>
                      </div>

                      <button
                        onClick={handleHeroReset}
                        className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 hover:text-orange-500 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Remove photo (plain dark background)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 2: Paul Heary's Website Biopic Photo */}
                <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
                    <div>
                      <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
                        Owner Identity Photo
                      </div>
                      <h4 className="text-lg font-black text-zinc-100 uppercase italic">
                        2. PAUL HEARY BIOPIC PHOTO ("ABOUT PAUL" SECTION)
                      </h4>
                    </div>
                    {paulMsg && (
                      <span className="text-xs font-bold text-orange-400 bg-orange-950/80 px-3 py-1 border border-orange-500/50 uppercase tracking-wider">
                        ✓ {paulMsg}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    {/* Image Preview Card */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Current Live Website Image:
                      </div>
                      <div className="relative h-56 bg-zinc-900 border border-zinc-800 overflow-hidden">
                        <img
                          src={paulPhoto}
                          alt="Paul Heary"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 left-2 bg-zinc-950/90 text-orange-500 text-[10px] font-black px-2 py-1 uppercase tracking-widest border border-zinc-800">
                          Live On Website
                        </div>
                      </div>
                    </div>

                    {/* Upload Controls */}
                    <div className="md:col-span-2 space-y-4">
                      {/* File Upload Option */}
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-zinc-200 tracking-wider flex items-center gap-2">
                          <Upload className="w-3.5 h-3.5 text-orange-500" />
                          <span>Option A: Upload New Photo from Device</span>
                        </label>
                        <label
                          className={`border-2 border-dashed p-4 flex items-center justify-center gap-3 transition-colors text-center group ${
                            paulBusy
                              ? "border-orange-600 bg-orange-950/30 cursor-wait"
                              : "border-zinc-800 hover:border-orange-600 bg-zinc-900/60 cursor-pointer"
                          }`}
                        >
                          <Upload
                            className={`w-5 h-5 transition-colors ${
                              paulBusy
                                ? "text-orange-500 animate-pulse"
                                : "text-zinc-400 group-hover:text-orange-500"
                            }`}
                          />
                          <div>
                            <div className="text-xs font-bold text-zinc-200 group-hover:text-white uppercase tracking-wider">
                              {paulBusy
                                ? "Optimizing image…"
                                : "Click to select image file from computer / device"}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              {paulBusy
                                ? "Cropping, sharpening and compressing for the web"
                                : "Auto-cropped to portrait and sharpened — JPG, PNG, WEBP"}
                            </div>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePaulFileUpload}
                            disabled={paulBusy}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* URL Option */}
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-zinc-200 tracking-wider flex items-center gap-2">
                          <LinkIcon className="w-3.5 h-3.5 text-orange-500" />
                          <span>Option B: Paste Web Image URL</span>
                        </label>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (paulUrlInput.trim()) {
                              savePaulPhoto(paulUrlInput.trim());
                              setPaulUrlInput("");
                            }
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="url"
                            placeholder="https://example.com/paul-photo.jpg"
                            value={paulUrlInput}
                            onChange={(e) => setPaulUrlInput(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-orange-600 text-zinc-100 px-3 py-2 text-xs font-mono outline-none"
                          />
                          <button
                            type="submit"
                            className="bg-orange-600 hover:bg-orange-500 text-white font-black px-4 py-2 text-xs uppercase tracking-wider cursor-pointer transition-colors"
                          >
                            Apply URL
                          </button>
                        </form>
                      </div>

                      {/* Reset Option */}
                      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500 italic">
                          Want to restore the original shop biopic photo?
                        </span>
                        <button
                          type="button"
                          onClick={handlePaulReset}
                          className="text-xs text-zinc-400 hover:text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer bg-zinc-900 px-3 py-1.5 border border-zinc-800"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Paul's Photo to Default</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Case Study Gallery Photos */}
                <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
                    <div>
                      <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
                        Portfolio Build Gallery
                      </div>
                      <h4 className="text-lg font-black text-zinc-100 uppercase italic">
                        3. CASE STUDY &amp; WORK GALLERY PHOTOS ("OUR WORK" SECTION)
                      </h4>
                    </div>
                    {galleryMsg && (
                      <span className="text-xs font-bold text-orange-400 bg-orange-950/80 px-3 py-1 border border-orange-500/50 uppercase tracking-wider">
                        ✓ {galleryMsg}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {WORK_PROJECTS.map((proj) => {
                      const activeImg = galleryPhotos[proj.id] || proj.imageUrl;
                      const hasCustom = Boolean(galleryPhotos[proj.id]);
                      const inputVal = galleryUrlInputs[proj.id] || "";

                      return (
                        <div key={proj.id} className="bg-zinc-900/80 border border-zinc-800 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                            <div>
                              <div className="text-[10px] font-black uppercase text-orange-500 tracking-wider">
                                {proj.bikeModel} ({proj.year})
                              </div>
                              <div className="text-sm font-black text-zinc-100 uppercase italic">
                                {proj.title}
                              </div>
                            </div>
                            {hasCustom && (
                              <span className="text-[9px] font-black uppercase bg-orange-950 text-orange-400 border border-orange-600/40 px-2 py-0.5">
                                Custom Photo Active
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3 items-center">
                            <div className="relative h-28 bg-zinc-950 border border-zinc-800 overflow-hidden">
                              <img
                                src={activeImg}
                                alt={proj.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="col-span-2 space-y-2">
                              {/* File Input */}
                              <label
                                className={`border border-dashed p-2 flex items-center justify-center gap-2 transition-colors ${
                                  galleryBusyId === proj.id
                                    ? "border-orange-500 bg-orange-950/30 cursor-wait"
                                    : "border-zinc-700 hover:border-orange-500 bg-zinc-950 cursor-pointer"
                                }`}
                              >
                                <Upload
                                  className={`w-3.5 h-3.5 ${
                                    galleryBusyId === proj.id
                                      ? "text-orange-500 animate-pulse"
                                      : "text-zinc-400"
                                  }`}
                                />
                                <span className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider">
                                  {galleryBusyId === proj.id ? "Optimizing…" : "Upload File"}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleGalleryFileUpload(proj.id, e)}
                                  disabled={galleryBusyId === proj.id}
                                  className="hidden"
                                />
                              </label>

                              {/* URL Form */}
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (inputVal.trim()) {
                                    saveGalleryPhoto(proj.id, inputVal.trim());
                                    setGalleryUrlInputs((prev) => ({ ...prev, [proj.id]: "" }));
                                  }
                                }}
                                className="flex gap-1"
                              >
                                <input
                                  type="url"
                                  placeholder="Paste image URL..."
                                  value={inputVal}
                                  onChange={(e) =>
                                    setGalleryUrlInputs((prev) => ({ ...prev, [proj.id]: e.target.value }))
                                  }
                                  className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 px-2 py-1 text-[11px] font-mono outline-none"
                                />
                                <button
                                  type="submit"
                                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-2 py-1 text-[10px] uppercase tracking-wider cursor-pointer"
                                >
                                  Save
                                </button>
                              </form>

                              {hasCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleGalleryReset(proj.id)}
                                  className="text-[10px] text-zinc-400 hover:text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reset to Default</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : activeMainTab === "transactions" ? (
              /* Financial POS Transactions View */
              <div className="space-y-6">
                {/* Financial KPI Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sans">
                  <div className="bg-zinc-950 p-4 border border-zinc-800">
                    <div className="text-[10px] font-black uppercase text-emerald-400 tracking-widest flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Total POS Revenue</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-1">
                      ${totalTxnRevenue.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">{completedTxns.length} Completed Txns</div>
                  </div>

                  <div className="bg-zinc-950 p-4 border border-zinc-800">
                    <div className="text-[10px] font-black uppercase text-blue-400 tracking-widest flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Card Volume</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono mt-1">
                      ${cardRevenue.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">{cardTxns.length} Card Payments</div>
                  </div>

                  <div className="bg-zinc-950 p-4 border border-zinc-800">
                    <div className="text-[10px] font-black uppercase text-amber-400 tracking-widest flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Cash Drawer</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono mt-1">
                      ${cashRevenue.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">{cashTxns.length} Cash Payments</div>
                  </div>

                  <div className="bg-zinc-950 p-4 border border-zinc-800">
                    <div className="text-[10px] font-black uppercase text-orange-400 tracking-widest flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Sales Tax Collected</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono mt-1">
                      ${taxRevenue.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">8.25% TX State Tax</div>
                  </div>
                </div>

                {/* Transactions Ledger Table */}
                <div className="bg-zinc-950 border border-zinc-800 p-4 space-y-3 font-sans">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5" />
                        <span>TRANSACTIONS LEDGER &amp; REGISTER LOG</span>
                      </div>
                      <h3 className="text-lg font-black text-zinc-100 uppercase italic">
                        CUSTOMER FINANCIAL TRANSACTIONS
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPosInitialBooking(null);
                        setIsPOSModalOpen(true);
                      }}
                      className="bg-orange-600 hover:bg-orange-500 text-white font-black px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>+ Process Customer POS Sale</span>
                    </button>
                  </div>

                  {transactions.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500 text-xs italic">
                      No customer transactions logged yet. Click "+ Process Customer POS Sale" above to record a payment.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-zinc-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-900 text-zinc-400 font-black uppercase text-[10px] border-b border-zinc-800">
                          <tr>
                            <th className="p-2.5">Date / Txn ID</th>
                            <th className="p-2.5">Rider &amp; Bike</th>
                            <th className="p-2.5">Method</th>
                            <th className="p-2.5">Items Summary</th>
                            <th className="p-2.5 text-right">Total ($)</th>
                            <th className="p-2.5 text-center">Status</th>
                            <th className="p-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/70 font-mono">
                          {transactions.map((t) => (
                            <tr key={t.id} className="hover:bg-zinc-900/60 transition-colors">
                              <td className="p-2.5">
                                <div className="text-orange-400 font-bold">{t.id}</div>
                                <div className="text-[10px] text-zinc-500">{new Date(t.timestamp).toLocaleString()}</div>
                              </td>
                              <td className="p-2.5 font-sans">
                                <div className="text-zinc-100 font-bold">{t.customerName}</div>
                                <div className="text-[10px] text-zinc-400 italic">{t.motorcycle}</div>
                              </td>
                              <td className="p-2.5 uppercase font-sans font-bold">
                                <span className="bg-zinc-900 px-2 py-0.5 border border-zinc-800 text-zinc-300">
                                  {t.paymentMethod}
                                </span>
                                {t.paymentDetails?.authCode && (
                                  <div className="text-[9px] text-zinc-500 font-mono mt-0.5">{t.paymentDetails.authCode}</div>
                                )}
                              </td>
                              <td className="p-2.5 font-sans text-zinc-300 text-[11px]">
                                {t.items.map((it) => it.description).join(", ")}
                              </td>
                              <td className="p-2.5 text-right font-bold text-orange-400 text-sm">
                                ${t.totalAmount.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`text-[9px] font-black uppercase px-2 py-0.5 border font-sans ${
                                    t.status === "completed"
                                      ? "bg-emerald-950 text-emerald-400 border-emerald-600/40"
                                      : "bg-red-950 text-red-400 border-red-600/40"
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-sans">
                                {t.status === "completed" && (
                                  <button
                                    type="button"
                                    onClick={() => handleRefundTransaction(t.id)}
                                    className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2 py-1 cursor-pointer"
                                  >
                                    Refund / Void
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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
                  No bookings match your current filter or search criteria. New customer requests submitted from the website will appear here in real-time.
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
                                {b.invoice.paymentStatus.replace("_", " ")}
                              </span>
                              <button
                                onClick={() => {
                                  setPosInitialBooking(b);
                                  setIsPOSModalOpen(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shadow"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Charge Customer (POS)</span>
                              </button>
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
                                onClick={() => {
                                  setPosInitialBooking(b);
                                  setIsPOSModalOpen(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shadow"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Charge Customer (POS)</span>
                              </button>
                              <button
                                onClick={() => openInvoiceModal(b)}
                                className="bg-zinc-950 hover:bg-orange-600/20 text-orange-400 hover:text-orange-300 border border-orange-600/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Create Owner Invoice</span>
                              </button>
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
                            onClick={() => handleDeleteBooking(b.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
                            title="Delete Ticket"
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
                onClick={() => {
                  setActiveInvoiceBooking(null);
                  setInvoiceFormState(null);
                }}
                className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
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

            {/* Preset Template Quick-Load Buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Industry Standard Rate Templates (Click to Auto-Populate)</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const preset = getDefaultInvoiceForBooking({ ...activeInvoiceBooking, serviceId: 'powertrain-alignment' });
                    setInvoiceFormState(preset);
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 p-2 text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-zinc-200">3D Laser Powertrain</div>
                  <div className="text-[10px] text-orange-400 font-mono">$249.38 • 2.0 hrs</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const preset = getDefaultInvoiceForBooking({ ...activeInvoiceBooking, serviceId: 'frame-repair' });
                    setInvoiceFormState(preset);
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 p-2 text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-zinc-200">Frame &amp; Neck Re-Angle</div>
                  <div className="text-[10px] text-orange-400 font-mono">$836.21 • 4.5 hrs</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const preset = getDefaultInvoiceForBooking({ ...activeInvoiceBooking, serviceId: 'suspension-tuning' });
                    setInvoiceFormState(preset);
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 p-2 text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-zinc-200">Fork Anti-Stiction</div>
                  <div className="text-[10px] text-orange-400 font-mono">$335.58 • 2.0 hrs</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const preset = getDefaultInvoiceForBooking({ ...activeInvoiceBooking, serviceId: 'other' });
                    setInvoiceFormState(preset);
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 p-2 text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-zinc-200">General Diagnostic</div>
                  <div className="text-[10px] text-orange-400 font-mono">$330.75 • 2.0 hrs</div>
                </button>
              </div>
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
                            value={item.category}
                            onChange={(e) => handleInvoiceItemChange(idx, "category", e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs p-1 focus:outline-none focus:border-orange-500 rounded-none"
                          >
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
                            onClick={() => handleRemoveInvoiceItem(idx)}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Remove Line Item"
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
                  Configurable Shop Rates &amp; Payment Status
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Hourly Labor Rate ($/hr)
                    </label>
                    <input
                      type="number"
                      value={invoiceFormState.laborHourlyRate}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 125.0;
                        updateInvoiceStateAndRecalculate({
                          ...invoiceFormState,
                          laborHourlyRate: val,
                        });
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                      Shop Supplies Fee (%)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={invoiceFormState.shopSuppliesRatePct}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateInvoiceStateAndRecalculate({
                          ...invoiceFormState,
                          shopSuppliesRatePct: val,
                        });
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={invoiceFormState.paymentStatus}
                    onChange={(e) =>
                      setInvoiceFormState({
                        ...invoiceFormState,
                        paymentStatus: e.target.value as any,
                      })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-bold uppercase text-xs rounded-none"
                  >
                    <option value="unpaid">Unpaid / Estimate Issued</option>
                    <option value="deposit_paid">Deposit Paid ($200.00)</option>
                    <option value="paid_in_full">Paid In Full ($ Total)</option>
                  </select>
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
                <div className="pt-2 border-t border-zinc-800 flex justify-between text-base font-bold text-zinc-100">
                  <span className="text-orange-500 uppercase font-black font-sans">Total Amount Due:</span>
                  <span className="text-orange-400">${invoiceFormState.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Internal Mechanic Notes */}
            <div>
              <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1 tracking-wider">
                Internal Mechanic Accounting Notes (Paul Only)
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
                placeholder="e.g. Parts purchased from Drag Specialties. $180 margin. Customer paying via shop check."
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
                    setStripeInvoiceStatus({ loading: false, url: null, error: null });
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-4 py-2 text-xs uppercase font-bold"
                >
                  Cancel
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
                  onClick={handleSendStripeInvoice}
                  disabled={stripeInvoiceStatus.loading}
                  className="bg-violet-700 hover:bg-violet-600 disabled:bg-zinc-800 text-white font-black px-6 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors"
                  title="Save invoice & email customer a Stripe payment link"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{stripeInvoiceStatus.loading ? "Sending..." : "Send via Stripe"}</span>
                </button>
              </div>

              {/* Stripe invoice send status */}
              {stripeInvoiceStatus.error && (
                <div className="w-full mt-3 p-3 bg-red-950/80 border border-red-600/60 text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{stripeInvoiceStatus.error}</span>
                </div>
              )}
              {stripeInvoiceStatus.url && (
                <div className="w-full mt-3 p-3 bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-200">Invoice sent!</strong> Customer received an email with a secure payment link.{" "}
                    <a href={stripeInvoiceStatus.url} target="_blank" rel="noopener noreferrer" className="underline text-emerald-400 hover:text-emerald-300 ml-1">
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
            <p style={{ fontSize: "12px", margin: 0 }}>Dallas, TX • Phone: (214) 555-FRAME</p>
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
            <h3 style={{ margin: "6px 0 0 0", borderTop: "2px solid #000", paddingTop: "4px" }}>
              TOTAL DUE: ${invoiceFormState.totalAmount.toFixed(2)}
            </h3>
          </div>

          {invoiceFormState.internalOwnerNotes && (
            <div style={{ marginTop: "20px", fontSize: "11px", border: "1px solid #000", padding: "8px" }}>
              <strong>Internal Owner Notes:</strong> {invoiceFormState.internalOwnerNotes}
            </div>
          )}

          <div style={{ marginTop: "40px", paddingTop: "20px", borderTop: "1px dashed #000", display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <div>Customer Signature: ___________________________</div>
            <div>Date: _______________</div>
          </div>
        </div>
      )}

      {/* Point of Sale & Customer Payment Transaction Modal */}
      <TransactionPOSModal
        isOpen={isPOSModalOpen}
        onClose={() => setIsPOSModalOpen(false)}
        initialBooking={posInitialBooking}
        existingBookings={bookings}
        onTransactionComplete={() => {
          fetchTransactions();
          fetchBookings();
        }}
      />

    </div>
  );
};
