import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import { unzipSync, strFromU8 } from 'fflate';

/**
 * The Excel downloads, read back from the real .xlsx file the browser saves:
 * the sheets are there, and the figures on them are the job's figures.
 */

const JOB = { invoiceNumber: 'INV-XLSX', items: [{ description: 'Power Train Alignment', category: 'service', quantity: 1, rate: 380 }], shopSuppliesRatePct: 5, taxRatePct: 8.25 };

/** Every text and number in a workbook, plus its sheet names. */
function readWorkbook(path: string) {
  const files = unzipSync(new Uint8Array(fs.readFileSync(path)));
  const xml = (name: string) => (files[name] ? strFromU8(files[name]) : '');
  const sheets = [...xml('xl/workbook.xml').matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1]);
  const shared = [...xml('xl/sharedStrings.xml').matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]);
  const cells = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .flatMap((n) => [...xml(n).matchAll(/<c [^>]*?(t="(\w+)")?[^>]*>(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)/g)])
    .map((m) => (m[2] === 's' ? shared[Number(m[3])] : m[4] ?? m[3]));
  return { sheets, text: [...shared, ...cells].join('\n') };
}

async function openPortal(page: Page) {
  await page.goto('/');
  await page.locator('footer button:has-text("Owner Login")').click();
  await page.getByPlaceholder('Enter PIN').fill('1234');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /COMMAND CENTER/i })).toBeVisible({ timeout: 10000 });
}

test('"Invoices Excel" and a single invoice both download a real workbook with the job on it', async ({ page, request }) => {
  const { booking } = await (await request.post('/api/bookings', {
    data: { name: 'Sheet Customer', phone: '8325550188', email: 'sheet@example.com', bikeYear: '2019', bikeMake: 'Harley-Davidson', bikeModel: 'Street Glide' },
  })).json();
  await request.patch(`/api/bookings/${booking.id}`, { data: { invoice: JOB } });
  try {
    await openPortal(page);

    const [all] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Invoices Excel/i }).click()]);
    expect(all.suggestedFilename()).toMatch(/^TheFrameShop_MasterInvoices_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const book = readWorkbook(await all.path());
    expect(book.sheets).toEqual(['Invoices Summary', 'Itemized Charges']);
    for (const s of ['INV-XLSX', booking.ticketNumber, 'Sheet Customer', '2019 Harley-Davidson Street Glide', 'Power Train Alignment', '380', '431.92']) {
      expect(book.text, s).toContain(s);
    }

    const card = page.locator('div.bg-zinc-950.border', { hasText: `Ticket #${booking.ticketNumber}` }).first();
    const [one] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', { name: /^Excel$/ }).click()]);
    expect(one.suggestedFilename()).toBe(`INV-XLSX_${booking.ticketNumber}_TheFrameShop.xlsx`);
    const single = readWorkbook(await one.path());
    expect(single.sheets).toEqual(['Work Order Invoice']);
    for (const s of ['INV-XLSX', 'BALANCE DUE ($):', '431.92', 'sheet@example.com']) expect(single.text, s).toContain(s);
  } finally {
    await request.delete(`/api/bookings/${booking.id}`);
  }
});
