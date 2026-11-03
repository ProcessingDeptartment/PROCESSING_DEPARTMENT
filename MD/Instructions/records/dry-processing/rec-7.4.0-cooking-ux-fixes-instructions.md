# REC 7.4.0 Dry Cooking — UX Fixes: Time Picker, Field Alignment, Slide Order, Next Gate, OOSW in Job Info

Status: instructions only, no code written. For Claude Code.
Date: 2026-10-13 (updated same day)
Raised by: Michaela
Scope: REC 7.4.0 only.

## 0. How this relates to earlier files

This file **amends** `rec-7.4.0-pot-slides-blanching-stage-instructions.md`. Where they disagree, **this file wins**. Anything not mentioned here stays as written there.

| Earlier file | What this file changes |
|---|---|
| `rec-7.4.0-pot-slides-blanching-stage-instructions.md` | Time field replaced with segmented HH:MM input. Field rows on every slide aligned to a strict grid. Slide 1 choice kept but Blanching removed from choices once one Blanching slide exists. Next gate relaxed for Cooking slides only. OOSW added to Job Info section. |

---

## 1. Time field — replace the native time picker

**Problem:** The native `<input type="time">` is inconsistent across Android and iOS browsers, visually sloppy, and hard to tap accurately on a tablet.

**New control:** A **segmented HH:MM input** — two adjacent numeric spinner boxes, one for hours and one for minutes, joined by a colon separator.

### 1.1 Layout

```
┌──────┐   ┌──────┐
│  09  │ : │  30  │
└──────┘   └──────┘
     [Now]
```

- **HH box:** integer 0–23. Two characters wide, left-padded with zero (shows `09` not `9`). Tap/click selects all; typing replaces the value. Up/down arrow keys increment or decrement, wrapping at 23 → 0 and 0 → 23.
- **MM box:** integer 0–59. Same two-character display. Up/down arrows step by 1; wrap at 59 → 0 and 0 → 59.
- The colon between the boxes is a static label, not focusable.
- Tab moves focus from HH → MM → next field (not HH → colon → MM).
- The **Now** button fills both boxes with the current local time (hh and mm only; seconds discarded). It is a small secondary button placed directly below or beside the pair, clearly labelled "Now".
- The pair has a visible bounding box (border + border-radius matching the other inputs on the form) so it reads as a single field at a glance.
- Minimum touch target for each box: 44 × 44 px. The colon separator does not reduce the width of the boxes.

### 1.2 Value storage

- Store as a `time` (hh:mm:00) string, same as the existing `blanchTime` and cooking time columns. No change to the database schema.
- An empty state: both boxes blank, placeholder `--`. The field is considered incomplete while either box is blank or holds a value outside range.

### 1.3 Apply to

All time fields in REC 7.4.0:
- `blanchTime` on the Blanching slide.
- Every cooking time field on the Cooking slide (Start time, End time, and any other `...Time` field).
- **Total time** is calculated and read-only — it remains a plain read-only text display, not a segmented input.

---

## 2. Field row alignment — strict grid

**Problem:** Fields on a slide are at different vertical baselines; labels and inputs don't line up across columns.

**Rule:** Every slide uses a **CSS Grid layout**, not flexbox wrapping or nested divs, for its field area.

### 2.1 Grid definition

```
Two-column grid on tablet portrait (>= 600 px):
  grid-template-columns: 1fr 1fr;
  column-gap: 16px;
  row-gap: 12px;

Single-column on narrow screens (< 600 px):
  grid-template-columns: 1fr;
```

- Each field (label + input) occupies **one grid cell**.
- **Label:** `display: block`, same font size and line-height everywhere on the slide, no wrapping truncation. Labels do not float or use `position: absolute`.
- **Input / control:** `width: 100%`, `box-sizing: border-box`, same height as all other inputs on the slide (set a consistent `--input-height` CSS variable, e.g. 44 px on tablet, 40 px on desktop).
- Yes/No button pairs (Sea water) span the same `--input-height` so they sit flush with adjacent inputs.
- The segmented HH:MM pair (section 1) is wrapped in a container that is `width: 100%` and matches `--input-height`; the two inner boxes split the width equally.
- The Optional additions block sits below the grid in a full-width row — it does not participate in the two-column grid.
- Read-only calculated fields (Total time, Available to cook) also sit in their grid cell at the same height.

