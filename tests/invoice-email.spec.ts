import { test, expect, type APIRequestContext } from '@playwright/test';
import http from 'http';
import { renderInvoicePdf } from '../invoicePdf';
import { acceptInvoice } from '../invoice';
import { looksLikeEmail } from '../mailer';

/**
 * Invoices as PDFs: downloaded by Paul, or emailed to the customer.
 *
 * The email tests need the server started with
 *   RESEND_API_KEY=test INVOICE_FROM_EMAIL="The Frame Shop <invoices@example.com>"
 *   RESEND_API_URL=http://127.0.0.1:4599/emails
 * and RESEND_API_URL set here too. Port 4599 is a stand-in for Resend that
 * this file runs, so the real sending path is exercised without a real account.
 */

const STUB = process.env.RESEND_API_URL || '';
const SHOP = { name: 'The Frame Shop', address: '7531 Unit C Root Road, Spring, Texas 77389', phone: '(832) 628-5226', email: 'theframeshop13@gmail.com' };
const JOB = { invoiceNumber: 'INV-PDF', items: [{ description: 'Power Train Alignment', category: 'service', quantity: 1, rate: 380 }], shopSuppliesRatePct: 5, taxRatePct: 8.25, internalOwnerNotes: 'PRIVATE: cost me $90' };

/** The words drawn on a page, from an uncompressed PDF. */
function pdfText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  let out = '';
  for (const m of raw.matchAll(/\[(.*?)\]\s*TJ/g)) {
    for (const h of m[1].matchAll(/<([0-9a-fA-F]+)>/g)) out += Buffer.from(h[1], 'hex').toString('latin1');
    out += ' ';
  }
  return out;
}

async function bookingWithInvoice(request: APIRequestContext, email = 'pdf@example.com') {
  const { booking } = await (await request.post('/api/bookings', {
    data: { name: 'Pat Customer', phone: '8325550177', email, bikeYear: '2021', bikeMake: 'Indian', bikeModel: 'Chief' },
  })).json();
  await request.patch(`/api/bookings/${booking.id}`, { data: { invoice: JOB } });
  return booking;
}

test.describe('Invoice PDF', () => {
  test("is the customer's copy: every charge, what was paid, the balance — and none of Paul's notes", async () => {
    const inv = acceptInvoice(JOB, [{ orderId: 'manual-1', orderName: 'Cash', amount: 100, paidAt: '2026-09-28T10:00:00Z', method: 'cash' }]);
    inv.internalOwnerNotes = JOB.internalOwnerNotes;
    const pdf = await renderInvoicePdf(inv, SHOP, { name: 'Pat Customer', phone: '8325550177', email: 'pdf@example.com', ticketNumber: 'FS-1', bike: '2021 Indian Chief' }, { compress: false });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = pdfText(pdf);
    for (const s of ['INV-PDF', 'Power Train Alignment', '$380.00', 'Shop supplies (5%)', 'Sales tax (8.25%)', '$431.92', 'BALANCE DUE', '$331.92', 'theframeshop13@gmail.com', '(832) 628-5226', 'Pat Customer', '2021 Indian Chief']) {
      expect(text, s).toContain(s);
    }
    expect(text).not.toContain('PRIVATE');
    expect(text).toContain('-$100.00'); // the payment, with a minus the font can draw
  });

  test('text the PDF font cannot draw is replaced, not garbled', async () => {
    const inv = acceptInvoice({ ...JOB, items: [{ description: 'Öhlins fork rebuild 🔧', category: 'service', quantity: 1, rate: 10 }] }, []);
    const text = pdfText(await renderInvoicePdf(inv, SHOP, { name: 'Zoë', phone: '', email: '', ticketNumber: 'FS-3', bike: '' }, { compress: false }));
    expect(text).toContain('Öhlins fork rebuild ?');
    expect(text).toContain('Zoë');
  });

  test('a paid invoice says so instead of showing a balance', async () => {
    const inv = acceptInvoice(JOB, [{ orderId: 'manual-1', orderName: 'Cash', amount: 431.92, paidAt: '2026-09-28', method: 'cash' }]);
    const text = pdfText(await renderInvoicePdf(inv, SHOP, { name: 'A', phone: '', email: '', ticketNumber: 'FS-2', bike: '' }, { compress: false }));
    expect(text).toContain('PAID IN FULL');
    expect(text).not.toContain('BALANCE DUE');
  });

  test('downloads from the portal route once the invoice is saved', async ({ request }) => {
    const { booking } = await (await request.post('/api/bookings', {
      data: { name: 'No Invoice Yet', phone: '8325550166', email: 'x@example.com', bikeMake: 'Indian', bikeModel: 'Scout' },
    })).json();
    try {
      expect((await request.get(`/api/bookings/${booking.id}/invoice.pdf`)).status()).toBe(400);
      await request.patch(`/api/bookings/${booking.id}`, { data: { invoice: JOB } });
      const res = await request.get(`/api/bookings/${booking.id}/invoice.pdf`);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('application/pdf');
      expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
    } finally {
      await request.delete(`/api/bookings/${booking.id}`);
    }
  });
});

