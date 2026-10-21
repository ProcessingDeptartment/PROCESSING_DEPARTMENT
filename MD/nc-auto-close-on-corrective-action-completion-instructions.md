# NC Auto-Close on Corrective Action Completion — Instructions

**Date:** 2026-10-21  
**Raised by:** Michaela  
**Type:** Enhancement to existing NC log system  
**Use in:** Claude Code (build) + backend API  
**Related:** `nc-log-page-instructions.md`, `nc-record-trigger-instructions.md`, `rec-7.4.2-qc-manual-alignment-instructions.md`

---

## 1. Purpose

When a non-conformance (NC) is raised (e.g. dry monitoring checks show Amber/Red/Critical status), the NC log tracks its resolution. Once the operator has taken corrective action and re-performed the check (e.g. re-run dry monitoring checks on trolley 1192, which now shows all points Green/In-spec), the system should automatically detect that the condition has been resolved.

Instead of manually changing the NC status to "Ready to Close" or "Closed", the NC should:
1. Automatically mark as **"Ready to close"** when the resolution condition is met
2. Require only a brief comment on what corrective action was actually taken
3. Be closable with a single click once the comment is added

This removes manual status tracking and ensures traceability by capturing *what* was done to fix the issue.

---

## 2. Design principles

- **Automatic detection, not manual marking.** The system looks at linked records (e.g. re-submitted Dry Monitoring entries) to determine if the original problem is fixed.
- **Condition-based closure.** Each NC knows its trigger condition (e.g. "REC-7.4.2 status ≥ Amber"). When a new submission of the same record shows the issue is resolved (e.g. status = Green), the NC is ready to close.
- **Comment required at close.** The operator must document the actual corrective action taken (e.g. "Replaced fan unit, dry room now stable at 30°C"). This is stored in `corrective_action` and appears on reports and in audit trails.
- **Clear status workflow:**  
  - `open` → initial state when NC is raised
  - `ready_to_close` → system detected resolution condition; awaiting comment + closure
  - `closed` → final state; includes `closed_at`, `closed_by`, and `corrective_action` text
- **Email notification on ready-to-close.** When the system detects resolution (e.g. after the second dry monitoring entry comes in Green), send an alert email: "NC {ref} is ready to close — review and confirm corrective action."

---

## 3. NC status field and database

### 3a. Extend `nc_log` table in Neon

Add these columns if not already present:

```sql
ALTER TABLE "nc_log" ADD COLUMN IF NOT EXISTS
  "status" TEXT DEFAULT 'open',                    -- 'open', 'ready_to_close', 'closed'
  "resolution_check_submitted_id" BIGINT,          -- submission_id of the record that triggered ready_to_close
  "ready_to_close_at" TIMESTAMP,                   -- when system detected resolution
  "ready_to_close_notes" TEXT,                     -- (optional) system note on detection
  "closed_at" TIMESTAMP,                           -- when NC was marked closed
  "closed_by" TEXT,                                -- username who closed it
  "corrective_action" TEXT;                        -- (expanded) what was done to fix it
```

Update existing rows: `UPDATE "nc_log" SET "status" = 'closed' WHERE "closed_at" IS NOT NULL; UPDATE "nc_log" SET "status" = 'open' WHERE "closed_at" IS NULL;`

Bump `version` on the `RecordDefinition` for `nc_log` (if it exists in the Neon table; otherwise just the SQL file is enough).

### 3b. Record linkage

The NC must record **which record type and field triggered it**. This is already done:
- `nc_log.record_ref` — e.g. `"REC-7.4.2"`
- `nc_log.submission_id` — the original submission that raised the NC (optional, but used for traceability)

Add a new optional column to capture the resolution trigger:
- `nc_log.resolution_trigger_field` — e.g. `"batchStatus"` or `"dryRoomTemp"` (the field whose change indicated resolution)

---

## 4. Resolution conditions per record type

Each record that can raise an NC must define **what it means for the NC to be resolved**. This is stored as rules in the record definition (alongside `ncThresholds`).

### 4a. REC-7.4.2 (Dry Monitoring) — example

