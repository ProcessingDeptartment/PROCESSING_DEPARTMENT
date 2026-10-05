/*
 * entry-flow.js -- focused entry panels for two roster records (2026-10-02 redesign):
 *   EntryFlow.oosw()       REC 7.1.5  size-range buttons -> weight -> Add weight, green totals below
 *   EntryFlow.receiving()  REC 7.1.2  Job info (confirm) -> Basket entry -> Basket list
 *
 * The engine (form-record.js) roster stays the single store: this file only reads / replaces its rows
 * through container._getRows() / container._setRows(), so storage keys, DB columns, validation, CSV and
 * print (the engine's own roster table, shown again under @media print) are exactly as before.
 * Styles live in styles/responsive.css (.ef-*).
 */
(function () {
  'use strict';
  if (window.EntryFlow) return;

  var FALLBACK_OOSW = ['0-50g', '50-100g', '100-150g', '150-200g', '200-250g', '250-300g', '300-350g', '350-400g', '400-450g', '450g+'];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt2(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function rosterHost() { return $('fr_rosterRows'); }
  function getRows() {
    var h = rosterHost();
    return (h && h._getRows) ? h._getRows().map(function (r) { return Object.assign({}, r); }) : [];
  }
  function setRows(rows) { var h = rosterHost(); if (h && h._setRows) h._setRows(rows); }
  function nonBlank(r) {
    return Object.keys(r).some(function (k) { return k.charAt(0) !== '_' && String(r[k] == null ? '' : r[k]).trim() !== ''; });
  }

  // brief message at the top of a panel (2 s, tap to dismiss)
  function toastIn(wrap, msg) {
    var t = wrap.querySelector('.ef-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'ef-toast';
      t.setAttribute('role', 'status');
      t.addEventListener('click', function () { t.classList.remove('show'); });
      wrap.insertBefore(t, wrap.firstChild);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }

  // "Remove X? [Yes, remove] [Keep]" bar in a stable slot element
  function confirmBar(slot, msg, onYes) {
    slot.innerHTML = '<div class="ef-confirm" role="alertdialog"><span>' + esc(msg) + '</span>' +
      '<button type="button" class="ef-btn ef-btn-danger" data-y>Yes, remove</button>' +
      '<button type="button" class="ef-btn" data-n>Keep</button></div>';
    var done = function () { slot.innerHTML = ''; };
    slot.querySelector('[data-y]').addEventListener('click', function () { done(); onYes(); });
    slot.querySelector('[data-n]').addEventListener('click', done);
    try { slot.querySelector('[data-n]').focus(); } catch (e) { }
  }

  // run fn now and after every engine re-render (draft load, job pick, Save & New ...)
  function watch(fn) {
    var pending = false;
    function kick() { if (pending) return; pending = true; setTimeout(function () { pending = false; try { fn(); } catch (e) { console.error('entry-flow', e); } }, 0); }
    (function boot() {
      var h = $('fr_modalSections');
      if (!h) { setTimeout(boot, 200); return; }
      new MutationObserver(kick).observe(h, { childList: true, subtree: true });
      h.addEventListener('input', kick);
      h.addEventListener('change', kick);
      kick();
    })();
  }

  // ======================================================================== REC 7.1.5 OOSW
  function oosw(opts) {
    opts = opts || {};
    var lockProbe = opts.lockProbe || 'fr_f_intakeDate';
    var S = { sel: '', pref: false, sig: '', opts: FALLBACK_OOSW.slice() };

    function sizeOpts() {
      var h = rosterHost();
      var s = h && h.querySelector('select[id$="_sizeRange"]');
      if (s) {
        var o = [].slice.call(s.options).map(function (x) { return x.value; }).filter(Boolean);
        if (o.length) S.opts = o;
      }
      return S.opts;
    }
    function isLocked() { var p = $(lockProbe); return !!(p && p.disabled); }
    function stored() {
      return getRows().filter(function (r) { return r.sizeRange && num(r.weight) > 0; });
    }
    function storedFor(size) {
      var r = stored().filter(function (x) { return x.sizeRange === size; })[0];
      return r ? String(r.weight) : '';
    }
    function intakeKg() { var f = $('fr_f_jiIntakeWeight'); var n = f ? num(f.value) : null; return n > 0 ? n : null; }

    function build(host) {
      var det = host.closest('details') || host.parentNode;
      var panel = document.createElement('div');
      panel.id = 'ef_oosw';
      panel.className = 'ef-panel no-print';
      panel.innerHTML =
        '<div class="ef-label" id="ef_sr_lab">Size range</div>' +
        '<div class="ef-seg" id="ef_seg" role="group" aria-labelledby="ef_sr_lab"></div>' +
        '<label class="ef-field" for="ef_w"><span class="ef-label">Weight (kg)</span>' +
          '<span class="ef-input-wrap"><input type="text" id="ef_w" inputmode="decimal" autocomplete="off" disabled>' +
          '<span class="ef-suffix" aria-hidden="true">kg</span></span></label>' +
        '<div class="ef-hint">Enter the total weight for this size range.</div>' +
        '<div class="ef-err" id="ef_err" role="alert"></div>' +
        '<button type="button" class="ef-btn ef-btn-primary ef-btn-lg" id="ef_add" disabled>Add weight</button>';
      var totals = document.createElement('div');
      totals.id = 'ef_totals';
      totals.className = 'ef-totals no-print';
      totals.innerHTML = '<div class="ef-toastwrap"></div><div id="ef_conf"></div><div class="ef-totals-head">Size range totals</div>' +
        '<div class="ef-hint">Percentages are auto-calculated from the total.</div><div id="ef_trows"></div>';
      host.parentNode.insertBefore(panel, host);
      host.parentNode.insertBefore(totals, host);
      // the engine's own table / totals stay in the DOM (the store, and what prints) but are not shown on screen
      host.classList.add('ef-screen-hide');
      var rt = host.parentNode.querySelector('[id^="fr_rosterTotals"]'); if (rt) rt.classList.add('ef-screen-hide');
      ['fr_addRosterRowBtn', 'fr_importCsvBtn'].forEach(function (id) {
        var b = host.parentNode.querySelector('[id^="' + id + '"]'); if (b) b.classList.add('ef-screen-hide');
      });
      wire(panel, totals);
    }

    function wire(panel, totals) {
      var w = panel.querySelector('#ef_w'), add = panel.querySelector('#ef_add');
      panel.querySelector('#ef_seg').addEventListener('click', function (e) {
        var b = e.target.closest('[data-size]'); if (!b || b.disabled) return;
        select(b.getAttribute('data-size'), true);
      });
      w.addEventListener('input', function () { panel.querySelector('#ef_err').textContent = ''; updateAdd(); });
      w.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!add.disabled) addWeight(); } });
      add.addEventListener('click', addWeight);
      totals.addEventListener('click', function (e) {
        var ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
        if (ed) { select(ed.getAttribute('data-edit'), false, true); }
        else if (del) {
          var size = del.getAttribute('data-del'), kg = storedFor(size);
          confirmBar($('ef_conf'), 'Remove ' + size + ' (' + fmt2(num(kg)) + ' kg)?', function () {
            setRows(getRows().filter(function (r) { return r.sizeRange !== size; }));
            if (S.sel === size) { S.sel = ''; S.pref = false; w.value = ''; }
            render(true);
          });
        }
      });
    }

    function select(size, toggle, scroll) {
      var w = $('ef_w');
      if (toggle && S.sel === size) { S.sel = ''; S.pref = false; w.value = ''; }
      else {
        S.sel = size;
        var cur = storedFor(size);
        w.value = cur; S.pref = cur !== '';
        var er = $('ef_err'); if (er) er.textContent = '';
      }
      render(true);
      if (scroll) { var p = $('ef_oosw'); if (p && p.scrollIntoView) p.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); }
      if (S.sel) { try { w.focus(); w.select(); } catch (e) { } }
    }

    function updateAdd() {
      var w = $('ef_w'), add = $('ef_add'); if (!w || !add) return;
      var lock = isLocked();
      w.disabled = !S.sel || lock;
      add.disabled = !S.sel || lock || !(num(w.value) > 0);
      add.textContent = S.pref ? 'Update weight' : 'Add weight';
    }

    function addWeight() {
      var w = $('ef_w'), err = $('ef_err');
      var kg = num(w.value);
      if (!S.sel) { err.textContent = 'Pick a size range first.'; return; }
      if (!(kg > 0)) { err.textContent = 'Enter a weight greater than 0 kg.'; try { w.focus(); } catch (e) { } return; }
      var rows = getRows().filter(nonBlank);
      var had = false;
      rows.forEach(function (r) { if (r.sizeRange === S.sel) { r.weight = String(kg); had = true; } });
      if (!had) rows.push({ sizeRange: S.sel, weight: String(kg) });
      var order = sizeOpts();
      rows.sort(function (a, b) {
        var ia = order.indexOf(a.sizeRange), ib = order.indexOf(b.sizeRange);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      setRows(rows);
      toastIn($('ef_totals').querySelector('.ef-toastwrap').parentNode, S.sel + (had ? ' updated to ' : ' set to ') + fmt2(kg) + ' kg');
      toastIn($('ef_oosw'), S.sel + (had ? ' updated to ' : ' set to ') + fmt2(kg) + ' kg');
      w.value = ''; S.pref = false; err.textContent = '';
      render(true);
      try { w.focus(); } catch (e) { }
    }

    function render(force) {
      var host = rosterHost();
      if (!host) return;
      if (!$('ef_oosw')) { build(host); S.sel = ''; S.pref = false; S.sig = ''; }   // fresh form render: nothing selected
      var opts = sizeOpts(), rows = stored(), lock = isLocked();
      var sig = JSON.stringify([opts, S.sel, S.pref, lock, rows.map(function (r) { return [r.sizeRange, r.weight]; }), intakeKg()]);
      if (!force && sig === S.sig) { updateAdd(); return; }
      S.sig = sig;
      var panel = $('ef_oosw');
      panel.classList.toggle('ef-locked', lock);
      $('ef_seg').innerHTML = opts.map(function (o) {
        var on = o === S.sel;
        return '<button type="button" class="ef-seg-btn' + (on ? ' on' : '') + '" data-size="' + esc(o) + '" aria-pressed="' + on + '"' + (lock ? ' disabled' : '') + '>' +
          (on ? '<span class="ef-tick" aria-hidden="true">✓</span>' : '') + esc(o) + '</button>';
      }).join('');
      var total = rows.reduce(function (s, r) { return s + num(r.weight); }, 0);
      var html = '';
      rows.forEach(function (r) {
        var kg = num(r.weight), pct = total > 0 ? kg / total * 100 : 0;
        html += '<div class="ef-trow"><span class="ef-tsize">' + esc(r.sizeRange) + '</span>' +
          '<span class="ef-tkg">' + fmt2(kg) + ' kg</span>' +
          '<span class="ef-tpct" aria-readonly="true" title="Auto-calculated"><span aria-hidden="true">🔒</span> ' + fmt2(pct) + ' %</span>' +
          (lock ? '' : '<button type="button" class="ef-link" data-edit="' + esc(r.sizeRange) + '" aria-label="Edit ' + esc(r.sizeRange) + '">Edit</button>' +
            '<button type="button" class="ef-x" data-del="' + esc(r.sizeRange) + '" aria-label="Remove ' + esc(r.sizeRange) + '">✕</button>') + '</div>';
      });
      if (!rows.length) html += '<div class="ef-hint">Add weights above for each size range.</div>';
      html += '<div class="ef-trow ef-ttotal"><span class="ef-tsize">Total OOSW</span><span class="ef-tkg">' + fmt2(total) + ' kg</span>' +
        '<span class="ef-tpct">' + (rows.length ? '100.00' : '0.00') + ' %</span></div>';
      var ik = intakeKg();
      if (ik && total > 0) html += '<div class="ef-hint">OOSW % of job whole weight: ' + fmt2(total / ik * 100) + ' %</div>';
      $('ef_trows').innerHTML = html;
      updateAdd();
    }

    watch(function () { render(false); });
  }

  // ======================================================================== REC 7.1.2 receiving
  function receiving(opts) {
    opts = opts || {};
    var required = opts.required || ['jobNo', 'receivingDate', 'receivedFrom', 'toBeProcessedFor'];
    var lockProbe = opts.lockProbe || 'fr_f_receivingDate';
    var S = { size: '', confirmed: false, init: false, sig: '', pendingCount: '', modalSel: '' };

    function isLocked() { var p = $(lockProbe); return !!(p && p.disabled); }
    function fval(k) { var i = $('fr_f_' + k); return i ? String(i.value || '').trim() : ''; }
    function jobValid() {
      var ok = required.every(function (k) { return fval(k); });
      var bad = document.querySelector('#fr_modalSections .fr-jn-hint.bad');
      return ok && !bad;
    }
    function baskets() { return getRows().filter(nonBlank); }
    function sizeList() { return (window.Lookups && window.Lookups.get && window.Lookups.get('sizeRanges')) || []; }
    function canScan() { return 'BarcodeDetector' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
    function totalKg(rows) { return rows.reduce(function (s, r) { return s + (num(r.wholeWeight) || 0); }, 0); }
    function plural(n) { return n + (n === 1 ? ' basket' : ' baskets'); }

    function sections() {
      var host = rosterHost();
      var rd = host && host.closest('details');
      var ms = $('fr_modalSections');
      var jd = ms && ms.querySelector('details.fr-section-collapsible');
      return (rd && jd && rd !== jd) ? { jd: jd, rd: rd, host: host } : null;
    }

    function build(sec) {
      var s2 = document.createElement('details');
      s2.id = 'ef_s2';
      s2.className = 'fr-section-collapsible ef-sec';
      s2.open = true;
      var scan = canScan();
      s2.innerHTML =
        '<summary class="fr-section-title">Basket entry</summary>' +
        '<div class="ef-body no-print">' +
          '<div class="ef-sizebar"><span class="ef-sb-lab">SIZE RANGE ·</span> <strong id="ef_cur" class="ef-cur">Not set</strong>' +
            '<button type="button" class="ef-btn" id="ef_newsize">⟳ New size range</button></div>' +
          (scan ? '<button type="button" class="ef-btn ef-btn-lg ef-scanbtn" id="ef_scan">📷 Scan barcode</button><div class="ef-or">or enter it below</div>' : '') +
          '<label class="ef-field" for="ef_bn"><span class="ef-label">Basket #</span>' +
            '<input type="text" id="ef_bn" inputmode="numeric" autocomplete="off"></label>' +
          '<div class="ef-suggest" id="ef_fd" hidden></div>' +
          '<div class="ef-hint">Basket # = lot code without \'FD\' — e.g. FD1234 → 1234</div>' +
          '<label class="ef-field" for="ef_w"><span class="ef-label">Weight (kg)</span>' +
            '<span class="ef-input-wrap"><input type="text" id="ef_w" inputmode="decimal" autocomplete="off"><span class="ef-suffix" aria-hidden="true">kg</span></span></label>' +
          '<div class="ef-err" id="ef_err" role="alert"></div>' +
          '<button type="button" class="ef-btn ef-btn-primary ef-btn-lg" id="ef_add" disabled>Add basket</button>' +
          '<div class="ef-tally" id="ef_tally"></div>' +
        '</div>';
      sec.rd.parentNode.insertBefore(s2, sec.rd);

      // Section 1: Confirm button inside the section
      var jb = document.createElement('div');
      jb.className = 'ef-body ef-confirmrow no-print';
      jb.innerHTML = '<div class="ef-err" id="ef_jerr" role="alert"></div>' +
        '<button type="button" class="ef-btn ef-btn-primary" id="ef_confirm" disabled>Confirm job info</button>';
      sec.jd.appendChild(jb);

      // Section 3: heading + list; the engine table stays (store + print) but is not shown on screen
      var sm = sec.rd.querySelector(':scope > summary');
      if (sm) sm.innerHTML = 'Basket list<span class="ef-s3-sum" id="ef_s3sum"></span>';
      sec.rd.open = false;
      sec.rd.classList.add('ef-sec');
      var list = document.createElement('div');
      list.className = 'ef-body no-print';
      list.innerHTML = '<div class="ef-toastwrap"></div><div id="ef_conf"></div><div id="ef_list"></div>' +
        '<button type="button" class="ef-link ef-addmore" id="ef_more">＋ Add more baskets</button>';
      sec.host.parentNode.insertBefore(list, sec.host);
      sec.host.classList.add('ef-screen-hide');
      var rt = sec.host.parentNode.querySelector('[id^="fr_rosterTotals"]'); if (rt) rt.classList.add('ef-screen-hide');
      ['fr_addRosterRowBtn', 'fr_importCsvBtn'].forEach(function (id) {
        var b = sec.host.parentNode.querySelector('[id^="' + id + '"]'); if (b) b.classList.add('ef-screen-hide');
      });
      wire(sec, s2);
    }

    function wire(sec, s2) {
      var bn = s2.querySelector('#ef_bn'), w = s2.querySelector('#ef_w');
      bn.addEventListener('input', function () { S.pendingCount = ''; s2.querySelector('#ef_err').textContent = ''; fdHint(); updateAdd(); });
      bn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); w.focus(); } });
      w.addEventListener('input', function () { s2.querySelector('#ef_err').textContent = ''; updateAdd(); });
      w.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!$('ef_add').disabled) addBasket(); } });
      s2.querySelector('#ef_fd').addEventListener('click', function (e) {
        var b = e.target.closest('[data-use]'); if (!b) return;
        bn.value = b.getAttribute('data-use'); fdHint(); updateAdd();
        try { w.focus(); } catch (er) { }
      });
      $('ef_add').addEventListener('click', addBasket);
      $('ef_newsize').addEventListener('click', sizeModal);
      var sc = $('ef_scan'); if (sc) sc.addEventListener('click', scan);
      $('ef_confirm').addEventListener('click', confirmJob);
      $('ef_more').addEventListener('click', function () {
        s2.open = true;
        if (s2.scrollIntoView) s2.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
        try { bn.focus(); } catch (e) { }
      });
      $('ef_list').addEventListener('click', function (e) {
        var d = e.target.closest('[data-del]'); if (!d) return;
        var i = parseInt(d.getAttribute('data-del'), 10), rows = baskets(), r = rows[i];
        if (!r) return;
        confirmBar($('ef_conf'), 'Remove basket ' + r.basketNr + '?', function () {
          var cur = baskets(); cur.splice(i, 1); setRows(cur); render(true);
        });
      });
    }

    function fdHint() {
      var bn = $('ef_bn'), box = $('ef_fd'), v = bn.value.trim();
      if (/^fd/i.test(v)) {
        var d = v.replace(/^fd[\s\-_]*/i, '');
        box.hidden = false;
        box.innerHTML = 'Did you mean <strong>' + esc(d) + '</strong>? <button type="button" class="ef-btn" data-use="' + esc(d) + '">Use ' + esc(d) + '</button>';
      } else { box.hidden = true; box.innerHTML = ''; }
    }

    function updateAdd() {
      var add = $('ef_add'); if (!add) return;
      add.disabled = !($('ef_bn').value.trim() && num($('ef_w').value) > 0 && S.size);
    }

    function addBasket() {
      var bn = $('ef_bn'), w = $('ef_w'), err = $('ef_err');
      var b = bn.value.trim(), kg = num(w.value);
      if (!S.size) { err.textContent = 'Set a size range first.'; return; }
      if (!b) { err.textContent = 'Enter the basket #.'; bn.focus(); return; }
      if (!/^\d+$/.test(b)) { err.textContent = /^fd/i.test(b) ? 'Basket # is the lot code without \'FD\'.' : 'Basket # must be a number.'; bn.focus(); return; }
      if (!(kg > 0)) { err.textContent = 'Enter a weight greater than 0 kg.'; w.focus(); return; }
      var rows = baskets();
      rows.push({ sizeRange: S.size, basketNr: b, wholeWeight: String(kg), farmCount: S.pendingCount || '', mortalityCount: '' });
      setRows(rows);
      toastIn($('ef_s2').querySelector('.ef-body'), 'Basket ' + b + ' added — ' + fmt2(kg) + ' kg · ' + S.size);
      bn.value = ''; w.value = ''; S.pendingCount = ''; err.textContent = '';
      fdHint(); render(true);
      try { bn.focus(); } catch (e) { }
    }

    // ---- size range modal
    function sizeModal() {
      var list = sizeList();
      var m = document.createElement('div');
      m.className = 'ef-modal';
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Select size range');
      S.modalSel = S.size;
      m.innerHTML = '<div class="ef-card"><h3>Select size range</h3><div class="ef-modal-list' + (list.length > 6 ? ' ef-vert' : '') + '">' +
        list.map(function (o) { return '<button type="button" class="ef-seg-btn' + (o === S.modalSel ? ' on' : '') + '" data-size="' + esc(o) + '" aria-pressed="' + (o === S.modalSel) + '">' + esc(o) + '</button>'; }).join('') +
        '</div><div class="ef-modal-actions"><button type="button" class="ef-btn" data-cancel>Cancel</button>' +
        '<button type="button" class="ef-btn ef-btn-primary" data-set' + (S.modalSel ? '' : ' disabled') + '>Set size range</button></div></div>';
      document.body.appendChild(m);
      function close() { document.removeEventListener('keydown', onKey, true); m.remove(); try { $('ef_newsize').focus(); } catch (e) { } }
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }
      document.addEventListener('keydown', onKey, true);
      m.addEventListener('click', function (e) {
        var b = e.target.closest('[data-size]');
        if (b) {
          S.modalSel = b.getAttribute('data-size');
          [].forEach.call(m.querySelectorAll('[data-size]'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
          m.querySelector('[data-set]').disabled = false;
        } else if (e.target.closest('[data-cancel]') || e.target === m) close();
        else if (e.target.closest('[data-set]') && S.modalSel) { S.size = S.modalSel; close(); render(true); updateAdd(); try { $('ef_bn').focus(); } catch (er) { } }
      });
      try { (m.querySelector('.on') || m.querySelector('[data-size]') || m.querySelector('[data-cancel]')).focus(); } catch (e) { }
    }

    // ---- barcode (BarcodeDetector only; button is absent when unsupported)
    function readBasket(raw) {
      raw = String(raw || '').trim();
      var bM = raw.match(/(?:basket|bkt)\D*(\d+)/i), cM = raw.match(/(?:count|cnt|qty)\D*(\d+)/i);
      if (bM) { S.pendingCount = cM ? cM[1] : ''; return bM[1]; }   // labelled barcodes keep their count
      S.pendingCount = '';
      return raw;
    }
    function gotBasket(raw) {
      var bn = $('ef_bn'); if (!bn) return;
      bn.value = readBasket(raw);
      var keep = S.pendingCount; fdHint(); S.pendingCount = keep; updateAdd();
      try { $('ef_w').focus(); } catch (e) { }
    }
    function scan() {
      var m = document.createElement('div');
      m.className = 'ef-modal';
      m.innerHTML = '<div class="ef-card"><h3>Scan barcode</h3><video playsinline muted class="ef-video"></video>' +
        '<div class="ef-modal-actions"><button type="button" class="ef-btn" data-cancel>Cancel</button></div></div>';
      document.body.appendChild(m);
      var video = m.querySelector('video'), stream = null, timer = null;
      function stop() { clearInterval(timer); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); m.remove(); }
      m.querySelector('[data-cancel]').addEventListener('click', stop);
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
        stream = s; video.srcObject = s; video.play();
        var det = new window.BarcodeDetector();
        timer = setInterval(function () {
          det.detect(video).then(function (codes) {
            if (codes && codes.length && m.isConnected) { var v = codes[0].rawValue; stop(); gotBasket(v); }
          }).catch(function () { });
        }, 250);
      }).catch(function () {
        stop(); toastIn($('ef_s2').querySelector('.ef-body'), 'Camera not available — type the basket #.');
      });
    }
    // scale integration hook kept from the previous page: fills the weight field
    window.RecScale = { submitWeight: function (kg) {
      var n = parseFloat(kg), w = $('ef_w'); if (isNaN(n) || !w) return;
      w.value = String(n); updateAdd(); try { w.focus(); } catch (e) { }
    } };

    // ---- Section 1 confirm / gate
    function setGate(on) {
      document.body.classList.toggle('ef-unconfirmed', on);
      ['ef_s2'].concat([]).forEach(function () { });
      var sec = sections(); if (!sec) return;
      [$('ef_s2'), sec.rd].forEach(function (n) {
        if (!n) return;
        n.classList.toggle('ef-gated', on);
        if (on) n.setAttribute('inert', ''); else n.removeAttribute('inert');
      });
    }
    function confirmJob() {
      var sec = sections(); if (!sec) return;
      var err = $('ef_jerr');
      if (!jobValid()) { err.textContent = 'Complete the job info fields first.'; return; }
      err.textContent = '';
      var first = !S.confirmed;
      S.confirmed = true;
      function after() {
        sec.jd.classList.remove('ef-closing');
        sec.jd.open = false;
        setGate(false);
        if (first) { $('ef_s2').open = true; sec.rd.open = false; }
        render(true);
        var sc = $('ef_scan'), bn = $('ef_bn');
        try { ((sc && sc.offsetParent) ? sc : bn).focus(); } catch (e) { }
      }
      if (!sec.jd.open || reduced()) { after(); }
      else { sec.jd.classList.add('ef-closing'); setTimeout(after, 150); }
    }
    function updateConfirm() {
      var b = $('ef_confirm'); if (b) b.disabled = !jobValid();
    }

    // submit needs at least one basket (the engine keeps its own checks)
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('#fr_submitBtn');
      if (!b || !$('ef_s2') || isLocked() || baskets().length) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var s2 = $('ef_s2'); s2.open = true;
      toastIn(s2.querySelector('.ef-body'), 'Add at least one basket before submitting.');
    }, true);
    // keep the existing draft guard: job info must be complete before a draft is saved
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('#fr_saveBtn');
      if (!b || jobValid()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      alert('Complete the Job info section (job no., receiving date, received from, processing for) before saving a draft.');
      var jn = $('fr_f_jobNo'); if (jn) try { jn.focus(); } catch (err) { }
    }, true);

    function render(force) {
      var sec = sections();
      if (!sec) { document.body.classList.remove('ef-unconfirmed'); return; }
      var lock = isLocked();
      document.body.classList.add('ef-page');
      if (!$('ef_s2')) {                       // a fresh form render: decide the starting state
        build(sec);
        S.init = false;
      }
      var rows = baskets();
      if (!S.init) {
        S.init = true;
        S.size = rows.length ? (rows[rows.length - 1].sizeRange || '') : '';
        S.confirmed = lock || (jobValid() && rows.length > 0);
        S.sig = '';
        if (S.confirmed) { sec.jd.open = false; $('ef_s2').open = true; sec.rd.open = false; }
        else { sec.jd.open = true; }
      }
      setGate(!S.confirmed && !lock);
      $('ef_s2').hidden = lock;
      $('ef_confirm').parentNode.hidden = lock;
      updateConfirm();
      var tk = totalKg(rows);
      var sig = JSON.stringify([S.size, lock, S.confirmed, rows.map(function (r) { return [r.sizeRange, r.basketNr, r.wholeWeight]; })]);
      if (force || sig !== S.sig) {
        S.sig = sig;
        var cur = $('ef_cur');
        cur.textContent = S.size || 'Not set';
        cur.classList.toggle('ef-amber', !S.size);
        $('ef_tally').textContent = 'Baskets added: ' + rows.length + '  ·  Total weight: ' + fmt2(tk) + ' kg';
        $('ef_s3sum').textContent = ' — ' + plural(rows.length) + ' · ' + fmt2(tk) + ' kg';
        $('ef_list').innerHTML = !rows.length ? '<div class="ef-hint">No baskets added yet.</div>' :
          '<div class="ef-brow ef-bhead" aria-hidden="true"><span>Basket #</span><span>Size range</span><span>Weight (kg)</span><span></span></div>' +
          rows.map(function (r, i) {
            return '<div class="ef-brow"><span class="ef-bn">' + esc(r.basketNr) + '</span><span class="ef-bs">' + esc(r.sizeRange) + '</span>' +
              '<span class="ef-bw">' + fmt2(num(r.wholeWeight) || 0) + ' kg</span>' +
              (lock ? '<span></span>' : '<button type="button" class="ef-x" data-del="' + i + '" aria-label="Remove basket ' + esc(r.basketNr) + '">✕</button>') + '</div>';
          }).join('');
        $('ef_more').hidden = lock;
        var sb = $('fr_submitBtn');
        if (sb && !lock) sb.setAttribute('aria-disabled', rows.length ? 'false' : 'true');
      }
      updateAdd();
    }

    watch(function () { render(false); });
  }

  window.EntryFlow = { oosw: oosw, receiving: receiving };
})();
