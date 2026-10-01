/**
 * Owner login: the PIN, session keys, and the guard on owner-only routes.
 *
 * Kept apart from server.ts so the one piece that decides who may see
 * customer data can be read, reviewed and tested on its own.
 */
import type express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import express_ from "express";
import { logEvent } from "./logger";
import { recordSecurityEvent, securitySummary, signOutAll, checkRevokeToken } from "./security";

const SHOP_OWNER_PIN  = process.env.SHOP_OWNER_PIN  || "1234";
export const SHOP_API_SECRET = process.env.SHOP_API_SECRET || "";

/**
 * Owner logins. A correct PIN gets a random session key that expires; the
 * master SHOP_API_SECRET never leaves the server. (It used to be handed to the
 * browser on login — one guessed PIN and it worked forever.) Sessions live in
 * memory, so a restart simply asks Paul for his PIN again.
 */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map<string, number>(); // key -> expiry time

/** Ends every owner login at once ("Sign everyone out"). */
export function revokeAllSessions(): void {
  sessions.clear();
}

function newSession(): string {
  const now = Date.now();
  for (const [key, expires] of sessions) if (expires <= now) sessions.delete(key);
  const key = crypto.randomBytes(32).toString("hex");
  sessions.set(key, now + SESSION_TTL_MS);
  return key;
}

const sameSecret = (a: string, b: string) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function isOwner(token: string): boolean {
  const expires = sessions.get(token);
  if (expires !== undefined) {
    if (expires > Date.now()) return true;
    sessions.delete(token);
  }
  // The master secret still works for scripts run on the server itself.
  return Boolean(SHOP_API_SECRET) && sameSecret(token, SHOP_API_SECRET);
}

export function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!SHOP_API_SECRET) return next();
  const token = String(req.headers["x-shop-secret"] || "");
  if (!token || !isOwner(token)) {
    recordSecurityEvent("unauthorized", req, `${req.method} ${req.path}`);
    return res.status(401).json({ error: "Unauthorized." });
  }
  next();
}

/** The PIN login route, with its guessing limits. */
export function registerAuthRoutes(app: express.Express) {
  /**
   * PIN guessing. Each visitor gets 5 wrong tries per 15 minutes. And because an
   * attacker can use many addresses, 30 wrong tries in an hour from anywhere
   * pauses all logins for an hour and raises an error alert. With a 6-digit PIN
   * (required in production) that is years of guessing, not minutes.
   */
  const pinLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.PIN_RATE_LIMIT) || 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      recordSecurityEvent("login_limited", req);
      res.status(429).json({ error: "Too many wrong PINs from this device. Wait 15 minutes and try again." });
    },
  });
  const PIN_LOCKOUT_FAILURES = Number(process.env.PIN_LOCKOUT_FAILURES) || 30;
  let pinFailures: number[] = [];
  let pinLockedUntil = 0;

  app.post("/api/auth/pin", pinLimiter, (req, res) => {
    const now = Date.now();
    if (now < pinLockedUntil) {
      return res.status(429).json({ error: "Owner login is paused after too many wrong PINs. Try again in an hour, or call Otis." });
    }
    const pin = String(req.body?.pin ?? "");
    if (!pin || !sameSecret(pin, SHOP_OWNER_PIN)) {
      pinFailures = pinFailures.filter((t) => t > now - 60 * 60 * 1000);
      pinFailures.push(now);
      recordSecurityEvent("login_failed", req);
      if (pinFailures.length >= PIN_LOCKOUT_FAILURES) {
        pinLockedUntil = now + 60 * 60 * 1000;
        pinFailures = [];
        logEvent("error", "auth.pin_lockout", { failures: PIN_LOCKOUT_FAILURES });
        recordSecurityEvent("lockout", req);
      }
      return res.status(401).json({ error: "Invalid PIN. Access denied." });
    }
    recordSecurityEvent("login_ok", req);
    res.json({ token: newSession() });
  });

  /* ---- The Security tab ------------------------------------------------ */
  app.get("/api/security", requireAdmin, (_req, res) => res.json(securitySummary()));

  app.post("/api/security/signout-all", requireAdmin, (req, res) => {
    signOutAll(req, "Security tab button");
    res.json({ ok: true });
  });

  /*
   * The "wasn't you?" link in the new-login email. Opening it only shows a
   * button: email apps open links on their own to scan them, and that must
   * never sign Paul out by itself. The button does it.
   */
  const page = (body: string) =>
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Frame Shop</title>` +
    `<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#18181b"><h1 style="font-size:1.3rem">The Frame Shop — Command Center</h1>${body}</body>`;
  const safe = (t: string) => t.replace(/[^\w.-]/g, "");

  app.get("/api/security/revoke", (req, res) => {
    const t = safe(String(req.query.t || ""));
    res.type("html").send(page(
      `<p>Sign every device out of your Command Center? Anyone logged in, including you, will need the PIN again.</p>` +
      `<form method="post" action="/api/security/revoke"><input type="hidden" name="t" value="${t}">` +
      `<button style="font:inherit;padding:.7rem 1.2rem;background:#ea580c;color:#fff;border:0;border-radius:4px">Sign everyone out</button></form>`
    ));
  });

  app.post("/api/security/revoke", express_.urlencoded({ extended: false, limit: "2kb" }), (req, res) => {
    const t = safe(String(req.body?.t || ""));
    if (!checkRevokeToken(t)) {
      return res.status(400).type("html").send(page(
        `<p>This link has expired or was already used. To sign everyone out, open the Command Center's Security tab, or call Otis.</p>`
      ));
    }
    signOutAll(req, "Link in the new-login email");
    res.type("html").send(page(`<p><strong>Done.</strong> Every device has been signed out. Ask Otis to change your PIN.</p>`));
  });
}

/**
 * Settings the live site cannot run safely without. Missing any of them used
 * to mean a warning in a log nobody reads — and, for the secret, the customer
 * list open to anyone. In production the server now refuses to start instead,
 * and says exactly what to set.
 */
export function productionProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  if (!env.SHOP_API_SECRET || env.SHOP_API_SECRET.length < 32 || /generate|random-hex|here/i.test(env.SHOP_API_SECRET)) {
    problems.push(
      "SHOP_API_SECRET is missing, shorter than 32 characters, or still the example text. Owner pages would be open to anyone.\n" +
      "      Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (!/^\d{6,}$/.test(env.SHOP_OWNER_PIN || "") || /^(\d)\1+$|^123456|^654321/.test(env.SHOP_OWNER_PIN || "")) {
    problems.push("SHOP_OWNER_PIN must be Paul's own PIN of at least 6 digits (not 123456, 111111 or the like).");
  }
  if (!/^https:\/\/[^\s/]+/.test(env.APP_URL || "")) {
    problems.push(
      "APP_URL must be the site's https:// address (e.g. https://theframeshop.com).\n" +
      "      Google, link previews and every unsubscribe link use it."
    );
  }
  if (!env.DATA_DIR) {
    problems.push(
      "DATA_DIR is not set. Point it at the host's permanent disk (e.g. a volume mounted at /data).\n" +
      "      Without it, bookings, invoices and messages are wiped on every deploy."
    );
  }
  return problems;
}
