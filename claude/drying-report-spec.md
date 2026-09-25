# Drying Report — Build Spec for Claude Code

**Decision resolved (2026-09-09): Option A.** Ship using only data already in the database. Do
not build a new record type for this pass. See Section "Decision needed" below, now answered.

**File to create:** `public/pages/drying-report.html`
**Pattern to follow:** `public/pages/canning-report.html` (same shell, same job-picker/refresh/CSV/print toolbar, same libs). This is a **new, separate page** — do not modify canning-report.html. Link to it from `job-status.html` the same way canning-report.html is linked (a "Report" button per job row), but only show/enable it for jobs that have drying data, OR add a second "Drying report" link column — implementer's call, keep it simple.

## Job number prefix rule (added 2026-09-11)

Job numbers carry a prefix that identifies which process they belong to:
- **Canning jobs:** prefix `3CP` or `CPR` (e.g. `CPR01156`)
- **Drying jobs:** prefix `3DP` or `DPR` (e.g. `DPR01156`)

Each report's job-number `<select>` must be **filtered to only its own job type**:
- `canning-report.html`'s job dropdown must only list jobs whose job number starts with `3CP` or `CPR` — drying jobs (`3DP`/`DPR`) must never appear there.
- `drying-report.html`'s job dropdown must only list jobs whose job number starts with `3DP` or `DPR` — canning jobs (`3CP`/`CPR`) must never appear there.

Implementation: filter the `STATUSES` list (from `window.JobStatus.list()`) by job-number prefix before populating the `<select>` in each page's `refresh()` function. Use a case-insensitive prefix check (`String(s.job_no).toUpperCase().startsWith('3CP') || ...startsWith('CPR')`) since data entry may vary in case. If a job number doesn't match either known prefix set for that report, exclude it from that report's dropdown (don't guess).

This is a required correction to `canning-report.html` as well, not just new behavior for `drying-report.html` — canning-report.html currently lists every job with no filter and must be updated to exclude drying jobs.

## Why this page looks different from Canning Report

Canning Report is organized around **cans produced** (can breakdown, harvest breakdown, processing measures). Drying Report must be organized around **dried product yield and size grading**, matching the paper form below. Do not reuse canning's section names or fields — this is a distinct report shape.

## Source data (existing records — do NOT invent new storage keys)

Pull from these existing records, matched on job number (same `abalone-receiving` job join canning-report.html already uses for header/harvest data):

1. **`abalone-receiving`** — job header + harvest rows (receiving date, whole mass, animals, weight/animal, size range, out-of-salt weight, %). Same source canning-report.html already reads for its "Harvest breakdown" table.
2. **`REC-7.4.1-drying-process`** (recordKey `drying-process`, job field `jobNumber`) — wholeWeight, cookingDate, cookingWeight, all steam dates, totalDryingTimeDays, dryWeight, estimateYield.
3. **`REC-7.4.3.1-grading-production-log-cultivated`** (recordKey likely `grading-production-log-cultivated`, job field `jobNumber`) — driedWeightReceived, actualDriedWeight, dateIntoGradingRoom, gradingDate, the full size-grade weight fields (under8g, g8to10, g11to13, g14to16, g17to20, g21to23, g24to25, g26to28, g29to31, g32to35, g36to39, g40to44, g45to50, g51to55, g56to60, g60plus), bGrade, actualGradedWeight, yield.

If a job has no drying-process or grading record yet, show the sections but leave values blank/dashed (same "No data yet from: X" warning pattern canning-report.html uses for missing records) — do not error.

## Fields that appear on the paper form but have NO existing record source (out of scope for v1)

The pasted paper form includes some fields not present in any REC record found in the codebase (Drying Code, Cost per Kg, PO no., GRN No., Delivery note no., Target Yield, Target Dried Weight, Mortalities, Live/Salted Animal Count, Cooked animal Count, Counting errors, Abalone Colour, C-grade, "Drying efficiency", per-size **piece counts** rather than just weights).

**v1 builds Option A: leave these out entirely.** Only display what the database already has (from the 3 sources above). This report ships now.

