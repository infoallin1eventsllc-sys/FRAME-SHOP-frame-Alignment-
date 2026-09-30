import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * The three checks from "securitymaxxing your app":
 *   1. the server checks who is asking before it hands data back,
 *   2. what people type is treated as data, never as code or commands,
 *   3. the browser never holds the admin key.
 *
 * Owner-only routes are open on the everyday test server (it has no secret, so
 * other tests can work), so these start their own server with the protections
 * switched on.
 */

// A fresh port each run, so a server left over from an earlier run is never tested by mistake.
const PORT = 3300 + Math.floor(Math.random() * 600);
const SECRET = 'a'.repeat(64);
const PIN = '482193';
let server: ChildProcess;
let api: APIRequestContext;
let dataDir: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(90_000);
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-sec-'));
  server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    env: {
      ...process.env, PORT: String(PORT), DATA_DIR: dataDir, SHOP_API_SECRET: SECRET, SHOP_OWNER_PIN: PIN,
      PIN_RATE_LIMIT: '5', PIN_LOCKOUT_FAILURES: '12', BOOKING_RATE_LIMIT: '1000', TRUST_PROXY: '1',
    },
    stdio: 'ignore',
    detached: true, // its own process group, so afterAll stops the whole thing
  });
  api = await pwRequest.newContext({ baseURL: `http://127.0.0.1:${PORT}` });
  for (let i = 0; i < 120; i++) {
    try { if ((await api.get('/api/health')).ok()) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('security test server did not start');
});

