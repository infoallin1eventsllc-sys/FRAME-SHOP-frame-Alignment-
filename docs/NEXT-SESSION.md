# The Frame Shop — where things stand

Last updated 29 September 2026. Start here next session.

## Where the work is

| What | Where |
|---|---|
| All code | branch `claude/frameshop-website-hardening` |
| Pull request | #2 → `frameshop-website` (open, not merged) |
| Clickable demo | https://claude.ai/artifact/6GNnNSJjNXPWXdLApS9NM6 — owner PIN **1234** (demo only) |
| Paul's instructions | in the portal: "How Do I…?" (`src/data/ownerGuide.ts`) |
| Settings reference | `.env.example` |
| Earlier Supabase marketing kit + per-client provisioning | `handoff/` (see its README) |

## Running it

```bash
npm install
npm run dev                 # site + server on http://localhost:3000
npm run build               # production build (dist/)
npm run build:preview       # the single-file demo page -> preview.html
```

Tests run against a server you start yourself. For all 99 to run (none
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

- 99 tests passing; production build and a production smoke test clean.
- `npm audit`: `qs` fixed. **`xlsx` still flagged (high)** — see below.
- Nothing is deployed. Nothing has been sent to a real customer, Shopify,
  Resend or Anthropic.

## Next up

1. **Replace `xlsx`.** The npm package is abandoned; SheetJS publishes fixed
   versions only at cdn.sheetjs.com, which this cloud environment's network
   blocks. From a normal machine:
   `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, then run
   the tests. Risk meanwhile is low: the site only *writes* spreadsheets; the
   flaws are in *reading* them.
2. **Deploy** somewhere with a persistent disk (Railway/Render with a volume),
   or move storage to a database first. Everything is JSON files under `data/`.
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

## Things not to undo

- No placeholder or invented content anywhere — not in drafts, invoices, rates or reviews.
- Customer names/contact details never go to the AI (`marketing.ts` scrubs and uses `{first_name}`).
- Nothing in marketing is sent without Paul's approval; campaigns only to opted-in customers.
- Never deploy on Otis's own API keys; `data/` and `.env` never committed.
- `trust proxy` must never be `true`.
