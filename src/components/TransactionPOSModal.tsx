import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  CreditCard,
  DollarSign,
  QrCode,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  User,
  Phone,
  Mail,
  Smartphone,
  ShieldCheck,
  Bluetooth,
  Wifi,
  Sparkles,
  ArrowRight,
  Send,
  AlertCircle,
  Receipt,
  HelpCircle
} from "lucide-react";
import { Booking, Transaction, TransactionLineItem } from "../types";
import { SHOP_INFO } from "../data/shopData";
import { safeFetch } from "../utils/api";
import { useEscapeToClose } from "../utils/useModalClose";
import {
  connectBluetoothPrinter,
  sendPayloadToBluetoothPrinter,
  buildEscPosWorkOrderPayload,
  getActiveBluetoothDeviceName,
} from "../utils/bluetoothPrinter";

interface TransactionPOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBooking?: Booking | null;
  existingBookings: Booking[];
  onTransactionComplete: () => void;
}

export const TransactionPOSModal: React.FC<TransactionPOSModalProps> = ({
  isOpen,
  onClose,
  initialBooking,
  existingBookings,
  onTransactionComplete,
}) => {
  const [selectedBookingId, setSelectedBookingId] = useState<string>(initialBooking?.id || "custom");
  
  // Customer details
  const [customerName, setCustomerName] = useState<string>(initialBooking?.name || "");
  const [customerPhone, setCustomerPhone] = useState<string>(initialBooking?.phone || "");
  const [customerEmail, setCustomerEmail] = useState<string>(initialBooking?.email || "");
  const [motorcycle, setMotorcycle] = useState<string>(
    initialBooking ? `${initialBooking.bikeYear} ${initialBooking.bikeMake} ${initialBooking.bikeModel}` : ""
  );

  // Line items
  const [items, setItems] = useState<TransactionLineItem[]>(() => {
    if (initialBooking?.invoice?.items) {
      return initialBooking.invoice.items.map((it) => ({
        ...it,
        category: (it.category as any) || "labor",
      }));
    }
    return [
      {
        id: "item-1",
        description: "3D Laser Frame & Chassis Alignment Inspection",
        category: "laser_scan",
        quantity: 1,
        rate: 75.0,
        amount: 75.0,
      },
      {
        id: "item-2",
        description: "Specialty Frame Technician Labor",
        category: "labor",
        quantity: 1.5,
        rate: 125.0,
        amount: 187.5,
      },
    ];
  });

  // Rates
  const shopSuppliesRatePct = 5.0;
  const taxRatePct = 8.25;

  // Payment State
  const [transactionType, setTransactionType] = useState<Transaction["type"]>("work_order_payment");
  const [paymentMethod, setPaymentMethod] = useState<Transaction["paymentMethod"]>("card");
  
  // Card details (simulated)
  const [cardHolder, setCardHolder] = useState<string>(customerName || "RIDER CARD");
  const [cardNumber, setCardNumber] = useState<string>("•••• •••• •••• 4920");
  const [cardExpiry, setCardExpiry] = useState<string>("08/28");
  const [cardCvc, setCardCvc] = useState<string>("892");
  const [terminalState, setTerminalState] = useState<"ready" | "processing" | "approved">("ready");
  const [showQrCodeModal, setShowQrCodeModal] = useState<boolean>(false);

  // Cash details
  const [cashTendered, setCashTendered] = useState<string>("");

  // Check details
  const [checkNumber, setCheckNumber] = useState<string>("");

  // Notes
  const [transactionNotes, setTransactionNotes] = useState<string>("");

  // Status & Completion State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedTxn, setCompletedTxn] = useState<Transaction | null>(null);

  // Bluetooth printer status
  const [btDeviceName, setBtDeviceName] = useState<string>(getActiveBluetoothDeviceName());
  const [btStatus, setBtStatus] = useState<"idle" | "connecting" | "printing" | "success" | "error">("idle");
  const [btMessage, setBtMessage] = useState<string>("");

  // Notification state
  const [dispatchStatus, setDispatchStatus] = useState<string>("");

  // Populate when selecting booking from dropdown
  useEffect(() => {
    if (selectedBookingId === "custom") {
      // keep current or clear if empty
      return;
    }
    const b = existingBookings.find((bk) => bk.id === selectedBookingId);
    if (b) {
      setCustomerName(b.name);
      setCustomerPhone(b.phone);
      setCustomerEmail(b.email);
      setMotorcycle(`${b.bikeYear} ${b.bikeMake} ${b.bikeModel}`);
      setCardHolder(b.name.toUpperCase());
      if (b.invoice?.items && b.invoice.items.length > 0) {
        setItems(
          b.invoice.items.map((it) => ({
            ...it,
            category: (it.category as any) || "labor",
          }))
        );
      }
    }
  }, [selectedBookingId, existingBookings]);

  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  // Calculate totals
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const shopSuppliesAmount = Math.round(subtotal * (shopSuppliesRatePct / 100) * 100) / 100;
  const taxAmount = Math.round((subtotal + shopSuppliesAmount) * (taxRatePct / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + shopSuppliesAmount + taxAmount) * 100) / 100;

  const cashVal = parseFloat(cashTendered) || 0;
  const changeGiven = Math.max(0, Math.round((cashVal - totalAmount) * 100) / 100);

  const handleItemChange = (index: number, field: keyof TransactionLineItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "rate") {
      const q = field === "quantity" ? parseFloat(value) || 0 : newItems[index].quantity;
      const r = field === "rate" ? parseFloat(value) || 0 : newItems[index].rate;
      newItems[index].amount = Math.round(q * r * 100) / 100;
    }
    setItems(newItems);
  };

  const handleAddItem = (presetDescription?: string, presetCategory?: TransactionLineItem["category"], presetAmount?: number) => {
    const newItem: TransactionLineItem = {
      id: `item-${Date.now()}`,
      description: presetDescription || "Shop Labor / Alignment Service",
      category: presetCategory || "labor",
      quantity: 1,
      rate: presetAmount || 125.0,
      amount: presetAmount || 125.0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleProcessTransaction = async () => {
    if (!customerName.trim()) {
      alert("Please enter customer name.");
      return;
    }
    if (items.length === 0) {
      alert("Please add at least one line item.");
      return;
    }

    setIsSubmitting(true);
    setTerminalState("processing");

    // Simulate terminal authorization delay for realistic POS experience
    setTimeout(async () => {
      try {
        const payload = {
          type: transactionType,
          bookingId: selectedBookingId !== "custom" ? selectedBookingId : undefined,
          ticketNumber: initialBooking?.ticketNumber,
          invoiceNumber: initialBooking?.invoice?.invoiceNumber,
          customerName,
          customerPhone,
          customerEmail,
          motorcycle,
          items,
          subtotal,
          shopSuppliesAmount,
          taxAmount,
          totalAmount,
          amountPaid: paymentMethod === "cash" ? Math.max(cashVal, totalAmount) : totalAmount,
          changeGiven: paymentMethod === "cash" ? changeGiven : 0,
          paymentMethod,
          paymentDetails: {
            cardBrand: "Visa / MasterCard",
            cardLast4: cardNumber.slice(-4) || "4920",
            authCode: `AUTH-${Math.floor(10000 + Math.random() * 90000)}`,
            checkNumber: paymentMethod === "check" ? checkNumber : undefined,
            notes: transactionNotes,
          },
        };

        const res = await safeFetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          setCompletedTxn(data.transaction);
          setTerminalState("approved");
          onTransactionComplete();
        } else {
          alert("Failed to record transaction.");
          setTerminalState("ready");
        }
      } catch (err) {
        console.error("Error processing POS transaction:", err);
        alert("Transaction processing error occurred.");
        setTerminalState("ready");
      } finally {
        setIsSubmitting(false);
      }
    }, 1200);
  };

  const handlePrintReceiptBluetooth = async () => {
    if (!completedTxn) return;
    setBtStatus("connecting");
    setBtMessage("Connecting to Bluetooth thermal printer...");
    const conn = await connectBluetoothPrinter();
    if (!conn.success) {
      setBtStatus("error");
      setBtMessage(conn.error || "Bluetooth printer pairing required.");
      return;
    }
    setBtDeviceName(conn.deviceName);
    setBtStatus("printing");
    setBtMessage(`Printing POS customer receipt to ${conn.deviceName}...`);

    const payload = buildEscPosWorkOrderPayload(
      SHOP_INFO.name,
      completedTxn.ticketNumber || completedTxn.id,
      completedTxn.id,
      new Date(completedTxn.timestamp).toLocaleDateString(),
      completedTxn.customerName,
      completedTxn.customerPhone,
      completedTxn.motorcycle,
      completedTxn.type.replace(/_/g, " ").toUpperCase(),
      completedTxn.items,
      completedTxn.subtotal,
      completedTxn.shopSuppliesAmount,
      completedTxn.taxAmount,
      completedTxn.totalAmount,
      `Paid via ${completedTxn.paymentMethod.toUpperCase()} on ${new Date(completedTxn.timestamp).toLocaleTimeString()}`
    );

    const printRes = await sendPayloadToBluetoothPrinter(payload);
    if (printRes.success) {
      setBtStatus("success");
      setBtMessage(`Receipt printed successfully to ${conn.deviceName}!`);
    } else {
      setBtStatus("error");
      setBtMessage(printRes.error || "Failed to print receipt.");
    }
  };

  const handleExportReceiptExcel = () => {
    if (!completedTxn) return;
    const wb = XLSX.utils.book_new();
    const rows = [
      ["THE FRAME SHOP - OFFICIAL CUSTOMER RECEIPT"],
      ["SPRING, TEXAS • 3D LASER FRAME & CHASSIS ALIGNMENT"],
      [""],
      ["Receipt / Txn #:", completedTxn.id, "", "Date/Time:", new Date(completedTxn.timestamp).toLocaleString()],
      ["Payment Method:", completedTxn.paymentMethod.toUpperCase(), "", "Status:", completedTxn.status.toUpperCase()],
      ["Processed By:", completedTxn.processedBy, "", "Auth Code:", completedTxn.paymentDetails?.authCode || "N/A"],
      [""],
      ["CUSTOMER & MOTORCYCLE"],
      ["Customer Name:", completedTxn.customerName, "", "Phone:", completedTxn.customerPhone],
      ["Email:", completedTxn.customerEmail, "", "Motorcycle:", completedTxn.motorcycle],
      [""],
      ["ITEMIZED CHARGES"],
      ["Description", "Category", "Qty/Hrs", "Rate ($)", "Amount ($)"]
    ];

    completedTxn.items.forEach((item) => {
      rows.push([item.description, item.category.toUpperCase(), item.quantity, item.rate, item.amount]);
    });

    rows.push([""]);
    rows.push(["", "", "", "Subtotal ($):", completedTxn.subtotal]);
    rows.push(["", "", "", "Shop Supplies ($):", completedTxn.shopSuppliesAmount]);
    rows.push(["", "", "", "Sales Tax ($):", completedTxn.taxAmount]);
    rows.push(["", "", "", "TOTAL PAID ($):", completedTxn.totalAmount]);
    if (completedTxn.paymentMethod === "cash") {
      rows.push(["", "", "", "Cash Tendered ($):", completedTxn.amountPaid]);
      rows.push(["", "", "", "Change Given ($):", completedTxn.changeGiven]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Receipt");
    XLSX.writeFile(wb, `Receipt_${completedTxn.id}_TheFrameShop.xlsx`);
  };

  const handleSimulateNotificationReceipt = (channel: "sms" | "email") => {
    setDispatchStatus(`Dispatching instant digital receipt via ${channel.toUpperCase()} to ${channel === "sms" ? customerPhone || "(832) 555-0199" : customerEmail || "customer@example.com"}...`);
    setTimeout(() => {
      setDispatchStatus(`✅ Receipt sent via ${channel.toUpperCase()}! Rider notified.`);
      setTimeout(() => setDispatchStatus(""), 4000);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/95 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-zinc-900 border-2 border-orange-600 rounded-none max-w-4xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[95vh] flex flex-col space-y-4 text-zinc-100 overflow-y-auto">
        
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-orange-500 bg-orange-950/80 px-2.5 py-0.5 border border-orange-600/40 tracking-widest">
              <CreditCard className="w-3.5 h-3.5" />
              <span>SHOP POINT-OF-SALE (POS) &amp; TRANSACTION TERMINAL</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-zinc-100 uppercase italic mt-1">
              CUSTOMER PAYMENT <span className="text-orange-500">TRANSACTION</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Execute live customer transactions, record cash/card payments, generate receipts, and update work order ledgers.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If Transaction Completed -> Show Receipt View */}
        {completedTxn ? (
          <div className="space-y-6 py-2">
            <div className="bg-emerald-950/90 border border-emerald-600 p-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
              <h4 className="text-2xl font-black text-white uppercase italic tracking-wider">
                TRANSACTION COMPLETED SUCCESSFULLY!
              </h4>
              <p className="text-xs text-emerald-200 font-mono">
                Transaction ID: <span className="font-bold text-white bg-emerald-900 px-2 py-0.5 border border-emerald-500">{completedTxn.id}</span> | Total Paid: <span className="font-bold text-emerald-300">${completedTxn.totalAmount.toFixed(2)}</span>
              </p>
            </div>

            {/* Receipt Card Summary */}
            <div className="bg-zinc-950 border border-zinc-800 p-5 space-y-4 font-mono text-xs">
              <div className="flex justify-between border-b border-zinc-800 pb-3">
                <div>
                  <div className="font-black text-zinc-100 text-sm">{SHOP_INFO.name}</div>
                  <div className="text-zinc-400 text-[11px]">{SHOP_INFO.tagline}</div>
                </div>
                <div className="text-right">
                  <div className="text-orange-400 font-bold">{completedTxn.id}</div>
                  <div className="text-zinc-500 text-[10px]">{new Date(completedTxn.timestamp).toLocaleString()}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-zinc-500 uppercase font-sans font-bold block">Rider</span>
                  <span className="text-zinc-100 font-bold">{completedTxn.customerName}</span>
                  <div className="text-zinc-400 text-[10px]">{completedTxn.customerPhone}</div>
                </div>
                <div>
                  <span className="text-zinc-500 uppercase font-sans font-bold block">Motorcycle</span>
                  <span className="text-zinc-200 italic">{completedTxn.motorcycle}</span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-zinc-800 my-2">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {completedTxn.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-zinc-200">{it.description}</td>
                        <td className="p-2 text-center text-zinc-400">{it.quantity}</td>
                        <td className="p-2 text-right text-orange-400 font-bold">${it.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-right text-xs pt-1">
                <div className="text-zinc-400">Subtotal: ${completedTxn.subtotal.toFixed(2)}</div>
                <div className="text-zinc-400">Shop Supplies (5%): ${completedTxn.shopSuppliesAmount.toFixed(2)}</div>
                <div className="text-zinc-400">Sales Tax (8.25%): ${completedTxn.taxAmount.toFixed(2)}</div>
                <div className="text-sm font-black text-orange-400 pt-1 border-t border-zinc-800">
                  TOTAL PAID ({completedTxn.paymentMethod.toUpperCase()}): ${completedTxn.totalAmount.toFixed(2)}
                </div>
                {completedTxn.paymentMethod === "cash" && (
                  <div className="text-[11px] text-emerald-400 font-bold">
                    Cash Tendered: ${completedTxn.amountPaid.toFixed(2)} | Change Given: ${completedTxn.changeGiven.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Notification Dispatch Buttons */}
            {dispatchStatus && (
              <div className="p-2.5 bg-blue-950 border border-blue-600/60 text-blue-300 text-xs font-mono text-center animate-pulse">
                {dispatchStatus}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrintReceiptBluetooth}
                  className="bg-blue-900 hover:bg-blue-800 text-blue-100 border border-blue-600/60 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Bluetooth className="w-4 h-4 text-blue-400" />
                  <span>Bluetooth Print Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportReceiptExcel}
                  className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Excel Receipt (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 px-4 py-2 text-xs uppercase font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-orange-500" />
                  <span>System Print</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSimulateNotificationReceipt("sms")}
                  className="bg-zinc-950 hover:bg-zinc-800 text-orange-400 border border-orange-600/40 px-3 py-2 text-xs uppercase font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>SMS Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateNotificationReceipt("email")}
                  className="bg-zinc-950 hover:bg-zinc-800 text-orange-400 border border-orange-600/40 px-3 py-2 text-xs uppercase font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-black px-5 py-2 text-xs uppercase tracking-wider cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Transaction Entry Form */
          <div className="space-y-4">
            
            {/* Customer Link or Select Bar */}
            <div className="bg-zinc-950 p-3 border border-zinc-800 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Select Existing Appointment Work Order or Walk-In Rider</span>
                </label>

                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-100 p-1.5 text-xs font-bold rounded-none focus:outline-none focus:border-orange-500 w-full sm:w-72"
                >
                  <option value="custom">+ New Walk-In Customer / Counter Sale</option>
                  {existingBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      Ticket #{b.ticketNumber} - {b.name} ({b.bikeMake} {b.bikeModel})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rider Details Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Rider Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Marcus Vance"
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-2 text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Phone Number</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(832) 555-0199"
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-2 text-xs focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Email Address</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="rider@example.com"
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-2 text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Motorcycle Model</label>
                  <input
                    type="text"
                    value={motorcycle}
                    onChange={(e) => setMotorcycle(e.target.value)}
                    placeholder="2022 H-D Road Glide"
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-2 text-xs focus:outline-none focus:border-orange-500 italic"
                  />
                </div>
              </div>
            </div>

            {/* Preset Charging Quick Buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Quick-Add Common Shop Charges (Click to Add Line Item)</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleAddItem("3D Laser Frame & Chassis Alignment Scan", "laser_scan", 75.0)}
                  className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 p-2 text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-zinc-200">🎯 $75 Laser Scan</div>
                  <div className="text-[10px] text-zinc-500">Express alignment check</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddItem("Specialty Mechanical Labor (1.0 hr)", "labor", 125.0)}
                  className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 p-2 text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-zinc-200">🔧 $125 1hr Labor</div>
                  <div className="text-[10px] text-zinc-500">Standard hourly shop rate</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddItem("Frame Straightening Initial Lift Deposit", "deposit", 200.0)}
                  className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 p-2 text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-zinc-200">🛡️ $200 Service Deposit</div>
                  <div className="text-[10px] text-zinc-500">Locks lift appointment</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddItem("Heavy Duty Stabilizer Bushings & Hardware", "parts", 68.0)}
                  className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500 p-2 text-left transition-colors cursor-pointer"
                >
                  <div className="font-bold text-zinc-200">🔩 $68 Hardware Kit</div>
                  <div className="text-[10px] text-zinc-500">Urethane motor mount bushings</div>
                </button>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                  Itemized Transaction Charges
                </span>
                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="text-xs bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-orange-400 px-2.5 py-1 uppercase font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="border border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-zinc-950 text-[10px] font-black uppercase text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="p-2">Category</th>
                      <th className="p-2">Item Description</th>
                      <th className="p-2 w-20 text-center">Qty / Hrs</th>
                      <th className="p-2 w-24 text-right">Rate ($)</th>
                      <th className="p-2 w-24 text-right">Amount ($)</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/50">
                    {items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="p-2">
                          <select
                            value={item.category}
                            onChange={(e) => handleItemChange(idx, "category", e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs p-1 focus:outline-none focus:border-orange-500 rounded-none"
                          >
                            <option value="labor">Labor ($/hr)</option>
                            <option value="laser_scan">Laser Scan Fee</option>
                            <option value="parts">Parts &amp; Hardware</option>
                            <option value="supplies">Shop Consumables</option>
                            <option value="deposit">Deposit Fee</option>
                            <option value="sublet">Sublet / Welding</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs p-1 focus:outline-none focus:border-orange-500 rounded-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs p-1 text-center font-mono focus:outline-none focus:border-orange-500 rounded-none"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.rate}
                            onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs p-1 text-right font-mono focus:outline-none focus:border-orange-500 rounded-none"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-orange-400">
                          ${item.amount.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
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

            {/* Calculations & Payment Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              
              {/* Payment Method Selector & Interactive Terminal */}
              <div className="bg-zinc-950 p-4 border border-zinc-800 space-y-3 text-xs">
                <span className="text-[10px] font-black uppercase text-orange-500 tracking-wider block">
                  Select Payment Processing Method
                </span>

                <div className="grid grid-cols-4 gap-1.5 font-bold text-[11px] uppercase">
                  {[
                    { id: "card", label: "💳 Card", icon: CreditCard },
                    { id: "cash", label: "💵 Cash", icon: DollarSign },
                    { id: "check", label: "📄 Check", icon: Receipt },
                    { id: "bnpl", label: "⚡ BNPL", icon: Sparkles },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as any)}
                      className={`p-2 border text-center transition-all cursor-pointer ${
                        paymentMethod === pm.id
                          ? "bg-orange-600 text-white border-orange-500 font-black shadow"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>

                {/* Card Terminal Simulator */}
                {paymentMethod === "card" && (
                  <div className="bg-zinc-900 p-3 border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
                      <span>CHIP &amp; TAP TERMINAL</span>
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <Wifi className="w-3 h-3 animate-pulse" />
                        TERMINAL ONLINE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-400 uppercase">Cardholder Name</label>
                        <input
                          type="text"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-1.5 text-xs focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 uppercase">Card Number (Last 4)</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-1.5 text-xs font-mono focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <button
                        type="button"
                        onClick={() => setShowQrCodeModal(!showQrCodeModal)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase flex items-center gap-1 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Generate Phone QR Checkout Link</span>
                      </button>
                    </div>

                    {showQrCodeModal && (
                      <div className="bg-zinc-950 border border-blue-600/50 p-3 text-center space-y-2">
                        <div className="bg-white p-2 w-32 h-32 mx-auto flex items-center justify-center">
                          <QrCode className="w-28 h-28 text-black" />
                        </div>
                        <div className="text-[10px] text-zinc-300 font-mono">
                          Rider can scan this QR code with their mobile phone camera to complete instant contactless checkout.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cash Payment Mode */}
                {paymentMethod === "cash" && (
                  <div className="bg-zinc-900 p-3 border border-zinc-800 space-y-2">
                    <label className="block text-[10px] text-zinc-400 uppercase font-bold">
                      Cash Amount Tendered ($)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="1"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value)}
                        placeholder={`Exact ($${totalAmount.toFixed(2)})`}
                        className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono text-sm focus:outline-none focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => setCashTendered(totalAmount.toFixed(2))}
                        className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-orange-400 px-2 py-1 text-[10px] uppercase font-bold"
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashTendered((Math.ceil(totalAmount / 50) * 50).toString())}
                        className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-orange-400 px-2 py-1 text-[10px] uppercase font-bold"
                      >
                        Round
                      </button>
                    </div>

                    {cashVal > 0 && (
                      <div className="p-2 bg-zinc-950 border border-zinc-800 flex justify-between font-mono font-bold text-xs">
                        <span className="text-zinc-400">CHANGE DUE TO RIDER:</span>
                        <span className="text-emerald-400 text-sm">${changeGiven.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Check Mode */}
                {paymentMethod === "check" && (
                  <div className="bg-zinc-900 p-3 border border-zinc-800 space-y-2">
                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase font-bold">Check Number</label>
                      <input
                        type="text"
                        value={checkNumber}
                        onChange={(e) => setCheckNumber(e.target.value)}
                        placeholder="e.g. #90218"
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-2 font-mono text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                )}

                {/* BNPL Mode */}
                {paymentMethod === "bnpl" && (
                  <div className="bg-zinc-900 p-3 border border-zinc-800 text-xs space-y-1">
                    <div className="text-amber-400 font-bold uppercase">Klarna / Affirm 4-Payment Plan</div>
                    <p className="text-zinc-400 text-[11px]">
                      Allows customer to split ${totalAmount.toFixed(2)} total into 4 bi-weekly interest-free payments of ${(totalAmount / 4).toFixed(2)}.
                    </p>
                  </div>
                )}
              </div>

              {/* Total Summary Box */}
              <div className="bg-zinc-950 p-4 border border-zinc-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Shop Environmental Fee ({shopSuppliesRatePct}%):</span>
                  <span>${shopSuppliesAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Texas Sales Tax ({taxRatePct}%):</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex justify-between text-base font-bold text-zinc-100">
                  <span className="text-orange-500 uppercase font-black font-sans">FINAL AMOUNT DUE:</span>
                  <span className="text-orange-400">${totalAmount.toFixed(2)}</span>
                </div>

                <div className="pt-2">
                  <label className="block text-[10px] font-sans font-bold text-zinc-400 uppercase mb-1">
                    Internal Payment Memo / Notes
                  </label>
                  <input
                    type="text"
                    value={transactionNotes}
                    onChange={(e) => setTransactionNotes(e.target.value)}
                    placeholder="e.g. Swiped card on counter terminal. Rider given 3D laser scan printout."
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-1.5 text-xs font-sans focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-zinc-950 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 px-4 py-2 text-xs uppercase font-bold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleProcessTransaction}
                disabled={isSubmitting}
                className="bg-orange-600 hover:bg-orange-500 text-white font-black px-8 py-2.5 text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-lg transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Wifi className="w-4 h-4 animate-spin" />
                    <span>Authorizing Payment...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Execute Transaction (${totalAmount.toFixed(2)})</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
