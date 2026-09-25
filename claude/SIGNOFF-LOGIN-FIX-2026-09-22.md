# Sign-off / login gate fixes — 2026-09-22

## Reported issues
1. Abalone Receiving (REC 7.1.2): submissions not saving.
2. No sign-off before submission.
3. Log verification button not working.
4. Administrator should have full access to everything.

## Root causes and fixes

### 1. Submissions not saving
This device/tablet gets 401s from `facility-api` — no valid access key entered at
`/pages/api-key.html`. Failed writes go into an in-memory-only retry queue (by design,
see `fsms-storage-seam` skill) and are lost if the tab closes before the key is fixed.
**Not code-fixed** — needs the facility access key entered on the affected device(s).

### 2. No sign-off before submission
`login-ui.js`'s `ensureAuthenticated()` was a stub that always resolved without ever
showing the sign-in modal, so no one was ever prompted to sign in and `signOffs` stayed
empty on every submission.
- **Fix:** `ensureAuthenticated()` now shows the login modal and blocks until
  `authSuccess` fires (`public/lib/login-ui.js`, v1 → v2).
- Added a "Completed by / Title / Date / Signature" panel to the form-record engine,
  rendered above Save/Submit on all 131 record forms, required only on Submit. The
  "Completed by" name auto-fills from the signed-in user
  (`public/lib/form-record.js`, v42 → v43).
- Captured as `submission.completedBy` on submit.

### 3. Log verification button not working
Same root cause as #2: since nobody could ever authenticate, `SignOffBlock.verifyGate()`
always reported "not signed in," so the button was permanently disabled for everyone.
Fixed by the login gate above. Confirmed working end-to-end as Quality Supervisor.

### 4. Administrator full access
`permission-rules.js`'s `verifyRecord` / `acknowledgeSpecChange` rules and
`signoff-block.js`'s `verifyGate()` (including per-record verifier-role assignments)
didn't include `ADMINISTRATOR`.
- **Fix:** `permission-rules.js` `can()` short-circuits true for Administrator; added
  `ADMINISTRATOR` to the relevant rule arrays (v1 → v2).
- `signoff-block.js` `verifyGate()` now always allows Administrator, overriding any
  per-record verifier assignment (v3 → v5).

## Files changed
- `public/lib/login-ui.js`
- `public/lib/form-record.js`
- `public/lib/signoff-block.js`
- `public/lib/permission-rules.js`
- `?v=` cache-busting bumped on all ~250 pages that load these libs.

## Still open
- Device access key needed on the tablet(s) reporting "submissions not saving."
- `login-ui.js` login is a client-side role picker with password `test` for everyone —
  not real identity. Entra ID integration is a separate, larger change
  (see `fsms-storage-seam` skill: "Roles bypass the adapter, for now").

## Deploy
Pushed to `origin/main` (commit `f8e7db9`); Render auto-deploys `facility-site` from
this repo.
