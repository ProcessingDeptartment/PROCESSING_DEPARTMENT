# REC 7.4.6 Dry Stock Control: one section, progressive submission per job, autofill from the job, sign-offs triggered by any weight or count (instructions for Claude Code)

**Date:** 2026-10-01 (revision 11)
**Raised by:** Michaela: "7.4.6 dry stock control. job info merged with actual form section", "month remove", "when job number input add details regarding cooking date, no. of trolleys, weight in (total cooked weight)", "whole weight is double field", "weight out = 7.4.10 weight total", "add to this one sign off: Finance representative: title, date, signature", "record not fully completed at once. submission allowed at any point and then when job is reloaded it loads where user left off", "but submission still not possible until sign off", "sign off does not re-load as a new user can be the next user to complete and sign off", "yes finance also sign before submission", "as soon as weight in or count in or outs is filled that is when this submission rules triggers", "yes they must trigger" (the autofilled weights trigger too), "yes since record does not need to be opened until finance is present" (accepted: every stage after a weight or count exists is opened and submitted with finance present)
**Scope:** REC 7.4.6 only (`dry-stock-control`, `batchField: jobNo`). Layout/grouping, two fields removed from view, four fields autofilled, a second sign-off block, progressive submission, and the sign-off trigger rule. No calculation changes, no DB column drops, no export changes. REC 7.4.10 is read, not changed.
**Related:** `rec-7.4.2-job-info-section-split-instructions.md`, `rec-7.4.2-dry-monitoring-field-changes-instructions.md` (same autofill pattern), `drying-process-refinement-instructions.md` (section 2.3 cooked weight, "Job so far" / locked-answer pattern), `record-sections-collapse-and-job-autofocus-instructions.md`, `monitoring-logs-completed-by-block-instructions.md` (standard sign-off block, reused).
No code was written for this brief. It is the specification.

## 1. Current state (read from the live definitions)

**7.4.6 Job Info group:** Job no. (`jobNo`), Received from (`jiReceivedFrom`, read-only), Processing for (`jiProcessingFor`, read-only), **Whole weight (kg) (`jiIntakeWeight`, read-only)**, Intake date (`intakeDate`), **Month (`month`, required)**.

**7.4.6 Processing & Measurement group:** **Whole weight (`wholeWeight`)**, Cooking date, No. of trolleys, Weight in, Date in, Count in factory, Count in finance, Weight out, Date out, Count out factory, Count out finance.

**Whole weight appears twice:** `jiIntakeWeight` (receiving) and `wholeWeight` (typed).

**Sign off today:** the standard COMPLETED BY block only.

**REC 7.4.10 Dried Abalone Transfer** (`dried-abalone-transfer`): Crates roster (Crate number, Weight kg); computed **`totalDriedWeight`** (kg) and `dryYield`.

## 2. What is wanted

1. **One section**, Dry stock control, Job no. first.
2. **Job info shows the job number only** (other job data in the pop-up only).
3. **Month is removed.**
4. **Whole weight appears once:** read-only from the job (receiving).
5. **Autofill after the job is confirmed:** Cooking date (REC 7.4.0), No. of trolleys (REC 7.4.1), Weight in = total cooked weight (REC 7.4.0), Weight out = REC 7.4.10 total weight.
6. **Two sign-offs: Completed by and Finance representative** (each Name, Title, Date, Signature).
7. **Not completed in one go.** Submit at any point; picking the same job again **loads where the user left off**, until the record is complete.
8. **Sign-off trigger:** both sign-offs are required to submit **as soon as any weight or count has a value**: Weight in, Count in factory, Count in finance, Weight out, Count out factory or Count out finance. **Autofilled weights count.** Until one of those has a value the submission rules do not apply.
9. **Sign-offs do not reload.** Each submission has its own two sign-offs, filled in by whoever submits it. A new user can be the next one to complete the record and sign off.

## 3. Target layout

