/**
 * The security watch: what happened at the Command Center's door, and who is
 * told about it.
 *
 * The blocking itself is done by the rules in auth.ts and the rate limits in
 * server.ts. This module records what those rules saw and raises the alarm:
 *
 *   - every successful owner login emails Paul ("was this you?") with a
 *     one-tap link that signs every device out;
 *   - wrong PINs, a login lockout, repeated attempts to open owner-only
 *     information, and floods of form submissions email Paul and post to
 *     Otis's alert channel (ERROR_ALERT_WEBHOOK, via logEvent).
 *
 * Addresses are stored partly masked and no customer details are recorded:
 * the log is about the door, not about who booked what.
 */
import type express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { logEvent, errorFields } from "./logger";
import { emailEnabled, sendEmail } from "./mailer";
import { writeJsonAtomic, readJsonWithRecovery } from "./storage";

export type SecurityKind =
  | "login_ok"        // correct PIN
  | "login_failed"    // wrong PIN
  | "login_limited"   // this device hit the wrong-PIN limit
  | "lockout"         // all logins paused
  | "unauthorized"    // owner-only information asked for without a login
  | "flood"           // a visitor hit a form's speed limit
  | "signout_all";    // every device signed out

export interface SecurityEvent {
  id: string;
  at: string;
  kind: SecurityKind;
  /** e.g. "203.0.113.x" — enough to tell attempts apart, not to identify anyone. */
  address: string;
  /** e.g. "iPhone · Safari" */
  device: string;
  detail?: string;
}

const MAX_EVENTS = 500;
const WINDOW_MS = 10 * 60 * 1000;
const ALERT_EVERY_MS = 10 * 60 * 1000;
const REVOKE_LINK_MS = 24 * 60 * 60 * 1000;

let file = "";
let events: SecurityEvent[] = [];
let alertTo = "";
let siteUrl = "";
let signOutEveryone: () => void = () => {};
const lastAlert = new Map<string, number>();
const usedRevokeLinks = new Set<string>();

/** Called once by server.ts before any route runs. */
export function configureSecurity(opts: { dataDir: string; alertTo: string; siteUrl: string; revokeAll: () => void }) {
  file = path.join(opts.dataDir, "security.json");
  alertTo = opts.alertTo;
  siteUrl = opts.siteUrl.replace(/\/+$/, "");
  signOutEveryone = opts.revokeAll;
  try {
    fs.mkdirSync(opts.dataDir, { recursive: true });
    events = readJsonWithRecovery<SecurityEvent[]>(file, { whenMissing: [], valid: (v): v is SecurityEvent[] => Array.isArray(v) }).data;
  } catch (err) {
    logEvent("error", "security.log_unreadable", errorFields(err));
    events = [];
  }
}

export function maskAddress(ip: string): string {
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.replace(/\.\d+$/, ".x");
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + ":…";
  return "unknown";
}

export function describeDevice(ua: string): string {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [os, browser].filter(Boolean).join(" · ") || (ua ? "Unrecognised device" : "Unknown device");
}

const shopTime = (d = new Date()) =>
  d.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Written at most every 2 seconds: during a flood, every refused request is an
// event, and rewriting the file for each would make the flood's job easier.
let saveTimer: NodeJS.Timeout | null = null;
function save() {
  if (!file || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      writeJsonAtomic(file, events.slice(0, MAX_EVENTS));
    } catch (err) {
      logEvent("error", "security.log_write_failed", errorFields(err));
    }
  }, 2000);
  saveTimer.unref?.();
}

/** Record something that happened at the door, and raise the alarm if it calls for one. */
export function recordSecurityEvent(kind: SecurityKind, req: express.Request, detail?: string): SecurityEvent {
  const ev: SecurityEvent = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    kind,
    address: maskAddress(req.ip || ""),
    device: describeDevice(String(req.headers["user-agent"] || "")),
    ...(detail ? { detail: detail.slice(0, 200) } : {}),
  };
  events.unshift(ev);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  save();
  void raiseAlarm(ev);
  return ev;
}

const recent = (kind: SecurityKind, now = Date.now()) =>
  events.filter((e) => e.kind === kind && now - Date.parse(e.at) < WINDOW_MS).length;

/** A signed, single-use link that signs every device out. */
function revokeToken(eventId: string, issuedAt: number): string {
  const secret = process.env.SHOP_API_SECRET || "";
  const sig = crypto.createHmac("sha256", secret).update(`revoke:${eventId}:${issuedAt}`).digest("hex");
  return `${eventId}.${issuedAt}.${sig}`;
}

export function checkRevokeToken(token: string): boolean {
  const [id, issued, sig] = token.split(".");
  const at = Number(issued);
  if (!id || !sig || !Number.isFinite(at) || !process.env.SHOP_API_SECRET) return false;
  if (Date.now() - at > REVOKE_LINK_MS || usedRevokeLinks.has(token)) return false;
  const expected = revokeToken(id, at).split(".")[2];
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  usedRevokeLinks.add(token);
  return true;
}

