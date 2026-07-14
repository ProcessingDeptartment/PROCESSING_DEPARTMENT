# Batch traceability

Trace a product batch/lot forwards and backwards across every record that touched it.
The traceable identifier is the **job number** (format enforced: `3CP`, `3DP`, `CPR`, or `DPR`
followed by digits), so that's what the trace follows. The trace includes production,
quality, testing, and recall initiation records.

## One-time setup

1. In Supabase, open **SQL Editor → New query**, paste [supabase/traceability.sql](supabase/traceability.sql), **Run**.
   (Same as you did for `schema.sql` — creates the `batch_link` index table + policies.)

That's it. From then on, every save of an opted-in record writes a link row automatically.

## Batch number format

All job/batch numbers must match one of these **required formats**:
- `3CP` — Canned Product (e.g., `3CP000001`)
- `3DP` — Dried Product (e.g., `3DP000001`)
- `CPR` — Canned Product Rework (e.g., `CPR000001`)
- `DPR` — Dried Product Rework (e.g., `DPR000001`)

When filling in a `jobNumber` or batch field, the system validates the format on save
and rejects invalid entries with a helpful error message.

## How it works

- Record bodies still live in `kv_store` unchanged. `batch_link` is a thin **index**: one row
  per (job number × record × submission).
- A record participates **only** if its config declares a batch field — no guessing. This avoids
  false links from the ~40 differently-named ingredient/consumable "batch" fields (sugar, salt,
  xanthan gum, chemicals) that are *not* the product batch.
- The shared engines ([form-record.js](public/lib/form-record.js),
  [monitoring-log.js](public/lib/monitoring-log.js)) call
  `Traceability.indexSubmission()` after each save. Indexing is best-effort: if Supabase is down
  or the table is missing, the record still saves normally.
- [records/batch-trace.html](public/records/batch-trace.html) is the lookup page (linked from the
  records hub). Enter a job number → a date-ordered timeline of every touchpoint, each linking to
  the record. Deep-link with `batch-trace.html?batch=JOB123`.

## Records already opted in

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

## Adding more records

Any record with a job-number (or other batch) field can join. Two edits:

1. In the record's config object (next to `recordKey`), add:
   ```js
   batchField: 'jobNumber',   // the field key holding the product batch/lot
   stage: 'drying',           // optional label for the timeline
   // batchDateField: 'dateDried',  // optional; else the record's first date field / `date` is used
   ```
2. Load the lib — after the `data-store.js` script tag add:
   ```html
   <script src="../lib/traceability.js?v=1"></script>
   ```

Other records carrying `jobNumber` not yet wired: brine-mixing-report, dispatch-receiving-checklist,
dry-cooking, dry-export-pack-front-page, dry-monitoring, drying-process,
grading-production-log-cultivated, grading-production-log-ranched. Add them the same way when you
want them in the trace.

> Note: where `jobNumber` is a per-row roster/log column rather than one value for the whole
> submission, indexing needs a small extension (one link per row) — flag those and I'll wire them.
