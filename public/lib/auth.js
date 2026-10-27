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

  // API base — dev server injects window.FACILITY_API_BASE; production falls back to Render URL.
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
  }

  function restoreSession() {
    const username = safeSession(() => window.sessionStorage.getItem(SESSION_KEY), null);
    if (!username) return;
    const user = USERS.find(u => u.username === username);
    if (!user) return;
    currentUser = user;
    applyRole(user);
  }

  // login() returns a Promise<{ok, user?, error?}>.
  // No-password users resolve immediately; admin password is checked server-side.
  function login(username, password) {
    const user = USERS.find(u => u.username === username.toLowerCase().trim());
    if (!user) return Promise.resolve({ ok: false, error: 'Invalid username' });

    if (user.noPassword) {
      currentUser = user;
      safeSession(() => window.sessionStorage.setItem(SESSION_KEY, user.username));
      applyRole(user);
      return Promise.resolve({ ok: true, user });
    }

    // Admin: verify password server-side.
    return fetch(apiBase() + '/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password || '' })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) return { ok: false, error: data.error || 'Incorrect password' };
        currentUser = user;
        safeSession(() => window.sessionStorage.setItem(SESSION_KEY, user.username));
        applyRole(user);
        return { ok: true, user };
      })
      .catch(function () {
        return { ok: false, error: 'Could not reach the server. Please try again.' };
      });
  }

  function logout() {
    currentUser = null;
    safeSession(() => window.sessionStorage.removeItem(SESSION_KEY));
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

  // PermissionRules may load after auth.js; re-apply the restored role once the DOM is ready.
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () { applyRole(currentUser); });
  }

  async function verifyPasskey(pin) {
    try {
      const res = await fetch(apiBase() + '/api/passkey/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: pin })
      });
      const data = await res.json();
      return !!data.ok;
    } catch (e) {
      return false;
    }
  }

  window.Auth = {
    login,
    logout,
    getCurrentUser,
    getCurrentUsername,
    getCurrentRole,
    isAuthenticated,
    getAvailableUsers,
    createSignOff,
    verifyPasskey,
    USERS
  };
})();
