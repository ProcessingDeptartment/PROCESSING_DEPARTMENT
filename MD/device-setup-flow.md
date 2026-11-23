# Device Setup Flow — "Set Up This Device"

## What this feature currently does

The `#deviceSetupBtn` button on the home page opens a modal with browser setup instructions. This is the current live behaviour. The modal guides a first-time user to set up their browser correctly so the system is accessible on that device.

**Current modal steps (live in `public/index.html`):**

1. Open **Chrome** on this device
2. Navigate to `processing-department.onrender.com`
3. Bookmark the page — press **Ctrl+D** (or tap the star in the address bar)
4. Keep this tab open during your shift

This modal is display-only — it has no form input, no passkey, no API call.

---

## Planned enhancement — device access key registration

The "Set Up This Device" flow needs to be extended so that the device receives a **device-level access key** (token) that enables the device to operate the full system. This is separate from a user's personal login.

### What it must do

1. User clicks "Set Up This Device" on the home page
2. The existing browser setup instructions appear first (steps 1–4 above) — keep these
3. A passkey entry step follows: `PasskeyInput.openForApproval('Set up this device')`
4. On valid passkey: the API validates and returns a **device access token**
5. The token is stored silently in `localStorage` (persistent, survives tab close)
6. **The token is never displayed to the user at any point**
7. The device is now registered — it can operate the system without repeating this step
8. Confirmation message: "This device is now set up."

### Key distinctions

| | Personal login | Device setup |
|---|---|---|
| Who does it | Each individual user | Done once per device (by admin or authorised staff) |
| What it stores | `sessionStorage` (clears on tab close) | `localStorage` (persistent) |
| What it grants | User role + session access | Device-level access key/token |
| Visible to user | Yes — name and role shown in top bar | No — token never shown |
| Repeats | Every session | Once per device |

### Implementation notes

- Do **not** call `AccessControl.unlockForSession()` — that is for personal user session unlock, not device registration
- The access key/token stored in `localStorage` is a device credential, not a user credential
- The token should be sent in API requests so the server can verify the device is authorised
- Check `pages/devices.html` and the API server (`server.js` / route files) for the existing device registration endpoint — it likely already exists or is partially built given `pages/devices.html` exists as an admin view of authorised devices
- The passkey used for device setup may be a separate admin passkey, not a personal user passkey

---

## Files to change

| File | Change |
|------|---------|
| `public/index.html` | Extend `#deviceSetupBtn` click handler: show browser setup steps first, then passkey entry, then store returned token to `localStorage` |
| API server | Confirm or add a device registration endpoint (e.g. `POST /api/devices/register`) that validates passkey and returns a device token |
| `public/lib/api-backend.js` | Attach device token from `localStorage` to outgoing API requests (if not already done) |

## Cache-bust reminder

```bash
grep -rl "index.html" public/
```

If `index.html` changes affect any `?v=N` references, bump them accordingly.
