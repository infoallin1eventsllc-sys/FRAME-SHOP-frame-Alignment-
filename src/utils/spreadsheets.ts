import writeExcelFile from "write-excel-file/browser";
import { Booking, InternalInvoice, ShopRates } from "../types";
import { SHOP_INFO } from "../data/shopData";
import { saveFile } from "./saveFile";
import { balanceDue, PAYMENT_METHOD_LABEL } from "./invoiceMath";

/**
 * The spreadsheet downloads in the Command Center: one invoice, every invoice,
 * and the rate sheet. Built with write-excel-file, which only writes spreadsheets. The
 * previous library (the abandoned `xlsx` package on npm) carried unfixed
 * security flaws in its spreadsheet *reader*.
 *
 * Building the sheets is kept apart from downloading them so the contents can
 * be checked without a browser download.
 */

type Cell = string | number | null;
export type SheetSpec = { sheet: string; data: Cell[][]; columns: { width: number }[] };

const widths = (...w: number[]) => w.map((width) => ({ width }));

export function singleInvoiceSheets(booking: Booking, invoice: InternalInvoice): SheetSpec[] {
  const data: Cell[][] = [
    ["THE FRAME SHOP - 3D LASER FRAME & CHASSIS ALIGNMENT"],
    ["INTERNAL OWNER WORK ORDER & INVOICE"],
    [null],
    ["Invoice #:", invoice.invoiceNumber, null, "Invoice Date:", invoice.createdDate],
    ["Ticket #:", booking.ticketNumber, null, "Due Date:", invoice.dueDate],
    ["Technician:", invoice.mechanicName, null, "Payment Status:", invoice.paymentStatus.toUpperCase()],
    [null],
    ["CUSTOMER & MOTORCYCLE DETAILS"],
    ["Customer Name:", booking.name, null, "Phone:", booking.phone],
    ["Email:", booking.email, null, "Requested Service:", booking.serviceTitle],
    ["Motorcycle:", `${booking.bikeYear} ${booking.bikeMake} ${booking.bikeModel}`],
    ["Customer Issue Notes:", booking.issueNotes || "N/A"],
    [null],
    ["ITEMIZED CHARGES"],
    ["Item #", "Category", "Description", "Qty / Hours", "Rate ($)", "Line Total ($)"],
  ];

  invoice.items.forEach((item, index) => {
    data.push([index + 1, item.category.toUpperCase(), item.description, item.quantity, item.rate, item.amount]);
  });

  data.push([null]);
  data.push([null, null, null, null, "Subtotal ($):", invoice.subtotal]);
  data.push([null, null, null, null, `Shop Supplies (${invoice.shopSuppliesRatePct}%):`, invoice.shopSuppliesAmount]);
  data.push([null, null, null, null, `Sales Tax (${invoice.taxRatePct}%):`, invoice.taxAmount]);
  data.push([null, null, null, null, "TOTAL ($):", invoice.totalAmount]);
  for (const p of invoice.payments ?? []) {
    data.push([
      null, null,
      `Payment ${p.paidAt.slice(0, 10)} — ${PAYMENT_METHOD_LABEL[p.method ?? "shopify"]} ${p.orderName}`,
      null, "Paid ($):", -p.amount,
    ]);
  }
  data.push([null, null, null, null, "BALANCE DUE ($):", balanceDue(invoice)]);
  data.push([null]);
  if (invoice.internalOwnerNotes) {
    data.push(["Internal Accounting Notes:", invoice.internalOwnerNotes]);
  }

  return [{ sheet: "Work Order Invoice", data, columns: widths(8, 16, 45, 14, 14, 16) }];
}

export function allInvoicesSheets(bookings: Booking[], exportedAt = new Date()): SheetSpec[] {
  const summary: Cell[][] = [
    ["THE FRAME SHOP - ALL INTERNAL WORK ORDERS & INVOICES SUMMARY"],
    ["Export Date:", exportedAt.toLocaleString()],
    [null],
    ["Invoice #", "Ticket #", "Date", "Customer Name", "Phone", "Motorcycle", "Service", "Subtotal ($)", "Supplies ($)", "Tax ($)", "Total Amount ($)", "Paid ($)", "Balance Due ($)", "Status"],
  ];
  const details: Cell[][] = [
    ["Invoice #", "Ticket #", "Customer", "Item Category", "Item Description", "Qty/Hrs", "Rate ($)", "Amount ($)"],
  ];

  let grandTotal = 0;
  for (const b of bookings) {
    const inv = b.invoice;
    if (!inv) continue;
    grandTotal += inv.totalAmount;
    summary.push([
      inv.invoiceNumber, b.ticketNumber, inv.createdDate, b.name, b.phone,
      `${b.bikeYear} ${b.bikeMake} ${b.bikeModel}`, b.serviceTitle,
      inv.subtotal, inv.shopSuppliesAmount, inv.taxAmount, inv.totalAmount,
      inv.amountPaid ?? 0, balanceDue(inv), inv.paymentStatus.toUpperCase(),
    ]);
    for (const item of inv.items) {
      details.push([
        inv.invoiceNumber, b.ticketNumber, b.name, item.category.toUpperCase(),
        item.description, item.quantity, item.rate, item.amount,
      ]);
    }
  }

  summary.push([null]);
  summary.push(["TOTAL INVOICED ($):", null, null, null, null, null, null, null, null, null, grandTotal]);

  return [
    { sheet: "Invoices Summary", data: summary, columns: widths(16, 12, 12, 20, 16, 28, 24, 12, 12, 10, 16, 14, 14, 12) },
    { sheet: "Itemized Charges", data: details, columns: widths(16, 12, 20, 16, 45, 10, 12, 14) },
  ];
}

async function download(sheets: SheetSpec[], fileName: string) {
  try {
    const outcome = await saveFile(fileName, await writeExcelFile(sheets).toBlob());
    if (outcome === "failed") alert("The spreadsheet could not be saved. Try again.");
  } catch {
    alert("The spreadsheet could not be created. Try again, or use Download PDF instead.");
  }
}

export function exportSingleInvoiceToExcel(booking: Booking, invoice: InternalInvoice) {
  return download(
    singleInvoiceSheets(booking, invoice),
    `${invoice.invoiceNumber}_${booking.ticketNumber}_TheFrameShop.xlsx`,
  );
}

export function exportAllInvoicesToExcel(bookings: Booking[]) {
  return download(
    allInvoicesSheets(bookings),
    `TheFrameShop_MasterInvoices_${new Date().toISOString().split("T")[0]}.xlsx`,
  );
}

export function ratesSheets(rates: ShopRates, exportedAt = new Date()): SheetSpec[] {
  const data: Cell[][] = [
    [`${SHOP_INFO.name} — Rate Sheet`],
    ["Exported", exportedAt.toLocaleDateString()],
    [null],
    ["Labor rate ($/hr)", rates.laborRate ?? "not set"],
    ["Shop supplies (%)", rates.suppliesPct],
    ["Sales tax (%)", rates.taxPct ?? "not set"],
    ["Overhead cost ($/hr)", rates.overheadPerHour ?? "not set"],
    [null],
    ["Service", "Price ($)", "Unit", "Notes"],
    ...rates.lines.map((l): Cell[] => [l.name, l.price ?? null, l.unit, l.note]),
  ];
  return [{ sheet: "Rate Sheet", data, columns: widths(40, 12, 14, 50) }];
}

export function exportRatesToExcel(rates: ShopRates) {
  return download(ratesSheets(rates), `TheFrameShop_Rates_${new Date().toISOString().split("T")[0]}.xlsx`);
}
