# Setting this up for each client

The short answer: **one shared codebase, one config file per client, one deploy
command.** Not a fork per client, and not one big system holding everyone's data.

## The architecture question, answered

Keep **one Supabase project per client**. Resist the pull toward a single
multi-tenant database with a `tenant_id` column.

| | Per-client projects | One multi-tenant system |
|---|---|---|
| Client owns their data and bills | Yes | No |
| One RLS mistake leaks another client's customers | Impossible | The main risk |
| Client can leave with their data | Hands over a project | A migration you have to write |
| Upgrading all clients | N deploys — automate it | One deploy |
| Your cost per client | Zero; they pay their own | Yours, growing |

The upgrade cost is the only real argument for multi-tenant, and it is a
scripting problem. The leak risk is not a scripting problem — it is the kind of
failure that ends an agency. For a business whose pitch is "you own your data
and your bills", the isolated model *is* the product.

Revisit this only if you ever have dozens of very small clients where the
per-project overhead dominates. You are nowhere near that.

## What makes it easy

```
clients/<slug>.json ──▶ generate-migration.mjs ──▶ 0003_<slug>_profile.sql
                    └─▶ provision.mjs ──────────▶ create project · migrate ·
                                                   deploy 5 functions · secrets · cron
```

A new client is a JSON file and a command. Everything that differs between
deployments — the business profile, the voice, the goals, which channels are on
— lives in that file. The code does not change.

### Tiers, not forks

"Bigger client" means more capability switched on, never different code.

| Tier | Fits | Channels on | Follow-up within |
|---|---|---|---|
| `solo` | One person, no staff | content | 24h |
| `staffed` | Owner plus a few people | content, email, sms | 8h |
| `multi_location` | Several sites or teams | content, email, sms | 4h |

`tiers.json` holds these. Moving a client up a tier is a one-word config change
and a regenerated migration.

### The generator refuses to do unsafe things

This is the point of generating rather than hand-writing:

- **A sending tier with no consent is refused.** `staffed` turns on email and
  SMS. If the client's form does not ask for marketing consent, it exits with an
  error rather than emitting a migration. Marketing email falls under CAN-SPAM
  and marketing SMS under the TCPA.
- **A tier that needs unbuilt capability is refused.** `multi_location` needs
  lead routing, which does not exist. It errors instead of producing a migration
  that looks deployable.
- **A channel is never enabled without credentials.** Only the channels the tier
  declares are switched on; the rest are explicitly switched off. Enabling one
  with nothing behind it has the orchestrator plan sends the runner cannot
  perform, filling the queue with work that only ever fails.

## What is built, and what is not

**Built and tested here:** the config schema, the tier definitions, the
migration generator and its three guards. Verified by generating The Frame
Shop's migration and diffing it against the hand-written one — identical.

**Not built:** `provision.mjs`. Creating the project, applying migrations,
deploying the functions, setting secrets and scheduling cron is a Supabase
Management API script. It is the next thing to write, and it cannot be tested
from this sandbox because outbound `*.supabase.co` is blocked.

Until it exists, `SETUP.md` in the Frame Shop kit is the same steps done by
hand — about twenty minutes per client.

**Keeping N clients current:** add a `schema_version` to `settings` and a
`deploy --all` that re-applies migrations and redeploys functions across every
client project, skipping any already current. Write this before the third
client, not after the tenth.

## Answering phones and email — the honest position

Today the agent has five task types: `follow_up_lead`, `generate_content`,
`publish_content`, `send_email`, `send_sms`, over SendGrid and Twilio SMS.

**Answering inbound email is close.** SendGrid Inbound Parse posts a received
email to a webhook; point it at `intake`, add a `reply_email` task type, and the
existing draft-and-approve loop handles it. Roughly a day's work, and it reuses
everything.

**Answering the phone is a different animal.** The current system is a batch
pipeline: cron wakes a function, it drains a queue, nobody is waiting. A phone
call is realtime and latency-bound — a caller will not wait two minutes for the
runner's next tick. It needs a Twilio Voice webhook, a realtime model session,
barge-in handling, and a path to a human when it cannot answer. Build it as its
own edge function and its own channel, not inside `runner`.

It is a real project, not a config flag. Worth quoting separately, and worth
being clear with clients that "the agent answers the phone" is a bigger promise
than "the agent drafts your follow-ups."

## Adding a client

1. Copy `clients/_template.json` to `clients/<slug>.json` and fill it in. The
   `voice` field matters most — it is what the agent imitates, so write how the
   business actually talks, not how a brochure talks.
2. Pick a tier.
3. `node generate-migration.mjs <slug> --write`
4. Follow `SETUP.md` (or `provision.mjs`, once it exists).
5. Wire the client's site to `intake` with `website/marketing.ts`.
