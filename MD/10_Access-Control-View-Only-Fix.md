# Access Control — View-Only Enforcement Fix

**Status:** Diagnosed, pending implementation  
**Date:** 2026-11-05

---

## Problem

The access-control system is set up and the admin UI lets you configure roles with `read` (view-only) access to pages. The home page correctly shows/hides nav tiles and sets `data-access="read"` on them. But the rule **does not carry through to the actual record form page** — once a user navigates to a record, the form renders fully editable regardless of their access level.

### Root cause

`access-control.js` enforces access on **home page nav elements** only (`[data-page-id]` selectors on the index page). There is no code in `form-record.js` or `record-shell.js` that:
1. Reads `AccessControl.isReadOnly(pageId)`, or
2. Disables form inputs / hides action buttons based on that result.

The form engine (`form-record.js`) has zero awareness of `AccessControl`.

---

## Architecture of the access control system (as-is)

```
access-control.js
  ├── Loads config from /api/access-control/public
  ├── Maps passkey title → role key (TITLE_TO_ROLE)
  ├── getAccess(pageId) → 'edit' | 'read' | 'none'
  ├── isReadOnly(pageId) → boolean
  ├── canEdit(pageId) → boolean
  └── applyRules() → sets data-access on [data-page-id] elements (home page only)
```

The record form HTML pages (`/records/REC-*.html`) load `form-record.js` and `record-shell.js` but neither consults `AccessControl`.

---

## Fix required

### Step 1 — Add `data-page-id` to each record HTML `<body>`

Each `REC-*.html` page needs to declare which page-ID it corresponds to so `AccessControl.getAccess()` can be called with the right key. For all standard record forms this is `"records"` (matching the access-control config key).

```html
<body data-page-id="records">
```

Run to find all record HTML files:
```bash
grep -rl "form-record.js" public/records/
```

### Step 2 — Enforce view-only in `record-shell.js`

After authentication resolves and `AccessControl` has loaded its config, check the access level and lock the form if `read`.

Add to `record-shell.js` (after the auth/init sequence):

```js
function enforcePageAccessLevel() {
  const pageId = document.body.getAttribute('data-page-id');
  if (!pageId || !window.AccessControl) return;
  if (!window.AccessControl.isReadOnly(pageId)) return;

  // Disable all editable form elements
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.disabled = true;
  });

  // Hide action buttons
  document.querySelectorAll(
    '.fr-btn-submit, .fr-btn-draft, .fr-btn-amend, .fr-btn-delete, [data-amend], [data-delete]'
  ).forEach(el => {
    el.style.display = 'none';
  });

  // Show a view-only banner at the top of the page
  const banner = document.createElement('div');
  banner.className = 'fr-access-banner fr-access-banner--readonly';
  banner.textContent = 'View only — you do not have edit access to this record';
  const main = document.querySelector('.fr-main, main, .fr-page') || document.body;
  main.prepend(banner);
}
```

Call `enforcePageAccessLevel()`:
- After `AccessControl.apply()` resolves (i.e. after config loads and auth is confirmed)
- Also listen for `authSuccess` event in case auth fires after page load

### Step 3 — Style the view-only banner

Add to `public/styles/record-theme.css`:

```css
.fr-access-banner {
  padding: 10px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 4px;
  margin-bottom: 12px;
}
.fr-access-banner--readonly {
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
}
```

---

## Files to change

| File | Change |
|---|---|
| `public/records/REC-*.html` | Add `data-page-id="records"` to `<body>` |
| `public/lib/record-shell.js` | Add `enforcePageAccessLevel()` function and call it after auth + AccessControl config load |
| `public/styles/record-theme.css` | Add `.fr-access-banner` styles |

No changes needed to `form-record.js`, `access-control.js`, or any server-side code.

---

## Notes

- `AccessControl.getAccess()` only returns `'read'` after the user has unlocked with a passkey **and** their role has `read` configured for `records` in the admin panel. Before unlock, non-admin users get `'edit'` for the default visible pages (`records` is in `DEFAULT_VISIBLE`). This is correct — view-only only applies once a specific role is active.
- The `PermissionRules` module (`permission-rules.js`) is a separate system controlling action-level permissions (who can verify, delete, amend). The page-level read/edit distinction from `AccessControl` is an additional layer on top.
- After implementing, bump the `?v=N` cache-bust param in all `REC-*.html` files if `record-shell.js` is changed (per CLAUDE.md convention — but `record-shell.js` is not version-suffixed the same way as `form-record.js`; check the HTML files for how `record-shell.js` is loaded).
