(function () {

  const USERS = [
    { username: 'supervisor',          role: 'PRODUCTION_SUPERVISOR', displayName: 'Supervisor',          noPassword: true },
    { username: 'shift manager',       role: 'SHIFT_MANAGER',         displayName: 'Shift Manager',       noPassword: true },
    { username: 'quality supervisor',  role: 'QUALITY_SUPERVISOR',    displayName: 'Quality Supervisor',  noPassword: true },
    { username: 'quality controller',  role: 'QUALITY_CONTROLLER',    displayName: 'Quality Controller',  noPassword: true },
    { username: 'qa manager',          role: 'QA_MANAGER',            displayName: 'QA Manager',          noPassword: true },
    { username: 'production manager',  role: 'PRODUCTION_MANAGER',    displayName: 'Production Manager',  noPassword: true },
    { username: 'operator',            role: 'OPERATOR',              displayName: 'Operator',            noPassword: true },
    { username: 'admin',               role: 'ADMIN',                 displayName: 'Admin',               noPassword: true },
    { username: 'administrator',       role: 'ADMINISTRATOR',         displayName: 'Administrator' }
  ];

  let currentUser = null;

  const SESSION_KEY = 'processing.auth.username';
  const AUTH_CHANNEL = 'processing.auth.channel';

  function apiBase() {
    return (window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com').replace(/\/$/, '');
  }

  function safeSession(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  function applyRole(user) {
    if (user && window.PermissionRules) {
      window.PermissionRules.setCurrentRole(user.role);
    }
    window.__currentUserRole = user ? user.username : '';
    window.__currentUserRoleKey = user ? user.role : '';
    window.__currentUserName = user ? user.displayName : '';
  }

  // Listen for auth requests from other tabs and broadcast logouts.
  function initChannel() {
    if (!window.BroadcastChannel) return;
    const ch = new BroadcastChannel(AUTH_CHANNEL);
    ch.onmessage = function (e) {
      if (e.data.type === 'AUTH_REQUEST' && currentUser) {
        ch.postMessage({ type: 'AUTH_RESPONSE', username: currentUser.username });
      } else if (e.data.type === 'AUTH_LOGOUT') {
        currentUser = null;
        safeSession(() => window.sessionStorage.removeItem(SESSION_KEY));
        applyRole(null);
      }
    };
  }

  // Broadcast current login state to any tab that just asked.
  function broadcastLogin(username) {
    if (!window.BroadcastChannel) return;
    const ch = new BroadcastChannel(AUTH_CHANNEL);
    ch.postMessage({ type: 'AUTH_RESPONSE', username });
    ch.close();
  }

  function broadcastLogout() {
    if (!window.BroadcastChannel) return;
    const ch = new BroadcastChannel(AUTH_CHANNEL);
    ch.postMessage({ type: 'AUTH_LOGOUT' });
    ch.close();
  }

  // Sync restore from sessionStorage (runs at load time).
  function restoreSession() {
    const username = safeSession(() => window.sessionStorage.getItem(SESSION_KEY), null);
    if (!username) return;
    const user = USERS.find(u => u.username === username);
    if (!user) return;
    currentUser = user;
    applyRole(user);
  }

  // Async restore: if sessionStorage is empty, ask other tabs via BroadcastChannel.
  // Resolves true if session was restored, false if not.
  function restoreSessionAsync() {
    if (currentUser) return Promise.resolve(true);
    if (!window.BroadcastChannel) return Promise.resolve(false);
    return new Promise(function (resolve) {
      const ch = new BroadcastChannel(AUTH_CHANNEL);
      let done = false;
      ch.onmessage = function (e) {
        if (e.data.type === 'AUTH_RESPONSE' && !done) {
          done = true;
          ch.close();
          const user = USERS.find(u => u.username === e.data.username);
          if (user) {
            currentUser = user;
            safeSession(() => window.sessionStorage.setItem(SESSION_KEY, user.username));
            applyRole(user);
            resolve(true);
          } else {
            resolve(false);
          }
        }
      };
      ch.postMessage({ type: 'AUTH_REQUEST' });
      setTimeout(function () {
        if (!done) { done = true; ch.close(); resolve(false); }
      }, 300);
    });
  }

  function _setUser(user) {
    currentUser = user;
    safeSession(() => window.sessionStorage.setItem(SESSION_KEY, user.username));
    applyRole(user);
    broadcastLogin(user.username);
  }

  function login(username, password) {
    const user = USERS.find(u => u.username === username.toLowerCase().trim());
    if (!user) return Promise.resolve({ ok: false, error: 'Invalid username' });

    if (user.noPassword) {
      _setUser(user);
      return Promise.resolve({ ok: true, user });
    }

    return fetch(apiBase() + '/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password || '' })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) return { ok: false, error: data.error || 'Incorrect password' };
        _setUser(user);
        return { ok: true, user };
      })
      .catch(function () {
        return { ok: false, error: 'Could not reach the server. Please try again.' };
      });
  }

  function logout() {
    currentUser = null;
    safeSession(() => window.sessionStorage.removeItem(SESSION_KEY));
    broadcastLogout();
  }

  function getCurrentUser() {
    return currentUser;
  }

  function getCurrentUsername() {
    return currentUser ? currentUser.displayName : null;
  }

  function getCurrentRole() {
    return currentUser ? currentUser.role : null;
  }

  function isAuthenticated() {
    return currentUser !== null;
  }

  function getAvailableUsers() {
    return USERS.map(u => ({ username: u.username, displayName: u.displayName, role: u.role, noPassword: !!u.noPassword }));
  }

  function createSignOff(action) {
    if (!currentUser) return null;
    return {
      action: action,
      by: currentUser.displayName,
      byRole: currentUser.role,
      at: new Date().toISOString(),
      timestamp: Date.now()
    };
  }

  restoreSession();
  initChannel();

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () { applyRole(currentUser); });
  }

  async function verifyPasskey(pin) {
    try {
      const opts = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passkey: pin,
          role: currentUser ? currentUser.role : ''
        })
      };
      const res = (window.FacilityApi && window.FacilityApi.fetch)
        ? await window.FacilityApi.fetch('/api/passkey/verify', opts)
        : await fetch(apiBase() + '/api/passkey/verify', opts);
      const data = await res.json().catch(function () { return {}; });
      return res.ok && (data.success === true || data.ok === true || data.valid === true || data.username != null);
    } catch (e) {
      return false;
    }
  }

  // Maps passkey title → role key (mirrors ROLE_MAP in src/passkeys.js)
  const TITLE_TO_ROLE = {
    'Supervisor':          'PRODUCTION_SUPERVISOR',
    'Shift Manager':       'SHIFT_MANAGER',
    'Quality Supervisor':  'QUALITY_SUPERVISOR',
    'Quality Controller':  'QUALITY_CONTROLLER',
    'QA Manager':          'QA_MANAGER',
    'Production Manager':  'PRODUCTION_MANAGER',
    'Operator':            'OPERATOR',
    'Admin':               'ADMIN',
    'Administrator':       'ADMINISTRATOR',
  };

  // Log in using the result object from PasskeyInput.openForApproval()
  // result = { displayName, title }
  function loginByPasskeyResult(result) {
    if (!result || !result.title) return { ok: false, error: 'No title returned from passkey' };
    const role = TITLE_TO_ROLE[result.title.trim()] || null;
    // Find matching USERS entry by role, or fall back to a synthetic user
    const user = (role ? USERS.find(u => u.role === role) : null) ||
                 { username: result.displayName.toLowerCase(), role: role || result.title, displayName: result.displayName, noPassword: true };
    _setUser(user);
    return { ok: true, user };
  }

  window.Auth = {
    login,
    logout,
    loginByPasskeyResult,
    getCurrentUser,
    getCurrentUsername,
    getCurrentRole,
    isAuthenticated,
    restoreSessionAsync,
    getAvailableUsers,
    createSignOff,
    verifyPasskey,
    USERS
  };
})();
