# Barcode Job Lifecycle & Traceability — Instructions for Claude Code

**Date:** 2026-10-19
**Raised by:** Michaela
**Scope:** Define how a barcode is linked to an intake job at receiving, travels with that job through all processing stages, and splits into multiple child barcodes when the product is divided (e.g. at grading/boxing). This is the backbone of the traceability system.

---

## 1. The concept in plain language

```
INTAKE (rec-7.1.2)
  Scan lot barcode → barcode is linked to this job
        |
        ↓
PROCESSING STAGES (cooking, drying, QC, etc.)
  Scan same barcode at each stage → system logs "this job passed through here"
        |
        ↓
SPLIT POINT (e.g. grading/boxing — rec-7.4.4)
  One job splits into multiple output lots (by size grade, weight, destination)
  Parent barcode → spawns Child barcodes (one per output lot)
  Each child barcode then travels independently from here
        |
        ↓
DOWNSTREAM (packing, cold store, dispatch)
  Scan child barcode → links back to parent job → full chain visible
```

A barcode is never destroyed — only split. The full history of any child barcode traces back through its parent to the original intake lot.

---

## 2. Database schema

Add the following tables to Neon (via Prisma). These sit alongside the existing record tables and do not replace them.

### 2.1 `TraceBarcode` — master barcode registry

```prisma
model TraceBarcode {
  id            Int      @id @default(autoincrement())
  barcodeValue  String   @unique   // the actual scanned string, e.g. "AG-2026-1042" or "FD1234"
  status        String   @default("active")  // active | split | retired
  createdAt     DateTime @default(now())
  createdByUser String?

  // Lineage
  parentId      Int?
  parent        TraceBarcode?  @relation("BarcodeChildren", fields: [parentId], references: [id])
  children      TraceBarcode[] @relation("BarcodeChildren")

  // Links to records
  jobLinks      BarcodeJobLink[]
  stageEvents   BarcodeStageEvent[]
  splitEvents   BarcodeSplitEvent[] @relation("SplitParent")
}
```

### 2.2 `BarcodeJobLink` — links a barcode to a specific record/job

```prisma
model BarcodeJobLink {
  id           Int      @id @default(autoincrement())
  barcodeId    Int
  barcode      TraceBarcode @relation(fields: [barcodeId], references: [id])

  recordKey    String   // e.g. "abalone-received", "cooking-process"
  submissionId String   // the submission ID from the existing records system
  jobNo        String?  // human-readable job number e.g. "AG-2026-1042"
  linkedAt     DateTime @default(now())
  linkedByUser String?
  stage        String   // e.g. "intake", "cooking", "drying", "grading", "packing"
  notes        String?
}
```

### 2.3 `BarcodeStageEvent` — log every scan at every stage

```prisma
model BarcodeStageEvent {
  id           Int      @id @default(autoincrement())
  barcodeId    Int
  barcode      TraceBarcode @relation(fields: [barcodeId], references: [id])

  stage        String   // "intake" | "cooking" | "drying" | "qc" | "grading" | "packing" | "dispatch"
  recordKey    String?
  submissionId String?
  scannedAt    DateTime @default(now())
  scannedByUser String?
  locationNote String?  // optional: which room/line/trolley
  weight       Float?   // weight at this stage if recorded
}
```

### 2.4 `BarcodeSplitEvent` — records when one barcode becomes many

```prisma
model BarcodeSplitEvent {
  id            Int      @id @default(autoincrement())
  parentId      Int
  parent        TraceBarcode @relation("SplitParent", fields: [parentId], references: [id])

  splitAt       DateTime @default(now())
  splitByUser   String?
  splitReason   String   // e.g. "grading-size", "weight-batch", "destination-split"
  recordKey     String?  // the record where the split occurred
  submissionId  String?

  // The child barcodes created are TraceBarcode rows with parentId = this parent
}
```

---

## 3. Barcode lifecycle rules

