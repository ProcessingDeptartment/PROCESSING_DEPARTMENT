// public/lib/access-control.js  v5
// Home-page visibility and within-page access enforcement.
// Config: { ROLE_KEY: { pageId: 'edit' | 'read' | false } }
// Before passkey unlock, non-admin users see only the default pages.
// After passkey unlock, configured access is applied (or full access if no config exists).
// Administrators bypass all restrictions.
(function () {
  'use strict';

  var _config = null;
  var _unlocked = false;
  var _unlockedRole = null;

  // Maps passkey title to role key (must match the server's passkey role map).
  var TITLE_TO_ROLE = {
    'Supervisor': 'PRODUCTION_SUPERVISOR',
    'Shift Manager': 'SHIFT_MANAGER',
    'Quality Supervisor': 'QUALITY_SUPERVISOR',
    'Quality Controller': 'QUALITY_CONTROLLER',
    'QA Manager': 'QA_MANAGER',
    'Production Manager': 'PRODUCTION_MANAGER',
    'Operator': 'OPERATOR',
    'Admin': 'ADMIN',
    'Administrator': 'ADMINISTRATOR'
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
    return /ADMIN(ISTRATOR)?$/.test(currentRole());
  }

  function loadConfig() {
    if (_config !== null) return Promise.resolve(_config);
    return fetch(apiBase() + '/api/access-control/public', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { _config = d.config || {}; return _config; })
      .catch(function () { _config = {}; return _config; });
  }

  function normalise(val) {
    if (val === 'edit' || val === true) return 'edit';
    if (val === 'read') return 'read';
    return 'none';
  }

  function getAccess(pageId) {
    var role = currentRole();
    if (!role) return 'none';
    if (isAdmin()) return 'edit';

    if (!_unlocked) return DEFAULT_VISIBLE[pageId] ? 'edit' : 'none';

    var effectiveRole = _unlockedRole || role;
    if (effectiveRole === 'ADMINISTRATOR' || /ADMIN(ISTRATOR)?$/.test(effectiveRole)) return 'edit';
    if (!_config || !_config[effectiveRole]) return 'edit';

    var rules = _config[effectiveRole];
    var hasAny = Object.keys(rules).some(function (k) {
      return rules[k] && rules[k] !== 'none';
    });
    if (!hasAny) return 'edit';

    return normalise(rules[pageId]);
  }

  function applyRules() {
    var role = currentRole();
    if (!role) return;

    if (isAdmin()) {
      var adminUnlockRow = document.getElementById('passkeyUnlockRow');
      if (adminUnlockRow) adminUnlockRow.style.display = 'none';
      document.querySelectorAll('[data-page-id]').forEach(function (el) {
        if (el.style.display === 'none') el.style.display = '';
        el.setAttribute('data-access', 'edit');
      });
      return;
    }

    document.querySelectorAll('[data-page-id]').forEach(function (el) {
      var id = el.getAttribute('data-page-id');
      var access = getAccess(id);
      if (access === 'none') {
        el.style.display = 'none';
        el.removeAttribute('data-access');
      } else {
        if (el.style.display === 'none') el.style.display = '';
        el.setAttribute('data-access', access);
      }
    });

    // The row is CSS-hidden by default. Set an explicit display value so it
    // appears for authenticated non-admin users until they unlock with a passkey.
    var unlockRow = document.getElementById('passkeyUnlockRow');
    if (unlockRow) unlockRow.style.display = _unlocked ? 'none' : 'block';
  }

  function run() {
    loadConfig().then(function () { applyRules(); });
  }

  // Keep the existing unlock call contract: the verifier may pass the passkey
  // title returned by the API, or null when the response has no title.
  function unlockForSession(title) {
    _unlocked = true;
    _unlockedRole = (title && TITLE_TO_ROLE[title.trim()]) || _unlockedRole || currentRole();
    run();
  }

  window.AccessControl = {
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
    apply: run,
    getAccess: getAccess,
    isReadOnly: function (pageId) { return getAccess(pageId) === 'read'; },
    canEdit: function (pageId) { return getAccess(pageId) === 'edit'; },
    unlockForSession: unlockForSession,
    isUnlocked: function () { return _unlocked; }
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (window.Auth && window.Auth.isAuthenticated()) run();
  });

  document.addEventListener('authSuccess', function () {
    _config = null;
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
