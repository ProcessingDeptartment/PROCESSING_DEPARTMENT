/*
 * Real backend for window.storage (see BACKEND_INTEGRATION.md).
 *
 * Talks to the Express API in src/index.ts, which persists to a SQLite file via Prisma.
 * Load this AFTER data-store.js on any page that should use the shared backend instead
 * of localStorage. Never throws -- failures are swallowed and logged, per the contract.
 */
(function () {
  const API_BASE = window.FACILITY_API_BASE || '';

  async function apiGet(key) {
    try {
      const res = await fetch(API_BASE + '/api/storage/key/' + encodeURIComponent(key));
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('storage get failed (api)', e);
      return null;
    }
  }

  async function apiSet(key, value) {
    try {
      const res = await fetch(API_BASE + '/api/storage/key/' + encodeURIComponent(key), {
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
      const res = await fetch(API_BASE + '/api/storage/key/' + encodeURIComponent(key), {
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
      const res = await fetch(API_BASE + '/api/storage/prefix/' + encodeURIComponent(prefix));
      if (!res.ok) return {};
      return await res.json();
    } catch (e) {
      console.error('storage getByPrefix failed (api)', e);
      return {};
    }
  }

  window.storage.useBackend({
    name: 'api',
    get: apiGet,
    set: apiSet,
    remove: apiRemove,
    getByPrefix: apiGetByPrefix
  });
})();
