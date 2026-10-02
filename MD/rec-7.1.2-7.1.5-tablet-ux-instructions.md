# REC 7.1.2 & REC 7.1.5 — Tablet UX Improvements (Instructions for Claude Code)

**Date:** 2026-10-02
**Raised by:** Michaela — "abalone receiving and salting (OOSW) forms are not easy to use" on tablet.
**Scope:** Tablet layout and interaction improvements for REC 7.1.2 (Abalone Received) and REC 7.1.5 (OOSW). No change to field names, storage keys, validation rules, calculations, CSV export, or print output.
**Related docs:** `claude/tablet-ui-optimisation-brief.md` (overarching tablet brief — this file is a targeted addendum for these two records specifically).

---

## Background and pain points

### REC 7.1.2 — Abalone Received

This is a roster form: one row per basket. A typical intake has 50–90+ baskets. On tablet, the current layout presents a wide data table that requires both horizontal and vertical scrolling simultaneously, making it hard to know which row you are on and easy to enter a value in the wrong column.

Known friction from the 2026-10-02 data-entry run:
- **Size range is required on every row** and cannot be blank — but the majority of baskets in a batch are usually the same size. Operators must tap a dropdown 84 times for what is effectively one value.
- **Count field is required** even when the count is not measured at receiving; operators used 0 as a placeholder, which is misleading.
- **Basket number** is manually derived from the lot code (strip "FD" prefix); this step is error-prone.
- **The wide table** on a tablet in portrait mode forces horizontal scroll, and the row identity (basket number) scrolls off-screen.

### REC 7.1.5 — OOSW

This is a simpler, fixed-structure form with one row per size band. The pain on tablet is:
- **The percentage field** next to each size band's weight is either editable (manual calculation, error-prone) or calculated but not clearly labelled as auto-calculated.
- **Layout on portrait tablet**: fields are cramped; the total/running tally is not prominent enough to catch data-entry mistakes.

---

## 1. REC 7.1.2 — Changes

### 1.1 Size range: "Apply to all baskets" shortcut

**Problem:** Size range is required per row and operators must select it for every basket individually, even when every basket in the batch is the same size.

**Change:** Add a prominent button above the roster, labelled **"Set size range for all baskets"** (or **"Apply size range to all"**). Tapping it opens a simple modal with the same size-range dropdown used on individual rows. Selecting a value and confirming pre-fills the size range on every basket row that currently has no size range set. Rows that already have a value are not overwritten (operator confirms via a checkbox in the modal: "Also update rows that already have a size range"). The button is not a submit-blocking requirement — it is a convenience. Each row's size range field stays individually editable after the bulk fill.

- **UI:** Place the button in the roster header bar, to the right of "Add basket" / "Add row". Style it as a secondary action button (outline style). On a touch device with ≥ 4 rows, the button is always visible (not hidden in a menu).
- **No schema change.** Each row still stores its own `sizeRange` value in the database; the shortcut just fills them in bulk client-side.

### 1.2 Count field — make it optional

**Problem:** "Count" is required but is not reliably measured at receiving. Operators enter 0 as a placeholder, which pollutes data.

**Change:** Mark the Count field as **optional** on REC 7.1.2. Remove any submit-blocking validation that requires a value. Leave the field visible and editable. Add a hint underneath: "Leave blank if not counted at receiving." Where the field is blank, store NULL (not 0) in the database. Update the print/PDF to show "—" for blank counts.

- Check the current key name for this field in the live record definition before implementing — it is likely `count` or `basketCount`. Confirm and state it in the work log.
- The CSV export should export a blank cell (not 0) for NULL counts.

### 1.3 Basket roster — tablet layout

**Problem:** Wide table requires simultaneous horizontal and vertical scrolling on portrait tablet. Row identity (basket number) scrolls off screen.

**Changes (tablet / coarse-pointer only — desktop table layout unchanged):**

#### Portrait orientation (width ≤ 820px, touch device):
Collapse each basket row from a wide table into a **compact card**, stacked vertically. Each card shows:
- Line 1 (bold): **Basket # [number]** — the row identifier, always visible
- Line 2: Size range selector (large touch target, segmented button if ≤ 4 options, else compact dropdown)
- Line 3: Weight (kg) input | Count input (optional, greyed hint)
- Delete (✕) button at top-right of the card, 40px tap target

A running total strip, pinned above the basket card list, shows:
**Baskets: 12 · Total weight: 234.50 kg** (updates live as rows are filled)

"+ Add basket" is a full-width 56px button below the last card.

