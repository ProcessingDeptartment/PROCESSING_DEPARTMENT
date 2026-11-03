// public/lib/access-control.js  v5
// ─────────────────────────────────────────────────────────────────────────────
// Home-page visibility + within-page access enforcement.
//
// Config shape (stored in API / returned by /api/access-control/public):
//   { ROLE_KEY: { pageId: 'edit' | 'read' | false } }
//
//   'edit'  – visible, fully editable
//   'read'  – visible, read-only (pages should check AccessControl.isReadOnly())
//   false   – hidden (not shown on the home page)
//   absent  – treated same as false
//
// DEFAULT behaviour for any non-admin role:
//   • Before passkey unlock  → only 'records' and 'verifications' are visible
//   • After passkey unlock   → configured access (or full access if no config set)
//
// Administrators always bypass all restrictions.
//
// API:
//   AccessControl.getAccess(pageId)  → 'edit' | 'read' | 'none'
//   AccessControl.isReadOnly(pageId) → bool
//   AccessControl.canEdit(pageId)    → bool
//   AccessControl.unlockForSession() → call after successful passkey verify
//   AccessControl.isUnlocked()       → bool
//   AccessControl.apply()            → re-apply rules (called after login)
//   AccessControl.getConfig()        → Promise<config>   (admin use)
//   AccessControl.saveConfig(config) → Promise<result>   (admin use; passkey handled by caller)
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  var _config = null;      // { ROLE_KEY: { pageId: 'edit'|'read'|false } }
  var _unlocked = false;   // true after the user has verified their passkey this session
  var _unlockedRole = null; // role key resolved from the verified passkey's title

  // Maps passkey title → role key (must match passkeys.js ROLE_MAP on the server)
  var TITLE_TO_ROLE = {
    'Supervisor':         'PRODUCTION_SUPERVISOR',
    'Shift Manager':      'SHIFT_MANAGER',
    'Quality Supervisor': 'QUALITY_SUPERVISOR',
    'Quality Controller': 'QUALITY_CONTROLLER',
    'QA Manager':         'QA_MANAGER',
    'Production Manager': 'PRODUCTION_MANAGER',
    'Operator':           'OPERATOR',
    'Admin':              'ADMIN',
    'Administrator':      'ADMINISTRATOR',
  };

  // Pages visible before passkey unlock for any non-admin role.
  var DEFAULT_VISIBLE = { records: true, verifications: true, handovers: true, 'seam-calculator': true };

  function apiBase() {
    return (window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com').replace(/\/$/, '');
  }

  function currentRole() {
    return window.__currentUserRoleKey || '';
  }

  function isAdmin() {
    var r = currentRole();
    return /ADMIN(ISTRATOR)?$/.test(r);
  }

  // ── Fetch public config ────────────────────────────────────────────────────
  function loadConfig() {
    if (_config !== null) return Promise.resolve(_config);
    return fetch(apiBase() + '/api/access-control/public', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { _config = d.config || {}; return _config; })
      .catch(function () { _config = {}; return _config; });
  }

  // Normalise a raw config value to 'edit' | 'read' | 'none'
  function normalise(val) {
    if (val === 'edit' || val === true) return 'edit';
    if (val === 'read') return 'read';
    return 'none';
  }

  // ── Core access logic ──────────────────────────────────────────────────────
  // Returns 'edit' | 'read' | 'none' for the current user + given page.
  function getAccess(pageId) {
    var role = currentRole();
    if (!role) return 'none';
    if (isAdmin()) return 'edit';

    if (!_unlocked) {
      // Pre-unlock: only the default pages are accessible
      return DEFAULT_VISIBLE[pageId] ? 'edit' : 'none';
    }

    // Post-unlock: use the passkey's resolved role (not the login role) for config lookup
    var effectiveRole = _unlockedRole || role;

    // If the passkey owner is Administrator, grant full access
    if (effectiveRole === 'ADMINISTRATOR' || /ADMIN(ISTRATOR)?$/.test(effectiveRole)) return 'edit';

    // Post-unlock: use configured restrictions
    if (!_config || !_config[effectiveRole]) {
      // No config = unrestricted for this role (after unlock)
      return 'edit';
    }

    var rules = _config[effectiveRole];
    // If no page has a non-false value, treat as unrestricted
    var hasAny = Object.keys(rules).some(function (k) {
      return rules[k] && rules[k] !== 'none';
    });
    if (!hasAny) return 'edit';

    return normalise(rules[pageId]);
  }

  // ── Apply visibility rules to [data-page-id] elements ─────────────────────
  function applyRules(config) {
    var role = currentRole();
    if (!role) return;
    if (isAdmin()) {
      // Admins see everything — show all data-page-id elements and hide the unlock row
      var ur = document.getElementById('passkeyUnlockRow');
      if (ur) ur.style.display = 'none';
      document.querySelectorAll('[data-page-id]').forEach(function (el) {
        if (el.style.display === 'none') el.style.display = '';
        el.setAttribute('data-access', 'edit');
      });
      return;
    }

    var elements = document.querySelectorAll('[data-page-id]');
    elements.forEach(function (el) {
      var id = el.getAttribute('data-page-id');
      var access = getAccess(id);

      if (access === 'none') {
        el.style.display = 'none';
        el.removeAttribute('data-access');
      } else {
        // Keep display managed by existing auth-only / admin-only CSS classes;
        // only override if we hid it ourselves.
        if (el.style.display === 'none') el.style.display = '';
        el.setAttribute('data-access', access);
      }
    });

    // Show/hide the passkey unlock row
    var unlockRow = document.getElementById('passkeyUnlockRow');
    if (unlockRow) {
      unlockRow.style.display = _unlocked ? 'none' : '';
    }
  }

  function run() {
    loadConfig().then(function (cfg) { applyRules(cfg); });
  }

  // Call this after the user has successfully verified their passkey.
  // title: the passkey's title field returned by the server (e.g. 'Supervisor', 'Administrator')
  // Access is granted based on the PASSKEY's role, not the logged-in click-login role.
  function unlockForSession(title) {
    _unlocked = true;
    _unlockedRole = (title && TITLE_TO_ROLE[title.trim()]) || _unlockedRole || currentRole();
    run();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.AccessControl = {
    // Admin CRUD (passkey verification is the caller's responsibility)
    getConfig: function () {
      return fetch(apiBase() + '/api/admin/access-control', {
        headers: { 'x-role': currentRole(), 'x-user': window.__currentUserName || '' }
      }).then(function (r) { return r.json(); });
    },
    saveConfig: function (config) {
      return fetch(apiBase() + '/api/admin/access-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': currentRole(),
          'x-user': window.__currentUserName || ''
        },
        body: JSON.stringify({ config: config })
      }).then(function (r) { return r.json(); });
    },

    // Runtime
    apply: run,
    getAccess: getAccess,
    isReadOnly: function (pageId) { return getAccess(pageId) === 'read'; },
    canEdit: function (pageId) { return getAccess(pageId) === 'edit'; },
    unlockForSession: unlockForSession,
    isUnlocked: function () { return _unlocked; }
  };

  // ── Auto-run ───────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    if (window.Auth && window.Auth.isAuthenticated()) run();
  });

  document.addEventListener('authSuccess', function () {
    _config = null;        // clear cache so re-fetch picks up any changes
    _unlocked = false;
    _unlockedRole = null;
    run();
  });

  document.addEventListener('authLogout', function () {
    _unlocked = false;
    _unlockedRole = null;
    run();
  });

})();
