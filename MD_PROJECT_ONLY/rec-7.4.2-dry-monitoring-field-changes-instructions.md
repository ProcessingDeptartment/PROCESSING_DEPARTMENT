# REC 7.4.2 Dry Monitoring: field changes (instructions for Claude Code)

**Purpose:** REC 7.4.2 is the record filled in when the user walks into the dry room and checks the job batches. It used to be typed in full because the job data was recorded by hand. That data now exists elsewhere in the system, so the user should no longer re-record it.

**Scope:** REC 7.4.2 only (`dry-monitoring`, table `sub_dry_monitoring`). Do not change REC 7.4.1, 7.4.0 or 7.4.3.x. No new records, no new pages. This file extends section 8 of `drying-process-refinement-instructions.md`; where the two overlap, this file wins for the fields listed here.

Do NOT run `prisma migrate` or `prisma db push` (schema drift, see SIGNOFF_MIGRATION_TODO.md). Add columns with a reviewed SQL file run in the Neon SQL Editor, same as the completed-by change.

## 1. The seven changes

| # | Field | Change |
|---|---|---|
| 1 | Date | **Remove** the typed Date field. |
| 2 | Cooking date | Keep the field, make it **read-only** (autofilled from the job). |
| 3 | Dry room area | Change from free text to a **dropdown list**. |
| 4 | No. of trolleys | Keep the field, make it **read-only** (autofilled from the job). |
| 5 | Estimated drying date | **Calculated, read-only:** cooking date + 22 days. |
| 6 | QC check and Supervisor | **Remove** both fields. |
| 7 | Yes/No answers | **Yes shows red** (a problem). Only exception: Trolleys clearly marked, where Yes is green and No is red. |

Find the exact field keys and labels in `data/record-definitions.json` and `dry-monitoring.json` first. Do not guess keys. List the current fields back to Michaela before editing.

## 2. Change 1: remove Date

- The typed Date field is removed from the form, the print sheet, the entry list and CSV export. It is not hidden, it is gone from the definition.
- The record still needs an entry date for traceability and trends. Use the **system-stamped submit date** (server time, read-only, never typed), the same rule as REC 7.4.1 (D16). Store it in the entry's existing created/submitted timestamp; if the table has no separate `entry_date` column, add one (`entry_date DATE`, filled by the server at save).
- Show it as a small read-only line "Entry date" at the top of the form and on the print sheet, so the printed sheet is still dated. If this is not wanted on screen, keep it on print only.
- **Old entries keep their typed Date.** Move the old value to `date_old` (TEXT/DATE as it was stored), shown labelled "(old)" on view/print of old entries only. Nothing is deleted or overwritten. One migration script under `scripts/`, before/after row counts, every old value equal to its new home.
- Check that nothing else reads the removed key (reports, lists sorted by date, the Traceability view, `v_dry_monitoring_trolley_check`). Switch them to the entry date.

## 3. Change 2: Cooking date, read-only

- Source: the record date of the job's submitted **REC 7.4.0 Cooking** entries (Cooking cards only, never Blanching), using the existing job lookup (`wireRecordPick` / `window.Traceability.trace(jobNo)` and table `dry_cooking_pot` matched on `job_no`). No new path.
- Autofills as soon as the job number is picked. Read-only with the note "From REC 7.4.0".
- Only **submitted** 7.4.0 entries count. Drafts are ignored.
- **If the job was cooked over more than one day:** default to the **latest** cooking date (the whole job is not ready until the last lot is done). Show the note "Cooked on 3 dates, latest used". Flag as decision D-A below.
- **If no 7.4.0 exists for the job:** amber note "No REC 7.4.0 cooking date for this job. Fill in REC 7.4.0 first", and the field **unlocks** so the user can type it. Saving and submitting are never blocked. Mark the entry `cooking_date_typed_manually = true`.
- Stored on the entry as a copy (audit snapshot) with `cooking_date_source_ids`. Old entries keep what they were saved with.

## 4. Change 3: Dry room area, dropdown

