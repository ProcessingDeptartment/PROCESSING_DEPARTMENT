# REC 7.4.0 Dry Cooking — Pot Slides, Simplified Blanching Stage, Optional Additions

Status: instructions only, no code written. For Claude Code.
Date: 2026-10-02
Raised by: Michaela (dried submission process review, comments 1 to 5).
Scope: REC 7.4.0 only. Other records keep behaving exactly as today (all changes gated behind the existing `processChoice` / roster options of this record).

## 0. How this relates to earlier files

This file **amends** three earlier REC 7.4.0 files. Where they disagree, **this file wins**. Anything not mentioned here stays as written there.

| Earlier file | What this file changes |
|---|---|
| `dry-cooking-pots-roster-instructions.md` | Blanching card is cut down to 5 fields. Cooking salt becomes an optional addition. Pots are shown as slides instead of stacked cards. Blanching has no pot number. Carry-forward of kg from Blanching to Cooking is removed. |
| `dry-cooking-pots-fixes-2026-09-30.md` | Fix 1 (two "+ Add pot" buttons) is replaced by the **Next** button and slide navigation (section 3). Fix 2 (no tally line or green on the PDF) still applies unchanged. Fix 3 still applies where it does not clash. |
| `rec-7.4.0-blanching-cooking-weight-rules-instructions.md` | Rules R2 and R3, "Available to blanch" and the blanching weight are **removed**. R1 (cooking weight must not exceed OOSW) stays. "Available to cook" stays but is recalculated (section 6). |

## 1. Summary of the change

1. Each pot is one **slide**. Pressing **Next** adds a new slide. A numbered bar across the top lets the operator jump back to any earlier slide.
2. Every new slide opens with a stage choice: **Blanching** or **Cooking**.
3. **Blanching** is a short, once-off stage with **no pot number** and only five fields: Sea water (Yes/No), Temperature (°C), Time, Salt weight (kg), Salt batch code. No abalone weight.
4. **Cooking** slides are the numbered pots (Pot 1, Pot 2, ...). Sugar, Salt and Vinegar are optional additions at the bottom, after Total time, each a tick button that opens a pop-up for weight and batch code.
5. **All fields must be completed** before Next works (optional additions excepted).
6. Batch codes are **sticky**: they stay filled in until the user changes them.
7. Units are shown in every label: temperature in °C, weights in kg.

## 2. Slide structure

### 2.1 Slide bar (top of the pots area, sticky under the page header)

- One chip per slide, in the order they were created.
- Cooking slides show **Pot 1, Pot 2, Pot 3 ...** Pot numbers count **cooking slides only** and are automatic and read-only.
- Blanching slides show a small **"B"** chip (tooltip/long-press: "Blanching"). They sit in the bar between the pots in the order they were done. They have no pot number.
- The current slide chip is highlighted. A chip with missing required fields shows a small dot. A completed chip shows a tick.
- Tapping a chip jumps to that slide. All values are kept (hide/show only, never rebuild or reset).
- On a tablet portrait width the bar scrolls horizontally inside its own container (no page horizontal scroll). Each chip is at least 44 px tall.

### 2.2 Stage choice (start of every slide)

- A new slide shows two large buttons: **Blanching** and **Cooking**. No default. A slide cannot exist without a stage.
- After choosing, the fields for that stage appear. The stage of an existing slide is fixed. To change it, remove the slide (confirm if it holds data) and add a new one.
- Every Next allows either stage. There is no forced order (Blanching, Cooking, Cooking, Blanching, ... are all valid).

### 2.3 Next button

- One **Next** button at the bottom of the current slide (large, full width on tablet).
- **Disabled until every field on the slide is complete.** While disabled, a short hint beside it reads "Complete all fields to continue".
- Optional additions that are not ticked do not block Next. A ticked addition with a missing weight or batch code blocks Next (see 5.3).
- Pressing Next: validates the slide, adds a new slide, makes it current, scrolls the top of the slide into view below the sticky header (smooth, after the next animation frame). On touch screens do **not** auto-focus a field (so the keyboard does not pop up); on non-touch screens focus the first field.
- Next replaces the "+ Add blanching pot" / "+ Add cooking pot" buttons from the 2026-09-30 fixes file. Do not show both.
- Short slide transition (150 ms), none when `prefers-reduced-motion` is set.

