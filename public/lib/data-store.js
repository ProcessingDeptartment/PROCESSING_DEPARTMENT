/*
 * Shared storage adapter for online records.
 *
 * Every record calls window.storage.get(key, shared) / window.storage.set(key, value, shared)
 * with this exact signature. Today it is backed by the browser's localStorage so that
 * save/find/history functionality genuinely works end-to-end while the real backend
 * (Express + Prisma, see src/index.ts) is still being built out.
 *
 * === SWAP POINT ===
 * When the server-side store is ready, replace the two function bodies below with
 * fetch() calls against the backend (e.g. GET/PUT `/kv/:key`). No record file needs to
 * change, because they only ever talk to window.storage, never to localStorage directly.
 * The `shared` flag is kept in the signature now so that distinction (per-user vs
 * facility-wide data) is already threaded through the API when that swap happens.
 */
(function () {
  const PREFIX = 'facility_records:';

  async function get(key, shared) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw === null ? null : { value: raw };
    } catch (e) {
      console.error('storage get failed', e);
      return null;
    }
  }

  async function set(key, value, shared) {
    try {
      window.localStorage.setItem(PREFIX + key, value);
      return true;
    } catch (e) {
      console.error('storage set failed', e);
      return false;
    }
  }

  async function remove(key) {
    try {
      window.localStorage.removeItem(PREFIX + key);
      return true;
    } catch (e) {
      return false;
    }
  }

  window.storage = { get, set, remove };
})();
