import React from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { SHOP_INFO } from '../data/shopData';
import { LEGAL_PATHS, cleanPath, type LegalPath } from '../data/routes';
import { Breadcrumbs } from './Breadcrumbs';

/**
 * Privacy, Terms, Deposits & Refunds, and Cookies.
 *
 * Written from what this site actually does with data — every form, every
 * outside service it talks to — not from a template. They are still DRAFTS:
 * nobody has reviewed them for Paul, and the highlighted gaps are facts only
 * he can supply (how long records are kept, what the deposit covers).
 *
 * To publish: fill every <Gap>, have them reviewed, set LEGAL_REVIEWED to true
 * (which removes the draft banner), and update LAST_UPDATED.
 */
export const LEGAL_REVIEWED = false;
const LAST_UPDATED = '28 September 2026';

export { LEGAL_PATHS };
export type { LegalPath };

export function legalPathFor(pathname: string): LegalPath | null {
  const clean = cleanPath(pathname);
  return (LEGAL_PATHS as readonly string[]).includes(clean) ? (clean as LegalPath) : null;
}

/** Something only the owner can fill in. Highlighted so it cannot be missed. */
const Gap: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  LEGAL_REVIEWED ? null : (
    <mark className="bg-amber-100 text-amber-900 px-1 font-semibold not-italic">[{children}]</mark>
  );

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-lg font-black uppercase italic tracking-tight text-zinc-900 pt-6">{children}</h2>
);

const Contact: React.FC<{ start?: boolean }> = ({ start }) => (
  <>
    {start ? 'Call or text' : 'call or text'} <a href={`tel:${SHOP_INFO.phoneRaw}`} className="underline">{SHOP_INFO.phone}</a>, or write to{' '}
    {SHOP_INFO.name}, {SHOP_INFO.address}, or email{' '}
    <a href={`mailto:${SHOP_INFO.email}`} className="underline">{SHOP_INFO.email}</a>
  </>
);

const Privacy = () => (
  <>
    <p>
      This explains what {SHOP_INFO.name} ("we") collects through this website, why, who else sees it, and what you
      can ask us to do with it. It covers this website only.
    </p>

    <H2>What we collect, and why</H2>
    <ul>
      <li>
        <strong>When you book an appointment:</strong> your name, phone number and email; your motorcycle's year, make
        and model; any notes you add; and the date and time you'd prefer. We use these to arrange and carry out the
        work, and to contact you about it.
      </li>
      <li>
        <strong>If you tick "send me offers" when booking:</strong> that you agreed, the exact words you agreed to, and
        when. We only send offers to people who ticked it, and you can opt out at any time. Leaving it unticked does
        not affect your booking.
      </li>
      <li>
        <strong>When you send a message:</strong> your name, the phone number or email you give, and your message. We
        use them to reply.
      </li>
      <li>
        <strong>If you tell us how you heard about us</strong> when booking: that answer, which helps us see which of our
        advertising works. It is optional.
      </li>
      <li>
        <strong>When you use the AI diagnostic tool:</strong> the bike, speed and symptoms you type in. These are sent
        to Google's Gemini service to produce the suggestion you see. The tool does not ask for your name or contact
        details — please don't type them into it.
      </li>
      <li>
        <strong>When you track a repair ticket:</strong> the ticket or phone number you enter, used only to find your
        booking.
      </li>
      <li>
        <strong>When you pay a deposit or invoice:</strong> payment is taken by Shopify on Shopify's own checkout
        page. We never see or store your card details; Shopify tells us the order was paid and how much.
      </li>
      <li>
        <strong>Automatically:</strong> our server sees your IP address with each request and uses it to limit abuse
        (for example, too many bookings from one address in a minute). Our server logs record events such as "booking
        received" with a ticket number; they are written not to include your name, phone number or email.
      </li>
    </ul>
    <p>We do not use analytics or advertising trackers, and we do not sell or rent your information to anyone.</p>

    <H2>Who else handles it</H2>
    <ul>
      <li><strong>Our hosting provider</strong> <Gap>name of host, e.g. Railway</Gap>, which runs this site and stores the booking and message records.</li>
      <li><strong>Shopify</strong>, for payments.</li>
      <li><strong>Google</strong>, for the AI diagnostic tool, and for the map — but only if you press "Show map".</li>
      <li>
        <strong>Anthropic</strong> (Claude), which helps the shop draft replies to messages. It receives the text of your
        message, with phone numbers and email addresses removed — not your name or contact details. Every reply is read and
        approved by the shop before it is sent.
      </li>
      <li><strong>Resend</strong>, which delivers the emails the shop sends you, such as invoices.</li>
      <li><strong>YouTube or Vimeo</strong>, if they host a shop video you watch on this page.</li>
    </ul>
    <p>We may also disclose information where the law requires it.</p>

    <H2>How long we keep it</H2>
    <p>
      Booking and job records: <Gap>e.g. 3 years after the job, for warranty and tax records</Gap>. Messages:{' '}
      <Gap>e.g. 12 months</Gap>. Rolling backups of these records are kept for recovery and replaced as new ones are
      made.
    </p>

    <H2>Your choices</H2>
    <p>
      You can ask to see the information we hold about you, to correct it, or to delete it (unless we must keep it,
      for example for tax records), and you can withdraw consent to offers at any time — every offer email has an
      unsubscribe link that works in one click. To do any of these, <Contact />.
      We will respond within <Gap>e.g. 30 days</Gap>.
    </p>

    <H2>Security</H2>
    <p>
      The site is served over an encrypted connection, the owner's area is protected, and our records are backed up.
      No system is perfectly secure; if a breach affecting your information occurs, we will tell you as the law
      requires.
    </p>

    <H2>Children</H2>
    <p>This site is not intended for children under 13, and we do not knowingly collect their information.</p>

    <H2>Changes</H2>
    <p>If we change this policy, we will update it here and change the date at the top.</p>
  </>
);

