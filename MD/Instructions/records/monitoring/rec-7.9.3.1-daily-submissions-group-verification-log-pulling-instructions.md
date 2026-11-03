# REC 7.9.3.1 Daily Submissions, Group Verification & Log Pulling — Instructions

**Date:** 2026-10-20  
**Raised by:** Michaela  
**Type:** System architecture — daily submission grouping (per record type), flexible group-level verification, and dynamic log pulling  
**Scope:** Verification workflow, database schema/views, submission grouping logic, log extraction endpoints, PDF print templates  
**Role gate:** Quality roles (Quality Supervisor, QA Manager, Production Manager, Shift Manager, Administrator)  
**Traceability:** Critical — all submissions, verifications, and log pulls must be auditable by day, room, job, and record type.

---

## Executive Summary

**Submission grouping by day, per record type:** All submissions of a **specific record type** (e.g., REC 7.9.3.1) made on a single calendar day are grouped together for verification. On day D, all REC 7.9.3.1 submissions from 00:00 to 23:59 on day D belong to the same group. REC 7.4.2 submissions on the same day are in a separate group. This keeps grouping scoped by record type and date — not system-wide or time-of-day specific.

**Group verification — flexible timing:** An authorized user can verify a day's batch **at any time** — morning, afternoon, evening, or even the next day. Verification is not tied to a specific time-of-day or 24-hour shift boundary. Once a group is verified, the data in that group is marked as verified. **Any new submissions added to the same record type after verification belong to a new, unverified group** for that day (or a new day if submissions come the next calendar day). This allows continuous logging and batch verification without time-based locks.

**PDF with day's logs:** When pulling a record to PDF, the PDF includes a **list of all logs for that day**, organized by room. This list shows which logs were recorded on the day the main record was submitted, and which rooms those logs cover.

**Dynamic log pulling:** When the system needs to pull log data for reporting, dashboards, or other pages, it can request logs by:
- **By job:** Find all logs recorded on the day job X was active, and look up what the logs state for that job's associated room(s).
- **By room and date:** Pull all logs for room Y on date D.
- **By room and date range:** Pull all logs for room Y from date D1 to D2 (useful for trend analysis).

These requests are served via API endpoints that query the log tables by `entry_date` and `room`, returning structured data suitable for display, export, or further calculation.

---

## 1. Database Schema Changes

### 1.1 — Submission grouping (per record type, per day, flexible verification timing)

Every submission record needs a grouping key for the day it was submitted **within its own record type**. Add these fields to every submission table (or to a shared `submissions_base` view):

| Field | Type | Purpose | Constraint |
|---|---|---|---|
| `record_type` | `TEXT` | The record code (e.g., 'REC_7.9.3.1', 'REC_7.4.2') | NOT NULL, indexed as part of composite key |
| `submission_date` | `DATE` | The calendar date the submission was made (00:00 local) | NOT NULL, indexed as part of composite key |
| `submission_group_id` | `UUID` or `TEXT` | Unique identifier for all submissions of this record type on `submission_date` | NOT NULL, indexed, same for all records of same type on same day |
| `verified_group_at` | `TIMESTAMPTZ` | Timestamp when the entire day's group (for this record type) was verified (NULL = unverified) | nullable; set at time of verification, not tied to shift end or time-of-day |

**Rules:**
- `record_type` must be the same for all submissions in a group (e.g., all REC 7.9.3.1, never mixed).
- `submission_date` is derived from the server timestamp at submission time (not user-entered). Use the server's local date in the processing-department timezone (Africa/Johannesburg, UTC+02:00).
- `submission_group_id` is generated once per (record_type, date) pair, same for all submissions matching both. Format: `sub_group_<RECORD>_<YYYY-MM-DD>_<uuid>` or `<RECORD>_<YYYY-MM-DD>_<uuid>`. Must be deterministic within a day and record type.
- `verified_group_at` is set when an authorized user verifies the group — **at any time** (morning, afternoon, evening, next day). All submissions of that record type on that day get the same timestamp. This is **not tied to shift times or the end of a 24-hour period**.
- **Composite key:** `(record_type, submission_date, submission_group_id)` is the unique identifier for a verification group.
- **New submissions after verification:** If a new submission of the same record type is added to the same calendar day *after* the group is verified, it stays part of the same group (same `submission_group_id`, same `submission_date`) but gets `verified_group_at = NULL`. This means a previously verified group can become unverified again if new data is added. **Option A (chosen): simpler, allows resets.**

### 1.2 — Group verification metadata

Create a new table to track group-level verifications, scoped by record type:

```sql
CREATE TABLE IF NOT EXISTS submissions_group_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type TEXT NOT NULL,                 -- e.g., 'REC_7.9.3.1'
  submission_group_id TEXT NOT NULL,
  submission_date DATE NOT NULL,
  verified_by TEXT NOT NULL,                 -- full name
  verified_title TEXT NOT NULL,              -- role label
  verified_signature TEXT NOT NULL,          -- passkey/initials
  verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- timestamp of verification (any time of day)
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_count INT,                          -- how many records in the group at time of verification
  CONSTRAINT uq_group_id UNIQUE (record_type, submission_group_id),
  CONSTRAINT fk_group_id FOREIGN KEY (submission_group_id) REFERENCES ... -- if linked to submissions
);
```

