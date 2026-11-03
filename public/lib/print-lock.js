(function () {
  'use strict';

  /*
   * print-lock.js
   *
   * Locks the Print / PDF buttons on a record page until the
   * Dried Abalone Transfer (REC 7.4.10) has been completed for that job.
   *
   * Used by:
   *   REC-7.4.1  drying-process.html   (FormRecord,       root: #frRoot)
   *   REC-7.4.2  dry-monitoring.html   (MonitoringLog,    root: #mlRoot)
   *
   * The check hits the existing API endpoint:
   *   GET /api/dry-monitoring/job-facts/:jobNo
   * which already queries sub_dried_abalone_transfer.
   * `dried-transfer-weight` is non-null only when at least one SUBMITTED
   * (non-draft) transfer entry exists with a weight for the job — that is
   * the "complete" signal.
   *
   * The lock is informational / workflow guidance, not a hard security gate.
   */

  var NOTICE_ID  = 'pl-transfer-lock';
  var _locked    = false;
  var _lastJob   = '';
  var _applyTmr  = null;

  /* ------ helpers ------ */
  function api(path) {
    return window.FacilityApi
      ? window.FacilityApi.fetch(path)
      : fetch(path);
  }

  /* ------ apply current lock state to every print / PDF button in the DOM ------ */
  function applyState() {
    /* Main print button: form-record renders id="fr_printBtn";
       monitoring-log renders id="${ns}_printBtn" (e.g. "ml_p_printBtn").
       Match both by looking for any id ending in "_printBtn". */
    var printBtns = document.querySelectorAll('[id$="_printBtn"]');
    /* Per-submission PDF buttons — both engines use data-pdf. */
    var pdfBtns   = document.querySelectorAll('[data-pdf]');
    var tip = _locked
      ? 'Complete REC 7.4.10 (Dried Abalone Transfer) for this job before printing.'
      : '';

    [].forEach.call(printBtns, function (b) {
      b.disabled     = _locked;
      b.style.opacity = _locked ? '0.4' : '';
      b.title        = tip;
    });
    [].forEach.call(pdfBtns, function (b) {
      b.disabled     = _locked;
      b.style.opacity = _locked ? '0.4' : '';
      b.title        = tip;
    });

    /* Lock notice banner */
    var notice = document.getElementById(NOTICE_ID);
    if (_locked) {
      if (!notice) {
        notice = document.createElement('div');
        notice.id = NOTICE_ID;
        notice.style.cssText = [
          'background:#fef3e0',
          'border:1.5px solid #c8a254',
          'border-radius:6px',
          'padding:10px 14px',
          'margin:8px 0 6px',
          'font:600 13px/1.5 "IBM Plex Sans","Segoe UI",system-ui,sans-serif',
          'color:#7a4f10',
          'display:flex',
          'align-items:center',
          'gap:8px'
        ].join(';');
        notice.innerHTML =
          '<span style="font-size:18px;line-height:1;flex-shrink:0">🔒</span>'
          + '<span>Print not available yet — '
          + '<a href="../records/REC-7.4.10-dried-abalone-transfer.html"'
          + '   target="_blank"'
          + '   style="color:#7a4f10;text-decoration:underline">'
          + 'REC 7.4.10 Dried Abalone Transfer</a>'
          + ' must be completed for this job first.</span>';

        /* Insert before the first visible panel (el-panel or fr-panel or ml-panel) */
        var root   = document.getElementById('frRoot') || document.getElementById('mlRoot');
        var anchor = root && root.querySelector('.el-panel, .ml-panel, .fr-panel');
        if (anchor) anchor.parentNode.insertBefore(notice, anchor);
        else if (root) root.prepend(notice);
      }
    } else {
      if (notice) notice.remove();
    }
  }

  /* Debounced re-apply — fires after DOM mutations settle */
  function scheduleApply() {
    clearTimeout(_applyTmr);
    _applyTmr = setTimeout(applyState, 60);
  }

  /* ------ hit the API and update lock state ------ */
  function check(jobNo) {
    if (!jobNo) {
      _locked = false;
      applyState();
      return;
    }
    api('/api/dry-monitoring/job-facts/' + encodeURIComponent(jobNo))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        /* dried-transfer-weight is only set when a submitted transfer exists */
        _locked = !(data && data['dried-transfer-weight'] != null);
        applyState();
      })
      .catch(function () {
        /* On network error: do not block the user */
        _locked = false;
        applyState();
      });
  }

  /* ------ public entry point ------ */
  function init() {
    /* Watch the job number field.
       form-record renders id="fr_f_jobNo";
       monitoring-log renders id="${ns}_f_jobNo" (e.g. "ml_p_f_jobNo").
       Both end in "_f_jobNo", so we match with [id$="_f_jobNo"]. */
    function watchJob() {
      var inp = document.querySelector('[id$="_f_jobNo"]');
      if (!inp) { setTimeout(watchJob, 500); return; }

      function onJob() {
        var v = String(inp.value || '').trim();
        if (v === _lastJob) return;
        _lastJob = v;
        check(v);
      }

      inp.addEventListener('change', onJob);
      inp.addEventListener('input',  onJob);

      /* Short poll for programmatic fills (job loaded from URL / barcode) */
      var polls = 0;
      var t = setInterval(function () {
        onJob();
        if (++polls > 40) clearInterval(t);
      }, 400);
    }
    watchJob();

    /* Re-apply lock state whenever the form re-renders content
       (submission list opens, new PDF buttons appear, etc.) */
    function attachObserver() {
      var root = document.getElementById('frRoot') || document.getElementById('mlRoot');
      if (!root) { setTimeout(attachObserver, 800); return; }
      var obs = new MutationObserver(scheduleApply);
      obs.observe(root, { childList: true, subtree: true });
    }
    attachObserver();
  }

  window.PrintLock = { init: init };
})();
