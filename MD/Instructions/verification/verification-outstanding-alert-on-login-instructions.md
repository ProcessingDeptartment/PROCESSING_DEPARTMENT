# Verification Outstanding Alert on Login — Instructions

**Date:** 2026-10-20  
**Raised by:** Michaela  
**Type:** Enhancement — Verification / Auth Session layer  
**Use in:** Claude Code (build)  
**Files to edit:**
- `public/pages/verification-preview.html` ← add alert logic
- `public/index.html` ← add alert logic  
- `server/routes/verification.js` (or equivalent) ← confirm `GET /api/verification/count-outstanding` exists
- Any shared session/auth utility used across pages

---

## 1. Purpose

When **any authenticated user** logs in (or lands on any page while authenticated), the system must immediately pop up a notification if there are any **outstanding verifications** in the verification queue/table.

The alert is actionable — it tells the user there are records awaiting verification and provides a direct link to the verification list.

---

## 2. Who the alert fires for

| User type | Alert fires? |
|---|---|
| All authenticated users | ✅ Yes |
| Unauthenticated / guest | ❌ No |

The alert fires once per session, regardless of user role.

---

## 3. When the alert fires

The alert fires on **page load** for all protected pages:
- `index.html` (main menu / dashboard)
- `pages/verification-preview.html`  
- Any other page with authenticated session

It fires **once per session** — not on every page navigation. Use `sessionStorage` to track that the alert has already been shown:

```javascript
const ALERT_KEY = 'verification_outstanding_alert_shown';
if (sessionStorage.getItem(ALERT_KEY)) return; // already shown this session
```

After showing the alert (regardless of user action), set the flag:

```javascript
sessionStorage.setItem(ALERT_KEY, '1');
```

---

## 4. The alert modal

Use a **modal overlay** (not a browser `alert()`). Style it consistently with the existing UI.

### 4a. Modal structure (HTML)

```html
<div id="verification-alert-overlay" class="verification-alert-overlay" style="display:none;">
  <div class="verification-alert-box">
    <div class="verification-alert-icon">⚠</div>
    <h2 class="verification-alert-title">Outstanding Verifications</h2>
    <p class="verification-alert-body">
      There are <strong id="verification-alert-count">0</strong> record(s) awaiting verification.
    </p>
    <div class="verification-alert-actions">
      <a href="/pages/verification-preview.html" class="verification-alert-btn-primary">View Verifications</a>
      <button type="button" id="verification-alert-dismiss" class="verification-alert-btn-secondary">Dismiss</button>
    </div>
  </div>
</div>
```

### 4b. Styles

```css
.verification-alert-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.verification-alert-box {
  background: #fff;
  border-radius: 12px;
  padding: 2rem 2.5rem;
  max-width: 420px;
  width: 90%;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}

.verification-alert-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #b45309;   /* amber-600 */
}

.verification-alert-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #b45309;   /* amber-700 */
  margin-bottom: 0.75rem;
}

.verification-alert-body {
  font-size: 1rem;
  color: #374151;
  margin-bottom: 1.5rem;
}

.verification-alert-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.verification-alert-btn-primary {
  background: #b45309;
  color: #fff;
  padding: 0.6rem 1.4rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  border: none;
}

.verification-alert-btn-primary:hover {
  background: #92400e;
}

.verification-alert-btn-secondary {
  background: #f3f4f6;
  color: #374151;
  padding: 0.6rem 1.4rem;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
}

.verification-alert-btn-secondary:hover {
  background: #e5e7eb;
}
```

### 4c. Dismiss behaviour

- Clicking **View Verifications** navigates to `pages/verification-preview.html` — the flag is set before navigating so it does not fire again on the verification page itself.
- Clicking **Dismiss** closes the overlay (`display: none`) and sets the `sessionStorage` flag.
- Clicking outside the modal box (on the overlay background) also dismisses it.

---

## 5. JavaScript logic (shared utility or inline)