### 2.2 Consistent typography

- All field labels: same size, same weight, same colour. No label is larger or bolder than another within the same slide.
- All input values: same font size, same line-height. No input is taller than another in the same row.
- Units (°C, kg) shown inline in the label text **and** as a non-editable suffix rendered inside the input control. The suffix is the same font size as the input value and muted in colour. The suffix does not overlap the value; the input has enough right-padding to prevent it.

### 2.3 Visual QA

Before marking complete, the developer must view the Blanching slide and a Cooking slide at tablet portrait width (768 px) and confirm:
- All labels in the left column start at the same x position.
- All labels in the right column start at the same x position.
- All inputs in the same row are the same height and their top edges are level.
- The HH:MM pair is the same height as a text input on the same row.
- The Yes/No pair is the same height as a text input on the same row.

---

## 3. Stage choice on new slides — Blanching removed once one exists

**Replaces section 3 of the previous version of this file ("Slide 1 always opens as Blanching").**

### 3.1 Rule

- **Every new slide, including slide 1, starts with the Blanching / Cooking choice buttons.** The operator always chooses the stage explicitly.
- **Once one Blanching slide already exists in the entry, the Blanching button is removed from the choice.** Only the Cooking button is shown for any subsequent new slide.
- This enforces the real-world process: one blanching stage happens first, then all remaining slides are cooking pots. A second blanching batch is not possible within a single entry.

### 3.2 Visual — choice buttons

When both options are available (no Blanching slide yet):
```
+---------------------+   +---------------------+
|      Blanching      |   |      Cooking        |
+---------------------+   +---------------------+
```

When Blanching already exists (one or more Blanching slides present):
```
+-------------------------------------------------+
|                    Cooking                      |
+-------------------------------------------------+
  i  Blanching already recorded for this entry
```
The info note under the single button is muted text, not a warning. It is brief and factual.

### 3.3 Edge cases

- Removing the only Blanching slide restores the two-button choice on any undecided new slide and on any slide whose stage was never chosen.
- If a saved draft already has a stage chosen on a slide, the choice is fixed as before — removal and re-add is the way to change it (unchanged from the earlier file).
- Old entries with multiple Blanching slides display as-is; the restriction applies only to new slides added after this change is deployed.

### 3.4 Slide bar

No change to the slide bar. "B" chips and pot-number chips behave exactly as described in the earlier file.

---

## 4. Next gate — relaxed for Cooking slides

**Problem:** Multiple cooking pots run simultaneously. An operator may start Pot 1, then need to add Pot 2 before Pot 1 is done. Blocking the Next button until every field on a Cooking slide is complete prevents this.

### 4.1 New rule

| Slide type | Next button |
|---|---|
| **Blanching** | **Unchanged** — disabled until every field is complete. A Blanching slide is quick, once-off, and done before cooking starts. All five fields must be filled before moving on. |
| **Cooking** | **Always enabled** (never disabled because of incomplete fields). The operator may press Next at any time to add the next pot. |

### 4.2 Incomplete Cooking slide indicators

Because Next no longer enforces completion on Cooking slides, the slide bar chip must clearly signal which slides still need attention:

- A Cooking chip with **any missing required field** shows a small **warning dot** (amber, clearly visible) on its chip in the slide bar.
- A Cooking chip with **all required fields filled** shows a **tick** (green or check mark).
- The Blanching chip follows the same dot / tick logic it always did.

### 4.3 Submit still blocked

**Submit (Finalize) is blocked while any real slide has missing required fields.** This rule is unchanged. The Submit button tooltip / hint must clearly state "Complete all pots to submit" (or equivalent) while blocked.

- "Real slide" excludes an untouched empty slide created by a stray Next press (same definition as the earlier file).
- Optional additions that are ticked but missing weight or batch code still block Submit.
- Draft save is never blocked (unchanged).

### 4.4 Hint text change

The old hint "Complete all fields to continue" only appeared beside the (disabled) Next button on a Cooking slide. Remove that hint from Cooking slides. It remains on the Blanching slide where Next is still gated.

---

## 5. OOSW in Job Info section

**Problem:** The OOSW (Out-Of-Shell Weight) total from REC 7.1.5 is the hard ceiling on total cooking weight for the job. The rule is active throughout the entry but the value is not visible in the job header, so the operator has no immediate reference point.

