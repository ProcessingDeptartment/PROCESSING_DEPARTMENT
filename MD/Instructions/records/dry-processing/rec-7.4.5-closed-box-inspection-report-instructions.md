# REC 7.4.5 Closed Box Inspection: per-box checks on boxes closed in 7.4.3 (instructions for Claude Code)

**Date:** 2026-10-01 (revision 2)
**Raised by:** Michaela. Revision 2 decisions (2026-10-01):
- The **"+ Full box"** action in REC 7.4.3.1 / 7.4.3.2 marks a box as **closed**, and in the same action moves the bin code to the **next number in the sequence**.
- **Frills present: Yes = pass.**
- **Nett weight is typed.**
- **The job number link is cancelled:** REC 7.4.5 has no job number selector. Boxes are listed from the closed boxes themselves.
**Related:** `rec-7.4.4-replace-form-with-report-instructions.md` (box code = bin code, `stock_link`), `rec-7.4.3-totals-section-start-collapsed-instructions.md`, `tablet-ui-optimisation-brief.md`.
No code was written for this brief. It is the specification.

## 1. What this record is

REC 7.4.5 is a **closed box inspection record**. Every time someone presses **+ Full box** in 7.4.3.x, one box is closed and becomes available for inspection. The 7.4.5 page lists the closed boxes that have not been inspected yet and the inspector answers the checks for each one. The user does not type a box list and does not pick a job.

Why no job link: a box can hold stock from more than one job (topped-up bins), so a job number is the wrong key for a box. The box code is the key. Which job(s) fed a box stays traceable through `stock_link` and is shown read-only (section 2). If Michaela wants the job number hidden on the page entirely, that is a display change only.

Existing REC 7.4.5 data stays readable as **legacy 7.4.5**. Do not delete the old definition or any old submission.

## 2. Page layout

**No header fields, no filters, no inspector field, no date of inspection field** (Michaela, 2026-10-01). The page opens straight on the closed box list. Who completed it comes from the common sign off block, and the date is the packing date stamped on submit (see below), which is not shown as a field. Already inspected boxes are not shown on this form at all.

**Section 1: Closed boxes.** A roster that fills itself with **every closed box that has not been completed**, oldest first. A box counts as completed only when a 7.4.5 record covering it has been **submitted**. A box with no inspection, or only a saved draft, stays on the list. It leaves the list the moment its inspection is submitted, and not before. If a draft covers a box, the row shows "Draft in progress" with a link, so two people do not inspect the same box. Nothing is typed to create a row.

Read-only columns, from 7.4.3.x and `stock_link`:

| Column | Source |
|---|---|
| Box code | the bin code the box carried when **+ Full box** was pressed (before it advanced) |
| Size grade | roster `sizeGrade` |
| Date / time closed | when **+ Full box** was pressed (see section 3) |
| Job(s) in box | `stock_link` edges for that code. Information only, not a selector, not a link to filter by. A blended box shows all contributing jobs |
| Nett weight set in 7.4.3 (kg) | the value the **+ Full box** action records for that box. This is a nett weight, not a gross weight (Michaela, 2026-10-01); the roster field currently called `fullBoxWeight` holds it. Relabel it "Nett weight" in 7.4.3 if the label says gross or full box weight |

Input columns, filled by the inspector:

| # | Column | Type | Pass value |
|---|---|---|---|
| 1 | Tare weight (kg) | number, 2 decimals, greater than 0 | n/a |
| 2 | Nett weight (kg) | number, **typed**, 2 decimals, greater than 0 | n/a |
| 3 | Colour uniform | Tick box (ticked = Yes) | Yes |
| 4 | Correct size grade | Tick box (ticked = Yes) | Yes |
| 5 | Frills present | Tick box (ticked = Yes) | **Yes** |
| 6 | Bag sealed | Tick box (ticked = Yes) | Yes |
| 7 | Box sealed | Tick box (ticked = Yes) | Yes |
| 8 | Silica satchets present | Tick box (ticked = Yes) | Yes |
| 9 | Comment / corrective action | text | required whenever any check fails |

Store the pass value per question as a setting in the record definition (all currently Yes) so it can change without code.

Row behaviour:

