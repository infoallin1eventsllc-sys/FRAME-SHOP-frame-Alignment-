#!/usr/bin/env node
/**
 * Turn a client config into the per-client migration.
 *
 *   node generate-migration.mjs frameshop            # print
 *   node generate-migration.mjs frameshop --write    # write into ../supabase/migrations/
 *
 * Why generate it rather than hand-write one per client: the profile, goals and
 * channel switches are the only things that differ between deployments, and
 * hand-writing them is where a channel gets enabled with no credentials behind
 * it. The tier decides what is on; this file just renders that decision as SQL.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const slug = process.argv[2];
const write = process.argv.includes("--write");

if (!slug) {
  console.error("usage: node generate-migration.mjs <client-slug> [--write]");
  process.exit(1);
}

const configPath = join(HERE, "clients", `${slug}.json`);
if (!existsSync(configPath)) {
  console.error(`No config at clients/${slug}.json`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const tiers = JSON.parse(readFileSync(join(HERE, "tiers.json"), "utf8"));
const tier = tiers[config.tier];

if (!tier) {
  console.error(`Unknown tier "${config.tier}". Known: ${Object.keys(tiers).filter(k => k[0] !== "_").join(", ")}`);
  process.exit(1);
}

// A tier that needs something not yet built must not silently produce a
// migration that looks deployable.
if (tier.requires?.length) {
  console.error(`Tier "${config.tier}" requires ${tier.requires.join(", ")}, which is not built yet.`);
  console.error(tier.notes ?? "");
  process.exit(1);
}

// Sending requires consent. Refuse to emit a migration that turns on email or
// sms for a client whose form does not ask — that is the failure this whole
// generator exists to prevent.
const sends = tier.channels.filter((c) => c === "email" || c === "sms");
if (sends.length && !config.consent?.form_asks) {
  console.error(`Tier "${config.tier}" enables ${sends.join(" and ")}, but clients/${slug}.json says the form does not ask for consent.`);
  console.error(`Add the checkbox and set consent.form_asks = true, or move this client to the "solo" tier.`);
  process.exit(1);
}

const q = (s) => `'${String(s ?? "").replace(/'/g, "''")}'`;
const b = config.business;

const servicesSql = (b.services ?? []).length
  ? `,\n  'services', jsonb_build_array(\n${b.services.map((s) => `    ${q(s)}`).join(",\n")}\n  )`
  : "";

const channelList = tier.channels.map(q).join(", ");

const sql = `-- ${b.name} — client profile.
--
-- Generated from clients/${slug}.json (tier: ${config.tier}).
-- Do not hand-edit: change the config and regenerate, or the next
-- regeneration will quietly undo the edit.
--
-- 0001 seeds a generic 'Your Business' profile so the stack can be redeployed
-- per client. This replaces it, and switches on only the channels this tier
-- actually has credentials for.

update public.settings
set value = jsonb_build_object(
  'name',     ${q(b.name)},
  'industry', ${q(b.industry)},
  'voice',    ${q(b.voice)},
  'timezone', ${q(b.timezone ?? "America/Chicago")},
  'website',  ${q(b.website ?? "")},
  'owner',    ${q(b.owner ?? "")},
  'location', ${q(b.location ?? "")}${servicesSql}
)
where key = 'business_profile';

update public.settings
set value = jsonb_build_object(
  'primary',                ${q(config.goals?.primary ?? "")},
  'weekly_content_target',  ${tier.weekly_content_target},
  'follow_up_within_hours', ${tier.follow_up_within_hours}
)
where key = 'goals';

update public.settings
set value = jsonb_set(value, '{autonomy}', ${q(`"${tier.autonomy}"`)}::jsonb)
where key = 'agent';

-- Channels for the ${tier.label.toLowerCase()} tier: ${tier.channels.join(", ")}.
-- Everything else stays off. Enabling a channel with no credentials has the
-- orchestrator plan sends the runner cannot perform, filling the queue with
-- work that only ever fails.
update public.channels set enabled = false
where key not in (${channelList});

update public.channels set enabled = true, status = 'live'
where key in (${channelList});
`;

if (write) {
  const out = join(HERE, "..", "supabase", "migrations", `0003_${slug}_profile.sql`);
  writeFileSync(out, sql);
  console.error(`wrote ${out}`);
} else {
  process.stdout.write(sql);
}
