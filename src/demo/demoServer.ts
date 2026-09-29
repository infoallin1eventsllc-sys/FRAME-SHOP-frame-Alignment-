/**
 * DEMO MODE — preview builds only.
 *
 * The published preview is a single static page with no server behind it, so
 * the owner portal could not be signed into and no form could be tried. In a
 * build made with `vite build --mode demo`, this answers the site's /api calls
 * inside the browser instead, so every screen can be clicked through.
 *
 * It follows server.ts route for route: the same status codes, the same
 * validation, and the real invoice arithmetic (invoice.ts). Everything is kept
 * in this browser only. Nothing reaches the shop, Shopify, Google or anyone
 * else. The production build does not contain this file.
 */
import { acceptInvoice, recomputePayments } from '../../invoice';
import { SERVICES } from '../data/shopData';
import { videoUrl, deleteVideo, clearVideos } from './videoStore';

export const DEMO_PIN = '1234';
const KEY = 'frameshop-demo-v1';

type Store = {
  bookings: any[];
  messages: any[];
  rates: any | null;
  media: Record<string, unknown>;
  videos: any[];
};

const empty = (): Store => ({ bookings: [], messages: [], rates: null, media: {}, videos: [] });
let memory: Store | null = null;

function load(): Store {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    memory = empty();
  }
  return memory!;
}
function save(s: Store) {
  memory = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private window or full storage: this visit still works from memory */
  }
}
export function resetDemo() {
  memory = empty();
  void clearVideos();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const uid = () => Math.random().toString(36).slice(2, 10);
const isOwner = (h: Headers) => h.get('x-shop-secret') === 'demo-owner';

function draftRates() {
  const lines = SERVICES.map((svc) => {
    const n = svc.startingPrice.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    return {
      id: svc.id,
      name: svc.title,
      price: n ? parseFloat(n[1].replace(/,/g, '')) : null,
      unit: /hr|hour/i.test(svc.startingPrice) ? 'per hour' : /wheel/i.test(svc.startingPrice) ? 'per wheel' : /from/i.test(svc.startingPrice) ? 'starting at' : 'flat',
      note: `Website lists: ${svc.startingPrice}`,
    };
  });
  return { laborRate: lines.find((l) => l.id === 'general-repair')?.price ?? null, suppliesPct: 0, taxPct: null, overheadPerHour: null, lines };
}

const moneyOrNull = (v: unknown, max = 1_000_000): number | null | undefined => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : undefined;
};

