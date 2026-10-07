# Trolley Barcode — Dry Process Data Capture Instructions
**Processing System · Abagold**  
Date: 2026-10-07

---

## 1. Concept

After cooking, product is hung onto trolleys. The moment a trolley is full it receives a barcode label. From that point, every stage the trolley passes through is captured by scanning that barcode — the operator scans, the system prompts for the data relevant to that stage, and all data is stored against that barcode in the database.

When an operator opens any record that relates to this trolley, the system pulls everything already captured from the database and pre-fills the record. The operator only enters the new data that belongs to that stage — nothing already known is re-typed.

---

## 2. Trolley Barcode — What It Holds

The barcode is the key. The database holds all the data. The label printed on the trolley shows:

```
┌──────────────────────────────────┐
│ ████████████████████████████████ │  ← Code 128 barcode
│ AGA-TR-00047                     │
│ Job:    AG-2026-1042             │
│ Intake: 2026-10-02               │
│ Trolley: 3                       │
│ Whole wt: 142.5 kg               │
│ Cook date: 2026-10-06            │
│ Cook wt:  118.3 kg               │
│ Pre-dry in: 2026-10-07 08:14     │
└──────────────────────────────────┘
```

Format: `AGA-TR-[SEQUENCE]` — e.g. `AGA-TR-00047`

The sequence is tied to the physical label. The trolley number (1, 2, 3…) is the number within the job — not a global unique number.

---

## 3. Data Captured at Each Stage

The barcode accumulates the following data as the trolley moves through the facility. Each row is a scan event written to `scan_events` with `barcode_type = 'trolley'`.

### Stage 1 — Trolley Loaded (at hanging station, after cooking)
Captured when the barcode is generated and printed:

| Field | Source |
|-------|--------|
| Job number | Pulled from the cooking record for this batch |
| Intake date | Pulled from the cooking record |
| Whole weight (pre-cook) | Pulled from the receiving record |
| Cooking date | Pulled from the cooking record |
| Cooked weight | Entered by operator at this point |
| Trolley number | Entered by operator (1, 2, 3… within this job) |

The system auto-generates the barcode ID and prints the label via Bartender.

### Stage 2 — Pre-Drying Room Entry
Captured when operator scans the trolley barcode at the pre-dry room entrance:

| Field | Source |
|-------|--------|
| Timestamp (pre-dry room entry) | **Automatic — the scan itself is the timestamp** |
| Operator | Operator passkey |
| Pre-dry room number | Entered or selected (if multiple pre-dry rooms) |

No manual date/time entry. The act of scanning = the time recorded.

### Stage 3 — Out of Pre-Drying / Into Steamer
Captured when trolley leaves pre-dry and enters the steamer:

| Field | Source |
|-------|--------|
| Timestamp out of pre-dry | Automatic on scan |
| Pre-dry duration | Calculated automatically (Stage 3 timestamp − Stage 2 timestamp) |
| Steamer number | Entered or selected |
| Operator | Operator passkey |
| Any steamer record details | Entered at this point per steamer record requirements |

### Stage 4 — Out of Steamer / Into Drying Room
Captured when trolley moves from steamer to drying room:

| Field | Source |
|-------|--------|
| Timestamp into drying room | Automatic on scan |
| Drying room number | Entered or selected |
| Operator | Operator passkey |
| Post-steam weight (if weighed) | Entered by operator |

### Stage 5 — Quality Checks During Drying (repeating)
Can be scanned multiple times during the drying period. Each scan adds one quality check entry:

| Field | Source |
|-------|--------|
| Timestamp of check | Automatic on scan |
| Operator | Operator passkey |
| Check details | Per quality check record requirements (moisture %, visual, etc.) |

Multiple quality checks are stored as separate scan events — the same stage name, multiple rows. All are visible in the trolley's history.

### Stage 6 — Room Movements (if trolley changes rooms)
If a trolley moves between drying rooms during the process:

| Field | Source |
|-------|--------|
| Timestamp out of room | Automatic on scan |
| Previous room | Known from last Stage 4/6 scan |
| New room number | Entered or selected |
| Operator | Operator passkey |

Every room movement is recorded — building a complete location history.

