/*
 * User authentication and session management for the online records system.
 *
 * Each user has a role (from PermissionRules) and a password (currently = username).
 * Login is required to save records. Sign-off and verification track who took action
 * and when, automatically populated from the authenticated session.
 *
 * === LOCAL SESSION ONLY ===
 * Session is stored in localStorage (sessionKey); users exist in memory. A future
 * backend auth (OAuth, LDAP, or a real auth API) would replace the hardcoded
 * users list and password check without changing any record code—just call
 * Auth.logout() on auth failure and Auth.setCurrentUser() on successful login.
 */
(function () {
  const SESSION_KEY = 'auth_session';

  // Users list: each role gets one user with username = role slug, password = username
  // Future: these come from an auth provider (LDAP, Okta, etc.)
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

  // Load session from localStorage on init
  function restoreSession() {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        currentUser = USERS.find(u => u.username === data.username);
        if (currentUser && window.PermissionRules) {
          window.PermissionRules.setCurrentRole(currentUser.role);
        }
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
    }
  }

  function login(username, password) {
    // For now: password = username. Future: call an auth API.
    const user = USERS.find(u => u.username === username);
    if (!user || password !== username) {
      return { ok: false, error: 'Invalid username or password' };
    }
    currentUser = user;
    if (window.PermissionRules) {
      window.PermissionRules.setCurrentRole(user.role);
    }
    // Persist session
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username }));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
    return { ok: true, user };
  }

  function logout() {
    currentUser = null;
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
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

  // Create a sign-off record (used by records on save)
  function createSignOff(action) {
    if (!currentUser) return null;
    return {
      action: action, // 'signed_off', 'verified', etc.
      by: currentUser.displayName,
      byRole: currentUser.role,
      at: new Date().toISOString(),
      timestamp: Date.now()
    };
  }

  // Restore session immediately on load
  restoreSession();

  window.Auth = {
    login,
    logout,
    getCurrentUser,
    getCurrentUsername,
    getCurrentRole,
    isAuthenticated,
    getAvailableUsers,
    createSignOff,
    USERS // Export for testing
  };
})();