### 2.4 Removing, finishing and submitting

- Each slide has a small **Remove slide** control with a confirm when it holds data. Removing a cooking slide renumbers the remaining pots (no gaps). Removing a blanching slide changes nothing else.
- A slide where no stage was ever chosen and nothing was typed is **ignored at submit** (so pressing Next and then deciding you are finished does not block Submit).
- Submit is blocked while any real slide is incomplete. Draft save is **never** blocked.
- At least one Cooking slide is needed to finalize (as today, at least one card).
- Saving a draft and reopening it restores all slides and returns to the first incomplete slide (or slide 1 if all are complete). Reopening must not scroll the page down to the pots.

## 3. Blanching slide (once-off stage, no pot number)

Fields, in this order. All required.

| # | Label on screen | Key | Type | Notes |
|---|---|---|---|---|
| 1 | Sea water used? (Yes / No) | `blanchSeaWater` | yesno | **First field.** Two large buttons, nothing pre-selected, no N/A option. Keep the existing label wording "100 Lt sea water used?" if that is what the current form shows. |
| 2 | Temperature (°C) | `blanchTempC` | number, 1 decimal | Unit shown in the label and as a suffix in the input. |
| 3 | Time | `blanchTime` | time (hh:mm) | See open item A. Include a "Now" button to fill the current time. |
| 4 | Salt weight (kg) | `blanchSaltKg` | number, 2 decimals | Unit in label and suffix. |
| 5 | Salt batch code | `blanchBatchNumber` | text | Typed for now. Sticky (section 7). |

- **Removed from the Blanching slide:** abalone weight, pH, start time, start temp, end time, end temp, "Temp 20 min after" placeholder, total time. They are not shown and not asked for on new entries.
- No weight rules apply to Blanching (it has no kg of abalone).
- The slide title reads "Blanching" (no number).

## 4. Cooking slide (numbered pot)

Title: "Pot n — Cooking" (n is the automatic cooking-pot number).

Keep the existing cooking fields and order, with these changes:

1. **Units in every label:** Abalone weight (kg), Start temp (°C), Temp 20 min after (°C), End temp (°C), times as hh:mm. Total time stays calculated and read-only (show the unit, for example "Total time (min)", matching how the form shows it today).
2. **Salt weight and Salt batch code move out of the main fields** and become the optional Salt addition at the bottom (section 5). Row 1 of the cooking slide is therefore Abalone weight (kg), 100 Lt sea water used?, then the existing row 2 and row 3 fields. Check the live definition when building; do not change any other cooking field.
3. After **Total time** comes the **Optional additions** block (section 5).
4. Required on a cooking slide: every field above except the optional additions. "All fields must be completed" applies to everything that exists on the slide, including pH, temperatures and times, unless a field is one of the optional additions.
5. The OOSW rule still counts Cooking `abaloneKg` only (section 6).

## 5. Optional additions: Sugar, Salt, Vinegar (Cooking slides only)

### 5.1 Layout

- A block headed "Optional additions" at the very bottom of the cooking slide, after Total time.
- Three tick buttons side by side (wrap on narrow screens): **Sugar**, **Salt**, **Vinegar**. Large touch targets (at least 44 px). Unticked by default.

### 5.2 Pop-up on tick

- Ticking opens a pop-up titled "Sugar" (or Salt / Vinegar) with two required fields:
  - Weight (kg) — see open item B for the vinegar unit.
  - Batch code (typed, sticky, see section 7).
- Buttons: **Save** (disabled until both fields are filled) and **Cancel**.
- Cancel clears the tick and saves nothing. Esc = Cancel. Backdrop click does not close it. Focus is trapped inside; Enter = Save when valid.
- After Save the tick stays on and a muted line under it shows "12.5 kg · Batch ABC123" with an **Edit** link that reopens the pop-up with the values.
- Unticking a saved addition asks for a confirm, then clears its weight and batch code.

### 5.3 Rules

- Unticked: nothing is stored for that addition (both columns empty, not zero).
- Ticked: weight and batch code are required. Next and Submit are blocked while a ticked addition lacks either value.
- Keys: `sugarKg`, `sugarBatchNumber`, `saltKg`, `saltBatchNumber`, `vinegarKg`, `vinegarBatchNumber` (existing keys, no rename). Add tick state as `sugarUsed`, `saltUsed`, `vinegarUsed` (boolean, or derive from "weight is not empty"; derive if that avoids a new column).
- Print: show only ticked additions with weight and batch code. Unticked additions are omitted.

