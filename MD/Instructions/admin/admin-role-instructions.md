# Admin Role — Add Facility Admin Login

**What this adds:** A second password-protected login, `Admin`, separate from `Administrator`.

| Role | Who | Password | Access level |
|------|-----|----------|-------------|
| Administrator | System builder (developer) | `ADMIN_PASSWORD` env var | Full — including system config, code, record definitions |
| **Admin** (new) | Facility manager / day-to-day system owner | `ADMIN_MANAGER_PASSWORD` env var | Full operational — passkeys, records, all data, delete/edit. No system-build pages |
| All others | Staff | None (pick from list) | Per role permissions |

---

## Step 1 — Add env var on Render

In the Render dashboard → **processing-department-api** service → Environment:

```
ADMIN_MANAGER_PASSWORD = <choose a strong password>
```

Deploy after adding it.

---

## Step 2 — `src/index.js` (API server)

### 2a. Add the new env var read (near line 61, alongside `ADMIN_PASSWORD`):

```js
const ADMIN_MANAGER_PASSWORD = process.env.ADMIN_MANAGER_PASSWORD || '';
if (!ADMIN_MANAGER_PASSWORD) {
  console.warn('*** ADMIN_MANAGER_PASSWORD is not set — facility admin login will always fail. Set it in the Render dashboard. ***');
}
```

### 2b. Add a new login endpoint (after the existing `/api/auth/admin-login` block):

```js
// Facility Admin login — checks ADMIN_MANAGER_PASSWORD env var.
app.post('/api/auth/admin-manager-login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_MANAGER_PASSWORD) return res.status(503).json({ ok: false, error: 'Admin login not configured on the server' });
  if (!passwordMatches(password, ADMIN_MANAGER_PASSWORD)) {
    return res.status(401).json({ ok: false, error: 'Incorrect password' });
  }
  res.json({ ok: true });
});
```

### 2c. Allow the new endpoint to bypass the API key gate (near line 83–84):

```js
if (req.path === '/auth/admin-manager-login') return next(); // public — password checked inside
```

---

## Step 3 — `public/lib/permission-rules.js`

### 3a. Add `ADMIN` to the roles list (line 3):

```js
const ROLES = ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMIN', 'ADMINISTRATOR'];
```

### 3b. Add label (in `ROLE_LABELS`):

```js
ADMIN: 'Admin',
```

### 3c. Add `ADMIN` to every rule array that currently has `ADMINISTRATOR` in it.
`ADMIN` gets the same operational permissions as `ADMINISTRATOR` except it is NOT given a blanket `can()` bypass — it goes through rules like everyone else but is included in all operational rules:

Replace the existing `RULES` object with:

```js
const RULES = {
  fillMeasurements:        ['PRODUCTION_SUPERVISOR','SHIFT_MANAGER','QUALITY_SUPERVISOR','QUALITY_CONTROLLER','QA_MANAGER','PRODUCTION_MANAGER','OPERATOR','ADMIN','ADMINISTRATOR'],
  saveDraft:               ['PRODUCTION_SUPERVISOR','SHIFT_MANAGER','QUALITY_SUPERVISOR','QUALITY_CONTROLLER','QA_MANAGER','PRODUCTION_MANAGER','OPERATOR','ADMIN','ADMINISTRATOR'],
  completeRecord:          ['QUALITY_SUPERVISOR','QUALITY_CONTROLLER','QA_MANAGER','PRODUCTION_MANAGER','SHIFT_MANAGER','PRODUCTION_SUPERVISOR','OPERATOR','ADMIN','ADMINISTRATOR'],
  verifyRecord:            ['QUALITY_SUPERVISOR','QA_MANAGER','PRODUCTION_MANAGER','SHIFT_MANAGER','ADMIN','ADMINISTRATOR'],
  acknowledgeSpecChange:   ['PRODUCTION_SUPERVISOR','SHIFT_MANAGER','QUALITY_SUPERVISOR','QUALITY_CONTROLLER','QA_MANAGER','PRODUCTION_MANAGER','ADMIN','ADMINISTRATOR'],
  manageSpecs:             ['QA_MANAGER','PRODUCTION_MANAGER','SHIFT_MANAGER','ADMIN','ADMINISTRATOR'],
  manageMasterIndex:       ['QA_MANAGER','QUALITY_SUPERVISOR','ADMIN','ADMINISTRATOR'],
  manageSOPs:              ['QA_MANAGER','PRODUCTION_MANAGER','ADMIN','ADMINISTRATOR'],
  managePolicies:          ['QA_MANAGER','PRODUCTION_MANAGER','ADMIN','ADMINISTRATOR'],
  manageProcedures:        ['QA_MANAGER','PRODUCTION_MANAGER','ADMIN','ADMINISTRATOR'],
  managePRPs:              ['QA_MANAGER','PRODUCTION_MANAGER','ADMIN','ADMINISTRATOR'],
  manageTemplates:         ['QA_MANAGER','PRODUCTION_MANAGER','ADMIN','ADMINISTRATOR'],
  editSubmission:          ['QUALITY_SUPERVISOR','QA_MANAGER','PRODUCTION_MANAGER','SHIFT_MANAGER','ADMIN','ADMINISTRATOR'],
  deleteSubmission:        ['QA_MANAGER','PRODUCTION_MANAGER','ADMIN','ADMINISTRATOR'],
};
```

