/* barcode-scan.js -- camera barcode scanning for any text input (iPhone Safari has no BarcodeDetector, so it falls back
 * to ZXing loaded on first use). 1D (Code 128/39/EAN/...) and QR are both enabled.
 *
 *   BarcodeScan.open(function (value) { ... })          modal scanner, with a type-it-in box as the fallback
 *   BarcodeScan.attach('fr_f_lotBarcode', { label })     adds a "Scan" button beside the input once it renders
 *
 * Camera access needs HTTPS (the Render site is). If the camera is refused the modal still lets the user type the code.
 */
(function () {
  'use strict';
  var ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  var zxingP = null;

  function loadZxing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!zxingP) {
      zxingP = new Promise(function (ok, no) {
        var s = document.createElement('script');
        s.src = ZXING; s.onload = function () { window.ZXing ? ok(window.ZXing) : no(new Error('zxing')); };
        s.onerror = function () { zxingP = null; no(new Error('zxing load')); };
        document.head.appendChild(s);
      });
    }
    return zxingP;
  }

  // Barcode functions are administrator-only for now (role ADMINISTRATOR = the password-protected Administrator login).
  function allowed() {
    try { return !!(window.Auth && Auth.getCurrentRole && Auth.getCurrentRole() === 'ADMINISTRATOR'); } catch (e) { return false; }
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function open(onValue, opts) {
    opts = opts || {};
    var m = document.createElement('div');
    m.className = 'ef-modal bs-modal';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="ef-card"><h3>' + esc(opts.title || 'Scan barcode') + '</h3>' +
      '<video playsinline muted class="ef-video" style="width:100%;max-height:50vh;background:#000"></video>' +
      '<div class="ef-hint bs-status" role="status">Starting camera…</div>' +
      '<label class="ef-field"><span class="ef-label">Or type it</span><input type="text" class="bs-manual" autocomplete="off" autocapitalize="characters"></label>' +
      '<div class="ef-modal-actions"><button type="button" class="ef-btn" data-cancel>Cancel</button>' +
      '<button type="button" class="ef-btn ef-btn-primary" data-use>Use typed code</button></div></div>';
    document.body.appendChild(m);

    var video = m.querySelector('video'), status = m.querySelector('.bs-status'), manual = m.querySelector('.bs-manual');
    var stream = null, timer = null, reader = null, done = false;

    function stop() {
      done = true; clearInterval(timer);
      try { if (reader) reader.reset(); } catch (e) { }
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      m.remove();
    }
    function accept(v) {
      v = String(v || '').trim();
      if (!v || done) return;
      stop();
      onValue(v);
    }
    function failed(msg) { status.textContent = msg; video.style.display = 'none'; try { manual.focus(); } catch (e) { } }

    m.querySelector('[data-cancel]').addEventListener('click', stop);
    m.querySelector('[data-use]').addEventListener('click', function () { accept(manual.value); });
    manual.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); accept(manual.value); } });

    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { failed('Camera not available here — type the code.'); return; }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }).then(function (s) {
      if (done) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s; video.srcObject = s; video.setAttribute('playsinline', ''); video.play().catch(function () { });
      status.textContent = 'Point the camera at the barcode.';
      if ('BarcodeDetector' in window) {
        var det = new window.BarcodeDetector();
        timer = setInterval(function () {
          det.detect(video).then(function (codes) { if (codes && codes.length) accept(codes[0].rawValue); }).catch(function () { });
        }, 250);
        return;
      }
      return loadZxing().then(function (Z) {
        if (done) return;
        reader = new Z.BrowserMultiFormatReader();
        timer = setInterval(function () {
          if (!video.videoWidth) return;
          var c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
          c.getContext('2d').drawImage(video, 0, 0);
          try {
            var lum = new Z.HTMLCanvasElementLuminanceSource(c);
            var bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(lum));
            accept(reader.decodeBitmap(bmp).getText());
          } catch (e) { /* no code in this frame */ }
        }, 300);
      });
    }).catch(function () { failed('Camera blocked or unavailable — type the code.'); });
  }

  // Adds a Scan button after the input (waits for the form engine to render it). Scanning fills the input and fires
  // an input event so the engine picks the value up like typing.
  function attach(inputId, opts) {
    opts = opts || {};
    function place() {
      var inp = document.getElementById(inputId);
      if (!inp || inp.dataset.bsAttached) return !!(inp && inp.dataset.bsAttached);
      inp.dataset.bsAttached = '1';
      if (!allowed()) {                       // not the administrator: the barcode field stays out of sight
        var fld = inp.closest('.fr-field, .ml-field') || inp.parentNode;
        if (fld) fld.style.display = 'none';
        return true;
      }
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ef-btn no-print'; b.textContent = '📷 ' + (opts.label || 'Scan');
      if (opts.readonly) { inp.readOnly = true; inp.placeholder = 'Scan the barcode'; }
      var note = document.createElement('div');
      note.className = 'ef-hint no-print'; note.setAttribute('role', 'status');
      function fill(v) {
        inp.value = v.toUpperCase();
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        note.textContent = opts.okText ? opts.okText(inp.value) : '';
      }
      b.addEventListener('click', function () {
        open(function (v) {
          if (!opts.check) { fill(v); return; }
          note.textContent = 'Checking ' + v + '…';
          Promise.resolve(opts.check(v.toUpperCase())).then(function (err) {
            if (err) { note.textContent = err; note.style.color = '#a33'; return; }
            note.style.color = ''; fill(v);
          }).catch(function () { note.style.color = ''; fill(v); });
        }, { title: opts.title });
      });
      inp.insertAdjacentElement('afterend', b);
      b.insertAdjacentElement('afterend', note);
      return true;
    }
    place();
    // the engine re-renders the form (draft load, lock changes), so keep the button present
    new MutationObserver(function () { var i = document.getElementById(inputId); if (i && !i.dataset.bsAttached) place(); })
      .observe(document.body, { childList: true, subtree: true });
  }

  window.BarcodeScan = { open: open, attach: attach, allowed: allowed };
})();
