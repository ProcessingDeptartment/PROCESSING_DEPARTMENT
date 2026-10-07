# Traceability and Field Reference

How batches are traced, field inventory, identifier questions and work-instruction content.

_Consolidated from 7 original files. Cross-references inside the text to old file names refer to the original files; see `00_INDEX.md` for where each one now lives._

## Contents

1. [Batch traceability](#batch-traceability) — `claude/TRACEABILITY.md`
2. [Export Batch Linking — Dry Export Pack Front Page](#export-batch-linking--dry-export-pack-front-page) — `Claude outputs/export-batch-linking-spec.md`
3. [Processing Department — Complete Field Inventory (Final Live Audit)](#processing-department--complete-field-inventory-final-live-audit) — `claude/Processing-Department-Field-Inventory.md`
4. [Note: "Production code" vs "AG code" — are they the same identifier?](#note-production-code-vs-ag-code--are-they-the-same-identifier) — `claude/PRODUCTION_CODE_VS_AG_CODE.md`
5. [Note: "Checked by" vs "Checked by (QC)" — label and key variants](#note-checked-by-vs-checked-by-qc--label-and-key-variants) — `claude/CHECKED_BY_FIELD_VARIANTS.md`
6. [Work Instructions — Full Content Extract](#work-instructions--full-content-extract) — `claude/Work-Instructions-Content-Extract.md`
7. [Work Instructions Field — Visibility Note](#work-instructions-field--visibility-note) — `claude/Work-Instructions-Visibility.md`

---

## Batch traceability

> **Source:** `claude/TRACEABILITY.md`

Trace a product batch/lot forwards and backwards across every record that touched it.
The traceable identifier is the **job number** (format enforced: `3CP`, `3DP`, `CPR`, or `DPR`
followed by digits), so that's what the trace follows. The trace includes production,
quality, testing, and recall initiation records.

### Setup

None. The index rides on the shared storage adapter, so every save of an opted-in record writes
its link entries automatically. Today that means this device's browser storage; when the backend
is connected (see [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md)) traceability moves with it,
with no separate wiring.

### Batch number format

All job/batch numbers must match one of these **required formats**:
- `3CP` — Canned Product (e.g., `3CP000001`)
- `3DP` — Dried Product (e.g., `3DP000001`)
- `CPR` — Canned Product Rework (e.g., `CPR000001`)
- `DPR` — Dried Product Rework (e.g., `DPR000001`)

When filling in a `jobNumber` or batch field, the system validates the format on save
and rejects invalid entries with a helpful error message.

### How it works

- Record bodies are stored by the record engines unchanged. The batch index is thin: one entry
  per (job number × record × submission), stored through `window.storage` under
  `batch_link:<job>:<record>:<submission>`.
- A record participates **only** if its config declares a batch field — no guessing. This avoids
  false links from the ~40 differently-named ingredient/consumable "batch" fields (sugar, salt,
  xanthan gum, chemicals) that are *not* the product batch.
- The shared engines ([form-record.js](public/lib/form-record.js),
  [monitoring-log.js](public/lib/monitoring-log.js)) call
  `Traceability.indexSubmission()` after each save. Indexing is best-effort: if it fails, the
  record still saves normally.
- [records/batch-trace.html](public/records/batch-trace.html) is the lookup page (linked from the
  records hub). Enter a job number → a date-ordered timeline of every touchpoint, each linking to
  the record. Deep-link with `batch-trace.html?batch=JOB123`.

### Records already opted in

| Record | Stage |
|--------|-------|
| Precooking Check Sheet (7.2.3) | precooking |
| Retorting Control Sheet (7.2.8) | retorting |
| Cans Produced (7.2.7) | canning |
| QC Report (7.2.11) | quality |
| Dried Abalone Transfer (7.4.10) | dry-transfer |
| Traceability & Mock Recall — Canned Abalone (8.1.6) | recall-canned |
| Traceability & Mock Recall — Canned Braised Abalone (8.1.6a) | recall-braised |
| Traceability & Mock Recall — Canned Minced Abalone (8.1.6b) | recall-minced |
| Traceability & Mock Recall — Dried Abalone (8.1.7) | recall-dried |

### Adding more records

Any record with a job-number (or other batch) field can join. Two edits:

1. In the record's config object (next to `recordKey`), add:
   ```js
   batchField: 'jobNumber',   // the field key holding the product batch/lot
   stage: 'drying',           // optional label for the timeline
   // batchDateField: 'dateDried',  // optional; else the record's first date field / `date` is used
   ```
2. Load the lib — after the `data-store.js` script tag add:
   ```html
   <script src="../lib/traceability.js?v=2"></script>
   ```

Other records carrying `jobNumber` not yet wired: brine-mixing-report, dispatch-receiving-checklist,
dry-cooking, dry-export-pack-front-page, dry-monitoring, drying-process,
grading-production-log-cultivated, grading-production-log-ranched. Add them the same way when you
want them in the trace.

> Note: where `jobNumber` is a per-row roster/log column rather than one value for the whole
> submission, indexing needs a small extension (one link per row) — flag those and I'll wire them.

---

## Export Batch Linking — Dry Export Pack Front Page

> **Source:** `Claude outputs/export-batch-linking-spec.md`

**Purpose:** Replace the Y/N "attached?" checklist on the Dry Export Pack Front Page with the
actual pulled-in content from REC 7.4.7 (Labelling of Dry Boxes), REC 7.4.8 (Dry Labelling List)
and REC 7.4.9 (Dry Stock Transfers) — all four linked by one shared `exportBatch` number, using
the app's **existing Batch Traceability engine**, not a new indexing mechanism.

Repo: `PROCESSING_DEPARTMENT` (Render services `facility-site` / `facility-api`, Neon Postgres via
Prisma). Confirmed against the live system on 2026-09-09: all four records (front page, 7.4.7,
7.4.8, 7.4.9) currently have **zero submitted entries**, so this migration carries no risk of
orphaning real data — re-check `View entries` on each before merging, in case that's changed.

### Revision note

An earlier draft of this spec proposed a brand-new `SubmissionIndex` Postgres table and a new
`/api/linked/:exportBatch` endpoint. **That is unnecessary — the app already has exactly this
mechanism, live in production, under a different name: Batch Traceability.** This revision reuses
it instead of duplicating it. Confirmed by reading the source:

- `public/lib/traceability.js` — `indexSubmission(config, sub)` already writes one indexed row per
  batch touchpoint to Postgres (`batch_link:<batch>:<recordKey>:<submissionId>` keys), keyed off
  whatever field the record declares as `config.batchField`. It also already supports genealogy
  (`rel: 'input'/'output'/'self'`) via `extraBatchFields` and roster batch columns, and a
  `config.traceSummary(sub)` hook for a human-readable one-line summary per entry.
- `public/lib/form-record.js:1423` and `public/lib/monitoring-log.js:1250-1251` already call
  `Traceability.indexSubmission` automatically on every save, whenever the record's config sets
  `batchField` — no per-record wiring needed beyond declaring the field.
- `src/index.js` (`GET /api/trace/:batch`, lines 288-339) already runs this as a real Postgres
  query (`keyValue.findMany` with `startsWith`/`contains` on the `batch_link:` prefix), not a
  client-side blob scan — i.e. Neon is already carrying this weight for every other record that
  sets `batchField` (e.g. Abalone Receiving via `jobNo`).
- `public/records/batch-trace.html` already renders this as a full timeline UI (genealogy +
  chronological touchpoint cards with title/date/stage/summary/link), reachable today at
  `/records/batch-trace.html?batch=<exportBatch>`.

So the actual build is much smaller: **make `exportBatch` each record's `batchField`**, and add a
small **inline** render of the same data (via `window.Traceability.trace(batch)`) directly on the
Dry Export Pack Front Page, in place of the Y/N toggles — rather than routing the user out to the
separate batch-trace page. No schema migration, no new backend endpoint.

### 1. Data model change — same as before

Add one new field, `exportBatch` (free-text, same style as the existing `jobNumber` /
`3DP00001`-type codes), to four record configs, **and declare it as that record's `batchField`**:

| Record | File | Change |
|---|---|---|
| Dry Export Pack Front Page | `public/records/Dry-Export-Pack-Front-Page-dry-export-pack-front-page.html` | New field; **this becomes the page's `batchField`** (currently `jobNumber` is — see open item below) |
| REC 7.4.7 Labelling of Dry Boxes | `public/records/REC-7.4.7-labelling-of-dry-boxes.html` | New field + new `batchField: 'exportBatch'` — this record currently has **no** batch link of any kind |
| REC 7.4.8 Dry Labelling List | `public/records/REC-7.4.8-dry-labelling-list.html` | New field **alongside** existing `agCode`; **change `batchField` from `'agCode'` to `'exportBatch'`** — see note below |
| REC 7.4.9 Dry Stock Transfers | `public/records/REC-7.4.9-dry-stock-transfers.html` | New field + new `batchField: 'exportBatch'` — currently has **no** batch link of any kind |

Decided with the requester (2026-09-09):
- Batch codes are free text in the existing job-number style (no new numbering scheme).
- Batch traceability should link on export batch number — confirmed 2026-09-09.
- 7.4.8 keeps `agCode` as a real field (per-box data, untouched), but see the `batchField`
  question below — `Traceability.indexSubmission` only reads **one** `config.batchField` per
  record, so 7.4.8 needs a decision on which field actually drives the trace index.

#### ⚠️ Open decision: `batchField` is singular per record

`indexSubmission` reads exactly one `config.batchField` — it is not a list. Two places this bites:

1. **REC 7.4.8** currently has `batchField: 'agCode'`. Switching it to `'exportBatch'` means it
   stops being traceable by AG code (a box-level identifier NRCS cares about) and starts being
   traceable by export batch instead. If AG-code traceability is still needed, use
   `extraBatchFields: ['agCode']` (already-supported mechanism, see `traceability.js` lines
   20-27, 98-109) alongside `batchField: 'exportBatch'` — this indexes AG code as a **secondary**
   link (default `rel: 'input'`) rather than the primary one, so both traces still work:
   `batch-trace.html?batch=<exportBatch>` shows it directly, `batch-trace.html?batch=<agCode>`
   shows it via genealogy ("went into" / "made from"). **Recommended**, since it costs nothing and
   loses no existing capability.
2. **Dry Export Pack Front Page** currently has no `batchField` set at all in the config shown to
   us (only `jobNumber` is a field; the front page's `FormRecord.init` doesn't currently declare
   `batchField`, unlike e.g. Abalone Receiving) — confirm this before assuming it needs to
   *change* one vs. simply *set* one for the first time. If job-number traceability is wanted too,
   use the same `extraBatchFields: ['jobNumber']` pattern.

#### Front page (`FormRecord.init` config)

```js
FormRecord.init({
  mount: '#frRoot',
  recordKey: 'dry-export-pack-front-page',
  batchField: 'exportBatch',              // NEW — was unset; this is what makes indexSubmission fire
  extraBatchFields: ['jobNumber'],        // OPTIONAL — keep job-number traceability alongside it
  ...
  sections: [
    { title: 'Shipment details', fields: [
      { key: 'jobNumber', label: 'Job number', type: 'jobsearch' },
      { key: 'exportBatch', label: 'Export batch', type: 'text', required: true },   // NEW
      { key: 'packingDate', label: 'Packing date', type: 'date', required: true },
      { key: 'noOfBoxesExported', label: 'No. of boxes exported', type: 'number' }
    ]},
    { title: 'Attachments checklist', fields: [ /* see section 3 — replaced */ ] },
    ...
  ]
});
```

#### REC 7.4.7 (`MonitoringLog.init` config)

```js
MonitoringLog.init({
  mount: '#mlRoot',
  recordKey: 'labelling-of-dry-boxes',
  batchField: 'exportBatch',    // NEW — this record had no batch link before
  entryFields: [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'exportBatch', label: 'Export batch', type: 'text', required: true },   // NEW
    { key: 'clientName', label: 'Client name', type: 'text' },
    ... (unchanged)
  ],
  traceSummary: (sub) => {                 // NEW — powers the trace timeline's one-line summary
    const v = sub.values || {};
    return `${v.quantityOfBoxes || '?'} boxes, inspected by ${v.inspectedByProcessing || '—'}`;
  },
  ...
});
```

#### REC 7.4.8 (`FormRecord.init` config)

```js
FormRecord.init({
  mount: '#frRoot',
  recordKey: 'dry-labelling-list',
  batchField: 'exportBatch',            // CHANGED from 'agCode' — see open decision above
  extraBatchFields: ['agCode'],         // ADD if AG-code traceability must be preserved (see above)
  sections: [
    { title: 'Shipment details', fields: [
      { key: 'customer', label: 'Customer', type: 'text', required: true },
      { key: 'exportBatch', label: 'Export batch', type: 'text', required: true },  // NEW
      { key: 'flight', label: 'Flight', type: 'text' },
      ... (unchanged; agCode stays only in the roster rows, untouched)
    ]},
    ...
  ],
  traceSummary: (sub) => {
    const v = sub.values || {};
    return `${v.customer || '—'}, ${v.nettWeight || '?'}kg, flight ${v.flight || '—'}`;
  }
});
```

#### REC 7.4.9 (`MonitoringLog.init` config)

```js
MonitoringLog.init({
  mount: '#mlRoot',
  recordKey: 'dry-stock-transfers',
  batchField: 'exportBatch',    // NEW — this record had no batch link before
  entryFields: [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'exportBatch', label: 'Export batch', type: 'text', required: true },   // NEW
    { key: 'noOfBoxes', label: 'No. of boxes', type: 'number' },
    ... (unchanged)
  ],
  traceSummary: (sub) => {
    const v = sub.values || {};
    return `${v.noOfBoxes || '?'} boxes transferred by ${v.transferredBy || '—'}`;
  }
});
```

Per `BACKEND_INTEGRATION.md`'s caching gotcha: bump `?v=N` on every `<script src="...form-record.js?v=27">`
/ `monitoring-log.js?v=25` tag once their behaviour changes (section 3), and grep for stale
references before shipping (`grep -rho 'form-record.js?v=[0-9]*' public --include=*.html | sort -u`).

### 2. Backend / Neon — no schema change needed, but be clear about where the weight actually sits

Nothing to add. `batch_link:*` rows already flow through the existing `KeyValue` table and
`/api/trace/:batch` query. Declaring `batchField: 'exportBatch'` on all four records is what makes
Postgres start carrying this join — the exact same mechanism already live for Abalone Receiving,
Ingredient Weighing, Sauce Mixing, etc. (see the other `batchField`/`extraBatchFields` entries in
`traced-records.js`).

**Important distinction, so this isn't misread as "Neon models the forms":** Neon is still just a
generic key/value store (`KeyValue.key`/`.value`, `value` an opaque JSON string — see
`prisma/schema.prisma`). It does not know what a "Dry Export Pack" or a "box" or an "export batch"
*is* — it only ever stores whatever blob `form-record.js`/`monitoring-log.js` hand it, plus the
derived `batch_link:*` / `SubmissionDateField` rows those two client-side engines choose to write
out. **All the actual heavy lifting — field definitions, validation, required fields, roster
rows, what a "box" or an "AG code" or an "export batch" means, what gets shown, what's
required-to-submit — lives in the `.js` form configs (`form-record.js`, `monitoring-log.js`, and
each record's own `FormRecord.init({...})`/`MonitoringLog.init({...})` call), not in the
database.** Neon's job here stays exactly what it already does elsewhere in this app: hold the
submitted blobs, and hold the *derived* indexes (`batch_link:*`, `SubmissionDateField`) that the
client-side code computes and writes to it after the fact. This feature doesn't change that
division — it just adds one more field (`exportBatch`) to the client-side configs that already
decide what gets indexed. Whoever builds this should not go looking for schema/relations to
encode "export batch" as a first-class Postgres concept — that would be new architecture, not what
this spec asks for, and it would require its own design pass (foreign keys, a real `ExportBatch`
table, etc.) rather than reusing the existing blob+derived-index pattern.

**Do still consider one real gap, independent of this feature**: `indexSubmission` writes a
`batch_link:*` row on *every* save, draft or submitted — there is no `status`/`__status` filtering
in `traceability.js`, unlike the `/api/lookup` autofill path which explicitly flags provisional
draft values (`values.__status`). That means a same-shift draft 7.4.7 entry will already show up
on the Dry Export Pack trace before it's finalised. Decide whether that's acceptable (arguably
fine here — "in progress" visibility might be useful) or whether `indexSubmission` needs a
`sub.status !== 'submitted'` guard added. This is a pre-existing gap in the shared Traceability
code, not something specific to this feature, so flag it but don't block this build on it unless
the answer is "must not show drafts."

### 3. Front-page UI: replace the Y/N checklist with real pulled-in content

Current (to be replaced), in the front page's config:

```js
{ title: 'Attachments checklist', fields: [
  { key: 'rec747Attached', label: 'REC 7.4.7 Labelling of Dry Boxes attached?', type: 'yesno' },
  { key: 'rec748Attached', label: 'REC 7.4.8 Dry Labelling List attached?', type: 'yesno' },
  { key: 'rec749Attached', label: 'REC 7.4.9 Dry Stock Transfers attached?', type: 'yesno' },
  { key: 'signedPackingListsAttached', label: 'Signed packing lists attached?', type: 'yesno' },
  { key: 'healthCertificatesAttached', label: 'Health certificates attached?', type: 'yesno' }
]}
```

New: a `type: 'linked-records'` field renders a small read-only panel per linked record, sourced
from `window.Traceability.trace(exportBatch)` (already returns `record_key`, `record_title`,
`occurred_on`, `stage`, `summary`, `href`, `submission_id` per touchpoint — see
`traceability.js`'s `trace()`/`traceLocal()`/`traceRemote()`), filtered to one `recordKey`:

```js
{ title: 'Attachments checklist', fields: [
  { key: 'rec747Linked', label: 'REC 7.4.7 Labelling of Dry Boxes', type: 'linked-records', source: 'labelling-of-dry-boxes' },
  { key: 'rec748Linked', label: 'REC 7.4.8 Dry Labelling List', type: 'linked-records', source: 'dry-labelling-list' },
  { key: 'rec749Linked', label: 'REC 7.4.9 Dry Stock Transfers', type: 'linked-records', source: 'dry-stock-transfers' },
  { key: 'signedPackingListsAttached', label: 'Signed packing lists attached?', type: 'yesno' },   // no source record — stays yesno
  { key: 'healthCertificatesAttached', label: 'Health certificates attached?', type: 'yesno' }      // no source record — stays yesno
]}
```

("Signed packing lists" and "Health certificates" have no corresponding structured record in the
system — they stay manual Y/N unless/until they get their own record too.)

#### `form-record.js` changes

1. **Render** (the field-type switch around line 285-318, alongside the existing `'yesno'` and
   `'recordpick'` cases): add a case for `'linked-records'` that renders a placeholder container,
   e.g. `<div class="fr-linked" data-linked-for="${id}" data-source="${esc(field.source)}">Loading…</div>`.

2. **Fetch + render on export-batch change** (new function alongside `wireAutofill`/
   `wireRecordPick`, e.g. `wireLinkedRecords`): watch the `exportBatch` input; on `input`/`change`,
   call `window.Traceability.trace(batchValue)` (already implemented — merges remote `/api/trace`
   with any not-yet-synced local writes, per `traceability.js`'s `trace()`), filter the returned
   rows to `r.record_key === field.source`, and render:
   - No matching rows → `No submitted ${docCode} entry found for export batch ${batch} yet.`
   - One or more rows → render each as a compact card using the row's own `record_title`,
     `occurred_on`, `stage`, `summary` (this is why `traceSummary` matters on each of the three
     source records — without it, `summary` is null and the card has nothing but a date), and a
     link `<a href="${row.href}">Open record →</a>` (already a real link to the exact submission,
     via `hrefForThisPage`'s `#<id>` anchor).
   - Trace lookup failure → show an explicit error state, never silently render "no entries" — a
     false negative here is worse than an ugly error, since this replaces a compliance checklist.

3. Bump `form-record.js?v=27` → `?v=28` (and `monitoring-log.js?v=25` → `?v=26` for the
   `traceSummary` additions) on every page that loads them.

#### Reuse `batch-trace.html`, don't duplicate its UI

`public/records/batch-trace.html` already renders exactly this kind of touchpoint card (title,
date, stage, summary, open link) in its `render()` function. Consider factoring that card-rendering
logic out into a small shared helper (e.g. `public/lib/trace-card.js`) that both `batch-trace.html`
and the new `linked-records` field type call, rather than writing the card markup twice. Not
required for a first cut, but avoids drift between the two (e.g. if `traceSummary` output ever
needs escaping fixed in one place).

Also: the front page could simply link out to
`batch-trace.html?batch=<exportBatch>` as a "View full batch trace →" line under the three panels,
giving users the existing genealogy/timeline view for free without rebuilding it inline.

### 4. Test plan before calling this done

1. Submit one real entry each on 7.4.7, 7.4.8, 7.4.9 with the same `exportBatch` value (e.g.
   `TESTBATCH01`) and confirm `batch-trace.html?batch=TESTBATCH01` already shows all three via the
   existing UI — this validates the `batchField` wiring alone, before touching the front page.
2. Submit a Dry Export Pack Front Page entry with `exportBatch = TESTBATCH01` and confirm it also
   appears on that same trace (validates the front page's own `batchField`).
3. Confirm the new inline `linked-records` panels on the front page show the same three entries,
   with real `traceSummary` content, not just a bare date.
4. Test the empty case (a batch code with no matching entries anywhere) — confirm the honest
   "not found yet" message.
5. Test a batch with **two** 7.4.9 entries (e.g. two separate stock transfers on the same export)
   to confirm multiple entries render.
6. If `extraBatchFields: ['agCode']` is added to 7.4.8: confirm `batch-trace.html?batch=<agCode>`
   still resolves the entry via genealogy (one-up/one-down), i.e. AG-code traceability isn't lost
   by the `batchField` switch.
7. Confirm existing `jobNumber` → `abalone-receiving` autofill (a different mechanism,
   `/api/lookup`, untouched by this change) still works.
8. Re-check `?v=` bumps landed everywhere the edited lib files are loaded (grep, per
   `BACKEND_INTEGRATION.md`'s documented gotcha) — a stale cached copy fails silently with no
   visible console error.

### Open items for whoever builds this

- **Resolve the `batchField` question above** for both the front page (does it need
  `extraBatchFields: ['jobNumber']`?) and REC 7.4.8 (does it need `extraBatchFields: ['agCode']`?)
  before writing the configs — this determines whether existing traceability by job number / AG
  code is preserved or dropped.
- **Draft-vs-submitted visibility in Traceability** (section 2) — decide whether
  `indexSubmission` needs a submitted-only guard added, independent of this feature but newly
  visible because of it.
- Write real `traceSummary` functions for 7.4.7/7.4.8/7.4.9 (drafted above as a starting point) —
  these are what make the pulled-in content actually useful rather than just a date and a link.

---

## Processing Department — Complete Field Inventory (Final Live Audit)

> **Source:** `claude/Processing-Department-Field-Inventory.md`

**Status:** All 120 REC records live-verified, field-by-field, via browser automation.
This closes the gap from the original Phase 1 audit (which only inspected 16 of 120 records in detail) and confirms every field flagged as missing ("Processing for," "Damages," "Production code," "Tanks cleaned," "Filters cleaned," and more).

*Note: the full 825-row field list and 120-record list were originally delivered as separate CSVs (Master_Field_Inventory_FULL.csv and Records_List.csv) in an earlier conversation. This document is the narrative summary from the project record; the underlying CSVs are not attached here.*

---

### SECTION 1 — REC Records Found

All 120 REC records on record-list.html were identified and opened live in the browser. Naming spans REC 01, REC 1, REC 6.1.2, and the REC 7.x / 7.1x / 8.x / 9.1 series through REC 9.1.

### Totals

| Metric | Count |
|---|---|
| REC records found on record-list.html | 120 |
| REC records inspected (live, field-by-field, "+New" clicked where applicable) | 120 |
| Unique field labels identified (exact-label match) | 825 |
| Fields shared across 2+ records | 133 |
| Possible duplicate fields flagged for review | 17 pairs/groups (see Section 4) |
| Fields needing clarification | 9 (see Section 6) |

Note on "825 unique fields": this counts exact label text. Many are legitimately record-specific (e.g., each ingredient in REC 7.3.2 Ingredient Weighing has its own weight + batch-code field; each size bracket in the grading logs is its own field). The 133 fields used on 2+ records are the true "common/shared" fields for database design purposes.

---

### SECTION 3 — Fields Used Across Multiple Records (top 20 by spread)

| Field | Records | Type |
|---|---|---|
| Date | 85 | date |
| Verified by | 60 | text |
| Signature | 56 | text |
| Title | 53 | text |
| From | 52 | date |
| To | 52 | date |
| Comments | 18 | text/textarea |
| Deviations only | 17 | checkbox |
| Checked by | 15 | text |
| Shift | 14 | dropdown |
| Supervisor | 12 | text |
| Job no. / Job number | 9 each | text |
| Intake date | 8 | date |
| Size range | 7 | dropdown |
| Area | 6 | dropdown |
| Supplier | 6 | text |
| AG code | 6 | text |
| Corrective actions | 5 | textarea |
| Staff member | 5 | text |
| Day | 5 | dropdown |

---

### SECTION 4 — Possible Duplicate Fields (flagged for review, NOT merged)

1. "Checked by" vs "Checked by (QC)" vs "Checked by QC" — three label variants, may be same role captured inconsistently.
2. "Verified by" vs "QC verification" vs "QA verification" — different verification-role labels.
3. "Inspected by" vs "Inspected by — QC".
4. "Issued to" vs "Issued by" vs "Issued" — likely genuinely different fields.
5. "Received by" vs "Received from" — likely different.
6. "Date of issue" vs "Issue date" — same concept, different phrasing.
7. "Comment/Corrective action" vs "Corrective action/Comment" vs "Comment / corrective action" — formatting variants of the same field.
8. "Whole weight" vs "Whole weight (kg)" — same field, unit sometimes in label.
9. "Product description" vs "Product description (D/W)" — needs confirmation whether D/W = Dried/Wet variant.
10. "No. of pallets/boxes" vs "No of pallets/boxes" — punctuation-only variant.
11. "No. of mortalities" vs "No of mortalities" — punctuation-only variant.
12. "Start shift — temp" vs "Start shift - temp" — dash-character variant across similar records.
13. "During production — temp" vs "During production - temp" — same as above.
14. "Salt (kg)" vs "Salt (%)" vs "Salt (g)" vs "Salt" — likely genuinely different measurements, confirm per-record.
15. "Sugar (kg)" vs "Sugar (g)" vs "Sugar (%)" — same caution as Salt.
16. "Batch number of salt" vs "Salt batch number" — same field, phrasing differs.
17. "Processing for" vs "QC — Processing" — surface text-similarity only; very likely UNRELATED fields, recommend disregarding.

---

### SECTION 5 — Calculated / Automatic Fields

Only one field is explicitly system-calculated: "Total days in chiller" (REC 7.8.1 Chiller Batch Control), confirmed via JavaScript.

Candidates for calculated/derived values, currently implemented as plain number-entry (human-typed) fields:
- Dry yield, Yield (%), Estimate yield (REC 7.4.10, 7.4.3.1, 7.4.1)
- Total cooking time, Total tumbling time (REC 7.2.8-family, salting records)
- Total dried weight, Total mortality weight, Total drying time (days)

---

### SECTION 6 — Fields Needing Clarification

1. **Work instructions** — present on records but hidden by default in the UI; only rendered/visible after clicking a "Show" button on the record. Confirmed present in the DOM/system but not visible on initial page load. Flag for database design: this is a data-capture field (instructional text tied to the record), not a UI-only artifact like the row-selection checkboxes — recommend capturing its content explicitly during any future extraction pass, since a plain page read without triggering "Show" will miss it. **CLOSED:** content now captured for all 52 records that carry it (68 records have no such block) — see [Work-Instructions-Content-Extract.md](Work-Instructions-Content-Extract.md). Pulled directly from each record's `config.instructions` array rather than the browser, so it is exact and complete.
2. "Product description (D/W)" (REC 7.3.6) — unclear abbreviation.
2. Row-selection checkboxes ("Select all," dynamically-labeled per-row entry checkboxes) — UI/system artifacts, not data-capture fields; recommend excluding from DB design.
3. REC 7.6.6 Pest Inspection Record — roster "Other" pest field was truncated during extraction; 1-2 columns possibly uncaptured.
4. REC 7.6.7 Staff Hygiene Inspection — final roster field ("QC signature") truncated in one pass; confirmed present via weekend variant 7.6.7a but not re-confirmed on main 7.6.7.
5. A handful of very long checklist records from the first audit pass (REC 7.2.4, 7.8.3, 7.8.4, 8.1.4, 8.2.1, 8.2.2, 9.1, and a few others) had partial truncation noted inline in the raw working file; a targeted re-check would close this out fully.
6. "Sex" field (REC 1 Gonad Inspection) — dropdown option list not captured.
7. Dropdown option lists in general were not exhaustively enumerated (Farm names, Area 1-10 names, Processing step values, etc.) — would need a targeted follow-up pass for exact ENUM/lookup-table values.
8. REC 7.8.1 exists as two separate records under the same number (wet Chiller Batch Control and Dry Chiller Batch Control) — confirm this dual-numbering is intentional.
9. REC 8.1.6 family — REC 8.1.6 (no letter), 8.1.6a, 8.1.6b are three near-identical separate records (canned abalone / braised / minced) — confirm whether these should be one parameterized record type in the database.

---

No database design, SQL, or schema work has been done — per project instructions, this stage is strictly "map everything the existing system currently captures."

---

## Note: "Production code" vs "AG code" — are they the same identifier?

> **Source:** `claude/PRODUCTION_CODE_VS_AG_CODE.md`

**Status:** Open question, with strong evidence they are DIFFERENT. Nothing merged, no
validation applied outside REC 7.1.
**Raised by:** the REC 7.1 field-change work, which added an `^AG[0-9]{6}$` format rule to
`productionCode` on that one record. Before that rule spreads anywhere else, this needs an answer.
**Method:** static read of every `entryFields` / `sections` config in
`PROCESSING_DEPARTMENT/public/records/*.html`. Exact-label counts here match the live audit in
`Processing-Department-Field-Inventory.md` (that doc counts "AG code" on 6 records; so does this),
which is a decent cross-check that nothing was missed.

---

### The evidence that they are NOT the same field

Three records carry **both fields, side by side, in the same section**:

| Record | File |
|---|---|
| Production Information NRCS (Canning) | `Production-Information-NRCS-(Canning)-production-information-nrcs.html` |
| Production Information NRCS (Rework) | `Production-Information-NRCS-(Rework)-production-information-nrcs-rework.html` |
| Production Information NRCS (Dry) | `Production-Information-NRCS-(Dry)-dry-nrcs-packs.html` (AG code only — see below) |

In the Canning and Rework records the "Batch details" section reads:

```js
{ key: 'productionCode', label: 'Production code', type: 'text' },
{ key: 'nrcsAgCode',     label: 'NRCS AG code',    type: 'text' },
```

Two adjacent fields, two different keys, on the same form. An operator filling that record is
being asked for two values. That is hard to explain if they are one identifier under two labels.

**Working conclusion:** they are distinct. The AG code looks like an NRCS-facing
(regulatory / export inspection) identifier; the production code looks like an internal
batch/run identifier. **This needs confirming with QC before it is treated as settled** —
it is inference from form layout, not from anyone who uses the records.

---

### Where each field appears

#### "Production code" — exact label, 7 records

| Record | Key | Required |
|---|---|---|
| REC 7.1 Incubator Cans Log | `productionCode` | yes — **and now format-validated** |
| REC 7.2.7 Cans Produced | `productionCode` | no |
| REC 7.2.8 Retorting Control Sheet | `productionCode` | no |
| REC 7.2.11 QC Report | `productionCode` | no |
| REC 8.1.3 Disposition Investigation Record | `productionCode` | no |
| Production Information NRCS (Canning) | `productionCode` | no |
| Production Information NRCS (Rework) | `productionCode` | no |

Plus one compound variant:
- REC 8.1.4 Withdrawal / Mock Recall — `productionCodePackingDate`, label
  "Production code / packing date". Two data items in one text box; worth splitting if this
  identifier ever becomes a lookup key.

#### "AG code" — exact label, 6 records

REC 01 Cans Released (`agCode`), REC 7.2.16 Stock Transfers (`agCode`), and the four
traceability mock-recall records — REC 8.1.6 (canned), 8.1.6a (braised), 8.1.6b (minced),
8.1.7 (dried), all `agCode`.

#### AG code — label variants, 8 more records

| Record | Key | Label |
|---|---|---|
| Production Information NRCS (Canning) | `nrcsAgCode` | NRCS AG code |
| Production Information NRCS (Dry) | `nrcsAgCode` | NRCS AG code |
| Production Information NRCS (Rework) | `nrcsAgCode` | NRCS AG code |
| REC 7.4.8 Dry Labelling List | `agCode` | NRCS AG code |
| REC 7.2.10 Stock Loading | `agCode` | AG |
| REC 7.2.6 Can Filling & Printing | `printedAgCode` | Printed AG code |
| REC 7.4.7 Labelling of Dry Boxes | `agCodeMatchesInspection` | NRCS AG code matches inspection report? (yes/no — a check, not a capture) |
| REC 7.2 Sampling Log | `productInfo` | Product information (AG code, DW / dry job no. / live tag / ranched incoming date) — free-text catch-all holding an AG code among other things |

Note the key drift inside the AG family alone: `agCode`, `nrcsAgCode`, `printedAgCode`, and one
buried inside `productInfo`. "AG" vs "AG code" vs "NRCS AG code" may be three labels for one
value, or `printedAgCode` may genuinely be *what was printed on the can* as distinct from what
should have been — that distinction matters for REC 7.2.6, which is a verification step.

---

### What this blocks

1. **The `^AG[0-9]{6}$` rule currently exists on exactly one field on one record** (REC 7.1
   `productionCode`). Every other Production code and every AG code field still accepts any text.
   If the format belongs to AG codes rather than production codes, the rule is on the wrong
   field and REC 7.1 is now rejecting valid production codes.
2. **No AG code field is validated anywhere**, including REC 01 Cans Released, which is the
   release gate, and the four mock-recall records, where a mistyped code is exactly the failure
   a mock recall is supposed to catch.
3. Neither identifier is a lookup key anywhere yet — unlike Job no., which is a pick-list from
   open jobs. Both are currently free text on every record.

### Update — partial answer from Michaela (2026-08-31)

While specifying the REC 7.1 staged rework, Michaela referred to that record's **Production code**
field as "the ag code" ("then the ag code, pieces, qty and description must be visible").

So on REC 7.1 at least, Production code *is* the AG code — which supports leaving the
`^AG[0-9]{6}$` rule where it is on that record. It does **not** resolve the wider question: the
NRCS records still carry `productionCode` and `nrcsAgCode` as two separate adjacent fields, so
one of the following must be true and it is not yet known which:

- The two are genuinely different on NRCS records, and REC 7.1's "Production code" is mislabelled
  (it should read "AG code" to match the 6 records that already use that label); or
- They are the same identifier throughout, and the NRCS records are capturing it twice.

Either way one set of labels is wrong. Still needs QC to settle it.

### Questions for QC

1. Are "Production code" and "AG code" two different identifiers? (Form layout says yes.)
2. Which one, if either, has the format `AG` + 6 digits? Is the "AG" prefix literal, or does it
   stand for something that varies?
3. Is "Printed AG code" (REC 7.2.6) the same value as "AG code", or deliberately the
   as-printed value being checked against an expected one?
4. Should "AG" (REC 7.2.10) and "NRCS AG code" be relabelled to match the majority "AG code"?

**Nothing above has been changed.** No labels merged, no keys renamed, no validation added
beyond the single REC 7.1 field.

---

## Note: "Checked by" vs "Checked by (QC)" — label and key variants

> **Source:** `claude/CHECKED_BY_FIELD_VARIANTS.md`

**Status:** Mostly resolved by evidence. Two small inconsistencies worth fixing; one real
question left for QC. Nothing changed.
**Raised by:** Section 4 item 1 of `Processing-Department-Field-Inventory.md`, which flagged
"Checked by" / "Checked by (QC)" / "Checked by QC" as possibly the same role captured
inconsistently.
**Method:** static read of every field config in `PROCESSING_DEPARTMENT/public/records/*.html`.

---

### The short answer

They are **two different fields, and the code already treats them that way.** The storage keys
split cleanly along the same line as the labels:

- `checkedBy` — a general "who checked this" signature, on operational/monitoring logs.
- `checkedByQC` — a QC-role sign-off, on release, inspection and NRCS records.

**No record carries both.** (Verified: no file in `public/records/` contains both
`key: 'checkedBy'` and `checkedByQC`.) So there is no case of one form asking for the same
thing twice — the two keys are used by disjoint sets of records. That is the strongest argument
that the split is intentional rather than accidental drift.

---

### `checkedByQC` — 9 records

| Record | Label | Required |
|---|---|---|
| REC 01 Cans Released | Checked by (QC) | yes |
| QA 01 Damaged Cans & Lids | Checked by (QC) | no |
| Production Information NRCS (Canning) | Checked by (QC) | yes |
| Production Information NRCS (Dry) | Checked by (QC) | yes |
| Production Information NRCS (Rework) | Checked by (QC) | yes |
| Dry Export Pack Front Page | Checked by (QC) | no |
| REC 7.5.1 Live Production Pack | Checked by (QC) | no |
| REC 7.5.4 Individual Abalone Weight Checks | Checked by (QC) | yes |
| REC 7.2.13 Rework Log | **Checked by QC** (no brackets) | no |

These are release gates, NRCS submissions and QC inspections — a QC-specific sign-off makes
sense on all of them.

### `checkedBy` — 20 records

REC 7.1 Incubator Cans Log, 7.2.10 Stock Loading, 7.6.2 Weekly Cleaning, 7.6.2.2 Dispatch
Cleaning Inspection, 7.7.1 Daily Equipment Checklist, 7.7.4 Utensil Issue, 7.8.8 Dispatch
Loading, 7.8.8.1 Dispatch Receiving, 7.8.9 Water Monitoring, 7.8.9.1 LHA Water Monitoring,
7.8.12 Factory Maintenance, 7.8.12.1 Equipment Checklist (Roof), 7.9.1 Chiller Temperature,
7.9.2 Incubator Temperature, 7.9.3.1 Dry Room Temp/Humidity, 7.9.3.2 Grading Room
Temp/Humidity, 7.10.2 pH Verification (twice — once per section), 7.10.3 Thermometer
Verification, 7.10.4 Thermometer Correction Factors.

Cleaning, equipment, temperature and calibration logs — routine monitoring, checked by whoever
is on shift. Almost all are `required: true`.

---

### Three inconsistencies found

#### 1. REC 7.2.13 Rework Log — label typo (cosmetic, safe to fix)

```js
{ key: 'checkedByQC', label: 'Checked by QC', type: 'text' }
```

Correct key, correct group — the label is just missing its brackets. The other 8 QC records
all read "Checked by (QC)". This is the third variant the inventory flagged, and it is nothing
more than a typo. **Recommend: relabel to "Checked by (QC)".** No key change, no data impact.

#### 2. Two records use a QC label on the non-QC key (needs a decision)

| Record | Key | Label |
|---|---|---|
| REC 1 Gonad Inspection Report | `checkedBy` | QC online — checked by |
| REC 7.2.2 Scrubbing Checklist (QC) | `checkedBy` | QC online — checked by |

Both are explicitly QC activities — 7.2.2 has "QC" in its own record title — but they store
into `checkedBy`, not `checkedByQC`. So the clean key/label split described above has exactly
two exceptions, and they are the two "QC online" records.

This is the one item that is **not** safe to fix unilaterally. Renaming the key to
`checkedByQC` would align them with the other QC records, but any already-saved entries on
these two records store their value under `checkedBy` — changing the key orphans that data
unless it is migrated. Needs a decision before touching, same as the REC 7.1 datetime
migration question.

Also possible that "QC online" is deliberately a *third* role — QC stationed on the line,
distinct from QC signing off a finished batch — in which case the current key is wrong in a
different way and it should be its own field. Worth asking.

#### 3. REC 7.8.4 Seamer Inspection — two stage-qualified variants (working as intended)

```js
{ key: 'checkedByBefore', label: 'Before production — checked by' },
{ key: 'checkedByEnd',    label: 'End of day — checked by', required: true },
```

Same person-check captured at two points in the day. These are genuinely two fields, correctly
keyed and clearly labelled. **No action.** Noting it only so it is not mistaken for drift in a
future audit.

---

### Recommended actions

| # | Action | Risk |
|---|---|---|
| 1 | REC 7.2.13: relabel "Checked by QC" → "Checked by (QC)" | None — label only |
| 2 | REC 1 and REC 7.2.2: decide whether "QC online — checked by" should key to `checkedByQC`, stay `checkedBy`, or become its own field | **Data migration** if the key changes |
| 3 | Leave REC 7.8.4 alone | — |

Ask QC: is "QC online" a distinct role from the QC who signs off a release record, or the
same person at a different moment?

**Nothing above has been changed.**

---

## Work Instructions — Full Content Extract

> **Source:** `claude/Work-Instructions-Content-Extract.md`

**Status:** Closes Section 6, item 1 of the [Processing Department Field Inventory](Processing-Department-Field-Inventory.md). The "Work Instructions" content that a plain page read misses (it renders in a panel that the audit noted as hidden-until-"Show") has now been captured for every record that carries it.

### Method

Extracted directly from source, not the browser. Every record page defines its Work Instructions as a `config.instructions` array of `{ label, text }` objects, rendered by `public/lib/form-record.js:543-547` into the `.fr-instructions` panel. Pulling from the config is exact and complete — no truncation, no need to trigger the "Show" toggle per record.

### Coverage

| | Count |
|---|---|
| Records carrying Work Instructions content | 52 |
| Records with no `instructions` block (nothing to capture) | 68 |
| Total REC records | 120 |

The 68 without an `instructions` block have no Work Instructions data — this is not truncation, the field is simply absent on those records.

### Content by record

#### Live intake / handling

- **REC 1 — Gonad Inspection Report**
  - *Stage 0:* Immature, sex indeterminate, digestive gland visible as grey/brown mass.
  - *Stage 1:* Sex determinable, gonad small, colouration, tip pointed.
  - *Stage 2:* Gonad large, tip rounded but not swollen.
  - *Stage 3:* Gonad very large, tip rounded and swollen, bulging at shell edge.
- **REC 7.1.0 — Daily Weight Sampling**
  - *Purpose:* Sample basket weights daily by size range and farm.
- **REC 7.1.00 — Fixed Reader Checks**
  - *Purpose:* Check that RFID tags match the QDE system reading at each fixed reader location.
- **REC 7.1.6 — Scrubbing Check (Supervisor)**
  - *Purpose:* Supervisor check that abalone is cleaned effectively during scrubbing, and any damage is recorded.
- **REC 7.2.2 — Scrubbing Checklist (QC)**
  - *Purpose:* QC check of scrubbing quality — crates inspected, damage, and whether abalone is scrubbed clean.
- **REC 7.2 — Sampling Log**
  - *Purpose:* Record any product samples taken (AG code / DW / dry job number / live tag / ranched incoming date) and why.
- **Live Leftovers Log**
  - *Note:* Tracks live product leftover weight by size class after packing — a standalone running log, separate from the per-pack leftovers fields on REC 7.5.2 Live Pack Checklist.
- **Mortality Counts by Customer**
  - *Note:* The paper version used one spreadsheet tab per date with a customer × size-band matrix that varies in width each time — this roster form captures the same data (customer, size band, mortality count) as flexible rows instead.
- **REC 7.5.3 — Live Packing Bag Quality Check**
  - *Purpose:* On the day of packing (or the shift before), all bags allocated for the live pack must be checked by a team of 2 from live sorting and 2 from processing.

#### Dry processing

- **REC 7.4.1 — Drying Process**
  - *Note:* The paper form has one Date/Time per steam cycle (up to 14). This digital version records the date of each steam turn — steam 1 through 14 — plus the milestone dates either side.
- **REC 7.4.5 — Boxing and Labelling**
  - *Note:* The bin code is used as the "box code" on the label.

#### Canning

- **REC 01 — Cans Released Form**
  - *Purpose:* Record cans released from hold, awaiting NRCS clearance.
- **REC 7.1 — Incubator Cans Log**
  - *Purpose:* Track cans sent for incubation/micro testing until they are cleared.
  - *How to fill this in:* The three sections are done at different times on the same job. Fill in section 1 when the cans go in and submit it — that section then locks. When you come back, pick the job no. under "Continue a job" to reopen it and fill in the next section. A section already submitted can still be corrected, but you must give a reason and your name.

#### Cleaning

- **REC 7.6.1 — Daily Cleaning Inspection**
  - *Cleaning instruction:* Perform cleaning per the master cleaning schedule. Food contact surfaces cleaned at start of shift, between jobs and at end of shift. Sanitise work surfaces at end of shift. Raise a corrective action immediately on visual inspection failure at end of shift. Open a CAR for areas non-conforming more than once a week. Tick C if cleaning is done, NC if not.
- **REC 7.6.1.1 — Deep Cleaning Record (Weekly)**
  - *Cleaning instruction:* Perform cleaning per the master cleaning schedule. Raise a corrective action immediately on visual inspection failure at end of shift. Open a CAR for areas non-conforming more than once a week. Tick C if cleaning is done, NC if not.
- **REC 7.6.8 — Allergen Cleaning Verification**
  - *Note:* Swabbing tests for the presence/absence of protein traces after cleaning, which indirectly indicates presence/absence of the allergens of concern for the products involved.
- **Master Cleaning Plan**
  - *Purpose:* The reference cleaning schedule that REC 7.6.1 (Daily Cleaning Inspection), REC 7.6.1.1 (Deep Cleaning Record Weekly) and REC 7.6.2 (Weekly Cleaning Record) point to. Update this when the cleaning method, frequency or responsible party for any part/area changes.
- **Master Cleaning Checklist**
  - *Note:* The paper form has separate Day/Night tick columns for every day of the week. This digital version records one row per equipment item per day — use the day field to log which day/shift a cleaning was done, and add a row per occurrence.

#### Pest control

- **REC 7.6.5 — Internal Pest Sightings Log**
  - *Instruction:* If any pest or presence of pest activity is noted or reported, the Internal Pest Controller completes this log and informs management.
- **REC 7.6.6 — Pest Inspection Record**
  - *Instruction:* Weekly inspections are done to determine the presence of pests and signs of activity. If any presence/activity is noted, complete the Pest Sightings Log and inform the pest control company. Bird droppings or pests present inside the facility must be recorded on a CAR.

#### Staff hygiene

- **REC 7.6.7 — Staff Hygiene Inspection**
  - *Work instruction:* Complete record at start-up of each working shift. Inspect per the Personnel Hygiene Procedure. Key: ✓ = Compliance, x = Non-compliance, A = Absent.
- **REC 7.6.7a — Staff Hygiene Inspection (Weekends)**
  - *Work instruction:* Complete record at start-up of each working shift. Inspect per the Personnel Hygiene Procedure. Non-compliance observed should be recorded and reported to supervisors.
- **REC 8.2.8.1 — RFH Medical Result**
  - *Screening covers:* Chronic medication acknowledgement, urine test, blood pressure & pulse, glucose blood test (if glucosuria/diabetic), Snellen eye test (both eyes), physical inspection of scalp/ears/nose/mouth/teeth/hands/nails.
- **RTW Medical Questionnaire**
  - *Note:* Ticking "yes" does not automatically make the employee unfit for duty — it provides baseline health statistics and supports health & safety legislation compliance. If any question is answered yes, refer the employee to a medical practitioner; if all no, the employee is fit to resume duties.

#### PPE / utensils / equipment

- **REC 7.7.1 — Daily Equipment Checklist**
  - *Inspection:* Inspect all equipment and devices daily. ✓ = Good condition/working, X = Faulty/damaged.
- **REC 7.7.2 — Glass & Plastic Equipment Inspection**
  - *Key:* Y = Inspected and in order. N = Inspected but not conforming.
  - *What to check:* Every morning before starting up, check light fittings, windows, temperature dial displays, extractor fan grids, wall clocks, computer screens and plastic crates. Check equipment/machinery (rollers, conveyers, racking, trolleys, tanks) is in good repair. Detail any non-conformance in Comments.
- **REC 7.7.4 — Utensil Issue Record**
  - *Work instruction:* Knives remove gut & beak; scrapers remove flesh from shell (shucking); scrubbing brushes scrub abalone; needles for stringing dry, scissors for destringing dry. Record quantity issued. Condition: ✓ = good condition, X = faulty/damaged. Faulty/damaged utensils returned to supervisor and discarded, with type & number recorded. Utensils go into Dynacide solution when not in use.
- **REC 7.7.4.1.a — Safety Glass Register**
  - *Key:* ✓ = Compliance, x = Non-compliance.
- **REC 7.7.4.1.b — Goggles Register**
  - *Key:* ✓ = Compliance, x = Non-compliance, N/A = Not issued.
- **REC 7.7.4.1.c — Knife Register**
  - *Key:* ✓ = Compliance, x = Non-compliance.
- **REC 7.8.12 — Factory Maintenance Inspection**
  - *Work instruction:* Conduct inspections at start of shift, checking that all listed areas are clean and in good, functioning condition, and that equipment/machinery is in a good state of repair and intact. Detail any non-conformance in the Comments column. Key: Y = Inspected and in order, N = Inspected but not conforming.
- **REC 7.8.12.1 — Equipment Checklist (Roof)**
  - *To-do — daily:* Drain the compressor tank. Empty the drip tray underneath the 250-pipe connection.
  - *To-do — weekly:* Drain and clean the filters.

#### Monitoring logs

- **REC 7.9.1 — Chiller Temperature Monitoring**
  - *Temperature parameters:* 0°C to +10°C. Defrost temperature not above +20°C.
  - *Frequency of monitoring:* Start of shift, lunch break and end of shift.
  - *If out of spec:* If the temperature varies by more than 0.5°C from the accepted parameters, corrective action must be recorded and the temperature checked again within 1 hour.
- **REC 7.9.2 — Incubator Temperature Check**
  - *Target range:* 36.1°C – 37.8°C, recorded at start of shift, lunch and end of shift.
- **REC 7.9.3.1 — Dry Room Temp/Humidity Log**
  - *Check:* Check temperature & relative humidity on the dial inside the dry room. Temperature should be 25–32°C; any deviation must be reported.
- **REC 7.9.3.2 — Grading Room Temp/Humidity Log**
  - *Check:* Check temperature & relative humidity on the dial inside the grading room. Temperature should be 25–32°C; any deviation must be reported.
- **REC 7.8.9 — Water Monitoring**
  - *Note:* Targets for fresh water pH and sea water pH/salt are not specified on the paper form — set them under Thresholds once confirmed. Readings are recorded either way.
- **REC 7.8.9.1 — LHA Water Monitoring**
  - *Scope:* Live Holding Area chiller unit — separate from the general Water Monitoring record (REC 7.8.9), which covers a different water source.
  - *Frequency:* Complete record twice per shift.
  - *Parameter:* Temperature 12-18°C.
- **REC 7.10.2 — pH Verification**
  - *Weekly:* Measure 20ml of buffer pH 4, insert probe, take reading. Repeat with buffer pH 7 and pH 10. Meter should read within 3.9–4.1 (buffer 4.01), 6.9–7.1 (buffer 7.01), 9.9–10.1 (buffer 10.01). If outside range, record the deviation and repeat the monthly calibration; if still out of spec, record it and report the issue.
  - *Monthly:* Measure 20ml of buffer pH 4, 7 and 10, click CAL on the pH meter and follow the instructions. Record that the calibration was done successfully.
- **REC 7.10.3 — Thermometer Verification**
  - *Verify thermometer accuracy:* Verification must be done using a standard reference thermometer and a test thermometer. Deviation should not be larger than 0.5°C — if it is, complete REC 7.10.4 to add a correction factor.
  - *Cold verification (0–5°C):* Crush ice, fill half a jar, top up with water and stir. Insert reference probe and test thermometer, wait to stabilise, then record.
  - *Hot verification (85–95°C):* Boil water, insert reference probe and test thermometer, wait to stabilise and record. If the reading exceeds the specified limits, a corrective action must be recorded.
  - *Frequency:* Weekly.
- **REC 7.10.4 — Thermometer Correction Factors**
  - *Verify thermometer accuracy:* Verification must be done using a standard reference thermometer or master thermometer calibrated by a SANAS accredited authority.
  - *How to establish correction factors:* Place the probes in one container filled with water and allow the thermometer to read for 2 minutes, then record the findings.
  - *Tolerance:* Readings should not exceed a difference of 0.5°C. If exceeded, report the thermometer and add the correction factor.
  - *Frequency:* Weekly.

#### Waste / incoming goods

- **REC 7.8.2 — Daily Waste Removal**
  - *Note:* Once the waste is offloaded, the person at the dumpsite or area of dumping must sign the form.
- **REC 7.8.7 — Incoming Goods Inspection**
  - *Sampling:* On receiving of lot/batches, refer to the sampling tables (PRO 8.2.18) to determine sampling size for inspection. If the product does not comply, do not accept the delivery.

#### Quality / HR / traceability

- **REC 8.1.4 — Withdrawal / Mock Recall Record**
  - *Note:* Mock recall to be completed within 72 hours due to time difference to country of export.
- **REC 8.1.6 — Traceability Mock Recall (Canned Abalone)**
  - *Note:* Static reference checklist — each row references another REC record by code/label rather than pulling live data from it (cross-record data linking is a future enhancement).
- **REC 8.1.6a — Traceability Mock Recall (Canned Braised Abalone)** — same *Note* as REC 8.1.6.
- **REC 8.1.6b — Traceability Mock Recall (Canned Minced Abalone)** — same *Note* as REC 8.1.6.
- **REC 8.1.7 — Traceability Mock Recall (Dried Abalone)** — same *Note* as REC 8.1.6.
- **REC 8.1.8 — Traceability Mock Recall (Live Abalone)** — same *Note* as REC 8.1.6.
- **REC 8.2.2 — Supplier Approval Record**
  - *Scoring:* The supplier is rated on the 6 criteria below. A score of 70% or more adds them to the Approved Supplier List. An ad-hoc supplier used before the selection process is complete needs Food Safety Team Leader approval.
- **REC 8.4.b — Handling of Emergencies and Incidences**
  - *Purpose:* Food safety factors to consider during an emergency drill — process for managing incidents that seriously compromise hygiene, food safety, quality, personnel or premises. Key factors: time and temperature.
- **REC 9.1 — Daily Factory Feedback Meeting**
  - *Note:* Attendance is a roster (name + present) rather than a fixed name list, so it stays accurate as staff changes.

---

### Note for database design

These `instructions` entries are **static instructional text tied to the record type**, not per-submission data capture. They belong in the record/template definition (one set per record type), not in the submissions table. They mix three kinds of content — legend/keys (✓/x meanings), procedural steps, and digital-vs-paper migration notes — but all are record-level metadata.

---

## Work Instructions Field — Visibility Note

> **Source:** `claude/Work-Instructions-Visibility.md`

**Status:** Requirement captured during the field inventory audit, then implemented (2026-08-31).

### Required Behaviour

On REC records the **Work Instructions** panel must be **hidden by default** on every viewport, revealed on demand via a **"Show"** button in the panel header (button then reads "Hide"). Do not show Work Instructions expanded by default.

### Implementation (2026-08-31)

Previously this was only true on narrow screens (≤768px) for `monitoring-log.js` records, and never for `form-record.js` records — on desktop the panel was always expanded.

Changed:

| File | Change | Cache bump |
|---|---|---|
| `public/lib/form-record.js` | Added `fr-instr-panel` wrapper, a `#fr_instrToggle` Show/Hide button, collapse CSS (all viewports), and the toggle click handler. | `?v=14` → `?v=15` (78 pages) |
| `public/lib/monitoring-log.js` | Moved the collapse rules out of the `@media (max-width:768px)` block so they apply on all viewports. Toggle button and JS were already present. | `?v=10` → `?v=11` (51 pages), `?v=18` → `?v=19` (1 page: REC 7.1) |

Verified live: on both a `form-record` page (REC 7.6.1) and a `monitoring-log` page (REC 7.9.1) the panel body is `display:none` on load, the button reads "Show", and clicking toggles body visibility and the button label.

### Relevance to Field Inventory

Because this panel is collapsed until triggered, any future data-extraction or audit pass must expand it (or read the source `config.instructions` array) — a plain page read will miss it.

**Content already extracted (2026-08-31):** pulled directly from each record's `config.instructions` array. 52 of 120 records carry a Work Instructions block; the other 68 have none. Full text in [Work-Instructions-Content-Extract.md](Work-Instructions-Content-Extract.md). Section 6 item 1 of the [Field Inventory](Processing-Department-Field-Inventory.md) is closed.

---
