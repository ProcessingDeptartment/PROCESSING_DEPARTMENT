# Split Product Description into Medium + Drained Weight Dropdowns

**Task:** Replace the single `productDescription` text field with two dropdown fields:
1. **Medium** — select from: Brine, Braised, Other
2. **Drained Weight** — select from: 80g, 150g, 180g, 213g, 238g

**Date:** 2026-09-17  
**Owner:** Michaela

---

## Context

Currently, the product description field stores combined information as free text (e.g. "Braised"). This change separates two structured attributes that are better represented as controlled dropdowns, improving data consistency and making reports/queries easier to filter and aggregate by medium or weight.

The field appears in multiple places across the system:
- **Cans Produced (REC 7.2.7)** — currently `brineOrBraised` field (which is the real product description field)
- **Production Information NRCS (Canning)** — currently pulls `brineOrBraised` from cans-produced
- **Canning Report** — displays this data in the Can Breakdown table
- Any other records/pages that reference product description

---

## Changes Required

### 1. Database Schema Update (if needed)

**Current state:** `brineOrBraised` on `sub_cans-produced` stores free text  
**New state:** Replace with two separate fields:
- `medium` (select type)
- `drainedWeight` (select type)

**Migration approach:**
- Check if any existing data needs to be preserved — if so, add a data migration script that:
  1. Reads existing `brineOrBraised` values
  2. Attempts to parse/map them to the new fields (e.g. "Braised" → medium="Braised", weight=null)
  3. Backfills the new columns
- If data is minimal or testing only, a fresh schema is acceptable

### 2. Record Definition Update

**File:** `data/record-definitions.json`

Add two new field definitions to `cans-produced`:

```json
{
  "key": "medium",
  "type": "select",
  "label": "Medium",
  "options": [
    { "value": "Brine", "label": "Brine" },
    { "value": "Braised", "label": "Braised" },
    { "value": "Other", "label": "Other" }
  ],
  "required": true
},
{
  "key": "drainedWeight",
  "type": "select",
  "label": "Drained Weight",
  "options": [
    { "value": "80g", "label": "80g" },
    { "value": "150g", "label": "150g" },
    { "value": "180g", "label": "180g" },
    { "value": "213g", "label": "213g" },
    { "value": "238g", "label": "238g" }
  ],
  "required": true
}
```

**Remove or deprecate:** `brineOrBraised` field definition (after verifying nothing else depends on it)

### 3. Form Updates (HTML Records)

**Cans Produced (REC 7.2.7) Record**  
File: `public/records/REC-7.2.7-cans-produced.html` (or similar)

Replace:
```js
{ key: 'brineOrBraised', label: 'Product description', type: 'text' }
```

With:
```js
{ key: 'medium', label: 'Medium', type: 'select' },
{ key: 'drainedWeight', label: 'Drained Weight', type: 'select' }
```

**Production Information NRCS (Canning)**  
File: `public/records/Production-Information-NRCS-(Canning)-production-information-nrcs.html`

If the roster currently maps `brineOrBraised`:
```js
{ key: 'productDescription', label: 'Product description', type: 'text', fillMap: { productDescription: 'brineOrBraised' } }
```

Update to:
```js
{ key: 'medium', label: 'Medium', type: 'select', fillMap: { medium: 'medium' } },
{ key: 'drainedWeight', label: 'Drained Weight', type: 'select', fillMap: { drainedWeight: 'drainedWeight' } }
```

### 4. Reports & Display Updates

**Canning Report**  
File: `public/pages/canning-report.html`

Update the Can Breakdown table or any display that currently shows `brineOrBraised` to show both:
- A "Medium" column displaying the `medium` field value
- A "Drained Weight" column displaying the `drainedWeight` field value

Or, if a single "Product description" column is preferred for display, concatenate them (e.g. "Braised 213g").

---

## Testing Checklist

- [ ] Open the Cans Produced form and confirm both dropdowns appear with the correct options
- [ ] Create/edit a Cans Produced record and save both fields — confirm data persists
- [ ] Open a Production Information NRCS (Canning) record and add a production codes roster row
- [ ] Confirm the picked cans-produced record correctly fills in both `medium` and `drainedWeight` on the roster row
- [ ] Open the Canning Report and confirm it displays the new fields (either as separate columns or combined in a "Product description" display column)
- [ ] Run a filter/search on the Canning Report by medium or weight — confirm it works correctly
- [ ] Re-open a saved record and confirm both fields retain their values
- [ ] Export/print a report and confirm the new fields appear correctly

---

## Rollout Notes

- **No downtime required** — schema change is additive, existing records can be backfilled offline
- **Backward compatibility:** If older records still reference `brineOrBraised`, keep it as a deprecated field temporarily and add a note in form instructions to use the new fields instead
- **Data cleanup:** After new data has been entered for a cycle, consider a one-time cleanup script to migrate any remaining old-format data

---

## Open Questions (to confirm with Michaela)

1. Should existing `brineOrBraised` data be migrated/mapped to the new fields, or is this a fresh-start field structure?
2. If a "Product description" display is needed for reports, should it show "Braised 213g" (concatenated) or two separate columns?
3. Are there any other records or pages that currently depend on `brineOrBraised` that need updating?
