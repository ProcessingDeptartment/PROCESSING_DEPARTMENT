# REC 7.4.10 — Add Summary Table (Abalone Transfer)

## Task

Add a summary table section to the **7.4.10 Abalone Transfer** record definition. The table must appear **after the standard job info section**.

---

## Summary Table Fields

| # | Label | Field key (suggested) | Notes |
|---|-------|-----------------------|-------|
| 1 | Dried date | `driedDate` | Date field |
| 2 | Cooking date | `cookingDate` | Date field |
| 3 | OOSW % | `ooswPercent` | Numeric / percentage |
| 4 | Cooked weight (%) | `cookedWeightPercent` | Numeric / percentage |

---

## Implementation Steps

### 1. Add a new section in the DB

Insert a row into `RecordSectionDef` for the `abalone-transfer` record:

- `title`: `"Summary"`
- `position`: one after the job info section (check existing positions first)
- `cols`: `2` (or `4` if all fields should sit in one row)
- `extraJson`: `{}` (no special flags needed unless a specific layout flag applies)

### 2. Add fields to `RecordFieldDef`

Insert four rows linked to the new section, in order:

| label | key | type | position |
|-------|-----|------|----------|
| Dried date | `driedDate` | `date` | 0 |
| Cooking date | `cookingDate` | `date` | 1 |
| OOSW % | `ooswPercent` | `number` | 2 |
| Cooked weight (%) | `cookedWeightPercent` | `number` | 3 |

Add `suffix: "%"` in `extraJson` for the two percentage fields if the form engine supports it; otherwise include it in the label.

### 3. Export and commit

```bash
node scripts/export-record-defs.mjs
```

Commit and push the updated `public/data/record-defs/abalone-transfer.json` (or whatever the `recordKey` is — confirm in the DB).

### 4. Verify

Open the form in the browser, hard-refresh (`Ctrl+Shift+R`), and confirm the Summary section appears after Job Info with all four fields.

---

## Notes

- Confirm the exact `recordKey` for 7.4.10 in `RecordDefinition` before running the export.
- If the section should be **collapsible**, add `"collapsible": true` to `extraJson`.
- No changes to `form-record.js` are needed — this is purely a record definition change.
