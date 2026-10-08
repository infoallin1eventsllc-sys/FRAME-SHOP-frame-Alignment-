/**
 * Invoice arithmetic, done once, on the server.
 *
 * The portal used to compute totals in the browser and the server stored
 * whatever it was sent, including the payment status. Three things went wrong
 * because of that:
 *
 * - "Email invoice" sent Shopify the line items only. Shop supplies and sales
 *   tax were left off, so the customer was billed less than the invoice said —
 *   and the job then showed "deposit paid" forever, because the payment never
 *   reached the invoice total.
 * - Saving an invoice replaced the payment ledger with the browser's copy. A
 *   payment that arrived while the invoice was open on Paul's screen was wiped
 *   the moment he pressed Save.
 * - Payment status was a dropdown Paul could set to anything, independent of
 *   what had actually been paid.
 *
 * Now: totals are recomputed here from the line items, the ledger is only ever
 * changed by a real payment (a Shopify webhook, or Paul recording cash or a
 * check), and the status is derived from the ledger.
 */
import type { PaymentRecord, PaymentStatus } from "./shopify";

export type LineCategory = "service" | "labor" | "parts" | "laser_scan" | "supplies" | "sublet";
const CATEGORIES: LineCategory[] = ["service", "labor", "parts", "laser_scan", "supplies", "sublet"];

export interface InvoiceLine {
  id: string;
  description: string;
  category: LineCategory;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  invoiceNumber: string;
  createdDate: string;
  dueDate: string;
  mechanicName: string;
  laborHourlyRate: number;
  items: InvoiceLine[];
  subtotal: number;
  shopSuppliesRatePct: number;
  shopSuppliesAmount: number;
  taxRatePct: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  payments?: PaymentRecord[];
  amountPaid?: number;
  internalOwnerNotes?: string;
}

const cents = (n: number) => Math.round(n * 100);
const dollars = (c: number) => c / 100;
const num = (v: unknown, min = 0, max = 1_000_000) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : min;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Status follows from what has actually been paid, never from a setting. */
export function recomputePayments<T extends { totalAmount: number; payments?: PaymentRecord[]; amountPaid?: number; paymentStatus: PaymentStatus }>(inv: T): T {
  const paidCents = (inv.payments ?? []).reduce((sum, p) => sum + cents(p.amount), 0);
  const dueCents = cents(Number(inv.totalAmount ?? 0));
  inv.amountPaid = dollars(paidCents);
  inv.paymentStatus =
    paidCents <= 0 ? "unpaid" : dueCents > 0 && paidCents < dueCents ? "deposit_paid" : "paid_in_full";
  return inv;
}

export function balanceDue(inv: Pick<Invoice, "totalAmount" | "amountPaid">): number {
  return dollars(Math.max(cents(inv.totalAmount) - cents(inv.amountPaid ?? 0), 0));
}

/**
 * Accept an invoice edited in the portal. Line amounts and totals are worked
 * out here; payments come from what is already recorded (plus anything paid
 * before the invoice existed), never from the request.
 */
export function acceptInvoice(input: any, recorded: PaymentRecord[]): Invoice {
  const rawItems: any[] = Array.isArray(input?.items) ? input.items.slice(0, 100) : [];
  const items: InvoiceLine[] = rawItems.map((it, i) => {
    const quantity = num(it?.quantity, 0, 10_000);
    const rate = num(it?.rate, 0, 1_000_000);
    return {
      id: str(it?.id, 60) || `li-${i + 1}`,
      description: str(it?.description, 300).trim() || "Shop service",
      category: CATEGORIES.includes(it?.category) ? it.category : "labor",
      quantity,
      rate,
      amount: dollars(Math.round(quantity * rate * 100)),
    };
  });

  const subtotalC = items.reduce((s, it) => s + cents(it.amount), 0);
  const shopSuppliesRatePct = num(input?.shopSuppliesRatePct, 0, 100);
  const taxRatePct = num(input?.taxRatePct, 0, 100);
  const suppliesC = Math.round(subtotalC * (shopSuppliesRatePct / 100));
  const taxC = Math.round((subtotalC + suppliesC) * (taxRatePct / 100));

  // Keep one copy of each payment, whichever list it came from.
  const seen = new Set<string>();
  const payments = recorded.filter((p) => (seen.has(p.orderId) ? false : (seen.add(p.orderId), true)));

  return recomputePayments({
    invoiceNumber: str(input?.invoiceNumber, 40) || "INV",
    createdDate: str(input?.createdDate, 20),
    dueDate: str(input?.dueDate, 20),
    mechanicName: str(input?.mechanicName, 120),
    laborHourlyRate: num(input?.laborHourlyRate, 0, 10_000),
    items,
    subtotal: dollars(subtotalC),
    shopSuppliesRatePct,
    shopSuppliesAmount: dollars(suppliesC),
    taxRatePct,
    taxAmount: dollars(taxC),
    totalAmount: dollars(subtotalC + suppliesC + taxC),
    paymentStatus: "unpaid",
    payments,
    internalOwnerNotes: str(input?.internalOwnerNotes, 2000),
  });
}

/**
 * What Shopify should charge: every line, plus shop supplies and sales tax as
 * lines of their own (Shopify's own tax is off for these orders, so it is not
 * added twice), less whatever has already been paid.
 */
export function shopifyCharge(inv: Invoice): { lines: { title: string; price: number }[]; alreadyPaid: number } {
  const lines = inv.items.filter((it) => it.amount > 0).map((it) => ({ title: it.description, price: it.amount }));
  if (inv.shopSuppliesAmount > 0) lines.push({ title: `Shop supplies (${inv.shopSuppliesRatePct}%)`, price: inv.shopSuppliesAmount });
  if (inv.taxAmount > 0) lines.push({ title: `Sales tax (${inv.taxRatePct}%)`, price: inv.taxAmount });
  return { lines, alreadyPaid: inv.amountPaid ?? 0 };
}
