# REC 7.4.0 Dry Cooking — Barcode Scan & Job Search Fix Instructions

**File:** `public/data/record-defs/dry-cooking.json`  
**Record:** REC 7.4.0 Dry Cooking

---

## Problem

The `jobNo` field is currently `"type":"jobnumber"` — a plain number entry with prefix validation. A barcode scan has been added to the form, but if the scan does not happen, the user is left with a manual text/number input. It should fall back to a **search function** (typeahead job search), not a bare input field.

---

## Fix 1 — Job number field: scan OR search, never bare input

### Rule
The job number entry must support **two paths**:
1. **Barcode scan** → scans the job barcode label, resolves the job number, and triggers autofill of job info.
2. **No scan / scan fails** → falls back to a **search field** (`type: "jobsearch"`) that lets the user type and select from existing job records.

Under no circumstances should the fallback be a plain text or number input.

### Change required in `dry-cooking.json`

Find this field in the `sections[0].fields` array:

```json
{
  "key": "jobNo",
  "label": "Job number",
  "type": "jobnumber",
  "required": true,
  "prefixes": ["DPR", "3DP"]
}
```

Change to:

```json
{
  "key": "jobNo",
  "label": "Job number",
  "type": "jobsearch",
  "required": true,
  "route": "Dried",
  "barcodeField": true
}
```

- `"type": "jobsearch"` — renders as a search-and-select field; the user types a job number or name and picks from matching records.
- `"route": "Dried"` — filters the job search to dried-route jobs (same as the grading records).
- `"barcodeField": true` — flags this field as the barcode scan target so the scan-to-fill logic resolves into this field first, then triggers autofill.

> If `form-record.js` uses a different flag name for barcode targeting (e.g. `"barcodeScan": true` or `"scannable": true`), use that existing flag instead of `"barcodeField"`. Check current usage in `form-record.js` and the grading records for the correct property name.

---

## Fix 2 — Autofill still fires on both paths

The existing `autofill` block watches `jobNo` and fills `intakeDate`, `harvestFarm`, `jiIntakeWeight`, `jiProcessingFor` from `abalone-receiving`. This is correct and must remain in place — it fires regardless of whether the job number was scanned or searched.

No change needed to the `autofill` array.

---

## Also applies to — REC 7.4.3 Grading Production Log

The same two-path rule applies to the grading records:

- `grading-production-log-cultivated.json` (REC 7.4.3.1)
- `grading-production-log-ranched.json` (REC 7.4.3.2)

These already use `"type": "jobsearch"` for `jobNo`, which is correct. Ensure `"barcodeField": true` (or the equivalent flag) is also present on these fields so the barcode scan resolves into the job search field and triggers autofill.

---

## Bin barcode scan — separate from job barcode (REC 7.4.3)

This is distinct from the job number barcode. In the grading records, a second scan is used to identify which **physical bin** is being worked:

- The worker scans the **bin barcode** (e.g. `Under 8g-1`).
- The system looks up the last recorded `finalBinWeight` for that bin code.
- It pre-populates `binWeightStart` with that value and sets `sizeGrade` from the bin's linked grade range.
- The bin barcode does **not** need to be typed or searched — it is scan-only (the bin code is a physical label that never changes).

This is separate logic from the job number entry and must not be conflated with the job barcode scan.

### How the bin scan should work

1. User scans bin barcode → resolves `binCode` (e.g. `Under 8g-1`).
2. System queries the grading submissions DB for the most recent entry for that `binCode` (across both cultivated and ranched records, today's date).
3. From that entry, reads `finalBinWeight` and the linked `sizeGrade`.
4. Pre-populates the new bin row:
   - `sizeGrade` ← from bin code lookup
   - `binWeightStart` ← `finalBinWeight` from last entry for this bin
5. The `startConfirmed` field still requires the worker to verify the scale reading before proceeding.

The bin barcode scan **shows the user what it found** before they confirm — i.e. display: "Bin: Under 8g-1 | Last final weight: 3.42 kg" — so they can verify it is correct.

---

## Deployment steps

1. Edit `dry-cooking.json`: change `jobNo` field from `"type":"jobnumber"` to `"type":"jobsearch"` with `"route":"Dried"` and the barcode flag.
2. Verify `form-record.js` handles `type: "jobsearch"` with a `barcodeField` flag — check existing grading record behaviour as the reference.
3. Commit and push `dry-cooking.json`.
4. Bump `?v=N` in `public/records/REC-7.4.0.html` (or whichever HTML file references `form-record.js` for this record).
5. Commit and push the HTML file.
6. Test on device: scan job barcode → job info autofills. Without scan: type in search box → select from list → job info autofills.
