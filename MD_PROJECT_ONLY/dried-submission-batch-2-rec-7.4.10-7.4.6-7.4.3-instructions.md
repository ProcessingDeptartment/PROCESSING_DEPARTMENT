# Dried Submission Process, Batch 2: REC 7.4.10, REC 7.4.6, REC 7.4.3.1 / 7.4.3.2 (+ locked reload with reason and passkey)

Status: instructions only, no code written. For Claude Code.
Date: 2026-10-02
Raised by: Michaela (dried submission process review, comments from 2026-10-02).
Batch 1 (REC 7.4.0 pot slides) is in `rec-7.4.0-pot-slides-blanching-stage-instructions.md`. The job-open gate for all records is in `record-open-job-gate-instructions.md`. Both still apply.

## 0. How this file relates to earlier files

This file **amends** the files below. Where they disagree, **this file wins**. Anything not mentioned here stays as written there.

| Earlier file | What this file changes |
|---|---|
| `rec-7.4.10-crate-number-automatic-instructions.md` | Crates section is simplified to "number + weight" with a working "+ Add crate" flow (section 2). Numbering rule and database stay. |
| `rec-7.4.6-dry-stock-control-merge-job-info-instructions.md` | Finance sign-off is required on **every** submission (the weight/count trigger is removed). Locked values can now be edited with reason + passkey. Weight out is the crate total from 7.4.10. (section 3) |
| `rec-7.4.3-totals-section-start-collapsed-instructions.md` | Totals gets a defined order, a deviation note and yield highlighting. A Comments section is added under Totals. Totals still starts collapsed. (section 4) |
| `implementation-passkey-and-title-prefill-REVISED.md` | Reused as is for the passkey check (section 1). No change to the passkey system itself. |

Open questions are collected in section 8 with the default Claude Code should use if they are not answered.

---

## 1. Shared mechanism: locked reload, edit only with reason + passkey

Raised for REC 7.4.6 ("entry details: if job number is pulled in again the data previously submitted must be present but locked in place, an edit can change it but it must have a reason and a passkey submit"). Build it as a **small reusable component** in the shared engines (`form-record.js`, `monitoring-log.js`, `job-picker.js`). **Confirmed by Michaela (2026-10-02): it applies to ALL records** where picking a job brings back earlier submitted answers. It is on by default for those records (flag `lockedReload`, default true where the condition below is met, with `lockedReload: false` available as an opt-out per record).

