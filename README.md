# Processing Department — Front-End Development

A document management system for the Abagold Processing Department. Currently focusing on **front-end HTML/CSS/JavaScript only**. The backend and database layer will be added after all forms are complete and tested.

## Current Status

- All HTML forms and pages complete
- Local storage works (browser-based)
- Backend API integration — coming next
- SQLite/PostgreSQL database — coming after HTML finalized

## Getting Started

1. Install Node.js 18+
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open http://localhost:3000 in your browser

No dependencies to install — the server uses only Node built-ins.

## Project Structure

```
public/
  ├── index.html                 Main landing page
  ├── pages/                     Handover reports and category pages
  ├── records/                   146 document record forms
  ├── sops/                      56 Standard Operating Procedures
  ├── lib/
  │   ├── data-store.js          Storage abstraction — localStorage today
  │   ├── api-backend.js         Placeholder for future API integration
  │   ├── form-record.js         Form record engine
  │   ├── monitoring-log.js      Monitoring log engine
  │   ├── doc-header.js          Document control headers
  │   └── ...other utilities
  ├── styles/
  │   ├── record-theme.css       Shared record styling
  │   └── responsive.css         Mobile/tablet breakpoints
  └── assets/                    Logo, images
```

## How Records Are Built

Record pages are thin. Each one is an empty mount div plus a config block — the actual rendering is done by shared engines (`form-record.js` or `monitoring-log.js`). This means structural changes happen in one library file, not across 146 pages.

## Data Storage

**Today:** All data is stored in the browser's `localStorage`. Data is device-specific.

**Later:** When the backend is ready, forms sync to a central database with no changes to form code. See [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md).

## Cache Busting

Library files are cached hard by browsers. When editing anything in `public/lib/`, bump the `?v=N` on every `<script>` tag that loads it, or stale code silently breaks pages.

## Scripts

- `npm run dev` — Start the development server
- `npm start` — Same as dev
