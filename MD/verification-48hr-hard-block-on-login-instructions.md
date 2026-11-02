# Verification 48hr Hard Block on Login — Instructions

**Date:** 2026-11-02  
**Raised by:** Michaela  
**Type:** Enhancement — Access Control / Verification Enforcement  
**Use in:** Claude Code (build)

---

## 1. Purpose

When any user logs in (or navigates to any protected page), the system must check whether there are **unverified submissions older than 48 hours**. If there are:

- **Blocked users** — the system shows a full-screen hard block overlay. They **cannot use the system at all** until a permitted user verifies the outstanding records. No dismiss button. No workaround.
- **Permitted users** — the system shows the same alert but they can **continue working**. They are expected to action the verifications.

---

## 2. Role matrix

Define which roles are **blocked** vs **permitted** in one place (easy to change later):

```javascript
// Blocked = cannot use system until records are verified
const BLOCKED_ROLES = [
  'operator',
  'supervisor',
  'production manager',
];

// Permitted = sees warning but can keep working
const PERMITTED_ROLES = [
  'administrator',
  'admin',
  'qa manager',
  'qc manager',
];
```

> **All role comparisons must be case-insensitive.** Store/compare in lowercase.
> If a user's role is not in either list, default to **blocked** (fail safe).

---

## 3. How the block works — overview

```
Page load (any protected page)
  ↓
Fetch GET /api/verification/count-overdue
  ↓
count > 0?
  ├─ NO  → normal page load, nothing shown
  └─ YES
       ↓
       Is user's role in PERMITTED_ROLES?
         ├─ YES → show amber WARNING overlay with "Continue" button + link to verify
         └─ NO  → show red HARD BLOCK overlay — NO dismiss button, link to verify only
```

---

## 4. New API endpoint — `GET /api/verification/count-overdue`

This is **different** from the existing `count-outstanding` endpoint. It counts only records that are both **unverified AND older than 48 hours**.

Add to the verification route file (e.g. `server/routes/verification.js`):

```javascript
app.get('/api/verification/count-overdue', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  try {
    // Adjust table/column names to match your actual schema
    const result = await prisma.submission.count({
      where: {
        submittedAt: { lt: cutoff },
        verifiedAt: null,
      },
    });
    res.json({ overdue: result });
  } catch (err) {
    console.error('count-overdue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

Returns:
```json
{ "overdue": 3 }
```

---

## 5. Client-side block logic (`public/lib/verification-block.js`)

Create this as a shared library file:

```javascript
// public/lib/verification-block.js
// Hard block / warning when overdue verifications exist