#### Landscape orientation (width > 820px, touch device):
Keep the table layout but make these changes:
- **Freeze the first column** (basket number) so it stays visible while scrolling horizontally.
- Increase row height to 48px minimum.
- Increase all input heights in the table to 44px.
- Size range column: use a compact segmented button for the most common size bands (≤ 4 options fit); fall back to a dropdown otherwise. Pre-select nothing.

### 1.4 Basket number — lot code helper

**Problem:** Operators manually derive the basket number by stripping "FD" from the lot code, which causes typos.

**Change:** Add a small hint line under the Basket # field: *"Lot code without 'FD' — e.g. lot FD1234 → basket 1234."* No auto-derivation (too many lot-code formats to handle safely) — the hint is enough. If a basket number entry begins with "FD" or "fd", show an inline warning: *"Did you mean [lot code without FD]?"* with a one-tap "Use [derived value]" correction. The field stays editable; the correction is only a suggestion.

---

## 2. REC 7.1.5 — OOSW Changes

### 2.1 Percentage column — clearly mark as calculated

**Problem:** The percentage column next to each size band weight appears editable, causing operators to second-guess whether to type it or leave it.

**Change:** Make the percentage field visually read-only: grey background (`#EEF1F0`), lock icon to the left of the value, no cursor on tap. Add a hint below the column header: *"Auto-calculated from total weight."* The stored value in the database is the calculated percentage (as today) — no schema change.

### 2.2 Total and running check — prominent on tablet

**Problem:** The total weight and total percentage are not prominent enough; it is easy to miskey a weight without noticing the total is wrong.

**Changes:**
- Pin a **summary bar** at the bottom of the size-band table (not the page footer — directly below the last row of the table, always visible without scrolling):
  ```
  Total OOSW weight: 414.35 kg   Total %: 27.27%
  ```
  Updates live as weights are typed.
- If the total percentage is not between 0% and 100%, the bar turns amber with a warning: *"Total is [X]% — check entries."*
- If the total percentage rounds to exactly 100% (within 0.1%), the bar shows a subtle green tick. This is informational only — never a blocking gate.

### 2.3 Weight fields — tablet input size

On tablet/touch devices:
- Each weight input in the size-band table: **48px minimum height**, numeric keyboard.
- Font size of input values: **18px** (matches tablet brief, Section 5.2).
- A **"Now" button is not applicable here** (OOSW is a weight record, not time-based) — do not add one.

### 2.4 Layout on portrait tablet

On portrait (width ≤ 820px, touch device), the size-band table can squeeze. If any column becomes narrower than 80px in portrait at the tablet's declared width:
- Stack the size-band table rows as cards (same pattern as 1.3 above):
  - Line 1: **Size band** (bold)
  - Line 2: Weight (kg) input (full width of card)
  - Line 3: Auto-calculated % (read-only, grey)
- The pinned summary bar (2.2) sits below the card list.

---

## 3. What does not change

- Field keys, storage schema, database columns — no change.
- Validation rules (required fields, OOSW cap check on REC 7.4.0) — no change.
- CSV export columns and order — no change.
- Print / PDF layout — no change.
- The OOSW business rule that caps cooking weight against OOSW total — no change, only the display is affected.

---

## 4. Testing checklist

### REC 7.1.2
1. **Apply size range to all:** tap the button with 10 rows already entered (5 with a size range, 5 without). Confirm: the 5 blank rows are filled; with the "also update filled rows" checkbox checked, all 10 are updated. Each row stores its own `sizeRange` in the DB.
2. **Count optional:** submit a basket with no count entered. Confirm: submission succeeds; DB stores NULL; CSV exports blank; PDF shows "—".
3. **Portrait card layout:** on a touch device ≤ 820px wide, basket rows display as stacked cards. The running total updates as weights are typed.
4. **Landscape freeze:** on a touch device > 820px wide, basket number column stays visible during horizontal scroll.
5. **FD hint:** type "FD1234" into basket number; confirm the "Did you mean 1234?" suggestion appears and the one-tap correction sets the field to "1234".
6. **Desktop unchanged:** on a non-touch device, none of the above layout changes apply — the existing table renders as before.

### REC 7.1.5
1. **Read-only %:** tapping a percentage cell on any device shows no cursor and does not open the keyboard.
2. **Live total bar:** change a weight; the total weight and % update immediately below the table, without a page reload.
3. **Amber warning:** enter weights that total to a % outside 0–100; confirm the bar turns amber and shows the message.
4. **Green tick:** enter weights that total to 100% (±0.1%); confirm the bar shows a green tick.
5. **Portrait card layout:** on touch ≤ 820px, size bands display as cards with stacked weight + %.
6. **Print unchanged:** generate a PDF; confirm layout and values are identical to before.
