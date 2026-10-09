# REC 7.4.0 Dry Cooking — Print / PDF Layout Instructions

Status: instructions only, no code written. For Claude Code.
Date: 2026-10-05
Raised by: Michaela
Revision on form: **7**
Reference: `REC 7.4.0 Dry Cooking_rev 7.docx` (supplied 2026-10-05)
Scope: PDF / print output of REC 7.4.0 only. Screen UX governed by `rec-7.4.0-pot-slides-blanching-stage-instructions.md`.

---

## 1. General print rules

- **Font size reduced** throughout. Base body: **9 pt**. Section headings: **10 pt bold**. Field labels: **8 pt**. Table cell values: **9 pt**. Reduce further only if a table overflows — never split a pot column mid-row across pages.
- Page: A4 portrait, 10 mm margins all sides.
- Black and white only. No tally lines. No "Available to cook". No slide bar.
- **Revision number** in the footer of every page, bottom right: `REC 7.4.0  |  Rev. 7  |  Printed: DD MMM YYYY  |  Page X of Y`.
- The red OOSW override warning prints when triggered (one bold bordered line per rule). No other coloured elements.

---

## 2. Page structure (top to bottom)

```
Header row (record title + revision)
Job Info section (3 rows × 4 columns)
─────────────────────────────────────
Batch 1 heading
Blanching table (5-field compact strip)
Cooking pots table (transposed, 4 pots minimum per row)
─────────────────────────────────────
Batch 2 heading  (if a second blanching slide exists)
Blanching table
Cooking pots table
─────────────────────────────────────
… additional batches …
─────────────────────────────────────
OOSW override warning (if any)
Sign-off section
Footer
```

---

## 3. Header

One row across the full page width:

```
[ Logo / Company name ]   REC 7.4.0 — Dry Cooking   Rev. 7
```

---

## 4. Job Info section — 3 rows × 4 columns

A grid of 3 rows and 4 columns. Columns alternate: **label (bold, 8 pt) | value (9 pt)** forming two label+value pairs per row. Column widths: label cols ~18% each, value cols ~32% each (total 100%).

```
┌─────────────────┬────────────────────────┬─────────────────┬────────────────────────┐
│ Job Number      │                        │ Harvest Farm    │                        │
├─────────────────┼────────────────────────┼─────────────────┼────────────────────────┤
│ Processing For  │                        │ Intake Date     │                        │
├─────────────────┼────────────────────────┼─────────────────┼────────────────────────┤
│ Whole Weight    │                        │ Cooking Date    │                        │
└─────────────────┴────────────────────────┴─────────────────┴────────────────────────┘
```

- **Col 1** (label): Job Number, Processing For, Whole Weight — bold, 8 pt, light grey background.
- **Col 2** (value): pre-filled from submission data; editable field on screen, static on print.
- **Col 3** (label): Harvest Farm, Intake Date, Cooking Date — bold, 8 pt, light grey background.
- **Col 4** (value): pre-filled from submission data.
- Light outer border, all internal borders 0.5 pt. No row shading on value columns.
- "Whole Weight" = total OOSW weight from REC 7.1.5 for the job (same value used by the OOSW rule). Label is "Whole Weight (kg)".

---

## 5. Batch grouping — blanching and cooking rounds

### 5.1 Definition

A **batch** = one Blanching slide + all Cooking slides that follow it (by `seq_no`) before the next Blanching slide.

Algorithm:

```
batch_number = 1
for each slide in seq_no order:
    if slide.process == 'Blanching':
        if batch_number > 1: close previous batch
        open Batch(batch_number)
        batch_number += 1
    else (Cooking):
        append to current batch
```

Any Cooking slides before the first Blanching slide (should not occur on new entries): group in an unlabelled cooking-only block before Batch 1.

### 5.2 Batch heading line

```
Batch 1
```

Bold 10 pt, light grey background, full width, 1 pt border. Printed immediately above the batch's blanching strip.

