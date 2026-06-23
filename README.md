# Frame Shop — Frame & Alignment Tracker

A management interface for a custom automotive frame and alignment shop. It brings billing, the project/build pipeline, and customer records into one dashboard so the shop can see what's in progress, who it's for, and what's owed — without juggling paper tickets and spreadsheets.

## What it does

- **Billing** — create, search, filter, and paginate invoices, each tied to a customer and a project, with statuses like Paid, Pending, Overdue, and Parts Wait, plus running totals for billed, collected, and outstanding amounts.
- **Projects / Builds tracker** — track each build (frame modification, TIG welding, CNC work, alignments) through its lifecycle: Queued, In Progress, Parts Wait, Completed, Delivered — with estimated vs. actual cost and per-job technician notes.
- **Customers** — manage client records including contact info, outstanding balance, lifetime spend, and notes.
- **Dashboard** — an at-a-glance overview of shop activity.

## Why I built it

Built for a real automotive frame-and-alignment shop that was tracking jobs and billing by hand. The goal was to replace scattered notes with a single, fast interface the crew could actually use on the shop floor — including a mobile layout for use away from a desk.

## Tech stack

- **React 19** + **TypeScript**
- **Vite** (build tool / dev server)
- **Tailwind CSS v4** for styling
- **Framer Motion** for animated view transitions
- **lucide-react** for icons
- React Context API for state management
- Built in **Google AI Studio**

## Getting started

```bash
# clone the repo
git clone https://github.com/infoallin1eventsllc-sys/FRAME-SHOP-frame-Alignment-.git

# move into the folder
cd FRAME-SHOP-frame-Alignment-

# install dependencies
npm install

# run the dev server
npm run dev
```

Then open the local address Vite prints (default `http://localhost:3000`).

## Screenshots <img width="1080" height="810" alt="image" src="https://github.com/user-attachments/assets/b3e489b9-35a8-4fcb-8fd9-6b819a4987d3" />


### Dashboard — Shop Floor Monitor
Live view of active fab queues, work efficiency, outstanding ledger items, and machinery status.

<!-- Drop your Dashboard screenshot directly below this line -->

### Billing — Financial Overview
Real-time ledger showing total billed, outstanding balance, and collected revenue, with searchable, filterable invoices.

<!-- Drop your Billing screenshot directly below this line -->

## About

Built by Otis Williams. [Optional: link to your portfolio, LinkedIn, or other projects.]


