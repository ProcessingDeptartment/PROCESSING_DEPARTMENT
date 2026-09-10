(function () {
  // data-store.js — the `window.storage` seam every record page saves through.
  //
  // As of 2026-09-10 this is API-ONLY. The old localStorage "LocalBackend" is removed:
  //   - Records save straight to Neon via api-backend.js.
  //   - If the API is unreachable, the save fails and retries (api-backend.js handles the queue).
  //   - No data is written to or read from localStorage by this module.
  //
  // The `shared` flag that some callers still pass (true = backend, false = local-only) is
  // accepted but ignored: both paths use the backend. This avoids touching 130+ call sites.

  let backend = null;

  let markReady;
  let expecting = false;
  let settled = false;
  const readyPromise = new Promise(function (resolve) { markReady = resolve; });
  function settle() { if (!settled) { settled = true; markReady(); } }

  function expectBackend() {
    if (expecting) return;
    expecting = true;
    setTimeout(settle, 8000);
  }

  function whenReady() {
    if (!expecting) settle();
    return readyPromise;
  }

  function useBackend(impl) {
    const missing = ['get', 'set', 'remove', 'getByPrefix']
      .filter(m => typeof (impl || {})[m] !== 'function');
    if (missing.length) {
      console.error('[data-store] backend rejected, missing method(s): ' + missing.join(', '));
      settle();
      return false;
    }
    backend = impl;
    console.info('[data-store] backend in use: ' + (impl.name || 'custom'));
    settle();
    return true;
  }

  function backendUnavailable() { settle(); }
  function backendName() { return backend ? (backend.name || 'custom') : 'none'; }

  function requireBackend() {
    if (backend) return backend;
    console.error('[data-store] no backend registered — api-backend.js must load before any storage call');
    return null;
  }

  async function get(key) {
    const b = requireBackend();
    return b ? b.get(key) : null;
  }

  async function set(key, value) {
    const b = requireBackend();
    return b ? b.set(key, value) : false;
  }

  async function remove(key) {
    const b = requireBackend();
    return b ? b.remove(key) : false;
  }

  async function getByPrefix(prefix) {
    const b = requireBackend();
    return b ? b.getByPrefix(prefix) : {};
  }

  window.storage = { get, set, remove, getByPrefix, useBackend, backendName, whenReady, expectBackend, backendUnavailable };
})();
