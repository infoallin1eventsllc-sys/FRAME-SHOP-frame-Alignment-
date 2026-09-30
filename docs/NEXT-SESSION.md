# The Frame Shop — where things stand

Last updated 29 September 2026. Start here next session.

## Where the work is

| What | Where |
|---|---|
| All code | branch `claude/frameshop-website-hardening` |
| Pull request | #2 → `frameshop-website` (open, not merged) |
| Clickable demo | https://claude.ai/artifact/6GNnNSJjNXPWXdLApS9NM6 — owner PIN **1234** (demo only) |
| Paul's instructions | in the portal: "How Do I…?" (`src/data/ownerGuide.ts`) |
| Paul's go-live steps | `docs/PAUL-GO-LIVE-STEPS.md` |
| How to deploy | `docs/DEPLOY.md` |
| Settings reference | `.env.example` |
| Earlier Supabase marketing kit + per-client provisioning | `handoff/` (see its README) |

## Running it

```bash
npm install
npm run dev                 # site + server on http://localhost:3000
npm run build               # production build (dist/)
npm run build:preview       # the single-file demo page -> preview.html
npm run diagnose            # whole-site check -> diagnostic-report/report.md
```

Tests run against a server you start yourself. For all 124 to run (none
skipped), start it with the stand-ins, then run the tests with the matching
variables:

```bash
BOOKING_RATE_LIMIT=1000 SHOPIFY_WEBHOOK_SECRET=test-webhook-secret-not-real \
RESEND_API_KEY=test INVOICE_FROM_EMAIL="The Frame Shop <invoices@example.com>" \
RESEND_API_URL=http://127.0.0.1:4599/emails \
ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4598 npm run dev

MARKETING_TESTS=1 SHOPIFY_WEBHOOK_SECRET=test-webhook-secret-not-real \
RESEND_API_URL=http://127.0.0.1:4599/emails npx playwright test
```

The tests start their own stand-ins for Resend (port 4599) and Claude (4598),
so nothing reaches a real account. The dev server's file watcher sometimes
misses a change — if a test sees old behaviour, restart the server.

## State at the end of 29 Sep

- 124 tests passing; production build and a production smoke test clean.
- Marketing tab shows a count of drafts waiting; Paul gets a morning email (after 7am shop time, only when something is waiting) once email is connected.
- `npm audit`: clean (0 vulnerabilities).
- Nothing is deployed. Nothing has been sent to a real customer, Shopify,
  Resend or Anthropic.

## Checked 29 Sep (design + system)

- Design pass: italic display type kept only for the hero and each section's
  headline; sub-headings upright; heavy card shadows and orange button glows
  removed; decorative "ALIGN" watermark and "Official shop emblem" chip removed.
- The header no longer claims "Shop Open Today" from the visitor's own clock and
  made-up hours; it states the real policy (Tue–Sat, by appointment).
- **Production security policy fixed**: it had been blocking every photo,
  YouTube/Vimeo video and the map on the live site (tests run on the dev server,
  where the policy is off, so they never saw it). Now allowed: Unsplash, YouTube,
  Vimeo, Google Maps, and the Supabase project in `SUPABASE_URL`. After deploy,
  open the live homepage and check photos, a video and the map all show.

- Launch basics: `robots.txt`, `sitemap.xml`, a real 404 page (404 status in
  production), breadcrumbs on inner pages, a 1200×630 share image
  (`public/og-image.png`), a fifth FAQ. The page's own address in the share
  tags / Google data is filled in per request from `APP_URL` (set it!) — it
  used to be hard-coded to localhost:3000.

- Security pass (from the "securitymaxxing" video): Track Ticket returns only a
  safe view (`src/utils/publicTicket.ts`) — no email, full phone, customer notes
  or private invoice notes. Owner login hands out 12-hour session keys, never
  SHOP_API_SECRET; 5 wrong PINs per visitor per 15 min, 30 in an hour pauses
  all logins for an hour. Production PIN must be 6+ digits. `tests/security.spec.ts`.

- Whole-site diagnostic (`npm run diagnose`, `scripts/diagnose.mjs`): production
  build, every page/pop-up/Command Center tab, phone + desktop — JS errors,
  failed requests, security-policy blocks, sideways scrolling, broken links,
  accessibility (axe, WCAG 2.1 AA). Last run: **no problems found**. It caught
  unlabelled invoice-editor fields and buttons, now fixed.

