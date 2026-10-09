# REC 7.1.5 OOSW — Entry Flow Redesign (Instructions for Claude Code)

**Date:** 2026-10-02
**Raised by:** Michaela — "Button selector for size range at top. Then weight. Then add weight. The size range whole weight is at the bottom where the green section is."
**Scope:** REC 7.1.5 OOSW entry form only. No change to storage keys, database schema, validation rules, the OOSW cap rule used by REC 7.4.0, CSV export, or print output.
**Related docs:** `claude/rec-7.1.2-basket-entry-flow-instructions.md` (same design pattern), `claude/record-open-job-gate-instructions.md` (job gate applies to this record).

---

## 1. The new entry panel structure

The OOSW entry form is reorganised into a **focused top-down entry panel** — no table of rows to fill in simultaneously. The operator selects a size range, types the weight for that range, taps **Add weight**, then repeats for the next size range. The accumulated per-size-range totals appear in a summary section at the bottom.

```
┌─────────────────────────────────┐
│  SIZE RANGE (buttons)           │
│  [ 0–50g ] [ 51–70g ] [ 71g+ ] │
│                                 │
│  Weight (kg)  [ ________ ]      │
│                                 │
│  [ Add weight ]                 │
├─────────────────────────────────┤
│  ▼ SIZE RANGE TOTALS            │  ← green section
│  0–50 g    414.35 kg   27.27 %  │
│  (other rows hidden until set)  │
│  ─────────────────────────      │
│  Total OOSW   1519.69 kg  100%  │
└─────────────────────────────────┘
```

---

## 2. Size range selector

At the top of the entry panel, a row (wrapping on narrow screens) of **large segmented buttons**, one per size range option. These are the same size range values used throughout the system (existing options — do not add or remove any). Each button is:
- Minimum 48 px tall, minimum 80 px wide, with the size range label in 17 px bold text.
- **Unselected state:** outline style (border `--field-line`, white background, `--ink` text).
- **Selected state:** filled with `--action` colour, white text, a tick icon to the left of the label.
- Only one size range can be selected at a time. Tapping a selected button de-selects it (nothing selected).
- If no button is selected, the Weight field and Add weight button are disabled (greyed, not focusable).

On a wide tablet in landscape: all buttons in one row. On portrait or if more than 5 options: wrap to two rows, no horizontal scroll.

---

## 3. Weight field

Below the size range selector:

```
Weight (kg)   [ ____________ ]
```

- Numeric input with decimal, 48 px tall, numeric keyboard on tablet.
- The unit "(kg)" is shown as a non-editable suffix inside the input and in the label.
- Required and must be > 0. The Add weight button is disabled until a size range is selected and a positive weight is entered.
- A small hint below: *"Enter the total weight for this size range."*

---

## 4. Add weight button

A full-width **Add weight** button (56 px, `--action` colour, white text).

On tap:
1. Validate: a size range is selected, weight > 0.
2. If valid:
   - The weight is stored against the selected size range.
   - If a weight already exists for that size range (the operator is updating it), the existing value is **replaced** — not summed. This matches the OOSW logic where each size range has one weight for the submission. A brief confirmation toast shows: *"0–50 g updated to 414.35 kg"*.
   - If it is the first entry for that size range: *"0–50 g set to 414.35 kg"*.
   - The selected size range button **remains selected** with its tick. The weight field **clears** and re-focuses, ready for the operator to either enter another size range (by tapping a different button) or correct this one.
   - The green totals section (§5) updates immediately.
3. If invalid: inline error under the weight field; no toast.

### 4.1 Re-entering a size range

If the operator taps a size range button that already has a stored weight, the weight field **pre-fills** with the existing value so it is easy to correct. The Add weight button label changes to **Update weight** while a pre-filled value is showing. On tap, the value is replaced (see §4 above).

This means the operator can always go back and correct any size range without navigating to a table — just tap the button, change the number, tap Update.

---

## 5. Size range totals — green section

Below the entry panel, a summary block styled with the existing green section colour (the same green currently on the form — keep the exact colour and background, do not re-theme it). This section is always visible; it does not collapse.

