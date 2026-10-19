/* barcode-test.js -- barcode-first job entry for the dry pages (REC 7.4.0 / 7.4.1 / 7.4.2) and Salting (REC 7.1.5).
 *
 *   BarcodeTest.init({ stage: 'drying', recordKey: 'drying-process' })              small "Use barcodes" switch (dry pages)
 *   BarcodeTest.init({ stage: 'oosw', recordKey: 'salting-oosw', always: true })    barcode mode always on (salting)
 *
 * With barcode mode on, a big "Scan job barcode" bar sits at the top of the form and the job number is filled by the
 * scan (the field is read-only). A scan: looks up the job from the main barcode set at REC 7.1.2, fills the job no. so
 * the page's own autofill runs as if it had been typed, and logs the scan as a stage event. Stage names are free text.
 */
(function () {
  'use strict';
  var KEY = 'bt_use_barcodes';

  function lsGet() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function lsSet(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { } }

  function api(path, opts) {
    if (!window.FacilityApi) return Promise.reject(new Error('no api'));
    return window.FacilityApi.fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.httpStatus = r.status; return j; });
    });
  }
  function who() { try { return (window.Auth && Auth.currentUser && (Auth.currentUser().name || Auth.currentUser())) || ''; } catch (e) { return ''; } }
  function jobInput() {
    return document.getElementById('fr_f_jobNo') || document.getElementById('ml_f_jobNo') || document.querySelector('[id$="_f_jobNo"]');
  }
  function root() { return document.getElementById('frRoot') || document.getElementById('mlRoot') || document.body; }

  function init(cfg) {
    var on = !!cfg.always || lsGet();
    var scanned = null; // { barcode, jobNo, members }

    function status(msg, kind) {
      var s = document.getElementById('bt_status');
      if (!s) return;
      s.textContent = msg;
      s.style.color = kind === 'bad' ? '#a33' : kind === 'ok' ? '#1f6a37' : '#555';
    }

    function applyJobLock() {
      var inp = jobInput();
      if (!inp) return;
      if (on) { inp.readOnly = true; inp.title = 'Filled by scanning the job barcode'; }
      else if (inp.readOnly && inp.dataset.btLocked) { inp.readOnly = false; inp.title = ''; }
      if (on) inp.dataset.btLocked = '1'; else delete inp.dataset.btLocked;
    }

    function ensureBar() {
      var bar = document.getElementById('bt_bar');
      if (!on) { if (bar) bar.remove(); return; }
      if (bar) return;
      var host = root();
      bar = document.createElement('div');
      bar.id = 'bt_bar'; bar.className = 'no-print';
      bar.style.cssText = 'margin:0 0 14px;padding:14px;border:2px solid #2d6a3e;border-radius:12px;background:#f2faf4;display:flex;flex-wrap:wrap;align-items:center;gap:12px';
      bar.innerHTML = '<button type="button" id="bt_scan" style="font:600 18px system-ui,sans-serif;padding:14px 22px;border:0;border-radius:10px;background:#2d6a3e;color:#fff;cursor:pointer">📷 Scan job barcode</button>' +
        '<div id="bt_status" role="status" style="font:15px/1.35 system-ui,sans-serif;flex:1 1 220px;color:#555">Scan the main barcode for this job.</div>';
      host.insertBefore(bar, host.firstChild);
      bar.querySelector('#bt_scan').addEventListener('click', function () {
        window.BarcodeScan.open(onScan, { title: 'Scan the job\'s main barcode' });
      });
      if (scanned) status('Job ' + scanned.jobNo + ' · barcode ' + scanned.barcode + ' · ' + scanned.members + ' baskets', 'ok');
    }

    function ensureSwitch() {
      var b = document.getElementById('bt_useBarcodes');
      if (cfg.always) { if (b) b.remove(); return; }
      if (!b) {
        b = document.createElement('button');
        b.id = 'bt_useBarcodes'; b.type = 'button'; b.className = 'no-print';
        b.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:900;padding:4px 9px;font:12px system-ui,sans-serif;border:1px solid #999;border-radius:6px;background:#fff;color:#333;opacity:.9;cursor:pointer';
        b.addEventListener('click', function () { on = !on; lsSet(on); refresh(); });
        document.body.appendChild(b);
      }
      b.textContent = '📷 Use barcodes: ' + (on ? 'ON' : 'off');
      b.style.background = on ? '#e6f4ea' : '#fff';
    }

    function refresh() { ensureSwitch(); ensureBar(); applyJobLock(); }

    function onScan(code) {
      status('Looking up ' + code + '…');
      api('/api/traceability/history/' + encodeURIComponent(code)).then(function (h) {
        if (!h.ok) { status(h.httpStatus === 404 ? 'Barcode ' + code + ' is not registered. Scan it at receiving (REC 7.1.2) first.' : 'Lookup failed.', 'bad'); return; }
        if (h.barcode.status !== 'active') { status('Barcode ' + h.barcode.value + ' is ' + h.barcode.status + (h.barcode.status === 'split' ? ' - scan one of its child barcodes.' : '.'), 'bad'); return; }
        var link = (h.jobLinks || []).filter(function (l) { return l.jobNo; })[0];
        var jobNo = link ? link.jobNo : '';
        if (!jobNo) { status('Barcode ' + h.barcode.value + ' has no job number linked.', 'bad'); return; }
        var inp = jobInput();
        if (inp && !inp.disabled) {
          inp.readOnly = false;
          inp.value = jobNo;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          applyJobLock();
        }
        return api('/api/traceability/scan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcodeValue: h.barcode.value, stage: cfg.stage, user: who(), locationNote: cfg.recordKey })
        }).then(function (s) {
          scanned = { barcode: h.barcode.value, jobNo: jobNo, members: (h.members || []).length };
          if (!s.ok) { status('Job ' + jobNo + ' filled, but the scan was not logged: ' + (s.error || 'error'), 'bad'); return; }
          status('Job ' + jobNo + ' · barcode ' + scanned.barcode + ' · ' + scanned.members + ' baskets · scan logged at ' + cfg.stage, 'ok');
        });
      }).catch(function () { status('Could not reach the server.', 'bad'); });
    }

    // the form engine re-renders (draft load, Save & New), so keep the bar, the switch and the read-only job field in place
    var t = null;
    function kick() { clearTimeout(t); t = setTimeout(refresh, 150); }
    function boot() {
      refresh();
      new MutationObserver(kick).observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
  }

  window.BarcodeTest = { init: init };
})();
