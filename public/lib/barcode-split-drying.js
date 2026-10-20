/* barcode-split-drying.js -- optional batch split panel for REC 7.4.1 (Drying Process).
 *
 *   BarcodeSplitDrying.init({ recordKey: 'drying-process' })
 *
 * Appears after BarcodeTest logs a successful job scan at the drying stage. The operator can
 * optionally split the batch into room/trolley groups; clicking "Save batch split" calls
 * POST /api/traceability/split. Requires BarcodeTest + BarcodeScan + FacilityApi.
 *
 * The panel is no-print (hidden from PDF). Child barcodes are proposed as {PARENT}-D1, -D2 etc.
 * but the operator can override. Reconciliation check shows input weight vs. sum of outputs.
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

  function init(cfg) {
    if (!(window.BarcodeScan && window.BarcodeScan.allowed())) return;

    var state = {
      parentBarcode: null,
      inputWeight: null,
      splitEnabled: false,
      rows: [],          // [{ label, barcodeValue, weight }]
      submitted: false,
      busy: false
    };

    function getPanel() { return document.getElementById(PANEL_ID); }
    function rootEl() { return document.getElementById('frRoot') || document.getElementById('mlRoot') || document.body; }

    function sumOutputs() {
      return state.rows.reduce(function (s, r) { return s + (parseFloat(r.weight) || 0); }, 0);
    }

    // ── HTML helpers ─────────────────────────────────────────────────────────

    function reconHtml() {
      if (!state.splitEnabled || state.rows.length < 2) return '';
      if (state.inputWeight == null) return '';
      var out = sumOutputs();
      var diff = out - state.inputWeight;
      var ok = Math.abs(diff) < 0.5;
      var bg = ok ? '#f2faf4' : '#fff8f8';
      var border = ok ? '#a3d4b0' : '#f0b0b0';
      var col = ok ? '#1f6a37' : '#b33';
      return '<div class="bsd-recon" style="margin:10px 0;padding:8px 12px;border-radius:6px;background:' + bg + ';border:1px solid ' + border + '">' +
        '<div style="font:600 13px system-ui,sans-serif;color:' + col + '">' + (ok ? '&#10003; Reconciliation OK' : '&#9888; Variance detected') + '</div>' +
        '<div style="font:12px system-ui,sans-serif;color:#555;margin-top:3px">' +
        'Input: ' + state.inputWeight.toFixed(2) + ' kg &nbsp;&middot;&nbsp; ' +
        'Output: ' + out.toFixed(2) + ' kg &nbsp;&middot;&nbsp; ' +
        'Difference: ' + (diff >= 0 ? '+' : '') + diff.toFixed(2) + ' kg' +
        '</div></div>';
    }

    function rowHtml(i, r) {
      var g = 'display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;padding:10px;background:#fff;border:1px solid #e0e0e0;border-radius:8px';
      return '<div class="bsd-row" data-idx="' + i + '" style="' + g + '">' +
        '<label style="display:block"><span style="font:11px system-ui,sans-serif;color:#666;display:block;margin-bottom:3px">Room / trolley group</span>' +
        '<input class="bsd-lbl" type="text" value="' + esc(r.label) + '" placeholder="e.g. Room 2, T1&ndash;10" style="width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font:14px system-ui,sans-serif;box-sizing:border-box"></label>' +
        '<label style="display:block"><span style="font:11px system-ui,sans-serif;color:#666;display:block;margin-bottom:3px">Barcode</span>' +
        '<input class="bsd-bc" type="text" value="' + esc(r.barcodeValue) + '" placeholder="e.g. FD1234-D1" style="width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font:13px monospace;text-transform:uppercase;box-sizing:border-box"></label>' +
        '<label style="display:block"><span style="font:11px system-ui,sans-serif;color:#666;display:block;margin-bottom:3px">Weight (kg)</span>' +
        '<input class="bsd-wt" type="number" step="0.01" min="0" value="' + esc(r.weight) + '" placeholder="0.0" style="width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font:14px system-ui,sans-serif;box-sizing:border-box"></label>' +
        '<button type="button" class="bsd-rm" data-idx="' + i + '" style="padding:6px 10px;font:12px system-ui,sans-serif;border:1px solid #d44;border-radius:6px;background:#fff8f8;color:#a33;cursor:pointer;white-space:nowrap">Remove</button>' +
        '</div>';
    }

    function bodyHtml(statusMsg, statusKind) {
      if (state.submitted) {
        return '<div style="padding:12px 0;font:14px system-ui,sans-serif;color:#2d6a3e">&#10003; Batch split recorded &mdash; ' + esc(state.parentBarcode) + ' split into ' + state.rows.length + ' groups.</div>';
      }
      var infoLine = state.inputWeight != null
        ? '<div style="font:13px system-ui,sans-serif;color:#555;margin-bottom:8px">Parent barcode: <strong>' + esc(state.parentBarcode) + '</strong> &nbsp;&middot;&nbsp; Last recorded weight: <strong>' + state.inputWeight.toFixed(2) + ' kg</strong></div>'
        : '<div style="font:13px system-ui,sans-serif;color:#555;margin-bottom:8px">Parent barcode: <strong>' + esc(state.parentBarcode) + '</strong></div>';
      var splitBody = '';
      if (state.splitEnabled) {
        splitBody = '<div id="bsd_rows" style="margin-top:10px">' + state.rows.map(function (r, i) { return rowHtml(i, r); }).join('') + '</div>' +
          '<button type="button" id="bsd_add" style="margin:4px 0 10px;padding:6px 14px;font:13px system-ui,sans-serif;border:1px solid #2d6a3e;border-radius:6px;background:#f2faf4;color:#2d6a3e;cursor:pointer">+ Add group</button>' +
          reconHtml() +
          '<button type="button" id="bsd_save" ' + (state.busy ? 'disabled ' : '') + 'style="padding:10px 22px;font:600 14px system-ui,sans-serif;border:0;border-radius:8px;background:#2d6a3e;color:#fff;cursor:pointer">' + (state.busy ? 'Saving&hellip;' : 'Save batch split') + '</button>';
      }
      var statusLine = statusMsg
        ? '<div role="status" style="margin-top:8px;font:13px system-ui,sans-serif;color:' + (statusKind === 'ok' ? '#1f6a37' : statusKind === 'bad' ? '#b33' : '#555') + '">' + esc(statusMsg) + '</div>'
        : '';
      return infoLine +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font:14px system-ui,sans-serif;user-select:none">' +
        '<input type="checkbox" id="bsd_enable"' + (state.splitEnabled ? ' checked' : '') + ' style="width:16px;height:16px;cursor:pointer">' +
        'Split this lot into separate room / trolley groups</label>' +
        splitBody + statusLine;
    }

    // ── Render ───────────────────────────────────────────────────────────────

    var _statusMsg = null, _statusKind = null;

    function render(msg, kind) {
      if (msg !== undefined) { _statusMsg = msg; _statusKind = kind; }
      var panel = getPanel();
      if (!panel) return;
      panel.innerHTML =
        '<details open style="list-style:none"><summary style="font:600 14px/1.4 system-ui,sans-serif;color:#7a5c00;cursor:pointer;padding:2px 0">&#9654; SPLIT BATCH BY ROOM / TROLLEY GROUP <span style="font-weight:400;font-size:12px;color:#888">(optional)</span></summary>' +
        '<div style="padding:10px 0 4px">' + bodyHtml(_statusMsg, _statusKind) + '</div>' +
        '</details>';
      bindEvents();
    }

    function bindEvents() {
      var panel = getPanel();
      if (!panel) return;

      var cb = panel.querySelector('#bsd_enable');
      if (cb) cb.addEventListener('change', function () {
        state.splitEnabled = cb.checked;
        if (state.splitEnabled && state.rows.length < 2) {
          var base = state.parentBarcode || 'BC';
          state.rows = [
            { label: 'Group 1', barcodeValue: base + '-D1', weight: '' },
            { label: 'Group 2', barcodeValue: base + '-D2', weight: '' }
          ];
        }
        render(null);
      });

      var addBtn = panel.querySelector('#bsd_add');
      if (addBtn) addBtn.addEventListener('click', function () {
        var n = state.rows.length + 1;
        var base = state.parentBarcode || 'BC';
        state.rows.push({ label: 'Group ' + n, barcodeValue: base + '-D' + n, weight: '' });
        render(null);
      });

      panel.querySelectorAll('.bsd-rm').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          state.rows.splice(idx, 1);
          render(null);
        });
      });

      panel.querySelectorAll('.bsd-row').forEach(function (row) {
        var idx = parseInt(row.getAttribute('data-idx'), 10);
        row.querySelector('.bsd-lbl').addEventListener('input', function (e) { state.rows[idx].label = e.target.value; });
        row.querySelector('.bsd-bc').addEventListener('input', function (e) { state.rows[idx].barcodeValue = e.target.value.toUpperCase().replace(/\s/g, ''); e.target.value = state.rows[idx].barcodeValue; });
        row.querySelector('.bsd-wt').addEventListener('input', function (e) { state.rows[idx].weight = e.target.value; render(null); });
      });

      var saveBtn = panel.querySelector('#bsd_save');
      if (saveBtn) saveBtn.addEventListener('click', doSplit);
    }

    // ── Split ────────────────────────────────────────────────────────────────

    function doSplit() {
      if (!state.parentBarcode || state.busy) return;
      if (state.rows.length < 2) { render('Add at least 2 groups to split.', 'bad'); return; }
      for (var i = 0; i < state.rows.length; i++) {
        if (!state.rows[i].barcodeValue.trim()) { render('Enter a barcode value for every group.', 'bad'); return; }
        if (!state.rows[i].weight || isNaN(parseFloat(state.rows[i].weight))) { render('Enter a weight for every group.', 'bad'); return; }
      }
      var barcodes = state.rows.map(function (r) { return r.barcodeValue.trim().toUpperCase(); });
      if (new Set(barcodes).size !== barcodes.length) { render('Each group must have a unique barcode value.', 'bad'); return; }

      state.busy = true;
      render(null);
      api('/api/traceability/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentBarcodeValue: state.parentBarcode,
          splitReason: 'drying-room-split',
          user: who(),
          recordKey: cfg.recordKey,
          submissionId: 'drying-split-' + Date.now(),
          children: state.rows.map(function (r) {
            return { barcodeValue: r.barcodeValue.trim().toUpperCase(), weight: parseFloat(r.weight), label: r.label };
          })
        })
      }).then(function (res) {
        state.busy = false;
        if (!res.ok) { render('Split failed: ' + (res.error || 'server error'), 'bad'); return; }
        state.submitted = true;
        render(null);
      }).catch(function () {
        state.busy = false;
        render('Could not reach the server.', 'bad');
      });
    }

    // ── Panel mount ──────────────────────────────────────────────────────────

    function onScanned(data) {
      if (!data || !data.barcode) return;
      // Reset for the new barcode
      state.parentBarcode = data.barcode;
      state.inputWeight = null;
      state.splitEnabled = false;
      state.rows = [];
      state.submitted = false;
      state.busy = false;
      _statusMsg = null; _statusKind = null;

      // Fetch last weight from scan history
      api('/api/traceability/history/' + encodeURIComponent(data.barcode)).then(function (h) {
        if (h.ok && Array.isArray(h.stageEvents)) {
          var last = h.stageEvents.slice().reverse().find(function (e) { return e.weight != null; });
          if (last) state.inputWeight = last.weight;
        }
        ensurePanel();
        render(null);
      }).catch(function () { ensurePanel(); render(null); });
    }

    function ensurePanel() {
      if (getPanel()) return;
      var panel = document.createElement('div');
      panel.id = PANEL_ID; panel.className = 'no-print';
      panel.style.cssText = 'margin:18px 0;padding:14px 18px;border:2px solid #c8a000;border-radius:12px;background:#fffef0';
      rootEl().appendChild(panel);
    }

    // ── Boot ─────────────────────────────────────────────────────────────────

    document.addEventListener('bt:scanned', function (e) { onScanned(e && e.detail); });

    // Late init: BarcodeTest may have already scanned before this module loaded
    var t = null;
    function pollForExisting() {
      if (window.BarcodeTest && BarcodeTest.getScanned && BarcodeTest.getScanned()) {
        onScanned(BarcodeTest.getScanned()); return;
      }
      if (++t < 10) setTimeout(pollForExisting, 300);
    }
    t = 0; setTimeout(pollForExisting, 300);
  }

  window.BarcodeSplitDrying = { init: init };
})();
