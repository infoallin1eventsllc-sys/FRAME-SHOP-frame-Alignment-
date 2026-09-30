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
import { publicTicket } from '../utils/publicTicket';
import { SERVICES, SHOP_INFO } from '../data/shopData';
import { renderDemoInvoicePdf } from './demoPdf';
import { videoUrl, deleteVideo, clearVideos } from './videoStore';

export const DEMO_PIN = '1234';
const KEY = 'frameshop-demo-v1';

type Store = {
  marketing?: { settings: any; drafts: any[]; runs: any[] };
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
    return match ? json(200, { booking: publicTicket(match) }) : json(404, { error: 'No ticket found.' });
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
      ...(['Google search', 'Google Maps', 'Instagram', 'Facebook', 'TikTok', 'Friend or another rider', 'Returning customer', 'Saw the shop', 'Other'].includes(b.source)
        ? { source: b.source }
        : {}),
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
        if (status === 'completed' && !b.completedAt) b.completedAt = new Date().toISOString();
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
  if (p.startsWith('/api/marketing')) return demoMarketing(s, m, seg, body, ownerOnly);
  if (p === '/api/security' && m === 'GET') {
    const denied = ownerOnly();
    if (denied) return denied;
    const zero = { logins: 0, wrongPins: 0, lockouts: 0, refused: 0, floods: 0 };
    return json(200, { demo: true, events: [], day: zero, week: zero, alertsTo: '', emailOn: false });
  }
  if (p === '/api/security/signout-all' && m === 'POST') {
    const denied = ownerOnly();
    return denied ?? json(200, { ok: true });
  }
  if (p === '/api/email/config') return json(200, { enabled: false, replyTo: 'theframeshop13@gmail.com' });
  if (seg[1] === 'bookings' && seg[3] === 'invoice.pdf' && m === 'GET') {
    const denied = ownerOnly();
    if (denied) return denied;
    const b = s.bookings.find((x) => x.id === seg[2]);
    if (!b?.invoice) return json(404, { error: 'This job has no invoice yet.' });
    const pdf = renderDemoInvoicePdf(
      b.invoice,
      { name: SHOP_INFO.name, address: SHOP_INFO.address, phone: SHOP_INFO.phone, email: SHOP_INFO.email },
      { name: b.name, phone: b.phone, email: b.email, ticketNumber: b.ticketNumber, bike: [b.bikeYear, b.bikeMake, b.bikeModel].filter(Boolean).join(' ') },
    );
    return new Response(pdf, { status: 200, headers: { 'Content-Type': 'application/pdf' } });
  }
  if (seg[1] === 'bookings' && seg[3] === 'invoice') {
    return json(503, { error: 'Demo mode: emailing works once the shop’s email account is connected on the live site. Download PDF works here.' });
  }
  if (p === '/api/diagnostic') return json(503, { error: 'The AI diagnostic is not connected in demo mode.' });

  return json(404, { error: `No such endpoint: ${m} ${p}` });
}

/* ---------------------------------------------------------------------------
 * The Marketing Desk, in the demo.
 *
 * The live assistants are Claude, on Paul's own key — the demo has no AI. So
 * that the approve / copy / mark-posted flow can be tried, the demo builds
 * simple drafts from the demo's own bookings and messages, and every one is
 * plainly labelled as a demo sample. Nothing here is what Claude would write.
 * ------------------------------------------------------------------------- */
const DEMO_TAG = '[DEMO SAMPLE — on the live site, Claude writes this from your shop records.]\n\n';