### 5.1 New field in Job Info

Add **OOSW (kg)** as a read-only display field in the Job Info section at the top of the form. It sits alongside the existing job fields (Job number, Processing for, Whole weight, Harvest farm, Intake date).

- **Label:** `OOSW (kg)`
- **Value:** the total OOSW kg from REC 7.1.5 for this job — the same value already used by the R1 weight rule.
- **Read-only.** The operator cannot edit it. It is fetched at the same time as the other job info fields.
- If no OOSW record exists for the job: show `Not recorded` in muted text (same behaviour as the "OOSW not found" case in the weight rules).
- It updates if the form is refreshed but does not poll live — a page load or draft-open fetch is sufficient.

### 5.2 Placement in the Job Info grid

The Job Info section already uses a grid (or equivalent row layout). Place OOSW (kg) in a logical position near Whole weight (kg), since both are weights tied to the same job. Suggested order:

```
Job Number          Harvest Farm
Processing For      Intake Date
Whole Weight (kg)   OOSW (kg)       <- new field alongside Whole Weight
```

If the existing grid is 4-column (label | value | label | value), OOSW fits naturally as the right-hand pair on the Whole Weight row:

```
| Whole Weight (kg) | [value] | OOSW (kg) | [value — read-only] |
```

Do not restructure the rest of the Job Info layout to accommodate this — slot it into the nearest available cell.

### 5.3 "Available to cook" relationship

The live **"Available to cook (kg)"** figure shown under the Abalone weight field on each Cooking slide is `OOSW - total cooked kg`. Showing OOSW in the header gives the operator both the ceiling and the running remainder without having to scroll to a cooking slide. These two displays are complementary; neither replaces the other.

### 5.4 Print

OOSW (kg) **prints** in the Job Info grid on the PDF, in the same position as on screen (section 4 of `rec-7.4.0-print-layout-instructions.md`). The print grid already has room for it on the Whole Weight row. Value is static on print (same as all other Job Info values).

### 5.5 Database / API

No schema change. The value already exists on the server (it is fetched for the R1 rule). Expose it in the job-info response payload that is already sent to the form on load. Add a field `ooswKg` (number or null) to that response; null maps to "Not recorded" on screen.

---

## 6. Testing checklist additions

These extend section 13 of `rec-7.4.0-pot-slides-blanching-stage-instructions.md` and the earlier version of this file.

1. **Time field:** tap the HH box and type `09`; MM box receives focus automatically; type `30`; field shows `09:30`. Now button fills current time. Up arrow on MM box at 59 wraps to 0 and HH remains unchanged. Tab moves HH -> MM -> next field.
2. **Time field tablet:** both boxes are at least 44 px tall and easy to tap individually. The colon separator is not focusable.
3. **Grid alignment:** at 768 px wide, all labels in the left column share the same x start; all inputs in the same row have the same height and level top edges; the HH:MM pair height matches adjacent text inputs.
4. **Stage choice — first slide:** slide 1 shows both Blanching and Cooking buttons. Choose Blanching.
5. **Stage choice — second slide:** press Next (after completing Blanching). New slide shows only the Cooking button with the muted "Blanching already recorded" note. The Blanching button is absent.
6. **Stage choice — remove Blanching:** remove the Blanching slide. Open a new slide — both buttons are back.
7. **Cooking Next gate:** on a Cooking slide with empty fields, the Next button is enabled. Press it — a new slide is added. Return to the incomplete Cooking slide; its chip in the slide bar shows a warning dot.
8. **Blanching Next gate unchanged:** on the Blanching slide with empty fields, the Next button is disabled with the hint "Complete all fields to continue".
9. **Submit blocked:** with any incomplete Cooking slide, Submit is blocked and the button shows a hint identifying the problem.
10. **Submit allowed:** once all required fields on all slides are filled (including any ticked additions), Submit is enabled.
11. **OOSW in Job Info:** open an entry for a job that has an OOSW record — the OOSW (kg) value appears correctly in the Job Info section alongside Whole Weight. It is not editable.
12. **OOSW missing:** open an entry for a job with no REC 7.1.5 record — Job Info shows `Not recorded` in muted text for OOSW (kg).
13. **OOSW on print / PDF:** the OOSW (kg) value appears in the Job Info grid on the printed output.
