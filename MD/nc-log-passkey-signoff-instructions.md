# NC Log Passkey Sign-Off on Comments, Notes & Status Changes — Instructions

**Date:** 2026-11-03  
**Raised by:** Michaela  
**Type:** Enhancement to NC log system  
**Use in:** Claude Code (build) + backend API  
**Related:** `nc-auto-close-on-corrective-action-completion-instructions.md`, `implementation-passkey-and-title-prefill.md`

---

## 1. Purpose

When an operator updates an NC record on the NC log page — adding or editing comments, notes, corrective action text, or changing status (open → ready_to_close → closed) — the system must capture:
1. **Who** made the change (passkey-authenticated identity)
2. **What** changed (field name, old value, new value)
3. **When** the change occurred (timestamp)
4. **Proof** of authorization (passkey signature)

The `closed_by` field must be a **passkey-authenticated username**, not typed text. All edits to an open/ready-to-close NC require passkey verification before the save completes.

**User experience:**
- Operator opens NC modal, makes edits (comments, notes, status, corrective action)
- Clicks "Save" or "Close NC" button
- System prompts: "Sign off on these changes with your passkey"
- Operator authenticates with biometric/PIN
- Changes are saved with operator's authenticated identity as `updated_by` / `closed_by`
- Audit log records all changes with full traceability

---

## 2. Database changes

### 2a. Extend `nc_log` table

Add these columns if not already present:

```sql
ALTER TABLE "nc_log" ADD COLUMN IF NOT EXISTS
  "updated_by" TEXT,                             -- passkey-authenticated username of last updater
  "updated_at" TIMESTAMP,                        -- when last updated
  "closed_by" TEXT,                              -- passkey-authenticated username who closed it
  "closed_at" TIMESTAMP,                         -- when NC was closed
  "created_by" TEXT;                             -- passkey username who raised the NC
```

Update existing rows:
```sql
UPDATE "nc_log" SET "created_by" = "raised_by" WHERE "created_by" IS NULL;
UPDATE "nc_log" SET "updated_by" = "raised_by" WHERE "updated_by" IS NULL AND "raised_at" IS NOT NULL;
```

### 2b. Create `nc_log_audit` table

Track every change to an NC record:

```sql
CREATE TABLE "nc_log_audit" (
  id BIGSERIAL PRIMARY KEY,
  nc_id BIGINT NOT NULL REFERENCES "nc_log"(id) ON DELETE CASCADE,
  changed_by TEXT NOT NULL,                      -- passkey username
  changed_at TIMESTAMP DEFAULT NOW(),
  field_name TEXT,                               -- 'corrective_action', 'notes', 'status', 'comments'
  old_value TEXT,                                -- previous value (for text fields)
  new_value TEXT,                                -- new value (for text fields)
  change_type TEXT,                              -- 'edit', 'close', 'reopen', 'comment'
  passkey_verified BOOLEAN DEFAULT true,         -- proof of passkey verification
  
  CONSTRAINT valid_field CHECK (field_name IN ('corrective_action', 'notes', 'status', 'comments', 'category', 'severity'))
);

CREATE INDEX idx_nc_log_audit_nc_id ON "nc_log_audit"(nc_id);
CREATE INDEX idx_nc_log_audit_changed_at ON "nc_log_audit"(changed_at DESC);
```

### 2c. Update Prisma schema (if using)

Add to `prisma/schema.prisma`:

```prisma
model NcLogAudit {
  id              BigInt   @id @default(autoincrement())
  ncId            BigInt
  ncLog           NcLog    @relation(fields: [ncId], references: [id], onDelete: Cascade)
  changedBy       String   // passkey username
  changedAt       DateTime @default(now())
  fieldName       String
  oldValue        String?
  newValue        String?
  changeType      String   // 'edit', 'close', 'reopen', 'comment'
  passkeyVerified Boolean  @default(true)

  @@index([ncId])
  @@index([changedAt])
}

model NcLog {
  // ... existing fields ...
  createdBy       String?
  updatedBy       String?
  updatedAt       DateTime?
  closedBy        String?  // ← Changed from username to passkey
  closedAt        DateTime?
  
  // Relationship to audit log
  auditLog        NcLogAudit[]
}
```

Run migration:
```bash
npx prisma migrate dev --name add_nc_log_audit_and_passkey_fields
```

---

## 3. Backend API changes

### 3a. Extend PATCH `/api/nc/:id`

When updating an NC record, require and validate a passkey signature.

**Request:**
```json
{
  "corrective_action": "Replaced fan unit 2. Dry room stable at 30°C.",
  "notes": "Temperature now within spec. Rechecked all areas.",
  "status": "closed",
  "comments": "Issue resolved successfully.",
  
  "passkeyVerification": {
    "credentialId": "base64url...",
    "clientDataJSON": "base64url...",
    "authenticatorData": "base64url...",
    "signature": "base64url...",
    "userVerified": true
  }
}
```

**Backend logic:**

1. Extract `passkeyVerification` from request body (separate from field updates).
2. Verify passkey signature using existing WebAuthn library (e.g., `@simplewebauthn/server`).
3. On success, extract authenticated `username` from the passkey credential.
4. Identify which fields are being changed (compare old vs new values).
5. Update `nc_log` table:
   - Set all fields from the request (corrective_action, notes, status, comments, etc.)
   - Set `updated_by = {authenticated_username}`
   - Set `updated_at = NOW()`
   - If `status = 'closed'`, also set `closed_by = {authenticated_username}`, `closed_at = NOW()`
