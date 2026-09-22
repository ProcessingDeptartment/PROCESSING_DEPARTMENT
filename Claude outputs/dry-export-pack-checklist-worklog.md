# Dry Export Pack Front Page — Attachment Checklist Rework

Session date: 2026-09-22. Spec handoff: `claude/dry-export-pack-front-page-attachment-checklist-instructions.md` (if present) — this doc is the build/testing worklog, not the original spec.

## What shipped

Replaced the manual "Attachments checklist" (5 hardcoded yes/no fields) on `Dry-Export-Pack-Front-Page-dry-export-pack-front-page.html` with a verify-gated roster of the real required dry-export records, matched automatically off the job number wherever possible.

### Engine changes (`public/lib/traceability.js`, `public/lib/form-record.js`)

- **`bin_link:` index** — new namespace parallel to `batch_link:`, resolves a physical bin code to the job number(s) whose graded stock fed it. Fed from **REC 7.4.4 (Grading, Boxing & Traceability)**, which already captures `binCode` + a free-text `jobNumbersInBin` per submission — the record staff already fill in for this purpose. `Traceability.jobsForBin(binCode)` / `Traceability.binsForJob(jobNo)`.
- **`bintrace` recordpick source** — for records keyed by bin code, not job number (e.g. `boxing-and-labelling`, whose `binCode` field is literally reused as the box code on the label). Resolves job → bin(s) → submissions.
- **Bin-code auto-suggest** — on REC 7.4.4, entering a bin code auto-fills `jobNumbersInBin` from the grading logs' Collection Bins roster (now indexed via `roster.binIdColumn`), only when the field is still empty.
- **`upload` field type** — file attach/download/remove, value stored inline as a JSON blob in the submission's own `values` (no new table or endpoint), capped at 4MB. Used for Health Certificates and Sales Packing List.
- **Verified-status recognition fix** — the server's `/api/trace` endpoint already returns a three-state `status: 'draft'|'submitted'|'verified'` (see `attachSubmissionStatus` in `src/index.js`), but the shared badge/gate logic (`recordpickBadgeHtml`, both submit-gates) only recognized `'submitted'` plus a separate `verified` flag that this path never populates. This silently broke the **existing NRCS Canning gate** too, not just this new checklist. Added `recordpickAttached()`/`recordpickVerified()` helpers used consistently everywhere.
- **Per-submission fallback picker** (`recordSubmissionOptions`) — REC 7.4.8 (Dry Labelling List) can't be auto-matched by job number (it's indexed by `agCode`, and there's no reliable sales-invoice↔job-number mapping). Its manual "search and pick" fallback was silently broken: it reused the Master Index, which lists one row per *record type*, not per submission, so it could never actually offer individual Dry Labelling List submissions to choose from. Now reads the same `formrecord:<recordKey>` data the record's own "View entries" list uses.
- **Race condition fix** — `wireRecordPick` runs async trace lookups per field and is invoked twice in quick succession (page load, then again on job-number change). A generation counter now stops a slower, stale call from overwriting a newer one's correct results after the fact. This was the cause of what looked like "intermittent" badge state during testing.

### Data changes (Neon, via `data/record-definitions.json` → `scripts/seed-definitions.mjs` → `scripts/export-record-defs.mjs`)

