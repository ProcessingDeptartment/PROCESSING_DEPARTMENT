/* ========================================================================
   nav-menu.js  --  shared hamburger button + top-right dropdown menu

   ONE source of menu items (NAV below). Replaces the old left sidebar /
   bottom tab bar. Navigation only: it never touches a page's fields, values,
   validation, storage or print output.

   API:  NavMenu.attach(hostEl)   append the hamburger as the last child of
                                  hostEl (a top bar). Idempotent; safe to call
                                  again if the host is rebuilt.
         NavMenu.close()
         NavMenu.NAV              the item list
   ======================================================================== */
(function () {
  'use strict';
  if (window.NavMenu) return;

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

  // load the stylesheet that sits beside this script's lib/ folder
  var SELF = document.currentScript && document.currentScript.src;
  if (SELF && !document.querySelector('link[data-nm-css]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute('data-nm-css', '1');
    link.href = SELF.replace(/lib\/nav-menu\.js.*$/, 'styles/nav-menu.css') +
                (SELF.indexOf('?') > -1 ? SELF.slice(SELF.indexOf('?')) : '');
    document.head.appendChild(link);
  }

  var btn = null, panel = null, scrim = null;
  var isOpen = false, lockY = 0;
  var mq = window.matchMedia ? window.matchMedia('(max-width: 559px)') : null;

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function currentFile() {
    return (location.pathname.split('/').pop() || '').toLowerCase();
  }

  function buildPanel() {
    panel = el('nav', 'nm-panel');
    panel.id = 'nmPanel';
    panel.setAttribute('aria-label', 'Menu');
    var here = currentFile();
    NAV.forEach(function (item) {
      var a = el('a');
      a.textContent = (item.primary ? '← ' : '') + item.label;
      a.href = item.href;
      var target = (item.href.split('/').pop() || '').toLowerCase();
      if (here && target && here === target) {
        a.classList.add('is-active');
        a.setAttribute('aria-current', 'page');
      }
      panel.appendChild(a);
    });
    scrim = el('div', 'nm-scrim');
    scrim.addEventListener('click', function () { close(true); });
    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    panel.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) close(false);
    });
  }

  function buildButton() {
    var b = el('button', 'nm-btn no-print');
    b.type = 'button';
    b.setAttribute('aria-label', 'Menu');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', 'nmPanel');
    b.innerHTML = '<span class="nm-bar"></span><span class="nm-bar"></span><span class="nm-bar"></span>';
    b.addEventListener('click', function () { isOpen ? close(true) : open(); });
    return b;
  }

  function items() {
    return Array.prototype.slice.call(panel.querySelectorAll('a'));
  }

  function keydown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    var ring = [btn].concat(items());
    var i = ring.indexOf(document.activeElement);
    if (e.key === 'Tab') {
      e.preventDefault();
      var n = e.shiftKey ? i - 1 : i + 1;
      ring[(n + ring.length) % ring.length].focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      var list = items();
      var j = list.indexOf(document.activeElement);
      e.preventDefault();
      if (e.key === 'ArrowDown') j = j < 0 ? 0 : Math.min(j + 1, list.length - 1);
      else j = j <= 0 ? 0 : j - 1;
      list[j].focus();
    }
  }

  // scroll lock without changing overflow (that would un-stick the top bar):
  // block wheel/touch on the scrim and pin the scroll position
  function block(e) { e.preventDefault(); }
  function pin() { if (isOpen && window.pageYOffset !== lockY) window.scrollTo(0, lockY); }

  function open() {
    if (isOpen || !btn) return;
    isOpen = true;
    var host = btn.parentNode;
    var bottom = host ? host.getBoundingClientRect().bottom : 57;
    panel.style.top = Math.max(0, Math.round(bottom)) + 'px';
    panel.style.setProperty('--nm-top', Math.round(bottom) + 'px');
    lockY = window.pageYOffset;
    panel.classList.add('is-open');
    scrim.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', keydown, true);
    scrim.addEventListener('wheel', block, { passive: false });
    scrim.addEventListener('touchmove', block, { passive: false });
    window.addEventListener('scroll', pin, { passive: true });
    var first = panel.querySelector('a.is-active') || panel.querySelector('a');
    if (first) first.focus({ preventScroll: true });
  }

  function close(returnFocus) {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('is-open');
    scrim.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', keydown, true);
    scrim.removeEventListener('wheel', block);
    scrim.removeEventListener('touchmove', block);
    window.removeEventListener('scroll', pin);
    if (returnFocus && btn) btn.focus({ preventScroll: true });
  }

  function attach(host) {
    if (!host) return null;
    if (!panel) buildPanel();
    if (btn && btn.parentNode === host) return btn;
    var wasOpen = isOpen;
    if (wasOpen) close(false);
    if (!btn) btn = buildButton();
    host.appendChild(btn);              // moves it if the old host was replaced
    return btn;
  }

  window.addEventListener('popstate', function () { close(false); });
  window.addEventListener('pagehide', function () { close(false); });
  // close when crossing the phone breakpoint (panel width rule changes there)
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { close(false); });

  window.NavMenu = { attach: attach, close: close, NAV: NAV };
  document.dispatchEvent(new CustomEvent('navmenu:ready'));
})();
