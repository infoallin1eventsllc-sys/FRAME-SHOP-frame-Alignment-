import { test, expect, type APIRequestContext } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { askClaude, AiUnavailable, parseJsonReply } from '../ai';
import { digestDue } from '../marketing';

/**
 * The Marketing Desk. Needs the server started with
 *   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4598
 *   RESEND_API_KEY=test INVOICE_FROM_EMAIL=... RESEND_API_URL=http://127.0.0.1:4599/emails
 * and MARKETING_TESTS=1 here. This file runs stand-ins for Claude (4598) and
 * Resend (4599), so the whole chain is exercised without real accounts.
 */
const ON = !!process.env.MARKETING_TESTS;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '..', 'data', 'marketing.json');

test.describe('Assistant connection', () => {
  test('with no API key, it says so — it never invents placeholder drafts', async () => {
    // This test process has no ANTHROPIC_API_KEY.
    await expect(askClaude({ system: 's', prompt: 'p' })).rejects.toBeInstanceOf(AiUnavailable);
  });

  test('reads the JSON answer even when it is wrapped in prose or a code fence', () => {
    expect(parseJsonReply<{ a: number }>('Here you go:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseJsonReply<{ a: number }>('{"a": 2}')).toEqual({ a: 2 });
  });
});

test.describe('Morning email timing', () => {
  // 29 Sep 2026: 11:30 UTC is 6:30am in Spring, TX (CDT); 13:00 UTC is 8:00am.
  const early = new Date('2026-09-29T11:30:00Z');
  const morning = new Date('2026-09-29T13:00:00Z');
  const base = { enabled: true, emailOn: true, waiting: 3, at: morning };

  test('goes once a day, after 7am shop time, only when something is waiting', () => {
    expect(digestDue(base)).toBe(true);
    expect(digestDue({ ...base, at: early })).toBe(false);
    expect(digestDue({ ...base, lastDigest: '2026-09-29' })).toBe(false);
    expect(digestDue({ ...base, lastDigest: '2026-09-28' })).toBe(true);
    expect(digestDue({ ...base, waiting: 0 })).toBe(false);
    expect(digestDue({ ...base, enabled: false })).toBe(false);
    expect(digestDue({ ...base, emailOn: false })).toBe(false);
  });
});

test.describe('Marketing Desk', () => {
  test.skip(!ON, 'MARKETING_TESTS not set for this run');

  let ai: http.Server;
  let mail: http.Server;
  let aiCalls: any[] = [];
  let sent: any[] = [];
  let saved: string | null = null;

  const answer = (body: any) => {
    const sys: string = body.system || '';
    const prompt: string = body.messages?.[0]?.content || '';
    const json = (o: object) => ({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(o) + '\n```' }] });
    if (sys.includes('Plan social media posts')) {
      return json({ posts: [
        { channel: 'instagram', title: 'Road Glide wobble fixed', caption: 'This Road Glide came in wobbling at 70. [ask Paul: before/after numbers]', hashtags: ['frameshop', 'roadglide'], photoIdea: 'The bike on the jig', suggestedDate: '2026-10-05' },
        { channel: 'google', title: 'Power train alignment', caption: 'Power Train Alignment, listed at $380.', hashtags: [] },
        { channel: 'tiktok', title: 'Wobble fix in 20 seconds', caption: 'Wobble at 70? Not anymore.', hashtags: ['harleydavidson'], videoPlan: 'Hook: bike wobbling. Shots: jig, laser, fix, ride-off. 20s upright.' },
        { channel: 'myspace', title: 'Unknown channel', caption: 'x', videoPlan: 'should be dropped' },
      ] });
    }
    if (sys.includes('Draft replies to messages')) {
      const ids = [...prompt.matchAll(/\[(msg-[^\]]+)\]/g)].map((m) => m[1]);
      return json({ replies: ids.map((id) => ({ id, body: 'Hi {first_name}, bring it by and I will put it on the jig. — Paul' })) });
    }
    if (sys.includes('public reply to a customer review')) return json({ reply: 'Thanks {first_name}, glad it tracks straight now.' });
    if (sys.includes('Google review')) return json({ subject: 'How is the {bike} riding?', body: 'Hi {first_name}, if the {service} on your {bike} did the job, a review helps: {review_link} — Paul' });
    if (sys.includes('marketing email')) return json({ subject: 'Spring check-up', body: 'Hi {first_name}, riding season is here. Call to book.' });
    if (sys.includes('Research the local market')) {
      return { content: [
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'x' } },
        { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://example.com/rally', title: 'Spring rally' }] },
        { type: 'text', text: JSON.stringify({ summary: 'Rally season.', items: [{ headline: 'Rally on Saturday', detail: 'Found at example.com', suggestion: 'Post a pre-rally check.' }] }) },
      ] };
    }
    return json({});
  };

  test.beforeAll(async () => {
    saved = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf-8') : null;
    if (saved !== null) fs.rmSync(FILE);
    ai = http.createServer((req, res) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => {
        const body = JSON.parse(b);
        aiCalls.push({ headers: req.headers, body });
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(answer(body)));
      });
    });
    mail = http.createServer((req, res) => {
      let b = '';
      req.on('data', (c) => (b += c));
      req.on('end', () => {
        sent.push(JSON.parse(b));
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"id":"em_1"}');
      });
    });
    await new Promise<void>((r) => ai.listen(4598, '127.0.0.1', () => r()));
    await new Promise<void>((r) => mail.listen(4599, '127.0.0.1', () => r()));
  });
  test.afterAll(async () => {
    await new Promise<void>((r) => ai.close(() => r()));
    await new Promise<void>((r) => mail.close(() => r()));
    if (saved !== null) fs.writeFileSync(FILE, saved);
    else fs.rmSync(FILE, { force: true });
  });
  test.beforeEach(() => {
    aiCalls = [];
    sent = [];
  });

  const created: string[] = [];
  const createdMsgs: string[] = [];
  test.afterEach(async ({ request }) => {
    for (const id of created.splice(0)) await request.delete(`/api/bookings/${id}`);
    for (const id of createdMsgs.splice(0)) await request.delete(`/api/messages/${id}`);
  });

  async function booking(request: APIRequestContext, extra: object = {}) {
    const { booking } = await (await request.post('/api/bookings', {
      data: { name: 'Zelda Uniquename', phone: '8325550142', email: 'zelda@example.com', bikeYear: '2022', bikeMake: 'Harley-Davidson', bikeModel: 'Road Glide', serviceId: 'powertrain-alignment', serviceTitle: 'Power Train Alignment', ...extra },
    })).json();
    created.push(booking.id);
    return booking;
  }
  const desk = async (request: APIRequestContext) => (await request.get('/api/marketing')).json();

  test('posts are written from real completed jobs — and no customer details reach the AI', async ({ request }) => {
    const b = await booking(request);
    await request.patch(`/api/bookings/${b.id}`, { data: { status: 'completed', techNotes: 'Motor mount 11mm out. Customer said call 832-555-0142 or zelda@example.com.' } });

    const res = await request.post('/api/marketing/run/content');
    expect(res.status()).toBe(200);
    const call = aiCalls[0];
    expect(call.headers['x-api-key']).toBe('test');
    const sys: string = call.body.system;
    expect(sys).toContain('2022 Harley-Davidson Road Glide: Power Train Alignment');
    expect(sys).toContain('Motor mount 11mm out');
    expect(sys).toMatch(/Never invent customers, reviews/);
    const everything = JSON.stringify(call.body);
    for (const secret of ['Zelda', 'Uniquename', '8325550142', '832-555-0142', 'zelda@example.com']) expect(everything).not.toContain(secret);

    const drafts = (await res.json()).drafts;
    expect(drafts).toHaveLength(4);
    expect(drafts[0]).toMatchObject({ agent: 'content', channel: 'instagram', status: 'pending', suggestedDate: '2026-10-05' });
    expect(call.body.messages[0].content).toMatch(/TikTok/);
    expect(drafts[2]).toMatchObject({ channel: 'tiktok', videoPlan: 'Hook: bike wobbling. Shots: jig, laser, fix, ride-off. 20s upright.' });
    // An unknown platform falls back to Instagram, and a video plan only rides along on TikTok posts.
    expect(drafts[3].channel).toBe('instagram');
    expect(drafts[3].videoPlan).toBeUndefined();
  });

  test('inbox replies: drafted, approved, then emailed to the customer — named only at sending', async ({ request }) => {
    const m = await (await request.post('/api/messages', { data: { name: 'Pat Rider', reach: 'pat@example.com', message: 'My Street Glide wobbles at 70. Call me at 281-555-0100.' } })).json();
    createdMsgs.push(m.id);
    const { drafts } = await (await request.post('/api/marketing/run/reply')).json();
    const d = drafts.find((x: any) => x.target?.messageId === m.id);
    expect(d).toMatchObject({ channel: 'email', status: 'pending' });
    const toAi = JSON.stringify(aiCalls[0].body);
    expect(toAi).not.toContain('Pat Rider');
    expect(toAi).not.toContain('pat@example.com');
    expect(toAi).not.toContain('281-555-0100');
    expect(toAi).toContain('wobbles at 70');

    // Not before it is approved.
    expect((await request.post(`/api/marketing/drafts/${d.id}/send`)).status()).toBe(409);
    await request.patch(`/api/marketing/drafts/${d.id}`, { data: { status: 'approved' } });
    const res = await request.post(`/api/marketing/drafts/${d.id}/send`);
    expect(res.status()).toBe(200);
    expect(sent[0].to).toEqual(['pat@example.com']);
    expect(sent[0].text).toContain('Hi Pat,');
    expect(sent[0].reply_to).toBe('theframeshop13@gmail.com');
    const msgs = (await (await request.get('/api/messages')).json()).messages;
    expect(msgs.find((x: any) => x.id === m.id).handled).toBe(true);

    // Running again does not draft a second reply to the same message.
    await request.post('/api/marketing/run/reply');
    const all = (await desk(request)).drafts.filter((x: any) => x.agent === 'reply' && x.target?.messageId === m.id);
    expect(all).toHaveLength(1);
  });

  test('review requests: need the review link, go once per finished job, with the link filled in', async ({ request }) => {
    await request.put('/api/marketing/settings', { data: { brandVoice: '', googleReviewUrl: '', competitors: '', autopilot: false } });
    expect((await request.post('/api/marketing/run/review_request')).status()).toBe(400);
    expect((await request.put('/api/marketing/settings', { data: { googleReviewUrl: 'not a link' } })).status()).toBe(400);
    await request.put('/api/marketing/settings', { data: { googleReviewUrl: 'https://g.page/r/test/review' } });

    const b = await booking(request, { bikeMake: 'Indian', bikeModel: 'Chief', bikeYear: '2021' });
    await request.patch(`/api/bookings/${b.id}`, { data: { status: 'completed' } });
    const { drafts } = await (await request.post('/api/marketing/run/review_request')).json();
    const d = drafts.find((x: any) => x.target?.bookingId === b.id);
    expect(d.body).toContain('https://g.page/r/test/review');
    expect(d.subject).toContain('2021 Indian Chief');

    await request.patch(`/api/marketing/drafts/${d.id}`, { data: { status: 'approved' } });
    expect((await request.post(`/api/marketing/drafts/${d.id}/send`)).status()).toBe(200);
    expect(sent[0].to).toEqual(['zelda@example.com']);
    expect(sent[0].text).toContain('Hi Zelda');
    const again = (await (await request.post('/api/marketing/run/review_request')).json()).drafts;
    expect(again.find((x: any) => x.target?.bookingId === b.id)).toBeUndefined();
  });

  test('campaigns go only to customers who asked, each with a working unsubscribe link', async ({ request }) => {
    const yes = await booking(request, { email: 'yes@example.com', name: 'Yes Rider', marketingConsent: true, marketingConsentWording: 'offers' });
    await booking(request, { email: 'no@example.com', name: 'No Rider' });
    const { drafts } = await (await request.post('/api/marketing/run/campaign', { data: { goal: 'spring check-ups' } })).json();
    const d = drafts[0];
    await request.patch(`/api/marketing/drafts/${d.id}`, { data: { status: 'approved' } });
    const res = await request.post(`/api/marketing/drafts/${d.id}/send`);
    expect(res.status()).toBe(200);

    const to = sent.map((s) => s.to[0]);
    expect(to).toContain('yes@example.com');
    expect(to).not.toContain('no@example.com');
    const mine = sent.find((s) => s.to[0] === 'yes@example.com');
    expect(mine.text).toContain('Hi Yes,');
    expect(mine.text).toContain('7531 Unit C Root Road');
    const link = mine.text.match(/Unsubscribe: (\S+)/)[1];
    expect(mine.headers['List-Unsubscribe']).toBe(`<${link}>`);

    const path_ = new URL(link).pathname + new URL(link).search;
    expect((await request.get(path_.replace(/t=[0-9a-f]+/, 't=' + '0'.repeat(32)))).status()).toBe(400);
    const unsub = await request.get(path_);
    expect(unsub.status()).toBe(200);
    expect(await unsub.text()).toContain("You're unsubscribed");
    const after = (await (await request.get('/api/bookings')).json()).bookings.find((x: any) => x.id === yes.id);
    expect(after.marketingConsent).toBeUndefined();
  });

  test('market radar searches the web and keeps its sources; review replies use the reviewer\'s name', async ({ request }) => {
    const radar = (await (await request.post('/api/marketing/run/radar')).json()).drafts[0];
    expect(aiCalls[0].body.tools?.[0]?.name).toBe('web_search');
    expect(radar.sources).toEqual([{ url: 'https://example.com/rally', title: 'Spring rally' }]);
    expect(radar.body).toContain('Rally on Saturday');

    expect((await request.post('/api/marketing/run/review_reply', { data: {} })).status()).toBe(400);
    const rr = (await (await request.post('/api/marketing/run/review_reply', { data: { review: 'Great work on my Dyna', rating: 5, reviewer: 'Sam' } })).json()).drafts[0];
    expect(rr.body).toBe('Thanks Sam, glad it tracks straight now.');
    expect((await request.post(`/api/marketing/drafts/${rr.id}/done`, { data: { note: 'Posted' } })).status()).toBe(200);
  });

  test('results come from real records, and "how did you hear about us" is counted', async ({ request }) => {
    const before = (await desk(request)).results;
    await booking(request, { source: 'Instagram' });
    await booking(request, { source: 'TikTok' });
    await booking(request, { source: 'Made up channel' });
    const after = (await desk(request)).results;
    expect(after.bookings30).toBe(before.bookings30 + 3);
    const tt = (r: any) => r.sources90.find((s: any) => s.label === 'TikTok')?.n ?? 0;
    expect(tt(after)).toBe(tt(before) + 1);
    const ig = (r: any) => r.sources90.find((s: any) => s.label === 'Instagram')?.n ?? 0;
    expect(ig(after)).toBe(ig(before) + 1);
    expect(after.sources90.find((s: any) => s.label === 'Made up channel')).toBeUndefined();
  });

  test('Paul is told what is waiting: a count for the tab, and a morning email', async ({ request }) => {
    const before = (await (await request.get('/api/marketing/summary')).json()).toApprove;
    const { drafts } = await (await request.post('/api/marketing/run/content')).json();
    expect((await (await request.get('/api/marketing/summary')).json()).toApprove).toBe(before + drafts.length);

    expect((await request.put('/api/marketing/settings', { data: { digestTo: 'not an address' } })).status()).toBe(400);
    await request.put('/api/marketing/settings', { data: { digestEnabled: true, digestTo: '' } });
    const res = await request.post('/api/marketing/digest/test');
    expect(res.status()).toBe(200);
    const mail = sent.at(-1);
    expect(mail.to).toEqual(['theframeshop13@gmail.com']); // the shop's own address by default
    expect(mail.subject).toMatch(/marketing drafts? waiting for you/);
    expect(mail.text).toMatch(/Social posts \(\d+\)/);
    expect(mail.text).toContain('Road Glide wobble fixed');
    expect(mail.text).toContain('Owner Login');
    expect(mail.text).toContain('Nothing is posted or sent until you approve it.');

    await request.put('/api/marketing/settings', { data: { digestEnabled: true, digestTo: 'paul@example.com' } });
    await request.post('/api/marketing/digest/test');
    expect(sent.at(-1).to).toEqual(['paul@example.com']);
    const s = (await (await request.get('/api/marketing')).json()).settings;
    expect(s).toMatchObject({ digestEnabled: true, digestTo: 'paul@example.com' });
  });

  test('in the portal: run an assistant, edit, approve and mark posted', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer button:has-text("Owner Login")').click();
    await page.getByPlaceholder('Enter PIN').fill('1234');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /✨ Marketing/ }).click();
    await expect(page.getByTestId('marketing-status')).toContainText('Assistant: connected');
    await page.getByRole('button', { name: 'Run an assistant' }).click();
    await page.getByTestId('marketing-panel').locator('div', { hasText: 'Content planner' }).getByRole('button', { name: 'Run' }).first().click();
    await expect(page.getByRole('status')).toContainText('new draft');
    // The tab itself now says how many are waiting.
    await expect(page.getByRole('button', { name: /✨ Marketing \(\d+ to approve\)/ })).toBeVisible();
    await expect(page.getByTestId('draft').filter({ hasText: 'Wobble fix in 20 seconds' }).first().getByTestId('video-plan')).toContainText('Shots: jig, laser');
    const card = page.getByTestId('draft').filter({ hasText: 'Road Glide wobble fixed' }).first();
    await expect(card).toContainText('Fill in the [ask Paul');
    await card.getByRole('button', { name: 'Approve' }).click();
    await card.getByRole('button', { name: 'Mark posted' }).click();
    await page.getByRole('button', { name: /Sent & posted/ }).click();
    await expect(page.getByTestId('marketing-panel')).toContainText('Road Glide wobble fixed');
  });

  test('in the portal: preview a post on a phone screen with a clip from this device, before approving', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer button:has-text("Owner Login")').click();
    await page.getByPlaceholder('Enter PIN').fill('1234');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /✨ Marketing/ }).click();
    await page.getByRole('button', { name: 'Run an assistant' }).click();
    await page.getByTestId('marketing-panel').locator('div', { hasText: 'Content planner' }).getByRole('button', { name: 'Run' }).first().click();
    await expect(page.getByRole('status')).toContainText('new draft');

    // TikTok: a phone-shaped frame, the upright clip Paul picks, the caption over it.
    const tiktok = page.getByTestId('draft').filter({ hasText: 'Wobble fix in 20 seconds' }).first();
    await tiktok.getByRole('button', { name: 'Preview on phone' }).click();
    const preview = tiktok.getByTestId('post-preview');
    await expect(preview.getByRole('img', { name: 'tiktok preview' })).toContainText('Wobble at 70? Not anymore.');
    await expect(preview).toContainText('#harleydavidson');
    await preview.getByLabel('Choose a photo or video for this post').setInputFiles('tests/fixtures/upright.webm');
    await expect(preview.locator('video')).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => preview.locator('video').evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);

    // Editing the text shows in the preview straight away — before it is saved.
    await tiktok.getByLabel(/Text — edit freely/).fill('Wobble at 75? Fixed on the jig.');
    await expect(preview).toContainText('Wobble at 75? Fixed on the jig.');

    // Nothing was uploaded: the draft on the server has no media, only the words.
    const drafts = (await (await page.request.get('/api/marketing')).json()).drafts as any[];
    expect(JSON.stringify(drafts)).not.toContain('blob:');

    // Too long for Google: said here, not discovered at posting time.
    const google = page.getByTestId('draft').filter({ hasText: 'Power train alignment' }).first();
    await google.getByRole('button', { name: 'Preview on phone' }).click();
    await google.getByLabel(/Text — edit freely/).fill('x'.repeat(1501));
    await expect(google.getByTestId('preview-warning')).toContainText('Google allows 1,500');

    // Email drafts have no phone preview.
    await expect(page.getByTestId('draft').filter({ hasText: /email/i }).getByRole('button', { name: 'Preview on phone' })).toHaveCount(0);
  });
});
