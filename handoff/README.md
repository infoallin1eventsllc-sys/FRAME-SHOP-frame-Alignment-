# Handoff material

## supabase-marketing-kit/

The first version of Paul's marketing system, built earlier: a separate stack on
**his own Supabase project** (CRM, orchestrator, runner, weekly report,
SendGrid/Twilio sending), plus `provisioning/` — the per-client config, tiers
and migration generator for standing the same system up for other clients.

**For The Frame Shop it is superseded** by the Marketing Desk built into the
website itself (`marketing.ts`, the portal's Marketing tab), which reads the
shop's bookings and messages directly and needs no second system. It is kept
here because:

- `provisioning/` is the starting point for offering the marketing stack to
  other clients (see its README), and
- if Paul later outgrows a single server, this is the heavier design to move to.

Note: the kit's own "mock mode" returns placeholder text when no AI key is set.
The in-site Marketing Desk deliberately does not — it says "not connected".
Carry that rule over before reusing this kit for anyone.
