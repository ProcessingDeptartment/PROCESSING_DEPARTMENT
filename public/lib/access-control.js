// public/lib/access-control.js
// Reads the access-control config from the API and hides nav blocks/rows
// on the home page (index.html) for the current user's role.
//
// Page elements that should be access-controlled must have:
//   data-page-id="some-page-key"
//
// The access config has the shape:
//   { ROLE_KEY: { "page-key": true } }   <- true = visible, absent/false = hidden
//
// If a role has NO entry in the config at all, all pages remain visible (default open).
// If a role has an entry, only pages listed as true are shown; all others are hidden.
//
// ADMINISTRATOR role is always fully visible and cannot be restricted.

(function () {
  'use strict';

  var _config = null;   // { ROLE_KEY: { pageId: bool } }
  var _applied = false;

  function apiBase() {
    return (window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com').replace(/\/$/, '');
  }

  function currentRole() {
    return window.__currentUserRoleKey || '';
  }

  // Fetch config from API (or local cache).
  function loadConfig() {
    if (_config !== null) return Promise.resolve(_config);
    return fetch(apiBase() + '/api/access-control/public', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { _config = d.config || {}; return _config; })
      .catch(function () { _config = {}; return _config; });
  }

  // Apply visibility rules to all [data-page-id] elements.
  function applyRules(config) {
    var role = currentRole();
    if (!role || /ADMIN/i.test(role)) return;   // admins see everything

    var rules = config[role];
    if (!rules || typeof rules !== 'object') return;   // no entry = no restriction

    // Are ANY pages explicitly enabled? If all are false/absent, assume no restriction applied yet.
    var hasAnyEnabled = Object.values(rules).some(Boolean);
    if (!hasAnyEnabled) return;   // empty ruleset treated as "unrestricted"

    var elements = document.querySelectorAll('[data-page-id]');
    elements.forEach(function (el) {
      var id = el.getAttribute('data-page-id');
      if (!rules[id]) {
        // Hide the element. For table rows use display:none; for blocks use visibility:hidden
        // then also set display:none so no empty gap remains.
        el.style.display = 'none';
        // If it's inside a block-grid, the grid gap handles layout — no gap needed.
      }
    });

    _applied = true;
  }

  function run() {
    loadConfig().then(function (config) {
      applyRules(config);
    });
  }

  // Expose publicly for the admin page to read/write config.
  window.AccessControl = {
    // Admin CRUD
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
    // Apply current rules (called after login).
    apply: run,
    isApplied: function () { return _applied; }
  };

  // Apply on DOMContentLoaded if already authenticated.
  document.addEventListener('DOMContentLoaded', function () {
    if (window.Auth && window.Auth.isAuthenticated()) run();
  });

  // Also apply after login.
  document.addEventListener('authSuccess', function () {
    _config = null;   // clear cached config so we re-fetch after a role change
    run();
  });

})();
