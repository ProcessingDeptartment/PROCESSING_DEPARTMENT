# REC 7.1.3 Salting and Tumbling — Barcode Scan + Roster UX (Instructions for Claude Code)

**Date:** 2026-10-27 (Part 2 revised same day)
**Raised by:** Michaela
**Scope:** Two independent improvements to `REC-7.1.3-salting-and-tumbling.html` and its record definition.

1. **Barcode scan** — add a lot-barcode field with camera scanner (admin-only), matching the pattern already used in REC 7.1.2 Abalone Receiving.
2. **Roster row UX** — three targeted fixes to the salting batch roster row: compact size range selector, weight fields sized like job info fields, and "Add weight" button placed inline next to the weight(kg) field styled like the submit button.

No field-key renames, no schema changes to existing columns, no print/PDF changes, no validation-rule changes.

---

## Part 1 — Barcode scan field

### 1.1 What to add

Add a single field to the **Job info** section of the `salting-and-tumbling` record definition:

```jsonc
{ "key": "lotBarcode", "label": "Lot barcode", "type": "text" }
```

Place it **after** `processingFor` (the last existing field in Job info). The field stores the lot barcode that links this salting job back to the intake basket, providing traceability from salting → abalone receiving.

### 1.2 Where to make the change

The record definition lives in the database **and** as a static snapshot. Both must be kept in sync:

- **Database:** `RecordFieldDef` table in Neon — add a row for `lotBarcode` in the Job info section of `salting-and-tumbling`.
- **Static snapshot:** `public/data/record-defs/salting-and-tumbling.json` — add the field to `sections[0].fields` (the Job info section array), after `processingFor`.

After updating the DB, run:
```bash
node scripts/export-record-defs.mjs
```
Then commit and push the updated JSON.

If DB access is not available, edit the JSON file directly and commit it.

**Current `sections[0].fields` array** (do not remove any of these):
```jsonc
[
  { "key": "jobNo",         "label": "Job no.",          "type": "jobsearch" },
  { "key": "intakeDate",    "label": "Intake date",       "type": "date" },
  { "key": "harvestFarm",   "label": "Harvest farm",      "type": "text" },
  { "key": "jiIntakeWeight","label": "Whole weight (kg)", "type": "text", "readOnly": true },
  { "key": "date",          "label": "Date",              "type": "date", "required": true },
  { "key": "processingFor", "label": "Processing for",    "type": "select",
    "options": ["Can","Dried","Other"], "matchJobRoute": "jobNo" },
  // ← ADD HERE:
  { "key": "lotBarcode",    "label": "Lot barcode",       "type": "text" }
]
```

### 1.3 HTML changes — `REC-7.1.3-salting-and-tumbling.html`

Add `barcode-scan.js` and the `BarcodeScan.attach` call before `</body>`:

```html
<script src="../lib/barcode-scan.js?v=2"></script>
<script>
BarcodeScan.attach('fr_f_lotBarcode', {
  label: 'Scan lot',
  title: 'Scan the lot barcode',
  readonly: true,
  okText: function (v) { return 'Lot barcode ' + v + ' recorded for this job.'; }
});
</script>
```

No duplicate-barcode check is needed here — a barcode can legitimately appear on multiple salting batches split from one lot.

### 1.4 Behaviour

- **Administrator only.** `barcode-scan.js` enforces this via `BarcodeScan.allowed()`. Non-administrators see no field.
- A "📷 Scan lot" button appears beside the lot barcode input for administrators.
- The field is read-only; value is filled by scan (or the "Or type it" fallback in the scanner modal).
- No blocking validation — informational/traceability only.

---

## Part 2 — Roster row UX fixes

### 2.1 Overview

Three targeted changes to how the salting batch roster row renders. All are CSS/render tweaks inside `public/lib/form-record.js`, scoped to this roster via a new opt-in flag. No data, no field keys, no PDF output changes.

**New flag on the roster definition** (add to the `roster` object in `salting-and-tumbling.json`):
```jsonc
"compactSizeRange": true
```

This flag switches on all three changes described below for that roster.

---

### 2.2 Change 1 — Size range selector: compact width

The size range dropdown (`sizeRange`) currently stretches to match the full column width. Make it compact — just wide enough to show the selected value without wasted space.

**Target CSS on the size range `<select>` when `compactSizeRange: true`:**
```css
.fr-roster-col-sizeRange select {
  width: auto;          /* shrink to content */
  min-width: 90px;
  max-width: 130px;
  font-size: 13px;
  padding: 4px 6px;
}
```

The options are short strings like `"100-150g"` — 90–130px is plenty. This keeps the row narrow on a tablet so the weight fields have more horizontal room.

---

### 2.3 Change 2 — Weight/number fields: match job info field sizing

All numeric fields in the roster row (`noOfCrates`, `shuckWeight`, `saltKg`, `saltPercentUsed`, `bakingSodaKg`, `sugarKg`, `sugarPercentUsed`) must look and feel identical to the job info section inputs — same height, same font size, same padding, same border style.

