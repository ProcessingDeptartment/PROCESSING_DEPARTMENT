# Admin Single-Passkey Delete — Implementation Instructions

**File:** `public/lib/delete-submission-modal.js`  
**Goal:** When the currently logged-in user is the **Administrator** (`ADMINISTRATOR` role via `Auth.getCurrentRole()`), the delete modal requires only **one** passkey verification instead of two. The reason for deletion is still required.

---

## Why one passkey for admin

Michaela logs in under the Administrator account. The second-signature rule exists to prevent a single person acting alone — but an admin is already the highest trust level in the system. Requiring a second admin to be physically present on the floor is impractical. One passkey + reason is the right trade-off for this role.

---

## 1 — Add an admin-mode flag at the top of `open()`

Find the `open()` function at the bottom of `delete-submission-modal.js` (around line 413):

```js
window.DeleteSubmissionModal = {
  open(opts) {
    injectStyles();
    currentOpts = opts;
    resetSlot(1); resetSlot(2);
    ...
```

Add a check right at the top of `open()`, before building the modal HTML:

```js
open(opts) {
  injectStyles();
  currentOpts = opts;
  resetSlot(1); resetSlot(2);

  // Admin shortcut: single passkey only.
  const role = window.Auth && window.Auth.getCurrentRole ? window.Auth.getCurrentRole() : null;
  currentOpts._adminMode = (role === 'ADMINISTRATOR');
```

---

## 2 — Modify `buildModal` to accept admin mode and conditionally hide Slot 2

`buildModal` currently takes just `opts`. Change its signature to `buildModal(opts, adminMode)` and conditionally hide the second passkey slot:

```js
function buildModal(opts, adminMode) {
  return `
    <div class="dsm-overlay" id="dsm_overlay" onclick="window._dsm.overlayClick(event)">
      <div class="dsm-modal" role="dialog" aria-modal="true" aria-labelledby="dsm_title">
        <div class="dsm-header">
          <h2 id="dsm_title">⚠ Delete Submission</h2>
          <button type="button" onclick="window._dsm.close()" aria-label="Close">✕</button>
        </div>
        <div class="dsm-body">
          <div class="dsm-warning">
            <strong>This action cannot be undone.</strong>
            You are about to permanently delete:<br>
            <span style="font-weight:600">${escHtml(opts.summary)}</span>
          </div>

          <!-- Slot 1 -->
          <div class="dsm-pk-row">
            <div class="dsm-label">
              ${adminMode ? 'Administrator authorisation' : 'First authorisation'}
            </div>
            <div class="dsm-sublabel">
              ${adminMode ? 'Enter your admin passkey to confirm deletion' : 'Administrator, Production Manager or QA Manager'}
            </div>
            <div class="dsm-pk-input-row">
              <div class="dsm-pk-display" id="dsm_pk1_display">—</div>
              <button type="button" class="dsm-pad-btn" onclick="window._dsm.togglePad(1)">Enter PIN</button>
              <button type="button" class="dsm-pad-btn" onclick="window._dsm.resetSlot(1)" style="color:#b71c1c">Reset</button>
            </div>
            ${padHtml(1)}
            <div class="dsm-pk-err" id="dsm_pk1_err"></div>
          </div>

          <!-- Slot 2 — hidden for admin -->
          ${adminMode ? '' : `
          <div class="dsm-pk-row">
            <div class="dsm-label">Second authorisation <span style="font-size:12px;color:#777">(must be a different person)</span></div>
            <div class="dsm-sublabel">Administrator, Production Manager or QA Manager</div>
            <div class="dsm-pk-input-row">
              <div class="dsm-pk-display" id="dsm_pk2_display">—</div>
              <button type="button" class="dsm-pad-btn" onclick="window._dsm.togglePad(2)">Enter PIN</button>
              <button type="button" class="dsm-pad-btn" onclick="window._dsm.resetSlot(2)" style="color:#b71c1c">Reset</button>
            </div>
            ${padHtml(2)}
            <div class="dsm-pk-err" id="dsm_pk2_err"></div>
          </div>`}

          <!-- Reason -->
          <div>
            <div class="dsm-label">Reason for deletion <span style="font-size:12px;color:#777">(required, min 10 characters)</span></div>
            <textarea class="dsm-reason-field" id="dsm_reason" placeholder="e.g. Entry made against wrong job number, duplicate submission, test entry…" rows="3"></textarea>
          </div>

          <!-- Hidden -->
          <input type="hidden" id="dsm_user1" value="">
        </div>
        <div class="dsm-footer">
          <button type="button" class="dsm-btn dsm-btn-cancel" onclick="window._dsm.close()">Cancel</button>
          <button type="button" class="dsm-btn dsm-btn-delete" id="dsm_confirm_btn" onclick="window._dsm.confirm()">
            Delete Submission
          </button>
        </div>
      </div>
    </div>`;
}
```

Then inside `open()`, pass `adminMode` when injecting the HTML:

