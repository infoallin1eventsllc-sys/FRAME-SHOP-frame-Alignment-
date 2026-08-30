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
    blurb: 'Money is handled in Shopify. The website raises the invoice and keeps track of who has paid.',
    items: [
      {
        task: 'Bill a customer for a finished job',
        steps: [
          'Open Work Orders and find the job.',
          'Click "Create Owner Invoice" and add the labour and parts lines.',
          'Send it. The customer gets an email with a link to pay.',
        ],
        note: 'When they pay, the job marks itself as paid here. You do not have to come back and tick anything off.',
      },
      {
        task: 'Take a payment at the counter',
        steps: ['Use the Shopify app or card reader, the same as any other sale.'],
        note: 'The website does not take cards itself — Shopify does, so all your takings stay in one place for the bookkeeper.',
      },
      {
        task: 'Get your numbers into a spreadsheet',
        steps: ['Click "Invoices Excel" or "Matrix Excel" to download for your bookkeeper.'],
      },
    ],
  },
  {
    heading: 'Your Prices',
    blurb: 'Open "Owner Price Matrix". Only you see this.',
    items: [
      {
        task: 'Change what you charge',
        steps: [
          'Edit the labour rates and parts prices in the table.',
          '"Print Matrix" gives you a paper copy for the wall.',
        ],
        note: 'Your cost and profit columns are for you only. Customers never see this screen.',
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
