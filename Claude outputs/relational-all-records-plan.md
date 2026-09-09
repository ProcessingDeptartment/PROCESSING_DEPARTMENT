# Relational Neon for all records — DB is the source of truth, frontend layout unchanged

**Date:** 2026-09-09 (rewritten — supersedes the earlier "storage layer only" version)
**Status:** Schema design for review. Greenfield — no DB in use yet.
**Related:** `INTEGRATION/07-RELATIONAL-VS-FRAPPE.md`, `relational-export-batch-slice.md`,
skill `fsms-erp-bridge`

---

## What Michaela decided (2026-09-09)

- The `.js` files must **not** be the heavy lifters. Field lists, required-ness,
  validation, derived values, links, autofill — all of it lives in the **database as
  data**, not in 130 hand-written `.init({...})` config objects.
- The **frontend layout is fine** — don't disturb how forms look or behave for the operator.
- **No DB in use yet** — this is greenfield. Set it up correctly now.
- Offline local-save-then-sync stays a hard requirement (rules out Frappe — ADR 07).

### What that means, precisely

`form-record.js` / `monitoring-log.js` keep rendering forms exactly as they look today,
but they stop *owning* what a record is. They **fetch the record's definition from the
API** (and cache it for offline), then render from that. The definition — every field,
type, rule, section, roster column, autofill, link — is rows in Postgres.

This is a Frappe-shaped design (DocType metadata + per-doc tables). You are building a
minimal version of it because Frappe itself is out (offline; not rewriting the repo).

### Honest limit

Zero record-specific JS is not reachable while offline and while hardware integrations
exist (REC 7.1.2 barcode + scale; REC 7.2.4 / 7.2.12 derived-value hooks). Those keep a
small amount of JS logic — but as **named hooks in a registry, referenced by the
definition**, not authored inline per page. The definition says "record uses hook X";
the DB still owns the field list and rules around it.

---

## Three layers

### Layer 1 — Definition (DB is source of truth)

Seeded **once** by parsing the 130 existing `.init({...})` configs, then those configs
are deleted from the HTML. After that, definitions are edited as data.

```prisma
model RecordDefinition {
  recordKey        String   @id                 // 'dry-monitoring'
  engine           String                       // 'form-record' | 'monitoring-log'
  docCode          String?                      // 'REC 7.4.2'
  title            String
  docRevisionStart Int      @default(1)
  jobInfoGroup     String?                      // grouping label for the job-info block
  clientHook       String?                      // named JS hook for bespoke pages, else null
  status           String   @default("active")
  version          Int      @default(1)         // bump on any edit → engines cache-bust
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  sections  RecordSectionDef[]
  fields    RecordFieldDef[]
  autofills RecordAutofillDef[]
}

model RecordSectionDef {
  id         String  @id @default(cuid())
  recordKey  String
  definition RecordDefinition @relation(fields: [recordKey], references: [recordKey], onDelete: Cascade)
  title      String
  kind       String  @default("fields")         // 'fields' | 'roster'
  position   Int

  @@index([recordKey])
}

model RecordFieldDef {
  id            String  @id @default(cuid())
  recordKey     String
  definition    RecordDefinition @relation(fields: [recordKey], references: [recordKey], onDelete: Cascade)
  sectionId     String?                          // null = top-level (monitoring-log entryFields)
  parentFieldId String?                          // set = this is a roster column
  key           String
  label         String
  type          String                           // text|textarea|number|date|time|yesno|select|
                                                  // jobsearch|jobnumber|computed|derived|batchseq|recordpick|roster
  required      Boolean @default(false)
  readOnly      Boolean @default(false)
  unit          String?
  options       String[]                         // select / enum values
  group         String?                          // job-info sub-grouping
  position      Int
  computeExpr   String?                          // computed/derived: e.g. 'sum(roster.wholeWeight)'
  recordPickSource String?                       // recordpick: source recordKey
  linkField     String?                          // marks this field a join key: 'jobNo'|'rmLot'|
                                                  //   'exportBatch'|'agCode'|'person'|...  (extensible)
  linkRelation  String?                          // 'self' | 'input' | 'output'  (default 'self')
  validateJson  Json?                            // { min, max, regex, ... }

  @@unique([recordKey, key, parentFieldId], name: "field_key")
  @@index([recordKey])
  @@index([key])                                 // "which records have field X"
}

model RecordAutofillDef {
  id              String @id @default(cuid())
  recordKey       String
  definition      RecordDefinition @relation(fields: [recordKey], references: [recordKey], onDelete: Cascade)
  watchKey        String                         // 'jobNumber'
  sourceRecordKey String                         // 'abalone-receiving'
  matchField      String                         // 'jobNo'
  fillMap         Json                           // { intakeDate: 'receivingDate', ... }

  @@index([recordKey])
}
```

