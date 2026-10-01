# REC 7.4.0 Dry Cooking — Blanching weight rule, cooking vs blanching, "available to cook"

Status: instructions only, no code written. For Claude Code.
Date: 2026-10-01. Builds on `dry-cooking-pots-roster-instructions.md` (pot cards) and `repo/business-rules.md`.

## 1. What is changing, in one paragraph

Blanching is the first stage, so it must obey the same OOSW weight rule that Cooking already obeys. On top of that, you can never cook more than you have blanched, so the job's total blanching kg must always be equal to or higher than its total cooking kg. The operator must always be able to see how much is still available to blanch and how much is still available to cook, so they do not find out only when Finalize is refused.

## 2. The three weight rules (all per job, across every entry for that job)

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

## 3. Available weight must be visible

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

## 4. How it is built (kept small)

Both new rules reuse the data already planned for the pots roster. No new rule engine.

1. **R1 and R2 are the same rule type** (`capAgainstOtherRecord` with `ownRowFilter`). R1 filters `process = Cooking`, R2 filters `process = Blanching`. Add one object to `public/data/business-rules.json` for R2 with its own message.
2. **R3 needs one small new type**, for example `capRowsAgainstRows`: "the total of this record's rows matching filter A, across all entries for the job, must not exceed the total of rows matching filter B". Parameters: `ownJobField`, `column`, `capFilter` (`process = Blanching`), `rowFilter` (`process = Cooking`), `message`. Document it in `business-rules.md` with R3 as the worked example.
3. **Server lookup:** extend the job lookup (`/api/lookup/...`) to return per-process totals of `abaloneKg` for the job from the submitted entries (exclude the entry being edited via `excludeId`, as today). With the `dry_cooking_pot` child table this is one grouped query by `job_no` and `process`. The form adds the current entry's own cards on top, live.
4. **Live display** uses the same numbers: fetch the job's OOSW and the other entries' totals once when the job number is set, then recompute locally as the operator types. Do not call the server on every keystroke.
5. Only **submitted** entries count for "other entries". Drafts of other entries are ignored (same as the existing rule).
6. Do not hand-edit the generated record-def snapshots; use the export script.

## 5. Database

No new columns on `dry_cooking_pot` (it already has `job_no`, `process`, `abalone_kg`, `record_date`, `submission_id`, `pot_no`).

Add one **read-only view** so the numbers behind the rules are always one query away and easy to chart:

`v_dry_job_weights` — one row per job: `job_no`, `oosw_kg`, `blanched_kg`, `cooked_kg`, `available_to_blanch_kg` (`oosw_kg - blanched_kg`), `available_to_cook_kg` (`blanched_kg - cooked_kg`), `last_record_date`. Built from `dry_cooking_pot` (submitted entries only) joined to the OOSW roster total. It must be a plain SQL view (no vendor features) so it moves to any other database unchanged. Trends such as blanched vs cooked per month, jobs with stock left uncooked, or jobs where a rule was overridden are simple queries on it.

Traceability: also add to the parent entry a list of which rules were overridden (R1, R2, R3) as plain text or a small child table `dry_weight_override` (`submission_id`, `job_no`, `rule`, `message`, `created_at`), so "which jobs ever went over, and who signed off" can be queried without parsing text. The full submission JSON stays as the audit copy.

## 6. Existing entries (do not change history)

- Migrated old entries became a Blanching card and a Cooking card with the **same kg**, so `B = C` for them and R3 does not fire. Nothing to fix.
- Old entries that had no blanching values got a Cooking card only. Those would look like `C > B`. Mark those migrated Cooking cards `legacy_no_blanching = true` and **leave them out of R3 and out of "Available to cook"** (they still count for R1). Do not invent blanching weight.
- Rules only run when a new entry is finalized. Old entries are never re-judged and their stored warnings stay as they are.
- Check with a before/after script: per job, `B`, `C` and OOSW before and after the change must match.

## 7. Testing checklist

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

## 8. Decisions taken (defaults, change if wrong)

1. "Blanching weight must be higher than cooking weight" means **equal or higher, as job totals** (a pot blanched and cooked at the same kg is correct, so equal must pass). It is not compared pot by pot.
2. "Available to cook" = blanched kg minus cooked kg for the job. "Available to blanch" = OOSW kg minus blanched kg. Both are shown.
3. All three rules are soft gates (confirm to override), like the existing OOSW rule, not hard blocks. Say if blanching-vs-cooking (R3) should be a hard block instead.
4. Legacy cooking-only cards are excluded from R3 (section 6).
5. The "Available" figures are screen-only helpers and do not print.

## 9. Build order for Claude Code

1. Add the `ownRowFilter` rule for Blanching (R2) and confirm R1 still passes its checklist.
2. Add the `capRowsAgainstRows` type (R3), update `business-rules.json` and `business-rules.md`.
3. Extend the job lookup to return per-process totals; add the `legacy_no_blanching` flag in the migration script.
4. Add the live "Available" lines (tally and per card) and the carry-forward cap.
5. Create `v_dry_job_weights` and the override table; update the trace view if it lists weights.
6. Run the section 7 checklist.
