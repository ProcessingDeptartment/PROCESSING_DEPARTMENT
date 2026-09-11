# Canning Report / Job Status changes — 2026-09-11

## Background

`CPR02170` in `NEW CANNING REPORTS.xlsx` was confirmed as the source-of-truth layout for the Canning Report page. Comparing it against the live `canning-report.html` surfaced six gaps, three of which (Additional NRCS cans column, stock-code Can Breakdown table, GRN/PO/cost/delivery-note/comments/canning-efficiency fields) had no existing data source anywhere in the system — same "don't invent data" issue already flagged for the Drying Report.

## What was built

### 1. Job-prefix filter on report pickers
- `canning-report.html` job list restricted to jobs starting `3CP`/`CPR`.
- Matches the existing pattern already used on `drying-report.html` (`3DP`/`DPR`).

### 2. New per-job input fields (Job Status Updates page)
Per Michaela's direction, these are captured on `job-status.html` (not on a form record), since they're per-job metadata entered while reviewing a job, not tied to a specific record submission:

- GRN No.
- PO No.
- Cost per Kg
- Delivery note no.
- Canning efficiency
- Comments
- NRCS AG codes — repeatable list of `{ AG code, Additional NRCS cans }`, since a job can have more than one AG code

Implementation:
- `job-status.js`: added `JobStatus.saveDetails(jobNo, patch)` — merges new fields into the existing `job_status:<jobNo>` storage row without disturbing status/close data.
- `job-status.html`: added a "Details" button per job row opening a modal with the fields above (add/remove rows for NRCS entries). Fixed a bug found along the way where the modal rendered open by default (a CSS rule was beating the `[hidden]` attribute).

### 3. Canning Report now displays the above
- New **Job Details** section: Processed for, GRN No., PO No., Cost per Kg, Delivery note no.
- **Comments** field added to Report Summary.
- **Processing Measures** and **Efficiency Indicators** split into two panels (previously "Whole mass per can" lived awkwardly inside Processing Measures). Efficiency Indicators now shows Whole mass per can, Canning efficiency (from Job Status), and Actual yield.
- New **NRCS AG codes** table listing each AG code + its additional cans count.
- CSV export updated to include all of the above.

### 4. Job Status Updates is now the single search/entry point
- Removed the separate job-picker dropdowns from `canning-report.html` and `drying-report.html`.
- `job-status.html`'s Reports column now shows only the relevant link per job: Canning link only for `3CP`/`CPR` jobs, Drying link only for `3DP`/`DPR` jobs (a dash otherwise).
- Both report pages now read `?job=` from the URL (as passed by the link from Job Status) and render that job directly, with a "No job specified — open from Job Status Updates" fallback if loaded without one.

## Still blocked / open

- **Stock-code level Can Breakdown table** (Stock code | Cans | Pcs/can | N/W | D/W | Description | 213g equiv.): blocked on "Werner's stock code list" — confirmed not yet digitized anywhere. Cannot build the lookup until that list exists as a file or system Claude can read.
- **Existing latent gap, not introduced by this work**: the Can Summary table's "NRCS AG code" column reads `v.nrcsAgCode` from the `cans-produced` record (REC 7.2.7), but that field doesn't exist on that record — it's always been blank in production. NRCS AG codes are now captured at the job level instead (see above), so this per-row column stays unresolved; flagging in case it should eventually be reconciled or removed.
