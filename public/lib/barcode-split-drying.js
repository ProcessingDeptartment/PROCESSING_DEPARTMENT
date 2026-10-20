/* barcode-split-drying.js -- trolley barcode scanning + steam log panel for REC 7.4.1.
 *
 *   BarcodeSplitDrying.init({ recordKey: 'drying-process' })
 *
 * SECTION 1 — TROLLEY BARCODES
 *   Once "No. of trolleys" is filled AND a job barcode is scanned, prompts the operator to scan
 *   one barcode per trolley. "Save trolley barcodes" calls POST /api/traceability/split, splitting
 *   the parent lot barcode into N child barcodes (one per trolley).
 *
 * SECTION 2 — STEAM LOG (appears after trolleys are saved)
 *   "+ New steam" shows an inline form: scan/type a trolley barcode, enter steam temp (°C),
 *   duration (min), start time (with "Now" button). Each entry is saved immediately via
 *   POST /api/traceability/scan (stage "drying-steam", data packed into locationNote).
 *
 * Administrator-only. Requires BarcodeTest + BarcodeScan + FacilityApi.
 */
(function () {
  'use strict';

  var PANEL_ID = 'bsd_panel';
  var TROLLEY_FIELD = 'fr_f_noOfTrolleys';

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
    var d = new Date(), pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function init(cfg) {
    if (!(window.BarcodeScan && window.BarcodeScan.allowed())) return;

    // ── State ─────────────────────────────────────────────────────────────────

    var trolley = {
      parentBarcode: null,
      trolleyCount: 0,
      slots: [],           // [{ value: '' }]
      submitted: false,
      busy: false,
      statusMsg: null, statusKind: null
    };

    var steam = {
      entries: [],         // [{ trolleyBarcode, temp, duration, startTime }] saved
      formOpen: false,
      form: { barcodeValue: '', temp: '', duration: '', startTime: '' },
      busy: false,
      statusMsg: null, statusKind: null
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    function getPanel() { return document.getElementById(PANEL_ID); }
    function rootEl() { return document.getElementById('frRoot') || document.getElementById('mlRoot') || document.body; }
    function ready() { return trolley.parentBarcode && trolley.trolleyCount > 0; }
    function scannedCount() { return trolley.slots.filter(function (s) { return s.value.trim(); }).length; }
    function knownTrolleyBarcodes() { return trolley.slots.map(function (s) { return s.value.trim(); }).filter(Boolean); }

    // ── HTML — trolley section ────────────────────────────────────────────────

    function trolleySlotHtml(i, s) {
      var filled = !!s.value.trim();
      var bg = filled ? '#f2faf4' : '#fff';
      var border = filled ? '#a3d4b0' : '#ccc';
      return '<div class="bsd-slot" data-idx="' + i + '" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;background:' + bg + ';border:1px solid ' + border + ';border-radius:8px">' +
        '<span style="font:600 13px system-ui,sans-serif;color:#555;min-width:72px">Trolley ' + (i + 1) + '</span>' +
        '<input class="bsd-bc" type="text" value="' + esc(s.value) + '" placeholder="Scan or type barcode" autocomplete="off" autocapitalize="characters" style="flex:1;padding:7px 10px;border:1px solid ' + border + ';border-radius:6px;font:14px monospace;background:' + bg + '">' +
        '<button type="button" class="bsd-scan-trolley" data-idx="' + i + '" style="padding:7px 12px;font:13px system-ui,sans-serif;border:1px solid #2d6a3e;border-radius:6px;background:#f2faf4;color:#2d6a3e;cursor:pointer;white-space:nowrap">&#128247; Scan</button>' +
        (filled ? '<span style="font:13px system-ui,sans-serif;color:#2d6a3e">&#10003;</span>' : '<span style="min-width:14px"></span>') +
        '</div>';
    }

    function trolleySectionHtml() {
      if (trolley.submitted) {
        return '<div style="font:13px system-ui,sans-serif;color:#2d6a3e;padding:4px 0">&#10003; ' + trolley.trolleyCount + ' trolley barcodes saved. Parent barcode ' + esc(trolley.parentBarcode) + ' split.</div>';
      }
      var done = scannedCount(), total = trolley.slots.length;
      var allDone = done === total && total > 0;
      var statusLine = trolley.statusMsg
        ? '<div role="status" style="margin-top:6px;font:13px system-ui,sans-serif;color:' + (trolley.statusKind === 'bad' ? '#b33' : '#1f6a37') + '">' + esc(trolley.statusMsg) + '</div>'
        : '';
      return '<div style="font:13px system-ui,sans-serif;color:#555;margin-bottom:10px">Scan a unique barcode for each trolley &mdash; <strong>' + done + ' of ' + total + '</strong> scanned.</div>' +
        trolley.slots.map(function (s, i) { return trolleySlotHtml(i, s); }).join('') +
        '<button type="button" id="bsd_save_trolleys" ' + (!allDone || trolley.busy ? 'disabled ' : '') +
        'style="margin-top:8px;padding:10px 22px;font:600 14px system-ui,sans-serif;border:0;border-radius:8px;background:' + (allDone && !trolley.busy ? '#2d6a3e' : '#aaa') + ';color:#fff;cursor:' + (allDone && !trolley.busy ? 'pointer' : 'default') + '">' +
        (trolley.busy ? 'Saving&hellip;' : 'Save trolley barcodes') + '</button>' +
        statusLine;
    }

    // ── HTML — steam section ──────────────────────────────────────────────────

    function steamEntryHtml(e, i) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;margin-bottom:5px;background:#fff;border:1px solid #dde;border-radius:7px;font:13px system-ui,sans-serif">' +
        '<span style="font:600 12px monospace;color:#2d6a3e;min-width:90px">' + esc(e.trolleyBarcode) + '</span>' +
        '<span style="color:#555">' + esc(e.temp) + '&#8202;&deg;C</span>' +
        '<span style="color:#555">' + esc(e.duration) + '&#8202;min</span>' +
        '<span style="color:#888">started ' + esc(fmtTime(e.startTime)) + '</span>' +
        '<span style="color:#2d6a3e">&#10003;</span>' +
        '</div>';
    }

    function steamFormHtml() {
      if (!steam.formOpen) return '';
      var f = steam.form;
      var known = knownTrolleyBarcodes();
      var bcOpts = known.map(function (v) { return '<option value="' + esc(v) + '"' + (f.barcodeValue === v ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
      var bcField = known.length > 0
        ? '<select id="bsd_sf_bc" style="flex:1;padding:7px 10px;border:1px solid #ccc;border-radius:6px;font:14px monospace">' +
          '<option value="">-- Select trolley barcode --</option>' + bcOpts + '</select>' +
          '<button type="button" id="bsd_sf_scan" style="padding:7px 12px;font:13px system-ui,sans-serif;border:1px solid #2d6a3e;border-radius:6px;background:#f2faf4;color:#2d6a3e;cursor:pointer;white-space:nowrap">&#128247; Scan</button>'
        : '<input id="bsd_sf_bc" type="text" value="' + esc(f.barcodeValue) + '" placeholder="Scan or type trolley barcode" autocomplete="off" autocapitalize="characters" style="flex:1;padding:7px 10px;border:1px solid #ccc;border-radius:6px;font:14px monospace">' +
          '<button type="button" id="bsd_sf_scan" style="padding:7px 12px;font:13px system-ui,sans-serif;border:1px solid #2d6a3e;border-radius:6px;background:#f2faf4;color:#2d6a3e;cursor:pointer;white-space:nowrap">&#128247; Scan</button>';
      var statusLine = steam.statusMsg
        ? '<div role="status" style="margin-top:6px;font:13px system-ui,sans-serif;color:' + (steam.statusKind === 'bad' ? '#b33' : '#1f6a37') + '">' + esc(steam.statusMsg) + '</div>'
        : '';
      return '<div style="margin-top:10px;padding:12px 14px;border:1px solid #a3d4b0;border-radius:8px;background:#fff">' +
        '<div style="font:600 13px system-ui,sans-serif;color:#2d6a3e;margin-bottom:10px">New steam entry</div>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span style="font:12px system-ui,sans-serif;color:#666;min-width:90px">Trolley barcode</span>' +
        bcField + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">' +
        '<label style="display:block"><span style="font:11px system-ui,sans-serif;color:#666;display:block;margin-bottom:3px">Steam temp (&deg;C)</span>' +
        '<input id="bsd_sf_temp" type="number" step="0.1" value="' + esc(f.temp) + '" placeholder="e.g. 85" style="width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font:14px system-ui,sans-serif;box-sizing:border-box"></label>' +
        '<label style="display:block"><span style="font:11px system-ui,sans-serif;color:#666;display:block;margin-bottom:3px">Duration (min)</span>' +
        '<input id="bsd_sf_dur" type="number" step="1" value="' + esc(f.duration) + '" placeholder="e.g. 45" style="width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font:14px system-ui,sans-serif;box-sizing:border-box"></label>' +
        '<label style="display:block"><span style="font:11px system-ui,sans-serif;color:#666;display:block;margin-bottom:3px">Start time</span>' +
        '<div style="display:flex;gap:6px">' +
        '<input id="bsd_sf_time" type="datetime-local" value="' + esc(f.startTime) + '" style="flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font:13px system-ui,sans-serif;min-width:0;box-sizing:border-box">' +
        '<button type="button" id="bsd_sf_now" style="padding:6px 8px;font:12px system-ui,sans-serif;border:1px solid #888;border-radius:6px;background:#f5f5f5;color:#333;cursor:pointer;white-space:nowrap">Now</button>' +
        '</div></label></div>' +
        '<div style="display:flex;gap:8px">' +
        '<button type="button" id="bsd_sf_add" ' + (steam.busy ? 'disabled ' : '') + 'style="padding:8px 18px;font:600 13px system-ui,sans-serif;border:0;border-radius:7px;background:#2d6a3e;color:#fff;cursor:' + (steam.busy ? 'default' : 'pointer') + '">' + (steam.busy ? 'Saving&hellip;' : 'Add steam') + '</button>' +
        '<button type="button" id="bsd_sf_cancel" style="padding:8px 14px;font:13px system-ui,sans-serif;border:1px solid #ccc;border-radius:7px;background:#fff;color:#555;cursor:pointer">Cancel</button>' +
        '</div>' + statusLine + '</div>';
    }

    function steamSectionHtml() {
      if (!trolley.submitted) return '';
      var entries = steam.entries.map(steamEntryHtml).join('');
      var addBtn = !steam.formOpen
        ? '<button type="button" id="bsd_new_steam" style="margin-top:8px;padding:8px 16px;font:600 13px system-ui,sans-serif;border:1px solid #2d6a3e;border-radius:7px;background:#f2faf4;color:#2d6a3e;cursor:pointer">+ New steam</button>'
        : '';
      return '<div style="margin-top:16px;padding-top:14px;border-top:1px solid #c8e6c9">' +
        '<div style="font:600 13px system-ui,sans-serif;color:#2d6a3e;margin-bottom:8px">STEAM LOG</div>' +
        (entries || '<div style="font:12px system-ui,sans-serif;color:#aaa;margin-bottom:4px">No steams logged yet.</div>') +
        addBtn + steamFormHtml() +
        '</div>';
    }

    // ── Render ────────────────────────────────────────────────────────────────

    function render() {
      var panel = getPanel();
      if (!panel) return;
      if (!ready()) { panel.innerHTML = ''; return; }
      panel.innerHTML =
        '<div style="font:600 14px system-ui,sans-serif;color:#2d6a3e;margin-bottom:10px">' +
        '&#128247; TROLLEY BARCODES' +
        '<span style="font-weight:400;font-size:12px;color:#888;margin-left:8px">Job barcode: ' + esc(trolley.parentBarcode) + '</span>' +
        '</div>' +
        trolleySectionHtml() +
        steamSectionHtml();
      bindEvents();
    }

    // ── Events ────────────────────────────────────────────────────────────────

    function bindEvents() {
      var panel = getPanel();
      if (!panel) return;

      // Trolley slot inputs
      panel.querySelectorAll('.bsd-slot').forEach(function (row) {
        var idx = parseInt(row.getAttribute('data-idx'), 10);
        var inp = row.querySelector('.bsd-bc');
        if (inp) {
          inp.addEventListener('input', function () {
            trolley.slots[idx].value = inp.value.trim().toUpperCase();
            inp.value = trolley.slots[idx].value;
            trolley.statusMsg = null;
            render();
          });
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); render(); } });
        }
      });

      // Trolley slot scan buttons
      panel.querySelectorAll('.bsd-scan-trolley').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          window.BarcodeScan.open(function (val) {
            val = val.trim().toUpperCase();
            var dup = trolley.slots.findIndex(function (s, i) { return i !== idx && s.value === val; });
            if (dup >= 0) { trolley.statusMsg = 'Barcode ' + val + ' is already assigned to Trolley ' + (dup + 1) + '.'; trolley.statusKind = 'bad'; render(); return; }
            trolley.slots[idx].value = val; trolley.statusMsg = null; render();
          }, { title: 'Scan barcode for Trolley ' + (idx + 1) });
        });
      });

      // Save trolleys button
      var saveTrolleysBtn = panel.querySelector('#bsd_save_trolleys');
      if (saveTrolleysBtn) saveTrolleysBtn.addEventListener('click', doSaveTrolleys);

      // New steam button
      var newSteamBtn = panel.querySelector('#bsd_new_steam');
      if (newSteamBtn) newSteamBtn.addEventListener('click', function () {
        steam.form = { barcodeValue: '', temp: '', duration: '', startTime: '' };
        steam.formOpen = true; steam.statusMsg = null;
        render();
        var bcEl = panel.querySelector('#bsd_sf_bc');
        if (bcEl) setTimeout(function () { try { bcEl.focus(); } catch (e) { } }, 50);
      });

      // Steam form fields
      var sfBc = panel.querySelector('#bsd_sf_bc');
      if (sfBc) sfBc.addEventListener('change', function () { steam.form.barcodeValue = (sfBc.value || '').trim().toUpperCase(); });
      if (sfBc && sfBc.tagName === 'INPUT') sfBc.addEventListener('input', function () { steam.form.barcodeValue = sfBc.value.trim().toUpperCase(); sfBc.value = steam.form.barcodeValue; });

      var sfScan = panel.querySelector('#bsd_sf_scan');
      if (sfScan) sfScan.addEventListener('click', function () {
        window.BarcodeScan.open(function (val) {
          steam.form.barcodeValue = val.trim().toUpperCase();
          steam.statusMsg = null; render();
        }, { title: 'Scan trolley barcode' });
      });

      var sfTemp = panel.querySelector('#bsd_sf_temp');
      if (sfTemp) sfTemp.addEventListener('input', function () { steam.form.temp = sfTemp.value; });

      var sfDur = panel.querySelector('#bsd_sf_dur');
      if (sfDur) sfDur.addEventListener('input', function () { steam.form.duration = sfDur.value; });

      var sfTime = panel.querySelector('#bsd_sf_time');
      if (sfTime) sfTime.addEventListener('input', function () { steam.form.startTime = sfTime.value; });

      var sfNow = panel.querySelector('#bsd_sf_now');
      if (sfNow) sfNow.addEventListener('click', function () {
        steam.form.startTime = nowLocal();
        if (sfTime) sfTime.value = steam.form.startTime;
      });

      var sfAdd = panel.querySelector('#bsd_sf_add');
      if (sfAdd) sfAdd.addEventListener('click', doAddSteam);

      var sfCancel = panel.querySelector('#bsd_sf_cancel');
      if (sfCancel) sfCancel.addEventListener('click', function () {
        steam.formOpen = false; steam.statusMsg = null; render();
      });
    }

    // ── Save trolleys ─────────────────────────────────────────────────────────

    function doSaveTrolleys() {
      if (!trolley.parentBarcode || trolley.busy) return;
      var vals = trolley.slots.map(function (s) { return s.value.trim(); });
      if (vals.some(function (v) { return !v; })) { trolley.statusMsg = 'Scan a barcode for every trolley first.'; trolley.statusKind = 'bad'; render(); return; }
      if (new Set(vals).size !== vals.length) { trolley.statusMsg = 'Each trolley needs a unique barcode.'; trolley.statusKind = 'bad'; render(); return; }
      trolley.busy = true; render();
      api('/api/traceability/split', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentBarcodeValue: trolley.parentBarcode,
          splitReason: 'drying-trolley-split',
          user: who(), recordKey: cfg.recordKey,
          submissionId: 'drying-split-' + Date.now(),
          children: vals.map(function (v, i) { return { barcodeValue: v, label: 'Trolley ' + (i + 1), weight: null }; })
        })
      }).then(function (res) {
        trolley.busy = false;
        if (!res.ok) { trolley.statusMsg = 'Split failed: ' + (res.error || 'server error'); trolley.statusKind = 'bad'; render(); return; }
        trolley.submitted = true; render();
      }).catch(function () { trolley.busy = false; trolley.statusMsg = 'Could not reach the server.'; trolley.statusKind = 'bad'; render(); });
    }

    // ── Add steam ─────────────────────────────────────────────────────────────

    function doAddSteam() {
      if (steam.busy) return;
      var f = steam.form;
      var bc = (f.barcodeValue || '').trim().toUpperCase();
      if (!bc) { steam.statusMsg = 'Select or scan a trolley barcode.'; steam.statusKind = 'bad'; render(); return; }
      if (!f.temp || isNaN(parseFloat(f.temp))) { steam.statusMsg = 'Enter a steam temperature.'; steam.statusKind = 'bad'; render(); return; }
      if (!f.duration || isNaN(parseInt(f.duration, 10))) { steam.statusMsg = 'Enter a duration.'; steam.statusKind = 'bad'; render(); return; }
      if (!f.startTime) { steam.statusMsg = 'Enter a start time.'; steam.statusKind = 'bad'; render(); return; }

      steam.busy = true; render();
      var note = JSON.stringify({ temp: parseFloat(f.temp), duration: parseInt(f.duration, 10), startTime: f.startTime });
      api('/api/traceability/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcodeValue: bc, stage: 'drying-steam', user: who(), locationNote: note })
      }).then(function (res) {
        steam.busy = false;
        if (!res.ok) { steam.statusMsg = 'Failed to save steam: ' + (res.error || 'error'); steam.statusKind = 'bad'; render(); return; }
        steam.entries.push({ trolleyBarcode: bc, temp: f.temp, duration: f.duration, startTime: f.startTime });
        steam.formOpen = false; steam.statusMsg = null;
        render();
      }).catch(function () { steam.busy = false; steam.statusMsg = 'Could not reach the server.'; steam.statusKind = 'bad'; render(); });
    }

    // ── Watchers ──────────────────────────────────────────────────────────────

    function onScanned(data) {
      if (!data || !data.barcode) return;
      if (trolley.parentBarcode === data.barcode) return;
      trolley.parentBarcode = data.barcode;
      trolley.submitted = false; trolley.busy = false; trolley.statusMsg = null;
      steam.entries = []; steam.formOpen = false; steam.statusMsg = null;
      rebuildSlots(); ensurePanel(); render();
    }

    function onTrolleyCount(n) {
      n = parseInt(n, 10);
      if (!n || n < 1 || n > 500) n = 0;
      if (trolley.trolleyCount === n) return;
      trolley.trolleyCount = n; trolley.submitted = false; trolley.busy = false; trolley.statusMsg = null;
      rebuildSlots(); ensurePanel(); render();
    }

    function rebuildSlots() {
      var n = trolley.trolleyCount, old = trolley.slots;
      trolley.slots = [];
      for (var i = 0; i < n; i++) trolley.slots.push({ value: (old[i] && old[i].value) || '' });
    }

    function attachTrolleyWatcher() {
      var inp = document.getElementById(TROLLEY_FIELD) || document.querySelector('[id$="_f_noOfTrolleys"]');
      if (!inp || inp._bsdWatched) return !!inp;
      inp._bsdWatched = true;
      inp.addEventListener('input', function () { onTrolleyCount(inp.value); });
      inp.addEventListener('change', function () { onTrolleyCount(inp.value); });
      if (inp.value) onTrolleyCount(inp.value);
      return true;
    }

    function ensurePanel() {
      if (getPanel()) return;
      var panel = document.createElement('div');
      panel.id = PANEL_ID; panel.className = 'no-print';
      panel.style.cssText = 'margin:18px 0;padding:14px 18px;border:2px solid #2d6a3e;border-radius:12px;background:#f2faf4';
      rootEl().appendChild(panel);
    }

    // ── Boot ──────────────────────────────────────────────────────────────────

    document.addEventListener('bt:scanned', function (e) { onScanned(e && e.detail); });

    var pollCount = 0;
    var pollTimer = setInterval(function () {
      if (attachTrolleyWatcher() || ++pollCount > 60) clearInterval(pollTimer);
    }, 300);

    new MutationObserver(function () { attachTrolleyWatcher(); })
      .observe(document.body || document.documentElement, { childList: true, subtree: true });

    var lateCheck = 0;
    var lateTimer = setInterval(function () {
      if (window.BarcodeTest && BarcodeTest.getScanned && BarcodeTest.getScanned()) {
        onScanned(BarcodeTest.getScanned()); clearInterval(lateTimer);
      } else if (++lateCheck > 10) clearInterval(lateTimer);
    }, 300);
  }

  window.BarcodeSplitDrying = { init: init };
})();