### Stage 7 — Out of Drying Rooms (drying complete)
Captured when the trolley is removed from the drying room at completion:

| Field | Source |
|-------|--------|
| Timestamp out of drying | Automatic on scan |
| Final dry weight | Entered by operator |
| Total drying duration | Calculated automatically |
| Operator | Operator passkey |

---

## 4. How the Scan-to-Record Pull Works

This is the key behaviour of the whole system:

### 4.1 Operator opens a record (e.g. the Drying Room record)

The record has a **Scan trolley barcode** field at the top — always focused, always listening for Enter.

### 4.2 Operator scans the trolley barcode

The system calls:
```
GET /api/barcode/AGA-TR-00047
```

Returns everything already captured for this trolley.

### 4.3 Record auto-fills from the database

The record pulls only the fields it needs from what the barcode has already collected:

```
Drying Room Record — auto-filled fields:
  Job number:     AG-2026-1042         ← from Stage 1
  Intake date:    2026-10-02           ← from Stage 1
  Trolley number: 3                    ← from Stage 1
  Cooked weight:  118.3 kg             ← from Stage 1
  Pre-dry in:     2026-10-07 08:14     ← from Stage 2
  Into dry room:  2026-10-07 14:32     ← from Stage 4
  Drying room:    Room 2               ← from Stage 4

Operator enters only:
  Final dry weight: [        ]
  Quality notes:    [        ]
```

The operator sees a record that is mostly pre-filled. They add only what is new at this stage.

### 4.4 On submit, the new data is written back to the barcode ledger

The record submission triggers a new `scan_event` row for this trolley — stage `'drying_complete'`, with the final dry weight and any notes. The barcode ledger grows.

---

## 5. Database — Trolley Barcode Type

Add `'trolley'` as a barcode type. The `scan_stage_config` table entries for trolleys:

```sql
INSERT INTO scan_stage_config (barcode_type, stage, label, sort_order) VALUES
  ('trolley', 'trolley_loaded',      'Trolley Loaded (post-cook)',       1),
  ('trolley', 'predry_entry',        'Pre-Drying Room Entry',            2),
  ('trolley', 'predry_exit_steam',   'Out of Pre-Dry / Into Steamer',    3),
  ('trolley', 'steam_exit_dryroom',  'Out of Steamer / Into Dry Room',   4),
  ('trolley', 'quality_check',       'Quality Check (during drying)',     5),
  ('trolley', 'room_movement',       'Room Movement',                    6),
  ('trolley', 'drying_complete',     'Out of Drying Rooms',              7);
```

New stages are added here as the process evolves — no code change needed.

---

## 6. Data Each Scan Event Stores (the `data` JSONB field)

### Stage 1 — trolley_loaded
```json
{
  "job_number": "AG-2026-1042",
  "intake_date": "2026-10-02",
  "whole_weight_kg": 142.5,
  "cooking_date": "2026-10-06",
  "cooked_weight_kg": 118.3,
  "trolley_number": 3,
  "cooking_record_id": 891
}
```

### Stage 2 — predry_entry
```json
{
  "predry_room": "Pre-Dry 1",
  "entry_timestamp": "2026-10-07T08:14:00+02:00"
}
```
*(entry_timestamp = scanned_at from the scan_events row — stored explicitly in data for easy query)*

### Stage 3 — predry_exit_steam
```json
{
  "exit_timestamp": "2026-10-07T11:45:00+02:00",
  "predry_duration_min": 211,
  "steamer_number": "Steamer A"
}
```

### Stage 4 — steam_exit_dryroom
```json
{
  "exit_steam_timestamp": "2026-10-07T13:20:00+02:00",
  "drying_room": "Room 2",
  "entry_dryroom_timestamp": "2026-10-07T13:22:00+02:00",
  "post_steam_weight_kg": 115.8
}
```

### Stage 5 — quality_check
```json
{
  "check_number": 2,
  "moisture_pct": 18.5,
  "visual_notes": "even drying, no clumping",
  "pass": true
}
```

### Stage 6 — room_movement
```json
{
  "from_room": "Room 2",
  "to_room": "Room 4",
  "reason": "Room 2 full"
}
```

