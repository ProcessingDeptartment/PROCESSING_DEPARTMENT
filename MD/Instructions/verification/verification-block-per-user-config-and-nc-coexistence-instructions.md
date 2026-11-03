# Verification Block — Per-User Configuration & NC Popup Coexistence

**Date:** 2026-11-02  
**Raised by:** Michaela  
**Type:** Addendum to `MD/verification-48hr-hard-block-on-login-instructions.md`  
**Use in:** Claude Code (build)  
**Depends on:**
- `MD/verification-48hr-hard-block-on-login-instructions.md`
- `MD/verification-block-escape-passkey-audit-instructions.md`
- `MD/nc-open-alert-on-login-instructions.md`

---

## 1. Purpose

This file covers two additions that must be built alongside the hard-block system:

1. **Per-user block configuration** — not every user account should receive the hard-block popup. The system needs a per-user flag so an admin can control exactly who gets blocked, regardless of role.
2. **NC open-alert coexistence** — the existing NC open-alert popup (`nc-alert.js`) must continue to fire independently. It must not be replaced, suppressed, or interfered with by the new verification block overlay.

---

## 2. Per-user block configuration

### 2a. Why role-only is not enough

The role matrix in the hard-block instructions (`PERMITTED_ROLES` vs blocked) sets the *default behaviour per role*. But some individual user accounts should be exempt entirely — for example:

- A delivery driver account that only uses a single read-only screen
- A maintenance account used for system checks
- An external auditor given a temporary login
- A user whose role would normally be blocked but who is permanently on-site and cannot be expected to verify records themselves

These exemptions cannot be expressed by role alone. A per-user flag is required.

### 2b. Database change — add `block_exempt` column

Run in Neon SQL editor at `console.neon.tech`:

```sql
-- Add to whichever table holds user accounts / passkeys
-- Replace 'user_passkeys' with the actual table name in your schema
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS block_exempt BOOLEAN NOT NULL DEFAULT FALSE;
```

> If users are stored in a different table (e.g. `users`, `accounts`, `staff`), run the `ALTER TABLE` on that table instead. Check `prisma/schema.prisma` to confirm the correct model.

### 2c. Prisma schema change

In `prisma/schema.prisma`, find the user/passkey model and add:

```prisma
model UserPasskey {
  // ... existing fields ...
  blockExempt   Boolean  @default(false) @map("block_exempt")
}
```

Then run:
```bash
npx prisma generate
```

### 2d. Expose the flag to the client

Wherever the application loads the current user's session data (e.g. after passkey login, or in a `/api/me` or `/api/session` call), include `blockExempt` in the response:

```javascript
// Example: GET /api/me response
res.json({
  id:          user.id,
  name:        user.name,
  role:        user.role,
  blockExempt: user.blockExempt,   // ← add this
});
```

On the client, set a global after the session loads:

```javascript
// Set after login / session init, before verification-block.js runs
window.__blockExempt = currentUser.blockExempt === true;
```

If you use `sessionStorage` for user state, also store it there:

```javascript
sessionStorage.setItem('blockExempt', currentUser.blockExempt ? '1' : '0');
```

### 2e. Check in `verification-block.js`

At the **very top** of `verification-block.js`, before the `fetch` call:

```javascript
(async function initVerificationBlock() {

  // ── 0. Per-user exemption check ──────────────────────────────────────────
  const blockExempt =
    window.__blockExempt === true ||
    sessionStorage.getItem('blockExempt') === '1';

  if (blockExempt) return;   // This user is exempt — skip everything

  // ── 1. Check override already granted this session ───────────────────────
  if (sessionStorage.getItem('vb_override_granted') === '1') return;

  // ... rest of the block logic continues as per the hard-block instructions ...
```

**Order matters:** the exemption check (`blockExempt`) comes before the override check (`vb_override_granted`) and before any API call. An exempt user never triggers the API.

### 2f. Admin management — setting exemptions

**To exempt a user** (run in Neon SQL editor):
```sql
UPDATE user_passkeys SET block_exempt = TRUE WHERE username = 'driver_account';
```

**To remove an exemption:**
```sql
UPDATE user_passkeys SET block_exempt = FALSE WHERE username = 'driver_account';
```

**To view all current exemptions:**
```sql
SELECT username, role, block_exempt
FROM user_passkeys
WHERE block_exempt = TRUE
ORDER BY username;
```

No code deploy is needed when changing exemptions — the flag is read on every login.

### 2g. Summary — three-level control

The full logic for who sees the block, in order of priority:

| Priority | Check | Result |
|----------|-------|--------|
| 1 | `block_exempt = TRUE` on user record | **No block shown at all** — user passes through |
| 2 | `vb_override_granted` in sessionStorage | **No block shown** — user already overrode this session |
| 3 | `overdue count = 0` | **No block shown** — nothing overdue |
| 4 | User role is in `PERMITTED_ROLES` | **Amber warning** — can dismiss and continue |
| 5 | User role is NOT in `PERMITTED_ROLES` | **Red hard block** — must use Override or wait |
| 6 | Role is unrecognised | **Red hard block** (fail-safe default) |

