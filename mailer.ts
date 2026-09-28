/**
 * Sending email from the site — currently, invoices with their PDF attached.
 *
 * Goes through Resend (resend.com), a transactional email service. Gmail
 * itself cannot be used to send from a website safely: it needs the account
 * password or an app password stored on the server, and Google blocks or
 * throttles automated sending. Instead the shop's Gmail is the Reply-To, so
 * when a customer answers an invoice email, the reply lands in that inbox.
 *
 * Needs, on the server:
 *   RESEND_API_KEY      from resend.com → API Keys
 *   INVOICE_FROM_EMAIL  e.g. "The Frame Shop <invoices@theframeshop.com>" —
 *                       must be on a domain verified in Resend
 * Optional:
 *   INVOICE_REPLY_TO    defaults to the shop email in shopData.ts
 */
export const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
export const INVOICE_FROM_EMAIL = process.env.INVOICE_FROM_EMAIL || "";
// Overridable so tests can point at a local stand-in instead of Resend.
const RESEND_API_URL = process.env.RESEND_API_URL || "https://api.resend.com/emails";

export const emailEnabled = () => Boolean(RESEND_API_KEY && INVOICE_FROM_EMAIL);

/** A plausible single address, and nothing that could smuggle in a second one. */
export const looksLikeEmail = (s: string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(s);

export async function sendEmail(opts: {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  attachment?: { filename: string; content: Buffer };
}): Promise<{ id: string }> {
  if (!emailEnabled()) throw new Error("Email is not configured on this server.");
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: INVOICE_FROM_EMAIL,
      to: [opts.to],
      reply_to: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
      ...(opts.attachment
        ? { attachments: [{ filename: opts.attachment.filename, content: opts.attachment.content.toString("base64") }] }
        : {}),
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    let detail = body.slice(0, 300);
    try {
      detail = JSON.parse(body).message || detail;
    } catch {
      /* keep the raw text */
    }
    throw new Error(`Email service refused the message (${res.status}): ${detail}`);
  }
  let id = "";
  try {
    id = JSON.parse(body).id || "";
  } catch {
    /* sent; no id to record */
  }
  return { id };
}
