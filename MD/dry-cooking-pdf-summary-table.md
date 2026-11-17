# Task: Add PDF summary table to REC 7.4.0 Dry Cooking

## What to add

After the **Job info** section in `dry-cooking.json`, add a new section that renders as a summary table in the PDF. It should appear immediately below Job info.

The table must show four values:

| Field | Label | Source |
|-------|-------|--------|
| `ooswKg` | OOSW (kg) | Already exists — read-only autofill from `salting-oosw` |
| `ooswPct` | OOSW % | New derived field — `ooswKg / jiIntakeWeight * 100`, rounded to 1 decimal place |
| `cookedWeightKg` | Cooked weight (kg) | New input field — user enters total cooked weight after all pots |
| `cookingDate` | Cooking date | Already exists — `recordDate: true`, date of submission |

---

## Changes required

### 1. `public/data/record-defs/dry-cooking.json`

#### Add `cookedWeightKg` to Job info section fields

```json
{
  "key": "cookedWeightKg",
  "label": "Cooked weight (kg)",
  "type": "number",
  "unit": "kg"
}
```

#### Add `ooswPct` derived field to Job info section fields

```json
{
  "key": "ooswPct",
  "label": "OOSW %",
  "type": "number",
  "readOnly": true,
  "deriveFormula": {
    "expr": "ooswKg / jiIntakeWeight * 100",
    "round": 1
  }
}
```

If `deriveFormula` is not yet supported in `form-record.js`, it must be added (see section 2 below).

#### Add a new section after "Job info"

Insert as the second entry in the `sections` array (index 1, right after Job info):

```json
{
  "title": "Summary",
  "printSummaryTable": true,
  "fields": [
    { "key": "ooswKg",         "label": "OOSW (kg)" },
    { "key": "ooswPct",        "label": "OOSW %" },
    { "key": "cookedWeightKg", "label": "Cooked weight (kg)" },
    { "key": "cookingDate",    "label": "Cooking date" }
  ]
}
```

---

### 2. `public/lib/form-record.js`

Two additions needed:

**A. `printSummaryTable` section support**

When a section has `printSummaryTable: true`:
- **Screen:** render as a compact read-only display panel (label/value pairs), or hide with a print-only class.
- **PDF/print:** render as a horizontal table — one column per field, header row of labels, data row of values. Border and slightly shaded header, consistent with existing print styles in `record-theme.css`.

**B. `deriveFormula` field support**

When a field has `deriveFormula: { expr, round }`:
- Evaluate the arithmetic expression against current record field values.
- Update reactively whenever any referenced field key changes.
- Round result to `round` decimal places.

---

### 3. Version bump

After editing `form-record.js`, bump `?v=N` by 1 in every referencing HTML file:

```bash
grep -rl "form-record.js" public/records/
```

---

### 4. Commit

Commit together:
- `public/data/record-defs/dry-cooking.json`
- `public/lib/form-record.js`
- All updated `public/records/REC *.html` files

No DB export script needed — the JSON is edited directly.

---

## Notes

- `ooswKg` and `cookingDate` already exist in Job info fields. Do **not** add them again there — only reference them in the new Summary section.
- `jiIntakeWeight` is the whole weight field used as the denominator for OOSW %.
- `cookingDate` has `recordDate: true` — it auto-sets to today's date on form creation/submission.
- The Summary section is primarily for the PDF printout. On screen it can be a subtle read-only panel or hidden entirely.
