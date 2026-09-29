<p><img src="assets/meridian-letterhead.png" alt="Meridian Interface" width="220"></p>

*Web design, mobile app interfaces, analytics & CRM dashboards, and brand identity systems.*
[meridianinterface.com](https://meridianinterface.com) · 281-882-9198 · [otis@meridianinterface.com](mailto:otis@meridianinterface.com)

---

# The Frame Shop — Paul's go-live steps

Do these in order. Don't skip ahead: each part needs the one before it.
Tick each box as you go. If a step doesn't work the way it says, **stop**,
take a screenshot, note what you tapped just before, and send it to Otis.
Nothing you do on the trial site can harm the live website.

Everything runs on accounts in **the shop's name**, paid for by the shop.
Keys and passwords are typed straight into the hosting settings, with Otis beside you.
**Never** email, text or paste a key into a shared document.

---

## Part 1 — Create the shop's accounts (Paul, with Otis, about 1–2 hours)

1. [ ] **Website domain.** If the shop doesn't own one yet (e.g. `theframeshop.com`), buy one.
   Email can't be sent from a Gmail address. It has to come from a domain the shop owns.
2. [ ] **Hosting.** Create an account on Railway or Render. Otis sets up the site with a
   *permanent disk*, so bookings survive a restart.
3. [ ] **Owner PIN.** Choose a PIN of at least 6 digits that only you know (not 123456 or a repeated digit). Otis sets it, along with a
   long secret key the server generates.
4. [ ] **Shopify** (card payments, deposits, pay links).
   1. In the Shopify admin: Settings → Apps and sales channels → Develop apps → create an app.
   2. Give it `write_draft_orders` and `read_orders`, then install it. Otis copies the token
      into the hosting settings.
   3. Settings → Notifications → Webhooks → create an **Order payment** webhook pointing at
      `https://<your-domain>/api/shopify/webhook`. Otis copies the signing secret.
5. [ ] **Resend** (emailing invoices and the morning summary). Create an account at resend.com,
   add the shop's domain, and add the DNS records it shows at your domain provider. When it
   says *Verified*, create an API key. Customer replies go to theframeshop13@gmail.com.
6. [ ] **Anthropic** (the Marketing assistants). Create an account at console.anthropic.com,
   add a card, **set a monthly spending limit**, then create an API key.
7. [ ] **Google AI Studio** (the "What's wrong with my bike?" diagnostic). Create an API key,
   and set a budget cap in Google Cloud billing.
8. [ ] **Video storage (Supabase)**, optional. Only needed to upload video files instead of
   pasting YouTube links. Make a **new** key. The old one was exposed and must not be used.
9. [ ] **Otis checks:** the site opens at its web address, the Owner Login accepts your PIN, and
   `APP_URL` is set to that address (it's what Google and link previews show).

## Part 2 — Set up the shop (Paul, about 30 minutes)

Open the website, tap **Owner Login** at the bottom of the page, and enter your PIN.

10. [ ] **My Rates:** check every price. Set your labor rate, shop supplies %, and sales tax,
    then press **Save rates**. ✅ The "Not saved yet" warning disappears.
11. [ ] **Sales tax:** before you bill a real customer, confirm with your accountant the tax
    rate, and whether repair labor is taxed in Texas.
12. [ ] **Owner Photo Control:** upload a real photo of yourself and at least one real job photo.
    ✅ They show on the homepage when you open it on another phone.
13. [ ] **Marketing → Settings:** paste your Google review link. Read "How you sound" and change
    anything that doesn't sound like you. Press **Save settings**.
14. [ ] **Marketing → Settings → Send me a test now.** ✅ The email arrives at
    theframeshop13@gmail.com. Check your spam folder too, and if it's there, mark it "Not spam".

## Part 3 — Customers and jobs (from your phone, as if you were a customer)

15. [ ] **Book a job** on the website with a real bike. Answer "How did you hear about us?" and
    tick the offers box. ✅ You get a ticket number, and within a minute the job appears in
    **Work Orders** showing the source and "OK to send offers".
16. [ ] **Track it:** tap **Track Ticket** and enter the ticket number. ✅ It shows the job and its status.
17. [ ] **Move it along:** Confirm Lift → In Shop → Mark Completed. Add tech notes: what was wrong,
    what you measured, what you did. ✅ The tracker shows each new status.
18. [ ] **Send a message** from the contact form. ✅ It appears under **Customer Messages** with a
    "new" count, and you can mark it replied.

## Part 4 — Getting paid

Use your own email address as the customer, so every invoice comes to you. For anything that
takes a real card, use a small amount ($1–$5), then refund it in Shopify afterwards.

19. [ ] **Deposit:** book a job and pay the $75 deposit online. ✅ The job shows "$75 paid in advance".
20. [ ] **Create the invoice** on that job. ✅ It starts with the booked service at your price,
    and the $75 is already taken off the balance.
21. [ ] **Add a part and some labor**, then press **Save Invoice**. ✅ The supplies, tax, total
    and balance are the numbers you would charge.
22. [ ] **Email PDF.** ✅ The PDF arrives, looks right, and shows the balance. Your private notes
    are not on it.
23. [ ] **Email Pay Link**, then pay it. ✅ The job turns "Paid in full" by itself.
24. [ ] **Record payment** (cash) on another job, then remove it. ✅ The balance goes down, then
    back up.
25. [ ] **Download PDF**, **System Print**, and **Bluetooth Print** (if you have the receipt
    printer). ✅ Each shows the shop's real address and phone.
26. [ ] **Invoices Excel.** ✅ The spreadsheet opens and shows what's been paid and what's still owed.

## Part 5 — Marketing

Everything the assistants write waits in **Marketing → To approve**. Nothing is posted or sent
until you approve it. Read every draft as a customer would. If anything in it is untrue, don't
approve it.

27. [ ] **Content planner:** finish 2–3 real jobs with good tech notes first, then run it.
    ✅ The posts describe those real jobs. Every [ask Paul] gap is something only you know. Nothing is
    made up: no fake reviews, numbers, years, or guarantees.
28. [ ] **Film one TikTok** from a draft's "Video to film" plan, and post it with the caption.
    ✅ It was something you could film in the shop in under 15 minutes.
29. [ ] **Post one Instagram or Facebook draft:** Approve → Copy → paste into the app → **Mark posted**.
    ✅ It appears under "Sent & posted".
30. [ ] **Inbox replies:** send yourself a question through the contact form, then run the
    assistant, edit the reply, and send it. ✅ The reply answers the question in your voice and
    arrives in your inbox.
31. [ ] **Review replies:** paste in one of your real Google reviews. ✅ You'd post the reply as
    written, or with small edits.
32. [ ] **Review requests:** finish a job booked under your own email, then run the assistant,
    approve, and send. ✅ The email has your Google review link and offers nothing in return.
33. [ ] **Email campaign:** with only your own booking ticked for offers, run it with a real goal
    and send. ✅ Only you receive it, and the unsubscribe link at the bottom takes you off the list.
34. [ ] **Market radar:** run it. ✅ The brief is about real local shops and events, and each
    source link opens.
35. [ ] **Morning email:** leave a draft unapproved overnight. ✅ An email arrives after 7am
    saying what's waiting.
36. [ ] **Results.** ✅ Your test bookings show under the right "heard about us" answer, and the
    money figures match your invoices.

## Part 6 — Photos and videos

37. [ ] **Upload a video you filmed upright on your phone** in Owner Photo Control. ✅ It plays by
    itself on the homepage, fills the phone screen, and plays on both an iPhone and an Android phone.
38. [ ] **Add a YouTube video by its link.** ✅ It plays on the homepage.
39. [ ] **Change a case-study photo, then reset it.** ✅ Both changes show on another phone after a refresh.

## Part 7 — Before the site goes live

40. [ ] Every box above is ticked, or Otis has fixed the problem and you have re-checked it.
41. [ ] You have read the draft Privacy, Terms, Refunds and Cookies pages and filled in the
    highlighted gaps, and a lawyer has reviewed them.
42. [ ] You have answered the open questions: years in business ("EST. 1998" or "30+ years"),
    "1,200+ frames", whether the case studies are real jobs, what the guarantees cover, how
    fast you promise to reply to messages, which Google reviews the site may quote, and
    whether you want visitor statistics on the site.
43. [ ] You have approved and posted **one real week** of marketing. ✅ It took under an hour.
44. [ ] Otis deletes the test bookings, invoices and messages, so the live site starts clean.

Signed off by Paul Hurey: ____________________  Date: __________

Signed off by Otis Williams: ____________________  Date: __________

---

*Prepared for The Frame Shop by Meridian Interface · [meridianinterface.com](https://meridianinterface.com) · 281-882-9198 · [otis@meridianinterface.com](mailto:otis@meridianinterface.com)*
