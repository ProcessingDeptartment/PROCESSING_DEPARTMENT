# REC 7.4.10 Dried Abalone Transfer: Crate number becomes automatic (instructions for Claude Code)

**Date:** 2026-10-01
**Raised by:** Michaela: "7.4.1 - crate number should be automatic". Clarified in chat: the record is **REC 7.4.10 Dried Abalone Transfer** (`dried-abalone-transfer`), the Crates roster. Numbering is a **running 1, 2, 3 per job**.
**Scope:** the **Crate number** column of the Crates roster on REC 7.4.10 only. No change to the Weight column, `totalDriedWeight`, `dryYield`, sign-off or any other record. No coding was done in writing this; this file is the brief.
**Related:** `drying-process-refinement-instructions.md` (the same "number runs per job, not per entry" pattern as Steam no.), `rec-7.4.6-dry-stock-control-merge-job-info-instructions.md` (reads `totalDriedWeight`, must not break), `rec-7.4.3-dry-weight-received-check-instructions.md` (reads `totalDriedWeight`), `TRACEABILITY.md`.

## 1. Current state (verify first, do not guess)

The roster has two typed columns: Crate number and Weight kg. Before building, inspect the live `dried-abalone-transfer` definition and the Neon tables behind it and report back:

1. The key, type and label of the Crate number column, and whether it is required.
2. Whether crate rows are stored as real rows (a child table) or only inside the submission JSON. If only JSON, the database step in section 5 is needed first so crate numbers can be queried.
3. How many existing 7.4.10 entries there are, and the distinct typed crate-number values (numeric, text such as "C12", duplicates, blanks).
4. Whether a job can have more than one 7.4.10 entry (7.4.6 assumes yes: "a job may have several transfers").

## 2. What is wanted

1. **Crate number is automatic and read-only.** The operator never types it. Each roster row gets the next number as soon as it is added; the operator types only the weight.
2. **Running 1, 2, 3 per job.** The number continues across all entries for the same job: if an earlier transfer ended at crate 8, the first crate of the next transfer is crate 9. Never restarts at 1 on a new entry for the same job.
3. **Unique per job, never reused.** A crate number is not given to a second physical crate of the same job, even if the first was removed from a draft.

## 3. Behaviour

