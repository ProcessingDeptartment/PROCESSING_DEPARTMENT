(function () {
  const API_BASE = window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com';


  if (window.storage && window.storage.expectBackend) window.storage.expectBackend();
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
  if (!STORE.durable) console.warn('[api-backend] no persistent storage on this device — offline saves cannot be queued');


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


  const QUEUE_STORE = 'facility_api_queue';
  let draining = false;

  function loadQueue() {
    try { return JSON.parse(STORE.s.getItem(QUEUE_STORE) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveQueue(q) {
    try { STORE.s.setItem(QUEUE_STORE, JSON.stringify(q)); return true; }
    catch (e) { console.error('write queue could not be persisted', e); return false; }
  }
  function queueCount() { return Object.keys(loadQueue()).length; }


  function enqueue(op, key, value) {
    if (!STORE.durable) {
      showNoStorageBanner();
      return false;
    }
    const q = loadQueue();
    q[key] = { op: op, value: value, ts: Date.now() };
    const ok = saveQueue(q);
    if (!ok) showNoStorageBanner();
    updateQueueBadge();
    return ok;
  }

  let noStorageShown = false;
  function showNoStorageBanner() {
    if (noStorageShown || typeof document === 'undefined' || !document.body) return;
    noStorageShown = true;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#9c241d;color:#fff;'
      + 'font:600 14px/1.4 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;padding:11px 16px;'
      + 'display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center;';
    el.textContent = 'The records database is unreachable and this device cannot store work offline '
      + '(private window, or browser storage is blocked). Nothing was saved — reconnect, or use a '
      + 'different device, before re-entering this record.';
    document.body.appendChild(el);
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
      + ' saved on this device and waiting to sync. Leave this page open until it clears.';
  }


  async function drain() {
    if (draining) return;
    draining = true;
    try {
      const q = loadQueue();
      const keys = Object.keys(q).sort((a, b) => q[a].ts - q[b].ts);
      for (const key of keys) {
        const item = q[key];
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

        const latest = loadQueue();
        if (latest[key] && latest[key].ts === item.ts) { delete latest[key]; saveQueue(latest); }
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


  const TTL_MS = 2000;
  const inFlight = new Map();
  const recent = new Map();

  function invalidate(key) {
    recent.delete(key);
    inFlight.delete(key);
  }

  async function apiGet(key) {

    const q = loadQueue();
    if (q[key]) return q[key].op === 'remove' ? null : { value: q[key].value };

    const hit = recent.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

    const pending = inFlight.get(key);
    if (pending) return pending;

    const p = (async function () {
      try {
        const res = await apiFetch('/api/storage/key/' + encodeURIComponent(key));
        if (!res.ok) return null;
        return await res.json();
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
    let res = null;
    try {
      res = await apiFetch('/api/storage/key/' + encodeURIComponent(key), { method: 'DELETE' });
    } catch (e) {
      console.warn('storage remove failed, queueing (api)', e);
    }
    if (res && res.ok) {
      const q = loadQueue();
      if (q[key]) { delete q[key]; saveQueue(q); updateQueueBadge(); }
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

    const q = loadQueue();
    Object.keys(q).forEach(function (k) {
      if (k.indexOf(prefix) !== 0) return;
      if (q[k].op === 'remove') delete out[k];
      else out[k] = q[k].value;
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

  fetch(API_BASE + '/api/health').then((res) => {
    if (!res.ok) throw new Error('unhealthy');
    if (queueCount()) drain();
  }).catch((e) => {
    console.warn('facility-api unreachable — writes will queue until it returns', e);
    updateQueueBadge();
  });
})();