**Rationale:** This table serves as the single source of truth for when a day's batch was verified, scoped by record type. The `verified_at` timestamp is not constrained to specific times and reflects the actual time the user clicked "Verify". It is not required to write verification metadata to every individual submission (though you may choose to do so for backward compatibility); the group verification table is the authoritative log.

### 1.3 — Log tables with automatic timestamps

For REC 7.9.3.1 and any other logging record, ensure every log *line* (not the submission as a whole) has:

| Field | Type | Purpose |
|---|---|---|
| `entry_date` | `DATE` | The calendar date the log line was recorded (automatic, not user-entered) |
| `entry_time` | `TIMESTAMPTZ` | The exact timestamp the log line was recorded |
| `room` | `TEXT` | The location (e.g., 'Dry room', 'Grading room', 'Packaging room') |
| (other fields) | | Temperature, Humidity, etc. |

- `entry_date` and `entry_time` are set by the server at the moment the line is added. They are not editable by users.
- `entry_date` is queryable for date-based grouping (e.g., "all logs from 2026-10-20").
- `entry_time` is used to order logs within a day (earliest first).
- `room` is the identifier for which location the log covers.

---

## 2. Submission Grouping Logic

### 2.1 — When a submission is created

At submission time (when the user clicks "Submit" on the form):

1. **Determine the record type:**
   ```js
   const recordType = 'REC_7.9.3.1';  // from the form/route
   ```

2. **Calculate the submission date:**
   ```js
   const submissionDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in server timezone
   ```

3. **Check for existing group for that record type and date:**
   ```sql
   SELECT submission_group_id FROM <table>
   WHERE record_type = $1 AND submission_date = $2
   LIMIT 1;
   ```
   If a group already exists for that (record_type, date) pair, reuse its ID. If not, generate a new one:
   ```js
   const groupId = `sub_group_${recordType}_${submissionDate}_${uuidv4()}`;
   ```

4. **Write the submission with grouping fields:**
   ```sql
   INSERT INTO <table> (
     ..., record_type, submission_date, submission_group_id, verified_group_at
   ) VALUES (
     ..., $1, $2, $3, NULL
   );
   ```

5. **All submissions of the same record type on the same calendar day get the same `submission_group_id`.** This is deterministic by (record_type, date), not system-wide. The day is based on calendar date, not shift times.

---

## 3. Group Verification Workflow

### 3.1 — Verification page displays by day and record type

The **Awaiting Verification** page groups submissions by `record_type` first, then by `submission_date`.

- Submissions are grouped first by `record_type`, then by `submission_date` (calendar day).
- Each record type has its own "awaiting verification" section.
- Within each record type, submissions are grouped by day.
- Each day shows a count of unverified submissions for that record type.
- A single **"Verify all [N] for [record type] on [date]"** button triggers group verification for that day and record type. **The user can click this at any time** — there is no time-of-day restriction or shift boundary.

### 3.2 — Verification modal (group-level, per record type & day, flexible timing)

When the user clicks "Verify all [N] for REC 7.9.3.1 on Oct 20", a modal appears:

**Fields:**
- **Verified by:** Text input (full name)
- **Title/Role:** Text input or dropdown (role label)
- **Signature/Initials:** Short text (passkey or signature initials)
- **Date verified:** Calendar picker (defaults to today; user can set to any date, even past or future)

**Action:** "Verify all [N] submissions for REC 7.9.3.1 on [date]"

**Passkey check:** Before writing, validate the signature against the existing passkey endpoint. If invalid, reject the entire batch verification.

**Timing:** The verification can happen **at any time** of the day or night. There are no shift-based or time-of-day constraints.

### 3.3 — Writing group verification

On successful modal submission:

1. **Write to the group verification table:**
   ```sql
   INSERT INTO submissions_group_verification (
     record_type, submission_group_id, submission_date, verified_by, verified_title, verified_signature, verified_at, record_count
   ) VALUES (
     $1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7
   )
   ON CONFLICT (record_type, submission_group_id) DO NOTHING;  -- idempotent
   ```

2. **Write verification metadata to each submission in that group:**
   ```sql
   UPDATE <table>
   SET
     verification = jsonb_build_object(
       'verifiedBy', $1,
       'verifiedTitle', $2,
       'verifiedDate', $3,
       'verifiedSignature', $4,
       'verifiedAt', CURRENT_TIMESTAMP,
       'groupVerified', true,
       'groupVerificationId', $5,
       'recordType', $6
     ),
     verified_group_at = CURRENT_TIMESTAMP
   WHERE record_type = $7
     AND submission_group_id = $8
     AND verification IS NULL;
   ```

3. **Audit log:** Record the verification action (who, when, how many records, group ID, record type) for traceability. The `verified_at` timestamp reflects the actual time of verification, not a fixed shift or day boundary.