| State | Meaning | Can be scanned at a stage? | Can be split? |
|-------|---------|--------------------------|---------------|
| `active` | travelling with the job | Yes | Yes |
| `split` | has been divided — children carry the job now | Read-only (history only) | No |
| `retired` | end of life (dispatched, destroyed, lab sample) | Read-only | No |

When a barcode is split:
1. Its status is set to `split`
2. New child `TraceBarcode` rows are created with `parentId` pointing to it
3. A `BarcodeSplitEvent` row is created recording why and where

---

## 4. Stage definitions

Define the stages as a fixed ordered list. This is used to validate scan sequence and display the timeline:

```javascript
// shared constant — add to a config file or the API
const STAGES = [
  { key: 'intake',    label: 'Intake',         recordKey: 'abalone-received' },
  { key: 'cooking',   label: 'Cooking',        recordKey: 'cooking-process' },
  { key: 'drying',    label: 'Drying',         recordKey: 'drying-process' },
  { key: 'qc',        label: 'QC',             recordKey: 'dry-monitoring' },
  { key: 'grading',   label: 'Grading/Boxing', recordKey: 'grading-boxing' },  // SPLIT POINT
  { key: 'packing',   label: 'Packing',        recordKey: null },
  { key: 'dispatch',  label: 'Dispatch',       recordKey: null },
];

const SPLIT_STAGES = ['grading']; // stages where a split is expected/allowed
```

Add or remove stages to match your actual process. The `SPLIT_STAGES` array defines which stage triggers the split UI.

---

## 5. API endpoints

Add these to the existing Express API (`processing-department-api.onrender.com`):

### 5.1 Link barcode to job at intake

```
POST /api/traceability/link
Body: {
  barcodeValue: "FD1234",
  stage: "intake",
  recordKey: "abalone-received",
  submissionId: "sub_abc123",
  jobNo: "AG-2026-1042",
  user: "michaela"
}
Response: { barcodeId: 7, status: "active", message: "Barcode linked to intake job" }
```

- If `barcodeValue` does not exist in `TraceBarcode`, create it first, then link.
- If it already exists and is `active`, just add the link (re-scan is valid — same lot returning through a stage).
- If it is `split`, return an error: "This barcode has been split — scan a child barcode."

### 5.2 Log a stage scan (without full record link)

```
POST /api/traceability/scan
Body: {
  barcodeValue: "FD1234",
  stage: "drying",
  user: "operator",
  locationNote: "Dry room 2",
  weight: 18.5
}
Response: { barcodeId: 7, jobNo: "AG-2026-1042", status: "active", stageHistory: [...] }
```

### 5.3 Split a barcode

```
POST /api/traceability/split
Body: {
  parentBarcodeValue: "FD1234",
  splitReason: "grading-size",
  submissionId: "sub_xyz",
  user: "michaela",
  children: [
    { barcodeValue: "FD1234-A", label: "Grade A 0-50g", weight: 8.2 },
    { barcodeValue: "FD1234-B", label: "Grade B 50-100g", weight: 6.1 },
    { barcodeValue: "FD1234-C", label: "Grade C 100g+", weight: 4.2 }
  ]
}
Response: {
  parentId: 7,
  children: [{ id: 8, barcodeValue: "FD1234-A" }, ...],
  splitEventId: 3
}
```

### 5.4 Get full barcode history (traceability chain)

```
GET /api/traceability/history/:barcodeValue
Response: {
  barcode: { id, value, status },
  parent: { ... } | null,
  children: [ ... ],
  stageEvents: [ { stage, scannedAt, locationNote, weight }, ... ],
  jobLinks: [ { stage, recordKey, submissionId, jobNo, linkedAt }, ... ]
}
```

This endpoint powers the traceability lookup page and the "job so far" panel on any record form.

---

## 6. How this integrates into the record forms

### 6.1 At intake (rec-7.1.2)

After Job Info is confirmed and before the operator starts adding baskets:

