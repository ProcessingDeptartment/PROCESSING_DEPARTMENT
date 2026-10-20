/* verification-alert.js — fires once per browser session if there are outstanding verifications */
(function () {
  var ALERT_KEY = 'verification_outstanding_alert_shown';

  async function checkAndShowVerificationAlert() {
    if (sessionStorage.getItem(ALERT_KEY)) return;
    sessionStorage.setItem(ALERT_KEY, '1');

    var outstandingCount = 0;
    try {
      var res = await window.FacilityApi.fetch('/api/verification/count-outstanding', { cache: 'no-store' });
      if (res.ok) {
        var data = await res.json();
        outstandingCount = data.outstanding || 0;
      }
    } catch (e) {
      return;
    }

    if (outstandingCount === 0) return;

    var countEl = document.getElementById('verification-alert-count');
    if (countEl) countEl.textContent = outstandingCount;

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

  document.addEventListener('DOMContentLoaded', checkAndShowVerificationAlert);
  window.checkAndShowVerificationAlert = checkAndShowVerificationAlert;
})();
