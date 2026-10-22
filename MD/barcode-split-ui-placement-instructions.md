# Barcode Split UI Placement — Instructions

**Date:** 2026-10-20 (Updated: Drying split + QC/Dry Monitoring barcode handling)  
**Raised by:** Michaela  
**Scope:** Define exactly where the barcode split option appears on each record form in the processing system. Shows the UI flow, placement, timing, and user interaction patterns at each stage.

---

## Overview: Where barcode split appears

```
INTAKE (rec-7.1.2)
  └─ "Link lot barcode" prompt
     (creates parent barcode) — Always

COOKING (rec-7.4.0)
  └─ "Scan job barcode" in Job Info gate
     (logs stage event, no split) — Always. Note: this can change in future.

DRYING (rec-7.4.1) ← SPLIT POINT #1 (batch split by room/trolley)
  └─ "Generate batch splits" panel — Always
     (creates batch splits by drying room / trolley)
     Batch splits by trolley. If job is moved to another room then all child
     barcodes move. Not needed to scan child by child — it is a "bulk"
     instruction for the job.

DRY MONITORING / QC (rec-7.4.2) ← BARCODE CHECKPOINT
  └─ "Scan parent or child barcode" in Job Info gate
     (logs stage event for whichever barcode is scanned)
     NOTE: Grading split is AFTER trolley split, so trolley split barcodes
     are what 7.4.2 works with.

DRIED ABALONE TRANSFER (rec-7.4.10)
  All trolley child barcodes will be scanned in. Once ALL barcodes scanned
  in, that becomes the parent barcode info again at this stage.

GRADING PRODUCTION LOG (rec-7.4.3.1 / 7.4.3.2)
  Job number search or scan. This record is only useful if the Dried Abalone
  Transfer record (7.4.10) is complete — put a SOFT LOCK on this record so
  it is only accessible once 7.4.10 has been submitted.
  The job number / parent barcode is now the full batch.
  Each bin has a barcode that identifies and pulls previous data of bin end
  at previous grade end. This provides the bin size range and the start kg.
  The user must still click confirm kg. Then logic set for +box as per
  rec-7.4.3-grading-log-updates-instructions.md.
  Once a full box is complete, that box will also get a barcode. This barcode
  must be scanned and locked per box. Info kept: packing date, quality check
  pass, job numbers in box, and more to be determined.

GRADING/BOXING (rec-7.4.4) ← SPLIT POINT #2 (barcode split by grade)
  └─ "Generate child barcodes" panel
     (creates child barcodes from parent by grade)
     NOTE: This record is currently a read-only report — split logic here
     is still to be confirmed.

PACKING, DISPATCH
  └─ "Scan product barcode"
     (logs stage event for child barcodes)
     Records between grading and packing still need work.
```

---

## 1. At Intake (rec-7.1.2 — Abalone Received)

### Location: After Job Info section, before Basket entry rows

```
┌─────────────────────────────────────────┐
│ ABALONE RECEIVED                        │
├─────────────────────────────────────────┤
│ JOB INFO (collapsible section)          │
│ ┌─────────────────────────────────────┐ │
│ │ Job No: AG-2026-1042              │ │
│ │ Date: 2026-10-19                  │ │
│ │ Received from: Farm XYZ           │ │
│ │ [✓ Job info confirmed]            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ *** NEW SECTION: BARCODE LINKING ***    │
│ ┌─────────────────────────────────────┐ │
│ │ LINK LOT BARCODE                  │ │
│ │ Scan the lot barcode that came    │ │
│ │ with this delivery:               │ │
│ │ [ 📷 Scan barcode or type ]       │ │
│ │ ✓ Lot FD1234 linked to job        │ │
│ │ [Barcode: FD1234]                 │ │
│ │ [Status: active]                  │ │
│ │ [First scan at: 2026-10-19 09:15] │ │
│ └─────────────────────────────────────┘ │
│ BASKET ENTRY (repeated rows)            │
│ [SAVE & SUBMIT]                         │
└─────────────────────────────────────────┘
```

### Interaction flow

- Operator fills Job Info and confirms
- New section appears: "LINK LOT BARCODE"
- Operator scans the lot barcode (or types it manually)
- System calls `POST /api/traceability/link` with `stage: "intake"`
- Confirmation shows: ✓ Lot FD1234 linked to job, status, first scan timestamp
- On submit: barcode linked to submission, batch created in background

### Key UI notes

