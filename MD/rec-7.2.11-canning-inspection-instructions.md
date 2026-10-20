# REC 7.2.11 — Canning Inspection Record

**Record Type:** Canning QC (cpr, 3cp only)  
**Data Model:** One job per PDF; multiple cans tested per job  
**Key Feature:** Multi-can workflow with simultaneous entry and dynamic validation

---

## Overview

REC 7.2.11 is a quality inspection record for canned products (CPR and 3CP only). One record = one job number. Within that job, operators test multiple cans and record measurements (dimensions, weights) and visual checks (appearance, odour, texture, taste, etc.) in transposed table format (measurements as rows, cans as columns).

The form must support parallel can entry: users should not be forced to complete all data for Can 1 before starting Can 2.

---

## Database Schema

### Product Data Table (`ProductData`)

This is the **single source of truth** for all product information: product codes, descriptions, and quality specifications. One row per product variant.

```
ProductData table:

- id: integer, primary key
- agCode: text, unique (AG production code, e.g., "CPR001")
- productDescription: text (e.g., "Tomato Paste 400ml")
- canSize: text (e.g., "400ml", "825ml")
- containerType: text (e.g., "tin", "glass jar")
- nettWeightMin: number (grams, minimum allowable)
- drainWeightMin: number (grams, minimum allowable)
- phMin: number (minimum allowable)
- brixMin: number (minimum allowable)
- saltMin: number (minimum allowable)
- notes: text (optional, e.g., "For salting or canning")
- createdAt: timestamp
- updatedAt: timestamp
```

**Example data:**

| agCode | productDescription | canSize | containerType | nettWeightMin | drainWeightMin | phMin | brixMin | saltMin |
|---|---|---|---|---|---|---|---|---|
| CPR001 | Tomato Paste | 400ml | tin | 350 | 200 | 3.5 | 5.0 | 0.5 |
| CPR002 | Peach Halves | 825ml | tin | 700 | 400 | 3.2 | 12.0 | 0.2 |
| 3CP001 | Mixed Vegetables | 600ml | glass jar | 500 | 280 | 4.0 | 2.0 | 1.0 |

This table is **centrally editable** via admin UI or direct DB access, and all changes flow automatically to forms that reference it.

---

## Record-level fields (Job info section)

```
RecordFieldDef entries:

- recordKey: "canning-inspection" (new)
- sectionId: "job-info" (new section)

- fieldKey: "jobNo"
  - label: "Job Number"
  - type: "text"
  - readOnly: true
  - pullFrom: "JobMaster.jobNo" (auto-populated from URL param)

- fieldKey: "dateOfProduction"
  - label: "Date of Production"
  - type: "date"
  - required: true

- fieldKey: "productionCode"
  - label: "Production Code (AG Code)"
  - type: "dropdown"
  - required: true
  - source: "ProductData.agCode" (must relate to job)
  - pullsInto: ["productDescription"]

- fieldKey: "productDescription"
  - label: "Product Description"
  - type: "dropdown"
  - required: true
  - source: "ProductData.productDescription"
  - depends: "productionCode"
  - pullsSpec: ["nettWeightMin", "drainWeightMin", "phMin", "brixMin", "saltMin"]
```

---

## Measurements Table Layout (TRANSPOSED)

**Rows = Measurement types | Columns = Cans (Can 1, Can 2, Can 3, etc.)**

```
Measurement          | Can 1           | Can 2           | Can 3           | ...
---------------------|-----------------|-----------------|-----------------|----
Can Contents         | 6 pieces        | mince           | 8 pieces        | ...
Nett Weight Min      | 350             | 350             | 350             | ...  (read-only spec)
Nett Weight Measured | 348 [NC badge]  | 352             | 351             | ...  (user entry)
Drain Weight Min     | 200             | 200             | 200             | ...  (read-only spec)
Drain Weight Measured| 195 [NC badge]  | 198             | 202             | ...  (user entry)
Ingo Weight (g)      | 12              | 10              | 14              | ...  (optional)
Vacuum (kPa)         | 8.5             | 8.2             | 8.7             | ...  (optional)
```