- Replace the free-text field with a dropdown (single select, nothing pre-selected, required at Submit).
- **Option list: get it from Michaela before building.** Do not invent area names. First check whether the dry room areas already exist somewhere in the system (for example in REC 7.9.3.1 Dry Room Temp & Humidity Log, or the 7.4.1 dry room movement) and reuse that list so the names match across records. If a list exists, use it as the single source and do not copy it into a second place.
- Keep the option list in one editable place (lookup/config table or the record definition's options), not hard-coded in the page, so an admin can add a room without a code change.
- **Old entries:** the old typed text is kept as saved and shown as it was. If an old value does not match any option, show it read-only labelled "(old)" and do not force a match. Produce a list of the distinct old values so Michaela can map them to the new options; do not auto-map without approval.
- Store the chosen value as text in the existing column (keep the column name), so trends by area work with a simple GROUP BY.

## 5. Change 4: No. of trolleys, read-only

This is already decided in section 8 of `drying-process-refinement-instructions.md`. Apply it as written:

- Read-only, autofilled with the **current trolley count for the job**: the count on the latest submitted REC 7.4.1 entry that has one.
- No 7.4.1 count: amber note "No REC 7.4.1 trolley count for this job. Fill in REC 7.4.1 first", field unlocks, never blocks saving or submitting.
- Stored as a copy with `trolleys_source_submission_id` and `trolleys_typed_manually`. Old entries keep their saved count.
- `trolleysClearlyMarked` stays a typed Yes/No (daily observation).
- View `v_dry_monitoring_trolley_check` lists 7.4.2 entries whose count differs from the job's count on that date.

## 6. Change 5: Estimated drying date

- **Formula:** Estimated drying date = Cooking date + 22 days (calendar days).
- Calculated in the page and stored on the entry, read-only, labelled "Estimated drying date". It is a calculated field: nobody can type in it.
- Blank until a cooking date exists. Never show NaN, 1970 or today's date as a fallback.
- **Recalculate** whenever the cooking date changes (job picked, or the date typed manually when no 7.4.0 exists). Because the cooking date is a copy stored on each entry, the estimate on an old entry does not move.
- The 22 is a **setting, not code:** one config value `dryingDaysEstimate = 22`, editable by an admin, in the same place as the other config values (the trolley kg guide uses one). Changing it affects new entries only.
- Date arithmetic must be timezone-safe: add 22 days to the date part only (Africa/Johannesburg), so a late-night save never lands a day off. Example: cooking date 2026-09-01 gives 2026-09-23; 2026-12-15 gives 2027-01-06.
- Optional and not requested: a soft amber flag when today is past the estimated date and the job has not been moved into the grading room. Do not build unless Michaela asks.
- Database: add `estimated_drying_date DATE`. Expose `days_to_estimated_drying = estimated_drying_date - CURRENT_DATE` in the view so overdue and due-this-week jobs can be listed.

## 6a. Change 6: remove QC check and Supervisor

- Remove the "QC check" and "Supervisor" fields from the form, print sheet, entry list and CSV export (find the exact keys in `dry-monitoring.json` first; if "QC check" is a group of fields, list them back to Michaela before removing).
- Not hidden: gone from the definition. Their role is covered by the Completed by block (and Verified by row on print).
- Old entries keep their values in `qc_check_old` and `supervisor_old` columns, shown labelled "(old)" on view/print of old entries only. Nothing deleted. Include them in the same migration script and before/after comparison.
- Check nothing else reads the removed keys (reports, lists, traceability).

## 6b. Change 7: Yes/No colouring (Yes = bad, shown red)

On REC 7.4.2 the Yes/No checks are problem checks (for example mould, pests, damage, moisture): **Yes means a problem was found, so it must show red.**

- **Rule:** every Yes/No field on REC 7.4.2 turns **red** when the answer is Yes. No stays neutral (or a calm green tick, see below).
- **Only exception:** `trolleysClearlyMarked` ("Trolleys clearly marked"). Here **Yes is good**: Yes shows green, **No shows red**.
- Implement it as a per-field flag in the record definition, not hard-coded in the page: `yesIsBad: true` (default for every Yes/No field on this record) and `yesIsBad: false` on `trolleysClearlyMarked`. An admin can then flip a field later without a code change. First list every Yes/No field on 7.4.2 (keys and labels) back to Michaela and confirm none other is a "good Yes".
- Colour is not the only signal (colour-blind users, black-and-white print): the red answer also shows the text "Yes" or "No" in bold plus a small warning mark, and it prints as bold with a border.
- Applies on the entry form (answer button turns red as soon as selected), the saved entry view, the entry list, and the print sheet.
- A red answer is a soft prompt only: show a required "Comment / corrective action" box for that check when it is red (use the record's existing comment or corrective action field if it has one). Never block Draft. Blocking Submit without a comment is decision D-F.
- Old entries: colouring is applied when displaying, so old answers also show red where they were Yes. No stored data changes.
- Reporting: add a view `v_dry_monitoring_flags` with one row per entry per red answer (job_no, entry_date, dry_room_area, field key, answer) so problems by room and by week can be counted for trends.
- Test: select Yes on a problem check gives red; No stays neutral; `trolleysClearlyMarked` Yes is green and No is red; print keeps the difference without colour; old Yes answers show red.

## 7. Database (Neon)

Provide one SQL file for the Neon SQL Editor, `CREATE`/`ADD COLUMN IF NOT EXISTS`, one transaction, safe to re-run. Take a backup copy of `sub_dry_monitoring` and the `RecordFieldDef` rows for `dry-monitoring` first.

Columns to add to `sub_dry_monitoring` (only those that do not already exist):

- `entry_date DATE` (server-stamped)
- `date_old` (the removed typed Date, same type as before)
- `cooking_date DATE` (if the existing column is TEXT, keep the old TEXT in `cooking_date_old` and add a real DATE column, so month-end trends and date maths work)
- `cooking_date_source_ids TEXT` / JSON, `cooking_date_typed_manually BOOLEAN`
- `estimated_drying_date DATE`
- `qc_check_old`, `supervisor_old` (removed fields, same types as before)
- `trolleys_source_submission_id`, `trolleys_typed_manually` (from section 8 of the earlier file)

Then bump `version` on the `dry-monitoring` `RecordDefinition` row, update `RecordFieldDef` for the changed fields, update `data/record-definitions.json`, the two `prisma` schema files by hand (no migrate), and run `node scripts/export-record-defs.mjs` for the offline cache file. Raise the `?v=` cache-buster on the scripts loaded by the 7.4.2 page.

## 8. Submit checks

- Hard block: job number filled; dry room area chosen.
- Soft warning only (never blocks): cooking date missing, trolley count missing, estimated date missing.
- The existing Completed by block (Completed by / Title / Date / Signature) is unchanged and stays the last block. Its Date is the sign-off date, not the removed monitoring Date.

## 9. Testing checklist

1. Open REC 7.4.2: no typed Date field on screen, print or list; a read-only Entry date shows.
2. Pick a job with a submitted 7.4.0 and 7.4.1: cooking date and trolleys fill read-only; estimated drying date shows cooking date + 22 days (2026-09-01 gives 2026-09-23; 2026-12-15 gives 2027-01-06; a 31 January date gives the correct February/March date).
3. Pick a job cooked over two days: latest date used with the note. Job with only a draft 7.4.0: draft ignored, amber note, cooking date unlocked. Type a date manually: estimate recalculates and the entry is flagged typed manually.
4. Pick a job with no 7.4.1 trolley count: amber note, field unlocked, Submit still works.
5. Dry room area is a dropdown with the agreed list, nothing pre-selected, Submit refuses an empty one.
6. Change the config `dryingDaysEstimate` to 21: a new entry uses 21, an old saved entry keeps its estimate.
7. Open an entry saved before this change: it opens fine, old Date shows labelled "(old)", old dry room area text shown as saved, nothing lost.
8. In Neon: `SELECT job_no, cooking_date, estimated_drying_date, estimated_drying_date - cooking_date AS days FROM sub_dry_monitoring ORDER BY "createdAt" DESC LIMIT 10;` gives 22 for every new row.
9. Print an entry sheet: shows entry date, cooking date, estimated drying date, area and trolleys, Completed by row intact.
10. Tablet width readable; dropdown easy to tap.
11. CSV export opens cleanly in Excel, dates in ISO format.

## 10. Decisions and questions for Michaela

- **D-A** Cooking date when a job was cooked on several days: default latest. Say if earliest is wanted.
- **D-B** Dry room area list: send the room names (or confirm the 7.9.3.1 list is the right one).
- **D-C** "22 days" is calendar days from cooking date, configurable. Confirm it does not vary by product, farm or season.
- **D-D** "Remove date" is read as: remove the typed Date field and replace it with the system entry date. Say if the record should carry no date at all on screen.
- **D-F** Should a red answer block Submit until a comment is entered? Default: comment prompted, not blocking.
- **D-E** Old dry room area text: OK to review a distinct-values list and map them by hand.

## 11. Build order for Claude Code

1. List the current 7.4.2 fields and keys back to Michaela, get D-B.
2. SQL file (backup, columns), review, run in Neon.
3. Update definition (remove Date, read-only cooking date and trolleys, area dropdown, calculated estimate), regenerate snapshot. **Stop for review here.**
4. Autofill from 7.4.0 and 7.4.1, unlock rules, estimate calculation, config value.
5. Migration script for old Date values (dry run, compare, then run). View updates.
6. Run the checklist and report pass/fail per item.
