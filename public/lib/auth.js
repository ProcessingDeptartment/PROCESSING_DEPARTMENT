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

  function restoreSession() {
    const username = safeSession(() => window.sessionStorage.getItem(SESSION_KEY), null);
    if (!username) return;
    const user = USERS.find(u => u.username === username);
    if (!user) return;
    currentUser = user;
    applyRole(user);
  }

  function login(username, password) {
    const user = USERS.find(u => u.username === username.toLowerCase().trim());
    if (!user) return Promise.resolve({ ok: false, error: 'Invalid username' });

    if (user.noPassword) {
      currentUser = user;
      safeSession(() => window.sessionStorage.setItem(SESSION_KEY, user.username));
      applyRole(user);
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
