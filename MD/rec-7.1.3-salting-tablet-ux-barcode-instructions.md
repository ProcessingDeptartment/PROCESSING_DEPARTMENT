# REC 7.1.3 Salting and Tumbling — Barcode Scan + Tablet Weight UX (Instructions for Claude Code)

**Date:** 2026-10-27  
**Raised by:** Michaela  
**Scope:** Two independent improvements to `REC-7.1.3-salting-and-tumbling.html` and its record definition.

1. **Barcode scan** — add a lot-barcode field with camera scanner (admin-only), matching the pattern already used in REC 7.1.2 Abalone Receiving.  
2. **Tablet weight entry** — redesign the weight and ingredient fields within each salting batch roster row so they are comfortable to use on a tablet. Job info section and size range selector are **not touched**.

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

If DB access is not available, edit the JSON file directly (see current state below) and commit it.

**Current `sections[0].fields` array** (for reference — do not remove any of these):
```jsonc
[
  { "key": "jobNo",         "label": "Job no.",           "type": "jobsearch" },
  { "key": "intakeDate",    "label": "Intake date",        "type": "date" },
  { "key": "harvestFarm",   "label": "Harvest farm",       "type": "text" },
  { "key": "jiIntakeWeight","label": "Whole weight (kg)",  "type": "text", "readOnly": true },
  { "key": "date",          "label": "Date",               "type": "date", "required": true },
  { "key": "processingFor", "label": "Processing for",     "type": "select",
    "options": ["Can","Dried","Other"], "matchJobRoute": "jobNo" },
  // ← ADD HERE:
  { "key": "lotBarcode",    "label": "Lot barcode",        "type": "text" }
]
```

### 1.3 HTML changes — `REC-7.1.3-salting-and-tumbling.html`

Add `barcode-scan.js` and the `BarcodeScan.attach` call, exactly mirroring how REC 7.1.2 does it. Copy these lines from REC 7.1.2 and place them **before** `</body>`:

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

**No** duplicate-barcode check is needed here (unlike receiving). The salting record is downstream — a barcode can legitimately appear on multiple salting jobs if a lot is split across batches.

### 1.4 Behaviour

- **Administrator only.** `barcode-scan.js` already enforces this via `BarcodeScan.allowed()` (checks `Auth.getCurrentRole() === 'ADMINISTRATOR'`). For non-administrator users the field is automatically hidden from view.
- A "📷 Scan lot" button appears beside the lot barcode input for administrators.
- Camera opens; scan fills the field as read-only (operator cannot type a wrong value — must scan or use the "Or type it" fallback inside the scanner modal).
- No blocking validation — the field is informational/traceability; it does not gate submission.

---

## Part 2 — Tablet weight entry redesign

### 2.1 Problem

Inside each salting batch roster row, the numeric weight and ingredient fields are presented as standard narrow `<input type="number">` fields. On a tablet:

- The field is narrow — a tap slightly off-centre misses it.
- The "Add weight" / "Save row" button is labelled with long text that takes up too much space.
- There is no visual separation between the "identity" columns (batch, size range, times) and the "measurement" columns (weights, ingredient amounts) making scanning across a filled row error-prone.

### 2.2 What changes

These changes are to `public/lib/form-record.js` (the shared form engine), gated behind a new per-record-definition flag so no other record is affected.

**New flag on the roster definition (add to `salting-and-tumbling.json` roster object):**
```jsonc
"tabletWeightEntry": true
```

When `tabletWeightEntry: true` is set on a roster, the form engine renders the weight/number fields in that roster using a **large-tap card layout** on touch devices (width ≤ 900px). On non-touch / desktop it falls back to the existing table layout unchanged.

### 2.3 Tablet card layout for weight fields

On a touch device with `tabletWeightEntry: true`, each **roster row** is rendered in two parts:

**A — Identity strip (top):** A compact, read-only strip showing the batch identifier and size range. This is always visible and does not change once the batch is started.

