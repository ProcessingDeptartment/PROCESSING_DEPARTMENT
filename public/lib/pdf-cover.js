// View PDF (Awaiting Verification): ?entry=<id>&print=1&printonly=1 -> hide the whole record page the
// moment it starts loading, so the form never shows; form-record.js / monitoring-log.js then print the
// entry with the browser's own print dialog. Must be the first script on the page.
(function () {
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('printonly') !== '1' || q.get('print') !== '1' || !q.get('entry')) return;
    window.__pdfOnly = true;
    var st = document.createElement('style');
    st.id = 'pdfCoverStyle';
    // hide everything on screen at once (even before the body exists); print output is unaffected
    st.textContent = '@media screen{html{background:#fff!important}body{visibility:hidden!important}}';
    document.head.appendChild(st);
  } catch (e) { /* ignore */ }
})();

// Popup blocked (iPhone Safari blocks a window opened without a tap): un-hide the page and ask for one tap,
// which is the user gesture the browser needs to open the print window.
window.__pdfTapPrompt = function (retry) {
  try {
    var cs = document.getElementById('pdfCoverStyle');
    if (cs) cs.remove();
    var old = document.getElementById('pdfTapBox');
    if (old) old.remove();
    var box = document.createElement('div');
    box.id = 'pdfTapBox';
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#fff;display:flex;align-items:center;justify-content:center;padding:24px;';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Open PDF';
    b.style.cssText = 'background:#1d7a46;color:#fff;border:none;border-radius:12px;padding:18px 40px;font:700 18px system-ui,sans-serif;';
    b.addEventListener('click', function () { box.remove(); retry(); });
    box.appendChild(b);
    document.documentElement.appendChild(box);
  } catch (e) { /* ignore */ }
};

// Print-only page could not produce the PDF (entry missing, offline, no access key): say so instead of a blank page.
window.__pdfFail = function (msg) {
  try {
    var cs = document.getElementById('pdfCoverStyle');
    if (cs) cs.remove();
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;font:600 16px system-ui,sans-serif;color:#a3352d;';
    var t = document.createElement('div');
    t.textContent = msg;
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Try again';
    b.style.cssText = 'background:#1d2b38;color:#fff;border:none;border-radius:10px;padding:12px 28px;font:700 15px system-ui,sans-serif;';
    b.addEventListener('click', function () { location.reload(); });
    box.appendChild(t); box.appendChild(b);
    document.documentElement.appendChild(box);
    try { const _t = window.opener || (window.parent !== window ? window.parent : null); if (_t) _t.postMessage({ pdfReady: 1 }, location.origin); } catch (e) { /* ignore */ }
  } catch (e) { /* ignore */ }
};

// View PDF: instead of a second window, write the finished print page into THIS tab (same document the
// engine would have written into a popup). Only write / close / focus are used on the popup, so this stands in for it.
window.__pdfSameTab = function () {
  var buf = '';
  return {
    document: {
      write: function (h) { buf += h; },
      close: function () {
        try { const _t = window.opener || (window.parent !== window ? window.parent : null); if (_t) _t.postMessage({ pdfReady: 1 }, location.origin); } catch (e) { /* ignore */ }
        document.open(); document.write(buf); document.close();
      }
    },
    focus: function () {}
  };
};
