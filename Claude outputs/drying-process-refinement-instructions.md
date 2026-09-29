# REC 7.4.1 Drying Process — Refinement (one job, many daily entries: movements, trolleys, steaming)

Status: instructions only, no code written. For Claude Code (layout part can go to Claude Design).
Date: 2026-09-29. Based on the current definition `public/data/record-defs/drying-process.json` (recordKey `drying-process`, batchField `jobNo`).
Companion docs: `claude/dry-cooking-pots-roster-instructions.md` (7.4.0), `claude/drying-report-spec.md` (report that reads 7.4.1), `claude/consolidated-plan.md`.

## 1. How the form is used (this drives the whole design)

The operator logs in, picks the **job number**, adds **what they are busy with that day**, and submits. They do the same again on the following days. **Every submission is one entry, and all entries for a job number add up to the drying history of that job.** A drying job typically runs for weeks, so one job will have many entries.

So REC 7.4.1 is an **entry log per job**, not one big record per job (the same idea as REC 7.4.0, where a job has several entries). Consequences that run through this document:

- One submission = one **entry** (one day or one shift of work on the job). The job number is the thread that joins the entries.
- Each entry holds only what happened in that entry: which movement(s) took place, the steam(s) done, the trolley count as at that time.
- **Everything already recorded for the job is shown on screen** when the operator picks the job (history panel, 4.1), so they can see the last steam, where the job is now, and what is still to do.
- **Job-level facts** (date into dry room, steam count so far, current stage, drying days, yield) are **not typed**; they are worked out from the entries, in database views.

## 2. What is on the form (per entry)

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

### 2.1 Steam roster (steams done in this entry)

- Empty at first with one **"+ Add steam"** button; each press adds a row. Most entries will have one steam or none; more than one works.
- Row fields, in this order: **Steam no.** (automatic and read-only), **Date** (default the entry date), **Steaming temperature** (°C), **Steaming time** (minutes), **Start time** (time of day), **Done by** (optional initials).
- **Steam no. is per job, not per entry**: it continues from the highest earlier steam number for the job, so the first steam of day 3 is "Steam 6" if days 1 and 2 had five. It renumbers only inside this entry when a row is removed.
- These are per steam, because each steam has its own values (D8). Only Date is required in a row; temperature, time and start time may be empty on a draft.
- **Previous steam details always show.** All earlier steams for the job (from earlier entries) are listed read-only directly above the new rows (steam no., date, temperature, time, start time, done by), never collapsed, so the operator sees what the last steam was. Above the list a one-line summary: "Last steam: no. 5, dd Mon, 85 °C, 45 min, started 07:30".
- A new row copies the **previous steam's temperature and time** as suggestions (editable, lighter style until touched). Start time is left empty.
- Steam dates may not be earlier than the job's date into dry room.
- Print shows this entry's steams, and the history panel is printed as "Job so far".

### 2.2 Trolley loading guide (expected trolleys and kg per trolley)

The count alone says little. The factory rule of thumb is roughly **250 to 300 kg of harvest whole weight per trolley**, but nothing in the system holds that, so a wrong count goes unnoticed.

- Basis is the **harvest whole weight** (`jiIntakeWeight`), known at loading time.
- Two config values in one place (not in code): `trolleyKgMin = 250`, `trolleyKgMax = 300`, editable by an admin.
- **Expected trolleys** (read-only, shown as soon as the job is picked): whole weight ÷ max up to whole weight ÷ min, rounded. 1500 kg gives "Expected trolleys: 5 to 6 (250–300 kg each)".
- **Whole kg per trolley** (once a count is typed): whole weight ÷ trolleys as a chip: green "In range", amber "Light" below min, amber "Heavy" above max. 1500 kg on 4 trolleys is 375.0, amber "Heavy (usual 250–300)".
- **Cooked kg per trolley** in a smaller line, for trends only.
- A **guide, not a rule**: never blocks a Draft or Submit; outside the range is a soft warning with a reason.
- Check with Michaela (D11): 1500 kg at 250–300 kg per trolley is 5 to 6 trolleys, not 4 (4 trolleys is 375 kg each). Confirm the rule and whether it differs by farm or product.

### 2.3 Cooked weight from REC 7.4.0

- `cookedWeight` = sum of `abalone_kg` on all **Cooking** cards (never Blanching) across the job's submitted REC 7.4.0 entries, from table `dry_cooking_pot` matched on `job_no` (same lookup as `wireRecordPick` / `window.Traceability.trace(jobNo)`; no new path).
- Only submitted 7.4.0 entries count (drafts ignored, with a note "N draft entries ignored").
- Read-only while a source exists, with "From REC 7.4.0 — N cooking pots". If none: amber "No REC 7.4.0 found for this job", the field unlocks, saving is not blocked.
- Stored as a copy on the entry (audit snapshot) with `cooked_weight_source_ids`. On every new entry the current value is read again; an earlier entry keeps what it was saved with.