| Section | Fields, in order |
|---|---|
| **Dry stock control** | Job no. (picker + pop-up), Whole weight (auto), Cooking date (auto), No. of trolleys (auto), Weight in (auto, total cooked weight), Date in, Count in factory, Count in finance, Weight out (auto, 7.4.10 total), Date out, Count out factory, Count out finance |
| **Sign off** | 1. Completed by (standard block). 2. **Finance representative**: Name, Title, Date, Signature. **Required to submit once the trigger in 4.1 is met.** |

A **status line** at the top once a job is confirmed: "First entry for this job", "In progress, stage 2 · last submitted 12 Oct by Anna, finance: Pieter" or "Complete". When the trigger is met the sign-off section shows a small banner "A weight or count is filled in: Completed by and Finance representative must sign before you submit." Both sections collapsible, open on load.

## 4. Progressive submission: how it works

**Principle:** one *job stock record* that grows over several submissions. Every submission is kept as its own immutable row (traceability and audit); each new submission is a full snapshot that carries forward the **data** already entered, but **never the sign-offs**.

**Working practice (accepted by Michaela, 2026-10-01):** the record is not opened for a stage until the finance representative is present, so signing both blocks at submit is normal, not a burden. Save draft is available but is not the expected route; do not add reminders or workflow around it.

1. **The sign-off trigger.** The sign-off rules apply to a submission when **any one of these six fields has a value** at the moment of submit, however the value got there (autofilled, typed, or carried forward and locked from an earlier stage):
   - Weight in
   - Count in factory
   - Count in finance
   - Weight out
   - Count out factory
   - Count out finance

   The trigger is evaluated live, so the banner and the required marks appear the moment one of those fields gets a value (including when the job is confirmed and Weight in autofills from REC 7.4.0) and disappear if every one of them is empty. A value of 0 counts as a value; an empty field does not. Dates (Date in, Date out), Whole weight, Cooking date and No. of trolleys never trigger it.
   **Practical effect:** once a job has submitted cooking in REC 7.4.0 (so Weight in autofills), every 7.4.6 submission for that job needs both sign-offs. Only a job with no cooking weight, no 7.4.10 total and no counts yet can be submitted without signing.
2. **Before the trigger: submit with no sign-off.** Only the **Job no.** is required. A submission with none of the six fields filled goes through without any sign-off. The system still records who submitted it and when from the logged-in user (`submitted_by`, `submitted_at`, set by the server), so every stage stays attributable. Save draft is never blocked.
3. **After the trigger: both sign-offs required.** Submit needs the **Completed by block** and the **Finance representative block** filled (Name, Title, Date, Signature in each, eight inputs). If anything is missing, Submit is refused with a toast naming the missing block: "A weight or count is filled in: Completed by and Finance representative (name, title, date and signature) are required to submit." Respect `window.AUTH_GATES_ENABLED` as the standard block does. Save draft is still never blocked and needs no sign-off.
4. **Reload loads where the user left off, data only.** After the user picks a job and presses Confirm, the system looks up the job's **latest submitted 7.4.6** and fills the form from it: all typed values. The new entry is stage n+1 with `previous_submission_id` pointing at the one it continues. If there is none: "First entry for this job".
5. **Sign-offs never reload.** Completed by and Finance representative always open **blank** on a new stage: no values carried from the previous stage, no Finance pre-fill. Completed by's Name follows the standard behaviour (suggested from the logged-in user, editable); the Finance Name is never pre-filled; Title and Signature start empty; Date may default to today. An earlier stage's sign-offs stay stored on that stage (shown in the stage history and print); the current user signs for **their own** stage. A reopened draft keeps what was typed in it, never a previous stage's signature. A stage submitted before the trigger shows "No sign-off (no weights or counts in this stage)".
6. **Values already submitted are locked.** A field holding a value from an earlier stage shows it read-only with "Entered in stage n, dd Mon". Empty fields stay open. A wrong value is corrected only by an admin, with reason and name, logged (Michaela / QA manager by default); the correction is a new stage, the old one is kept.
7. **Autofilled fields refresh from their source on every load** (cooking date, trolleys, weight in, weight out, whole weight). A changed value shows an amber chip "Changed since last submission: was X, now Y"; the previous stage keeps its stored copy.
8. **Status** is stored on every submission, computed by the server on save, never typed:
   - **In progress:** a completion field is still empty.
   - **Complete:** every completion field is filled. Completion fields (default, Michaela to confirm): Weight in, Date in, Count in factory, Count in finance, Weight out, Date out, Count out factory, Count out finance.
   Because the sign-offs are required whenever any weight or count has a value, the stage that completes the record is always signed by both.
