# Export Batch Linking — Dry Export Pack Front Page

**Purpose:** Replace the Y/N "attached?" checklist on the Dry Export Pack Front Page with the
actual pulled-in content from REC 7.4.7 (Labelling of Dry Boxes), REC 7.4.8 (Dry Labelling List)
and REC 7.4.9 (Dry Stock Transfers) — all four linked by one shared `exportBatch` number, using
the app's **existing Batch Traceability engine**, not a new indexing mechanism.

Repo: `PROCESSING_DEPARTMENT` (Render services `facility-site` / `facility-api`, Neon Postgres via
Prisma). Confirmed against the live system on 2026-09-09: all four records (front page, 7.4.7,
7.4.8, 7.4.9) currently have **zero submitted entries**, so this migration carries no risk of
orphaning real data — re-check `View entries` on each before merging, in case that's changed.

## Revision note

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

## 1. Data model change — same as before

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

### ⚠️ Open decision: `batchField` is singular per record

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

### Front page (`FormRecord.init` config)

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

### REC 7.4.7 (`MonitoringLog.init` config)

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

### REC 7.4.8 (`FormRecord.init` config)

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

### REC 7.4.9 (`MonitoringLog.init` config)

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

## 2. Backend / Neon — no schema change needed, but be clear about where the weight actually sits

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

## 3. Front-page UI: replace the Y/N checklist with real pulled-in content

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

### `form-record.js` changes

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

### Reuse `batch-trace.html`, don't duplicate its UI

`public/records/batch-trace.html` already renders exactly this kind of touchpoint card (title,
date, stage, summary, open link) in its `render()` function. Consider factoring that card-rendering
logic out into a small shared helper (e.g. `public/lib/trace-card.js`) that both `batch-trace.html`
and the new `linked-records` field type call, rather than writing the card markup twice. Not
required for a first cut, but avoids drift between the two (e.g. if `traceSummary` output ever
needs escaping fixed in one place).

Also: the front page could simply link out to
`batch-trace.html?batch=<exportBatch>` as a "View full batch trace →" line under the three panels,
giving users the existing genealogy/timeline view for free without rebuilding it inline.

## 4. Test plan before calling this done

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

## Open items for whoever builds this

- **Resolve the `batchField` question above** for both the front page (does it need
  `extraBatchFields: ['jobNumber']`?) and REC 7.4.8 (does it need `extraBatchFields: ['agCode']`?)
  before writing the configs — this determines whether existing traceability by job number / AG
  code is preserved or dropped.
- **Draft-vs-submitted visibility in Traceability** (section 2) — decide whether
  `indexSubmission` needs a submitted-only guard added, independent of this feature but newly
  visible because of it.
- Write real `traceSummary` functions for 7.4.7/7.4.8/7.4.9 (drafted above as a starting point) —
  these are what make the pulled-in content actually useful rather than just a date and a link.