### Stage 7 — drying_complete
```json
{
  "final_dry_weight_kg": 84.2,
  "total_drying_hours": 52.3,
  "weight_loss_kg": 34.1,
  "weight_loss_pct": 28.8
}
```

Weight loss % is calculated automatically by the system: `(cooked_weight − final_dry_weight) / cooked_weight × 100`.

---

## 7. Barcode Generation Flow (at the hanging station)

1. Operator completes the cooking stage on a job
2. Operator starts hanging product onto a trolley
3. When trolley is full, operator goes to the terminal and opens **New Trolley**
4. System prompts:
   - Job number (scan or select from active jobs)
   - Trolley number within this job (auto-suggests next: if 2 trolleys already, suggests 3)
   - Cooked weight of this trolley
5. System pulls the rest from the cooking record (whole weight, cooking date, intake date)
6. System generates a new `AGA-TR-XXXXX` barcode ID, assigns it (`status = 'active'`)
7. System sends print job to Bartender — label prints on Argox
8. Operator sticks label on the trolley
9. Stage 1 scan event is written automatically at label generation

---

## 8. Scan Page Behaviour for Trolleys

When `AGA-TR-XXXXX` is scanned on the Scan page, the system shows the trolley's current stage and prompts for the next logical action:

```
┌─────────────────────────────────────────────┐
│  TROLLEY  AGA-TR-00047                      │
│  Job: AG-2026-1042 · Trolley 3              │
│  Status: ACTIVE                             │
│  Current stage: IN DRY ROOM 2               │
│─────────────────────────────────────────────│
│  HISTORY                                    │
│  ✓ Loaded        06 Oct · 118.3 kg cook wt  │
│  ✓ Pre-dry entry 07 Oct 08:14               │
│  ✓ Into steamer  07 Oct 11:45 (211 min)     │
│  ✓ Into Room 2   07 Oct 13:22               │
│  ✓ Quality check 08 Oct 09:00 · 18.5%       │
│─────────────────────────────────────────────│
│  NEXT ACTION                                │
│  [Quality check]  [Room movement]           │
│  [Drying complete]  [Add note]              │
└─────────────────────────────────────────────┘
```

The "Next action" buttons shown are context-aware — based on current stage, only relevant actions are offered. The system never shows "Pre-dry entry" if the trolley is already in a drying room.

---

## 9. Record Pre-fill API

Each record type declares which barcode fields it needs. When a trolley barcode is scanned into a record, the backend compiles those fields from the scan history:

```
GET /api/barcode/AGA-TR-00047/prefill?record=drying_room_record
```

Response:
```json
{
  "job_number":            "AG-2026-1042",
  "intake_date":           "2026-10-02",
  "trolley_number":        3,
  "cooked_weight_kg":      118.3,
  "predry_entry":          "2026-10-07T08:14:00+02:00",
  "drying_room":           "Room 2",
  "drying_room_entry":     "2026-10-07T13:22:00+02:00",
  "latest_quality_check":  { "moisture_pct": 18.5, "checked_at": "2026-10-08T09:00:00+02:00" }
}
```

The record frontend maps these to its fields. Any field not yet captured (because that stage hasn't happened) comes back null and the operator fills it in.

---

## 10. Implementation Notes for Coder

- Trolley barcode type = `'trolley'` — add to prefix routing: `AGA-TR` → trolley
- Stage names are free text — do not enum them. Read from `scan_stage_config` table
- Timestamps: always store in UTC with timezone offset. Display in SAST (UTC+2) in the UI
- Duration calculations (pre-dry duration, total drying hours): calculate server-side from timestamps, store in the JSONB `data` field for easy querying — do not recalculate on every read
- Weight loss %: calculated and stored at Stage 7 submit time, not on every read
- Trolley number within a job: the system tracks `MAX(trolley_number) + 1` from existing assignments for that job number to suggest the next number — operator can override
- Multiple trolleys per job: a job will have many trolley barcodes. All query correctly via `assignment.job_number`
- The prefill endpoint is the key integration point — every existing and future record that relates to the dry process calls this endpoint when a trolley barcode is scanned, instead of having operators re-enter known data