When an NC is raised because `batchStatus ≥ Amber`, the resolution condition is:
```
"batchStatus" = "Green" (all checks score 0)
```

Add to `dry-monitoring.json` in the record definition:

```json
"ncResolutionCondition": {
  "triggeredWhen": "batchStatus >= Amber",
  "resolvedWhen": "batchStatus = Green",
  "descriptionForOperator": "Re-check all signs. If all score 0 (Green), the NC is ready to close.",
  "triggerField": "batchStatus"
}
```

### 4b. Other records (future extension)

Records with `ncThresholds` should include `ncResolutionCondition`. Example for REC-7.9.1 (Chiller Temp):

```json
"ncThresholds": [
  {
    "field": "chillerTemp",
    "min": 0,
    "max": 10,
    "category": "Temperature out of spec",
    "severity": "major"
  }
],
"ncResolutionCondition": {
  "triggeredWhen": "chillerTemp outside 0–10°C",
  "resolvedWhen": "chillerTemp within 0–10°C",
  "descriptionForOperator": "Check the chiller temperature. If within range, the NC is resolved.",
  "triggerField": "chillerTemp"
}
```

---

## 5. Backend API changes

### 5a. POST `/api/nc/check-resolution`

Called by the system (or manually by the frontend) to scan for any NCs ready to close.

**Request:**
```json
{
  "record_ref": "REC-7.4.2",
  "submission_id": 1234,
  "values": { "batchStatus": "Green", ... }
}
```

**Response:**
```json
{
  "ncsReady": [
    {
      "nc_id": 5,
      "nc_ref": "NC-2026-0042",
      "job_number": "DPR01167",
      "original_issue": "batchStatus = Amber (Possible overdrying)",
      "current_status": "Green — all in spec",
      "message": "The dry monitoring checks on trolley 1192 now show all points in spec. This NC is ready to close."
    }
  ]
}
```

**Backend logic:**
1. Find all open NCs (`status = 'open'`) matching `record_ref` and `job_number` (inferred from submission).
2. For each NC, fetch the record's `ncResolutionCondition`.
3. Check if the new submission's values satisfy the resolution condition (e.g. `batchStatus = Green`).
4. If yes, update that NC: `status = 'ready_to_close'`, `ready_to_close_at = NOW()`, `resolution_check_submitted_id = {submission_id}`, `ready_to_close_notes = "{automatic detection: condition met}"`.
5. Return list of updated NCs and metadata for frontend notification.

### 5b. PATCH `/api/nc/:id/close`

Existing endpoint, extend it. When closing an NC, require `corrective_action` field:

```json
{
  "corrective_action": "Replaced fan unit 2. Dry room stable at 30°C. Re-checked all areas.",
  "closed_by": "Michaela"
}
```

Server sets:
- `status = 'closed'`
- `closed_at = NOW()`
- `closed_by = {username}`
- `corrective_action = {provided text}`

Return the updated NC record.

### 5c. GET `/api/nc?status=ready_to_close`

Filter NCs by status. When querying with `status=ready_to_close`, return all NCs awaiting operator confirmation and corrective action comment.

---

## 6. Frontend — NC log page changes

### 6a. Status column update

Current status options: Open / In progress / Closed.

**New status values (backend stores as TEXT):**
- `open` → displays as badge **Open** (red)
- `ready_to_close` → displays as badge **Ready to close** (amber/orange, blink or highlight)
- `closed` → displays as badge **Closed** (green, muted)

In `nc-log-page.html` table, update the Status column renderer to show the new states.

### 6b. Row highlighting for "Ready to close"

Add CSS rule for ready-to-close rows:

```css
tr[data-status="ready_to_close"] {
  background-color: #fef3c7;  /* light amber, slightly brighter than open amber */
}
```

Ready-to-close rows stand out to the operator so they can complete closure quickly.

### 6c. View / Edit modal — "Ready to close" state

When opening an NC with `status = 'ready_to_close'`, the modal shows:

**Header banner (amber):**  
"✓ **NC is ready to close.** The issue has been resolved. Please confirm the corrective action taken and close this NC."

