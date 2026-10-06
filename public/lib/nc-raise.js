/* NC from records: "Raise NC on this record" button + modal, out-of-spec threshold checks, and the NC banner
 * shown on submitted records. Shared by form-record.js and monitoring-log.js.
 *
 * A record's config may carry `ncThresholds: [{ field, label, min, max, category, severity, description }]`
 * (description may use {value}); `ncAlways: true` raises an NC on every submit (REC 7.6.5 pest sightings).
 * The NC itself is saved by POST /api/nc (src/nc-log.js), which also sends the alert email.
 */
(function () {
  'use strict';

  var CATEGORIES = ['Weight deviation', 'Temperature out of spec', 'Labelling error', 'Equipment failure',
    'Process deviation', 'Product quality', 'Dry room issue', 'Documentation error', 'Hygiene / sanitation', 'Pest activity', 'Other'];
  var SEV = { minor: 'Minor', major: 'Major', critical: 'Critical' };

  var css = ''
    + '.fr-nc-btn{border:1.5px solid #d98200;background:#fff8ec;color:#8a5200;border-radius:6px;padding:7px 12px;font:600 13px inherit;font-family:inherit;cursor:pointer}'
    + '.fr-nc-btn:hover{background:#ffeccb}'
    + '.nc-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 4px}'
    + '.nc-pending{font-size:12px;color:#8a5200;font-weight:600}'
    + '.nc-banner{margin:0 0 10px;padding:8px 11px;border-left:3px solid #d98200;background:#fff3dc;color:#7a4a00;font-size:12.5px;font-weight:600;border-radius:3px}'
    + '.nc-banner.nc-closed{border-left-color:#8a8f96;background:#eceef0;color:#4b5158}'
    + '.nc-banner a{color:inherit;text-decoration:underline;margin-left:6px}'
    + '.nc-inline-warn{display:block;margin-top:3px;font-size:11.5px;font-weight:600;color:#8a5200}'
    + '.nc-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100000;display:flex;align-items:center;justify-content:center;padding:14px}'
    + '.nc-modal{background:#fff;color:#1d2125;border-radius:10px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:16px 18px;border-top:4px solid #d98200;font-family:inherit}'
    + '.nc-modal h2{margin:0 0 4px;font-size:17px}'
    + '.nc-modal .nc-sub{margin:0 0 10px;font-size:12.5px;color:#5a6068}'
    + '.nc-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}'
    + '.nc-grid label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:600}'
    + '.nc-grid .nc-full{grid-column:1/-1}'
    + '.nc-grid input,.nc-grid select,.nc-grid textarea{font:14px inherit;font-family:inherit;padding:7px 8px;border:1px solid #b9bfc6;border-radius:6px}'
    + '.nc-grid input[readonly]{background:#f2f4f6;color:#4b5158}'
    + '.nc-grid textarea{min-height:70px;resize:vertical}'
    + '.nc-err{color:#b30000;font-size:12.5px;min-height:16px;margin-top:6px}'
    + '.nc-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}'
    + '.nc-btns button{padding:8px 14px;border-radius:6px;border:1px solid #b9bfc6;background:#fff;font:600 13px inherit;font-family:inherit;cursor:pointer}'
    + '.nc-btns .nc-go{background:#d98200;border-color:#d98200;color:#fff}'
    + '@media print{.fr-nc-btn,.nc-bar,.nc-inline-warn{display:none!important}}';
  var styled = false;
  function injectCss() {
    if (styled) return; styled = true;
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function userName() { var u = window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser(); return (u && u.displayName) || ''; }
  function api(path, opts) { return window.FacilityApi.fetch(path, opts); }

  /* ---- thresholds ---- */
  function num(v) { if (v == null || String(v).trim() === '') return null; var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
  function outOfRange(t, v) {
    var n = num(v); if (n === null) return false;
    return (t.min != null && n < t.min) || (t.max != null && n > t.max);
  }
  function rangeText(t) {
    if (t.min != null && t.max != null) return t.min + '–' + t.max;
    if (t.max != null) return 'max ' + t.max;
    return 'min ' + t.min;
  }
  function describe(t, v) {
    var tpl = t.description || ((t.label || t.field) + ' {value} — outside accepted range ' + rangeText(t) + '.');
    return tpl.replace(/\{value\}/g, String(v).trim());
  }
  // values: { field: value }; rosterRows: [[row, ...], ...] (optional). One breach per out-of-range value.
  function findBreaches(thresholds, values, rosterRows) {
    var out = [];
    (thresholds || []).forEach(function (t) {
      var seen = [];
      if (values && values[t.field] != null) seen.push(values[t.field]);
      (rosterRows || []).forEach(function (rows) { (rows || []).forEach(function (r) { if (r && r[t.field] != null) seen.push(r[t.field]); }); });
      seen.forEach(function (v) {
        if (outOfRange(t, v)) out.push({ key: t.field + '=' + String(v).trim(), field: t.field, value: String(v).trim(),
          category: t.category || 'Other', severity: t.severity || 'minor', description: describe(t, v) });
      });
    });
    return out;
  }

  // Inline warning under an out-of-spec input. idFor(field) -> input id; roster columns are found by data-col.
  function wireInline(root, thresholds, idFor) {
    if (!root || !thresholds || !thresholds.length || root._ncInline) return;
    root._ncInline = true; injectCss();
    root.addEventListener('change', function (e) {
      var inp = e.target; if (!inp || !inp.tagName || !/^(INPUT|SELECT)$/.test(inp.tagName)) return;
      var col = inp.closest && inp.closest('[data-col]');
      var t = thresholds.filter(function (x) {
        return inp.id === idFor(x.field) || (col && col.getAttribute('data-col') === x.field);
      })[0];
      if (!t) return;
      var host = col || inp.parentElement, w = host.querySelector(':scope > .nc-inline-warn');
      if (outOfRange(t, inp.value)) {
        if (!w) { w = document.createElement('span'); w.className = 'nc-inline-warn'; host.appendChild(w); }
        w.textContent = '⚠ Value out of spec (' + rangeText(t) + '). An NC will be prompted at submission.';
      } else if (w) w.remove();
    });
  }

  /* ---- modal ---- */
  // opts: { recordRef, jobNumber, submissionId, category, severity, description, allowSkip, heading }
  // resolves { nc } when raised, { skipped: true } when skipped, null when cancelled.
  function open(opts) {
    injectCss();
    return new Promise(function (resolve) {
      var bg = document.createElement('div'); bg.className = 'nc-bg';
      var user = userName();
      var cats = CATEGORIES.slice(); if (opts.category && cats.indexOf(opts.category) < 0) cats.unshift(opts.category);
      bg.innerHTML = '<form class="nc-modal"><h2>' + esc(opts.heading || '⚠ Raise NC on this record') + '</h2>'
        + '<p class="nc-sub">An alert email is sent as soon as this is raised.</p><div class="nc-grid">'
        + '<label>Record<input readonly value="' + esc(opts.recordRef) + '"></label>'
        + '<label>Job number<input readonly value="' + esc(opts.jobNumber || '') + '" placeholder="—"></label>'
        + '<label>Submission ID<input readonly value="' + esc(opts.submissionId || '') + '" placeholder="(not saved yet)"></label>'
        + '<label>Raised by<input name="raised_by" ' + (user ? 'readonly ' : 'required ') + 'value="' + esc(user) + '"></label>'
        + '<label>Category *<select name="category" required><option value="">— choose —</option>'
        + cats.map(function (c) { return '<option' + (c === opts.category ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>'
        + '<label>Severity *<select name="severity" required>'
        + Object.keys(SEV).map(function (k) { return '<option value="' + k + '"' + (k === (opts.severity || 'minor') ? ' selected' : '') + '>' + SEV[k] + '</option>'; }).join('') + '</select></label>'
        + '<label class="nc-full">Description *<textarea name="description" required placeholder="What went wrong">' + esc(opts.description || '') + '</textarea></label>'
        + '<label class="nc-full">Corrective action<textarea name="corrective_action" placeholder="Optional — can be added later in the NC log"></textarea></label>'
        + '</div><div class="nc-err"></div><div class="nc-btns">'
        + (opts.allowSkip ? '<button type="button" data-skip>Skip NC</button>' : '<button type="button" data-cancel>Cancel</button>')
        + '<button type="submit" class="nc-go">Raise NC</button></div></form>';
      document.body.appendChild(bg);
      var form = bg.querySelector('form'), err = bg.querySelector('.nc-err');
      function done(r) { bg.remove(); resolve(r); }
      var skip = bg.querySelector('[data-skip]'), cancel = bg.querySelector('[data-cancel]');
      if (skip) skip.addEventListener('click', function () { done({ skipped: true }); });
      if (cancel) cancel.addEventListener('click', function () { done(null); });
      if (!opts.allowSkip) bg.addEventListener('mousedown', function (e) { if (e.target === bg) done(null); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = form.elements, btn = form.querySelector('.nc-go');
        var body = { record_ref: opts.recordRef, job_number: opts.jobNumber || '', submission_id: opts.submissionId || '',
          raised_by: f.raised_by.value.trim(), category: f.category.value, severity: f.severity.value,
          description: f.description.value.trim(), corrective_action: f.corrective_action.value.trim() };
        btn.disabled = true; err.textContent = '';
        api('/api/nc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
          .then(function (nc) { done({ nc: nc }); })
          .catch(function (x) { btn.disabled = false; err.textContent = 'Could not raise NC: ' + x.message; });
      });
    });
  }

  /* ---- button + banner ---- */
  function buttonHtml(id) {
    injectCss();
    return '<div class="nc-bar no-print"><button type="button" id="' + id + '" class="fr-nc-btn">⚠ Raise NC on this record</button>'
      + '<span class="nc-pending" id="' + id + '_note"></span></div>';
  }
  function bannerHtml(refs) {
    refs = (refs || []).filter(Boolean); if (!refs.length) return '';
    injectCss();
    return '<div class="nc-banner" data-nc-refs="' + esc(refs.join(',')) + '">⚠ NC raised on this record: '
      + refs.map(function (r) { return esc(r) + ' <a href="../pages/nc-log.html?ref=' + encodeURIComponent(r) + '">View NC →</a>'; }).join(' · ') + '</div>';
  }
  // grey the banner once every NC on it is closed
  function hydrateBanners(root) {
    (root || document).querySelectorAll('.nc-banner[data-nc-refs]').forEach(function (b) {
      api('/api/nc?ref=' + encodeURIComponent(b.getAttribute('data-nc-refs')))
        .then(function (r) { return r.json(); })
        .then(function (rows) { if (rows.length && rows.every(function (n) { return n.status === 'closed'; })) b.classList.add('nc-closed'); })
        .catch(function () { });
    });
  }

  window.NcRaise = { open: open, findBreaches: findBreaches, wireInline: wireInline, buttonHtml: buttonHtml,
    bannerHtml: bannerHtml, hydrateBanners: hydrateBanners };
})();