- Input method: scan OR type manually
- `lotBarcode` saved with the record
- Batch created automatically on submit

---

## 2. At Cooking (rec-7.4.0)

### Location: Job Info section gate (top of form)

```
┌──────────────────────────────────────────┐
│ COOKING PROCESS (rec-7.4.0)              │
├──────────────────────────────────────────┤
│ JOB INFO (gate — must fill to proceed)   │
│ ┌────────────────────────────────────┐   │
│ │ Look up job by number or barcode: │   │
│ │ [ Job No: AG-2026-1042 ]  OR      │   │
│ │ [ 📷 Scan parent barcode ]        │   │
│ │ ┌────────────────────────────┐    │   │
│ │ │ Lookup Results:            │    │   │
│ │ │ Job: AG-2026-1042          │    │   │
│ │ │ Barcode: FD1234            │    │   │
│ │ │ Status: active             │    │   │
│ │ │ Last stage: intake         │    │   │
│ │ │ Weight at last stage: 45.2kg   │   │
│ │ └────────────────────────────┘    │   │
│ │ [✓ Confirm — proceed to cooking] │   │
│ └────────────────────────────────┘   │
│ COOKING DETAILS                          │
│ [SAVE & SUBMIT]                          │
└──────────────────────────────────────────┘
```

### Interaction flow

- Two lookup methods: Job Number OR barcode scan
- Scan triggers auto-fill of all job info
- Shows last known weight for verification
- On submit: logs stage event, logs weight checkpoint

### Key UI notes

- No split option here — intermediate processing only
- Shows barcode status (active/split) — important for operator awareness

---

## 3. At Drying (rec-7.4.1) ← SPLIT POINT #1

### Location: After trolley count and movements are logged, before submit

```
┌──────────────────────────────────────────────────┐
│ DRYING PROCESS (rec-7.4.1)                       │
├──────────────────────────────────────────────────┤
│ JOB INFO (gate)                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ [✓ Job confirmed: AG-2026-1042]             │ │
│ │ [📷 Scan barcode: FD1234 — active]          │ │
│ │ [Input weight: 45.1 kg]                     │ │
│ └──────────────────────────────────────────────┘ │
│ DRYING ENTRY                                     │
│ ┌──────────────────────────────────────────────┐ │
│ │ No. of trolleys: [ 20 ]                     │ │
│ │ Dry room location: [ Room 2 ]               │ │
│ │ Humidity: [ 35 ] %                          │ │
│ └──────────────────────────────────────────────┘ │
│ *** SPLIT BATCH BY ROOM/TROLLEY GROUP ***        │
│ ┌──────────────────────────────────────────────┐ │
│ │ [ ✓ No split — all in one room ]            │ │
│ │ [ ✎ Split by room/trolley ]                 │ │
│ │ If enabled:                                  │ │
│ │   Batch 1 (Room 2, Trolleys 1–10): [ 22.5 ] kg │
│ │   Batch 2 (Room 2, Trolleys 11–20): [ 22.6 ] kg│
│ │   Waste/Loss: [ 0 ] kg                      │ │
│ │   [Reconciliation OK] [Review]              │ │
│ └──────────────────────────────────────────────┘ │
│ [SAVE & SUBMIT]                                  │
└──────────────────────────────────────────────────┘
```

### Interaction flow

- Optional split: default is "No split — all in one room"
- If splitting: enter weight distribution, system reconciles
- On submit: logs stage event; if split chosen, calls `POST /api/batch/:id/split`

### Why drying needs a split

- A lot may move between rooms for environmental reasons
- Splits across trolley zones for loss tracking per room
- Timeline tracking (which room dried faster)
- Audit trail (if product lost, which room was it in)

### New data fields

```json
batchSplitEnabled: Boolean
childBatches: [
  { room: "Room 2", trolleys: "1-10", batchKey: "...", weight: 22.5 },
  { room: "Room 2", trolleys: "11-20", batchKey: "...", weight: 22.6 }
]
varianceApproved: Boolean
```

---

## 4. At Dry Monitoring / QC (rec-7.4.2) ← BARCODE CHECKPOINT

### Location: Job Info section gate (top of form)

