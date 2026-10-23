/**
 * Forward a completed booking to the marketing CRM.
 *
 * Drop this file in the Frame Shop site at `src/marketing.ts` (or beside
 * `server.ts`) and call `forwardBookingToCrm(booking)` from the booking route.
 *
 * Three rules govern this file:
 *
 * 1. IT MUST NEVER BREAK A BOOKING. A customer booking their bike in is the
 *    business; the CRM copy is bookkeeping. So this never throws, never blocks
 *    the response, and never changes what the customer sees. If the CRM is
 *    down, the booking still succeeds and the failure is logged for Paul.
 *
 * 2. IT IS OFF UNTIL CONFIGURED. With no MARKETING_INTAKE_URL set it returns
 *    immediately, exactly like the video uploads and the AI diagnostic. The
 *    site runs fine with no marketing stack attached.
 *
 * 3. BOOKING A REPAIR IS NOT CONSENT TO BE MARKETED TO. Consent flags are sent
 *    false unless the form actually asked. See the note at the bottom.
 */

interface BookingLike {
  id?: string;
  ticketNumber?: string;
  name?: string;
  phone?: string;
  email?: string;
  bikeYear?: string;
  bikeMake?: string;
  bikeModel?: string;
  serviceTitle?: string;
  serviceId?: string;
  issueNotes?: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
  consentEmail?: boolean;
  consentSms?: boolean;
}

const INTAKE_URL = process.env.MARKETING_INTAKE_URL || "";
const INTAKE_SECRET = process.env.MARKETING_INTAKE_SECRET || "";

/** Whether a marketing CRM is wired up at all. */
export const marketingEnabled = () => Boolean(INTAKE_URL);

export async function forwardBookingToCrm(booking: BookingLike): Promise<void> {
  if (!INTAKE_URL) return;

  const body = {
    type: "appointment",
    payload: {
      id: booking.id ?? null,
      ticketNumber: booking.ticketNumber ?? null,
      name: booking.name ?? null,
      phone: booking.phone ?? null,
      email: booking.email ?? null,
      bikeYear: booking.bikeYear ?? null,
      bikeMake: booking.bikeMake ?? null,
      bikeModel: booking.bikeModel ?? null,
      serviceTitle: booking.serviceTitle ?? null,
      serviceType: booking.serviceId ?? null,
      issueNotes: booking.issueNotes ?? null,
      preferredDate: booking.preferredDate ?? null,
      preferredTimeSlot: booking.preferredTimeSlot ?? null,
      source: "frameshop-website:booking",

      // Default to no marketing consent. The customer asked for their frame to
      // be straightened; they did not ask to be emailed. Only pass true when a
      // checkbox on the form actually said so.
      consent_email: booking.consentEmail === true,
      consent_sms: booking.consentSms === true,
    },
  };

  // 5 seconds, then give up. The customer is waiting on the booking response.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);

  try {
    const res = await fetch(INTAKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(INTAKE_SECRET ? { "x-webhook-secret": INTAKE_SECRET } : {}),
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    if (!res.ok) {
      console.warn("[CRM] intake refused the booking:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    // Swallowed on purpose. See rule 1.
    console.warn("[CRM] could not reach intake:", (err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------------------
 * Wiring it into server.ts
 *
 * In the booking route, AFTER the booking is saved and the response is sent:
 *
 *     import { forwardBookingToCrm } from "./src/marketing";
 *
 *     app.post("/api/bookings", bookingLimiter, (req, res) => {
 *       // ... existing validation and save ...
 *       res.status(201).json(booking);
 *
 *       // Not awaited: the customer already has their ticket number.
 *       void forwardBookingToCrm(booking);
 *     });
 *
 * Send it after res.json, not before. Awaiting a third-party call inside the
 * request is how a slow CRM turns into a slow booking form.
 *
 * ---------------------------------------------------------------------------
 * The consent question, which is a legal one and not a technical one
 *
 * In the US, marketing email is governed by CAN-SPAM and marketing SMS by the
 * TCPA — and the TCPA requires express written consent before an automated
 * marketing text. Booking a repair is not that consent.
 *
 * So, before the agent is allowed to send anything to these contacts:
 *
 *   - Add a checkbox to the booking form, unticked by default, with words of
 *     its own: "Text or email me about service reminders and shop news."
 *     Pass its value through as consentEmail / consentSms.
 *   - Until that exists, every contact arrives with consent false, and the
 *     agent must be kept on `autonomy = 'draft'` so Paul approves each message
 *     and sends it as an ordinary business reply.
 *
 * Transactional messages — "your bike is ready", "your appointment is Tuesday"
 * — are a different thing and do not need marketing consent. Keep them separate
 * from anything promotional.
 * ------------------------------------------------------------------------- */
