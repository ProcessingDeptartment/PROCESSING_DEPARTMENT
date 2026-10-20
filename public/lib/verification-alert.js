/* verification-alert.js
 * Shows a modal once per login session when the current user has records
 * awaiting their verification. Fires on authSuccess (login), not page load.
 * Uses VerificationQueue.forCurrentUser() so the count is role-filtered.
 */
(function () {
  function alertKey() {
    var user = window.Auth && window.Auth.getCurrentUsername && window.Auth.getCurrentUsername();
    return 'verification_alert_shown:' + (user || '');
  }

  async function show() {
    // Once per user per browser session — keyed to the username so a different
    // user logging in on the same tab gets their own check.
    var key = alertKey();
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    if (!window.VerificationQueue) return;

    var q;
    try { q = await window.VerificationQueue.forCurrentUser(); }
    catch (e) { return; }

    if (!q || !q.total) return;

    var countEl = document.getElementById('verification-alert-count');
    if (countEl) countEl.textContent = q.total;

    var overlay = document.getElementById('verification-alert-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    var dismissBtn = document.getElementById('verification-alert-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () { overlay.style.display = 'none'; });
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  }

  // Fire on login.
  document.addEventListener('authSuccess', show);

  // Also fire on page load when the session was already authenticated before this
  // page loaded (e.g. user navigated here after logging in on another page) —
  // but only if the session flag is not yet set.
  document.addEventListener('DOMContentLoaded', function () {
    if (sessionStorage.getItem(ALERT_KEY)) return;
    if (window.Auth && window.Auth.isAuthenticated()) show();
  });
})();
