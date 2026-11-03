# Processing Department — Full System Overview

_Abagold Processing Facility | Paperless System_
_Last updated: 2026-11-03_

---

## Purpose of this document

This is the single readable overview of the entire processing department paperless system — what it is, how every layer fits together, why it was designed this way, and the reasoning behind the key architectural choices. It is written for onboarding, handover, and as a reference before starting any significant new work.

For fine-grained detail on any layer, see the numbered MD files (`01_` through `09_`). This file sits above them: it gives the **whole picture first**, then points to where the detail lives.

---

## 1. What the system is

The Processing Department Paperless System replaces paper-based quality, food-safety, and production records at Abagold's abalone processing facility.

The facility runs three main product lines:

| Line | Forms prefix | What it covers |
|---|---|---|
| **Canning** | REC-7.2.x | Pre-cooking, packing, retorting, seam inspection, labelling, dispatch |
| **Dry processing** | REC-7.4.x | Drying, grading, boxing, traceability, stock control |
| **Live** | REC-7.5.x | Packing, bag quality, receiving returns |

Supporting these are sanitation/cleaning records (REC-7.6.x), equipment/maintenance (REC-7.7.x–7.8.x), environmental monitoring (REC-7.9.x–7.10.x), traceability and recall (REC-8.1.x), and governance/compliance records.

At the time of writing, **over 130 individual record forms** are live and data-backed.

---

