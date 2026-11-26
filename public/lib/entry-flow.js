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
    var S = { sig: '', dupJob: null, dupResult: null };

    // ---- duplicate-submission warning
    function checkDuplicate(jobNo, onResult) {
      var done = false;
      function finish(r) { if (done) return; done = true; clearTimeout(timer); onResult(r); }
      var timer = setTimeout(function () { finish(null); }, 5000);
      function fromApi() {
        return window.FacilityApi.fetch('/api/submissions/salting-oosw?full=1&status=submitted&jobNo=' + encodeURIComponent(jobNo))
          .then(function (res) { if (!res.ok) throw new Error('api'); return res.json(); })
          .then(function (j) { return (j.rows || []).map(function (x) { return x.entry; }).filter(Boolean); });
      }
      function fromBlob() {
        return window.storage.get('formrecord:salting-oosw', true).then(function (r) {
          var subs = [];
          try { subs = r && r.value ? JSON.parse(r.value) : []; } catch (e) { }
          return Array.isArray(subs) ? subs : [];
        });
      }
      try {
        (window.FacilityApi ? fromApi().catch(fromBlob) : fromBlob()).then(function (subs) {
          var hits = subs.filter(function (s) {
            return s && s.status !== 'draft' && s.submittedAt && s.values && String(s.values.jobNo || '').trim() === jobNo;
          }).sort(function (a, b) { return b.submittedAt - a.submittedAt; });
          if (!hits.length) { finish({ found: false }); return; }
          var latest = hits[0];
          var kg = (latest.roster || []).reduce(function (t, x) { return t + (num(x.weight) || 0); }, 0);
          var intake = num(latest.values.jiIntakeWeight) || intakeKg();
          finish({ found: true, ooswKg: kg, ooswPct: (intake > 0 && kg > 0) ? kg / intake * 100 : null, submittedAt: latest.submittedAt, count: hits.length });
        }).catch(function () { finish(null); });
      } catch (e) { finish(null); }
    }
    function renderDupBanner(result) {
      var panel = $('ef_oosw'); if (!panel) return;
      var existing = $('ef_dup_warn');
      if (!result || !result.found || isLocked()) { if (existing) existing.remove(); return; }
      var dateStr = '';
      try {
        var d = new Date(result.submittedAt);
        dateStr = d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' +
          d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
      } catch (e) { }
      var html = '<div class="ef-dup-head">⚠ A record has already been submitted for this job.</div>' +
        '<div class="ef-dup-data">OOSW: ' + fmt2(result.ooswKg) + ' kg' + (result.ooswPct != null ? '  ·  ' + fmt2(result.ooswPct) + ' % of job weight' : '') + '</div>' +
        (dateStr ? '<div class="ef-dup-date">Submitted: ' + esc(dateStr) + '</div>' : '') +
        (result.count > 1 ? '<div class="ef-dup-extra">(+' + (result.count - 1) + ' more submission' + (result.count > 2 ? 's' : '') + ' for this job)</div>' : '');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'ef_dup_warn';
        existing.className = 'ef-dup-warning no-print';
        existing.setAttribute('role', 'alert');
        panel.parentNode.insertBefore(existing, panel);
      }
      existing.innerHTML = html;
    }
    function dupCheck() {
      var f = $('fr_f_jobNo'), job = f ? String(f.value || '').trim() : '';
      var ia = $('fr_f_intakeDate'), iw = $('fr_f_jiIntakeWeight');
      var settled = job && ((ia && ia.value) || (iw && iw.value) || /^[A-Za-z0-9]{3}\d{5}$/.test(job));
      if (!settled || isLocked()) { S.dupJob = null; S.dupResult = null; renderDupBanner(null); return; }
      if (S.dupJob !== job) {
        S.dupJob = job; S.dupResult = null; renderDupBanner(null);
        checkDuplicate(job, function (r) {
          if (S.dupJob !== job) return;
          S.dupResult = r; renderDupBanner(r);
        });
      } else if (S.dupResult) renderDupBanner(S.dupResult);
    }

    function isLocked() { var p = $(lockProbe); return !!(p && p.disabled); }
    function stored() { return getRows().filter(function (r) { return num(r.weight) > 0; }); }
    function intakeKg() { var f = $('fr_f_jiIntakeWeight'); var n = f ? num(f.value) : null; return n > 0 ? n : null; }

    function build(host) {
      var jpGated = host.closest('.jp-gated');
      var insertRef = jpGated || host.closest('details') || host;
      var insertParent = insertRef.parentNode;
      var panel = document.createElement('div');
      panel.id = 'ef_oosw';
      panel.className = 'ef-panel no-print';
      panel.innerHTML =
        '<label class="ef-field" for="ef_w"><span class="ef-label">OOSW weight (kg)</span>' +
          '<span class="ef-input-wrap"><input type="text" id="ef_w" inputmode="decimal" autocomplete="off">' +
          '<span class="ef-suffix" aria-hidden="true">kg</span></span></label>' +
        '<div class="ef-err" id="ef_err" role="alert"></div>' +
        '<button type="button" class="ef-btn ef-btn-primary ef-btn-lg" id="ef_add" disabled>Add weight</button>';
      var totals = document.createElement('div');
      totals.id = 'ef_totals';
      totals.className = 'ef-totals no-print';
      totals.innerHTML = '<div class="ef-toastwrap"></div><div id="ef_conf"></div><div class="ef-totals-head">OOSW totals</div><div id="ef_trows"></div>';
      insertParent.insertBefore(panel, insertRef);
      insertParent.insertBefore(totals, insertRef);
      host.classList.add('ef-screen-hide');
      var rt = host.parentNode.querySelector('[id^="fr_rosterTotals"]'); if (rt) rt.classList.add('ef-screen-hide');
      ['fr_addRosterRowBtn', 'fr_importCsvBtn'].forEach(function (id) {
        var b = host.parentNode.querySelector('[id^="' + id + '"]'); if (b) b.classList.add('ef-screen-hide');
      });
      wire(panel, totals);
    }

    function wire(panel, totals) {
      var w = panel.querySelector('#ef_w'), add = panel.querySelector('#ef_add');
      w.addEventListener('input', function () { panel.querySelector('#ef_err').textContent = ''; updateAdd(); });
      w.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (!add.disabled) addWeight(); } });
      add.addEventListener('click', addWeight);
      totals.addEventListener('click', function (e) {
        var del = e.target.closest('[data-del]');
        if (del) {
          var i = parseInt(del.getAttribute('data-del'), 10);
          var rows = stored(), r = rows[i];
          if (!r) return;
          confirmBar($('ef_conf'), 'Remove entry ' + (i + 1) + ' (' + fmt2(num(r.weight)) + ' kg)?', function () {
            var all = getRows().filter(nonBlank); all.splice(i, 1); setRows(all); render(true);
          });
        }
      });
    }

    function updateAdd() {
      var w = $('ef_w'), add = $('ef_add'); if (!w || !add) return;
      var lock = isLocked();
      w.disabled = lock;
      add.disabled = lock || !(num(w.value) > 0);
    }

    function addWeight() {
      var w = $('ef_w'), err = $('ef_err');
      var kg = num(w.value);
      if (!(kg > 0)) { err.textContent = 'Enter a weight greater than 0 kg.'; try { w.focus(); } catch (e) { } return; }
      var rows = getRows().filter(nonBlank);
      rows.push({ weight: String(kg) });
      setRows(rows);
      toastIn($('ef_totals'), fmt2(kg) + ' kg added');
      w.value = ''; err.textContent = '';
      render(true);
      try { w.focus(); } catch (e) { }
    }

    function render(force) {
      var host = rosterHost();
      if (!host) return;
      if (!$('ef_oosw')) { build(host); S.sig = ''; }
      var rows = stored(), lock = isLocked();
      dupCheck();
      var sig = JSON.stringify([lock, rows.map(function (r) { return r.weight; }), intakeKg()]);
      if (!force && sig === S.sig) { updateAdd(); return; }
      S.sig = sig;
      var panel = $('ef_oosw');
      panel.classList.toggle('ef-locked', lock);
      var total = rows.reduce(function (s, r) { return s + (num(r.weight) || 0); }, 0);
      var html = '';
      rows.forEach(function (r, i) {
        var kg = num(r.weight);
        html += '<div class="ef-trow"><span class="ef-tsize">Entry ' + (i + 1) + '</span>' +
          '<span class="ef-tkg">' + fmt2(kg) + ' kg</span>' +
          (lock ? '' : '<button type="button" class="ef-x" data-del="' + i + '" aria-label="Remove entry ' + (i + 1) + '">✕</button>') + '</div>';
      });
      if (!rows.length) html += '<div class="ef-hint">No weights added yet.</div>';
      html += '<div class="ef-trow ef-ttotal"><span class="ef-tsize">Total OOSW</span><span class="ef-tkg">' + fmt2(total) + ' kg</span></div>';
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
    function canScan() { return !!(window.Auth && window.Auth.getCurrentRole && window.Auth.getCurrentRole() === 'ADMINISTRATOR'); }
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
      var isAdmin = !!(window.Auth && window.Auth.getCurrentRole && window.Auth.getCurrentRole() === 'ADMINISTRATOR');
      bn.addEventListener('input', function () { S.pendingCount = ''; s2.querySelector('#ef_err').textContent = ''; fdHint(); updateAdd(); });
      if (isAdmin) {
        bn.addEventListener('focus', function () { try { bn.select(); } catch (er) { } });
        bn.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          var v = bn.value.trim();
          if (/^fd/i.test(v)) { fdHint(); }
          else if (num(w.value) > 0 && S.size) { addBasket(); }
          else { w.focus(); }
        });
      } else {
        bn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); w.focus(); } });
      }
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
      if (window.BarcodeScan && window.BarcodeScan.allowed()) { window.BarcodeScan.open(gotBasket, { title: 'Scan basket barcode' }); return; }
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
