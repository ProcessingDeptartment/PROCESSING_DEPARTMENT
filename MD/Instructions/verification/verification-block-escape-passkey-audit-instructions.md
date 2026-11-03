# Verification Block Escape — Passkey + Reason + Audit Log

**Date:** 2026-11-02  
**Raised by:** Michaela  
**Type:** Enhancement — Block Escape with Accountability  
**Use in:** Claude Code (build)  
**Depends on:** `MD/verification-48hr-hard-block-on-login-instructions.md`

---

## 1. Purpose

Blocked users (those who cannot dismiss the 48hr verification block) may have a legitimate operational reason to continue working before records are verified. This feature adds an **escape hatch** to the hard block:

- User clicks **"Override — Enter Reason"**
- A modal appears requiring:
  1. A written reason — **minimum 20 characters**
  2. Their **passkey** (validated against the server)
- On success:
  - The block is removed for this session
  - The override is written to a **permanent audit log** in the database
  - No record of the override is suppressible — it is always logged

This is a **full accountability chain**: every override is traceable to the person, their stated reason, and the exact time.

---

## 2. What changes in `verification-block.js`

Add an **"Override"** button to the hard-block overlay (red version only — permitted users already have a Continue button):

```html
<!-- Add inside .vb-actions for blocked users only -->
<button type="button" id="vb-override-btn" class="vb-btn-override">
  Override — Enter Reason
</button>
```

And the escape modal HTML (inject into the overlay):

```html
<div id="vb-escape-modal" style="display:none;">
  <div class="vb-escape-box">
    <h3 class="vb-escape-title">Override Verification Block</h3>
    <p class="vb-escape-warning">
      ⚠ This override will be <strong>permanently recorded</strong> in the audit log with your name, passkey identity, reason, and timestamp.
    </p>

    <label class="vb-label" for="vb-reason">
      Reason for override <span class="vb-required">(minimum 20 characters)</span>
    </label>
    <textarea
      id="vb-reason"
      class="vb-textarea"
      rows="4"
      maxlength="500"
      placeholder="Explain why you need to access the system before verifications are completed..."
    ></textarea>
    <div class="vb-char-count">
      <span id="vb-char-current">0</span> / 20 minimum
    </div>

    <label class="vb-label" for="vb-passkey">Your passkey</label>
    <input
      type="password"
      id="vb-passkey"
      class="vb-input"
      placeholder="Enter your passkey"
      autocomplete="off"
      inputmode="numeric"
    />

    <div id="vb-escape-error" class="vb-escape-error" style="display:none;"></div>

    <div class="vb-escape-actions">
      <button type="button" id="vb-escape-submit" class="vb-btn-primary" disabled>
        Submit Override
      </button>
      <button type="button" id="vb-escape-cancel" class="vb-btn-secondary">
        Cancel
      </button>
    </div>
  </div>
</div>
```

---

## 3. JavaScript — escape flow (add to `verification-block.js`)

Append this logic after the overlay is injected. Only runs for blocked users (`!isPermitted`):

