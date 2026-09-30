# REC 7.4.3.1 / 7.4.3.2 — Grading Production Log: Collection bins

*Updated 2026-09-30. Applies to Cultivated (7.4.3.1) and Ranched (7.4.3.2).*

## What the operator sees (tablet)

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

## Bin code = box code

- Each **+ Box** gives that box the bin's **current** code, and the bin then counts on by one. Example: bin at `8g-10g-3` → add box → the box is `8g-10g-3`, the bin becomes `8g-10g-4`.
- **Undo** only removes the **last** box, so codes already given to boxes never change.
- A new log starts each grade on its latest number from the database (the number after the last box).

## Traceability

- Every box code is saved to the bin trace with its job number, grading date, record and its own weight.
- `batch-trace.html?batch=<box code>` shows an **"In this bin"** table: job no., graded on, record, boxes, kg.
- REC 7.4.4 / 7.4.5 capture the same box code, so they link back to the job.

## How it is stored

| Column | Meaning |
|---|---|
| `sizeGrade` | fixed per row (hidden; it is the row) |
| `binNo` | hidden counter — the next free number for this grade |
| `binCode` | `sizeGrade-binNo` (derived) — the bin's current/next code |
| `binWeightStart`, `startConfirmed` | start weight + tick |
| `fullBoxWeight` | box weights `"12.4 + 11.9"`; box *k* of *n* has code `sizeGrade-(binNo − n + k)` |
| `finalBinWeight`, `gradedWeight` | final weight, calculated graded weight |

## Technical

- Definition: `roster.fixedGroups = { column: 'sizeGrade', seqColumn: 'binNo', dateField: 'gradingDate', sources: [cultivated, ranched], boxList: 'fullBoxWeight' }`; `fullBoxWeight.boxEntry`; start-weight `carryPrev.match = 'sizeGrade'`. Applied by `scripts/apply-grading-bin-no-removed.mjs`, then `snapshot-one-def.mjs` ×2 and `seed-definitions.mjs`.
- Server: `GET /api/roster-last-by-group/binNo?...` returns each grade's latest bin number in one call.
- Engine: `public/lib/form-record.js` v64 (grade table, box pop-up, confirm cell). Trace: `public/lib/traceability.js` v10 (indexes each box code). Styles: `record-theme.css` `.fr-bin-row`, `.fr-bin-sheet` (tv18).

## Known gaps

- Loading real bin numbers and box codes from the database is not yet tested live (the local preview has no database access).
- Logs saved before 2026-09-30 have no per-box codes in the trace.
- The old `binNo` column in the `sub_*` table was kept (it is used again).
