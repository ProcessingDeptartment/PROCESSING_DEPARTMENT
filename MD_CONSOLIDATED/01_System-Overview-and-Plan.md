# System Overview, Plans and Business Rules

Where the project stands, what is decided, what is open, and the rules the system enforces.

_Consolidated from 7 original files. Cross-references inside the text to old file names refer to the original files; see `00_INDEX.md` for where each one now lives._

## Contents

1. [Processing Department — Front-End Development](#processing-department--front-end-development) — `README.md`
2. [Processing Department — Consolidated Plan & Open Decisions](#processing-department--consolidated-plan--open-decisions) — `claude/consolidated-plan.md`
3. [Processing Department — Next Steps Work Plan](#processing-department--next-steps-work-plan) — `claude/next-steps-workplan.md`
4. [Business rules registry](#business-rules-registry) — `claude/business-rules.md`
5. [Backend integration — the space left for it](#backend-integration--the-space-left-for-it) — `claude/BACKEND_INTEGRATION.md`
6. [Intelligent Agent Role-Out Template — Production Record Design Pattern](#intelligent-agent-role-out-template--production-record-design-pattern) — `claude/intelligent-agent-role-out-template.md`
7. [Render build failure — 2026-09-11 (resolved, transient)](#render-build-failure--2026-09-11-resolved-transient) — `claude/render-build-failure-2026-09-11.md`

---

## Processing Department — Front-End Development

> **Source:** `README.md`

A document management system for the Abagold Processing Department. Currently focusing on **front-end HTML/CSS/JavaScript only**. The backend and database layer will be added after all forms are complete and tested.

### Current Status

- All HTML forms and pages complete
- Local storage works (browser-based)
- Backend API integration — coming next
- SQLite/PostgreSQL database — coming after HTML finalized

### Getting Started

1. Install Node.js 18+
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open http://localhost:3000 in your browser

No dependencies to install — the server uses only Node built-ins.

### Project Structure

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

### How Records Are Built

Record pages are thin. Each one is an empty mount div plus a config block — the actual rendering is done by shared engines (`form-record.js` or `monitoring-log.js`). This means structural changes happen in one library file, not across 146 pages.

### Data Storage

**Today:** All data is stored in the browser's `localStorage`. Data is device-specific.

**Later:** When the backend is ready, forms sync to a central database with no changes to form code. See [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md).

### Cache Busting

Library files are cached hard by browsers. When editing anything in `public/lib/`, bump the `?v=N` on every `<script>` tag that loads it, or stale code silently breaks pages.

### Scripts

- `npm run dev` — Start the development server
- `npm start` — Same as dev
- `python scripts/extract_quality_trends.py` — Rebuild `public/data/quality-trends.json` from the
  Quality workbooks in `../Online system/19. Quality report`. Run it whenever Quality updates one of
  those workbooks; the Quality Trends dashboard (`public/pages/quality-trends.html`) reads only the
  JSON, never the spreadsheets. Needs `openpyxl`.

---

## Processing Department — Consolidated Plan & Open Decisions

> **Source:** `claude/consolidated-plan.md`

**Status as of 2026-09-09.** This is the single place that tracks what's built, what's decided,
and what's still open across the whole system. Read this before starting any new work so nothing
gets duplicated or re-litigated.

---

### 1. What's already built (do not redesign this)

The system is live at https://processing-department.onrender.com/ (password-gated) with:

- **Frontend**: static site (`public/`), deployed as a Render Static Site — free, no sleep.
- **API**: Express (`src/index.js`), deployed as a Render free-tier web service (`facility-api`)
  — sleeps after 15 min idle, so first request after idle is slow. This is a known, accepted
  trade-off of the free tier, not a bug.
- **Database**: Postgres on Neon, accessed via Prisma (`prisma/schema.prisma`). A generic
  `KeyValue` table stores every record submission as a namespaced key (e.g.
  `submissions:brine-mixing`, `document_revision:double-seam`, `batch_link:<batch>:...`), plus a
  `SubmissionDateField` table that auto-extracts and classifies every date field across all ~130
  record types, so trend/date-range queries don't require touching each record's schema.
- **Storage seam**: every record page calls one adapter, `window.storage` in
  `public/lib/data-store.js` — never the database directly. `public/lib/api-backend.js` implements
  the four-function contract (`get`/`set`/`remove`/`getByPrefix`) against the live API. This is
  what makes "move to another format" cheap: **swapping database or backend only means rewriting
  `api-backend.js`, not touching any of the ~130+ record pages.** This already satisfies the
  requirement that the database structure be swappable.
- **Traceability**: `public/lib/traceability.js`, riding on the same `batch_link:*` keys as
  everything else — no separate system to maintain.
- **Backups**: `scripts/backup.js` reads directly from Postgres via Prisma (independent of the API
  being awake) and writes verified, timestamped backups to a OneDrive-synced folder outside the
  git repo. This is the actual answer to "Neon free tier is risky" — Neon's point-in-time recovery
  window is only 6 hours (an undo buffer, not an archive); this script is the real 5-year
  compliance backup.
- **Roles**: a client-side "Acting as" selector, deliberately not wired to the backend yet — a
  placeholder for real identity.

**Do not re-architect any of the above.** The database structure is already clear (namespaced
keys + a date-classification index), already swappable (one file to change), and already backed
up. Anything that looks like "redesign the database" should instead be scoped as one of the
specific open items below.

---

### 2. Decisions made this session (2026-09-09)

| Decision | Answer | Why |
|---|---|---|
| Drying Report scope | **Option A** — ship using only data already in the database (`abalone-receiving`, `drying-process`, `grading-production-log-cultivated`). Paper-form-only fields (Drying Code, PO no., mortalities, piece counts, etc.) are left out of v1. | Ships immediately; avoids a new record type and schema work before the report itself is proven useful. |
| Quick Abalone Receiving scope (tablet redesign) | **Out of scope** — treated the same as Handovers. Left untouched, no sidebar/shell applied. | It's a separate top-level flow, not one of the ~130 records reached from Record List. |
| Upstream integration path | **ERPNext**, not Dataverse. Plan this app's future upstream feed against the Syspro→ERPNext nightly sync (system of record from 1 July 2027), not the original Syspro→Dataverse→Postgres design. | Dataverse path is unbuilt and unowned; ERPNext path is live and has an owner-mandated timeline. |
| Computed-field representation in `RecordDefinition` (relational migration) | **Named-function registry**, not an expression DSL — see Section 6 below for the full schema shape. | 15 known formulas are small and regular (sums, subtraction, rounding, ceiling); a registry keeps the existing JS almost as-is and avoids building/maintaining a parser for a list that may never grow. DSL stays an option later if the formula count grows significantly. |

These decisions are now reflected in `claude/drying-report-spec.md` and
`claude/layout-redesign-instructions.md` (updated alongside this doc).

---

### 3. Work items, in order

#### 3.1 Drying Report (`public/pages/drying-report.html`) — ready to build
Spec: `claude/drying-report-spec.md` (updated with the Option A decision — no more open question
blocking this). Follows the `canning-report.html` pattern. Give the spec file directly to Claude
Code as the build task; it already contains the full field mapping, source records, and CSV/print
requirements.

**Fast-follow (not now):** if paper-form parity is wanted later, that's Option B from the spec —
a new `REC-7.4.X-drying-report-extras` record — scope it as a separate task when requested.

#### 3.2 Tablet record-entry redesign — ready to build, edge case resolved
Spec: `claude/layout-redesign-instructions.md` (updated — Quick Abalone Receiving confirmed out of
scope, same as Handovers). Remaining step before Claude Code batch-applies anything: flag any
other Record List entries that overlap with out-of-scope pages (Job Status, Traceability, etc.),
per Section 6 step 1 of that spec. Build order in that doc (Section 6) still applies as written:
tokens/shell → one repeating-row record → one single-submission record → review → batch-apply →
responsive check → regression check.

#### 3.3 Upstream integration (Syspro → this app) — needs a design pass, not code yet
Not ready for Claude Code. Before any ETL work starts:
- Confirm with IT/Sales (owners of `T:\Sales Dept\erp-evaluation`) what ERPNext exposes as of
  1 July 2027 — API, webhook, or scheduled export — since the current docs only describe it as
  "a live alternative," not a finished integration spec.
- Decide the sync direction and cadence into this app's Postgres (nightly batch is the existing
  pattern used for Syspro→ERPNext itself, so mirroring that cadence into this app's DB is the
  likely default — confirm rather than assume).
- Reconfirm the write-back rule stays in force: **Syspro is read-only forever.** Approved records
  from this app go to ERPNext, never directly to Syspro, and only in scheduled batches, never
  per-user/real-time (existing rule, unchanged by the ERPNext decision).
- Once that's written down as a short spec (same format as the drying-report spec), it can go to
  Claude Code as a build task.

#### 3.4 Real identity / login (Entra ID) — not started, not scheduled
Currently a client-side "Acting as" role selector in `localStorage`, not tied to any real
authentication. No spec exists yet. Raise this as its own planning task when it becomes a
priority — it touches every page's permission checks, so it deserves its own scoped instruction
file rather than being folded into either of the two builds above.

#### 3.5 Relational `RecordDefinition` migration (moving record definitions into the DB) — schema decided, extraction done
This is a separate track from the KeyValue system described in Section 1: it's about representing
each of the ~131 record pages as data (`RecordDefinition` + child field/section rows) instead of as
hand-written page JS, so record structure itself becomes inspectable and editable without a code
change. `scripts/extract-definitions.mjs` (report-only, writes nothing) confirmed on 2026-09-09
that 124 of 131 record pages are purely declarative and map with zero manual work; 7 are flagged,
all for the same root cause (a computed/derived field backed by inline JS). See Section 6 for the
schema decision that unblocks migrating those 7.

---

### 4. What NOT to do
- Don't re-plan the database structure — it's already namespaced, indexed by date, and swappable
  behind one file (`api-backend.js`). Any "make it clearer to view trends" request should first
  check whether `GET /api/dates` (date-class + range query) already answers it before adding new
  tables.
- Don't let the tablet redesign CSS (`record-theme.css` or equivalent) leak into any out-of-scope
  page's stylesheet — this is called out explicitly in the redesign spec and is a common way this
  kind of change goes wrong.
- Don't point any new upstream-integration work at Dataverse — that path is superseded by the
  ERPNext decision above unless someone explicitly revisits it.
- Don't build a general expression DSL for computed fields before the registry approach is tried —
  see Section 6. 15 formulas do not justify a parser.
- Don't migrate the 3 clientHook records (7.1.2, 7.2.4, 7.2.12) as if they were plain data — they
  keep real JS, just referenced by name from the definition row (Section 6.3), not inlined in page
  script.

---

### 5. Files referenced
- `claude/drying-report-spec.md` — build spec for the Drying Report page (decision resolved)
- `claude/layout-redesign-instructions.md` — build spec for the tablet record-entry redesign
  (edge case resolved)
- `BACKEND_INTEGRATION.md` (repo) — the storage seam contract and current backend status
- `render.yaml` (repo) — deployment config for both Render services
- `scripts/backup.js` (repo) — the real compliance backup, separate from Neon's 6-hour undo window
- `data/record-key-map.json` (repo) — record key → doc code → record name mapping
- `scripts/extract-definitions.mjs` (repo) — report-only definition-extraction scanner (Section 3.5)
- `relational-all-records-plan.md` — the broader relational-migration plan this section belongs to
  (not yet a project doc here — pull it in if/when work on 3.5 actually starts)

---

### 6. Schema decision: computed fields and client hooks in `RecordDefinition`

This section exists so the 2026-09-09 extraction backlog (7 flagged records, ~15 formulas) doesn't
get re-litigated per-record. Decide the shape once, apply it uniformly.

#### 6.1 Computed fields — named-function registry
Every flagged computed/derived field (`intakeWeight`, `standardSaltingTime`,
`totalTumblingTime`, `coldDeviation`, `hotDeviation`, `difference`, `cookoutPct`, `newMinIngo`,
`newMaxIngo`, `purgeDays`, `purgeLoss`, and any future one) is represented on its field-definition
row with two columns, not one:

| Column | Type | Meaning |
|---|---|---|
| `computeFn` | string (nullable) | Name of a function in a shared registry, e.g. `'cookoutPct'`, `'sumRosterColumn'`. Null for ordinary non-computed fields. |
| `computeArgs` | JSON (nullable) | Arguments the function needs at call time — e.g. `{"column": "wholeWeight"}` for a roster sum, `{"a": "coldReading", "b": "coldStandard"}` for a difference. Keeps the function generic instead of writing one function per field. |

The functions themselves live in one place, e.g. `public/lib/compute/registry.js` (client) mirrored
by a server-side equivalent used at submission time — both call the same named functions, keyed by
`computeFn`, so client-side live preview and server-side stored value never disagree. The ~15
existing formulas move into this registry almost unchanged; nothing about their logic needs to
change, only where they're invoked from (a lookup by name instead of inline page script).

**Explicitly not doing (for now):** a general expression DSL (`sum(roster.wholeWeight)`,
`round(x * frac, 2)` parsed from a string). Revisit only if the computed-field count grows well
past ~15–20 or the formulas stop fitting the "small and regular" shapes seen so far (roster-column
sums, `a - b`, `round(x * frac, 2)`, `ceil(spec / cookoutFrac)`).

#### 6.2 New field types
Add four field types to the generator's type map — straightforward 1:1 column mappings, no schema
design needed beyond this table:

| Field type | Maps to |
|---|---|
| `month` | `<input type="month">` / stored as string |
| `timestamp` | DateTime column |
| `datetime` | DateTime column |
| `digits` | Integer column |

#### 6.3 Client hooks (bespoke JS that isn't a single computed field)
Three records keep real, non-declarative page behavior and are not forced into the computed-field
shape above:

| Record | Hook mechanism | Stays as |
|---|---|---|
| REC 7.1.2 Abalone Receiving | barcode + scale integration (`window.Rec*`) | inherently client-side hardware code — no change |
| REC 7.2.4 Abalone Packing Specification | `deriveInto` hook | named hook |
| REC 7.2.12 Double Seam Inspection | `customBody` hook | named hook |

Each of these gets a `clientHook` column (string, nullable) on its `RecordDefinition` row, holding
the name of the JS module/function the page loads (e.g. `'abaloneReceivingScale'`,
`'packingSpecDerive'`, `'doubleSeamCustomBody'`). This is the difference between "undocumented
exception" and "traceable pointer": the definition table stays the single source of truth for
which records have non-standard behavior, even though the behavior itself isn't data.

**Follow-up needed before migrating REC 7.2.12 specifically:** the extraction report flagged it as
`fields=0, rosterTables=0` — "no fields found (check parser)" — which is a parser uncertainty, not
a confirmed zero-field record. Open the page source and confirm by hand whether it genuinely has no
declarative fields (all fields built in `customBody`) before writing its `RecordDefinition` row, so
this isn't silently migrated wrong.

#### 6.4 What this unblocks
With 6.1–6.3 decided, all 131 record pages have a defined home in the relational model: 124 map
directly today, 45 of those already via `RecordAutofillDef`, and the remaining 7 map once
`computeFn`/`computeArgs` (four records) and `clientHook` (three records, one needing manual
field-list confirmation first) are added as columns. No record requires inventing a new mechanism
beyond these two columns.

---

## Processing Department — Next Steps Work Plan

> **Source:** `claude/next-steps-workplan.md`

**Status:** Active  
**Date:** 2026-09-18  
**Owner:** Michaela  
**Tracks:** Option A (Ship Fast) + Option C (Design Pipeline)

---

### Track A: Ship Fast (Canning Production + Drying Report)

#### A1. Canning Production Record Implementation
**Status:** Ready to build  
**Input:** `claude/canning-production-record-technical-spec.md`  
**Deliverable:** `public/pages/canning-production.html`  
**Owner:** Claude Code  
**Timeline:** Start immediately, 4–6 hours  
**Approval:** [Pending Claude Code completion]

**Testing before live:**
- [ ] Form renders correctly on desktop, tablet, mobile
- [ ] All validation rules work (required fields, ranges, conditional Sauce Batch)
- [ ] Batch rows add/edit/delete correctly
- [ ] Total Cans counter updates on each row add/delete
- [ ] Timestamp button sets current time correctly
- [ ] Submit saves to KeyValue table with correct schema
- [ ] Error messages display on validation failure
- [ ] Success toast appears and form clears
- [ ] Dropdowns match specified lists (Retort Code, Retort Number, Can Size, Cooking Method, Drain Weight)

**Staging deployment:** Once built, test on staging before production push.

---

#### A2. Drying Report Implementation
**Status:** Ready to build  
**Input:** `claude/drying-report-spec.md`  
**Deliverable:** `public/pages/drying-report.html`  
**Owner:** Claude Code  
**Timeline:** Start after Canning Production, 3–4 hours  
**Approval:** [Pending Claude Code completion]

**Testing before live:**
- [ ] Report loads and displays data correctly
- [ ] CSV export works with correct columns
- [ ] Print preview renders cleanly
- [ ] Job dropdown filters to 3CP/CPR prefix only
- [ ] All computed fields (yield %, target cans, etc.) calculate correctly
- [ ] Mobile layout is readable (tables may scroll horizontally)

**Staging deployment:** Once built, test on staging before production push.

---

### Track C: Design Pipeline (Next Production Records)

#### C1. Sauce Batch Preparation Record (REC-7.4.X)

**Why now?** Feeds into Canning Production; core to braised workflow.

**Gather requirements (by tomorrow):**
- [ ] Interview kitchen staff: What info is captured when a sauce batch is started?
- [ ] What ingredients go in? (sugar, water, spices — what's the list?)
- [ ] How long does mixing take? (minutes range?)
- [ ] What QA checks happen? (smell, color, pH range?)
- [ ] How is the batch ID formatted? (SB-2026-0918-001 assumed — confirm)
- [ ] Do batches link forward to Canning Production records? (yes, via sauceBatch field)
- [ ] Link backward to inventory? (yes, ingredient stock levels)

**Design brief for Claude (template provided):**
```
Record: REC-7.4.X Sauce Batch Preparation
Process: Kitchen staff prep sauce batches for braised canning
Users: Kitchen staff, 2–3 batches per shift
Fields to capture:
  - Batch ID, Date Started, Chef Name
  - Ingredients (sugar kg, water L, spices list)
  - Process (mixing duration min, final temp °C)
  - Quality checks (pH, smell OK, appearance notes)
  - Comments

Validation:
  - Batch ID unique, matches format SB-YYYY-MM-DD-###
  - Mixing duration 0–180 min
  - Final temp 60–100°C
  - pH 2.5–4.5
  - Comments optional

Reference: Canning Production Record design pattern
```

**Deliverables from Claude:**
- Design & Layout Instructions (markdown)
- Technical Specification (markdown)

**Timeline:** Design Thursday–Friday (2 days), ready to code next week.

---

#### C2. Quality Sampling Record (REC-7.5.X)

**Why now?** Lab data needed for compliance; high visibility.

**Gather requirements (by end of week):**
- [ ] Interview lab tech: What gets sampled and when?
- [ ] What measurements are taken? (pH, weight, appearance, microbiology results?)
- [ ] How often? (per batch, per trolley, per day?)
- [ ] Does it link to a canning batch? (yes, via batch/trolley)
- [ ] What pass/fail criteria? (pH > 3.5 = pass, etc.?)
- [ ] Who approves results? (lab manager signature/sign-off?)

**Design brief for Claude:**
```
Record: REC-7.5.X Quality Sampling
Process: Lab tech records QA measurements on product samples
Users: Lab technician, 5–10 samples per shift
Fields to capture:
  - Sample ID, Batch/Trolley Link, Date Sampled
  - Measurements (pH, weight g, appearance notes)
  - Microbiology (if applicable)
  - Pass/Fail Status
  - Reviewed By (lab manager)
  - Comments

Validation:
  - Sample ID unique
  - pH 2.5–4.5 (or per product type)
  - Weight > 0
  - Pass/Fail required
  - Reviewed By required if Fail

Reference: Canning Production Record design pattern
```

**Deliverables from Claude:**
- Design & Layout Instructions (markdown)
- Technical Specification (markdown)

**Timeline:** Design next week (Mon–Tue), ready to code by Wednesday.

---

#### C3. Waste Tracking Record (REC-7.6.X)

**Status:** Optional, lower priority  
**Timing:** Design following week if bandwidth allows

**Why?** Operational insight (trim, damaged goods, off-grade product). Not blocking anything.

**Gather requirements (async):**
- [ ] What waste types? (damaged, off-grade, trim, other?)
- [ ] How measured? (count, weight kg, volume L?)
- [ ] When logged? (end of batch, end of shift, continuous?)
- [ ] Does it link to a batch? (yes)
- [ ] Reason codes? (yes, dropdown)

---

### Recommended Timeline

| Week | Track A (Coding) | Track C (Design) | Blockers | Handoff |
|---|---|---|---|---|
| W1 (Sep 18–22) | Canning Production build + test | Sauce Batch requirements + design brief | None | Canning Prod → staging test |
| W2 (Sep 25–29) | Drying Report build + test | Quality Sampling requirements + design brief | None | Both → production if tests pass |
| W3 (Oct 2–6) | Regression testing on staging | Sauce Batch + Quality Sampling approve & hand to Claude Code | None | Sauce Batch implementation |
| W4 (Oct 9–13) | Deploy to production | Quality Sampling implementation | None | Quality Sampling deploy |

---

### How to Brief Claude

#### For Track A (Claude Code builds):

**Canning Production:**
```
Implement public/pages/canning-production.html

Technical spec: claude/canning-production-record-technical-spec.md

Reference: public/pages/canning-report.html (for style patterns)

Required:
- Self-contained HTML (no separate CSS/JS files)
- Data stored via window.storage adapter
- All validation per spec
- Mobile-responsive (tested on tablet/phone)

Testing: [checklist above]
Timeline: This week
```

**Drying Report:**
```
Implement public/pages/drying-report.html

Spec: claude/drying-report-spec.md

Reference: public/pages/canning-report.html (same pattern)

Required:
- Self-contained HTML
- CSV export button
- Print button
- Job dropdown filters to 3CP/CPR only
- All formulas per spec

Testing: [checklist above]
Timeline: After Canning Production
```

#### For Track C (Claude Design):

**Sauce Batch Preparation:**
```
Design REC-7.4.X Sauce Batch Preparation record

Use: claude/intelligent-agent-role-out-template.md (briefing guide)

Deliverables:
1. Design & Layout Instructions (markdown)
2. Technical Specification (markdown)

Context: Feeds into Canning Production (braised medium)
Reference: Canning Production Record specs (follow same pattern)

Timeline: By Friday Sep 20
```

---

### Decision Points

#### Before implementing Canning Production:
- [ ] Retort Code list confirmed (R1, R2, R3, ... how many?)
- [ ] Retort Number list confirmed (L1, R1, ... complete list?)
- [ ] Can Size options confirmed (Unit, Mince, or others?)
- [ ] Cooking Method times confirmed (11/15/24 min, others?)
- [ ] Drain Weight list confirmed (213g, 80g, 150g, 238g, 180g, 200g — any others?)
- [ ] AG Code source confirmed (Double Seam Inspection record — verified?)

#### Before designing Sauce Batch:
- [ ] Requirements gathered from kitchen staff
- [ ] Batch ID format locked in (SB-YYYY-MM-DD-### assumed)
- [ ] Ingredient list finalized (sugar, water, spices — complete?)
- [ ] pH/temp/mixing ranges confirmed

#### Before designing Quality Sampling:
- [ ] Requirements gathered from lab tech
- [ ] Measurement types locked in (pH, weight, appearance, microbiology?)
- [ ] Pass/fail criteria documented per product type

---

### Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Retort/can lists incomplete | Form rejects valid entries | Confirm full lists before Claude codes |
| Canning Production delays | Drying Report can't start | Build in parallel if possible |
| Requirements gathering slow | Design pipeline stalls | Start interviews this week |
| Integration with Double Seam Inspection fails | AG Code lookup broken | Verify data structure in existing record |

---

### Success Criteria

**Track A (Week 1–2):**
- [ ] Canning Production + Drying Report deployed to production
- [ ] Operations team logging data successfully
- [ ] Zero critical bugs in first 48 hours live

**Track C (Week 1–4):**
- [ ] Sauce Batch record designed, approved, and handed to Claude Code
- [ ] Quality Sampling record designed, approved, and handed to Claude Code
- [ ] Both implemented and tested by end of week 4

---

### Next Immediate Actions

**By EOD today (Sep 18):**
1. [ ] Confirm all Canning Production field lists (Retort Code, Can Size, Cooking Method, Drain Weight)
2. [ ] Confirm AG Code source (Double Seam Inspection record)
3. [ ] Schedule kitchen staff interview for tomorrow (Sauce Batch)
4. [ ] Schedule lab tech interview for tomorrow (Quality Sampling)

**Tomorrow (Sep 19):**
1. [ ] Hand Canning Production spec to Claude Code
2. [ ] Interview kitchen staff → document requirements
3. [ ] Interview lab tech → document requirements

**Friday (Sep 20):**
1. [ ] Canning Production in staging (test)
2. [ ] Brief Claude on Sauce Batch design
3. [ ] Brief Claude on Quality Sampling design

**Next week:**
1. [ ] Canning Production → production (if tests pass)
2. [ ] Drying Report → staging (test)
3. [ ] Review Sauce Batch + Quality Sampling designs
4. [ ] Hand approved designs to Claude Code for implementation

---

## Business rules registry

> **Source:** `claude/business-rules.md`

Every cross-record business rule — "a value on this record can't exceed/must match a value
already saved on another record for the same job" — lives as **data**, in one file:

- Registry: `public/data/business-rules.json`
- Engine (reads the registry, runs the checks): `public/lib/form-record.js`
  (`fetchBusinessRules` / `runBusinessRules` / one `checkXxx` function per rule `type`)

### Why this exists

These little cross-record rules were multiplying, each built a different way, scattered across
record definitions and form code. Going forward:

- **Adding a rule that fits an existing `type`** = one new object in `business-rules.json`.
  No code change, no html change, no touching a record's own definition.
- **A genuinely new kind of check** = one new `case` in `runBusinessRules` (form-record.js).
  Should be rare — check the list of types below first.
- Record definitions under `public/data/record-defs/*.json` are **generated snapshots**
  (see `scripts/export-record-defs.mjs`) — never hand-edit them for a rule; they'd be
  silently overwritten on the next export.

### Registry file shape

`public/data/business-rules.json` is a flat array. Every entry needs at least:

```json
{
  "recordKey": "<the record this rule runs on, e.g. \"dry-cooking\">",
  "type": "<one of the types below>",
  "label": "<short human name for this rule>",
  "why": "<plain-English reason, for whoever reads this file next>"
}
```

Everything else in the entry is parameters for that `type`.

### Rule types

#### `capAgainstOtherRecord`

This record's own numeric field, **totalled across every previously-submitted entry for the
same job** (plus the value being saved right now), must not exceed a total already recorded on
another record for that job.

- Soft gate: at finalize, if the total would exceed the cap, the operator sees a confirm dialog
  and must explicitly click OK to override — declining aborts the save.
- If overridden, the record is stamped with `oosWarningAck` / `oosWarningNote`, which then shows
  as a standing red warning line both when viewing the submitted record and on the printed/PDF
  sheet.

Parameters:

| key | meaning |
|---|---|
| `ownJobField` | this record's own field holding the job number |
| `ownWeightField` | this record's own numeric field to total. If it is a column of the record's roster, the roster column is totalled across all rows (this entry's rows plus earlier submitted entries' rows) |
| `ownRowFilter` | optional `{ "column": "process", "equals": "Cooking" }` (or `"in": [...]` for several values) - with a roster column, count only rows whose `column` matches |
| `source` | `recordKey` of the record holding the cap |
| `matchField` | that record's job-number field |
| `sumColumn` | the roster column on that record to sum for the cap |
| `message` | the warning line shown on override / view / print |

Example (first rule of this kind — REC 7.4.0 Dry Cooking vs REC 7.1.5 OOSW):

```json
{
  "recordKey": "dry-cooking",
  "type": "capAgainstOtherRecord",
  "label": "Dry cooking batch weight vs OOSW",
  "why": "Abalone processed for dry cooking cannot exceed the OOSW weight recorded for the job on REC 7.1.5 - a higher total means batches from different jobs got mixed.",
  "ownJobField": "jobNo",
  "ownWeightField": "abaloneKg",
  "ownRowFilter": { "column": "process", "equals": "Cooking" },
  "source": "salting-oosw",
  "matchField": "jobNo",
  "sumColumn": "weight",
  "message": "Cooking pot weight exceeding OOSW - possible batch mix"
}
```

#### `capRowsAgainstRows`

The total of this record's roster rows matching `rowFilter`, **across every submitted entry for the
job plus the rows being saved now**, must not exceed the total of the rows matching `capFilter`.
Both are totals of the same roster column, compared as whole-job totals (equal passes), so card
order and which entry a card was saved on do not matter. Soft gate with the same override stamp as
`capAgainstOtherRecord`: each overridden rule adds its own line to `oosWarningNote` (one line per
rule), shown red on screen and on the printed sheet.

| key | meaning |
|---|---|
| `ownJobField` | this record's own field holding the job number |
| `column` | the roster column to total |
| `capFilter` | `{ "column": "process", "equals": "Blanching" }` - the rows that form the cap |
| `rowFilter` | `{ "column": "process", "equals": "Cooking" }` - the rows that must stay within it. Must use the same `column` as `capFilter` (the server groups by that column) |
| `legacyColumn` | optional roster column; rows where it is Yes/true are left out of the `rowFilter` side (REC 7.4.0 migrated cooking-only cards, `legacyNoBlanching`) |
| `message` | the warning line shown on override / view / print |

Worked example (REC 7.4.0, R3 - cannot cook more than was blanched):

```json
{
  "recordKey": "dry-cooking",
  "type": "capRowsAgainstRows",
  "ownJobField": "jobNo",
  "column": "abaloneKg",
  "capFilter": { "column": "process", "equals": "Blanching" },
  "rowFilter": { "column": "process", "equals": "Cooking" },
  "legacyColumn": "legacyNoBlanching",
  "message": "Cooking weight exceeds blanched weight - cooked more than was blanched"
}
```

REC 7.4.0 therefore runs three rules: R1 Cooking vs OOSW and R2 Blanching vs OOSW (both
`capAgainstOtherRecord`, differing only in `ownRowFilter`) and R3 Cooking vs Blanching.

The live "Available to blanch / Available to cook" figures on that record are not a rule; they
come from the roster's `jobWeights` setting (see `scripts/apply-dry-cooking-weights.mjs`) and use
the same server numbers.

### How it runs (for reference, not something you normally need to touch)

1. On finalize (`saveForm`, form-record.js), `runBusinessRules(config, values, editingId)` fetches
   the registry (`/data/business-rules.json`, cached after first load) and filters to rules whose
   `recordKey` matches the current record.
2. Each matching rule runs through a `switch (rule.type)`, dispatching to the matching `checkXxx`
   function.
3. `/api/lookup/:recordKey/:field/:value` (src/index.js) is what supplies the numbers each check
   needs:
   - `__rosterSums` — per-column totals across a *single* matched entry's roster rows (used for
     the cap side, e.g. REC 7.1.5's `weight` roster column).
   - `__matchRosterSum` - when the request carries `?rosterCol=&filterCol=&filterIn=a,b`, the sum of that
     roster column over the other submitted entries' rows whose `filterCol` value is in `filterIn`
     (REC 7.4.0: kg of Cooking pot cards).
   - `__matchRosterGroupSums` / `__matchRosterGroupLegacy` - when the request also carries
     `&groupCol=process&legacyCol=legacyNoBlanching`: the roster-column total per value of
     `groupCol` over the other submitted entries (REC 7.4.0: kg per process), and the part of it
     on rows whose `legacyCol` flag is Yes. Feeds `capRowsAgainstRows` and the live figures.
   - `__matchValueSums` — sum of a numeric top-level field across every *other submitted* entry
     matching the same job (`?excludeId=` skips the record currently being edited) — used for the
     "own total across many separate batch submissions" side.

---

## Backend integration — the space left for it

> **Source:** `claude/BACKEND_INTEGRATION.md`

**The seam is now connected.** The forms save through one adapter to a live Express + Postgres
API (see *Status* at the bottom). This file describes that seam — the contract every record page
saves through — which was designed so connecting a backend was a small, contained job rather than
a rewrite of 146 pages, and which is equally what lets the backend be re-pointed later without
touching a single record page.

**Still open**: where the app's data comes *from*. The forms have a shared store; they are not yet
fed by, or feeding, any other system. That is the subject of the architecture below.

### The intended architecture — upstream, NOT yet built

```
SYSPRO  ──(feeds out)──>  Microsoft Dataverse  ──(scheduled ETL)──>  this app's PostgreSQL
                                                                              │
                                                                        (read only)
                                                                              │
                                                                      this app's API
                                                                              │
                                                                        the forms
```

And back the other way, for traceability:

```
approved records  ──(scheduled batch, not per-user, not real time)──>  SYSPRO
```

**Why it is shaped this way:** SYSPRO runs on a limited number of concurrent user licences. If
the forms queried SYSPRO directly, every user session would risk consuming a licence seat and
could risk the integrity of live transactional data. So the app never queries SYSPRO directly and
never holds a live connection to it — it reads its own synchronised copy, and writes back only in
scheduled batches over a single controlled connection.

### The seam: one file, four functions

Everything the forms save goes through `window.storage` in
[public/lib/data-store.js](public/lib/data-store.js). No record page talks to storage directly —
all of them only ever call `window.storage`. That is the entire surface to reconnect.

To connect the API, **do not edit `data-store.js` and do not touch any record page.** Fill in
[public/lib/api-backend.js](public/lib/api-backend.js), which already implements this shape:

```js
// public/lib/api-backend.js
window.storage.useBackend({
  name: 'api',
  async get(key)            { /* -> { value: '<string>' } or null */ },
  async set(key, value)     { /* -> true / false */ },
  async remove(key)         { /* -> true / false */ },
  async getByPrefix(prefix) { /* -> { '<key>': '<value string>', ... } */ }
});
```

…then add its `<script>` tag immediately **after** the `data-store.js` tag on the pages that need
it.

#### Contract

| Rule | Detail |
|---|---|
| All four are `async` | Callers already `await` everything. |
| `value` is an opaque string | Records `JSON.stringify` themselves. Do not parse or reshape it. |
| `get` returns `{ value }` or `null` | Not a bare string. `null` means "not set". |
| Never throw | Swallow and log; a storage failure must not break a form mid-shift. |
| `getByPrefix` is ONE round trip | The Master Record Index reads ~130 `document_revision:*` keys at once. A loop of `get()` calls will stall the page. |
| Keys are namespaced strings | e.g. `document_revision:double-seam`, `submissions:brine-mixing`, `batch_link:3CP000001:...`. |

#### The `shared` flag already routes correctly

Every call takes a `shared` argument, and that routing survives the switch:

- `shared === false` → **always** this device's `localStorage`. Per-device state; never syncs.
- `shared !== false` → the active backend. Facility-wide data: submissions, specs, document
  revisions, batch links.

Records already pass `shared: true` for their real data, so the day a backend is registered that
data starts flowing to it and per-device state correctly stays put.

### What else this touches

- **Traceability** ([public/lib/traceability.js](public/lib/traceability.js)) rides on the same
  adapter — its index is stored as ordinary `batch_link:*` keys. It moves with the backend
  automatically; there is no second connection to wire. If the API can answer batch lookups more
  efficiently with a real relational query, override `window.Traceability.trace` and
  `.knownBatches` after that file loads. Nothing else reads the index directly.
- **Roles** ([public/lib/permission-rules.js](public/lib/permission-rules.js)) are a client-side
  "Acting as" selector written straight to `localStorage`, deliberately bypassing the adapter.
  Real identity arrives with Entra ID login, and that is a separate change from this seam — the
  role names are already in place so it drops into a structure that has meaning.

### Not yet decided

These are open questions from the working scope, listed here so the seam isn't closed around an
assumption:

- ~~Where the app's PostgreSQL is hosted~~ — **answered**: Neon, via `DATABASE_URL` on the
  `facility-api` Render service.
- ~~Offline / poor-connectivity behaviour~~ — **answered**: the write-ahead outbox described under
  *Status*. Queue on failure, drain on reconnect, reads overlay the queue.
- **Which upstream system feeds this one, and how.** The Dataverse path above is unbuilt and
  unowned. A live alternative exists: the Syspro→ERPNext nightly sync
  (`T:\Sales Dept\erp-evaluation`), which becomes the company's system of record on 1 July 2027.
  See `../INTEGRATION/02-FSMS-READINESS.md` for the comparison and recommendation.
- **The write-back leg.** `approved records → SYSPRO` in the diagram above must not be built as
  drawn: Syspro is read-only forever under an owner-mandated rule. Approved records would go to
  ERPNext instead.
- Input-source tagging (typed by a person vs. read from a sensor/device), which affects the value
  shape records save, not this adapter.
- Concurrent-edit / safe-failure behaviour when two people act on the same record.

### Caching gotcha

Static JS in `public/lib/` is cached hard by browsers. When editing a lib file, bump its `?v=N` on
**every** `<script src="../lib/....js?v=N">` tag that loads it, or a stale copy silently breaks the
page — a missing export throws inside an async IIFE with no visible console error. Current
versions: `data-store.js?v=5`, `api-backend.js?v=5`, `traceability.js?v=3`,
`lookups.js?v=1` (45 pages). Check with
`grep -rho 'data-store.js?v=[0-9]*' public --include=*.html | sort -u` rather than
trusting this line — it has gone stale before.

### Status: the seam is filled in and the API is live

`api-backend.js` is wired up on all 243 pages that load `data-store.js` (added right after it, per
the contract above) and implements the real Express API in [src/index.js](src/index.js), backed by
Postgres (Neon).

- **Deployed**: `https://processing-department-api.onrender.com` — `/api/health` returns 200.
  `API_BASE` ([public/lib/api-backend.js](public/lib/api-backend.js)) points at it and can be
  overridden per page with `window.FACILITY_API_BASE`.
- **Database**: [prisma/schema.prisma](prisma/schema.prisma) — a generic `KeyValue` table backing
  the storage contract, plus a `SubmissionDateField` table that automatically extracts and
  classifies every date field inside any `formrecord:*` record (see
  [data/date-field-classification.csv](data/date-field-classification.csv), sourced from
  `DATE_FIELDS_ALL_RECORDS.csv`).
- **API**: [src/index.js](src/index.js) — the four contract endpoints
  (`GET/PUT/DELETE /api/storage/key/:key`, `GET /api/storage/prefix/:prefix`), plus
  `GET /api/values/:recordKey/:field` (distinct values seen for a field, most-recent first),
  `GET /api/lookup/:recordKey/:field/:value` (find a submission by field value),
  `GET /api/dates` (query extracted dates by class and range) and `GET /api/health`.
- **Deployment**: [render.yaml](render.yaml) defines two Render services — `facility-site`
  (static, free, no spin-down) and `facility-api` (free-tier Node web service, so it **sleeps
  after 15 min idle** — the first request after a sleep is slow). Two secrets are set in the
  dashboard, never in git: `DATABASE_URL` (Neon) and `API_KEY`. `PORT` is deliberately not set —
  Render assigns it and `src/index.js` reads `process.env.PORT`.

#### Access is a per-device shared key

The API requires `Authorization: Bearer <key>`. `/api/health` and CORS preflights are exempt so
uptime probes keep working. If `API_KEY` is unset the API runs **unprotected** and logs a warning
on startup, so enabling it is a one-step dashboard change that never leaves the site broken
between deploys.

A device with no key gets 401 on every call, which otherwise looks exactly like an empty
database — so `api-backend.js` shows a red banner once, linking to
[public/pages/api-key.html](public/pages/api-key.html) where the key is entered once per device.

**What this is and isn't**: a device-level shared secret, not user identity. It stops the API
being read or wiped by anyone with the URL. It does not stop someone who can already use the site
from reading the key out of their own browser. Real per-user auth needs Entra ID; until then
`auth.js` is a client-side shared password and `permission-rules.js` a client-side role picker,
so neither can be enforced server-side. A lock on the front door, not an audit trail.

#### Writes queue; they no longer fall back to localStorage

The backend is registered **unconditionally**, including when the API is unreachable. It used to
fall back to `localStorage` on a failed health check, which quietly turned an outage into a
device-local write that reported success and was then stranded on one tablet.

Instead there is a durable outbox (`facility_api_queue`):

- a failed write is queued and replayed on reconnect, with a badge showing the pending count;
- the queue is **collapsed by key, last write wins** — both engines persist the whole submissions
  array on every save, so an older queued write is a strictly older copy of the same array, not a
  missing change. This is also what stops the queue growing unbounded over a long shift;
- **reads overlay the queue**, so a value you saved while offline doesn't vanish from the list
  until it syncs;
- if the device has no durable storage, `enqueue` returns false and the caller reports a real
  failure rather than a false "Draft saved".

The health check now only decides whether to attempt an immediate drain — not whether the backend
is used at all.

This is an outbox, not an offline cache: records saved on *another* device while this one is
offline are still not readable until the connection returns.

---

## Intelligent Agent Role-Out Template — Production Record Design Pattern

> **Source:** `claude/intelligent-agent-role-out-template.md`

**Purpose:** Standardized workflow for Claude to design and specify new production records across the facility, following the pattern established by the Canning Production Record (REC-7.3.X).

**Date:** 2026-09-18  
**Status:** Template  
**Used for:** Rolling out data-entry forms for new production stages, equipment, or processes.

---

### Overview

This document describes how to brief Claude (Claude Code or Claude Design agent) to design new production records that follow Processing Department standards. Each new record should result in:

1. **Design & Layout Instructions** (markdown) — user-facing spec, clear layout, field definitions, validation rules.
2. **Technical Specification** (markdown) — implementation-ready HTML/JS/CSS structure, data storage schema, testing checklist.
3. **Completed page** (HTML) — coded, tested, and ready to deploy.

The template below is a **checklist and briefing framework** for Claude to follow every time a new production record is needed.

---

### Part 1: Gather Requirements (Before briefing Claude)

#### 1.1 Understand the Process
- What stage of production does this record capture? (e.g., intake, processing, packaging, QA)
- Who are the users? (e.g., floor operators, supervisors, lab technicians)
- What equipment or actions trigger a record entry? (e.g., trolley entering retort, batch completed, sample drawn)
- How often is this record used? (dozens times/day, once/week, etc.)

#### 1.2 Identify Core Data Fields
- **Grouping:** Do fields naturally cluster into sections? (e.g., equipment info, batch details, quality measurements, comments)
- **Required vs. optional:** Which fields must always be filled? Which are conditional?
- **Relationships:** Does this record link to another existing record type? (e.g., a batch record links to a job, a sample links to a batch)
- **Dropdowns vs. free-entry:** Which fields should use fixed lists (dropdowns) vs. allow new values?

#### 1.3 Define Validation & Constraints
- Date/time fields: any bounds? (e.g., can't be in future, must be after job start)
- Numeric fields: ranges? (e.g., weight > 0, temperature 70–120°C)
- Conditional fields: when do some fields appear/disappear? (e.g., Sauce Batch only if Medium="Braised")
- Field interdependencies: if field A changes, should field B update? (e.g., choosing a different can size should clear a cache)

#### 1.4 Confirm Data Output & Storage
- What reports or dashboards will consume this data?
- How should the data be stored? (KeyValue table with namespaced key, or a dedicated schema?)
- Do records need to link for traceability? (e.g., batch → job, sample → batch → trolley)
- Any fields that should generate computed/derived values? (e.g., total weight, yield %, time delta)

#### 1.5 Decide on Scope & Schedule
- **MVP scope:** Which fields/features are essential for v1? (e.g., basic data capture, no barcode scanning)
- **Future enhancements:** What would be nice-to-have? (e.g., offline mode, templates, real-time dashboard)
- **Timeline:** When does this record need to be live? (influences breadth of documentation)

---

### Part 2: Brief Claude (Claude Code Agent or Design Agent)

#### 2.1 The Design Brief

**Prompt structure for Claude (copy and customize):**

```
I need you to design a new production record for the Processing Department.

**Record Name:** [REC type and human name, e.g., "REC-7.4.X Sauce Batch Preparation"]

**Process Context:**
[1-2 paragraphs describing what this record captures and why. Example: "This record logs the preparation of sauce batches used in braised canning. Operators enter batch ID, ingredients, quantities, and mixing times. The record feeds into the Canning Production Record and Quality Report."]

**Users:**
[Who fills it out and when? Example: "Kitchen staff, 2–3 times per shift"]

**Trigger/Workflow:**
[When/how is this record opened? Example: "When a new sauce batch is started; record completed when batch is ready for use."]

**Core Data Fields:**
[List the fields you want captured, grouped logically. Example:
- **Batch Info:** Batch ID, Date Started, Chef Name
- **Ingredients:** Sugar (kg), Water (L), Spices List
- **Process:** Mixing Duration (minutes), Final Temperature (°C)
- **Quality:** pH Reading, Smell OK (yes/no), Comments
]

**Key Constraints & Validation:**
[Any rules that should be enforced. Example:
- Batch ID must be unique
- Mixing Duration > 0 minutes, < 120 minutes
- Final Temperature must be 60–100°C
- pH must be 2.5–4.5
- Comments are optional
]

**Data Linkage:**
[Does this record link to others? Example: "Batch ID should match a record in the Inventory system. Batches link forward to Canning Production records via Sauce Batch ID."]

**Storage:**
[Where should this go? Example: "KeyValue table, key format: 'sauce-batch:<batch-id>:<date-created>'"]

**Scope & Timeline:**
[What's v1, what's future? Example: "v1: basic form entry, no barcode scanning. Future: scale integration, batch re-use templates."]

**Reference Records:**
[Any existing records to match pattern from? Example: "Follow the layout and validation style of REC-7.3.X Canning Production Record."]

---

**Deliverables:**
1. Design & Layout Instructions (markdown) — user-facing spec with clear field descriptions, layout notes, validation rules
2. Technical Specification (markdown) — implementation guide with HTML structure, JS logic, CSS patterns, data schema, testing checklist
3. (Optional) Implementation if scope permits

**Format:** Both markdown files should follow the same structure as the Canning Production Record instructions (see project docs).
```

#### 2.2 Attachments/Context for Claude
- Link to this template in your brief (so Claude knows the expected structure).
- Attach or reference the **Canning Production Record** design and technical specs as examples of the expected format.
- If there are related existing records (e.g., a receiving form that feeds into this), include links.
- Any relevant wireframes, photos of paper forms, or existing spreadsheet layouts that show current process.

---

### Part 3: Review Claude's Output (Quality Gate)

#### 3.1 Design & Layout Instructions Checklist

- [ ] **Fields clearly grouped** into logical sections (trolley, batch, quality, comments, etc.)
- [ ] **Each field has:** Type (text/number/dropdown/datetime), Required (Yes/No), Notes (example, constraints, or conditional rules)
- [ ] **Visual layout described:** How wide are fields? Do they wrap on mobile? Are there sub-sections?
- [ ] **Validation rules stated:** Date bounds, numeric ranges, conditional appearance, interdependencies
- [ ] **Data storage schema shown:** JSON example of how the record is stored
- [ ] **UI/UX patterns** reference existing Processing Department styles (record-theme.css, toolbar, buttons)
- [ ] **Open questions called out:** Anything ambiguous is flagged for you to answer before Claude codes
- [ ] **Spacer items noted:** Any fields that need configuration (dropdown lists, compute functions, etc.)

#### 3.2 Technical Specification Checklist

- [ ] **HTML structure:** Form groups, field names, ARIA labels, semantic fieldsets
- [ ] **JavaScript:** Event handlers, validation logic, batch row management (add/delete), conditional field visibility
- [ ] **CSS:** Responsive grid, mobile stacking, button sizing, error styling, toast notifications
- [ ] **Data storage logic:** How record is serialized, key format, what fields are included
- [ ] **Integration points:** Where does this connect to existing code (window.storage, API, shared validation)?
- [ ] **Testing checklist:** Specific test cases (form submission, validation failures, mobile layout, accessibility)

#### 3.3 Common Issues & Fixes

| Issue | Fix |
|---|---|
| Field descriptions are vague | Ask Claude to add examples and ranges (e.g., "1–50 pieces allowed"). |
| Layout is desktop-only | Ensure **flex-wrap on tablet** is stated; ask for mobile stacking details. |
| Dropdowns are autocomplete | Change to native `<select>` unless there's a strong reason for autocomplete. |
| No total/counter shown | Ask Claude to add running sums or totals if batches/rows are being added. |
| Conditional fields not clearly triggered | Specify exactly which parent field value triggers which child field. |
| Validation too strict or too loose | Review ranges/constraints; adjust and re-brief Claude. |
| Data schema doesn't match existing KeyValue pattern | Align with `<namespace>:<id>:<timestamp>` format used elsewhere in the app. |

---

### Part 4: Iterate & Refine (If Needed)

#### 4.1 Review Comments in Claude
- Use Claude's review feature to highlight fields or sections that need changes.
- Keep feedback concise and actionable (e.g., "change to dropdown" or "add timestamp button").

#### 4.2 Request Changes
- If major changes are needed, re-brief Claude with updated requirements.
- If minor tweaks, use review comments (faster turnaround).

#### 4.3 Finalize & Approve
- Once design and spec are approved, move to implementation (hand to Claude Code).
- Both markdown files become part of the project documentation.

---

### Part 5: Hand Off to Claude Code (If Implementing)

**Brief Claude Code** with the approved technical specification:

```
I have a technical specification for a new production record: REC-7.X.X [Name].
The spec is here: [link to technical-spec markdown]

Please implement this as public/pages/[record-slug].html

Reference records for style/pattern:
- public/pages/canning-production.html (similar batch-row management)
- public/lib/data-store.js (storage adapter)

Deliverables:
1. Completed HTML file (self-contained, no separate CSS/JS files)
2. Test results (manual testing of form, validation, mobile layout)
3. Screenshots of the rendered form

Timeline: [date needed]
```

---

### Part 6: Post-Launch Checklist

- [ ] **Live on staging:** Test with real data from a small batch of users.
- [ ] **Mobile testing:** Verify on tablet and phone; check touch targets and layout.
- [ ] **Data validation:** Do submitted records appear in the database with the correct schema?
- [ ] **Traceability:** Can records be linked forward/backward to related records?
- [ ] **Performance:** Does form load quickly? Any lag on submit?
- [ ] **User feedback:** Are operators comfortable with the data entry flow? Any confusion?
- [ ] **Documentation:** Is the form linked in the main Record List navigation?

---

### Template Variables (Customize Per Record)

When using this template for a new record, fill in:

| Variable | Example | Your Value |
|---|---|---|
| Record Name | REC-7.4.X Sauce Batch Preparation | |
| Process Context | What gets captured and why | |
| Users | Who fills it, how often | |
| Core Fields | Grouped list of fields | |
| Key Constraints | Validation rules, ranges | |
| Data Linkage | Links to other records | |
| Storage Format | KeyValue namespace or schema | |
| Timeline | When needed | |
| Implementation Date | After design approval | |

---

### Examples of Records to Design Next

Candidates for this template (in priority order):

1. **REC-7.4.X Sauce Batch Preparation** — kitchen staff log batch prep, ingredients, mixing times
2. **REC-7.5.X Quality Sampling** — lab tech records sample measurements, pH, appearance
3. **REC-7.6.X Waste Tracking** — log damaged goods, trim, off-grade product
4. **REC-7.7.X Staff Shift Handover** — shift change summary, equipment status, notes for next shift
5. **REC-7.8.X Maintenance Log** — equipment maintenance records, parts replaced, downtime

Each can follow this same template and output structure.

---

### Quick Checklist for Next Record

Before briefing Claude on a new record:

- [ ] I've identified the process this record captures
- [ ] I've listed 8–12 core fields (grouped logically)
- [ ] I know which fields are required vs. optional
- [ ] I know which fields should be dropdowns vs. free-entry
- [ ] I know if this record links to existing records
- [ ] I know the validation rules (ranges, constraints, conditions)
- [ ] I've decided MVP scope vs. future enhancements
- [ ] I have a timeline
- [ ] I have a reference record to match style from (e.g., Canning Production)

**If all boxes are checked:** You're ready to use this template and brief Claude.

**If boxes are unchecked:** Spend 30 min clarifying those details first — it will save Claude time and reduce iteration cycles.

---

### Supporting Files & Links

- **Canning Production Record Design Instructions:** `claude/canning-production-record-design-instructions.md`
- **Canning Production Record Technical Spec:** `claude/canning-production-record-technical-spec.md`
- **Consolidated Plan (system overview):** `claude/consolidated-plan.md`
- **Layout Redesign Instructions (tablet/mobile patterns):** `claude/layout-redesign-instructions.md`
- **Processing Department Data Store Adapter:** `public/lib/data-store.js`
- **Record Theme CSS (styling):** `public/css/record-theme.css`

---

## Render build failure — 2026-09-11 (resolved, transient)

> **Source:** `claude/render-build-failure-2026-09-11.md`

**Service:** PROCESSING_DEPARTMENT API (`facility-api`, srv-da6n74u1egvs73995kp0)
**Failed deploy:** commit `12b75fd`, 2026-09-11 14:42:36 GMT+2, duration 29.8s
**Retry deploy:** same commit `12b75fd`, manually redeployed 14:45:59 GMT+2 — **succeeded, live**
at 14:46:41 GMT+2 (`dep-dahvg1qfngtc73e80ldg`).

### Root cause (confirmed)
Not a code error. First attempt got through `npm install` and `npx prisma generate` cleanly,
then failed on `npx prisma migrate deploy`:

```
Error: P1002
The database server at `ep-long-pond-aydj6pgg-pooler.c-5.us-east-2.aws.neon.tech:5432` was
reached but timed out.
Context: Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369)).
Elapsed: 10000ms.
```

Classic Neon free-tier cold-start: the database compute had suspended from inactivity, and
Prisma's migration lock attempt gave up (10s) before Neon finished waking the endpoint back up.

**Confirmed by the retry:** redeploying the identical commit ~3 minutes later, after the database
had been kept active by browsing the live site, produced `No pending migrations to apply.`
instantly and the build succeeded in 41.3s total. Same commit, same migrations, only difference
was DB wake state — proves this was purely a cold-start timing issue, not a code defect.

### Resolution
Manually triggered "Deploy latest commit" from the Render dashboard for the PROCESSING_DEPARTMENT
API service. Build succeeded, service went live at 14:46:41 GMT+2. Verified afterward: Job Status
Updates page loads correctly, all 3 existing jobs (CPR002045, 3CP0001112, CPR001598) still present
with data intact — no impact from the failed-then-retried deploy.

### Impact
None to end users at any point. Render deploys are sequential — the failed deploy never replaced
the previously-live build (`7a98849`), so the site was continuously available throughout.

### Relevance to the Neon free-tier risk already tracked
This is a concrete, dated instance of the exact risk flagged in `claude/consolidated-plan.md`
Section 1 (Neon free-tier sleep/cold-start behavior). Worth citing here if it recurs — evidence
for prioritizing either a paid Neon tier or making the migration step resilient to cold starts,
rather than treating the risk as hypothetical.

### Follow-up (not urgent after a single occurrence)
If this recurs, consider a build-command change: ping/wake the database (e.g. a trivial query)
before `npx prisma migrate deploy` runs, or wrap the migrate step with a longer timeout/retry.
No action taken on this yet — watch for recurrence first.

### Status
**Resolved.** No code change was needed or made.

---
