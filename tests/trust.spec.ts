import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { parseVideoUrl } from '../src/utils/videoEmbed';

/**
 * The legal and trust checklist: what a customer is told, what they agree to,
 * and whether the site does what it says.
 */

async function myMessages(request: APIRequestContext, marker: string) {
  const { messages } = await (await request.get('/api/messages')).json();
  return (messages as any[]).filter((m) => m.message.includes(marker));
}

async function fillContactForm(page: Page, marker: string) {
  await page.goto('/');
  await page.getByLabel('Your Name *').fill('Contact Tester');
  await page.getByLabel('Phone or Email *').fill('8325550144');
  await page.getByLabel('Message / Motorcycle Details *').fill(`2020 Road King, wobble at 70. ${marker}`);
}

test.describe('Contact form', () => {
  test('a message sent from the form is saved where the owner can read it', async ({ page, request }) => {
    // It used to show "Message Sent To The Shop!" and send nothing at all.
    const marker = `contact-${Date.now()}`;
    await fillContactForm(page, marker);
    await page.getByRole('button', { name: /send message to paul/i }).click();
    await expect(page.getByText(/message sent to the shop/i)).toBeVisible({ timeout: 10000 });

    const saved = await myMessages(request, marker);
    try {
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ name: 'Contact Tester', reach: '8325550144', handled: false });
    } finally {
      for (const m of saved) await request.delete(`/api/messages/${m.id}`);
    }
  });

  test('when the message cannot be saved, the customer is told and given the phone number', async ({ page }) => {
    await page.route('**/api/messages', (route) => route.fulfill({ status: 500, body: '{}' }));
    await fillContactForm(page, 'never-saved');
    await page.getByRole('button', { name: /send message to paul/i }).click();

    await expect(page.getByRole('alert')).toContainText(/did not reach the shop/i);
    await expect(page.getByRole('alert')).toContainText('(832) 628-5226');
    await expect(page.getByText(/message sent to the shop/i)).toHaveCount(0);
  });

  test('the owner sees new messages in the portal and can mark them replied', async ({ page, request }) => {
    const marker = `portal-${Date.now()}`;
    const created = await (await request.post('/api/messages', {
      data: { name: 'Portal Reader', reach: 'reader@example.com', message: `Need a quote. ${marker}` },
    })).json();

    try {
      await page.goto('/');
      await page.locator('footer button:has-text("Owner Login")').click();
      await page.locator('input[type="password"], input[inputmode="numeric"]').first().fill('1234');
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: /customer messages/i }).click();

      const panel = page.getByTestId('messages-panel');
      const card = panel.locator('li', { hasText: marker });
      await expect(card).toBeVisible({ timeout: 10000 });
      await expect(card.getByRole('link', { name: 'reader@example.com' })).toHaveAttribute('href', 'mailto:reader@example.com');

      await card.getByRole('button', { name: /mark as replied/i }).click();
      await expect(card.getByRole('button', { name: /mark as new/i })).toBeVisible();
      expect((await myMessages(request, marker))[0].handled).toBe(true);
    } finally {
      await request.delete(`/api/messages/${created.id}`);
    }
  });
});

test.describe('Messages API', () => {
  test('rejects an incomplete message', async ({ request }) => {
    const res = await request.post('/api/messages', { data: { name: 'Only A Name' } });
    expect(res.status()).toBe(400);
  });

  test('the same message sent twice is saved once', async ({ request }) => {
    const marker = `twice-${Date.now()}`;
    const body = { name: 'Twice', reach: '8325550133', message: marker, idempotencyKey: marker };
    await Promise.all([request.post('/api/messages', { data: body }), request.post('/api/messages', { data: body })]);
    const saved = await myMessages(request, marker);
    try {
      expect(saved).toHaveLength(1);
    } finally {
      for (const m of saved) await request.delete(`/api/messages/${m.id}`);
    }
  });

  test('changing or deleting a message that does not exist says so', async ({ request }) => {
    expect((await request.patch('/api/messages/msg-missing', { data: { handled: true } })).status()).toBe(404);
    expect((await request.delete('/api/messages/msg-missing')).status()).toBe(404);
  });
});

