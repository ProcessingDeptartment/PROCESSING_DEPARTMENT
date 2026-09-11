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
- NRCS AG codes — independent list (a job can have more than one)
- Additional NRCS cans — a single job-level quantity, independent of the AG code list (see Bug 2 below)

Implementation:
- `job-status.js`: added `JobStatus.saveDetails(jobNo, patch)` — merges new fields into the existing `job_status:<jobNo>` storage row without disturbing status/close data.
- `job-status.html`: added a "Details" button per job row opening a modal with the fields above.

### 3. Canning Report now displays the above
- New **Job Details** section: Processed for, GRN No., PO No., Cost per Kg, Delivery note no.
- **Comments** field added to Report Summary.
- **Processing Measures** and **Efficiency Indicators** split into two panels (previously "Whole mass per can" lived awkwardly inside Processing Measures). Efficiency Indicators now shows Whole mass per can, Canning efficiency (from Job Status), and Actual yield.
- New **NRCS AG codes** table listing each AG code, plus the job's Additional NRCS cans total.
- CSV export updated to include all of the above.

### 4. Job Status Updates is now the single search/entry point
- Removed the separate job-picker dropdowns from `canning-report.html` and `drying-report.html`.
- `job-status.html`'s Reports column now shows only the relevant link per job: Canning link only for `3CP`/`CPR` jobs, Drying link only for `3DP`/`DPR` jobs (a dash otherwise).
- Both report pages now read `?job=` from the URL (as passed by the link from Job Status) and render that job directly, with a "No job specified — open from Job Status Updates" fallback if loaded without one.

### 5. Print / PDF layout
- Canning Report print styles tightened (smaller fonts, reduced padding, `@page{ size:A4; margin:10mm }`) so the current report content — Job Details, Report Summary, Can breakdown, Harvest breakdown, Processing Measures/Efficiency Indicators, NRCS AG codes — targets a single printed page.
- A `.page2-start` CSS hook (`break-before:page` in print) is in place for the future stock-code-level Can Breakdown table (see below) so that table starts cleanly on page 2 once it's built, instead of competing with page 1 for space.
- Not fully verified against a real, data-heavy job — a job with an unusually large number of harvest rows or can-breakdown rows could still overflow one page. Worth a print/PDF check against a real job (e.g. CPR002045) once device access allows it.

## Bugs found and fixed while testing (2026-09-11)

Found live while Michaela filled in job details for CPR002045 to verify the layout.

### Bug 1 — corrected: Job Details is now its own action, and IS required before closing
The first pass at this (see git history / earlier version of this doc) had the rule backwards — assumed Job Details should never block closing. Michaela corrected this same day: a job **must** have Job Details added before it can be closed, and adding them needed to be a deliberate, separate action rather than bundled into a generic "view" click.

Required-field subset confirmed by Michaela: **GRN No., PO No., Cost per Kg, Delivery note no., Comments, and at least one NRCS AG code.** Canning efficiency is deliberately excluded from the gate — it has no defined formula yet, so requiring it would block every job from ever closing until that formula exists.

Built:
- Renamed the row action from "Details" to **"Add Job Details"** — an explicit, deliberate data-entry step, not a passive view.
- Each row shows a completion indicator next to it: "✓ complete" or "incomplete".
- `hasRequiredJobDetails(row)` in `job-status.html` checks the six required fields above (using the migrated NRCS shape from Bug 2, so it works against both old and new saved data).
- **Close job is disabled** (greyed out, `title="Add Job Details before closing this job."`) on any row that doesn't pass the check — Reopen is never gated, only Close.
- Defense-in-depth: `toggleJob()` also checks `hasRequiredJobDetails` directly and shows an alert with the same message if a close is ever attempted with a stale/bypassed render (confirmed via direct test — the native `disabled` attribute blocks the click first; the JS check catches it if that's bypassed).

Confirmed: a job with no Job Details saved cannot be closed (button disabled, clear tooltip; direct-call guard also blocks it with an alert). A job with all six required fields saved closes normally.

Also carried over from the original (incorrect-framing) investigation, and still valid: `JobStatus.close()`/`reopen()` were overwriting the whole job-status row instead of merging, which would have silently wiped GRN No./PO No./etc. on every close/reopen. That fix (merge via `get(jobNo)` first, same pattern as `saveDetails`) stays in place regardless of the gating rule.

### Bug 2 — NRCS AG code and Additional NRCS cans were wrongly paired
Previously stored as `nrcsEntries: [{ agCode, additionalCans }]` — one paired row per entry, added/removed together. Per the layout spec, these are two independent data points: a job can have multiple NRCS AG codes, and Additional NRCS cans is a separate job-level quantity, not tied one-to-one to a single code.

Fixed:
- Data shape changed to two independent fields: `nrcsAgCodes` (array of strings) and `additionalNrcsCans` (single value).
- `job-status.html` modal UI split accordingly — a repeatable AG-code-only list, and one separate "Additional NRCS cans" input.
- **Migration**: existing paired data (e.g. CPR002045's `AG1`/`100`) is not dropped. A `migrateNrcsShape()` helper (duplicated identically in `job-status.html` and `canning-report.html`, since both read job-status rows independently) detects the old `nrcsEntries` shape when no new-shape data is present yet, and derives: all `agCode`s collected into the AG codes list, and all `additionalCans` values summed into the single Additional NRCS cans total. Nothing is saved back in the old shape going forward — the next Save from either page writes the new shape.

## Still blocked / open

- **Stock-code level Can Breakdown table** (Stock code | Cans | Pcs/can | N/W | D/W | Description | 213g equiv.): blocked on "Werner's stock code list" — confirmed not yet digitized anywhere. Cannot build the lookup until that list exists as a file or system Claude can read. The print layout has a `.page2-start` hook ready for it.
- **Existing latent gap, not introduced by this work**: the Can Summary table's "NRCS AG code" column reads `v.nrcsAgCode` from the `cans-produced` record (REC 7.2.7), but that field doesn't exist on that record — it's always been blank in production. NRCS AG codes are now captured at the job level instead (see above), so this per-row column stays unresolved; flagging in case it should eventually be reconciled or removed.
