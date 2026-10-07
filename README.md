# Processing Department — Document Management System

A full-stack document management system for the Abagold Processing Department, built on a static front-end served by Render, a Node/Express API, and a Neon Postgres database accessed via Prisma.

## Live Environment

| Service | URL |
|---------|-----|
| Public site | `https://processing-department.onrender.com` |
| API server | `https://processing-department-api.onrender.com` |
| Database | Neon Postgres (serverless, via Prisma) |
| Repo | `https://github.com/ProcessingDeptartment/PROCESSING_DEPARTMENT` on `main` |

Push to `main` → Render auto-deploys both the static site and the API service (~30–60 s). No build step for the static site — Render serves `public/` as-is.

## Getting Started (local development)

1. Install Node.js 18+
2. Copy `.env.example` to `.env` and add your `DATABASE_URL` (Neon connection string)
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000

## Project Structure

```
public/
  ├── index.html                 Main landing page
  ├── pages/                     Handover reports and category pages
  ├── records/                   Record forms (REC-*.html)
  ├── sops/                      Standard Operating Procedures
  ├── data/
  │   └── record-defs/           Static JSON snapshots of record configs (read by the browser)
  ├── lib/
  │   ├── form-record.js         Main form engine — render, roster, PDF print, sign-off
  │   ├── monitoring-log.js      Monitoring log engine
  │   ├── signoff-block.js       Sign-off / approval section
  │   ├── api-backend.js         Client-side API calls (cached → static file → live API)
  │   ├── doc-header.js          Document control headers
  │   └── data-store.js          Storage abstraction
  ├── styles/
  │   ├── record-theme.css       Shared record styling
  │   └── responsive.css         Mobile/tablet breakpoints
  └── assets/                    Logo, images
src/
  └── record-def.js              assembleRecordConfig() — builds config from DB via Prisma
scripts/
  └── export-record-defs.mjs     Reads DB, writes all public/data/record-defs/*.json files
```

## How Record Configs Reach the Browser

Record forms do **not** call the live API at page load. The flow is:

```
Neon DB (source of truth)
  → scripts/export-record-defs.mjs   ← run after any DB change
  → public/data/record-defs/<key>.json
  → committed to git + pushed to main
  → Render deploys → CDN serves file
  → form-record.js reads this file (falls back to API if missing)
```

After any change to a record definition in the DB:
1. Run `node scripts/export-record-defs.mjs` (needs `DATABASE_URL` in env)
2. Commit and push the updated `public/data/record-defs/<key>.json`
3. Render deploys automatically within ~30 seconds

## Cache Busting

HTML pages load JS with `?v=N` query params. Whenever `form-record.js` changes, bump the version number in every HTML file that references it — otherwise browsers serve the old cached version.

```bash
# Find all files that reference form-record.js
grep -rl "form-record.js" public/records/
```

## Database

Main tables (Prisma / Neon Postgres):

| Table | Purpose |
|-------|---------|
| `RecordDefinition` | One row per record type — `recordKey`, top-level config |
| `RecordSectionDef` | Sections, ordered by `position` |
| `RecordFieldDef` | Fields within sections |
| `RosterColumnDef` | Columns within the roster (repeat-row section) |

After any SQL change to these tables, run `export-record-defs.mjs`.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon connection string — needed by `export-record-defs.mjs` and the API server |

Set in the Render dashboard for the API service. Set locally in `.env` for script runs.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` / `npm start` | Start the local development server |
| `node scripts/export-record-defs.mjs` | Export all record configs from Neon DB to `public/data/record-defs/*.json` |
| `python scripts/extract_quality_trends.py` | Rebuild `public/data/quality-trends.json` from Quality workbooks in `../Online system/19. Quality report`. Needs `openpyxl`. |

## Documentation

All project markdown is consolidated under `MD_CONSOLIDATED/`. Start with `MD_CONSOLIDATED/00_INDEX.md` for a full topic index. For Claude Code context, see `CLAUDE.md`.