**Key points:**
- **Rows** = each measurement type (Can Contents, Nett Weight Min/Measured, Drain Weight Min/Measured, etc.)
- **Columns** = each can being tested (Can 1, Can 2, Can 3, etc.)
- **Spec minimums** appear as read-only rows (greyed out, from ProductData)
- **Measured values** appear directly below specs for easy visual comparison
- **NC badges** appear inline on measured values when they fall below spec
- Users can add new can columns dynamically

---

## Water Reading Section (Single, Record-level)

**Before Measurements table:**

Display current ProductData specs (for reference only, read-only display):
```
**Product Specs (from ProductData):**
- pH Min: 3.5
- Brix Min: 5.0
- Salt Min: 0.5

**Water Reading (measured once per job):**
- pH Min (spec):     3.5
- pH Measured:       [3.6 or 3.4 → triggers NC if below]
- Brix Min (spec):   5.0
- Brix Measured:     [7.2 or 3.8 → triggers NC if below]
- Salt Min (spec):   0.5
- Salt Measured:     [0.8 or 0.3 → triggers NC if below]
```

---

## Visual Checks Table (TRANSPOSED)

**Rows = Visual check types | Columns = Cans (Can 1, Can 2, Can 3, etc.)**

```
Visual Check        | Can 1           | Can 2           | Can 3           | ...
--------------------|-----------------|-----------------|-----------------|----
Appearance          | [text + image]  | [text + image]  | [text + image]  | ...
Odours              | [text]          | [text]          | [text]          | ...
Texture/Consistency | [text]          | [text]          | [text]          | ...
Taste of Product    | [text]          | [text]          | [text]          | ...
General Comments    | [text + image]  | [text + image]  | [text + image]  | ...
```

---

## Implementation Checklist

### Database setup (Neon)
- [ ] Create `ProductData` table with schema shown above
- [ ] Populate `ProductData` with all product variants (agCode, description, sizes, specs)
- [ ] Create `RecordDefinition` row: recordKey = "canning-inspection"
- [ ] Create `RecordSectionDef` rows (job-info, product-specs, measurements, water-reading, visual-checks)
- [ ] Create `RecordFieldDef` rows (all job-info fields, water reading fields)
- [ ] Create `RosterColumnDef` rows for transposed tables (measurements-transposed, visualchecks-transposed)
- [ ] Run `node scripts/export-record-defs.mjs` → generate `public/data/record-defs/canning-inspection.json`

### Frontend setup
- [ ] Create `public/records/REC-7.2.11.html` shell
- [ ] Add script tags for form-record.js with correct `?v=N` version
- [ ] Ensure form-record.js supports:
  - [ ] **Transposed table rendering** (rows = measurement types, columns = cans)
  - [ ] **Dynamic can column addition** ("+ Add Can" creates new column)
  - [ ] **Dynamic can column deletion**
  - [ ] Read-only spec rows displayed above/below measured value rows
  - [ ] Multi-row rosters (visual-checks as transposed rows)
  - [ ] Inline image upload with central archive integration
  - [ ] Dynamic validation rules pulled from ProductData at runtime
  - [ ] NC auto-trigger on spec violation

### Validation & testing
- [ ] Test agCode → productDescription autofill chain
- [ ] Test ProductData specs display in reference section
- [ ] Test transposed layout renders correctly (cans as columns, measurements as rows)
- [ ] Test nett weight < min → NC triggered
- [ ] Test drain weight < min → NC triggered
- [ ] Test pH/brix/salt below min → NC triggered
- [ ] Test image upload in appearance & general comments cells
- [ ] Test PDF print (transposed layout preserved, all specs and measured values visible)
- [ ] Test on tablet (primary entry device)

---

## Notes

- **Only CPR and 3CP jobs** allowed; filter for cans only (cpr, 3cp)
- **ProductData is the single source of truth** for all product information and specs
- **Transposed layout** (rows = measurement types, columns = cans) allows side-by-side comparison
- **Spec minimums and measured values paired** in adjacent rows for easy visual validation
- **Parallel can entry**: users enter Can 1, 2, 3 in parallel columns
- **NC comment field** pre-populated with can # and spec violation but editable
- **Measured values** are what operators type in; no upper limits enforced
- **Water reading** (pH, brix, salt) is **once per job**, not per-can
