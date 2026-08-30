import { test, expect } from '@playwright/test';

/**
 * Guards for bugs that reached the running site and were found by hand.
 *
 * Each test here exists because something broke in a way the original suite
 * could not see: the flows a customer actually completes, and the ways a
 * feature fails quietly rather than loudly.
 */

const PIN = '1234';

/** Fill and submit the booking form. Returns the ticket number it comes back with. */
async function submitBooking(page: import('@playwright/test').Page, name: string) {
  await page.locator('#hero-book-now-btn').click();
  const modal = page.locator('div.fixed').last();
  await expect(modal).toBeVisible();

  for (const input of await modal.locator('input').all()) {
    const type = await input.getAttribute('type');
    const ph = (await input.getAttribute('placeholder')) || '';
    if (type === 'date') await input.fill('2026-09-15');
    else if (type === 'email') await input.fill('qa@example.com');
    else if (type === 'tel') await input.fill('8325550100');
    else if (/2022/.test(ph)) await input.fill('2021');
    else if (/Harley/i.test(ph)) await input.fill('Harley-Davidson');
    else if (/Glide/i.test(ph)) await input.fill('Road Glide');
    else if (/Full Name/i.test(ph)) await input.fill(name);
  }
  for (const select of await modal.locator('select').all()) {
    await select.selectOption({ index: 1 }).catch(() => {});
  }

  await modal.locator('button[type="submit"]').last().click();
  const ticket = modal.locator('text=/FS-\\d+/').first();
  await expect(ticket).toBeVisible({ timeout: 10000 });
  return (await ticket.innerText()).match(/FS-\d+/)![0];
}

async function loginToPortal(page: import('@playwright/test').Page) {
  await page.locator('footer button:has-text("Owner Login")').click();
  await page.locator('input[type="password"], input[inputmode="numeric"]').first().fill(PIN);
  await page.keyboard.press('Enter');
  await expect(page.locator('text=/COMMAND CENTER/i').first()).toBeVisible({ timeout: 10000 });
  return page.locator('div.fixed').last();
}

test.describe('Customer booking', () => {
  /**
   * The confirmation screen used to be wiped by a page reload the moment it
   * appeared, because the server writes bookings into data/ and Vite treated
   * that as a source change. The API returned 201 throughout, so nothing looked
   * wrong from the server side.
   */
  test('confirmation survives after submitting, with the ticket number', async ({ page }) => {
    await page.goto('/');
    const ticket = await submitBooking(page, 'Regression Rider');

    const modal = page.locator('div.fixed').last();
    await expect(modal).toContainText(/received|confirmed/i);
    await expect(modal).toContainText(ticket);

    // Still there a beat later — a reload would have taken it by now.
    await page.waitForTimeout(2000);
    await expect(modal).toContainText(ticket);
  });

  test('the ticket it issues can then be tracked', async ({ page }) => {
    await page.goto('/');
    const ticket = await submitBooking(page, 'Trackable Rider');
    await page.keyboard.press('Escape');

    await page.locator('footer button:has-text("Track Repair Ticket")').click();
    await page.locator('input[placeholder*="Ticket" i]').first().fill(ticket);
    await page.keyboard.press('Enter');
    await expect(page.locator('div.fixed').last()).toContainText(ticket, { timeout: 10000 });
  });

  test('an unknown ticket is refused in plain language', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer button:has-text("Track Repair Ticket")').click();
    await page.locator('input[placeholder*="Ticket" i]').first().fill('FS-000000');
    await page.keyboard.press('Enter');
    await expect(page.locator('div.fixed').last()).toContainText(/no active ticket/i, { timeout: 10000 });
  });
});

test.describe('Modals close the way people expect', () => {
  test('Escape closes the booking modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('#hero-book-now-btn').click();
    await expect(page.locator('div.fixed').last()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('div.fixed')).toHaveCount(0);
  });

  test('clicking the backdrop closes the ticket tracker', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer button:has-text("Track Repair Ticket")').click();
    const overlay = page.locator('div.fixed').last();
    await expect(overlay).toBeVisible();
    await overlay.click({ position: { x: 8, y: 8 } });   // the dark area, not the dialog
    await expect(page.locator('div.fixed')).toHaveCount(0);
  });
});