- **Every box on the list is meant to be completed before Submit.** If the inspector presses Submit while any listed box is untouched, show a warning that names the count and the box codes ("3 closed boxes on this list have not been inspected: ..."), with **Go back** and **Submit anyway**. **Submit anyway is allowed** (Michaela, 2026-10-01). Boxes that were not completed are not saved as inspections, get no packing date, and stay on the list for the next record. A row that has been started (a weight typed or a box ticked) must still be finished, since a half-filled box would be a false record.
- **The six questions are tick boxes (Michaela, 2026-10-01): ticked = Yes, unticked = No.** Large tick boxes (at least 44px tap target), never pre-ticked. Because an unticked box means No, an unticked box on a row the inspector has started is a failed check: it turns red and the comment becomes required. No separate "unanswered" state exists for the six checks; the row is "started" once a weight is typed or any box is ticked, and the inspector must tick everything that passes before Submit. Tick boxes are stored as true/false.
- Row status badge: **Not started / Incomplete / Pass / Fail**. Incomplete = a weight or comment is missing. Pass = all six boxes ticked and weights valid. Fail = any of the six unticked.
- No "tick all" shortcut. Each box is ticked on its own.
- On tablet each box can show as a card instead of a nine-column row.

**No summary section** (Michaela, 2026-10-01). The page has only the closed boxes list and the sign off. Counts appear only inside the submit warning.

**Section 2: Sign off.** The **common sign off section used on all the other forms**, unchanged, reused as is (same labels, same signature and date behaviour). Do not build a special version and do not add a separate Inspector field.

### Packing date (Michaela, 2026-10-01)

The **packing date of a box is the date this form is completed (submitted) for that box.** It is not typed anywhere.

- Each box gets a read-only **Packing date** that is blank while the box is waiting or in draft, and is stamped automatically when the 7.4.5 record covering it is **submitted**. A draft save never sets it.
- The date is set by the server at submit time in South African time (Africa/Johannesburg), so a late-evening submit on a tablet with a wrong clock cannot give a wrong date. Stored as a date and as a full timestamp.
- Boxes on one record can only be submitted together, so they get the same packing date. A box left untouched is not inspected and gets no packing date; it stays on the list.
- The packing date is **not** changed by a later edit, by a verification, or by a re-inspection. A re-inspection keeps the original packing date and records its own inspection date; show both.
- There is **no visible date field** on the form (no date of inspection, no packing date placeholder). The packing date is stored and shown only on the reports and the 7.4.4 trace report. The inspector is recorded from the sign off block and the logged-in user in the stored row, not as a field on the page.
- Use: shown on the closed box report, on the 7.4.4 trace report per box, and as a check on the Dry Export Pack (its Packing date should fall on or after the latest box packing date in that shipment; warn only).

## 3. What "closed" means in the data (Claude Code must verify first)

Rule: a box is **closed** when **+ Full box** has been pressed on its roster row in 7.4.3.1 or 7.4.3.2. That action also advances the bin code to the next in the sequence (the `fixedGroups` continuation across both logs), so the code that was current when it was pressed is the closed box's code.

Before building, inspect the live 7.4.3.1 / 7.4.3.2 definitions and the page script behind **+ Full box**, and report back:

1. What is stored when the button is pressed (a new roster row, a counter, the nett weight value, a flag, a timestamp), and whether the nett weight is typed in 7.4.3 or a fixed preset value.
2. Whether the closed box's code and weight are saved in the submission, or only the next bin code. If the closed box is not stored as its own row, the 7.4.3 change in section 7 is needed first.
3. Whether a closed box can be un-closed, edited or deleted after the fact, and what that should do to a box that already has an inspection (section 4, rule 8).

4. **Full boxes only (Michaela, 2026-10-01).** Only boxes closed with **+ Full box** are listed. Half boxes, part-filled bins and any other partial or leftover quantity are **never** listed, even if a bin was closed off or carried over. Report how 7.4.3 distinguishes a full box from a half box (a separate button, a weight threshold, a type field). If the data cannot tell them apart, stop and ask; do not use a weight guess.

Do not guess. If the data does not hold a closed-box record with its code, stop and report; do not infer it from bin code gaps.

The list must include closed boxes from **draft** 7.4.3 records as well as submitted ones, with a "from draft" badge on those, because boxes are inspected while grading is still running.

## 4. Validation rules

