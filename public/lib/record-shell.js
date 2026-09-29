/* ========================================================================
   record-shell.js  --  tablet record-entry shell (opt-in)

   Wraps whatever a record engine (form-record.js / monitoring-log.js /
   cleaning-register.js) or a bespoke record page has already rendered in the
   navy top-bar shell (hamburger dropdown menu, see nav-menu.js) from the redesign brief. It moves nodes,
   it does NOT re-render them -- so every field, event listener, calculation,
   validation and CSV/print path the engine set up is left exactly as it was.

   Scope: the ~130 individual record-entry pages reached from Record List.
   NOT Home, the Record List index, Job Status, Traceability, Submissions,
   FSMS, Handovers or the login modal. A page opts in by loading this script;
   a page that never loads it is completely unaffected.

   Load order: AFTER the engine script(s), near the end of <body>. The engine
   renders synchronously into its mount on DOMContentLoaded; this then runs and
   re-parents that output. Safe to load with `defer` or a plain tag at the
   bottom of the document.
   ======================================================================== */
(function () {
  'use strict';

  /* Menu items now live in nav-menu.js (single source). Load it beside this
     script, keeping the same ?v= cache-buster. */
  var SELF = document.currentScript && document.currentScript.src;
  function withNavMenu(fn) {
    if (window.NavMenu) return fn();
    document.addEventListener('navmenu:ready', fn, { once: true });
    if (document.querySelector('script[data-nm-js]')) return;
    var s = document.createElement('script');
    s.setAttribute('data-nm-js', '1');
    s.src = SELF ? SELF.replace(/record-shell\.js/, 'nav-menu.js') : '../lib/nav-menu.js';
    document.head.appendChild(s);
  }

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* the engines all render the same header shape:
       <div class="fr-top|ml-top|cr-top">
         <div class="doc-line"><span class="doc-code"><h1><span class="doc-rev"></div>
         <div class="...toolbar... no-print"> buttons </div>
       </div>
       <div class="fr-body|ml-body|cr-body"> ...record... </div>
     A bespoke page may instead have a bare <h1> and its own toolbar. */
  function findParts() {
    var top = document.querySelector('.fr-top, .ml-top, .cr-top');
    var body = document.querySelector('.fr-body, .ml-body, .cr-body');
    var docLine = document.querySelector('.doc-line');
    // The element to re-parent is the engine's OUTERMOST wrapper (the mount
    // div, e.g. #mlRoot / #frRoot -- often also .ml-app / .fr-app), not the
    // inner .*-body. Bespoke pages scope all their CSS under that id
    // (`#mlRoot .ds-grid { ... }`), so moving only .ml-body would strand every
    // one of those rules. Walk up to the highest ancestor still inside <body>.
    var root = body;
    while (root && root.parentElement && root.parentElement !== document.body) {
      root = root.parentElement;
    }
    return { top: top, body: body, root: root || body, docLine: docLine };
  }

  function buildTopbar(parts) {
    var bar = h('header', 'rt-topbar');
    var back = h('button', 'rt-back', '←');
    back.type = 'button';
    back.setAttribute('aria-label', 'Back');
    back.title = 'Back';
    back.addEventListener('click', function () {
      // go to the previous page if it was on this site, else to the Record List
      var sameSite = document.referrer && document.referrer.indexOf(location.origin) === 0;
      if (sameSite && history.length > 1) history.back();
      else location.href = '../records/record-list.html';
    });
    bar.appendChild(back);
    bar.appendChild(h('div', 'rt-logo', 'AB'));

    if (parts.docLine) {
      var code = parts.docLine.querySelector('.doc-code');
      var title = parts.docLine.querySelector('h1');
      var rev = parts.docLine.querySelector('.doc-rev');
      var titleText = title ? title.textContent : document.title;
      // only show the doc code when it is a real code (REC 7.1.2, QA-01, ...),
      // not when the page set docCode to the same string as the title
      if (code && code.textContent.trim() &&
          code.textContent.trim().toLowerCase() !== titleText.trim().toLowerCase()) {
        bar.appendChild(h('span', 'rt-doc-code', code.textContent));
      }
      bar.appendChild(h('span', 'rt-title', titleText));
      if (rev) {
        var revSpan = h('span', 'rt-rev');
        revSpan.id = rev.id || '';           // keep #fr_docRev / #ml_docRev live
        revSpan.textContent = rev.textContent;
        bar.appendChild(revSpan);
      }
    } else {
      bar.appendChild(h('span', 'rt-title', document.title));
    }

    bar.appendChild(h('span', 'rt-spacer'));
    bar.insertBefore(h('span', 'rt-wi-slot'), bar.lastChild);

    bar.appendChild(h('div', 'rt-actions'));
    withNavMenu(function () { window.NavMenu.attach(bar); });
    return bar;
  }

  /* "View work instruction" -- the engines render a collapsed Work instructions
     panel above the form. In the shell that panel is hidden by CSS and its
     content is shown on demand in a temporary bubble anchored under a button
     that sits right after the revision date. Content is read from the panel at
     click time, so it always reflects what the engine rendered. */
  var WI_PANEL = '.rt-content .fr-instr-panel, .rt-content .ml-instr-panel';
  var wiBubble = null;

  function closeWi() {
    if (!wiBubble) return;
    wiBubble.parentNode && wiBubble.parentNode.removeChild(wiBubble);
    wiBubble = null;
    document.removeEventListener('keydown', wiKey, true);
    document.removeEventListener('mousedown', wiOutside, true);
    document.removeEventListener('touchstart', wiOutside, true);
    var b = document.querySelector('.rt-wi-btn');
    if (b) { b.setAttribute('aria-expanded', 'false'); }
  }
  function wiKey(e) { if (e.key === 'Escape') { closeWi(); var b = document.querySelector('.rt-wi-btn'); if (b) b.focus(); } }
  function wiOutside(e) {
    if (wiBubble && !wiBubble.contains(e.target) && !(e.target.closest && e.target.closest('.rt-wi-btn'))) closeWi();
  }

  function openWi(btn) {
    var panel = document.querySelector(WI_PANEL);
    if (!panel) return;
    closeWi();
    var items = panel.querySelectorAll('.instr-item');
    var bub = h('div', 'rt-wi-bubble');
    bub.setAttribute('role', 'dialog');
    bub.setAttribute('aria-label', 'Work instruction');
    var head = h('div', 'rt-wi-head');
    head.appendChild(h('strong', null, 'Work instruction'));
    var x = h('button', 'rt-wi-close', '\u2715');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close work instruction');
    x.addEventListener('click', function () { closeWi(); btn.focus(); });
    head.appendChild(x);
    bub.appendChild(head);
    var body = h('div', 'rt-wi-body');
    Array.prototype.forEach.call(items, function (it) { body.appendChild(it.cloneNode(true)); });
    bub.appendChild(body);
    document.body.appendChild(bub);
    var r = btn.getBoundingClientRect();
    var left = Math.max(8, Math.min(r.left, window.innerWidth - bub.offsetWidth - 8));
    bub.style.left = left + 'px';
    bub.style.top = Math.round(r.bottom + 8) + 'px';
    bub.style.maxHeight = (window.innerHeight - r.bottom - 24) + 'px';
    wiBubble = bub;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', wiKey, true);
    document.addEventListener('mousedown', wiOutside, true);
    document.addEventListener('touchstart', wiOutside, true);
  }

  // keep the button present exactly when the engine rendered a panel
  function ensureWiButton() {
    var slot = document.querySelector('.rt-topbar .rt-wi-slot');
    if (!slot) return;
    var has = !!document.querySelector(WI_PANEL);
    var btn = slot.querySelector('.rt-wi-btn');
    if (has && !btn) {
      btn = h('button', 'rt-wi-btn', 'View work instruction');
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', function () { wiBubble ? closeWi() : openWi(btn); });
      slot.appendChild(btn);
    } else if (!has && btn) {
      closeWi();
      slot.removeChild(btn);
    }
  }

  /* record-chrome.js is normally loaded early by each page (so its fetch wrapper
     sees the first API call); this covers a page that only loads the shell. */
  function ensureChrome() {
    if (window.RecordChrome || document.querySelector('script[data-rc-js]')) return;
    var s = document.createElement('script');
    s.setAttribute('data-rc-js', '1');
    s.onload = function () { if (window.RecordChrome) window.RecordChrome.boot(); };
    s.src = SELF ? SELF.replace(/record-shell\.js/, 'record-chrome.js') : '../lib/record-chrome.js';
    document.head.appendChild(s);
  }

  function mount() {
    var parts = findParts();
    if (!parts.body) return false;                 // nothing recognisable yet

    // already wrapped, and the engine has not re-rendered underneath us
    var existing = document.querySelector('.rt-shell');
    if (existing) {
      if (existing.contains(parts.body)) return true;
      // engine re-rendered a fresh .ml-body/.fr-body outside the shell
      // (async auth resolve etc.) -- drop the stale shell and rebuild
      existing.parentNode.removeChild(existing);
    }

    var shell = h('div', 'rt-shell');
    var topbar = buildTopbar(parts);
    var bodyWrap = h('div', 'rt-body');
    var content = h('main', 'rt-content');

    // move the engine's outermost wrapper (mount div / .ml-app / .fr-app)
    // into the shell content column, so id-scoped page CSS keeps matching
    content.appendChild(parts.root || parts.body);
    bodyWrap.appendChild(content);
    shell.appendChild(topbar);
    shell.appendChild(bodyWrap);

    document.body.insertBefore(shell, document.body.firstChild);
    document.body.classList.add('rt-has-shell');
    document.body.classList.add('rt-tablet');            // Tablet UI v2 (rolled out 2026-09-29)
    ensureChrome();
    syncToolbar();
    ensureWiButton();
    return true;
  }

  /* The old dark header strip is hidden by CSS (.rt-content .*-top). Its
     toolbar buttons (Thresholds, + Add entry, ...) are moved into the navy
     bar's .rt-actions -- idempotent, and re-run after the engine re-renders
     its mount, which rebuilds a fresh .*-top inside the shell. */
  function syncToolbar() {
    var actions = document.querySelector('.rt-topbar .rt-actions');
    if (!actions) return;
    var toolbar = document.querySelector(
      '.rt-content .ml-topline, .rt-content .fr-toolbar, .rt-content .cr-topline');
    if (!toolbar) return;
    Array.prototype.slice.call(toolbar.children).forEach(function (btn) {
      actions.appendChild(btn);
    });
  }

  /* The engines render the roster/entry totals as a single text string
     ("Totals — Whole weight (kg): 0.00 · Count: 0.00 · ..."). Re-render it as
     a stat-tile row. Purely presentational -- the numbers and the element the
     engine writes are untouched; we only reshape its innerHTML, and skip when
     we've already tiled it (so the engine's next write is what re-triggers us). */
  function tileTotals(el) {
    if (!el) return;
    if (el.querySelector('.rt-tally')) return;          // already ours
    var txt = (el.textContent || '').trim();
    var m = txt.match(/^Totals\s*[—-]\s*(.+)$/);
    if (!m) return;
    var pairs = m[1].split(/\s*[·|]\s*/).map(function (seg) {
      var i = seg.lastIndexOf(':');
      return i === -1 ? null : { label: seg.slice(0, i).trim(), value: seg.slice(i + 1).trim() };
    }).filter(Boolean);
    if (!pairs.length) return;
    el.innerHTML = '<div class="rt-tally">' + pairs.map(function (p, idx) {
      var cls = idx === 0 ? ' is-count' : '';
      return '<div><div class="rt-stat-label">' + p.label +
             '</div><div class="rt-stat-value' + cls + '">' + p.value + '</div></div>';
    }).join('') + '</div>';
    el.classList.add('rt-totals-tiled');
  }

  function watchTotals() {
    var seen = [];
    function scan() {
      var els = document.querySelectorAll(
        '#fr_rosterTotals, #ml_rosterTotals, .fr-roster-totals, .ml-roster-totals');
      Array.prototype.forEach.call(els, function (el) {
        tileTotals(el);
        if (seen.indexOf(el) === -1) {
          seen.push(el);
          new MutationObserver(function () { tileTotals(el); })
            .observe(el, { childList: true, characterData: true, subtree: true });
        }
      });
    }
    scan();
    var n = 0;
    var iv = setInterval(function () { scan(); if (++n > 20) clearInterval(iv); }, 400);
  }

  function boot() {
    mount();
    watchTotals();
    // The engines render into their mount on DOMContentLoaded and then
    // re-render once more after an async auth/permission check resolves --
    // which replaces the node we wrapped. Watch <body> and re-wrap whenever a
    // fresh engine body appears outside the shell. Debounced so the engine's
    // own internal DOM churn (entries list, totals) doesn't thrash us.
    var pending = false;
    var obs = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var body = document.querySelector('.fr-body, .ml-body, .cr-body');
        var shell = document.querySelector('.rt-shell');
        if (body && (!shell || !shell.contains(body))) mount();
        else { syncToolbar(); ensureWiButton(); }   // engine re-rendered its mount inside the shell
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    // stop watching once things have settled
    setTimeout(function () { obs.disconnect(); }, 8000);

    // The work-instruction button must appear whenever the engine renders its
    // panel, however late (auth/permission re-render, slow API). Timer-based
    // (not rAF) so it also runs in background tabs; the check is one querySelector.
    var wiPending = false;
    new MutationObserver(function () {
      if (wiPending) return;
      wiPending = true;
      setTimeout(function () {
        wiPending = false;
        if (!document.querySelector('.rt-shell')) { mount(); }
        ensureWiButton();
      }, 100);
    }).observe(document.body, { childList: true, subtree: true });
    setInterval(ensureWiButton, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.RecordShell = { mount: mount };
})();