## 6. Weight rules (what remains)

- **R1 stays:** total Cooking `abaloneKg` for the job (all submitted entries plus this entry) must not exceed the OOSW total on REC 7.1.5. Soft gate at Finalize, confirm to override, red warning line on screen and on print, existing `oosWarningAck` / `oosWarningNote`. Message: "Cooking pot weight exceeding OOSW - possible batch mix".
- **R2, R3 removed.** Delete the Blanching cap rule and the cooking-vs-blanching rule from `business-rules.json` if they were already added; do not build them if not. The `capRowsAgainstRows` rule type is **not needed**.
- **"Available to cook (kg)" = OOSW − total cooked kg for the job.**
  - Shown live on the cooking slide under the Abalone weight field and in the on-screen tally under the pots area. It includes the value currently being typed, so it drops as the operator types.
  - Turns red with a minus sign when negative.
  - If the job has no OOSW record: show "OOSW not found" (no fake zero) and skip R1.
  - Screen only. **Not printed.** The PDF shows only the slides' content and the red override warning when applicable (Fix 2 of the 2026-09-30 file still applies: no tally line, no green).
- **Removed:** "Available to blanch", the Blanching weight, and the rule that pre-fills Cooking kg from a Blanching card.
- Only submitted entries count for other entries of the same job. Drafts are ignored. Use `excludeId` as today so an entry being edited is not counted twice.

## 7. Sticky batch codes

- Applies to: Blanching Salt batch code, and the Salt, Sugar and Vinegar batch codes in the optional additions.
- **Behaviour:** the last code entered is pre-filled into the same field on the next slide and on the next new entry, until the user types a different one. The new code then becomes the sticky one.
- The Salt batch code is **one shared sticky value** across the Blanching slide and the Salt addition (it is the same salt). Sugar and Vinegar each have their own.
- Store the sticky values in the browser on the device (`localStorage`, wrapped in try/catch; the form must work if storage is blocked). Per device, not per user, not shared between devices (default, see open item C).
- A sticky value is a normal editable value. A light "same as last time" hint shows until edited; the hint is not saved.
- Reopening a saved draft or viewing a submitted entry **never** overwrites stored values with sticky ones. Sticky applies only to empty fields on new slides/entries.
- Every slide still stores its own batch codes, so traceability per slide is exact even when codes repeat.

## 8. Units on screen

- Temperature fields: "(°C)". Weight fields: "(kg)". Show the unit in the label **and** as a non-editable suffix inside the input so it is visible when the label wraps on a tablet.
- Apply to all weight and temperature fields on both slide types, including Abalone weight, Salt/Sugar/Vinegar weights, Start/End/20-minute temperatures and the Blanching temperature and salt weight.
- The unit is fixed (not selectable). No unit conversion is done.
- Print and view show the units too.

## 9. Database

Keep the child table `dry_cooking_pot` (one row per slide). Real typed columns, plain SQL, no vendor features, so it moves to any other database unchanged. **Do not drop any existing column**; old data must stay readable.

Changes:

| Column | Change |
|---|---|
| `seq_no` | **NEW**, integer. Position of the slide in the entry (1, 2, 3 ...). Preserves the real order of Blanching and Cooking slides. |
| `pot_no` | Now **only for Cooking rows** (counts cooking slides). **Nullable; NULL for Blanching rows.** |
| `pot_no_old` | **NEW**, integer, keeps the pot number old entries had (so no history is lost when old numbering changes). |
| `process` | Unchanged (`Blanching` / `Cooking`). |
| `blanch_temp_c` | **NEW**, numeric. The single Blanching temperature. |
| `blanch_time` | **NEW**, time. The single Blanching time. |
| `blanch_sea_water`, `blanch_salt_kg`, `blanch_batch_number` | Used as the Blanching slide fields. |
| `abalone_kg` | NULL for new Blanching rows. Cooking rows unchanged. |
| `blanch_ph`, `blanch_start_time`, `blanch_start_temp`, `blanch_end_time`, `blanch_end_temp`, `blanch_total_time`, `blanch_temp_old` | **No longer filled for new entries; kept for history.** |
| `salt_kg`, `salt_batch_number` | Now filled only when the Salt addition is ticked (NULL otherwise). Old rows keep their values. |
| `sugar_kg`, `sugar_batch_number`, `vinegar_kg`, `vinegar_batch_number` | Unchanged; NULL when not ticked. |

