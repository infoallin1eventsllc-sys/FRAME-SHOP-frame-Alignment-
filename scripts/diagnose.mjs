/**
 * Whole-site diagnostic. Builds nothing — run `npm run build` first.
 *
 *   node scripts/diagnose.mjs [report-dir]
 *
 * Starts the PRODUCTION server (real security policy, owner login switched on)
 * on a throwaway data folder, seeds one booking with an invoice and one
 * message, then visits every page, pop-up and Command Center tab at phone and
 * desktop size. For each it records:
 *   - JavaScript errors and console errors
 *   - failed or error responses from this site
 *   - anything the security policy blocked
 *   - sideways scrolling (content wider than the screen)
 *   - accessibility problems (axe-core, WCAG 2.1 A/AA)
 *   - links to pages or #sections that don't exist
 * Requests to outside sites that fail are listed separately: in a sandbox
 * without internet they are expected, and are not bugs in the site.
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const OUT = path.resolve(process.argv[2] || 'diagnostic-report');
const PORT = 3400 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const PIN = '482193';
const SECRET = 'd'.repeat(64);
const EXEC = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

fs.mkdirSync(OUT, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-diag-'));
const server = spawn(process.execPath, ['dist/server.cjs'], {
  env: {
    ...process.env, NODE_ENV: 'production', PORT: String(PORT), DATA_DIR: dataDir,
    SHOP_API_SECRET: SECRET, SHOP_OWNER_PIN: PIN, APP_URL: 'https://diagnostic.example',
    BOOKING_RATE_LIMIT: '1000', TRUST_PROXY: '0',
  },
  stdio: ['ignore', 'ignore', 'pipe'],
  detached: true,
});
let serverErr = '';
server.stderr.on('data', (d) => (serverErr += d));
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* gone */ } };
process.on('exit', stop);

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start:\n${serverErr}`);
}

const findings = [];
const external = new Set();
const add = (where, kind, detail) => findings.push({ where, kind, detail });

async function seed() {
  const post = (p, body, headers = {}) => fetch(`${BASE}${p}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const { booking } = await (await post('/api/bookings', { name: 'Diag Rider', phone: '8325550111', email: 'diag@example.com', bikeYear: '2021', bikeMake: 'Harley-Davidson', bikeModel: 'Street Glide', issueNotes: 'wobble at 70' })).json();
  await fetch(`${BASE}/api/bookings/${booking.id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-shop-secret': SECRET },
    body: JSON.stringify({ techNotes: 'Motor mounts 3mm out; realigned.', invoice: { invoiceNumber: 'INV-DIAG', items: [{ description: 'Power Train Alignment', category: 'service', quantity: 1, rate: 380 }], shopSuppliesRatePct: 5, taxRatePct: 8.25 } }),
  });
  await post('/api/messages', { name: 'Diag Asker', reach: 'asker@example.com', message: 'Do you work on Indians?', idempotencyKey: 'diag-1' });
  return booking;
}

function watch(page, where) {
  const ctx = { where: () => where.current };
  page.on('pageerror', (e) => add(ctx.where(), 'javascript error', e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return; // reported by the response/requestfailed handlers with the URL
    add(ctx.where(), 'console error', t.slice(0, 300));
  });
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(BASE).origin) { external.add(u.host); return; }
    if (r.failure()?.errorText === 'net::ERR_ABORTED') return; // navigation away / cancelled media
    add(ctx.where(), 'request failed', `${r.method()} ${u.pathname} — ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(BASE).origin || r.status() < 400) return;
    if (u.pathname === '/this-page-does-not-exist' && r.status() === 404) return; // the 404 page itself
    add(ctx.where(), 'error response', `${r.status()} ${r.request().method()} ${u.pathname}${u.search}`);
  });
}

