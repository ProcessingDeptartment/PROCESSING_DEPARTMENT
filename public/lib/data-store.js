/*
 * Shared storage adapter for online records.
 *
 * Every record calls window.storage.get(key, shared) / window.storage.set(key, value, shared)
 * / window.storage.remove(key) with this exact signature. Nothing in any record file talks to
 * localStorage or Supabase directly -- they only ever go through window.storage -- so this is
 * the single place that decides where facility data actually lives.
 *
 * === HOW IT ROUTES ===
 *   shared === false  ->  browser localStorage  (per-device state, never leaves this machine)
 *   shared !== false  ->  Supabase              (facility-wide record data, shared across devices)
 *
 * Today every record passes shared:true for its actual submissions/specs/revisions, so those all
 * land in Supabase. Per-device state (the "Acting as" role) is written straight to localStorage by
 * permission-rules.js and never comes through here, so it correctly stays local.
 *
 * === SETUP (see SUPABASE_SETUP.md) ===
 * Fill in the two constants below with your Supabase project's URL and anon (public) key.
 * The anon key is DESIGNED to be public and shipped in client code -- security comes from the
 * Row Level Security policies in supabase/schema.sql, not from hiding this key.
 *
 * Until both constants are filled in, this adapter transparently falls back to localStorage, so the
 * whole site keeps working exactly as before while Supabase is being provisioned. A one-time console
 * warning tells you it is running in local-only mode.
 */
(function () {
  // ------------------------------------------------------------------ CONFIG
  // Paste your project values here (Supabase dashboard -> Project Settings -> API).
  const SUPABASE_URL = 'YOUR_SUPABASE_URL';        // e.g. https://abcdefgh.supabase.co
  const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
  const TABLE = 'kv_store';
  // -------------------------------------------------------------------------

  const PREFIX = 'facility_records:';
  const configured =
    SUPABASE_URL && SUPABASE_ANON_KEY &&
    SUPABASE_URL.indexOf('YOUR_') !== 0 && SUPABASE_ANON_KEY.indexOf('YOUR_') !== 0;

  if (!configured) {
    console.warn(
      '[data-store] Supabase is not configured yet -- running in local-only mode ' +
      '(data stays in this browser). See SUPABASE_SETUP.md to connect the shared backend.'
    );
  }

  // ------------------------------------------------------- localStorage (per-device)
  function localGet(key) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw === null ? null : { value: raw };
    } catch (e) {
      console.error('storage get failed (local)', e);
      return null;
    }
  }
  function localSet(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, value);
      return true;
    } catch (e) {
      console.error('storage set failed (local)', e);
      return false;
    }
  }
  function localRemove(key) {
    try {
      window.localStorage.removeItem(PREFIX + key);
      return true;
    } catch (e) {
      return false;
    }
  }

  // -------------------------------------------------------------- Supabase client
  // Lazily loaded once, the first time facility-wide data is touched. Cached as a promise so
  // concurrent callers share a single client instance and a single network import.
  let clientPromise = null;
  function getClient() {
    if (!clientPromise) {
      clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
        .then(function (mod) {
          return mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false }
          });
        });
    }
    return clientPromise;
  }

  async function remoteGet(key) {
    const supabase = await getClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data ? { value: data.value } : null;
  }

  async function remoteSet(key, value) {
    const supabase = await getClient();
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key: key, value: value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    return true;
  }

  async function remoteRemove(key) {
    const supabase = await getClient();
    const { error } = await supabase.from(TABLE).delete().eq('key', key);
    if (error) throw error;
    return true;
  }

  // ----------------------------------------------------------------- public API
  async function get(key, shared) {
    if (!configured || shared === false) return localGet(key);
    try {
      return await remoteGet(key);
    } catch (e) {
      console.error('storage get failed (supabase)', e);
      return null;
    }
  }

  async function set(key, value, shared) {
    if (!configured || shared === false) return localSet(key, value);
    try {
      return await remoteSet(key, value);
    } catch (e) {
      console.error('storage set failed (supabase)', e);
      return false;
    }
  }

  async function remove(key, shared) {
    if (!configured || shared === false) return localRemove(key);
    try {
      return await remoteRemove(key);
    } catch (e) {
      console.error('storage remove failed (supabase)', e);
      return false;
    }
  }

  window.storage = { get, set, remove };
})();
