# REC 7.4.0 Dry Cooking — Pot cards (Blanching or Cooking), auto pot number, sea water tick

Status: instructions only, no code written. For Claude Code (or Claude Design for the layout part).
Date: 2026-09-29. Based on the current definition `public/data/record-defs/dry-cooking.json`.
Supersedes earlier versions of this file (which had a third "Blanching and cooking" option; that is now two cards).

## 1. What is changing, in one paragraph

Today one REC 7.4.0 entry describes ONE pot: pot number, cooking date, abalone kg, a Blanching section, a Cooking section and an Additives section are all single fields. The change: the entry keeps its job information once, and everything pot-specific becomes a list of **pot cards**. When the operator opens the record and reaches the pots area they **select Blanching OR Cooking**, which opens a pot card for that process. Under the last card is a **"+ Add pot"** button; pressing it asks Blanching or Cooking again and adds another card. A pot that is blanched and then cooked straight after is simply a Blanching card followed by a Cooking card. **Pot numbers are automatic and sequential (Pot 1, Pot 2, Pot 3 ...); the operator never types a pot number.** When the entry is compared with the REC 7.1.5 OOSW weight, **only Cooking cards count**.

## 2. Layout of the form

Once per entry (unchanged, stays at the top):
- Job number, Processing for, Whole weight (kg), Harvest farm, Intake date (`jobNo`, `jiProcessingFor`, `jiIntakeWeight`, `harvestFarm`, `intakeDate`). Autofill from REC 7.1.2 stays exactly as it is.

Pots area (`pots`):
- Empty at first with two large buttons: **Blanching** and **Cooking**. Choosing one creates Pot 1 of that type. (No default; a card cannot exist without a process, so the wrong process cannot be recorded silently.)
- Each card has a plain title "Pot n — Blanching" or "Pot n — Cooking". **No section headings inside a card**: the old "Blanching", "Cooking" and "Additives (optional)" section titles and the page break before Blanching are removed. Each card shows one continuous list of fields for its process only.
- Under the last card: **"+ Add pot"**, which offers Blanching or Cooking and appends the next card. Each card has a remove button; removing a card renumbers the pots so numbers stay sequential with no gaps.
- The process of an existing card is fixed. To change it, remove the card and add a new one (a confirm appears if the card has data).
- At least one card is needed to finalize. Draft saves are never blocked.
- Cards are stacked one per screen block so the tablet layout stays readable. Follow `mobile-tablet-font-responsiveness.md`. Print each card in order.
- Read-only totals under the last card: number of pots, total blanching kg, total cooking kg.

Fields per card. **Both card types (Blanching and Cooking) have the same layout**, built as rows:

| Row | Label on screen (both cards) | Blanching card key | Cooking card key |
|---|---|---|---|
| 1 | Abalone weight (kg) (was "Abalone (kg)") | `abaloneKg` | `abaloneKg` |
| 1 | 100 Lt sea water used? (Yes / No, see 2b) | `blanchSeaWater` | `cookSeaWater` |
| 1 | Salt weight (kg) (was "Blanch salt (kg)" / "Salt (kg)") | `blanchSaltKg` | `saltKg` |
| 1 | Salt batch code (was "Blanch batch number" / "Salt batch number") | `blanchBatchNumber` | `saltBatchNumber` |
| 2 | Start time | `blanchStartTime` (NEW) | `startTime` |
| 2 | Start temp | `blanchStartingTemp` (NEW) | `startingTemp` |
| 2 | pH | `blanchPh` | `cookPh` |
| 3 | Temp 20 min after | none: greyed-out placeholder, no field saved | `temp20MinAfter` |
| 3 | End time | `blanchEndTime` (NEW) | `timeOut` (relabelled "End time", was "Time out") |
| 3 | End temp | `blanchEndTemp` (NEW) | `endOfCookingTemp` (relabelled "End temp") |
| 4 | Total time (read-only, calculated from start and end time) | `cookingTime` | `totalCookingTime` |