/** What each kind of event should say, and when it is worth an alarm. */
function alarmFor(ev: SecurityEvent): { key: string; subject: string; body: string; urgent: boolean } | null {
  const when = shopTime(new Date(ev.at));
  const where = `${ev.device}, network ${ev.address}`;
  switch (ev.kind) {
    case "login_ok": {
      const link = siteUrl ? `${siteUrl}/api/security/revoke?t=${encodeURIComponent(revokeToken(ev.id, Date.now()))}` : "";
      return {
        key: `login_ok:${ev.id}`,
        urgent: false,
        subject: "New login to your Command Center",
        body:
          `Someone just logged in to The Frame Shop Command Center.\n\n` +
          `When: ${when}\nDevice: ${where}\n\n` +
          `If this was you, there's nothing to do.\n\n` +
          `If it wasn't you, sign every device out now${link ? ":\n" + link : " from the Security tab"}\n` +
          `Then ask Otis to change your PIN.`,
      };
    }
    case "login_failed":
      if (recent("login_failed") < 3) return null;
      return {
        key: "login_failed",
        urgent: true,
        subject: "Wrong PINs at your Command Center",
        body:
          `There have been ${recent("login_failed")} wrong PIN attempts in the last 10 minutes.\n` +
          `Latest: ${when}, ${where}.\n\n` +
          `If this wasn't you mistyping, someone may be trying to guess your PIN. The website limits ` +
          `each device to 5 tries per 15 minutes, and pauses all logins after too many.\n` +
          `Nothing has been opened. See the Security tab for details.`,
      };
    case "lockout":
      return {
        key: "lockout",
        urgent: true,
        subject: "Command Center logins paused",
        body:
          `So many wrong PINs were tried that the website has paused all owner logins for an hour (${when}).\n\n` +
          `Nothing was opened. Someone is probably trying to guess your PIN. Call Otis: he can check ` +
          `the activity and change your PIN.`,
      };
    case "unauthorized":
      if (recent("unauthorized") < 5) return null;
      return {
        key: "unauthorized",
        urgent: true,
        subject: "Someone tried to open your customer records",
        body:
          `In the last 10 minutes there were ${recent("unauthorized")} attempts to open owner-only ` +
          `information (bookings, invoices or messages) without logging in. Latest: ${when}, ${where}.\n\n` +
          `Every attempt was refused and nothing was shown. See the Security tab for details.`,
      };
    case "flood":
      if (recent("flood") < 20) return null;
      return {
        key: "flood",
        urgent: true,
        subject: "Your website's forms are being flooded",
        body:
          `In the last 10 minutes one or more visitors hit the booking, message or diagnostic forms ` +
          `${recent("flood")} times over the speed limit. The extra submissions were refused.\n\n` +
          `Real customers can still use the site. If fake bookings or messages got through, ` +
          `delete them in the Command Center.`,
      };
    case "signout_all":
      return {
        key: `signout_all:${ev.id}`,
        urgent: false,
        subject: "Every device was signed out of your Command Center",
        body: `Every device was signed out of the Command Center at ${when}. Log in again with your PIN.`,
      };
    default:
      return null;
  }
}

async function raiseAlarm(ev: SecurityEvent) {
  const a = alarmFor(ev);
  if (!a) return;
  const now = Date.now();
  if (now - (lastAlert.get(a.key) ?? 0) < ALERT_EVERY_MS) return;
  lastAlert.set(a.key, now);

  // Otis's alert channel gets the serious ones.
  if (a.urgent) logEvent("error", `security.${ev.kind}`, { address: ev.address, device: ev.device });

  if (!alertTo || !emailEnabled()) return;
  try {
    await sendEmail({ to: alertTo, replyTo: alertTo, subject: `🔒 ${a.subject}`, text: a.body });
  } catch (err) {
    logEvent("error", "security.alert_email_failed", errorFields(err));
  }
}

/** For the Security tab: recent events and counts. */
export function securitySummary() {
  const now = Date.now();
  const since = (ms: number) => events.filter((e) => now - Date.parse(e.at) < ms);
  const count = (list: SecurityEvent[], kind: SecurityKind) => list.filter((e) => e.kind === kind).length;
  const day = since(24 * 60 * 60 * 1000);
  const week = since(7 * 24 * 60 * 60 * 1000);
  const tally = (list: SecurityEvent[]) => ({
    logins: count(list, "login_ok"),
    wrongPins: count(list, "login_failed") + count(list, "login_limited"),
    lockouts: count(list, "lockout"),
    refused: count(list, "unauthorized"),
    floods: count(list, "flood"),
  });
  return {
    events: events.slice(0, 100),
    day: tally(day),
    week: tally(week),
    alertsTo: alertTo,
    emailOn: emailEnabled(),
  };
}

/** Sign every device out (the button, and the link in the login email). */
export function signOutAll(req: express.Request, how: string) {
  signOutEveryone();
  recordSecurityEvent("signout_all", req, how);
}