9. **Drafts.** A draft needs no sign-off. If a draft already exists for the picked job, show "A draft for this job was started by X on dd Mon" with Open draft or Start new. Two people must not enter the same stage at once; Start new needs a confirm. An unsubmitted draft is not a stage and does not change what loads for the next user.
10. **One open record per job in the list.** One line per job (latest stage, status, last submitted date and by, finance representative, weight in, weight out), with an expander showing every stage oldest first, each with its own sign-offs. Full history stays reachable and printable.
11. **Complete locks the record.** Picking a Complete job shows it read-only. Reopening is admin only, with reason, creating a new stage.
12. **No loss on abandon.** Leaving without submitting loses nothing already submitted.

## 5. Changes (form, fields, sign-off)

1. **Re-group** `data/record-definitions.json`, `public/data/record-defs/dry-stock-control.json` and the live `RecordFieldDef` rows together. Export the live definition first and compare; do not run `seed-definitions.mjs` against a stale JSON. Keys, labels, types and order of kept fields do not change.
2. **Auto-collapse guard.** The section holds more than the job picker, so it does **not** auto-collapse after Confirm; mark it `jobEntry: 'merged'` so the shared guard skips it silently. After Confirm, focus goes to the first empty open field.
3. **Whole weight, one field.** Keep `wholeWeight`, read-only, autofilled from receiving (`abalone-receiving.intakeWeight` by `jobNo`). Hide `jiIntakeWeight`; audit its readers and repoint to `wholeWeight`; check nothing compared the two or relied on `wholeWeight` being typed. Old entries with a differing typed value stay as saved and are listed in the work log. If receiving has no weight, unlock with an amber note (5.10). Drop no column.
4. **Hide other job-data fields** (`jiReceivedFrom`, `jiProcessingFor`, `intakeDate`). Audit readers, repoint to a lookup by `jobNo`, drop nothing. Audit table in the work log.
5. **Remove Month.** Off the form and out of required validation. Old values stay stored; do not delete the column. Audit list columns, print, CSV, filters, trends and period grouping; derive the period from `dateIn`. List other records with the same `month` pattern; change none without approval.
6. **Cooking date (read-only autofill).** Record date of the job's **submitted REC 7.4.0 Cooking cards** (never Blanching), existing lookup (`wireRecordPick` / `window.Traceability.trace(jobNo)`, table `dry_cooking_pot` on `job_no`). Several days: **latest**, note "Cooked on N dates, latest used". Drafts ignored with a note.
7. **No. of trolleys (read-only autofill).** Count on the **latest submitted REC 7.4.1 entry that has one**; if it changed during the job show "Trolleys changed during the job, latest used".
8. **Weight in = total cooked weight (read-only, kg).** Sum of `abalone_kg` over all **Cooking** cards across the job's submitted REC 7.4.0 entries. Reuse the `cookedWeight` calculation in `drying-process-refinement-instructions.md` section 2.3; no second copy. Note "From REC 7.4.0, N cooking pots". Counts as a value for the sign-off trigger (4.1).
9. **Weight out = REC 7.4.10 total weight (read-only, kg).** Sum of stored `totalDriedWeight` over the job's **submitted** REC 7.4.10 entries (a job may have several transfers). Do not re-add crate rows in the browser. Drafts ignored with a note. Note "From REC 7.4.10, N transfers". Counts as a value for the sign-off trigger (4.1).
10. **Missing source** (no 7.4.0, no 7.4.1 count, no 7.4.10, no receiving weight): amber note on that field, e.g. "No REC 7.4.10 found for this job. Fill in REC 7.4.10 first", and the field **unlocks** to be typed. Saving and submitting are never blocked by this. Flag `*_typed_manually = true` per field. A typed value counts toward the trigger exactly like an autofilled one. An unlocked typed value locks after submit (4.6).
11. **Source ids stored on each submission** (audit snapshot): `cooking_date_source_ids`, `trolleys_source_submission_id`, `cooked_weight_source_ids`, `weight_out_source_ids`.
12. **Finance representative sign-off block.**
    - Same `window.SignOffBlock` component and styling as Completed by, directly under it, label **"Finance representative"**. Inputs: **Name**, **Title**, **Date**, **Signature**. New element ids with prefix `_fin_`, never `_cb_`.
    - **Opens blank on every new stage** (4.5). Name never pre-filled.
    - **Required together with Completed by whenever the trigger in 4.1 is met**; not required before it; never required for Save draft. Inputs disabled when the record is Complete.
    - Saved as `financeRep = { by, title, date, signature }` in `rawJson` and in new TEXT column `financeRep` plus DATE `financeRepDate`, **per stage row**. `completedBy` likewise per stage. `src/submission-store.js` fills them, after checking `information_schema` so a missing column cannot break saving.
    - Printed sheet: "Finance representative:" row under Completed by, per stage (blank with the note in 4.5 on a no-sign-off stage). CSV: "Finance representative" and "Finance representative date" as last columns, one row per stage. 7.4.6 only (flag `financeSignOff: true`, `signOffTrigger: ['weightIn','countInFactory','countInFinance','weightOut','countOutFactory','countOutFinance']`, rule `anyHasValue`). The trigger list lives in the record definition, not in code, so it can be changed without a release. If the shared component needs a small option for a conditional or second block, add it there, not a copy.
