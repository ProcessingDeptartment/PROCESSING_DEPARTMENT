(function () {
  const PREFIX = 'facility_records:';


  const LocalBackend = {
    name: 'local',
    async get(key) {
      try {
        const raw = window.localStorage.getItem(PREFIX + key);
        return raw === null ? null : { value: raw };
      } catch (e) {
        console.error('storage get failed (local)', e);
        return null;
      }
    },
    async set(key, value) {
      try {
        window.localStorage.setItem(PREFIX + key, value);
        return true;
      } catch (e) {
        console.error('storage set failed (local)', e);
        return false;
      }
    },
    async remove(key) {
      try {
        window.localStorage.removeItem(PREFIX + key);
        return true;
      } catch (e) {
        return false;
      }
    },
    async getByPrefix(prefix) {
      const out = {};
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(PREFIX + prefix)) {
            out[k.slice(PREFIX.length)] = window.localStorage.getItem(k);
          }
        }
      } catch (e) {
        console.error('storage getByPrefix failed (local)', e);
      }
      return out;
    }
  };


  let backend = LocalBackend;


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


  function backendName() {
    return backend.name || 'custom';
  }


  async function get(key, shared) {
    return (shared === false ? LocalBackend : backend).get(key);
  }

  async function set(key, value, shared) {
    return (shared === false ? LocalBackend : backend).set(key, value);
  }

  async function remove(key, shared) {
    return (shared === false ? LocalBackend : backend).remove(key);
  }


  async function getByPrefix(prefix, shared) {
    return (shared === false ? LocalBackend : backend).getByPrefix(prefix);
  }

  window.storage = { get, set, remove, getByPrefix, useBackend, backendName, whenReady, expectBackend, backendUnavailable };
})();