test.describe('Marketing consent', () => {
  const booking = (extra: object) => ({
    name: 'Consent Rider', phone: '8325550122', email: 'consent@example.com',
    bikeMake: 'Indian', bikeModel: 'Chief', ...extra,
  });

  test('the offers box starts unticked, and a booking made without ticking it records no consent', async ({ page, request }) => {
    await page.goto('/');
    await page.locator('#hero-book-now-btn').click();
    const box = page.getByLabel(/send me occasional offers/i);
    await expect(box).not.toBeChecked();

    const res = await request.post('/api/bookings', { data: booking({}) });
    const { booking: saved } = await res.json();
    try {
      expect(saved.marketingConsent).toBeUndefined();
    } finally {
      await request.delete(`/api/bookings/${saved.id}`);
    }
  });

  test('ticking it records the words agreed to and when', async ({ request }) => {
    const wording = 'Send me occasional offers.';
    const { booking: saved } = await (await request.post('/api/bookings', {
      data: booking({ marketingConsent: true, marketingConsentWording: wording }),
    })).json();
    try {
      expect(saved.marketingConsent).toMatchObject({ given: true, wording });
      expect(Date.parse(saved.marketingConsent.at)).not.toBeNaN();
    } finally {
      await request.delete(`/api/bookings/${saved.id}`);
    }
  });

  test('anything other than a plain yes is not consent', async ({ request }) => {
    for (const value of ['yes', 1, 'true']) {
      const { booking: saved } = await (await request.post('/api/bookings', { data: booking({ marketingConsent: value }) })).json();
      try {
        expect(saved.marketingConsent, `marketingConsent: ${JSON.stringify(value)}`).toBeUndefined();
      } finally {
        await request.delete(`/api/bookings/${saved.id}`);
      }
    }
  });
});

test.describe('Third parties load only when asked', () => {
  test('the Google map does not load until the visitor asks for it', async ({ page }) => {
    const google: string[] = [];
    page.on('request', (r) => { if (/google\.com\/maps/.test(r.url())) google.push(r.url()); });

    await page.goto('/');
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('map-placeholder')).toBeVisible();
    await page.waitForTimeout(500);
    expect(google, 'map requested before the visitor asked').toEqual([]);

    await page.getByRole('button', { name: 'Show map' }).click();
    await expect(page.locator('iframe[title*="Location Map"]')).toBeVisible();
  });

  test('Vimeo videos play with do-not-track on', () => {
    expect(parseVideoUrl('https://vimeo.com/76979871').embedUrl).toContain('dnt=1');
  });
});

test.describe('Accessibility', () => {
  test('the page can be zoomed', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
    expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/);
  });

  test('every field in the booking and contact forms has a label', async ({ page }) => {
    await page.goto('/');
    await page.locator('#hero-book-now-btn').click();
    const unlabeled = await page.evaluate(() =>
      [...document.querySelectorAll('input, select, textarea')]
        .filter((el) => (el as HTMLInputElement).type !== 'hidden')
        .filter((el) => !(el as HTMLInputElement).labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
        .map((el) => el.outerHTML.slice(0, 100))
    );
    expect(unlabeled).toEqual([]);
  });
});

test.describe('Policy pages', () => {
  for (const [path, title] of [
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Service'],
    ['/refunds', 'Deposits & Refunds'],
    ['/cookies', 'Cookies'],
  ]) {
    test(`${path} shows the ${title}, marked as a draft`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      // Unreviewed wording must not pass as final.
      await expect(page.getByTestId('legal-draft-banner')).toBeVisible();
    });
  }

  test('the shop email is on the contact section, the footer and the policies', async ({ page }) => {
    for (const where of ['/#contact', '/privacy']) {
      await page.goto(where);
      await expect(page.locator('a[href="mailto:theframeshop13@gmail.com"]').first()).toBeVisible();
    }
    await page.goto('/');
    await expect(page.locator('footer a[href="mailto:theframeshop13@gmail.com"]')).toBeVisible();
  });

  test('the footer links to every policy', async ({ page }) => {
    await page.goto('/');
    const policies = page.getByRole('navigation', { name: 'Policies' });
    for (const name of ['Privacy', 'Terms', 'Refunds', 'Cookies']) {
      await expect(policies.getByRole('link', { name })).toBeVisible();
    }
  });
});
