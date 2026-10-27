# REC 7.4.3 Grading Log — Fixes & Logic Confirmation

**Files changed:** `public/data/record-defs/grading-production-log-cultivated.json` + `grading-production-log-ranched.json`  
**Applies to:** REC 7.4.3.1 (Cultivated) and REC 7.4.3.2 (Ranched)

---

## Changes made

### 1. Dried weight received (with strings) — restored to read-only

`driedWeightReceived` had `readOnly: true` removed by mistake. Re-added.  
This field carries over from the dry process record and must not be manually edited.

### 2. Grading date — auto-fills, no manual entry needed

`gradingDate` now has `readOnly: true` and `defaultToday: true`.  
It auto-populates with today's date when the record is opened. The user does not fill it in — it reflects the date the record is completed.

### 3. Collection bin barcode — restored

`binCode` column now has `barcode: true`.  
The bin code (e.g. `17g-20g-3`) renders as a scannable barcode on each bin card.  
This was previously working and had been lost from the column definition.

### 4. "Size grade weights (kg)" → renamed "Grading summary" + collapsed by default

The section that shows per-grade totals is now:
- Title: **Grading summary**
- `collapsible: true` — user can open/close it
- `collapsedByDefault: true` — starts collapsed; user taps to expand

---

## Page logic confirmation

The record flow is:

```
Job info (collapsible, auto-fills from receiving record)
  └─ jobNo search → pulls intakeDate, farm, processingFor, intakeWeight (all read-only)

Batch details
  └─ driedWeightReceived (read-only, from dry process)
  └─ actualDriedWeight (user enters — no strings)
  └─ dateIntoGradingRoom (user enters)
  └─ gradingDate (auto = today, read-only)

Collection bins roster (fixedGroups by size grade)
  └─ Bin cards per grade — binCode generated + barcoded
  └─ binWeightStart (carries forward from previous day's finalBinWeight)
  └─ startConfirmed → unlocks box weights + finalBinWeight
  └─ gradedWeight = (fullBoxWeights + finalBinWeight) − binWeightStart

Grading summary (collapsed by default, opens on tap)
  └─ Per-grade totals summed from roster gradedWeight

Totals (collapsed by default)
  └─ actualGradedWeight = sum of all gradedWeight
  └─ yield % = actualGradedWeight / actualDriedWeight
```

This logic is correct. The `fixedGroups` mechanism groups bins by `sizeGrade` and sequences `binNo` within each grade across both cultivated and ranched records on the same `gradingDate`.

---

## Deploy

Push `public/data/record-defs/grading-production-log-cultivated.json` and `grading-production-log-ranched.json` to `main`. Render auto-deploys within ~30s. No form-record.js change — no version bump needed.