**The job info fields currently use** the engine's standard `.fr-field input` style. Apply that same class (or duplicate its rules) to the roster number inputs when `compactSizeRange: true`:

```css
/* Roster number inputs — match job info field style */
.fr-roster[data-compact] input[type="number"] {
  height: var(--fr-field-height, 40px);
  font-size: var(--fr-field-font, 15px);
  padding: var(--fr-field-pad, 8px 10px);
  border: 1px solid var(--fr-border, #ccc);
  border-radius: var(--fr-radius, 6px);
  width: 90px;           /* fixed width — enough for a 5-digit weight */
  box-sizing: border-box;
  text-align: right;
}
```

> **Note:** Add `inputmode="decimal"` as an HTML attribute on every number `<input>` in this roster so mobile keyboards open the numeric pad automatically.

Text fields (`saltBatchCode`, `bakingSodaBatchCode`, `sugarBatchCode`) also receive the standard `.fr-field input` height and padding.

**Attach the `data-compact` attribute** to the roster's wrapper element when the flag is active:
```js
// in the roster render function, when roster.compactSizeRange is true:
rosterEl.setAttribute('data-compact', '1');
```

---

### 2.4 Change 3 — "Add weight" button: inline, next to weight(kg) field, submit-button style

The "Add weight" action (which saves/adds the current roster row) must sit **immediately to the right of the `shuckWeight` (Shuck weight kg) input**, on the same line, with no line break between them.

Style it identically to the form's existing primary submit button — same background colour, same height, same font size, same border-radius, same padding. It is an inline-flex element, not a block/full-width element.

**Layout target:**
```
[ Shuck weight (kg) ___90px___ ]  [ Add weight ]  ← same row, no wrap
```

**CSS:**
```css
.fr-roster[data-compact] .fr-roster-add-btn {
  display: inline-flex;
  align-items: center;
  height: var(--fr-field-height, 40px);       /* same height as the weight input */
  padding: 0 16px;
  font-size: var(--fr-field-font, 15px);
  background: var(--fr-submit-bg, #a0763a);   /* same colour as submit button */
  color: var(--fr-submit-text, #fff);
  border: none;
  border-radius: var(--fr-radius, 6px);
  cursor: pointer;
  white-space: nowrap;
  margin-left: 8px;
}
.fr-roster[data-compact] .fr-roster-add-btn:hover {
  opacity: 0.88;
}
```

**Label:** keep as `Add weight` — no text change, only position and style.

**Placement:** render the button inside the same flex/grid cell as `shuckWeight`, or in an adjacent cell with `display: flex; align-items: center` so they stay on one line. Do not put it in its own full-width row.

---

### 2.5 Version bump

After any change to `form-record.js`, bump `?v=N` by 1 in every HTML file that references it:
```bash
grep -rl "form-record.js" public/records/
```

---

## Files to change (summary)

| File | Change |
|------|--------|
| `public/data/record-defs/salting-and-tumbling.json` | Add `lotBarcode` field to Job info; add `"compactSizeRange": true` to roster object |
| `public/records/REC-7.1.3-salting-and-tumbling.html` | Add `barcode-scan.js` script tag + `BarcodeScan.attach` call |
| `public/lib/form-record.js` | Add `compactSizeRange` render path (compact select, job-info-matched inputs, inline Add button); add CSS; bump version |
| All HTML files referencing `form-record.js` | Bump `?v=N` query param |
| DB (`RecordFieldDef` via Neon console) | Add `lotBarcode` field row for the Job info section of `salting-and-tumbling` |

---

## What does NOT change

- Job info section — layout and all existing fields unchanged (except the new `lotBarcode` at the bottom).
- Size range options — the dropdown options list is unchanged; only the rendered width of the element is reduced.
- Weight field data / keys / validation — unchanged; only the visual size matches job info fields.
- Print / PDF output — unchanged. `compactSizeRange` flag affects screen render only.
- Any other record — `compactSizeRange` is opt-in; no other record uses it.

---

## Testing checklist

1. **Barcode hidden for non-admin:** Log in as a standard user → "Lot barcode" field not visible.
2. **Barcode scan for admin:** Log in as Administrator → "📷 Scan lot" button visible → tap → scanner modal opens → type fallback value → field filled read-only.
3. **Size range compact:** Open a salting batch roster row → size range dropdown is narrow (≤ 130px), not stretched.
4. **Weight fields match job info:** Compare `shuckWeight` input height, font size and border to a job info text field — they should be visually identical.
5. **"Add weight" inline:** The Add weight button sits to the right of the shuck weight input on the same line, not on its own row. Its background colour and height match the form's submit button.
6. **`inputmode` on mobile:** Open on a phone/tablet — tapping a number field opens the numeric/decimal keyboard.
7. **Desktop unchanged:** On a non-compact roster (any other record) the existing table render is unaffected.
8. **PDF unchanged:** Export a salting batch PDF — layout and values identical to before.
