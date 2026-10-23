/**
 * Shopify payments for The Frame Shop.
 *
 * Both things the shop charges for — a deposit taken when a booking is made,
 * and the final invoice for a finished job — are Draft Orders here. Shopify is
 * built around a catalogue of products, but a Draft Order takes free-text line
 * items at whatever price you name, which is what a shop billing custom labour
 * and parts actually needs.
 *
 * A Draft Order gives back an invoice_url the customer can pay on, and can also
 * email itself. When it is paid Shopify turns it into a real Order and fires the
 * orders/paid webhook, which is how the booking gets marked off.
 */
import crypto from "crypto";
import { recomputePayments } from "./invoice";

export const SHOPIFY_STORE_DOMAIN   = (process.env.SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
export const SHOPIFY_ADMIN_TOKEN    = process.env.SHOPIFY_ADMIN_TOKEN    || "";
export const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || "";
const API_VERSION                   = process.env.SHOPIFY_API_VERSION    || "2024-10";

export const shopifyEnabled = () => Boolean(SHOPIFY_STORE_DOMAIN && SHOPIFY_ADMIN_TOKEN);

export interface DraftLineItem {
  title: string;
  /** Dollars, e.g. 125.50. Shopify takes prices as decimal strings. */
  price: number;
  quantity?: number;
}

export interface DraftOrderResult {
  id: number;
  invoiceUrl: string;
  name: string;
}

async function adminApi(path: string, init: RequestInit = {}): Promise<any> {
  if (!shopifyEnabled()) {
    throw new Error("Shopify is not configured on this server.");
  }
  const res = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/${path}`, {
    ...init,
    // Creating a deposit link happens while the customer waits on the booking
    // screen. Shopify's Admin API normally answers in well under a second.
    signal: init.signal ?? AbortSignal.timeout(15_000),
    headers: {
      "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    // Shopify returns {errors: ...} as either a string or a field map.
    let detail = text.slice(0, 400);
    try {
      const parsed = JSON.parse(text);
      detail = typeof parsed.errors === "string" ? parsed.errors : JSON.stringify(parsed.errors ?? parsed);
    } catch {
      /* keep the raw text */
    }
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

/**
 * Create a draft order. bookingId travels in note_attributes so it survives onto
 * the paid Order and the webhook can match it back to the job.
 */
export async function createDraftOrder(opts: {
  lineItems: DraftLineItem[];
  email?: string;
  customerName?: string;
  bookingId?: string;
  ticketNumber?: string;
  note?: string;
  /** Money already received (a deposit, cash). Taken off the order's total. */
  alreadyPaid?: number;
}): Promise<DraftOrderResult> {
  const body = {
    draft_order: {
      line_items: opts.lineItems.map(li => ({
        title: li.title,
        price: li.price.toFixed(2),
        quantity: li.quantity ?? 1,
        requires_shipping: false,
        taxable: false,
      })),
      ...(opts.email ? { email: opts.email } : {}),
      note: opts.note || (opts.ticketNumber ? `Work Order ${opts.ticketNumber}` : "The Frame Shop"),
      tags: "frame-shop",
      ...(opts.alreadyPaid && opts.alreadyPaid > 0
        ? {
            applied_discount: {
              title: "Already paid",
              description: "Deposit and payments already received",
              value_type: "fixed_amount",
              value: opts.alreadyPaid.toFixed(2),
              amount: opts.alreadyPaid.toFixed(2),
            },
          }
        : {}),
      note_attributes: [
        ...(opts.bookingId ? [{ name: "bookingId", value: opts.bookingId }] : []),
        ...(opts.ticketNumber ? [{ name: "ticketNumber", value: opts.ticketNumber }] : []),
      ],
    },
  };

  const data = await adminApi("draft_orders.json", { method: "POST", body: JSON.stringify(body) });
  const draft = data.draft_order;
  return { id: draft.id, invoiceUrl: draft.invoice_url, name: draft.name };
}

/** Email the draft order to the customer with a pay link. */
export async function sendDraftOrderInvoice(draftOrderId: number, customMessage?: string): Promise<void> {
  await adminApi(`draft_orders/${draftOrderId}/send_invoice.json`, {
    method: "POST",
    body: JSON.stringify({
      draft_order_invoice: {
        subject: "Your invoice from The Frame Shop",
        custom_message:
          customMessage ||
          "Thank you for trusting The Frame Shop with your motorcycle. Zero Tolerance. Pure Alignment.",
      },
    }),
  });
}

/**
 * Shopify signs each webhook with the shared secret. Compared in constant time
 * so the check cannot be probed by timing it.
 */
export function verifyWebhook(rawBody: Buffer, hmacHeader: string): boolean {
  if (!SHOPIFY_WEBHOOK_SECRET || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", SHOPIFY_WEBHOOK_SECRET).update(rawBody).digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Pull our bookingId back out of a paid order's note_attributes. */
export function bookingIdFromOrder(order: any): string | null {
  const attrs = order?.note_attributes;
  if (!Array.isArray(attrs)) return null;
  const hit = attrs.find((a: any) => a?.name === "bookingId");
  return hit?.value ? String(hit.value) : null;
}

/* ---------------------------------------------------------------------------
 * Recording a payment against an invoice
 *
 * A job can be paid in more than one Shopify order: a deposit, then the
 * balance. Each order fires its own orders/paid webhook. Two things follow.
 *
 * 1. Payments must ACCUMULATE. The first version judged each order on its own
 *    — "$400 is less than the $500 total, so deposit paid" — so paying off the
 *    balance left the job marked as still owing, forever.
 *
 * 2. Accumulating makes RETRIES dangerous. Shopify redelivers a webhook when it
 *    is unsure the first delivery landed, and sums would count a retried order
 *    twice. So every payment is recorded against its Shopify order id, and an
 *    order already on the ledger is ignored. Replaying a webhook changes nothing.
 * ------------------------------------------------------------------------- */

export interface PaymentRecord {
  /** Shopify's order id — the key that makes a replayed webhook a no-op. */
  orderId: string;
  /** The human order number, e.g. "#1042", for Paul's screen. */
  orderName: string;
  amount: number;
  paidAt: string;
  /** How it was paid. Absent on records from before this field existed: Shopify. */
  method?: "shopify" | "cash" | "check" | "card_in_person" | "other";
  note?: string;
}

export type PaymentStatus = "unpaid" | "deposit_paid" | "paid_in_full";

/** The slice of an invoice this needs; the full type lives in server.ts. */
export interface PayableInvoice {
  totalAmount: number;
  paymentStatus: PaymentStatus;
  payments?: PaymentRecord[];
  amountPaid?: number;
}

export interface PaymentResult {
  /** False when this order was already recorded — a retried webhook. */
  applied: boolean;
  status: PaymentStatus;
  amountPaid: number;
}

/**
 * Record one paid order against an invoice. Mutates the invoice in place and
 * says what happened. Safe to call any number of times with the same order.
 */
export function applyPayment(invoice: PayableInvoice, order: any): PaymentResult {
  const payments = (invoice.payments ??= []);
  const orderId = String(order?.id ?? "");
  const amount = Math.round(parseFloat(order?.total_price ?? "0") * 100) / 100;

  const already = orderId !== "" && payments.some((p) => p.orderId === orderId);
  const applied = !already && orderId !== "" && amount > 0;
  if (applied) {
    payments.push({
      orderId,
      orderName: String(order?.name ?? orderId),
      amount,
      paidAt: String(order?.processed_at ?? order?.created_at ?? new Date().toISOString()),
      method: "shopify",
    });
  }

  // Summed in cents so a run of small payments cannot drift by a penny.
  recomputePayments(invoice);
  return { applied, status: invoice.paymentStatus, amountPaid: invoice.amountPaid ?? 0 };
}
