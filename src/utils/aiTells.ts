/**
 * Phrases that make writing read as machine-made. Riders tune out a post that
 * sounds like an AI wrote it, so the Marketing tab flags these on a draft
 * before Paul approves it. The assistants are also told to avoid them
 * (marketing.ts, rule 7); this catches what slips through.
 *
 * Only phrases that can be spotted reliably are here. The structural habits in
 * the same list — forced groups of three, repetitive rhythm, overexplaining —
 * are covered by the assistants' rules, not by this check.
 */
const TELLS: { label: string; pattern: RegExp }[] = [
  { label: '"in today\'s fast-paced world"', pattern: /\bin today['’]s (fast-paced|digital|modern|ever-changing) world\b/i },
  { label: '"delve"', pattern: /\bdelv(e|es|ed|ing)\b/i },
  { label: '"tapestry"', pattern: /\btapestry\b/i },
  { label: '"it\'s not X — it\'s Y"', pattern: /\b(it['’]s|this is|that['’]s) not (just |only |about )?[^.!?\n]{1,60}?[—–-]+\s*(it['’]s|this is|that['’]s)\b/i },
  { label: '"not only … but also"', pattern: /\bnot only\b[^.!?\n]{1,80}\bbut also\b/i },
  { label: '"additionally / moreover / furthermore"', pattern: /\b(additionally|moreover|furthermore)\b/i },
  { label: '"let\'s break it down"', pattern: /\blet['’]s (break it down|dive in|unpack)\b/i },
  { label: '"the key takeaway"', pattern: /\bkey takeaways?\b/i },
  { label: '"challenges and opportunities"', pattern: /\bchallenges and opportunities\b/i },
  { label: '"a testament to"', pattern: /\b(stands as )?a testament to\b/i },
  { label: '"underscores the importance"', pattern: /\bunderscores? the (importance|significance)\b/i },
  { label: '"I hope this helps"', pattern: /\bi hope this helps\b/i },
  { label: 'unnecessary praise ("great question")', pattern: /\b(great|excellent|fantastic) question\b/i },
  { label: 'vague sources ("experts agree", "studies show")', pattern: /\b(experts (agree|say)|studies (show|have shown)|research shows|many believe)\b/i },
  { label: 'corporate buzzwords', pattern: /\b(leverag(e|es|ing)|synerg(y|ies)|game[- ]changer|seamless(ly)?|cutting[- ]edge|revolutioni[sz]e|elevate your|unlock (the|your)|in the realm of|navigat(e|ing) the complexities)\b/i },
];

/** The giveaway phrases found in a piece of writing, in list order, each once. */
export function aiTells(text: string): string[] {
  return TELLS.filter((t) => t.pattern.test(text)).map((t) => t.label);
}