(async function initVerificationBlock() {
  // ── 1. Read current user role from session ────────────────────────────────
  // Adjust to wherever your app stores the logged-in user's role.
  // Common patterns: sessionStorage, a global set on page load, or a /api/me call.
  const userRole = (
    window.__currentUserRole ||
    sessionStorage.getItem('userRole') ||
    ''
  ).toLowerCase().trim();

  const PERMITTED_ROLES = ['administrator', 'admin', 'qa manager', 'qc manager'];
  const isPermitted = PERMITTED_ROLES.includes(userRole);

  // ── 2. Check overdue count ────────────────────────────────────────────────
  let overdueCount = 0;
  try {
    const res = await fetch('/api/verification/count-overdue');
    if (res.ok) {
      const data = await res.json();
      overdueCount = data.overdue || 0;
    }
  } catch {
    return; // Silently fail — never block on network error
  }

  if (overdueCount === 0) return; // Nothing to do

  // ── 3. Inject overlay ─────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'vb-overlay';
  overlay.innerHTML = `
    <div class="vb-box ${isPermitted ? 'vb-warning' : 'vb-block'}">
      <div class="vb-icon">${isPermitted ? '⚠' : '🔒'}</div>
      <h2 class="vb-title">
        ${isPermitted
          ? 'Overdue Verifications — Action Required'
          : 'System Locked — Verifications Overdue'}
      </h2>
      <p class="vb-body">
        <strong>${overdueCount} record${overdueCount !== 1 ? 's' : ''}</strong>
        ${overdueCount !== 1 ? 'have' : 'has'} been awaiting verification for more than <strong>48 hours</strong>.
        ${isPermitted
          ? 'Please verify these records as soon as possible.'
          : 'You cannot use the system until all overdue records are verified by an authorised user.'}
      </p>
      <div class="vb-actions">
        <a href="/pages/verification-preview.html" class="vb-btn-primary">
          View Verifications (${overdueCount})
        </a>
        ${isPermitted
          ? '<button type="button" id="vb-continue" class="vb-btn-secondary">Continue to system</button>'
          : ''}
      </div>
      ${!isPermitted ? `
        <p class="vb-contact">
          Contact your QA Manager or Administrator to verify outstanding records.
        </p>
      ` : ''}
    </div>
  `;
  document.body.appendChild(overlay);

  // ── 4. Permitted users can dismiss ────────────────────────────────────────
  if (isPermitted) {
    const continueBtn = document.getElementById('vb-continue');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        overlay.remove();
      });
    }
    // Also dismiss on overlay background click (permitted only)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ── 5. Blocked users: intercept ALL clicks / navigation ──────────────────
  if (!isPermitted) {
    // Prevent all keyboard navigation and clicks landing on page beneath
    overlay.style.pointerEvents = 'all';
    document.addEventListener('keydown', blockKey, true);
  }

  function blockKey(e) {
    // Allow Tab within the overlay and Escape (does nothing for blocked users, but prevents other handlers)
    if (!['Tab', 'Shift'].includes(e.key)) e.preventDefault();
  }
})();
```

---

## 6. CSS for the overlay (`public/lib/verification-block.js` — append, or add to `record-theme.css`)

Add inline in the JS (or in `record-theme.css`):

```css
#vb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: sans-serif;
}

.vb-box {
  background: #fff;
  border-radius: 14px;
  padding: 2.5rem 3rem;
  max-width: 480px;
  width: 92%;
  text-align: center;
  box-shadow: 0 12px 48px rgba(0,0,0,0.30);
}

