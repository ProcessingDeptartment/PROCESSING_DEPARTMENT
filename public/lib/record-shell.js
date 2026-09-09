/* ========================================================================
   record-shell.js  --  tablet record-entry shell (opt-in)

   Wraps whatever a record engine (form-record.js / monitoring-log.js /
   cleaning-register.js) or a bespoke record page has already rendered in the
   navy top-bar + left-sidebar shell from the redesign brief. It moves nodes,
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

  var NAV = [
    { label: 'Record List', href: '../records/record-list.html', primary: true },
    { label: 'Home', href: '../index.html' },
    { label: 'Dashboard', href: '../pages/dashboard.html' },
    { label: 'Job Status', href: '../pages/job-status.html' },
    { label: 'Traceability', href: '../records/batch-trace.html' },
    { label: 'Submissions', href: '../pages/submissions-log.html' },
    { label: 'FSMS', href: '../pages/fsms.html' },
    { label: 'Handovers', href: '../pages/handovers.html' },
    { label: 'Quick Receiving', href: '../records/quick-abalone-receiving.html' }
  ];

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

  function currentFile() {
    return (location.pathname.split('/').pop() || '').toLowerCase();
  }

  function buildSidebar() {
    var nav = h('nav', 'rt-sidebar');
    nav.appendChild(h('div', 'rt-nav-head', 'Navigation'));
    var here = currentFile();
    NAV.forEach(function (item) {
      var a = h('a', null, (item.primary ? '← ' : '') + item.label);
      a.href = item.href;
      var target = (item.href.split('/').pop() || '').toLowerCase();
      if (here && target && here === target) a.classList.add('is-active');
      nav.appendChild(a);
    });
    return nav;
  }

  function buildTopbar(parts) {
    var bar = h('header', 'rt-topbar');
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

    bar.appendChild(h('div', 'rt-actions'));
    return bar;
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
    var sidebar = buildSidebar();
    var content = h('main', 'rt-content');

    // move the engine's outermost wrapper (mount div / .ml-app / .fr-app)
    // into the shell content column, so id-scoped page CSS keeps matching
    content.appendChild(parts.root || parts.body);
    bodyWrap.appendChild(sidebar);
    bodyWrap.appendChild(content);
    shell.appendChild(topbar);
    shell.appendChild(bodyWrap);

    document.body.insertBefore(shell, document.body.firstChild);
    document.body.classList.add('rt-has-shell');
    syncToolbar();
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
        else syncToolbar();   // engine re-rendered its mount inside the shell
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    // stop watching once things have settled
    setTimeout(function () { obs.disconnect(); }, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.RecordShell = { mount: mount, NAV: NAV };
})();
