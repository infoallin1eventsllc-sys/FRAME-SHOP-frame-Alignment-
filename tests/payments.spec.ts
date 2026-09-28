import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import { applyPayment, type PayableInvoice } from '../shopify';

/**
 * Money. A job can be paid across more than one Shopify order — a deposit,
 * then the balance — and Shopify redelivers webhooks when it is unsure the
 * first delivery landed. Both used to be wrong in opposite directions.
 */

const invoice = (total: number): PayableInvoice => ({ totalAmount: total, paymentStatus: 'unpaid' });
const order = (id: number, total: string, name = `#${id}`) => ({ id, name, total_price: total });

test.describe('Recording payments', () => {
  test('a deposit then the balance settles the job', () => {
    // The original bug: each order was judged on its own, so the $400 balance
    // was "less than the $500 total" and the job stayed marked as owing.
    const inv = invoice(500);
    expect(applyPayment(inv, order(1, '100.00')).status).toBe('deposit_paid');
    const r = applyPayment(inv, order(2, '400.00'));
    expect(r.status).toBe('paid_in_full');
    expect(r.amountPaid).toBe(500);
  });

  test('a retried webhook does not count the same payment twice', () => {
    const inv = invoice(500);
    applyPayment(inv, order(1, '100.00'));
    const retry = applyPayment(inv, order(1, '100.00'));
    expect(retry.applied).toBe(false);
    expect(retry.amountPaid).toBe(100);
    expect(inv.payments).toHaveLength(1);

    // Four retries of a deposit must not add up to "paid in full".
    for (let i = 0; i < 4; i++) applyPayment(inv, order(1, '100.00'));
    expect(inv.paymentStatus).toBe('deposit_paid');
  });

  test('paying the whole amount in one order settles it', () => {
    expect(applyPayment(invoice(275.5), order(9, '275.50')).status).toBe('paid_in_full');
  });

  test('sums in cents, so many small payments cannot drift a penny short', () => {
    // 0.1 + 0.2 !== 0.3 in floating point; ten 10-cent payments must still
    // settle a $1.00 invoice rather than leaving it at $0.9999999.
    const inv = invoice(1);
    for (let i = 1; i <= 10; i++) applyPayment(inv, order(i, '0.10'));
    expect(inv.amountPaid).toBe(1);
    expect(inv.paymentStatus).toBe('paid_in_full');
  });

  test('an order with no id or no amount changes nothing', () => {
    const inv = invoice(500);
    expect(applyPayment(inv, { total_price: '100.00' }).applied).toBe(false);
    expect(applyPayment(inv, order(3, '0.00')).applied).toBe(false);
    expect(inv.paymentStatus).toBe('unpaid');
  });
});

/**
 * The same, through the real route: a signed orders/paid webhook against a real
 * booking. Needs SHOPIFY_WEBHOOK_SECRET set to the same value on the server and
 * here, since an unsigned webhook is — correctly — refused.
 */
test.describe('orders/paid webhook, end to end', () => {
  const SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  test.skip(!SECRET, 'SHOPIFY_WEBHOOK_SECRET not set for this run');

  const sign = (body: string) => crypto.createHmac('sha256', SECRET).update(body).digest('base64');
  const deliver = (request: import('@playwright/test').APIRequestContext, payload: object) => {
    const body = JSON.stringify(payload);
    return request.post('/api/shopify/webhook', {
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-Sha256': sign(body), 'X-Shopify-Topic': 'orders/paid' },
      data: body,
    });
  };

  test('deposit, balance and a retry land correctly on the booking', async ({ request }) => {
    const created = await request.post('/api/bookings', {
      data: { name: 'Ledger Test', phone: '8325550199', email: 'ledger@example.com', bikeMake: 'Harley-Davidson', bikeModel: 'Road Glide' },
    });
    expect(created.status()).toBe(201);
    const { booking: { id } } = await created.json();

    await request.patch(`/api/bookings/${id}`, {
      data: { invoice: { invoiceNumber: 'T-1', totalAmount: 500, paymentStatus: 'unpaid', items: [] } },
    });

    const readInvoice = async () =>
      (await (await request.get('/api/bookings')).json()).bookings.find((b: any) => b.id === id).invoice;
    const paidOrder = (oid: number, total: string) => ({ id: oid, name: `#${oid}`, total_price: total, note_attributes: [{ name: 'bookingId', value: id }] });

    try {
      expect((await deliver(request, paidOrder(7001, '100.00'))).status()).toBe(200);
      await expect.poll(async () => (await readInvoice()).paymentStatus).toBe('deposit_paid');

      await deliver(request, paidOrder(7001, '100.00')); // Shopify retry
      await deliver(request, paidOrder(7002, '400.00')); // the balance
      await expect.poll(async () => (await readInvoice()).paymentStatus).toBe('paid_in_full');

      const inv = await readInvoice();
      expect(inv.amountPaid).toBe(500);
      expect(inv.payments).toHaveLength(2);
    } finally {
      await request.delete(`/api/bookings/${id}`);
    }
  });

  test('an unsigned webhook is refused', async ({ request }) => {
    const res = await request.post('/api/shopify/webhook', {
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-Sha256': 'forged', 'X-Shopify-Topic': 'orders/paid' },
      data: '{"id":1}',
    });
    expect(res.status()).toBe(401);
  });
});
