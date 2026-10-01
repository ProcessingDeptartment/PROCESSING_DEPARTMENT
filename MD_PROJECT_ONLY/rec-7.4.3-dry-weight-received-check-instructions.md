# REC 7.4.3.1 and 7.4.3.2: dry weight received cannot exceed the REC 7.4.10 weight (instructions for Claude Code)

**Date:** 2026-10-01
**Raised by:** Michaela: "dry weight received cannot be higher than the weight from 7.4.10". Confirmed: the field is on the grading records (7.4.3.1 and 7.4.3.2); **hard block at Submit**.
**Scope:** a submit check on the two grading records. No change to fields, keys, calculations, DB columns, CSV or print layout. REC 7.4.10 is read, not changed. No coding was done in writing this; this file is the brief.
**Related:** `rec-7.4.3-job-prefix-scope-instructions.md` (7.4.3.1 = `DPR` jobs, 7.4.3.2 = `3DP` jobs), `rec-7.4.6-dry-stock-control-merge-job-info-instructions.md` (Weight out = sum of 7.4.10 `totalDriedWeight`), `drying-process-refinement-instructions.md` (job-level numbers, yield).

## 1. Rule

For one job:

- `T` = sum of `totalDriedWeight` (kg) over all **submitted** REC 7.4.10 (`dried-abalone-transfer`) entries for the job. Drafts are ignored.
- `R` = dry weight received on the grading record: the sum of the dry weight received field over **all submitted entries of this record for the job, plus the entry being submitted now**. (A job has one grading record type only, 7.4.3.1 for `DPR` or 7.4.3.2 for `3DP`.)

**`R` must not be greater than `T`.** Compare to 2 decimals with a tolerance setting that defaults to 0.00 kg (in the record definition, loosenable without code).

## 2. First step: identify the field (do not guess)

Before building, inspect the live 7.4.3.1 and 7.4.3.2 definitions and report back:

1. The key and label of the "dry weight received" field (likely `actualDriedWeight` or similar; the yield calculation uses it). If two fields could fit, stop and ask Michaela.
2. Whether it is typed, autofilled, or calculated from the Collection bins roster.
3. Whether a job can have more than one grading entry (then `R` is the running sum, section 1).

## 3. Behaviour

1. **Hard block at Submit only.** Drafts always save. Message, in red beside the field and in the submit toast: "Dry weight received (R kg) is more than the weight transferred on REC 7.4.10 (T kg). Correct the weight or check the 7.4.10 entries." Show both numbers, 2 decimals.
2. **Live hint while typing:** a small line under the field, "7.4.10 transferred: T kg · already received on earlier entries: E kg · left to receive: T − E kg". Turns red when `R > T`. Blank until `T` exists, never NaN or 0.
3. **No 7.4.10 entry for the job** (`T` missing): do not block (nothing to compare). Show an amber line "No REC 7.4.10 transfer found for this job, weight not checked" and record it in the work log counts. Michaela decides later whether this should also block.
4. **Server side:** the API recomputes `T` and `R` and rejects a violating submit, so an old cached page cannot bypass it.
5. **Where 7.4.10 changes later** (a transfer corrected downwards after grading): do not rewrite grading. Add the job to a view `v_dry_received_exceeds_transferred` (job, `T`, `R`, difference, record, latest submitter) so it can be reviewed.
6. Print, CSV and the read-only view unchanged. No new stored column; `T` and `R` are calculated.

## 4. Existing data (check before enforcing)

Run a read-only query and report to Michaela before turning on the server check: every job whose existing `R` is greater than `T`, and every job with grading but no 7.4.10. List them; change nothing. Old entries still open, print and export as before. The rule applies to new submits and edits only.

## 5. Test

1. Job with 7.4.10 total 800 kg: enter 800.00 received on the grading record: submits. Enter 800.01: blocked with both numbers shown. Save draft with 900: works.
2. Two grading entries on one job (500 then 400, `T` 800): second submit blocked; with 300 it submits (`R` 800).
3. Two submitted 7.4.10 entries (500 + 300): `T` is 800. A draft 7.4.10 is ignored.
4. Job with no 7.4.10: submit allowed, amber line shown.
5. Correct 7.4.10 down after grading: no change to grading; job appears in `v_dry_received_exceeds_transferred`.
6. Direct API submit with `R > T`: rejected.
7. Works on both 7.4.3.1 (`DPR` job) and 7.4.3.2 (`3DP` job). Other records unchanged.
8. Existing entry opens, prints and exports unchanged. Tablet width: hint line readable, no horizontal scroll. Bump the `?v=` script strings.

## 6. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.3-dry-weight-received-check-instructions.md` and follow it. On REC 7.4.3.1 and 7.4.3.2, the dry weight received (summed over the job's submitted grading entries plus the current one) must not be greater than the job's total `totalDriedWeight` from submitted REC 7.4.10 entries. Identify the field first and report it. Hard block at Submit only (drafts save), live hint under the field, server-side enforcement, tolerance setting default 0.00 kg, amber note and no block when the job has no 7.4.10. Run the read-only data check in section 4 first and report without changing data. Add the review view. Do not change fields, calculations, DB columns or exports. Bump the `?v=` strings, run section 5 and write a short work log.
