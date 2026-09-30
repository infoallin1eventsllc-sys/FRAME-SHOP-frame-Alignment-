import { test, expect } from '@playwright/test';
import { aiTells } from '../src/utils/aiTells';

/** The "sounds machine-written" check on marketing drafts. */

test('catches the giveaway phrases', () => {
  const cases: [string, string][] = [
    ["In today's fast-paced world, your bike deserves better.", "fast-paced"],
    ['Let us delve into frame alignment.', 'delve'],
    ['A rich tapestry of riders.', 'tapestry'],
    ["It's not just a wobble — it's a warning.", "it's not X"],
    ['Not only faster, but also safer.', 'not only'],
    ['Moreover, we check the swingarm.', 'moreover'],
    ["Let's break it down.", 'break it down'],
    ['The key takeaway is simple.', 'key takeaway'],
    ['Riding season brings challenges and opportunities.', 'challenges and opportunities'],
    ['This build stands as a testament to patience.', 'testament'],
    ['It underscores the importance of alignment.', 'underscores'],
    ['I hope this helps!', 'hope this helps'],
    ['Great question! We do.', 'great question'],
    ['Experts agree that alignment matters.', 'vague sources'],
    ['A seamless, cutting-edge experience.', 'buzzwords'],
  ];
  for (const [text, expected] of cases) {
    expect(aiTells(text).join(' ').toLowerCase(), text).toContain(expected.toLowerCase());
  }
});

test('leaves plain shop writing alone', () => {
  for (const text of [
    'This Road Glide came in wobbling at 70. Motor mounts were 3mm out. Rides straight now.',
    'Hi {first_name}, bring it by Tuesday and I will put it on the jig. — Paul',
    'Power Train Alignment, listed at $380. Book online or call (832) 628-5226.',
    "Wobble at 75? That's usually the mounts, not the tires.",
  ]) {
    expect(aiTells(text), text).toEqual([]);
  }
});
