/**
 * The Marketing Desk — Paul's marketing assistants, inside the Command Center.
 *
 * Each assistant ("agent") drafts one kind of work from the shop's own data:
 * posts, replies to customer messages, replies to reviews, review requests,
 * email campaigns, and a market brief. Every draft lands in an approval queue.
 * Nothing is sent or posted until Paul approves it.
 *
 * Two rules hold throughout:
 * - Facts come only from the fact sheet built here from real shop data. The
 *   assistant is told not to invent reviews, numbers, years in business, prices
 *   or guarantees — the claims the legal review flagged.
 * - Customer names and contact details are never sent to the AI. Drafts use
 *   {first_name}-style placeholders, filled in here just before sending.
 */
import crypto from "crypto";
import path from "path";
import type express from "express";
import { askClaude, aiEnabled, aiUsageToday, parseJsonReply, AiUnavailable, MARKETING_MODEL } from "./ai";
import { readJsonWithRecovery, writeJsonAtomic } from "./storage";
import { emailEnabled, sendEmail, looksLikeEmail } from "./mailer";
import { logEvent, errorFields } from "./logger";
import { balanceDue } from "./invoice";

export type AgentId = "content" | "reply" | "review_reply" | "review_request" | "campaign" | "radar";
export const AGENTS: AgentId[] = ["content", "reply", "review_reply", "review_request", "campaign", "radar"];

export interface Draft {
  id: string;
  agent: AgentId;
  status: "pending" | "approved" | "done" | "discarded";
  createdAt: string;
  updatedAt: string;
  title: string;
  channel: "instagram" | "facebook" | "tiktok" | "google" | "email" | "text" | "review" | "brief";
  subject?: string;
  body: string;
  hashtags?: string[];
  photoIdea?: string;
  /** TikTok: the clip to film — the hook, the shots, the words on screen. */
  videoPlan?: string;
  suggestedDate?: string;
  sources?: { url: string; title: string }[];
  /** Who it is for. Kept on the server; the AI never saw these. */
  target?: { messageId?: string; bookingId?: string };
  doneNote?: string;
}

interface Settings {
  brandVoice: string;
  googleReviewUrl: string;
  competitors: string;
  autopilot: boolean;
  lastDailyRun?: string;
  lastWeeklyRun?: string;
  /** Signs unsubscribe links, so nobody can unsubscribe someone else. */
  unsubscribeKey: string;
}

interface MarketingData {
  settings: Settings;
  drafts: Draft[];
  runs: { agent: AgentId; at: string; ok: boolean; drafts: number; error?: string }[];
  unsubscribed: string[];
  campaigns: { draftId: string; subject: string; sentAt: string; sent: number; failed: number }[];
}

export interface MarketingDeps {
  dataDir: string;
  shop: { name: string; owner: string; address: string; phone: string; email: string; hours: string; instagramHandle: string };
  services: { id: string; title: string; description?: string; startingPrice?: string }[];
  loadBookings: () => any[];
  saveBookings: (b: any[]) => void;
  loadMessages: () => any[];
  saveMessages: (m: any[]) => void;
  loadRates: () => any;
  requireAdmin: express.RequestHandler;
  limiter: express.RequestHandler;
}

const DEFAULT_VOICE =
  "Plain, straight-talking and knowledgeable — a working mechanic, not an ad agency. " +
  "Short sentences. Explain what was wrong and what was done. No hype words like 'ultimate' or 'world-class'. " +
  "Speak to riders as fellow riders.";

const uid = () => crypto.randomBytes(6).toString("hex");
const now = () => new Date().toISOString();
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** Phone numbers and email addresses out of free text before it goes to the AI. */
const scrub = (s: string) =>
  s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]").replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone]");
const firstName = (name: string) => (name || "").trim().split(/\s+/)[0] || "there";
const DAY = 86_400_000;

