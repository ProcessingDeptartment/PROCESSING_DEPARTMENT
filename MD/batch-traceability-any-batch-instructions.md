# Batch traceability — any batch number

Trace any batch or lot **forwards and backwards** across every record that touched it: product
batches (job numbers), ingredient/consumable lots (salt, sugar, vinegar, malt…), and bin codes.
All three are looked up on `records/batch-trace.html` (deep link `?batch=<value>`).

## How it is indexed

Every save of an opted-in record calls `Traceability.indexSubmission(config, sub)` (best-effort; the
record saves regardless). One `batch_link:<batch>:<recordKey>:<submissionId>` row is written per
declared batch, each carrying `rel` — its relationship to the record's primary job batch:

| `rel` | Meaning |
|-------|---------|
| `self` | the record's own job/batch (`batchField`) |
| `input` | consumed into the job (ingredient lot, receiving lot, sub-batch) — **default for extras** |
| `output` | produced from the job (rework/split job number) |

Bin codes are a separate `bin_link:` namespace (a bin code is not a job number).

## Declaring batches in a record definition

| Config | Where | Effect |
|--------|-------|--------|
| `batchField: 'jobNo'` | top level | primary batch, `rel: self` |
| `extraBatchFields: ['saltBatchNo', …]` | top level | one link per field, `rel: input`. Entries may be `{ field, rel }`. |
| `roster.batchIdColumn` (+ `batchIdRel`) | roster | one link per row for a sub-batch column |
| `roster.extraBatchColumns: ['saltBatchNumber', …]` | roster | **per-row ingredient lots**; several columns per row allowed. Entries may be `{ column, rel }`. |
| `roster.binIdColumn` | roster | `bin_link` per row (grading bins also expand `boxList`) |
| `binField` + `binJobsField` | top level | bin code plus free-text job list (REC 7.4.4) |

Where the definition lives: `data/record-definitions.json` → `extraBatchFields` on the definition (and
`linkField`/`linkRelation` on the field); `extraBatchColumns` goes in the roster section's `extraJson`.
After changing it: `node scripts/seed-one-definition.mjs <key>`, then export/snapshot
(`node scripts/export-record-defs.mjs`), commit `public/data/record-defs/<key>.json`.

## Batch formats

Product batches are validated (`3CP`, `3DP`, `CPR`, `DPR` + digits). Ingredient lots are free-form and
matched exactly as typed (trimmed).

## `Traceability` API

```js
Traceability.indexSubmission(config, sub)  // engines call this on save
Traceability.trace(batch)                  // rows touching a batch, date ascending (local + server merge)
Traceability.traceMulti([batches])         // trace() for each, merged, de-duplicated, date-sorted
Traceability.traceGraph(batch)             // { records, inputs, outputs } one-up/one-down genealogy
Traceability.jobsForBin(binCode)           // bin_link rows (job_no) for a bin
Traceability.binsForJob(jobNo)             // reverse: bins a job fed
Traceability.knownBatches()                // recent batch list for the search box
```

## Records wired

Product batch (`batchField`): precooking, retorting, cans produced, QC report, dried abalone transfer,
the four mock-recall records, and most job-scoped forms.

Ingredient lots (`extraBatchFields` / `extraBatchColumns`):

| Record | Fields |
|--------|--------|
| Bleeding and Salting (7.1.3.1) | `saltBatchCode`, `bakingSodaBatchCode` |
| Ingredient weighing | per its definition |
| Sauce mixing | per its definition |
| Brine Mixing Report (7.3.6) | `saltBatchNo`, `sugarBatchNo`, `maltBatchNo` |
| Precooking Check Sheet (7.2.3) | `sugarBatchCode` |
| Dry Cooking (7.4.0), roster | `blanchBatchNumber`, `saltBatchNumber`, `sugarBatchNumber`, `vinegarBatchNumber` |

Still to wire: Dry Monitoring (7.4.2) if it captures a salt lot, and any other record with a
`…BatchCode` / `…BatchNo` field (grep the record-defs).
