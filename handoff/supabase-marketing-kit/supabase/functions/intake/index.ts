// Intake — public webhook that captures a lead into the CRM, logs the activity,
// and enqueues a follow-up. Accepts either a flat contact shape
//   { name, email, phone, message, source }
// or a booking envelope
//   { type: "appointment", payload: { clientName, clientEmail, clientPhone, ... } }
//
// The Frame Shop's booking form sends its own field names, so those are mapped
// here too: name/phone/email, bikeYear/bikeMake/bikeModel, serviceTitle,
// issueNotes, preferredDate, preferredTimeSlot, ticketNumber.
//
// The bike is the shop's equivalent of "company" — it is the thing the job is
// about, and a follow-up that cannot name the customer's bike is useless — so
// it is carried into the contact record rather than dropped.
//
// Public endpoint (verify_jwt = false); protected by an optional shared secret
// in the `x-webhook-secret` header (set WEBHOOK_SECRET to enforce).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { json, corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (secret && req.headers.get("x-webhook-secret") !== secret) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return json({ ok: false, error: "invalid JSON" }, 400);
  }

  // Unwrap the { type, payload } envelope the site uses; else treat as flat.
  const isEnvelope = !!raw && typeof raw === "object" && "payload" in raw && typeof raw.payload === "object";
  const p = (isEnvelope ? raw.payload : raw) as Record<string, unknown>;
  const kind = String((raw.type ?? "") as string);
  const isAppointment = kind === "appointment";

  const email = String((p.email ?? p.clientEmail ?? "") as string).trim().toLowerCase() || null;
  const fullName = (p.name ?? p.full_name ?? p.clientName ?? null) as string | null;
  const phone = (p.phone ?? p.clientPhone ?? null) as string | null;

  // The bike stands in for "company": it is what the job is about.
  const bike = [p.bikeYear, p.bikeMake, p.bikeModel].filter(Boolean).join(" ").trim() || null;
  const company = (p.company ?? p.companyName ?? bike ?? null) as string | null;

  const source = (p.source ?? (isAppointment ? "frameshop-website:booking" : "frameshop-website")) as string;

  // Build a readable message. For bookings, summarise the request.
  let message = (p.message ?? p.details ?? p.notes ?? p.issueNotes ?? null) as string | null;
  if (isAppointment) {
    const parts = [
      p.serviceTitle ?? p.serviceType,
      bike,
      p.preferredDate ? `on ${p.preferredDate}` : null,
      p.preferredTimeSlot,
      p.budgetRange ? `budget ${p.budgetRange}` : null,
    ].filter(Boolean).join(" · ");
    const notes = p.issueNotes ?? p.notes;
    message = [
      `Booking request: ${parts}`,
      notes ? `Symptoms: ${notes}` : null,
      p.ticketNumber ? `Ticket ${p.ticketNumber}` : null,
    ].filter(Boolean).join(" — ");
  }

  if (!email && !phone) return json({ ok: false, error: "email or phone required" }, 400);

  const sb = serviceClient();

  // Upsert on email when present; otherwise insert a fresh contact.
  let contactId: string | undefined;
  if (email) {
    const { data: existing } = await sb.from("contacts").select("id").eq("email", email).maybeSingle();
    contactId = existing?.id;
  }
  if (!contactId) {
    const { data, error } = await sb.from("contacts").insert({
      full_name: fullName, email, phone, company, source,
      lifecycle_stage: "lead",
      consent_email: Boolean(p.consent_email ?? !!email),
      consent_sms: Boolean(p.consent_sms ?? false),
      meta: { message, raw },
    }).select("id").single();
    if (error) return json({ ok: false, error: error.message }, 500);
    contactId = data.id;
  } else {
    await sb.from("contacts").update({
      full_name: fullName ?? undefined, phone: phone ?? undefined, company: company ?? undefined,
      meta: { message, raw },
    }).eq("id", contactId);
  }

  await sb.from("activities").insert({
    contact_id: contactId, type: isAppointment ? "booking" : "note", direction: "inbound",
    subject: isAppointment ? "New booking request" : "New inquiry", body: message, meta: { source },
  });

  // For a booking, also open a deal in the pipeline.
  let dealId: string | undefined;
  if (isAppointment) {
    const amount = parseBudget(String(p.budgetRange ?? ""));
    const { data: deal } = await sb.from("deals").insert({
      contact_id: contactId,
      title: String(p.serviceTitle ?? p.serviceType ?? "Alignment work"),
      stage: "quoted",
      amount,
      event_date: (p.preferredDate as string | null) ?? null,
      details: {
        service_type: p.serviceType ?? null,
        time_slot: p.preferredTimeSlot ?? null,
        budget_range: p.budgetRange ?? null,
        appointment_id: p.id ?? null,
        // Carried so a follow-up can name the bike and quote the ticket.
        bike: bike,
        bike_year: p.bikeYear ?? null,
        bike_make: p.bikeMake ?? null,
        bike_model: p.bikeModel ?? null,
        ticket_number: p.ticketNumber ?? null,
      },
    }).select("id").single();
    dealId = deal?.id;
  }

  // Queue a follow-up (deduped so repeat submissions don't stack).
  await sb.from("tasks").upsert(
    { type: "follow_up_lead", payload: { contact_id: contactId }, priority: 50, dedupe_key: `follow_up_lead:${contactId}` },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );

  return json({ ok: true, contact_id: contactId, deal_id: dealId ?? null });
});

// Parse the low end of a budget range like "$3,000 - $5,000" -> 3000.
function parseBudget(s: string): number | null {
  const m = s.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}
