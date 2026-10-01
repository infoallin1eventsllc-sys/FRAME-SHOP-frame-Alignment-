import { test, expect, type Page } from '@playwright/test';

/** Found by scripts/diagnose.mjs: every control in the invoice editor has a name a screen reader can read out. */

async function openPortal(page: Page) {
  await page.goto('/');
  await page.locator('footer button:has-text("Owner Login")').click();
  await page.getByPlaceholder('Enter PIN').fill('1234');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Work Orders/ })).toBeVisible({ timeout: 10000 });
}

test('invoice line items, remove, close and delete buttons are all labelled', async ({ page, request }) => {
  const { booking } = await (await request.post('/api/bookings', {
    data: { name: 'Label Check', phone: '8325550155', email: 'label@example.com', bikeYear: '2018', bikeMake: 'Indian', bikeModel: 'Scout' },
  })).json();
  try {
    await openPortal(page);
    const card = page.locator('div.bg-zinc-950.border', { hasText: `Ticket #${booking.ticketNumber}` }).first();
    await expect(card.getByRole('button', { name: `Delete ticket ${booking.ticketNumber}` })).toBeVisible();
    await card.getByRole('button', { name: /create owner invoice/i }).click();
    await expect(page.getByLabel('Line 1 category')).toBeVisible();
    await expect(page.getByLabel('Line 1 description')).toHaveValue('Power Train Alignment');
    await expect(page.getByLabel('Line 1 quantity or hours')).toBeVisible();
    await expect(page.getByLabel('Line 1 rate in dollars')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove line 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Close invoice' }).click();
    await expect(page.getByLabel('Line 1 category')).toHaveCount(0);
  } finally {
    await request.delete(`/api/bookings/${booking.id}`);
  }
});