### 5.3 Pot numbering within a batch

Within each batch, cooking pots are numbered **Pot 1, Pot 2 …** starting from 1. This is the batch-local number used in print headers. The database `pot_no` (global across the whole entry) is not used in the print heading.

Printed column header format: **Batch 1 — Pot 1**, **Batch 1 — Pot 2**, etc.

---

## 6. Blanching section — compact strip table

Printed above each batch's cooking table.

### 6.1 New entries (Oct 2026 format — 5 fields)

A single-row strip. "Blanching" label on the far left (bold, shaded), then 5 label+value pairs across the row:

```
┌────────────┬──────────────────┬──────┬──────────────────┬──────┬────────┬──────┬───────────┬──────┬────────────────┬──────┐
│ Blanching  │ Sea Water (Lt)   │      │ Temperature (°C) │      │  Time  │      │ Salt (kg) │      │ Salt batch no. │      │
└────────────┴──────────────────┴──────┴──────────────────┴──────┴────────┴──────┴───────────┴──────┴────────────────┴──────┘
```

- Section label "Blanching": bold 9 pt, light grey background, ~12% width.
- Each label: bold 8 pt. Each value cell: 9 pt, empty (handwritten) or filled from data.
- Remaining width shared equally across 5 label+value pairs.
- Light 0.5 pt borders throughout.

### 6.2 Old entries (legacy format — pre Oct 2026)

Detect by: `blanch_temp_c IS NULL`. Print the original 6-field layout matching the reference document (two groups side by side):

```
┌────────────┬──────────────────┬──────┬───────────────┬──────┬────────────────────┬──────┐
│            │ Sea Water (Lt)   │      │ pH            │      │                    │      │
│ Blanching  │ Salt – Kg        │      │ Temperature   │      │                    │      │
│            │ Record batch no. │      │ Cooking time  │      │                    │      │
└────────────┴──────────────────┴──────┴───────────────┴──────┴────────────────────┴──────┘
```

---

## 7. Cooking pots table — transposed, 4 pots minimum

Field names run **down the left column**; each pot occupies **one column to the right**. This matches the reference document structure (rows 5–23).

### 7.1 Table layout

