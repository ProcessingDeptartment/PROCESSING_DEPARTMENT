# Moving PROCESSING_DEPARTMENT off the generic KeyValue store onto relational Postgres

**Status: proposal / design for review — not started, not approved for build.**

## The idea in one sentence (confirmed with the requester, 2026-09-09)

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

## 1. What "heavy lifting" means today, concretely

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

## 2. Why the current design is this way (from the codebase's own docs)

`BACKEND_INTEGRATION.md` explains the KeyValue/blob choice was deliberate, not an oversight: it
describes a not-yet-built upstream architecture (SYSPRO → Dataverse → this app's Postgres,
read-only) and states the seam (`window.storage`'s four functions) was designed so *connecting*
a backend was "a small, contained job rather than a rewrite of 146 pages" — i.e. the blob store was
chosen specifically to avoid a big-bang schema project while the backend was being stood up. That
tradeoff was reasonable at the time; the current ask is to revisit it now that real relational
needs (export batch linking, and by extension anything else that wants a proper join) are showing
the limits of a scan-the-blob-in-JS approach.

## 3. Target shape

### 3a. Per-record relational tables, not one generic blob

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

### 3b. Where field *definitions* live — this is the crux of the "heavy lifting" question

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

### 3c. Roster-bearing and multi-entry records

Two existing shapes need explicit per-record-type handling, not a single generic pattern:

- **FormRecord with a roster** (e.g. Abalone Receiving's baskets, Dry Labelling List's boxes) →
  parent table + child table (3a's example above).
- **MonitoringLog records** (running logs — REC 7.4.7, REC 7.4.9, and ~40 others) → these are
  naturally just "one table, many rows, no parent/child," which maps onto relational storage more
  directly than FormRecord does.

### 3d. Bespoke per-page behavior — the real risk in this migration

Pages like Abalone Receiving (barcode scanning, scale integration, custom save-blocking, sticky
UI state) are not simply "a form over fields" — moving their storage to a relational table doesn't
touch this logic, but a migration plan that assumes every record is declarative-config-only will
break these pages. **Before estimating this migration, audit every one of the ~130 record HTML
files for a second `<script>` block beyond the `FormRecord.init`/`MonitoringLog.init` call** (like
Abalone Receiving's ~300-line barcode/scale script) — that inventory is what turns this from a
guess into a real scope.

## 4. Migration path (write-time extraction, proven pattern in this codebase)

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

## 5a. Linking must be generic, not per-feature — this changes the design

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

## 5a-ii. Sections as reusable building blocks, and cross-record fields inside any section

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

## 5b. Concrete first-slice schema: the four export-batch-linked records

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

## 6. What's needed before this can be scoped/estimated properly

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

## 7. What this does NOT resolve on its own

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
