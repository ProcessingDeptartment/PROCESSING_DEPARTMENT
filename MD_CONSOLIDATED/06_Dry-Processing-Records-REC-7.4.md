# Dry Processing Records (REC 7.4.x) and Dry Export Pack

Dry cooking, drying process, dry monitoring, grading/collection bins, dry export pack and drying report.

_Consolidated from 16 original files. Cross-references inside the text to old file names refer to the original files; see `00_INDEX.md` for where each one now lives._

## Contents

1. [Drying Report — Build Spec for Claude Code](#drying-report--build-spec-for-claude-code) — `claude/drying-report-spec.md`
2. [REC 7.4.0 Dry Cooking — "Blanching or Cooking" selector](#rec-740-dry-cooking--blanching-or-cooking-selector) — `Claude outputs/dry-cooking-blanching-or-cooking-selector-instructions.md`
3. [REC 7.4.0 Dry Cooking — Blanching weight rule, cooking vs blanching, "available to cook"](#rec-740-dry-cooking--blanching-weight-rule-cooking-vs-blanching-available-to-cook) — `Claude outputs/rec-7.4.0-blanching-cooking-weight-rules-instructions.md`
4. [REC 7.4.1 Drying Process — Refinement (one job, many daily entries: movements, trolleys, steaming)](#rec-741-drying-process--refinement-one-job-many-daily-entries-movements-trolleys-steaming) — `Claude outputs/drying-process-refinement-instructions.md`
5. [REC 7.4.1 Drying Process — As Built](#rec-741-drying-process--as-built) — `claude/rec-7-4-1-drying-process-as-built.md`
6. [REC 7.4.1 Drying Process: rename "Job so far", remove the Steams section](#rec-741-drying-process-rename-job-so-far-remove-the-steams-section) — `rec-7.4.1-progress-of-product-rename-and-steam-section-removal-instructions.md`
7. [REC 7.4.2 Dry Monitoring: field changes (build summary)](#rec-742-dry-monitoring-field-changes-build-summary) — `Claude outputs/rec-7-4-2-dry-monitoring-changes-summary.md`
8. [REC 7.4.2 Dry Monitoring: Job info section split (2026-10-01)](#rec-742-dry-monitoring-job-info-section-split-2026-10-01) — `Claude outputs/rec-7-4-2-section-split-work-log.md`
9. [REC 7.4.2 Dry Monitoring: Job info section has taken over, and the whole form collapses (instructions for Claude Code)](#rec-742-dry-monitoring-job-info-section-has-taken-over-and-the-whole-form-collapses-instructions-for-claude-code) — `rec-7.4.2-job-info-section-split-instructions.md`
10. [REC 7.4.3.1 / 7.4.3.2 — Grading Production Log: Collection bins](#rec-7431--7432--grading-production-log-collection-bins) — `docs/REC-7.4.3-collection-bins.md`
11. [REC 7.4.3.1 and 7.4.3.2: Totals section starts collapsed (instructions for Claude Code)](#rec-7431-and-7432-totals-section-starts-collapsed-instructions-for-claude-code) — `rec-7.4.3-totals-section-start-collapsed-instructions.md`
12. [REC 7.4.4 Grading, Boxing & Traceability: replace the input form with a report (instructions for Claude Code)](#rec-744-grading-boxing--traceability-replace-the-input-form-with-a-report-instructions-for-claude-code) — `rec-7.4.4-replace-form-with-report-instructions.md`
13. [Give every monitoring log the same COMPLETED BY block](#give-every-monitoring-log-the-same-completed-by-block) — `Claude outputs/monitoring-logs-completed-by-block-instructions.md`
14. [Dry Export Pack Front Page — auto-populated Attachment Checklist (instructions for Claude Code)](#dry-export-pack-front-page--auto-populated-attachment-checklist-instructions-for-claude-code) — `claude/dry-export-pack-attachment-checklist-instructions.md`
15. [Dry Export Pack Front Page — Attachment Checklist Rework](#dry-export-pack-front-page--attachment-checklist-rework) — `Claude outputs/dry-export-pack-checklist-worklog.md`
16. [Dry Export Pack Front Page — rebuild from the paper form (instructions for Claude Code)](#dry-export-pack-front-page--rebuild-from-the-paper-form-instructions-for-claude-code) — `Claude outputs/dry-export-pack-front-page-rebuild-instructions.md`

---

## Drying Report — Build Spec for Claude Code

> **Source:** `claude/drying-report-spec.md`

**Decision resolved (2026-09-09): Option A.** Ship using only data already in the database. Do
not build a new record type for this pass. See Section "Decision needed" below, now answered.

**File to create:** `public/pages/drying-report.html`
**Pattern to follow:** `public/pages/canning-report.html` (same shell, same job-picker/refresh/CSV/print toolbar, same libs). This is a **new, separate page** — do not modify canning-report.html. Link to it from `job-status.html` the same way canning-report.html is linked (a "Report" button per job row), but only show/enable it for jobs that have drying data, OR add a second "Drying report" link column — implementer's call, keep it simple.

### Job number prefix rule (added 2026-09-11)

Job numbers carry a prefix that identifies which process they belong to:
- **Canning jobs:** prefix `3CP` or `CPR` (e.g. `CPR01156`)
- **Drying jobs:** prefix `3DP` or `DPR` (e.g. `DPR01156`)

Each report's job-number `<select>` must be **filtered to only its own job type**:
- `canning-report.html`'s job dropdown must only list jobs whose job number starts with `3CP` or `CPR` — drying jobs (`3DP`/`DPR`) must never appear there.
- `drying-report.html`'s job dropdown must only list jobs whose job number starts with `3DP` or `DPR` — canning jobs (`3CP`/`CPR`) must never appear there.

Implementation: filter the `STATUSES` list (from `window.JobStatus.list()`) by job-number prefix before populating the `<select>` in each page's `refresh()` function. Use a case-insensitive prefix check (`String(s.job_no).toUpperCase().startsWith('3CP') || ...startsWith('CPR')`) since data entry may vary in case. If a job number doesn't match either known prefix set for that report, exclude it from that report's dropdown (don't guess).

This is a required correction to `canning-report.html` as well, not just new behavior for `drying-report.html` — canning-report.html currently lists every job with no filter and must be updated to exclude drying jobs.

### Why this page looks different from Canning Report

Canning Report is organized around **cans produced** (can breakdown, harvest breakdown, processing measures). Drying Report must be organized around **dried product yield and size grading**, matching the paper form below. Do not reuse canning's section names or fields — this is a distinct report shape.

### Source data (existing records — do NOT invent new storage keys)

Pull from these existing records, matched on job number (same `abalone-receiving` job join canning-report.html already uses for header/harvest data):

1. **`abalone-receiving`** — job header + harvest rows (receiving date, whole mass, animals, weight/animal, size range, out-of-salt weight, %). Same source canning-report.html already reads for its "Harvest breakdown" table.
2. **`REC-7.4.1-drying-process`** (recordKey `drying-process`, job field `jobNumber`) — wholeWeight, cookingDate, cookingWeight, all steam dates, totalDryingTimeDays, dryWeight, estimateYield.
3. **`REC-7.4.3.1-grading-production-log-cultivated`** (recordKey likely `grading-production-log-cultivated`, job field `jobNumber`) — driedWeightReceived, actualDriedWeight, dateIntoGradingRoom, gradingDate, the full size-grade weight fields (under8g, g8to10, g11to13, g14to16, g17to20, g21to23, g24to25, g26to28, g29to31, g32to35, g36to39, g40to44, g45to50, g51to55, g56to60, g60plus), bGrade, actualGradedWeight, yield.

If a job has no drying-process or grading record yet, show the sections but leave values blank/dashed (same "No data yet from: X" warning pattern canning-report.html uses for missing records) — do not error.

### Fields that appear on the paper form but have NO existing record source (out of scope for v1)

The pasted paper form includes some fields not present in any REC record found in the codebase (Drying Code, Cost per Kg, PO no., GRN No., Delivery note no., Target Yield, Target Dried Weight, Mortalities, Live/Salted Animal Count, Cooked animal Count, Counting errors, Abalone Colour, C-grade, "Drying efficiency", per-size **piece counts** rather than just weights).

**v1 builds Option A: leave these out entirely.** Only display what the database already has (from the 3 sources above). This report ships now.

**Fast-follow (not part of this task, do not build now):** Option B — add a new lightweight record (e.g. `REC-7.4.X-drying-report-extras`) capturing exactly the paper form's non-DB fields, so the report can render 1:1 with the paper form. Revisit only if/when Michaela asks for exact paper-form parity as a separate task.

### Page layout (drying-report.html)

Same shell as canning-report.html: dark top bar with doc-code + `<h1>Drying Report</h1>`, "← Job status" link, job-no `<select>` (filtered per the prefix rule above), Refresh / Export CSV / Print buttons, status line, then a report panel. Reuse `record-theme.css` and the same CSS custom properties block canning-report.html defines (`--ink`, `--steel-dk`, `--paper`, `--line`, `--accent`, `--sans`, `--mono`) so it's visually consistent with the rest of the site, but the **content structure is different**, as follows:

#### 1. Job header block
Job no., processing for, received from, receiving date — read-only, same style as canning-report's header line. (Cost per kg and PO no. are Option B fields — omit for v1.)

#### 2. Yield summary (top, prominent — this is the number people check first)
Table or stat-row:
- Actual yield % (= dryWeight / wholeWeight × 100, or use REC 7.4.1's own `estimateYield` / REC 7.4.3.1's `yield` if populated)
- Actual dried weight (REC 7.4.3.1 `actualDriedWeight`, fallback `dryWeight` from 7.4.1)
- (Target yield % / target dried weight are Option B fields — omit for v1; no target-vs-actual comparison in this pass.)

#### 3. Harvest breakdown (receiving) table
Same shape as canning-report.html's harvest table: Receiving date | Whole mass (kg) | Animals | Weight/animal (g) | Out-of-salt weight (kg) | % — pulled straight from `abalone-receiving`, with a TOTAL row. This part *can* be shared logic with canning-report.html (extract a helper) since the source data is identical.

#### 4. Drying process timeline (new — not in canning report)
A compact table or horizontal timeline of the REC 7.4.1 dates: Cooking date → Movement to dry room 1 → Steam 1–14 (only show steams that have a date; collapse empty trailing steams) → Movement to container → Removed from trolleys → Movement to grading room → De-string → Graded. Plus Total drying time (days) and Cooking weight / Whole weight.

#### 5. Size grade breakdown table (this is the section that must look different from Canning Report's can-breakdown table)
Columns: **Size range | Weight (kg)** from REC 7.4.3.1's weight-per-size fields (Under 8g, 8-10g, 11-13g, 14-16g, 17-20g, 21-23g, 24-25g, 26-28g, 29-31g, 32-35g, 36-39g, 40-44g, 45-50g, 51-55g, 56-60g, 60g+), plus a B-grade row and TOTAL row (= actualGradedWeight). (Pcs/Av.weight columns and C-grade row are Option B fields — omit for v1.)

#### 6. Shell/quality summary — omitted for v1
This entire section (mortalities, live/cooked counts, counting errors, colour, drying efficiency) is Option B — no current DB source. Do not build a placeholder section for it; simply don't include it in v1.

#### 7. Export CSV / Print
Mirror canning-report.html's `downloadCsv()` structure but with drying section headers (JOB HEADER, YIELD SUMMARY, HARVEST BREAKDOWN, DRYING TIMELINE, SIZE GRADE BREAKDOWN) instead of canning's (CAN BREAKDOWN, HARVEST BREAKDOWN, PROCESSING MEASURES). Filename: `drying-report-${jobNo}.csv`.

### What makes this visibly distinct from Canning Report (checklist for review)
- [ ] No "can breakdown" / drained-weight / medium / AG-code table anywhere
- [ ] Has a Drying process timeline section (steam dates) — canning report has none
- [ ] Size grade table uses the drying grading fields (g8to10 … g60plus, bGrade) not can production codes
- [ ] Yield summary is dry-weight-based (wholeWeight → dryWeight), not cans-per-100kg
- [ ] Page title says "Drying Report", doc-code area can say "DRYING" instead of "PRODUCTION"
- [ ] Job dropdown on drying-report.html shows only `3DP`/`DPR` jobs
- [ ] Job dropdown on canning-report.html shows only `3CP`/`CPR` jobs (fix required on existing file)

### Status
Ready to build. No open decisions remain — proceed straight to implementation per this spec, including the job-number-prefix filtering fix to canning-report.html.

---

## REC 7.4.0 Dry Cooking — "Blanching or Cooking" selector

> **Source:** `Claude outputs/dry-cooking-blanching-or-cooking-selector-instructions.md`

Status: instructions only, no code written. For Claude Code (or Claude Design for the layout part).
Date: 2026-09-29

### 1. What is changing

Add one selector to REC 7.4.0 (record key `dry-cooking`) so the operator states whether this
entry is a **Blanching** run or a **Cooking** run.

### 2. The field

Add near the top of the entry section, directly after the job number / date, before any weights or times:

```js
{ key: 'processType', label: 'Process', type: 'select', required: true,
  options: ['Blanching', 'Cooking'] }
```

- Required for finalize. Draft saves are never blocked.
- Type is a single-choice select (two large tap targets / radio buttons are better than a dropdown on the tablet; follow whatever `mobile-tablet-font-responsiveness.md` recommends).
- No default: the operator must choose, so it can never silently record the wrong process.
- Store the value as plain text `Blanching` or `Cooking` (exact spelling, so it can be grouped and filtered in the database).

### 3. What the selector should drive (confirm before building)

I have not seen the current field list of REC 7.4.0, so these are assumptions to verify against the live page:

1. **Labels.** Any label that says "cooking" (cooking time, cooking temperature, cooking weight, "Total cooking time") should read "Blanching …" when Blanching is selected. Underlying field keys do NOT change, so existing data and REC 7.4.1's link to the cooking date/weight keep working.
2. **Fields that apply to only one process.** If some fields belong to only one process, show/hide them by selector value. Hidden fields are not required and are saved empty.
3. **Targets / limits.** If blanching and cooking have different time or temperature targets, set them per process (in the definition, not hard-coded).
4. **Title on print/PDF.** Print the chosen process on the sheet header so the paper copy shows it.

### 4. Database and traceability

- Add one column on the dry-cooking submission data: `process_type` (TEXT, values `Blanching` / `Cooking`, indexed). Keep it as a real column, not only inside `rawJson`, so trends can be queried directly (e.g. yield by process, weight by process per month).
- Old entries have no value. Do not guess. Show them as "Not recorded", and let the operator set it if they reopen an old draft.
- Trace view (`window.Traceability.trace(jobNo)`): show the process next to the REC 7.4.0 entry (e.g. "Dry Cooking — Blanching").
- Business rule vs REC 7.1.5 OOSW (`capAgainstOtherRecord`) stays as is. Open point: should blanching and cooking weights add together toward the OOSW cap for the job? Default assumption: yes, both draw from the same OOSW total. Do not change the rule unless told.
- Export/migration: `process_type` is one plain text column, so it moves to any other format without conversion.

### 5. Downstream checks

- REC 7.4.1 Drying Process reads cooking date and cooking weight from 7.4.0. Confirm it still picks up blanching runs (same field keys, so it should).
- REC 8.1.7 mock recall and the drying report: decide whether they should display the process type. Not required for v1.

### 6. Do not touch

Other records, the OOSW rule parameters, and the field keys of existing 7.4.0 fields. Bump the `form-record.js` version query string only if the shared library is changed (it should not need to be).

### 7. Testing checklist

1. New entry: selector empty; Finalize is refused until chosen; Draft saves fine.
2. Pick Blanching: labels and visible fields switch as agreed in section 3; pick Cooking: they switch back with no data lost.
3. Submit, reopen, print: process shown correctly on screen and on the PDF.
4. Database: `process_type` populated on the new row; old rows show "Not recorded".
5. Trace a job with a 7.4.0 entry: process appears; REC 7.4.1 still links.
6. OOSW cap warning still fires correctly.
7. Tablet width: selector is easy to tap and does not overflow.

### 8. Open questions for Michaela

1. Are blanching and cooking done on the same batch (both steps, one after the other), or is each batch one or the other? If both can happen on one job, the record may need the selector per batch row rather than once per entry.
2. Which existing fields, if any, apply to only one process?
3. Do they have different time/temperature targets?
4. Should blanching weight count toward the OOSW cap the same way as cooking?
5. Should old entries be backfilled as "Cooking"?

---

## REC 7.4.0 Dry Cooking — Blanching weight rule, cooking vs blanching, "available to cook"

> **Source:** `Claude outputs/rec-7.4.0-blanching-cooking-weight-rules-instructions.md`

Status: instructions only, no code written. For Claude Code.
Date: 2026-10-01. Builds on `dry-cooking-pots-roster-instructions.md` (pot cards) and `repo/business-rules.md`.

### 1. What is changing, in one paragraph

Blanching is the first stage, so it must obey the same OOSW weight rule that Cooking already obeys. On top of that, you can never cook more than you have blanched, so the job's total blanching kg must always be equal to or higher than its total cooking kg. The operator must always be able to see how much is still available to blanch and how much is still available to cook, so they do not find out only when Finalize is refused.

### 2. The three weight rules (all per job, across every entry for that job)

Definitions, for one job number:

- `OOSW` = total weight on REC 7.1.5 (OOSW) for the job (already used by the existing rule).
- `B` = total `abaloneKg` of all **Blanching** cards (all submitted entries for the job, plus the entry being edited now).
- `C` = total `abaloneKg` of all **Cooking** cards (same scope).

| # | Rule | Message (shown on override, on the record and on print) |
|---|---|---|
| R1 | `C` must not exceed `OOSW` (exists today; keep as is) | "Cooking pot weight exceeding OOSW - possible batch mix" |
| R2 | `B` must not exceed `OOSW` (**NEW**, same rule applied to Blanching) | "Blanching pot weight exceeding OOSW - possible batch mix" |
| R3 | `C` must not exceed `B` (**NEW**: blanching weight must be higher than or equal to cooking weight) | "Cooking weight exceeds blanched weight - cooked more than was blanched" |

Because blanching comes first, R2 is the one that normally triggers. R3 is the guard that you cannot cook what was never blanched. If `C <= B <= OOSW`, R1 can never fire; keep it anyway, it costs nothing and protects entries with no blanching card.

All three keep the existing behaviour: soft gate at Finalize, confirm dialog to override, stamped on the record, red warning line on screen and on print. Drafts are never blocked. Each rule that was overridden adds its own message line (so two broken rules show two red lines, not one). Keep `oosWarningAck` / `oosWarningNote` working for old records; add the new messages into the same note field, one per line.

Order does not matter: totals are compared as whole numbers per job, so a Cooking card added above a Blanching card, or on a later entry, is judged the same way.

### 3. Available weight must be visible

Two numbers, shown live as the operator types, always visible without opening anything:

- **Available to blanch (kg)** = `OOSW − B`
- **Available to cook (kg)** = `B − C`  (the stock that has been blanched but not yet cooked)

Where to show them:

1. **Under the pots area** (the existing grey on-screen tally): add `OOSW`, `Available to blanch`, `Available to cook` next to "pots / blanching kg / cooking kg". Updates on every keystroke.
2. **On each card**, a small line under the weight field: Blanching card shows "Available to blanch: X kg", Cooking card shows "Available to cook: X kg". The figure is calculated **including the card being typed**, so it goes down as the operator enters kg.
3. **Turns red with a minus sign** when negative (for example "Available to cook: -20 kg") so the problem is obvious before Finalize.
4. If the job number is not filled in yet, or REC 7.1.5 has no OOSW for the job, show "OOSW not found" and skip R1 and R2 (R3 still works). Do not show a fake zero.
5. Screen only. **Do not print these figures** (same rule as the tally line: the PDF shows pot cards only; the red override warning lines do print).

Carry-forward tweak (section 2c of the pots instructions): when a Cooking card is added after a Blanching card, pre-fill `abaloneKg` with the blanching card's kg **but not more than Available to cook**; still editable.

### 4. How it is built (kept small)

Both new rules reuse the data already planned for the pots roster. No new rule engine.

1. **R1 and R2 are the same rule type** (`capAgainstOtherRecord` with `ownRowFilter`). R1 filters `process = Cooking`, R2 filters `process = Blanching`. Add one object to `public/data/business-rules.json` for R2 with its own message.
2. **R3 needs one small new type**, for example `capRowsAgainstRows`: "the total of this record's rows matching filter A, across all entries for the job, must not exceed the total of rows matching filter B". Parameters: `ownJobField`, `column`, `capFilter` (`process = Blanching`), `rowFilter` (`process = Cooking`), `message`. Document it in `business-rules.md` with R3 as the worked example.
3. **Server lookup:** extend the job lookup (`/api/lookup/...`) to return per-process totals of `abaloneKg` for the job from the submitted entries (exclude the entry being edited via `excludeId`, as today). With the `dry_cooking_pot` child table this is one grouped query by `job_no` and `process`. The form adds the current entry's own cards on top, live.
4. **Live display** uses the same numbers: fetch the job's OOSW and the other entries' totals once when the job number is set, then recompute locally as the operator types. Do not call the server on every keystroke.
5. Only **submitted** entries count for "other entries". Drafts of other entries are ignored (same as the existing rule).
6. Do not hand-edit the generated record-def snapshots; use the export script.

### 5. Database

No new columns on `dry_cooking_pot` (it already has `job_no`, `process`, `abalone_kg`, `record_date`, `submission_id`, `pot_no`).

Add one **read-only view** so the numbers behind the rules are always one query away and easy to chart:

`v_dry_job_weights` — one row per job: `job_no`, `oosw_kg`, `blanched_kg`, `cooked_kg`, `available_to_blanch_kg` (`oosw_kg - blanched_kg`), `available_to_cook_kg` (`blanched_kg - cooked_kg`), `last_record_date`. Built from `dry_cooking_pot` (submitted entries only) joined to the OOSW roster total. It must be a plain SQL view (no vendor features) so it moves to any other database unchanged. Trends such as blanched vs cooked per month, jobs with stock left uncooked, or jobs where a rule was overridden are simple queries on it.

Traceability: also add to the parent entry a list of which rules were overridden (R1, R2, R3) as plain text or a small child table `dry_weight_override` (`submission_id`, `job_no`, `rule`, `message`, `created_at`), so "which jobs ever went over, and who signed off" can be queried without parsing text. The full submission JSON stays as the audit copy.

### 6. Existing entries (do not change history)

- Migrated old entries became a Blanching card and a Cooking card with the **same kg**, so `B = C` for them and R3 does not fire. Nothing to fix.
- Old entries that had no blanching values got a Cooking card only. Those would look like `C > B`. Mark those migrated Cooking cards `legacy_no_blanching = true` and **leave them out of R3 and out of "Available to cook"** (they still count for R1). Do not invent blanching weight.
- Rules only run when a new entry is finalized. Old entries are never re-judged and their stored warnings stay as they are.
- Check with a before/after script: per job, `B`, `C` and OOSW before and after the change must match.

### 7. Testing checklist

1. Job with OOSW 500 kg: Blanching 300 kg shows "Available to blanch: 200 kg"; add Blanching 250 kg and it shows -50 in red; Finalize asks for confirm (R2); decline aborts, OK stamps the red line.
2. Blanching 300 kg, Cooking 200 kg: "Available to cook: 100 kg"; type Cooking 350: shows -50 in red; Finalize asks for confirm (R3).
3. Cooking only, no Blanching card: R3 fires (cooked more than blanched); Draft still saves.
4. Same pot blanched then cooked, 100 kg each: B = 100, C = 100, available to cook 0, no warning. R1 counts the cooked 100 once.
5. Second entry on the same job: earlier blanching and cooking totals are included in both the live figures and the rules; editing a submitted entry does not count it twice (`excludeId`).
6. Card order: Cooking card above Blanching card gives the same result as the reverse.
7. No job number yet, or no OOSW record: shows "OOSW not found", R1 and R2 skipped, R3 still works.
8. Override both R2 and R3: two red lines on screen and on the printed sheet; no tally or "Available" figures on the PDF.
9. Carry-forward: Cooking card after a Blanching card pre-fills kg, never more than Available to cook.
10. Old entries: job totals unchanged before and after; cooking-only legacy cards are excluded from R3 and from Available to cook.
11. Database: `v_dry_job_weights` matches the form's numbers for three sample jobs; override rows exist for overridden jobs.
12. Tablet width: the "Available" line is readable and does not push the weight field out of view; other records with rosters behave exactly as before.

### 8. Decisions taken (defaults, change if wrong)

1. "Blanching weight must be higher than cooking weight" means **equal or higher, as job totals** (a pot blanched and cooked at the same kg is correct, so equal must pass). It is not compared pot by pot.
2. "Available to cook" = blanched kg minus cooked kg for the job. "Available to blanch" = OOSW kg minus blanched kg. Both are shown.
3. All three rules are soft gates (confirm to override), like the existing OOSW rule, not hard blocks. Say if blanching-vs-cooking (R3) should be a hard block instead.
4. Legacy cooking-only cards are excluded from R3 (section 6).
5. The "Available" figures are screen-only helpers and do not print.

### 9. Build order for Claude Code

1. Add the `ownRowFilter` rule for Blanching (R2) and confirm R1 still passes its checklist.
2. Add the `capRowsAgainstRows` type (R3), update `business-rules.json` and `business-rules.md`.
3. Extend the job lookup to return per-process totals; add the `legacy_no_blanching` flag in the migration script.
4. Add the live "Available" lines (tally and per card) and the carry-forward cap.
5. Create `v_dry_job_weights` and the override table; update the trace view if it lists weights.
6. Run the section 7 checklist.

---

## REC 7.4.1 Drying Process — Refinement (one job, many daily entries: movements, trolleys, steaming)

> **Source:** `Claude outputs/drying-process-refinement-instructions.md`

Status: instructions only, no code written. For Claude Code (layout part can go to Claude Design).
Date: 2026-09-29. Based on the current definition `public/data/record-defs/drying-process.json` (recordKey `drying-process`, batchField `jobNo`).
Companion docs: `claude/dry-cooking-pots-roster-instructions.md` (7.4.0), `claude/drying-report-spec.md` (report that reads 7.4.1), `claude/consolidated-plan.md`.

### 1. How the form is used (this drives the whole design)

The operator logs in, picks the **job number**, adds **what they are busy with that day**, and submits. They do the same again on the following days. **Every submission is one entry, and all entries for a job number add up to the drying history of that job.** A drying job typically runs for weeks, so one job will have many entries.

So REC 7.4.1 is an **entry log per job**, not one big record per job (the same idea as REC 7.4.0, where a job has several entries). Consequences that run through this document:

- One submission = one **entry** (one day or one shift of work on the job). The job number is the thread that joins the entries.
- Each entry holds only what happened in that entry: which movement(s) took place, the steam(s) done, the trolley count as at that time.
- **Everything already recorded for the job is shown on screen** when the operator picks the job (history panel, 4.1), so they can see the last steam, where the job is now, and what is still to do.
- **Job-level facts** (date into dry room, steam count so far, current stage, drying days, yield) are **not typed**; they are worked out from the entries, in database views.

### 2. What is on the form (per entry)

Top to bottom:

**A. Job info** (unchanged): Job number (`jobNo`, jobsearch, required, route Dried), Receiving date, Received from (farm), Processing for, Whole weight (kg, read-only, from receiving). Autofill from `abalone-receiving` stays exactly as today.

**B. Entry date**: `entryDate`, **read-only, stamped automatically** with the actual date and time the entry is submitted, plus the logged-in user. It cannot be typed or back-dated (D16).

**C. Job so far** (read-only, see 4.1): stage strip, steams so far, last steam, earlier entries.

**D. Cooked weight and trolleys**
- **Cooked weight (kg)**: read-only, pulled from REC 7.4.0 (2.3). Job-level, the same on every entry.
- **No. of trolleys** (`noOfTrolleys`, whole number). Prefilled from the latest earlier entry's count for this job, editable. If the operator changes it, the form shows "Changed from 20 to 18" and asks for a short reason (soft, section 6). A vital field, shown large, with the loading guide (2.2).

**E. Movements** (three fields, in this order):
1. **Move into drying rooms**
2. **Move into dry container**
3. **Move into grading room**

Each movement field has **two states**, decided by the job's earlier entries:

- **Open (a question):** no earlier entry has answered Yes to it. It is shown as a Yes / No question, e.g. "Move into drying rooms?". Nothing pre-selected, no third option (same pattern as the sea-water tick on 7.4.0). **Yes** shows a **read-only date stamp** ("Will be stamped dd Mon yyyy hh:mm on submit"); the operator cannot type or change it. **No** means "did not happen in this entry" and it stays a question on the next entry.
- **Done (a read-only field):** an earlier entry already answered Yes. It is **no longer a question**. It becomes a read-only line, e.g. "Moved into drying rooms: 12 Sep 2026 (entry of 12 Sep, J. Smith)". It cannot be changed here, it is not asked again, and it counts as answered. It is shown the same way on print. (Changing it means correcting the original entry, with reason and name, section 6.)

Rules (D12, D15):
- **These three are the only required fields on every entry:** every movement that is still an open question must be answered Yes or No before Submit. A movement in the Done state is already satisfied. Once all three are Done, no required question is left on the form.
- The three movements happen in order. Movement 2 stays hidden as a question (shown greyed "Not yet: needs Move into drying rooms") until movement 1 is Done or answered Yes in this entry; the same for movement 3 after movement 2. Answering Yes to several in one entry is allowed when they really happened that day, each with its own date.
- A movement can only be Yes once per job (also enforced in the database, 7.1).

**No can never be changed back-dated (D16).** A submitted entry that answered No is **locked**: it cannot be reopened, edited or given a date in the past. The only way a movement goes from No to Yes is that it is answered **Yes in a new entry, on the day it actually happens**, and the date stamped is the **actual date and time of that change** (system clock, read-only). There is no field to choose a date, and no way to record "it really happened last Tuesday". If it really happened earlier and was forgotten, the entry says so in a comment, and the Yes is still stamped with today's date.
- **Only N → Y is allowed.** Y → N is never allowed (a Done movement is a read-only line). A Yes cannot be re-dated. A wrongly answered Yes can only be reversed by an admin with reason and name, which is logged and puts the movement back to an open question (D17).
- The date stamp is recorded from the server clock, not the device, so a wrong tablet clock cannot back-date it.

**F. Steaming for this entry**: the **steam roster** (2.1).

**G. Sign-off** as on every other record (unchanged).

Tablet rule: follow `mobile-tablet-font-responsiveness.md`. Order on screen and print: A, B, C, D, E, F, G.

#### 2.1 Steam roster (steams done in this entry)

- Empty at first with one **"+ Add steam"** button; each press adds a row. Most entries will have one steam or none; more than one works.
- Row fields, in this order: **Steam no.** (automatic and read-only), **Date** (default the entry date), **Steaming temperature** (°C), **Steaming time** (minutes), **Start time** (time of day), **Done by** (optional initials).
- **Steam no. is per job, not per entry**: it continues from the highest earlier steam number for the job, so the first steam of day 3 is "Steam 6" if days 1 and 2 had five. It renumbers only inside this entry when a row is removed.
- These are per steam, because each steam has its own values (D8). Only Date is required in a row; temperature, time and start time may be empty on a draft.
- **Previous steam details always show.** All earlier steams for the job (from earlier entries) are listed read-only directly above the new rows (steam no., date, temperature, time, start time, done by), never collapsed, so the operator sees what the last steam was. Above the list a one-line summary: "Last steam: no. 5, dd Mon, 85 °C, 45 min, started 07:30".
- A new row copies the **previous steam's temperature and time** as suggestions (editable, lighter style until touched). Start time is left empty.
- Steam dates may not be earlier than the job's date into dry room.
- Print shows this entry's steams, and the history panel is printed as "Job so far".

#### 2.2 Trolley loading guide (expected trolleys and kg per trolley)

The count alone says little. The factory rule of thumb is roughly **250 to 300 kg of harvest whole weight per trolley**, but nothing in the system holds that, so a wrong count goes unnoticed.

- Basis is the **harvest whole weight** (`jiIntakeWeight`), known at loading time.
- Two config values in one place (not in code): `trolleyKgMin = 250`, `trolleyKgMax = 300`, editable by an admin.
- **Expected trolleys** (read-only, shown as soon as the job is picked): whole weight ÷ max up to whole weight ÷ min, rounded. 1500 kg gives "Expected trolleys: 5 to 6 (250–300 kg each)".
- **Whole kg per trolley** (once a count is typed): whole weight ÷ trolleys as a chip: green "In range", amber "Light" below min, amber "Heavy" above max. 1500 kg on 4 trolleys is 375.0, amber "Heavy (usual 250–300)".
- **Cooked kg per trolley** in a smaller line, for trends only.
- A **guide, not a rule**: never blocks a Draft or Submit; outside the range is a soft warning with a reason.
- Check with Michaela (D11): 1500 kg at 250–300 kg per trolley is 5 to 6 trolleys, not 4 (4 trolleys is 375 kg each). Confirm the rule and whether it differs by farm or product.

#### 2.3 Cooked weight from REC 7.4.0

- `cookedWeight` = sum of `abalone_kg` on all **Cooking** cards (never Blanching) across the job's submitted REC 7.4.0 entries, from table `dry_cooking_pot` matched on `job_no` (same lookup as `wireRecordPick` / `window.Traceability.trace(jobNo)`; no new path).
- Only submitted 7.4.0 entries count (drafts ignored, with a note "N draft entries ignored").
- Read-only while a source exists, with "From REC 7.4.0 — N cooking pots". If none: amber "No REC 7.4.0 found for this job", the field unlocks, saving is not blocked.
- Stored as a copy on the entry (audit snapshot) with `cooked_weight_source_ids`. On every new entry the current value is read again; an earlier entry keeps what it was saved with.

### 3. Fields removed or replaced (compared with the old single-record form)

**Removed:** `wholeWeight` (typed Whole weight), `cookingDate`, `removedFromTrolleysDate`, `dateDeString`, `dateGraded`, `totalDryingTimeDays`, `dryWeight`, `estimateYield`.
**Replaced by the cooked weight pull:** `cookingWeight`.
**Replaced by the movement fields (question while open, read-only once Yes, each with a system-stamped date):** `movementToDryRoom1Date` → "Move into drying rooms" / "Date into dry room"; `movementToContainerDate` → "Move into dry container" / "Date into dry container"; `movementToGradingRoomDate` → "Move into grading room" / "Date into grading room".
**Replaced by the steam roster:** `steam1Date` … `steam14Date`.
**New:** `entryDate`, `noOfTrolleys`, the three movement fields (`movedIntoDryRoom`, `movedIntoDryContainer`, `movedIntoGradingRoom`), the steam roster.

Rules:
- Removed fields do not appear on screen, print or list, and are not hidden on the form.
- **Old data is kept.** Existing entries keep every stored value in `_old` columns (7.1) and show them on view/print of old entries only, labelled "(old)". Nothing is deleted or overwritten.
- Dry weight, yield, date into grading room and graded date already exist in REC 7.4.3.1 / 7.4.3.2 (`actualDriedWeight`, `yield`, `dateIntoGradingRoom`, `gradingDate`); reports read them there. Cooking date is the record date of the REC 7.4.0 Cooking entries.
- The read-only whole weight in Job info stays (trolley guide, yield in views) (D2).
- The **Drying Report** (`drying-report-spec.md`) is switched off the removed keys: yield, size grades and graded date from 7.4.3.1; whole weight from receiving; cooked weight, trolleys, movement dates and the steam timeline from the 7.4.1 entries (view `v_dry_job_progress`). Do not change 7.4.3.1 without confirming. REC 7.4.2 changes only as in section 8.

### 4. Job-level view of the entries

#### 4.1 "Job so far" panel (read-only, shown as soon as the job is picked)

- **Stage strip:** Loaded → In dry room → In container → In grading room, the current stage highlighted, each reached stage with its stamped date and time. Stage comes from the movement answers across all entries.
- **Counts:** entries so far, steams so far, days since date into dry room.
- **Last steam** line (2.1) and the full list of earlier steams.
- **Earlier entries** as a compact list, newest first: entry date, who, movements answered Yes, steams, trolley count. Tapping one opens it read-only.
- **Trolleys now:** the latest count, with a note if it changed during the job.
- If the job has no earlier entries the panel says "First entry for this job".

#### 4.2 Calculated fields (read-only, stored per entry where they belong to the entry)

| Field | Key | Formula |
|---|---|---|
| Whole kg per trolley | `wholeKgPerTrolley` | Receiving whole weight ÷ this entry's No. of trolleys, one decimal |
| Cooked kg per trolley | `cookedKgPerTrolley` | Cooked weight ÷ No. of trolleys |
| Loading status | `trolleyLoadingStatus` | `in_range` / `light` / `heavy` |
| Cook loss % | `cookLossPct` | (Whole weight − Cooked weight) ÷ Whole weight × 100 |
| Steam count in this entry | `steamCount` | rows in this entry's roster |

Blank until inputs exist, never NaN or 0. **Job-level totals** (steams so far, drying days, yield, drying loss, stage) are calculated in the views (7.3), not typed and not stored on the entry.

### 5. Job-level numbers (defined once, used by the views)

- **Date into dry room / container / grading room**: the server stamp on the entry where that movement was answered Yes.
- **Drying days** = date into grading room − date into dry room (both from 7.4.1 entries); fallback to 7.4.3.1 `dateIntoGradingRoom`, then `gradingDate` (D1).
- **Yield %** = `actualDriedWeight` (7.4.3.1 / 7.4.3.2) ÷ receiving whole weight × 100 (or that record's own `yield`).
- **Drying loss %** = (cooked weight − dried weight) ÷ cooked weight × 100.
- **Steams so far** = count of steam rows for the job; **current trolleys** = the count on the latest entry that has one.

### 6. Submit checks

Apply at **Submit only** (each entry). Draft saves are never blocked. A draft's Yes shows only the preview text; the stamp is set at Submit, so a draft kept for days cannot carry an old date.

**Hard block**
1. Job number filled.
2. **Every movement still shown as an open question is answered** (Yes or No). Done (read-only) movements are already satisfied. These answers are the only required fields on every entry.
3. Every Yes gets its date stamp from the server at Submit (nothing to type). The stamp is never earlier than the previous entry's stamp for the job.
4. A movement already Done cannot be answered again (the form does not offer it; the database also refuses a second Yes for the same job).
5. Sequence: Yes to container or grading room needs the earlier movement Done or Yes in this entry.
6. Date order across the whole job: date into dry room ≤ every steam date ≤ date into container ≤ date into grading room. Movement stamps are automatic and always in order; this check mainly guards typed steam dates (a steam dated before the stamped date into dry room, or in the future, is refused with both dates named).
7. Cooked weight not greater than receiving whole weight (only if both exist).

**Soft warning (submit allowed with confirm; reason where stated)**
8. **No. of trolleys empty or 0** on an entry that answers Yes to "Move into drying rooms", or on any entry while the job has no count yet: red line "No. of trolleys not recorded" on screen and print, confirm with reason (vital field, D13).
9. Trolley count **changed** from the previous entry: reason required ("Changed from 20 to 18").
10. Whole kg per trolley outside `trolleyKgMin`–`trolleyKgMax`: reason. "1500 kg on 4 trolleys is 375 kg per trolley. Usual is 250–300. Continue?"
11. **Empty entry**: every open movement answered No and no steam rows: "Nothing recorded in this entry. Submit anyway?" (allowed, no reason).
12. A steam row has a date but no temperature, time or start time (row numbers listed).
13. Steaming temperature or time outside a normal range (placeholders, D3); cook loss % outside a normal range (D3).
14. A second entry for the same job on the same date: informational only, since several people or shifts may add entries.

Reuse the OOSW-style override from 7.4.0: confirm dialog, `warningAck` and `warningNote`, red line on screen and print.

**Correcting a submitted entry** uses the existing pattern (reason and name, logged) for trolley counts, steam values and comments, and the checks above re-run against the rest of the job. **Movement answers and their stamped dates are not correctable this way:** a No is locked (cannot be reopened, cannot be back-dated), a Yes date cannot be edited, and Y → N is not offered. Only an admin can reverse a wrong Yes (D17), with reason and name, logged. A correction that would break the sequence of another entry is refused with the clash named.

### 7. Database

Principle: every reportable value is a real typed column, the full submission JSON stays as the audit copy, plain relational so it moves to any other database or format without conversion. Neon (Postgres) as today. **`job_no` is the thread**, repeated on every row.

#### 7.1 Parent table `dry_process_entry` (one row per submitted entry)

Keys: `id`, `submission_id`, `job_no`, `entry_date` (date of `entry_at`), `submitted_by`, `submitted_at`, status, sign-off (as the generic submission table).
- Job snapshot: `entry_at` (TIMESTAMPTZ, server-stamped, this is `entryDate`), `received_from`, `processing_for`, `whole_weight_kg` (copy of the receiving weight)
- Trolleys: `no_of_trolleys` INT (nullable; CHECK > 0 when not null), `trolley_change_reason`, `whole_kg_per_trolley`, `cooked_kg_per_trolley` NUMERIC(8,1), `trolley_loading_status`
- Cooked weight: `cooked_weight_kg` NUMERIC(10,2), `cooked_weight_source_ids` (array of 7.4.0 submission ids), `cook_loss_pct` NUMERIC(5,2)
- Movements, each a boolean and a **server-stamped timestamp**, true only on the entry where the movement happened (stamp null unless true): `moved_into_dry_room` + `date_into_dry_room_at` (TIMESTAMPTZ, with a DATE view column `date_into_dry_room`); `moved_into_dry_container` + `date_into_dry_container_at`; `moved_into_grading_room` + `date_into_grading_room_at`. Stamps are set by the database/server (`DEFAULT now()` at submit), never accepted from the client. `stamp_source` = `system` for new entries, `migrated_typed` for migrated ones. Add `movement_reversed_by`, `movement_reversed_at`, `movement_reversed_reason` for the admin reversal (D17), and keep every reversal as a row in an audit table `dry_process_movement_audit` (job, movement, old stamp, who, when, reason). Later entries store false/null for a movement that was Done earlier (the read-only line is worked out from the earlier entry, never stored twice).
- `steam_count` INT
- Warning audit: `warning_ack`, `warning_note`
- **Old-data columns** (migrated entries only, never shown on new ones): `whole_weight_kg_old`, `cooking_date_old`, `cooking_weight_kg_old`, `removed_from_trolleys_date_old`, `de_string_date_old`, `graded_date_old`, `total_drying_days_old`, `dry_weight_kg_old`, `estimate_yield_pct_old`, `calculated_by_migration` bool
- `created_at`, `updated_at`

Unique constraint: at most one entry per job may have `moved_into_dry_room = true` (same for container and grading room), enforced in the database, not only the form.

#### 7.2 Child table `dry_process_steam` (one row per steam)

`id`, `entry_id`, `submission_id`, `job_no`, **`steam_no` (per job)**, `steam_no_old` (migration only), `steam_date` DATE, `steaming_temp_c` NUMERIC(5,1), `steaming_time_min` INT, `start_time` TIME, `done_by`, `created_at`. Unique on `(job_no, steam_no)`. Migrated rows leave temp, time and start time null.

Indexes: `job_no`, `entry_id`, `submission_id`, `steam_date`, on the parent `(job_no, entry_date)` and each movement date.

#### 7.3 Views for trends (plain SQL views so they survive a move)

The join to 7.4.3.1 / 7.4.3.2 is on `job_no` (latest submitted grading record; if a job has both cultivated and ranched records, sum dried weight, noted in a view comment).

- `v_dry_job_progress`: one row per job, **the job-level picture built from all its entries**: farm, processing for, whole kg, cooked kg, entries, steams so far, first and last steam date, current trolleys and loading status, the three movement dates, `current_stage` (`Loaded`, `In dry room`, `In container`, `In grading room`), days in dry room so far, plus from grading: dried kg, yield %, drying loss %, graded date, drying days. The drying report and spreadsheet exports read this.
- `v_dry_yield_by_month`: month, jobs, total whole kg, total dried kg, weighted yield %, average drying days.
- `v_dry_yield_by_farm`: same grouped by farm.
- `v_dry_trolley_loading`: per job and month, trolleys (latest), whole and cooked kg per trolley, loading status, drying days and yield.
- `v_dry_steam_profile`: per job, number of steams, average steaming temperature, average and total steaming time, days between steams, with drying days and yield.
- `v_dry_jobs_in_dry_room`: jobs currently between "into dry room" and "into grading room" with days so far and steams so far (the live floor view).

Weighted yield = sum dried kg ÷ sum whole kg, not the average of per-job yields (comment this on the view).

#### 7.4 Keep it movable

No JSON-only reportable fields, no Neon-specific features. Add `scripts/export-dry-process.mjs` writing `dry_process_entry`, `dry_process_steam` and the views to CSV (header row, ISO dates), the "move to another format" path and a backup. Update the checked-in `drying-process.json` and `scripts/export-record-defs.mjs` so JSON and database stay identical; never hand-edit the generated snapshot.

#### 7.5 Traceability

`batchField: jobNo` stays, so `window.Traceability.trace(jobNo)` returns **all entries for the job**. The trace view lists them oldest first, one line each: "REC 7.4.1 — dd Mon — N trolleys — moved into dry room / steam 3 (85 °C, 45 min) / moved into container …", plus the job summary line from `v_dry_job_progress`. Links: to 7.4.0 (pots, batch codes) by `job_no` and `cooked_weight_source_ids`; to grading (dried weight, size grades, bin codes) by `job_no`.

### 8. REC 7.4.2 Dry Monitoring: trolley count pulled from 7.4.1 (decided)

Current 7.4.2 (`dry-monitoring.json`) has a typed `noOfTrolleys` next to `trolleysClearlyMarked`. 7.4.2 is also an entry log (one entry per monitoring day), so the trolley count follows the same rhythm:

- `noOfTrolleys` becomes **read-only and autofilled** with the **current trolley count for the job**: the count on the latest submitted 7.4.1 entry that has one, using the existing job lookup (not a new path). Label unchanged.
- If no 7.4.1 entry with a count exists: amber note "No REC 7.4.1 trolley count for this job. Fill in REC 7.4.1 first", and the field unlocks. Saving and submitting are not blocked.
- Stored on the 7.4.2 entry as a copy with `trolleys_source_submission_id`. Old 7.4.2 entries keep what they were saved with; each new monitoring entry picks up the current count.
- `trolleysClearlyMarked` stays a typed Yes/No (a daily observation).
- Existing 7.4.2 entries unchanged; typed counts stay as saved.
- Database: `no_of_trolleys` stays a typed INT column; add `trolleys_source_submission_id` and `trolleys_typed_manually`. View `v_dry_monitoring_trolley_check` lists 7.4.2 entries whose count differs from the job's count on that date.
- Update the checked-in `dry-monitoring.json` and `scripts/export-record-defs.mjs`; no hand-edit of the snapshot.

### 9. Existing entries (do not lose or change history)

Today one job usually has one big 7.4.1 record. One script under `scripts/`, original JSON untouched. Before/after: row counts, and every old value equal to its new home or its `_old` column.
- Each old record becomes **one** `dry_process_entry` (entry date = its completion/record date) plus one `dry_process_steam` row for every filled `steamNDate`, numbered 1..N in old field order, original position in `steam_no_old`.
- Old dry-room, container and grading-room dates go to the new movement stamp columns (midnight, `stamp_source = 'migrated_typed'`, so they are recognisable as typed history, not system stamps), with the boolean set to true when a date exists; when none exists leave the boolean **null** (unknown), not false. A migrated movement with a date is Done (read-only) for any new entry on that job; one without a date stays an open question.
- All other removed values (whole weight, cooking date, cooking weight, removed from trolleys, de-string, graded, total drying days, dry weight, yield) are copied unchanged to their `_old` columns. Do not recalculate or overwrite them, and leave `cooked_weight_kg` null on old entries.
- Old entries have no trolley count in 7.4.1: leave `no_of_trolleys` null. An optional reviewable backfill from REC 7.4.2 `noOfTrolleys` (first value per job, flagged `trolleys_backfilled`) is **not run without Michaela's approval** (D10).
- Old entries with an old dry weight but no grading record still show that dry weight, labelled "(old)", in `v_dry_job_progress`.
- Unusable dates: keep raw text in a `*_raw` column, typed column null, list in the script output. Do not guess. Do not invent data.
- New entries added to a migrated job continue the steam numbering after the migrated steams and see the migrated data in "Job so far".

### 10. Testing checklist

1. Pick a job with no entries: "First entry for this job"; none of the removed fields appear; the three movement fields show as questions with nothing pre-selected (movements 2 and 3 greyed until the earlier one is done); Cooked weight read-only from 7.4.0 (Blanching excluded, several 7.4.0 entries summed, drafts ignored); no 7.4.0 gives the amber note and an unlocked field.
2. **Multi-day use:** submit day 1 (Yes to "Move into drying rooms", 4 trolleys, steam 1); log in again, pick the same job: "Job so far" shows the stage, steam 1 and the day 1 entry; the trolley count is prefilled; day 2 entry with steam 2 is numbered Steam 2; day 3 continues as Steam 3; "Last steam" and earlier steams are always correct and never collapsed.
3. **Movement fields:** on day 2 "Move into drying rooms" is a **read-only line with the date** and is not a question; "Move into dry container" is now the open question; answering No keeps it a question on day 3; Yes shows the date and on day 4 it too is a read-only line; when all three are Done no required question remains; Yes shows a read-only "will be stamped on submit" preview and no date can be typed; the stamp equals the server time at Submit (change the tablet clock: the stamp does not follow it); a draft kept for two days stamps on the day it is submitted; **a submitted No cannot be reopened or edited**; Y → N is not offered; there is no way to enter a past date for a movement; Yes to container/grading without the earlier one Done or Yes is refused; a steam dated before the stamped date into dry room or in the future is refused naming both dates; an admin reversal of a wrong Yes needs reason and name, is logged in `dry_process_movement_audit`, and turns the movement back into an open question; all open movements No with no steam gives "Nothing recorded"; the database rejects a second Yes for the same movement on a job; the read-only lines also appear on print.
4. **Trolleys:** empty count on a dry-room Yes entry gives the red flag and confirm; changing the count from the last entry asks for a reason; the loading guide shows "Expected trolleys: 5 to 6" for 1500 kg, 5 trolleys = 300.0 green, 4 = 375.0 amber Heavy, 7 = 214.3 amber Light; changing the config min/max changes the guide without a code change; never blocks a Draft.
5. **Steam roster:** each row has Date, Steaming temperature, Steaming time, Start time; new row copies the last temperature and time as editable suggestions; steam before the date into dry room refused; removing a row inside an entry renumbers only that entry; steam numbers unique per job.
6. Same-day second entry for one job: allowed with the informational line.
7. Corrections: correcting a trolley count, steam value or comment on a submitted entry needs reason and name; movement answers and stamps offer no correction; a correction breaking the sequence in another entry is refused.
8. Calculations: whole 1500, cooked 1000, 5 trolleys gives 300.0 and 200.0 kg per trolley and cook loss 33.3 %; blank inputs give blank.
9. **Views:** `v_dry_job_progress` shows one row per job built from several entries (movement dates from the right entries, steams so far, current trolleys, stage); `v_dry_jobs_in_dry_room` lists only jobs between dry room and grading room; drying days = grading-room date − dry-room date; yield/dried weight from the grading record; weighted yield by month = sum dried ÷ sum whole.
10. Old entry: opens fine; old values show labelled "(old)" on view/print only; old container/grading dates appear as Done read-only lines, missing ones as open questions not No; a new entry on a migrated job continues the steam numbering.
11. Migration: counts and every old value identical (new home or `_old`); steams 1, 2 and 4 become three rows; unusable dates listed.
12. Export script produces CSVs that open cleanly in Excel.
13. Trace view for a job lists every entry in date order plus the job summary line.
14. Drying report renders for an old and a new job and no longer reads removed keys.
15. REC 7.4.2: fills the job's current trolley count read-only; no 7.4.1 count gives the amber note and an unlocked field; change the count in 7.4.1 and a new 7.4.2 entry shows the new count while an old saved one keeps its old one; `v_dry_monitoring_trolley_check` lists mismatches.
16. Tablet width readable; "+ Add steam" and the Yes/No buttons easy to tap.

### 11. Decisions taken (defaults, change if wrong)

- **D1** Drying days = date into dry room to date into grading room (7.4.1 entries), fallback to 7.4.3.1 dates. Confirm.
- **D2** Keep the read-only receiving whole weight in Job info.
- **D3** Warning ranges (steaming temperature and time, cook loss %) are placeholders; give real ones from QC.
- **D4** Dry weight, yield and grading dates come from 7.4.3.1 / 7.4.3.2; confirm they are always filled for finished jobs, otherwise those jobs show no yield.
- **D8** Steaming temperature, time (minutes) and Start time are per steam; steam numbers run per job.
- **D9** Cooked weight = Cooking cards only, submitted 7.4.0 entries only.
- **D10** REC 7.4.2 trolley count is pulled from 7.4.1 (decided, section 8); backfilling old 7.4.1 from 7.4.2 only on approval.
- **D11** Loading guide: harvest whole weight, default 250–300 kg per trolley, configurable, soft warning only. Confirm the numbers and whether they vary by farm or product.
- **D12** The three movements are Yes/No questions with a system-stamped date on Yes; the still-open ones are the only required fields on every entry.
- **D13** No. of trolleys is a strongly flagged soft warning, not a hard block, because only the movement questions are required. Say if it should also block Submit.
- **D14** Several entries for one job on the same day are allowed (informational note only).
- **D16** A submitted No is locked and cannot be reopened or back-dated. A movement goes from No to Yes only in a new entry, stamped with the actual server date and time of the change; the entry date is also system-stamped and read-only (decided). Steam dates remain typed (not future, not before dry-room stamp); say if steam dates should also be locked to the actual date.
- **D17** A wrongly answered Yes can only be reversed by an admin, with reason and name, logged. Say who the admin is (default: Michaela / QA manager role).
- **D15** Once a movement has been answered Yes on any earlier entry it stops being a question and becomes a read-only line with its date on every later entry (decided). A movement answered No stays a question.

### 12. Build order for Claude Code

1. Confirm D1, D3, D4, D8, D11 and D13 with Michaela.
2. Database: `dry_process_entry`, `dry_process_steam`, the views, export script, migration (dry run, compare every value, then run).
3. Update the record definition (per-entry form, removed fields, three movement fields with dates, read-only Cooked weight, No. of trolleys, steam roster) and regenerate the snapshot. **Stop for review here.**
4. "Job so far" panel, per-job steam numbering, question/read-only switching of the movement fields, submit checks and warning overrides.
5. REC 7.4.2 trolley autofill (section 8); trace view lines; switch the drying report off the removed keys.
6. Run the checklist and report pass/fail per item.

---

## REC 7.4.1 Drying Process — As Built

> **Source:** `claude/rec-7-4-1-drying-process-as-built.md`

Status: built and live (code pushed, database migrated, definition seeded). Date: 2026-09-30.
Replaces the original spec `Claude outputs/drying-process-refinement-instructions.md` where the two differ; every
difference below was a decision by Michaela during the build (2026-09-29).

### 1. How the form is used

The operator opens the record **to complete a steam**. They pick the job number, see where the job is and its
last steam, add the steam(s), answer any open movement question, and submit. Every submission is one **entry**;
all entries for a job number make up that job's drying history. Engine: `form-record` with the `entryLog`
extension (`public/lib/entry-log.js`).

### 2. What is on screen (top to bottom)

1. **Job info** — unchanged (job number, receiving date, farm, processing for, whole weight; read-only from REC 7.1.2).
2. **Job so far** — only:
   - Location: current stage (Loaded / In dry room / In container / In grading room) with its date, plus the dry
     room area from the latest submitted REC 7.4.2 check
   - Trolleys (once set)
   - Last steam (date), Steam number, Steam info (temperature, time, start time)
   - Next steam number
   - "First entry for this job" when there are no earlier entries
3. **Steams** — earlier steams for the job listed read-only, then one card per new steam with only:
   Steaming temperature, Steaming time (minutes), Start time. Temperature and time are copied from the previous
   steam as editable suggestions.
4. **Movements** — slim rows, one per movement (see section 4).
5. Sign-off.

Hidden (stored, not shown): entry date, cooked weight, steam number, steam date, trolley count, movement stamps.

### 3. Rules

**Steam**
- Steam number: automatic, per job, starts at 1, never blank or 0. Not shown on the card.
- Steam date: never typed. The server dates every steam with the day the entry is submitted.
- No steaming once the job is in the grading room (moved earlier, or answered Yes in the same entry):
  "+ Add steam" hides with a note, and the server refuses it.

**No. of trolleys — set once**
- Asked in a **pop-up** the first time "+ Add steam" is pressed on a job that has no count yet. Whole number ≥ 1.
- Never asked again; every later entry carries the same count. It cannot be changed.
- The server refuses steams if no count exists for the job.
- There is **no** trolley loading guide (no kg-per-trolley rule or status).

**Cooked weight**
- Not shown. Copied silently from REC 7.4.0 (sum of `abaloneKg` on submitted Cooking cards; Blanching and drafts
  excluded) and stored with the entry. Never typed or overridden.

**Removed completely:** cook loss %, steam temperature limits, "Done by", "Steams this entry",
"Reason trolley count changed", and the old single-record fields (whole weight, cooking date/weight,
removed from trolleys, de-string, graded date, total drying days, dry weight, estimate yield — kept only as
read-only `…Old` values on migrated entries).

**Soft warnings at submit** (confirm to continue, recorded on the entry as `warningAck` / `warningNote`):
nothing recorded in the entry; a steam missing temperature, time or start time; steaming time outside
20–90 min (**placeholder** range until QC gives the real one).

### 4. Movements

Three movements: Move into drying rooms, Move into dry container, Move into grading room.

- **Open** movement: a Yes/No question (84 × 44 px buttons). Selected Yes = dark grey, No = light grey. No colours.
- **Done** movement: a grey read-only line with its stamped date; cannot be answered again.
- **Blocked** movement: a lighter grey line saying why.
- Dry container and grading room each need the drying rooms first (not each other).
- The grading room is the **final room**: nothing moves into the container after it, and container and grading
  cannot both be Yes in one entry.
- Each open question must be answered before submit. A submitted No stays open for the next entry and can never
  be back-dated; the Yes is stamped with the server date and time of the entry that answers it.
- Only an administrator / QA manager can reverse a wrongly answered Yes (reason + name, logged in
  `dry_process_movement_audit`), via `POST /api/drying-process/reverse-movement`.

### 5. Server rules (`src/drying-process-guard.js`)

Every write to `formrecord:drying-process` passes through the guard before it is stored:
entry date and movement stamps from the server clock; drafts carry no stamp; submitted entries locked (a stale
device cannot change or drop them); one Yes per movement per job; movement order and final-room rules; per-job
steam numbers; steam date = submit day; no steaming in the grading room; no steaming without a trolley count;
trolley count carried from the first entry that set it. A refusal returns 409/422 and the form shows the reason
(`api-backend.js` does not queue refused saves for retry).

Tests: `node scripts/test-drying-process-guard.mjs` (16 passing).

### 6. Database (Neon)

- `sub_drying_process` = one row per entry (`jobNo` is the thread); `sub_drying_process_row` = one row per steam.
- Partial unique indexes: at most one submitted Yes per movement per job.
- Views: `dry_process_entry`, `dry_process_steam`, `v_dry_job_progress` (job-level picture built from all
  entries), `v_dry_yield_by_month`, `v_dry_yield_by_farm` (weighted yield = Σ dried ÷ Σ whole),
  `v_dry_trolley_loading`, `v_dry_steam_profile`, `v_dry_jobs_in_dry_room`, `v_dry_monitoring_trolley_check`.
- Migrations: `20260929170000_drying_process_entries`, `…190000_drop_cook_loss`, `…200000_drop_done_by`,
  `…210000_drop_trolley_reason`. `migrate deploy` needed `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` (pgbouncer
  advisory-lock trap, P1002).

### 7. Where the job-level numbers come from

- Whole weight: REC 7.1.2 receiving. Cooked weight: REC 7.4.0 (copied onto the entry).
- Dried weight, yield, size grades, graded date: REC 7.4.3.1 / 7.4.3.2 (cultivated + ranched added together).
- Drying days = date into grading room − date into dry room (7.4.1 stamps), fallback to the 7.4.3 dates.
- Drying loss % = (cooked − dried) ÷ cooked × 100.

Readers switched to the new entries: `pages/drying-report.html`, the dashboard tiles in `index.html`
(dry yield, steam turns per job), `lib/traced-records.js` (store key `formrecord:drying-process`), and
REC 7.4.2's trolley autofill (`/api/dry-monitoring/job-facts`).

### 8. Scripts

| Script | Purpose |
|---|---|
| `scripts/apply-drying-process-entries.mjs` | Writes the 7.4.1 definition into `data/record-definitions.json` (idempotent) |
| `scripts/snapshot-one-def.mjs drying-process` | Regenerates `public/data/record-defs/drying-process.json` |
| `scripts/seed-definitions-only.mjs drying-process` | Seeds just this record's definition into Neon |
| `scripts/migrate-drying-process-entries.mjs` | Converts old single-record entries (dry run by default; none existed in prod) |
| `scripts/export-dry-process.mjs` | Tables + views to CSV (Excel-friendly) |
| `scripts/test-drying-process-guard.mjs` | Server-rule tests |

After any definition change: apply → snapshot → seed, then push.

### 9. Open

- Real QC range for steaming time (placeholder 20–90 min).
- Correcting a submitted entry (reason + name) — not built; form-record has no such pattern.
- Trace-view line format for 7.4.1 not customised (uses the default entry listing).
- Test entry for job DPR001998 (saved before the server rules, no stamps) is still in production.

---

## REC 7.4.1 Drying Process: rename "Job so far", remove the Steams section

> **Source:** `rec-7.4.1-progress-of-product-rename-and-steam-section-removal-instructions.md`

Date: 2026-10-01. Small UI change. Builds on `drying-process-refinement-instructions.md` (sections 2.1 and 4.1). For Claude Code or Claude Design. No other record changes.

### 1. Rename "Job so far" to "Progress of product"

On REC 7.4.1 (the read-only panel shown as soon as the job is picked):

- Change the panel heading **"Job so far"** to **"Progress of product"**.
- Change every place that heading text appears: on screen, in print (the print heading is also "Job so far" today), in the view/read-only page of a submitted entry, and in any tooltip, empty-state or aria-label.
- Empty state: "First entry for this job" stays as is.
- Contents of the panel do not change (stage strip, counts, earlier entries, trolleys now).
- Do not rename database objects. `v_dry_job_progress` keeps its name. Display label only.
- Search the repo for the string "Job so far" and "jobs so far" (case-insensitive) in the 7.4.1 record definition, the JS that builds the panel, the print CSS/template and the Drying Report, and change the label in each. Leave code comments and variable names alone.

### 2. Remove the "Steams" section from the form

The Steams section (section F, steam roster) contains only the **"+ Add steam"** button, so it is removed from the form.

- Remove the whole section from screen, print and the read-only view: heading, "+ Add steam" button, the empty roster, and the "Last steam: ..." summary line that sits above it.
- Remove the tablet-width and tap-target handling that exists only for that button.
- Re-letter the remaining sections so there is no gap (sign-off becomes F). Order on screen and print: A, B, C, D, E, F.
- Submit checks that read the steam roster no longer run on new entries: steam dates against date into dry room (check 6), and "steam" wording in correction rules. Keep the movement date checks.
- The calculated field `steamCount` is not shown on new entries.

#### Keep, do not delete

- **Database stays as it is.** Table `dry_process_steam`, `steam_no`, `steam_no_old` and all existing rows are untouched. No drop, no migration, no data loss. Traceability depends on this (`TRACEABILITY.md`).
- **Existing steam data stays visible, read-only,** for any job that already has steam rows: show them inside "Progress of product" as a compact read-only list (steam no., date, temperature, time, start time, done by), labelled "Steams recorded earlier". If a job has no steam rows, show nothing (no empty heading).
- `v_dry_job_progress`, `v_dry_steam_profile`, the Drying Report timeline and the CSV export keep reading `dry_process_steam`. They simply show blanks for jobs with no steams.
- Checked-in `drying-process.json` and `scripts/export-record-defs.mjs`: remove the steam roster field from the record definition and regenerate the snapshot with the script. Do not hand-edit the generated snapshot. Confirm the export script still writes `dry_process_steam` to CSV.

### 3. Confirm with Michaela before building

One consequence to confirm: with the Steams section gone, the form can no longer record new steams (temperature, time, start time). If steams are still being recorded somewhere else, or are no longer needed, the plan above is complete. If they are still needed, say so and the roster should be moved rather than deleted (for example into the Progress of product panel as an "Add steam" action).

### 4. Testing checklist

1. Pick a job with no entries: panel reads "Progress of product", "First entry for this job" shows, no Steams section anywhere.
2. Pick a job with earlier entries: panel heading is "Progress of product" and the content is unchanged.
3. Print preview and a submitted entry's read-only page: no "Job so far" text left, no Steams heading, sections lettered A to F with no gap.
4. A job that already has steam rows: "Steams recorded earlier" appears read-only inside the panel with the right values; a job with none shows no steam heading.
5. Submit and draft save work with no steam fields; no errors from the removed roster in the console.
6. Drying Report and `v_dry_job_progress` still render for an old job (steam columns populated) and a new job (blank steam columns).
7. Search the repo for "Job so far": no user-visible matches remain.
8. Tablet width still reads cleanly after the section removal.

---

## REC 7.4.2 Dry Monitoring: field changes (build summary)

> **Source:** `Claude outputs/rec-7-4-2-dry-monitoring-changes-summary.md`

Status as of 2026-09-30: **built and browser-tested locally; NOT deployed or reseeded.** Held until REC 7.4.1 ships (the trolley count reads REC 7.4.1 entries).

### Decisions (Michaela)

| Ref | Decision |
|---|---|
| D-A | Job cooked over several days: use the **newest** cooking date as final (no "cooked on N dates" note). |
| D-B | Dry room areas: **Main dry room, Dry container, Grading room**. |
| D-C | 22 days is the same for every product, farm and season. |
| D-E | Old dry room area text: the table had 0 rows, so nothing to map. |
| D-F | A red answer **prompts** for a comment; it never blocks Submit. |
| Yes/No | Surface shine: Yes = red. Only **Trolleys clearly marked** has Yes = good (green), No = red. |

### The seven changes as built

1. **Date removed.** Replaced by a read-only **Entry date**, stamped when the entry is submitted (Johannesburg date). It heads the print sheet. Old typed Date is kept as `dateOld`, shown "(old)" on old entries.
2. **Cooking date** read-only, from the latest submitted REC 7.4.0 **Cooking** card (Blanching never counts, drafts ignored). No source: amber note, field unlocks, entry flagged `cookingDateTypedManually`.
3. **Dry room area** is a required dropdown with the three areas. Old free text is kept as saved.
4. **No. of trolleys** read-only, from the latest submitted REC 7.4.1 entry that has a count. No source: amber note, unlocks, flagged `trolleysTypedManually`.
5. **Estimated drying date** = cooking date + 22 calendar days, read-only, blank until a cooking date exists. `dryingDaysEstimate` lives in the record definition; changing it affects new entries only. Examples: 2026-09-01 gives 2026-09-23; 2026-12-15 gives 2027-01-06; 2027-01-31 gives 2027-02-22.
6. **QC check and Supervisor removed.** Old values kept as `qcCheckOld` / `supervisorOld`, shown "(old)".
7. **Yes/No colouring.** Per-field `good` flag in the definition (`"No"` = Yes is the problem). Problem answers are red, bold, carry a warning mark and print with a border. Old answers are coloured at display time. Comment field relabelled "Comment / corrective action".

Submit checks: hard block on job number and dry room area; soft "Missing: ..." notice for cooking date, trolley count, estimate.

### Files

| File | Change |
|---|---|
| `Claude outputs/rec-7-4-2-dry-monitoring-columns.sql` | Backups, 8 new columns, old-value copy, 3 views. **Already run in Neon (2026-09-29).** |
| `scripts/apply-dry-monitoring-changes.mjs` | Rewrites the definition (idempotent). |
| `data/record-definitions.json`, `public/data/record-defs/dry-monitoring.json` | Updated definition and offline snapshot. |
| `public/lib/monitoring-log.js` | v38. Stamped dates, `fromRecord` autofill, `addDays`, hidden and legacy fields, red styling and prompt, entry-date sort and filter. |
| `src/index.js` | New `GET /api/dry-monitoring/job-facts/:jobNo`. |
| `public/records/REC-7.4.2-dry-monitoring.html` | Script cache-buster `?v=38`. |
| `prisma/schema.prisma`, `prisma/submission-models.prisma` | New columns added by hand (no migrate). `prisma validate` passes. |

Neon views: `v_dry_monitoring_trolley_check` (now on entry date), `v_dry_monitoring_estimate` (`days_to_estimated_drying`), `v_dry_monitoring_flags` (one row per problem answer). Backups: `bak_sub_dry_monitoring_20260929`, `bak_recordfielddef_dry_monitoring_20260929`, `bak_recorddefinition_dry_monitoring_20260929`.

### Test results (local, stubbed storage and API)

Passed: no Date field; entry date on list and print; cooking date and trolleys autofill; amber notes and unlocking; manual flags; estimate maths; area dropdown and required refusal; job switch clears a copied value; Yes/No colours (all four cases); comment prompt; submit and soft warning; old-format entry opens, lists and prints with "(old)" rows.

Not tested: `dryingDaysEstimate` change, tablet width, a CSV opened in Excel, the real endpoint against Neon, the Neon 22-day query (needs real entries).

### Deploy order (when REC 7.4.1 is live)

1. Deploy the code (files above).
2. `node scripts/seed-definitions.mjs` (loads the new definition and bumps its version). Do this only after step 1: the old engine cannot use the new definition.
3. Write and run the column-drop SQL for `date`, `qcCheck`, `supervisor` (table is empty, so safe).
4. Run: `SELECT "jobNo", "cookingDate", "estimatedDryDate", "estimatedDryDate" - "cookingDate" AS days FROM sub_dry_monitoring ORDER BY "createdAt" DESC LIMIT 10;` and expect 22 on every new row.

### Notes

- Entry date is stamped by the browser (Johannesburg time), because the monitoring-log engine has no server-side stamp.
- Drafts have no entry date until submitted.
- Trolleys will show the amber "fill in REC 7.4.1 first" note until 7.4.1 entries exist.

---

## REC 7.4.2 Dry Monitoring: Job info section split (2026-10-01)

> **Source:** `Claude outputs/rec-7-4-2-section-split-work-log.md`

### Cause
Only `jobNo` had a group in the definition. The engine gives ungrouped fields the previous group, so all 25 fields sat in "Job info". Picking a job folds that section, which hid the checks.

### Changes
- `data/record-definitions.json` (via `scripts/split-dry-monitoring-sections.mjs`, idempotent) + `public/data/record-defs/dry-monitoring.json` (snapshot): sections Job info / Dry room details / Checks / Comments. Keys, labels, columns, calculations unchanged. Order inside each section kept, but sections must be contiguous, so *Trolleys clearly marked* now follows *Estimated drying date* instead of sitting between No. of trolleys and it (affects print/CSV column order for that one field).
- `monitoring-log.js` v40: new `hideInForm` field flag (hidden input, still autofilled, saved, listed and printed); Job info header summary ignores hidden fields (shows `Job <no>` only).
- `job-picker.js` v6: auto-collapse guard `foldSafe()`: if the picker's section holds any visible, editable control that is not job data, it stays open and logs a console warning naming the page.
- Script versions bumped: monitoring-log 39→40 (51 pages), form-record 65→66 (80 pages), job-picker 5→6.

### Audit: the four hidden job-data fields
| Field | Read by | Action |
|---|---|---|
| jiReceivedFrom, jiProcessingFor, intakeWeight, intakeDate | `autofill` (abalone-receiving), stored values/list/print/CSV, `sub_*` column | Kept as hidden inputs; nothing dropped or repointed |

### Test (local, snapshot definition)
- New entry: Job info shows job number only; Dry room details, Checks, Comments, Sign off visible below. No "(old)" fields. Counters 0 of 1 / 0 of 1 / 0 of 1 / 0 of 1 / 0 of 4.
- Pick job + Confirm: Job info folds to `Job DPR9999`; the other four stay open. Console: only unauthenticated 401s (no local API).
- Not tested locally (needs live data/login): autofill values, old entry with saved Date/QC/Supervisor, printing, CSV.

### Deploy
Reseed the definition: `node scripts/seed-definitions-only.mjs` (Neon), then push. Pages read `/api/record-def/dry-monitoring` live.

### Other records with the same grouping fault (not changed)
monitoring-log (non-job fields inherit the Job info group): gonad-inspection-report, scrubbing-check-supervisor, sampling-log, stock-loading, dry-stock-control, labelling-of-dry-boxes, dry-stock-transfers, live-production-pack, chiller-batch-control, dry-chiller-batch-control, seamer-inspection-report, cans-incoming-inspection, dispatch-loading-inspection-checklist, dispatch-receiving-checklist, chiller-temperature-monitoring, incubator-cans-log ("1. New entry — cans in"). Also double-seam-inspection-report and abalone-packing-specification (no groups at all, so no job-section fold issue unless a job picker is added).
form-record "Batch details" holding editable fields: production-information-nrcs, dry-nrcs-packs, traceability-mock-recall-* (4). Job info with editable extras (mostly intake date / processing for, likely intentional): ~12 more (e.g. salting-and-tumbling, dry-cooking, dried-abalone-transfer, qc-report).
With the new guard, records whose Job info holds editable non-job-data fields will stay open after job pick (console warning) instead of folding the form away.

---

## REC 7.4.2 Dry Monitoring: Job info section has taken over, and the whole form collapses (instructions for Claude Code)

> **Source:** `rec-7.4.2-job-info-section-split-instructions.md`

**Date:** 2026-10-01
**Raised by:** Michaela: "7.4.2 Job info section has taken over" and "once job detail input then the whole checks collapse"
**Scope:** REC 7.4.2 only (`dry-monitoring`). No new fields, no field renames, no calculation, DB or export changes. Layout/grouping and collapse behaviour only.
**Related:** `record-sections-collapse-and-job-autofocus-instructions.md` (Job entry = Job no. only, auto-collapse), `rec-7.4.2-dry-monitoring-field-changes-instructions.md`.

### 1. What is wrong (observed on the live page, confirmed by Michaela)

The first section, "Job info", holds **everything** on the form: 26 inputs, "0 of 6 fields done". It contains:

- Job number (correct)
- Received from (farm), Processing for, Whole weight, Intake date (job data, should not be on this record)
- Entry date, Cooking date, Dry room area, No. of trolleys, Estimated drying date (record data)
- Trolleys clearly marked, Mould visible, White salt on surface, Case hardening, Surface shine, Foot damage, Comment / corrective action (the actual monitoring checks)
- Comments, plus "Date (old)", "QC check (old)", "Supervisor (old)" showing on a brand-new entry

Only two sections exist (Job info and Sign off). **Bug as reported:** once the job is selected, the Job info section auto-collapses, and because the checks live inside it, **the whole checks area folds away with it**. The user cannot enter the checks after choosing the job.

Root cause: wrong grouping in the record definition (all fields assigned to the job section), not the collapse code itself. Auto-collapse is working as designed on the wrong container.

### 2. Target layout

| Section | Fields |
|---|---|
| **Job info** | Job number ONLY (picker, job details pop-up with Confirm/Cancel, then collapses to `JOB INFO, <job no>`) |
| **Dry room details** | Entry date (read-only), Cooking date (read-only), Estimated drying date (read-only), Dry room area (dropdown), No. of trolleys (read-only) |
| **Checks** | Trolleys clearly marked, Mould visible, White salt on surface, Case hardening, Surface shine, Foot damage, Comment / corrective action |
| **Comments** | Comments |
| **Sign off** | Unchanged (Completed by block, last) |

All sections collapsible, all open on load. **Only Job info collapses after the job is confirmed.** Dry room details, Checks, Comments and Sign off stay open and enterable.

### 3. Changes

1. **Re-group in the record definition** (`data/record-definitions.json` / `dry-monitoring.json`, then the `RecordFieldDef` section values): add the sections above and assign each existing field to one. Field keys, order within a section, labels and storage columns do not change.
2. **Job info = job number only.** Remove Received from, Processing for, Whole weight and Intake date from the rendered form. Per the collapse brief, these show only in the confirmation pop-up. Before removing, check what reads them (list columns, print, CSV, trends). Repoint to a lookup by `jobNo`; do not drop any stored column or old data. Write an audit table in the work log.
3. **Auto-collapse guard (the reported bug).** Auto-collapse acts on the single section that contains the job picker, and nothing else. Add a safety check in the shared code: if that section contains any field other than the job picker, do not auto-collapse it, and log a console warning naming the record. This stops the same mistake recurring on another record.
4. **Progress counter** ("x of y fields done") is per section, so Job info shows 0 of 1 and each new section counts its own fields.
5. **Old-value fields** (`Date (old)`, `QC check (old)`, `Supervisor (old)`): render only when viewing an old entry that has a value in them. Never on a new entry, never on a blank form. Place them in a small "Earlier values" block at the end of Dry room details (not in Job info).
6. **Print / CSV** unchanged in content and order; print shows all sections expanded.
7. **Check other records for the same fault.** List every record whose definition puts non-job fields in the same section as the job picker. Report them back; do not change them without approval.

### 4. Test

1. New entry: Job info shows only Job number; the other sections are visible below it.
2. Pick a job, Confirm: autofill fills cooking date, trolleys, estimated drying date; Job info folds to one line; **Checks stay open and every check can be answered**.
3. Re-open Job info by clicking its header: job number intact. Change the job: autofill reruns, Job info folds again, Checks untouched and any answers already given stay.
4. Section progress counters are correct per section.
5. New entry shows no "(old)" fields; an old entry with saved Date/QC/Supervisor shows them labelled "(old)".
6. Existing entries open and print identically to before (field values, order, Completed by row). CSV unchanged.
7. Tablet width: no horizontal scroll, 44px section headers.
8. Bump `?v=` on scripts loaded by the 7.4.2 page.

### 5. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.2-job-info-section-split-instructions.md` and follow it. Bug: on REC 7.4.2, picking a job collapses the whole form because every field sits in the Job info section. Split it into Job info (job number only), Dry room details, Checks and Comments, keep Sign off unchanged, so only Job info collapses. Add the auto-collapse guard from section 3.3. Do not change field keys, labels, calculations, DB columns or exports. Hide the four job-data fields (farm, processing for, whole weight, intake date) after auditing and repointing anything that reads them. Show the "(old)" fields only on old entries. Report other records with the same grouping fault. Bump the `?v=` strings, run section 4 and write a short work log.

---

## REC 7.4.3.1 / 7.4.3.2 — Grading Production Log: Collection bins

> **Source:** `docs/REC-7.4.3-collection-bins.md`

*Updated 2026-09-30. Applies to Cultivated (7.4.3.1) and Ranched (7.4.3.2).*

### What the operator sees (tablet)

A new grading log opens with **one row per size grade**. No rows to add or remove.

| Bin | Start kg | Confirm kg | Full boxes | Final kg | Graded kg |
|---|---|---|---|---|---|
| 8g-10g-3 | 20.0 | ☑ | **[+ Box]** 2 boxes / 24.3 kg | 21.0 | 25.30 |

- **Bin**: the current bin code, `size grade-number` (e.g. `8g-10g-3`). The size grade is part of the code, so there is no separate grade column.
- **Start kg**: filled from that size grade's last final bin weight on an earlier grading log (cultivated or ranched). If there is none, weigh the bin and enter it.
- **Confirm kg**: tick once the start weight has been checked on the scale. The whole cell is tappable. Until it is ticked, **+ Box** and **Final kg** stay locked. Ticking also makes the start weight read-only; untick to correct it.
- **+ Box**: opens a pop-up for **one** full box: enter the box weight, tap **Add full box**, and the pop-up closes. Tap outside to cancel. The pop-up shows the boxes so far and the last box with **Undo**.
- **Final kg**: what is left in the bin at the end.
- **Graded kg** = Σ full boxes + final − start (calculated).

Every size grade is saved on every log, so each row needs its start weight confirmed before submitting.

### Bin code = box code

- Each **+ Box** gives that box the bin's **current** code, and the bin then counts on by one. Example: bin at `8g-10g-3` → add box → the box is `8g-10g-3`, the bin becomes `8g-10g-4`.
- **Undo** only removes the **last** box, so codes already given to boxes never change.
- A new log starts each grade on its latest number from the database (the number after the last box).

### Traceability

- Every box code is saved to the bin trace with its job number, grading date, record and its own weight.
- `batch-trace.html?batch=<box code>` shows an **"In this bin"** table: job no., graded on, record, boxes, kg.
- REC 7.4.4 / 7.4.5 capture the same box code, so they link back to the job.

### How it is stored

| Column | Meaning |
|---|---|
| `sizeGrade` | fixed per row (hidden; it is the row) |
| `binNo` | hidden counter — the next free number for this grade |
| `binCode` | `sizeGrade-binNo` (derived) — the bin's current/next code |
| `binWeightStart`, `startConfirmed` | start weight + tick |
| `fullBoxWeight` | box weights `"12.4 + 11.9"`; box *k* of *n* has code `sizeGrade-(binNo − n + k)` |
| `finalBinWeight`, `gradedWeight` | final weight, calculated graded weight |

### Technical

- Definition: `roster.fixedGroups = { column: 'sizeGrade', seqColumn: 'binNo', dateField: 'gradingDate', sources: [cultivated, ranched], boxList: 'fullBoxWeight' }`; `fullBoxWeight.boxEntry`; start-weight `carryPrev.match = 'sizeGrade'`. Applied by `scripts/apply-grading-bin-no-removed.mjs`, then `snapshot-one-def.mjs` ×2 and `seed-definitions.mjs`.
- Server: `GET /api/roster-last-by-group/binNo?...` returns each grade's latest bin number in one call.
- Engine: `public/lib/form-record.js` v64 (grade table, box pop-up, confirm cell). Trace: `public/lib/traceability.js` v10 (indexes each box code). Styles: `record-theme.css` `.fr-bin-row`, `.fr-bin-sheet` (tv18).

### Known gaps

- Loading real bin numbers and box codes from the database is not yet tested live (the local preview has no database access).
- Logs saved before 2026-09-30 have no per-box codes in the trace.
- The old `binNo` column in the `sub_*` table was kept (it is used again).

---

## REC 7.4.3.1 and 7.4.3.2: Totals section starts collapsed (instructions for Claude Code)

> **Source:** `rec-7.4.3-totals-section-start-collapsed-instructions.md`

**Date:** 2026-10-01
**Raised by:** Michaela: "7.4.3 'totals and sign off' always collapse". Clarified: **only the Totals section starts collapsed.** Sign off stays open like every other section.
**Scope:** REC 7.4.3.1 and REC 7.4.3.2 (the two grading records) only. Display behaviour only. No change to fields, keys, labels, calculations, validation, DB columns, CSV or print content.
**Related:** `record-sections-collapse-and-job-autofocus-instructions.md` (all sections collapsible, all open on load; this is the one agreed exception), `rec-7.4.2-job-info-section-split-instructions.md`.

### 1. Rule

1. On both records, the **Totals** section loads **collapsed** on a new entry, every time. All other sections, including **Sign off**, load **open** as per the collapse brief.
2. This is the only page-level use of `collapsedByDefault: true`. The collapse brief said not to use it anywhere; this brief overrides that for these two records, Totals section only.
3. Totals remains **calculated and read-only**. Collapsing hides it, it does not stop it calculating. Values keep updating while folded.

### 2. Collapsed header shows a one-line summary

So the user can see the result without opening it, the Totals header shows the key figure(s) as muted text, updated live, for example `TOTALS: dried weight 842.5 kg`. Use the figures the section already calculates (confirm which: total dried weight, yield % if present). Blank until values exist, never NaN or 0. If there is no number yet, the header shows only `TOTALS`.

### 3. When it must open

- **User tap on the header:** opens, stays open until the user closes it. Do not re-collapse on recalculation, on typing in other sections, or when a job is picked.
- **Validation failure inside Totals** (if the section has any required or checked field): expand it, scroll to and focus the first problem, show the message.
- **Existing entry or restored draft opened for edit or view:** Totals **open**, same as the other sections (the collapse is for new entries only). Say so back to Michaela if she wants it collapsed there too.
- **Print, PDF, CSV, submitted read-only view:** Totals always **expanded and printed**, regardless of on-screen state.

### 4. Safety checks

- Add the setting in the record definition for these two records (a section flag such as `collapsedByDefault: true` on the Totals section), not a hard-coded section title check in shared code.
- Confirm the Job info auto-collapse still acts only on the job picker section and does not touch Totals (guard from the 7.4.2 brief).
- If a record has no section named Totals, stop and report back. Do not guess another section.
- Bump the `?v=` script strings on both record pages (and `form-record.js` / `monitoring-log.js` if shared code is touched).

### 5. Test

1. New entry on 7.4.3.1 and 7.4.3.2: Totals folded (▸), every other section open (▾), Sign off open and enterable.
2. Enter grading values: folded header summary updates live, no NaN, no 0 placeholders.
3. Open Totals by tap: stays open while typing elsewhere and after recalculation.
4. Pick or change the job: Totals state is not changed by it.
5. Submit with Totals closed: saved totals identical to when it is open. CSV unchanged.
6. Print preview and the submitted read-only view: Totals shown in full.
7. Open an existing entry and a saved draft: Totals open.
8. Tablet width: header tap target at least 44px, no horizontal scroll.

### 6. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.3-totals-section-start-collapsed-instructions.md` and follow it. On REC 7.4.3.1 and 7.4.3.2 only, make the Totals section load collapsed on new entries (Sign off stays open), with a live one-line summary in its header. Use a section flag in the record definition. Totals still calculates while folded, opens when tapped and stays open, always prints and exports expanded, and opens normally for existing entries and drafts. Do not change fields, calculations, DB columns or exports. Bump the `?v=` strings, run section 5 and write a short work log.

---

## REC 7.4.4 Grading, Boxing & Traceability: replace the input form with a report (instructions for Claude Code)

> **Source:** `rec-7.4.4-replace-form-with-report-instructions.md`

**Decision (Michaela, 2026-10-01):** the data already sits in other records, so REC 7.4.4 does not need to be a typed form. Keep REC 7.4.4 as a **report** that is generated from the existing records. No coding was done in writing this; this file is the brief.

### 1. Why the form is redundant

Live definition of `grading-boxing-traceability` (REC 7.4.4): job no. (+ receiving date, farm, processing for, whole weight), date created, bin code, size grade, and a free-text "Job numbers in bin".

Everything in it is held elsewhere:

| 7.4.4 content | Already captured in |
|---|---|
| Job no., receiving date, farm, processing for, whole weight | Receiving (REC 7.1.2) via the job lookup |
| Bin code, size grade (one bin per size grade) | REC 7.4.3.1 / 7.4.3.2 "Collection bins" roster (`binCode`, `sizeGrade`, `binNo`) |
| Which jobs are in a bin (blending) | REC 7.4.3.1 / 7.4.3.2. The roster's `fixedGroups` setting reads both grading logs (`sources`) and continues the bin per size grade across jobs, so a topped-up bin carries the same bin code in each job's log. **Confirmed by Michaela: topping up with several jobs is carried through by the 7.4.3 format.** |
| Bin to box | REC 7.4.8 (box code, NRCS AG code, weight, `binCode` per box); REC 7.4.5 (`binCode`, size range, nett weight) |

The "Job numbers in bin" free text is the weakest field in the system (cannot be joined or filtered) and is duplicated information.

### 2. Hard dependency: do NOT hide the 7.4.4 form first

The current bin index (`bin_link`, `Traceability.jobsForBin`) is fed by REC 7.4.4 (`binField: binCode`, `binJobsField: jobNumbersInBin`). Removing the form first breaks bin-to-job lookups. Build in this order, as separate changes:

1. **Feed the index from 7.4.3.1 and 7.4.3.2.** On save, write one `job -> bin` edge per Collection bins roster row into `stock_link` (schema in `claude/dry-export-pack-front-page-rebuild-instructions.md` section 9.3), written by the API in the same transaction as the submission. Replace that submission's edges on every save so a re-save creates no duplicates. A bin code that appears under two jobs yields two edges, which is how blending shows up.
2. **Backfill.** One script under `scripts/`: build `stock_link` from existing 7.4.3.1/7.4.3.2 submissions, and also from existing 7.4.4 submissions (split the free-text "Job numbers in bin" on commas/spaces/new lines; validate each against `^(3CP|3DP|CPR|DPR)\d+$`). Report rows created per record type, and list every submission that could not be linked (missing or malformed key) for Michaela to review. Do not guess.
3. **Reconcile.** For every bin that exists in 7.4.4 data, check that the 7.4.3 edges give the same set of jobs. Output a mismatch list. Resolve mismatches before step 5.
4. **Build the report** (section 3).
5. **Then** hide the 7.4.4 entry form (section 4).

### 3. The report

Title: **REC 7.4.4 Grading, Boxing & Traceability (report)**. Read-only, generated from `stock_link` plus the proving submissions. One API call per view, no per-row lookups in the browser.

**Inputs (any one):** job number, bin code, box code, NRCS AG code, export/invoice no. Direction is automatic (forward and backward).

**Layout, one row per bin:**

| Column | Source |
|---|---|
| Bin code | 7.4.3.x roster |
| Size grade | 7.4.3.x roster |
| Job number(s) in bin | all `job -> bin` edges for that bin (one per contributing job) |
| Graded weight per job (kg) | `gradedWeight` on the roster row |
| Date graded | `gradingDate` |
| Box codes + NRCS AG code(s) | 7.4.8 rows where `binCode` matches |
| Export / invoice no. | 7.4.8 header, via the box-to-export edge |
| Source record links | link to each proving submission (7.4.3.x, 7.4.5, 7.4.8) with status (draft / submitted / verified) |

Show a blended bin clearly (for example a "2 jobs" badge, expandable to the per-job weights). Show a warning row where a bin has boxes but no grading edge, or a grading bin with no boxes yet (still in stock).

**Optional mass balance per bin:** weight in (sum of graded weights) against weight out (sum of box weights), with a tolerance and a flag. Show it on the report only.

**Output:** on-screen table, print layout (A4 landscape, header with generated-on date/time, user, and the query used), and CSV export. The print is the audit evidence for a mock recall, so it must carry the "generated on" stamp.

### 3a. Box code = bin code (confirmed by Michaela, 2026-10-01)

The physical bin and the box are the same unit: once the abalone is sealed, the bin code becomes the box code. So there is **no separate bin-to-box link to build**. The chain is `job -> bin/box code -> export invoice`.

- In `stock_link`, do not create a separate `box` node type for this. Treat `box` and `bin` as the same key (a box lookup is a bin lookup). This supersedes the separate bin and box steps in section 9.1/9.5 of `dry-export-pack-front-page-rebuild-instructions.md`.
- REC 7.4.8 has both `boxCode` and `binCode` per box. They must hold the same value. Preferred: keep `boxCode` (it is the label name) and make `binCode` read-only, auto-filled from it, or drop the extra column. If both stay, add a check that flags any row where they differ. Decide with Michaela; do not delete existing data.
- Validate on save that every 7.4.8 box code exists as a bin code in a 7.4.3.1/7.4.3.2 grading record. Warn (not block) when it does not: this catches typos and boxes with no grading record.
- REC 7.4.5 `binCode` is already the box code, so no change. Show it on the report as "Bin / box code".
- Report column "Box codes" becomes "Bin / box code", and the box lookup input is the same field as the bin lookup.
- Add to the tests: a 7.4.8 box code that matches no grading bin is flagged; a box code typed with different case or spacing is normalised (trim, upper-case) before matching, both in the index and the lookup.
- Weight check: a sealed box is one bin, so the box nett weight (7.4.5 / 7.4.8) can be compared directly with the bin's graded weight for the mass balance in section 3.

### 3b. Per-shipment snapshot via the Dry Export Pack (confirmed by Michaela, 2026-10-01)

The saved copy of the report belongs to the export pack, not to a separate form.

- On the Dry Export Pack Front Page, when the pack is **submitted**, the system generates the trace report for that shipment's export/invoice no. and stores it with the submission as an immutable snapshot (JSON of the rows plus a rendered print/PDF copy). Saving a draft does not freeze it; the draft shows the live report.
- Snapshot content: invoice no., generated-on date/time, generated-by, the exact rows shown (bin/box code, size grade, jobs and weights, 7.4.8 AG codes, source submission ids and their status at that moment), and any warnings (unmatched box codes, weight differences).
- Store it in a table such as `export_trace_snapshot (id, export_no, submission_id, generated_at, generated_by, rows_json, pdf_ref)`, linked to the export pack submission. Plain SQL, exportable. A re-submitted or corrected pack creates a **new** snapshot; old ones are kept, never overwritten.
- The pack's attachments checklist gets a read-only line "Trace report (REC 7.4.4)" showing the snapshot date and a link to it. It is generated by the system, so it is not typed and not an upload.
- A snapshot taken while the report has warnings shows them. Whether warnings block Submit is for Michaela to decide; default is warn only.
- The live report stays available for any job, bin or invoice at any time. The snapshot is the evidence of what was true when the shipment was packed.
- Test: submit a pack, then change a source record; the snapshot is unchanged and the live report shows the change. Re-submit the pack; a second snapshot is created.

### 4. Retiring the entry form

- Do not delete the record definition or any submission. Old 7.4.4 submissions stay readable and are shown on the report as a "legacy 7.4.4" source.
- Remove 7.4.4 from the "new entry" list and point its menu entry to the report. Keep the REC number and title so the master record index, REC 8.1.7 (Traceability Mock Recall, Dried Abalone) and any controlled-document list still resolve.
- Update REC 8.1.7's wording if it implies a filled-in 7.4.4 form is attached.
- **Controlled-document status (confirmed by Michaela, 2026-10-01):** REC 7.4.4 is a controlled document, but because the records around it (7.4.3.x, 7.4.5, 7.4.8) are controlled, the FSMS traceability requirement is met without 7.4.4 as a stand-alone form. Retire it as a form: mark it "withdrawn / superseded by system report" in the document register using the normal document-change process, keeping the REC number for the history. Make sure the surrounding controlled records stay locked after submission and carry an audit trail, since they are now the evidence.
- Update `data/record-definitions.json`, `public/data/record-defs/` and the live definition tables together, and bump the definition version. Do not run `seed-definitions.mjs` against a stale JSON (known drift, see the front-page instructions).

### 5. Database and portability

- Plain SQL table `stock_link`, no vendor-specific features, so it exports to CSV or moves to another database (Neon free tier today).
- Required indexes: `(from_type, from_key)`, `(to_type, to_key)`, `(record_key, submission_id)`.
- Target: 95th percentile under 300 ms on a warm system with 100,000 edges. Add an `EXPLAIN` test.
- Keep Neon compute from suspending in working hours and keep the API warm, otherwise the first request each morning is slow regardless of query tuning.

### 6. Testing checklist

1. Job with three size grades: the report shows three bins with their weights.
2. Bin topped up by two jobs: both jobs appear on that bin, with per-job weights.
3. Start from a box code in 7.4.8: it walks back to the bin and every contributing job.
4. Start from invoice 4910: all 38 boxes, their bins, and all contributing jobs.
5. A submission saved twice creates no duplicate edges.
6. Backfilled legacy 7.4.4 data matches the 7.4.3 edges, or appears on the mismatch list.
7. A bin with boxes but no grading record is flagged, not hidden.
8. Printout shows the generated-on stamp, user and query; CSV matches the screen.
9. Old 7.4.4 submissions still open read-only.
10. Timing test with a large seeded table.

### 7. Open questions for Michaela

1. ~~Controlled document?~~ Resolved: yes, controlled, but not needed as a form for FSMS because the surrounding records are controlled (section 4). Still needed: whoever owns the document register raises the change.
2. ~~Box code vs bin code?~~ Resolved: the box code **is** the bin code, renamed because the abalone is sealed in the box (section 3a).
3. ~~Snapshot per shipment?~~ Resolved: yes, saved through the Dry Export Pack front page (section 3b).

---

## Give every monitoring log the same COMPLETED BY block

> **Source:** `Claude outputs/monitoring-logs-completed-by-block-instructions.md`

**Goal:** every record in the system ends with the same block: **Completed by / Title / Date / Signature**, and the name lands in that record's `completedBy` TEXT column in Neon. Form-style records (79) already do this. This file covers the **52 monitoring logs**, which do not.

Status when this was written (2026-09-29): the Neon definitions, `data/record-definitions.json`, the 42 changed offline cache files and `src/submission-store.js` were already updated for the form-style records. Nothing below has been applied yet.

Do the steps in order. Do NOT run `prisma migrate` or `prisma db push` (unrelated schema drift, see SIGNOFF_MIGRATION_TODO.md).

### What the block is

The form-record engine (`public/lib/form-record.js`, around line 1438) renders it with `window.SignOffBlock.completedByHtml({ byId, titleId, dateId, signatureId, gridClass, fieldClass })` (`public/lib/signoff-block.js`). On submit it saves `entry.completedBy = { by, title, date, signature }` and clears the four inputs after saving. It pre-fills "Completed by" from `window.Auth.getCurrentUsername()` (`suggestCompletedBy`). Copy that behaviour exactly.

### Step 1 - Database: add the column to the 52 monitoring-log tables

Run `add-completedby-to-monitoring-log-tables.sql` (sits next to this file) in the Neon SQL Editor. It is `ADD COLUMN IF NOT EXISTS "completedBy" TEXT` per table, in one transaction, and safe to re-run. Two tables (REC 7.2.12, REC 7.6.8) already have the column.

Then keep the schema files in step **by hand, without migrating**: add `completedBy String?` to each of the 52 `sub_*` models in `prisma/submission-models.prisma` and `prisma/schema.prisma` (a few already have it). If `scripts/generate-submission-schema.mjs` builds these models from the definitions, add a rule there so every record gets one `completedBy String?` column, regenerate, diff, and merge only that change. Run `npx prisma generate` afterwards (codegen only).

### Step 2 - Add the block to the monitoring-log page (`public/lib/monitoring-log.js`)

1. **Markup.** In `logBlockHtml(ns, blockTitle, inline)`, inside `fieldsAndActions`, insert between `<div id="${ns}_modalFields" ...></div>` and the `.ml-actions` div:

   - a small label "Completed by" (same style as form-record: `ml-muted`, 10.5px uppercase), then
   - `window.SignOffBlock.completedByHtml({ byId: ns + '_cb_by', titleId: ns + '_cb_title', dateId: ns + '_cb_date', signatureId: ns + '_cb_signature', gridClass: 'ml-grid ml-grid-4', fieldClass: 'ml-field' })`.

   `fieldsAndActions` is shared by the modal and inline layouts and by `customBody` pages (REC 7.2.12, 7.2.4), so one insert covers all 52.

2. **openForm(id).** After the fields are rendered: if editing an entry that has `existing.completedBy`, fill the four inputs from it; for a new entry clear them and pre-fill "Completed by" from `window.Auth.getCurrentUsername()` (add a `suggestCompletedBy` like form-record's, and re-run it on `authSuccess`). When `locked` (submitted entry) disable the four inputs together with the other inputs.

3. **saveForm(finalize).** Read the four inputs into `completedBy = { by, title, date, signature }` (trimmed).
   - Logs with `submitFlow`: only require the block when `finalize` is true. If `window.AUTH_GATES_ENABLED === true` and any of the four is empty, `toast('Completed by, title, date and signature are required to submit.')` and return. Store it on the entry only when `finalize` is true, same as form-record.
   - Logs without `submitFlow` (plain "Save entry"): every save is the completion, so apply the same required check on save and always store it.
   - Set `savedEntry.completedBy = completedBy` in both branches (edit-existing and new entry), next to where `submittedAt` is set.
   - Clear the four inputs in `closeForm()`/after a successful save, like form-record does.

4. **Printed sheet.** In `buildEntrySheet`, the "Completed by:" row currently shows the `operator` role field and leaves Title and Signature blank. Change it to `entryRow.completedBy` (by, title, date, signature), falling back to the old `operator` value and `submittedAt` date for entries saved before this change. Leave the Verified by row alone. `customBody.sheetHtml` pages (7.2.12) must show the same row.

5. **Entry list / CSV / JSON export.** No change needed: the block is stored on the entry, not in `values`. Optionally add "Completed by" as a last column in CSV export.

### Step 3 - Feed the column (`src/submission-store.js`)

`completedByText(entry, values)` and the `blockCompletedBy` check already exist. Change the condition in `getSchema` from `def.engine === 'form-record'` to also include `'monitoring-log'`. It checks `information_schema` for the column once per record, so a table without it can never break saving. Keep the `values.completedBy` fallback so REC 7.2.12 / 7.6.8 values already stored are kept.

### Step 4 - Remove the two old "Completed by" fields on monitoring logs

- **REC 7.2.12** (`double-seam-inspection-report`): entry fields `completedBy` ("Completed by") and `completedDate` ("Completed date"). This is a `customBody` page, so also check `public/records/*7.2.12*.html` for its own inputs and remove them, so it does not show two sign-offs.
- **REC 7.6.8** (`allergen-cleaning-verification`): entry field `completedBy` ("Completed by").

Remove them from the definitions everywhere: `data/record-definitions.json`, the Neon tables (`DELETE FROM "RecordFieldDef" WHERE "recordKey" IN ('double-seam-inspection-report','allergen-cleaning-verification') AND key IN ('completedBy','completedDate')`, then bump `version` on both `RecordDefinition` rows; take a backup copy of `RecordFieldDef` first), and re-export the two files in `public/data/record-defs/` (`node scripts/export-record-defs.mjs`). Only do this after Step 2 is deployed, otherwise those two logs briefly have no sign-off at all. `completedDate` is dropped because the block already has a Date.

### Step 5 - Bump cache-busting

Raise the `?v=` on the `monitoring-log.js` script tag in every monitoring-log page (or wherever the shared shell loads it) so browsers fetch the new file.

### Step 6 - Test before telling anyone it is done

1. Open REC 7.2 (a plain log), REC 7.4.2 (a `submitFlow` log if any), REC 7.2.12 and REC 7.6.8. Each must show the COMPLETED BY block once and no other sign-off.
2. Add an entry, save, reload: the four block values come back when you edit the entry.
3. In Neon: `SELECT "completedBy", "rawJson"->'completedBy' FROM sub_<table> ORDER BY "createdAt" DESC LIMIT 3;` shows the name in the column and the full object in `rawJson`.
4. Print an entry sheet: the Completed by row shows name, title, date, signature.
5. Confirm a form-style record (for example REC 7.1.5) still saves and its `completedBy` column fills.

### The 52 monitoring logs and their tables

- Live Leftovers Log — `live-leftovers-log` → `sub_live_leftovers_log`
- Mortalities Log — `mortalities-log` → `sub_mortalities_log`
- QA1 — `qa1-damaged-cans-and-lids` → `sub_qa1_damaged_cans_and_lids`
- REC 01 — `cans-released-form` → `sub_cans_released_form`
- REC 1 — `gonad-inspection-report` → `sub_gonad_inspection_report`
- REC 7.1 — `incubator-cans-log` → `sub_incubator_cans_log`
- REC 7.1.00 — `fixed-reader-checks` → `sub_fixed_reader_checks`
- REC 7.1.6 — `scrubbing-check-supervisor` → `sub_scrubbing_check_supervisor`
- REC 7.10.2 — `ph-verification` → `sub_ph_verification`
- REC 7.10.3 — `thermometer-verification` → `sub_thermometer_verification`
- REC 7.10.4 — `thermometer-correction-factors` → `sub_thermometer_correction_factors`
- REC 7.2 — `sampling-log` → `sub_sampling_log`
- REC 7.2.10 — `stock-loading` → `sub_stock_loading`
- REC 7.2.12 — `double-seam-inspection-report` → `sub_double_seam_inspection_report`
- REC 7.2.4 — `abalone-packing-specification` → `sub_abalone_packing_specification`
- REC 7.4.1 — `drying-process` → `sub_drying_process`
- REC 7.4.2 — `dry-monitoring` → `sub_dry_monitoring`
- REC 7.4.5 — `boxing-and-labelling` → `sub_boxing_and_labelling`
- REC 7.4.6 — `dry-stock-control` → `sub_dry_stock_control`
- REC 7.4.7 — `labelling-of-dry-boxes` → `sub_labelling_of_dry_boxes`
- REC 7.4.9 — `dry-stock-transfers` → `sub_dry_stock_transfers`
- REC 7.5.1 — `live-production-pack` → `sub_live_production_pack`
- REC 7.5.2 — `live-pack-checklist` → `sub_live_pack_checklist`
- REC 7.5.5 — `receiving-live-returns` → `sub_receiving_live_returns`
- REC 7.6.2.2 — `dispatch-cleaning-inspection` → `sub_dispatch_cleaning_inspection`
- REC 7.6.4 — `chemical-stock-issue-register` → `sub_chemical_stock_issue_register`
- REC 7.6.5 — `internal-pest-sightings-log` → `sub_internal_pest_sightings_log`
- REC 7.6.8 — `allergen-cleaning-verification` → `sub_allergen_cleaning_verification`
- REC 7.7.5 — `glove-issuing-register` → `sub_glove_issuing_register`
- REC 7.7.6 — `plaster-dressing-inspection` → `sub_plaster_dressing_inspection`
- REC 7.7.6a — `first-aid-checklist-record` → `sub_first_aid_checklist_record`
- REC 7.7.7 — `salt-issuing-register` → `sub_salt_issuing_register`
- REC 7.8.1 — `chiller-batch-control` → `sub_chiller_batch_control`
- REC 7.8.1 — `dry-chiller-batch-control` → `sub_dry_chiller_batch_control`
- REC 7.8.11 — `water-tank-inspection` → `sub_water_tank_inspection`
- REC 7.8.2 — `daily-waste-removal` → `sub_daily_waste_removal`
- REC 7.8.3 — `boiler-inspection-report` → `sub_boiler_inspection_report`
- REC 7.8.4 — `seamer-inspection-report` → `sub_seamer_inspection_report`
- REC 7.8.5 — `incoming-ppe-inspection` → `sub_incoming_ppe_inspection`
- REC 7.8.5.1 — `incoming-goods-inspection-log` → `sub_incoming_goods_inspection_log`
- REC 7.8.6 — `cans-incoming-inspection` → `sub_cans_incoming_inspection`
- REC 7.8.6.1 — `lids-incoming-inspection` → `sub_lids_incoming_inspection`
- REC 7.8.6.2 — `lids-incoming-inspection-internal` → `sub_lids_incoming_inspection_internal`
- REC 7.8.7 — `incoming-goods-inspection` → `sub_incoming_goods_inspection`
- REC 7.8.8 — `dispatch-loading-inspection-checklist` → `sub_dispatch_loading_inspection_checklist`
- REC 7.8.8.1 — `dispatch-receiving-checklist` → `sub_dispatch_receiving_checklist`
- REC 7.8.9 — `water-monitoring` → `sub_water_monitoring`
- REC 7.8.9.1 — `lha-water-monitoring` → `sub_lha_water_monitoring`
- REC 7.9.1 — `chiller-temperature-monitoring` → `sub_chiller_temperature_monitoring`
- REC 7.9.2 — `incubator-temperature-check` → `sub_incubator_temperature_check`
- REC 7.9.3.1 — `dry-room-temp-humidity-log` → `sub_dry_room_temp_humidity_log`
- REC 7.9.3.2 — `grading-room-temp-humidity-log` → `sub_grading_room_temp_humidity_log`

### Known limits

- Entries saved before this change have no block. Their column stays as it was (empty, except 7.2.12 / 7.6.8 where it holds the old field value) until the entry is saved again.
- Title, date and signature are kept in `rawJson`, not in their own columns. If you want to query them, add three more TEXT/DATE columns later.

---

## Dry Export Pack Front Page — auto-populated Attachment Checklist (instructions for Claude Code)

> **Source:** `claude/dry-export-pack-attachment-checklist-instructions.md`

**Requested by:** Michaela, 2026-09-22
**Target file:** `public/records/Dry-Export-Pack-Front-Page-dry-export-pack-front-page.html`
**Do not code this in chat/Claude Design — hand this file to Claude Code as-is.**

### What Michaela asked for

On the Dry Export Pack Front Page, replace the current manual "Attachments checklist" (five
plain yes/no toggles the operator fills in by hand) with a checklist backed by the actual
records, not a self-reported tick — exactly the pattern already built for NRCS Canning (see
`claude/nrcs-canning-add-view-verify-gate-instructions.md`):

1. **Auto-adds the records** — once a job number is entered, every record required for that job
   is found and listed automatically, the same way the NRCS Canning "Records for this job"
   roster already works (see `claude/nrcs-canning-add-view-verify-gate-instructions.md` and the
   `recordpick`/`jobtrace` pattern used on REC 8.1.6b and REC 8.1.7 — this codebase already has
   this exact mechanism, it just isn't wired up on this page yet).
2. **User must approve** — auto-added rows are not silently treated as done. Approval here means
   the same thing it means on the NRCS Canning gate: the row's status reflects whether the real,
   linked record has actually been completed and verified (Not attached / Draft — not yet
   submitted / Awaiting verification / Verified), not a plain yes/no checkbox the preparer ticks
   by hand. The person filling in the form must confirm each row against the real record's status
   before it counts as attached — see "What to build" below, which replaces the earlier
   "Approved by preparer: yesno" idea with this same verified-status gate.
3. **All required records must be listed, and all must be attached, based on job number** — the
   checklist is not just the 5 legacy REC codes hardcoded today; it must include every record
   type that SOP-56 (Dry Export) and the traceability roster already say belongs to a dry export
   job (see the full list on REC 8.1.7's roster description below), and the front page must not
   allow marking the pack complete until every one of those is attached.

### Current state (what exists today)

The live page ships as a set of 5 static yes/no fields:

```js
{ title: 'Attachments checklist', fields: [
  { key: 'rec747Attached', label: 'REC 7.4.7 Labelling of Dry Boxes attached?', type: 'yesno' },
  { key: 'rec748Attached', label: 'REC 7.4.8 Dry Labelling List attached?', type: 'yesno' },
  { key: 'rec749Attached', label: 'REC 7.4.9 Dry Stock Transfers attached?', type: 'yesno' },
  { key: 'signedPackingListsAttached', label: 'Signed packing lists attached?', type: 'yesno' },
  { key: 'healthCertificatesAttached', label: 'Health certificates attached?', type: 'yesno' }
]}
```

This is a manual checkbox list — nothing looks up whether the record actually exists for this
job, and nothing stops the operator ticking "yes" on a record that was never filed. That's the
gap this change closes.

The mechanism to fix it already exists elsewhere in the codebase and must be reused, not
reinvented:

- `recordpick` / `source: 'jobtrace'` roster columns (`wireRecordPick` in `public/lib/form-record.js`)
  — given a job number field, offers a dropdown of only the records actually filed against that
  job number, and can auto-fill other columns from the picked record (`fillCode`, `fillName`, or
  the newer generic `fillMap`).
- `window.Traceability.trace(jobNo)` (`public/lib/traceability.js`) — resolves a job number to
  the specific submissions filed against it.
- The verify-gate roster pattern from `claude/nrcs-canning-add-view-verify-gate-instructions.md`
  — a `required: true` flag on a roster column, a status badge per row
  (Not attached / Draft — not yet submitted / Awaiting verification / Verified (date)), and a
  finalize-time block (`saveForm(finalize)` in `form-record.js`) that refuses to submit until
  every required roster row is attached **and** verified. Draft saves are never blocked by this.
- REC 8.1.7 (Traceability Mock Recall — Dried Abalone) already lists, in its roster title, the
  full set of record types that belong to a dry-line job: Dry Cooking (7.4.0), Drying Process
  (7.4.1), Dry Monitoring (7.4.2), Grading Production Log (7.4.3.1/7.4.3.2), Grading & Boxing
  Traceability (7.4.4), Boxing & Labelling (7.4.5), Dry Stock Control (7.4.6), Labelling of Dry
  Boxes (7.4.7), Dry Labelling List (7.4.8), Dry Stock Transfers (7.4.9), Dried Abalone Transfer
  (7.4.10), plus incoming/COA and cleaning/hygiene records. This is the reference list for "all
  required records" on a dry export job — use it as the starting checklist, not the 5 legacy
  fields currently on the front page.

### Bigger structural issue found while scoping this: bin code, not job number, is the real link

Before the REC 7.4.8 wrinkle below, a more fundamental gap surfaced and was confirmed with
Michaela: **a single dry export shipment is packed from bins that blend stock from multiple job
numbers.** Grading splits one job's dried output across several physical bins
(`REC-7.4.3.1-grading-production-log-cultivated.html` and
`REC-7.4.3.2-grading-production-log-ranched.html` each carry a job number on the record itself,
plus a "Collection bins" roster of `{ binCode, binWeightStart, fullBoxWeight, finalBinWeight,
gradedWeight }` rows — i.e. one job's graded stock gets divided into multiple named bins). At
packing/export time, boxes are filled by pulling from whichever bins are on hand, which may carry
stock originally graded under different job numbers. So "attach records for this job number" is
the wrong model for the checklist as a whole, not just for REC 7.4.8: a job-number-only lookup on
the Dry Export Pack Front Page will systematically miss records tied to the *other* job numbers
whose bins fed this shipment.

**What exists today vs. what's missing:**
- Bin codes already exist as data, but only as a roster sub-field on REC 7.4.3.1/7.4.3.2 — there
  is no top-level `bin-code → job number(s)` index anywhere in the codebase.
  `Traceability.trace()` only accepts a job number as input; it has no reverse lookup from bin
  code to job number, and `TRACEABILITY.md` explicitly notes today's indexing is "one entry per
  job number" — a roster sub-field like `binCode` is not currently indexed at all (see
  `TRACEABILITY.md`'s own note: "where `jobNumber` is a per-row roster/log column rather than one
  value for the whole submission, indexing needs a small extension").
- No downstream record (Dry Labelling List, Dry Stock Transfers, Dry Export Pack Front Page)
  currently captures which bin code(s) were used to fill a given shipment/box, so even once a
  bin→job index exists, something has to capture "these bin codes went into this shipment" at
  labelling/packing time for the chain to be walkable end to end.

**Build decision — do this in two parts, sequenced, not as a single change to the front page:**

1. **Engine change (do first, separately, low risk):** extend `Traceability` with a bin-code
   index. When REC 7.4.3.1/7.4.3.2 save, in addition to today's whole-submission job-number
   indexing, also write one `bin_link:<binCode> → { jobNumber, recordKey, submissionId }` entry
   per collection-bin roster row (mirrors the existing `batch_link:<job>:<record>:<submission>`
   pattern in `TRACEABILITY.md`, just keyed by bin code instead of job number). Expose a lookup
   function, e.g. `Traceability.jobsForBin(binCode)` returning the job number(s) that bin's stock
   came from — a bin could in principle be topped up from more than one job's grading run, so this
   should return an array, not assume one job per bin.
2. **Capture bin codes on the shipment itself.** **Confirmed with Michaela: this belongs on REC
   7.4.8 Dry Labelling List**, not the Dry Export Pack Front Page — that's the record where box
   code and NRCS AG code are already assigned per box at labelling time, and bin code is the same
   kind of per-box/per-shipment detail known at that point. Add a bin code field/column to REC
   7.4.8's roster (alongside Box No./Grade Range/Box code/NRCS AG Code) to record which bin
   code(s) fed each box. Without this, there is nothing to resolve bin→job against for a *given*
   shipment.
3. **Only then** can the front page's attachment checklist auto-populate correctly: resolve the
   shipment's bin code(s) → the set of job number(s) via `Traceability.jobsForBin()` → run the
   existing `jobtrace` auto-match roster once per resolved job number, unioning the required
   records found across all of them (a required record type is satisfied once any of the
   contributing jobs has it attached+approved — confirm this "satisfied by any one job" logic
   with Michaela, since a stricter read might require it per job).

**Resolved:** bin code capture goes on REC 7.4.8 Dry Labelling List (see point 2 above) — the same
record where box code and NRCS AG code are already assigned per box at labelling time. This is
now settled, not an open question.

### Correction: sales sends templates *into* this system for production to complete — not just reference files

**Confirmed with Michaela (2026-09-22):** the sales department's own online application produces
the labelling list and packing list per shipment (see the `export-manager` folder structure
below), and **sends these to production, where production fills in its own required columns and
saves the completed record within this processing system** — the same way REC 7.4.8 works today
(sales/Abagold's labelling-list template comes in with Box No./Grade Range pre-populated, and
production fills in Box code + NRCS AG Code before saving/signing). The packing list works the
same way: sales' packlist is the starting point, and production's completed version is what gets
saved and filed here, not left as a standalone spreadsheet in a network folder.

**This changes what "attach the record" means for these two items:** REC 7.4.8 (Dry Labelling
List) and the packing list are not external documents the checklist needs to somehow verify exist
on a file share — they are **records that get created and saved inside this same system**, by
production, using sales' data as the starting template. So the correct build is not "read the
sales network folder to confirm a file exists" — it is: (a) sales' data needs a way to get into
this system as the starting point for the record (e.g. an import/starting-values step, scoped
separately — see open question below), and (b) once production completes and saves it, it is a
normal filed submission like any other, so it participates in the roster/`recordpick`/verify-gate
mechanism used throughout this spec exactly like every other required record. Do not design the
checklist around "check whether a file exists in a folder" — design it around "has production
completed and saved this record in the system yet," which is the same Verified-status gate
already specified above.

**Open question to confirm with Michaela before Claude Code builds any import step:** how should
sales' data (from the `export-manager` folder, or from wherever sales' online application outputs
land) actually get into this system as the starting point for production's REC 7.4.8 / packing
list entry — a manual copy-paste by whoever starts the record, an upload of the sales-provided
file, or an automated pull from the `export-manager` folder? This is a real scoping decision
(reading an arbitrary Windows file share from a browser-based app is a different capability than
anything in this system today) and should not be assumed — flag it as a separate follow-up rather
than building it as part of this checklist change.

### Reference: the sales export number (`EXP-####`) as a shipment-level identifier

Michaela shared the sales department's own file store — `export-manager` (a folder tree the sales
team's online application writes to, organized `<customer name>/EXP-####/...`). This shows a
shipment-level identifier that already threads through every document sales produces, independent
of job number, bin code, or AG code — useful as a reference number, per the correction above, not
as a file-existence check to build a checklist against.

**Confirmed folder pattern** (checked across three different customers — Ocean Treasure, Grand
Seafood, Hai Tung — all consistent):

```
<customer name>/
  EXP-4910/
    EXP-4910_2026-09-16_<customer>_AMI_Invoice.xlsx / .pdf
    EXP-4910_2026-09-16_<customer>_BF60A_Health_Cert.docx
    EXP-4910_2026-09-16_<customer>_Packlist.xlsx / .pdf
    EXP-4910_2026-09-16_<customer>_Packlist_Summary.xlsx / .pdf
    EXP-4910_2026-09-16_<customer>_Standard_Invoice.xlsx / .pdf
    EXP-4910_2026-09-16_<customer>_IDN.xlsx                      (present on some shipments)
    EXP-4910_2026-09-16_<customer>_Picking_List.xlsx / .pdf      (present on some shipments)
    20260916 - <customer> - REC 7.4.6 Dry Labelling list - 4910.docx   (Abagold's own filename,
                                                                         not sales' naming — this
                                                                         is the labelling-list
                                                                         template Abagold fills in
                                                                         and returns; see note below)
    AWB & HC.pdf / COO.pdf / HC.pdf                              (loose, hand-added scans — AWB,
                                                                   health cert, certificate of
                                                                   origin — inconsistent naming,
                                                                   added manually per shipment,
                                                                   not part of the automated set)
```

Every `EXP-####` folder is the complete paper trail for one shipment: sales-generated invoice/
packlist/health-cert/picking-list documents, plus the labelling list that comes back from
Abagold once boxed and signed, plus loose freight/compliance scans added along the way.
`EXP-####` is the number sales' own system uses as its record key, and it's the one already
printed on the labelling list docx Abagold fills in (see "INV. NO. 4910" in the earlier
Ocean Treasure example) — so it is a naturally occurring, always-present field on the paperwork
already, unlike bin code or job number.

**What this changes about the plan above:** this doesn't replace the bin-code/job-number
traceability work above — REC records inside Abagold's own system are still keyed by job number
(and bin code, once that's wired up), because that's what NRCS/food-safety traceability requires.
**The only change needed here is a plain field**: add an **Export/Invoice no. (`EXP-####`)** text
field to the relevant records (Dry Export Pack Front Page and/or REC 7.4.8), simply storing the
number as printed on the sales paperwork for this shipment. That is the entire scope of this
item — just capture the number on the record. Per the correction above, do **not** build any
folder-reading, file-existence-checking, or cross-referencing mechanism against the
`export-manager` network share — that is out of scope and not something to build here.

**Do not treat this as solving the bin-code/job-number matching problem.** The `EXP-####` number
is a sales/invoice-side key; it is not tied 1:1 to job number (confirmed earlier in this document)
and it is not a food-safety traceability key NRCS would recognize — it's an additional,
reliably-present reference number worth surfacing on the front page, not a replacement for the
job-number/bin-code work above.

**Forward-looking note (confirmed with Michaela, not in scope now):** the `export-manager` folder
is itself generated by sales' own online application, not a manually-maintained file share. That
means a future direct system-to-system integration between sales' application and this processing
system is plausible (e.g. sales' app pushing shipment data — customer, invoice number, packlist
contents — directly into this system via an API, rather than production re-keying it from a
folder or file). Capturing the plain `EXP-####` field now is a small, low-risk step that would
also make a later integration easier to key against — but no integration work should be assumed
or built as part of this checklist change; it's a separate, future project to scope explicitly
with Michaela if and when it becomes a priority.

### Resolved wrinkle: REC 7.4.8 (Dry Labelling List) cannot be auto-matched — confirmed with Michaela

`dry-labelling-list` (REC 7.4.8) is indexed by `agCode`, not `jobNo`
(`public/lib/traced-records.js`: `"batchField": "agCode"`). Every other record in the dry chain
is indexed by `jobNo`/`jobNumber`, so a plain `jobtrace` lookup keyed on job number surfaces all
of them automatically — except this one.

**Confirmed with Michaela (2026-09-22):** there is no fixed mapping between a sales invoice/order
number and Abagold's job number — a job can span multiple invoices or vice versa — so there is no
reliable key to auto-resolve REC 7.4.8 submissions from the job number. The AG code itself is only
assigned when production fills in and signs the labelling list per box, starting from the
packing-instruction/packlist and labelling-list templates sales sends per invoice (see real
example: `EXP-4910` invoice, 38 cartons, sizes `DRYJ1720`–`DRYJ3639`, boxed then labelled with
Box code + NRCS AG Code before sign-off). Per the correction above, production completes and saves
both the packing list and the labelling list **within this processing system**, using sales' data
as the starting template — that completed, signed labelling list is filed as a permanent REC 7.4.8
record; it is not a pass-through/reference document, so it must be traceable and searchable like
every other filed record.

**Build decision:** do NOT try to auto-populate REC 7.4.8 into the checklist via `jobtrace`.
Instead:
1. Keep REC 7.4.8 as a **required roster row** on the Dry Export Pack Front Page checklist
   (see roster below — `sourceRecordKey: 'dry-labelling-list'`), but let the `recordpick` picker
   for that one row **fall back to the full Master Index / dry-labelling-list list** (not
   filtered by job number) so the preparer can manually find and pick the specific labelling
   list submission(s) that belong to this shipment — the same fallback behavior `recordpick`
   already has today when no job number match exists (see `wireRecordPick` in `form-record.js`:
   `if (!opts.length) opts = masterIndexOptions();`).
2. This row therefore behaves like the other checklist rows for approval/verification purposes
   (still gates Submit, still needs to reach "Verified" status via the real record's own
   verification flow) but differs in that it is never silently auto-added — it must always be a
   deliberate pick, and the UI/instructions text should say so explicitly (e.g. "Dry Labelling
   List (REC 7.4.8) is not linked by job number — search and pick the specific submission for
   this shipment.").
3. No changes needed to `Traceability.trace()` or `traced-records.js` for this — this is a UI/UX
   accommodation on the checklist roster, not an engine change.

**Cross-reference:** REC 7.4.8 is also where the bin code field from "Bigger structural issue"
above gets added (point 2 in that section) — Box No./Grade Range/Box code/NRCS AG Code/bin code
are all captured together per box on this same record, at the same labelling step.

### What to build

1. **Replace the "Attachments checklist" section** with a `roster` block (same shape as REC
   8.1.7 / REC 8.1.6b), keyed off the page's existing `jobNumber` field:

   ```js
   roster: {
     title: 'Attachment checklist — records required for this dry export job',
     columns: [
       { key: 'submissionRef', label: 'Record', type: 'recordpick', source: 'jobtrace',
         jobField: 'jobNumber', fillCode: 'recordCode', fillName: 'recordName', required: true }
       // no separate yes/no "approved" column — see below: status is read from the real record
     ]
   }
   ```

   **Do not add a plain yes/no "Approved by preparer" column.** Per the correction above, this
   must work exactly like the NRCS Canning "Add / View / Verify" gate
   (`claude/nrcs-canning-add-view-verify-gate-instructions.md`): each row's status badge
   (Not attached / Draft — not yet submitted / Awaiting verification / Verified (date)) is read
   from the real linked record's own save/verify state — not from a checkbox on this page. Reuse
   that gate's exact mechanism: the `verifiedDate` it introduces, the same status-badge classes
   (`.badge-warn`/`.badge-ok`/`.badge-muted`/`.badge-info`), and the "View" link pattern to open
   the actual record. "Approved" on this checklist means the linked record itself has reached
   Verified status via its own normal sign-off flow — never a separate rubber-stamp tick added to
   this roster.

   The REC 7.4.8 (Dry Labelling List) row is the one exception in this roster: it does not use
   job-number auto-matching (see "Resolved wrinkle" above) — its `recordpick` column should
   declare `sourceRecordKey: 'dry-labelling-list'` and rely on the existing fallback-to-Master-
   Index behavior so the preparer searches and picks it manually. Every other required row uses
   the standard `jobtrace` auto-match. Once picked, it is held to the same Verified-status
   requirement as every other row — picking it is not itself enough to satisfy the checklist.

2. **Auto-populate rows on job number entry.** When `jobNumber` is filled in (or changed), call
   the same `jobTraceOptions()`/`Traceability.trace()` path used elsewhere to fetch every
   submission filed against that job, and pre-create one roster row per required record type
   found — not just leave the roster empty for the operator to add rows one at a time. This is
   the "auto add the records" behaviour Michaela asked for; today's `recordpick` only offers
   choices in a dropdown when a row already exists, it doesn't proactively create rows. This is
   new behaviour needed on top of the existing mechanism — check whether any other page already
   auto-creates roster rows from a fixed required-list (the NRCS Canning "Production codes"
   roster is the closest precedent) before building it from scratch.

3. **Required-set definition.** Hardcode the required record-type list for this page (the REC
   8.1.7 list above, trimmed/confirmed with Michaela if some of those don't actually apply to
   "export pack" as opposed to production — e.g. does the export pack need Dry Cooking/Drying
   Process records, or only the packing/labelling/transfer/health-cert end of the chain?). Flag
   this open question back to Michaela before finalizing the required list — do not silently
   guess which subset applies.

3a. **Sequencing note:** steps 1–3 above (the roster, auto-populate, required-set) all assume a
    single job number resolves every required record. Per "Bigger structural issue" above, that
    assumption is false for a real shipment spanning multiple bins/jobs. Build and ship the
    bin-code traceability extension (bin index + bin-code capture point) as its own separate,
    prior change; only wire the front page's auto-populate step to resolve *all* contributing job
    numbers via bin code once that groundwork exists. Do not ship a version of this checklist that
    silently only checks the one job number typed into "Shipment details" — that would recreate
    the exact traceability gap this whole request is meant to close.

4. **Finalize-time gate.** Reuse the exact `saveForm(finalize)` roster-completeness check from
   `claude/nrcs-canning-add-view-verify-gate-instructions.md` engine change 3: block Submit
   (not Save draft) until every required roster row is both attached (a specific record picked)
   and Verified (per the real record's own status, not a checkbox on this page). Show a clear
   message naming which record(s) are missing or still unverified.

5. **Status badges.** Reuse the existing badge classes and meanings from the NRCS Canning gate
   exactly (`.badge-muted` = Not attached, `.badge-info` = Draft — not yet submitted, `.badge-warn`
   = Awaiting verification, `.badge-ok` = Verified (date)) — do not invent a separate "Approved"
   state for this page.

### Testing checklist

1. Enter a job number with several dry-line records already filed. Confirm the roster
   auto-populates one row per required record type, each linked to the actual filed submission
   (not just the record type name).
2. Confirm an auto-added row whose linked record is only in draft shows "Draft — not yet
   submitted" or "Awaiting verification" as appropriate — never a pre-ticked/approved state.
3. Go verify the underlying linked record via its own normal verification flow; reopen this
   checklist and confirm the row's status now reads "Verified (date)" — not because anything was
   ticked here, but because the real record changed status.
4. Try Submit with at least one required row not yet Verified or not attached — confirm it's
   blocked with a message naming the missing/unverified record(s).
5. Save as draft in the same incomplete state — confirm draft save is not blocked.
6. Verify all required rows' underlying records, confirm Submit now succeeds.
7. Confirm the REC 7.4.8 row is present as a required checklist item but is never auto-filled —
   confirm the preparer can search and manually pick the correct Dry Labelling List submission
   for this shipment, and that it is held to the same Verified-status gate as every auto-matched
   row (picking it alone does not satisfy the checklist).
8. Confirm the "View" link on an attached row opens the underlying record in a new tab (reuse
   the existing pattern from `verification-queue.html` / the NRCS Canning gate).

### Status
Not yet built. This document is the spec handoff — build directly against
`public/records/Dry-Export-Pack-Front-Page-dry-export-pack-front-page.html`,
`public/lib/form-record.js`, and `public/lib/traceability.js`.

---

## Dry Export Pack Front Page — Attachment Checklist Rework

> **Source:** `Claude outputs/dry-export-pack-checklist-worklog.md`

Session date: 2026-09-22. Spec handoff: `claude/dry-export-pack-front-page-attachment-checklist-instructions.md` (if present) — this doc is the build/testing worklog, not the original spec.

### What shipped

Replaced the manual "Attachments checklist" (5 hardcoded yes/no fields) on `Dry-Export-Pack-Front-Page-dry-export-pack-front-page.html` with a verify-gated roster of the real required dry-export records, matched automatically off the job number wherever possible.

#### Engine changes (`public/lib/traceability.js`, `public/lib/form-record.js`)

- **`bin_link:` index** — new namespace parallel to `batch_link:`, resolves a physical bin code to the job number(s) whose graded stock fed it. Fed from **REC 7.4.4 (Grading, Boxing & Traceability)**, which already captures `binCode` + a free-text `jobNumbersInBin` per submission — the record staff already fill in for this purpose. `Traceability.jobsForBin(binCode)` / `Traceability.binsForJob(jobNo)`.  can i change the free text to something else ? i would almost want the job numbers in bin to auto populate based off of the info already provided during the previous production run as the jobs in the bin do not change until the bin is emptied and at that point the user will complete the fields and submit the bin or box code 

- **`bintrace` recordpick source** — for records keyed by bin code, not job number (e.g. `boxing-and-labelling`, whose `binCode` field is literally reused as the box code on the label). Resolves job → bin(s) → submissions.
- **Bin-code auto-suggest** — on REC 7.4.4, entering a bin code auto-fills `jobNumbersInBin` from the grading logs' Collection Bins roster (now indexed via `roster.binIdColumn`), only when the field is still empty.
- **`upload` field type** — file attach/download/remove, value stored inline as a JSON blob in the submission's own `values` (no new table or endpoint), capped at 4MB. Used for Health Certificates and Sales Packing List.
- **Verified-status recognition fix** — the server's `/api/trace` endpoint already returns a three-state `status: 'draft'|'submitted'|'verified'` (see `attachSubmissionStatus` in `src/index.js`), but the shared badge/gate logic (`recordpickBadgeHtml`, both submit-gates) only recognized `'submitted'` plus a separate `verified` flag that this path never populates. This silently broke the **existing NRCS Canning gate** too, not just this new checklist. Added `recordpickAttached()`/`recordpickVerified()` helpers used consistently everywhere.
- **Per-submission fallback picker** (`recordSubmissionOptions`) — REC 7.4.8 (Dry Labelling List) can't be auto-matched by job number (it's indexed by `agCode`, and there's no reliable sales-invoice↔job-number mapping). Its manual "search and pick" fallback was silently broken: it reused the Master Index, which lists one row per *record type*, not per submission, so it could never actually offer individual Dry Labelling List submissions to choose from. Now reads the same `formrecord:<recordKey>` data the record's own "View entries" list uses.
- **Race condition fix** — `wireRecordPick` runs async trace lookups per field and is invoked twice in quick succession (page load, then again on job-number change). A generation counter now stops a slower, stale call from overwriting a newer one's correct results after the fact. This was the cause of what looked like "intermittent" badge state during testing.

#### Data changes (Neon, via `data/record-definitions.json` → `scripts/seed-definitions.mjs` → `scripts/export-record-defs.mjs`)

- `dry-export-pack-front-page`: checklist rebuilt as 6 required `recordpick` fields (REC 7.4.5, 7.4.6, 7.4.7, 7.4.8, 7.4.9, 7.4.10) + 2 `upload` fields (sales packing list, health certificates). "Signed packing lists" removed per Michaela's request — replaced with "sales packing list" as the actual document to attach.
- `grading-boxing-traceability` (REC 7.4.4): `binField`/`binJobsField` config added.
- `grading-production-log-cultivated` / `-ranched`: Collection Bins roster gets `binIdColumn: "binCode"`.
- `boxing-and-labelling` (REC 7.4.5): `batchField` set to `binCode` (was unset — record wasn't traceable at all before).
- `labelling-of-dry-boxes` (REC 7.4.7) / `dry-stock-transfers` (REC 7.4.9): had **no job or bin link field at all**. Added a `Job no.` field (same convention as the rest of the dry chain) and set `batchField: "jobNo"`.
- `dry-labelling-list` (REC 7.4.8): added a `Bin code` column to its Boxes roster.

#### Page-level fix (widespread, pre-existing gap)

5 of the 6 records this checklist depends on (`REC-7.4.4`, `7.4.5`, `7.4.7`, `7.4.8`, `7.4.9`) were **missing the `traceability.js` and/or `job-status.js` script tags entirely** — so `Traceability.indexSubmission` silently never ran, and the job-number picker never populated. Added the missing tags to those 5 pages.

**This is a much wider gap than just these 5 pages**: across the whole app, 39 of 52 `monitoring-log.js` pages and 53 of 80 `form-record.js` pages are missing `traceability.js`. Only the pages in this checklist's direct dependency chain were fixed this session — **the rest is an open follow-up**, worth a dedicated audit before relying on traceability/batch-trace features elsewhere in the app.   NB do this fix

### Verified end-to-end (real job `3DP55555`, live production)

Submitted + verified real test entries for all 6 required records against job `3DP55555` (all clearly labeled "TEST - Claude verification" in the relevant fields):
- REC 7.4.4 Grading, Boxing & Traceability — bin `TESTBIN01`, `jobNumbersInBin: 3DP55555`
- REC 7.4.5 Boxing & Labelling — bin `TESTBIN01` (resolves via bintrace)
- REC 7.4.6 Dry Stock Control
- REC 7.4.7 Labelling of Dry Boxes
- REC 7.4.9 Dry Stock Transfers
- REC 7.4.10 Dried Abalone Transfer

Confirmed via direct Neon queries (not just UI) that all 6 correctly write `batch_link`/`bin_link` index rows, and confirmed via the front page that badges correctly read "Verified" once the underlying record is verified, and "Awaiting verification" / "Not attached" otherwise. Confirmed Submit is blocked while any required row is unattached/unverified.

**Not exercised**: REC 7.4.8's manual-pick fallback (no real Dry Labelling List submission existed for this job to test against), and a genuine multi-job bin blend (only one bin/job was used in testing).

### Test data left in production

Real submitted+verified records against job `3DP55555`, all clearly labeled as test data:
- REC 7.4.4 — bin `TESTBIN01`, supervisor "TEST - Claude verification"
- REC 7.4.5 — bin `TESTBIN01`, QC/Supervisor "TEST"/"TEST"
- REC 7.4.6 — month 2026-09
- REC 7.4.7 — client "Ocean Treasure (TEST)", 38 boxes
- REC 7.4.9 — transferred/received by "TEST Transferrer"/"TEST Receiver"
- REC 7.4.10 — received/verified by "TEST Receiver"/"TEST Verifier"

Not deleted — flag for cleanup if/when convenient.

### Known open items

1. **Sales data → REC 7.4.8 / packing list**: how sales' `export-manager` folder data gets into this system as the starting point for production's Dry Labelling List / packing list entry is explicitly out of scope, per the original spec — needs a separate scoping conversation.
2. **File upload storage**: currently inline in the submission JSON (4MB cap), not dedicated blob storage. Fine for now; revisit if certs/packing lists turn out to be large or numerous.
3. **Wider `traceability.js`/`job-status.js` gap**: 39+53 pages across the app missing these script tags (see above) — only the 5 in this checklist's dependency chain were fixed.
4. **`REC-7.4.4` job dropdown**: fixed for this checklist's purposes (added `job-status.js`), but worth confirming this didn't regress anything else on that page.
5. **Bin-code multi-job union**: current design resolves one job → its bin(s) → submissions on those bins. A shipment genuinely blending stock from multiple jobs via one bin is handled (bin can list multiple jobs in `jobNumbersInBin`), but this was never tested with real multi-job data.

---

## Dry Export Pack Front Page — rebuild from the paper form (instructions for Claude Code)

> **Source:** `Claude outputs/dry-export-pack-front-page-rebuild-instructions.md`

**Requested by:** Michaela, 2026-09-29
**Base document:** `Dry Export pack front page.docx` (the paper form is the base for what the online record requires)
**Target page:** `public/records/Dry-Export-Pack-Front-Page-dry-export-pack-front-page.html` (record key `dry-export-pack-front-page`)
**Supersedes:** the checklist section of `claude/dry-export-pack-attachment-checklist-instructions.md`. Keep that document's bin-code background; ignore its required-record list and its roster/recordpick build.

### 1. Read this first: things that are not what they seem

1. **The live database definition for this record has drifted from `data/record-definitions.json`.** Different field types were seen live than the JSON holds, and the page has flipped between a cached older layout and a newer one. Do not run the full `seed-definitions.mjs` until the JSON is brought back in line with the live tables, or it will overwrite live pages. Before building, export the live definition for this record (`GET /api/record-def/dry-export-pack-front-page`) and compare it with the JSON and with `public/data/record-defs/dry-export-pack-front-page.json`.
2. **A job number cannot identify an export pack.** Boxes are filled from bins that mix stock from several jobs. The link is bin code, not job number (see section 4).
3. **Possible leftovers from an aborted attempt on 2026-09-29.** A job-number-driven checklist was briefly deployed to this page, and a SQL script added six `cmt7xx` comment fields and set six record pickers to `required = false`. An undo script (`revert-dry-export-pack.sql`) was provided. Check the live table `RecordFieldDef` for `recordKey = 'dry-export-pack-front-page'` and remove any `cmt745`…`cmt7410` fields left over before adding new ones. Check the page file does not still contain the old `attachmentsChecklist` script.
4. **Numbering conflict to confirm with Michaela.** The paper form says "REC 7.4.6 Labelling list attached?". In the system, the dry labelling list is REC 7.4.8 (`dry-labelling-list`) and REC 7.4.6 is Dry Stock Control (`dry-stock-control`). This spec treats the paper form's labelling list as `dry-labelling-list` and labels the row "Dry Labelling List". Confirm, and correct the paper form's code if it is a typo.

### 2. The form, as on paper

Shipment details: **Packing date**, **No. of boxes exported**.

Attachments (each "attached?"):

| Row | Record | System key | Kind |
|---|---|---|---|
| 1 | Dry Labelling List (paper form: "REC 7.4.6 Labelling list") | `dry-labelling-list` | Filed record, picked by hand |
| 2 | REC 7.4.7 Labelling of Dry Boxes | `labelling-of-dry-boxes` | Filed record, found automatically |
| 3 | REC 7.4.9 Dry Stock Transfer | `dry-stock-transfers` | Filed record, found automatically |
| 4 | Signed packing lists | (file) | Upload |
| 5 | Health certificates | (file) | Upload |

Sign-off block: Completed by (Supervisor), Checked by (QC), Verification by, each with Signature and Date. Use the standard "Completed by" block the other pages now use; keep Verification by working as it does today.

Not required on this page: REC 7.4.5, 7.4.6 (Dry Stock Control), 7.4.10, and the earlier long list. Do not add them.

### 3. Layout (copy the Dry NRCS Packs checklist)

Reference implementation: the inline script at the bottom of `public/records/Production-Information-NRCS-(Dry)-dry-nrcs-packs.html` (element `#attachmentsChecklist`) and its fields in `data/record-definitions.json`. Reuse its look and structure:

- One table titled ATTACHMENTS CHECKLIST with columns **Record**, **Attached**, **Submissions**, **Comments**.
- **Attached** is Yes / No / Incomplete, computed, never typed. Rule: at least one record must exist, and every record that exists must be completed (submitted or verified, not draft). Any draft = Incomplete. Rows that are No or Incomplete are shaded red; complete but unverified rows are amber.
- **Submissions** lists every linked submission with date and status and links to it. When a record has many submissions (10 of one type is normal), show one summary line ("10 submissions · 8 verified · 2 awaiting verification") that expands to the full list. Rows with drafts expand by default.
- **Comments** is a normal text form field per row (`cmtLabelling`, `cmt747`, `cmt749`, `cmtPackingLists`, `cmtHealthCerts`), saved with the submission.
- A summary banner above the table: red "Not complete … (n of 5)" naming what is missing, or green when all are attached and completed. A note counts attached-but-unverified submissions.
- **Block Submit (not Save draft)** while any row is No or Incomplete, with a message naming the row(s). This was requested for this page specifically.

### 4. How records are found (the important part)

1. The preparer **picks the shipment's Dry Labelling List** (row 1). It is the one record that cannot be looked up automatically: the AG code is only assigned when production completes it, and there is no fixed mapping from a sales invoice to a job number. Keep the existing `recordpick` for `dry-labelling-list` (falls back to the full list of that record's submissions, not filtered by job). Show it inside row 1's Submissions cell. Row 1 is Attached = Yes only when the picked submission is completed.
2. Read the **bin codes** from the picked labelling list (roster column `binCode`, added to that record's boxes roster by `scripts/apply-dry-export-checklist.mjs`; confirm it is also in the live tables, and that the picked option exposes roster values — `recordSubmissionOptions` currently returns top-level `values` only, so this may need extending).
3. Resolve bin codes to jobs with `Traceability.jobsForBin(binCode)` (returns an array; a bin can be topped up from more than one job). Union the results into the shipment's set of job numbers.
4. For rows 2 and 3, run `Traceability.trace(jobNo)` for **every** job in that set and merge, de-duplicating by `record_key|submission_id`. Show all found submissions for each row, grouped, with the job number on each so it is clear which job supplied it.
5. The completion rule in section 3 applies to the merged set. Confirm with Michaela whether a required record must exist **for every contributing job** (stricter) or **for the shipment as a whole** (satisfied once any job has it). Default to the whole-shipment reading and show per-job counts in the row's expanded list so the gap is visible either way.
6. Rows 4 and 5 are uploads (see section 5). They do not use tracing.

`labelling-of-dry-boxes` and `dry-stock-transfers` were given a `Job no.` field and `batchField: 'jobNo'` by `scripts/apply-dry-export-checklist.mjs`. Verify this is live in the database and in their submission tables before relying on it. Older submissions filed before the field existed will not be found by job — decide whether to backfill.

If the labelling list has no bin codes, or `jobsForBin` returns nothing, show a clear message on the page ("No bin codes found on this labelling list — cannot find linked records") and keep rows 2 and 3 as No. Do not silently fall back to the typed job number.

### 5. Packing lists and health certificates

The paper form treats these as "attached?". Decide with Michaela: a file upload each (the earlier live version used upload fields, which give real evidence), or Yes/No. Default: **upload, required**, Attached = Yes once a file is present. Sales' packing list is the starting point that production completes in this system, per the earlier spec; do not build anything that reads the sales `export-manager` folder. Optionally capture the sales **Export/Invoice no. (`EXP-####`)** as a plain text field on this page, per the earlier spec — no lookups.

### 6. Data and database

- Keep everything in the existing `RecordDefinition` / `RecordSectionDef` / `RecordFieldDef` tables and mirror it into `data/record-definitions.json` and `public/data/record-defs/dry-export-pack-front-page.json`. Update these together, then bump the definition `version`.
- Fields: `jobNo` (keep, optional — no longer the driver), `packingDate` (required date), `noOfBoxesExported` (number), `labellingListPick` (recordpick, `dry-labelling-list`), the five comment fields, the two upload fields, and the standard Completed by block. Remove the six old `rec74xAttached` pickers once no saved submission needs them; check existing submissions first, do not orphan their data.
- The submission tables (`sub_dry_export_pack_front_page`) need columns for new fields. Use `scripts/generate-submission-schema.mjs` and a migration; do not run `prisma db push` or `migrate dev` (there is known unrelated drift, see `SIGNOFF_MIGRATION_TODO.md`).
- If the database is edited by SQL rather than the seed script, record it in a script under `scripts/` so the JSON and the database stay identical.

### 7. Testing checklist

1. Pick a labelling list with bin codes fed by two different jobs. Confirm both jobs are found and rows 2 and 3 list records from both.
2. A record with several submissions collapses to one summary line and expands to all of them.
3. A draft anywhere in a row makes it Incomplete (red), lists the draft, and names it in the banner.
4. Missing 7.4.7 or 7.4.9 for the shipment: banner names it; Submit is refused; Save draft works.
5. Complete and verify everything, attach both files: banner turns green and Submit succeeds.
6. Comments save, reopen and print correctly; the sign-off block prints as on the paper form.
7. Reload after saving a draft: the picked labelling list and all rows repopulate.
8. Confirm no other page changed and `seed-definitions.mjs` was not run against a stale JSON.

### 8. Open questions for Michaela

1. Labelling list is REC 7.4.8 in the system but 7.4.6 on the paper form — which is right?
2. Must each required record exist for every contributing job, or once for the whole shipment?
3. Packing lists and health certificates: upload or Yes/No?
4. Can one shipment have more than one labelling list? If so row 1 needs several picks.
5. Backfill: should older 7.4.7 / 7.4.9 submissions without a job number be linked to jobs?

---