```
[ Batch 1 ]  [ 100–150g ]  [ 08:00 → 09:30 · 90 min ]
```

**B — Weight/ingredient cards (below the strip):** Each numeric field becomes a large card:

```
┌─────────────────────┐   ┌─────────────────────┐
│   Shuck weight      │   │   No. of crates     │
│                     │   │                     │
│      [  48.5  ]     │   │      [   12   ]     │
│         kg          │   │                     │
└─────────────────────┘   └─────────────────────┘
```

- Each card: **minimum 120px wide, minimum 80px tall**.
- The numeric `<input>` inside the card: **full width of the card**, `font-size: 22px`, `text-align: center`, `inputmode="decimal"` (opens numeric keyboard on iOS/Android).
- The unit label (e.g. "kg") is displayed below the input as small grey text — not as a placeholder (placeholder disappears on focus, which is confusing).
- Cards lay out in a **flex-wrap row**, 2–3 per line depending on screen width.

### 2.4 The add-weight / save action

Replace the current long "Add weight" / "Save row" button text with a short icon+label version:

| Current | Replacement |
|---------|-------------|
| `Add weight` | `＋ Add` |
| `Save row` / submit row | `✓ Save` |

- Button minimum height: **52px**.
- Button minimum width: **100px**.
- Font size: **16px**.
- Place the save button at the **bottom of the weight cards area**, full width on narrow screens (≤ 480px), auto-width otherwise.

### 2.5 Specific roster columns affected

The following columns in the salting-and-tumbling roster are in scope for large-tap card rendering:

| Key | Label | Unit label |
|-----|-------|-----------|
| `noOfCrates` | No. of crates | *(none)* |
| `shuckWeight` | Shuck weight | kg |
| `saltKg` | Salt | kg |
| `saltPercentUsed` | Salt % used | % |
| `saltBatchCode` | Salt batch code | *(text, rendered as a standard wide input, not a card — skip card style for text fields)* |
| `bakingSodaKg` | Baking soda | kg |
| `bakingSodaBatchCode` | Baking soda batch code | *(text — standard wide input)* |
| `sugarKg` | Sugar | kg |
| `sugarPercentUsed` | Sugar % used | % |
| `sugarBatchCode` | Sugar batch code | *(text — standard wide input)* |

**Text fields** (`saltBatchCode`, `bakingSodaBatchCode`, `sugarBatchCode`) use a full-width standard `<input type="text">` at 48px height — not the card layout, but still touch-sized.

**Derived / read-only fields** (`standardSaltingTime`, `totalTumblingTime`) are displayed as a label+value pair, not editable — keep them compact and place them in the identity strip (Part A) or as slim read-only tiles.

### 2.6 Implementation approach in `form-record.js`

1. **Detect touch + flag:** In the roster render function, check:
   ```js
   var isTabletWeight = roster.tabletWeightEntry && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
   ```
2. **Render identity strip:** Render `batchId`, `sizeRange`, `startTime`, `finishTime`, `totalTumblingTime`, `standardSaltingTime` as a read-only header bar above the editable fields.
3. **Render weight cards:** For each editable numeric field not in the identity strip, render a `<div class="fr-wcard">` card containing:
   - A `<label>` with the field label
   - An `<input type="number" inputmode="decimal" class="fr-wcard-input">` 
   - An optional `<span class="fr-wcard-unit">` for the unit
4. **Render text fields:** Each batch-code text field gets `class="fr-wcard-text"` — full width, 48px height.
5. **Save button:** Render as `<button class="fr-wcard-save">✓ Save</button>` full-width at the bottom of the card group.

