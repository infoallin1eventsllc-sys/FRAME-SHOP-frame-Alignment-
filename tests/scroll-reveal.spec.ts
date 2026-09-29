import { test, expect } from '@playwright/test';

/**
 * Sections fade up as they scroll into view. The failure that matters is
 * content left invisible, so every test ends by checking nothing is.
 */

const faded = () =>
  [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity !== '1').length;

test('the hero shows at once; lower sections wait until scrolled to, then all appear', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#hero h1')).toHaveCSS('opacity', '1');

  const faq = page.locator('#faqs [data-reveal]').first();
  await expect(faq).not.toHaveClass(/is-revealed/);

  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(50);
  }
  await expect(faq).toHaveClass(/is-revealed/);
  await expect.poll(() => page.evaluate(faded)).toBe(0);
});

test('jumping from the menu to a section shows it', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.getElementById('contact')!.scrollIntoView());
  await expect(page.locator('#contact [data-reveal]').first()).toHaveCSS('opacity', '1');
});

test('visitors who turn off motion see everything without waiting', async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#faqs h2')).toHaveCSS('opacity', '1');
  expect(await page.evaluate(faded)).toBe(0);
  await page.close();
});