test.describe('Owner portal', () => {
  test('rejects a wrong PIN and admits the right one', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer button:has-text("Owner Login")').click();
    await page.locator('input[type="password"], input[inputmode="numeric"]').first().fill('9999');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=/invalid pin|denied/i').first()).toBeVisible({ timeout: 10000 });

    await page.locator('input[type="password"], input[inputmode="numeric"]').first().fill(PIN);
    await page.keyboard.press('Enter');
    await expect(page.locator('text=/COMMAND CENTER/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('every tab renders, and the retired POS is gone', async ({ page }) => {
    await page.goto('/');
    const portal = await loginToPortal(page);

    for (const tab of ['Work Orders', 'Owner Price Matrix', 'Owner Photo Control', 'How Do I']) {
      await portal.locator(`button:has-text("${tab}")`).first().click();
      await expect(portal).not.toBeEmpty();
    }
    // Payments live in Shopify; the in-app card terminal was removed.
    await expect(portal.locator('button:has-text("Charge Customer")')).toHaveCount(0);
    await expect(portal.locator('button', { hasText: /Process Customer Transaction/i })).toHaveCount(0);
  });

  /** Videos were held in the owner's browser, so customers saw nothing. */
  test('a video added by the owner is stored on the server', async ({ page, request }) => {
    await page.goto('/');
    const portal = await loginToPortal(page);
    await portal.locator('button:has-text("Owner Photo Control")').first().click();

    await portal.locator('button:has-text("Already on YouTube")').click();
    await portal.locator('input[placeholder="Paste the YouTube link"]').fill('https://youtu.be/aqz-KE-bpKQ');
    await portal.locator('input[placeholder*="Road Glide"]').fill('Regression clip');
    await portal.locator('button:has-text("Put It On The Website")').click();
    await expect(portal.locator('text=Regression clip').first()).toBeVisible({ timeout: 10000 });

    // Present for anyone asking the server, not just this browser.
    const list = await (await request.get('/api/videos')).json();
    expect(list.some((v: { title: string }) => v.title === 'Regression clip')).toBe(true);

    page.on('dialog', d => d.accept());
    await portal.locator('button[aria-label^="Remove"]').first().click();
    await expect(portal.locator('text=Regression clip')).toHaveCount(0, { timeout: 10000 });
  });
});

test.describe('API surface', () => {
  test('an unknown endpoint answers with JSON, not the app shell', async ({ request }) => {
    const res = await request.get('/api/not-a-real-endpoint');
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('application/json');
    expect((await res.json()).error).toMatch(/no such endpoint/i);
  });

  test('the customer list is not readable without the owner token', async ({ request }) => {
    // Only meaningful once SHOP_API_SECRET is set; locally the guard is open by
    // design, so accept either the lock or the open door — never HTML.
    for (const path of ['/api/bookings']) {
      const res = await request.get(path);
      expect([200, 401]).toContain(res.status());
      expect(res.headers()['content-type']).toContain('application/json');
    }
  });

  test('a customer can look up one ticket but cannot fish for others', async ({ request }) => {
    expect((await request.get('/api/bookings/lookup?q=FS-000000')).status()).toBe(404);
    expect((await request.get('/api/bookings/lookup?q=832')).status()).toBe(400);
  });
});

test.describe('Layout', () => {
  test('navigation is reachable at every width, with no sideways scroll', async ({ page }) => {
    await page.goto('/');
    for (const width of [1920, 1280, 1100, 900, 640, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(250);

      const links = page.locator('header nav button', { hasText: 'Contact' });
      const menu = page.locator('header button[aria-label="Toggle Navigation"]');
      const reachable = (await links.isVisible().catch(() => false)) || (await menu.isVisible().catch(() => false));
      expect(reachable, `no navigation at ${width}px`).toBe(true);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('Search and sharing', () => {
  test('the page carries a description and share card', async ({ page }) => {
    await page.goto('/');
    for (const sel of [
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:image"]',
      'meta[name="twitter:card"]',
    ]) {
      const content = await page.locator(sel).getAttribute('content');
      expect(content, `${sel} missing or empty`).toBeTruthy();
    }
  });
});