13. **Progress counter** counts the merged section's fields; Month gone, duplicate Whole weight not counted twice, autofilled and locked-from-earlier fields count as done.
14. **Print / CSV** unchanged apart from Month (CSV keeps its column, blank for new entries), the hidden Whole weight (CSV keeps both columns, the hidden one filled by lookup) and the sign-offs. **Print of a job prints every stage** oldest first under a "Job so far" summary, each with its own sign-off rows, all sections expanded. CSV adds `stage_no`, `status`, `signoff_required`.

## 6. Database

Plain SQL, reviewed file under `scripts/`, backup first, safe to re-run, moves out of Neon or to CSV unchanged.

On `sub_dry_stock_control` add:

| Column | Type | Notes |
|---|---|---|
| stage_no | int | 1, 2, 3 ... per job, set by the server |
| previous_submission_id | FK, nullable | the stage this one continues |
| completion_status | text | `in_progress` / `complete`, computed on save |
| signoff_required | boolean | true when any of the six trigger fields has a value in this stage (rule 4.1); computed by the server from the saved values, never trusted from the browser |
| submitted_by, submitted_at | text, timestamptz | from the logged-in user, set by the server on every submit, so stages without sign-off are still attributable |
| is_latest | boolean | true on the newest submitted stage of the job, set in the same transaction |
| fields_filled | int | count of completion fields filled |
| financeRep, financeRepDate | text, date | per stage, see 5.12 |
| `*_source_*`, `*_typed_manually` | various | see 5.10 and 5.11 |

`completedBy` and the Completed by title/date/signature (in `rawJson`) stay per stage row and are never copied to the next stage.