### 5.1 Layout

Each size range that has been given a weight appears as one row:

| Size range | Weight (kg) | % of total |
|---|---|---|
| 0–50 g | 414.35 | 27.27 % |
| 51–70 g | 600.00 | 39.48 % |
| … | … | … |

- Size ranges **with no weight set are not shown** (hidden, not zero). The list grows as the operator adds weights.
- The percentage is **auto-calculated** from the individual weight ÷ sum of all entered weights × 100, to 2 decimal places. It is display-only — never editable, no cursor on tap, no keyboard. Rendered in a slightly muted style (secondary text colour) to distinguish it from the weight.
- A **divider line**, then a **Total row** at the bottom:

```
Total OOSW     1519.69 kg     100.00 %
```

- The total weight is the sum of all entered size-range weights. The total % is always 100.00% (because percentages are derived from the same total). If only one size range has been entered, the total and the row are the same — that is correct.
- If no weights have been entered yet: the green section shows only the total row with 0.00 kg and a hint: *"Add weights above for each size range."*

### 5.2 Editing from the totals section

Each row in the green section has an **Edit** link (small, secondary style) on the right. Tapping Edit:
- Selects the corresponding size range button at the top.
- Pre-fills the weight field with that size range's current weight.
- Scrolls the entry panel into view.

This gives the operator a second path to correct a value without having to remember to re-tap the right button.

### 5.3 Removing a size range entry

On each row in the green section, after the Edit link: a **✕** icon (40 px tap target). Tapping ✕ shows a confirm: *"Remove 0–50 g (414.35 kg)? [Yes, remove] [Keep]"*. On Yes: that size range's weight is cleared, the row disappears from the green section, and the button at the top returns to unselected state. The totals recalculate.

---

## 6. Total weight cross-check

The total OOSW weight in the green section must be consistent with the total receiving weight on REC 7.1.2 for the same job. This cross-check already exists as a business rule — do not change the rule or its trigger. Only the display is changing. The existing warning or block behaviour is unchanged.

---

## 7. What does not change

- Storage keys and database columns for OOSW size ranges and weights — no change.
- The OOSW percentage values stored in the database — calculated and stored exactly as today.
- The business rule on REC 7.4.0 that caps cooking weight against the OOSW total — no change.
- CSV export: column names, order, values — no change.
- Print / PDF layout: the existing OOSW print table (all size ranges and weights in a fixed table) — no change. Print always uses the stored values regardless of which size range buttons are selected on screen.
- Validation rules — no change.

---

## 8. Testing checklist

1. **No size range selected:** Weight field disabled (greyed), Add weight button disabled.
2. **Select a size range:** Weight field enables, Add weight button enables.
3. **Enter weight and tap Add:** toast confirms, weight field clears, button stays selected with tick, green section shows new row with correct % calculated.
4. **Add a second size range:** both rows in green section, percentages recalculate correctly (sum to 100%).
5. **Re-tap a size range that has a value:** weight field pre-fills with existing value, button label shows "Update weight". Tap Update → value replaced, toast says "updated to…".
6. **Edit link in green section:** taps the right button at the top, pre-fills the weight. Update works.
7. **✕ in green section:** confirm shown, on Yes — row gone, button de-selected, totals recalculate.
8. **No weights entered:** green section shows 0.00 kg and the hint text only.
9. **Portrait tablet:** size range buttons wrap cleanly, no horizontal scroll. Weight field and Add button full width.
10. **Landscape tablet:** buttons in one row if space allows; entry panel and green section visible without scrolling (or with minimal scroll).
11. **Print:** PDF shows all stored size range weights in the existing table format, identical to before.
12. **CSV:** values and columns identical to before the redesign.
13. **OOSW cap rule on REC 7.4.0:** still triggers correctly based on the stored OOSW total weight.
14. **Touch targets:** size range buttons ≥ 48 px tall, Add weight ≥ 56 px, Edit links ≥ 44 px, ✕ ≥ 40 px.
