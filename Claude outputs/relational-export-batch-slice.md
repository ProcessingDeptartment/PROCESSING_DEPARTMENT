# Relational slice #1 — RecordLink + the four export-batch records

**Date:** 2026-09-09
**Status:** Build-ready design. Scope frozen per `INTEGRATION/07-RELATIONAL-VS-FRAPPE.md`.
**Supersedes:** the schema sections of `Claude outputs/relational-architecture.md` for
these four records only. `SectionTemplate` / `RecordSection` / `ProjectedField` and
option A (schema-driven form rendering) are **out of scope here** — see "Not in this
slice" at the end.
**Feeds:** `Claude outputs/export-batch-linking-spec.md` (the front-page UI feature that
consumes this).

---

## What "build it all perfectly" means for this slice

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

## 1. Prisma schema — additions to `prisma/schema.prisma`

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

### Column notes

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

## 2. RecordLink write rules

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

## 3. API endpoints

### `GET /api/links/:linkValue`

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

### `GET /api/export-batches/:exportBatch/linked`

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

## 4. Migration path (per `INTEGRATION/04`; proven by `SubmissionDateField` / `batch_link:*`)

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

## 5. Test plan

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

## Not in this slice (deferred per `INTEGRATION/07`)

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
