/* Field specifications: check a value against a field's `spec`, give live feedback, and gate submission.
 * Spec: MD/field-specifications-system-instructions.md. Specs come from the record definition (src/record-def.js puts
 * `field.spec` on every field / roster column that has an active row in field_specs). Styles are in record-theme.css.
 *
 *   SpecGate.attach(config)                       await before collectSpecs: copies specs from the static snapshot onto an inline-defined config
 *   SpecGate.collectSpecs(config)                 -> { fieldKey: { spec, label, roster } }
 *   SpecGate.check(spec, value)                   -> { ok, reason }
 *   SpecGate.wire(root, specMap)                  live red highlight + warning bubble on input/change/blur
 *   SpecGate.scan(root, specMap)                  apply that feedback to values already in the form (draft / edit)
 *   SpecGate.collect(specMap, values, rosterRows, rosterList)   -> details[] of every out-of-spec value
 *   SpecGate.run(details, { root })               -> Promise: false (stop) | { mode, acceptedBy?, acknowledged? }
 *   SpecGate.ncBreaches(details)                  -> one NC prompt per ncCategory, for NcRaise.open
 *   SpecGate.stamp(sub, details, result)          writes the audit keys onto the saved submission
 *   SpecGate.liveThresholds(config)               config.ncThresholds minus fields whose spec has autoNc
 *
 * Gate modes, strictest wins: hard_block > double_sign > warn_submit > none.
 */