function demoMarketing(s: Store, m: string, seg: string[], body: any, ownerOnly: () => Response | null): Response {
  const denied = ownerOnly();
  if (denied) return denied;
  const mk = (s.marketing ??= {
    settings: { brandVoice: 'Plain, straight-talking and knowledgeable — a working mechanic, not an ad agency.', googleReviewUrl: '', competitors: '', autopilot: false },
    drafts: [],
    runs: [],
  });
  const now = new Date().toISOString();
  const add = (d: any) => {
    const full = { id: `dr-${uid()}`, status: 'pending', createdAt: now, updatedAt: now, ...d, body: DEMO_TAG + d.body };
    mk.drafts.unshift(full);
    return full;
  };
  const bike = (b: any) => [b.bikeYear, b.bikeMake, b.bikeModel].filter(Boolean).join(' ');
  const first = (n: string) => (n || '').trim().split(/\s+/)[0] || 'there';

  if (seg[2] === 'summary' && m === 'GET') {
    return json(200, {
      toApprove: mk.drafts.filter((d) => d.status === 'pending').length,
      approvedNotDone: mk.drafts.filter((d) => d.status === 'approved').length,
    });
  }
  if (seg[2] === 'digest' && seg[3] === 'test' && m === 'POST') {
    return json(503, { error: 'Demo mode: the morning email goes out on the live site, once email sending is switched on.' });
  }

  if (seg[2] === undefined && m === 'GET') {
    const t = Date.now();
    const within = (iso: string, days: number, from = 0) => t - Date.parse(iso) < days * 86400000 && t - Date.parse(iso) >= from * 86400000;
    const tally = (list: any[], key: (b: any) => string) =>
      Object.entries(list.reduce((a: Record<string, number>, b) => ((a[key(b)] = (a[key(b)] || 0) + 1), a), {} as Record<string, number>) as Record<string, number>)
        .map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
    const recent = s.bookings.filter((b) => within(b.createdAt, 90));
    let collected = 0, invoiced = 0, outstanding = 0;
    for (const b of s.bookings) {
      if (!b.invoice) continue;
      if (within(b.invoice.createdDate || now, 30)) invoiced += b.invoice.totalAmount || 0;
      for (const p of b.invoice.payments || []) if (within(p.paidAt, 30)) collected += p.amount;
      outstanding += Math.max(0, (b.invoice.totalAmount || 0) - (b.invoice.amountPaid || 0));
    }
    const done = mk.drafts.filter((d) => d.status === 'done');
    return json(200, {
      connected: true, emailConnected: false, model: 'demo', usage: { used: mk.runs.length, cap: 60 },
      settings: { digestEnabled: true, digestTo: 'theframeshop13@gmail.com', ...mk.settings },
      drafts: mk.drafts.filter((d) => d.status !== 'discarded'),
      runs: mk.runs.slice(0, 20),
      results: {
        bookings30: s.bookings.filter((b) => within(b.createdAt, 30)).length,
        bookingsPrev30: s.bookings.filter((b) => within(b.createdAt, 60, 30)).length,
        sources90: tally(recent, (b) => b.source || 'Not asked / not given'),
        services90: tally(recent, (b) => b.serviceTitle || 'Other'),
        invoiced30: Math.round(invoiced * 100) / 100, collected30: Math.round(collected * 100) / 100, outstanding: Math.round(outstanding * 100) / 100,
        emailList: new Set(s.bookings.filter((b) => b.marketingConsent).map((b) => b.email)).size, unsubscribed: 0,
        messages30: s.messages.filter((x) => within(x.createdAt, 30)).length, messagesWaiting: s.messages.filter((x) => !x.handled).length,
        published30: done.filter((d) => ['content', 'review_reply'].includes(d.agent)).length, emailsSent30: 0,
        reviewRequests30: done.filter((d) => d.agent === 'review_request').length,
      },
    });
  }

  if (seg[2] === 'settings' && m === 'PUT') {
    const url = String(body?.googleReviewUrl || '').trim();
    if (url && !/^https:\/\/\S+$/.test(url)) return json(400, { error: 'The Google review link should start with https://' });
    const digestTo = String(body?.digestTo || '').trim();
    if (digestTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(digestTo)) return json(400, { error: "The morning email address doesn't look right." });
    mk.settings = {
      brandVoice: String(body?.brandVoice || mk.settings.brandVoice), googleReviewUrl: url, competitors: String(body?.competitors || ''), autopilot: body?.autopilot === true,
      digestEnabled: body?.digestEnabled !== false, digestTo: digestTo || 'theframeshop13@gmail.com',
    };
    save(s);
    return json(200, { settings: mk.settings });
  }

  if (seg[2] === 'run' && m === 'POST') {
    const agent = seg[3];
    const added: any[] = [];
    if (agent === 'radar') return json(503, { error: 'Demo mode: the market radar searches the web with Claude, so it only runs on the live site.' });
    if (agent === 'content') {
      const jobs = s.bookings.filter((b) => b.status === 'completed').slice(0, 3);
      const topics = jobs.length ? jobs.map((b) => `${bike(b)} — ${b.serviceTitle}`) : SERVICES.slice(0, 3).map((x) => x.title);
      topics.forEach((topic, i) =>
        added.push(add({ agent, channel: ['instagram', 'facebook', 'google'][i % 3], title: topic, body: `${topic}. [ask Paul: what was wrong, and what it rides like now]`, hashtags: ['theframeshop', 'springtx'], photoIdea: 'The bike on the jig' }))
      );
      added.push(add({
        agent, channel: 'tiktok', title: `TikTok: ${topics[0]}`, body: `${topics[0]} [ask Paul: one line on the fix]`, hashtags: ['motorcycle', 'harleydavidson', 'springtx'],
        videoPlan: 'Hook (0–2s): [ask Paul: the symptom, e.g. "Wobbles at 70?"] on screen over the bike rolling in.\nShots: 1) bike on the jig  2) laser line on the frame  3) the adjustment  4) ride-off.\nOn-screen text: the problem, then "fixed".\nLength: about 20 seconds, filmed upright.',
      }));
    }
    if (agent === 'reply') {
      const covered = new Set(mk.drafts.filter((d) => d.agent === 'reply' && d.status !== 'discarded').map((d) => d.target?.messageId));
      for (const msg of s.messages.filter((x) => !x.handled && !covered.has(x.id)))
        added.push(add({ agent, channel: /@/.test(msg.reach) ? 'email' : 'text', title: `Reply to ${first(msg.name)}`, subject: 'Re: your message to The Frame Shop', body: `Hi ${first(msg.name)}, thanks for getting in touch. [ask Paul: answer to their question] Book online or call (832) 628-5226. — Paul`, target: { messageId: msg.id } }));
    }
    if (agent === 'review_reply') {
      if (!String(body?.review || '').trim()) return json(400, { error: 'Paste the review you want to answer.' });
      added.push(add({ agent, channel: 'review', title: `Reply to ${body?.reviewer || 'a'} review`, body: `Thanks ${body?.reviewer || 'for the review'} — [ask Paul: a line about their bike]. — Paul` }));
    }
    if (agent === 'review_request') {
      if (!mk.settings.googleReviewUrl) return json(400, { error: 'Add your Google review link in Marketing settings first.' });
      const covered = new Set(mk.drafts.filter((d) => d.agent === 'review_request' && d.status !== 'discarded').map((d) => d.target?.bookingId));
      for (const b of s.bookings.filter((x) => x.status === 'completed' && x.email && !covered.has(x.id)))
        added.push(add({ agent, channel: 'email', title: `Review request — ${bike(b)}`, subject: `How is the ${bike(b)} riding?`, body: `Hi ${first(b.name)}, if the ${b.serviceTitle} did the job, a short review helps other riders find us: ${mk.settings.googleReviewUrl} — Paul`, target: { bookingId: b.id } }));
    }
    if (agent === 'campaign') {
      const goal = String(body?.goal || '').trim();
      if (!goal) return json(400, { error: 'Say what the email is for — for example, “fill the slow Tuesdays in March”.' });
      added.push(add({ agent, channel: 'email', title: `Email campaign: ${goal.slice(0, 60)}`, subject: goal.slice(0, 80), body: `Hi {first_name}, [ask Paul: the offer for "${goal}"]. Book online or call (832) 628-5226.` }));
    }
    mk.runs.unshift({ agent, at: now, ok: true, drafts: added.length });
    save(s);
    return json(200, { drafts: added, message: added.length ? `${added.length} demo sample draft${added.length === 1 ? '' : 's'} to review.` : 'Nothing needed doing.' });
  }

  const d = mk.drafts.find((x) => x.id === seg[3]);
  if (seg[2] === 'drafts' && !d) return json(404, { error: 'Draft not found.' });
  if (seg[2] === 'drafts' && m === 'PATCH') {
    if (typeof body?.body === 'string') d.body = body.body;
    if (typeof body?.subject === 'string') d.subject = body.subject;
    if (['pending', 'approved', 'discarded'].includes(body?.status)) d.status = body.status;
    d.updatedAt = now;
    save(s);
    return json(200, { draft: d });
  }
  if (seg[2] === 'drafts' && seg[4] === 'done') {
    d.status = 'done';
    d.doneNote = String(body?.note || 'Marked done');
    d.updatedAt = now;
    if (d.agent === 'reply' && d.target?.messageId) {
      const msg = s.messages.find((x) => x.id === d.target.messageId);
      if (msg) msg.handled = true;
    }
    save(s);
    return json(200, { draft: d });
  }
  if (seg[2] === 'drafts' && seg[4] === 'send') {
    return json(503, { error: 'Demo mode: email sending is not connected. Copy the text and mark it sent, or try it on the live site.' });
  }
  return json(404, { error: 'No such endpoint.' });
}
