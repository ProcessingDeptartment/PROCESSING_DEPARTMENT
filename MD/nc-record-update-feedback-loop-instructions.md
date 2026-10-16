# NC ↔ Record Update Feedback Loop — Instructions

**Date:** 2026-10-16
**Raised by:** Michaela
**Type:** Enhancement — NC log + record update flow
**Use in:** Claude Code (build)
**Depends on:** `nc-log-page-instructions.md`, `nc-record-trigger-instructions.md`

---

## 1. Purpose

When a record has an NC raised against it, any subsequent update to that record
(corrected values re-submitted, corrective action taken on the factory floor)
must flow back to the NC automatically. The NC should reflect:

- **What changed** on the record after the NC was raised.
- **Who made the change** and when.
- Whether the change **resolves** the NC or leaves it open.

Without this loop an NC can sit permanently "open" even though the underlying
problem was fixed on the record days ago — or worse, a record can be quietly
corrected without the NC being acknowledged at all.

---

## 2. Data model changes

### 2a. Add columns to `nc_log`

```sql
ALTER TABLE nc_log
  ADD COLUMN IF NOT EXISTS linked_submission_id  INTEGER,  -- FK to submissions.id
  ADD COLUMN IF NOT EXISTS linked_record_ref     TEXT,     -- e.g. "REC-7.4.2"
  ADD COLUMN IF NOT EXISTS linked_job_number     TEXT,     -- e.g. "DPR01167"
  ADD COLUMN IF NOT EXISTS resolution_trigger    TEXT,     -- 'manual' | 'record_update' | 'auto_close'
  ADD COLUMN IF NOT EXISTS last_record_update_at TIMESTAMPTZ,  -- timestamp of the record edit that affected this NC
  ADD COLUMN IF NOT EXISTS last_record_update_by TEXT;     -- user who edited the record
```

> Note: `submission_id` already exists in the table (from `nc-log-page-instructions.md`).
> `linked_submission_id` is the same concept — rename or alias as needed.
> If the column is already called `submission_id`, skip the ADD for `linked_submission_id`
> and use `submission_id` throughout.

### 2b. Add `nc_refs` column to submissions table (if not already present)

```sql
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS nc_refs  JSONB DEFAULT '[]'::jsonb;
  -- e.g. ["NC-2026-0001", "NC-2026-0005"]
```

This is referenced in `nc-record-trigger-instructions.md` (section 4c). Confirm it
exists before running — do not add a duplicate.

---

## 3. What triggers the feedback loop

The feedback loop fires whenever **either** of these happens:

| Trigger | Where it fires |
|---|---|
| A submitted record is **edited and re-saved** (corrected values) | `PATCH /api/submissions/:id` or equivalent edit endpoint |
| A record is **signed off / finalised** and that record already has NCs linked to it | `POST /api/submissions` with a matching `nc_refs` entry |

Both cases follow the same logic described in section 4.

---

## 4. Server-side logic — record update handler

Add this block to the end of every submission `PATCH` (edit) handler and the
existing `POST` (new submit) handler **after** the DB write succeeds.