**Fast-follow (not part of this task, do not build now):** Option B — add a new lightweight record (e.g. `REC-7.4.X-drying-report-extras`) capturing exactly the paper form's non-DB fields, so the report can render 1:1 with the paper form. Revisit only if/when Michaela asks for exact paper-form parity as a separate task.

## Page layout (drying-report.html)

Same shell as canning-report.html: dark top bar with doc-code + `<h1>Drying Report</h1>`, "← Job status" link, job-no `<select>` (filtered per the prefix rule above), Refresh / Export CSV / Print buttons, status line, then a report panel. Reuse `record-theme.css` and the same CSS custom properties block canning-report.html defines (`--ink`, `--steel-dk`, `--paper`, `--line`, `--accent`, `--sans`, `--mono`) so it's visually consistent with the rest of the site, but the **content structure is different**, as follows:

### 1. Job header block
Job no., processing for, received from, receiving date — read-only, same style as canning-report's header line. (Cost per kg and PO no. are Option B fields — omit for v1.)

### 2. Yield summary (top, prominent — this is the number people check first)
Table or stat-row:
- Actual yield % (= dryWeight / wholeWeight × 100, or use REC 7.4.1's own `estimateYield` / REC 7.4.3.1's `yield` if populated)
- Actual dried weight (REC 7.4.3.1 `actualDriedWeight`, fallback `dryWeight` from 7.4.1)
- (Target yield % / target dried weight are Option B fields — omit for v1; no target-vs-actual comparison in this pass.)

### 3. Harvest breakdown (receiving) table
Same shape as canning-report.html's harvest table: Receiving date | Whole mass (kg) | Animals | Weight/animal (g) | Out-of-salt weight (kg) | % — pulled straight from `abalone-receiving`, with a TOTAL row. This part *can* be shared logic with canning-report.html (extract a helper) since the source data is identical.

### 4. Drying process timeline (new — not in canning report)
A compact table or horizontal timeline of the REC 7.4.1 dates: Cooking date → Movement to dry room 1 → Steam 1–14 (only show steams that have a date; collapse empty trailing steams) → Movement to container → Removed from trolleys → Movement to grading room → De-string → Graded. Plus Total drying time (days) and Cooking weight / Whole weight.

### 5. Size grade breakdown table (this is the section that must look different from Canning Report's can-breakdown table)
Columns: **Size range | Weight (kg)** from REC 7.4.3.1's weight-per-size fields (Under 8g, 8-10g, 11-13g, 14-16g, 17-20g, 21-23g, 24-25g, 26-28g, 29-31g, 32-35g, 36-39g, 40-44g, 45-50g, 51-55g, 56-60g, 60g+), plus a B-grade row and TOTAL row (= actualGradedWeight). (Pcs/Av.weight columns and C-grade row are Option B fields — omit for v1.)

### 6. Shell/quality summary — omitted for v1
This entire section (mortalities, live/cooked counts, counting errors, colour, drying efficiency) is Option B — no current DB source. Do not build a placeholder section for it; simply don't include it in v1.

### 7. Export CSV / Print
Mirror canning-report.html's `downloadCsv()` structure but with drying section headers (JOB HEADER, YIELD SUMMARY, HARVEST BREAKDOWN, DRYING TIMELINE, SIZE GRADE BREAKDOWN) instead of canning's (CAN BREAKDOWN, HARVEST BREAKDOWN, PROCESSING MEASURES). Filename: `drying-report-${jobNo}.csv`.

## What makes this visibly distinct from Canning Report (checklist for review)
- [ ] No "can breakdown" / drained-weight / medium / AG-code table anywhere
- [ ] Has a Drying process timeline section (steam dates) — canning report has none
- [ ] Size grade table uses the drying grading fields (g8to10 … g60plus, bGrade) not can production codes
- [ ] Yield summary is dry-weight-based (wholeWeight → dryWeight), not cans-per-100kg
- [ ] Page title says "Drying Report", doc-code area can say "DRYING" instead of "PRODUCTION"
- [ ] Job dropdown on drying-report.html shows only `3DP`/`DPR` jobs
- [ ] Job dropdown on canning-report.html shows only `3CP`/`CPR` jobs (fix required on existing file)

## Status
Ready to build. No open decisions remain — proceed straight to implementation per this spec, including the job-number-prefix filtering fix to canning-report.html.