- Marketing drafts are checked for machine-sounding phrases ("delve",
  "moreover", "it's not X — it's Y", "I hope this helps", buzzwords…):
  `src/utils/aiTells.ts`, shown on the draft card; the assistants' rule 7 in
  `marketing.ts` tells them to avoid the same list.

- Security pass 2: owner login lives in `auth.ts`; photo/video addresses must
  be https (or data:image / site paths); public booking fields are bounded,
  the service comes from the shop's list, booking ids are random; public
  errors never include internal detail; malformed requests get 400.
- Demo: downloads (PDF, Excel, rate sheet) work inside the Claude preview via
  the `downloads` capability (`src/utils/saveFile.ts`); the demo draws its PDF
  in the browser (`src/demo/demoPdf.ts`, jsPDF). `vite.config.ts` swaps
  `src/demo/install` for `src/demo/off.ts` outside demo builds, so no demo
  code (or jsPDF) reaches the live bundle. Publish the preview with
  `capabilities: {downloads: true}`.

## Client documents (Claude Docs, private until shared; Meridian letterhead on each)

| Document | Link |
|---|---|
| **Demo & Trial Packet** (send this first) | https://claude.ai/artifact/CRyJnwaXmgUNDEWA9GSgMk |
| Handoff Plan | https://claude.ai/artifact/JNp2pLjDQxb45JEQKGpoKG |
| Your Photos & Videos | https://claude.ai/artifact/AEftk71bJd4NCbRWbFczuc |
| Paul's trial checklist | https://claude.ai/artifact/KkHAzyTNNwQt3yrtXJcDeA |

Every document sent to a client gets the Meridian Interface letterhead
(`docs/assets/meridian-letterhead.png`) and contact footer. Customer-facing
Frame Shop invoices keep The Frame Shop's own branding.

## Next up

1. ~~Replace `xlsx`~~ — done 29 Sep: now `write-excel-file`; `npm audit` is clean.
2. **Deploy** — follow `docs/DEPLOY.md`. The production server refuses to start
   without `DATA_DIR` (the volume), `APP_URL`, a real PIN and `SHOP_API_SECRET`.
3. **Connect the services, on accounts in the shop's name:**
   - `SHOP_API_SECRET` and a real `SHOP_OWNER_PIN` — **required**, owner routes are open without it
   - Anthropic (`ANTHROPIC_API_KEY`) for the Marketing Desk, with a monthly spend limit
   - Resend (`RESEND_API_KEY`, `INVOICE_FROM_EMAIL`) — needs a domain the shop owns
   - Shopify (store domain, admin token, webhook secret) for pay links and deposits
   - Supabase (new key — the old service key was exposed and must be rotated) for video uploads
   - Gemini key for the AI diagnostic, with a budget cap
4. After deploying: one real test of each — booking, message, invoice PDF email,
   pay link, a Marketing Desk run, an unsubscribe.

## Questions waiting on Paul

- Check **My Rates** and press Save. Confirm **sales tax** with his accountant
  (rate at the shop, and whether repair labour is taxable in Texas).
- Upload a real **photo of himself**; are the **case studies** real jobs? (stock photos)
- "EST. 1998" vs "30+ years", and "1,200+ frames" — which is true?
- Terms for the "guarantees"; fill the gaps in the draft **policy pages**; lawyer review.
- His **Google review link** (Marketing → Settings).
- Does the shop have its **own website domain**? (needed for sending email)
- A **reply-time promise** for the contact form ("Paul replies within …")? Only he can commit to one.
- **Visitor statistics**: does he want them? Google Analytics sets cookies, so it needs a consent banner and a privacy-policy change; a cookie-free counter (e.g. Plausible) does not.
- **Real reviews**: which Google reviews may the site quote, word for word? (The old invented testimonials were removed.)

## Things not to undo

- No placeholder or invented content anywhere — not in drafts, invoices, rates or reviews.
- Customer names/contact details never go to the AI (`marketing.ts` scrubs and uses `{first_name}`).
- Nothing in marketing is sent without Paul's approval; campaigns only to opted-in customers.
- Never deploy on Otis's own API keys; `data/` and `.env` never committed.
- `trust proxy` must never be `true`.