### 3d. Update the `can()` function so `ADMIN` also gets full bypass (like `ADMINISTRATOR`):

```js
function can(action) {
  if (!ENFORCE_ROLES) return true;
  if (currentRole === 'ADMINISTRATOR') return true;
  if (currentRole === 'ADMIN') return true;          // ← add this line
  const allowed = RULES[action];
  if (!allowed) return true;
  return allowed.includes(currentRole);
}
```

---

## Step 4 — `public/lib/auth.js`

### 4a. Add the new user to the `USERS` array (before `administrator`):

```js
{ username: 'admin', role: 'ADMIN', displayName: 'Admin' },
```

No `noPassword` — so it requires a password, same as the Administrator entry.

### 4b. Add a login branch for the new user (in the `login()` function).

The current `login()` sends all password-protected users to `/api/auth/admin-login`.  
Update it so `admin` uses the new endpoint instead:

```js
// Admin (facility manager): verify password server-side.
if (user.username === 'admin') {
  return fetch(apiBase() + '/api/auth/admin-manager-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: password || '' })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data.ok) return { ok: false, error: data.error || 'Incorrect password' };
      currentUser = user;
      safeSession(() => window.sessionStorage.setItem(SESSION_KEY, user.username));
      applyRole(user);
      return { ok: true, user };
    })
    .catch(function () {
      return { ok: false, error: 'Could not reach the server. Please try again.' };
    });
}
```

Place this block **before** the existing administrator fetch block, inside the `if (!user.noPassword)` branch.

---

## Step 5 — Cache-bust

`auth.js` and `permission-rules.js` are loaded by many pages. Check how they are referenced:

```bash
grep -rl "auth.js" public/
grep -rl "permission-rules.js" public/
```

Bump the `?v=N` version number on every HTML file that references either file.

---

## Step 6 — Optional: protect admin pages

If there are pages that should only be accessible to `ADMIN` or `ADMINISTRATOR` (e.g. passkey management at `/pages/admin-passkeys.html`), add a guard at the top of those pages:

```js
document.addEventListener('DOMContentLoaded', function () {
  const role = window.Auth && window.Auth.getCurrentRole();
  if (role !== 'ADMIN' && role !== 'ADMINISTRATOR') {
    document.body.innerHTML = '<p style="padding:2rem;color:#991b1b;">Access denied. Admin login required.</p>';
  }
});
```

---

## Summary of what changes

| File | Change |
|------|--------|
| `src/index.js` | New env var read + new `/api/auth/admin-manager-login` endpoint + bypass for API key gate |
| `public/lib/permission-rules.js` | New `ADMIN` role, added to all rule arrays, added `can()` bypass |
| `public/lib/auth.js` | New `admin` user entry, new login branch hitting new endpoint |
| `public/*.html` (many) | Bump `?v=N` on auth.js and permission-rules.js references |
| Render dashboard | Set `ADMIN_MANAGER_PASSWORD` env var |

---

## Difference between Admin and Administrator after this change

| Capability | Admin | Administrator |
|-----------|-------|---------------|
| Fill / save records | ✅ | ✅ |
| Complete / submit records | ✅ | ✅ |
| Verify records | ✅ | ✅ |
| Edit / delete submissions | ✅ | ✅ |
| Manage passkeys / users | ✅ | ✅ |
| Manage specs, SOPs, templates | ✅ | ✅ |
| Bypasses all permission checks | ✅ | ✅ |
| Changes to record definitions (DB / JSON exports) | ❌ (convention only) | ✅ |
| System code / deployment | ❌ (convention only) | ✅ |

The code/system distinction is by convention — both roles have full in-app access. The split exists so the person running the facility doesn't log in as the system-builder account.
