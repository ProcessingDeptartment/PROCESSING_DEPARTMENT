# CLAUDE.md — Processing Department App

## Project overview

Static site (Render) + API server (Render) + Neon Postgres + GitHub auto-deploy.

- **Public site**: `https://processing-department.onrender.com` — serves `public/` folder, auto-deploys on push to `main`
- **API**: `https://processing-department-api.onrender.com` — Node/Express, also auto-deploys on push
- **Database**: Neon Postgres (serverless), accessed via Prisma
- **Repo**: `https://github.com/ProcessingDeptartment/PROCESSING_DEPARTMENT` on `main`

---

## Critical architecture: how record definitions reach the browser

Record forms do NOT read from the live API at page load. The sequence is:

```
Neon DB (source of truth)
  → scripts/export-record-defs.mjs   ← must run after any DB change
  → public/data/record-defs/<recordKey>.json   ← static snapshot
  → committed to git + pushed to main
  → Render deploys → CDN serves file
  → form-record.js reads this file first (falls back to API if missing)
```

**After any change to a record definition in the DB, you must:**
1. Run `node scripts/export-record-defs.mjs` (needs `DATABASE_URL` in env)
2. Commit and push `public/data/record-defs/<recordKey>.json`
3. Render will auto-deploy within ~30 seconds

If you cannot run the script (no local DB access), manually edit the JSON file to match the DB state and commit it.

---

## Key files

| File | Purpose |
|------|---------|
| `public/lib/form-record.js` | Main form engine (~236 KB). Handles render, roster, PDF print, sign-off |
| `public/data/record-defs/<key>.json` | Static record config snapshots (what the browser actually reads) |
| `src/record-def.js` | `assembleRecordConfig()` — builds config object from DB via Prisma |
| `scripts/export-record-defs.mjs` | Reads DB, writes all `public/data/record-defs/*.json` files |
| `public/records/REC-*.html` | One HTML shell per record form |
| `public/styles/record-theme.css` | Shared form styles |
| `public/lib/signoff-block.js` | Sign-off / approval section |
| `public/lib/api-backend.js` | Client-side API calls; serves cached → static file → live API |

---

## Version cache-busting

HTML pages load JS with `?v=N` query params, e.g.:

```html
<script src="../lib/form-record.js?v=80"></script>
```

**Whenever `form-record.js` changes**, bump the version number in every HTML file that references it. Otherwise browsers will serve the old cached version.

Quick check — files that reference form-record.js:
```bash
grep -rl "form-record.js" public/records/
```

---

## Record definition structure (JSON schema summary)

```jsonc
{
  "recordKey": "drying-process",
  "docCode": "REC 7.4.1",
  "title": "Drying Process",
  "printCompact": true,          // compact PDF (9.5px font, 8mm margins)
  "jobInfoGroup": "Job info",
  "batchField": "jobNo",
  "listColumns": ["entryDate", "jobNo", "roster:count"],

  "roster": {
    "title": "Steams",
    "cardRows": true,            // renders as cards on screen
    "printTable": true,          // renders as flat table in PDF
    "titleFrom": "steamNo",
    "rowTitle": "Steam",
    "titleDate": "steamDate",    // shows date suffix on card heading, e.g. "Steam 3 · 5 Oct"
    "columns": [ /* ... */ ]
  },

  "sections": [
    {
      "title": "Job info",
      "cols": 4,                 // 4-column grid layout
      "collapsible": true,
      "summaryField": ["jobNo", "jiProcessingFor"],
      "fields": [ /* ... */ ]
    },
    {
      "title": "Progress of product",
      "jobSoFarPanel": true,     // special panel showing job timeline
      "fields": []
    },
    {
      "title": "Trolleys",
      "trolleyBanner": true,     // renders a styled display-only banner
      "bannerField": "noOfTrolleys",
      "bannerLabel": "No. of trolleys for this job",
      "fields": []
    },
    {
      "title": "Movements",
      "movementBlock": true,
      "afterRoster": true,       // rendered after the roster section
      "fields": [ /* ... */ ]
    }
  ],

  "autofill": [ /* watch a field and fill others from another record */ ]
}
```

### Special section flags

| Flag | Effect |
|------|--------|
| `jobSoFarPanel: true` | Renders the "job so far" progress panel |
| `trolleyBanner: true` | Renders a read-only styled banner showing `bannerField` value |
| `movementBlock: true` | Renders the movement tracking UI |
| `legacyBlock: true` | Renders legacy/migrated values block |
| `afterRoster: true` | Section is placed after the roster (steams) section |
| `collapsible: true` | Section has a collapse/expand toggle |
| `cols: N` | Job info grid column count (default 2) |

---

## Database tables (Prisma / Neon)

Main record definition tables:
- `RecordDefinition` — one row per record type (`recordKey`, top-level config)
- `RecordSectionDef` — sections ordered by `position` (0-based)
- `RecordFieldDef` — fields within sections
- `RosterColumnDef` — columns within the roster (repeat-row section)

After any SQL change to these tables, run `export-record-defs.mjs`.

---

## PDF / print behaviour

- `printCompact: true` on the root config → adds `.fr-sheet-compact` class during print → 9.5px font, 8mm margins → fits full form on 1 A4 page
- `roster.printTable: true` → steams rendered as flat HTML table in PDF (not cards)
- `roster.titleDate: "steamDate"` → card heading shows date, e.g. "Steam 3 · 5 Oct"

---

## Common tasks

### Add a new field to a record

1. Add row to `RecordFieldDef` in Neon DB (via `console.neon.tech`)
2. Run `node scripts/export-record-defs.mjs`
3. Commit and push the updated `public/data/record-defs/<key>.json`

### Add a new section

1. Add row to `RecordSectionDef` with the next `position` value and correct `extraJson`
2. Run export script, commit, push

### Change form-record.js behaviour

1. Edit `public/lib/form-record.js`
2. Bump `?v=N` in all referencing HTML files (grep for `form-record.js`)
3. Commit and push both the JS and the HTML files

### Debug: form not showing new config

Check in browser devtools → Network tab:
- Is `drying-process.json` returning the new content? (check response, not just status — may be cached)
- Is `form-record.js?v=N` loading the correct version?
- Hard refresh: `Ctrl+Shift+R` (Windows/Chrome)

---

## Environment variables

- `DATABASE_URL` — Neon connection string (needed to run `export-record-defs.mjs` and for the API server)
- Set in Render dashboard for the API service; set locally in `.env` for script runs

---

## Deployment

Push to `main` → Render auto-deploys both the static site and the API service (~30–60s).

No build step for the static site — Render serves `public/` as-is.

The API service runs `npm start` (Node/Express).