export async function handleDemoRequest(method: string, url: URL, headers: Headers, body: any): Promise<Response> {
  const s = load();
  const p = url.pathname;
  const m = method.toUpperCase();
  const seg = p.split('/').filter(Boolean); // ['api', ...]
  const ownerOnly = () => (isOwner(headers) ? null : json(401, { error: 'Unauthorized.' }));

  if (p === '/api/health') return json(200, { status: 'ok', checks: { bookings: 'ok', storage: 'ok' }, demo: true });

  if (p === '/api/auth/pin' && m === 'POST') {
    return body?.pin === DEMO_PIN ? json(200, { token: 'demo-owner' }) : json(401, { error: 'Invalid PIN. Access denied.' });
  }

  // ---- bookings --------------------------------------------------------
  if (p === '/api/bookings/lookup' && m === 'GET') {
    const raw = String(url.searchParams.get('q') || '').trim();
    if (raw.length < 6) return json(400, { error: 'Enter your full ticket number or phone number.' });
    const digits = raw.replace(/\D/g, '');
    const match = s.bookings.find(
      (b) => b.ticketNumber.toUpperCase() === raw.toUpperCase() || (digits.length >= 10 && b.phone.replace(/\D/g, '') === digits)
    );
    return match ? json(200, { booking: match }) : json(404, { error: 'No ticket found.' });
  }

  if (p === '/api/bookings' && m === 'GET') {
    const denied = ownerOnly();
    if (denied) return denied;
    return json(200, { bookings: s.bookings, total: s.bookings.length });
  }

  if (p === '/api/bookings' && m === 'POST') {
    const b = body || {};
    if (!b.name || !b.phone || !b.bikeMake || !b.bikeModel) return json(400, { error: 'Missing required contact or motorcycle details.' });
    const key = typeof b.idempotencyKey === 'string' && b.idempotencyKey.length <= 100 ? b.idempotencyKey : undefined;
    const existing = key && s.bookings.find((x) => x.idempotencyKey === key);
    if (existing) return json(200, { success: true, message: 'Appointment request received.', booking: existing, duplicate: true });
    const taken = new Set(s.bookings.map((x) => x.ticketNumber));
    let ticketNumber = '';
    do ticketNumber = 'FS-' + (100000 + Math.floor(Math.random() * 900000));
    while (taken.has(ticketNumber));
    const booking = {
      id: 'bk-' + Date.now(),
      ticketNumber,
      serviceId: b.serviceId || 'powertrain-alignment',
      serviceTitle: b.serviceTitle || 'Power Train Alignment',
      bikeYear: b.bikeYear || '',
      bikeMake: b.bikeMake,
      bikeModel: b.bikeModel,
      issueNotes: b.issueNotes || '',
      preferredDate: b.preferredDate || new Date().toISOString().split('T')[0],
      preferredTimeSlot: b.preferredTimeSlot || 'Morning (9AM - 12PM)',
      name: b.name,
      phone: b.phone,
      email: b.email,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...(key ? { idempotencyKey: key } : {}),
      ...(b.marketingConsent === true
        ? { marketingConsent: { given: true, at: new Date().toISOString(), wording: clean(b.marketingConsentWording, 500) } }
        : {}),
    };
    s.bookings.unshift(booking);
    save(s);
    return json(201, { success: true, message: 'Appointment request received.', booking, notificationDispatched: false });
  }

  if (seg[1] === 'bookings' && seg[2] && seg.length === 3) {
    const denied = ownerOnly();
    if (denied) return denied;
    const b = s.bookings.find((x) => x.id === seg[2]);
    if (!b) return json(404, { error: 'Booking ticket not found.' });

    if (m === 'DELETE') {
      s.bookings = s.bookings.filter((x) => x !== b);
      save(s);
      return json(200, { success: true, message: 'Booking removed.' });
    }
    if (m === 'PATCH') {
      const { status, techNotes, preferredDate, preferredTimeSlot, invoice } = body || {};
      if (status !== undefined) {
        if (!['pending', 'confirmed', 'in_shop', 'completed', 'cancelled'].includes(status)) return json(400, { error: 'Unknown status.' });
        b.status = status;
      }
      if (techNotes !== undefined) b.techNotes = techNotes;
      if (preferredDate) b.preferredDate = preferredDate;
      if (preferredTimeSlot) b.preferredTimeSlot = preferredTimeSlot;
      if (invoice !== undefined) {
        if (!invoice || typeof invoice !== 'object') return json(400, { error: 'Invalid invoice.' });
        b.invoice = acceptInvoice(invoice, [...(b.invoice?.payments ?? []), ...(b.prepayments ?? [])]);
        delete b.prepayments;
      }
      save(s);
      return json(200, { success: true, booking: b });
    }
  }

  if (seg[1] === 'bookings' && seg[3] === 'payments') {
    const denied = ownerOnly();
    if (denied) return denied;
    const b = s.bookings.find((x) => x.id === seg[2]);
    if (!b) return json(404, { error: 'Booking ticket not found.' });

    if (m === 'POST' && seg.length === 4) {
      const amount = Math.round(parseFloat(String(body?.amount)) * 100) / 100;
      const method = body?.method;
      if (!Number.isFinite(amount) || amount <= 0) return json(400, { error: 'Enter the amount received.' });
      if (!['cash', 'check', 'card_in_person', 'other'].includes(method)) return json(400, { error: 'Choose how it was paid.' });
      const record = {
        orderId: `manual-${uid()}`,
        orderName: method === 'check' ? 'Check' : method === 'cash' ? 'Cash' : method === 'card_in_person' ? 'Card (in shop)' : 'Other',
        amount,
        paidAt: new Date().toISOString(),
        method,
        ...(clean(body?.note, 200) ? { note: clean(body?.note, 200) } : {}),
      };
      if (b.invoice) {
        (b.invoice.payments ??= []).push(record);
        recomputePayments(b.invoice);
      } else {
        (b.prepayments ??= []).push(record);
      }
      save(s);
      return json(201, { success: true, booking: b });
    }
    if (m === 'DELETE' && seg[4]) {
      const list = b.invoice ? (b.invoice.payments ??= []) : (b.prepayments ??= []);
      const i = list.findIndex((x: any) => x.orderId === decodeURIComponent(seg[4]));
      if (i === -1) return json(404, { error: 'Payment not found.' });
      if (!list[i].orderId.startsWith('manual-')) return json(409, { error: 'Online payments are recorded by Shopify. Refund them in Shopify instead.' });
      list.splice(i, 1);
      if (b.invoice) recomputePayments(b.invoice);
      save(s);
      return json(200, { success: true, booking: b });
    }
  }

  // ---- messages --------------------------------------------------------
  if (p === '/api/messages' && m === 'POST') {
    const name = clean(body?.name, 120);
    const reach = clean(body?.reach, 200);
    const message = clean(body?.message, 4000);
    if (!name || !reach || !message) return json(400, { error: 'Please fill in your name, a phone or email, and your message.' });
    const key = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : undefined;
    const existing = key && s.messages.find((x) => x.idempotencyKey === key);
    if (existing) return json(200, { success: true, id: existing.id, duplicate: true });
    const entry = { id: `msg-${Date.now()}-${uid()}`, name, reach, message, createdAt: new Date().toISOString(), handled: false, ...(key ? { idempotencyKey: key } : {}) };
    s.messages.unshift(entry);
    save(s);
    return json(201, { success: true, id: entry.id });
  }
  if (p === '/api/messages' && m === 'GET') {
    const denied = ownerOnly();
    if (denied) return denied;
    return json(200, { messages: s.messages, unhandled: s.messages.filter((x) => !x.handled).length });
  }
  if (seg[1] === 'messages' && seg[2]) {
    const denied = ownerOnly();
    if (denied) return denied;
    const msg = s.messages.find((x) => x.id === decodeURIComponent(seg[2]));
    if (!msg) return json(404, { error: 'Message not found.' });
    if (m === 'PATCH') {
      if (typeof body?.handled === 'boolean') msg.handled = body.handled;
      save(s);
      return json(200, { success: true, message: msg });
    }
    if (m === 'DELETE') {
      s.messages = s.messages.filter((x) => x !== msg);
      save(s);
      return json(200, { success: true });
    }
  }

  // ---- rates -------------------------------------------------------------
  if (p === '/api/rates') {
    const denied = ownerOnly();
    if (denied) return denied;
    if (m === 'GET') return json(200, s.rates ?? draftRates());
    if (m === 'PUT') {
      const r = body || {};
      const laborRate = moneyOrNull(r.laborRate);
      const taxPct = moneyOrNull(r.taxPct, 100);
      const overheadPerHour = moneyOrNull(r.overheadPerHour);
      const suppliesPct = moneyOrNull(r.suppliesPct, 100);
      if ([laborRate, taxPct, overheadPerHour, suppliesPct].includes(undefined)) {
        return json(400, { error: 'Rates must be numbers of zero or more (percentages up to 100).' });
      }
      if (!Array.isArray(r.lines)) return json(400, { error: 'Invalid rate list.' });
      const lines = [];
      for (const [i, raw] of r.lines.entries()) {
        const name = clean(raw?.name, 120);
        const price = moneyOrNull(raw?.price);
        if (!name) return json(400, { error: `Line ${i + 1} needs a name.` });
        if (price === undefined) return json(400, { error: `"${name}" has an invalid price.` });
        lines.push({ id: clean(raw?.id, 60) || `rate-${Date.now()}-${i}`, name, price, unit: clean(raw?.unit, 40) || 'flat', note: clean(raw?.note, 300) });
      }
      s.rates = { laborRate, suppliesPct: suppliesPct ?? 0, taxPct, overheadPerHour, lines, confirmedAt: new Date().toISOString() };
      save(s);
      return json(200, s.rates);
    }
  }

  // ---- site photos and videos -------------------------------------------
  if (p === '/api/media' && m === 'GET') return json(200, s.media);
  if (p === '/api/media' && m === 'PUT') {
    const denied = ownerOnly();
    if (denied) return denied;
    s.media = body && typeof body === 'object' ? body : {};
    save(s);
    return json(200, { ok: true });
  }
  // Uploads are kept in this browser (videoStore.ts). A stored clip's link is
  // made fresh on each read: the previous visit's blob: link no longer works.
  if (p === '/api/videos/config') return json(200, { enabled: true, maxBytes: 200 * 1024 * 1024 });
  if (p === '/api/videos' && m === 'GET') {
    const list = [];
    for (const v of s.videos) {
      if (typeof v.storageObject === 'string' && v.storageObject.startsWith('demo-')) {
        const url = await videoUrl(v.storageObject);
        if (url) list.push({ ...v, url });
      } else {
        list.push(v);
      }
    }
    return json(200, list);
  }
  if (seg[1] === 'videos' && seg[2] === 'object' && seg[3] && m === 'DELETE') {
    const denied = ownerOnly();
    if (denied) return denied;
    await deleteVideo(decodeURIComponent(seg[3]));
    return json(200, { ok: true });
  }
  if (p === '/api/videos' && m === 'PUT') {
    const denied = ownerOnly();
    if (denied) return denied;
    if (!Array.isArray(body)) return json(400, { error: 'Invalid video list.' });
    s.videos = body;
    save(s);
    return json(200, { ok: true, count: body.length });
  }

  // ---- outside services: off in the demo ---------------------------------
  if (p === '/api/payments/config') return json(200, { provider: 'shopify', enabled: false });
  if (p === '/api/shopify/checkout') return json(503, { error: 'Online payment is not connected in demo mode.' });
  if (p === '/api/shopify/invoice/send') return json(503, { error: 'Demo mode: Shopify is not connected, so no email was sent. On the live site this emails the customer a payment link.' });
  if (p === '/api/email/config') return json(200, { enabled: false, replyTo: 'theframeshop13@gmail.com' });
  if (seg[1] === 'bookings' && (seg[3] === 'invoice.pdf' || seg[3] === 'invoice')) {
    return json(503, { error: 'Demo mode: PDFs are made by the server, so Download PDF and Email PDF only work on the live site.' });
  }
  if (p === '/api/diagnostic') return json(503, { error: 'The AI diagnostic is not connected in demo mode.' });

  return json(404, { error: `No such endpoint: ${m} ${p}` });
}