test.describe('Emailing the PDF', () => {
  test.skip(!STUB, 'RESEND_API_URL not set for this run');

  let server: http.Server;
  let received: any[] = [];
  let failNext = false;
  test.beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        if (failNext) {
          failNext = false;
          res.writeHead(500, { 'Content-Type': 'application/json' }).end('{"message":"stub failure"}');
          return;
        }
        received.push({ auth: req.headers.authorization, body: JSON.parse(body) });
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"id":"email_123"}');
      });
    });
    await new Promise<void>((r) => server.listen(Number(new URL(STUB).port), '127.0.0.1', () => r()));
  });
  test.afterAll(() => new Promise<void>((r) => server.close(() => r())));
  test.beforeEach(() => {
    received = [];
    failNext = false;
  });

  test('sends the PDF to the customer, with replies going to the shop Gmail, and records it', async ({ request }) => {
    const b = await bookingWithInvoice(request);
    try {
      const res = await request.post(`/api/bookings/${b.id}/invoice/email`);
      expect(res.status()).toBe(200);
      expect(received).toHaveLength(1);
      const mail = received[0].body;
      expect(received[0].auth).toBe('Bearer test');
      expect(mail.to).toEqual(['pdf@example.com']);
      expect(mail.reply_to).toBe('theframeshop13@gmail.com');
      expect(mail.subject).toContain('INV-PDF');
      expect(mail.text).toContain('Balance due: $431.92');
      expect(mail.text).not.toContain('PRIVATE');
      expect(Buffer.from(mail.attachments[0].content, 'base64').subarray(0, 5).toString()).toBe('%PDF-');

      const saved = (await (await request.get('/api/bookings')).json()).bookings.find((x: any) => x.id === b.id);
      expect(saved.invoiceEmails).toHaveLength(1);
      expect(saved.invoiceEmails[0]).toMatchObject({ to: 'pdf@example.com', balanceDue: 431.92, id: 'email_123' });
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('a failed send says so, and records nothing as sent', async ({ request }) => {
    const b = await bookingWithInvoice(request);
    try {
      failNext = true;
      const res = await request.post(`/api/bookings/${b.id}/invoice/email`);
      expect(res.status()).toBe(502);
      expect((await res.json()).error).toMatch(/did not send/);
      const saved = (await (await request.get('/api/bookings')).json()).bookings.find((x: any) => x.id === b.id);
      expect(saved.invoiceEmails ?? []).toHaveLength(0);
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });

  test('refuses an address that is not one', async ({ request }) => {
    const sneaky = 'someone@example.com, other@evil.test';
    // Stopped at the door: a booking can't be made with it...
    const res = await request.post('/api/bookings', {
      data: { name: 'Pat Customer', phone: '8325550177', email: sneaky, bikeYear: '2021', bikeMake: 'Indian', bikeModel: 'Chief' },
    });
    expect(res.status()).toBe(400);
    // ...and the sending check still refuses it, for bookings saved before
    // the door check existed.
    expect(looksLikeEmail(sneaky)).toBe(false);
    expect(looksLikeEmail('pat@example.com')).toBe(true);
    expect(received).toHaveLength(0);
  });

  test('from the portal: Email PDF sends it and says where it went', async ({ page, request }) => {
    const b = await bookingWithInvoice(request);
    try {
      await page.goto('/');
      await page.locator('footer button:has-text("Owner Login")').click();
      await page.getByPlaceholder('Enter PIN').fill('1234');
      await page.keyboard.press('Enter');
      page.on('dialog', (d) => d.accept());
      await page.locator('div.bg-zinc-950.border', { hasText: `Ticket #${b.ticketNumber}` }).first().getByRole('button', { name: /edit invoice/i }).click();
      await page.getByRole('button', { name: 'Email PDF' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'PDF invoice emailed to pdf@example.com' })).toBeVisible();
      await expect(page.getByTestId('invoice-email-status')).toContainText('Last emailed');
      expect(received).toHaveLength(1);
    } finally {
      await request.delete(`/api/bookings/${b.id}`);
    }
  });
});
