/**
 * Claude, for the marketing agents.
 *
 * Paul's own Anthropic key (ANTHROPIC_API_KEY, from console.anthropic.com),
 * on his own account and billing. Without it the agents say they are not
 * connected — they never fall back to placeholder text, because a placeholder
 * in an approval queue looks exactly like a real draft.
 *
 * Every call is counted against a daily ceiling (MARKETING_DAILY_AI_CAP,
 * default 60) so a runaway schedule cannot run up his bill. Set a spending
 * limit in the Anthropic console as well; this is the second line.
 */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
// Overridable so tests can point at a local stand-in.
const BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
export const MARKETING_MODEL = process.env.MARKETING_MODEL || "claude-sonnet-5-5";
const DAILY_CAP = Math.max(1, Number(process.env.MARKETING_DAILY_AI_CAP) || 60);

export const aiEnabled = () => Boolean(ANTHROPIC_API_KEY);

const usage = { day: "", count: 0 };
export function aiUsageToday() {
  const today = new Date().toISOString().slice(0, 10);
  if (usage.day !== today) Object.assign(usage, { day: today, count: 0 });
  return { used: usage.count, cap: DAILY_CAP };
}

export class AiUnavailable extends Error {}

export interface AiResult {
  text: string;
  /** Pages the model read, when web search was used. */
  sources: { url: string; title: string }[];
}

export async function askClaude(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  webSearch?: boolean;
}): Promise<AiResult> {
  if (!aiEnabled()) throw new AiUnavailable("The marketing assistant is not connected yet (no Anthropic API key on the server).");
  const u = aiUsageToday();
  if (u.used >= u.cap) throw new AiUnavailable(`Today's limit of ${u.cap} assistant runs is used up. It resets at midnight UTC.`);
  usage.count += 1;

  const res = await fetch(`${BASE}/v1/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MARKETING_MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
      ...(opts.webSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }] } : {}),
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 300);
    try {
      detail = JSON.parse(raw)?.error?.message || detail;
    } catch {
      /* keep raw */
    }
    throw new Error(`Anthropic API ${res.status}: ${detail}`);
  }
  const body = JSON.parse(raw);
  const blocks: any[] = Array.isArray(body?.content) ? body.content : [];
  const text = blocks.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
  const sources: { url: string; title: string }[] = [];
  for (const b of blocks) {
    if (b?.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r?.url) sources.push({ url: String(r.url), title: String(r.title || r.url) });
    }
  }
  return { text, sources: dedupe(sources) };
}

const dedupe = (list: { url: string; title: string }[]) => {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
};

/**
 * The agents are asked to answer with one JSON object. Models sometimes wrap
 * it in a code fence or add a sentence around it; this finds the object.
 */
export function parseJsonReply<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The assistant's reply had no JSON in it.");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
