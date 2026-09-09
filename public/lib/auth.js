(function () {


  const USERS = [
    { username: 'production_supervisor', role: 'PRODUCTION_SUPERVISOR', displayName: 'Production Supervisor' },
    { username: 'shift_manager', role: 'SHIFT_MANAGER', displayName: 'Shift Manager' },
    { username: 'quality_supervisor', role: 'QUALITY_SUPERVISOR', displayName: 'Quality Supervisor' },
    { username: 'quality_controller', role: 'QUALITY_CONTROLLER', displayName: 'Quality Controller' },
    { username: 'qa_manager', role: 'QA_MANAGER', displayName: 'QA Manager' },
    { username: 'production_manager', role: 'PRODUCTION_MANAGER', displayName: 'Production Manager' },
    { username: 'operator', role: 'OPERATOR', displayName: 'Operator' },
    { username: 'administrator', role: 'ADMINISTRATOR', displayName: 'Administrator' }
  ];

  let currentUser = null;

  const SESSION_KEY = 'processing.auth.username';

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

  function login(username, password) {

    const user = USERS.find(u => u.username === username);
    if (!user || password !== 'test') {
      return { ok: false, error: 'Invalid username or password' };
    }
    currentUser = user;
    safeSession(() => window.sessionStorage.setItem(SESSION_KEY, user.username));
    applyRole(user);

    return { ok: true, user };
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
    return USERS.map(u => ({ username: u.username, displayName: u.displayName, role: u.role }));
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

  window.Auth = {
    login,
    logout,
    getCurrentUser,
    getCurrentUsername,
    getCurrentRole,
    isAuthenticated,
    getAvailableUsers,
    createSignOff,
    USERS
  };
})();
