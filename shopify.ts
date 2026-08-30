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