---

## 3. NC open-alert popup coexistence

### 3a. What the existing NC alert does

The file `MD/nc-open-alert-on-login-instructions.md` describes a popup that fires on login when there are **open (unresolved) Non-Conformances** in the system. It is a soft informational alert that can be dismissed. It is controlled by a separate script (referred to here as `nc-alert.js`) and uses its own overlay element.

This popup must **not be removed or changed** as part of the hard-block implementation.

### 3b. Why they can coexist without conflict

The two overlays are completely independent:

| Property | Verification block (`verification-block.js`) | NC open-alert (`nc-alert.js`) |
|----------|-----------------------------------------------|-------------------------------|
| Overlay element ID | `#vb-overlay` | `#nc-alert-overlay` (or similar — check actual file) |
| sessionStorage key | `vb_override_granted` | Separate key (e.g. `nc_alert_dismissed`) |
| API endpoint | `GET /api/verification/count-overdue` | `GET /api/nc/count-open` (or similar) |
| Trigger condition | Unverified records > 48hr old | Any open NCs |
| Dismiss behaviour | Hard block: no dismiss (or Override flow). Warning: dismiss button | Soft dismiss |
| Z-index | `99999` | Must be different (see below) |

They do not share state, DOM elements, or API calls. Both can fire on the same page load.

### 3c. Z-index stacking

If both overlays appear simultaneously (e.g. user logs in, there are open NCs **and** overdue verifications), they must stack correctly:

- **Hard verification block** — the more severe condition. It must appear **on top**.
- **NC alert** — sits below, or appears after the verification block is dismissed (for permitted users).

Set z-indexes explicitly:

```javascript
// In verification-block.js (hard block overlay)
overlay.style.zIndex = '99999';

// In nc-alert.js (NC open-alert overlay)
// Ensure its z-index is lower, e.g. 9999 or 99998
```

If the NC alert currently uses `z-index: 9999` or similar, no change is needed — the verification block at `99999` naturally sits above it.

> Do **not** increase the NC alert's z-index above `99999` — doing so would cause it to cover the verification hard block.

### 3d. Load order on protected pages

On every protected page, load the scripts in this order:

```html
<!-- 1. Session init — sets window.__currentUserRole, window.__blockExempt, etc. -->
<script src="/lib/session-init.js?v=N"></script>

<!-- 2. Existing NC alert — fires if there are open NCs -->
<script src="/lib/nc-alert.js?v=N"></script>

<!-- 3. Verification block — fires if there are overdue verifications -->
<script src="/lib/verification-block.js?v=1"></script>
```

Both scripts are async IIFE functions — they do not block each other. Both call their own API endpoints and inject their own overlays. If both conditions are true, both overlays appear (verification block on top due to higher z-index).

### 3e. Do not touch `nc-alert.js`

No changes are needed to the NC alert script as part of this work. The NC alert:

- Keeps its own sessionStorage key to track whether it has been dismissed
- Keeps its own API call and overlay element
- Keeps its own dismiss logic
- Is unaffected by the verification block's state

The only change is ensuring `verification-block.js` uses a **higher z-index** so it appears above the NC alert when both fire simultaneously.

---

## 4. Files to create / edit

| File | Action |
|------|--------|
| `prisma/schema.prisma` | **Edit** — add `blockExempt Boolean` to user/passkey model |
| Neon SQL editor | **Run** — `ALTER TABLE user_passkeys ADD COLUMN IF NOT EXISTS block_exempt BOOLEAN NOT NULL DEFAULT FALSE;` |
| `/api/me` or session endpoint | **Edit** — include `blockExempt` in user session response |
| Session init script (e.g. `session-init.js`) | **Edit** — set `window.__blockExempt` and `sessionStorage.blockExempt` after login |
| `public/lib/verification-block.js` | **Edit** — add exemption check at top, ensure z-index is `99999` |
| `nc-alert.js` | **No change needed** — must not be modified |

---

## 5. Testing checklist

**Per-user exemption:**
- [ ] User with `block_exempt = FALSE` (default) and a blocked role → hard block appears when records overdue
- [ ] User with `block_exempt = TRUE` → no block appears at all, regardless of overdue count
- [ ] Exempt user with an admin role → no block (exempt check fires before role check)
- [ ] `block_exempt` flag change in Neon takes effect immediately on next login (no deploy needed)
- [ ] `SELECT ... WHERE block_exempt = TRUE` query returns correct list of exempt users

**NC popup coexistence:**
- [ ] Login with open NCs but NO overdue verifications → NC alert appears, no verification block
- [ ] Login with overdue verifications but NO open NCs → verification block appears, no NC alert
- [ ] Login with BOTH open NCs and overdue verifications → both overlays appear; verification block is visually on top (higher z-index)
- [ ] Dismiss verification block (permitted user) → NC alert is visible underneath (if it was already there)
- [ ] NC alert dismiss does not affect verification block state
- [ ] Verification block does not affect NC alert dismiss state (different sessionStorage keys)
- [ ] `nc-alert.js` is unmodified and functions exactly as before
