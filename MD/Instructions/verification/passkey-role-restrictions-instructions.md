# Passkey Role Restrictions — Instructions

**Date:** 2026-11-02
**Raised by:** Michaela
**Type:** Enhancement — Auth / Passkey system
**Use in:** Claude Code (build)

---

## 1. Purpose

Each passkey (user record) has a **Title** that maps directly to one of the system login roles. That title is what determines where the passkey is accepted — a passkey assigned to "Quality Supervisor" can only be used when the system is signed in as Quality Supervisor.

The `title` field on `UserPasskey` is **not free text** — it must be selected from the fixed list of sign-in roles defined in `public/lib/auth.js`.

---

## 2. The sign-in roles (source of truth: `public/lib/auth.js` → `USERS` array)

| `role` key (used internally) | `displayName` (shown in UI) |
|---|---|
| `PRODUCTION_SUPERVISOR` | Supervisor |
| `SHIFT_MANAGER` | Shift Manager |
| `QUALITY_SUPERVISOR` | Quality Supervisor |
| `QUALITY_CONTROLLER` | Quality Controller |
| `QA_MANAGER` | QA Manager |
| `PRODUCTION_MANAGER` | Production Manager |
| `OPERATOR` | Operator |
| `ADMIN` | Admin |
| `ADMINISTRATOR` | Administrator |

If roles are added or removed from `auth.js`, the same list in the passkey form must be updated to match.

---

## 3. Data model — no migration needed

The existing `title` field on `UserPasskey` is already the right field to use. **No schema change required.**

What changes: the `title` field is now stored as the role's `displayName` (e.g. `"Quality Supervisor"`) and is enforced on the verify endpoint instead of being a free-text label.

---

## 4. Admin UI — `public/pages/admin-passkeys.html`

### 4a. Replace the title free-text input with a dropdown

**Create form** — find:
```html
<input type="text" id="title" placeholder="Job title" />
```
Replace with:
```html
<select id="title">
  <option value="">-- Select role --</option>
  <option value="Supervisor">Supervisor</option>
  <option value="Shift Manager">Shift Manager</option>
  <option value="Quality Supervisor">Quality Supervisor</option>
  <option value="Quality Controller">Quality Controller</option>
  <option value="QA Manager">QA Manager</option>
  <option value="Production Manager">Production Manager</option>
  <option value="Operator">Operator</option>
  <option value="Admin">Admin</option>
  <option value="Administrator">Administrator</option>
</select>
```

**Edit modal** — find the title input (likely `id="editTitle"`) and replace the same way:
```html
<select id="editTitle">
  <option value="">-- Select role --</option>
  <option value="Supervisor">Supervisor</option>
  <option value="Shift Manager">Shift Manager</option>
  <option value="Quality Supervisor">Quality Supervisor</option>
  <option value="Quality Controller">Quality Controller</option>
  <option value="QA Manager">QA Manager</option>
  <option value="Production Manager">Production Manager</option>
  <option value="Operator">Operator</option>
  <option value="Admin">Admin</option>
  <option value="Administrator">Administrator</option>
</select>
```

When populating the edit modal, set the selected value:
```javascript
document.getElementById('editTitle').value = user.title || '';
```

### 4b. Add a helper note under the dropdown

```html
<small style="color:#888;">This role determines where the passkey is accepted.</small>
```

### 4c. User table — label the title column clearly

Change the column header from `"Title"` to `"Role / Title"` so it's clear this is the restriction, not just a display label.

---

## 5. Backend — `POST /api/passkey/verify` (enforce the role)

Find the verify endpoint in `src/index.js` (or wherever `POST /api/passkey/verify` is defined).

After the passkey hash matches and `matchedUser` is found, add a role check:

```javascript
// After passkey match is confirmed:
if (matchedUser.title && matchedUser.title.trim() !== '') {
  // Map displayName → role key
  const ROLE_MAP = {
    'Supervisor':          'PRODUCTION_SUPERVISOR',
    'Shift Manager':       'SHIFT_MANAGER',
    'Quality Supervisor':  'QUALITY_SUPERVISOR',
    'Quality Controller':  'QUALITY_CONTROLLER',
    'QA Manager':          'QA_MANAGER',
    'Production Manager':  'PRODUCTION_MANAGER',
    'Operator':            'OPERATOR',
    'Admin':               'ADMIN',
    'Administrator':       'ADMINISTRATOR',
  };

  const requiredRole = ROLE_MAP[matchedUser.title.trim()];
  const callerRole   = (req.body.role || req.headers['x-user-role'] || '').trim();

  if (requiredRole && callerRole !== requiredRole) {
    return res.status(403).json({
      ok: false,
      valid: false,
      error: `This passkey is for "${matchedUser.title}" sign-in only.`
    });
  }
}
```

If `title` is blank or not in the map → **unrestricted** (passkey accepted in any role). This preserves backward compatibility for any existing records with a free-text title that doesn't match.

---

## 6. Client-side — send current role with every verify call

### 6a. `public/lib/auth.js` — update `verifyPasskey()`

```javascript
async function verifyPasskey(pin) {
  try {
    const res = await fetch(apiBase() + '/api/passkey/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passkey: pin,
        role: currentUser ? currentUser.role : ''   // ← ADD THIS
      })
    });
    const data = await res.json();
    return data.ok === true || data.valid === true;
  } catch (e) {
    return false;
  }
}
```

### 6b. Any direct verify calls (not via `Auth.verifyPasskey`)

Search:
```bash
grep -rn "passkey/verify\|api/passkey" public/lib/ public/pages/
```

For each direct `fetch('/api/passkey/verify', ...)` call, add `role: window.Auth?.getCurrentRole?.() || ''` to the JSON body.

### 6c. Surface the error message to the user

Where a failed verify is handled, ensure the error text from the server is shown. For example in `signoff-block.js`, if the current code only checks `data.ok`:

```javascript
if (!data.ok) {
  showError(data.error || 'Invalid passkey');
  return;
}
```

The message `"This passkey is for 'Quality Supervisor' sign-in only."` will then display naturally.

---

## 7. Backward compatibility

- Existing records with a blank `title` → unrestricted, no change in behaviour.
- Existing records with a free-text title that isn't in the role map → treated as unrestricted (falls through the check). Admin should update those records to use the dropdown values.
- The `role` field now sent in verify requests is ignored by the server for unrestricted users.

---

## 8. Files to edit

| File | Change |
|---|---|
| `public/pages/admin-passkeys.html` | Replace title text inputs with role dropdowns in create form and edit modal ✅ Done |
| `src/index.js` (verify endpoint) | Add role check after passkey match |
| `public/lib/auth.js` | Add `role` to `verifyPasskey()` body |
| `public/lib/signoff-block.js` | Surface `data.error` message on failed verify |
| Any other direct `/api/passkey/verify` callers | Add `role` to body |

---

## 9. Testing checklist

- [ ] Create form: title field is a dropdown showing all 9 roles
- [ ] Edit modal: title dropdown pre-selects the user's current role
- [ ] Create a user with title = "Quality Supervisor"
- [ ] Sign in as Quality Supervisor → passkey verify succeeds
- [ ] Sign in as Operator → passkey verify returns "This passkey is for 'Quality Supervisor' sign-in only."
- [ ] User with blank title → passkey accepted in all roles
- [ ] Existing users with non-matching free-text titles → still accepted (no regression)
- [ ] Administrator passkey → only accepted when signed in as Administrator
- [ ] Error message appears in the sign-off block UI (not just the console)