```
┌──────────────────────────────────────────────────┐
│ DRY MONITORING / QC (rec-7.4.2)                  │
├──────────────────────────────────────────────────┤
│ JOB INFO (gate — must fill to proceed)           │
│ ┌──────────────────────────────────────────────┐ │
│ │ [ Job No: AG-2026-1042 ]  OR               │ │
│ │ [ 📷 Scan parent or child barcode ]        │ │
│ │                                             │ │
│ │ IF PARENT BARCODE (FD1234):                │ │
│ │   Status: active (or split)                │ │
│ │   Last stage: drying                       │ │
│ │   Weight at last: 45.1 kg                  │ │
│ │   Split status: Active (not split)         │ │
│ │                                             │ │
│ │ OR IF CHILD BARCODE (FD1234-DRY-R2-T1):   │ │
│ │   Child of: FD1234                         │ │
│ │   Room: Room 2, Trolleys 1–10             │ │
│ │   Last stage: drying                       │ │
│ │   Weight at last: 22.5 kg                  │ │
│ │                                             │ │
│ │ [✓ Confirm — proceed to QC]               │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Key notes

- Grading split is AFTER trolley split — so at 7.4.2 stage, the active barcodes are the drying room/trolley child barcodes (not the grade child barcodes)
- Accepts parent OR trolley-child barcode
- Shows different info depending on what was scanned
- No split option — only logs stage event

### New data fields

```json
jobBarcodeScanned: String
barcodeType: "parent" | "child"
childBarcodeInfo: {
  barcodeValue: "FD1234-DRY-R2-T1",
  type: "child",
  room: "Room 2",
  trolleys: "1-10",
  parentBarcode: "FD1234",
  weight: 22.5
}
```

---

## 5. At Dried Abalone Transfer (rec-7.4.10)

**All trolley child barcodes must be scanned in.** Once ALL barcodes for a job are scanned in, the system re-consolidates them and the parent barcode becomes the active identifier again at this stage.

- Scanning all child barcodes confirms the full lot has been transferred
- After all scanned: parent barcode is reactivated as the batch identifier going into grading
- This is the consolidation step before grading begins

---

## 6. At Grading Production Log (rec-7.4.3.1 / 7.4.3.2)

### Soft lock requirement

This record must be **soft-locked** — it should only be accessible / submittable once the Dried Abalone Transfer record (rec-7.4.10) has been submitted for that job number. Display a warning or disable the form if 7.4.10 is not complete.

### Job lookup

- Job number search OR scan the parent barcode (now reactivated after 7.4.10)
- The job number / parent barcode represents the full consolidated batch

### Bin barcode scan

Each physical grading bin has a permanent barcode label. When scanned:

1. System looks up the last entry for that bin code (across all grading records)
2. Pulls: size grade range linked to that bin + `finalBinWeight` from last entry
3. Pre-populates:
   - `sizeGrade` ← from bin code lookup
   - `binWeightStart` ← last `finalBinWeight` for this bin
4. User must still click **Confirm kg** to verify weight on scale
5. Then follows box-full logic per `rec-7.4.3-grading-log-updates-instructions.md`

### Box barcodes

Once a full box is completed, that box receives its own barcode. This barcode must be:
- Scanned and confirmed at box completion
- Locked (read-only) after confirmation
- Stored with: packing date, quality check pass/fail, job numbers in box, and further fields TBD

---

## 7. At Grading/Boxing (rec-7.4.4) ← SPLIT POINT #2

> **Note:** This record is currently a read-only report. The split logic below is the intended design but implementation details are still to be confirmed.

### Location: After grade/size rows are filled, before submit

Generates child barcodes per grade (e.g. FD1234-A, FD1234-B, FD1234-C). Proposed barcodes shown; operator can scan pre-printed label to override.

Reconciliation check runs automatically:
- Input weight vs. sum of grade outputs + waste
- Variance warning if tolerance exceeded
- [ 👁 Review & explain ] or [ ✓ Approve variance ] actions

### New data fields

```json
parentLotBarcode: String
childBarcodes: [
  { grade: "A", barcodeValue: "FD1234-A", weight: 18.5 },
  { grade: "B", barcodeValue: "FD1234-B", weight: 15.2 },
  { grade: "C", barcodeValue: "FD1234-C", weight: 8.1 }
]
varianceDetected: Boolean
varianceApproved: Boolean
varianceReason: String
```

---

## 8. At Packing & Dispatch (rec-7.4.5, rec-7.4.6)

Scan child barcode (grade-based). Shows full lineage back to farm. No split option — child barcodes cannot be split at packing.

On submit: logs stage event for child barcode. At dispatch: marks lot as dispatched.

---

## 9. Summary table

| Record | Section | When appears | What happens |
|--------|---------|--------------|--------------|
| rec-7.1.2 Intake | After Job Info | Always | Creates parent barcode |
| rec-7.4.0 Cooking | Job Info gate | On scan/search | Logs stage event |
| rec-7.4.1 Drying | After movements | Optional toggle | **Split by room/trolley** |
| rec-7.4.2 QC/Monitoring | Job Info gate | On scan/search | Logs stage (parent OR trolley-child) |
| rec-7.4.10 Transfer | Scan panel | Per trolley child | Re-consolidates to parent |
| rec-7.4.3 Grading | Job Info gate + bin scan | Soft-locked until 7.4.10 done | Bin lookup, box barcodes |
| rec-7.4.4 Grading/Boxing | After grade weights | Auto-appears | **Split by grade**, child barcodes |
| rec-7.4.5 Packing | Job Info gate | On child scan | Logs stage event |
| rec-7.4.6 Dispatch | Job Info gate | On child scan | Logs stage, marks dispatched |

---

## 10. Reusable UI patterns

### Pattern 1: Barcode scan input

```
[ 📷 Scan barcode or type ]
[________________]
```
- Accepts alphanumeric, hyphens, underscores
- On scan: triggers immediate lookup

### Pattern 2: Barcode status badge

```
✓ Lot FD1234 linked to job
[Status: active | split | retired]
[First scan at: 2026-10-19 09:15]
```

### Pattern 3: Reconciliation warning

```
⚠ Variance: 0.4 kg detected. Approve or adjust.
Input: 45.2 kg | Output: 44.8 kg | Waste: 0 kg
Tolerance: 0.1 kg
[ 👁 Review & explain ] [ ✓ Approve variance ]
```

### Pattern 4: Child barcode row (in split panel)

```
Child barcode 1:
  Grade: A (0–50g) | Weight: 18.5 kg
  Proposed barcode: FD1234-A
  [ 📷 Scan or override ] [input: FD1234-A] [Clear]