```javascript
// nc-feedback-loop.js  (extract and call from both handlers)

async function notifyLinkedNCs(submissionId, updatedBy, updatedAt, pool) {
  // 1. Find all open/in-progress NCs linked to this submission
  const { rows: linkedNCs } = await pool.query(
    `SELECT id, nc_ref, status, record_ref, job_number
     FROM nc_log
     WHERE submission_id = $1
       AND status IN ('open', 'in_progress')`,
    [submissionId]
  );

  if (linkedNCs.length === 0) return;

  for (const nc of linkedNCs) {
    // 2. Stamp the NC with the record update details
    await pool.query(
      `UPDATE nc_log
       SET last_record_update_at = $1,
           last_record_update_by = $2,
           status = CASE
                      WHEN status = 'open' THEN 'in_progress'
                      ELSE status
                    END,
           updated_at = NOW()
       WHERE id = $3`,
      [updatedAt, updatedBy, nc.id]
    );

    // 3. Add a note entry to the NC audit trail (see section 5)
    await pool.query(
      `INSERT INTO nc_audit (nc_id, action, actor, note, created_at)
       VALUES ($1, 'record_updated', $2, $3, $4)`,
      [
        nc.id,
        updatedBy,
        `Record ${nc.record_ref} (submission #${submissionId}) was updated — review if NC is resolved.`,
        updatedAt
      ]
    );

    // 4. Send email notification to NC owner / recipients
    await sendNCRecordUpdateAlert(nc, submissionId, updatedBy, updatedAt);
  }
}
```

**Call sites:**

```javascript
// In PATCH /api/submissions/:id handler, after successful DB write:
await notifyLinkedNCs(req.params.id, req.body.updatedBy || 'System', new Date(), pool);

