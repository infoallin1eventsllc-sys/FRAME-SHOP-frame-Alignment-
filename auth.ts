/**
 * Owner login: the PIN, session keys, and the guard on owner-only routes.
 *
 * Kept apart from server.ts so the one piece that decides who may see
 * customer data can be read, reviewed and tested on its own.
 */
import type express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { logEvent } from "./logger";

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
    message: { error: "Too many wrong PINs from this device. Wait 15 minutes and try again." },
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
      if (pinFailures.length >= PIN_LOCKOUT_FAILURES) {
        pinLockedUntil = now + 60 * 60 * 1000;
        pinFailures = [];
        logEvent("error", "auth.pin_lockout", { failures: PIN_LOCKOUT_FAILURES });
      }
      return res.status(401).json({ error: "Invalid PIN. Access denied." });
    }
    res.json({ token: newSession() });
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