Indexes: keep existing, add `(submission_id, seq_no)`.

**Weights view `v_dry_job_weights`** (plain SQL view, one row per job): `job_no`, `oosw_kg`, `cooked_kg`, `available_to_cook_kg` (`oosw_kg - cooked_kg`), `last_record_date`. Remove `blanched_kg` and `available_to_blanch_kg`. If the earlier file's view was never created, create it in this reduced form.

**Override traceability:** only R1 can now be overridden. Keep the `dry_weight_override` table (`submission_id`, `job_no`, `rule`, `message`, `created_at`) with `rule = 'R1'`, so "which jobs ever went over OOSW" is a simple query.

**Traceability:** the trace view lists per job, in `seq_no` order: "Blanching — time — temp — salt batch" and "Pot n — Cooking — record date — kg — additions with batch codes". Salt, sugar and vinegar batch codes must be queryable per job.

The full submission JSON remains the audit copy; the child table is the query layer and can be rebuilt from it. Update `scripts/export-record-defs.mjs` and the checked-in `dry-cooking.json`; **do not hand-edit generated snapshots**.

## 10. Existing entries (do not lose or change history)

- Old entries were migrated into a Blanching card (pot_no 1) and a Cooking card (pot_no 2), or a single card where one group was empty. Do not delete or rewrite any value.
- Migration step (script under `scripts/`, original JSON untouched):
  1. Set `seq_no` from the existing order.
  2. Copy the current `pot_no` into `pot_no_old` for every row.
  3. Set `pot_no` to NULL for Blanching rows and renumber Cooking rows 1, 2, 3 ... within each entry. Cooking `abalone_kg` is unchanged, so OOSW totals do not change.
  4. Do not backfill `blanch_temp_c` or `blanch_time` (old blanching used different fields). Old Blanching rows keep `abalone_kg` and the old start/end/pH values, and display them on view/print as they do today.
- On view/print of an old Blanching card, show its old fields as before. The new simplified layout applies only to new entries. Old cooking cards with a typed salt show it in a read-only "Salt" line on view/print.
- Before/after check per job: total Cooking kg, number of Cooking rows and OOSW comparison must be identical.
- Old entries are never re-judged by the rules, and their stored warnings are unchanged.

## 11. Print and PDF

- All slides print in `seq_no` order, one block per slide: "Blanching" (no number) and "Pot n — Cooking".
- Black and white. No tally line, no "Available to cook", no slide bar. The red OOSW override warning still prints when one was overridden.
- Blanching block prints its five fields with units. Cooking block prints its fields and only the ticked additions.
- Collapsed or hidden slides on screen still print in full.

## 12. Open items (defaults are used if unanswered)

- **A. Blanching "Time".** Default: time of day (hh:mm) when the blanching was done, with a "Now" button. Alternative: a duration in minutes. Michaela to confirm.
- **B. Vinegar unit.** Default: kg, matching the existing `vinegar_kg` column. Alternative: litres (would need a new `vinegar_l` column and a note on old data).
- **C. Sticky scope.** Default: remembered per device. Alternative: shared department-wide (would need a small server-side setting).
- **D. Temperature unit.** Assumed °C everywhere.
- **E. Salt in cooking.** Taken from the comment that Sugar, Salt and Vinegar are all optional additions at the bottom, so cooking Salt leaves the main fields. Michaela to confirm cooking salt is no longer a normal required field.

## 13. Testing checklist