1. A **"Link lot barcode"** prompt appears: `[ 📷 Scan lot barcode ]`
2. Operator scans the lot barcode that came with the delivery
3. System calls `POST /api/traceability/link` with `stage: "intake"` and the new submission ID
4. Confirmation: `"Lot FD1234 linked to job AG-2026-1042"`
5. The barcode value is stored on the record (new field: `lotBarcode`) so it's part of the submission

### 6.2 At intermediate stages (cooking, drying, QC)

Add a **"Scan job barcode"** action to the Job Info section gate on each record:

1. Operator opens a new cooking/drying record
2. In the Job Info gate, alongside Job Number: `[ 📷 Scan to look up job ]`
3. Operator scans the lot barcode
4. System calls `GET /api/traceability/history/FD1234` → returns job number, intake date, product
5. Job Info fields auto-fill (same as the existing job lookup)
6. On record submit: system calls `POST /api/traceability/link` with `stage: "cooking"` (or drying, etc.)

This means scanning the barcode at each stage both **auto-fills** the form AND **logs** the stage event — two actions from one scan.

### 6.3 At the split point (grading/boxing — rec-7.4.4)

At the grading/boxing record, after the operator logs the split (different grades/sizes):

1. System detects this is a `SPLIT_STAGE`
2. A **"Generate child barcodes"** panel appears after the grade rows are filled
3. For each output grade/lot, the system proposes a child barcode value: `FD1234-A`, `FD1234-B`, etc.
4. Operator can override the child barcode values (scan existing labels if pre-printed, or accept the generated ones)
5. On submit: system calls `POST /api/traceability/split` — parent becomes `split`, children become `active`
6. Labels print for each child lot (via the existing label printing flow)

---

## 7. Barcode value naming convention

Use a consistent format so barcodes are human-readable and machine-scannable:

```
Intake lot:    FD1234           (farm lot code, as received)
After split:   FD1234-A         (parent lot + grade suffix)
               FD1234-B
               FD1234-C
Re-split:      FD1234-A-1       (if a child lot is further split)
```

- Keep the original farm lot code as the root — this maintains traceability back to the farm/harvest
- Suffixes are single uppercase letters for first split, then numbers for subsequent splits
- Max barcode length: 40 characters (fits all common barcode formats)

---

## 8. Traceability lookup page

Create `public/traceability.html` — a standalone page accessible from the main menu.

Features:
- Scan or type any barcode (parent or child)
- Displays the full chain: parent intake → all stages → split event → all children
- Timeline view: each stage shown as a step with date, operator, weight
- Highlights which child lots are still active vs. dispatched
- Links to the actual submission record for each stage event
- Printable / exportable as PDF for audit

This page uses `GET /api/traceability/history/:barcodeValue`.

---

## 9. Implementation order

| Phase | What | Notes |
|-------|------|-------|
| 1 | DB tables + Prisma migration | `TraceBarcode`, `BarcodeJobLink`, `BarcodeStageEvent`, `BarcodeSplitEvent` |
| 2 | API endpoints (link, scan, history) | Skip split for now |
| 3 | Intake scan (rec-7.1.2) | Pilot — scan at Job Info confirm, store `lotBarcode` |
| 4 | Stage scan on all records | Add scan-to-lookup at Job Info gate |
| 5 | Split logic + child barcode generation | At grading/boxing record |
| 6 | Traceability lookup page | `public/traceability.html` |
| 7 | Label printing for child barcodes | Extend existing label printing |

---

## 10. Key design principles

- **Never delete a barcode** — only change its status. The full audit trail must be preserved.
- **Scanning is additive** — scanning a barcode at a stage adds an event; it does not overwrite previous events.
- **One scan = one action** — a single scan at a stage both identifies the job AND logs the stage event. Operators do not scan twice.
- **Split is explicit** — the system does not auto-split. A human action at the split record triggers it.
- **Child inherits parent history** — querying a child barcode returns the parent's full history too, back to intake.
- **Farm lot code is preserved** — the original farm barcode/lot code is always the root, even after splits.
