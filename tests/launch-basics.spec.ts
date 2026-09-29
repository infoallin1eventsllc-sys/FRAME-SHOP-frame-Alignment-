import { test, expect } from '@playwright/test';

/**
 * The pre-launch basics: what search engines and link previews read, what a
 * wrong address shows, and the small things a first-time visitor looks for.
 */

test('robots.txt allows the site, keeps crawlers out of the API, and names the sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('text/plain');
  const body = await res.text();
  expect(body).toContain('Disallow: /api/');
  expect(body).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
});

test('sitemap.xml lists every page with a full address', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.headers()['content-type']).toContain('xml');
  const locs = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(locs.sort()).toEqual(['/', '/cookies', '/privacy', '/refunds', '/terms']);
});

test('link-preview tags use a full address and the 1200x630 share image', async ({ page, request }) => {
  await page.goto('/');
  const html = await page.content();
  expect(html).not.toContain('%SITE_URL%');
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).toMatch(/^https?:\/\/[^/]+\/$/);
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/^https?:\/\/[^/]+\/og-image\.png$/);
  const img = await request.get(new URL(image!).pathname);
  expect(img.headers()['content-type']).toContain('image/png');
  const bytes = await img.body();
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
  const schema = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(schema.url).toBe(canonical);
});

test('a wrong address shows a "not found" page with a way back, not the homepage', async ({ page }) => {
  await page.goto('/this-page-does-not-exist');
  await expect(page).toHaveTitle(/Page not found/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/isn't here/i);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Home');
  await expect(page.getByRole('link', { name: /Call or text/ })).toHaveAttribute('href', /^tel:/);
  await expect(page.locator('#hero')).toHaveCount(0);
});

test('policy pages carry breadcrumbs back to the home page', async ({ page }) => {
  await page.goto('/privacy');
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Privacy Policy');
});

test('the FAQ answers five questions', async ({ page }) => {
  await page.goto('/');
  await page.locator('#faqs').scrollIntoViewIfNeeded();
  await expect(page.locator('#faqs button[aria-expanded]')).toHaveCount(5);
});

test('the ticket tracker offers no sample ticket that does not exist', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /track ticket/i }).first().click();
  await expect(page.getByText(/Sample Test Tickets/i)).toHaveCount(0);
});
