/* barcode-split-drying.js -- barcode-linked steam log for REC 7.4.1 (Drying Process).
 *
 *   BarcodeSplitDrying.init({ recordKey: 'drying-process' })
 *
 * Administrator-only. Inserts a steam log panel directly before the Steams roster section.
 *
 * FLOW:
 *   1. Job confirmed via BarcodeTest (lot/job barcode scanned).
 *   2. "+ New steam" opens an inline form:
 *        - Trolley 1 barcode: scan button + type input (required)
 *        - Trolley 2 barcode: scan button + type input (optional; normal is 2, max 2)
 *        - Steam temp (C), Steam time (min), Start time + [Now]
 *   3. [Add steam] -> fetches steam number from barcode history, then calls
 *        POST /api/traceability/scan  (stage: "drying-steam")  per trolley barcode.
 *   4. Entry appears in the logged-steams list.
 *
 * Steam number = count of prior "drying-steam" events on that barcode (incl. parent ancestry).
 * Split barcodes can be scanned -- data is associated via ancestry chain.
 *
 * Requires BarcodeTest + BarcodeScan + FacilityApi.
 */
(function () {
  'use strict';

  var PANEL_ID = 'bsd_panel';

  function api(path, opts) {
    if (!window.FacilityApi) return Promise.reject(new Error('no api'));
    return window.FacilityApi.fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { j.httpStatus = r.status; return j; });
    });
  }
  function who() {
    try { return (window.Auth && Auth.currentUser && (Auth.currentUser().name || Auth.currentUser())) || ''; } catch (e) { return ''; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function nowLocal() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtTime(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; }
  }
  function fetchSteamNumber(barcodeValue) {
    return api('/api/traceability/history/' + encodeURIComponent(barcodeValue)).then(function (h) {
      if (!h.ok || !Array.isArray(h.stageEvents)) return 1;
      return h.stageEvents.filter(function (e) { return e.stage === 'drying-steam'; }).length + 1;
    }).catch(function () { return 1; });
  }

  function init(cfg) {
    if (!(window.BarcodeScan && window.BarcodeScan.allowed())) return;

    var state = {
      jobBarcode: null,
      steams: [],
      formOpen: false,
      form: { bc1: '', bc2: '', temp: '', duration: '', startTime: '' },
      busy: false,
      statusMsg: null, statusKind: null
    };

    function getPanel() { return document.getElementById(PANEL_ID); }

    function findInsertPoint() {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        if (/add\s+steam/i.test(btns[i].textContent)) {
          var el = btns[i];
          for (var j = 0; j < 6; j++) {
            if (!el.parentNode || el.parentNode.id === 'frRoot') {
              return el.parentNode ? { parent: el.parentNode, before: el } : null;
            }
            el = el.parentNode;
          }
          return { parent: el.parentNode, before: el };
        }
      }
      var root = document.getElementById('frRoot') || document.body;
      return { parent: root, before: null };
    }

    function ensurePanel() {
      var existing = getPanel();
      if (existing) return existing;
      var panel = document.createElement('div');
      panel.id = PANEL_ID; panel.className = 'no-print';
      panel.style.cssText = 'margin:0 0 16px;padding:14px 18px;border:2px solid #2d6a3e;border-radius:12px;background:#f2faf4';
      var pt = findInsertPoint();
      if (pt) pt.parent.insertBefore(panel, pt.before);
      else (document.getElementById('frRoot') || document.body).appendChild(panel);
      return panel;
    }

    function steamRowHtml(s) {
      var trolleys = s.trolleys.map(function (t) {
        return '<span style="font:12px monospace;background:#e6f4ea;padding:2px 6px;border-radius:4px;margin-right:4px">' +
          esc(t.barcode) + ' (steam #' + t.steamNo + ')</span>';
      }).join('');
      return '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:8px 10px;margin-bottom:5px;background:#fff;border:1px solid #c8e6c9;border-radius:7px;font:13px system-ui,sans-serif">' +
        '<span style="font:600 12px system-ui;color:#2d6a3e;min-width:60px">Steam ' + esc(s.displayNo) + '</span>' +
        trolleys +
        '<span style="color:#555">' + esc(s.temp) + '&#8202;&deg;C</span>' +
        '<span style="color:#555">' + esc(s.duration) + '&#8202;min</span>' +
        '<span style="color:#888">started ' + esc(fmtTime(s.startTime)) + '</span>' +
        '</div>';
    }

    function trolleyInputHtml(n, val) {
      var filled = !!val;
      return '<div style="margin-bottom:10px">' +
        '<div style="font:11px system-ui,sans-serif;color:#666;text-transform:uppercase;margin-bottom:5px">' +
        'Trolley ' + n + (n === 2 ? ' <span style="font-weight:400;text-transform:none">(optional)</span>' : '') +
        '</div>' +
        '<button type="button" id="bsd_scan' + n + '" style="display:block;width:100%;padding:11px;font:600 14px system-ui,sans-serif;border:2px solid #2d6a3e;border-radius:8px;background:#f2faf4;color:#2d6a3e;cursor:pointer;text-align:center;box-sizing:border-box">&#128247; Scan trolley ' + n + ' barcode</button>' +
        '<input id="bsd_bc' + n + '" type="text" value="' + esc(val) + '" placeholder="or type barcode" autocomplete="off" autocapitalize="characters" ' +
        'style="margin-top:6px;width:100%;padding:7px 10px;border:1px solid ' + (filled ? '#a3d4b0' : '#ccc') + ';border-radius:6px;font:14px monospace;box-sizing:border-box;background:' + (filled ? '#f2faf4' : '#fff') + '">' +
        (filled ? '<div style="font:12px system-ui,sans-serif;color:#2d6a3e;margin-top:2px">&#10003; ' + esc(val) + '</div>' : '') +
        '</div>';
    }

    function formHtml() {
      if (!state.formOpen) return '';
      var f = state.form;
      var statusLine = state.statusMsg
        ? '<div role="status" style="margin-top:8px;font:13px system-ui,sans-serif;color:' + (state.statusKind === 'bad' ? '#b33' : '#1f6a37') + '">' + esc(state.statusMsg) + '</div>'
        : '';
      return '<div id="bsd_form" style="margin-top:12px;padding:14px;border:1px solid #a3d4b0;border-radius:10px;background:#fff">' +
        '<div style="font:600 13px system-ui,sans-serif;color:#2d6a3e;margin-bottom:12px">New steam entry</div>' +
        trolleyInputHtml(1, f.bc1) +
        trolleyInputHtml(2, f.bc2) +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:12px 0">' +
        '<label style="display:block"><span style="font:11px system-ui,sans-serif;color:#666;text-transform:uppercase;display:block;margin-bottom:4px">Steam temp (&deg;C)</span>' +
        '<input id="bsd_temp" type="number" step="0.1" value="' + esc(f.temp) + '" placeholder="e.g. 85" style="width:100%;padding:7px 8px;border:1px solid #ccc;border-radius:6px;font:14px system-ui;box-sizing:border-box"></label>' +
        '<label style="display:block"><span style="font:11px system-ui,sans-serif;color:#666;text-transform:uppercase;display:block;margin-bottom:4px">Steam time (min)</span>' +
        '<input id="bsd_dur" type="number" step="1" value="' + esc(f.duration) + '" placeholder="e.g. 45" style="width:100%;padding:7px 8px;border:1px solid #ccc;border-radius:6px;font:14px system-ui;box-sizing:border-box"></label>' +
        '<label style="display:block"><span style="font:11px system-ui,sans-serif;color:#666;text-transform:uppercase;display:block;margin-bottom:4px">Start time</span>' +
        '<input id="bsd_time" type="datetime-local" value="' + esc(f.startTime) + '" style="width:100%;padding:7px 8px;border:1px solid #ccc;border-radius:6px;font:13px system-ui;box-sizing:border-box">' +
        '<button type="button" id="bsd_now" style="margin-top:5px;width:100%;padding:5px;font:12px system-ui;border:1px solid #888;border-radius:5px;background:#f5f5f5;color:#333;cursor:pointer">Now</button>' +
        '</label></div>' +
        '<div style="display:flex;gap:8px">' +
        '<button type="button" id="bsd_add" ' + (state.busy ? 'disabled ' : '') +
        'style="flex:1;padding:10px;font:600 13px system-ui;border:0;border-radius:7px;background:' + (state.busy ? '#aaa' : '#2d6a3e') + ';color:#fff;cursor:' + (state.busy ? 'default' : 'pointer') + '">' +
        (state.busy ? 'Saving&hellip;' : 'Add steam') + '</button>' +
        '<button type="button" id="bsd_cancel" style="padding:10px 16px;font:13px system-ui;border:1px solid #ccc;border-radius:7px;background:#fff;color:#555;cursor:pointer">Cancel</button>' +
        '</div>' + statusLine + '</div>';
    }

    function render(msg, kind) {
      if (msg !== undefined) { state.statusMsg = msg; state.statusKind = kind; }
      var panel = getPanel();
      if (!panel || !state.jobBarcode) return;
      var steamList = state.steams.length
        ? state.steams.map(steamRowHtml).join('')
        : '<div style="font:12px system-ui;color:#aaa;margin-bottom:6px">No steams logged yet this session.</div>';
      var addBtn = !state.formOpen
        ? '<button type="button" id="bsd_new" style="padding:9px 18px;font:600 13px system-ui;border:1px solid #2d6a3e;border-radius:7px;background:#f2faf4;color:#2d6a3e;cursor:pointer">+ New steam</button>'
        : '';
      panel.innerHTML =
        '<div style="font:600 14px system-ui;color:#2d6a3e;margin-bottom:10px">' +
        'STEAM LOG <span style="font-weight:400;font-size:12px;color:#888">(barcode session &mdash; job barcode: ' + esc(state.jobBarcode) + ')</span>' +
        '</div>' +
        steamList + addBtn + formHtml();
      bindEvents();
    }

    function bindEvents() {
      var panel = getPanel();
      if (!panel) return;
      var newBtn = panel.querySelector('#bsd_new');
      if (newBtn) newBtn.addEventListener('click', function () {
        state.form = { bc1: '', bc2: '', temp: '', duration: '', startTime: '' };
        state.formOpen = true; state.statusMsg = null; render();
      });
      [1, 2].forEach(function (n) {
        var scanBtn = panel.querySelector('#bsd_scan' + n);
        if (scanBtn) scanBtn.addEventListener('click', function () {
          BarcodeScan.open(function (val) {
            val = val.trim().toUpperCase();
            state.form['bc' + n] = val; state.statusMsg = null; render();
          }, { title: 'Scan barcode for Trolley ' + n });
        });
        var inp = panel.querySelector('#bsd_bc' + n);
        if (inp) inp.addEventListener('input', function () {
          state.form['bc' + n] = inp.value.trim().toUpperCase(); inp.value = state.form['bc' + n];
        });
      });
      var tempEl = panel.querySelector('#bsd_temp');
      if (tempEl) tempEl.addEventListener('input', function () { state.form.temp = tempEl.value; });
      var durEl = panel.querySelector('#bsd_dur');
      if (durEl) durEl.addEventListener('input', function () { state.form.duration = durEl.value; });
      var timeEl = panel.querySelector('#bsd_time');
      if (timeEl) timeEl.addEventListener('input', function () { state.form.startTime = timeEl.value; });
      var nowBtn = panel.querySelector('#bsd_now');
      if (nowBtn) nowBtn.addEventListener('click', function () {
        state.form.startTime = nowLocal(); if (timeEl) timeEl.value = state.form.startTime;
      });
      var addBtn = panel.querySelector('#bsd_add');
      if (addBtn) addBtn.addEventListener('click', doAddSteam);
      var cancelBtn = panel.querySelector('#bsd_cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { state.formOpen = false; state.statusMsg = null; render(); });
    }

    function doAddSteam() {
      if (state.busy) return;
      var f = state.form;
      var bc1 = f.bc1.trim(), bc2 = f.bc2.trim();
      if (!bc1) { render('Scan Trolley 1 barcode first.', 'bad'); return; }
      if (bc2 && bc2 === bc1) { render('Trolley 1 and Trolley 2 barcodes must be different.', 'bad'); return; }
      if (!f.temp || isNaN(parseFloat(f.temp))) { render('Enter steam temperature.', 'bad'); return; }
      if (!f.duration || isNaN(parseInt(f.duration, 10))) { render('Enter steam time in minutes.', 'bad'); return; }
      if (!f.startTime) { render('Enter start time.', 'bad'); return; }
      state.busy = true; render(null);
      var barcodes = bc2 ? [bc1, bc2] : [bc1];
      Promise.all(barcodes.map(fetchSteamNumber)).then(function (steamNos) {
        var note = JSON.stringify({ temp: parseFloat(f.temp), duration: parseInt(f.duration, 10), startTime: f.startTime });
        return Promise.all(barcodes.map(function (bc) {
          return api('/api/traceability/scan', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcodeValue: bc, stage: 'drying-steam', user: who(), locationNote: note, recordKey: cfg.recordKey })
          });
        })).then(function (results) {
          state.busy = false;
          var failed = results.find(function (r) { return !r.ok; });
          if (failed) { render('Save failed: ' + (failed.error || 'server error'), 'bad'); return; }
          state.steams.push({
            displayNo: state.steams.length + 1,
            trolleys: barcodes.map(function (bc, i) { return { barcode: bc, steamNo: steamNos[i] }; }),
            temp: f.temp, duration: f.duration, startTime: f.startTime
          });
          state.formOpen = false; state.statusMsg = null; render(null);
        });
      }).catch(function () { state.busy = false; render('Could not reach the server.', 'bad'); });
    }

    function onScanned(data) {
      if (!data || !data.barcode) return;
      if (state.jobBarcode === data.barcode) return;
      state.jobBarcode = data.barcode;
      state.steams = []; state.formOpen = false; state.statusMsg = null; state.busy = false;
      tryMount();
    }

    var mountTimer = null, mountTries = 0;
    function tryMount() {
      if (!state.jobBarcode) return;
      clearInterval(mountTimer); mountTries = 0;
      mountTimer = setInterval(function () {
        if (++mountTries > 40) { clearInterval(mountTimer); ensurePanel(); render(null); return; }
        var pt = findInsertPoint();
        if (pt) { clearInterval(mountTimer); ensurePanel(); render(null); }
      }, 250);
    }

    new MutationObserver(function () {
      if (!state.jobBarcode || getPanel()) return;
      tryMount();
    }).observe(document.body || document.documentElement, { childList: true, subtree: false });

    document.addEventListener('bt:scanned', function (e) { onScanned(e && e.detail); });

    var lateCheck = 0;
    var lateTimer = setInterval(function () {
      if (window.BarcodeTest && BarcodeTest.getScanned && BarcodeTest.getScanned()) {
        onScanned(BarcodeTest.getScanned()); clearInterval(lateTimer);
      } else if (++lateCheck > 10) clearInterval(lateTimer);
    }, 300);
  }

  window.BarcodeSplitDrying = { init: init };
})();
