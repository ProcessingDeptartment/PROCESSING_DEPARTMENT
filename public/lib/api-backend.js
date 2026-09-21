(function () {
  const API_BASE = window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com';

  if (window.storage && window.storage.expectBackend) window.storage.expectBackend();

  // API key is still persisted in localStorage/sessionStorage — it's a device credential, not
  // record data, and losing it on every page load would force re-entry on every form.
  const KEY_STORE = 'facility_api_key';

  const memStore = {};
  function pickStore() {
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        const s = window[name];
        s.setItem('__probe__', '1');
        s.removeItem('__probe__');
        return { s: s, durable: true, name: name };
      } catch (e) {  }
    }
    return {
      s: {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null; },
        setItem: function (k, v) { memStore[k] = String(v); },
        removeItem: function (k) { delete memStore[k]; }
      },
      durable: false,
      name: 'memory'
    };
  }
  const STORE = pickStore();


  function getKey() {
    try { return STORE.s.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function setKey(k) {
    try { STORE.s.setItem(KEY_STORE, String(k || '').trim()); return true; }
    catch (e) { return false; }
  }
  function clearKey() {
    try { STORE.s.removeItem(KEY_STORE); return true; } catch (e) { return false; }
  }

  function headers(extra) {
    const h = Object.assign({}, extra || {});
    const k = getKey();
    if (k) h.Authorization = 'Bearer ' + k;
    return h;
  }


  let authFailed = false;
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
    if (res.status === 401) { authFailed = true; showAuthBanner(); }
    else if (res.ok) authFailed = false;
    return res;
  }

  window.FacilityApi = { base: () => API_BASE, getKey, setKey, clearKey, headers, fetch: apiFetch,
    authFailed: () => authFailed };

  // ---------- Instant-load cache for record LAYOUT (not record data) ----------
  // A record page must draw immediately even while the API is asleep. The form definition and the
  // template override are layout only, so they are cached on the device and served at once; a
  // background fetch refreshes the cache for the next open. Entries/submissions are never cached.
  const SWR_PREFIX = 'abg_swr1:';
  function swr(cacheKey, fetcher) {
    let cached = null;
    try { const raw = STORE.s.getItem(SWR_PREFIX + cacheKey); if (raw) cached = JSON.parse(raw); } catch (e) { cached = null; }
    const refresh = (async function () {
      const v = await fetcher();
      try { STORE.s.setItem(SWR_PREFIX + cacheKey, JSON.stringify({ v: v })); } catch (e) { /* quota: fine */ }
      return v;
    })();
    if (cached) { refresh.catch(function () {}); return Promise.resolve(cached.v); }
    return refresh;
  }
  function swrPut(cacheKey, v) {
    try { STORE.s.setItem(SWR_PREFIX + cacheKey, JSON.stringify({ v: v })); } catch (e) { /* ignore */ }
  }
  async function fetchWithRetry(path, tries) {
    let last = null;
    for (let i = 0; i < tries; i++) {
      try {
        const res = await apiFetch(path);
        if (res.ok) return res;
        if (res.status < 500) throw new Error('HTTP ' + res.status);
        last = new Error('HTTP ' + res.status);
      } catch (e) {
        if (/^HTTP 4/.test(e.message)) throw e;
        last = e;
      }
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    throw last;
  }
  // -> config object, or null if unavailable (nothing cached and API down)
  window.FacilityApi.recordDef = async function (recordKey) {
    try {
      return await swr('def:' + recordKey, async function () {
        const res = await fetchWithRetry('/api/record-def/' + encodeURIComponent(recordKey), 6);
        const body = await res.json();
        if (!body || !body.config) throw new Error('no config');
        return body.config;
      });
    } catch (e) { console.error('record-def ' + recordKey + ' failed', e); return null; }
  };
  // -> raw override JSON string, or null when there is none
  window.FacilityApi.templateOverride = async function (recordKey) {
    try {
      return await swr('tpl:' + recordKey, async function () {
        const res = await fetchWithRetry('/api/storage/key/' + encodeURIComponent('record_template:' + recordKey), 6);
        const body = await res.json();
        return body && body.value != null ? body.value : null;
      });
    } catch (e) { return null; }
  };


  // ---------- In-memory retry queue (no localStorage) ----------
  // If a write fails (network down, 5xx), it stays in this in-memory queue and retries every
  // 30 s and on `online`. If the user navigates away before it drains, the data is LOST — that
  // is the intended behaviour (no localStorage for record data). The banner warns them.
  const queue = {};       // key -> { op, value, ts }
  let draining = false;

  function queueCount() { return Object.keys(queue).length; }

  function enqueue(op, key, value) {
    queue[key] = { op: op, value: value, ts: Date.now() };
    updateQueueBadge();
    return true;
  }

  let queueBadge = null;
  function updateQueueBadge() {
    const n = queueCount();
    if (typeof document === 'undefined' || !document.body) return;
    if (!n) { if (queueBadge) { queueBadge.remove(); queueBadge = null; } return; }
    if (!queueBadge) {
      queueBadge = document.createElement('div');
      queueBadge.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#8a5a10;'
        + 'color:#fff;font:600 14px/1.4 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;padding:10px 16px;'
        + 'display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;';
      document.body.appendChild(queueBadge);
    }
    queueBadge.textContent = n + (n === 1 ? ' record is' : ' records are')
      + ' waiting to sync — do NOT close or navigate away from this page until it clears.';
  }


  async function drain() {
    if (draining) return;
    draining = true;
    try {
      const keys = Object.keys(queue).sort((a, b) => queue[a].ts - queue[b].ts);
      for (const key of keys) {
        const item = queue[key];
        let ok = false;
        try {
          const res = item.op === 'remove'
            ? await apiFetch('/api/storage/key/' + encodeURIComponent(key), { method: 'DELETE' })
            : await apiFetch('/api/storage/key/' + encodeURIComponent(key), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: item.value })
              });
          ok = res.ok;
        } catch (e) { ok = false; }
        if (!ok) break;
        invalidate(key);
        // Only delete if this is still the same queued item (not re-queued during drain).
        if (queue[key] && queue[key].ts === item.ts) delete queue[key];
      }
    } finally {
      draining = false;
      updateQueueBadge();
    }
  }

  window.addEventListener('online', drain);
  setInterval(function () { if (queueCount()) drain(); }, 30000);
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', updateQueueBadge);
  }


  // ---------- Read cache (in memory) ----------
  const TTL_MS = 2000;
  const inFlight = new Map();
  const recent = new Map();

  function invalidate(key) {
    recent.delete(key);
    inFlight.delete(key);
  }

  async function apiGet(key) {
    // Check the in-memory queue first (same as before, minus localStorage).
    if (queue[key]) return queue[key].op === 'remove' ? null : { value: queue[key].value };

    const hit = recent.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

    const pending = inFlight.get(key);
    if (pending) return pending;

    const p = (async function () {
      try {
        const res = await apiFetch('/api/storage/key/' + encodeURIComponent(key));
        if (!res.ok) return null;
        // A missing key comes back 200 { value: null } (a 404 would show as a red console error
        // for every optional key a page probes). Callers treat "missing" as null, so normalise.
        const body = await res.json();
        return body && body.value != null ? body : null;
      } catch (e) {
        console.error('storage get failed (api)', e);
        return null;
      }
    })();

    inFlight.set(key, p);
    try {
      const value = await p;
      recent.set(key, { at: Date.now(), value: value });
      return value;
    } finally {
      inFlight.delete(key);
    }
  }


  async function apiSet(key, value) {
    invalidate(key);
    if (key.indexOf('record_template:') === 0) swrPut('tpl:' + key.slice('record_template:'.length), value);
    let res = null;
    try {
      res = await apiFetch('/api/storage/key/' + encodeURIComponent(key), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
    } catch (e) {
      console.warn('storage set failed, queueing (api)', e);
    }
    if (res && res.ok) {
      if (queueCount()) drain();
      return true;
    }
    console.warn('storage set queued for retry:', key, res ? res.status : 'network');
    return enqueue('set', key, value);
  }

  async function apiRemove(key) {
    invalidate(key);
    if (key.indexOf('record_template:') === 0) swrPut('tpl:' + key.slice('record_template:'.length), null);
    let res = null;
    try {
      res = await apiFetch('/api/storage/key/' + encodeURIComponent(key), { method: 'DELETE' });
    } catch (e) {
      console.warn('storage remove failed, queueing (api)', e);
    }
    if (res && res.ok) {
      if (queue[key]) { delete queue[key]; updateQueueBadge(); }
      return true;
    }
    return enqueue('remove', key, null);
  }

  async function apiGetByPrefix(prefix) {
    let out = {};
    try {
      const res = await apiFetch('/api/storage/prefix/' + encodeURIComponent(prefix));
      if (res.ok) out = await res.json();
    } catch (e) {
      console.error('storage getByPrefix failed (api)', e);
    }

    // Overlay in-memory queued writes.
    Object.keys(queue).forEach(function (k) {
      if (k.indexOf(prefix) !== 0) return;
      if (queue[k].op === 'remove') delete out[k];
      else out[k] = queue[k].value;
    });
    return out;
  }


  window.storage.useBackend({
    name: 'api',
    get: apiGet,
    set: apiSet,
    remove: apiRemove,
    getByPrefix: apiGetByPrefix
  });

  // ---------- Cold-start notice (non-blocking) ----------
  // The page itself renders from cached layout, so this is only a slim strip telling staff that
  // entries are still loading / saving will wait. It never covers the form.
  let wakeEl = null;
  let wakeTimer = null;
  function showWake() {
    if (wakeEl || typeof document === 'undefined') return;
    wakeEl = document.createElement('div');
    wakeEl.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99997;background:#8a5a10;color:#fff;'
      + 'font:600 13px/1.4 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;padding:6px 16px;text-align:center;';
    wakeEl.textContent = 'Connecting to the records server… saved entries will appear shortly.';
    (document.body || document.documentElement).appendChild(wakeEl);
  }
  function hideWake() {
    clearTimeout(wakeTimer);
    if (wakeEl) { wakeEl.remove(); wakeEl = null; }
  }

  let healthy = false;
  function checkHealth(attempt) {
    fetch(API_BASE + '/api/health', { cache: 'no-store' }).then((res) => {
      if (!res.ok) throw new Error('unhealthy');
      healthy = true;
      hideWake();
      if (queueCount()) drain();
    }).catch((e) => {
      if (healthy) return;
      console.warn('facility-api unreachable (attempt ' + attempt + ') — retrying', e);
      updateQueueBadge();
      setTimeout(function () { checkHealth(attempt + 1); }, 3000);
    });
  }
  wakeTimer = setTimeout(function () { if (!healthy) showWake(); }, 1200);
  checkHealth(1);
})();
