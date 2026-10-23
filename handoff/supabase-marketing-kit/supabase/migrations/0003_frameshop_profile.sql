-- The Frame Shop — client profile.
--
-- Generated from clients/frameshop.json (tier: solo).
-- Do not hand-edit: change the config and regenerate, or the next
-- regeneration will quietly undo the edit.
--
-- 0001 seeds a generic 'Your Business' profile so the stack can be redeployed
-- per client. This replaces it, and switches on only the channels this tier
-- actually has credentials for.

update public.settings
set value = jsonb_build_object(
  'name',     'The Frame Shop',
  'industry', 'motorcycle frame and alignment',
  'voice',    'plain, direct, shop-floor — no marketing gloss. Paul talks like a mechanic, not a brochure.',
  'timezone', 'America/Chicago',
  'website',  '',
  'owner',    'Paul Hurey',
  'location', 'Spring, Texas',
  'services', jsonb_build_array(
    'Frame straightening',
    'Power train alignment',
    'Suspension tuning',
    'Tire changes and dynamic balance',
    'Brake inspections',
    'Custom parts and fabrication'
  )
)
where key = 'business_profile';

update public.settings
set value = jsonb_build_object(
  'primary',                'Fill the bench — turn inspection bookings into paid alignment work',
  'weekly_content_target',  2,
  'follow_up_within_hours', 24
)
where key = 'goals';

update public.settings
set value = jsonb_set(value, '{autonomy}', '"draft"'::jsonb)
where key = 'agent';

-- Channels for the solo operator tier: content.
-- Everything else stays off. Enabling a channel with no credentials has the
-- orchestrator plan sends the runner cannot perform, filling the queue with
-- work that only ever fails.
update public.channels set enabled = false
where key not in ('content');

update public.channels set enabled = true, status = 'live'
where key in ('content');