```js
// Replace:
document.body.insertAdjacentHTML('beforeend', buildModal(opts));
// With:
document.body.insertAdjacentHTML('beforeend', buildModal(opts, currentOpts._adminMode));
```

---

## 3 — Modify `confirm()` to skip Slot 2 when in admin mode

Inside `window._dsm.confirm()`, replace the hard-coded two-slot validation:

```js
// EXISTING:
if (!state[1].verified) {
  document.getElementById('dsm_pk1_err').textContent = 'First passkey has not been verified';
  return;
}
if (!state[2].verified) {
  document.getElementById('dsm_pk2_err').textContent = 'Second passkey has not been verified';
  return;
}
```

Replace with:

```js
if (!state[1].verified) {
  document.getElementById('dsm_pk1_err').textContent = 'Passkey has not been verified';
  return;
}
const adminMode = !!(currentOpts && currentOpts._adminMode);
if (!adminMode && !state[2].verified) {
  document.getElementById('dsm_pk2_err').textContent = 'Second passkey has not been verified';
  return;
}
```

Then in the body object sent to the API, make `passkey2` optional for admin:

```js
// EXISTING:
const body = {
  key: currentOpts.prefix + currentOpts.recordKey,
  submissionId: currentOpts.entryId,
  reason,
};
body.passkey1 = currentOpts._rawPin1 || state[1].pin;
body.passkey2 = currentOpts._rawPin2 || state[2].pin;
```

Replace with:

```js
const adminMode = !!(currentOpts && currentOpts._adminMode);
const body = {
  key: currentOpts.prefix + currentOpts.recordKey,
  submissionId: currentOpts.entryId,
  reason,
  adminSingleAuth: adminMode || undefined,
};
body.passkey1 = currentOpts._rawPin1 || state[1].pin;
if (!adminMode) {
  body.passkey2 = currentOpts._rawPin2 || state[2].pin;
}
```

---

## 4 — Server side: accept `adminSingleAuth` flag

**File:** `src/index.js` (or wherever `/api/submissions/delete-one` is handled)

Find the delete handler. It currently verifies both `passkey1` and `passkey2`. Add a branch:

```js
// Near the top of the DELETE handler, after parsing body:
const { key, submissionId, passkey1, passkey2, reason, adminSingleAuth } = req.body;

// Verify passkey 1 — always required
const pk1 = await verifyPasskey(passkey1);     // existing helper
if (!pk1.ok) return res.status(403).json({ error: 'First passkey not recognised' });

// Check authorised role for pk1
const isAdminOrManager = ['administrator', 'production manager', 'qa manager']
  .some(f => (pk1.title || '').toLowerCase().includes(f));
if (!isAdminOrManager) return res.status(403).json({ error: pk1.displayName + ' is not authorised to approve deletions' });

// Passkey 2 only required when NOT in admin single-auth mode
if (!adminSingleAuth) {
  if (!passkey2) return res.status(400).json({ error: 'passkey2 is required' });
  const pk2 = await verifyPasskey(passkey2);
  if (!pk2.ok) return res.status(403).json({ error: 'Second passkey not recognised' });
  const isAdminOrManager2 = ['administrator', 'production manager', 'qa manager']
    .some(f => (pk2.title || '').toLowerCase().includes(f));
  if (!isAdminOrManager2) return res.status(403).json({ error: pk2.displayName + ' is not authorised' });
  if (pk2.username === pk1.username) return res.status(403).json({ error: 'Both passkeys belong to the same person' });
} else {
  // Admin single-auth: the first passkey must belong to an Administrator, not just any manager.
  const isAdmin = (pk1.title || '').toLowerCase().includes('administrator');
  if (!isAdmin) return res.status(403).json({ error: 'Single-auth mode requires Administrator passkey' });
}
```

> **Note:** `verifyPasskey(pin)` is your existing function that calls the passkey table. The check above ensures single-auth mode is only granted to the `administrator` title — a production manager cannot bypass the double check.

---

## 5 — No change needed to the passkey API or DB

The `/api/passkey/verify` endpoint used by `verifySlot()` in the modal is unchanged. The admin shortcut only removes the requirement for a *second* person — the first passkey is still checked against the server.

---

## 6 — Commit

```
git add public/lib/delete-submission-modal.js src/index.js
git commit -m "feat: admin single-passkey delete (no second verification for ADMINISTRATOR role)

- Admin users see a single passkey slot instead of two in the delete modal
- Server-side guard: adminSingleAuth flag only accepted when passkey1 has Administrator title
- Double sign-off still required for all non-admin roles

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UrVKBs2QSA3Q83wQE4rA9y"
git push origin main
```

---

## Summary

| Scenario | Passkeys required |
|---|---|
| QA Manager deletes | 2 (different people) |
| Production Manager deletes | 2 (different people) |
| **Administrator deletes** | **1 (their own passkey only)** |

The change is purely client-side UI (hiding slot 2) + a server-side flag check. The reason field remains mandatory for all roles. The server rejects `adminSingleAuth` if the passkey's title is not `administrator`, so there is no way to spoof single-auth mode from the browser.
