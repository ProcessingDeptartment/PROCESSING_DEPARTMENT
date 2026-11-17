# Add Summary Table to REC 7.4.1 Drying Process

## Task
Add a read-only summary table to the **Drying Process** record (7.4.1), positioned **after the standard Job Info section** and before the rest of the form.

The table displays four key values pulled from existing fields:

| Column | Source field |
|--------|-------------|
| Cooked weight (kg) | field from job info (check field key — likely `cookedWeight` or similar) |
| Cooking date | field from job info |
| No. of trolleys | `noOfTrolleys` |
| Date into drying room | field from job info or movement block |

---

## Implementation steps

### 1. Identify the exact field keys
Check `public/data/record-defs/drying-process.json` for the precise `name` values of:
- Cooked weight
- Cooking date
- Date into drying room

Use those exact keys in step 2.

### 2. Add a new section to the DB (`RecordSectionDef`)

Insert a new section row for `drying-process` with:
- `title`: `"Summary"`
- `position`: immediately after the Job Info section (bump positions of all subsequent sections by 1 if needed)
- `extraJson`:
```json
{
  "summaryTable": true,
  "summaryTableFields": ["cookedWeight", "cookingDate", "noOfTrolleys", "dateIntoDryingRoom"]
}
```
*(replace field names with the actual keys found in step 1)*

### 3. Implement `summaryTable` rendering in `form-record.js`

In `public/lib/form-record.js`, add handling for `section.summaryTable === true`:

- Render a styled `<table>` with one row of four cells
- Each cell: label on top, value below (pulled from `this.data[fieldKey]`)
- Use existing CSS variables / classes for consistency; style as a compact display-only banner (similar to `trolleyBanner`)
- Table should be **read-only** — no inputs, just displayed values

### 4. Export, bump version, commit

1. Run `node scripts/export-record-defs.mjs`
2. Commit updated `public/data/record-defs/drying-process.json`
3. Bump `?v=N` in `public/records/REC 7.4.1 Drying Process.html` (and any other HTML referencing `form-record.js`)
4. Commit and push to `main`

---

## Notes
- If `summaryTable` section flag approach doesn't suit, an alternative is to add it as a `legacyBlock`-style special section with its own renderer.
- Values should update reactively as the user fills in the job info fields (use the same data-binding pattern as other display-only sections).