Add this to a shared `verification-alert.js` file (or inline in each affected page's `<script>` block):

```javascript
async function checkAndShowVerificationAlert() {
  // 1. Only fire once per browser session
  if (sessionStorage.getItem('verification_outstanding_alert_shown')) return;
  sessionStorage.setItem('verification_outstanding_alert_shown', '1');

  // 2. Fetch outstanding verification count
  let outstandingCount = 0;
  try {
    const res = await fetch('/api/verification/count-outstanding');
    if (res.ok) {
      const data = await res.json();
      outstandingCount = data.outstanding || 0;
    }
  } catch (e) {
    // Silently fail — do not block page load
    return;
  }

  // 3. If no outstanding verifications, nothing to show
  if (outstandingCount === 0) return;

  // 4. Update count in alert and show overlay
  const countEl = document.getElementById('verification-alert-count');
  if (countEl) countEl.textContent = outstandingCount;

  const overlay = document.getElementById('verification-alert-overlay');
  if (overlay) overlay.style.display = 'flex';

  // 5. Wire up dismiss button
  const dismissBtn = document.getElementById('verification-alert-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }

  // 6. Wire up overlay background click to dismiss
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', checkAndShowVerificationAlert);
```

---

## 6. Where to add the modal HTML and script call

### `public/index.html`
- Add the `#verification-alert-overlay` HTML just before `</body>`.
- Add the `verification-alert.js` script tag just before `</body>`.

### `public/pages/verification-preview.html`
- Add the same overlay HTML.
- Add the same script call.
- If the user arrived via the alert's "View Verifications" link, the `sessionStorage` flag will already be set so the alert will not re-fire (correct — they are already on the verification page).

### Other authenticated pages
- If there are other pages requiring full authentication (e.g. admin dashboard, submission logs), add the overlay HTML and script call there too so the alert fires wherever the user lands first.

---

## 7. Backend API requirement

Ensure your API provides the endpoint:

**`GET /api/verification/count-outstanding`**

Should return JSON:

```json
{
  "outstanding": 5
}
```

**Where `outstanding`** = count of records with status `pending_verification` or `awaiting_review` (adjust per your DB schema).

If the endpoint does not exist, create it in `server/routes/verification.js` (or equivalent):

```javascript
app.get('/api/verification/count-outstanding', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const count = await db.query(
      'SELECT COUNT(*) as outstanding FROM verification_queue WHERE status = ? OR status = ?',
      ['pending_verification', 'awaiting_review']
    );
    res.json({ outstanding: count[0]?.outstanding || 0 });
  } catch (err) {
    console.error('Error fetching outstanding count:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

Adjust table name, status values, and query logic to match your database schema.

---

## 8. Script tag placement (cache-busting)

In each HTML file, add:

```html
<script src="../lib/verification-alert.js?v=1"></script>
```

**Whenever you update `verification-alert.js`**, bump the `?v=N` number in all HTML files that reference it.

Quick check — find all files that reference it:

```bash
grep -rl "verification-alert.js" public/
```

---

## 9. Checks before finishing

- [ ] Log in to an authenticated session with outstanding verifications in the DB → alert pops up.
- [ ] Alert shows the correct count of outstanding verifications.
- [ ] Clicking **View Verifications** navigates to the verification page; alert does not fire again on that page.
- [ ] Clicking **Dismiss** closes the modal without navigating.
- [ ] Clicking the dark overlay background also closes the modal.
- [ ] Navigate to another page in the same session → alert does **not** fire again (sessionStorage flag).
- [ ] Open a new browser tab (new session) → alert fires again if verifications are still outstanding.
- [ ] When there are zero outstanding verifications, no alert appears.
- [ ] Page load is not blocked if the `/api/verification/count-outstanding` call fails.
- [ ] Alert fires on `index.html` and `verification-preview.html` as expected.
- [ ] The modal styling is consistent with the existing UI theme.

---

## 10. Dark mode consideration

If your site supports dark mode (via CSS variable or class), add dark-mode styles:

```css
@media (prefers-color-scheme: dark) {
  .verification-alert-box {
    background: #1f2937;
    color: #f3f4f6;
  }

  .verification-alert-title {
    color: #fbbf24;   /* amber-300 */
  }

  .verification-alert-body {
    color: #e5e7eb;
  }

  .verification-alert-btn-secondary {
    background: #374151;
    color: #f3f4f6;
    border-color: #4b5563;
  }

  .verification-alert-btn-secondary:hover {
    background: #4b5563;
  }
}
```

---

## 11. Testing checklist

**Pre-login:**
- [ ] Unauthenticated user does not see any alert
- [ ] Login page loads without errors

**Post-login (with outstanding verifications):**
- [ ] Modal appears within 1 second
- [ ] Count is accurate
- [ ] Buttons are clickable
- [ ] Navigation works

**Post-login (zero outstanding verifications):**
- [ ] No modal appears
- [ ] No console errors

**Session persistence:**
- [ ] Refresh page → alert does not re-fire
- [ ] Open new tab → alert fires again if applicable
- [ ] Clear sessionStorage manually → alert fires again on next page load
