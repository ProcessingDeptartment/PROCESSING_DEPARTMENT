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

  // Tell data-store to hold whenReady() until the health check below resolves, so pages that read
  // on load don't race it and mistake an empty localStorage for an empty database.
  if (window.storage && window.storage.expectBackend) window.storage.expectBackend();
  const KEY_STORE = 'facility_api_key';

  /* Not every device gives us localStorage -- private windows, locked-down browsers and a full
   * quota all block it. Degrade localStorage -> sessionStorage -> memory rather than break.
   * `durable` is the part that matters: it says whether what we store survives a page reload.
   * The access key can live in memory (worst case it's re-entered each session), but the write
   * queue CANNOT -- telling someone their record is "waiting to sync" when a refresh would
   * evaporate it is worse than refusing the save outright. See enqueue(). */
  const memStore = {};
  function pickStore() {
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        const s = window[name];
        s.setItem('__probe__', '1');
        s.removeItem('__probe__');
        return { s: s, durable: true, name: name };
      } catch (e) { /* blocked or full -- try the next one */ }
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

  // The access key is per-device, entered once (see pages/api-key.html), never in the repo.
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

  /* ---- write-ahead queue ----------------------------------------------------------------------
   * Factory wifi drops. Before this, a write that failed fell back to localStorage and reported
   * "Draft saved" -- the record looked captured but was stranded on one tablet, which is exactly
   * how a pile of orphaned local keys accumulates. Now a failed write goes into a durable outbox
   * and replays when the connection returns.
   *
   * COLLAPSED BY KEY, LAST WRITE WINS. Both engines persist the WHOLE submissions array for a
   * record on every save, so an older queued write for the same key is not a missing change -- it
   * is a strictly older copy of the same array. Keeping only the newest is both correct and what
   * stops the queue growing without bound over a long shift.
   *
   * READS OVERLAY THE QUEUE. Otherwise you save while offline, the list re-reads from the API, and
   * your own entry vanishes until it syncs. Since a queued value is the complete current state of
   * that key, serving it back is exactly right.
   *
   * This is an outbox, not an offline cache: records saved on another device while this one is
   * offline are still not readable until the connection returns. */
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

  // Returns false when the write could not be made durable -- the caller must then report a real
  // failure rather than a false "saved". On a device with no persistent storage that is every
  // offline write, which is the honest answer: we cannot promise to deliver it later.
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

  // Replays the outbox oldest-first. Stops at the first failure so a still-down API doesn't burn
  // through every entry, and so ordering is preserved.
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
        // Re-read: a newer save for this key may have landed while the request was in flight.
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

  async function apiGet(key) {
    // A queued write is the newest state of this key -- serve it rather than the API's older copy.
    const q = loadQueue();
    if (q[key]) return q[key].op === 'remove' ? null : { value: q[key].value };
    try {
      const res = await apiFetch('/api/storage/key/' + encodeURIComponent(key));
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('storage get failed (api)', e);
      return null;
    }
  }

  // Returns true once the write is durable -- either accepted by the API, or safely in the outbox.
  // Only a queue that can't even be persisted counts as a real failure the caller must surface.
  async function apiSet(key, value) {
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
      // Opportunistic: the connection is clearly up, so flush anything waiting behind this.
      if (queueCount()) drain();
      return true;
    }
    console.warn('storage set queued for retry:', key, res ? res.status : 'network');
    return enqueue('set', key, value);
  }

  async function apiRemove(key) {
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
    // Overlay pending writes so a record saved while offline still appears in its own list.
    const q = loadQueue();
    Object.keys(q).forEach(function (k) {
      if (k.indexOf(prefix) !== 0) return;
      if (q[k].op === 'remove') delete out[k];
      else out[k] = q[k].value;
    });
    return out;
  }

  /* Register unconditionally -- including when the API is unreachable.
   *
   * This used to fall back to localStorage on a failed health check, so an outage quietly turned
   * every save into a device-local write that reported success and was then stranded there. With
   * the outbox above, staying registered is the safer behaviour: writes queue durably, the badge
   * says so, and they replay on reconnect. The health check now only decides whether to attempt an
   * immediate drain, not whether the backend is used at all. */
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