Rules:
- **Server-side check:** the API rejects a submit where `signoff_required` is true and `completedBy` or `financeRep` (or their title, date, signature) is empty, so the rule cannot be bypassed by an old cached page.
- Rows are **never overwritten after submit**; a new stage inserts a new row. Unique `(job_no, stage_no)`.
- Index `job_no`, `(job_no, is_latest)`, `completion_status`.
- Views: `v_dry_stock_control_current` (latest stage per job, with status), `v_dry_stock_balance` (job, weight in, weight out, difference, difference %, status, latest finance representative and date, days since first stage), `v_dry_stock_control_open` (jobs not Complete, days waiting), `v_dry_stock_unsigned` (stages where `signoff_required` is true but a sign-off is empty, to catch old or imported data).
- Backfill: every existing 7.4.6 submission becomes stage 1 of its job; where a job has several, number them by date and mark only the latest `is_latest`. Old rows have **no finance sign-off**; leave `financeRep` null, show "Not recorded (before finance sign-off was added)", never invent one; set `signoff_required` by the same rule for information only (old rows that would have required it appear in `v_dry_stock_unsigned`, which is expected, and must not block anything). Status computed once by the script. Old rows never rewritten. Report jobs where numbering may be wrong (two submissions the same day). Dry run first with before/after counts.
- Traceability: `batchField: jobNo` stays; `trace(jobNo)` returns every stage, shown as "7.4.6 stage 2, In progress".

## 7. Test

1. New entry: one section, Job no. on top, Whole weight **once**, no Received from / Processing for / Intake date / Month. Sign off shows Completed by, then Finance representative.
2. **Autofilled weights trigger:** pick a job with submitted REC 7.4.0 (so Weight in autofills), Confirm: Cooking date, No. of trolleys, Weight in (and Weight out if a 7.4.10 exists) fill read-only, and the sign-off banner appears immediately with both blocks marked required.
3. **Before the trigger:** pick a job with no 7.4.0 cooking, no 7.4.10 and no counts; type only Date in; Submit with no sign-off succeeds. Stage saved with `signoff_required = false`, `submitted_by` and `submitted_at` filled, shown as "No sign-off".
4. **Each field triggers:** on that same job type a value in Count in factory: banner and required marks appear; clear it: they disappear. Repeat for Count in finance, Count out factory, Count out finance, and a typed Weight in and typed Weight out (sources missing, fields unlocked). Typing 0 triggers. Typing Date in, Date out, Cooking date or trolleys alone never triggers.
5. With the trigger met: Submit with both blocks empty is refused, toast names both; Completed by only is refused naming Finance; Finance only is refused naming Completed by; both filled (eight inputs) succeeds. Save draft with no sign-off always works.
6. **Carried-forward values also trigger:** stage 2 holds a signed count in. In stage 3, with that count locked and only Date out typed, Submit still requires both sign-offs.
7. **Sign-offs do not reload:** user A (finance rep F1) submits stage 1. User B picks the job: data loaded and locked, "In progress, stage 2", both sign-off blocks blank (Completed by name suggested as B). B and finance rep F2 sign and submit. Stage 1 shows A and F1, stage 2 shows B and F2, in the expander, print and CSV.
8. Reopen a stage-2 draft: it keeps what B typed and never shows A's or F1's signature. A draft with no sign-off can be opened by the finance person, signed and submitted.
9. **Server check:** send a submit with a weight or count and no finance sign-off straight to the API: rejected. `v_dry_stock_unsigned` is empty for new data.
10. Fill all completion fields in a signed stage: status "Complete", read-only on next pick.
11. Change a 7.4.10 transfer between stages: on reload the Weight out chip shows "Changed since last submission: was X, now Y"; earlier stages keep their copies.
12. A draft exists for a job: another user sees the warning with Open draft / Start new.
13. An unlocked typed value locks after submit. An admin correction creates a new stage with a reason; the old one is kept.
14. List page: one line per job, expander shows all stages. Neon: `SELECT job_no, stage_no, completion_status, signoff_required, "completedBy", "financeRep", submitted_by FROM sub_dry_stock_control ORDER BY job_no, stage_no;`. Views match a hand check for two jobs.
15. Weight in equals the Cooked weight on REC 7.4.1; Weight out equals the sum of the job's submitted 7.4.10 totals (drafts ignored with a note); Blanching excluded; cooked over two days uses the latest date.
16. Backfill dry run: before/after row counts equal; every old value unchanged; finance "Not recorded" on old rows; ambiguous jobs listed; old rows do not block anything. Old entries open, print and export as before.
17. Print a job with 3 stages (one with no sign-off): all stages in order with the "Job so far" summary and each stage's own sign-off rows; CSV has `stage_no`, `status`, `signoff_required`.
18. Other records' sign-off blocks unchanged (spot-check REC 7.4.2, 7.4.9).
19. Tablet width: no horizontal scroll, 44px headers, both sign-off blocks readable. Bump `?v=` strings.