1. Tare and nett weight required and greater than 0 for every started row.
2. **Nett weight must match the 7.4.3 value (Michaela, 2026-10-01).** The nett weight typed in 7.4.5 must equal the nett weight set when **+ Full box** was pressed in 7.4.3 for that box, compared to 2 decimals. Gross weight is not used anywhere on this record. On a mismatch the row turns red, shows "Nett weight does not match 7.4.3 (7.4.3: XX.XX kg)", and **Submit is blocked** until the 7.4.5 value is corrected to match. The user cannot override it here. If 7.4.3 itself is wrong it is corrected in 7.4.3 (audited), after which the row re-checks against the new value. Compare with a tolerance setting that defaults to 0.00 kg so it can be loosened later without code. If 7.4.3 has a fixed preset value for full boxes, show it and use the same rule.
3. Tare, nett and the comment (when needed) completed on every started row before **Submit**. Unticked boxes count as No (fail), not as unanswered. Save draft is never blocked.
4. Any failed check requires a comment before Submit.
5. **Warn, then allow:** submitting with listed boxes not completed shows the warning (see the closed boxes section) and then lets the user submit. Store on the record "Submitted with N boxes outstanding" (count and box codes) so the sign off and reports show it.
6. A box can have only **one current inspection**. A box already inspected (submitted) does not appear on this form. A deliberate **Re-inspect** is started from that box's row in the closed box inspection report; it adds the box back to this form, and on submit creates a new inspection and marks the old one superseded; the old one is kept.
7. Box codes are normalised (trim, upper-case) before matching.
8. If a 7.4.3 box is changed or un-closed after being inspected, do not delete or silently alter the inspection. Flag it on the report as "Box changed after inspection" with the date, for QC to review.
9. After submission the record is locked and carries an audit trail, as for other controlled records.

## 5. Database design (traceable, simple, easy to analyse)

Keep the submission as today and **also** write one flat row per inspected box, in the same transaction as the submission. Every save replaces that submission's rows (no duplicates).

Table `box_inspection`:

| Column | Type | Notes |
|---|---|---|
| id | identity | |
| submission_id | FK | the 7.4.5 record |
| record_status | text | draft / submitted / verified |
| box_code | text | normalised, same value as the bin code |
| source_submission_id | FK | the 7.4.3.x record the box was closed in |
| source_record_key | text | `grading-production-log-cultivated` / `-ranched` |
| size_grade | text | as shown from 7.4.3 |
| closed_at | timestamptz | when **+ Full box** was pressed |
| nett_kg_7_4_3 | numeric(8,2) | the nett weight set in 7.4.3 for this box, copied at the time so later edits do not rewrite history |
| tare_kg | numeric(8,2) | |
| nett_kg | numeric(8,2) | typed |
| colour_uniform, size_grade_correct, frills_present, bag_sealed, box_sealed, silica_present | boolean | true = Yes |
| result | text | pass / fail, stored |
| failed_checks | text | names of failing checks |
| comment | text | |
| packing_date | date | set by the server when the record is submitted (Africa/Johannesburg); null in draft; never changed afterwards |
| packed_at | timestamptz | exact submit time behind `packing_date` |
| inspected_at | timestamptz | time of this inspection (differs from `packed_at` on a re-inspection) |
| inspected_by | text | |
| superseded_by | FK, nullable | set by a re-inspection |

There is **no job number column that is used as a key**. Jobs for a box are read from `stock_link` (job to bin edges), so the one source of truth for blending stays in one place. A read-only copy of the contributing job numbers may be stored for fast display only.

Rules:

- Plain SQL types, no vendor-specific features, so it moves from Neon to any other Postgres or exports to CSV unchanged.
- Indexes: `(box_code)`, `(submission_id)`, `(source_submission_id)`, `(inspected_at)`, `(closed_at)`, `(result)`. Partial unique index on `box_code` where `superseded_by is null and record_status <> 'draft'`.
- Rows are never overwritten after submit; a re-inspection inserts a new row.
- Write one `stock_link` edge per inspected box (`box_code -> inspection`, with status) so the 7.4.4 trace report can show the inspection. Reuse the existing write path.
- Views: `v_box_inspection_current` (non-superseded, non-draft) and `v_box_inspection_trend` (by week and size grade: boxes inspected, fail count, fail rate per check, average tare, average nett). Add a third, `v_boxes_awaiting_inspection`, listing every closed box with no **submitted** inspection (drafts do not count as completed) and how long it has waited. The form's list reads from this view. Document all three in the schema notes.
- No backfill needed. Old 7.4.5 submissions stay legacy.

## 6. Outputs

