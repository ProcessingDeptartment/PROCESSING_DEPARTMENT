/* ========================================================================
   record-chrome.js  --  Tablet UI v2 shared chrome (PILOT, opt-in)

   Active only when <body class="rt-tablet">. Adds, without touching engine
   logic, storage or validation:
     C4  sticky bottom action bar  (Clear / Save draft / Submit) -- the bar
         buttons CLICK the engine's own buttons, looked up at click time, so
         the engine's handlers are the only code that saves anything.
     C5  save-state chip in the top bar, driven by the engine's own toast
         messages. While a save is in flight the bar's Save/Submit are
         disabled (prevents a double submit).
     C6  server-wake banner if the first API call takes > 3 s.
     C11 Entries / Verification panel headings act as full-width bars.
     C12 "n field needs attention" note in the bar, built from the engine's
         own validation toast (no rules of its own); tap jumps to the field.

   Load it EARLY (right after <body>, before the engine scripts) so the
   fetch wrapper sees the first API call. Everything is idempotent: the
   record shell re-parents the engine's DOM, so ensure() re-runs on DOM
   changes and on a timer.
   ======================================================================== */
(function () {
  'use strict';

  var WAKE_AFTER_MS = 3000;
  var SAVE_TIMEOUT_MS = 20000;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function optedIn() { return document.body && document.body.classList.contains('rt-tablet'); }

  /* ---------------- C6: server-wake banner ---------------- */
  var wake = null, wakeTimer = null, gotResponse = false;
  function showWake(on) {
    if (!optedIn()) return;
    if (!wake) {
      wake = h('div', 'rt-wake');
      wake.setAttribute('role', 'status');
      wake.appendChild(h('div', null, 'Connecting to the server… this can take up to a minute after a quiet period'));
      wake.appendChild(h('div', 'rt-wake-bar'));
    }
    if (on) { if (!wake.parentNode) document.body.appendChild(wake); wake.hidden = false; }
    else if (wake.parentNode) { wake.hidden = true; }
  }
  function settled() {
    gotResponse = true;
    if (wakeTimer) { clearTimeout(wakeTimer); wakeTimer = null; }
    showWake(false);
  }
  if (typeof window.fetch === 'function' && !window.fetch.__rtChrome) {
    var origFetch = window.fetch;
    var wrapped = function () {
      var p = origFetch.apply(this, arguments);
      if (!gotResponse && !wakeTimer) {
        wakeTimer = setTimeout(function () { showWake(true); }, WAKE_AFTER_MS);
      }
      p.then(function (res) {
        try { if (res && /\/api\//.test(res.url || '')) { if (res.status === 401) setAuth(true); else if (res.ok) setAuth(false); } } catch (e) { /* detection only */ }
        settled();
      }, function () { /* a failed call is not a wake-up; leave the banner to the timer */ });
      return p;
    };
    wrapped.__rtChrome = true;
    window.fetch = wrapped;
  }

  /* ---------------- C5: save-state chip ---------------- */
  var chip = null, saveTimer = null, saving = false, lastState = null, stateBeforeSave = null;
  var authBad = false;
  var NOAUTH_TEXT = 'This device is not authorised for the records database \u2014 nothing will save. Tap to enter the access key.';
  function typedSomething() {
    var f = document.querySelectorAll('.rt-content input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]):not([readonly]), .rt-content textarea');
    for (var i = 0; i < f.length; i++) if (String(f[i].value || '').trim() !== '') return true;
    return false;
  }
  function setAuth(bad) { if (authBad === bad) return; authBad = bad; setState(lastState ? lastState.state : 'ready', lastState ? lastState.text : 'Ready'); }
  function setState(state, text) {
    lastState = { state: state, text: text };
    if (!chip) return;
    // with no access key, a quiet state (ready / saved / draft) is not true: nothing will save
    if (authBad && (state === 'ready' || state === 'saved' || state === 'draft')) { state = 'noauth'; text = NOAUTH_TEXT; }
    chip.dataset.state = state;
    // ready / saved and saving are icon-only (small green tick / red hourglass); the words stay in the tooltip and for screen readers
    var icon = (state === 'saved' || state === 'ready') ? '✓' : state === 'saving' ? '⌛' : state === 'noauth' ? '⚠' : null;
    chip.textContent = icon || text;
    chip.title = text;
    chip.setAttribute('aria-label', text);
  }
  function stateFromToast(msg) {
    var t = String(msg || '');
    if (/^Draft saved/i.test(t)) { endSaving(); var d = new Date(); setState('draft', 'Draft saved ' + pad(d.getHours()) + ':' + pad(d.getMinutes())); }
    else if (/submitted|^Entry (added|updated)|^Correction saved|^Verification logged/i.test(t)) { endSaving(); setState('saved', 'Saved'); }
    else if (/failed|could not be saved/i.test(t)) { endSaving(); setState('error', 'Error — tap to retry'); }
    else return false;
    return true;
  }
  function beginSaving() {
    if (!saving) stateBeforeSave = lastState;
    saving = true;
    setState('saving', 'Saving…');
    syncBar();
    clearTimeout(saveTimer);
    // No confirmation in time (validation refused it, or the call hung): free the bar again.
    saveTimer = setTimeout(function () { if (saving) { endSaving(); if (lastState && lastState.state === 'saving') setState(navigator.onLine ? 'error' : 'offline', navigator.onLine ? 'Error — tap to retry' : 'Offline — will retry'); } }, SAVE_TIMEOUT_MS);
  }
  function endSaving() { saving = false; clearTimeout(saveTimer); syncBar(); }
  window.addEventListener('offline', function () { setState('offline', 'Offline — will retry'); });
  window.addEventListener('online', function () { if (lastState && lastState.state === 'offline') setState('saved', 'Back online'); });

  /* ---------------- Submit and print ----------------
     Clicks the engine's Submit (so all validation and saving is the engine's), waits for its 'submitted' message, then presses
     the engine's own Print button for that entry (the row's [data-pdf] button, which prints the controlled-copy sheet). */
  var printAfterSubmit = false, printTimer = null;
  function pdfIds() {
    return Array.prototype.map.call(document.querySelectorAll('.rt-content [data-pdf], .rt-sheet [data-pdf]'), function (b) { return b.getAttribute('data-pdf'); });
  }
  var idsBeforeSubmit = [];
  function submitAndPrint() {
    var real = findEngineBtn('submit');
    if (!real || real.disabled || saving) return;
    idsBeforeSubmit = pdfIds();
    printAfterSubmit = true;
    clearTimeout(printTimer);
    printTimer = setTimeout(function () { printAfterSubmit = false; }, 20000);   // never leave it armed
    proxy('submit')();
  }
  function printSubmitted() {
    printAfterSubmit = false; clearTimeout(printTimer);
    var tries = 0;
    (function look() {
      var all = document.querySelectorAll('.rt-content [data-pdf], .rt-sheet [data-pdf]');
      var pick = null;
      Array.prototype.forEach.call(all, function (b) { if (!pick && idsBeforeSubmit.indexOf(b.getAttribute('data-pdf')) < 0) pick = b; });
      if (!pick && all.length && tries >= 3) pick = all[0];         // resubmitted draft: same id, newest row is first
      if (pick) { pick.click(); return; }
      if (++tries < 12) setTimeout(look, 300);
    })();
  }

  /* ---------------- C4 + C12: action bar ---------------- */
  var bar = null, btnClear, btnSave, btnSubmit, btnPrint, note;
  var IDS = { clear: /^(ml_p|fr)_cancelBtn$/, save: /^(ml_p|fr)_saveBtn$/, submit: /^(ml_p|fr)_submitBtn$/ };
  function findEngineBtn(kind) {
    var list = document.querySelectorAll('.rt-content button[id$="Btn"]');
    for (var i = 0; i < list.length; i++) if (IDS[kind].test(list[i].id)) return list[i];
    return null;
  }
  function proxy(kind) {
    return function () {
      var real = findEngineBtn(kind);
      if (!real || real.disabled) return;
      clearNote();
      if (kind !== 'clear') beginSaving();
      real.click();
    };
  }
  function buildBar() {
    bar = h('div', 'rt-actionbar-fixed no-print');
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Record actions');
    note = h('button', 'rt-ab-note'); note.type = 'button'; note.hidden = true;
    btnClear = h('button', 'rt-ab-clear', 'Clear'); btnClear.type = 'button';
    btnSave = h('button', 'rt-ab-save', 'Save draft'); btnSave.type = 'button';
    btnSubmit = h('button', 'rt-ab-submit', 'Submit'); btnSubmit.type = 'button';
    btnPrint = h('button', 'rt-ab-print', 'Submit and print'); btnPrint.type = 'button';
    btnClear.addEventListener('click', proxy('clear'));
    btnSave.addEventListener('click', proxy('save'));
    btnSubmit.addEventListener('click', proxy('submit'));
    btnPrint.addEventListener('click', submitAndPrint);
    note.addEventListener('click', jumpToProblem);
    [note, btnClear, btnSave, btnPrint, btnSubmit].forEach(function (b) { bar.appendChild(b); });
    document.body.appendChild(bar);
  }
  function txt(e, v) { if (e.textContent !== v) e.textContent = v; }
  function syncBar() {
    if (!bar) return;
    var rc = findEngineBtn('clear'), rs = findEngineBtn('save'), rm = findEngineBtn('submit');
    var any = rc || rs || rm;
    bar.hidden = !any;
    if (!any) return;
    function hiddenReal(b) { return !b || b.style.display === 'none' || b.hidden; }
    btnClear.hidden = hiddenReal(rc);
    btnSave.hidden = hiddenReal(rs);
    btnSubmit.hidden = hiddenReal(rm);
    btnPrint.hidden = hiddenReal(rm);
    if (rc) txt(btnClear, rc.textContent);
    if (rs) txt(btnSave, rs.textContent);
    if (rm) txt(btnSubmit, rm.textContent);
    btnSave.disabled = saving || (rs ? rs.disabled : false);
    btnSubmit.disabled = saving || (rm ? rm.disabled : false);
    btnPrint.disabled = btnSubmit.disabled;
    // the engine's own row leaves the layout (still in the DOM, still clickable)
    [rc, rs, rm].forEach(function (b) {
      var row = b && b.parentElement;
      if (row && !row.classList.contains('rt-actions-proxied') && /(^|\s)(ml|fr)-actions(\s|$)/.test(row.className)) row.classList.add('rt-actions-proxied');
    });
  }

  /* ---------------- C12: validation note from the engine's own toast ---------------- */
  var problemLabel = null;
  function clearNote() { problemLabel = null; if (note) note.hidden = true; }
  function noteFromToast(msg) {
    var t = String(msg || '');
    var m = t.match(/^"(.+)" is required\.?$/);
    if (m) { problemLabel = m[1]; showNote('1 field needs attention — tap to go to ' + m[1]); return true; }
    if (/is not in the expected format|required to submit|are all required|A check is marked as a problem/i.test(t)) {
      problemLabel = ''; showNote('1 field needs attention — ' + t); return true;
    }
    return false;
  }
  function showNote(text) { if (note) { note.textContent = text; note.hidden = false; } }
  function jumpToProblem() {
    var target = null;
    if (problemLabel) {
      var labels = document.querySelectorAll('.rt-content .ml-field, .rt-content .fr-field');
      for (var i = 0; i < labels.length; i++) {
        var first = (labels[i].firstChild && labels[i].firstChild.textContent || labels[i].textContent).trim();
        if (first.indexOf(problemLabel) === 0) { target = labels[i]; break; }
      }
    }
    if (!target) target = document.querySelector('.rt-content .ml-field input:not([type=hidden]):invalid, .rt-content .fr-field.invalid');
    if (!target) return;
    for (var d = target.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
    var offset = topOffset() + 4;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - offset, behavior: 'smooth' });
    var inp = target.querySelector('input:not([type=hidden]), select, textarea');
    if (inp) setTimeout(function () { inp.focus({ preventScroll: true }); }, 250);
  }

  /* ---------------- C11: panel heading = bar ---------------- */
  function barPanels() {
    var heads = document.querySelectorAll('.rt-content .ml-panel-head, .rt-content .fr-panel-head');
    Array.prototype.forEach.call(heads, function (head) {
      var panel = head.parentElement;
      if (!panel || panel.classList.contains('rt-bar-panel')) return;
      var reveal = head.querySelector('.ml-reveal-btn, .fr-reveal-btn');
      if (!reveal || !reveal.dataset.reveal) return;
      // only the top-level Entries / Verification reveal, not nested history lists
      if (head.querySelector('h2') === null) return;
      panel.classList.add('rt-bar-panel');
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      function toggle(e) {
        if (e && e.target && e.target.closest && e.target.closest('.ml-btn:not(.ml-reveal-btn), .fr-btn:not(.fr-reveal-btn)')) return;
        reveal.click();
        var target = document.getElementById(reveal.dataset.reveal);
        var open = target ? /ml-open|fr-open/.test(target.className) : false;
        panel.classList.toggle('rt-bar-open', open);
        head.setAttribute('aria-expanded', String(open));
      }
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
    });
  }

  /* api-backend.js pins a red 'not authorised' banner to the bottom of the screen; sit above it */
  // api-backend.js pins a red 'not authorised' bar to the bottom of the screen. The red warning in the top bar replaces it.
  function liftAboveBanner() {
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === bar || k.nodeType !== 1 || !k.style || k.style.zIndex !== '99999' || k.style.position !== 'fixed') continue;
      if (k.id === 'api-auth-warning' || (k.style.bottom === '0px' && /not authorised/i.test(k.textContent || ''))) {
        k.style.setProperty('display', 'none', 'important');
        setAuth(true);
      }
    }
    if (document.body.style.paddingBottom) document.body.style.paddingBottom = '';
  }

  /* ---------------- generic 14px floor for self-styled (customBody) pages ---------------- */
  var floorPending = false;
  function floorText() {
    var root = document.querySelector('.rt-content');
    if (!root) return;
    var floorPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-hint')) || 13;   // the floor IS the hint token
    var els = root.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.classList.contains('rt-fs-floor') || /^(SCRIPT|STYLE|OPTION|SVG|PATH)$/i.test(e.tagName)) continue;
      var hasText = false;
      for (var c = e.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) { hasText = true; break; }
      if (!hasText && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) continue;
      if (e.type === 'checkbox' || e.type === 'radio' || e.type === 'hidden') continue;
      if (parseFloat(getComputedStyle(e).fontSize) < floorPx) e.classList.add('rt-fs-floor');
    }
  }
  function scheduleFloor() {
    if (floorPending) return;
    floorPending = true;
    setTimeout(function () { floorPending = false; floorText(); }, 250);
  }

  /* ---------------- C2 / C3: section progress + rail (form-record pages) ---------------- */
  var rail = null, sectionsPending = false, activeIdx = -1;
  var FIELD_SEL = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea';

  // the engine draws the sign-off block's heading as a small caption, not a section title; treat it as a section of its own
  var SIGNOFF_RE = /^(completed by|sign off)$/i;
  // the sign-off block's heading: the engines call it 'Completed by'; on screen it is the 'Sign off' section
  function renameSignoff(el) { if ((el.textContent || '').trim().toLowerCase() === 'completed by') el.textContent = 'Sign off'; }
  function isCaption(el) { return el.nodeType === 1 && el.classList.contains('fr-muted') && SIGNOFF_RE.test((el.textContent || '').trim()); }
  function isTitle(el) { return el.nodeType === 1 && (el.classList.contains('fr-section-title') || isCaption(el) || (el.tagName === 'DETAILS' && el.classList.contains('fr-section-collapsible'))); }
  function collectFrSections() {
    var app = document.querySelector('.rt-content .fr-app');
    if (!app) return [];
    var titles = Array.prototype.filter.call(app.querySelectorAll('.fr-section-title, .fr-muted'), function (t) { return t.classList.contains('fr-section-title') || isCaption(t); }), out = [];
    titles.forEach(function (t) {
      if (isCaption(t)) { t.classList.add('rt-cap'); renameSignoff(t); }
      else if (t.tagName === 'SUMMARY' && t.parentElement.classList.contains('fr-signoff-block')) renameSignoff(t);
    });
    titles.forEach(function (t) {
      if (t.closest('.fr-instr-panel, .fr-modal-overlay, .rt-wi-bubble')) return;
      var details = t.tagName === 'SUMMARY' ? t.parentElement : null;
      var nodes = [];
      if (details) nodes = [details];   // every form-record section is a <details> now
      else for (var n = t.nextElementSibling; n && !isTitle(n); n = n.nextElementSibling) {
        if (n.querySelector && n.querySelector('.fr-section-title')) break;
        if (/(^|\s)fr-actions(\s|$)/.test(n.className)) break;
        nodes.push(n);
      }
      out.push({ title: t, anchor: details || t.closest('.rt-bubble') || t, details: details, nodes: nodes });
    });
    return out;
  }
  /* monitoring-log pages: the sections are the blocks bubbleMl() made (plus the Continue-a-job panel). */
  function mlName(b) {
    var g = b.querySelector(':scope > .ml-grouphead, :scope > summary.ml-grouphead, :scope > .rt-cap');
    if (g) {
      var first = '';   // the heading's own text; status chips ('Fill in now', 'Later') sit in child elements
      for (var c = g.firstChild; c && !first; c = c.nextSibling) if (c.nodeType === 3) first = c.textContent.trim();
      if (!first && g.firstElementChild) first = (g.firstElementChild.textContent || '').trim();
      return { el: g, name: first || 'Section' };
    }
    return { el: b, name: 'Entry' };
  }
  function collectMlSections() {
    var app = document.querySelector('.rt-content .ml-app');
    if (!app) return [];
    var out = [];
    Array.prototype.forEach.call(app.querySelectorAll('.ml-panel'), function (panel) {
      if (panel.classList.contains('rt-panel-hidden') || panel.classList.contains('ml-instr-panel') || panel.classList.contains('ml-related')) return;
      if (!panel.getClientRects().length) return;
      var bubbles = Array.prototype.filter.call(panel.querySelectorAll('.rt-bubble'), function (b) { return !b.parentElement.closest('.rt-bubble'); });
      if (bubbles.length) {
        bubbles.forEach(function (b) {
          var n = mlName(b);
          out.push({ title: n.el, anchor: b, details: b.tagName === 'DETAILS' ? b : null, nodes: [b], name: n.name, noCollapse: !(b.tagName === 'DETAILS' && b.hasAttribute('data-autofold')) });
        });
      } else if (panel.classList.contains('ml-continue-panel')) {
        var hd = panel.querySelector('h2');
        out.push({ title: hd || panel, anchor: panel, details: null, nodes: [panel], name: (hd ? hd.textContent : 'Continue a job').trim(), noCollapse: true });
      }
    });
    return out;
  }
  function collectSections() {
    var fr = collectFrSections();
    return fr.length ? fr : collectMlSections();
  }
  function secName(sec) { return sec.name || titleText(sec.title); }
  function titleText(t) {
    return (t.firstChild && t.firstChild.nodeType === 3 ? t.firstChild.textContent : (t.textContent || '')).trim();
  }
  function sectionProgress(sec) {
    var done = 0, total = 0;
    sec.nodes.forEach(function (n) {
      Array.prototype.forEach.call(n.querySelectorAll(FIELD_SEL), function (f) {
        // REC 7.4.6 (body.ml-progressive): autofilled and locked-from-an-earlier-stage values count as done
        if (f.disabled || f.closest('[hidden]')) return;
        if (f.readOnly && !(document.body.classList.contains('ml-progressive') && String(f.value || '').trim() !== '')) return;
        var shown = f.getClientRects().length || f.closest('details:not([open])') || f.closest('.rt-collapsed');
        if (!shown) return;
        total++;
        if (String(f.value || '').trim() !== '') done++;
      });
    });
    return { done: done, total: total, complete: total > 0 && done === total };
  }
  // room to leave above a scroll target: the real sticky top bar + the section strip (if any) + a little air
  function topOffset() {
    var tb = document.querySelector('.rt-topbar');
    return (tb ? tb.offsetHeight : 0) + (rail && rail.parentNode ? rail.offsetHeight : 0) + 12;
  }
  function goToSection(sec) {
    if (sec.details && !sec.details.open) sec.details.open = true;
    window.scrollTo({ top: sec.anchor.getBoundingClientRect().top + window.pageYOffset - topOffset(), behavior: 'smooth' });
  }
  /* Every section is its own rounded block: the engine puts all sections in one host, so each title + its content is wrapped
     (nodes are moved, never re-created, so ids, listeners and the engine's lookups are untouched). Idempotent. */
  function bubbleSections() {
    var host = document.getElementById('fr_modalSections');
    if (!host || !optedIn()) return;
    host.classList.add('rt-bubble-host');
    var panel = host.closest('.fr-panel');
    if (panel) panel.classList.add('rt-bubbled');
    collectSections().forEach(function (sec) {
      if (sec.details) { sec.details.classList.add('rt-bubble'); return; }
      var par = sec.title.parentNode;
      if (!par || par.classList.contains('rt-bubble')) return;
      var w = h('div', 'rt-bubble');
      par.insertBefore(w, sec.title);
      w.appendChild(sec.title);
      sec.nodes.forEach(function (n) { w.appendChild(n); });
    });
  }
  /* monitoring-log pages: the entry form's field grid holds group headings, collapsible blocks and plain fields side by side.
     Each group becomes its own block (nodes moved, not re-created); a grid with no groups, or a customBody page, is one block;
     the engine's 'Completed by' caption + grid is its own block. The engine redraws the grid on open/clear/save, so this re-runs. */
  function bubbleMl() {
    if (!optedIn()) return;
    var hosts = document.querySelectorAll('.rt-content .ml-app [id$="_modalFields"]');
    Array.prototype.forEach.call(hosts, function (host) {
      var panel = host.closest('.ml-panel'), body = host.parentElement;
      if (!panel || !body) return;
      panel.classList.add('rt-bubbled');
      var kids = Array.prototype.slice.call(host.children);
      var grouped = kids.some(function (k) { return k.classList.contains('ml-grouphead') || k.classList.contains('ml-section-collapsible') || k.classList.contains('rt-bubble'); });
      if (host.classList.contains('ml-custom-body') || !grouped) { host.classList.add('rt-bubble'); host.classList.remove('rt-bubble-host'); }
      else {
        host.classList.remove('rt-bubble'); host.classList.add('rt-bubble-host');
        var cur = null;
        kids.forEach(function (k) {
          if (k.classList.contains('rt-bubble')) { cur = null; return; }
          if (k.classList.contains('ml-section-collapsible')) { k.classList.add('rt-bubble'); cur = null; return; }
          if (k.classList.contains('ml-grouphead') || !cur) { cur = h('div', 'rt-bubble ml-grid ml-grid-2'); host.insertBefore(cur, k); }
          cur.appendChild(k);
        });
      }
      Array.prototype.forEach.call(body.children, function (k) {
        if (k.tagName !== 'DETAILS' || !k.classList.contains('ml-signoff-block')) return;
        k.classList.add('rt-bubble');
        var sm = k.querySelector(':scope > summary'); if (sm) renameSignoff(sm);
      });
      var cap = null;
      Array.prototype.forEach.call(body.children, function (k) { if (!cap && k.classList.contains('ml-muted') && SIGNOFF_RE.test((k.textContent || '').trim())) cap = k; });
      if (cap) renameSignoff(cap);
      if (cap && !cap.parentNode.classList.contains('rt-bubble') && cap.nextElementSibling) {
        var next = cap.nextElementSibling;
        var w = h('div', 'rt-bubble');
        cap.classList.add('rt-cap'); renameSignoff(cap);
        body.insertBefore(w, cap); w.appendChild(cap); w.appendChild(next);
      }
    });
  }

  var prevComplete = [];
  function updateSections() {
    bubbleSections();
    bubbleMl();
    var secs = collectSections();
    var host = document.querySelector('.rt-content');
    if (!host) return;
    if (secs.length < 1) { if (rail && rail.parentNode) rail.parentNode.removeChild(rail); rail = null; }
    else {
      if (!rail || !rail.parentNode) {
        rail = h('nav', 'rt-rail no-print');
        rail.setAttribute('aria-label', 'Sections');
        host.insertBefore(rail, host.firstChild);
      }
      var sig = secs.map(function (x) { return secName(x); }).join('|');
      if (rail.dataset.sig !== sig) {
        rail.dataset.sig = sig; rail.textContent = '';
        secs.forEach(function (sec, i) {
          var b = h('button', 'rt-rail-btn'); b.type = 'button';
          b.appendChild(h('span', 'rt-rail-tick', ''));
          b.appendChild(h('span', 'rt-rail-name', secName(sec)));
          b.addEventListener('click', function () { var cur = collectSections(); if (cur[i]) goToSection(cur[i]); });
          rail.appendChild(b);
        });
      }
    }
    secs.forEach(function (sec, i) {
      var p = sectionProgress(sec);
      sec.title.classList.toggle('rt-done', p.complete);
      if (sec.details) {
        var pr = sec.title.querySelector('.rt-progress');
        if (!pr) { pr = h('span', 'rt-progress'); sec.title.appendChild(pr); }
        var t = p.total ? p.done + ' of ' + p.total + ' fields done' : '';
        if (pr.textContent !== t) pr.textContent = t;
        // finishing a collapsible section opens the next collapsible one
        if (p.complete && prevComplete[i] === false) {
          for (var j = i + 1; j < secs.length; j++) if (secs[j].details) { if (!secs[j].details.open && !sectionProgress(secs[j]).complete) secs[j].details.open = true; break; }
        }
      }
      // auto-fold on completion is switched off: sections only close when the person closes them
      sec.title.__rtPendingCollapse = false;
      prevComplete[i] = p.complete;
      if (rail) {
        var btn = rail.children[i];
        if (btn) {
          btn.classList.toggle('rt-done', p.complete);
          var lbl = secName(sec) + (p.total ? ' \u2014 ' + p.done + ' of ' + p.total + ' fields done' : '');
          if (btn.getAttribute('aria-label') !== lbl) btn.setAttribute('aria-label', lbl);
        }
      }
    });
    tryCollapse(secs);
    updateActive(secs);
  }
  /* A section that has just been completed folds away once focus leaves it (never while the person is still typing in it). */
  function inSection(sec) { var a = document.activeElement; return !!a && sec.nodes.some(function (n) { return n.contains(a); }); }
  function tryCollapse(secs) {
    secs.forEach(function (sec, i) {
      if (!sec.title.__rtPendingCollapse || inSection(sec)) return;
      sec.title.__rtPendingCollapse = false;
      if (sec.details) sec.details.open = false;
      else {
        sec.nodes.forEach(function (n) { n.classList.add('rt-collapsed'); });
        sec.title.classList.add('rt-toggle', 'rt-collapsed-title');
      }
      // bring the next unfinished section to the top
      for (var j = i + 1; j < secs.length; j++) {
        if (!sectionProgress(secs[j]).complete) { if (secs[j].details && !secs[j].details.open) secs[j].details.open = true; goToSection(secs[j]); break; }
      }
    });
  }
  function onTitleToggle(e) {
    var t = e.target.closest && e.target.closest('.fr-section-title.rt-toggle');
    if (!t || t.tagName === 'SUMMARY') return;
    var sec = collectSections().filter(function (x) { return x.title === t; })[0];
    if (!sec) return;
    var closed = t.classList.toggle('rt-collapsed-title');
    sec.nodes.forEach(function (n) { n.classList.toggle('rt-collapsed', closed); });
  }
  function updateActive(secs) {
    if (!rail) return;
    var line = topOffset() + 4, idx = 0;
    secs = secs || collectSections();
    secs.forEach(function (sec, i) { if (sec.anchor.getBoundingClientRect().top <= line) idx = i; });
    if (idx === activeIdx && rail.children[idx] && rail.children[idx].classList.contains('rt-active')) return;
    activeIdx = idx;
    Array.prototype.forEach.call(rail.children, function (b, i) { b.classList.toggle('rt-active', i === idx); });
    var a = rail.children[idx];
    if (a && (a.offsetLeft + a.offsetWidth > rail.scrollLeft + rail.clientWidth || a.offsetLeft < rail.scrollLeft)) rail.scrollLeft = Math.max(0, a.offsetLeft - 16);
  }
  function scheduleSections() {
    if (sectionsPending) return;
    sectionsPending = true;
    setTimeout(function () { sectionsPending = false; updateSections(); }, 200);
  }

  /* ---------------- C10: roster add-row + running count + undoable delete ---------------- */
  var undo = null;   // { btn, row, timer, toast }
  function rowsOf(list) { return list ? list.querySelectorAll('.fr-roster-row, .fr-pot-card') : []; }
  function countStrips() {
    var lists = document.querySelectorAll('.rt-content [id^="fr_rosterRows"]');
    Array.prototype.forEach.call(lists, function (list) {
      var strip = list.previousElementSibling;
      if (!strip || !strip.classList.contains('rt-rowcount')) {
        strip = h('div', 'rt-rowcount'); strip.setAttribute('role', 'status');
        list.parentNode.insertBefore(strip, list);
      }
      var n = 0;
      Array.prototype.forEach.call(rowsOf(list), function (r) { if (!r.hidden && r.style.display !== 'none') n++; });
      var t = n + (n === 1 ? ' row' : ' rows');
      if (strip.textContent !== t) strip.textContent = t;
    });
  }
  function dropToast(u) { if (u.toast.parentNode) u.toast.parentNode.removeChild(u.toast); }
  function commitUndo() {
    if (!undo) return;
    var u = undo; undo = null;
    clearTimeout(u.timer); dropToast(u);
    if (document.body.contains(u.btn)) { u.btn.__rtCommit = true; u.btn.click(); }
  }
  function cancelUndo() {
    if (!undo) return;
    var u = undo; undo = null;
    clearTimeout(u.timer);
    u.row.style.display = '';
    dropToast(u);
    countStrips();
  }
  function onRemoveClick(e) {
    var btn = e.target.closest && e.target.closest('[data-remove-roster-row]');
    if (!btn || !optedIn()) return;
    if (btn.__rtCommit) { btn.__rtCommit = false; return; }               // our own delayed click: the engine handles it
    var row = btn.closest('.fr-roster-row');
    if (!row || btn.closest('.fr-pot-card')) return;                       // card rows already confirm() in the engine
    e.stopImmediatePropagation(); e.preventDefault();
    if (undo) { commitUndo(); return; }                                    // settle the earlier removal; the list redraws, so tap again
    var idx = Number(btn.dataset.removeRosterRow);
    row.style.display = 'none';
    var toast = h('div', 'rt-undo-toast');
    toast.setAttribute('role', 'status');
    toast.appendChild(h('span', null, 'Row ' + (idx + 1) + ' removed'));
    var ub = h('button', 'rt-undo-btn', 'Undo'); ub.type = 'button';
    ub.addEventListener('click', cancelUndo);
    toast.appendChild(ub);
    document.body.appendChild(toast);
    undo = { btn: btn, row: row, toast: toast, timer: setTimeout(commitUndo, 5000) };
    countStrips();
  }
  function onAnyClickCapture(e) {
    // anything else tapped while a removal is pending settles it first (never save a half-removed roster)
    if (!undo) return;
    if (e.target.closest && (e.target.closest('.rt-undo-btn') || e.target.closest('[data-remove-roster-row]'))) return;
    commitUndo();
  }
  function onAddRowClick(e) {
    var btn = e.target.closest && e.target.closest('[id^="fr_addRosterRowBtn"]');
    if (!btn || !optedIn()) return;
    var list = document.getElementById(btn.id.replace('fr_addRosterRowBtn', 'fr_rosterRows'));
    var before = rowsOf(list).length;
    setTimeout(function () {
      var rows = rowsOf(list);
      if (rows.length <= before) return;
      var last = rows[rows.length - 1];
      window.scrollTo({ top: last.getBoundingClientRect().top + window.pageYOffset - topOffset() - 8, behavior: 'smooth' });
      var f = last.querySelector('input:not([type=hidden]):not([disabled]):not([readonly]), select:not([disabled])');
      if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 250);
    }, 60);
  }

  /* ---------------- Submissions / Verification move out of the record ----------------
     The Verification panel and the Submissions panel are hidden on screen (kept in the DOM, so every engine handler still works).
     A small "View submissions" button in the top bar opens the submissions in a full-height sheet with a day picker.
     Verification is done from the separate Awaiting Verification page. Set window.RT_KEEP_SUBMISSION_PANELS = true to undo. */
  var sheet = null, sheetState = null;
  function panelKind(panel) {
    var r = panel.querySelector('[data-reveal]');
    var id = r ? r.getAttribute('data-reveal') : '';
    if (/verificationBody$/.test(id)) return 'verification';
    if (/(entriesBody|submissionsBody)$/.test(id)) return 'submissions';
    return '';
  }
  function hideSubmissionPanels() {
    if (!optedIn() || window.RT_KEEP_SUBMISSION_PANELS) return;
    var actions = bar;                                    // the bottom action bar, far left
    var panels = document.querySelectorAll('.rt-content .ml-panel, .rt-content .fr-panel');
    var primary = true;
    Array.prototype.forEach.call(panels, function (panel) {
      var kind = panelKind(panel);
      if (!kind) return;
      panel.classList.add('rt-panel-hidden');
      if (kind !== 'submissions' || !actions) return;
      var reveal = panel.querySelector('[data-reveal]');
      var key = reveal.getAttribute('data-reveal');
      if (actions.querySelector('[data-rt-subs="' + key + '"]')) { primary = false; return; }
      var head = panel.querySelector('h2');
      var title = head ? head.textContent.trim() : '';
      var label = primary || !title || /^entries$/i.test(title) ? 'View submissions' : 'View ' + title.toLowerCase();
      primary = false;
      var b = h('button', 'rt-ab-subs', label); b.type = 'button'; b.setAttribute('data-rt-subs', key);
      b.addEventListener('click', function () { openSheet(key, label); });
      actions.insertBefore(b, actions.firstChild);
    });
  }
  function filterInputs(root) {
    return { from: root.querySelector('input[id$="filterFrom"]'), to: root.querySelector('input[id$="filterTo"]') };
  }
  function fire(inp) { inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
  function setDay(target, day) {
    var f = filterInputs(target);
    [f.from, f.to].forEach(function (i) { if (i) { i.value = day; fire(i); } });
  }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function openSheet(key, label) {
    var target = document.getElementById(key);
    var host = document.querySelector('.rt-content');
    if (!target || !host || sheet) return;
    sheetState = { target: target, parent: target.parentNode, next: target.nextSibling, wasOpen: /ml-open|fr-open/.test(target.className) };
    sheet = h('div', 'rt-sheet no-print');
    var card = h('div', 'rt-sheet-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', label);
    var head = h('div', 'rt-sheet-head');
    head.appendChild(h('h2', null, label.replace(/^View /, '').replace(/^./, function (c) { return c.toUpperCase(); })));
    var day = h('input'); day.type = 'date'; day.setAttribute('aria-label', 'Show one day');
    day.addEventListener('change', function () { setDay(target, day.value); });
    var bToday = h('button', 'rt-sheet-btn', 'Today'); bToday.type = 'button';
    bToday.addEventListener('click', function () { day.value = todayStr(); setDay(target, day.value); });
    var bAll = h('button', 'rt-sheet-btn', 'All days'); bAll.type = 'button';
    bAll.addEventListener('click', function () { day.value = ''; setDay(target, ''); });
    var bClose = h('button', 'rt-sheet-close', '\u2715'); bClose.type = 'button'; bClose.setAttribute('aria-label', 'Close');
    bClose.addEventListener('click', closeSheet);
    [day, bToday, bAll, bClose].forEach(function (x) { head.appendChild(x); });
    var body = h('div', 'rt-sheet-body');
    card.appendChild(head); card.appendChild(body); sheet.appendChild(card);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
    host.appendChild(sheet);
    body.appendChild(target);                                  // the engine node itself: filters, table and handlers come with it
    target.classList.add('ml-open', 'fr-open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', sheetKey, true);
    bClose.focus();
  }
  function sheetKey(e) { if (e.key === 'Escape') closeSheet(); }
  function closeSheet() {
    if (!sheet || !sheetState) return;
    var st = sheetState;
    setDay(st.target, '');
    if (st.parent) st.parent.insertBefore(st.target, st.next && st.next.parentNode === st.parent ? st.next : null);
    if (!st.wasOpen) st.target.classList.remove('ml-open', 'fr-open');
    if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
    sheet = null; sheetState = null;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', sheetKey, true);
  }
  // the engine print flow expects its table in place: put it back before the browser prints
  window.addEventListener('beforeprint', closeSheet);

  /* status is just the word: the engine writes 'tick Submitted' / 'tick Verified'; show 'Submitted' / 'Verified' */
  function plainStatus() {
    var badges = document.querySelectorAll('.rt-content .fr-badge, .rt-content .ml-badge, .rt-sheet .fr-badge, .rt-sheet .ml-badge');
    Array.prototype.forEach.call(badges, function (b) {
      var t = b.textContent || '';
      var m = t.match(/^[\u2713\u2714\u2715\u2716\u2717\u2718\s]+/);
      if (m && !b.firstElementChild) b.textContent = t.slice(m[0].length);
    });
  }

  /* ---------------- wiring ---------------- */
  function ensure() {
    if (!optedIn()) return;
    if (!bar || !bar.parentNode) buildBar();
    var shellEl = document.querySelector('.rt-shell');
    if (bar && shellEl && bar.parentNode !== shellEl) shellEl.appendChild(bar);
    var actions = document.querySelector('.rt-topbar .rt-actions');
    if (actions && (!chip || !chip.parentNode)) {
      chip = h('span', 'rt-savechip');
      chip.setAttribute('role', 'status');
      chip.addEventListener('click', function () {
        if (chip.dataset.state === 'noauth') {
          if (!typedSomething() || window.confirm('Open the access-key page? Anything typed on this page will be lost.')) location.href = '/pages/api-key.html';
          return;
        }
        if (chip.dataset.state === 'error') { var real = findEngineBtn('save'); if (real && !real.disabled) proxy('save')(); }
      });
      actions.parentNode.insertBefore(chip, actions);
      setState(lastState ? lastState.state : 'ready', lastState ? lastState.text : 'Ready');
    }
    var tbar = document.querySelector('.rt-topbar');
    if (tbar) { var th = tbar.offsetHeight + 'px'; if (document.body.style.getPropertyValue('--rt-topbar-h') !== th) document.body.style.setProperty('--rt-topbar-h', th); }
    syncBar();
    scheduleFloor();
    scheduleSections();
    countStrips();
    liftAboveBanner();
    hideSubmissionPanels();
    plainStatus();
    barPanels();
    var toast = document.querySelector('.ml-toast, .fr-toast');
    if (toast && !toast.__rtWatched) {
      toast.__rtWatched = true;
      new MutationObserver(function () {
        var msg = toast.textContent;
        if (!msg) return;
        if (!stateFromToast(msg)) { if (saving) { endSaving(); if (stateBeforeSave) setState(stateBeforeSave.state, stateBeforeSave.text); } printAfterSubmit = false; }
        else if (printAfterSubmit && /submitted/i.test(msg)) setTimeout(printSubmitted, 500);
        noteFromToast(msg);
      }).observe(toast, { childList: true, characterData: true, subtree: true });
    }
  }

  function boot() {
    if (!optedIn()) return;
    ensure();
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; ensure(); }, 120);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'style'] });
    setInterval(ensure, 1500);
    document.addEventListener('input', clearNote, true);
    document.addEventListener('input', scheduleSections, true);
    document.addEventListener('change', scheduleSections, true);
    document.addEventListener('toggle', scheduleSections, true);
    window.addEventListener('scroll', function () { if (rail) updateActive(); }, { passive: true });
    document.addEventListener('click', onAnyClickCapture, true);
    document.addEventListener('click', onRemoveClick, true);
    document.addEventListener('click', onAddRowClick, false);
    document.addEventListener('click', onTitleToggle, false);
    document.addEventListener('focusout', function () { setTimeout(scheduleSections, 120); }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.RecordChrome = { ensure: ensure, boot: boot };
})();