```
┌──────────────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│                                  │  Batch 1     │  Batch 1     │  Batch 1     │  Batch 1     │
│                                  │  Pot 1       │  Pot 2       │  Pot 3       │  Pot 4       │
├──────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ [COOKING — full-width shaded]    │  (merged across all pot columns)                          │
├──────────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Abalone (kg)                     │              │              │              │              │
│ Sea Water (Lt)                   │              │              │              │              │
│ pH                               │              │              │              │              │
│ Salt – kg (if applicable)        │              │              │              │              │
│ Record batch number              │              │              │              │              │
│ Sugar – kg (if applicable)       │              │              │              │              │
│ Record batch number              │              │              │              │              │
│ Vinegar – kg (if applicable)     │              │              │              │              │
│ Record batch number              │              │              │              │              │
│ Start time                       │              │              │              │              │
│ Starting temperature (°C)        │              │              │              │              │
│ 20 min after reaching temp (°C)  │              │              │              │              │
│ End of cooking cycle (°C)        │              │              │              │              │
│ Time out                         │              │              │              │              │
│ Total cooking time               │              │              │              │              │
│ Comments                         │              │              │              │              │
│ Cooker                           │              │              │              │              │
└──────────────────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### 7.2 Column rules

- **Always print a minimum of 4 pot columns per batch row**, even if fewer pots were entered. Unused columns print blank data cells with a blank header — space for handwritten additions on the printed form.
- If a batch has 5–8 pots: two consecutive 4-column table blocks under the same Batch heading (pots 1–4, then pots 5–8). 9–12 pots: three blocks. Etc.
- **Column widths:** field label column = **30% of page width**. Each pot column = 70% ÷ 4 = **17.5%**.
- Header row (Batch / Pot labels): light grey background, bold 8 pt, centred.
- "Cooking" section label row: full width, light grey background, bold 10 pt — sits at the top of the table spanning all columns.
- Field label column: bold 8 pt. Value cells: 9 pt. All borders 0.5 pt.

### 7.3 Optional addition rows (Salt, Sugar, Vinegar)

Always print all three optional addition groups (Salt+batch, Sugar+batch, Vinegar+batch) in every cooking table, matching the reference document. Label them "(if applicable)". If a pot did not use an addition, its cell is empty — do not omit the row.

### 7.4 "Cooker" row

The final row of the cooking table. Pre-fill from submission `signedOffBy` data where available. Empty on blank pots.

---

## 8. Sign-off section

Below the last batch block, above the footer. Three equal columns:

```
┌──────────────────────────┬──────────────────────────┬──────────────────────────┐
│ Completed by             │ Checked by               │ Authorised by            │
│ Name: _______________    │ Name: _______________     │ Name: _______________    │
│ Signature: ___________   │ Signature: ___________    │ Signature: ___________   │
│ Date: ________________   │ Date: ________________    │ Date: ________________   │
└──────────────────────────┴──────────────────────────┴──────────────────────────┘
```

- Light outer border, internal column dividers 0.5 pt. No background shading.
- 8 pt throughout. "Completed by" Name pre-filled from `signedOffBy` where available.

---

## 9. OOSW override warning (if triggered)

Bordered box between the last batch and the sign-off section. Bold black text (or red where colour is supported).

```
⚠  OOSW Override — Cooking pot weight exceeding OOSW - possible batch mix
   Acknowledged by: [name]   Note: [oosWarningNote]
```

One block per overridden rule. Only R1 can trigger (per Oct 2026 slide instructions).

---

## 10. Footer (every page)

```
REC 7.4.0 — Dry Cooking  |  Rev. 7  |  Printed: DD MMM YYYY  |  Page X of Y
```

Right-aligned. 7 pt. Thin rule above.

---

## 11. Old entries — backwards compatibility

- Old Blanching cards (`blanch_temp_c IS NULL`): use legacy 6-field strip (section 6.2).
- Old Cooking cards with a typed Salt value: Salt – Kg and batch number cells filled normally.
- Old cooking-only entries (no blanching card): print the cooking table with no Blanching strip or Batch heading.
- Total cooking kg per job must be identical before and after.

---

## 12. Build instructions for Claude Code

1. Apply font reductions: body 9 pt, headings 10 pt bold, labels 8 pt, footer 7 pt.
2. **Job Info grid:** 3 rows × 4 columns. Col 1 labels: Job Number / Processing For / Whole Weight (kg). Col 3 labels: Harvest Farm / Intake Date / Cooking Date. Fill values from submission data.
3. Implement batch-grouping algorithm (section 5.1) from `seq_no`-ordered child rows.
4. Per batch: Batch heading → Blanching strip (new 5-field or legacy 6-field) → Cooking section label → Transposed pots table.
5. Always print 4 pot columns minimum; fill unused with blank cells.
6. All Salt/Sugar/Vinegar rows always print with "(if applicable)". Never omit.
7. "Cooker" row at the bottom of every cooking table (pre-fill from sign-off data).
8. Sign-off section (section 8) and OOSW warning box (section 9).
9. Footer every page: `REC 7.4.0 — Dry Cooking  |  Rev. 7  |  Printed: <date>  |  Page X of Y`.
10. Visual QA — three test prints on A4 portrait:
    - **Test A:** 1 batch, 3 cooking pots → 4th column blank.
    - **Test B:** 2 batches — Batch 1: 2 pots, Batch 2: 5 pots → Batch 2 wraps into two 4-column blocks.
    - **Test C:** Legacy old entry — blanching with legacy fields + cooking pots.
