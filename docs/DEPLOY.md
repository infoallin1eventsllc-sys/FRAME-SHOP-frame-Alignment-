# Deploying The Frame Shop

For Otis, with Paul beside you. Every account below is **in the shop's name and
on the shop's card**. Keys are typed straight into the host's settings. Never
email or text them, and never put them in a shared document.

The site is one Node server (`npm run build`, then `npm start`) that stores its
records as files on a permanent disk. Any host that runs Node 20+ and offers a
persistent volume works. Railway is described here because `railway.json` is
already set up for it. Render works the same way (Web Service + Disk).

---

## 1. Before you start

Have these ready (from Paul's go-live steps, Part 1):

- [ ] The shop's domain, with access to its DNS settings
- [ ] Shopify: store domain, admin API token, and (after step 4) the webhook signing secret
- [ ] Resend: API key, and the domain verified in Resend
- [ ] Anthropic: API key, with a monthly spending limit set
- [ ] Google AI Studio: API key, with a budget cap in Google Cloud billing
- [ ] Supabase (optional, for uploading video files): project URL and a **newly created** service key

## 2. Create the service (Railway)

1. New project → **Deploy from GitHub repo** → this repository. Choose the branch
   that holds the finished site (after PR #2 is merged, `frameshop-website`).
2. Railway reads `railway.json`: it builds with `npm run build`, starts with
   `node dist/server.cjs`, and checks `/api/health`.
3. **Add a volume** to the service and mount it at **`/data`**. This is the
   permanent disk. Without it every deploy wipes all bookings.

## 3. Settings (Variables)

The server **refuses to start** if any of the first five are missing or unsafe,
and its log says which. That's deliberate.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/data` (the volume's mount path) |
| `APP_URL` | `https://` + the shop's domain, e.g. `https://theframeshop.com` |
| `SHOP_OWNER_PIN` | Paul's own PIN (not 1234) |
| `SHOP_API_SECRET` | 64 random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SHOPIFY_STORE_DOMAIN` | `yourstore.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | `shpat_…` |
| `SHOPIFY_WEBHOOK_SECRET` | from step 4 |
| `RESEND_API_KEY` | from Resend |
| `INVOICE_FROM_EMAIL` | e.g. `The Frame Shop <invoices@theframeshop.com>` (on the verified domain) |
| `ANTHROPIC_API_KEY` | from the Anthropic console |
| `GEMINI_API_KEY` | from Google AI Studio |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_VIDEO_BUCKET` | optional: video uploads |
| `ERROR_ALERT_WEBHOOK` | recommended: a Slack or Discord webhook, so errors reach you |

Every setting is explained in `.env.example`.

## 4. Domain and payments

1. In Railway, add the shop's domain to the service and create the DNS record it
   shows at the domain provider. Wait until the site opens over `https://`.
2. In Shopify admin → Settings → Notifications → Webhooks: create an
   **Order payment** webhook pointing at `https://<domain>/api/shopify/webhook`.
   Copy the signing secret into `SHOPIFY_WEBHOOK_SECRET` and redeploy.

## 5. Check it's live (15 minutes)

- [ ] `https://<domain>/api/health` shows `"status":"ok"` with `"storage":"ok"`
- [ ] The homepage shows photos, a video plays, and **Show map** loads the map
- [ ] `https://<domain>/robots.txt` names `https://<domain>/sitemap.xml`
- [ ] A made-up address (e.g. `/test-404`) shows "This page isn't here"
- [ ] Paste the homepage link into a text message: the preview shows the shop card image
- [ ] Owner Login accepts Paul's PIN; a wrong PIN is refused
- [ ] **Redeploy once, then check a test booking is still there.** This proves the volume works.
- [ ] Book a test job, then work through Paul's go-live steps, Parts 2–6

## 6. Before real customers

- Delete the test bookings, invoices and messages (Command Center), or stop
  the service, empty the volume, and start it again.
- Policy pages: when the lawyer has approved them, set `LEGAL_REVIEWED = true`
  and update `LAST_UPDATED` in `src/components/LegalPage.tsx`, then redeploy.

## Backups

Everything the shop records is in the volume (`/data`): `bookings.json`,
`messages.json`, `rates.json`, `marketing.json`, `media.json`, `videos.json`,
plus rolling copies in `/data/backups`. Take a copy regularly. On Railway,
enable volume backups; otherwise download the folder monthly.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000, data in ./data, owner PIN 1234
```
