# Barcode Scan-to-Log System — Architecture & Instructions
**Processing System · Abagold**  
Date: 2026-10-07

---

## 1. Core Concept

Every barcode in this system is a **persistent ledger identifier**. Scanning it at any point in the facility opens that item's running log and appends a new event — a weight reading, a stage completion, a quality result. The barcode never "closes". It accumulates entries from raw intake through to finished product leaving the building.

This is different from a simple form field auto-fill. The scan triggers a **context-aware action** depending on:
- What type of item was scanned (crate, job sheet, box, room/equipment)
- What stage that item is currently at
- What record page the operator is on (or whether they're on a standalone scan page)

---

## 2. The Four Barcode Types

### Type A — Crate / Basket
Attached to a physical container that moves through the facility.

```
Format:  AGA-CR-[YEAR]-[SEQUENCE]
Example: AGA-CR-2026-00142
```

Lifecycle events logged against a crate:
- Received (weight, product, job number, intake date)
- Blanched / cooked (start time, end time, cook weight)
- Dried (drying room, start weight, end weight, moisture %)
- Graded (size range, quality grade, grading weight)
- Packed (box assigned, pack weight, operator)
- Dispatched (order number, dispatch date)

### Type B — Job / Batch Sheet
Attached to the paper that travels with a production run. One job can have many crates.

```
Format:  AGA-JOB-[YEAR]-[JOB_NUMBER]
Example: AGA-JOB-2026-1042
```

Scanning a job barcode opens the job summary — all crates under it, current stage, total weights.

### Type C — Finished Box
Attached to a sealed box leaving the facility.

```
Format:  AGA-BOX-[YEAR]-[SEQUENCE]
Example: AGA-BOX-2026-00891
```

Lifecycle events logged against a box:
- Packed (contents: crate IDs, product, grade, weight)
- QC inspected (seam check, visual check, pass/fail)
- Dispatched (order, customer, date)

### Type D — Room / Equipment (Fixed)
Permanent barcodes mounted on dry rooms, blanching equipment, grading tables. Scanning one logs activity in that location.

```
Format:  AGA-LOC-[LOCATION_CODE]
Example: AGA-LOC-DRYROOM-01
         AGA-LOC-BLANCH-A
         AGA-LOC-GRADE-TABLE-2
```

Scanning a location barcode opens a "log activity here" prompt — operator enters what they are doing, which job/crate, and the system timestamps and stores it.

---

## 3. Database Design

### 3.1 Core Tables

#### `barcodes` — the master registry
```sql
CREATE TABLE barcodes (
  id              SERIAL PRIMARY KEY,
  barcode_id      TEXT UNIQUE NOT NULL,      -- e.g. AGA-CR-2026-00142
  barcode_type    TEXT NOT NULL,             -- 'crate' | 'job' | 'box' | 'location'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      TEXT,
  status          TEXT DEFAULT 'active',     -- active | retired | voided
  metadata        JSONB DEFAULT '{}'         -- flexible: product, job link, description
);

CREATE INDEX idx_barcodes_type ON barcodes(barcode_type);
```

#### `scan_events` — every scan ever made (the ledger)
```sql
CREATE TABLE scan_events (
  id              SERIAL PRIMARY KEY,
  barcode_id      TEXT NOT NULL REFERENCES barcodes(barcode_id),
  scanned_at      TIMESTAMPTZ DEFAULT NOW(),
  scanned_by      TEXT NOT NULL,             -- operator passkey / name
  location        TEXT,                      -- where the scan happened (location barcode or free text)
  stage           TEXT NOT NULL,             -- 'receiving' | 'blanching' | 'drying' | 'grading' | 'packing' | 'dispatch' | 'inspection' | 'custom'
  action          TEXT NOT NULL,             -- 'stage_start' | 'stage_complete' | 'weight_recorded' | 'quality_recorded' | 'note_added'
  data            JSONB NOT NULL DEFAULT '{}', -- all event-specific fields (weight, grade, notes, etc.)
  record_id       INTEGER,                   -- FK to the specific form record if one was generated
  record_type     TEXT                       -- which record table the record_id points to
);

CREATE INDEX idx_scan_events_barcode ON scan_events(barcode_id);
CREATE INDEX idx_scan_events_stage   ON scan_events(stage);
CREATE INDEX idx_scan_events_date    ON scan_events(scanned_at);
```

#### `barcode_links` — relationships between barcodes
```sql
CREATE TABLE barcode_links (
  id              SERIAL PRIMARY KEY,
  parent_id       TEXT NOT NULL REFERENCES barcodes(barcode_id),
  child_id        TEXT NOT NULL REFERENCES barcodes(barcode_id),
  link_type       TEXT NOT NULL,             -- 'job_contains_crate' | 'crate_packed_into_box' | 'box_in_order'
  linked_at       TIMESTAMPTZ DEFAULT NOW(),
  linked_by       TEXT
);

CREATE INDEX idx_links_parent ON barcode_links(parent_id);
CREATE INDEX idx_links_child  ON barcode_links(child_id);
```

### 3.2 The `data` JSONB Field (scan_events)

This field holds whatever is relevant to that scan. Examples:

```json
// Weight recording
{ "weight_kg": 18.5, "scale_id": "SCALE-01", "notes": "" }

// Stage completion
{ "stage_duration_min": 45, "temperature_c": 95, "operator_note": "normal" }

// Quality / grading result
{ "grade": "A", "size_range": "50-80g", "moisture_pct": 12.3, "defects": "none" }

// QC inspection
{ "seam_check": "pass", "visual": "pass", "vacuum": "ok", "inspector": "MK" }
```

JSONB means you can query these fields for trend analysis without rigid column schemas. New data points can be added at any time without a migration.

---

## 4. Scanning Workflow — How It Works in Practice

### 4.1 Standalone Scan Page

Add a dedicated **Scan** page accessible from the main menu. This is the universal entry point for any handheld scan that isn't part of a specific form.

```
┌─────────────────────────────────┐
│  🔳  SCAN                       │
│                                 │
│  [ ________________________ ]   │
│    Scan or type barcode ID      │
│                                 │
│  Last scanned: AGA-CR-2026-142  │
│  Crate · Receiving · 14:32      │
└─────────────────────────────────┘
```

- The input is always focused and listening for Enter
- When a barcode is scanned (Enter fires), the system looks it up and routes accordingly:
  - **Known crate** → opens Crate Log panel (§4.2)
  - **Known job** → opens Job Summary panel (§4.3)
  - **Known box** → opens Box Log panel
  - **Known location** → opens Location Activity panel (§4.4)
  - **Unknown** → "Barcode not recognised — register it?" prompt

### 4.2 Crate Log Panel (after scanning a crate barcode)

```
┌─────────────────────────────────────────┐
│  CRATE  AGA-CR-2026-142                 │
│  Product: Abalone · Job: AG-2026-1042   │
│  Current stage: DRYING                  │
│─────────────────────────────────────────│
│  EVENT HISTORY                          │
│  ✓ Received     02 Oct · 18.5 kg · MK   │
│  ✓ Blanched     03 Oct · 45 min · JV    │
│  ▶ Drying       04 Oct · started · MK   │
│─────────────────────────────────────────│
│  ADD EVENT                              │
│  [Weight reading]  [Stage complete]     │
│  [Quality result]  [Add note]           │
└─────────────────────────────────────────┘
```

Operator taps the event type they want to add, fills the small form, submits — a new row goes into `scan_events`. They can scan the same crate repeatedly throughout the day to add weight readings at different points.

### 4.3 Scan Within a Record Form

When a barcode is scanned while a form is open (e.g. the drying record), the system:

1. Detects the scan (Enter fires in any focused field)
2. Recognises it as a crate barcode (by prefix `AGA-CR-`)
3. Auto-fills the relevant fields on the form (job number, product, weight from last event)
4. After the form submits, automatically writes a `scan_event` row linking the crate to this record

This means the form and the barcode ledger stay in sync automatically.

### 4.4 Location Barcode — Log Activity at a Station

Mounted barcode at Drying Room 01:

```
┌──────────────────────────────────┐
│  LOCATION  Drying Room 01        │
│─────────────────────────────────-│
│  Current: 3 jobs active          │
│  AG-2026-1042 · AG-2026-1038 ... │
│─────────────────────────────────-│
│  LOG ACTIVITY                    │
│  Operator:  [ __________ ]       │
│  Action:    [Started] [Ended]    │
│             [Checked] [Note]     │
│  Crate/Job: [ __________ ]       │
│  Note:      [ __________ ]       │
│  [Submit]                        │
└──────────────────────────────────┘
```

---

## 5. API Endpoints Required

### 5.1 Barcode Lookup (the universal entry point)
```
GET /api/barcode/:barcodeId
```
Returns: barcode type, metadata, current stage, last 5 events.

### 5.2 Add Scan Event
```
POST /api/barcode/:barcodeId/event
Body: { stage, action, data, scanned_by, location }
```
Appends a new row to `scan_events`. Returns the created event.

### 5.3 Register New Barcode
```
POST /api/barcode/register
Body: { barcode_id, barcode_type, created_by, metadata }
```
Adds to `barcodes` table. Called when an unknown barcode is first scanned.

### 5.4 Barcode History
```
GET /api/barcode/:barcodeId/history
```
Returns all `scan_events` for that barcode in chronological order.

### 5.5 Link Barcodes
```
POST /api/barcode/link
Body: { parent_id, child_id, link_type, linked_by }
```
Stores a relationship (e.g. crate packed into a box).

---

## 6. Label Generation & Printing

### 6.1 When to Generate a Barcode

| Trigger | Who generates | Barcode type |
|---------|--------------|--------------|
| New batch/job created | System auto-generates on job creation | AGA-JOB-... |
| Crates received at intake | Operator registers crate count on receiving record | AGA-CR-... (one per crate) |
| Box packed | Operator confirms pack on packing record | AGA-BOX-... |
| New room/equipment added | Admin one-time setup | AGA-LOC-... |

### 6.2 Label Content (minimum)

```
┌──────────────────────────┐
│ ████████████████████████ │  ← Code 128 barcode
│ AGA-CR-2026-00142        │
│ Product: Abalone         │
│ Job: AG-2026-1042        │
│ Date: 2026-10-02         │
│ Weight: 18.5 kg          │
└──────────────────────────┘
```

### 6.3 Print Flow
1. Record submitted → system generates N barcode records in `barcodes` table
2. Page shows **Print labels** button
3. Opens browser print dialog with label layout
4. Labels print on A4 sheet (multiple per page) or direct label printer

### 6.4 Sequence Number Generation
```sql
-- Auto-increment per type per year, zero-padded to 5 digits
SELECT LPAD(NEXTVAL('crate_seq_2026')::TEXT, 5, '0');
-- Result: 00142
```
Use a separate sequence per type per year (reset annually). Store in Postgres sequences.

---

## 7. Trend Analysis Queries

Because all events are in `scan_events` with JSONB data, you can query across the whole history.

### Weight loss through drying (per crate)
```sql
SELECT
  b.barcode_id,
  MAX(CASE WHEN e.stage = 'receiving' THEN (e.data->>'weight_kg')::numeric END) AS wet_weight,
  MAX(CASE WHEN e.stage = 'drying' AND e.action = 'stage_complete' THEN (e.data->>'weight_kg')::numeric END) AS dry_weight,
  ROUND(
    (1 - MAX(CASE WHEN e.action = 'stage_complete' THEN (e.data->>'weight_kg')::numeric END)
       / NULLIF(MAX(CASE WHEN e.stage = 'receiving' THEN (e.data->>'weight_kg')::numeric END), 0)) * 100, 1
  ) AS weight_loss_pct
FROM barcodes b
JOIN scan_events e ON e.barcode_id = b.barcode_id
WHERE b.barcode_type = 'crate'
GROUP BY b.barcode_id;
```

### Average drying time by job
```sql
SELECT
  e_start.data->>'job_number' AS job,
  AVG(EXTRACT(EPOCH FROM (e_end.scanned_at - e_start.scanned_at))/3600) AS avg_hours
FROM scan_events e_start
JOIN scan_events e_end ON e_end.barcode_id = e_start.barcode_id
WHERE e_start.stage = 'drying' AND e_start.action = 'stage_start'
  AND e_end.stage   = 'drying' AND e_end.action   = 'stage_complete'
GROUP BY job;
```

### Grade distribution by month
```sql
SELECT
  DATE_TRUNC('month', scanned_at) AS month,
  data->>'grade' AS grade,
  COUNT(*) AS crate_count
FROM scan_events
WHERE stage = 'grading' AND action = 'quality_recorded'
GROUP BY 1, 2
ORDER BY 1, 2;
```

---

## 8. Implementation Plan

### Phase 1 — Foundation (do first)
- [ ] Create `barcodes`, `scan_events`, `barcode_links` tables in Neon
- [ ] Create barcode sequences (one per type per year)
- [ ] Build `/api/barcode/:id` lookup endpoint
- [ ] Build `/api/barcode/:id/event` POST endpoint
- [ ] Build standalone **Scan page** with the always-focused input + router

### Phase 2 — Crate lifecycle
- [ ] Crate barcode generation on receiving record submit
- [ ] Crate label print view
- [ ] Crate Log panel (history + add event UI)
- [ ] Wire drying, grading, packing records to auto-write scan events on submit

### Phase 3 — Job & Box barcodes
- [ ] Job barcode generation on job creation
- [ ] Job summary panel (linked crates, progress)
- [ ] Box barcode generation on packing record submit
- [ ] Box log panel

### Phase 4 — Location barcodes
- [ ] Admin setup page for location barcodes
- [ ] Location activity log panel
- [ ] Print location barcode stickers

### Phase 5 — Analytics dashboard
- [ ] Weight loss trends
- [ ] Stage throughput by period
- [ ] Grade distribution over time
- [ ] Export to CSV for all scan events

---

## 9. Design Rules for Scan Input on Every Page

Apply these rules to every input that may receive a barcode scan via handheld scanner:

1. **Always focused** — the primary scan input on any page must be focused on load and re-focused after every successful scan
2. **Auto-select on focus** — `input.select()` on focus so a second scan overwrites cleanly
3. **Enter triggers action** — `keydown` Enter = same as tapping the primary action button; never require a mouse click to complete a scan
4. **Prefix routing** — the system reads the first 6 characters of any scanned value to determine type:
   - `AGA-CR` → crate
   - `AGA-JO` → job
   - `AGA-BO` → box
   - `AGA-LO` → location
   - anything else → unknown barcode prompt
5. **Visual confirmation** — after every scan, show a brief toast (1.5 sec) confirming what was scanned and what action was taken
6. **No modal blocking** — never block the scan input behind a modal that requires mouse interaction to dismiss; keep the operator in a continuous scan flow
7. **Offline tolerance** — if the network is momentarily unavailable, queue the scan event locally and sync when connection returns (localStorage queue, max 50 events)

---

## 10. Portability (Moving Off Neon)

The `scan_events` table with JSONB is the most important export. Keep this exportable at all times:

```sql
-- Full export
COPY scan_events TO '/tmp/scan_events_export.csv' WITH CSV HEADER;

-- Or via the app's export endpoint
GET /api/export/scan-events?from=2026-01-01&to=2026-12-31
```

The system must provide a **Database export** page in admin settings that exports all tables as CSV or JSON. This means moving to any other platform (Supabase, PlanetScale, self-hosted Postgres, etc.) is always possible by re-importing the CSVs.