(function () {
  'use strict';

  var RANK = { none: 0, warn_submit: 1, double_sign: 2, hard_block: 3 };
  var SEV = { minor: 1, major: 2, critical: 3 };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(v) { if (v == null || String(v).trim() === '') return null; var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
  function api(path, opts) { return window.FacilityApi ? window.FacilityApi.fetch(path, opts) : fetch(path, opts); }

  /* ---- check ---- */
  function hasLimits(spec) { return !!spec && (spec.min != null || spec.max != null || (spec.allowed && spec.allowed.length)); }

  // Blank values are never out of spec (an empty required field is the form's own problem, not a spec breach).
  function check(spec, value) {
    if (!spec || value == null || String(value).trim() === '') return { ok: true, reason: '' };
    var reason = '';
    if (spec.min != null || spec.max != null) {
      var n = num(value);
      if (n !== null) {
        if (spec.min != null && n < spec.min) reason = 'Below minimum (' + spec.min + ')';
        else if (spec.max != null && n > spec.max) reason = 'Above maximum (' + spec.max + ')';
      }
    }
    if (!reason && spec.allowed && spec.allowed.length) {
      var v = String(value).trim().toLowerCase();
      if (!spec.allowed.some(function (a) { return String(a).trim().toLowerCase() === v; })) reason = 'Value not in allowed list';
    }
    return { ok: !reason, reason: reason };
  }

  function rangeText(spec, unit) {
    var u = unit ? ' ' + unit : '', parts = [];
    if (spec.min != null && spec.max != null) parts.push(spec.min + '–' + spec.max + u);
    else if (spec.max != null) parts.push('max ' + spec.max + u);
    else if (spec.min != null) parts.push('min ' + spec.min + u);
    if (spec.allowed && spec.allowed.length) parts.push('allowed: ' + spec.allowed.join(', '));
    return parts.join('; ');
  }

  /* ---- spec map ---- */
  function collectSpecs(config) {
    var map = {};
    function add(list, roster) {
      (list || []).forEach(function (f) {
        if (f && f.key && hasLimits(f.spec)) map[f.key] = { spec: f.spec, label: f.spec.labelOverride || f.label || f.key, unit: f.unit || '', roster: !!roster };
      });
    }
    add(config.fields); add(config.entryFields);
    (config.sections || []).forEach(function (s) { add(s.fields); });
    if (config.roster) add(config.roster.columns, true);
    (config.rosters || []).forEach(function (r) { add(r.columns, true); });
    return map;
  }

  /* ---- attach specs to a config that did not come from the definition ---- */
  // 86 record pages still declare their fields inline in the HTML, so their config has no `spec`. For those, read the
  // static snapshot (data/record-defs/<key>.json, the same file the DB-driven pages load) and copy each spec onto the
  // field / roster column with the same key. Static file only, short timeout, never the API: a slow or missing
  // snapshot must not hold a form up. Any failure just means "no specs".
  function attach(config) {
    if (!config || !config.recordKey) return Promise.resolve();
    var timeout = new Promise(function (res) { setTimeout(function () { res(null); }, 4000); });
    var load = fetch('/data/record-defs/' + encodeURIComponent(config.recordKey) + '.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return Promise.race([load, timeout]).then(function (def) {
      if (!def) return;
      var byKey = {};
      function scanDef(list) { (list || []).forEach(function (f) { if (f && f.key && f.spec) byKey[f.key] = f.spec; }); }
      scanDef(def.fields); scanDef(def.entryFields);
      (def.sections || []).forEach(function (s) { scanDef(s.fields); });
      if (def.roster) scanDef(def.roster.columns);
      (def.rosters || []).forEach(function (r) { scanDef(r.columns); });
      if (!Object.keys(byKey).length) return;
      function tag(list) { (list || []).forEach(function (f) { if (f && f.key && byKey[f.key] && !f.spec) f.spec = byKey[f.key]; }); }
      tag(config.fields); tag(config.entryFields);
      (config.sections || []).forEach(function (s) { tag(s.fields); });
      if (config.roster) tag(config.roster.columns);
      (config.rosters || []).forEach(function (r) { tag(r.columns); });
    }).catch(function () { });
  }

  /* ---- live feedback ---- */
  function keyOf(inp) {
    var col = inp.closest && inp.closest('[data-col]');
    if (col) return col.getAttribute('data-col');
    var m = inp.id && /_f_(.+)$/.exec(inp.id);   // form-record: fr_f_<key>; monitoring-log: <ns>_f_<key>
    return m ? m[1] : null;
  }

  function apply(inp, entry) {
    var host = inp.closest('.fr-field, .ml-field') || inp.parentElement;
    if (!host) return;
    var r = check(entry.spec, inp.value);
    host.classList.toggle('is-out-of-spec', !r.ok && !!entry.spec.highlightRed);
    var w = host.querySelector(':scope > .fr-spec-warn');
    if (!r.ok && entry.spec.showWarningBubble) {
      if (!w) { w = document.createElement('div'); w.className = 'fr-spec-warn'; host.appendChild(w); }
      w.textContent = '⚠ Out of spec — ' + r.reason;
    } else if (w) w.remove();
  }

  function wire(root, specMap) {
    if (!root || root._specWired || !Object.keys(specMap).length) return;
    root._specWired = true;
    function onEvt(e) {
      var inp = e.target;
      if (!inp || !inp.tagName || !/^(INPUT|SELECT|TEXTAREA)$/.test(inp.tagName)) return;
      var k = keyOf(inp);
      if (k && specMap[k]) apply(inp, specMap[k]);
    }
    ['input', 'change', 'focusout'].forEach(function (t) { root.addEventListener(t, onEvt); });
    scan(root, specMap);
  }

  function scan(root, specMap) {
    if (!root) return;
    root.querySelectorAll('input,select,textarea').forEach(function (inp) {
      var k = keyOf(inp);
      if (k && specMap[k]) apply(inp, specMap[k]);
    });
  }

  /* ---- collect at submit (authoritative: reads values, not the DOM) ---- */
  function collect(specMap, values, rosterRows, rosterList) {
    var out = [];
    function push(key, v, rowLabel, rowIndex, rosterIdx) {
      var e = specMap[key], r = check(e.spec, v);
      if (r.ok) return;
      out.push({ key: key, label: e.label, unit: e.unit, value: String(v).trim(), reason: r.reason, spec: e.spec,
        range: rangeText(e.spec, e.unit), rowLabel: rowLabel || '', rowIndex: rowIndex == null ? -1 : rowIndex, rosterIdx: rosterIdx || 0 });
    }
    Object.keys(specMap).forEach(function (k) {
      if (!specMap[k].roster && values && values[k] != null) push(k, values[k]);
    });
    (rosterRows || []).forEach(function (rows, ri) {
      var title = (rosterList && rosterList[ri] && rosterList[ri].rowTitle) || 'Row';
      (rows || []).forEach(function (row, n) {
        Object.keys(specMap).forEach(function (k) {
          if (specMap[k].roster && row && row[k] != null) push(k, row[k], title + ' ' + (n + 1), n, ri);
        });
      });
    });
    return out;
  }

  function strictest(details) {
    return details.reduce(function (m, d) { return RANK[d.spec.gateMode] > RANK[m] ? d.spec.gateMode : m; }, 'none');
  }

  /* ---- modal ---- */
  function listHtml(details) {
    return '<ul class="spec-gate-field-list">' + details.map(function (d) {
      return '<li><b>' + esc(d.label) + '</b>' + (d.rowLabel ? ' (' + esc(d.rowLabel) + ')' : '') + ': '
        + esc(d.value) + (d.unit ? ' ' + esc(d.unit) : '') + ' — Spec: ' + esc(d.range) + '</li>';
    }).join('') + '</ul>';
  }

  function focusFirst(root, details) {
    var d = details[0];
    if (!root || !d) return;
    var el = null;
    if (d.rowIndex >= 0) {
      var all = root.querySelectorAll('[data-col="' + d.key + '"] input,[data-col="' + d.key + '"] select');
      el = all[d.rowIndex] || all[0];
    } else el = root.querySelector('[id$="_f_' + d.key + '"]');
    if (!el) return;
    if (el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    if (el.focus) el.focus();
  }

  function run(details, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var mode = strictest(details);
      if (mode === 'none') { resolve({ mode: 'none' }); return; }
      var bg = document.createElement('div'); bg.className = 'spec-gate-overlay';
      var blocking = mode === 'hard_block' ? details.filter(function (d) { return d.spec.gateMode === 'hard_block'; }) : details;
      var html;
      if (mode === 'hard_block') {
        html = '<h2>⛔ Submission Blocked — Value Out of Spec</h2>' + listHtml(blocking)
          + '<p>This field must be within specification before the record can be submitted. Correct the value and try again.</p>'
          + '<div class="spec-gate-btns"><button type="button" class="spec-gate-go" data-back>Go Back and Correct</button></div>';
      } else if (mode === 'double_sign') {
        html = '<h2>⚠ Out-of-Spec Value — Authorisation Required</h2>' + listHtml(blocking)
          + '<p>Submitting with an out-of-spec value requires authorisation from two people. Both must enter their passkeys.</p>'
          + [1, 2].map(function (n) {
            return '<div class="spec-gate-step" data-step="' + n + '"><label>' + (n === 1 ? 'First passkey — person accepting the out-of-spec value' : 'Second passkey — supervisor sign-off') + '</label>'
              + '<div class="spec-gate-passkey-row"><input type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="Passkey"' + (n === 2 ? ' disabled' : '') + '>'
              + '<button type="button" data-verify="' + n + '"' + (n === 2 ? ' disabled' : '') + '>Verify</button></div>'
              + '<div class="spec-gate-msg" data-msg="' + n + '"></div></div>';
          }).join('')
          + '<div class="spec-gate-btns"><button type="button" data-cancel>Cancel</button>'
          + '<button type="button" class="spec-gate-go" data-confirm disabled>Confirm and Submit</button></div>';
      } else {
        html = '<h2>⚠ Out-of-Spec Value Detected</h2>' + listHtml(blocking)
          + '<p>You are about to submit a record containing a value outside specification. Do you want to continue?</p>'
          + '<div class="spec-gate-btns"><button type="button" data-cancel>Cancel</button>'
          + '<button type="button" class="spec-gate-go" data-continue>Continue Anyway</button></div>';
      }
      bg.innerHTML = '<div class="spec-gate-modal" role="dialog" aria-modal="true">' + html + '</div>';
      document.body.appendChild(bg);

      function done(r) { document.removeEventListener('keydown', onKey, true); bg.remove(); resolve(r); }
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } }
      function cancel() { done(false); if (mode === 'hard_block') focusFirst(opts.root, blocking); }
      document.addEventListener('keydown', onKey, true);
      var q = function (s) { return bg.querySelector(s); };
      if (q('[data-back]')) q('[data-back]').addEventListener('click', cancel);
      if (q('[data-cancel]')) q('[data-cancel]').addEventListener('click', cancel);
      if (q('[data-continue]')) q('[data-continue]').addEventListener('click', function () { done({ mode: mode, acknowledged: true }); });

      if (mode === 'double_sign') {
        var who = {};
        var confirmBtn = q('[data-confirm]');
        function verify(n) {
          var step = q('[data-step="' + n + '"]'), inp = step.querySelector('input'), msg = q('[data-msg="' + n + '"]'), btn = step.querySelector('[data-verify]');
          var pin = inp.value.trim();
          msg.className = 'spec-gate-msg'; msg.textContent = '';
          if (!/^\d{4,8}$/.test(pin)) { msg.classList.add('is-err'); msg.textContent = 'Passkey must be 4–8 digits.'; return; }
          btn.disabled = true;
          api('/api/passkey/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passkey: pin }) })
            .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
            .then(function (r) {
              if (!r.ok) { btn.disabled = false; msg.classList.add('is-err'); msg.textContent = (r.j && r.j.error) || 'Passkey not recognised'; inp.value = ''; inp.focus(); return; }
              if (n === 2 && who[1] && who[1].username === r.j.username) {
                btn.disabled = false; inp.value = ''; msg.classList.add('is-err');
                msg.textContent = 'The second passkey must belong to a different person.'; inp.focus(); return;
              }
              who[n] = r.j; inp.value = ''; inp.disabled = true;
              msg.classList.add('is-ok'); msg.textContent = '✓ Verified: ' + r.j.displayName;
              if (n === 1) { var s2 = q('[data-step="2"]'); s2.querySelector('input').disabled = false; s2.querySelector('button').disabled = false; s2.querySelector('input').focus(); }
              confirmBtn.disabled = !(who[1] && who[2]);
            })
            .catch(function (x) { btn.disabled = false; msg.classList.add('is-err'); msg.textContent = 'Could not verify: ' + x.message; });
        }
        [1, 2].forEach(function (n) {
          var step = q('[data-step="' + n + '"]');
          step.querySelector('button').addEventListener('click', function () { verify(n); });
          step.querySelector('input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); verify(n); } });
        });
        confirmBtn.addEventListener('click', function () {
          if (who[1] && who[2]) done({ mode: mode, acceptedBy: [who[1].displayName, who[2].displayName] });
        });
        q('[data-step="1"] input').focus();
      }
    });
  }

  /* ---- NC ---- */
  // One breach (shaped like NcRaise.findBreaches output, plus allowSkip) per unique ncCategory among autoNc fields.
  function ncBreaches(details) {
    var groups = {};
    details.forEach(function (d) {
      if (!d.spec.autoNc) return;
      var cat = d.spec.ncCategory || 'Other';
      var g = groups[cat] || (groups[cat] = { category: cat, severity: 'minor', allowSkip: true, lines: [], sig: [] });
      if ((SEV[d.spec.ncSeverity] || 1) > SEV[g.severity]) g.severity = d.spec.ncSeverity;
      if (!d.spec.ncOptionalSkip) g.allowSkip = false;
      g.lines.push(d.label + (d.rowLabel ? ' (' + d.rowLabel + ')' : '') + ' ' + d.value + (d.unit ? ' ' + d.unit : '') + ' — spec ' + d.range);
      g.sig.push(d.key + '=' + d.value);
    });
    return Object.keys(groups).map(function (cat) {
      var g = groups[cat];
      return { key: 'spec:' + cat + ':' + g.sig.join('|'), category: g.category, severity: g.severity, allowSkip: g.allowSkip,
        description: 'Out of specification: ' + g.lines.join('; ') + '.' };
    });
  }

  // config.ncThresholds minus any field whose spec has autoNc (the spec's NC prompt replaces the threshold's, so no double prompt)
  function liveThresholds(config) {
    var map = collectSpecs(config);
    return (config.ncThresholds || []).filter(function (t) { return !(map[t.field] && map[t.field].spec.autoNc); });
  }

  /* ---- audit stamp ---- */
  function stamp(sub, details, result) {
    delete sub.out_of_spec_fields; delete sub.out_of_spec_accepted_by; delete sub.out_of_spec_acknowledged;
    if (!details.length) return;
    sub.out_of_spec_fields = details.map(function (d) {
      return { field_key: d.key, label: d.label, value: num(d.value) != null ? num(d.value) : d.value,
        spec_min: d.spec.min == null ? null : d.spec.min, spec_max: d.spec.max == null ? null : d.spec.max,
        gate_mode: d.spec.gateMode, spec_version: d.spec.version == null ? null : d.spec.version, row: d.rowLabel || null };
    });
    if (result && result.acceptedBy) sub.out_of_spec_accepted_by = result.acceptedBy;
    if (result && result.acknowledged) sub.out_of_spec_acknowledged = true;
  }

  window.SpecGate = { check: check, collectSpecs: collectSpecs, wire: wire, scan: scan, collect: collect, run: run,
    ncBreaches: ncBreaches, stamp: stamp, strictest: strictest, liveThresholds: liveThresholds, attach: attach };
})();
