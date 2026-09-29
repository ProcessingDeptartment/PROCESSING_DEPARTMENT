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
      p.then(settled, function () { /* a failed call is not a wake-up; leave the banner to the timer */ });
      return p;
    };
    wrapped.__rtChrome = true;
    window.fetch = wrapped;
  }

  /* ---------------- C5: save-state chip ---------------- */
  var chip = null, saveTimer = null, saving = false, lastState = null, stateBeforeSave = null;
  function setState(state, text) {
    lastState = { state: state, text: text };
    if (!chip) return;
    chip.dataset.state = state;
    chip.textContent = text;
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

  /* ---------------- C4 + C12: action bar ---------------- */
  var bar = null, btnClear, btnSave, btnSubmit, note;
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
    btnClear.addEventListener('click', proxy('clear'));
    btnSave.addEventListener('click', proxy('save'));
    btnSubmit.addEventListener('click', proxy('submit'));
    note.addEventListener('click', jumpToProblem);
    [note, btnClear, btnSave, btnSubmit].forEach(function (b) { bar.appendChild(b); });
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
    if (rc) txt(btnClear, rc.textContent);
    if (rs) txt(btnSave, rs.textContent);
    if (rm) txt(btnSubmit, rm.textContent);
    btnSave.disabled = saving || (rs ? rs.disabled : false);
    btnSubmit.disabled = saving || (rm ? rm.disabled : false);
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
    var topbar = document.querySelector('.rt-topbar');
    var offset = (topbar ? topbar.offsetHeight : 0) + 16;
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
  function liftAboveBanner() {
    if (!bar) return;
    var b = null, kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === bar || k.nodeType !== 1 || !k.style || k.style.zIndex !== '99999' || k.style.position !== 'fixed') continue;
      if (k.style.bottom === '0px') { b = k; break; }
    }
    var px = b ? b.offsetHeight + 'px' : '';
    if (bar.style.bottom !== px) bar.style.bottom = px;
  }

  /* ---------------- generic 14px floor for self-styled (customBody) pages ---------------- */
  var floorPending = false;
  function floorText() {
    var root = document.querySelector('.rt-content');
    if (!root) return;
    var els = root.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.classList.contains('rt-fs-floor') || /^(SCRIPT|STYLE|OPTION|SVG|PATH)$/i.test(e.tagName)) continue;
      var hasText = false;
      for (var c = e.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) { hasText = true; break; }
      if (!hasText && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) continue;
      if (e.type === 'checkbox' || e.type === 'radio' || e.type === 'hidden') continue;
      if (parseFloat(getComputedStyle(e).fontSize) < 14) e.classList.add('rt-fs-floor');
    }
  }
  function scheduleFloor() {
    if (floorPending) return;
    floorPending = true;
    setTimeout(function () { floorPending = false; floorText(); }, 250);
  }

  /* ---------------- wiring ---------------- */
  function ensure() {
    if (!optedIn()) return;
    if (!bar || !bar.parentNode) buildBar();
    var actions = document.querySelector('.rt-topbar .rt-actions');
    if (actions && (!chip || !chip.parentNode)) {
      chip = h('span', 'rt-savechip');
      chip.setAttribute('role', 'status');
      chip.addEventListener('click', function () {
        if (chip.dataset.state === 'error') { var real = findEngineBtn('save'); if (real && !real.disabled) proxy('save')(); }
      });
      actions.parentNode.insertBefore(chip, actions);
      setState(lastState ? lastState.state : 'saved', lastState ? lastState.text : 'Ready');
    }
    syncBar();
    scheduleFloor();
    liftAboveBanner();
    barPanels();
    var toast = document.querySelector('.ml-toast, .fr-toast');
    if (toast && !toast.__rtWatched) {
      toast.__rtWatched = true;
      new MutationObserver(function () {
        var msg = toast.textContent;
        if (!msg) return;
        if (!stateFromToast(msg)) { if (saving) { endSaving(); if (stateBeforeSave) setState(stateBeforeSave.state, stateBeforeSave.text); } }
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.RecordChrome = { ensure: ensure, boot: boot };
})();
