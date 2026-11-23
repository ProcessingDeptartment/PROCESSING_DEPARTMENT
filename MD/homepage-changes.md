# Home Page Changes

## Overview
Redesign the home page (`public/index.html` or equivalent master record index page) to remove clutter and enforce passkey-only login.

---

## 1. Login flow — passkey required, no general role selection

**Remove:**
- The radio-button role selection list from the login modal
- All `noPassword: true` direct role logins from the login UI
- The "Sign In" button that submits a selected role without a passkey

**Add / change:**
- Home page shows only **two buttons**: `Log In` and `Set Up This Device`
- `Log In` opens the passkey PIN numpad directly (`window.PasskeyInput.openForApproval(...)`) — no role picker step
- Passkey verification via `verifyPasskey(pin)` → `loginByPasskeyResult()` as already wired, but now it is the **only** login path
- Remove the "Sign in with passkey" secondary button — the passkey IS the login

> Note: `administrator` password login via `/api/auth/admin-login` can remain as a hidden or separate admin path, but should not appear on the main home page login flow.

---

## 2. Remove from home page

| Element | Location / selector | Action |
|---|---|---|
| "Categories" header / section heading | Above the form grid | Remove |
| NC Log button | Home page action bar or quick-links | Remove |
| Hamburger menu icon | Top bar / nav | Remove from home page only (keep on record forms if present) |
| Back button | Top bar | Remove from home page only |

---

## 3. Keep on home page

- **Seam Calculator** button — keep as-is
- **Handovers** button — keep as-is
- `Set Up This Device` button (new, see §1)
- `Log In` button (new passkey-direct, see §1)

---

## 4. "Set Up This Device" button behaviour

Opens a simple device setup flow or info modal explaining:
- Open Chrome, navigate to `processing-department.onrender.com`
- Bookmark the page (`Ctrl+D`)
- Keep the tab open during the shift

This can be a static modal — no backend call required.

---

## Files likely affected

- `public/index.html` (or `public/records/master-record-index.html`) — markup changes
- `public/lib/login-ui.js` — remove role list, make passkey the primary/only path
- `public/lib/auth.js` — `ensureAuthenticated()` should now always require passkey (consider setting `AUTH_GATES_ENABLED = true` now that passkey is enforced)
- Any CSS controlling the hamburger, back button, categories heading, NC log button

## Cache-bust reminder

After changing `login-ui.js`, bump `?v=N` on every HTML file that loads it:
```bash
grep -rl "login-ui.js" public/
```