async function check(page, where, { axe = true } = {}) {
  const csp = await page.evaluate(() => (window.__csp || []).splice(0));
  for (const v of csp) add(where, 'blocked by security policy', v);
  const overflow = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= w + 1) return null;
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.right > w + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed'; })
      .slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`);
    return `page is ${document.documentElement.scrollWidth}px wide on a ${w}px screen: ${wide.join(', ')}`;
  });
  if (overflow) add(where, 'sideways scrolling', overflow);
  if (axe) {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    for (const v of r.violations) {
      add(where, `accessibility: ${v.id}`, `${v.impact} — ${v.help} (${v.nodes.length}×) e.g. ${v.nodes[0]?.target?.join(' ')} :: ${(v.nodes[0]?.failureSummary || '').replace(/\s+/g, ' ').slice(0, 220)}`);
    }
  }
}

async function checkLinks(page, where) {
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
  for (const href of new Set(links)) {
    if (!href || /^(mailto:|tel:|https?:\/\/(?!127\.0\.0\.1))/.test(href)) continue;
    const url = new URL(href, page.url());
    if (url.hash && url.pathname === new URL(page.url()).pathname) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (id && !(await page.evaluate((i) => !!document.getElementById(i), id))) add(where, 'broken link', `${href} — no section with that id`);
      continue;
    }
    const res = await fetch(`${BASE}${url.pathname}`);
    if (res.status >= 400) add(where, 'broken link', `${href} — ${res.status}`);
  }
}

async function run() {
  await waitUp();
  const booking = await seed();
  const browser = await chromium.launch({ executablePath: EXEC });

  for (const [size, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    const page = await context.newPage();
    const where = { current: '' };
    watch(page, where);
    page.on('dialog', (d) => d.accept());
    const at = (label) => (where.current = `${size} · ${label}`);

    // Standalone pages
    for (const p of ['/privacy', '/terms', '/refunds', '/cookies', '/this-page-does-not-exist']) {
      at(p);
      await page.goto(BASE + p, { waitUntil: 'networkidle' });
      await check(page, where.current);
      await checkLinks(page, where.current);
    }

    // Home page, scrolled end to end so every section is revealed
    at('home');
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= h; y += 500) { await page.evaluate((to) => window.scrollTo(0, to), y); await page.waitForTimeout(40); }
    await page.waitForTimeout(900);
    await check(page, where.current);
    await checkLinks(page, where.current);

    // Every in-page menu link lands on a section
    at('home · menu targets');
    const targets = await page.evaluate(() => [...document.querySelectorAll('section[id]')].map((s) => s.id));
    for (const id of ['services', 'why-us', 'our-work', 'calculator', 'diagnostic', 'about-paul', 'faqs', 'contact']) {
      if (!targets.includes(id)) add(where.current, 'missing section', `#${id} is linked from the menu but not on the page`);
    }

    // Booking pop-up: open, fill, submit
    at('booking form');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: /book/i }).first().click();
    await page.waitForTimeout(400);
    await check(page, where.current);
    const dlg = page.locator('form').filter({ has: page.getByRole('button', { name: /Confirm Booking Request/i }) });
    const fill = async (label, value) => { const f = dlg.getByLabel(label).first(); if (await f.count()) await f.fill(value); else add(where.current, 'missing field', label); };
    await fill(/name/i, 'Diag Customer');
    await fill(/phone/i, '8325550122');
    await fill(/email/i, 'diagcust@example.com');
    await fill(/year/i, '2019');
    await fill(/make/i, 'Indian');
    await fill(/model/i, 'Chief');
    const date = dlg.locator('input[type="date"]');
    if (await date.count()) await date.fill(new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10));
    await dlg.getByRole('button', { name: /Confirm Booking Request/i }).click();
    await page.waitForTimeout(1500);
    const confirmed = await page.getByText(/Thank you/i).count();
    if (!confirmed) add(where.current, 'booking did not complete', (await page.locator('[role="alert"], .text-red-500, .text-red-600').allInnerTexts()).join(' | ').slice(0, 300) || 'no confirmation and no error shown');
    await check(page, `${where.current} · confirmation`);
    await page.keyboard.press('Escape');
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // Ticket tracker
    at('ticket tracker');
    await page.getByRole('button', { name: /track/i }).first().click();
    await page.waitForTimeout(300);
    const box = page.getByRole('textbox').last();
    await box.fill(booking.ticketNumber);
    await box.press('Enter');
    await page.waitForTimeout(800);
    if (!(await page.getByText(/Street Glide/).count())) add(where.current, 'tracker did not find the seeded ticket', booking.ticketNumber);
    await check(page, where.current);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    // Contact form
    at('contact form');
    await page.locator('#contact').scrollIntoViewIfNeeded();
    const contact = page.locator('#contact form');
    await contact.getByLabel(/name/i).first().fill('Diag Visitor');
    await contact.getByLabel(/phone|email|contact/i).first().fill('visitor@example.com');
    await contact.getByLabel(/message|details/i).first().fill('Diagnostic check message.');
    await contact.getByRole('button', { name: /send/i }).click();
    await page.waitForTimeout(1200);
    if (!(await page.getByText(/Message Sent/i).count())) add(where.current, 'contact form did not confirm', 'no "Message Sent" shown');

    // Diagnostic questionnaire and calculator
    at('diagnostic questionnaire');
    await page.locator('#diagnostic').scrollIntoViewIfNeeded();
    for (let i = 0; i < 4; i++) {
      const opt = page.locator('#diagnostic button').filter({ hasText: /^[A-D]/ }).first();
      if (await opt.count()) { await opt.click(); await page.waitForTimeout(250); }
    }
    await check(page, where.current, { axe: false });
    at('calculator');
    await page.locator('#calculator').scrollIntoViewIfNeeded();
    const slider = page.locator('#calculator input[type="range"]').first();
    if (await slider.count()) await slider.fill('35');
    await check(page, where.current, { axe: false });

    // Command Center
    at('owner login');
    await page.locator('footer button:has-text("Owner Login")').click();
    await page.getByPlaceholder('Enter PIN').fill(PIN);
    await page.keyboard.press('Enter');
    try {
      // The heading also shows on the PIN screen; the tabs appear only once logged in.
      await page.getByRole('button', { name: /Work Orders/ }).waitFor({ timeout: 8000 });
    } catch { add(where.current, 'owner login failed', 'Command Center did not open with the right PIN'); }
    for (const tab of [/Work Orders/, /Customer Messages/, /Marketing/, /My Rates/, /Owner Photo Control/, /How Do I/]) {
      at(`Command Center · ${tab.source.replace(/\\/g, '')}`);
      const btn = page.getByRole('button', { name: tab }).first();
      if (!(await btn.count())) { add(where.current, 'missing tab', tab.source); continue; }
      await btn.click();
      await page.waitForTimeout(700);
      await check(page, where.current);
    }
    at('Command Center · invoice editor');
    await page.getByRole('button', { name: /Work Orders/ }).first().click();
    const edit = page.getByRole('button', { name: /edit invoice/i }).first();
    if (await edit.count()) { await edit.click(); await page.waitForTimeout(500); await check(page, where.current); }
    else add(where.current, 'missing control', 'no "Edit invoice" button for the seeded invoiced job');

    await context.close();
  }

  // Reduced motion: nothing hidden
  const rm = await browser.newPage({ reducedMotion: 'reduce' });
  await rm.goto(BASE + '/', { waitUntil: 'networkidle' });
  const hidden = await rm.evaluate(() => [...document.querySelectorAll('section *')].filter((e) => getComputedStyle(e).opacity === '0' && e.getBoundingClientRect().height > 0).length);
  if (hidden) add('reduced motion · home', 'hidden content', `${hidden} elements invisible`);

  await browser.close();
}

run()
  .catch((e) => add('diagnostic', 'crashed', e.stack || String(e)))
  .finally(() => {
    stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
    const byKind = {};
    for (const f of findings) (byKind[`${f.kind} :: ${f.detail}`] ??= []).push(f.where);
    const lines = Object.entries(byKind).map(([k, w]) => `- ${k}\n    on: ${[...new Set(w)].join('; ')}`);
    const report = `# Diagnostic report\n\n${findings.length ? `${Object.keys(byKind).length} distinct findings:\n\n${lines.join('\n')}` : 'No problems found.'}\n\nOutside sites unreachable from here (expected in a sandbox): ${[...external].join(', ') || 'none'}\n`;
    fs.writeFileSync(path.join(OUT, 'report.md'), report);
    fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));
    console.log(report);
    process.exit(0);
  });