// In POST /api/submissions handler (for records with pending_nc from local state):
// — handled via nc_refs column already stamped; same call applies after insert.
```

---

## 5. NC audit trail table

A lightweight log so every NC shows a full history of events.

```sql
CREATE TABLE IF NOT EXISTS nc_audit (
  id         SERIAL PRIMARY KEY,
  nc_id      INTEGER NOT NULL REFERENCES nc_log(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,   -- 'raised' | 'record_updated' | 'status_changed' | 'closed' | 'note_added'
  actor      TEXT NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nc_audit_nc_id ON nc_audit (nc_id);
```

Seed an initial `'raised'` entry whenever a new NC is inserted:

```sql
-- Add to the existing trigger function set_nc_ref() OR in the POST /api/nc handler
-- after the INSERT, insert a matching audit row:
INSERT INTO nc_audit (nc_id, action, actor, note)
VALUES (new_nc.id, 'raised', new_nc.raised_by, 'NC opened.');
```

---

## 6. Email — record update alert

Fires once per linked open NC when its source record is edited.

**Subject:** `🔄 Record Updated — Review NC {nc_ref} [{record_ref} / Job: {job_number}]`

**Body:**

```
A record linked to an open NC has been updated.

NC Reference:    NC-2026-0001
Record:          REC 7.4.2 — Dry Monitoring
Job number:      DPR01167
Updated by:      Operator name
Updated at:      16/10/2026 09:15

The record correction may resolve this NC.
Please review and close the NC if the issue is resolved.

View NC:         https://processing-department.onrender.com/pages/nc-log.html?nc=NC-2026-0001

---
Abagold Processing Facility — Automated Alert
```

Recipients: same `NC_EMAIL_RECIPIENTS` env var as the raise alert.

---

## 7. NC log page — show record update history

### 7a. View / Edit modal — add "History" tab

In the existing View/Edit modal (section 4f of `nc-log-page-instructions.md`),
add a **History** tab alongside the existing fields tab:

| Tab | Contents |
|---|---|
| **Details** | All existing fields (current content of the modal) |
| **History** | Chronological audit trail from `nc_audit` |

History tab format (newest first):

```
16/10/2026 09:15  •  record_updated  •  Michaela
  "Record REC-7.4.2 (submission #42) was updated — review if NC is resolved."

06/10/2026 14:30  •  raised  •  Operator
  "NC opened."
```

### 7b. NC table — "Record updated" indicator

In the NC log table, if `last_record_update_at` is set and the NC is still open/in-progress,
show a small pill next to the status badge:

```
[In progress]  🔄 Record updated
```

This immediately flags to a manager: "the operator fixed the record — go close this NC."

### 7c. Deep-link from email

The View NC link in emails should filter the NC log directly to that NC ref:
`/pages/nc-log.html?nc=NC-2026-0001`

Add query-param handling to the NC log page JS:

```javascript
const params = new URLSearchParams(location.search);
const ncFilter = params.get('nc');
if (ncFilter) {
  // Pre-fill the search/filter bar with nc_ref value and trigger a search
  document.getElementById('filter-nc-ref').value = ncFilter;
  loadNCs();
  // Auto-open the detail modal for that NC
  openNCModal(ncFilter);
}
```

---

## 8. Record view — live NC status banner

Extend the banner described in `nc-record-trigger-instructions.md` (section 7)
to show live NC status, not just a static link.

Fetch NC status at record-view load time:

```javascript
// GET /api/nc?submission_id=42
// Returns any NCs linked to this submission
```

Banner states:

| NC status | Banner appearance |
|---|---|
| open | 🔴 amber background — "⚠ NC open: NC-2026-0001 — Awaiting corrective action. [View →]" |
| in_progress | 🟡 yellow background — "🔄 NC in progress: NC-2026-0001 — Under review. [View →]" |
| closed | ✅ grey/green — "✔ NC resolved: NC-2026-0001 — Closed by Michaela on 16/10/2026. [View →]" |

When the banner shows "open" or "in_progress", also show a button:
**[Update this record to fix NC]** — scrolls to the edit/correction section of the record.

---

## 9. Auto-close option (optional — implement as second pass)

If the record is updated and the previously out-of-spec value is now within
threshold, the server can auto-close the NC:

```javascript
// In notifyLinkedNCs(), after stamping the update:
const rechecked = await recheckThresholds(submissionId, pool);
if (rechecked.allClear && nc.resolution_trigger !== 'manual') {
  await pool.query(
    `UPDATE nc_log
     SET status = 'closed',
         closed_at = NOW(),
         closed_by = $1,
         corrective_action = COALESCE(corrective_action, 'Auto-closed: record values corrected.'),
         resolution_trigger = 'auto_close'
     WHERE id = $2`,
    [updatedBy, nc.id]
  );
  await insertAuditRow(nc.id, 'closed', updatedBy, 'Auto-closed — record values are now within spec.');
}
```

Mark this in the NC log with a badge: `[Auto-closed]` instead of `[Closed]`.

**Do not implement auto-close for NCs where `severity = 'critical'`** — those
must always be manually reviewed and closed.

---

## 10. API — add endpoints

### GET `/api/nc?submission_id=:id`

Returns all NCs linked to a given submission ID.
Used by the record view banner (section 8).

### GET `/api/nc/:id/history`

Returns all `nc_audit` rows for a given NC id, ordered `created_at DESC`.
Used by the History tab in the modal (section 7a).

---

## 11. Implementation order

1. **DB migration** — add `nc_audit` table; add `last_record_update_at / by` columns to `nc_log`; confirm `nc_refs` on submissions.
2. **`notifyLinkedNCs()` utility** — wire into PATCH submissions handler first (edits).
3. **Record-update email** — low risk, immediately visible value.
4. **NC log page: "Record updated" pill** in table + History tab in modal.
5. **Record view banner upgrade** — live status + fix button.
6. **Deep-link from email** — query-param filter + auto-open modal.
7. **(Optional pass 2)** Auto-close on threshold recheck.

---

## 12. Checks before finishing

- [ ] Editing a submitted record that has an open NC transitions the NC to `in_progress`.
- [ ] `nc_audit` row is inserted with action `record_updated` and correct timestamp.
- [ ] Email fires to `NC_EMAIL_RECIPIENTS` with correct subject and body.
- [ ] NC log table shows 🔄 "Record updated" pill on affected rows.
- [ ] History tab in modal shows audit trail in correct order.
- [ ] Record view banner shows live NC status (open / in-progress / closed) with correct colour.
- [ ] Deep-link `?nc=NC-2026-0001` opens and filters the NC log correctly.
- [ ] GET `/api/nc?submission_id=:id` returns the correct NCs.
- [ ] GET `/api/nc/:id/history` returns audit rows.
- [ ] Auto-close (if built): critical NCs are never auto-closed.
- [ ] Auto-close (if built): auto-closed NCs show `[Auto-closed]` badge.
