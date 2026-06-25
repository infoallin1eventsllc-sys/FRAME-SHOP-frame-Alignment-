# CLAUDE.md — Frame Shop Frame & Alignment Tracker

This file documents the codebase structure, development conventions, and workflow guidelines for AI assistants (and human developers) working in this repository.

---

## Project Overview

**Frame Shop — Frame & Alignment Tracker** is a management dashboard for a custom automotive frame and alignment shop. It replaces paper tickets and spreadsheets with a single, fast interface covering billing, the project/build pipeline, and customer records.

Built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4**, and **Framer Motion**. It is a fully client-side single-page app — no backend, no database calls. State lives in React Context.

---

## Repository Structure

The repo currently contains the `README.md` at root. Source files are generated/managed via the Vite scaffold. The expected layout is:

```
frame-shop-frame-alignment-/
├── index.html                    # Vite entry point
├── src/
│   ├── main.tsx                  # React root mount
│   ├── App.tsx                   # Root component + view routing
│   ├── context/                  # React Context providers for global state
│   ├── components/               # Feature components per section
│   │   ├── Dashboard.tsx         # Shop floor monitor overview
│   │   ├── Billing.tsx           # Invoice ledger
│   │   ├── Projects.tsx          # Build pipeline tracker
│   │   └── Customers.tsx         # Client records
│   ├── types.ts                  # Shared TypeScript interfaces
│   └── data/                     # Static mock/seed data
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.ts            # Tailwind v4 config
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite (dev server + bundler) |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion (view transitions) |
| Icons | lucide-react |
| State | React Context API |
| Data | Local in-memory state (no external DB) |

---

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (default http://localhost:3000)
npm run dev

# Type-check
npm run lint      # or: npx tsc --noEmit

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## Application Sections

| Section | Purpose |
|---|---|
| **Dashboard** | Shop floor monitor — active fab queues, work efficiency, outstanding ledger, machinery status |
| **Billing** | Invoice ledger — total billed, outstanding, collected; searchable/filterable, paginated |
| **Projects / Builds** | Build pipeline — each job tracked through Queued → In Progress → Parts Wait → Completed → Delivered |
| **Customers** | Client records — contact info, outstanding balance, lifetime spend, notes |

### Invoice statuses
`Paid` | `Pending` | `Overdue` | `Parts Wait`

### Project/build statuses
`Queued` | `In Progress` | `Parts Wait` | `Completed` | `Delivered`

---

## State Management

State is managed via the **React Context API** — no Redux, Zustand, or other external store. Each major domain (billing, projects, customers) has its own context provider. Components consume these via custom hooks.

Because there is no backend, all data is initialised from static files in `src/data/` and mutated in memory. **Data does not persist across page refreshes** in the current version.

---

## Coding Conventions

- **TypeScript strict.** Define all data shapes in `src/types.ts`. Avoid `any`.
- **One component per section.** `Dashboard`, `Billing`, `Projects`, `Customers` are separate files.
- **Framer Motion for view transitions.** Use `AnimatePresence` and `motion.*` components for section switches — do not use CSS transitions for page-level animations.
- **Tailwind CSS v4 utility classes.** No custom CSS files unless Tailwind cannot cover the case. Tailwind v4 uses the `@import "tailwindcss"` directive instead of `@tailwind base/components/utilities`.
- **lucide-react for all icons.** Do not add a second icon library.
- **Mobile-first.** The shop floor may be accessed on a phone. All layouts must work on small screens.
- **No backend calls.** All data operations are synchronous, in-memory Context mutations. When adding persistence, use a Context-level adapter so components don't change.

---

## Adding a New Feature

1. Define data types in `src/types.ts`
2. Add seed data in `src/data/`
3. Create or extend the relevant Context provider
4. Build the component in `src/components/`
5. Wire navigation in `App.tsx`
6. Add Framer Motion transition if the feature introduces a new top-level view

---

## Build & Deployment

This is a **static SPA** — the `npm run build` output is a `dist/` folder that can be deployed to any static host:

- Netlify (drag-and-drop or Git integration)
- Vercel
- GitHub Pages
- Any CDN

No server-side runtime is required.

---

## Notes for AI Assistants

- There is no authentication layer. This is a single-operator internal tool.
- Do not introduce a backend or database without discussing it first — the intentional constraint is zero infrastructure.
- When modifying the billing or project status enums, update both `src/types.ts` and any UI filters/badges that reference those values.
- Framer Motion animations should feel fast and professional — keep `duration` under 0.3s for transitions.