/* Hard block — red theme */
.vb-block .vb-icon  { font-size: 3rem; margin-bottom: 0.5rem; }
.vb-block .vb-title { color: #b91c1c; font-size: 1.4rem; font-weight: 800; margin-bottom: 0.75rem; }
.vb-block .vb-body  { color: #374151; font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
.vb-block           { border-top: 6px solid #b91c1c; }

/* Warning — amber theme (permitted users) */
.vb-warning .vb-icon  { font-size: 3rem; margin-bottom: 0.5rem; }
.vb-warning .vb-title { color: #b45309; font-size: 1.4rem; font-weight: 800; margin-bottom: 0.75rem; }
.vb-warning .vb-body  { color: #374151; font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
.vb-warning           { border-top: 6px solid #d97706; }

.vb-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.vb-btn-primary {
  background: #1d4ed8;
  color: #fff;
  padding: 0.65rem 1.5rem;
  border-radius: 7px;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.95rem;
  border: none;
  cursor: pointer;
}
.vb-btn-primary:hover { background: #1e40af; }

.vb-btn-secondary {
  background: #f3f4f6;
  color: #374151;
  padding: 0.65rem 1.5rem;
  border-radius: 7px;
  border: 1px solid #d1d5db;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
}
.vb-btn-secondary:hover { background: #e5e7eb; }

.vb-contact {
  margin-top: 1.25rem;
  font-size: 0.85rem;
  color: #6b7280;
}

@media (prefers-color-scheme: dark) {
  .vb-box        { background: #1f2937; }
  .vb-body       { color: #d1d5db; }
  .vb-contact    { color: #9ca3af; }
  .vb-btn-secondary { background: #374151; color: #f3f4f6; border-color: #4b5563; }
}
```

---

## 7. Where to load the script

Add to **every protected page** just before `</body>`. This includes at minimum:

- `public/index.html`
- `public/records/REC-*.html` (all record forms)
- `public/pages/verification-preview.html`
- `public/pages/nc-log.html`
- Any other authenticated page

```html
<script src="/lib/verification-block.js?v=1"></script>
```

> **Cache busting:** Whenever `verification-block.js` changes, bump `?v=N` in all HTML files.  
> Quick check: `grep -rl "verification-block.js" public/`

**Important:** Load this script **after** the script that sets `window.__currentUserRole` (or populates `sessionStorage.userRole`), so the role is available when the block runs.

---

## 8. How the user role must be available on the page

The block script reads `window.__currentUserRole` or `sessionStorage.getItem('userRole')`.

Wherever your app currently sets the logged-in user's session data (e.g. after passkey login, or in a shared session init script), ensure it also sets one of these:

```javascript
// Option A — global variable (set before verification-block.js loads)
window.__currentUserRole = 'operator';   // lowercase

// Option B — sessionStorage (set at login)
sessionStorage.setItem('userRole', 'operator');
```

If neither is set, `verification-block.js` defaults to **blocked** (safe default — unidentified users cannot proceed if verifications are overdue).

---

## 9. Verification page behaviour

The block links directly to `/pages/verification-preview.html`. On that page:

- The block script **still runs** (a blocked user who somehow navigates there should still see the block — they cannot verify records themselves since they are not a permitted role).
- A **permitted user** who arrives via the "View Verifications" link will see the amber warning but can dismiss it and do the verifications normally.
- After a permitted user verifies all overdue records, the count drops to 0, and on their next page navigation the block will not appear.

---

## 10. Re-check after verification completes (optional enhancement)

To make the block disappear immediately after the last record is verified (without a page reload), the verification action can broadcast a custom event:

In the verification page JS, after a successful verify action:
```javascript
window.dispatchEvent(new CustomEvent('verification-completed'));
```

In `verification-block.js`, listen for this and recheck:
```javascript
window.addEventListener('verification-completed', async () => {
  const res = await fetch('/api/verification/count-overdue');
  if (res.ok) {
    const data = await res.json();
    if (data.overdue === 0) document.getElementById('vb-overlay')?.remove();
  }
});
```

This is optional — page reload on navigation achieves the same effect.

---

## 11. Files to create / edit

| File | Action |
|------|--------|
| `public/lib/verification-block.js` | **Create** — the full block script with embedded CSS |
| `server/routes/verification.js` | **Edit** — add `GET /api/verification/count-overdue` endpoint |
| `public/index.html` | **Edit** — add script tag before `</body>` |
| `public/records/REC-*.html` | **Edit** — add script tag to each record page |
| `public/pages/verification-preview.html` | **Edit** — add script tag |
| `public/pages/nc-log.html` | **Edit** — add script tag |
| Any other authenticated pages | **Edit** — add script tag |

---

## 12. Adjusting roles later

To change which roles are blocked or permitted, edit only the `PERMITTED_ROLES` array in `verification-block.js` and bump the `?v=N` version. No backend changes required.

Example — to also allow Production Managers to continue working:
```javascript
const PERMITTED_ROLES = ['administrator', 'admin', 'qa manager', 'qc manager', 'production manager'];
```

---

## 13. Testing checklist

- [ ] Log in as `operator` with 0 overdue records → no block, normal access
- [ ] Log in as `operator` with overdue records → red hard block overlay appears, **no dismiss button**
- [ ] Hard block: clicking anywhere on the page beneath the overlay does nothing
- [ ] Hard block: "View Verifications" link is clickable and navigates correctly
- [ ] Log in as `administrator` with overdue records → amber warning overlay appears with "Continue to system" button
- [ ] Permitted user clicks "Continue" → overlay dismissed, system usable
- [ ] Permitted user verifies all records → navigating to another page shows no block
- [ ] `count-overdue` endpoint returns `{ overdue: 0 }` when all records are verified or all submissions are less than 48hr old
- [ ] If `/api/verification/count-overdue` fails (network error), no block is shown and no console crash
- [ ] Block appears on `index.html`, record pages, and nc-log page
- [ ] Role check is case-insensitive (`"OPERATOR"`, `"Operator"` are both blocked)
- [ ] User with unrecognised role is treated as blocked
- [ ] Mobile: overlay fills screen, buttons are tappable, text is legible