export function registerMarketing(app: express.Express, deps: MarketingDeps) {
  const FILE = path.join(deps.dataDir, "marketing.json");

  const load = (): MarketingData => {
    const { data } = readJsonWithRecovery<MarketingData>(FILE, {
      whenMissing: {
        settings: { brandVoice: DEFAULT_VOICE, googleReviewUrl: "", competitors: "", autopilot: false, unsubscribeKey: crypto.randomBytes(24).toString("hex") },
        drafts: [],
        runs: [],
        unsubscribed: [],
        campaigns: [],
      },
      valid: (v): v is MarketingData => !!v && typeof v === "object" && Array.isArray((v as MarketingData).drafts),
    });
    return data;
  };
  const save = (d: MarketingData) => {
    d.drafts = d.drafts.slice(0, 500);
    d.runs = d.runs.slice(0, 100);
    writeJsonAtomic(FILE, d, { backups: 10 });
  };

  const unsubToken = (d: MarketingData, email: string) =>
    crypto.createHmac("sha256", d.settings.unsubscribeKey).update(email.toLowerCase()).digest("hex").slice(0, 32);

  /* ------------------------------------------------------------------------
   * What the assistant is allowed to know, and to say.
   * ---------------------------------------------------------------------- */
  function factSheet(d: MarketingData): string {
    const rates = deps.loadRates();
    const done = deps
      .loadBookings()
      .filter((b) => b.status === "completed" && Date.now() - Date.parse(b.completedAt || b.createdAt) < 60 * DAY)
      .slice(0, 15);
    const lines = [
      `SHOP: ${deps.shop.name}, ${deps.shop.address}. Owner and head mechanic: ${deps.shop.owner}.`,
      `Phone/text: ${deps.shop.phone}. Email: ${deps.shop.email}. Hours: ${deps.shop.hours}. Instagram: ${deps.shop.instagramHandle}.`,
      "",
      "SERVICES (as listed on the website):",
      ...deps.services.map((s) => `- ${s.title}: ${clip(s.description, 240)}${s.startingPrice ? ` Listed as: ${s.startingPrice}.` : ""}`),
    ];
    if (rates?.confirmedAt && Array.isArray(rates.lines)) {
      lines.push("", "PRICES PAUL HAS CONFIRMED:");
      for (const l of rates.lines) if (l.price != null) lines.push(`- ${l.name}: $${l.price} (${l.unit})`);
    }
    if (done.length) {
      lines.push("", "RECENT COMPLETED JOBS (real work — the bike and the job, no customer details):");
      for (const b of done) {
        const bike = [b.bikeYear, b.bikeMake, b.bikeModel].filter(Boolean).join(" ");
        lines.push(`- ${bike}: ${b.serviceTitle}.${b.techNotes ? ` Paul's notes: ${scrub(clip(b.techNotes, 300))}` : ""}`);
      }
    }
    lines.push("", "BRAND VOICE:", d.settings.brandVoice || DEFAULT_VOICE);
    return lines.join("\n");
  }

  const RULES = `RULES — these override everything else:
1. Use only facts in the FACT SHEET. If a fact you would need is not there, write [ask Paul: …] in its place.
2. Never invent customers, reviews, testimonials, quotes, statistics, awards, years in business, numbers of bikes worked on, or results.
3. Do not state or imply a guarantee or warranty. Do not claim to be the best, only, or first.
4. Mention a price only if it appears in the FACT SHEET, worded as it appears there.
5. Never include a customer's real name or contact details. Where a greeting needs a name, write {first_name}.
6. Write for The Frame Shop's riders in the brand voice. No emojis unless the brand voice asks for them.
Answer with one JSON object only, no other text.`;

  const system = (d: MarketingData, job: string) =>
    `You are a marketing assistant for ${deps.shop.name}, a motorcycle frame and alignment shop in Spring, Texas. ${job}\n\n${RULES}\n\nFACT SHEET:\n${factSheet(d)}`;

  const addDraft = (d: MarketingData, draft: Omit<Draft, "id" | "status" | "createdAt" | "updatedAt">) => {
    const full: Draft = { id: `dr-${uid()}`, status: "pending", createdAt: now(), updatedAt: now(), ...draft };
    d.drafts.unshift(full);
    return full;
  };

  /* ------------------------------------------------------------------------
   * The agents. Each returns the drafts it added.
   * ---------------------------------------------------------------------- */
  async function runAgent(agent: AgentId, input: Record<string, unknown>): Promise<Draft[]> {
    const d = load();
    const added: Draft[] = [];

    if (agent === "content") {
      const start = new Date(Date.now() + DAY).toISOString().slice(0, 10);
      const { text } = await askClaude({
        system: system(d, "Plan social media posts for the coming week."),
        prompt: `Plan 6 posts for the 7 days starting ${start}: a mix of Instagram, Facebook, TikTok and Google Business Profile, with at least one TikTok.
Build them on the recent completed jobs and the services — what the problem was, what it feels like to ride, what was done.
TikTok posts are short vertical videos Paul films on his phone in the shop: give a videoPlan with a hook for the first two seconds, 3–6 shots he can film himself (the bike on the jig, the laser, the fix, a ride-off), the words to put on screen, and a length of 15–45 seconds. Keep its caption short.
Return {"posts":[{"channel":"instagram|facebook|tiktok|google","title":"short label","caption":"the post text","hashtags":["..."],"photoIdea":"what photo or clip Paul should take","videoPlan":"TikTok only: hook, shots, on-screen text, length","suggestedDate":"YYYY-MM-DD"}]}`,
      });
      const { posts } = parseJsonReply<{ posts: any[] }>(text);
      for (const p of (posts || []).slice(0, 7)) {
        const channel = ["instagram", "facebook", "tiktok", "google"].includes(p?.channel) ? p.channel : "instagram";
        added.push(
          addDraft(d, {
            agent,
            channel,
            title: clip(p?.title, 120) || "Post",
            body: clip(p?.caption, 2200),
            hashtags: Array.isArray(p?.hashtags) ? p.hashtags.map((h: unknown) => clip(h, 40)).filter(Boolean).slice(0, 15) : [],
            photoIdea: clip(p?.photoIdea, 300),
            ...(channel === "tiktok" && clip(p?.videoPlan, 1500) ? { videoPlan: clip(p?.videoPlan, 1500) } : {}),
            suggestedDate: /^\d{4}-\d{2}-\d{2}$/.test(p?.suggestedDate) ? p.suggestedDate : undefined,
          })
        );
      }
    }

    if (agent === "reply") {
      const covered = new Set(d.drafts.filter((x) => x.agent === "reply" && x.status !== "discarded").map((x) => x.target?.messageId));
      const waiting = deps.loadMessages().filter((m) => !m.handled && !covered.has(m.id)).slice(0, 10);
      if (waiting.length) {
        const { text } = await askClaude({
          system: system(d, "Draft replies to messages customers sent through the website's contact form."),
          prompt: `Draft a reply to each message. Answer what they asked using the fact sheet; where you cannot, say Paul will look at the bike. Invite them to book or call. Greet them as {first_name}. Sign off as ${deps.shop.owner.split(" ")[0]}, ${deps.shop.name}.
Messages:
${waiting.map((m) => `[${m.id}] ${scrub(clip(m.message, 1500))}`).join("\n")}
Return {"replies":[{"id":"the id in brackets","body":"the reply"}]}`,
        });
        const { replies } = parseJsonReply<{ replies: any[] }>(text);
        for (const r of replies || []) {
          const msg = waiting.find((m) => m.id === r?.id);
          if (!msg) continue;
          added.push(
            addDraft(d, {
              agent,
              channel: looksLikeEmail(String(msg.reach || "")) ? "email" : "text",
              title: `Reply to ${firstName(msg.name)}`,
              subject: `Re: your message to ${deps.shop.name}`,
              body: clip(r?.body, 4000),
              target: { messageId: msg.id },
            })
          );
        }
      }
    }

    if (agent === "review_reply") {
      const review = clip(input.review, 3000);
      if (!review) throw new BadInput("Paste the review you want to answer.");
      const rating = Math.min(Math.max(Number(input.rating) || 0, 0), 5);
      const { text } = await askClaude({
        system: system(d, "Draft a public reply to a customer review."),
        prompt: `A customer left this ${rating ? `${rating}-star ` : ""}review:
"""${scrub(review)}"""
Write a short public reply from ${deps.shop.owner.split(" ")[0]}. Thank them; if something went wrong, own it without arguing and invite them to call. Do not repeat private details. Greet them as {first_name}.
Return {"reply":"..."}`,
      });
      const { reply } = parseJsonReply<{ reply: string }>(text);
      added.push(
        addDraft(d, {
          agent,
          channel: "review",
          title: `Reply to ${clip(input.reviewer, 60) || "a"}${rating ? ` ${rating}★` : ""} review`,
          body: clip(reply, 3000).replace(/\{first_name\}/g, firstName(clip(input.reviewer, 60)) || "there"),
        })
      );
    }

    if (agent === "review_request") {
      if (!d.settings.googleReviewUrl) throw new BadInput("Add your Google review link in Marketing settings first.");
      const covered = new Set(d.drafts.filter((x) => x.agent === "review_request" && x.status !== "discarded").map((x) => x.target?.bookingId));
      const due = deps
        .loadBookings()
        .filter(
          (b) =>
            b.status === "completed" &&
            !b.reviewRequestedAt &&
            looksLikeEmail(String(b.email || "")) &&
            !covered.has(b.id) &&
            Date.now() - Date.parse(b.completedAt || b.createdAt) < 30 * DAY
        )
        .slice(0, 20);
      if (due.length) {
        // One template, filled per customer: one AI run however many are due.
        const { text } = await askClaude({
          system: system(d, "Write a short email asking a customer whose job is finished to leave a Google review."),
          prompt: `Write the email. Use exactly these placeholders: {first_name}, {bike}, {service}, {review_link}. Keep it under 90 words, no pressure, no incentive of any kind (offering one breaks Google's rules). Sign off as ${deps.shop.owner.split(" ")[0]}.
Return {"subject":"...","body":"..."}`,
        });
        const t = parseJsonReply<{ subject: string; body: string }>(text);
        for (const b of due) {
          const bike = [b.bikeYear, b.bikeMake, b.bikeModel].filter(Boolean).join(" ") || "bike";
          const fill = (s: string) =>
            s
              .replace(/\{bike\}/g, bike)
              .replace(/\{service\}/g, b.serviceTitle || "service")
              .replace(/\{review_link\}/g, d.settings.googleReviewUrl);
          added.push(
            addDraft(d, {
              agent,
              channel: "email",
              title: `Review request — ${bike}`,
              subject: fill(clip(t.subject, 200)),
              body: fill(clip(t.body, 3000)),
              target: { bookingId: b.id },
            })
          );
        }
      }
    }

    if (agent === "campaign") {
      const goal = clip(input.goal, 600);
      if (!goal) throw new BadInput("Say what the email is for — for example, “fill the slow Tuesdays in March”.");
      const { text } = await askClaude({
        system: system(d, "Write a marketing email to customers who asked to hear about offers."),
        prompt: `Goal: ${goal}
Write one email. Greet them as {first_name}. One clear reason to get in touch and one way to do it (book online or call ${deps.shop.phone}). Under 150 words. Do not add an unsubscribe line — it is added automatically.
Return {"subject":"...","body":"..."}`,
      });
      const c = parseJsonReply<{ subject: string; body: string }>(text);
      added.push(addDraft(d, { agent, channel: "email", title: `Email campaign: ${clip(goal, 60)}`, subject: clip(c.subject, 200), body: clip(c.body, 5000) }));
    }

    if (agent === "radar") {
      const competitors = d.settings.competitors.trim();
      const { text, sources } = await askClaude({
        webSearch: true,
        maxTokens: 6000,
        system: system(d, "Research the local market and write a short weekly brief."),
        prompt: `Search the web for what is happening this month for motorcycle repair, frame and alignment work, and custom V-twin riders in Spring, The Woodlands and north Houston, Texas: local competitors' offers and news, events and rides, seasonal demand.${competitors ? ` Check these competitors specifically: ${competitors}.` : ""}
Report only what you found, with where you found it. Then suggest what ${deps.shop.name} could do about it.
Return {"summary":"two or three sentences","items":[{"headline":"...","detail":"...","suggestion":"..."}]}`,
      });
      const r = parseJsonReply<{ summary: string; items: any[] }>(text);
      const body = [
        clip(r.summary, 1000),
        "",
        ...(r.items || []).slice(0, 8).map((i: any) => `• ${clip(i?.headline, 160)}\n  ${clip(i?.detail, 500)}\n  → ${clip(i?.suggestion, 300)}`),
      ].join("\n");
      added.push(addDraft(d, { agent, channel: "brief", title: `Market brief — week of ${now().slice(0, 10)}`, body, sources: sources.slice(0, 12) }));
    }

    d.runs.unshift({ agent, at: now(), ok: true, drafts: added.length });
    save(d);
    logEvent("info", "marketing.run", { agent, drafts: added.length });
    return added;
  }

  class BadInput extends Error {}

  const recordFailure = (agent: AgentId, err: unknown) => {
    try {
      const d = load();
      d.runs.unshift({ agent, at: now(), ok: false, drafts: 0, error: (err as Error).message.slice(0, 300) });
      save(d);
    } catch {
      /* the failure itself is logged below */
    }
  };

  /* ------------------------------------------------------------------------
   * Results — only numbers the shop's own records support.
   * ---------------------------------------------------------------------- */
  function results(d: MarketingData) {
    const bookings = deps.loadBookings();
    const t = Date.now();
    const within = (iso: string | undefined, from: number, to = 0) => {
      const x = Date.parse(iso || "");
      return Number.isFinite(x) && t - x < from * DAY && t - x >= to * DAY;
    };
    const count = (list: any[], key: (b: any) => string) =>
      Object.entries(list.reduce((acc: Record<string, number>, b) => ((acc[key(b)] = (acc[key(b)] || 0) + 1), acc), {} as Record<string, number>) as Record<string, number>)
        .map(([label, n]) => ({ label, n }))
        .sort((a, b) => b.n - a.n);
    const recent90 = bookings.filter((b) => within(b.createdAt, 90));
    let invoiced30 = 0;
    let collected30 = 0;
    let outstanding = 0;
    for (const b of bookings) {
      const inv = b.invoice;
      if (!inv) continue;
      if (within(inv.createdDate, 30)) invoiced30 += Number(inv.totalAmount) || 0;
      for (const p of inv.payments || []) if (within(p.paidAt, 30)) collected30 += Number(p.amount) || 0;
      outstanding += balanceDue(inv);
    }
    const unsub = new Set(d.unsubscribed);
    const list = new Set(
      bookings.filter((b) => b.marketingConsent && looksLikeEmail(String(b.email || ""))).map((b) => String(b.email).toLowerCase()).filter((e) => !unsub.has(e))
    );
    const messages = deps.loadMessages();
    const sent30 = d.drafts.filter((x) => x.status === "done" && within(x.updatedAt, 30));
    return {
      bookings30: bookings.filter((b) => within(b.createdAt, 30)).length,
      bookingsPrev30: bookings.filter((b) => within(b.createdAt, 60, 30)).length,
      sources90: count(recent90, (b) => b.source || "Not asked / not given"),
      services90: count(recent90, (b) => b.serviceTitle || "Other"),
      invoiced30: Math.round(invoiced30 * 100) / 100,
      collected30: Math.round(collected30 * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      emailList: list.size,
      unsubscribed: d.unsubscribed.length,
      messages30: messages.filter((m) => within(m.createdAt, 30)).length,
      messagesWaiting: messages.filter((m) => !m.handled).length,
      published30: sent30.filter((x) => ["content", "review_reply"].includes(x.agent)).length,
      emailsSent30: d.campaigns.filter((c) => within(c.sentAt, 30)).reduce((s, c) => s + c.sent, 0) +
        sent30.filter((x) => ["reply", "review_request"].includes(x.agent) && x.doneNote?.startsWith("Emailed")).length,
      reviewRequests30: sent30.filter((x) => x.agent === "review_request").length,
    };
  }

  /* ------------------------------------------------------------------------
   * Routes
   * ---------------------------------------------------------------------- */
  app.get("/api/marketing", deps.requireAdmin, (_req, res) => {
    try {
      const d = load();
      const { unsubscribeKey: _k, ...settings } = d.settings;
      res.json({
        connected: aiEnabled(),
        emailConnected: emailEnabled(),
        model: MARKETING_MODEL,
        usage: aiUsageToday(),
        settings,
        drafts: d.drafts.filter((x) => x.status !== "discarded").slice(0, 200),
        runs: d.runs.slice(0, 20),
        results: results(d),
      });
    } catch (err) {
      logEvent("error", "marketing.read.failed", errorFields(err));
      res.status(500).json({ error: "Could not load the Marketing Desk." });
    }
  });

  app.put("/api/marketing/settings", deps.requireAdmin, (req, res) => {
    const body = req.body || {};
    const url = clip(body.googleReviewUrl, 500);
    if (url && !/^https:\/\/\S+$/.test(url)) return res.status(400).json({ error: "The Google review link should start with https://" });
    try {
      const d = load();
      d.settings.brandVoice = clip(body.brandVoice, 2000) || DEFAULT_VOICE;
      d.settings.googleReviewUrl = url;
      d.settings.competitors = clip(body.competitors, 1000);
      d.settings.autopilot = body.autopilot === true;
      save(d);
      const { unsubscribeKey: _k, ...settings } = d.settings;
      res.json({ settings });
    } catch (err) {
      logEvent("error", "marketing.settings.failed", errorFields(err));
      res.status(500).json({ error: "Settings could not be saved." });
    }
  });

  app.post("/api/marketing/run/:agent", deps.requireAdmin, async (req, res) => {
    const agent = req.params.agent as AgentId;
    if (!AGENTS.includes(agent)) return res.status(404).json({ error: "No such assistant." });
    try {
      const drafts = await runAgent(agent, req.body || {});
      res.json({ drafts, message: drafts.length ? `${drafts.length} new draft${drafts.length === 1 ? "" : "s"} to review.` : "Nothing needed doing." });
    } catch (err) {
      if (err instanceof BadInput) return res.status(400).json({ error: err.message });
      recordFailure(agent, err);
      if (err instanceof AiUnavailable) return res.status(503).json({ error: err.message });
      logEvent("error", "marketing.run.failed", { agent, ...errorFields(err) });
      res.status(502).json({ error: "The assistant could not finish this time. Nothing was changed — try again in a minute." });
    }
  });

  app.patch("/api/marketing/drafts/:id", deps.requireAdmin, (req, res) => {
    try {
      const d = load();
      const x = d.drafts.find((y) => y.id === req.params.id);
      if (!x) return res.status(404).json({ error: "Draft not found." });
      if (x.status === "done") return res.status(409).json({ error: "This one has already gone out." });
      const b = req.body || {};
      if (typeof b.body === "string") x.body = clip(b.body, 6000);
      if (typeof b.subject === "string") x.subject = clip(b.subject, 200);
      if (Array.isArray(b.hashtags)) x.hashtags = b.hashtags.map((h: unknown) => clip(h, 40)).filter(Boolean).slice(0, 15);
      if (["pending", "approved", "discarded"].includes(b.status)) x.status = b.status;
      x.updatedAt = now();
      save(d);
      res.json({ draft: x });
    } catch (err) {
      logEvent("error", "marketing.draft.update.failed", errorFields(err));
      res.status(500).json({ error: "The draft could not be saved." });
    }
  });

  /** Paul posted or sent it himself (a social post, a text, a review reply). */
  app.post("/api/marketing/drafts/:id/done", deps.requireAdmin, (req, res) => {
    try {
      const d = load();
      const x = d.drafts.find((y) => y.id === req.params.id);
      if (!x) return res.status(404).json({ error: "Draft not found." });
      x.status = "done";
      x.doneNote = clip(req.body?.note, 120) || "Marked done";
      x.updatedAt = now();
      if (x.agent === "reply" && x.target?.messageId) {
        const msgs = deps.loadMessages();
        const m = msgs.find((y) => y.id === x.target!.messageId);
        if (m) {
          m.handled = true;
          deps.saveMessages(msgs);
        }
      }
      save(d);
      res.json({ draft: x });
    } catch (err) {
      logEvent("error", "marketing.draft.done.failed", errorFields(err));
      res.status(500).json({ error: "Could not mark it done." });
    }
  });

  /** Send an approved email draft: a reply, a review request, or a campaign. */
  app.post("/api/marketing/drafts/:id/send", deps.requireAdmin, async (req, res) => {
    if (!emailEnabled()) {
      return res.status(503).json({ error: "Email sending is not switched on yet. Copy the text and send it yourself, then mark it done." });
    }
    const d = load();
    const x = d.drafts.find((y) => y.id === req.params.id);
    if (!x) return res.status(404).json({ error: "Draft not found." });
    if (x.status === "done") return res.status(409).json({ error: "This one has already gone out." });
    if (x.status !== "approved") return res.status(409).json({ error: "Approve it first." });
    const subject = x.subject || `A note from ${deps.shop.name}`;
    const replyTo = process.env.INVOICE_REPLY_TO || deps.shop.email;

    try {
      if (x.agent === "reply") {
        const msgs = deps.loadMessages();
        const m = msgs.find((y) => y.id === x.target?.messageId);
        if (!m) return res.status(404).json({ error: "The customer's message is no longer on file." });
        if (!looksLikeEmail(String(m.reach || ""))) return res.status(409).json({ error: "They left a phone number, not an email. Copy the reply and text it." });
        await sendEmail({ to: m.reach, replyTo, subject, text: x.body.replace(/\{first_name\}/g, firstName(m.name)) });
        m.handled = true;
        deps.saveMessages(msgs);
        x.doneNote = `Emailed to ${m.reach}`;
      } else if (x.agent === "review_request") {
        const bookings = deps.loadBookings();
        const b = bookings.find((y) => y.id === x.target?.bookingId);
        if (!b || !looksLikeEmail(String(b.email || ""))) return res.status(404).json({ error: "That customer's booking or email is no longer on file." });
        await sendEmail({ to: b.email, replyTo, subject, text: x.body.replace(/\{first_name\}/g, firstName(b.name)) });
        b.reviewRequestedAt = now();
        deps.saveBookings(bookings);
        x.doneNote = `Emailed to ${b.email}`;
      } else if (x.agent === "campaign") {
        const unsub = new Set(d.unsubscribed);
        const seen = new Set<string>();
        const recipients = deps
          .loadBookings()
          .filter((b) => b.marketingConsent && looksLikeEmail(String(b.email || "")))
          .filter((b) => {
            const e = String(b.email).toLowerCase();
            if (unsub.has(e) || seen.has(e)) return false;
            seen.add(e);
            return true;
          });
        if (!recipients.length) return res.status(409).json({ error: "Nobody on the list yet — only customers who ticked the offers box can be emailed." });
        const base = `${req.protocol}://${req.get("host")}`;
        let sent = 0;
        let failed = 0;
        for (const b of recipients) {
          const email = String(b.email).toLowerCase();
          const link = `${base}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(d, email)}`;
          const footer = `\n\n—\n${deps.shop.name} · ${deps.shop.address}\nYou're getting this because you asked for offers when you booked with us.\nUnsubscribe: ${link}`;
          try {
            await sendEmail({ to: b.email, replyTo, subject, text: x.body.replace(/\{first_name\}/g, firstName(b.name)) + footer, headers: { "List-Unsubscribe": `<${link}>` } });
            sent += 1;
          } catch (err) {
            failed += 1;
            logEvent("error", "marketing.campaign.send_failed", errorFields(err));
          }
        }
        d.campaigns.unshift({ draftId: x.id, subject, sentAt: now(), sent, failed });
        x.doneNote = `Sent to ${sent} customer${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`;
        if (!sent) {
          save(d);
          return res.status(502).json({ error: "None of the emails went out. Nothing was marked as sent; try again later." });
        }
      } else {
        return res.status(409).json({ error: "This one is posted by hand: copy it, post it, then mark it done." });
      }
      x.status = "done";
      x.updatedAt = now();
      save(d);
      logEvent("info", "marketing.sent", { agent: x.agent });
      res.json({ draft: x, message: x.doneNote });
    } catch (err) {
      logEvent("error", "marketing.send.failed", errorFields(err));
      res.status(502).json({ error: "The email did not send. Nothing was marked as sent; try again." });
    }
  });

  /** The link in every campaign email. Public, but only works with its signature. */
  app.get("/api/unsubscribe", deps.limiter, (req, res) => {
    const email = String(req.query.e || "").toLowerCase();
    const token = String(req.query.t || "");
    const page = (msg: string) =>
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${deps.shop.name}</title>` +
      `<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#18181b"><h1 style="font-size:1.3rem">${deps.shop.name}</h1><p>${msg}</p></body>`;
    try {
      const d = load();
      const expected = unsubToken(d, email);
      if (!email || token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
        return res.status(400).send(page(`That link didn't work. To stop our emails, reply to any of them or call ${deps.shop.phone}.`));
      }
      if (!d.unsubscribed.includes(email)) d.unsubscribed.push(email);
      save(d);
      const bookings = deps.loadBookings();
      let changed = false;
      for (const b of bookings) {
        if (String(b.email || "").toLowerCase() === email && b.marketingConsent) {
          delete b.marketingConsent;
          changed = true;
        }
      }
      if (changed) deps.saveBookings(bookings);
      logEvent("info", "marketing.unsubscribed");
      res.send(page("You're unsubscribed. You won't get offers from us again. Emails about a job you've booked will still reach you."));
    } catch (err) {
      logEvent("error", "marketing.unsubscribe.failed", errorFields(err));
      res.status(500).send(page(`Something went wrong. Please reply to the email or call ${deps.shop.phone} and we'll take you off the list.`));
    }
  });

  /* ------------------------------------------------------------------------
   * Autopilot: drafts appear on their own. Still nothing goes out unapproved.
   * Daily after 6am shop time: replies and review requests. Mondays: the
   * week's posts and the market brief.
   * ---------------------------------------------------------------------- */
  async function autopilotTick() {
    if (!aiEnabled()) return;
    let d: MarketingData;
    try {
      d = load();
    } catch {
      return;
    }
    if (!d.settings.autopilot) return;
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" })
        .formatToParts(new Date())
        .map((p) => [p.type, p.value])
    );
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    if (Number(parts.hour) < 6) return;
    const jobs: AgentId[] = [];
    if (d.settings.lastDailyRun !== today) jobs.push("reply", ...(d.settings.googleReviewUrl ? (["review_request"] as AgentId[]) : []));
    if (parts.weekday === "Mon" && d.settings.lastWeeklyRun !== today) jobs.push("content", "radar");
    if (!jobs.length) return;
    // Record the day first, so a failure does not retry every half hour.
    if (d.settings.lastDailyRun !== today) d.settings.lastDailyRun = today;
    if (jobs.includes("content")) d.settings.lastWeeklyRun = today;
    save(d);
    for (const job of jobs) {
      try {
        await runAgent(job, {});
      } catch (err) {
        recordFailure(job, err);
        logEvent("error", "marketing.autopilot.failed", { agent: job, ...errorFields(err) });
      }
    }
  }
  const timer = setInterval(() => void autopilotTick(), 30 * 60_000);
  timer.unref();
}
