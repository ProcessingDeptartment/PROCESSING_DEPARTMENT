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
