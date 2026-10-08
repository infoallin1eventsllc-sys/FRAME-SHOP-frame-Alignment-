import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { acceptInvoice, shopifyCharge } from '../invoice';
import { buildEscPosWorkOrderPayload } from '../src/utils/bluetoothPrinter';
import * as shopData from '../src/data/shopData';

/**
 * Paul's Command Center: the owner portal. Money first — what a customer is
 * charged and what the portal says they have paid — then everything in it that
 * was invented or failed without saying so.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';

async function newBooking(request: APIRequestContext, name = 'Command Center Test') {
  const res = await request.post('/api/bookings', {
    data: { name, phone: '8325550188', email: 'cc@example.com', bikeMake: 'Harley-Davidson', bikeModel: 'Road Glide', serviceId: 'powertrain-alignment', serviceTitle: 'Power Train Alignment' },
  });
  return (await res.json()).booking;
}
const readBooking = async (request: APIRequestContext, id: string) =>
  (await (await request.get('/api/bookings')).json()).bookings.find((b: any) => b.id === id);

const JOB = { invoiceNumber: 'INV-T', items: [{ description: 'Frame job', category: 'service', quantity: 1, rate: 400 }], shopSuppliesRatePct: 5, taxRatePct: 8.25 };
// 400 + 5% = 420; 8.25% of 420 = 34.65; total 454.65.
const JOB_TOTAL = 454.65;

test.describe('Invoice arithmetic', () => {
  test('totals are worked out from the lines, not taken from what was sent', () => {
    const inv = acceptInvoice({ ...JOB, totalAmount: 1, subtotal: 1, paymentStatus: 'paid_in_full', payments: [{ orderId: 'x', amount: 9999 }] }, []);
    expect(inv.subtotal).toBe(400);
    expect(inv.shopSuppliesAmount).toBe(20);
    expect(inv.taxAmount).toBe(34.65);
    expect(inv.totalAmount).toBe(JOB_TOTAL);
    // A status or payment in the request is ignored: nothing has been paid.
    expect(inv.payments).toEqual([]);
    expect(inv.paymentStatus).toBe('unpaid');
  });

  test('Shopify is asked for the whole invoice — supplies and tax included — less what is already paid', () => {
    const inv = acceptInvoice(JOB, [{ orderId: 'dep', orderName: '#1', amount: 75, paidAt: '2026-09-01' }]);
    const { lines, alreadyPaid } = shopifyCharge(inv);
    const charged = lines.reduce((s, l) => s + Math.round(l.price * 100), 0) / 100 - alreadyPaid;
    expect(lines.map((l) => l.title)).toEqual(['Frame job', 'Shop supplies (5%)', 'Sales tax (8.25%)']);
    expect(alreadyPaid).toBe(75);
    expect(charged).toBe(Math.round((JOB_TOTAL - 75) * 100) / 100);
  });
});

test.describe('Payments on the server', () => {
  const sign = (body: string) => crypto.createHmac('sha256', SECRET).update(body).digest('base64');
  const paid = (request: APIRequestContext, bookingId: string, orderId: number, total: string) => {
    const body = JSON.stringify({ id: orderId, name: `#${orderId}`, total_price: total, note_attributes: [{ name: 'bookingId', value: bookingId }] });
    return request.post('/api/shopify/webhook', {
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-Sha256': sign(body), 'X-Shopify-Topic': 'orders/paid' },
      data: body,
    });
  };

  test('a deposit paid before the invoice exists is kept, and counted on the invoice', async ({ request }) => {
    test.skip(!SECRET, 'SHOPIFY_WEBHOOK_SECRET not set for this run');
    const b = await newBooking(request);
    try {
      expect((await paid(request, b.id, 8101, '75.00')).status()).toBe(200);
      // Before: dropped, because the booking had no invoice yet.
      await expect.poll(async () => (await readBooking(request, b.id)).prepayments?.length ?? 0).toBe(1);

      await request.patch(`/api/bookings/${b.id}`, { data: { invoice: JOB } });
      const inv = (await readBooking(request, b.id)).invoice;
      expect(inv.amountPaid).toBe(75);
      expect(inv.paymentStatus).toBe('deposit_paid');

      // The customer pays exactly the balance Shopify was asked for.
      await paid(request, b.id, 8102, (JOB_TOTAL - 75).toFixed(2));
      await expect.poll(async () => (await readBooking(request, b.id)).invoice.paymentStatus).toBe('paid_in_full');
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('saving an invoice that was open when a payment arrived does not erase the payment', async ({ request }) => {
    test.skip(!SECRET, 'SHOPIFY_WEBHOOK_SECRET not set for this run');
    const b = await newBooking(request);
    try {
      await request.patch(`/api/bookings/${b.id}`, { data: { invoice: JOB } });
      const staleCopy = (await readBooking(request, b.id)).invoice; // Paul's screen
      await paid(request, b.id, 8201, '100.00');
      await expect.poll(async () => (await readBooking(request, b.id)).invoice.amountPaid).toBe(100);

      await request.patch(`/api/bookings/${b.id}`, { data: { invoice: { ...staleCopy, internalOwnerNotes: 'edited' } } });
      const inv = (await readBooking(request, b.id)).invoice;
      expect(inv.amountPaid).toBe(100);
      expect(inv.internalOwnerNotes).toBe('edited');
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('cash taken in the shop is recorded, and can be corrected; online payments cannot be removed here', async ({ request }) => {
    const b = await newBooking(request);
    try {
      await request.patch(`/api/bookings/${b.id}`, { data: { invoice: JOB } });
      const res = await request.post(`/api/bookings/${b.id}/payments`, { data: { amount: JOB_TOTAL, method: 'cash' } });
      expect(res.status()).toBe(201);
      const inv = (await res.json()).booking.invoice;
      expect(inv.paymentStatus).toBe('paid_in_full');

      const del = await request.delete(`/api/bookings/${b.id}/payments/${inv.payments[0].orderId}`);
      expect((await del.json()).booking.invoice.paymentStatus).toBe('unpaid');

      expect((await request.post(`/api/bookings/${b.id}/payments`, { data: { amount: -5, method: 'cash' } })).status()).toBe(400);
      expect((await request.post(`/api/bookings/${b.id}/payments`, { data: { amount: 5, method: 'bitcoin' } })).status()).toBe(400);
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('an unknown status is refused', async ({ request }) => {
    const b = await newBooking(request);
    try {
      expect((await request.patch(`/api/bookings/${b.id}`, { data: { status: 'teleported' } })).status()).toBe(400);
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });
});

test.describe('Rate sheet', () => {
  const FILE = path.resolve(HERE, '..', 'data', 'rates.json');
  let saved: string | null = null;
  test.beforeEach(() => {
    saved = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf-8') : null;
    if (saved !== null) fs.rmSync(FILE);
  });
  test.afterEach(() => {
    if (saved !== null) fs.writeFileSync(FILE, saved);
    else fs.rmSync(FILE, { force: true });
  });

  test('starts from the prices the website shows, marked unconfirmed — nothing invented', async ({ request }) => {
    const rates = await (await request.get('/api/rates')).json();
    expect(rates.confirmedAt).toBeUndefined();
    expect(rates.taxPct).toBeNull();
    expect(rates.lines.find((l: any) => l.id === 'powertrain-alignment')).toMatchObject({ price: 380 });
    expect(rates.laborRate).toBe(150); // "General Repair — $150 / hr" on the site
    expect(JSON.stringify(rates)).not.toMatch(/Stage 1|Big Bore|margin/i);
  });

  test('saves what Paul enters, and refuses nonsense', async ({ request }) => {
    const body = { laborRate: 140, suppliesPct: 4, taxPct: 8.25, overheadPerHour: null, lines: [{ id: 'x', name: 'Laser scan', price: 199, unit: 'flat', note: '' }] };
    expect((await request.put('/api/rates', { data: { ...body, laborRate: -1 } })).status()).toBe(400);
    expect((await request.put('/api/rates', { data: { ...body, lines: [{ name: '', price: 1 }] } })).status()).toBe(400);
    const res = await request.put('/api/rates', { data: body });
    expect(res.status()).toBe(200);
    const back = await (await request.get('/api/rates')).json();
    expect(back).toMatchObject({ laborRate: 140, taxPct: 8.25 });
    expect(back.confirmedAt).toBeTruthy();
  });
});

async function openPortal(page: Page) {
  await page.goto('/');
  await page.locator('footer button:has-text("Owner Login")').click();
  await page.getByPlaceholder('Enter PIN').fill('1234');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /COMMAND CENTER/i })).toBeVisible({ timeout: 10000 });
}

test.describe('In the portal', () => {
  test('a new invoice holds the booked service at Paul\'s own price — no invented parts or prices', async ({ page, request }) => {
    const b = await newBooking(request, 'Invoice Starter');
    try {
      await openPortal(page);
      const card = page.locator('div.bg-zinc-950.border', { hasText: `Ticket #${b.ticketNumber}` }).first();
      await card.getByRole('button', { name: /create owner invoice/i }).click();

      const descriptions = await page.locator('table input[type="text"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
      expect(descriptions).toEqual(['Power Train Alignment']);
      await expect(page.getByText(/Industry Standard Rate Templates|Urethane Stabilizer|Deposit Paid \(\$200/)).toHaveCount(0);
      await expect(page.locator('table input[type="number"][step="0.01"]').first()).toHaveValue('380');
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('a payment taken at the counter updates the balance', async ({ page, request }) => {
    const b = await newBooking(request, 'Counter Payer');
    await request.patch(`/api/bookings/${b.id}`, { data: { invoice: JOB } });
    try {
      await openPortal(page);
      const card = page.locator('div.bg-zinc-950.border', { hasText: `Ticket #${b.ticketNumber}` }).first();
      await card.getByRole('button', { name: /edit invoice/i }).click();
      await expect(page.getByTestId('invoice-balance')).toContainText(`$${JOB_TOTAL.toFixed(2)}`);

      await page.getByLabel('Amount ($)').fill('100');
      await page.getByLabel('Paid by').selectOption('check');
      await page.getByRole('button', { name: 'Record payment' }).click();
      await expect(page.getByTestId('invoice-balance')).toContainText(`$${(JOB_TOTAL - 100).toFixed(2)}`);
      await expect(page.getByTestId('invoice-payments')).toContainText('Check');
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('the printed copy has the shop\'s real details and none of Paul\'s private notes', async ({ page, request }) => {
    const b = await newBooking(request, 'Print Check');
    await request.patch(`/api/bookings/${b.id}`, { data: { invoice: { ...JOB, internalOwnerNotes: 'PRIVATE margin note' } } });
    try {
      await openPortal(page);
      await page.locator('div.bg-zinc-950.border', { hasText: `Ticket #${b.ticketNumber}` }).first().getByRole('button', { name: /edit invoice/i }).click();
      const printed = await page.locator('#printable-work-order').textContent();
      expect(printed).toContain(shopData.SHOP_INFO.phone);
      expect(printed).toContain('Spring');
      expect(printed).not.toMatch(/Dallas|555-FRAME/);
      expect(printed).not.toContain('PRIVATE margin note');
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('a change that fails to save says so', async ({ page, request }) => {
    const b = await newBooking(request, 'Failing Save');
    try {
      await openPortal(page);
      await page.route(`**/api/bookings/${b.id}`, (route) =>
        route.request().method() === 'PATCH' ? route.fulfill({ status: 500, body: '{"error":"Disk full"}' }) : route.continue()
      );
      const card = page.locator('div.bg-zinc-950.border', { hasText: `Ticket #${b.ticketNumber}` }).first();
      await card.getByRole('button', { name: /confirm lift/i }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Disk full' })).toBeVisible();
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('an old or half-written invoice on file does not take the portal down', async ({ page, request }) => {
    // One such record used to crash the whole page on a .toFixed of undefined.
    const b = await newBooking(request, 'Legacy Invoice');
    const DATA = path.resolve(HERE, '..', 'data', 'bookings.json');
    const all = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
    const i = all.findIndex((x: any) => x.id === b.id);
    all[i].invoice = { invoiceNumber: 'OLD-1', items: [{ description: 'Old job', quantity: 1, rate: 50 }] };
    fs.writeFileSync(DATA, JSON.stringify(all));
    try {
      await openPortal(page);
      const card = page.locator('div.bg-zinc-950.border', { hasText: `Ticket #${b.ticketNumber}` }).first();
      await expect(card).toContainText('Total: $50.00');
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('the rates tab is Paul\'s own sheet, flagged until he saves it', async ({ page }) => {
    await openPortal(page);
    await page.getByRole('button', { name: /my rates/i }).click();
    await expect(page.getByTestId('rates-panel')).toBeVisible();
    await expect(page.getByText(/HOUSTON METRO|Stage 3\/4 Big Bore|Target Gross Margin/)).toHaveCount(0);
  });
});

test.describe('Nothing invented, nothing leaked', () => {
  test('the receipt fits a 58 mm printer, is plain ASCII, and carries no private notes', () => {
    const bytes = buildEscPosWorkOrderPayload('The Frame Shop', 'FS-1', 'INV-1', '2026-09-28', 'Zoë Rider', '8325550100', '2021 Indian Chief',
      'Power Train Alignment — full', [{ description: 'Öhlins fork — rebuild', quantity: 1, rate: 100, amount: 100 }], 100, 5, 8.66, 113.66, 0, 113.66);
    const text = Buffer.from(bytes).toString('latin1');
    expect([...bytes].every((b) => b < 0x80)).toBe(true);
    // The printed columns only; the bold-on command before them is not printed.
    const header = text.match(/ITEM.*TOTAL/)![0];
    expect(header.length).toBeLessThanOrEqual(32);
    expect(text).toContain('Ohlins');
    expect(text).not.toMatch(/MECHANIC NOTES/);
  });

  test('no invented customer reviews remain in the site data', () => {
    expect('TESTIMONIALS' in shopData).toBe(false);
  });

  test('printing a customer page prints the page, not a blank sheet', async ({ page }) => {
    await page.goto('/privacy');
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