const Terms = () => (
  <>
    <p>
      These terms apply to using this website and to booking work with {SHOP_INFO.name}, {SHOP_INFO.address}. By
      booking, you agree to them.
    </p>

    <H2>Bookings</H2>
    <p>
      A booking made on this site is a <strong>request</strong>. It is not confirmed until the shop confirms it with
      you. We work {SHOP_INFO.hours.toLowerCase()}.
    </p>

    <H2>Estimates and the AI diagnostic tool</H2>
    <p>
      The AI diagnostic tool and the rake &amp; trail calculator give general guidance only. They are not an
      inspection, a diagnosis or a quote. What your motorcycle needs, and what it will cost, is set only after we have
      inspected it. Any price given before inspection is an estimate.
    </p>

    <H2>Before and during the work</H2>
    <p>
      Please tell us about any previous accident, frame damage, or modification you know of. We will contact you
      before doing work beyond what you approved. <Gap>Paul to confirm: whether additional work over a set amount
      needs written or verbal approval</Gap>.
    </p>

    <H2>Collection and payment</H2>
    <p>
      Payment is due when the work is complete, before the motorcycle is released. Motorcycles not collected within{' '}
      <Gap>e.g. 7 days</Gap> of our telling you they are ready may be charged storage at <Gap>rate</Gap>. Under Texas
      law, a repair shop may hold a vehicle until the repair bill is paid.
    </p>

    <H2>Workmanship</H2>
    <p>
      <Gap>Paul to write: what the shop guarantees, for how long, and what it excludes — e.g. crash damage, later
      modifications, parts supplied by the customer. Every "guarantee" mentioned elsewhere on this site should point
      here.</Gap>
    </p>

    <H2>Deposits and refunds</H2>
    <p>
      See <a href="/refunds" className="underline">Deposits &amp; Refunds</a>.
    </p>

    <H2>Liability</H2>
    <p>
      Nothing in these terms limits any right you have under Texas or federal law, including the Texas Deceptive
      Trade Practices Act. <Gap>Any further limitation of liability to be written with a lawyer — not drafted here</Gap>.
    </p>

    <H2>This website</H2>
    <p>
      The text, photographs and design of this site belong to {SHOP_INFO.name} or are used with permission. Please
      don't copy them without asking.
    </p>

    <H2>Law</H2>
    <p>These terms are governed by the laws of the State of Texas. <Gap>Confirm venue — county</Gap>.</p>

    <H2>Contact</H2>
    <p>Questions about these terms: <Contact />.</p>
  </>
);