test.afterAll(async () => {
  await api?.dispose();
  if (server?.pid) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** Each call looks like a different visitor, so the per-visitor limit is tested on its own. */
const as = (ip: string) => ({ 'X-Forwarded-For': ip });

test('1. Track Ticket shows the job and what is owed — never contact details or private notes', async () => {
  const { booking } = await (await api.post('/api/bookings', {
    data: { name: 'Dana Rider', phone: '(832) 555-0142', email: 'dana@example.com', bikeYear: '2020', bikeMake: 'Harley-Davidson', bikeModel: 'Road Glide', issueNotes: 'my gate code is 4417' },
  })).json();
  await api.patch(`/api/bookings/${booking.id}`, {
    headers: { 'x-shop-secret': SECRET },
    data: { invoice: { invoiceNumber: 'INV-SEC', items: [{ description: 'Power Train Alignment', category: 'service', quantity: 1, rate: 100 }], shopSuppliesRatePct: 5, taxRatePct: 8.25, internalOwnerNotes: 'PRIVATE: parts cost me $40' } },
  });

  for (const q of [booking.ticketNumber, '8325550142']) {
    const res = await api.get(`/api/bookings/lookup?q=${encodeURIComponent(q)}`);
    expect(res.ok()).toBe(true);
    const text = await res.text();
    for (const secret of ['dana@example.com', '555-0142', '8325550142', 'Rider', 'gate code', 'PRIVATE', 'payments', booking.id]) {
      expect(text, secret).not.toContain(secret);
    }
    const { booking: t } = JSON.parse(text);
    expect(t).toMatchObject({ ticketNumber: booking.ticketNumber, firstName: 'Dana', phoneLast4: '0142', bikeModel: 'Road Glide' });
    expect(t.invoice).toMatchObject({ shopSuppliesRatePct: 5, taxRatePct: 8.25, amountPaid: 0 });
    expect(t.invoice.balanceDue).toBe(t.invoice.totalAmount);
  }

  // The owner list stays behind the login.
  expect((await api.get('/api/bookings')).status()).toBe(401);
  expect((await api.get('/api/messages')).status()).toBe(401);
});

test('2. typed text is stored as text: markup and query tricks do nothing', async () => {
  const nasty = `<script>alert(1)</script>' OR '1'='1; DROP TABLE bookings;--`;
  const res = await api.post('/api/bookings', {
    data: { name: nasty, phone: '8325550199', email: 'x@example.com', bikeYear: '2020', bikeMake: 'Indian', bikeModel: nasty },
  });
  expect(res.ok()).toBe(true);
  const { booking } = await res.json();
  // Looking it up by a quote-laden "ticket" finds nothing, instead of everything.
  expect((await api.get(`/api/bookings/lookup?q=${encodeURIComponent("' OR '1'='1")}`)).status()).toBe(404);
  // The text comes back exactly as typed — as data.
  const t = (await (await api.get(`/api/bookings/lookup?q=${booking.ticketNumber}`)).json()).booking;
  expect(t.bikeModel).toBe(nasty);
  // And other customers' bookings are still there.
  const all = await (await api.get('/api/bookings', { headers: { 'x-shop-secret': SECRET } })).json();
  expect((all.bookings ?? all).length).toBeGreaterThanOrEqual(2);
});

test('3. a correct PIN gets an expiring session key — never the admin key itself', async () => {
  const res = await api.post('/api/auth/pin', { headers: as('10.0.0.1'), data: { pin: PIN } });
  expect(res.ok()).toBe(true);
  const { token } = await res.json();
  expect(token).toMatch(/^[0-9a-f]{64}$/);
  expect(token).not.toBe(SECRET);
  expect((await api.get('/api/bookings', { headers: { 'x-shop-secret': token } })).ok()).toBe(true);
  expect((await api.get('/api/bookings', { headers: { 'x-shop-secret': 'f'.repeat(64) } })).status()).toBe(401);
  // Two logins, two different keys.
  const again = (await (await api.post('/api/auth/pin', { headers: as('10.0.0.1'), data: { pin: PIN } })).json()).token;
  expect(again).not.toBe(token);
});

test('3. guessing the PIN is cut off: 5 tries per visitor, then a pause for everyone', async () => {
  for (let i = 0; i < 5; i++) {
    expect((await api.post('/api/auth/pin', { headers: as('10.0.1.1'), data: { pin: String(100000 + i) } })).status()).toBe(401);
  }
  const blocked = await api.post('/api/auth/pin', { headers: as('10.0.1.1'), data: { pin: PIN } });
  expect(blocked.status()).toBe(429);
  expect((await blocked.json()).error).toMatch(/Wait 15 minutes/);

  // Many addresses: after 12 failures in all (this server's setting), every login pauses — even the right PIN.
  for (let i = 0; i < 7; i++) {
    await api.post('/api/auth/pin', { headers: as(`10.0.2.${i}`), data: { pin: '000000' } });
  }
  const paused = await api.post('/api/auth/pin', { headers: as('10.0.3.1'), data: { pin: PIN } });
  expect(paused.status()).toBe(429);
  expect((await paused.json()).error).toMatch(/paused/);
});

test('4. only the owner can send large photo uploads, and only safe addresses are accepted', async () => {
  // A stranger's 5 MB body is refused at the door, not read first.
  const big = await api.put('/api/media', { data: { heroImage: 'data:image/png;base64,' + 'A'.repeat(5_000_000) } });
  expect(big.status()).toBe(401);

  const owner = { 'x-shop-secret': SECRET };
  for (const bad of ['javascript:alert(1)', 'http://insecure.example/x.jpg', 'data:text/html;base64,PHNjcmlwdD4=']) {
    expect((await api.put('/api/media', { headers: owner, data: { heroImage: bad } })).status(), bad).toBe(400);
  }
  expect((await api.put('/api/media', { headers: owner, data: { galleryPhotos: { 'proj-1': 'javascript:alert(1)' } } })).status()).toBe(400);
  expect((await api.put('/api/media', { headers: owner, data: { heroImage: 'https://images.example/bike.jpg', paulPhoto: 'data:image/jpeg;base64,/9j/4AAQ' } })).ok()).toBe(true);

  for (const bad of ['javascript:alert(1)', '//evil.example/x.mp4', 'http://insecure.example/x.mp4']) {
    expect((await api.put('/api/videos', { headers: owner, data: [{ id: 'v1', title: 'x', url: bad }] })).status(), bad).toBe(400);
  }
  expect((await api.put('/api/videos', { headers: owner, data: [{ id: 'v1', title: 'x', url: 'https://youtu.be/abc12345678' }] })).ok()).toBe(true);
  await api.put('/api/videos', { headers: owner, data: [] });
});

test('5. a public booking is bounded and uses the shop’s real services', async () => {
  const res = await api.post('/api/bookings', {
    data: { name: 'N'.repeat(5000), phone: '8325550177', email: 'ok@example.com', bikeYear: '2021', bikeMake: 'Indian', bikeModel: 'Chief', serviceId: 'no-such-service', serviceTitle: 'FREE WORK — $0' },
  });
  expect(res.status()).toBe(201);
  const { booking } = await res.json();
  expect(booking.id).toMatch(/^bk-[0-9a-f-]{36}$/);
  expect(booking.name.length).toBe(120);
  expect(booking.serviceTitle).toBe('Power Train Alignment');
  expect(JSON.stringify(booking)).not.toContain('FREE WORK');

  const badEmail = await api.post('/api/bookings', { data: { name: 'A', phone: '8325550178', email: 'not-an-email', bikeMake: 'Indian', bikeModel: 'Chief' } });
  expect(badEmail.status()).toBe(400);
  const notText = await api.post('/api/bookings', { data: { name: { $gt: '' }, phone: ['1'], bikeMake: 'x', bikeModel: 'y' } });
  expect(notText.status()).toBe(400);
});

test('6. broken requests get a plain "bad request", and public errors reveal nothing internal', async () => {
  const garbled = await api.post('/api/messages', { headers: { 'content-type': 'application/json' }, data: '{"name": "x", ' });
  expect(garbled.status()).toBe(400);
  expect(await garbled.text()).not.toMatch(/SyntaxError|at JSON|node_modules|\/home\//);

  const diag = await api.post('/api/diagnostic', { data: { symptomDescription: { nested: true } } });
  expect(diag.status()).toBe(400);
  const pay = await api.post('/api/shopify/checkout', { data: { bookingId: 'bk-nope' } });
  expect(await pay.text()).not.toMatch(/details|stack|Error:/);
});