6. For each changed field, insert a row into `nc_log_audit`:
   - `nc_id`, `changed_by`, `changed_at`, `field_name`, `old_value`, `new_value`, `change_type`, `passkey_verified`
7. Return updated NC record and audit trail.

**Response:**
```json
{
  "success": true,
  "nc": {
    "id": 5,
    "nc_ref": "NC-2026-0042",
    "status": "closed",
    "corrective_action": "Replaced fan unit 2...",
    "updated_by": "michaela",
    "updated_at": "2026-11-03T08:45:00Z",
    "closed_by": "michaela",
    "closed_at": "2026-11-03T08:45:00Z"
  },
  "changes": [
    {
      "field": "corrective_action",
      "old": "(empty)",
      "new": "Replaced fan unit 2...",
      "changedBy": "michaela",
      "changedAt": "2026-11-03T08:45:00Z"
    },
    {
      "field": "status",
      "old": "ready_to_close",
      "new": "closed",
      "changedBy": "michaela",
      "changedAt": "2026-11-03T08:45:00Z"
    }
  ]
}
```

**Error handling:**
- If passkey verification fails: return 401 "Passkey verification failed"
- If username does not exist or passkey is disabled: return 401 "User not authorized"
- If no passkey data is provided: return 400 "Passkey signature required for this action"

### 3b. GET `/api/nc/:id/audit`

Return the complete audit trail for an NC record.

**Request:**
```
GET /api/nc/5/audit
```

**Response:**
```json
{
  "ncId": 5,
  "ncRef": "NC-2026-0042",
  "auditLog": [
    {
      "id": 1,
      "changedBy": "michaela",
      "changedAt": "2026-10-21T14:30:00Z",
      "fieldName": "status",
      "oldValue": null,
      "newValue": "open",
      "changeType": "create",
      "passkeyVerified": false
    },
    {
      "id": 2,
      "changedBy": "michaela",
      "changedAt": "2026-11-03T08:45:00Z",
      "fieldName": "corrective_action",
      "oldValue": null,
      "newValue": "Replaced fan unit 2...",
      "changeType": "edit",
      "passkeyVerified": true
    }
  ]
}
```

### 3c. POST `/api/nc/:id/comment`

Add a comment to an NC record. Requires passkey.

**Request:**
```json
{
  "text": "Follow-up: Equipment has been tested and certified.",
  "passkeyVerification": { ... }
}
```

---

## 4. Frontend — NC log page changes

### 4a. NC modal HTML structure

```html
<div id="nc-modal" class="modal">
  <div class="modal-content">
    <h2>Non-Conformance <span id="nc-ref"></span></h2>
    
    <form id="nc-form">
      <label>Corrective action
        <textarea id="nc-corrective-action" required></textarea>
      </label>
      
      <label>Notes
        <textarea id="nc-notes"></textarea>
      </label>
      
      <label>Comments
        <textarea id="nc-comments"></textarea>
      </label>
      
      <details>
        <summary>📋 Change history</summary>
        <div id="nc-audit-trail" class="audit-trail"></div>
      </details>
    </form>
    
    <!-- Passkey sign-off section -->
    <div id="nc-signoff-section" class="signoff-section">
      <h3>Sign off on changes</h3>
      
      <div id="nc-auth-step" class="step">
        <p>Authenticate with your passkey to confirm these changes.</p>
        <button id="nc-passkey-btn" type="button" class="btn btn-primary">
          🔐 Authenticate with passkey
        </button>
        <div id="nc-auth-status" class="status-message"></div>
      </div>
      
      <div id="nc-confirm-step" class="step" style="display: none;">
        <p>✓ <strong id="nc-auth-user"></strong> authenticated</p>
        <button id="nc-confirm-btn" type="button" class="btn btn-success">
          ✓ Confirm and save changes
        </button>
      </div>
    </div>
    
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" id="nc-cancel-btn">Cancel</button>
    </div>
  </div>
</div>
```

### 4b. JavaScript implementation

- Load `passkey-auth.js` on NC log page
- Implement 2-step passkey flow: authenticate → confirm
- Load audit trail on modal open
- Send passkey verification with PATCH request

---

## 5. Implementation checklist

- [ ] Add columns to `nc_log` table
- [ ] Create `nc_log_audit` table
- [ ] Update Prisma schema and run migration
- [ ] Extend `PATCH /api/nc/:id` with passkey verification
- [ ] Implement `GET /api/nc/:id/audit` endpoint
- [ ] Implement `POST /api/nc/:id/comment` endpoint
- [ ] Add passkey sign-off UI to NC modal
- [ ] Test: Edit NC, authenticate with passkey, verify audit trail
- [ ] Test: Close NC, verify `closed_by` is passkey username
- [ ] Mobile: Ensure modal is responsive

---

## 6. Security notes

✅ **Passkey-authenticated `closed_by` ensures non-repudiation** — Michaela cannot deny she closed the NC.
✅ **Full audit trail** — Every change is tracked with user, timestamp, and passkey verification proof.
✅ **Server-side timestamps** — Tamper-proof timestamps prevent backdating changes.