const Refunds = () => (
  <>
    <p>How deposits, cancellations and refunds work at {SHOP_INFO.name}.</p>

    <H2>The inspection deposit</H2>
    <p>
      When you book, you can choose to pay a <strong>$75 inspection deposit</strong> online. It is optional. It is{' '}
      <Gap>Paul to confirm: applied to your final bill / kept as the inspection fee</Gap>.
    </p>

    <H2>If you cancel or reschedule</H2>
    <ul>
      <li>With at least <Gap>e.g. 48 hours'</Gap> notice: your deposit is refunded in full, or moved to your new date.</li>
      <li>With less notice, or if you don't arrive: <Gap>Paul to decide — e.g. the deposit is kept</Gap>.</li>
      <li>If we have to cancel: your deposit is refunded in full.</li>
    </ul>

    <H2>Completed work</H2>
    <p>
      Labor already carried out can't be returned, so it is not refunded. If you are unhappy with work we did, tell us
      within <Gap>e.g. 14 days</Gap> and we will inspect it and put right anything that falls short of what we agreed.
      See the workmanship section of our <a href="/terms" className="underline">terms</a>.
    </p>

    <H2>Parts</H2>
    <p>
      <Gap>Paul to confirm: whether unused special-order parts can be returned, and any restocking charge</Gap>.
    </p>

    <H2>How refunds are paid</H2>
    <p>
      Refunds go back to the card you paid with, through Shopify, within <Gap>e.g. 5 business days</Gap> of our
      agreeing them. Your bank may take a few more days to show it.
    </p>

    <H2>Ask for a refund</H2>
    <p>
      <Contact start />, with your ticket number.
    </p>
  </>
);

const Cookies = () => (
  <>
    <p>A cookie is a small file a website stores in your browser. Here is everything this site stores, and what other services may.</p>

    <H2>This site</H2>
    <p>
      This site sets <strong>no cookies</strong> and uses no analytics or advertising trackers. The only thing it
      stores in your browser is a sign-in token for the shop owner's area, which ordinary visitors never use and which
      is deleted when the browser tab closes.
    </p>

    <H2>Other services, only when you use them</H2>
    <ul>
      <li>
        <strong>Google Maps:</strong> the map in the contact section does not load until you press "Show map". Once
        loaded, Google may set its own cookies. "Get directions" opens Google Maps in a new tab instead.
      </li>
      <li>
        <strong>Shop videos:</strong> videos hosted on YouTube play through YouTube's privacy-enhanced mode, and Vimeo
        videos play with Vimeo's do-not-track setting. Both services may still store some information in your browser
        when a video plays, under their own policies.
      </li>
      <li>
        <strong>Payments:</strong> paying a deposit or invoice takes you to Shopify's checkout, which sets its own
        cookies on its own site.
      </li>
    </ul>

    <H2>Your control</H2>
    <p>
      You can block or delete cookies in your browser's settings. Doing so won't stop you booking, messaging or
      tracking a ticket on this site.
    </p>

    <H2>Questions</H2>
    <p>
      <Contact start />. See also our <a href="/privacy" className="underline">privacy policy</a>.
    </p>
  </>
);

const PAGES: Record<LegalPath, { title: string; body: React.FC }> = {
  '/privacy': { title: 'Privacy Policy', body: Privacy },
  '/terms': { title: 'Terms of Service', body: Terms },
  '/refunds': { title: 'Deposits & Refunds', body: Refunds },
  '/cookies': { title: 'Cookies', body: Cookies },
};

export const LegalPage: React.FC<{ path: LegalPath }> = ({ path }) => {
  const { title, body: Body } = PAGES[path];

  React.useEffect(() => {
    document.title = `${title} — ${SHOP_INFO.name}`;
  }, [title]);

  return (
    <div className="min-h-screen bg-white text-zinc-800 font-sans">
      <header className="bg-zinc-950 border-b-4 border-orange-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <a href="/" className="font-black text-zinc-100 uppercase italic tracking-tighter text-lg">
            THE FRAME <span className="text-orange-600">SHOP</span>
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-orange-500">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to site
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Breadcrumbs current={title} />

        {!LEGAL_REVIEWED && (
          <div role="note" data-testid="legal-draft-banner" className="mb-8 border-2 border-amber-500 bg-amber-50 p-4 flex gap-3 text-sm text-amber-900">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <p>
              <strong>Draft — not yet reviewed.</strong> This page describes what the site actually does, but it has not
              been checked by a lawyer, and highlighted items are still to be filled in by the shop.
            </p>
          </div>
        )}

        <h1 className="text-3xl sm:text-4xl font-black uppercase italic tracking-tighter text-zinc-900" style={{ textWrap: 'balance' }}>
          {title}
        </h1>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-2">
          {LEGAL_REVIEWED ? 'Last updated' : 'Draft of'} {LAST_UPDATED}
        </p>

        <article className="mt-6 space-y-4 text-[15px] leading-relaxed max-w-[65ch] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:text-orange-700">
          <Body />
        </article>

        <nav aria-label="Policies" className="mt-12 pt-6 border-t border-zinc-200 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold uppercase tracking-wider">
          {LEGAL_PATHS.map((p) => (
            <a key={p} href={p} aria-current={p === path ? 'page' : undefined} className={p === path ? 'text-orange-700' : 'text-zinc-600 hover:text-orange-700'}>
              {PAGES[p].title}
            </a>
          ))}
        </nav>
      </main>
    </div>
  );
};
