# Fix: First-Submit Error ("Save failed — please retry")

**Date:** 2026-10-13  
**File changed:** `public/lib/data-store.js`

## Symptom

On first submit of any record form, users saw a "Save failed — please retry" toast (sometimes described as "tap to retry"). Tapping Submit a second time succeeded normally.

## Root Cause

`data-store.js` wraps `api-backend.js` behind a `readyPromise` that resolves once the backend registers itself (or after an 8-second timeout). The `get()` function correctly awaited this promise before attempting a read. However, `set()`, `remove()`, and `getByPrefix()` did **not** — they called `requireBackend()` immediately.

If the Submit button was tapped before `api-backend.js` had finished registering (a race condition on page load), `requireBackend()` returned `null`, `set()` returned `false`, and `persist()` in `form-record.js` / `monitoring-log.js` saw a failure and showed the error toast — without ever attempting an API call.

The second tap succeeded because the backend had registered by then.

## Fix

Added `await whenReady()` to the top of `set()`, `remove()`, and `getByPrefix()` in `data-store.js`:

```js
async function set(key, value) {
  await whenReady();          // ← added
  const b = requireBackend();
  return b ? b.set(key, value) : false;
}
```

Same pattern applied to `remove()` and `getByPrefix()`.

The backend registers in well under one second on a normal page load, so there is no perceptible delay. On a pathological load the 8-second timeout fires and the call proceeds (still returning `false` if no backend registered, which is the correct behaviour — something else is broken at that point).

## No other changes

No field, validation, DB schema, API route, or record page was changed. No version bump needed beyond the file itself.