**Fields shown (all as text or read-only display):**
- NC ref, Job number, Record ref, Category, Severity, Description, Raised by, Raised at, Original issue, Resolution detection (e.g. "Dry monitoring shows all checks Green — submitted by Michaela on 21/10/2026 14:30")

**Editable field:**
- **Corrective action** (textarea, required)  
  Placeholder: "What was done to fix this issue? E.g. 'Replaced fan unit. Dry room stable at 30°C. Re-checked all areas.'"

**Action buttons:**
- **Close NC** (primary, green) — enabled only when `corrective_action` is not empty
- **Keep open** (secondary) — allows editing without closing (e.g. if operator wants to add more detail later)
- **Cancel** — close modal without saving

When **Close NC** is clicked:
1. Show confirmation: "Mark this NC as closed with the provided corrective action?"
2. On confirm, PATCH `/api/nc/{id}/close` with the corrective action text.
3. On success, show a green banner: "✓ NC closed successfully. Reference: {nc_ref}."
4. Reload the NC log table.

### 6d. Auto-detection notification

After a record is submitted (in `form-record.js` on submit success), call `POST /api/nc/check-resolution` with the record type and values. If any NCs are ready to close:

1. Show a green notification banner at the top of the page: "✓ **NC Ready to close:** {nc_ref} — Corrective action detected. [View NC Log]"
2. The "View NC Log" link navigates to `pages/nc-log.html` with filter `status=ready_to_close` pre-set.
3. Optionally, highlight the ready-to-close NC row in the table.

### 6e. Email notification when ready to close

When the backend transitions an NC to `ready_to_close` (in the POST `/api/nc/check-resolution` handler), send an email:

**Subject:** `✓ NC Ready to close — {nc_ref} [{job_number}]`

**Body:**
```
Non-conformance is ready to close.

NC Reference:    NC-2026-0042
Job number:      DPR01167
Original issue:  Dry monitoring — Status Amber (Possible overdrying)

Resolution:
  A new dry monitoring check on 21/10/2026 14:30 shows all points in spec (Green).
  The corrective action has been effective.

Next step:
  Review the NC log, confirm the corrective action taken, and close this NC.
  You only need to add a brief comment about what was actually done.

View NC: https://processing-department.onrender.com/pages/nc-log.html?status=ready_to_close

---
Abagold Processing Facility — Automated Alert
```

Email recipient: `NC_EMAIL_RECIPIENTS` (existing env var, or use a more specific list if needed).

---

## 7. Implementation workflow

### Step 1: Database (Neon)
- [ ] Add columns to `nc_log` table (see 3a above).
- [ ] Run backup + migration SQL.
- [ ] Verify columns exist.

### Step 2: Record definitions
- [ ] Add `ncResolutionCondition` to `dry-monitoring.json`.
- [ ] (Future) add to other records with `ncThresholds`.
- [ ] Run `node scripts/export-record-defs.mjs` to update `public/data/record-defs/` cache.

### Step 3: Backend API
- [ ] Implement `POST /api/nc/check-resolution` handler.
  - Fetch open NCs for the record/job.
  - Load `ncResolutionCondition` from record definition.
  - Evaluate condition against submission values.
  - Update matching NCs to `ready_to_close`.
  - Send email alert.
  - Return list of ready NCs.
- [ ] Extend `PATCH /api/nc/:id/close` to accept and store `corrective_action`.
- [ ] Extend `GET /api/nc` to filter by `status` query param.

### Step 4: Frontend — form-record.js
- [ ] On successful submit, call `POST /api/nc/check-resolution` with `record_ref`, `submission_id`, and full form values.
- [ ] If NCs are ready to close, show green notification banner with link to NC log (filtered by `status=ready_to_close`).

### Step 5: Frontend — nc-log page
- [ ] Update Status column to handle `open`, `ready_to_close`, `closed`.
- [ ] Update row CSS highlighting for `ready_to_close` state.
- [ ] Update View/Edit modal:
  - Show amber banner when `status = ready_to_close`.
  - Make `corrective_action` textarea editable and required.
  - Show "Close NC" button (green, enabled only if corrective_action not empty).
  - Implement close flow with confirmation + email.