**Which records it covers.** First audit every record definition and list, in the work log, each record that reloads earlier submitted data for the same job (progressive or stage-based records such as REC 7.4.6, and any record that continues or re-opens a job's earlier entry). Enable the component on all of them. Records where every entry is a fresh, independent form (nothing is loaded back when the job is picked) have nothing to lock and are unchanged. Show the audit list to Michaela before switching it on everywhere. Records that are already read-only when reloaded keep that behaviour. Each record's own autofilled fields stay governed by that record's own rules (they refresh from source, not edited through this route).

### 1.1 Behaviour

1. When the job number is confirmed and the job already has earlier submitted data for this record, that data loads into the form and every field that holds a submitted value is **locked** (read-only). Each locked field shows a small caption: "Entered in stage n, dd Mon".
2. Empty fields stay open for normal entry.
3. Autofilled fields (REC 7.4.6: Whole weight, Cooking date, No. of trolleys, Weight in, Weight out) are **not** editable through this route. They refresh from their source forms on every load; if the value changed since the last submission an amber chip shows "Changed since last submission: was X, now Y". To change them the source form is corrected.
4. Each locked field has a small **Edit** control (pencil icon, at least 44 px target). Tapping it opens a pop-up "Change submitted value" with:
   - the field name, the current value and a box for the new value (same input type and validation as the field),
   - **Reason for change** (text, required, minimum 5 characters),
   - the **passkey number pad** from `passkey-input.js` (the existing component),
   - buttons **Save change** (disabled until reason, new value and a verified passkey are all present) and **Cancel**.
5. On Save change: the passkey is verified by the existing `/api/passkey/verify` call. A wrong passkey leaves the field locked and changes nothing. A correct one unlocks that single field with the new value, marks it "Changed in this stage" (amber), and records the change (1.2). The identity of the person making the change is the user the passkey belongs to, not just the logged-in user.
6. The changed value is part of the **new stage** being worked (REC 7.4.6 saves every submission as a new immutable stage), so earlier stages are never rewritten. The change takes effect when that stage is submitted; abandoning the stage discards it.
7. A field can be changed more than once within a stage; every change is logged. The earliest original value is kept in the log.
8. Locked fields cannot be changed by any other route (no console, no stale cached page). The API checks that any submitted value that differs from the carried-forward value has a matching change record with reason and a verified passkey, and rejects the submit otherwise.
9. Respect `window.AUTH_GATES_ENABLED` the same way the sign-off block does.
10. Editing a locked value does not remove the sign-off requirement. The stage that contains the change still needs both sign-offs (section 3.3).

### 1.2 Database

New table `field_change_log` (plain SQL, exportable to CSV):

| Column | Type | Notes |
|---|---|---|
| `id` | PK | |
| `record_key` | text | for example `dry-stock-control` |
| `job_no` | text | |
| `submission_id` | FK | the stage in which the change was made |
| `field_key` | text | |
| `old_value`, `new_value` | text | stored as text; keep the original type in `value_type` |
| `reason` | text | required |
| `changed_by` | text | username of the passkey owner |
| `passkey_log_id` | FK, nullable | links to the existing passkey usage log row |
| `changed_at` | timestamptz | server time |

Indexes: `(job_no)`, `(record_key, field_key)`, `(submission_id)`. A view `v_field_changes` joins the log to the stage (stage number, job, field, who, why) so "which values were ever changed, by whom, and why" is a simple query for trend and audit use.

---

## 2. REC 7.4.10 Dried Abalone Transfer: Crates section

### 2.1 Problem and first step

"The crates section does not function." The exact fault was not described. **Before changing anything**, Claude Code opens the live REC 7.4.10 page, tries to add three crates on a desktop and on a tablet width, and reports what fails (number not appearing, add button doing nothing, weight not saving, totals wrong, console errors). Then fix the cause and apply the simplified layout below. Stop and show the findings before step 3 of the build order.

### 2.2 What the section contains

Only two things per row, nothing else in the section (no extra columns, headings or controls):

1. **Crate number**: 1, 2, 3, 4, 5 and so on, automatic, read-only plain label, not an input, not focusable.
2. **Weight (kg)**: number, 2 decimals, greater than 0, unit shown in the label and as a suffix.

### 2.3 Flow

1. The user types the weight, then presses **+ Add crate**. A new row appears with the next number and the cursor ready in its weight field (on a touch screen do not force-open the keyboard; scroll the new row into view).
2. **+ Add crate** is disabled until the current (last) row has a valid weight, so there are no blank crates. A short hint beside it reads "Enter the weight to add the next crate".
3. Each row has a small remove control with a confirm when a weight has been entered. Removing a row in a draft renumbers the rows in this entry so there are no gaps.
4. First load of a new entry shows crate 1 with an empty weight (no need to press add for the first crate).
5. `totalDriedWeight` and `dryYield` are unchanged: the total is still the sum of the Weight column.

### 2.4 Numbering (confirmed)

Per job, restarting at 1 for each new job. Job 1 runs crates 1 to 10; job 2 starts again at 1. A second transfer on the **same** job continues after the highest crate of the earlier transfers (crate 11 onward), as in the earlier brief. A crate is identified by job number + crate number. The server assigns the final numbers at Submit; drafts show provisional numbers. Unique `(job_no, crate_no)` in the database. Everything else in `rec-7.4.10-crate-number-automatic-instructions.md` (sections 3 to 7) stays.

---

## 3. REC 7.4.6 Dry Stock Control

### 3.1 Field changes (keep what the earlier brief says; this list is the confirmation)

1. **Month** removed from the form and from required validation. Old values stay in the database; derive any period grouping from Date in.
2. **Cooking date**, **No. of trolleys** and **Weight in** are not typed. They are pulled in from the other forms after the job is confirmed, read-only:
   - Cooking date from REC 7.4.0: the record date of the job's submitted **Cooking** slides (several days: the latest, with the note "Cooked on N dates, latest used"). Blanching is ignored.
   - No. of trolleys from REC 7.4.1: the count on the latest submitted entry that has one.
   - Weight in (kg) = total cooked weight: the sum of `abalone_kg` over the job's submitted **Cooking** rows in REC 7.4.0 (`dry_cooking_pot`). Blanching has no abalone weight any more (batch 1), so nothing changes in this calculation.
3. **Weight out (kg)** is pulled from the **total weight of the crates** on REC 7.4.10: the sum of the stored `totalDriedWeight` over the job's **submitted** transfers (a job may have several). Voided crates are excluded, drafts are ignored with a note. Show "From REC 7.4.10, N transfers".
4. **Whole weight** appears once, read-only, from receiving (as in the earlier brief).
5. If a source form has nothing for the job, the field unlocks with an amber note ("No REC 7.4.10 found for this job. Fill in REC 7.4.10 first") so the stage can still be saved and submitted; the typed value is flagged `*_typed_manually = true` and locks after submit. (Default, see open item D.)
6. Source ids stored on each stage (`cooking_date_source_ids`, `trolleys_source_submission_id`, `cooked_weight_source_ids`, `weight_out_source_ids`) as in the earlier brief.

### 3.2 Locked reload

This record uses the shared mechanism in section 1 (it applies to all records that reload a job's earlier data). Previously submitted values load locked; changes need a reason and a passkey. The stage/status model from the earlier brief stays (progressive submission, one immutable row per stage, `stage_no`, `previous_submission_id`, `is_latest`, computed `completion_status`).

### 3.3 Sign-off: both always required

This is one form where nothing is submitted until finance has also signed off.

1. **Completed by** and **Finance representative** (Name, Title, Date, Signature each, eight inputs) are required for **every** Submit. They are marked required from the moment the form opens.
2. The "any weight or count has a value" trigger, the banner that went with it, `signOffTrigger` and the "stage without sign-off" state are **removed**. Do not build them. Keep `signoff_required` as a column for old data, but new rows always store `true`.
3. **Save draft** never needs a sign-off. A finance representative can open a draft, sign and submit.
4. Signatures use the existing passkey sign-off block. Sign-offs still **never reload**: both blocks open blank on every new stage, the Finance name is never pre-filled. Each stage keeps its own two sign-offs.
5. Server-side check: the API rejects any submit missing either sign-off (name, title, date or signature of either block), so an old cached page cannot bypass it.
6. `v_dry_stock_unsigned` lists submitted stages with a missing sign-off. For new data it must always be empty. Old stages from before this rule show "Not recorded (before finance sign-off was added)" and are never given an invented signature.

### 3.4 Everything else

Unchanged from the earlier 7.4.6 brief: merged section with Job no. first, no auto-collapse, status line, one list line per job with a stage expander, print of all stages, CSV columns, views `v_dry_stock_control_current`, `v_dry_stock_balance`, `v_dry_stock_control_open`. The job-open gate (`record-open-job-gate-instructions.md`) applies to this record too.

---

## 4. REC 7.4.3.1 and REC 7.4.3.2 (grading logs)

Scope confirmed: both records. Shared code is reused; do not hand-edit generated snapshots (export script).

### 4.1 Start kg: confirm only when it must change

First, inspect the live definitions and the page script and report the exact field names for "Start kg", "+ Box" (believed to be the existing **+ Full box** button) and "Final kg in bin". Do not guess.

Rule:

1. Start kg arrives pre-filled and is **accepted as is**. If the operator does not edit it, there is no confirmation prompt, no extra tap and no blocking message on submit.
2. A confirmation step is shown **only when the operator**: edits Start kg, presses **+ Box**, or edits Final kg in bin. It asks them to confirm the weight before it is accepted ("Confirm start weight 12.50 kg" or the equivalent for the edited field).
3. Cancel on the prompt reverts the field to its previous value.
4. An edited Start kg asks for a **reason** (required, minimum 5 characters) in the confirm step, and writes the original value, new value and reason to the audit trail (reuse `field_change_log` with no passkey). See open item E.
5. Untouched bins never ask for confirmation, whether the entry is new, a draft or being viewed.

### 4.2 Totals section

Order, all calculated and read-only:

1. **Dried weight (kg)**
2. **Weight graded (kg)** = the sum of the graded weights shown in the Collection bins section (`gradedWeight` on the bin rows). This is the same figure the 7.4.4 report reads, so the two always agree.
3. **Yield (%)** using the existing yield calculation (no formula change; see open item F).

Deviation note: if dried weight and weight graded differ, show under the totals: "Dried 842.5 kg, graded 830.1 kg, difference 12.4 kg (1.5%)". Nothing is shown when they match. A tolerance setting `deviationToleranceKg` lives in the record definition (default 0, meaning any difference is noted).

Yield highlighting (thresholds in the record definition as `yieldLow: 10` and `yieldHigh: 14`, not hard-coded):

- **Below 10%**: yield shown in red. No extra message (open item G).
- **Above 14%**: yield shown in red with the message **"Job mixing likely"**.
- **10% to 14% inclusive**: normal.
- No value yet: blank, never 0 or NaN.
- Soft flag only: it never blocks Submit.
- Shown on screen, in the saved record view and on print (bold red label so it reads on a black-and-white copy). The collapsed Totals header shows the yield in red when it is outside the range.

### 4.3 Comments section

A **Comments** section directly under Totals and above Sign off: one optional multi-line text box (about 4 lines, growing). Collapsible, open on load (Totals still starts collapsed). Stored as a plain text column `comments` on each grading submission table. Printed, shown in the saved view and exported to CSV only when it has text.

### 4.4 Remove the Size grade weights section

The read-only **Size grade weights** section is removed from the form, print and view for **new** entries. Stored values stay in the database and old entries still display them when opened. Before removing, list everything that reads those values (Totals, yield, the bin roster, the 7.4.4 report, CSV and print) and repoint each to the Collection bins graded weights first. Do not drop any column. Show the audit table in the work log.

### 4.5 Added rows: typed bin code with saved suggestions

1. Rows created by the normal flow keep the automatic bin code sequence (`fixedGroups`), unchanged.
2. A row created with **Add row** has an **editable, typed** bin code (not read-only, no automatic number).
3. Every typed code is stored as a suggestion. On later added rows, clicking into the bin code cell shows the saved codes as a drop-down; the list narrows as the operator types, and a new code can still be typed. Suggestions are shared by 7.4.3.1 and 7.4.3.2.
4. New table `bin_code_suggestion` (plain SQL): `code` (unique, trimmed, case-normalised), `first_typed_by`, `first_typed_at`, `last_used_at`, `use_count`, `record_keys` (which logs used it). A code typed again increments `use_count`; no duplicate row.
5. **Traceability check:** if the typed code is already used by a **different job** (look it up in `stock_link` edges for that code), show a warning "Bin code X is already used by job Y. Is this a deliberate top-up?" with **Confirm top-up** and **Change code**. Confirming is logged against the row (`topup_confirmed`, by, at). Because box code = bin code, this is what keeps blended bins traceable. Saving a typed code also writes the usual `job -> bin` edge.
6. A typed code that equals an existing code on the **same** job and record is rejected as a duplicate within the job.
7. The automatic sequence is not changed by typed codes. If a typed code equals a code the sequence will reach later, the traceability check in step 5 catches it at that time.

---

## 5. Database summary

All plain SQL in one reviewed file under `scripts/`, backup first, dry run, safe to re-run, exportable to CSV (add the new tables to the CSV export script so the "move to another format" path covers them). No column is dropped.

| Change | Where |
|---|---|
| `field_change_log` + view `v_field_changes` | new (section 1.2) |
| `bin_code_suggestion` | new (section 4.5) |
| `comments` TEXT | 7.4.3.1 and 7.4.3.2 submission tables |
| `topup_confirmed`, `topup_confirmed_by`, `topup_confirmed_at` | 7.4.3 bin rows |
| `signoff_required` default true | 7.4.6 (column kept, always true for new rows) |
| `dried_transfer_crate`, unique `(job_no, crate_no)`, view `v_dry_transfer_crates_by_job` | 7.4.10 (as in the earlier brief, if not yet built) |

Update `dried-abalone-transfer.json`, `dry-stock-control.json` and the two 7.4.3 definitions through `scripts/export-record-defs.mjs`, keeping the live tables and JSON identical. Bump the `?v=` strings on every touched page and script.

---

## 6. Existing entries

Do not change history. Old 7.4.6 stages keep their sign-offs (finance shown as "Not recorded" where there was none). Old 7.4.3 entries keep their Size grade weights, bin codes and totals. Old 7.4.10 crates keep their typed number in `crate_no_old` as in the earlier brief. Before/after totals per job must match.

---

## 7. Test plan

**Shared locked reload (7.4.6)**
1. Submit stage 1, pick the job again: typed values load locked with "Entered in stage 1" captions; empty fields are open.
2. Edit a locked value: pop-up needs reason (5+ characters) and a valid passkey; wrong passkey changes nothing; correct passkey unlocks only that field; `field_change_log` has old value, new value, reason, passkey owner.
3. Send a modified value straight to the API without a log entry: rejected.
4. Autofilled fields show no Edit control; a changed source shows the amber chip.

**REC 7.4.10**
5. Findings of the first-step check are reported. A new entry shows crate 1; entering a weight enables **+ Add crate**; five crates number 1 to 5; the new row is scrolled into view.
6. Job 1 with crates 1 to 10 and job 2 starts at 1; a second transfer on job 1 starts at 11; two tablets submitting at once get no duplicate numbers.
7. Total dried weight and yield are unchanged.

**REC 7.4.6**
8. Month is gone. Cooking date, trolleys, Weight in and Weight out fill after the job is confirmed; Weight out equals the sum of the job's submitted 7.4.10 totals; voided crates and drafts are excluded.
9. Submit with either sign-off missing is refused (screen and API), with a message naming the missing block; both present succeeds; Save draft always works.
10. `v_dry_stock_unsigned` is empty for new data.

**REC 7.4.3.1 / 7.4.3.2**
11. Untouched Start kg: no prompt anywhere. Edit Start kg, press + Box, or edit Final kg: the confirm step appears; Cancel reverts.
12. Totals order is dried weight, weight graded, yield. Weight graded equals the sum of the Collection bins weights. A mismatch shows the deviation note; a match shows none.
13. Yield 9.9% is red; 10.0% and 14.0% are normal; 14.1% is red with "Job mixing likely". Same on print and view; blank yield shows nothing.
14. Comments box sits under Totals, prints only when filled.
15. Size grade weights section is gone for new entries; old entries still show their values; nothing that used them broke.
16. Added row: bin code is typed; it appears as a suggestion in the next added row and in the other 7.4.3 record; a code used by a different job shows the top-up warning and logs the confirmation.
17. Tablet portrait and landscape: all new controls at least 44 px, no horizontal scroll, pop-ups fit above the keyboard.
18. Print and CSV match the screen; old entries open, print and export as before.

---

## 8. Open items (defaults are used if unanswered)

- **A. Which records get the "locked, edit only with reason + passkey" behaviour?** **Confirmed by Michaela (2026-10-02): all records** where picking a job brings back earlier answers. Claude Code lists those records first (section 9 step 4) for review, then enables the shared component on all of them.
- **B. Whose passkey.** **Confirmed by Michaela (2026-10-02):** the editing user's own passkey is used (identity logged), and any user with a valid passkey may edit a locked value. No role restriction.
- **C. When the passkey is entered.** **Confirmed by Michaela (2026-10-02):** in the Edit pop-up, at the moment the change is made (not once at Submit).
- **D. What if a pulled-in value has nothing to pull from?** Example: someone opens REC 7.4.6 for a job, but REC 7.4.10 has not been filled in yet, so there is no crate total to put in Weight out. Default: the field becomes typeable, with an amber note "No REC 7.4.10 found for this job. Fill in REC 7.4.10 first", so the stage can still be saved. Alternative: the field stays empty and locked, and the stage cannot be completed until REC 7.4.10 is filled in. Answer "typeable" or "stay locked".
- **E. Start kg edit needs a reason?** **Confirmed by Michaela (2026-10-02):** editing Start kg requires a short reason (minimum 5 characters) in the confirm step, in addition to the confirmation. No passkey is needed for this one. Untouched Start kg still asks for nothing.
- **F. Yield basis.** **Confirmed by Michaela (2026-10-02):** the existing yield calculation stays; only the highlighting is added.
- **G. Message for yield below 10%.** Default: red only, no text.
- **H. Deviation tolerance.** Default: 0 (any difference noted).
- **I. Which button is "+ Box".** Default: the existing **+ Full box**. Claude Code confirms from the live page.

## 9. Build order for Claude Code

1. Inspect and report: the 7.4.10 crates fault, the live 7.4.3 field names (Start kg, + Box, Final kg), and the readers of Size grade weights. **Stop for review.**
2. Database SQL file (section 5) with backup, dry run and before/after totals; CSV export script update.
3. REC 7.4.10 crates section (section 2).
4. Shared locked-reload component and `field_change_log` (section 1). Audit which records reload a job's earlier data and **stop for Michaela's review of that list**; then enable it on all of them (REC 7.4.6 first as the pilot).
5. REC 7.4.6 changes (section 3).
6. REC 7.4.3.1 / 7.4.3.2: Start kg confirm, Totals, Comments, Size grade weights removal, typed bin codes (section 4).
7. Regenerate record definitions with the export script, bump `?v=` strings, run section 7 and write a work log at `MD_PROJECT_ONLY/dried-submission-batch-2-worklog.md`.

## 10. Paste-ready prompt for Claude Code

> Read `dried-submission-batch-2-rec-7.4.10-7.4.6-7.4.3-instructions.md` and follow it exactly. It amends the earlier 7.4.10, 7.4.6 and 7.4.3 Totals briefs; where they conflict, this file wins. First inspect and report (section 9 step 1), then stop for review. Then: (1) simplify the REC 7.4.10 Crates section to an automatic crate number plus a weight in kg per row with a working "+ Add crate" that is disabled until the current weight is entered, numbering per job and server-assigned at Submit; (2) build the shared locked-reload component (previously submitted values load locked; an edit needs a reason and a passkey, logged in `field_change_log`), audit and list every record that reloads a job's earlier data, stop for my review of that list, then enable it on all of them (REC 7.4.6 first as the pilot); (3) on REC 7.4.6 remove Month, pull Cooking date, No. of trolleys, Weight in (Cooking slides only) and Weight out (sum of REC 7.4.10 `totalDriedWeight`) from the other forms, and require both Completed by and Finance representative on every Submit with a server-side check (no weight/count trigger); (4) on REC 7.4.3.1 and 7.4.3.2 confirm Start kg only when Start kg, + Box or Final kg is edited, order Totals as dried weight, weight graded, yield with a deviation note and red yield outside 10% to 14% ("Job mixing likely" above 14%), add a Comments section under Totals, remove the read-only Size grade weights section after repointing its readers, and make added-row bin codes typed with saved shared suggestions and a traceability top-up warning. Drop no column, keep JSON definitions and live tables identical via the export script, bump `?v=` strings, run the section 7 tests and write the work log. Show me REC 7.4.10 Crates and the 7.4.3 Totals first.
