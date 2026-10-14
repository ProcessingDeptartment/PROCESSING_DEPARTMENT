/* ========================================================================
   post-submit-prompt.js -- pop-up shown after a record is SUBMITTED.

   PostSubmitPrompt.show({ onAnother })
     New submission        closes the pop-up; the engine has already reset the form
     Return to record list navigates to record-list.html
     Return to home        navigates to the home index
     Log out               Auth.logout(), then back to the sign-in screen (Home)

   Navigation only: never touches fields, values, validation, storage or print.
   ======================================================================== */
(function () {
  'use strict';
  if (window.PostSubmitPrompt) return;

  var HOME_URL = '../index.html';
  var LIST_URL = '../records/record-list.html';

  function mk(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function injectCss() {
    if (document.getElementById('psp-css')) return;
    var s = document.createElement('style');
    s.id = 'psp-css';
    s.textContent =
      '.psp-scrim{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.psp-box{background:#fff;color:#1D2B38;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.35);width:100%;max-width:400px;padding:22px 20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}' +
      '.psp-box h2{margin:0 0 6px;font-size:18px}' +
      '.psp-box p{margin:0 0 16px;font-size:14px;color:#4a5a68}' +
      '.psp-box button{display:block;width:100%;min-height:48px;margin-top:8px;font-size:16px;font-weight:600;border-radius:8px;cursor:pointer;border:1px solid #1D2B38;background:#fff;color:#1D2B38}' +
      '.psp-box button.psp-primary{background:#1D2B38;color:#fff}' +
      '.psp-box button.psp-logout{border-color:#b91c1c;color:#b91c1c}' +
      '.psp-box button:focus-visible{outline:2px solid #A9763A;outline-offset:2px}' +
      '@media print{.psp-scrim{display:none!important}}';
    document.head.appendChild(s);
  }

  function show(opts) {
    opts = opts || {};
    if (document.querySelector('.psp-scrim')) return;
    injectCss();
    var scrim = mk('div', 'psp-scrim no-print');
    var box = mk('div', 'psp-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Submitted');
    box.appendChild(mk('h2', null, 'Submitted ✓'));
    box.appendChild(mk('p', null, 'What would you like to do next?'));

    function close() { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }

    /* 1 — New submission (primary action) */
    var btnNew = mk('button', 'psp-primary', 'New submission');
    btnNew.type = 'button';
    btnNew.addEventListener('click', function () { close(); if (opts.onAnother) opts.onAnother(); });

    /* 2 — Return to record list */
    var btnList = mk('button', null, 'Return to record list');
    btnList.type = 'button';
    btnList.addEventListener('click', function () { window.location.href = LIST_URL; });

    /* 3 — Return to home */
    var btnHome = mk('button', null, 'Return to home');
    btnHome.type = 'button';
    btnHome.addEventListener('click', function () { window.location.href = HOME_URL; });

    /* 4 — Log out */
    var btnOut = mk('button', 'psp-logout', 'Log out');
    btnOut.type = 'button';
    btnOut.addEventListener('click', function () {
      try { if (window.Auth && window.Auth.logout) window.Auth.logout(); } catch (e) { console.error(e); }
      window.location.href = HOME_URL;
    });

    box.appendChild(btnNew);
    box.appendChild(btnList);
    box.appendChild(btnHome);
    box.appendChild(btnOut);
    scrim.appendChild(box);
    document.body.appendChild(scrim);
    btnNew.focus({ preventScroll: true });
  }

  window.PostSubmitPrompt = { show: show };
})();