## 2. High-level architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (tablet / desktop)                        │
│                                                                            │
│  index.html  →  record list  →  REC-7.x.x.html                            │
│                                 │                                          │
│                         form-record.js  (main engine)                      │
│                         monitoring-log.js  (log-style records)             │
│                         entry-flow.js  (entry wizard)                      │
│                         signoff-block.js  (sign-off / approval)            │
│                         traceability.js  (trace lookups)                   │
│                                 │                                          │
│                         data-store.js  ◄─── storage seam                  │
│                                 │                                          │
│                         api-backend.js  ◄─── one file that talks to API   │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ HTTPS
┌────────────────────────────────────▼───────────────────────────────────────┐
│                      API  (Render web service — Node/Express)               │
│                      src/index.js   (main router, ~74 KB)                  │
│                                                                            │
│  POST /api/submissions        set a record                                 │
│  GET  /api/submissions        query records (prefix, date range, key)      │
│  GET  /api/dates              date-class index for cross-record queries     │
│  GET  /api/record-defs/:key   live record definition (fallback)            │
│  POST /api/auth/passkey/*     WebAuthn enrolment + assertion flows         │
│  POST /api/nc/*               non-conformance log endpoints                │
│  … and 40+ other routes                                                    │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ Prisma (connection pool)
┌────────────────────────────────────▼───────────────────────────────────────┐
│                    DATABASE  (Neon Postgres — serverless)                   │
│                                                                            │
│  KeyValue              — every record submission (namespaced key + JSON)   │
│  SubmissionDateField   — date fields extracted & classified, for indexing  │
│  RecordDefinition      — record type config (title, docCode, top-level)    │
│  RecordSectionDef      — sections per record (ordered by position)         │
│  RecordFieldDef        — fields per section                                │
│  RosterColumnDef       — columns in the repeat-row (roster) section        │
│  Passkey               — WebAuthn credentials per user                     │
│  NcLog / NcAction      — non-conformance events and corrective actions     │
│  CertRevision          — document revision history                         │
│  … and others                                                              │
└────────────────────────────────────────────────────────────────────────────┘

Static record definition snapshots:
  public/data/record-defs/<key>.json   ← built by export-record-defs.mjs
  (browser reads these first; falls back to API)
```

---

## 3. The storage seam — why it matters

Every record page reaches the database through exactly **one adapter**:

```
page  →  window.storage (data-store.js)  →  api-backend.js  →  API  →  Neon
```

`api-backend.js` implements four functions: `get`, `set`, `remove`, `getByPrefix`. These are the **only** functions any record page or library ever calls. No page or library touches the API URL, the key format, or the database structure directly.

**Why:** if the database ever needs to change (Neon → something else, key/value → relational row-per-field), only `api-backend.js` needs to be rewritten — not 130+ record pages. This is a deliberate one-file seam.

The same seam also has a priority cascade:

1. **Cached in memory** (very recent data, same session)
2. **Static JSON file** (`public/data/record-defs/<key>.json`) — served by the CDN, zero latency
3. **Live API** — only if the static file is missing or outdated

This means record *definitions* (the form structure) load instantly even when the API service is sleeping (Render free tier sleeps after 15 min idle). Record *data* (submissions) still needs the API; the API cold-start is an accepted trade-off on the free tier.

---

## 4. Record definitions — how they reach the browser

The form structure for each record (fields, sections, columns, validation rules) is stored in the database (`RecordDefinition` + child tables) but **not read live on page load**. Instead:

```
Neon DB
  → scripts/export-record-defs.mjs    (run after any DB change)
  → public/data/record-defs/<key>.json   (static snapshot, committed to git)
  → git push → Render deploys → CDN serves file
  → form-record.js reads this file
```

**Why not read from the API live?**
- The API service sleeps. A sleeping API means the form doesn't render at all.
- CDN-served static JSON is ~100× faster than a cold-start API call.
- Form definitions change rarely (a field addition, not a per-submission event). Committing the JSON snapshot makes the definition change auditable in git.

**The rule:** after any change to a record definition in the DB, the engineer must run `node scripts/export-record-defs.mjs` and commit/push the updated JSON file. If DB access isn't available, manually edit the JSON to match and push it.

---

## 5. The form engine — form-record.js

`public/lib/form-record.js` (~311 KB) is the core of the system. It does everything a record page needs:

| Responsibility | How |
|---|---|
| Read the record definition JSON | Fetches `public/data/record-defs/<key>.json` |
| Render the form | Builds DOM from the definition (sections, fields, grid layouts) |
| Handle the roster (repeat rows) | Steams, batches, repeat measurements — renders as cards on screen, table on print |
| Run computed fields | Named function registry (`src/compute-registry.js` + client mirror) |
| Job autofill | Watches a field and fills others from a linked record (the `autofill` block) |
| PDF / print | Adds `.fr-sheet-compact` class when `printCompact: true`; renders roster as flat table when `printTable: true` |
| Sign-off | Delegates to `signoff-block.js` |
| Validation | Field-level rules defined in the record definition |
| Save / load submissions | Calls `window.storage` (the seam) — never the API directly |

Every `REC-x.x.x.html` file is **a thin shell**: a mount `<div>`, a `<script>` tag that loads `form-record.js?v=N`, and a tiny config block that names the `recordKey`. The engine does the rest.

**Cache busting:** because `form-record.js` is large and browsers cache it aggressively, every HTML shell that loads it includes a `?v=N` query parameter. **Bump `N` every time `form-record.js` changes**, or tablets will silently run the old version. A helper script (`bump-form-record-version.js`) automates this across all HTML shells.

---

## 6. Record definition structure (the data model in the JSON)

Each `public/data/record-defs/<key>.json` file is the output of `assembleRecordConfig()` in `src/record-def.js`. Its top-level shape:

```json
{
  "recordKey": "drying-process",
  "docCode": "REC 7.4.1",
  "title": "Drying Process",
  "printCompact": true,
  "batchField": "jobNo",
  "listColumns": ["entryDate", "jobNo", "roster:count"],

  "roster": { ... },      // the repeat-row section (steams, batches, etc.)
  "sections": [ ... ],    // ordered flat sections
  "autofill": [ ... ]     // cross-record fill rules
}
```

**Roster:** The repeat section (e.g. "Steams" in drying, "Can batches" in canning). Each row is one steam/batch. On screen: rendered as expandable cards (`cardRows: true`). On print: rendered as a flat HTML table (`printTable: true`). The card heading can show a date suffix (`titleDate: "steamDate"` → "Steam 3 · 5 Oct").

**Sections:** Ordered flat sections beneath the roster (or before it). Special flags control layout:

| Flag | Effect |
|---|---|
| `jobSoFarPanel: true` | "Job so far" progress timeline panel |
| `trolleyBanner: true` | Read-only display banner showing a count field |
| `movementBlock: true` | Movement tracking UI |
| `collapsible: true` | Collapse/expand toggle |
| `afterRoster: true` | Section placed after the roster |
| `cols: N` | Grid column count (default 2) |

**Autofill:** Watches a field change and copies values from a linked record into other fields. Used for cross-record job data propagation (e.g. receiving details → drying form).

---

## 7. Data model — the KeyValue store

Every record submission is stored as a single row in the `KeyValue` table:

```
key:   "submissions:<recordKey>"     (one namespace per record type)
id:    auto-generated UUID
value: JSON blob of all field values
```

Related keys use prefixes:
- `batch_link:<batchNo>:<recordKey>` — links a batch number to a record submission (the foundation of traceability)
- `document_revision:<recordKey>` — document revision history
- `submission_images:<submissionId>` — photo attachments

**Why key/value rather than a column-per-field relational table?**
Each of the 130+ record types has a different schema. Managing 130 tables (or one EAV table per field) would be brittle and migration-heavy. A namespaced key/value store lets every record type use the same read/write API with zero schema work per new record. The cost is that SQL `WHERE field = X` queries across submission content aren't possible — but the separate `SubmissionDateField` table covers the only cross-record query pattern that actually matters in practice (date ranges).

**The date index:** `SubmissionDateField` has one row per date-type field in every submission. Its columns classify the field: `dateClass` (entry date, batch date, test date, etc.), `recordKey`, `submissionId`, `date`. The `/api/dates` endpoint queries this table to answer "show me all submissions from record X between date A and date B" — no JSON parsing of the blob required.

---

## 8. Authentication and sign-off

### 8.1 Device enrolment

Tablets and workstations are enrolled as trusted devices before use. The `src/device-enroll.js` flow saves a device token to the database. Device identity gates which features are available.

### 8.2 Passkeys (WebAuthn)

Users authenticate using WebAuthn passkeys — fingerprint or PIN, no passwords. The flow is:
1. Enrolment: `POST /api/auth/passkey/register` — generates a challenge, user completes biometric, credential is stored in the `Passkey` table.
2. Authentication: `POST /api/auth/passkey/authenticate` — challenge/assertion, credential verified server-side.

Client-side: `public/lib/passkey-input.js` wraps the browser's `navigator.credentials` API.

### 8.3 Sign-off

`public/lib/signoff-block.js` renders the sign-off section at the bottom of every applicable record. A sign-off requires a passkey assertion to confirm identity. The signed-off state is stored in the submission JSON and flagged in the KeyValue record.

### 8.4 Role / permission model

Currently a **client-side "Acting as" selector** in localStorage — not tied to real identity on the server. This is a known placeholder. The `src/access-control.js` and `public/lib/permission-rules.js` files implement the client-side permission checks; they will bind to real server-verified identity when real login is built.

The planned identity provider is **Microsoft Entra ID** (Azure AD). No timeline set; it is a distinct work item.

---

## 9. Traceability

Traceability is built into the same key/value structure — no separate system.

Every record that touches a batch or job writes a `batch_link:<batchNo>:<recordKey>` key. `public/lib/traceability.js` reads these links and assembles a timeline: which records reference this batch, in what order, with links to open each one.

The `records/REC-8.1.x-traceability-*.html` pages expose this as user-facing mock-recall and traceability reports.

Barcode scanning (`public/lib/barcode-scan.js`, `barcode-split-drying.js`) feeds traceability by reading GS1 or internal barcodes and resolving them to batch numbers, which are then linked.

---

## 10. Non-conformance (NC) log

`src/nc-log.js` (~27 KB) is the backend for recording non-conformances — any deviation, finding, or quality failure. An NC can be raised from inside any record form (via `public/lib/nc-raise.js`) or standalone. The NC record stores: what happened, which record it was raised from, who raised it, the severity, and links to corrective actions (`NcAction` table).

The `public/lib/nc-login-alert.js` shows a banner on login if there are open NCs assigned to the user.

---

## 11. Reports and dashboards

Several purpose-built report pages aggregate data across record submissions:

| Page | What it shows |
|---|---|
| `pages/canning-report.html` | Job-level canning summary — weight, can counts, batch links |
| `pages/drying-report.html` | Job-level drying summary — drying records, grading output, stock |
| `pages/double-seam-trend.html` | Trend charts for double-seam inspection measurements |
| `pages/batch-trace.html` | Full batch timeline across all linked records |
| `pages/master-record-index.html` | Cross-record index — search/filter all submissions by date |
| `pages/quality-trends.html` | Quality KPI trends from external Excel workbooks |

Reports read from the API (`GET /api/submissions?prefix=...&dateFrom=...&dateTo=...`) — they do not read static JSON files because they aggregate across many submissions.

---

## 12. Document management (SOPs, PRPs, policies, certifications)

Beyond records, the system hosts:
- **SOPs** (`public/sops/`) — Standard Operating Procedures, rendered by `public/lib/sop-doc.js`
- **PRPs** (`public/prps/`) — Prerequisite Programs, rendered by `public/lib/prp-doc.js`
- **Policies** (`public/policies/`) — rendered by `public/lib/policy-doc.js`
- **Procedures** (`public/procedures/`)
- **Certifications** (`public/certifications/`) — issued certificates and their revision history (`src/certRevisions.js`)

All document pages share `public/lib/doc-header.js` which renders the standard document control header (doc code, revision, date, approvals). Revision history for certs is tracked in the `CertRevision` database table.

The FSMS calendar (`src/fsms-calendar.js`) tracks scheduled food-safety management system activities.

---

## 13. Deployment pipeline

```
Developer edits files locally
         │
         ▼
git push to main (GitHub)
         │
         ├──▶ Render Static Site  (serves public/ as-is)
         │         └── deploys in ~30s, no build step
         │
         └──▶ Render Web Service  (runs Node/Express: src/index.js)
                   └── deploys in ~60s, npm start
```

- **No build step** for the static site. Render serves `public/` directly. Changing a JS file means pushing it — no bundler, no compile step.
- **Environment variables** are set in the Render dashboard: `DATABASE_URL` (Neon connection string) for the API service. Locally, `.env` file (git-ignored).
- **The API sleeps** on the free tier after 15 minutes of inactivity. First request after sleep has a ~10s cold start. This is accepted behaviour, not a bug.

---

## 14. Backup and data durability

Neon's free tier has a **6-hour point-in-time recovery window** — an undo buffer, not an archive.

`scripts/backup.js` provides the real compliance backup:
- Reads directly from Postgres via Prisma (independent of the API being awake)
- Writes timestamped, verified JSON backups
- Synced to OneDrive (outside the git repo) — accessible for 5-year compliance retention

This script must be run regularly (scheduled task or manually). The OneDrive sync is the durable archive.

---

## 15. Future integration — ERPNext

The planned upstream integration is:
```
Syspro (ERP) → ERPNext (nightly sync, from 1 July 2027)
                   ↓
             this app's Postgres
```

**Rules that do not change:**
- Syspro is **read-only forever** from this app's perspective — no write-back to Syspro.
- Approved records go to ERPNext, never directly to Syspro.
- Sync cadence: nightly batch (matching Syspro→ERPNext pattern), never per-user/real-time.

The Dataverse path (an earlier plan) is **superseded** — do not design against it.

ERPNext integration is not started; it needs a design spec before any code work.

---

## 16. Key business rules (summary)

Full rules registry: see `MD/01_System-Overview-and-Plan.md` → Business rules section.

Critical rules:

| Rule | Where enforced |
|---|---|
| Every submission must have an entry date | `validate-submission.js` |
| A signed-off submission cannot be edited without re-signing | `signoff-block.js` + `submission-store.js` |
| Syspro write-back is forbidden | architecture rule — no code path to Syspro |
| Record definitions in DB must match static JSON | `export-record-defs.mjs` run required after any DB change |
| Batch numbers must be unique per record type | `crate-number-guard.js`, `drying-process-guard.js` |
| Dry stock movements are guarded before entry | `dry-stock-guard.js` |
| Computed fields use the named-function registry | `compute-registry.js` — no inline JS in form pages |
| `form-record.js` version must be bumped on every change | CLAUDE.md rule + `bump-form-record-version.js` |

---

## 17. What is deliberately NOT done

| Not done | Why |
|---|---|
| Column-per-field relational tables for submissions | 130+ schemas would require 130+ tables; namespaced key/value is intentionally simpler |
| General expression DSL for computed fields | 15 formulas don't justify a parser; named-function registry is the chosen approach |
| Real-time sync to ERP | Nightly batch is the agreed pattern; real-time would create race conditions |
| CSS redesign on out-of-scope pages (Handovers, Quick Receiving) | These are separate flows; leaking record-theme.css into them would cause regressions |
| Migrating clientHook records as plain data | REC-7.1.2, 7.2.4, 7.2.12 keep real JS — referenced by name in the definition row |
| Re-architecting api-backend.js | It is the seam; the goal is to change only it when the backend changes, not to redesign it every time |

---

## 18. Where the detail lives

| Topic | File |
|---|---|
| System status, open decisions, work items | `MD/01_System-Overview-and-Plan.md` |
| Database schema, Prisma, table shapes | `MD/02_Database-and-Relational-Design.md` |
| Field traceability, key naming, batch linking | `MD/03_Traceability-and-Field-Reference.md` |
| ERPNext integration plan | `MD/04_ERP-Integration.md` |
| Canning records and job status | `MD/05_Canning-Records-Reports-and-Job-Status.md` |
| Dry processing records (REC-7.4.x) | `MD/06_Dry-Processing-Records-REC-7.4.md` |
| UI/UX, tablet layout, form-record.js internals | `MD/07_UI-UX-Tablet-and-Layout.md` |
| Receiving, salting, REC-7.1 forms | `MD/08_REC-7.1-Receiving-Salting-and-Form-Changes.md` |
| Auth, sign-off, passkeys | `MD/09_Authentication-Signoff-and-Passkeys.md` |
| All MD files index | `MD/00_INDEX.md` |
| Deployment, env vars, architecture | `CLAUDE.md` (repo root) |
| API routes | `src/index.js` |
| Form engine internals | `public/lib/form-record.js` |
| Storage seam | `public/lib/api-backend.js` |
| Record definition assembly | `src/record-def.js` |
| Definition export script | `scripts/export-record-defs.mjs` |

---

_End of system overview._
