/**
 * Structured logging, and a way for errors to reach a person.
 *
 * Before this, failures went to console.error as free text: readable in a
 * terminal, unsearchable in a host's log viewer, and seen by nobody unless
 * someone went looking. Customer phone numbers were printed alongside them.
 *
 * Now every event is one JSON line — { ts, level, event, ...fields } — which
 * Railway, Render and Vercel all index and filter. Customer contact details are
 * redacted before anything is written. And if ERROR_ALERT_WEBHOOK is set, each
 * error is also posted there: a Slack or Discord incoming-webhook URL, so the
 * site tells someone when it breaks rather than waiting to be noticed.
 */

export type Level = "info" | "warn" | "error";

/** Keys whose values are customer contact details. Never written to a log. */
const REDACT = new Set(["phone", "email", "name", "customerName", "customerPhone", "customerEmail", "address"]);

function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = REDACT.has(k) && v ? "[redacted]" : v;
  return out;
}

const ALERT_URL = process.env.ERROR_ALERT_WEBHOOK || "";
/** One alert per event name per window, so a crash loop cannot flood a channel. */
const ALERT_WINDOW_MS = 5 * 60 * 1000;
const lastAlert = new Map<string, number>();

function alert(event: string, fields: Record<string, unknown>) {
  if (!ALERT_URL) return;
  const now = Date.now();
  if (now - (lastAlert.get(event) ?? 0) < ALERT_WINDOW_MS) return;
  lastAlert.set(event, now);

  const detail = Object.entries(fields)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");
  // `text` is Slack's field and `content` is Discord's; sending both lets the
  // same variable work with either.
  const message = `The Frame Shop — ${event}\n${detail}`.slice(0, 1900);
  fetch(ALERT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message, content: message }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // An alert that cannot be delivered must never become a second error.
  });
}

export function logEvent(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const safe = redact(fields);
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...safe });
  if (level === "error") {
    console.error(line);
    alert(event, safe);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/** For an Error caught in a catch block: keep the message and the top of the stack. */
export function errorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack?.split("\n").slice(0, 4).join(" | ") };
  }
  return { message: String(err) };
}

export const alertsConfigured = () => Boolean(ALERT_URL);
