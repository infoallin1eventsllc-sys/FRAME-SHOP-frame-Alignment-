import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Phone footage is usually filmed upright. In the old fixed widescreen frame
 * an upright clip shrank to a sliver between black bars.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));

test('an upright clip gets a tall frame; a widescreen clip keeps the widescreen one', async ({ page, request }) => {
  const before = await (await request.get('/api/videos')).json();
  for (const name of ['upright', 'wide']) {
    await page.route(`**/test-${name}.webm`, (route) =>
      route.fulfill({ status: 200, contentType: 'video/webm', body: fs.readFileSync(path.join(HERE, 'fixtures', `${name}.webm`)) })
    );
  }
  await request.put('/api/videos', {
    data: [
      { id: 'vid-upright', url: '/test-upright.webm', title: 'Upright clip' },
      { id: 'vid-wide', url: '/test-wide.webm', title: 'Wide clip' },
    ],
  });
  try {
    await page.goto('/');
    const frames = page.getByTestId('video-frame');
    await frames.first().scrollIntoViewIfNeeded();
    const upright = page.locator('article', { hasText: 'Upright clip' }).getByTestId('video-frame');
    const wide = page.locator('article', { hasText: 'Wide clip' }).getByTestId('video-frame');
    await expect.poll(async () => { const b = await upright.boundingBox(); return b ? b.height / b.width : 0; }).toBeGreaterThan(1);
    const w = (await wide.boundingBox())!;
    expect(w.height / w.width).toBeCloseTo(9 / 16, 1);
  } finally {
    await request.put('/api/videos', { data: before });
  }
});