- On a tablet each row is one line of fields where it fits (row 1 has four fields, rows 2 and 3 have three), wrapping only on narrow screens. No headings between rows.
- Cooking cards only, after row 4: optional `sugarKg`, `sugarBatchNumber`, `vinegarKg`, `vinegarBatchNumber`.
- **Blanching card: "Temp 20 min after" is shown greyed out and disabled** (not applicable to blanching). It cannot be tapped or typed in, is never required, is saved empty, and prints as a greyed "N/A" so the row layout matches the Cooking card. Cooking card keeps it as a normal entry field. It stays in the layout (not hidden) so both cards line up.
- Same temperature and time rules on both cards, so the same validation and units apply. Any existing limits or warnings on the cooking temperature fields (check the record's config when building) apply to the blanching equivalents only if Michaela confirms them.
- Total time is calculated automatically (end minus start, across midnight if needed) and the operator does not type it. The old typed value is kept for old entries (see section 5).

The automatic pot number (`potNo`, read-only) is not a field the operator fills: it shows in the card title ("Pot 1 — Blanching").

Rules:
- Required on every card: `abaloneKg` and the sea water Yes/No question for that card's process. Nothing else is required today, so nothing else becomes required.
- The old typed `potNumber` field is removed from new entries (replaced by the automatic `potNo`).
- **The cooking date field is removed** (from the form and from every card). The cooking date is the date the record is completed: it is taken automatically from the record's own date (the date the entry is completed/submitted) and shown read-only in the record header and on print as "Cooking date". The operator never types a date. One date applies to the whole entry, so all cards share it. See section 5 for old data.
- `potNo` is assigned by position in the entry (1, 2, 3 ...) and is stored with the card so it never changes after submission.

## 2b. Sea water becomes a simple Yes / No question

Both sea water fields change from a typed number to a two-choice Yes / No question:

```js
{ key: 'blanchSeaWater', label: '100 Lt sea water used?', type: 'yesno', required: true },
{ key: 'cookSeaWater',   label: '100 Lt sea water used?', type: 'yesno', required: true }
```

- Exactly two choices, **Yes** and **No**. No "None", "N/A" or blank option is shown, and there is no default selected, so the operator must tap one (required to submit; drafts still save without it). Use two large tap buttons.
- Same field keys, new type. Blanching cards show the blanch question, Cooking cards show the cook question.
- Database: `blanch_sea_water` and `cook_sea_water` are BOOLEAN. New entries always have a value once submitted.
- Old entries hold a typed litre number, or nothing. Keep the original in read-only columns `blanch_sea_water_lt_old` and `cook_sea_water_lt_old` (NUMERIC), shown on view/print of old entries as "Sea water (Lt): X". Migration: old value exactly 100 becomes Yes; any other typed number becomes No (the old litre figure stays visible next to it); an old entry that had no value stays empty in the database and displays "Not recorded" on view/print only (never offered as a choice).

## 2c. Carry-forward when adding a card

Salt batch code and other batch numbers rarely change part-way through a run, and a pot blanched then cooked has the same abalone, so the operator should not retype these.

- **Batch numbers:** a new card is pre-filled with the batch numbers from the most recent card that has the same field (`blanchBatchNumber`, `saltBatchNumber`, `sugarBatchNumber`, `vinegarBatchNumber`). The "Salt batch code" is the same salt on both card types, so a new card picks it up from the previous card even if that card is the other type (Blanching to Cooking or back). Sugar and vinegar codes come from the most recent card that has them.
- **Abalone kg:** if a Cooking card is added straight after a Blanching card, `abaloneKg` is pre-filled from that Blanching card (the same pot contents). It stays editable.
- Nothing else is copied (dates, weights other than kg, temperatures and times start empty).
- Pre-filled values are normal editable values. If the operator changes one, the changed value is what later cards copy. Earlier cards are never changed. A light "carried from previous pot" hint shows until the value is edited; the hint is not saved, only the value.
- Carrying only happens when a card is added; reopening a draft never overwrites saved values. Removing a card does not break the carry (the next card copies from the last remaining suitable card).
- Carry-forward stays inside one entry. A new entry starts with empty batch fields (decided).
- Database: no schema change; every card stores its own batch numbers, so traceability per pot stays exact even when codes repeat.

## 3. OOSW rule: Cooking cards only

Existing rule (`public/data/business-rules.json`, type `capAgainstOtherRecord`) totals this record's `abaloneKg` across all submissions for the job and compares it to the OOSW total on REC 7.1.5. Two changes:

1. `abaloneKg` moves from an entry field to a column inside `pots`. The rule must total the roster column.
2. Add one optional parameter so the rule counts only some rows, for example `ownRowFilter: { "column": "process", "equals": "Cooking" }`. Blanching cards are ignored. This is one small extension of the existing type, not a new type; document it in `business-rules.md`.

Everything else about the rule stays: soft gate at finalize, override with confirm, `oosWarningAck` / `oosWarningNote`, red warning line on the record and print. Change the warning text to say "cooking pot weight". Because a blanched-then-cooked pot has two cards but only the Cooking card counts, its kg is counted once.

## 4. Database

Do NOT keep pots as one text blob. Store each card as its own row so weights and trends are directly queryable.

Parent (the entry, as today): `submission_id`, `job_no`, `intake_date`, status, sign-off. Unchanged.

New child table `dry_cooking_pot`, one row per card:

- Keys: `id`, `submission_id`, `job_no` (repeated on every row so trace lookups need no join), `pot_no` (the automatic sequence number)
- Card: `process` (`Blanching` / `Cooking`), `abalone_kg`. No date column on the card: the cooking date is the parent entry's record date (`record_date`), so queries use `dry_cooking_pot` joined to the entry, or a `record_date` copy repeated on each row (recommended, like `job_no`, so trend queries need no join).
- Blanching: (`blanch_temp_20_min_after` is not created: not applicable to blanching) `blanch_sea_water`, `blanch_salt_kg`, `blanch_batch_number`, `blanch_start_time`, `blanch_start_temp`, `blanch_ph`, `blanch_end_time`, `blanch_end_temp`, `blanch_total_time`
- Cooking: `start_time`, `starting_temp`, `temp_20_min_after`, `end_of_cooking_temp`, `time_out`, `total_cooking_time`, `cook_sea_water`, `cook_ph`, `salt_kg`, `salt_batch_number`
- Additives: `sugar_kg`, `sugar_batch_number`, `vinegar_kg`, `vinegar_batch_number`
- Old-data helpers: `blanch_temp_old` (the single blanch temp typed on old entries), `pot_number_old` (the pot number typed on old entries), `cooking_date_old` (the cooking date typed on old entries), `blanch_sea_water_lt_old`, `cook_sea_water_lt_old`
- `created_at`, `updated_at`

Indexes: `job_no`, `submission_id`, `(process, record_date)`, `(submission_id, pot_no)`. Real typed columns (NUMERIC, TIME, DATE) so trends (kg per month, temperature drift, salt batch by job) are plain queries. Keep the full submission JSON as the audit copy; the child table is the query layer and can be rebuilt from it. Plain relational tables move to any other database format without conversion.

Traceability: the batch numbers per card link ingredients to a job and feed the trace view. The trace view lists, per job, each card: "Pot 2 — Cooking — record date — kg — salt batch ...".

## 5. Existing entries (do not lose or change history)

Every old entry has one pot with blanching, cooking and additive values on the same entry, so it becomes two cards (Blanching then Cooking), which is exactly how a blanched-then-cooked pot is now recorded:

- Card 1: `Blanching`, `pot_no` 1, the old blanch fields (`blanchSeaWater`, `blanchPh`, `blanchSaltKg`, `blanchBatchNumber`, and `cookingTime` into total time). The old single "Blanch temp" is not guessed into start or end temp: it goes to `blanch_temp_old` and shows on view/print as "Blanch temp (old): X". The new start/end/20-minute blanching fields stay empty, `abaloneKg` copied from the old entry, batch `blanchBatchNumber`.
- Card 2: `Cooking`, `pot_no` 2, the cooking and additive fields, the same `abaloneKg`.
- The old typed pot number is kept in `pot_number_old` and the old typed cooking date in `cooking_date_old` on both cards, shown on view/print of old entries as "Pot number (old): X" and "Cooking date (old): X". The record date of an old entry is its existing completion date, unchanged.
- Only the Cooking card counts toward OOSW, with the same kg as before, so historic totals and warnings do not change.
- An old entry with no blanching values at all gets just the Cooking card. An old entry with no cooking values gets just the Blanching card. Do not invent data.
- Run as a script under `scripts/`, keep the original JSON untouched, and check row counts and total kg per job before and after.
- Update the checked-in definition and `scripts/export-record-defs.mjs` so the JSON and database stay identical. Do not hand-edit the generated definition snapshot.

## 6. Other places to check (do not change without confirming)

- `listColumns` currently `intakeDate, jobNo, potNumber`. `potNumber` no longer exists at entry level: replace it with "No. of pots".
- REC 7.4.1 Drying Process reads cooking date and cooking weight from 7.4.0: confirm it should use the entry's record date as the cooking date, and the Cooking cards (summed) for weight, and how it finds them. Any report or record that shows "cooking date" from 7.4.0 (drying report, trace view) must switch to the record date.
- REC 8.1.7 mock recall, the drying report and the trace view: not required to show card detail in v1, except the trace view above.
- `batchField: jobNo` stays, so traceability indexing is unchanged. `window.Traceability.trace(jobNo)` still returns the entry; card detail is read from `dry_cooking_pot`.

## 7. Testing checklist

1. New entry: pots area shows Blanching / Cooking buttons; choosing one creates Pot 1; Finalize refused until every card has kg; Draft saves fine.
2. Pot number is automatic and read-only: add cards, remove the middle one, numbers renumber with no gaps.
3. Add Blanching then Cooking: the Cooking card pre-fills kg and batch numbers from the Blanching card and remains editable; no section headings appear inside cards.
4. OOSW: Blanching 100 kg and Cooking 100 kg for the same pot counts as 100; only Cooking cards count; push cooked kg over the OOSW total: warning and override work; blanching alone can never trigger it.
5. Second entry on the same job: earlier Cooking kg is added to the total.
6. Old entries appear as two cards (Blanching, Cooking) or one where a group was empty; total cooking kg per job is identical before and after migration; the old pot number is still visible.
7. Submit, reopen, print: every card prints in order with process, pot number and batch numbers.
8. Database: one child row per card with `job_no` filled; a query for total cooking kg by job matches the form.
9. Tablet width: cards readable; Blanching / Cooking and "+ Add pot" buttons easy to tap.
10. Autofill from REC 7.1.2 still fills the job info.
0. Field layout: both card types show row 1 Abalone weight (kg), 100 Lt sea water used?, Salt weight (kg), Salt batch code; row 2 Start time, Start temp, pH; row 3 Temp 20 min after (greyed out on Blanching cards), End time, End temp; then Total time calculated. Same on Blanching and Cooking cards, with those exact labels.
11. Batch codes: enter salt, sugar and vinegar batches on Cooking pot 1, add a second Cooking card: they carry; change the salt batch, add a third: it gets the changed code; a new entry starts empty.
12. Sea water: only Yes and No are offered (no none/blank option, nothing pre-selected); Finalize is refused until answered; Yes/No shows on screen, in the database and on print; old entry with 100 shows Yes, with another number shows No, with none shows "Not recorded"; the old litre figure stays visible.

## 8. Decisions taken (defaults, change if wrong)

0b. Blanching "Temp 20 min after" is a greyed-out placeholder only: no database column, never asked.
0a. Total time is calculated, read-only, and shown last on both cards (kept because the old form had it). Say if you want it removed.
0. The old "Blanch batch number" is treated as the salt batch code for blanching (relabelled), since your list gives Salt batch code as the fourth field on both cards. Field keys and old data are unchanged.

1. Two options only, Blanching or Cooking. A pot that is blanched then cooked is two consecutive cards, numbered sequentially.
2. No date field on the form. Cooking date = the date the record is completed (record date), one per entry, read-only.
3. Blanching cards have no weight cap or cross-check.
4. Additives (sugar, vinegar) are on Cooking cards only.
5. Batch codes carry forward within an entry only.
6. Old entries split into a Blanching card and a Cooking card as in section 5.

## 9. Build order for Claude Code

1. Migration script and `dry_cooking_pot` table (with before/after totals check).
2. Update `dry-cooking.json` to the pots roster and regenerate snapshots.
3. Card behaviour: Blanching/Cooking buttons, "+ Add pot", automatic pot numbers, renumbering on remove, carry-forward.
4. Extend `capAgainstOtherRecord` with `ownRowFilter`; update `business-rules.json` and `business-rules.md`.
5. Update trace view, `listColumns`, print layout; check REC 7.4.1.
6. Run the section 7 checklist.
