# Chiller Temperature Monitoring — Multi-Row Support

## Context

REC 7.9.1 (`chiller-temperature-monitoring.json`) currently captures one chiller unit reading per submission.  
In practice, **all three areas** (Chiller 1, Chiller 2, Freezer) are usually checked in one go, but sometimes only one or two are. The form needs a **repeating-row pattern**: each row captures one unit's reading, and the user can add more rows via a `+` button.

---

## 1 — JSON Record Definition (`public/data/record-defs/chiller-temperature-monitoring.json`)

Replace the current flat `entryFields` approach with a **`rowFields`** structure nested inside a new `repeatingRows` block:

```json
{
  "repeatingRows": {
    "minRows": 1,
    "maxRows": 3,
    "addLabel": "+ Add area",
    "rowLabel": "Area",
    "uniqueKey": "chillerUnit",
    "rowFields": [
      {
        "key": "chillerUnit",
        "label": "Unit",
        "type": "select",
        "options": ["Chiller 1", "Chiller 2", "Freezer"],
        "required": true
      },
      {
        "key": "dialTemp",
        "label": "Dial temp",
        "type": "number",
        "unit": "°C",
        "specKey": "chillerTemp"
      },
      {
        "key": "productTemp",
        "label": "Product temp",
        "type": "number",
        "unit": "°C",
        "specKey": "chillerTemp"
      },
      {
        "key": "correctiveAction",
        "label": "Corrective action",
        "type": "textarea",
        "conditional": { "field": "productTemp", "outOfSpec": true }
      }
    ]
  },
  "entryFields": [
    {
      "key": "productCovered",
      "label": "Product covered",
      "type": "yesno"
    }
  ]
}
```

**Key rules:**
- `uniqueKey: "chillerUnit"` — the UI should prevent the same unit being selected in two rows in one submission.
- `productCovered` stays as a top-level `entryFields` item (once per submission, not per row).
- `minRows: 1` — at least one row is always required.
- `maxRows: 3` — maximum three rows (one per unit).

---

## 2 — DB Storage

Submissions currently store entry fields as flat JSONB columns (or inside a `data` JSONB column).  
The repeating rows must be stored as a **JSON array** under the key `readings`:

```json
{
  "productCovered": "yes",
  "readings": [
    { "chillerUnit": "Chiller 1", "dialTemp": 4, "productTemp": 5 },
    { "chillerUnit": "Chiller 2", "dialTemp": 3, "productTemp": 4 },
    { "chillerUnit": "Freezer",   "dialTemp": -18, "productTemp": -17 }
  ]
}
```

**Migration:** existing submissions have flat fields (`chillerUnit`, `dialTemp`, `productTemp`, `correctiveAction`). On read, if `readings` is absent but `chillerUnit` is present, **auto-wrap** into a single-element `readings` array so old records display correctly. No schema migration needed — this is handled in the read path only.

---

## 3 — UI Rendering (`src/index.js` — form rendering for `repeatingRows`)

Add support for rendering a `repeatingRows` block in the generic form builder:

### Table layout
Render rows as a table with columns matching `rowFields`:

```
| Unit       | Dial temp | Product temp | Corrective action |
|------------|-----------|--------------|-------------------|
| Chiller 1  | 4 °C      | 5 °C         |                   |  [×]
| [+ Add area]                                              |
```

- Each row has a **remove button [×]** (disabled when only one row remains).
- The **`+ Add area`** button appends a new blank row. Hide the button once `maxRows` is reached.
- If `uniqueKey` is set, grey out already-selected options in the unit dropdown of other rows.
- `correctiveAction` textarea appears inline in the row (can collapse when empty / not out-of-spec).

### Validation
- Each row: `chillerUnit` required, `dialTemp` required, `productTemp` required.
- No duplicate `chillerUnit` values across rows in the same submission.

---

## 4 — NC Threshold Checking (`src/validate-submission.js`)

Currently NC checking references top-level `productTemp`. Update to **iterate over `readings`**:

```js
// For chiller-temperature-monitoring, check each row in readings[]
if (def.repeatingRows) {
  const readings = data.readings || [];
  readings.forEach((row, i) => {
    def.ncThresholds.forEach(threshold => {
      const val = row[threshold.field];
      if (val != null && (val < threshold.min || val > threshold.max)) {
        ncs.push({
          ...threshold,
          rowIndex: i,
          rowLabel: row[def.repeatingRows.uniqueKey] ?? `Row ${i + 1}`,
          value: val
        });
      }
    });
  });
}
```

NC descriptions should include the unit label, e.g.:  
`"Chiller 2 — Product temperature 11°C — outside accepted range 0–10°C."`

---

## 5 — Submission History / View (`src/submission-history.js`, view pages)

When displaying a saved submission:
- Show `productCovered` at the top.
- Render `readings` as a read-only table (same column layout as the form).
- Highlight any out-of-spec rows in amber/red.
- If `correctiveAction` is present in a row, show it below the row or in a collapsed section.

---

## 6 — PDF / Print View

In the PDF render for REC 7.9.1:
- Include a table of all readings (unit, dial temp, product temp, corrective action).
- Each NC row should be visually flagged.

---

## Files to touch

| File | Change |
|---|---|
| `public/data/record-defs/chiller-temperature-monitoring.json` | Add `repeatingRows` block; move row fields out of `entryFields` |
| `src/index.js` | Add `repeatingRows` rendering in form builder |
| `src/validate-submission.js` | Iterate `readings[]` for NC threshold checks |
| `src/submission-history.js` | Render `readings[]` table in history view |
| `src/record-def.js` | Ensure `repeatingRows` schema is tolerated / passed through |
| PDF template for REC 7.9.1 (if separate) | Add readings table |

---

## Backwards compatibility

- Old submissions (flat fields) render correctly via the auto-wrap read path.
- No DB migration required.
- The JSON change is additive — existing `entryFields` for `productCovered` stays in place.
