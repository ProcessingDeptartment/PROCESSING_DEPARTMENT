/* ========================================================================
   post-submit-prompt.js -- "Complete another page?" pop-up shown after a
   record is SUBMITTED (not after a draft save).

   PostSubmitPrompt.show({ onAnother })
     Yes — another page   closes the pop-up; the engine has already reset the form
     No — back to Record  reloads this record page (draft already cleared)
     Log out              Auth.logout(), then back to the sign-in screen (Home)

   Navigation only: never touches fields, values, validation, storage or print.
   ======================================================================== */
(function () {
  'use strict';
  if (window.PostSubmitPrompt) return;

  var HOME_URL = '../index.html';

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
      '.psp-box button.psp-yes{background:#1D2B38;color:#fff}' +
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
    box.appendChild(mk('h2', null, 'Submitted'));
    box.appendChild(mk('p', null, 'Do you want to complete another page?'));

    function close() { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }

    var yes = mk('button', 'psp-yes', 'Yes — another page');
    yes.type = 'button';
    yes.addEventListener('click', function () { close(); if (opts.onAnother) opts.onAnother(); });

    var no = mk('button', null, 'No — back to Record');
    no.type = 'button';
    no.addEventListener('click', function () { window.location.reload(); });

    var out = mk('button', null, 'Log out');
    out.type = 'button';
    out.addEventListener('click', function () {
      try { if (window.Auth && window.Auth.logout) window.Auth.logout(); } catch (e) { console.error(e); }
      window.location.href = HOME_URL;
    });

    box.appendChild(yes); box.appendChild(no); box.appendChild(out);
    scrim.appendChild(box);
    document.body.appendChild(scrim);
    yes.focus({ preventScroll: true });
  }

  window.PostSubmitPrompt = { show: show };
})();
