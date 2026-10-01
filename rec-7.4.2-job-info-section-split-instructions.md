# REC 7.4.2 Dry Monitoring: Job info section has taken over, and the whole form collapses (instructions for Claude Code)

**Date:** 2026-10-01
**Raised by:** Michaela: "7.4.2 Job info section has taken over" and "once job detail input then the whole checks collapse"
**Scope:** REC 7.4.2 only (`dry-monitoring`). No new fields, no field renames, no calculation, DB or export changes. Layout/grouping and collapse behaviour only.
**Related:** `record-sections-collapse-and-job-autofocus-instructions.md` (Job entry = Job no. only, auto-collapse), `rec-7.4.2-dry-monitoring-field-changes-instructions.md`.

## 1. What is wrong (observed on the live page, confirmed by Michaela)

The first section, "Job info", holds **everything** on the form: 26 inputs, "0 of 6 fields done". It contains:

- Job number (correct)
- Received from (farm), Processing for, Whole weight, Intake date (job data, should not be on this record)
- Entry date, Cooking date, Dry room area, No. of trolleys, Estimated drying date (record data)
- Trolleys clearly marked, Mould visible, White salt on surface, Case hardening, Surface shine, Foot damage, Comment / corrective action (the actual monitoring checks)
- Comments, plus "Date (old)", "QC check (old)", "Supervisor (old)" showing on a brand-new entry

Only two sections exist (Job info and Sign off). **Bug as reported:** once the job is selected, the Job info section auto-collapses, and because the checks live inside it, **the whole checks area folds away with it**. The user cannot enter the checks after choosing the job.

Root cause: wrong grouping in the record definition (all fields assigned to the job section), not the collapse code itself. Auto-collapse is working as designed on the wrong container.

## 2. Target layout

| Section | Fields |
|---|---|
| **Job info** | Job number ONLY (picker, job details pop-up with Confirm/Cancel, then collapses to `JOB INFO, <job no>`) |
| **Dry room details** | Entry date (read-only), Cooking date (read-only), Estimated drying date (read-only), Dry room area (dropdown), No. of trolleys (read-only) |
| **Checks** | Trolleys clearly marked, Mould visible, White salt on surface, Case hardening, Surface shine, Foot damage, Comment / corrective action |
| **Comments** | Comments |
| **Sign off** | Unchanged (Completed by block, last) |

All sections collapsible, all open on load. **Only Job info collapses after the job is confirmed.** Dry room details, Checks, Comments and Sign off stay open and enterable.

## 3. Changes

1. **Re-group in the record definition** (`data/record-definitions.json` / `dry-monitoring.json`, then the `RecordFieldDef` section values): add the sections above and assign each existing field to one. Field keys, order within a section, labels and storage columns do not change.
2. **Job info = job number only.** Remove Received from, Processing for, Whole weight and Intake date from the rendered form. Per the collapse brief, these show only in the confirmation pop-up. Before removing, check what reads them (list columns, print, CSV, trends). Repoint to a lookup by `jobNo`; do not drop any stored column or old data. Write an audit table in the work log.
3. **Auto-collapse guard (the reported bug).** Auto-collapse acts on the single section that contains the job picker, and nothing else. Add a safety check in the shared code: if that section contains any field other than the job picker, do not auto-collapse it, and log a console warning naming the record. This stops the same mistake recurring on another record.
4. **Progress counter** ("x of y fields done") is per section, so Job info shows 0 of 1 and each new section counts its own fields.
5. **Old-value fields** (`Date (old)`, `QC check (old)`, `Supervisor (old)`): render only when viewing an old entry that has a value in them. Never on a new entry, never on a blank form. Place them in a small "Earlier values" block at the end of Dry room details (not in Job info).
6. **Print / CSV** unchanged in content and order; print shows all sections expanded.
7. **Check other records for the same fault.** List every record whose definition puts non-job fields in the same section as the job picker. Report them back; do not change them without approval.

## 4. Test

1. New entry: Job info shows only Job number; the other sections are visible below it.
2. Pick a job, Confirm: autofill fills cooking date, trolleys, estimated drying date; Job info folds to one line; **Checks stay open and every check can be answered**.
3. Re-open Job info by clicking its header: job number intact. Change the job: autofill reruns, Job info folds again, Checks untouched and any answers already given stay.
4. Section progress counters are correct per section.
5. New entry shows no "(old)" fields; an old entry with saved Date/QC/Supervisor shows them labelled "(old)".
6. Existing entries open and print identically to before (field values, order, Completed by row). CSV unchanged.
7. Tablet width: no horizontal scroll, 44px section headers.
8. Bump `?v=` on scripts loaded by the 7.4.2 page.

## 5. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.2-job-info-section-split-instructions.md` and follow it. Bug: on REC 7.4.2, picking a job collapses the whole form because every field sits in the Job info section. Split it into Job info (job number only), Dry room details, Checks and Comments, keep Sign off unchanged, so only Job info collapses. Add the auto-collapse guard from section 3.3. Do not change field keys, labels, calculations, DB columns or exports. Hide the four job-data fields (farm, processing for, whole weight, intake date) after auditing and repointing anything that reads them. Show the "(old)" fields only on old entries. Report other records with the same grouping fault. Bump the `?v=` strings, run section 4 and write a short work log.
