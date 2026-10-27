/* NC Login Alert — shows a popup after login if there are any open/in-progress NCs.
 * Skips admin and administrator users. Disappears once all NCs are closed.
 * Listens for the 'authSuccess' custom event dispatched by login-ui.js.
 */
(function () {
  'use strict';

  var CSS = ''
    + '.nc-alert-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200000;display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.nc-alert-box{background:#fff;border-radius:10px;max-width:540px;width:100%;max-height:90vh;overflow:auto;border-top:4px solid #d98200;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:inherit}'
    + '.nc-alert-head{background:#fff8ec;padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #ffe0a0}'
    + '.nc-alert-head h2{margin:0;font-size:16px;color:#7a4000;flex:1}'
    + '.nc-alert-close{background:none;border:none;font-size:22px;cursor:pointer;color:#7a4000;padding:0 4px;line-height:1}'
    + '.nc-alert-body{padding:14px 18px}'
    + '.nc-alert-intro{font-size:13px;color:#4b5158;margin:0 0 12px}'
    + '.nc-alert-list{list-style:none;margin:0 0 4px;padding:0;display:flex;flex-direction:column;gap:8px}'
    + '.nc-alert-item{padding:10px 12px;border:1px solid #ffe0a0;border-left:3px solid #d98200;border-radius:6px;background:#fffcf5;font-size:12.5px}'
    + '.nc-alert-item.nc-alert-prog{border-left-color:#c9a400;background:#fffef0}'
    + '.nc-alert-item.nc-alert-rtc{border-left-color:#4a9e4a;background:#f0fff0}'
    + '.nc-alert-ref{font-weight:700;color:#7a4000;font-size:13px}'
    + '.nc-alert-item.nc-alert-prog .nc-alert-ref{color:#665500}'
    + '.nc-alert-item.nc-alert-rtc .nc-alert-ref{color:#2a6a2a}'
    + '.nc-alert-meta{color:#5a6068;margin-top:3px}'
    + '.nc-alert-foot{padding:0 18px 16px;display:flex;justify-content:flex-end;gap:8px}'
    + '.nc-alert-btn-view{background:#d98200;color:#fff;border:none;border-radius:6px;padding:9px 16px;font:600 13px inherit;font-family:inherit;cursor:pointer}'
    + '.nc-alert-btn-view:hover{background:#b87000}'
    + '.nc-alert-btn-dismiss{background:#fff;color:#1d2125;border:1px solid #b9bfc6;border-radius:6px;padding:9px 16px;font:600 13px inherit;font-family:inherit;cursor:pointer}'
    + '.nc-alert-btn-dismiss:hover{background:#f2f4f6}'
    + '@media print{.nc-alert-overlay{display:none!important}}';

  var styleInjected = false;
  function injectCss() {
    if (styleInjected) return;
    styleInjected = true;
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return String(iso); }
  }

  function ncLogUrl() {
    return window.location.origin + '/pages/nc-log.html';
  }

  function apiBase() {
    return (window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com').replace(/\/$/, '');
  }

  function apiFetch(path) {
    if (window.FacilityApi) return window.FacilityApi.fetch(path);
    return fetch(apiBase() + path);
  }

  function fetchOpenNCs() {
    return apiFetch('/api/nc?limit=200')
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        return (rows || []).filter(function (nc) { return nc.status !== 'closed'; });
      });
  }

  function showAlert(openNCs) {
    if (!openNCs || !openNCs.length) return;
    injectCss();

    var overlay = document.createElement('div');
    overlay.className = 'nc-alert-overlay';

    var items = openNCs.map(function (nc) {
      var cls = nc.status === 'in_progress' ? 'nc-alert-prog'
               : nc.status === 'ready_to_close' ? 'nc-alert-rtc' : '';
      var statusLabel = nc.status === 'in_progress' ? 'In progress'
                      : nc.status === 'ready_to_close' ? 'Ready to close' : 'Open';
      var meta = [];
      if (nc.jobNumber) meta.push('Job: <strong>' + esc(nc.jobNumber) + '</strong>');
      if (nc.recordRef) meta.push(esc(nc.recordRef));
      meta.push('Raised: ' + esc(fmtDate(nc.raisedAt)));
      return '<li class="nc-alert-item' + (cls ? ' ' + cls : '') + '">'
        + '<div class="nc-alert-ref">⚠ ' + esc(nc.ncRef) + ' <span style="font-weight:400;font-size:11.5px;">— ' + esc(statusLabel) + '</span></div>'
        + '<div class="nc-alert-meta">' + meta.join(' · ') + '</div>'
        + '</li>';
    }).join('');

    var count = openNCs.length;
    var plural = count === 1 ? 'NC' : 'NCs';
    var verb = count === 1 ? 'is' : 'are';

    overlay.innerHTML = '<div class="nc-alert-box">'
      + '<div class="nc-alert-head">'
      + '<h2>⚠ Open Non-Conformances (' + count + ')</h2>'
      + '<button class="nc-alert-close" data-dismiss title="Dismiss">×</button>'
      + '</div>'
      + '<div class="nc-alert-body">'
      + '<p class="nc-alert-intro">The following ' + plural + ' ' + verb + ' open and require corrective action:</p>'
      + '<ul class="nc-alert-list">' + items + '</ul>'
      + '</div>'
      + '<div class="nc-alert-foot">'
      + '<button class="nc-alert-btn-dismiss" data-dismiss>Dismiss</button>'
      + '<button class="nc-alert-btn-view" data-view>View NC Log</button>'
      + '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    function close() { overlay.remove(); }

    overlay.querySelectorAll('[data-dismiss]').forEach(function (btn) {
      btn.addEventListener('click', close);
    });
    overlay.querySelector('[data-view]').addEventListener('click', function () {
      close();
      window.location.href = ncLogUrl();
    });
  }

  function checkAndAlert(user) {
    if (!user) return;
    var uname = (user.username || '').toLowerCase().trim();
    if (uname === 'admin' || uname === 'administrator') return;
    fetchOpenNCs()
      .then(function (openNCs) { if (openNCs.length) showAlert(openNCs); })
      .catch(function () { /* silent on network errors */ });
  }

  document.addEventListener('authSuccess', function (e) {
    checkAndAlert(e && e.detail);
  });

  window.NcLoginAlert = { checkAndAlert: checkAndAlert };
})();
