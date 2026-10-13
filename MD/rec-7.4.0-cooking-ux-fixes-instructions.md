# REC 7.4.0 Dry Cooking — UX Fixes: Time Picker, Field Alignment, Slide Order, Next Gate

Status: instructions only, no code written. For Claude Code.
Date: 2026-10-13
Raised by: Michaela
Scope: REC 7.4.0 only.

## 0. How this relates to earlier files

This file **amends** `rec-7.4.0-pot-slides-blanching-stage-instructions.md`. Where they disagree, **this file wins**. Anything not mentioned here stays as written there.

| Earlier file | What this file changes |
|---|---|
| `rec-7.4.0-pot-slides-blanching-stage-instructions.md` | Time field replaced with segmented HH:MM input. Field rows on every slide aligned to a strict grid. Slide 1 always opens as Blanching (no choice). Next gate relaxed for Cooking slides only. |

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
- Every cooking time field on the Cooking slide (Start time, End time, and any other `…Time` field).
- **Total time** is calculated and read-only — it remains a plain read-only text display, not a segmented input.

---

## 2. Field row alignment — strict grid

**Problem:** Fields on a slide are at different vertical baselines; labels and inputs don't line up across columns.

**Rule:** Every slide uses a **CSS Grid layout**, not flexbox wrapping or nested divs, for its field area.

### 2.1 Grid definition

```
Two-column grid on tablet portrait (≥ 600 px):
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

## 3. Slide 1 always opens as Blanching — no choice on slide 1

**Problem:** Dry cooking always starts with one blanching stage. Presenting a Blanching / Cooking choice on the first slide is unnecessary friction and risks operators accidentally starting a cooking pot before blanching.

### 3.1 New rule

- **Slide 1 is always a Blanching slide.** It opens directly with the Blanching fields — no stage-choice buttons are shown on slide 1.
- The Blanching slide title reads "Blanching" (unchanged).
- Slides 2, 3, 4 … still show the Blanching / Cooking choice when first opened (so a second blanching batch is still possible, matching the existing multi-batch model).

### 3.2 Edge cases

- The operator cannot convert slide 1 to a Cooking slide via the Remove and re-add path. After removing slide 1, a new slide 1 is automatically created as Blanching.
- If a saved draft's slide 1 is Cooking (created before this rule was applied), display it without change — do not migrate or reorder old data. The rule applies only to new entries created after this change is deployed.
- Old entries (existing submissions) are unaffected.

### 3.3 Slide bar

The "B" chip for slide 1 (Blanching) still appears in the slide bar as described in the earlier file. No other changes to the bar.

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

## 5. Testing checklist additions

These extend section 13 of `rec-7.4.0-pot-slides-blanching-stage-instructions.md`.

1. **Time field:** tap the HH box and type `09`; MM box receives focus automatically; type `30`; field shows `09:30`. Now button fills current time. Up arrow on MM box at 59 wraps to 0 and HH remains unchanged. Tab moves HH → MM → next field.
2. **Time field tablet:** both boxes are at least 44 px tall and easy to tap individually. The colon separator is not focusable.
3. **Grid alignment:** at 768 px wide, all labels in the left column share the same x start; all inputs in the same row have the same height and level top edges; the HH:MM pair height matches adjacent text inputs.
4. **Slide 1 is Blanching:** open a new entry — slide 1 shows Blanching fields immediately, no choice buttons. Removing slide 1 and re-creating slide 1 also opens as Blanching. Slide 2 still shows the choice.
5. **Old draft with Cooking as slide 1:** opens without change; no error.
6. **Cooking Next gate:** on a Cooking slide with empty fields, the Next button is enabled. Press it — a new slide is added. Return to the incomplete Cooking slide; its chip in the slide bar shows a warning dot.
7. **Blanching Next gate unchanged:** on the Blanching slide with empty fields, the Next button is disabled with the hint "Complete all fields to continue".
8. **Submit blocked:** with any incomplete Cooking slide, Submit is blocked and the button shows a hint identifying the problem.
9. **Submit allowed:** once all required fields on all slides are filled (including any ticked additions), Submit is enabled.