```

---

## 11. Edge cases

### Scan a split barcode at QC

```
⚠ WARNING: This barcode has been split
FD1234 was split into: FD1234-A, FD1234-B, FD1234-C
Do you want to log QC for all grades, or scan a specific child barcode?
[ 📋 View split details ] [ FD1234-A ] [ FD1234-B ] [ FD1234-C ]
```

### Scan an already-split barcode at grading

```
⚠ ERROR: This barcode has already been split
FD1234 was split into: FD1234-A, FD1234-B, FD1234-C (on 2026-10-20 10:00)
You cannot split an already-split barcode.
```
→ Reject scan, show error.

### Barcode mismatch (wrong job)

```
⚠ WARNING: Barcode mismatch
Current job: AG-2026-1042
Scanned barcode (FD1234) is linked to: AG-2026-1043
[ × Cancel ] [ ✓ Continue anyway ]
```

### Child barcode scanned as job number

If a child barcode is scanned or entered in the job number field, the system must recognise it as a child barcode and display a pop-up:

```
"This barcode is a child of parent barcode [FD1234] which is job number [AG-2026-1042].
Do you want to use this job number?"
[ × Cancel ] [ ✓ Yes, use this job ]
```

---

## 12. Current known errors / issues to fix

1. **Barcode re-use across stages**: A barcode scanned as a basket number in Abalone Receiving (rec-7.1.2) remains open and has been used for a dry trolley in a later stage. A barcode should be tied to its stage context — once used as a lot/batch barcode, it must not be re-usable as a basket identifier, and vice versa.

2. **Child barcode recognised as job number**: If a child barcode is entered in the job number field, the system should detect that it is a child barcode, not a job number, and prompt the user (see edge case above).

3. **Grading split context**: The grading (by grade) split happens AFTER the trolley split. Therefore at rec-7.4.2 (Dry Monitoring/QC), the active child barcodes are trolley-based child barcodes, not grade-based. Ensure the system correctly identifies which generation of child barcodes is active at each stage.

4. **Barcode batch trace**: Full barcode-to-batch trace path still to be verified end-to-end.

---

## 13. Related documents

- `MD/barcode-job-lifecycle-traceability-instructions.md` — technical barcode system details
- `MD/rec-7.4.3-grading-log-updates-instructions.md` — bin barcode, box logic, grading rules
- `MD/batch-traceability-any-batch-instructions.md` — weight reconciliation alongside splits