1. New entry: first slide asks Blanching or Cooking. Choosing Blanching shows exactly five fields in this order: Sea water (first), Temperature (°C), Time, Salt weight (kg), Salt batch code. No abalone weight, no pH.
2. Next stays disabled until all five fields are filled; the hint shows; once complete, Next adds a new slide and scrolls it into view. No keyboard pops up by itself on a tablet.
3. Top bar: Blanching shows as "B" with no number; Cooking slides show Pot 1, Pot 2 ... counting cooking slides only; tapping a chip returns to that slide with all values intact.
4. Sequence Blanching, Cooking, Cooking, Blanching, Cooking: bar reads B, Pot 1, Pot 2, B, Pot 3; `seq_no` 1 to 5 and `pot_no` NULL, 1, 2, NULL, 3 in the database.
5. Remove the middle cooking slide: cooking pots renumber with no gaps; blanching slides unaffected.
6. Cooking slide: all fields required; additions block sits after Total time; ticking Sugar opens the pop-up; Save is disabled until weight and batch code are filled; Cancel clears the tick; saved values show under the tick with Edit; unticking confirms and clears.
7. A ticked addition with missing values blocks Next and Submit. Unticked additions store NULL and do not print.
8. Sticky: enter a salt batch on a Blanching slide, open a Cooking slide and tick Salt: the same code is pre-filled. Change it: the next slide uses the new code. A new entry starts with the last code. Reopening a saved draft does not overwrite stored codes. With browser storage blocked the form still works.
9. OOSW: cooking over OOSW total triggers the confirm and the red line on screen and print; Blanching can never trigger it. "Available to cook" drops live, goes red with a minus when negative, shows "OOSW not found" when no OOSW record, and is absent from the PDF.
10. Second entry on the same job: previous Cooking kg counts; editing a submitted entry does not count it twice.
11. Units: every temperature field shows °C and every weight field shows kg, on screen, print and view.
12. Draft: incomplete slides save as a draft; Submit is refused until every real slide is complete; an untouched empty slide is ignored at submit.
13. Old entries: open an old entry; Blanching and Cooking cards display as before; total Cooking kg per job is identical before and after migration; `pot_no_old` holds the original numbers.
14. PDF: slides in order, no tally line, no green, no slide bar; trace view shows blanching and pots in `seq_no` order with salt/sugar/vinegar batch codes.
15. Tablet portrait and landscape: slide bar scrolls inside itself, Next and tick buttons are easy to tap, pop-up fits above the keyboard, no horizontal page scroll.
16. Other records with rosters behave exactly as before.

## 14. Build order for Claude Code

1. Database: migration script (`seq_no`, `pot_no_old`, `blanch_temp_c`, `blanch_time`, nullable `pot_no`), before/after totals check, reduced `v_dry_job_weights`.
2. Update `dry-cooking.json` (Blanching slide fields, cooking salt moved to additions, labels with units) and regenerate snapshots with the export script.
3. Slide engine for this record: stage choice, slide bar, Next with completion gate, remove, draft restore. Gate behind the existing `processChoice` option.
4. Optional additions block and pop-up.
5. Sticky batch codes.
6. Weight rules: keep R1, remove R2/R3 if present, recalc "Available to cook".
7. Print layout, trace view, `listColumns` check, REC 7.4.1 check (it reads cooking weight from 7.4.0; Cooking `abalone_kg` is unchanged so it should be unaffected, but confirm).
8. Run section 13 and write a work log at `MD_PROJECT_ONLY/rec-7.4.0-pot-slides-worklog.md`.

## 15. Paste-ready prompt for Claude Code

> Read `rec-7.4.0-pot-slides-blanching-stage-instructions.md` and follow it exactly. It amends `dry-cooking-pots-roster-instructions.md`, `dry-cooking-pots-fixes-2026-09-30.md` and `rec-7.4.0-blanching-cooking-weight-rules-instructions.md`; where they conflict, this file wins. Change REC 7.4.0 only, gated behind its existing `processChoice` roster option so no other record changes. Turn the pot cards into slides with a numbered top bar and a Next button that is disabled until every field on the slide is complete; every slide starts with a Blanching/Cooking choice. Blanching has no pot number and only Sea water Yes/No (first), Temperature (°C), Time, Salt weight (kg), Salt batch code. Cooking slides are numbered pots; Sugar, Salt and Vinegar become optional tick buttons after Total time, each opening a pop-up for weight and batch code. Batch codes are sticky until changed. Show °C and kg in labels. Keep the OOSW rule for Cooking kg and recalc "Available to cook" as OOSW minus cooked kg; remove the blanching weight rules. Add `seq_no`, `pot_no_old`, `blanch_temp_c`, `blanch_time`; make `pot_no` nullable; drop nothing. Run the migration with before/after totals, regenerate snapshots with the export script, run the section 13 checklist and write the work log. Show me one Blanching slide and one Cooking slide on a tablet width first, then continue.