### Step 6: Testing & deployment
- [ ] Test REC-7.4.2 flow: raise NC (Amber), re-submit with Green status, verify NC auto-transitions to ready_to_close.
- [ ] Test email alert on ready-to-close.
- [ ] Test closing with corrective action comment.
- [ ] Verify old open NCs remain open (no unintended status changes).
- [ ] Mobile: test modal responsiveness and textarea input.

---

## 8. Example walkthrough

1. **Monday 14:30 – Dry monitoring submitted with Amber status**
   - System auto-raises NC-2026-0042: "Possible overdrying on trolley 1192"
   - Status: `open`
   - Email alert sent to Michaela

2. **Monday 15:00 – Operator takes corrective action**
   - Checks the dry room, replaces faulty fan unit.
   - Ensures airflow is restored.

3. **Monday 16:00 – Re-check performed**
   - Another dry monitoring entry is submitted for trolley 1192.
   - All checks score 0 (Green status).
   - On form submit success, `POST /api/nc/check-resolution` is called.
   - Backend finds NC-2026-0042, checks: `batchStatus = Green` → condition met.
   - NC status updated to `ready_to_close`.
   - Email alert sent: "NC-2026-0042 ready to close"
   - Green notification banner shown on the screen.

4. **Monday 16:15 – NC closed**
   - Michaela opens the NC log, sees NC-2026-0042 highlighted in amber ("Ready to close").
   - Clicks [View/Edit].
   - Modal shows: "NC is ready to close. Resolution: Dry monitoring now shows all checks Green."
   - Michaela types in corrective action: "Replaced fan unit 2. Dry room stable at 30°C. Rechecked all areas Monday morning."
   - Clicks [Close NC].
   - Modal confirms the action.
   - NC is closed: `status = closed`, `closed_at = NOW()`, `corrective_action` saved.
   - Green banner: "✓ NC closed successfully. Reference: NC-2026-0042."

5. **Traceability & audit**
   - Job DPR01167 traceability view shows: "NC raised 14:30 (Dry room Amber), resolved 16:15 (corrective action: fan replacement)."
   - CSV export of closed NCs includes corrective action text.

---

## 9. Future enhancements

- **Multi-check NCs:** If an NC is raised for multiple checks (e.g. both Mould AND Case hardening), resolution requires **all** to be Green.
- **Partial resolution tracking:** Show which sub-conditions are resolved and which still need attention (e.g. "Mould: ✓ resolved, Case hardening: pending").
- **SLA tracking:** Alert if an NC is open > X hours without resolution attempt.
- **Corrective action templates:** Pre-fill common fixes (e.g. "Fan unit replacement") from a dropdown, with optional free-text override.
- **Photo evidence:** Allow the operator to attach photos of the corrective action (e.g. new fan installed, temperature readings) when closing.

---

## 10. Checks before finishing

- [ ] `nc_log` table has `status`, `ready_to_close_at`, `resolution_check_submitted_id`, `corrective_action` columns.
- [ ] Existing NCs updated to `status = 'open'` or `status = 'closed'` as appropriate.
- [ ] `ncResolutionCondition` added to `dry-monitoring.json`.
- [ ] `POST /api/nc/check-resolution` implemented and tested in isolation (e.g. with curl).
- [ ] `PATCH /api/nc/:id/close` accepts `corrective_action` field.
- [ ] `GET /api/nc?status=ready_to_close` returns only ready-to-close NCs.
- [ ] form-record.js calls `check-resolution` on submit success.
- [ ] NC log page table shows `ready_to_close` status with correct highlighting.
- [ ] NC log modal shows corrective action textarea when `status = ready_to_close` and makes it required for closure.
- [ ] Green notification banner appears on form submit when NCs are ready to close.
- [ ] Email alert sent when NC transitions to `ready_to_close`.
- [ ] Mobile: modal and notification badges are responsive.
- [ ] Test with REC-7.4.2 Amber → Green flow end-to-end.
- [ ] Verify old open NCs are not affected.
- [ ] Verify email recipients and subject line match spec.
