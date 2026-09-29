# Frame Shop marketing stack — setup

Paul's own instance of the Meridian marketing system: his Supabase project, his
keys, his billing, his customer data. Nothing routes through Meridian.

This is the same code that runs Meridian's own system, redeployed. The schema
was written to be reseeded per business, so only the profile and the booking
field mapping differ.

## What it does

```
booking form ──▶ intake ──▶ CRM (contacts, deals, activities)
    pg_cron ──▶ orchestrator ──▶ plans tasks ──▶ tasks queue
    pg_cron ──▶ runner ────────▶ executes ────▶ content_items (Paul approves)
                                             └▶ messages ──▶ SendGrid / Twilio
    pg_cron ──▶ report ────────▶ weekly summary for Paul
```

## What's here

```
supabase/migrations/   0001 schema · 0002 media library · 0003 Frame Shop profile
supabase/functions/    intake · orchestrator · runner · report · dashboard · _shared
website/marketing.ts   forwards a booking to intake — drop into the site
cli.mjs                operator CLI
.env.example
```

Only two files differ from Meridian's deployment: `0003_frameshop_profile.sql`
(new) and `intake/index.ts` (Frame Shop booking fields). The rest is verbatim.

## Standing it up

**Paul creates the project.** It is his account and his billing — do not create
it on a Meridian account and hand it over. Free tier is enough to start.

1. Paul signs in at supabase.com and creates a project. Region `us-west-2` or
   whichever is nearest Texas. He keeps the database password.
2. From the project's API settings, he copies the **project URL** and the
   **service_role key**. The service_role key bypasses row-level security —
   treat it like the keys to the shop.
3. Apply the migrations in order: `0001`, `0002`, `0003`.
4. Deploy the five edge functions. `intake` and `dashboard` are public
   (`verify_jwt = false`); `orchestrator`, `runner` and `report` require a JWT.
5. Set the function secrets in the Supabase dashboard under
   Edge Functions → Secrets:

   | Secret | Needed for | Notes |
   |---|---|---|
   | `WEBHOOK_SECRET` | intake | Any long random string. The site sends it as `x-webhook-secret`. |
   | `ANTHROPIC_API_KEY` | real drafts | Paul's own key. Without it the system runs in mock mode and still works. |
   | `SENDGRID_*` | sending email | Optional |
   | `TWILIO_*` | sending SMS | Optional |

6. Schedule the three cron jobs: runner every 2 minutes, orchestrator daily,
   report weekly.
7. In the site's host settings, add `MARKETING_INTAKE_URL` (the deployed intake
   URL) and `MARKETING_INTAKE_SECRET` (the same value as `WEBHOOK_SECRET`).
8. Copy `website/marketing.ts` into the site and call it from the booking route
   — the wiring is documented at the bottom of that file.

## It runs in mock mode without an Anthropic key

`_shared/claude.ts` catches any API error and falls back to placeholder text, so
an absent *or invalid* key never breaks the pipeline. The whole loop — intake,
planning, queueing, approval — works before Paul has a key; only the words are
placeholders. The dashboard shows "Demo mode" until real output exists.

That means the stack can be stood up and proven before Paul spends anything.

**The key goes in Supabase, not on anyone's laptop** — that is where the
functions run. If it still says mock after saving, the key is in the wrong
place. If it errors with `invalid x-api-key`, the value was truncated — re-copy
the whole `sk-ant-...`.

## The consent question — settle it before anything sends

Booking a repair is not consent to be marketed to. In the US, marketing email
falls under CAN-SPAM and marketing SMS under the TCPA, which requires express
written consent before an automated marketing text.

So:

- Every contact arrives with `consent_email` and `consent_sms` **false** until
  the booking form actually asks, with an unticked checkbox in its own words.
- `settings.agent.autonomy` is `draft`. Paul approves each message. Leave it
  there until the consent checkbox exists and he has read enough of the agent's
  output to trust it.
- "Your bike is ready" is transactional and needs no marketing consent. Keep it
  well away from anything promotional.

This is a decision for Paul, not a setting to flip.

## Checks before it is live

- [ ] Supabase project created on **Paul's** account
- [ ] Migrations 0001–0003 applied
- [ ] Five functions deployed
- [ ] `WEBHOOK_SECRET` set, and matching on the website
- [ ] A test booking appears as a contact, an activity and a deal
- [ ] A booking still succeeds with the CRM switched off (stop the function, book again)
- [ ] Cron jobs scheduled and a run visible in `agent_runs`
- [ ] Consent checkbox decided — added, or autonomy confirmed as `draft`

That sixth one is the one people skip. The CRM is bookkeeping; the booking is
the business. Prove the booking survives the CRM being down.
