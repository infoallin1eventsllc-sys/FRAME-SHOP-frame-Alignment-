import { SHOP_INFO } from '../data/shopData';
import type { Booking, InternalInvoice, InvoiceLineItem, ShopRates } from '../types';

/**
 * The live preview while Paul edits an invoice. The server works the same
 * figures out again when it saves, and that saved copy is what gets charged.
 */
const c = (n: number) => Math.round(n * 100);

export function recalcInvoice(inv: InternalInvoice): InternalInvoice {
  const items = inv.items.map((it) => ({ ...it, amount: Math.round(it.quantity * it.rate * 100) / 100 }));
  const subtotalC = items.reduce((s, it) => s + c(it.amount), 0);
  const suppliesC = Math.round(subtotalC * (inv.shopSuppliesRatePct / 100));
  const taxC = Math.round((subtotalC + suppliesC) * (inv.taxRatePct / 100));
  return {
    ...inv,
    items,
    subtotal: subtotalC / 100,
    shopSuppliesAmount: suppliesC / 100,
    taxAmount: taxC / 100,
    totalAmount: (subtotalC + suppliesC + taxC) / 100,
  };
}

/**
 * An invoice from storage, made safe to display. Records saved by older
 * versions can be missing fields; one such record used to crash the whole
 * portal on a `.toFixed` of undefined.
 */
export function normalizeInvoice(raw: any): InternalInvoice {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
  const items: InvoiceLineItem[] = (Array.isArray(raw?.items) ? raw.items : []).map((it: any, i: number) => ({
    id: String(it?.id ?? `li-${i + 1}`),
    description: String(it?.description ?? ''),
    category: it?.category ?? 'labor',
    quantity: n(it?.quantity),
    rate: n(it?.rate),
    amount: n(it?.amount),
  }));
  const payments = Array.isArray(raw?.payments) ? raw.payments : [];
  const amountPaid = typeof raw?.amountPaid === 'number' ? raw.amountPaid : payments.reduce((s: number, p: any) => s + n(p?.amount), 0);
  return recalcInvoice({
    invoiceNumber: String(raw?.invoiceNumber ?? 'INV'),
    createdDate: String(raw?.createdDate ?? ''),
    dueDate: String(raw?.dueDate ?? ''),
    mechanicName: String(raw?.mechanicName ?? ''),
    laborHourlyRate: n(raw?.laborHourlyRate),
    items,
    subtotal: 0,
    shopSuppliesRatePct: n(raw?.shopSuppliesRatePct),
    shopSuppliesAmount: 0,
    taxRatePct: n(raw?.taxRatePct),
    taxAmount: 0,
    totalAmount: 0,
    paymentStatus: raw?.paymentStatus === 'paid_in_full' || raw?.paymentStatus === 'deposit_paid' ? raw.paymentStatus : 'unpaid',
    payments,
    amountPaid,
    internalOwnerNotes: typeof raw?.internalOwnerNotes === 'string' ? raw.internalOwnerNotes : '',
  });
}

export function balanceDue(inv: Pick<InternalInvoice, 'totalAmount' | 'amountPaid'>): number {
  return Math.max(c(inv.totalAmount) - c(inv.amountPaid ?? 0), 0) / 100;
}

/**
 * A new invoice holds only what is known: the booked service at Paul's own
 * price for it, if he has set one, and his own supplies and tax rates. It used
 * to be pre-filled with invented parts, hours and prices.
 */
export function newInvoiceForBooking(booking: Booking, rates: ShopRates | null): InternalInvoice {
  const today = new Date().toISOString().split('T')[0];
  const line = rates?.lines.find((l) => l.id === booking.serviceId);
  const items: InvoiceLineItem[] = [
    {
      id: `li-${Date.now()}`,
      description: booking.serviceTitle,
      category: 'service',
      quantity: 1,
      rate: line?.price ?? 0,
      amount: line?.price ?? 0,
    },
  ];
  const prepaid = booking.prepayments ?? [];
  const amountPaid = prepaid.reduce((s, p) => s + c(p.amount), 0) / 100;

  return recalcInvoice({
    invoiceNumber: `INV-${booking.ticketNumber.replace('FS-', '')}`,
    createdDate: today,
    dueDate: today,
    mechanicName: SHOP_INFO.owner,
    laborHourlyRate: rates?.laborRate ?? 0,
    items,
    subtotal: 0,
    shopSuppliesRatePct: rates?.suppliesPct ?? 0,
    shopSuppliesAmount: 0,
    taxRatePct: rates?.taxPct ?? 0,
    taxAmount: 0,
    totalAmount: 0,
    paymentStatus: amountPaid > 0 ? 'deposit_paid' : 'unpaid',
    payments: prepaid,
    amountPaid,
    internalOwnerNotes: '',
  });
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  shopify: 'Online (Shopify)',
  cash: 'Cash',
  check: 'Check',
  card_in_person: 'Card in shop',
  other: 'Other',
};