## 3. Fields removed or replaced (compared with the old single-record form)

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

## 4. Job-level view of the entries

### 4.1 "Job so far" panel (read-only, shown as soon as the job is picked)

- **Stage strip:** Loaded → In dry room → In container → In grading room, the current stage highlighted, each reached stage with its stamped date and time. Stage comes from the movement answers across all entries.
- **Counts:** entries so far, steams so far, days since date into dry room.
- **Last steam** line (2.1) and the full list of earlier steams.
- **Earlier entries** as a compact list, newest first: entry date, who, movements answered Yes, steams, trolley count. Tapping one opens it read-only.
- **Trolleys now:** the latest count, with a note if it changed during the job.
- If the job has no earlier entries the panel says "First entry for this job".

### 4.2 Calculated fields (read-only, stored per entry where they belong to the entry)

| Field | Key | Formula |
|---|---|---|
| Whole kg per trolley | `wholeKgPerTrolley` | Receiving whole weight ÷ this entry's No. of trolleys, one decimal |
| Cooked kg per trolley | `cookedKgPerTrolley` | Cooked weight ÷ No. of trolleys |
| Loading status | `trolleyLoadingStatus` | `in_range` / `light` / `heavy` |
| Cook loss % | `cookLossPct` | (Whole weight − Cooked weight) ÷ Whole weight × 100 |
| Steam count in this entry | `steamCount` | rows in this entry's roster |

Blank until inputs exist, never NaN or 0. **Job-level totals** (steams so far, drying days, yield, drying loss, stage) are calculated in the views (7.3), not typed and not stored on the entry.

## 5. Job-level numbers (defined once, used by the views)