1. **Pick job first.** The roster stays disabled (or shows "Pick the job number first") until the job number is confirmed, because the numbering needs the job.
2. **Start number** = highest crate number already **submitted** for the job + 1, read from the existing job lookup (`window.Traceability.trace(jobNo)` / the 7.4.10 table on `job_no`); no new lookup path. If the job has no earlier transfer, start at 1.
3. **Adding a row** (existing "+ Add crate" action) appends the next number. The Crate number cell is a plain read-only label (not an input, not focusable), so tablet users go straight to Weight.
4. **Removing a row from a draft** renumbers only the rows inside this entry so there is no gap (first crate of this entry keeps the start number). Submitted entries are never renumbered.
5. **Draft entries:** numbers shown on a draft are provisional. **The final numbers are assigned by the server at Submit**, inside one transaction, using the highest submitted number for the job at that moment, so two people (or two tablets) working on the same job cannot get the same number. If the final numbers differ from what the draft showed, the submit confirmation shows "Crates numbered 9 to 14".
6. **Submit** stores the number on each crate row. A submitted number is read-only and cannot be edited. Correcting a crate weight uses the existing correction pattern (reason and name, logged); the crate number stays.
7. **Deleting or voiding a submitted crate** (if that is ever allowed) does not free its number. The row stays with a void flag and reason; the next crate still continues after the highest number ever used.
8. **Display:** shown as "Crate 9" (or the plain number, matching today's label), the same on screen, print, view page, list and CSV. Keep the column label "Crate number".
9. **Totals unchanged:** `totalDriedWeight` is still the sum of the Weight column; `dryYield` unchanged. A crate row with a number but no weight is a draft-only state; Submit requires a weight on every crate (keep today's rule).

## 4. Hard rules and checks (Submit)

- Every submitted crate has a number; no duplicates inside the job (database constraint, section 5; the form check is only a convenience).
- Numbers are sequential from the job's start number with no gaps inside the entry.
- The server ignores any crate number sent by the client and assigns its own. A stale cached page cannot override this.

## 5. Database (plain SQL, movable to another format)

Keep every reportable value as a typed column. If the roster is currently only in JSON, add the child table first.

`dried_transfer_crate` (one row per crate):

- `id`, `entry_id`, `submission_id`, `job_no`
- **`crate_no` INT NOT NULL** (per job, assigned by the server at Submit)
- `crate_no_old` TEXT (migrated rows only: the value that was typed before this change)
- `weight_kg` NUMERIC(10,2)
- `voided` BOOL DEFAULT false, `void_reason`, `voided_by`, `voided_at`
- `created_at`

Constraints and indexes:

- **UNIQUE `(job_no, crate_no)`**, enforced in the database, so the rule holds even if the form is bypassed.
- Index on `job_no`, `entry_id`, `submission_id`.
- Assignment query (inside the submit transaction, with a lock on the job so two submits queue): `SELECT COALESCE(MAX(crate_no),0) FROM dried_transfer_crate WHERE job_no = $1` then insert N rows as max+1 … max+N. Use an advisory lock on the job number or `SELECT ... FOR UPDATE` on a per-job row; a plain max() without a lock is not safe.

View for trends (plain SQL view): `v_dry_transfer_crates_by_job` — per job: crate count, total weight, average crate weight, first and last transfer date, number of transfers. Add a comment that `totalDriedWeight` for a job is the sum of `weight_kg` over non-voided crates of submitted entries, so 7.4.6 and 7.4.3 keep reading the stored `totalDriedWeight` unchanged.

Update the checked-in `dried-abalone-transfer.json` and `scripts/export-record-defs.mjs`; never hand-edit the generated snapshot. Extend the CSV export script so `dried_transfer_crate` is exported (header row, ISO dates) as part of the "move to another format" path.

## 6. Existing entries (do not lose or change history)

One script under `scripts/`, original JSON untouched, dry run first.

- Every old crate row keeps its typed crate number in `crate_no_old` exactly as saved. Nothing is overwritten.
- Give old rows a numeric `crate_no` so the unique constraint and the "continue after highest" rule work: where the old typed value is a clean whole number and unique within the job, use it; otherwise number the job's old crates 1..N in entry date then row order and keep the typed value in `crate_no_old`. List every job where the typed numbers were not clean (duplicates, text, blanks) in the script output for Michaela. Do not guess or merge.
- Old crates show their number labelled "(old)" on view/print only when `crate_no` differs from `crate_no_old`.
- New entries on a migrated job start at the highest migrated `crate_no` + 1.
- Before/after: row counts per job, total weight per job identical, `totalDriedWeight` per entry identical.

## 7. Traceability

`batchField` stays `jobNo`, so `window.Traceability.trace(jobNo)` still returns every 7.4.10 entry for the job. Add the crate range to the trace line: "REC 7.4.10 — dd Mon — crates 9 to 14 — 126.40 kg". A crate can be referred to as job number + crate number (for example `J1234 / crate 9`), unique across the system.

## 8. Testing checklist

1. Job with no earlier 7.4.10: first row is crate 1, then 2, 3; the number cell cannot be typed in.
2. Pick the job number before the roster is usable; changing the job clears the roster or recalculates the numbers and warns.
3. Submit a transfer with crates 1 to 5. A second entry on the same job starts at 6.
4. Remove the middle row from a draft: rows renumber with no gap; a submitted entry never renumbers.
5. Two tablets submit drafts for the same job at once: no duplicate numbers; the second one gets the next range and sees "Crates numbered N to M" on the confirmation.
6. Send a crafted request with a client-chosen crate number: the server ignores it; the database rejects any duplicate `(job_no, crate_no)`.
7. `totalDriedWeight` and `dryYield` equal the values before this change for old and new entries; REC 7.4.6 Weight out and the REC 7.4.3 weight check still work.
8. Migration: counts and weights identical per job; old typed numbers in `crate_no_old`; messy jobs listed in the script output.
9. Print, view page, list and CSV show the number the same way; trace line shows the crate range.
10. CSV export of `dried_transfer_crate` opens cleanly in Excel.
11. Tablet width: the weight field is the first tap target in each new row; no console errors.

## 9. Decisions (defaults, change if wrong)

- **D1** Numbering is per job, continuing across entries (confirmed by Michaela).
- **D2** Numbers are assigned by the server at Submit; drafts show provisional numbers.
- **D3** Plain number, no job prefix on screen (confirmed by Michaela, 2026-10-01). A coded form such as `J1234-C09` can still be built later from `job_no` + `crate_no` without a data change.
- **D4** Submitted crate numbers are permanent; a voided crate keeps its number.
- **D5** Old typed numbers are kept in `crate_no_old`; only clean, unique ones carry over as `crate_no`.

## 10. Build order for Claude Code

1. Run the checks in section 1 and report back (including the distinct old crate-number values).
2. Database: `dried_transfer_crate` (if needed), constraint, view, export script, migration (dry run, compare, then run).
3. Update the record definition (read-only Crate number, server assignment) and regenerate the snapshot. **Stop for review here.**
4. Form behaviour (start number from the job, add/remove, provisional numbers, server assignment at Submit, confirmation message).
5. Trace line, print, list and CSV.
6. Run the checklist and report pass/fail per item.
