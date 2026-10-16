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