**CSS additions (add to the existing CSS block inside `form-record.js`):**
```css
/* Tablet weight-entry cards */
.fr-wcard-group { display:flex; flex-wrap:wrap; gap:10px; padding:10px 0; }
.fr-wcard { min-width:120px; min-height:80px; background:var(--fr-input-bg,#f8f8f8);
  border:1px solid var(--fr-border,#ccc); border-radius:8px; padding:8px 10px;
  display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; }
.fr-wcard label { font-size:12px; color:var(--fr-label,#666); margin-bottom:4px; white-space:nowrap; }
.fr-wcard-input { width:100%; font-size:22px; text-align:center; border:none; background:transparent;
  padding:4px 0; color:var(--fr-text,#111); }
.fr-wcard-input:focus { outline:2px solid var(--fr-accent,#a0763a); border-radius:4px; }
.fr-wcard-unit { font-size:11px; color:var(--fr-label,#999); margin-top:2px; }
.fr-wcard-text { width:100%; min-height:48px; font-size:16px; padding:10px 12px;
  border:1px solid var(--fr-border,#ccc); border-radius:8px; margin:6px 0; }
.fr-wcard-save { display:block; width:100%; min-height:52px; min-width:100px; font-size:16px;
  background:var(--fr-accent,#a0763a); color:#fff; border:none; border-radius:8px;
  margin-top:12px; cursor:pointer; }
.fr-wcard-id-strip { font-size:13px; color:var(--fr-label,#666); padding:6px 0 2px; border-bottom:1px solid var(--fr-border,#eee); margin-bottom:8px; }
```

### 2.7 Version bump

Every time `form-record.js` changes, bump the `?v=N` in all referencing HTML files:
```bash
grep -rl "form-record.js" public/records/
```
Increment the version number by 1 in each file found.

---

## Files to change (summary)

| File | Change |
|------|--------|
| `public/data/record-defs/salting-and-tumbling.json` | Add `lotBarcode` field to Job info; add `"tabletWeightEntry": true` to roster |
| `public/records/REC-7.1.3-salting-and-tumbling.html` | Add `barcode-scan.js` script tag + `BarcodeScan.attach` call |
| `public/lib/form-record.js` | Add tablet weight-card render path gated on `tabletWeightEntry`; add CSS; bump version |
| All HTML files referencing `form-record.js` | Bump `?v=N` query param |
| DB (`RecordFieldDef` via Neon console) | Add `lotBarcode` field row for the Job info section of `salting-and-tumbling` |

---

## What does NOT change

- Job info section layout and fields (other than the added `lotBarcode`) — leave exactly as is.
- Size range selector within the roster — leave exactly as is.
- All other roster columns (batch ID, start/finish time, derived durations, standard salting time) — data unchanged; only their visual presentation differs on touch devices.
- Print / PDF output — no change. The `tabletWeightEntry` layout is screen-only; print uses the existing table render.
- Validation rules, field keys, DB column names — no change.
- Any other record — `tabletWeightEntry` is an opt-in flag; no other record has it.

---

## Testing checklist

1. **Barcode field hidden for non-admin:** Log in as a standard user; open REC 7.1.3; confirm "Lot barcode" field is not visible.
2. **Barcode scan for admin:** Log in as Administrator; open REC 7.1.3; confirm "📷 Scan lot" button appears beside the Lot barcode field; tap it; camera modal opens; type a value in the fallback box; confirm field is filled read-only.
3. **Tablet layout on touch device:** Open REC 7.1.3 on a tablet or Chrome DevTools touch emulation at ≤ 900px; confirm weight fields render as large cards; confirm text batch-code fields render as full-width inputs; confirm "✓ Save" button is present and at least 52px tall.
4. **Desktop unchanged:** Open on a desktop non-touch browser; confirm the existing roster table renders exactly as before — no card layout.
5. **PDF unchanged:** Print / export a salting batch PDF; confirm layout and all field values are identical to before.
6. **Job info unchanged:** Confirm the Job info section (job no., intake date, harvest farm, etc.) is visually and functionally identical to before, except for the new Lot barcode field appearing at the bottom.
7. **Size range unchanged:** Confirm the size range selector in the roster row still works as before.