- `dry-export-pack-front-page`: checklist rebuilt as 6 required `recordpick` fields (REC 7.4.5, 7.4.6, 7.4.7, 7.4.8, 7.4.9, 7.4.10) + 2 `upload` fields (sales packing list, health certificates). "Signed packing lists" removed per Michaela's request — replaced with "sales packing list" as the actual document to attach.
- `grading-boxing-traceability` (REC 7.4.4): `binField`/`binJobsField` config added.
- `grading-production-log-cultivated` / `-ranched`: Collection Bins roster gets `binIdColumn: "binCode"`.
- `boxing-and-labelling` (REC 7.4.5): `batchField` set to `binCode` (was unset — record wasn't traceable at all before).
- `labelling-of-dry-boxes` (REC 7.4.7) / `dry-stock-transfers` (REC 7.4.9): had **no job or bin link field at all**. Added a `Job no.` field (same convention as the rest of the dry chain) and set `batchField: "jobNo"`.
- `dry-labelling-list` (REC 7.4.8): added a `Bin code` column to its Boxes roster.

### Page-level fix (widespread, pre-existing gap)

5 of the 6 records this checklist depends on (`REC-7.4.4`, `7.4.5`, `7.4.7`, `7.4.8`, `7.4.9`) were **missing the `traceability.js` and/or `job-status.js` script tags entirely** — so `Traceability.indexSubmission` silently never ran, and the job-number picker never populated. Added the missing tags to those 5 pages.

**This is a much wider gap than just these 5 pages**: across the whole app, 39 of 52 `monitoring-log.js` pages and 53 of 80 `form-record.js` pages are missing `traceability.js`. Only the pages in this checklist's direct dependency chain were fixed this session — **the rest is an open follow-up**, worth a dedicated audit before relying on traceability/batch-trace features elsewhere in the app.

## Verified end-to-end (real job `3DP55555`, live production)

Submitted + verified real test entries for all 6 required records against job `3DP55555` (all clearly labeled "TEST - Claude verification" in the relevant fields):
- REC 7.4.4 Grading, Boxing & Traceability — bin `TESTBIN01`, `jobNumbersInBin: 3DP55555`
- REC 7.4.5 Boxing & Labelling — bin `TESTBIN01` (resolves via bintrace)
- REC 7.4.6 Dry Stock Control
- REC 7.4.7 Labelling of Dry Boxes
- REC 7.4.9 Dry Stock Transfers
- REC 7.4.10 Dried Abalone Transfer

Confirmed via direct Neon queries (not just UI) that all 6 correctly write `batch_link`/`bin_link` index rows, and confirmed via the front page that badges correctly read "Verified" once the underlying record is verified, and "Awaiting verification" / "Not attached" otherwise. Confirmed Submit is blocked while any required row is unattached/unverified.

**Not exercised**: REC 7.4.8's manual-pick fallback (no real Dry Labelling List submission existed for this job to test against), and a genuine multi-job bin blend (only one bin/job was used in testing).

## Test data left in production

Real submitted+verified records against job `3DP55555`, all clearly labeled as test data:
- REC 7.4.4 — bin `TESTBIN01`, supervisor "TEST - Claude verification"
- REC 7.4.5 — bin `TESTBIN01`, QC/Supervisor "TEST"/"TEST"
- REC 7.4.6 — month 2026-09
- REC 7.4.7 — client "Ocean Treasure (TEST)", 38 boxes
- REC 7.4.9 — transferred/received by "TEST Transferrer"/"TEST Receiver"
- REC 7.4.10 — received/verified by "TEST Receiver"/"TEST Verifier"

Not deleted — flag for cleanup if/when convenient.

## Known open items

1. **Sales data → REC 7.4.8 / packing list**: how sales' `export-manager` folder data gets into this system as the starting point for production's Dry Labelling List / packing list entry is explicitly out of scope, per the original spec — needs a separate scoping conversation.
2. **File upload storage**: currently inline in the submission JSON (4MB cap), not dedicated blob storage. Fine for now; revisit if certs/packing lists turn out to be large or numerous.
3. **Wider `traceability.js`/`job-status.js` gap**: 39+53 pages across the app missing these script tags (see above) — only the 5 in this checklist's dependency chain were fixed.
4. **`REC-7.4.4` job dropdown**: fixed for this checklist's purposes (added `job-status.js`), but worth confirming this didn't regress anything else on that page.
5. **Bin-code multi-job union**: current design resolves one job → its bin(s) → submissions on those bins. A shipment genuinely blending stock from multiple jobs via one bin is handled (bin can list multiple jobs in `jobNumbersInBin`), but this was never tested with real multi-job data.