## 8. Open questions for Michaela

Decided and no longer open: autofilled weights trigger the sign-off; every stage with a weight or count is submitted with finance present.

1. Whole weight read-only from receiving (default), or editable?
2. Month hidden everywhere on 7.4.6, history included (data kept)? Report period: Date in (default) or Date out?
3. Cooking date with several cooking days: latest (default) or earliest? Weight in = Cooking cards only, Blanching excluded. Confirm.
4. Date out: should it also fill from REC 7.4.10's Actual dried date (latest transfer)? Default: stays typed.
5. Weight out sums all submitted 7.4.10 transfers for the job (default). Confirm a job can have more than one.
6. Are values from an earlier submission locked for the next user (default), or freely editable (every stage is kept either way)?
7. What counts as Complete? Default: Weight in, Date in, both Count in, Weight out, Date out, both Count out all filled. Add or remove any?
8. Should the Finance representative be typed free text (default) or chosen from a list of finance staff?
9. Should the "open jobs" list (not yet complete) appear on the dashboard so unfinished stock records are not forgotten?
10. Paper numbering: the dry labelling list is REC 7.4.6 on paper and 7.4.8 in the system. This brief assumes 7.4.6 = Dry Stock Control.

## 9. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.6-dry-stock-control-merge-job-info-instructions.md` and follow it. On REC 7.4.6 (`dry-stock-control`): merge the Job Info and Processing & Measurement groups into one section "Dry stock control", Job no. first, no auto-collapse. Keep `wholeWeight` (read-only from receiving), hide the duplicate `jiIntakeWeight` after repointing readers; hide Received from, Processing for, Intake date (audit and repoint to a lookup by `jobNo`, drop nothing); remove Month from the form and required validation without deleting data. After Confirm autofill read-only: Cooking date (latest submitted REC 7.4.0 Cooking card date), No. of trolleys (latest submitted REC 7.4.1 count), Weight in (total cooked weight, Cooking cards only, reuse the existing cooked-weight calculation), Weight out (sum of `totalDriedWeight` of the job's submitted REC 7.4.10 entries); unlock with an amber note if a source is missing. Make the record progressive: submit is allowed at any point; **the sign-off rule triggers as soon as ANY of Weight in, Count in factory, Count in finance, Weight out, Count out factory, Count out finance has a value (autofilled, typed or carried forward all count)**, from which point **both Completed by and Finance representative (Name, Title, Date, Signature each) are required to submit**; before the trigger a stage submits with no sign-off and is attributed through server-set `submitted_by` / `submitted_at`; Save draft never needs sign-off; the trigger field list is in the record definition (`signOffTrigger`, rule `anyHasValue`); the API enforces the rule server-side through a server-computed `signoff_required`. Picking the job again loads the latest submitted stage's **data**, earlier values locked, autofilled fields refreshed with a "changed since last submission" chip; **sign-offs never reload**, both blocks open blank on every new stage; each submission is a new immutable stage row (`stage_no`, `previous_submission_id`, `is_latest`, computed `completion_status`), one line per job in the list with a stage expander, the views in section 6 and a backfill that makes old submissions stage 1 with finance "Not recorded". Add the "Finance representative" sign-off using the shared SignOffBlock with `_fin_` ids, saved per stage in `rawJson` and in new `financeRep` / `financeRepDate` columns, on print and as the last CSV columns, 7.4.6 only. All database changes in a reviewed SQL file under `scripts/` with backup and dry run. Export the live definition first, keep JSON and live tables identical, bump `?v=` strings, run section 7 and write a short work log. Do not change REC 7.4.10 or other records' sign-off.