```javascript
if (!isPermitted) {
  // ── Show override modal on button click ────────────────────────────────
  const overrideBtn = document.getElementById('vb-override-btn');
  const escapeModal = document.getElementById('vb-escape-modal');
  const reasonEl    = document.getElementById('vb-reason');
  const charCurrent = document.getElementById('vb-char-current');
  const passkeyEl   = document.getElementById('vb-passkey');
  const submitBtn   = document.getElementById('vb-escape-submit');
  const cancelBtn   = document.getElementById('vb-escape-cancel');
  const errorEl     = document.getElementById('vb-escape-error');

  overrideBtn.addEventListener('click', () => {
    escapeModal.style.display = 'flex';
    reasonEl.focus();
  });

  cancelBtn.addEventListener('click', () => {
    escapeModal.style.display = 'none';
    reasonEl.value = '';
    passkeyEl.value = '';
    errorEl.style.display = 'none';
    charCurrent.textContent = '0';
    submitBtn.disabled = true;
  });

  // ── Live character count + enable submit ───────────────────────────────
  function updateSubmitState() {
    const len = reasonEl.value.trim().length;
    charCurrent.textContent = len;
    charCurrent.style.color = len >= 20 ? '#16a34a' : '#dc2626';
    submitBtn.disabled = !(len >= 20 && passkeyEl.value.length > 0);
  }
  reasonEl.addEventListener('input', updateSubmitState);
  passkeyEl.addEventListener('input', updateSubmitState);

  // ── Submit override ────────────────────────────────────────────────────
  submitBtn.addEventListener('click', async () => {
    const reason  = reasonEl.value.trim();
    const passkey = passkeyEl.value.trim();
    const userName = window.__currentUserName
      || sessionStorage.getItem('userName')
      || 'Unknown';
    const userRole = window.__currentUserRole
      || sessionStorage.getItem('userRole')
      || 'Unknown';

    if (reason.length < 20) {
      showError('Reason must be at least 20 characters.');
      return;
    }
    if (!passkey) {
      showError('Passkey is required.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying…';
    errorEl.style.display = 'none';

    try {
      // 1. Validate passkey against server
      const verifyRes = await fetch('/api/passkeys/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-key': window.getAccessKey?.() || '',
        },
        body: JSON.stringify({ passkey }),
      });
      const verifyData = verifyRes.ok ? await verifyRes.json() : {};
      const passkeyValid = verifyData.valid === true || verifyData.ok === true;

      if (!passkeyValid) {
        showError('Passkey not recognised. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Override';
        return;
      }

      // 2. Write audit log entry
      const auditRes = await fetch('/api/audit/block-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-key': window.getAccessKey?.() || '',
        },
        body: JSON.stringify({
          userName,
          userRole,
          reason,
          overdueCount,        // captured in outer scope
          passkeyIdentity: verifyData.displayName || verifyData.username || userName,
        }),
      });

      if (!auditRes.ok) {
        // Audit log write failed — do NOT unblock. This prevents bypassing without a trace.
        showError('Failed to write audit log. Override not granted. Contact your administrator.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Override';
        return;
      }

      // 3. Grant access — remove block for this session
      sessionStorage.setItem('vb_override_granted', '1');
      overlay.remove();

    } catch (err) {
      showError('Network error. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Override';
    }
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
}
```

---

## 4. Override already granted this session

At the **top** of `verification-block.js`, before the API call, add:

```javascript
// If override was already granted this session, skip the block entirely
if (sessionStorage.getItem('vb_override_granted') === '1') return;
```

This means the user is only asked once per browser session. If they close and reopen the browser, the flag is cleared and they must justify again if records are still overdue.

---

## 5. New API endpoint — `POST /api/audit/block-override`

Add to the server (e.g. `src/routes/audit.js` or inline in `src/index.js`):

```javascript
app.post('/api/audit/block-override', async (req, res) => {
  if (!req.user && !req.headers['x-access-key']) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userName, userRole, reason, overdueCount, passkeyIdentity } = req.body;

  if (!reason || reason.trim().length < 20) {
    return res.status(400).json({ error: 'Reason must be at least 20 characters.' });
  }

  try {
    await prisma.blockOverrideAudit.create({
      data: {
        userName:        userName || 'Unknown',
        userRole:        userRole || 'Unknown',
        passkeyIdentity: passkeyIdentity || userName || 'Unknown',
        reason:          reason.trim(),
        overdueCount:    overdueCount || 0,
        overriddenAt:    new Date(),
        ipAddress:       req.ip || req.headers['x-forwarded-for'] || null,
        userAgent:       req.headers['user-agent'] || null,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[block-override-audit] DB write failed:', err.message);
    // Return 500 — client will NOT grant override if this fails
    res.status(500).json({ error: 'Audit log write failed.' });
  }
});
```

**Critical:** The endpoint returns `500` on failure. The client code checks for `!auditRes.ok` and **refuses to grant access** if the audit write failed. There is no way to get past the block without a trace.

---

## 6. Database — new table `block_override_audit`

Run in Neon SQL editor (`console.neon.tech`):

```sql
CREATE TABLE IF NOT EXISTS block_override_audit (
  id               SERIAL PRIMARY KEY,
  user_name        TEXT        NOT NULL,
  user_role        TEXT        NOT NULL,
  passkey_identity TEXT        NOT NULL,
  reason           TEXT        NOT NULL,
  overdue_count    INTEGER     NOT NULL DEFAULT 0,
  overridden_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address       TEXT,
  user_agent       TEXT
);

-- Index for quick audit queries by user or date
CREATE INDEX IF NOT EXISTS idx_block_override_user ON block_override_audit (user_name);
CREATE INDEX IF NOT EXISTS idx_block_override_date ON block_override_audit (overridden_at DESC);
```

---

## 7. Prisma schema — add model

In `prisma/schema.prisma`:

```prisma
model BlockOverrideAudit {
  id               Int      @id @default(autoincrement())
  userName         String   @map("user_name")
  userRole         String   @map("user_role")
  passkeyIdentity  String   @map("passkey_identity")
  reason           String
  overdueCount     Int      @default(0) @map("overdue_count")
  overriddenAt     DateTime @default(now()) @map("overridden_at")
  ipAddress        String?  @map("ip_address")
  userAgent        String?  @map("user_agent")

  @@map("block_override_audit")
}
```

Then run:
```bash
npx prisma generate
```

---

## 8. Viewing the audit log (admin only)

### Option A — Neon SQL editor (immediate, no coding)

```sql
SELECT
  overridden_at AT TIME ZONE 'Africa/Johannesburg' AS "Time (SAST)",
  user_name     AS "User",
  user_role     AS "Role",
  passkey_identity AS "Passkey ID",
  overdue_count AS "Records overdue",
  reason        AS "Reason given",
  ip_address    AS "IP"
FROM block_override_audit
ORDER BY overridden_at DESC;
```

### Option B — Admin page (future enhancement)

Add a read-only table at `pages/admin-audit-log.html` accessible to `ADMINISTRATOR` role only. The table shows all override events sorted newest first. Can be added later without changing any of the logic above.

---

## 9. CSS additions (add to `verification-block.js` style block)

```css
.vb-btn-override {
  background: transparent;
  color: #9ca3af;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #4b5563;
  font-size: 0.82rem;
  cursor: pointer;
  margin-top: 0.5rem;
}
.vb-btn-override:hover { color: #f3f4f6; border-color: #9ca3af; }

#vb-escape-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  z-index: 100000;
  display: none;
  align-items: center;
  justify-content: center;
}
.vb-escape-box {
  background: #fff;
  border-radius: 12px;
  padding: 2rem 2.5rem;
  max-width: 460px;
  width: 94%;
  box-shadow: 0 16px 60px rgba(0,0,0,0.4);
}
.vb-escape-title   { font-size: 1.2rem; font-weight: 800; color: #111827; margin-bottom: 0.75rem; }
.vb-escape-warning { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 7px; padding: 0.75rem 1rem; font-size: 0.88rem; color: #92400e; margin-bottom: 1.25rem; }
.vb-label          { display: block; font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 0.35rem; }
.vb-required       { color: #dc2626; font-weight: 400; }
.vb-textarea       { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.6rem 0.75rem; font-size: 0.9rem; resize: vertical; box-sizing: border-box; }
.vb-textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
.vb-char-count     { font-size: 0.78rem; color: #6b7280; margin-top: 0.25rem; margin-bottom: 1rem; }
.vb-input          { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.6rem 0.75rem; font-size: 0.9rem; box-sizing: border-box; margin-bottom: 1rem; }
.vb-input:focus    { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
.vb-escape-error   { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 0.6rem 0.75rem; font-size: 0.85rem; color: #b91c1c; margin-bottom: 0.75rem; }
.vb-escape-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
```

---

## 10. Files to create / edit

| File | Action |
|------|--------|
| `public/lib/verification-block.js` | **Edit** — add Override button, escape modal HTML, escape JS logic, CSS, session flag check |
| `src/index.js` or `src/routes/audit.js` | **Edit/Create** — add `POST /api/audit/block-override` endpoint |
| `prisma/schema.prisma` | **Edit** — add `BlockOverrideAudit` model |
| Neon SQL editor | **Run** — `CREATE TABLE block_override_audit ...` |

---

## 11. Testing checklist

- [ ] Blocked user sees the red hard-block overlay with a small "Override — Enter Reason" button
- [ ] Clicking Override opens the escape modal over the block overlay
- [ ] Submit button stays disabled until reason ≥ 20 chars AND passkey is entered
- [ ] Character counter turns green when ≥ 20 characters, red when under
- [ ] Entering a valid passkey + reason → block is removed, system is usable
- [ ] Entering an invalid passkey → error shown, block remains, no audit entry written
- [ ] Entering a reason < 20 characters and submitting → rejected client-side and server-side
- [ ] After override: navigate to another page in same session → no block re-appears (`vb_override_granted` flag)
- [ ] After override: close browser, reopen, log in → block reappears if records still overdue (sessionStorage cleared)
- [ ] Every successful override creates a row in `block_override_audit` with correct `user_name`, `reason`, `overridden_at`, and `overdue_count`
- [ ] If the `POST /api/audit/block-override` call returns 500, the block is NOT removed
- [ ] Permitted users (admin, QA manager) do NOT see the Override button — they have the "Continue" button instead
- [ ] Audit table is queryable in Neon with the SQL above
- [ ] IP address and user agent are captured in the audit row
- [ ] Cancel button closes modal and clears all fields without granting access
