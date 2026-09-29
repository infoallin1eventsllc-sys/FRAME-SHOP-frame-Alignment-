/**
 * The owner's guide, written for Paul rather than for a developer.
 *
 * Plain language on purpose: no "CMS", no "upload the asset", no "navigate to".
 * Every entry answers a job he actually wants done, in the order he is likely to
 * need it, and says where to click.
 */

export interface GuideStep {
  task: string;
  steps: string[];
  note?: string;
}

export interface GuideSection {
  heading: string;
  blurb?: string;
  items: GuideStep[];
}

export const OWNER_GUIDE: GuideSection[] = [
  {
    heading: 'Getting In',
    blurb: 'Everything you control lives behind one login.',
    items: [
      {
        task: 'Open your shop controls',
        steps: [
          'Go to your website.',
          'Scroll to the very bottom and click "Owner Login".',
          'Type your PIN and press Enter.',
        ],
        note: 'Customers never see this. There is no login button anywhere else on the site.',
      },
      {
        task: 'Change your PIN',
        steps: ['Ask Otis. It is set on the server, not in this screen.'],
      },
    ],
  },
  {
    heading: 'Photos On Your Website',
    blurb: 'Open "Owner Photo Control" after logging in.',
    items: [
      {
        task: 'Change the big photo at the top of the front page',
        steps: [
          'Owner Photo Control, section 1.',
          'Click the upload box and pick a photo.',
          'It appears on the front page straight away.',
        ],
        note: 'Photos are cropped, sharpened and shrunk for you. Use the widest shot you have.',
      },
      {
        task: 'Remove the big photo entirely',
        steps: ['Section 1, click "Remove photo (plain dark background)".'],
      },
      {
        task: 'Change your own photo in the About Paul section',
        steps: ['Owner Photo Control, section 2. Upload a photo.'],
        note: 'Upright photos work best here. It is shown tall, not wide.',
      },
      {
        task: 'Change the before-and-after job photos',
        steps: [
          'Owner Photo Control, section 3.',
          'Find the job you want, click "Upload File", pick the photo.',
          '"Reset to Default" puts the original back.',
        ],
      },
    ],
  },
  {
    heading: 'Videos',
    blurb: 'Owner Photo Control, section 4. Videos show on the front page for every customer.',
    items: [
      {
        task: 'Post a video from your computer',
        steps: [
          'Click the video upload box and pick the file.',
          'Wait for the bar to finish. Do not close the window.',
          'It is live on the website as soon as the bar completes.',
        ],
        note: 'The title fills in from the file name. Change it if you want something better.',
      },
      {
        task: 'Post a video from YouTube instead',
        steps: [
          'Put the video on YouTube. Set it to Unlisted if you do not want it on your channel.',
          'Copy the link, paste it in the link box, add a title, click "Add Video By Link".',
        ],
        note: 'Best choice for older phone videos. No size limit and it plays on every device.',
      },
      {
        task: 'If it says the video will not work',
        steps: [
          'The message tells you what to do. Usually: open it in iMovie, choose Share, then Export File.',
          'Upload the copy iMovie makes.',
        ],
        note: 'This is iPhone video that Apple devices play but Android phones cannot. Better to catch it now than have customers see a blank box.',
      },
      {
        task: 'Change the order, or take one down',
        steps: [
          'Use the up and down arrows next to each video to reorder.',
          'The bin icon removes it from the website.',
        ],
        note: 'Removing a video you uploaded also deletes the file, so it stops using up storage.',
      },
    ],
  },
  {
    heading: 'Jobs And Appointments',
    blurb: 'Open "Work Orders & Appointments". Bookings from the website land here.',
    items: [
      {
        task: 'See new booking requests',
        steps: [
          'New ones show as Pending and are counted at the top.',
          'Click "Refresh" if you have had the screen open a while.',
        ],
      },
      {
        task: 'Move a job along',
        steps: [
          'Pending means the customer asked, you have not agreed a date.',
          'Confirmed means the date is booked.',
          'In Shop means the bike is with you.',
          'Completed means it is finished and ready to collect.',
        ],
        note: 'Customers see this on the website using "Track Ticket" and their ticket number, so keeping it current saves you phone calls.',
      },
      {
        task: 'Call the customer',
        steps: ['Click the phone number on the job to ring or text them.'],
      },
    ],
  },
  {
    heading: 'Getting Paid',
    blurb: 'Online payments go through Shopify. The website raises the invoice and keeps track of what has been paid.',
    items: [
      {
        task: 'Bill a customer for a finished job',
        steps: [
          'Open Work Orders and find the job.',
          'Click "Create Owner Invoice". It starts with the booked service at your price from My Rates.',
          'Add more lines with "Add from my rates" or "Add Custom Item", then click "Save Invoice".',
          'To send it, pick one:',
          '"Email PDF" — emails the customer the invoice as a PDF. When they reply, it lands in the shop\'s Gmail.',
          '"Email Pay Link" — Shopify emails them a link to pay the balance online by card.',
          '"Download PDF" — saves the PDF so you can text it, print it or hand it over.',
        ],
        note: 'Supplies and sales tax are included, and any deposit already paid is taken off. An online payment marks the job paid by itself; money taken in person you record yourself (below).',
      },
      {
        task: 'Take a payment at the counter',
        steps: [
          'Take the money as usual — cash, check, or your card reader.',
          'Open the job\'s invoice, enter the amount under "Payments received", choose how they paid, and click "Record payment".',
        ],
        note: 'A sale rung up on the Shopify app is not linked to the job, so record it here as "Card in shop" too. Made a typing mistake? The bin icon next to a payment you entered removes it.',
      },
      {
        task: 'Get your numbers into a spreadsheet',
        steps: ['On Work Orders, click "Invoices Excel". On My Rates, click "Excel" for your price list.'],
      },
    ],
  },
  {
    heading: 'Your Marketing',
    blurb: 'Open "Marketing". Assistants draft the work; you approve every word before anything goes out.',
    items: [
      {
        task: 'Get the week\'s posts written',
        steps: [
          'Marketing → "Run an assistant" → Content planner → Run.',
          'Open "To approve". Read each post, change anything, fill in any [ask Paul: …] gaps.',
          'Press Approve, then Copy, paste it into Instagram, Facebook or Google, and press Mark posted.',
        ],
        note: 'Posts are written from your finished jobs and your notes on them. The more you write in the tech notes, the better the posts get.',
      },
      {
        task: 'Answer customer messages faster',
        steps: [
          'Run "Inbox replies". Each waiting message gets a drafted answer.',
          'Edit it, press Approve, then Send email — or Copy it into a text if they left a phone number.',
        ],
      },
      {
        task: 'Get more Google reviews',
        steps: [
          'Once: Marketing → Settings → paste your Google review link.',
          'Run "Review requests" after jobs are finished. Approve and send.',
        ],
        note: 'Never offer anything in return for a review — Google removes reviews that were paid for in any way.',
      },
      {
        task: 'Email your regulars',
        steps: [
          'Run "Email campaign" and say what it is for, e.g. "spring check-ups".',
          'Approve it, then Send. It goes only to customers who ticked "send me offers".',
        ],
        note: 'Every email carries an unsubscribe link, as the law requires. Someone who unsubscribes is taken off automatically.',
      },
      {
        task: 'Let it run itself',
        steps: ['Marketing → Settings → tick Autopilot → Save.'],
        note: 'Every morning it drafts replies and review requests; every Monday, the week\'s posts and a market brief. Drafts only — nothing goes out until you approve it.',
      },
      {
        task: 'See what is working',
        steps: ['Marketing → Results.'],
        note: '"Where customers heard about you" comes from the new question on the booking form, so it fills in over the first few weeks.',
      },
    ],
  },
  {
    heading: 'Your Prices',
    blurb: 'Open "My Rates". Only you see this.',
    items: [
      {
        task: 'Set what you charge',
        steps: [
          'Type your labor rate, shop supplies percentage and sales tax.',
          'Check the price next to each service, change any that are wrong, and add or remove services.',
          'Click "Save rates". New invoices use them from then on.',
        ],
        note: 'The first time you open it, the prices shown are the "starting at" prices your website shows customers. Nothing is used until you save. "Print" gives you a paper copy.',
      },
    ],
  },
  {
    heading: 'If Something Looks Wrong',
    items: [
      {
        task: 'A change you made is not showing',
        steps: ['Reload the page. On a Mac hold Command and Shift and press R.'],
      },
      {
        task: 'A video shows a blank box',
        steps: [
          'If it is a YouTube video from someone else, they have blocked it from playing on other sites. Use a different video.',
          'Click "Open original" underneath to watch it on YouTube.',
        ],
      },
      {
        task: 'Anything else',
        steps: ['Call Otis at Meridian Interface. Say what you clicked and what happened.'],
      },
    ],
  },
];
