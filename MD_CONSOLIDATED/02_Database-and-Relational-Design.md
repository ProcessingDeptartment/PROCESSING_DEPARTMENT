# Database and Relational Design (Neon / Postgres)

Relational architecture, schema plans, table typing, live audits and seeding. Database is the vital piece.

_Consolidated from 7 original files. Cross-references inside the text to old file names refer to the original files; see `00_INDEX.md` for where each one now lives._

## Contents

1. [Moving PROCESSING_DEPARTMENT off the generic KeyValue store onto relational Postgres](#moving-processingdepartment-off-the-generic-keyvalue-store-onto-relational-postgres) — `Claude outputs/relational-architecture.md`
2. [Relational Neon for all records — DB is the source of truth, frontend layout unchanged](#relational-neon-for-all-records--db-is-the-source-of-truth-frontend-layout-unchanged) — `Claude outputs/relational-all-records-plan.md`
3. [Relational slice #1 — RecordLink + the four export-batch records](#relational-slice-1--recordlink--the-four-export-batch-records) — `Claude outputs/relational-export-batch-slice.md`
4. [Type the submission tables — build spec for Claude Code](#type-the-submission-tables--build-spec-for-claude-code) — `claude/submission-table-typing-spec.md`
5. [Neon Database — Live Audit (2026-09-14): Operations Comparison vs Syspro, Corrected](#neon-database--live-audit-2026-09-14-operations-comparison-vs-syspro-corrected) — `claude/neon-db-live-audit.md`
6. [Definition-extraction report](#definition-extraction-report) — `Claude outputs/definition-extraction-report.md`
7. [Grading log layout: seeded to Neon (2026-09-29)](#grading-log-layout-seeded-to-neon-2026-09-29) — `Claude outputs/grading-layout-seed-2026-09-29.md`

---

## Moving PROCESSING_DEPARTMENT off the generic KeyValue store onto relational Postgres

> **Source:** `Claude outputs/relational-architecture.md`

**Status: proposal / design for review — not started, not approved for build.**

### The idea in one sentence (confirmed with the requester, 2026-09-09)

**Any section of any record should be able to run a query against the database and pull back
whatever info it needs — not a fixed foreign key, not a bespoke join built per feature, just a
live query, available everywhere.** Everything below — `RecordLink`, `SectionTemplate`,
`ProjectedField`, the per-record tables — is scaffolding in service of that one idea: it's what
makes "pull a query from the DB of info" actually possible, by first getting real structured,
queryable data into Postgres (section 1 explains why that's not true today), then giving any
record's UI a way to ask for it by a shared key rather than a record-specific relationship. If a
later design choice ever makes it harder to "just query for the info you need" from any section,
that's a sign it's drifted from the actual goal, not a case for making an exception.

Written 2026-09-09, prompted by the export-batch-linking feature (see
`export-batch-linking-spec.md`), where the request was made explicit: the `.js` form files should
not be where the real "heavy lifting" of this system sits — the Neon database should. This
document takes that as a standing direction for the whole app (130+ records), not just the one
feature.

**Sequencing (confirmed with the requester, 2026-09-09): there is no urgent business deadline
forcing export-batch linking out the door. The requester is working through this system's ~130
records step by step, fixing issues as they're noticed — so it's reasonable to get this foundation
right first, rather than ship export-batch linking on the old blob-store pattern and migrate it
later.** Practically, that means: do the section-6 groundwork (the bespoke-behavior audit and the
(A)/(B) decision below) before writing schema for any record, then bring the export-batch-linked
records (Dry Export Pack Front Page, REC 7.4.7, 7.4.8, 7.4.9) across as the first real slice —
they're simple (no roster, no bespoke per-page scripts) and there's a concrete feature waiting on
them, so they're a good first proof of the new pattern once it's designed, without having to
migrate all 130 records before anything real is built on it.

### 1. What "heavy lifting" means today, concretely

Confirmed by reading the source (`public/lib/*.js`, `src/index.js`, `prisma/schema.prisma`):

- **Storage**: one Postgres table, `KeyValue(key, value, createdAt, updatedAt)`. `value` is an
  opaque JSON string. For any given record type, e.g. `formrecord:abalone-receiving`, **one row**
  holds a JSON array of *every entry ever submitted* for that record. There are no columns for
  `jobNo`, `receivingDate`, box weights, etc. — none of it exists as SQL-queryable structure.
- **Reads**: `getByPrefix` (`GET /api/storage/prefix/:prefix`) is the only bulk read — it returns
  whole blobs, and every record page loads its entire submission history into the browser to
  render its own list/table.
- **Field definitions, validation, required-ness, options, computed/derived values, roster
  columns, autofill rules, batch-trace linkage** — all of this lives in ~130 individual
  `FormRecord.init({...})` / `MonitoringLog.init({...})` JavaScript config objects, interpreted at
  runtime by two large shared engines, `public/lib/form-record.js` (82KB) and
  `public/lib/monitoring-log.js` (102KB).
- **Two derived-index tables already exist** and are the closest thing to "the database doing
  real work" today:
  - `SubmissionDateField` — every date field inside any submission, extracted and classified
    (`src/index.js`'s `syncSubmissionDates`, keyed by `data/date-field-classification.csv` +
    `data/record-key-map.json`).
  - The `batch_link:*` keys written by `public/lib/traceability.js`'s `indexSubmission` — one row
    per batch-number touchpoint, queried relationally by `GET /api/trace/:batch`
    (`src/index.js` lines 288-339).
  
  Both are **write-time extraction from the JSON blob into something queryable** — a pattern
  already proven in this codebase, and the right precedent for how a bigger migration should work,
  rather than inventing something new.
- **Some pages carry real bespoke behavior beyond declarative config** — e.g.
  `REC-7.1.2-abalone-receiving.html` has ~300 lines of page-specific JS: barcode-scan parsing, a
  scale-weight integration hook (`window.RecScale`), a "current basket" entry panel with its own
  state machine, custom pre-submit validation blocking the save button, and a MutationObserver
  reconciling that panel against the generic roster UI. **This is not just data-and-fields — it's
  real interactive behavior**, and a schema migration has to account for it, not just move field
  lists into column lists.

### 2. Why the current design is this way (from the codebase's own docs)

`BACKEND_INTEGRATION.md` explains the KeyValue/blob choice was deliberate, not an oversight: it
describes a not-yet-built upstream architecture (SYSPRO → Dataverse → this app's Postgres,
read-only) and states the seam (`window.storage`'s four functions) was designed so *connecting*
a backend was "a small, contained job rather than a rewrite of 146 pages" — i.e. the blob store was
chosen specifically to avoid a big-bang schema project while the backend was being stood up. That
tradeoff was reasonable at the time; the current ask is to revisit it now that real relational
needs (export batch linking, and by extension anything else that wants a proper join) are showing
the limits of a scan-the-blob-in-JS approach.

### 3. Target shape

#### 3a. Per-record relational tables, not one generic blob

Each of the ~130 records gets its own Postgres table (or a small number of related tables for
roster-bearing records — see 3c), with real typed columns for its fields, instead of a JSON blob.
Example, for REC 7.1.2 Abalone Receiving:

```prisma
model AbaloneReceiving {
  id              String   @id @default(cuid())
  jobNo           String
  receivingDate   DateTime
  receivedFrom    String?
  toBeProcessedFor String?   // 'Can' | 'Dried' | 'Live' | 'Other'
  intakeWeight    Decimal?  // computed (sum of roster.wholeWeight) — see 3b on computed fields
  status          String    // 'draft' | 'submitted'
  submittedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  baskets         AbaloneReceivingBasket[]

  @@index([jobNo])
  @@index([status])
}

model AbaloneReceivingBasket {
  id              String   @id @default(cuid())
  receivingId     String
  receiving       AbaloneReceiving @relation(fields: [receivingId], references: [id])
  sizeRange       String?
  basketNr        Int?
  wholeWeight     Decimal?
  farmCount       Int?
  mortalityCount  Int?

  @@index([receivingId])
}
```

This is the difference between "the JS scans for matching strings across blobs" (today, and still
true even after the Traceability-reuse spec) and "the database enforces and answers the
relationship directly" (the target state this document describes). **How that relationship is
actually modeled — a dedicated foreign key per relationship, vs. the generic `RecordLink`
mechanism — is decided in section 5a below, not here; see that section before assuming a direct
foreign key like `ExportBatch` is the answer.**

#### 3b. Where field *definitions* live — this is the crux of the "heavy lifting" question

Two real options, not one obvious answer:

- **(A) Schema-as-source-of-truth**: the Prisma schema (or a hand-maintained SQL migration set)
  becomes the canonical definition of every record's fields, types, and required-ness. The `.js`
  config objects are generated *from* the schema (or a thin manifest next to it), and
  `form-record.js`/`monitoring-log.js` become pure renderers that ask the API "what fields does
  this record have, what type, what's required" rather than declaring it themselves.
- **(B) API-enforced validation, schema-as-storage-only**: the Prisma schema defines storage shape
  and relations, but field metadata (labels, option lists, which type of input to render,
  conditional/computed logic like `intakeWeight`'s roster-sum) stays in a config format — just
  **validated server-side against the schema** on write, instead of trusted blindly from the
  client the way `PUT /api/storage/key/:key` does today (it only checks `typeof value ===
  'string'`). This is a smaller lift than (A) and still moves real weight to the database/API
  layer (rejecting bad data, enforcing types/required fields, owning relations) without requiring
  a form-definition-generation system.

**Recommendation for the design discussion: start with (B).** It delivers the actual thing being
asked for — Neon/the API doing real validation and relational work instead of blindly storing
whatever JSON the client sends — without also taking on a code-generation system for form UIs,
which is a separate, harder problem (see 3d, bespoke page behavior). (A) can be a later phase if
wanted once (B) is proven.

#### 3c. Roster-bearing and multi-entry records

Two existing shapes need explicit per-record-type handling, not a single generic pattern:

- **FormRecord with a roster** (e.g. Abalone Receiving's baskets, Dry Labelling List's boxes) →
  parent table + child table (3a's example above).
- **MonitoringLog records** (running logs — REC 7.4.7, REC 7.4.9, and ~40 others) → these are
  naturally just "one table, many rows, no parent/child," which maps onto relational storage more
  directly than FormRecord does.

#### 3d. Bespoke per-page behavior — the real risk in this migration

Pages like Abalone Receiving (barcode scanning, scale integration, custom save-blocking, sticky
UI state) are not simply "a form over fields" — moving their storage to a relational table doesn't
touch this logic, but a migration plan that assumes every record is declarative-config-only will
break these pages. **Before estimating this migration, audit every one of the ~130 record HTML
files for a second `<script>` block beyond the `FormRecord.init`/`MonitoringLog.init` call** (like
Abalone Receiving's ~300-line barcode/scale script) — that inventory is what turns this from a
guess into a real scope.

### 4. Migration path (write-time extraction, proven pattern in this codebase)

Do not attempt a big-bang cutover. Follow the precedent already set by `SubmissionDateField` and
`batch_link:*`:

1. **Add the new relational tables alongside the existing `KeyValue` table** — don't remove
   `KeyValue` yet.
2. **Dual-write**: on every `PUT /api/storage/key/:key` for a `formrecord:*`/`monitoring_log:*`
   key, in addition to today's blob write and `syncSubmissionDates`/`indexSubmission` calls, also
   upsert the record's own relational table(s) from the same payload (a new `syncRelational(key,
   value)`, one per record type — or, if going with option (B) above, this is also where
   server-side validation against the schema happens and can reject a bad write).
3. **Backfill** existing blob history into the new tables with a one-off script per record type
   (there is currently no submitted data on the four export-batch-linking records, so this is free
   for that feature, but not for the other ~126 records, which likely do have real production data
   — check before assuming an empty backfill everywhere).
4. **Cut reads over table-by-table**, starting with whichever record most needs real relational
   querying (export-batch linking is the forcing example) — read from the new table, verify
   against the old blob output during a transition window, then retire the blob read for that
   record.
5. **Retire `KeyValue` rows per record type** only once both write and read sides are fully moved
   and verified, not before.

Given the sequencing decision above (get the foundation right first, no rush), the export-batch
records (Dry Export Pack Front Page, REC 7.4.7, 7.4.8, 7.4.9) are a good **first** slice to build
this pattern against, rather than a later cutover candidate — they're simple (no roster
complexity, no bespoke per-page scripts like Abalone Receiving's), and there's a concrete feature
(export-batch linking) that immediately validates the pattern once it's live, so the very first
thing built on the new relational tables is something the requester can actually use.

### 5a. Linking must be generic, not per-feature — this changes the design

**Direction confirmed with the requester, 2026-09-09: any record should be linkable to any other
record, in whatever direction is needed, as a standing capability — not a one-off relationship
built just for export batch.** The concrete example given: a Dry Export Pack might need to be
linked from a future "Final Dry Report" record that doesn't exist yet. That means the schema below
must not hardcode `ExportBatch` as a special first-class join table that only these four records
know about — it needs a general link mechanism that any current or future record can use, in
either direction, without a schema change every time a new relationship is needed.

This is exactly the same shape problem `batch_link:*`/`Traceability` already solved once, at the
blob-store layer (section 1) — a generic keyed link between any two submissions, not a bespoke
foreign key per relationship. The relational version should keep that same generality, just
backed by a real table instead of scanned key-value rows:

```prisma
// A generic edge between two submissions in ANY two records (or the same record twice), keyed by
// a shared value (an export batch number, a job number, an AG code, a batch/lot — whatever the
// two sides actually share) rather than a fixed foreign key pair. This is what lets "Dry Export
// Pack <-> REC 7.4.7/7.4.8/7.4.9" and, later, "Final Dry Report -> Dry Export Pack" (or anything
// else not yet designed) work without a schema change per relationship.
model RecordLink {
  id             String   @id @default(cuid())
  linkValue      String   // the shared key, e.g. an export batch number -- normalised (trim+upper)
  linkField      String   // which kind of value this is, e.g. 'exportBatch', 'jobNo', 'agCode'
  recordName     String   // e.g. 'dry-export-pack-front-page', 'labelling-of-dry-boxes'
  recordId       String   // the row's own id in its own table (e.g. DryExportPackFrontPage.id)
  relation       String   // 'self' | 'input' | 'output' -- same semantics as today's Traceability rel
  createdAt      DateTime @default(now())

  @@index([linkValue, linkField])
  @@index([recordName, recordId])
}
```

Any record's own table (`DryExportPackFrontPage`, `LabellingOfDryBoxes`, a future
`FinalDryReport`, or any of the other ~126) writes rows into `RecordLink` whenever it's saved with
a value in a field the record declares as linkable — this is the direct relational successor to
today's `config.batchField`/`extraBatchFields` mechanism, just backed by an indexed join table
instead of scanned `batch_link:*` keys. A generic endpoint answers "everything linked to value X"
across every record that ever declared a link to it:

```
GET /api/links/:linkValue
  -> { linkValue: "3DP00001", records: [
       { recordName: 'dry-export-pack-front-page', recordId: '...', relation: 'self', ... },
       { recordName: 'labelling-of-dry-boxes',      recordId: '...', relation: 'self', ... },
       { recordName: 'final-dry-report',            recordId: '...', relation: 'output', ... },
       ...
     ] }
```

— which, given a `recordName`, is resolved to its own table and row via a small per-record
registry (the relational-era successor to today's `record-key-map.json` /
`traced-records.js`), not a hardcoded join per relationship.

**This is the piece that actually satisfies "linked in whatever way needed."** A dedicated
`ExportBatch` table with hardcoded relations to exactly four models (the version originally drafted
below) works only for this one feature and has to be redesigned every time a new relationship
shows up — e.g. wiring in a Final Dry Report later would mean another migration, another set of
foreign keys, more special-casing. `RecordLink` is the one mechanism, built once, that every
current and future record can use.

### 5a-ii. Sections as reusable building blocks, and cross-record fields inside any section

**Further direction confirmed with the requester, 2026-09-09: "all DB info should be able to fit
into any section"** — clarified as two things together, both bigger than `RecordLink` alone:

1. **Sections themselves should be reusable, DB-modeled components**, not re-declared per record.
   Today, `Shipment details`/`Sign-off`/`Attachments checklist`-style sections are just object
   literals inside each of the ~130 `FormRecord.init`/`MonitoringLog.init` calls — identical or
   near-identical sections (e.g. "Sign-off" with supervisor/QC/verification fields appears, in
   some form, on a large share of these records) are hand-duplicated wherever they're used.
2. **Any field from any linked record should be projectable into any section of any other
   record** — not just "here's a link to open the related record" (what `RecordLink` +
   `GET /api/links/:linkValue` gives you), but literally showing, say, REC 7.4.8's `nettWeight`
   value live inside a section of a future Final Dry Report, without Final Dry Report's own schema
   needing a `nettWeight` column of its own.

This is a real step up in scope from 5a, and it changes what the schema needs to represent. Two
new concepts, both building on `RecordLink`:

```prisma
// A reusable section definition -- e.g. "Sign-off", "Shipment details" -- declared ONCE and
// referenced by any record, instead of re-typed per record's config. `fieldDefs` describes the
// section's own native fields (label, type, required, options -- the same vocabulary
// form-record.js/monitoring-log.js already use, just centralised).
model SectionTemplate {
  id          String   @id @default(cuid())
  key         String   @unique     // e.g. 'signoff-standard', 'shipment-details'
  title       String               // e.g. 'Sign-off'
  fieldDefs   Json                 // [{ key, label, type, required, options... }, ...]
  createdAt   DateTime @default(now())
}

// Which sections a given record uses, and in what order. A record's "shape" becomes rows here
// instead of a hardcoded fields array in a .js file.
model RecordSection {
  id                String          @id @default(cuid())
  recordName        String          // e.g. 'dry-export-pack-front-page'
  sectionTemplateId String
  sectionTemplate   SectionTemplate @relation(fields: [sectionTemplateId], references: [id])
  position          Int

  @@index([recordName])
}

// A field inside a section whose VALUE is not typed in locally -- it's projected live from
// another record via a RecordLink. E.g. a "Linked export pack" section on Final Dry Report
// wants to show DryLabellingList.nettWeight for whatever export batch the report names, without
// Final Dry Report owning a nettWeight column itself.
model ProjectedField {
  id                String   @id @default(cuid())
  sectionTemplateId String
  sectionTemplate   SectionTemplate @relation(fields: [sectionTemplateId], references: [id])
  label             String           // shown label in the projecting section, may differ from source
  sourceRecordName  String           // e.g. 'dry-labelling-list'
  sourceFieldKey    String           // e.g. 'nettWeight'
  linkField         String           // which RecordLink.linkField resolves the source row, e.g. 'exportBatch'

  @@index([sectionTemplateId])
}
```

**How this actually renders, end to end, for the Final Dry Report example:** Final Dry Report
declares a `RecordSection` pointing at a `SectionTemplate` that includes a `ProjectedField` for
`dry-labelling-list.nettWeight` keyed on `exportBatch`. When a Final Dry Report entry is opened for
export batch `3DP00001`, the API resolves that `ProjectedField` by querying `RecordLink` for
`linkValue = '3DP00001', linkField = 'exportBatch', recordName = 'dry-labelling-list'`, fetches
that row's `nettWeight`, and returns it as part of Final Dry Report's own rendered data — live,
not copied at save time, so it always reflects 7.4.8's current submitted value.

**This is a materially bigger build than section 5a alone**, and it changes what "the .js form
files render" means: `form-record.js`/`monitoring-log.js` (or their eventual replacement) need to
know how to render a `ProjectedField` as read-only pulled-in content — which is exactly the same
rendering problem the export-batch-linking feature already needed solved (a "linked-records"
field type showing real pulled content, not a placeholder) — so this generalizes that one-off UI
need into the standing mechanism, rather than building it twice.

**Sequencing implication**: given this is confirmed as the target shape, the earlier `(A)
schema-as-source-of-truth` option in section 3b stops being "a later phase to consider" and becomes
close to required — `SectionTemplate`/`RecordSection`/`ProjectedField` only pay off if the
`.js` config layer actually reads section/field definitions from the database, rather than
declaring its own copy that could drift from what's centrally defined. Revise the 3b
recommendation: **build toward (A)**, using (B)'s server-side validation as a stepping stone
rather than a stopping point.

### 5b. Concrete first-slice schema: the four export-batch-linked records

The per-record tables below (their own real columns, replacing the JSON blob) stand regardless of
which linking approach is used — they're what section 3a/5a's move-off-KeyValue applies to
specifically for these four records. What changes given 5a is that they no longer carry a direct
`exportBatchId` foreign key into a bespoke `ExportBatch` table — instead each writes into the
generic `RecordLink` table (via `linkField: 'exportBatch'`) when saved, exactly like every other
record that declares a linkable field.

The `ExportBatch`/direct-foreign-key version is kept below, struck through in spirit, as a record
of the alternative considered and rejected in favor of 5a's generic approach — do not build it:

```prisma
model ExportBatch {
  id               String   @id @default(cuid())
  exportBatch      String   @unique
  createdAt        DateTime @default(now())

  frontPages       DryExportPackFrontPage[]
  labellingEntries LabellingOfDryBoxes[]
  labellingLists   DryLabellingList[]
  stockTransfers   DryStockTransfers[]
}

model DryExportPackFrontPage {
  id                          String      @id @default(cuid())
  exportBatchId               String
  exportBatch                 ExportBatch @relation(fields: [exportBatchId], references: [id])
  jobNumber                   String?
  packingDate                 DateTime?
  noOfBoxesExported            Int?
  signedPackingListsAttached  Boolean?
  healthCertificatesAttached  Boolean?
  completedBySupervisor       String?
  checkedByQC                 String?
  verificationBy              String?
  status                      String      // 'draft' | 'submitted'
  submittedAt                 DateTime?
  createdAt                   DateTime    @default(now())
  updatedAt                   DateTime    @updatedAt

  @@index([exportBatchId])
  @@index([jobNumber])
}

model LabellingOfDryBoxes {          // REC 7.4.7
  id                          String      @id @default(cuid())
  exportBatchId               String
  exportBatch                 ExportBatch @relation(fields: [exportBatchId], references: [id])
  date                        DateTime?
  clientName                  String?
  clientAddress               String?
  quantityOfBoxes             Int?
  productDescription          String?
  agCodeMatchesInspection     Boolean?
  sizeRangeCorrectAcrossBoxes Boolean?
  boxCountMatchesPackingList  Boolean?
  addressMatchesPackingList   Boolean?
  correctiveActions           String?
  inspectedByProcessing       String?
  inspectedByQC                String?
  inspectedByFG01              String?
  status                      String
  submittedAt                 DateTime?
  createdAt                   DateTime    @default(now())
  updatedAt                   DateTime    @updatedAt

  @@index([exportBatchId])
}

model DryLabellingList {              // REC 7.4.8
  id                     String      @id @default(cuid())
  exportBatchId          String
  exportBatch            ExportBatch @relation(fields: [exportBatchId], references: [id])
  customer               String?
  flight                 String?
  address                String?
  airwaybillNr           String?
  etd                    DateTime?
  nettWeight             Decimal?
  salesDept              String?
  driverFromFreightCo    String?
  abagoldEmployee        String?
  status                 String
  submittedAt            DateTime?
  createdAt              DateTime    @default(now())
  updatedAt              DateTime    @updatedAt

  boxes                  DryLabellingBox[]

  @@index([exportBatchId])
}

model DryLabellingBox {
  id                String            @id @default(cuid())
  labellingListId   String
  labellingList     DryLabellingList  @relation(fields: [labellingListId], references: [id])
  boxNo             Int?
  gradeRange        String?
  boxCode           String?
  agCode            String?           // kept as real per-box data, per the earlier decision not to touch its meaning
  weight            Decimal?

  @@index([labellingListId])
  @@index([agCode])                    // preserves AG-code lookups without agCode driving the batch link
}

model DryStockTransfers {            // REC 7.4.9
  id               String      @id @default(cuid())
  exportBatchId    String
  exportBatch      ExportBatch @relation(fields: [exportBatchId], references: [id])
  date             DateTime?
  noOfBoxes        Int?
  timeOfTransfer   String?
  transferredBy    String?
  receivedBy       String?
  status           String
  submittedAt      DateTime?
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  @@index([exportBatchId])
}
```

New endpoint this enables (a real join, not a blob scan or a batch-link string match):

```
GET /api/export-batches/:exportBatch/linked
  -> {
       exportBatch: "3DP00001",
       frontPage: { ...single row or null... },
       labellingEntries: [ ...LabellingOfDryBoxes rows... ],
       labellingLists: [ ...DryLabellingList rows, each with .boxes... ],
       stockTransfers: [ ...DryStockTransfers rows... ]
     }
```

implemented as one Prisma query against `ExportBatch` with `include`, e.g.:

```js
app.get('/api/export-batches/:exportBatch/linked', async (req, res) => {
  const batch = await prisma.exportBatch.findUnique({
    where: { exportBatch: req.params.exportBatch.trim().toUpperCase() },
    include: {
      frontPages: true,
      labellingEntries: { where: { status: 'submitted' } },
      labellingLists: { where: { status: 'submitted' }, include: { boxes: true } },
      stockTransfers: { where: { status: 'submitted' } }
    }
  });
  res.json(batch || { exportBatch: req.params.exportBatch, frontPages: [], labellingEntries: [], labellingLists: [], stockTransfers: [] });
});
```

Note this already answers, structurally, the "submitted-only" question the earlier
Traceability-reuse spec left open as a gap — `status: 'submitted'` is a real filter here, not
something bolted on afterward.

The front-page UI change (the `type: 'linked-records'` field rendering real pulled-in content
instead of the Y/N toggle) is unchanged in spirit from the earlier spec — only its data source
changes, from `window.Traceability.trace()` to this new endpoint.

### 6. What's needed before this can be scoped/estimated properly

1. The full-audit-for-bespoke-behavior pass described in 3d, across all ~130 record HTML files —
   now more important, not less: a `ProjectedField`/`SectionTemplate` model (5a-ii) assumes
   sections are declarative enough to centralize, and a page with real bespoke logic (barcode
   scanning, scale integration, custom validation, sticky UI state — Abalone Receiving's pattern)
   may not fit that model cleanly. The audit needs to specifically flag which records can become
   pure section-template compositions and which can't.
2. Section 3b's option choice is now effectively decided by 5a-ii: **build toward (A)**
   (schema-as-source-of-truth), using (B)'s server-side validation as a stepping stone. Confirm
   this reading is correct before committing engineering time — it's a materially larger build
   than (B) alone.
3. **Design `SectionTemplate`/`RecordSection`/`ProjectedField` against at least 2-3 concrete
   real examples before building** — the Final Dry Report example in 5a-ii is illustrative but
   that record doesn't exist yet. Pick real existing records that already share a section (e.g.
   compare the "Sign-off" section across several current records) and a real
   already-planned cross-record projection, so the schema is validated against real shape, not a
   hypothetical.
4. Confirmation of how much real production data currently lives in each `formrecord:*`/
   `monitoring_log:*` blob (drives backfill-script scope and risk — check via
   `GET /api/storage/prefix/formrecord:` / `monitoring_log:` per record, or a DB-side count, before
   assuming any record is "easy" the way the four export-batch records currently are).
5. A decision on sequencing: migrate record-by-record over time (recommended — matches the
   dual-write/cutover plan in section 4 and keeps the app shippable throughout), vs. a dedicated
   project that pauses other form changes until it's done. Given the scope added in 5a/5a-ii, also
   decide whether `RecordLink`/`SectionTemplate`/`ProjectedField` should be designed fully before
   any record migrates (safer, avoids rework) or evolved alongside the first slice (faster
   feedback, more rework risk) — recommendation: design `RecordLink` and a minimal
   `SectionTemplate` fully before migrating the first record, since retrofitting either into
   already-migrated tables is more expensive than getting the join/projection model right up
   front.

### 7. What this does NOT resolve on its own

- **It doesn't remove the need for the export-batch-linking feature's own decisions** (whether
  7.4.8 keeps AG-code traceability via a secondary link, whether drafts should be visible in
  traces/links) — those are feature-level decisions independent of which storage layer answers
  them.
- **It doesn't replace `form-record.js`/`monitoring-log.js` as UI renderers by itself** — even
  under option (A), the forms still need *some* client-side code to render inputs, render
  projected read-only fields, and collect values; what changes is where the definitions those
  renderers read come from.
- **Real per-user auth (Entra ID) and per-user audit trail** are called out as separate, unbuilt
  work in `BACKEND_INTEGRATION.md` already — this migration doesn't touch that, and validating
  data server-side is not the same as knowing *who* submitted it.

---

## Relational Neon for all records — DB is the source of truth, frontend layout unchanged

> **Source:** `Claude outputs/relational-all-records-plan.md`

**Date:** 2026-09-09 (rewritten — supersedes the earlier "storage layer only" version)
**Status:** Schema design for review. Greenfield — no DB in use yet.
**Related:** `INTEGRATION/07-RELATIONAL-VS-FRAPPE.md`, `relational-export-batch-slice.md`,
skill `fsms-erp-bridge`

---

### What Michaela decided (2026-09-09)

- The `.js` files must **not** be the heavy lifters. Field lists, required-ness,
  validation, derived values, links, autofill — all of it lives in the **database as
  data**, not in 130 hand-written `.init({...})` config objects.
- The **frontend layout is fine** — don't disturb how forms look or behave for the operator.
- **This is a server-backed site, not an app** (confirmed 2026-09-09). Online-only. **No
  offline mode, and no `localStorage` at all** — records save straight to Neon through the
  API; a failed save is retried, not queued locally. The current `data-store.js`
  `localStorage` fallback is to be removed.
- Neon account exists and `facility-api` is deployed, but **Neon is not organised yet** —
  this is effectively greenfield DB design.
- Frappe stays out — by preference (don't move platforms, don't rewrite the repo, "an app
  is too complex for this system"), not only by a constraint.

#### What that means, precisely

`form-record.js` / `monitoring-log.js` keep rendering forms exactly as they look today,
but they stop *owning* what a record is. On page load they **fetch the record's
definition from the API** and render from that — no client-side caching needed, since the
site is online-only. The definition — every field, type, rule, section, roster column,
autofill, link — is rows in Postgres.

This is a Frappe-shaped design (DocType metadata + per-doc tables), built as a minimal
version inside the existing site rather than by adopting Frappe.

#### Honest limit

Three records keep a small amount of real JS (REC 7.1.2 barcode + scale; REC 7.2.4
`deriveInto`; REC 7.2.12 `customBody`) — but as **named hooks referenced by the
definition** (`clientHook`), not authored inline per page. The DB still owns the field
list and rules around them.

---

### Three layers

#### Layer 1 — Definition (DB is source of truth)

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
  computeFn     String?                          // name of a fn in public/lib/compute/registry.js (+ server mirror)
  computeArgs   Json?                            // {"column":"wholeWeight"} | {"a":"coldReading","b":"coldStandard"}
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

`GET /api/record-def/:recordKey` returns the whole thing assembled. The engines fetch it
on page load and render. Online-only site — no client-side cache; `version` is for HTTP
caching / cache-busting, not offline storage.

#### Layer 2 — Submissions (per-record physical tables, generated from Layer 1)

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

#### Layer 3 — RecordLink (generic, unchanged from slice #1)

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

### Server owns validation

`PUT /api/storage/key/:key` stops trusting the client blob. For every
`formrecord:*` / `monitoring_log:*` write:

1. load the `RecordDefinition`
2. validate the payload against it — required present, types coercible, options in range,
   `validateJson` rules — **reject on failure** (today it only checks `typeof value === 'string'`)
3. compute `computed` / `derived` values server-side by calling `computeFn` with `computeArgs`
   (client value is advisory only)
4. `upsert` the Layer-2 row + roster rows
5. upsert/prune Layer-3 `RecordLink` edges
6. for any record that *already* holds `KeyValue` data, also write the blob for one
   transition window (rollback + diff mirror). Records with no existing data skip this
   and go straight relational.

The engines keep a client-side copy of the same validation for UX, driven by the same
definition — but it is no longer the authority.

---

### Engine changes (form-record.js / monitoring-log.js)

Rendering and layout code is **not** rewritten — it already renders from a config object
(`allFields(config)`, the `field.type` switch at `form-record.js:265–315`, roster handling,
job-info block, signoff block). The change is *where that object comes from*:

| Today | After |
|---|---|
| `FormRecord.init({ recordKey, sections:[…], … })` inline in each HTML file | `FormRecord.init({ recordKey })` only — engine does `GET /api/record-def/<key>` |
| config object literal | same object shape, assembled from `RecordDefinition` + children |
| definition is in the JS bundle | definition fetched from the API on page load (online-only site) |
| `computed`/`derived` done client-side | done server-side; client mirrors for live display |
| bespoke `<script>` per page (7.1.2 etc.) | `clientHook` name in the definition → hook from a small registry |

130 record HTML files each lose their `.init({...})` body and keep everything else
(mount div, lib includes, layout). Net: less code in the repo, not more.

---

### Getting the 130 definitions in

`scripts/extract-definitions.mjs` — one-time:

1. parse every `public/records/*.html` `.init({...})` (78 FormRecord + 53 MonitoringLog —
   they are clean static object literals, verified)
2. write `RecordDefinition` + `RecordSectionDef` + `RecordFieldDef` + `RecordAutofillDef` rows
3. emit a diff report: anything not cleanly mappable (bespoke hooks, unusual field types) —
   that list is the manual-review backlog
4. after review + sign-off, a second script strips the `.init({...})` bodies from the HTML

Then `gen-submission-schema.mjs` builds Layer 2 from the now-authoritative Layer 1.

---

### ERPNext alignment (per `fsms-erp-bridge`)

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

### Sequencing (implementation is staged even though the target is the whole thing)

1. **Slice #1 — the 4 export-batch records.** Build all three layers + server validation +
   the engine's fetch-definition path end to end on these four. Proves the design.
2. **Definition extraction** for the rest; manual-review backlog worked down.
3. **Area batches** — receiving (7.1.x), canning (7.2.x), drying (7.4.x), … — flip each
   batch's engine to fetch-from-DB, generate its Layer-2 tables, strip its inline configs.
4. Any `KeyValue` rows that predate this are diffed against their new relational rows,
   then retired per record once the diff window is clean.

Because almost nothing is in Neon yet, most records go straight to relational with no
`KeyValue` step at all — check `GET /api/storage/prefix/formrecord:` and
`monitoring_log:` first to see which (if any) already hold data.

### Open items

- ~~Run `extract-definitions.mjs` report-only → count the records that don't map~~
  **Done 2026-09-09** — see `definition-extraction-report.md`. Result: **124 / 131 clean,
  7 flagged, 0 unparseable.** All 7 flags are the same root cause (computed/derived field
  backed by a JS function); 3 of those also keep a `clientHook` (7.1.2, 7.2.4, 7.2.12).
- ~~`computeExpr` mechanism~~ **Decided (Consolidated Plan §6.1):** named-function registry —
  `computeFn` (string) + `computeArgs` (JSON) columns on `RecordFieldDef`, functions in
  `public/lib/compute/registry.js` + a server mirror. No DSL. Registry wiring for the ~15
  formulas is a build step, not a design question.
- `linkField` catalogue — enumerate the join-key kinds with Michaela (`jobNo`, `rmLot`,
  `exportBatch`, `agCode`, `person`, …) so normalisation rules per kind are defined once.
- `select` fields that should be shared Postgres enums (grades, size ranges, "processing for").
- How definitions get **edited** after seeding — admin UI vs migration-style PRs. Later.
- `fsms-erp-bridge` Q2 (which ERPNext doc an approved record becomes) — decides final
  table-name alignment; doesn't block.

---

## Relational slice #1 — RecordLink + the four export-batch records

> **Source:** `Claude outputs/relational-export-batch-slice.md`

**Date:** 2026-09-09
**Status:** Build-ready design. Scope frozen per `INTEGRATION/07-RELATIONAL-VS-FRAPPE.md`.
**Supersedes:** the schema sections of `Claude outputs/relational-architecture.md` for
these four records only. `SectionTemplate` / `RecordSection` / `ProjectedField` and
option A (schema-driven form rendering) are **out of scope here** — see "Not in this
slice" at the end.
**Feeds:** `Claude outputs/export-batch-linking-spec.md` (the front-page UI feature that
consumes this).

---

### What "build it all perfectly" means for this slice

Not "build the whole relational vision now." It means this bounded slice is done to a
standard the rest of the migration can be copied from:

- real typed columns, not a blob, for these four records
- one generic link table (`RecordLink`) that every future record will reuse unchanged
- dual-write alongside `KeyValue` — nothing is removed until reads are cut over and verified
- a `raw` JSON mirror column on every new table for the transition, so the old blob and
  the new row can be diffed byte-for-byte before the blob read is retired
- server-side validation on write (reject bad types / missing required), i.e. option (B)
- no form-framework work, no code generation, no changes to `form-record.js` /
  `monitoring-log.js` rendering beyond what `export-batch-linking-spec.md` already scopes

If a later decision moves the FSMS into Frappe, this slice is small enough to port or
discard cheaply. If it stays custom, `RecordLink` is the right foundation either way.

---

### 1. Prisma schema — additions to `prisma/schema.prisma`

Append these models. Nothing existing changes. `KeyValue`, `SubmissionDateField` stay
exactly as they are.

```prisma
// ---------------------------------------------------------------------------
// Relational slice #1  (INTEGRATION/07)
// Generic cross-record linking + real tables for the four export-batch records.
// Written alongside KeyValue by a dual-write in the API; KeyValue is still the
// system of record until reads are cut over and verified per section 4.
// ---------------------------------------------------------------------------

// A generic edge between one submission and a value it shares with other submissions
// (an export batch number, a job number, an AG code...). The relational successor to
// the batch_link:<value>:<record>:<submission> keys traceability.js writes today.
// ANY record writes rows here for any field it declares linkable -- no schema change
// per new relationship. `relation` carries the same self/input/output semantics as
// traceability.js's `rel`.
model RecordLink {
  id         Int      @id @default(autoincrement())
  linkValue  String   // shared key, normalised: trim + uppercase
  linkField  String   // kind of value: 'exportBatch' | 'jobNo' | 'agCode' | ...
  recordName String   // e.g. 'dry-export-pack-front-page'
  recordId   String   // the submission id in its own table (= the submission's own id)
  relation   String   @default("self") // 'self' | 'input' | 'output'
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([linkValue, linkField, recordName, recordId, relation], name: "record_link_edge")
  @@index([linkValue, linkField])
  @@index([recordName, recordId])
}

// --- Front page (FormRecord) --------------------------------------------------
model DryExportPackFrontPage {
  id                         String    @id            // the submission's own id (sub_...)
  jobNumber                  String?
  exportBatch                String?
  packingDate                DateTime?
  noOfBoxesExported          Int?
  signedPackingListsAttached Boolean?
  healthCertificatesAttached Boolean?
  completedBySupervisor      String?
  checkedByQC                String?
  verificationBy             String?
  status                     String    @default("draft") // 'draft' | 'submitted'
  submittedAt                DateTime?
  raw                        Json                          // full submission mirror, transition only
  createdAt                  DateTime  @default(now())
  updatedAt                  DateTime  @updatedAt

  @@index([exportBatch])
  @@index([jobNumber])
  @@index([status])
}

// --- REC 7.4.7 Labelling of Dry Boxes (MonitoringLog: one table, many rows) ---
model LabellingOfDryBoxes {
  id                          String    @id
  date                        DateTime?
  exportBatch                 String?
  clientName                  String?
  clientAddress               String?
  quantityOfBoxes             Int?
  productDescription          String?
  agCodeMatchesInspection     Boolean?
  sizeRangeCorrectAcrossBoxes Boolean?
  boxCountMatchesPackingList  Boolean?
  addressMatchesPackingList   Boolean?
  correctiveActions           String?
  inspectedByProcessing       String?
  inspectedByQC               String?
  inspectedByFG01             String?
  status                      String    @default("draft")
  submittedAt                 DateTime?
  raw                         Json
  createdAt                   DateTime  @default(now())
  updatedAt                   DateTime  @updatedAt

  @@index([exportBatch])
  @@index([status])
}

// --- REC 7.4.8 Dry Labelling List (FormRecord + "Boxes" roster) --------------
model DryLabellingList {
  id                  String    @id
  customer            String?
  exportBatch         String?
  flight              String?
  address             String?
  airwaybillNr        String?
  etd                 DateTime?
  nettWeight          Decimal?
  salesDept           String?
  driverFromFreightCo String?
  abagoldEmployee     String?
  status              String    @default("draft")
  submittedAt         DateTime?
  raw                 Json
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  boxes               DryLabellingBox[]

  @@index([exportBatch])
  @@index([status])
}

model DryLabellingBox {
  id              String           @id            // roster row id
  labellingListId String
  labellingList   DryLabellingList @relation(fields: [labellingListId], references: [id], onDelete: Cascade)
  position        Int                             // roster order, 0-based
  boxNo           Int?
  gradeRange      String?
  boxCode         String?
  agCode          String?
  weight          Decimal?

  @@index([labellingListId])
  @@index([agCode])
}

// --- REC 7.4.9 Dry Stock Transfers (MonitoringLog) --------------------------
model DryStockTransfers {
  id             String    @id
  date           DateTime?
  exportBatch    String?
  noOfBoxes      Int?
  timeOfTransfer String?
  transferredBy  String?
  receivedBy     String?
  status         String    @default("draft")
  submittedAt    DateTime?
  raw            Json
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([exportBatch])
  @@index([status])
}
```

#### Column notes

- **`id` is the submission's own id**, not a fresh `cuid()`. Submissions already carry
  `sub_<epochms>_<rand>`; roster rows already carry their own ids. This makes dual-write
  a plain `upsert` keyed on that id, and makes backfill re-runnable.
- **`raw Json`** — the entire submission object as received. Transition-only: it lets the
  cutover step (section 4) diff the reconstructed row against the original blob and prove
  equivalence before the blob read is retired. Drop these columns in a later migration,
  per record, once its read is fully moved.
- **`status` / `submittedAt`** — mirror the submission's `status` (and `values.__status`
  for the draft flag). `RecordLink` rows are still written for drafts (matches
  `traceability.js` today); consumers filter on `status` — see the endpoint in section 3
  and the open decision carried from `export-batch-linking-spec.md` section 2.
- **`exportBatch` is nullable** on all four — it is new, and existing/legacy submissions
  may not have it. Normalise to `trim().toUpperCase()` on write, the same way
  `RecordLink.linkValue` is normalised, so the join is exact.
- **`jobNumber`** kept on the front page (it is a real field there). 7.4.7 / 7.4.8 / 7.4.9
  have no job-info block today — no `jobNo` column added. If the job-info block is later
  added to any of them, add the column then.
- **`Decimal`** for weights (`nettWeight`, box `weight`) — never `Float` for anything
  that could be read back as a quantity.
- **`onDelete: Cascade`** on `DryLabellingBox` — a labelling list and its boxes are one
  document; deleting the parent removes its rows.
- **`position`** on `DryLabellingBox` — roster array order is not otherwise recoverable
  after the split (same reasoning as `INTEGRATION/04`).

---

### 2. RecordLink write rules

On every dual-write of one of the four records (section 4 step 2):

1. Compute the link edges for the submission:
   - `exportBatch` present → `{ linkField: 'exportBatch', linkValue: norm(exportBatch), relation: 'self' }`
   - front page only, `jobNumber` present → `{ linkField: 'jobNo', linkValue: norm(jobNumber), relation: 'self' }`
   - 7.4.8 only, any roster box `agCode` present → one edge per distinct AG code,
     `{ linkField: 'agCode', linkValue: norm(agCode), relation: 'input' }`
     (secondary link — mirrors `extraBatchFields: ['agCode']` in the feature spec)
2. `upsert` each edge on the `record_link_edge` unique key (idempotent re-write on every save).
3. Delete any `RecordLink` rows for `(recordName, recordId)` whose edge is no longer
   present in the submission (e.g. the operator corrected the batch number).

`norm(x) = String(x).trim().toUpperCase()`. Use it in exactly one place, shared with the
column writes.

---

### 3. API endpoints

#### `GET /api/links/:linkValue`

Everything linked to a shared value, across every record that ever declared a link to it.

```
GET /api/links/3DP00001
  -> { linkValue: "3DP00001",
       records: [
         { recordName: "dry-export-pack-front-page", recordId: "sub_...", linkField: "exportBatch", relation: "self" },
         { recordName: "labelling-of-dry-boxes",      recordId: "sub_...", linkField: "exportBatch", relation: "self" },
         ...
       ] }
```

Implementation: one `recordLink.findMany({ where: { linkValue: norm(param) } })`.
Optional `?linkField=exportBatch` filter. This is the generic successor to
`GET /api/trace/:batch` and works for every future record with zero new code.

#### `GET /api/export-batches/:exportBatch/linked`

The shaped view the front-page feature needs — a real join, submitted-only.

```
GET /api/export-batches/3DP00001/linked
  -> { exportBatch: "3DP00001",
       frontPage:       { ...row or null... },
       labellingEntries:[ ...LabellingOfDryBoxes rows... ],
       labellingLists:  [ ...DryLabellingList rows, each with .boxes... ],
       stockTransfers:  [ ...DryStockTransfers rows... ] }
```

```js
app.get('/api/export-batches/:exportBatch/linked', async (req, res) => {
  const b = norm(req.params.exportBatch);
  const [frontPages, labellingEntries, labellingLists, stockTransfers] = await Promise.all([
    prisma.dryExportPackFrontPage.findMany({ where: { exportBatch: b, status: 'submitted' } }),
    prisma.labellingOfDryBoxes.findMany({ where: { exportBatch: b, status: 'submitted' } }),
    prisma.dryLabellingList.findMany({ where: { exportBatch: b, status: 'submitted' }, include: { boxes: { orderBy: { position: 'asc' } } } }),
    prisma.dryStockTransfers.findMany({ where: { exportBatch: b, status: 'submitted' } }),
  ]);
  res.json({ exportBatch: b, frontPage: frontPages[0] || null, labellingEntries, labellingLists, stockTransfers });
});
```

`status: 'submitted'` here is the real answer to the draft-visibility question
`export-batch-linking-spec.md` left open — drafts are indexed in `RecordLink` but this
shaped endpoint hides them. The front-page `linked-records` field can point at this
endpoint instead of `window.Traceability.trace()` once it exists; until then the feature
spec's Traceability path still works unchanged.

---

### 4. Migration path (per `INTEGRATION/04`; proven by `SubmissionDateField` / `batch_link:*`)

1. **Add the tables.** `prisma migrate` the models above. Nothing reads them yet.
2. **Dual-write.** In the `PUT /api/storage/key/:key` handler, when the key is
   `formrecord:dry-export-pack-front-page`, `formrecord:dry-labelling-list`,
   `monitoring_log:labelling-of-dry-boxes` or `monitoring_log:dry-stock-transfers`
   (and their `:<id>` per-submission variants from ADR 04): after today's blob write and
   the existing `syncSubmissionDates` / `indexSubmission` calls, also
   `syncRelational(key, value)` — one mapper per record type that (a) validates required
   fields and types, rejecting the write on failure; (b) `upsert`s the row + roster rows;
   (c) applies the `RecordLink` write rules in section 2.
3. **Backfill.** One script, re-runnable (upserts on submission id). These four records
   have **zero submitted entries** as of 2026-09-09 (`export-batch-linking-spec.md`) —
   re-check `View entries` on each before running; if still empty the backfill is a
   no-op and that is fine.
4. **Cut reads over, one record at a time.** Point that record's list/detail read at the
   new table; keep computing the old blob result alongside for a transition window and
   log any diff (`raw` vs blob). When the diff log is clean, retire the blob read for
   that record.
5. **Retire `KeyValue` rows** for a record only after both write and read are fully moved
   and the diff window was clean. Not before. Drop that record's `raw` column in the
   same migration.

Ship order within the slice: front page last (it consumes the other three via the
endpoint), so bring `labelling-of-dry-boxes`, `dry-labelling-list`, `dry-stock-transfers`
across first.

---

### 5. Test plan

1. `prisma migrate` applies cleanly; existing `KeyValue` / `SubmissionDateField` untouched.
2. Submit one entry each on 7.4.7, 7.4.8, 7.4.9 with `exportBatch = TESTBATCH01`:
   - a row appears in each new table with the right typed values and `raw` mirroring the blob
   - `KeyValue` still has the blob (dual-write, not move)
   - `GET /api/links/TESTBATCH01` returns all three edges
   - `GET /api/export-batches/TESTBATCH01/linked` returns them shaped, `boxes` ordered
3. Save one as a **draft**: row has `status='draft'`, `RecordLink` edge exists,
   `/api/export-batches/.../linked` omits it. Submit it: it appears.
4. 7.4.8 with two roster boxes carrying different AG codes → two `agCode` `RecordLink`
   edges with `relation='input'`, plus the `exportBatch` `self` edge.
5. Edit a submitted 7.4.8, change `exportBatch` → old `RecordLink` edge gone, new one present.
6. Validation: submit with a required field blank / a number field set to text → write
   rejected, no partial row, clear error.
7. Front page with `exportBatch = TESTBATCH01` → its own row + edge; appears in
   `/api/export-batches/TESTBATCH01/linked` as `frontPage`.
8. Backfill script run twice in a row → identical result, no duplicate rows (upsert on id).
9. Two `dry-stock-transfers` entries on one export batch → both returned.
10. `norm()` — `" testbatch01 "` on one record and `"TESTBATCH01"` on another resolve to
    the same batch.

---

### Not in this slice (deferred per `INTEGRATION/07`)

- `SectionTemplate` / `RecordSection` — reusable section definitions
- `ProjectedField` — live cross-record field projection (Frappe "Fetch From")
- Option A — forms rendered from central definitions / any code generation
- Migrating any of the other ~126 records
- Changing `form-record.js` / `monitoring-log.js` rendering beyond
  `export-batch-linking-spec.md` section 3
- Auth / per-user audit trail (`BACKEND_INTEGRATION.md`, separate unbuilt work)

Revisit `SectionTemplate` / `ProjectedField` only with 2–3 real cross-record cases in
hand. The A-vs-B fork (custom app vs FSMS-in-Frappe) is a Werner + Michaela decision,
prerequisites listed in `INTEGRATION/07`.

---

## Type the submission tables — build spec for Claude Code

> **Source:** `claude/submission-table-typing-spec.md`

**Context:** the 175 `sub_*` submission tables in the live Neon database store every field as
`String?`, regardless of what kind of data it actually is. This was written by an earlier Claude
session (commit `0a001f0`, "relational layer 2," 2026-09-10, one day before this was reviewed) as
a design choice made *while building the relational layer* — not a decision made by anyone at
Abagold, and not something that's been load-bearing long enough to be risky to change. Now that
the project's near-term goal is reconciling this data against ERPNext (which will hand back typed
values), it's worth fixing properly instead of working around it with cast-at-query-time
documentation. See `claude/erp-reconciliation-prep.md` for the original field-by-field reference
this spec supersedes with a real fix, and `claude/erpnext-integration-spec.md` for the broader
integration this unblocks.

**The good news:** the information needed to type every field correctly already exists and is
already the system's own source of truth for field metadata — `data/record-definitions.json` (and
its database mirror, `RecordFieldDef.type`) declares a `type` per field:

| type | count | Prisma column type |
|---|---|---|
| `text` | 687 | `String?` (unchanged) |
| `number` | 292 | `Float?` |
| `yesno` | 282 | `Boolean?` |
| `date` | 227 | `DateTime?` (date-only) |
| `select` | 152 | `String?` (unchanged — options are strings) |
| `textarea` | 96 | `String?` (unchanged) |
| `jobsearch` | 47 | `String?` (unchanged — this is the job-number reconciliation key, see the open question in `claude/erp-reconciliation-prep.md` section 2; do not change its type even though it identifies numbers) |
| `computed` | 9 | follow the type of what it computes (check `computeFn` in `RecordFieldDef`; most are numeric) |
| `month` | 5 | `String?` (unchanged — `<input type="month">` value, e.g. `"2026-09"`, not a real date) |
| `recordpick` | 4 | `String?` (unchanged — references another record) |
| `timestamp` | 3 | `DateTime?` |
| `digits` | 3 | `Int?` |
| `derived` | 3 | follow the type of what it derives from |
| `time` | 2 | `String?` (unchanged — `HH:MM`, not worth a DateTime for two fields) |
| `jobnumber` | 1 | `String?` (unchanged — same reasoning as `jobsearch`) |
| `batchseq` | 1 | `String?` (unchanged — a sequence code, not numeric) |

So this is **not** a hand-picked allowlist of "ERP-relevant fields" — it's a mechanical mapping
driven by metadata the system already declares for every one of its ~1800 fields, run uniformly.
That's both more correct and lower-risk than picking fields by hand, since it can't miss a field
or apply inconsistent judgement.

### Why this needs to be three coordinated changes, not one

Changing `prisma/schema.prisma` alone will break every future submission. Here's why, and what
each piece needs:

#### 1. `scripts/generate-submission-schema.mjs` — read `type` from the definition, emit the right Prisma type
Currently every field becomes `String?` unconditionally (line ~93: `` `${col.padEnd(24)} String?` ``).
Change this to look up the field's `type` from `def.fields` (already in scope as `f.type`) and emit
the mapped Prisma type per the table above. Apply the same change to the roster/child-table loop.

Keep `rawJson` on every table exactly as-is — it's the existing safety net (full JSON blob per
row) and should stay regardless of this change, so nothing is ever unrecoverable even if a cast
goes wrong somewhere.

#### 2. `src/submission-store.js` — stop force-stringifying every value
This is the actual blocking risk. Line 112 currently does:
```js
params.push(v != null ? String(v) : null);
```
for **every** column, unconditionally, before a raw SQL `INSERT`. Once the target column is
`Float?`/`Int?`/`Boolean?`/`DateTime?` instead of `String?`, this needs to convert per the column's
real type instead of always stringifying — and, critically, **handle the case where the input is
not cleanly convertible** (empty string, stray text, inconsistent decimal formatting from a
half-filled paper form) without throwing and killing the whole transaction for that record.

Concretely: `getSchema()` already loads `RecordFieldDef` rows per record key — extend the cached
schema object to carry each column's target type alongside its key/col name, and add a
`coerce(value, type)` helper:
- `number`/`digits` → `parseFloat`/`parseInt`; on `NaN`, write `null` (not throw) and log a
  warning naming the record key, field, and raw value, so bad data is visible but never blocks a
  submission
- `yesno` → map the field's actual stored vocabulary (check what values the yesno inputs actually
  write today — likely `"Yes"`/`"No"` strings, possibly `"true"`/`"false"` in some records; confirm
  by sampling live data before assuming) to `true`/`false`/`null`
- `date`/`timestamp` → `new Date(v)`; on `Invalid Date`, write `null` and log the same warning
  shape
- everything else → unchanged `String(v)`

This preserves the existing "never let a storage failure break a form mid-shift" principle from
`BACKEND_INTEGRATION.md` — a bad value degrades to `null` in the typed column (recoverable from
`rawJson`) rather than failing the write.

#### 3. A migration that doesn't lose or corrupt existing data
There are only 35 live submission rows total as of 2026-09-14 (per `claude/neon-db-live-audit.md`)
— small enough to migrate by regenerating rather than needing an in-place `ALTER COLUMN ... USING`
cast, which is the safer choice here anyway given point 2's coercion logic needs to run in
application code, not raw SQL:

1. Run `scripts/generate-submission-schema.mjs` (updated per step 1) to produce the new
   `prisma/submission-models.prisma`.
2. Before applying: back up the 35 existing rows (the existing `scripts/backup.js` compliance
   backup already does this — confirm a fresh backup exists, or run one, before migrating).
3. Apply the schema change as a new Prisma migration (`npx prisma migrate dev --name type_submission_columns`)
   — this will `DROP` and recreate the affected columns, so existing data in those columns is lost
   at the schema level. That's acceptable here because:
   - `KeyValue` remains the actual source of truth (per `submission-store.js`'s own comment: "The
     KeyValue blob is still the source of truth; this is an additive projection for queries") —
     nothing is lost from the system, only from the projection.
   - `rawJson` on each row is also about to be dropped and recreated by the same migration, so
     after migrating, **re-run the dual-write sync for all 35 existing `formrecord:`/`monitoring_log:`
     keys** (a one-off script reading every such key from `KeyValue` and calling
     `syncSubmissionRows` again) to repopulate the typed columns from the source of truth. Do not
     skip this step — otherwise the 9 populated tables go back to 0 rows and stay there until
     someone resubmits.
4. Verify: re-run the same row-count query used in the Neon audit
   (`select relname, n_live_tup from pg_stat_user_tables where relname like 'sub_%'`) and confirm
   the same 9 tables show the same row counts as before (3/3/3/2/2/1/1/6/14), now with typed
   columns populated instead of stringified text.

### What NOT to change in this pass
- `KeyValue` and `SubmissionDateField` — untouched, they're a separate layer and this doesn't
  affect either.
- `jobsearch`/`jobnumber`/`recordpick`/`batchseq`/`month`/`time` fields — deliberately left as
  `String?` per the table above; these are identifiers or formats where a string is the correct
  type, not a typing gap.
- The generator's overall shape (one table per record, `_Row` children, `rawJson` safety net) —
  none of that changes, only the per-field column type.

### Status
Ready to build. No open questions block this — the type mapping is mechanical (driven by existing
`record-definitions.json` metadata), the risk (submission-store.js's blind stringify) is identified
with a concrete fix, and the data volume (35 rows) is small enough that a full re-sync after
migration is the safe path rather than a risky in-place cast.

---

## Neon Database — Live Audit (2026-09-14): Operations Comparison vs Syspro, Corrected

> **Source:** `claude/neon-db-live-audit.md`

**Why this doc exists.** Michaela asked for an evaluation of the site against Syspro on the
operations side, specifically asking that the live Neon database be checked before drawing any
conclusion. The first pass of this evaluation was based on the schema (pulled from GitHub) and the
live app UI only, and it drew conclusions about traceability/trend-viewing "gaps" that turned out
to be an artifact of near-zero data, not a structural weakness. This doc corrects that, with the
actual query results as evidence, so the correction doesn't get lost.

### What was actually checked

Direct SQL access to the Neon database was not available from the cloud sandbox (raw Postgres on
port 5432 is not proxied through this session's egress, and Neon's HTTPS/serverless driver hit an
org-level host allowlist block). The Neon console's own SQL editor was used instead — Michaela ran
four queries and pasted back the results, reproduced in full below.

### Query 1 — row counts per table (busiest first, capped at 40)

Only 9 of the 40 busiest tables have any rows at all. The rest (31 of the 40 shown, and it gets
worse further down the list) are at zero: traceability, mock recall, water monitoring, maintenance,
chemical stock, medicals, training register, and more.

| table | rows |
|---|---|
| sub_abalone_receiving_row | 14 |
| sub_salting_and_tumbling_row | 6 |
| sub_cans_produced | 3 |
| sub_salting_and_tumbling | 3 |
| sub_abalone_receiving | 3 |
| sub_basket_removal_shucking_gutting | 2 |
| sub_precooking_check_sheet | 2 |
| sub_qc_report | 1 |
| sub_gonad_inspection_report | 1 |
| *(31 more tables in the top-40, all at 0 rows)* | 0 |

### Query 2 — whole-database total

| total_tables | empty_tables | total_rows |
|---|---|---|
| 175 | 166 | **35** |

**175 record submission tables exist. 166 of them (95%) have never received a single submission.
The entire database holds 35 rows, full stop.**

### Query 3 — traceability/linking layer

| table | count |
|---|---|
| RecordLink | 19 |
| SubmissionDateField | 28 |
| RecordDefinition | 131 |

`RecordDefinition` at 131 is fully seeded — that's the design-time metadata layer (one row per
record type), populated once by `scripts/extract-definitions.mjs`, independent of usage. The other
two scale with the 35 real submissions: roughly one date-index row per submission (28 vs 35, since
not every record type has a classified date field) and about one link row per two submissions (19
vs 35, since only job-numbered records — receiving, salting, canning — currently populate
`linkField`).

### Query 4 — sample of the core intake record (`sub_abalone_receiving`)

| jobNo | receivingDate | receivedFrom | toBeProcessedFor | intakeWeight | createdAt |
|---|---|---|---|---|---|
| CPR002045 | 2026-09-10 | Bergsig | Can | 93.35 | 2026-09-10 14:47:49 |
| 3CP0001112 | 2026-09-11 | Third Party | Can | 582.15 | 2026-09-10 11:22:05 |
| CPR001598 | 2026-09-10 | Bergsig | Can | 37.45 | 2026-09-10 06:41:40 |

All 3 receiving records fall inside a single 24-hour window (2026-09-10 to 2026-09-11), from two
source farms, all routed to canning. This is pilot/test data from one or two days of use, not a
production history.

### Corrected conclusion

The earlier version of this evaluation (before live data was checked) described traceability as
"real but shallow" and trend-viewing as "basic," based on the batch trace page showing "6 batch
numbers indexed" and several dashboard tiles reading "No data." That framing was wrong in emphasis:
those weren't thin features, they were close to the entire dataset. With 35 total rows across 175
tables, there is currently nothing to trend and almost nothing to trace — not because the schema
can't support it, but because the facility hasn't yet run real production volume through the
system.

This matters for how "operations vs Syspro" should actually be read:

- **The structural gaps identified from the schema still stand** — no stock/inventory ledger, no
  work-order costing, no live Syspro connection (by design). Those are true regardless of row
  count, because they're about what tables and relations exist, not how many rows are in them.
- **The traceability/trend gaps are not structural** — the `RecordLink` join-table design and the
  `SubmissionDateField` date-index design are both sound and already working correctly at the
  scale that exists (19 links / 28 dated fields against 35 submissions is the right ratio). They
  simply have almost nothing to operate on yet.
- **The practical priority is rollout, not schema work.** Every traceability and trend-viewing goal
  in the project brief depends on real shift-level data flowing through the system at volume. No
  amount of further database design will produce a trend line from 3 canning jobs recorded on two
  days. Getting the floor onto full, sustained use of the system is the highest-leverage next step
  for the "traceability is vital" and "must be able to view trends" requirements — ahead of any
  further schema or reporting work.

### Evidence trail

Queries were run directly against the live Neon instance via its own SQL editor
(`postgresql://...@ep-long-pond-aydj6pgg-pooler.c-5.us-east-2.aws.neon.tech/neondb`) on
2026-09-14. Note: the connection string was shared in chat during this session and should be
rotated in the Neon dashboard if it hasn't been already, since it grants full read/write access to
the whole database.

---

## Definition-extraction report

> **Source:** `Claude outputs/definition-extraction-report.md`

**Date:** 2026-09-09
**Command:** `node scripts/extract-definitions.mjs` (report) / `--emit` (writes the JSON)
**Raw output:** `Claude outputs/definition-extraction-report.txt`, `definition-extraction.json`

**Update — compute registry built (later same day):** the 7 flagged records are resolved.
5 named functions in `public/lib/compute/registry.js` (mirrored server-side by
`src/compute-registry.js`) now back the 8 monitoring-log computed fields
(`computeFn` + `computeArgs` on the field rows); the 3 form-record ones
(`intakeWeight`, `standardSaltingTime`, `totalTumblingTime`) were already declarative
(`sumRosterColumn` / `deriveLookup` / `deriveDuration`) and needed nothing.
**Now: 129 clean, 2 flagged** — REC 7.1.2 (barcode + scale hardware) and REC 7.2.12
(`customBody`), both keeping JS via `clientHook` exactly as Consolidated Plan §6.3 intends.
The section below is the original report.

---

### Headline

| | count |
|---|---:|
| record pages scanned | 131 (7 non-record pages excluded) |
| **map cleanly, zero manual work** | **124** |
| flagged for review | 7 |
| unparseable / no init call | 0 |
| records using declarative autofill | 45 — fully handled by `RecordAutofillDef` |
| engines | 78 form-record · 53 monitoring-log |

**~95% of records are pure declarative** — field list, types, required, options, sections,
rosters, autofill — and lift into `RecordDefinition` + children with no human involvement.

### Field types in use (all safe to map 1:1 to a column)

`text` 686 · `number` 293 · `yesno` 282 · `date` 227 · `select` 121 · `textarea` 96 ·
`jobsearch` 47 · `computed` 9 · `month` 5 · `recordpick` 4 · `timestamp` 3 · `digits` 3 ·
`derived` 2 · `time` 2 · `jobnumber` 1 · `batchseq` 1

`month` → `<input type=month>` / `String`; `timestamp` → `DateTime`; `digits` → integer.
Trivial additions to the generator's type map — not blockers.

### The 7 flagged records — all the same root cause

Every flag is a **computed / derived field backed by a JS function**. That's the one
mechanism that isn't declarative today and needs a home in the definition model.

| Record | Computed/derived fields | Also bespoke? |
|---|---|---|
| REC 7.1.2 Abalone Receiving | `intakeWeight` (sum of roster whole-weights) | **yes** — ~300 lines barcode + scale (`window.Rec*`) |
| REC 7.1.3 Salting & Tumbling | `standardSaltingTime`, `totalTumblingTime` | no |
| REC 7.10.3 Thermometer Verification | `coldDeviation`, `hotDeviation` | no |
| REC 7.10.4 Thermometer Correction Factors | `difference` | no |
| REC 7.2.4 Abalone Packing Specification | `cookoutPct`, `newMinIngo`, `newMaxIngo` | **yes** — `deriveInto` hook |
| REC 7.2.12 Double Seam Inspection | (fields built in `customBody`) | **yes** — `customBody` hook |
| REC 7.5.1 Live Production Pack | `purgeDays`, `purgeLoss` | no |

~15 formulas total. Shapes seen: roster-column sums, `a - b`, `round(x * frac, 2)`,
`ceil(spec / cookoutFrac)`. Small and regular.

### What the backlog actually is

1. **A `computeExpr` mechanism** — one decision. Either a tiny expression DSL
   (`sum(roster.wholeWeight)`, `round(minSpec / cookoutFrac, 2)`) evaluated on the server
   and mirrored client-side, or a named-function registry (`computeExpr: 'cookoutPct'`
   → a function in `public/lib/compute/`). DSL is more "definition is data"; registry is
   less work and keeps the 15 existing functions almost as-is. **Recommend the registry
   first**, DSL later if the list grows.
2. **3 `clientHook` records** — 7.1.2, 7.2.4, 7.2.12 keep their bespoke JS, but as a
   named hook the definition points to, not inline page script. 7.1.2's scale/barcode
   integration is inherently client code and stays that way.
3. **4 field-type variants** (`month`, `timestamp`, `datetime`, `digits`) added to the
   generator's type map — an hour.

Nothing here changes the plan. It confirms the tail is ~7 records and one small design
choice, not a long slog.

### Non-record pages excluded

`_shell-test`, `batch-trace`, `double-seam-trend`, `master-record-index`,
`quick-abalone-receiving`, `record-list`, `seam-quick-calculator` — tools/indexes, no
`.init()` call, not part of the migration.

---

## Grading log layout: seeded to Neon (2026-09-29)

> **Source:** `Claude outputs/grading-layout-seed-2026-09-29.md`

REC 7.4.3.1 (cultivated) and 7.4.3.2 (ranched) Collection bins card layout is now live in the database.

### Verification
- `node scripts/verify-definitions.mjs` **fails: 25 records** (sign-off sections / fields on the page but not in the definition, e.g. factory-maintenance-inspection, supplier-questionnaire, 7.6.x cleaning records, 7.7.x registers).
- The same 25 fail against the HEAD version of `data/record-definitions.json`, so they **predate the grading edits**. Neither grading record is among them.

### What differs from HEAD in `data/record-definitions.json`
| Record | Source |
|---|---|
| grading-production-log-cultivated | grading bin-card layout (this work) |
| grading-production-log-ranched | grading bin-card layout (this work) |
| drying-process | recent drying-process work (NOT seeded) |
| dry-monitoring | recent drying-process work (NOT seeded) |

The other 127 records are unchanged.

### What was seeded
- Full `seed-definitions.mjs` was **not** run (it wipes and reloads all 131 definitions and would have pushed the unfinished drying-process changes and the 25 mismatching records).
- Instead `scripts/seed-grading-only.mjs` (untracked one-off) deleted and reloaded only the two grading records in one transaction.
- Result: `seeded 2 definitions`; DB still 131 definitions, 224 sections, 1780 fields, 45 autofills.

### Live check
`GET /api/record-def/grading-production-log-{cultivated,ranched}`: one roster each with `cardLayout: true`, 8 columns, every column has a `layoutRow`.

### Follow-ups
- Hard-refresh (Ctrl+Shift+R) the grading pages on each device.
- Nothing committed or pushed.
- drying-process / dry-monitoring still need seeding once the 7.4.1 entry-log work ships; the 25 verify failures still need fixing before a full reseed.
- Cleanup stopped four Node processes, including any `npm run dev` you had running; restart it.

---