`GET /api/record-def/:recordKey` returns the whole thing assembled. The engines fetch it,
cache it in IndexedDB keyed by `recordKey`+`version`, and render. Offline = use the cache.

### Layer 2 — Submissions (per-record physical tables, generated from Layer 1)

One table per record, real typed columns, generated by `scripts/gen-submission-schema.mjs`
**from the definition tables** (not from HTML). Roster → child table. Same shape as
`relational-export-batch-slice.md`:

- `id String @id` (the submission's own id)
- one column per `RecordFieldDef` (type-mapped: `date→DateTime?`, `number/derived→Decimal?`,
  `yesno→Boolean?`, else `String?`; `select` with a fixed list → Postgres enum)
- `status`, `submittedAt`, `raw Json` (transition mirror), `createdAt`, `updatedAt`
- `@@index` on `status`, on `jobNo`, and on every field with a `linkRelation`
- child table per roster field, with `position Int` and `onDelete: Cascade`

A definition edit that adds/removes/retypes a field regenerates that one table and
produces a Prisma migration — a documented step, run deliberately (this is exactly what
Frappe does under the hood when you edit a DocField).

### Layer 3 — RecordLink (generic, unchanged from slice #1)

One edge table. `linkField` is **open-ended** — job number is only the ERP reconciliation
key, not the only join. Confirmed with Michaela (2026-09-09): joins will also be on
**raw-material / ingredient batch (lot) codes, dates, person names (operator / inspector),
export batch, AG code**, and more not yet named. Any `RecordFieldDef` can carry:

```
linkField     String?   // names the kind of shared value: 'jobNo' | 'exportBatch' |
                        //   'rmLot' | 'agCode' | 'person' | 'poNumber' | ...  (free, extensible)
linkRelation  String?   // 'self' | 'input' | 'output'   (genealogy direction; default 'self')
```

On every submission the API writes one `RecordLink` row per linkable field value
(normalised `trim().toUpperCase()`). `GET /api/links/:value` then answers "everything
touching this lot / this person / this batch / this job" across every record, with zero
per-key code. This *is* the "any section can query the DB for what it needs" mechanism
from the original design note — backed by a real indexed table instead of scanned
`batch_link:*` keys.

**Dates** stay in the existing `SubmissionDateField` index (already typed and classified
header-date vs line-item) rather than being stringified into `RecordLink` — a date range
query wants a real `DateTime` column. `RecordLink` + `SubmissionDateField` together cover
"date or batch code or person".

`GET /api/export-batches/:x/linked` is just the shaped, submitted-only view for the
front-page feature — one consumer of the generic mechanism.

---

## Server owns validation

`PUT /api/storage/key/:key` stops trusting the client blob. For every
`formrecord:*` / `monitoring_log:*` write:

1. load the `RecordDefinition`
2. validate the payload against it — required present, types coercible, options in range,
   `validateJson` rules — **reject on failure** (today it only checks `typeof value === 'string'`)
3. compute `computed` / `derived` values server-side from `computeExpr` (client value is
   advisory only)
4. `upsert` the Layer-2 row + roster rows
5. upsert/prune Layer-3 `RecordLink` edges
6. still write the `KeyValue` blob (rollback + mirror during transition)

The engines keep a client-side copy of the same validation for UX, driven by the same
definition — but it is no longer the authority.

---

## Engine changes (form-record.js / monitoring-log.js)

Rendering and layout code is **not** rewritten — it already renders from a config object
(`allFields(config)`, the `field.type` switch at `form-record.js:265–315`, roster handling,
job-info block, signoff block). The change is *where that object comes from*:

| Today | After |
|---|---|
| `FormRecord.init({ recordKey, sections:[…], … })` inline in each HTML file | `FormRecord.init({ recordKey })` only — engine does `GET /api/record-def/<key>` |
| config object literal | same object shape, assembled from `RecordDefinition` + children |
| no offline definition concern (it's in the JS) | definition cached in IndexedDB by `recordKey`+`version` |
| `computed`/`derived` done client-side | done server-side; client mirrors for live display |
| bespoke `<script>` per page (7.1.2 etc.) | `clientHook` name in the definition → hook from a small registry |

130 record HTML files each lose their `.init({...})` body and keep everything else
(mount div, lib includes, layout). Net: less code in the repo, not more.

---

## Getting the 130 definitions in

`scripts/extract-definitions.mjs` — one-time:

1. parse every `public/records/*.html` `.init({...})` (78 FormRecord + 53 MonitoringLog —
   they are clean static object literals, verified)
2. write `RecordDefinition` + `RecordSectionDef` + `RecordFieldDef` + `RecordAutofillDef` rows
3. emit a diff report: anything not cleanly mappable (bespoke hooks, unusual field types) —
   that list is the manual-review backlog
4. after review + sign-off, a second script strips the `.init({...})` bodies from the HTML

Then `gen-submission-schema.mjs` builds Layer 2 from the now-authoritative Layer 1.

---

## ERPNext alignment (per `fsms-erp-bridge`)

- **Job number is the ERP reconciliation key** — Syspro Job == ERPNext Work Order ==
  FSMS `jobNumber`. Every record with a job field gets a `jobNo` column + index. This is
  the key cutover and nightly-sync recon use — but it is *not* the only join key inside
  the FSMS (see Layer 3: raw-material lots, dates, people, export batch, AG code…).
- **Lots ≠ job numbers** — an ingredient/RM lot relates to a job through material issues,
  not by name. Keep RM-batch fields distinct from the job number; both can be `linkField`s.
- **Never** store or join on ERPNext internal row ids — the replica is wiped and rebuilt.
- Record ≈ DocType, roster ≈ child table — the shape a future ERP load expects.
- No ERP calls from a page — this only shapes FSMS's own Postgres.

---

## Sequencing (implementation is staged even though the target is the whole thing)

1. **Slice #1 — the 4 export-batch records.** Build all three layers + server validation +
   the engine's fetch-definition/cache path end to end on these four. Proves the design.
2. **Definition extraction** for the rest; manual-review backlog worked down.
3. **Area batches** — receiving (7.1.x), canning (7.2.x), drying (7.4.x), … — flip each
   batch's engine to fetch-from-DB, generate its Layer-2 tables, strip its inline configs.
4. `KeyValue` retained as rollback until ERP cutover (2027-07-01).

## Open items

- ~~Run `extract-definitions.mjs` report-only → count the records that don't map~~
  **Done 2026-09-09** — see `definition-extraction-report.md`. Result: **124 / 131 clean,
  7 flagged, 0 unparseable.** All 7 flags are the same root cause (computed/derived field
  backed by a JS function); 3 of those also keep a `clientHook` (7.1.2, 7.2.4, 7.2.12).
- **`computeExpr` mechanism — the one real design choice.** ~15 formulas across 7 records.
  Recommend a named-function registry (`public/lib/compute/<name>.js`, referenced by
  `RecordFieldDef.computeExpr`) first; a small DSL later only if the list grows.
- `linkField` catalogue — enumerate the join-key kinds with Michaela (`jobNo`, `rmLot`,
  `exportBatch`, `agCode`, `person`, …) so normalisation rules per kind are defined once.
- `select` fields that should be shared Postgres enums (grades, size ranges, "processing for").
- How definitions get **edited** after seeding — admin UI vs migration-style PRs. Later.
- `fsms-erp-bridge` Q2 (which ERPNext doc an approved record becomes) — decides final
  table-name alignment; doesn't block.
