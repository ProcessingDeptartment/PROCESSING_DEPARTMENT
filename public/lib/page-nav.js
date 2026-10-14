/* ========================================================================
   page-nav.js  --  sticky top nav bar (back button + hamburger) for
   non-record pages (Home, Record List, pages/*.html, etc.).

   Usage: add ONE script tag near the top of <body>:
     <script src="/lib/page-nav.js?v=1"></script>

   The script injects a slim dark bar at the very top of the page containing:
     [← Back]  [AB]  [Page title]  [spacer]  [≡ Menu]

   It reuses nav-menu.js (same shared panel) and nav-menu.css.
   The bar carries class  .pn-bar  so each page can override its look.
   ======================================================================== */
(function () {
  'use strict';
  if (window.PageNav) return;

  var SELF = document.currentScript && document.currentScript.src;

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---------- CSS (injected once) ---------- */
  function injectCss() {
    if (document.getElementById('pn-css')) return;
    var style = document.createElement('style');
    style.id = 'pn-css';
    style.textContent = [
      '.pn-bar{',
        'position:sticky;top:0;z-index:200;',
        'display:flex;align-items:center;gap:8px;',
        'height:48px;padding:0 4px 0 8px;',
        'background:#1D2B38;color:#fff;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;',
        '-webkit-tap-highlight-color:transparent;',
      '}',
      '.pn-back{',
        'flex-shrink:0;width:48px;height:48px;',
        'display:inline-flex;align-items:center;justify-content:center;',
        'background:transparent;border:0;border-radius:8px;',
        'cursor:pointer;color:#fff;font-size:20px;',
      '}',
      '.pn-back:hover,.pn-back:active{background:rgba(255,255,255,.08);}',
      '.pn-back:focus-visible{outline:2px solid #A9763A;outline-offset:2px;}',
      '.pn-logo{',
        'flex-shrink:0;width:28px;height:28px;border-radius:5px;',
        'background:#A9763A;color:#fff;font-size:11px;font-weight:700;',
        'display:inline-flex;align-items:center;justify-content:center;',
      '}',
      '.pn-title{',
        'font-size:14px;font-weight:600;color:#E6EBEF;',
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
        'flex:1 1 0;min-width:0;',
      '}',
      '@media print{.pn-bar{display:none!important}}',
    ].join('');
    document.head.appendChild(style);
  }

  /* ---------- nav-menu.js loader ---------- */
  function loadNavMenu(fn) {
    if (window.NavMenu) return fn();
    document.addEventListener('navmenu:ready', fn, { once: true });
    if (document.querySelector('script[data-nm-js]')) return;
    var s = document.createElement('script');
    s.setAttribute('data-nm-js', '1');
    s.src = SELF ? SELF.replace(/lib\/page-nav\.js.*$/, 'lib/nav-menu.js') : '/lib/nav-menu.js';
    document.head.appendChild(s);
  }

  /* ---------- back-button handler ---------- */
  function goBack() {
    // Same-origin referrer: use browser history
    var sameSite = document.referrer && document.referrer.indexOf(location.origin) === 0;
    // Don't go back to the same page
    var sameFile = document.referrer && document.referrer.split('?')[0] === location.href.split('?')[0];
    if (sameSite && !sameFile && history.length > 1) {
      history.back();
    } else {
      // Default: go to home
      var depth = (location.pathname.match(/\//g) || []).length;
      location.href = depth > 2 ? '../index.html' : 'index.html';
    }
  }

  /* ---------- bar builder ---------- */
  function buildBar() {
    injectCss();
    var bar = el('div', 'pn-bar no-print');
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Page navigation');

    var back = el('button', 'pn-back', '←');
    back.type = 'button';
    back.setAttribute('aria-label', 'Go back');
    back.title = 'Go back';
    back.addEventListener('click', goBack);
    bar.appendChild(back);

    bar.appendChild(el('span', 'pn-logo', 'AB'));
    bar.appendChild(el('span', 'pn-title', document.title || 'Processing Department'));
    // spacer pushed by nav-menu's nm-btn order:999

    loadNavMenu(function () {
      window.NavMenu.attach(bar);
    });

    return bar;
  }

  /* ---------- mount ---------- */
  function mount() {
    if (document.querySelector('.pn-bar')) return;
    var bar = buildBar();
    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  window.PageNav = { mount: mount };
})();
