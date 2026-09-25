# Processing Department — Consolidated Plan & Open Decisions

**Status as of 2026-09-09.** This is the single place that tracks what's built, what's decided,
and what's still open across the whole system. Read this before starting any new work so nothing
gets duplicated or re-litigated.

---

## 1. What's already built (do not redesign this)

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

## 2. Decisions made this session (2026-09-09)

| Decision | Answer | Why |
|---|---|---|
| Drying Report scope | **Option A** — ship using only data already in the database (`abalone-receiving`, `drying-process`, `grading-production-log-cultivated`). Paper-form-only fields (Drying Code, PO no., mortalities, piece counts, etc.) are left out of v1. | Ships immediately; avoids a new record type and schema work before the report itself is proven useful. |
| Quick Abalone Receiving scope (tablet redesign) | **Out of scope** — treated the same as Handovers. Left untouched, no sidebar/shell applied. | It's a separate top-level flow, not one of the ~130 records reached from Record List. |
| Upstream integration path | **ERPNext**, not Dataverse. Plan this app's future upstream feed against the Syspro→ERPNext nightly sync (system of record from 1 July 2027), not the original Syspro→Dataverse→Postgres design. | Dataverse path is unbuilt and unowned; ERPNext path is live and has an owner-mandated timeline. |
| Computed-field representation in `RecordDefinition` (relational migration) | **Named-function registry**, not an expression DSL — see Section 6 below for the full schema shape. | 15 known formulas are small and regular (sums, subtraction, rounding, ceiling); a registry keeps the existing JS almost as-is and avoids building/maintaining a parser for a list that may never grow. DSL stays an option later if the formula count grows significantly. |

These decisions are now reflected in `claude/drying-report-spec.md` and
`claude/layout-redesign-instructions.md` (updated alongside this doc).

---

## 3. Work items, in order

### 3.1 Drying Report (`public/pages/drying-report.html`) — ready to build
Spec: `claude/drying-report-spec.md` (updated with the Option A decision — no more open question
blocking this). Follows the `canning-report.html` pattern. Give the spec file directly to Claude
Code as the build task; it already contains the full field mapping, source records, and CSV/print
requirements.

**Fast-follow (not now):** if paper-form parity is wanted later, that's Option B from the spec —
a new `REC-7.4.X-drying-report-extras` record — scope it as a separate task when requested.

### 3.2 Tablet record-entry redesign — ready to build, edge case resolved
Spec: `claude/layout-redesign-instructions.md` (updated — Quick Abalone Receiving confirmed out of
scope, same as Handovers). Remaining step before Claude Code batch-applies anything: flag any
other Record List entries that overlap with out-of-scope pages (Job Status, Traceability, etc.),
per Section 6 step 1 of that spec. Build order in that doc (Section 6) still applies as written:
tokens/shell → one repeating-row record → one single-submission record → review → batch-apply →
responsive check → regression check.

### 3.3 Upstream integration (Syspro → this app) — needs a design pass, not code yet
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

### 3.4 Real identity / login (Entra ID) — not started, not scheduled
Currently a client-side "Acting as" role selector in `localStorage`, not tied to any real
authentication. No spec exists yet. Raise this as its own planning task when it becomes a
priority — it touches every page's permission checks, so it deserves its own scoped instruction
file rather than being folded into either of the two builds above.

### 3.5 Relational `RecordDefinition` migration (moving record definitions into the DB) — schema decided, extraction done
This is a separate track from the KeyValue system described in Section 1: it's about representing
each of the ~131 record pages as data (`RecordDefinition` + child field/section rows) instead of as
hand-written page JS, so record structure itself becomes inspectable and editable without a code
change. `scripts/extract-definitions.mjs` (report-only, writes nothing) confirmed on 2026-09-09
that 124 of 131 record pages are purely declarative and map with zero manual work; 7 are flagged,
all for the same root cause (a computed/derived field backed by inline JS). See Section 6 for the
schema decision that unblocks migrating those 7.

---

## 4. What NOT to do
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

## 5. Files referenced
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

## 6. Schema decision: computed fields and client hooks in `RecordDefinition`

This section exists so the 2026-09-09 extraction backlog (7 flagged records, ~15 formulas) doesn't
get re-litigated per-record. Decide the shape once, apply it uniformly.

### 6.1 Computed fields — named-function registry
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

### 6.2 New field types
Add four field types to the generator's type map — straightforward 1:1 column mappings, no schema
design needed beyond this table:

| Field type | Maps to |
|---|---|
| `month` | `<input type="month">` / stored as string |
| `timestamp` | DateTime column |
| `datetime` | DateTime column |
| `digits` | Integer column |

### 6.3 Client hooks (bespoke JS that isn't a single computed field)
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

### 6.4 What this unblocks
With 6.1–6.3 decided, all 131 record pages have a defined home in the relational model: 124 map
directly today, 45 of those already via `RecordAutofillDef`, and the remaining 7 map once
`computeFn`/`computeArgs` (four records) and `clientHook` (three records, one needing manual
field-list confirmation first) are added as columns. No record requires inventing a new mechanism
beyond these two columns.