### 3.4 — Idempotency & post-verification submissions

Group verification must be idempotent: verifying the same group twice with the same or different values should not create duplicate records or cause errors.

**Post-verification submissions (Option A — chosen):** If a new submission of the same record type arrives on the same calendar day *after* the group is verified:
- The new submission gets the same `submission_group_id` and `submission_date` as the earlier group, but `verified_group_at = NULL`.
- This means the group becomes "unverified" and needs re-verification to cover the new data.
- The `record_count` in the verification log reflects the count at time of first verification, not the count after new data arrives.

---

## 4. Pulling Record to PDF with Daily Logs

### 4.1 — PDF includes logs for the day

When a user prints/exports a submission to PDF, the PDF includes a section:

**"Logs for [submission date]"** or **"Room Activity Summary — [date]"**

This section lists all log entries (from REC 7.9.3.1 and similar logging records) recorded on the day the main submission was created, organized by room.

### 4.2 — API endpoints for log pulling

**Endpoint 1:** `GET /api/logs/by-date?date=2026-10-20`  
Returns all logs for that date, organized by room.

**Endpoint 2:** `GET /api/logs/by-job?job_id=ABC123`  
Returns logs for the room(s) associated with a job on that job's working date.

**Endpoint 3:** `GET /api/logs/by-room?room=Dry%20room&date_from=2026-10-14&date_to=2026-10-20`  
Returns logs for a room over a date range (useful for trends).

---

## 5. Traceability & Data Integrity

### 5.1 — Audit trail requirements

Every verification action must be logged:

| Field | Captured | Example |
|---|---|---|
| `action` | "verify_group" | — |
| `record_type` | The record type being verified | "REC_7.9.3.1" |
| `submission_group_id` | From the group | "sub_group_REC_7.9.3.1_2026-10-20_abc123..." |
| `submission_date` | The calendar date of the submissions | "2026-10-20" |
| `verified_by` | From modal | "Quality Supervisor A" |
| `verified_signature` | From modal | "QA01" |
| `verified_at` | Server timestamp at moment of verification | "2026-10-20T14:30:00Z" or "2026-10-21T09:15:00Z" (next day) |
| `record_count` | How many records in the group at time of verification | 5 |
| `user_id` | Logged-in user (may differ from verified_by) | "user_123" |

---

## 6. Implementation Checklist

- [ ] Add `record_type`, `submission_date`, `submission_group_id`, `verified_group_at` fields to submission schema.
- [ ] Create `submissions_group_verification` table with unique constraint on `(record_type, submission_group_id)`.
- [ ] Add `entry_date`, `entry_time` to all logging records (REC 7.9.3.1, etc.).
- [ ] Backfill `record_type` for all existing submissions (from the record definition).
- [ ] Backfill `submission_date` for all existing submissions (use `createdAt` or a specific import date).
- [ ] Backfill `submission_group_id` deterministically for all existing submissions (same group ID for all of same record type on same calendar day).
- [ ] Backfill `entry_date` and `entry_time` for all existing log lines (use `createdAt` or typed Date if available).
- [ ] Update Awaiting Verification page to group by `record_type` then `submission_date` and show "Verify all for [date]" button per record type.
- [ ] Build group verification modal (verifiedBy, title, signature, date) — **no time-of-day constraints**.
- [ ] Write `/api/storage/key/group-verify` endpoint (or adapt existing `/api/storage/key/` PUT) to handle group verification writes, scoped by record type.
- [ ] Add group verification endpoints: `GET /api/logs/by-date`, `GET /api/logs/by-job`, `GET /api/logs/by-room`.
- [ ] Update PDF export template to include "Logs for [submission date]" section.
- [ ] Test group verification with 1, 5, 10+ records of same type; test with invalid passkey; test idempotency.
- [ ] Test log pulling by date, job, and room.
- [ ] Update trend dashboards to use `entry_date`-based queries.
- [ ] Document the new group ID scheme (scoped by record type and date) for operators and support teams.
- [ ] **Test post-verification submissions:** Add new REC 7.9.3.1 to Oct 20 after group is verified. Confirm group becomes unverified (Option A).
- [ ] Run compliance audit: verify all past and current submissions have record types, dates, and group IDs; audit trails for verifications.

---

## 7. Related Documentation

- `claude/rec-7.9.3.1-dry-room-log-field-removal-instructions.md` — Field and merge details for REC 7.9.3.1.
- `MD/admin-bulk-verify-all-records-instructions.md` — Per-record bulk verification (different from group verification).
- `claude/project-core-instructions.md` — Overall system design and database strategy.
- Database schema (`data/record-definitions.json`, Prisma schema files).

---

## Change Log

- **2026-10-20** — Instruction created by Michaela / Claude. Defines daily submission grouping **per record type per day**, group-level verification **scoped by record type and flexible timing (any time of day)**, and dynamic log pulling patterns for PDF, dashboards, and trend analysis. Option A chosen: new submissions after verification stay in the same group and reset the verified flag.
