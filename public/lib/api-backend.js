/*
 * Real backend for window.storage (see BACKEND_INTEGRATION.md).
 *
 * Talks to the Express API in src/index.js, which persists to Postgres (Neon) via Prisma.
 * Load this AFTER data-store.js on any page that should use the shared backend instead
 * of localStorage. Never throws -- failures are swallowed and logged, per the contract.
 *
 * Also exposes window.FacilityApi, the one place every API call goes through, so the access key
 * and the "not authorised" handling live in a single spot rather than at each call site (the
 * job-number pickers, autofill lookups and job-status all call the API directly too).
 */
(function () {
  const API_BASE = window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com';
  const KEY_STORE = 'facility_api_key';

  // The access key is per-device, entered once (see pages/api-key.html), never in the repo.
  function getKey() {
    try { return window.localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function setKey(k) {
    try { window.localStorage.setItem(KEY_STORE, String(k || '').trim()); return true; }
    catch (e) { return false; }
  }
  function clearKey() {
    try { window.localStorage.removeItem(KEY_STORE); return true; } catch (e) { return false; }
  }

  function headers(extra) {
    const h = Object.assign({}, extra || {});
    const k = getKey();
    if (k) h.Authorization = 'Bearer ' + k;
    return h;
  }

  // A 401 means this device has no key (or the wrong one) -- every read comes back empty and every
  // write fails, which otherwise looks exactly like "the database is empty". Say so, once, plainly.
  let bannerShown = false;
  function showAuthBanner() {
    if (bannerShown || typeof document === 'undefined') return;
    bannerShown = true;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#9c241d;color:#fff;'
      + 'font:600 14px/1.4 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;padding:11px 16px;'
      + 'display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;';
    el.innerHTML = 'This device is not authorised for the records database — nothing will save. '
      + '<a href="/pages/api-key.html" style="color:#fff;text-decoration:underline;">Enter the access key</a>';
    (document.body || document.documentElement).appendChild(el);
  }

  async function apiFetch(path, opts) {
    const o = Object.assign({}, opts || {});
    o.headers = headers(o.headers);
    const res = await fetch(API_BASE + path, o);
    if (res.status === 401) showAuthBanner();
    return res;
  }

  window.FacilityApi = { base: () => API_BASE, getKey, setKey, clearKey, headers, fetch: apiFetch };

  async function apiGet(key) {
    try {
      const res = await apiFetch('/api/storage/key/' + encodeURIComponent(key));
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('storage get failed (api)', e);
      return null;
    }
  }

  async function apiSet(key, value) {
    try {
      const res = await apiFetch('/api/storage/key/' + encodeURIComponent(key), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      return res.ok;
    } catch (e) {
      console.error('storage set failed (api)', e);
      return false;
    }
  }

  async function apiRemove(key) {
    try {
      const res = await apiFetch('/api/storage/key/' + encodeURIComponent(key), {
        method: 'DELETE'
      });
      return res.ok;
    } catch (e) {
      console.error('storage remove failed (api)', e);
      return false;
    }
  }

  async function apiGetByPrefix(prefix) {
    try {
      const res = await apiFetch('/api/storage/prefix/' + encodeURIComponent(prefix));
      if (!res.ok) return {};
      return await res.json();
    } catch (e) {
      console.error('storage getByPrefix failed (api)', e);
      return {};
    }
  }

  // Only switch off localStorage once the API is confirmed reachable -- if it's down or not
  // deployed yet, stay on the local fallback rather than silently failing every save.
  fetch(API_BASE + '/api/health').then((res) => {
    if (!res.ok) throw new Error('unhealthy');
    window.storage.useBackend({
      name: 'api',
      get: apiGet,
      set: apiSet,
      remove: apiRemove,
      getByPrefix: apiGetByPrefix
    });
  }).catch((e) => {
    console.error('facility-api unreachable, staying on localStorage', e);
  });
})();
