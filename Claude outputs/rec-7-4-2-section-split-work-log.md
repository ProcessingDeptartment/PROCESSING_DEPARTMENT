# REC 7.4.2 Dry Monitoring: Job info section split (2026-10-01)

## Cause
Only `jobNo` had a group in the definition. The engine gives ungrouped fields the previous group, so all 25 fields sat in "Job info". Picking a job folds that section, which hid the checks.

## Changes
- `data/record-definitions.json` (via `scripts/split-dry-monitoring-sections.mjs`, idempotent) + `public/data/record-defs/dry-monitoring.json` (snapshot): sections Job info / Dry room details / Checks / Comments. Keys, labels, columns, calculations unchanged. Order inside each section kept, but sections must be contiguous, so *Trolleys clearly marked* now follows *Estimated drying date* instead of sitting between No. of trolleys and it (affects print/CSV column order for that one field).
- `monitoring-log.js` v40: new `hideInForm` field flag (hidden input, still autofilled, saved, listed and printed); Job info header summary ignores hidden fields (shows `Job <no>` only).
- `job-picker.js` v6: auto-collapse guard `foldSafe()`: if the picker's section holds any visible, editable control that is not job data, it stays open and logs a console warning naming the page.
- Script versions bumped: monitoring-log 39→40 (51 pages), form-record 65→66 (80 pages), job-picker 5→6.

## Audit: the four hidden job-data fields
| Field | Read by | Action |
|---|---|---|
| jiReceivedFrom, jiProcessingFor, intakeWeight, intakeDate | `autofill` (abalone-receiving), stored values/list/print/CSV, `sub_*` column | Kept as hidden inputs; nothing dropped or repointed |

## Test (local, snapshot definition)
- New entry: Job info shows job number only; Dry room details, Checks, Comments, Sign off visible below. No "(old)" fields. Counters 0 of 1 / 0 of 1 / 0 of 1 / 0 of 1 / 0 of 4.
- Pick job + Confirm: Job info folds to `Job DPR9999`; the other four stay open. Console: only unauthenticated 401s (no local API).
- Not tested locally (needs live data/login): autofill values, old entry with saved Date/QC/Supervisor, printing, CSV.

## Deploy
Reseed the definition: `node scripts/seed-definitions-only.mjs` (Neon), then push. Pages read `/api/record-def/dry-monitoring` live.

## Other records with the same grouping fault (not changed)
monitoring-log (non-job fields inherit the Job info group): gonad-inspection-report, scrubbing-check-supervisor, sampling-log, stock-loading, dry-stock-control, labelling-of-dry-boxes, dry-stock-transfers, live-production-pack, chiller-batch-control, dry-chiller-batch-control, seamer-inspection-report, cans-incoming-inspection, dispatch-loading-inspection-checklist, dispatch-receiving-checklist, chiller-temperature-monitoring, incubator-cans-log ("1. New entry — cans in"). Also double-seam-inspection-report and abalone-packing-specification (no groups at all, so no job-section fold issue unless a job picker is added).
form-record "Batch details" holding editable fields: production-information-nrcs, dry-nrcs-packs, traceability-mock-recall-* (4). Job info with editable extras (mostly intake date / processing for, likely intentional): ~12 more (e.g. salting-and-tumbling, dry-cooking, dried-abalone-transfer, qc-report).
With the new guard, records whose Job info holds editable non-job-data fields will stay open after job pick (console warning) instead of folding the form away.
