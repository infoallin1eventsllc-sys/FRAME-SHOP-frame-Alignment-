/**
 * Command Center functional check. Run `npm run build` first.
 *
 *   node scripts/command-center-check.mjs
 *
 * Starts the PRODUCTION server (owner login on, a stand-in email service,
 * no Shopify / AI / video storage connected — as on a fresh install), then
 * works every Command Center feature through the browser the way Paul would,
 * and checks each result against the server's own records, not just the
 * screen. Prints PASS/FAIL per step; exits non-zero on any failure.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const PORT = 3500 + Math.floor(Math.random() * 400);
const MAIL_PORT = PORT + 1;
const BASE = `http://127.0.0.1:${PORT}`;
const PIN = '482193';
const SECRET = 'c'.repeat(64);
const EXEC = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const results = [];
const problems = [];
const pass = (step) => results.push(`PASS  ${step}`);
const fail = (step, why) => { results.push(`FAIL  ${step} — ${why}`); problems.push(step); };
async function step(name, fn) {
  try { await fn(); pass(name); } catch (e) { fail(name, String(e?.message || e).split('\n')[0].slice(0, 220)); }
}
const ok = (cond, why) => { if (!cond) throw new Error(why); };

// Stand-in email service
const mails = [];
const mailServer = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => { mails.push(JSON.parse(b || '{}')); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"id":"stub"}'); });
});
await new Promise((r) => mailServer.listen(MAIL_PORT, '127.0.0.1', r));

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-cc-'));
const server = spawn(process.execPath, ['dist/server.cjs'], {
  env: {
    ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATA_DIR: dataDir, TRUST_PROXY: '0',
    SHOP_API_SECRET: SECRET, SHOP_OWNER_PIN: PIN, APP_URL: 'https://cc-check.example', BOOKING_RATE_LIMIT: '1000',
    RESEND_API_KEY: 'test', INVOICE_FROM_EMAIL: 'The Frame Shop <invoices@example.com>', RESEND_API_URL: `http://127.0.0.1:${MAIL_PORT}/emails`,
    SECURITY_ALERT_EMAIL: 'paul@example.com',
    SHOPIFY_STORE_DOMAIN: '', SHOPIFY_ADMIN_TOKEN: '', ANTHROPIC_API_KEY: '', GEMINI_API_KEY: '', SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '',
  },
  stdio: ['ignore', 'ignore', 'pipe'], detached: true,
});
let serverErr = ''; server.stderr.on('data', (d) => (serverErr += d));
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }

const owner = { 'x-shop-secret': SECRET, 'content-type': 'application/json' };
const api = async (p, init = {}) => { const r = await fetch(BASE + p, { ...init, headers: { ...owner, ...(init.headers || {}) } }); return { status: r.status, body: await r.json().catch(() => null) }; };
const booking = async (id) => (await api('/api/bookings')).body.bookings.find((b) => b.id === id);

// A customer books, and sends a message — through the public routes, as on the live site.
const created = await (await fetch(`${BASE}/api/bookings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Casey Rider', phone: '8325550190', email: 'casey@example.com', bikeYear: '2019', bikeMake: 'Harley-Davidson', bikeModel: 'Street Glide', serviceId: 'powertrain-alignment', issueNotes: 'Wobble at 70' }) })).json();
const B = created.booking;
await fetch(`${BASE}/api/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Morgan Asker', reach: 'morgan@example.com', message: 'Do you work on Indians?' }) });

const browser = await chromium.launch({ executablePath: EXEC });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const jsErrors = []; const serverErrors = [];
page.on('pageerror', (e) => jsErrors.push(e.message));
// 503 is the server's deliberate "not connected yet" answer (card payments, AI);
// the screen explains it. Anything else 5xx is a real failure.
page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 500 && r.status() !== 503) serverErrors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
page.on('dialog', (d) => d.accept());
const tab = (re) => page.getByRole('button', { name: re }).first();
const card = () => page.locator('div.bg-zinc-950.border', { hasText: `Ticket #${B.ticketNumber}` }).first();

await page.goto(BASE + '/', { waitUntil: 'networkidle' });

await step('Login: wrong PIN is refused with a message', async () => {
  await page.locator('footer button:has-text("Owner Login")').click();
  await page.getByPlaceholder('Enter PIN').fill('000000'); await page.keyboard.press('Enter');
  await page.getByText(/Invalid PIN/).waitFor({ timeout: 5000 });
});
await step('Login: right PIN opens the Command Center and emails a new-login notice', async () => {
  await page.getByPlaceholder('Enter PIN').fill(PIN); await page.keyboard.press('Enter');
  await tab(/Work Orders/).waitFor({ timeout: 8000 });
  for (let i = 0; i < 20 && !mails.some((m) => /New login/.test(m.subject)); i++) await page.waitForTimeout(200);
  ok(mails.some((m) => /New login/.test(m.subject) && m.to?.[0] === 'paul@example.com'), 'no new-login email');
});

// ---- Work Orders --------------------------------------------------------
await step('Work Orders: the new booking is listed with its details', async () => {
  await card().waitFor({ timeout: 8000 });
  const t = await card().innerText();
  ok(/Casey Rider/.test(t) && /Street Glide/.test(t), 'details missing on card');
});
await step('Work Orders: search finds the job, and hides others', async () => {
  const search = page.getByPlaceholder('Search name, ticket #, model...');
  await search.fill('no-such-rider-xyz'); await page.waitForTimeout(300);
  ok((await card().count()) === 0, 'search did not filter');
  await search.fill('Casey'); await page.waitForTimeout(300);
  ok((await card().count()) === 1, 'search did not find the job');
  await search.fill('');
});
await step('Work Orders: Call Rider dials the customer', async () => {
  const href = await card().getByRole('link', { name: /Call Rider/i }).getAttribute('href');
  ok(href === 'tel:8325550190' || /^tel:\+?1?8325550190$/.test(href || ''), `href ${href}`);
});
await step('Work Orders: Confirm Lift → In Shop → Mark Completed are saved', async () => {
  for (const [label, status] of [['CONFIRM LIFT', 'confirmed'], ['IN SHOP', 'in_shop'], ['MARK COMPLETED', 'completed']]) {
    await card().locator('button', { hasText: new RegExp(`^\\W*${label}$`, 'i') }).click();
    for (let i = 0; i < 20 && (await booking(B.id)).status !== status; i++) await page.waitForTimeout(150);
    ok((await booking(B.id)).status === status, `status not ${status}`);
  }
});
await step('Work Orders: tech notes are saved and shown', async () => {
  await card().getByRole('button', { name: /Add Tech Notes|Edit Tech Notes/i }).click();
  await card().getByRole('textbox', { name: /tech notes/i }).fill('Motor mounts 3mm out of parallel; realigned.');
  await card().getByRole('button', { name: /Save Measurements/i }).click();
  for (let i = 0; i < 20 && !(await booking(B.id)).techNotes; i++) await page.waitForTimeout(150);
  ok((await booking(B.id)).techNotes === 'Motor mounts 3mm out of parallel; realigned.', 'notes not saved');
  for (let i = 0; i < 20 && !/3mm out of parallel/i.test(await card().innerText()); i++) await page.waitForTimeout(150);
  ok(/3mm out of parallel/i.test(await card().innerText()), 'notes not shown');
});

// ---- Invoice ------------------------------------------------------------
await step('Invoice: starts from the booked service at the shop price', async () => {
  await card().getByRole('button', { name: /create owner invoice/i }).click();
  ok((await page.getByLabel('Line 1 description').inputValue()) === 'Power Train Alignment', 'wrong first line');
});
await step('Invoice: add a line, save, and the server holds the right total', async () => {
  await page.getByRole('button', { name: /add custom item/i }).click();
  await page.getByLabel('Line 2 description').fill('Motor mount bolts');
  await page.getByLabel('Line 2 rate in dollars').fill('24.50');
  await page.getByRole('button', { name: /save invoice/i }).first().click();
  await page.waitForTimeout(800);
  const inv = (await booking(B.id)).invoice;
  ok(inv && inv.items.length === 2, 'invoice not saved');
  ok(Math.abs(inv.subtotal - (inv.items[0].amount + 24.5)) < 0.005, `subtotal ${inv.subtotal}`);
  ok(Math.abs(inv.totalAmount - (inv.subtotal + inv.shopSuppliesAmount + inv.taxAmount)) < 0.011, 'total does not add up');
});
await step('Invoice: a cash payment is recorded and lowers the balance', async () => {
  await page.getByLabel('Amount ($)').fill('50');
  await page.getByRole('button', { name: /record payment/i }).first().click();
  for (let i = 0; i < 20 && !((await booking(B.id)).invoice.payments || []).length; i++) await page.waitForTimeout(150);
  const inv = (await booking(B.id)).invoice;
  ok(inv.payments.length === 1 && inv.payments[0].amount === 50 && inv.amountPaid === 50, 'payment not on record');
  ok((await page.getByTestId('invoice-balance').innerText()).includes((inv.totalAmount - 50).toFixed(2)), 'balance on screen wrong');
});
await step('Invoice: a hand-entered payment can be removed', async () => {
  await page.getByRole('button', { name: /Remove Cash payment/i }).click();
  for (let i = 0; i < 20 && ((await booking(B.id)).invoice.payments || []).length; i++) await page.waitForTimeout(150);
  ok(((await booking(B.id)).invoice.payments || []).length === 0, 'payment still there');
});
await step('Invoice: Download PDF gives a real PDF', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('button', { name: /download pdf/i }).first().click()]);
  const f = path.join(dataDir, 'check.pdf'); await dl.saveAs(f);
  ok(fs.readFileSync(f).subarray(0, 5).toString() === '%PDF-', 'not a PDF');
});
await step('Invoice: Email PDF sends it to the customer with the PDF attached', async () => {
  const before = mails.length;
  await page.getByRole('button', { name: 'Email PDF' }).click();
  await page.getByRole('status').filter({ hasText: 'casey@example.com' }).waitFor({ timeout: 8000 });
  const m = mails.slice(before).find((x) => x.to?.includes('casey@example.com'));
  ok(m && m.attachments?.[0]?.filename?.endsWith('.pdf'), 'no email with PDF');
});
await step('Invoice: Email Pay Link explains card payments aren’t connected yet', async () => {
  await page.getByRole('button', { name: /Email Pay Link/i }).click();
  await page.getByText(/Shopify|not (set up|configured|connected)/i).first().waitFor({ timeout: 5000 });
});
await step('Invoice: Excel export downloads a workbook', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('button', { name: /Export to Excel/i }).click()]);
  ok(/\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
});
await step('Invoice: closes cleanly', async () => {
  await page.getByRole('button', { name: 'Close invoice' }).click();
  ok((await page.getByLabel('Line 1 description').count()) === 0, 'still open');
});
await step('Work Orders: Invoices Excel downloads every invoice', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), tab(/Invoices Excel/).click()]);
  ok(/MasterInvoices.*\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
});

// ---- Messages ----------------------------------------------------------
await step('Messages: the new message shows, with a count on the tab', async () => {
  ok(/\(1 new\)/i.test(await tab(/Customer Messages/).innerText()), 'no new count');
  await tab(/Customer Messages/).click();
  await page.getByText('Do you work on Indians?').waitFor({ timeout: 5000 });
});
await step('Messages: Mark as replied is saved', async () => {
  await page.getByRole('button', { name: /Mark as replied/i }).first().click();
  for (let i = 0; i < 20 && !(await api('/api/messages')).body.messages?.[0]?.handled; i++) await page.waitForTimeout(150);
  ok((await api('/api/messages')).body.messages[0].handled === true, 'not saved');
});
await step('Messages: Delete removes it', async () => {
  await page.getByRole('button', { name: /Delete message from Morgan Asker/i }).click();
  for (let i = 0; i < 20 && (await api('/api/messages')).body.messages?.length; i++) await page.waitForTimeout(150);
  ok((await api('/api/messages')).body.messages.length === 0, 'still there');
});

// ---- Marketing ---------------------------------------------------------
await step('Marketing: says the assistant is not connected (no key), and never invents drafts', async () => {
  await tab(/Marketing/).click();
  await page.getByTestId('marketing-status').waitFor({ timeout: 5000 });
  ok(/not connected/i.test(await page.getByTestId('marketing-status').innerText()), 'status wrong');
});
await step('Marketing: settings are saved', async () => {
  await page.getByRole('button', { name: /Settings/ }).last().click();
  await page.locator('#mk-review').fill('https://g.page/r/frameshop-test/review');
  await page.getByRole('button', { name: /Save settings/i }).click();
  for (let i = 0; i < 20 && (await api('/api/marketing')).body.settings.googleReviewUrl !== 'https://g.page/r/frameshop-test/review'; i++) await page.waitForTimeout(150);
  ok((await api('/api/marketing')).body.settings.googleReviewUrl === 'https://g.page/r/frameshop-test/review', 'not saved');
});

// ---- My Rates ----------------------------------------------------------
await step('My Rates: a new labor rate and sales tax are saved', async () => {
  await tab(/My Rates/).click();
  await page.locator('#rate-labor').fill('135');
  await page.locator('#rate-tax').fill('8.25');
  await page.getByRole('button', { name: /Save rates/i }).click();
  for (let i = 0; i < 20 && (await api('/api/rates')).body.laborRate !== 135; i++) await page.waitForTimeout(150);
  const r = (await api('/api/rates')).body;
  ok(r.laborRate === 135 && r.taxPct === 8.25 && r.confirmedAt, JSON.stringify({ l: r.laborRate, t: r.taxPct }));
});
await step('My Rates: Excel and Print work', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('button', { name: /^Excel$/ }).click()]);
  ok(/Rates.*\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const [pop] = await Promise.all([page.waitForEvent('popup', { timeout: 8000 }), page.getByRole('button', { name: /^Print$/ }).click()]);
  ok(/Rate Sheet/.test(await pop.title()), 'print page wrong'); await pop.close();
});

// ---- Owner Photo Control -----------------------------------------------
await step('Photos: an uploaded homepage photo is saved and shown on the homepage', async () => {
  await tab(/Owner Photo Control/).click();
  await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles('public/og-image.png');
  for (let i = 0; i < 40 && !(await api('/api/media')).body.heroImage; i++) await page.waitForTimeout(200);
  const hero = (await api('/api/media')).body.heroImage || '';
  ok(/^data:image\/(jpeg|png|webp);base64,/.test(hero), 'not saved');
  const home = await ctx.newPage(); await home.goto(BASE + '/', { waitUntil: 'networkidle' });
  ok(await home.locator('#hero img').evaluateAll((els, h) => els.some((e) => e.getAttribute('src') === h), hero), 'homepage not showing it');
  await home.close();
});
await step('Photos: a YouTube video is added, and can be removed', async () => {
  await page.getByRole('button', { name: /Already on YouTube/i }).click();
  await page.getByPlaceholder('Paste the YouTube link').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByPlaceholder(/Give it a name/).fill('Frame check');
  await page.getByRole('button', { name: /Put It On The Website/i }).click();
  for (let i = 0; i < 20 && !(await fetch(`${BASE}/api/videos`).then((r) => r.json())).length; i++) await page.waitForTimeout(150);
  ok((await fetch(`${BASE}/api/videos`).then((r) => r.json()))[0]?.title === 'Frame check', 'not added');
  await page.getByRole('button', { name: 'Remove Frame check' }).click();
  for (let i = 0; i < 20 && (await fetch(`${BASE}/api/videos`).then((r) => r.json())).length; i++) await page.waitForTimeout(150);
  ok((await fetch(`${BASE}/api/videos`).then((r) => r.json())).length === 0, 'not removed');
});
await step('Photos: file upload says video storage is not switched on yet (not a silent failure)', async () => {
  ok(/storage isn't switched on|use the YouTube option/i.test(await page.locator('body').innerText()), 'no explanation shown');
});

// ---- Security + Help ----------------------------------------------------
await step('Security: shows today’s logins and wrong PIN', async () => {
  await tab(/Security/).click();
  await page.getByTestId('security-panel').getByText('Logged in').first().waitFor({ timeout: 5000 });
  ok((await page.getByTestId('security-panel').getByText('Wrong PIN').count()) >= 1, 'wrong PIN not listed');
});
await step('Help: How Do I…? lists the guide and prints', async () => {
  await tab(/How Do I/).click();
  await page.getByText('Keeping Your Command Center Safe').first().waitFor({ timeout: 5000 });
  const [pop] = await Promise.all([page.waitForEvent('popup', { timeout: 8000 }), page.getByRole('button', { name: /print/i }).first().click()]);
  ok(/Running Your Website/.test(await pop.title()), 'print page wrong'); await pop.close();
});
await step('Security: Sign everyone out ends this login too, and the PIN screen returns', async () => {
  await tab(/Security/).click();
  await page.getByRole('button', { name: /Sign everyone out/i }).click();
  await tab(/Work Orders/).click().catch(() => {});
  await page.getByPlaceholder('Enter PIN').waitFor({ timeout: 8000 });
  await page.getByText(/timed out|PIN again/i).first().waitFor({ timeout: 3000 });
});

await step('No JavaScript errors and no server errors during the whole check', async () => {
  ok(!jsErrors.length, `JS: ${jsErrors.join(' | ')}`);
  ok(!serverErrors.length, `server: ${serverErrors.join(', ')}`);
});

await browser.close();
stop(); mailServer.close();
fs.rmSync(dataDir, { recursive: true, force: true });
console.log(results.join('\n'));
console.log(problems.length ? `\n${problems.length} problem(s).` : '\nEvery Command Center check passed.');
if (serverErr.trim()) console.log('\nServer stderr:\n' + serverErr.slice(0, 1500));
process.exit(problems.length ? 1 : 0);