- **Print:** A4 landscape, header with generated-on date and time and the user who printed it; one row per inspected box; failed cells marked; sign off. All sections expanded.
- **CSV:** one row per box, columns as in section 5, Yes/No instead of true/false.
- **Report view** (separate menu entry "Closed box inspection report", read-only): no filters, a plain table of every inspected box, newest first, column sorting only. Shows current inspection per box, failures by check, boxes waiting, and links to the source 7.4.3 and 7.4.5 submissions. Reads from the views above. This is the audit evidence for a mock recall.

## 7. Changes to other records

- **REC 7.4.3.1 / 7.4.3.2:** only if the section 3 check shows the closed box is not stored on its own. In that case **+ Full box** must save the closed box's code, size grade, weight and timestamp as a roster row at the moment it is pressed, then advance the bin code. Do not change the sequence logic or existing submissions. Report back before changing.
- REC 7.4.4 trace report: show inspection result and date per bin row, read-only.
- REC 8.1.7: change wording to "Closed box inspection" if it implies the old format.
- Update `data/record-definitions.json`, `public/data/record-defs/` and the live definition tables together; bump the definition version; do not run `seed-definitions.mjs` against a stale JSON. Bump `?v=` strings on touched pages and scripts.

## 8. Testing checklist

1. Press **+ Full box** three times in 7.4.3.1: three boxes appear on 7.4.5 with the correct codes, the bin code has advanced each time, and the next box in progress does not appear.
2. A box still open (not closed) is never listed. A half box or part-filled bin is never listed, only boxes closed with **+ Full box**.
3. Boxes from a draft 7.4.3 record appear with the "from draft" badge.
4. A blended box shows all contributing jobs, read-only, and is inspected once.
5. All checks Yes with valid weights: Pass.
6. Frills "No": row Fail, comment required, Submit blocked until filled.
7. A started row with a missing weight: Incomplete, Submit blocked, Save draft works. An unticked check counts as No: row Fail, comment required. Untouched rows: Submit shows the warning with the count and codes; Go back returns to the form; Submit anyway saves the record, the outstanding boxes stay listed, the record shows "Submitted with N boxes outstanding".
8. Type a nett weight different from the 7.4.3 value: row red with the 7.4.3 value shown, Submit blocked; correct it to match and Submit works. Change the value in 7.4.3 after inspection: the box is flagged "Box changed after inspection".
9. Save twice: no duplicate `box_inspection` rows.
10. A box with only a saved draft is still listed (marked "Draft in progress"); it disappears only after Submit. Inspected boxes disappear from this form and can be seen in the closed box inspection report. No filters, inspector field or date field appears on the form.
10a. Packing date is blank in draft, set to the submit date when the record is submitted, shown read-only, and identical for all boxes on that record. A box not touched has none. Editing or verifying later does not change it; a re-inspection keeps the original packing date.
11. Re-inspect creates a new row and supersedes the old; history kept.
12. Change a 7.4.3 box after inspection: inspection kept, "Box changed after inspection" shown.
13. Views and CSV match a hand count; print has the generated-on stamp.
14. Tablet width: toggles at least 44px, no horizontal scroll.
15. Old 7.4.5 submissions open read-only.
16. `EXPLAIN` on the trend view with a large seeded table uses the indexes.

## 9. Open questions for Michaela

0. Packing date is the submit date of this form. Should it be the date the record is **submitted**, or the date the **inspector signs** it (normally the same day)? Default: submit date.
1. Replace the current REC 7.4.5 (old submissions kept as legacy), or a new record number alongside? Default: replace.
2. Should the job number be shown at all on the page (read-only, information only, as designed), or hidden completely?
3. Nett match tolerance defaults to exactly 0.00 kg difference. Keep exact?
4. Is a tick box enough for silica satchets, or do you want a satchet count later?

## 10. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.5-closed-box-inspection-report-instructions.md` and `claude/rec-7.4.4-replace-form-with-report-instructions.md`. First inspect the live REC 7.4.3.1 and 7.4.3.2 definitions and the **+ Full box** script and report what is stored when a box is closed and how a full box differs from a half box (section 3, points 1 to 4); list full boxes only; stop and report if the closed box is not stored on its own. Then build REC 7.4.5 as described: no job selector, a self-filling list of closed boxes awaiting inspection, per-box typed tare and nett weight, six Yes/No checks with Yes as the pass value (frills included) and a required comment on any fail, standard sign-off (no summary section), the warn-then-allow submit, the flat `box_inspection` table with its three views and the `stock_link` edge. Keep old 7.4.5 submissions readable. Do not run `seed-definitions.mjs` against a stale JSON, bump the definition version and `?v=` strings, run the section 8 tests and write a short work log.