- **Date into dry room / container / grading room**: the server stamp on the entry where that movement was answered Yes.
- **Drying days** = date into grading room − date into dry room (both from 7.4.1 entries); fallback to 7.4.3.1 `dateIntoGradingRoom`, then `gradingDate` (D1).
- **Yield %** = `actualDriedWeight` (7.4.3.1 / 7.4.3.2) ÷ receiving whole weight × 100 (or that record's own `yield`).
- **Drying loss %** = (cooked weight − dried weight) ÷ cooked weight × 100.
- **Steams so far** = count of steam rows for the job; **current trolleys** = the count on the latest entry that has one.

## 6. Submit checks

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

## 7. Database

Principle: every reportable value is a real typed column, the full submission JSON stays as the audit copy, plain relational so it moves to any other database or format without conversion. Neon (Postgres) as today. **`job_no` is the thread**, repeated on every row.

### 7.1 Parent table `dry_process_entry` (one row per submitted entry)

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

### 7.2 Child table `dry_process_steam` (one row per steam)

`id`, `entry_id`, `submission_id`, `job_no`, **`steam_no` (per job)**, `steam_no_old` (migration only), `steam_date` DATE, `steaming_temp_c` NUMERIC(5,1), `steaming_time_min` INT, `start_time` TIME, `done_by`, `created_at`. Unique on `(job_no, steam_no)`. Migrated rows leave temp, time and start time null.

Indexes: `job_no`, `entry_id`, `submission_id`, `steam_date`, on the parent `(job_no, entry_date)` and each movement date.

### 7.3 Views for trends (plain SQL views so they survive a move)

The join to 7.4.3.1 / 7.4.3.2 is on `job_no` (latest submitted grading record; if a job has both cultivated and ranched records, sum dried weight, noted in a view comment).

- `v_dry_job_progress`: one row per job, **the job-level picture built from all its entries**: farm, processing for, whole kg, cooked kg, entries, steams so far, first and last steam date, current trolleys and loading status, the three movement dates, `current_stage` (`Loaded`, `In dry room`, `In container`, `In grading room`), days in dry room so far, plus from grading: dried kg, yield %, drying loss %, graded date, drying days. The drying report and spreadsheet exports read this.
- `v_dry_yield_by_month`: month, jobs, total whole kg, total dried kg, weighted yield %, average drying days.
- `v_dry_yield_by_farm`: same grouped by farm.
- `v_dry_trolley_loading`: per job and month, trolleys (latest), whole and cooked kg per trolley, loading status, drying days and yield.
- `v_dry_steam_profile`: per job, number of steams, average steaming temperature, average and total steaming time, days between steams, with drying days and yield.
- `v_dry_jobs_in_dry_room`: jobs currently between "into dry room" and "into grading room" with days so far and steams so far (the live floor view).

Weighted yield = sum dried kg ÷ sum whole kg, not the average of per-job yields (comment this on the view).

### 7.4 Keep it movable

No JSON-only reportable fields, no Neon-specific features. Add `scripts/export-dry-process.mjs` writing `dry_process_entry`, `dry_process_steam` and the views to CSV (header row, ISO dates), the "move to another format" path and a backup. Update the checked-in `drying-process.json` and `scripts/export-record-defs.mjs` so JSON and database stay identical; never hand-edit the generated snapshot.

### 7.5 Traceability

`batchField: jobNo` stays, so `window.Traceability.trace(jobNo)` returns **all entries for the job**. The trace view lists them oldest first, one line each: "REC 7.4.1 — dd Mon — N trolleys — moved into dry room / steam 3 (85 °C, 45 min) / moved into container …", plus the job summary line from `v_dry_job_progress`. Links: to 7.4.0 (pots, batch codes) by `job_no` and `cooked_weight_source_ids`; to grading (dried weight, size grades, bin codes) by `job_no`.

## 8. REC 7.4.2 Dry Monitoring: trolley count pulled from 7.4.1 (decided)

Current 7.4.2 (`dry-monitoring.json`) has a typed `noOfTrolleys` next to `trolleysClearlyMarked`. 7.4.2 is also an entry log (one entry per monitoring day), so the trolley count follows the same rhythm:

- `noOfTrolleys` becomes **read-only and autofilled** with the **current trolley count for the job**: the count on the latest submitted 7.4.1 entry that has one, using the existing job lookup (not a new path). Label unchanged.
- If no 7.4.1 entry with a count exists: amber note "No REC 7.4.1 trolley count for this job. Fill in REC 7.4.1 first", and the field unlocks. Saving and submitting are not blocked.
- Stored on the 7.4.2 entry as a copy with `trolleys_source_submission_id`. Old 7.4.2 entries keep what they were saved with; each new monitoring entry picks up the current count.
- `trolleysClearlyMarked` stays a typed Yes/No (a daily observation).
- Existing 7.4.2 entries unchanged; typed counts stay as saved.
- Database: `no_of_trolleys` stays a typed INT column; add `trolleys_source_submission_id` and `trolleys_typed_manually`. View `v_dry_monitoring_trolley_check` lists 7.4.2 entries whose count differs from the job's count on that date.
- Update the checked-in `dry-monitoring.json` and `scripts/export-record-defs.mjs`; no hand-edit of the snapshot.

## 9. Existing entries (do not lose or change history)

Today one job usually has one big 7.4.1 record. One script under `scripts/`, original JSON untouched. Before/after: row counts, and every old value equal to its new home or its `_old` column.
- Each old record becomes **one** `dry_process_entry` (entry date = its completion/record date) plus one `dry_process_steam` row for every filled `steamNDate`, numbered 1..N in old field order, original position in `steam_no_old`.
- Old dry-room, container and grading-room dates go to the new movement stamp columns (midnight, `stamp_source = 'migrated_typed'`, so they are recognisable as typed history, not system stamps), with the boolean set to true when a date exists; when none exists leave the boolean **null** (unknown), not false. A migrated movement with a date is Done (read-only) for any new entry on that job; one without a date stays an open question.
- All other removed values (whole weight, cooking date, cooking weight, removed from trolleys, de-string, graded, total drying days, dry weight, yield) are copied unchanged to their `_old` columns. Do not recalculate or overwrite them, and leave `cooked_weight_kg` null on old entries.
- Old entries have no trolley count in 7.4.1: leave `no_of_trolleys` null. An optional reviewable backfill from REC 7.4.2 `noOfTrolleys` (first value per job, flagged `trolleys_backfilled`) is **not run without Michaela's approval** (D10).
- Old entries with an old dry weight but no grading record still show that dry weight, labelled "(old)", in `v_dry_job_progress`.
- Unusable dates: keep raw text in a `*_raw` column, typed column null, list in the script output. Do not guess. Do not invent data.
- New entries added to a migrated job continue the steam numbering after the migrated steams and see the migrated data in "Job so far".

## 10. Testing checklist

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

## 11. Decisions taken (defaults, change if wrong)

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

## 12. Build order for Claude Code

1. Confirm D1, D3, D4, D8, D11 and D13 with Michaela.
2. Database: `dry_process_entry`, `dry_process_steam`, the views, export script, migration (dry run, compare every value, then run).
3. Update the record definition (per-entry form, removed fields, three movement fields with dates, read-only Cooked weight, No. of trolleys, steam roster) and regenerate the snapshot. **Stop for review here.**
4. "Job so far" panel, per-job steam numbering, question/read-only switching of the movement fields, submit checks and warning overrides.
5. REC 7.4.2 trolley autofill (section 8); trace view lines; switch the drying report off the removed keys.
6. Run the checklist and report pass/fail per item.
