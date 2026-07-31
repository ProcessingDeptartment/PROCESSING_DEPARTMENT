/*
 * Shared engine for "periodic monitoring log" online records (temperature, humidity,
 * pH, thermometer verification, water chemistry, etc.) -- the family of paper logs that
 * are all shaped the same way: date/shift rows of readings, an auto-flagged deviation,
 * a corrective-action note, who checked it, and a periodic verify.
 *
 * A page calls MonitoringLog.init(config) once. Everything (entries table, add/edit
 * modal, thresholds modal, verification strip) is generated from that one config object
 * -- see any file in public/records/ for a real config, e.g. REC-7.9.1-chiller-temperature-monitoring.html.
 *
 * Reuses the existing shared libs exactly like the Double Seam Inspection Report does:
 *  - data-store.js     window.storage.get/set(key, shared) -- the localStorage-now /
 *                      real-backend-later shim. Entries live under
 *                      'monitoring_log:<recordKey>' (or '__<suffix>' for a secondary log).
 *  - spec-registry.js  versioned tolerances (SpecRegistry.proposeVersion/getPublished),
 *                      one flat spec object per recordKey (key -> {min,max}), no can/point
 *                      nesting needed for these simple logs.
 *  - document-revision.js  the record TEMPLATE's own revision badge, bumped whenever
 *                      thresholds are edited (reason + name + title required).
 *
 * === SWAP POINT for hardware/AI ingestion ===
 * Every entry carries `source` ('manual' today). A future sensor/PLC feed or AI vision
 * check would call the same saveEntry() path (or POST to whatever REST endpoint
 * data-store.js's storeSet() becomes once the real backend lands) with source:'device'
 * and a deviceId, landing in the exact same entries array and getting the same
 * auto-deviation flagging for free -- nothing about the schema below needs to change.
 * No such endpoint exists yet; this comment marks where it plugs in.
 */
(function () {
  const NS_ROOT = 'ml';

  function el(id) { return document.getElementById(id); }
  function num(v) { const n = parseFloat(v); return (v === '' || v == null || isNaN(n)) ? null : n; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function safeKey(s) { return String(s || '').trim().replace(/[\s\/\\'"]+/g, '_'); }
  function uid(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

  const STYLE = `
  .ml-app{ font-family:'Segoe UI',system-ui,sans-serif; color:var(--palette-ink,#1b2330); background:var(--palette-paper,#f4f5f3); font-size:13px; line-height:1.4; }
  .ml-app *{ box-sizing:border-box; }
  .ml-app h1,.ml-app h2,.ml-app h3{ margin:0; font-weight:700; }
  .ml-app input,.ml-app select,.ml-app textarea{
    font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; font-size:12.5px; border:1px solid #c9cdd1; border-radius:3px;
    padding:5px 7px; background:#fff; color:var(--palette-ink,#1b2330); width:100%;
  }
  .ml-app input:focus,.ml-app select:focus,.ml-app textarea:focus{ outline:2px solid var(--palette-focus,#2f4356); outline-offset:-1px; }
  .ml-app button{ font-family:'Segoe UI',system-ui,sans-serif; cursor:pointer; border:none; border-radius:3px; font-weight:600; }
  .ml-top{ background:var(--palette-dark,#1d2b38); color:var(--palette-dark-text,#f4f1e8); padding:14px 18px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
  .ml-topline{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .ml-btn{ padding:7px 13px; font-size:12.5px; }
  .ml-btn-primary{ background:var(--palette-primary,#c9832b); color:var(--palette-primary-text,#241a0a); }
  .ml-btn-primary:hover{ background:var(--palette-primary-hover,#dd9536); }
  .ml-btn-ghost{ background:transparent; color:#f4f1e8; border:1px solid #55636e !important; }
  .ml-btn-ghost:hover{ background:#33444f; }
  .ml-btn-flat{ background:#e2e4e3; color:#1b2330; }
  .ml-btn-flat:hover{ background:#d5d8d6; }
  .ml-btn:disabled{ opacity:.45; cursor:not-allowed; }
  .ml-btn-sm{ padding:4px 10px; font-size:10.5px; }
  .ml-body{ padding:16px 18px 60px; max-width:1400px; margin:0 auto; }
  .ml-panel{ background:#fff; border:1px solid var(--palette-border,#e2e4e3); border-radius:6px; margin-bottom:14px; }
  .ml-panel-head{ padding:9px 14px; border-bottom:1px solid var(--palette-border,#e2e4e3); display:flex; justify-content:space-between; align-items:center; background:var(--palette-head-bg,#fbfbfa); border-radius:6px 6px 0 0; gap:10px; flex-wrap:wrap; }
  .ml-panel-head h2{ font-size:12.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--palette-heading,#2f4356); }
  .ml-panel-body{ padding:14px; }
  .ml-instructions{ display:grid; gap:8px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .ml-instructions .instr-item{ background:var(--palette-head-bg,#fbfbfa); border:1px solid var(--palette-border,#e2e4e3); border-radius:4px; padding:8px 10px; }
  .ml-instructions .instr-item strong{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--palette-label,#54606b); margin-bottom:3px; }
  .ml-related a{ color:#1d4ed8; font-weight:600; text-decoration:none; }
  .ml-related a:hover{ text-decoration:underline; }
  .ml-grid{ display:grid; gap:10px; }
  .ml-grid-2{ grid-template-columns:repeat(2,1fr); }
  .ml-grid-3{ grid-template-columns:repeat(3,1fr); }
  .ml-field{ display:flex; flex-direction:column; gap:3px; font-size:11.5px; color:var(--palette-label,#54606b); font-weight:600; }
  .ml-field span.hint{ font-weight:400; color:#8a939b; font-family:'IBM Plex Mono',monospace; font-size:10.5px; }
  .ml-filters{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
  .ml-filters input[type=date]{ width:auto; }
  .ml-filters input[type=text]{ max-width:220px; }
  .ml-filters label{ font-size:11.5px; color:var(--palette-label,#54606b); display:flex; gap:5px; align-items:center; white-space:nowrap; }
  table.ml-table{ width:100%; border-collapse:collapse; }
  table.ml-table th,table.ml-table td{ border:1px solid var(--palette-border,#e2e4e3); padding:5px 7px; text-align:left; vertical-align:middle; font-size:11.5px; }
  table.ml-table th{ background:var(--palette-head-bg,#fbfbfa); font-size:10.5px; text-transform:uppercase; letter-spacing:.03em; color:var(--palette-label,#54606b); font-weight:700; white-space:nowrap; }
  table.ml-table td.ml-num{ font-family:'IBM Plex Mono',monospace; text-align:right; }
  table.ml-table tr.ml-fail td{ background:#fbe8e6; }
  .ml-badge{ display:inline-block; padding:2px 8px; border-radius:20px; font-size:10.5px; font-weight:700; letter-spacing:.02em; white-space:nowrap; }
  .ml-badge-ok{ background:var(--palette-ok-bg,#e8f3ec); color:var(--palette-ok,#2f7a52); }
  .ml-badge-fail{ background:var(--palette-fail-bg,#fbe8e6); color:var(--palette-fail,#a3352d); }
  .ml-badge-muted{ background:#eee; color:#777; }
  .ml-muted{ color:#8a939b; }
  .ml-notice{ display:none; padding:8px 12px; border-radius:4px; font-size:11.5px; font-weight:600; margin-bottom:10px; }
  .ml-notice.show{ display:block; }
  .ml-notice-due{ background:var(--palette-fail-bg,#fbe8e6); color:var(--palette-fail,#a3352d); border:1px solid #e8b8b3; }
  .ml-empty{ padding:18px; text-align:center; color:#8a939b; }
  .ml-history-list{ max-height:220px; overflow:auto; border:1px solid var(--palette-border,#e2e4e3); border-radius:4px; }
  .ml-history-item{ padding:7px 10px; border-bottom:1px solid var(--palette-border,#e2e4e3); display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:11.5px; }
  .ml-history-item:last-child{ border-bottom:none; }
  .ml-modal-overlay{ position:fixed; inset:0; background:rgba(20,25,30,.5); z-index:500; align-items:center; justify-content:center; }
  .ml-modal-inner{ background:#fff; border-radius:8px; width:min(760px,94vw); max-height:90vh; overflow:auto; padding:16px; }
  .ml-modal-inner h2{ font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--palette-heading,#2f4356); margin-bottom:10px; }
  .ml-modal-inner h3{ font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--palette-label,#54606b); margin:14px 0 6px; }
  .ml-actions{ display:flex; gap:10px; justify-content:flex-end; margin-top:10px; flex-wrap:wrap; align-items:center; }
  .ml-toast{ position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:var(--palette-dark,#1d2b38); color:#fff; padding:9px 18px; border-radius:20px; font-size:12px; z-index:999; opacity:0; pointer-events:none; transition:opacity .25s; }
  .ml-toast.show{ opacity:1; }
  /* Entries table is wider than any tablet -- scroll it inside the panel rather
     than letting it stretch the page. Applies at every width. */
  .ml-table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
  @media (max-width:1024px){
    .ml-grid-3{ grid-template-columns:repeat(2,1fr); }
    .ml-body{ padding:14px 14px 60px; }
  }
  @media (max-width:900px){ .ml-grid-2,.ml-grid-3{grid-template-columns:1fr;} }
  @media (max-width:768px){
    .ml-top{ padding:10px 12px; gap:10px; }
    .ml-topline{ width:100%; }
    .ml-topline .ml-btn{ flex:1 1 auto; }
    .ml-body{ padding:10px 12px 60px; }
    .ml-panel-head{ padding:8px 10px; }
    .ml-panel-body{ padding:10px; }
    /* >=16px stops iOS Safari zooming the page on focus. Inputs inside the
       entries table stay compact -- that table scrolls instead. */
    .ml-app input,.ml-app select,.ml-app textarea{ font-size:16px; padding:8px; }
    .ml-app table.ml-table input,.ml-app table.ml-table select,.ml-app table.ml-table textarea{ font-size:13px; padding:4px; }
    .ml-btn{ min-height:40px; }
    .ml-btn-sm{ min-height:32px; padding:6px 10px; font-size:11.5px; }
    .ml-filters{ gap:6px; }
    .ml-filters label,.ml-filters input[type=text]{ flex:1 1 140px; max-width:none; }
    .ml-filters input[type=date]{ width:100%; }
    .ml-modal-inner{ width:100vw; max-width:100vw; min-height:100vh; max-height:100vh; border-radius:0; padding:14px; }
    .ml-actions{ justify-content:flex-start; }
    .ml-actions .ml-btn{ flex:1 1 auto; }
  }
  @media (max-width:480px){
    .ml-top{ padding:8px 10px; }
    .ml-topline{ flex-direction:column; align-items:stretch; }
    .ml-body{ padding:8px 10px 60px; }
    .ml-panel-body{ padding:8px; }
    .ml-filters label,.ml-filters input[type=text]{ flex:1 1 100%; }
    .ml-actions .ml-btn{ flex:1 1 100%; }
    .ml-actions .ml-btn-sm{ flex:0 1 auto; }
  }
  @media print{
    @page{ size:A4 landscape; margin:9mm; }
    body{ background:#fff; }
    .no-print{ display:none !important; }
    .ml-app{ font-size:10px; }
    .ml-table-wrap{ overflow:visible !important; }
    table.ml-table th,table.ml-table td{ border:1px solid #000; padding:3px 5px; }
  }`;

  function injectStyleOnce() {
    if (document.getElementById('ml-style')) return;
    const s = document.createElement('style');
    s.id = 'ml-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  async function storeGet(key, shared) {
    try { const r = await window.storage.get(key, shared); return r ? r.value : null; } catch (e) { return null; }
  }
  async function storeSet(key, value, shared) {
    try { await window.storage.set(key, value, shared); return true; } catch (e) { console.error('storage set failed', e); return false; }
  }

  /* === SWAP POINT for notifications ===
   * No notification transport exists yet (no backend, no mail relay). Everything that
   * would notify someone routes through notify() so wiring it up later is a one-liner:
   * define window.RecordNotifications.send(payload) -> Promise, and every call site
   * below starts delivering. Until then payloads are logged and dropped.
   * payload = { type, recordKey, docCode, title, message, recipients, dueSince, meta }
   */
  function notify(payload) {
    try {
      if (window.RecordNotifications && typeof window.RecordNotifications.send === 'function') {
        return Promise.resolve(window.RecordNotifications.send(payload));
      }
    } catch (e) { console.error('notification send failed', e); }
    console.info('[notification not delivered — no transport configured]', payload);
    return Promise.resolve(false);
  }

  function fieldInputHtml(ns, field, value) {
    const id = `${ns}_f_${field.key}`;
    const v = value == null ? '' : value;
    if (field.type === 'select' || field.type === 'yesno') {
      const opts = field.type === 'yesno' ? ['', 'Yes', 'No'] : ['', ...(field.options || [])];
      // Keep a stored value that is no longer an option (e.g. an option list
      // that was since renamed) so old records still show what was captured.
      if (v !== '' && opts.indexOf(v) === -1) opts.push(v);
      return `<select id="${id}">${opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${o === '' ? '—' : esc(o)}</option>`).join('')}</select>`;
    }
    if (field.type === 'textarea') {
      return `<textarea id="${id}" rows="2">${esc(v)}</textarea>`;
    }
    if (field.type === 'number') {
      return `<input type="number" step="0.01" id="${id}" value="${esc(v)}">`;
    }
    if (field.type === 'computed') {
      return `<input type="text" id="${id}" value="${esc(v)}" disabled>`;
    }
    if (field.type === 'date') {
      return `<input type="date" id="${id}" value="${esc(v)}">`;
    }
    if (field.type === 'month') {
      return `<input type="month" id="${id}" value="${esc(v)}">`;
    }
    return `<input type="text" id="${id}" value="${esc(v)}">`;
  }

  function fieldLabel(field) {
    return field.label + (field.unit ? ` <span class="hint">(${esc(field.unit)})</span>` : '');
  }

  // ---- one controller per log (primary + optional secondary share this factory) ----
  function makeLogController(opts) {
    const { ns, title, entryFields, storageKey, specGetter, toast, tableWrap, modalIds, deviationLabel, deviationPolarity, submitFlow } = opts;
    let entries = [];
    let editingId = null;

    // Entries predating the draft/submit lifecycle have no status; treat them as drafts
    // so nothing that was editable yesterday is locked today.
    function isSubmitted(entryRow) { return submitFlow && entryRow.status === 'submitted'; }

    function specFor(key) {
      const spec = specGetter();
      return spec ? spec[key] : null;
    }

    function checkField(field, value) {
      if (!field.specKey) return null;
      const v = num(value);
      if (v === null) return null;
      const range = specFor(field.specKey);
      if (!range || (range.min == null && range.max == null)) return null;
      if (range.min != null && v < range.min) return 'fail';
      if (range.max != null && v > range.max) return 'fail';
      return 'ok';
    }

    function evaluateEntry(values) {
      let anyChecked = false, anyFail = false;
      entryFields.forEach(f => {
        const r = checkField(f, values[f.key]);
        if (r) { anyChecked = true; if (r === 'fail') anyFail = true; }
      });
      if (!anyChecked) return null;
      return !anyFail; // true = in spec
    }

    function statusBadge(inSpec) {
      if (inSpec === null || inSpec === undefined) return `<span class="ml-badge ml-badge-muted">—</span>`;
      const isAccuratePolarity = deviationPolarity === 'accurate';
      const goodText = isAccuratePolarity ? 'Yes' : 'No';
      const badText = isAccuratePolarity ? 'No' : 'Yes';
      const text = inSpec ? goodText : badText;
      const cls = inSpec ? 'ml-badge-ok' : 'ml-badge-fail';
      return `<span class="ml-badge ${cls}">${esc(deviationLabel)}: ${text}</span>`;
    }

    async function load() {
      const raw = await storeGet(storageKey, true);
      try { entries = raw ? JSON.parse(raw) : []; } catch (e) { entries = []; }
    }
    async function persist() {
      return storeSet(storageKey, JSON.stringify(entries), true);
    }

    function computeAll(rawValues) {
      const values = Object.assign({}, rawValues);
      entryFields.forEach(f => {
        if (f.type === 'computed' && typeof f.compute === 'function') {
          try { values[f.key] = f.compute(values); } catch (e) { values[f.key] = ''; }
        }
      });
      return values;
    }

    function filteredEntries() {
      const from = el(`${ns}_filterFrom`) ? el(`${ns}_filterFrom`).value : '';
      const to = el(`${ns}_filterTo`) ? el(`${ns}_filterTo`).value : '';
      const search = el(`${ns}_filterSearch`) ? el(`${ns}_filterSearch`).value.trim().toLowerCase() : '';
      const devOnly = el(`${ns}_filterDevOnly`) ? el(`${ns}_filterDevOnly`).checked : false;
      return entries.filter(e => {
        const d = e.values.date || '';
        if (from && d && d < from) return false;
        if (to && d && d > to) return false;
        if (devOnly && e.inSpec !== false) return false;
        if (search) {
          const hay = JSON.stringify(e.values).toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      }).sort((a, b) => (b.values.date || '').localeCompare(a.values.date || '') || b.createdAt - a.createdAt);
    }

    function renderTable() {
      const list = filteredEntries();
      const table = tableWrap;
      if (!list.length) {
        table.innerHTML = `<div class="ml-empty">No entries yet${entries.length ? ' matching these filters' : ''}.</div>`;
        return;
      }
      const cols = entryFields.filter(f => f.showInTable !== false);
      let html = `<table class="ml-table"><thead><tr>${cols.map(f => `<th>${esc(f.label)}</th>`).join('')}${submitFlow ? '<th>Submission</th>' : ''}<th>Status</th><th></th></tr></thead><tbody>`;
      list.forEach(entryRow => {
        html += `<tr class="${entryRow.inSpec === false ? 'ml-fail' : ''}">`;
        cols.forEach(f => {
          let v = entryRow.values[f.key];
          if (f.type === 'yesno' || f.type === 'select') v = v || '—';
          else if (v === '' || v == null) v = '—';
          html += `<td class="${f.type === 'number' || f.type === 'computed' ? 'ml-num' : ''}">${esc(v)}</td>`;
        });
        if (submitFlow) {
          html += isSubmitted(entryRow)
            ? `<td><span class="ml-badge ml-badge-ok">✓ Submitted</span></td>`
            : `<td><span class="ml-badge ml-badge-muted">Draft</span></td>`;
        }
        html += `<td>${statusBadge(entryRow.inSpec)}</td>`;
        html += `<td><button class="ml-btn ml-btn-flat ml-btn-sm" data-edit="${entryRow.id}">${isSubmitted(entryRow) ? 'View' : 'Edit'}</button></td>`;
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      table.innerHTML = html;
      table.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => openForm(btn.dataset.edit));
      });
    }

    function recalcComputedInModal() {
      const raw = {};
      entryFields.forEach(f => {
        if (f.type !== 'computed') {
          const inp = el(`${ns}_f_${f.key}`);
          if (inp) raw[f.key] = inp.value;
        }
      });
      const withComputed = computeAll(raw);
      entryFields.forEach(f => {
        if (f.type === 'computed') {
          const inp = el(`${ns}_f_${f.key}`);
          if (inp) inp.value = withComputed[f.key] == null ? '' : withComputed[f.key];
        }
      });
    }

    function openForm(id) {
      editingId = id || null;
      const existing = id ? entries.find(e => e.id === id) : null;
      const locked = existing ? isSubmitted(existing) : false;
      el(modalIds.title).textContent = !id ? 'Add entry' : (locked ? 'Submitted entry (read-only)' : 'Edit entry');
      const container = el(modalIds.fields);
      container.innerHTML = entryFields.map(f => `
        <label class="ml-field">${fieldLabel(f)}
          ${fieldInputHtml(ns, f, existing ? existing.values[f.key] : (f.default || ''))}
        </label>`).join('');
      container.querySelectorAll('input,select,textarea').forEach(inp => {
        inp.addEventListener('input', recalcComputedInModal);
        inp.addEventListener('change', recalcComputedInModal);
      });
      recalcComputedInModal();
      if (submitFlow) {
        container.querySelectorAll('input,select,textarea').forEach(inp => { inp.disabled = locked; });
        const saveBtn = el(`${ns}_saveBtn`), submitBtn = el(`${ns}_submitBtn`);
        if (saveBtn) saveBtn.style.display = locked ? 'none' : '';
        if (submitBtn) submitBtn.style.display = locked ? 'none' : '';
      }
      el(modalIds.overlay).style.display = 'flex';
    }
    function closeForm() {
      el(modalIds.overlay).style.display = 'none';
    }

    async function saveForm(finalize) {
      const raw = {};
      let missingRequired = null;
      entryFields.forEach(f => {
        if (f.type === 'computed') return;
        const inp = el(`${ns}_f_${f.key}`);
        raw[f.key] = inp ? inp.value : '';
        if (f.required && !String(raw[f.key] || '').trim()) missingRequired = f.label;
      });
      // A draft may be incomplete; a submission may not.
      if (missingRequired && (finalize || !submitFlow)) { toast(`"${missingRequired}" is required.`); return; }
      const values = computeAll(raw);
      const inSpec = evaluateEntry(values);

      const status = submitFlow ? (finalize ? 'submitted' : 'draft') : undefined;
      let savedEntry;
      if (editingId) {
        const existing = entries.find(e => e.id === editingId);
        if (isSubmitted(existing)) { toast('This entry is submitted and can no longer be changed.'); return; }
        existing.history = existing.history || [];
        existing.history.push({ ts: Date.now(), previousValues: existing.values });
        existing.values = values;
        existing.inSpec = inSpec;
        existing.updatedAt = Date.now();
        if (submitFlow) { existing.status = status; if (finalize) existing.submittedAt = Date.now(); }
        savedEntry = existing;
      } else {
        savedEntry = {
          id: uid('entry'),
          values,
          inSpec,
          status,
          submittedAt: finalize ? Date.now() : undefined,
          source: 'manual', // future device/AI feeds set 'device' + a deviceId here
          createdAt: Date.now(),
          updatedAt: Date.now(),
          history: []
        };
        entries.push(savedEntry);
      }
      const ok = await persist();
      if (!ok) { toast('Save failed — please retry.'); return; }
      // Best-effort batch traceability index (only if this record declares a batchField).
      if (window.Traceability && config.batchField) window.Traceability.indexSubmission(config, savedEntry);
      closeForm();
      renderTable();
      if (submitFlow) toast(finalize ? 'Entry submitted.' : 'Draft saved.');
      else toast(editingId ? 'Entry updated.' : 'Entry added.');
    }

    function download(blob, filename) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    }

    function exportCsv() {
      const cols = entryFields.filter(f => f.showInTable !== false);
      const rows = [cols.map(f => f.label).concat(submitFlow ? ['Submission', 'Status'] : ['Status'])];
      filteredEntries().forEach(e => {
        const tail = e.inSpec === null || e.inSpec === undefined ? '' : (e.inSpec ? 'OK' : 'DEVIATION');
        rows.push(cols.map(f => e.values[f.key] == null ? '' : String(e.values[f.key]))
          .concat(submitFlow ? [isSubmitted(e) ? 'Submitted' : 'Draft', tail] : [tail]));
      });
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      download(new Blob([csv], { type: 'text/csv' }), safeKey(title) + '.csv');
    }

    // Full-fidelity export -- unlike the CSV this keeps hidden columns, edit history
    // and submission timestamps, so it round-trips into the future backend.
    function exportJson() {
      const payload = {
        record: title,
        storageKey,
        exportedAt: new Date().toISOString(),
        entryCount: filteredEntries().length,
        entries: filteredEntries()
      };
      download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), safeKey(title) + '.json');
    }

    function printPdf() {
      const previousTitle = document.title;
      document.title = safeKey(title) + '_' + new Date().toISOString().slice(0, 10);
      window.print();
      document.title = previousTitle;
    }

    return { load, renderTable, openForm, closeForm, saveForm, exportCsv, exportJson, printPdf,
      // Drafts aren't finished work, so they don't make a verification due.
      verifiableCount: () => submitFlow ? entries.filter(isSubmitted).length : entries.length };
  }

  async function init(config) {
    // Require authentication before showing the record
    if (window.LoginUI) {
      await window.LoginUI.ensureAuthenticated();
    }

    injectStyleOnce();
    const mount = typeof config.mount === 'string' ? document.querySelector(config.mount) : config.mount;
    mount.classList.add('ml-app');

    function toast(msg) {
      const t = el('ml_toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2200);
    }

    const specKey = config.recordKey + '-spec';
    const docRevisionKey = config.recordKey;
    let currentSpec = null;

    function defaultSpecObject() {
      const obj = {};
      (config.specFields || []).forEach(f => { obj[f.key] = { min: f.min, max: f.max }; });
      return obj;
    }

    async function loadSpec() {
      let published = await SpecRegistry.getPublished(specKey);
      if (!published) {
        published = await SpecRegistry.proposeVersion(specKey, defaultSpecObject(), {
          changeReason: `Seeded from paper record ${config.docCode}`, publishedBy: 'System', changedByTitle: 'System'
        });
      }
      currentSpec = published;
    }

    async function renderDocRevBadge() {
      const rev = await DocumentRevision.getCurrent(docRevisionKey, config.docRevisionStart || 1);
      const date = await DocumentRevision.getCurrentDate(docRevisionKey, config.docRevisionDate);
      el('ml_docRev').textContent = `Rev ${rev} · Rev date ${date || 'not set'}`;
      const modalTag = el('ml_docRevInModal');
      if (modalTag) modalTag.textContent = `Rev ${rev}`;
    }
    async function renderDocRevHistory() {
      const target = el('ml_docRevHistoryList');
      if (!target) return; // thresholds modal (its only home) is switched off
      const hist = await DocumentRevision.history(docRevisionKey);
      if (!hist.length) { target.innerHTML = `<div class="ml-history-item ml-muted">No revisions logged yet (currently Rev ${config.docRevisionStart || 1}).</div>`; return; }
      target.innerHTML = hist.map(h => `
        <div class="ml-history-item"><span>Rev ${h.revisionNumber} · ${new Date(h.changedAt).toLocaleString()} · ${esc(h.changedBy)} (${esc(h.changedByTitle)})<br><span class="ml-muted">${esc(h.reason)}</span></span></div>`).join('');
    }

    // ---------- top-level skeleton ----------
    const instructionsHtml = (config.instructions || []).length ? `
      <div class="ml-panel no-print"><div class="ml-panel-head"><h2>Work instructions</h2></div>
        <div class="ml-panel-body ml-instructions">
          ${config.instructions.map(i => `<div class="instr-item"><strong>${esc(i.label)}</strong>${esc(i.text)}</div>`).join('')}
        </div></div>` : '';

    const relatedHtml = (config.relatedLinks || []).length ? `
      <div class="ml-panel no-print ml-related"><div class="ml-panel-body">
        ${config.relatedLinks.map(l => `<a href="${esc(l.href)}">→ ${esc(l.label)}</a>`).join('<br>')}
      </div></div>` : '';

    // Opt-in per-entry lifecycle: entries save as 'draft' and are locked once submitted.
    const submitFlow = config.entryWorkflow === 'draft-submit';

    function logBlockHtml(ns, blockTitle) {
      return `
      <div class="ml-panel no-print">
        <div class="ml-panel-head">
          <h2>${esc(blockTitle)}</h2>
          <button class="ml-btn ml-btn-primary ml-btn-sm" id="${ns}_addEntryBtn">+ Add entry</button>
        </div>
        <div class="ml-panel-body">
          <div class="ml-filters">
            <label>From <input type="date" id="${ns}_filterFrom"></label>
            <label>To <input type="date" id="${ns}_filterTo"></label>
            <input type="text" id="${ns}_filterSearch" placeholder="Search entries…">
            <label><input type="checkbox" id="${ns}_filterDevOnly"> Deviations only</label>
            <button class="ml-btn ml-btn-flat ml-btn-sm" id="${ns}_exportCsvBtn">Export CSV</button>
            <button class="ml-btn ml-btn-flat ml-btn-sm" id="${ns}_exportJsonBtn">Export JSON</button>
            <button class="ml-btn ml-btn-flat ml-btn-sm" id="${ns}_printBtn">Print PDF</button>
          </div>
          <div id="${ns}_table" class="ml-table-wrap"></div>
        </div>
      </div>
      <div id="${ns}_modal" class="ml-modal-overlay no-print" style="display:none;">
        <div class="ml-modal-inner">
          <h2 id="${ns}_modalTitle">Add entry</h2>
          <div id="${ns}_modalFields" class="ml-grid ml-grid-2"></div>
          <div class="ml-actions">
            <button class="ml-btn ml-btn-flat" id="${ns}_cancelBtn">Cancel</button>
            <button class="ml-btn ${submitFlow ? 'ml-btn-flat' : 'ml-btn-primary'}" id="${ns}_saveBtn">${submitFlow ? 'Save draft' : 'Save entry'}</button>
            ${submitFlow ? `<button class="ml-btn ml-btn-primary" id="${ns}_submitBtn">Submit</button>` : ''}
          </div>
        </div>
      </div>`;
    }

    const showVerification = config.showVerificationStrip !== false;
    const verificationHtml = showVerification ? `
      <div class="ml-panel no-print">
        <div class="ml-panel-head"><h2>Verification</h2></div>
        <div class="ml-panel-body">
          <div class="ml-notice ml-notice-due" id="ml_verifyNotice"></div>
          <div class="ml-grid ml-grid-3" style="margin-bottom:10px;">
            <label class="ml-field">Verified by<input id="ml_verifiedBy"></label>
            <label class="ml-field">Signature (type name to sign)<input id="ml_verifiedSig"></label>
            <label class="ml-field">Date<input id="ml_verifiedDate" type="date"></label>
          </div>
          <div class="ml-actions" style="justify-content:flex-start; margin-top:0;">
            <button class="ml-btn ml-btn-primary ml-btn-sm" id="ml_saveVerificationBtn">Log verification</button>
          </div>
          <h3>Verification history</h3>
          <div class="ml-history-list" id="ml_verificationHistory"></div>
        </div>
      </div>` : '';

    // Thresholds are meaningless for a log with no numeric spec fields (e.g. an
    // all-checklist record), so the button can be switched off per record.
    const showThresholds = config.showThresholds !== false;
    // Records that lead with the action rather than the log put "+ Add entry" in the
    // header and push the entries panel below the verification strip.
    const topAddEntry = config.topAddEntry === true;
    const entriesAtBottom = config.entriesPosition === 'bottom';

    const logsHtml = `
        ${logBlockHtml('ml_p', config.secondaryLog ? (config.primaryLogTitle || 'Entries') : 'Entries')}
        ${config.secondaryLog ? logBlockHtml('ml_s', config.secondaryLog.title) : ''}`;

    mount.innerHTML = `
      <div class="ml-top">
        <div class="doc-line">
          <span class="doc-code">${esc(config.docCode)}</span>
          <h1>${esc(config.title)}</h1>
          <span class="doc-rev" id="ml_docRev"></span>
        </div>
        <div class="ml-topline no-print">
          ${topAddEntry ? `<button class="ml-btn ml-btn-ghost" id="ml_topAddEntryBtn">+ Add entry</button>` : ''}
          ${showThresholds ? `<button class="ml-btn ml-btn-ghost" id="ml_thresholdsBtn">Thresholds</button>` : ''}
        </div>
      </div>
      <div class="ml-body">
        ${instructionsHtml}
        ${relatedHtml}
        ${entriesAtBottom ? verificationHtml + logsHtml : logsHtml + verificationHtml}
      </div>
      <div id="ml_thresholdsModal" class="ml-modal-overlay no-print" style="display:none;">
        <div class="ml-modal-inner">
          <h2>Thresholds</h2>
          <div class="ml-muted" style="margin-bottom:10px;">Document revision: <strong id="ml_docRevInModal"></strong></div>
          <table class="ml-table" id="ml_thresholdsTable"></table>
          <h3>Change attribution (required to save)</h3>
          <div class="ml-grid ml-grid-3">
            <label class="ml-field">Reason for this change<input id="ml_thReason"></label>
            <label class="ml-field">Your name<input id="ml_thChangedBy"></label>
            <label class="ml-field">Your title<input id="ml_thChangedByTitle"></label>
          </div>
          <div class="ml-actions">
            <button class="ml-btn ml-btn-flat" id="ml_thCancelBtn">Cancel</button>
            <button class="ml-btn ml-btn-primary" id="ml_thSaveBtn">Save thresholds</button>
          </div>
          <h3>Revision history</h3>
          <div class="ml-history-list" id="ml_docRevHistoryList"></div>
        </div>
      </div>
      <div class="ml-toast no-print" id="ml_toast"></div>
    `;

    // ---------- primary + optional secondary log controllers ----------
    const primary = makeLogController({
      ns: 'ml_p',
      title: config.title,
      entryFields: config.entryFields,
      storageKey: 'monitoring_log:' + config.recordKey,
      specGetter: () => currentSpec,
      toast,
      tableWrap: el('ml_p_table'),
      modalIds: { overlay: 'ml_p_modal', title: 'ml_p_modalTitle', fields: 'ml_p_modalFields' },
      deviationLabel: config.deviationLabel || 'Deviation',
      deviationPolarity: config.deviationPolarity || 'deviation',
      submitFlow
    });
    let secondary = null;
    if (config.secondaryLog) {
      secondary = makeLogController({
        ns: 'ml_s',
        title: config.secondaryLog.title,
        entryFields: config.secondaryLog.entryFields,
        storageKey: 'monitoring_log:' + config.recordKey + '__' + config.secondaryLog.key,
        specGetter: () => currentSpec,
        toast,
        tableWrap: el('ml_s_table'),
        modalIds: { overlay: 'ml_s_modal', title: 'ml_s_modalTitle', fields: 'ml_s_modalFields' },
        deviationLabel: config.secondaryLog.deviationLabel || 'Deviation',
        deviationPolarity: config.secondaryLog.deviationPolarity || 'deviation',
        submitFlow
      });
    }

    function wireLog(ctrl, ns) {
      el(`${ns}_addEntryBtn`).addEventListener('click', () => ctrl.openForm(null));
      el(`${ns}_cancelBtn`).addEventListener('click', () => ctrl.closeForm());
      el(`${ns}_saveBtn`).addEventListener('click', () => ctrl.saveForm(!submitFlow));
      if (submitFlow) el(`${ns}_submitBtn`).addEventListener('click', () => ctrl.saveForm(true));
      el(`${ns}_exportCsvBtn`).addEventListener('click', () => ctrl.exportCsv());
      el(`${ns}_exportJsonBtn`).addEventListener('click', () => ctrl.exportJson());
      el(`${ns}_printBtn`).addEventListener('click', () => ctrl.printPdf());
      ['filterFrom', 'filterTo', 'filterSearch', 'filterDevOnly'].forEach(suffix => {
        const inp = el(`${ns}_${suffix}`);
        inp.addEventListener('input', () => ctrl.renderTable());
      });
    }
    wireLog(primary, 'ml_p');
    if (secondary) wireLog(secondary, 'ml_s');
    if (topAddEntry) el('ml_topAddEntryBtn').addEventListener('click', () => primary.openForm(null));

    // ---------- thresholds modal ----------
    function buildThresholdsTable() {
      const fields = config.specFields || [];
      el('ml_thresholdsTable').innerHTML = `<thead><tr><th style="text-align:left;">Reading</th><th>Low</th><th>High</th></tr></thead><tbody>` +
        fields.map(f => `<tr><td style="text-align:left;">${esc(f.label)}${f.unit ? ` (${esc(f.unit)})` : ''}</td>
          <td><input type="number" step="0.01" id="ml_th_${f.key}_min"></td>
          <td><input type="number" step="0.01" id="ml_th_${f.key}_max"></td></tr>`).join('') + `</tbody>`;
    }
    function fillThresholdsForm() {
      (config.specFields || []).forEach(f => {
        const range = currentSpec ? currentSpec[f.key] : null;
        el(`ml_th_${f.key}_min`).value = (range && range.min != null) ? range.min : '';
        el(`ml_th_${f.key}_max`).value = (range && range.max != null) ? range.max : '';
      });
      el('ml_thReason').value = '';
      el('ml_thChangedBy').value = '';
      el('ml_thChangedByTitle').value = '';
    }
    async function openThresholds() {
      buildThresholdsTable();
      fillThresholdsForm();
      await renderDocRevBadge();
      await renderDocRevHistory();
      el('ml_thresholdsModal').style.display = 'flex';
    }
    async function saveThresholds() {
      const reason = el('ml_thReason').value.trim();
      const changedBy = el('ml_thChangedBy').value.trim();
      const changedByTitle = el('ml_thChangedByTitle').value.trim();
      const data = {};
      (config.specFields || []).forEach(f => {
        const min = num(el(`ml_th_${f.key}_min`).value);
        const max = num(el(`ml_th_${f.key}_max`).value);
        data[f.key] = (min === null && max === null) ? null : { min: min === null ? undefined : min, max: max === null ? undefined : max };
      });
      try {
        currentSpec = await SpecRegistry.proposeVersion(specKey, data, { changeReason: reason, publishedBy: changedBy, changedByTitle });
        const rev = await DocumentRevision.bump(docRevisionKey, { reason, changedBy, changedByTitle }, config.docRevisionStart || 1);
        await renderDocRevBadge();
        await renderDocRevHistory();
        primary.renderTable();
        if (secondary) secondary.renderTable();
        toast(`Thresholds saved — document is now Rev ${rev.revisionNumber}.`);
        el('ml_thresholdsModal').style.display = 'none';
      } catch (e) { toast(e.message); }
    }
    if (showThresholds) {
      el('ml_thresholdsBtn').addEventListener('click', openThresholds);
      el('ml_thCancelBtn').addEventListener('click', () => { el('ml_thresholdsModal').style.display = 'none'; });
      el('ml_thSaveBtn').addEventListener('click', saveThresholds);
    } else {
      el('ml_thresholdsModal').remove();
    }

    // ---------- verification strip ----------
    let refreshVerification = () => {};
    if (showVerification) {
      // config.verificationNotify = { intervalDays, recipients:[], message }
      // Opt-in: without it the strip behaves exactly as before.
      const notifyCfg = config.verificationNotify || null;

      // Flags a log that has entries but no (or a stale) verification, shows the banner
      // and fires one notification per page load. Delivery is a no-op until a transport
      // is registered -- see notify() at the top of this file.
      function checkVerificationDue(hist) {
        if (!notifyCfg) return;
        const notice = el('ml_verifyNotice');
        const last = hist.length ? hist[hist.length - 1] : null;
        const intervalDays = notifyCfg.intervalDays || 30;
        const lastMs = last ? (Date.parse(last.verifiedDate) || last.loggedAt) : null;
        const dueMs = lastMs == null ? null : lastMs + intervalDays * 86400000;
        const hasEntries = entryCountForVerification() > 0;

        let due = false, message = '';
        if (!hasEntries) due = false;
        else if (lastMs == null) {
          const n = entryCountForVerification();
          due = true;
          message = `Never verified — ${n} ${n === 1 ? 'entry is' : 'entries are'} awaiting verification.`;
        }
        else if (Date.now() > dueMs) {
          const daysOver = Math.floor((Date.now() - dueMs) / 86400000);
          due = true;
          message = `Verification overdue by ${daysOver} day${daysOver === 1 ? '' : 's'} (last verified ${esc(last.verifiedDate || '—')}, every ${intervalDays} days).`;
        }

        notice.innerHTML = due ? message : '';
        notice.classList.toggle('show', due);
        if (!due) return;

        notify({
          type: 'verification-due',
          recordKey: config.recordKey,
          docCode: config.docCode,
          title: config.title,
          message: notifyCfg.message || message,
          recipients: notifyCfg.recipients || [],
          dueSince: dueMs,
          meta: { lastVerifiedAt: lastMs, intervalDays, unverifiedEntries: entryCountForVerification() }
        });
      }

      function entryCountForVerification() {
        return primary.verifiableCount() + (secondary ? secondary.verifiableCount() : 0);
      }

      async function renderVerificationHistory() {
        const raw = await storeGet('verification_log:' + config.recordKey, true);
        let hist = [];
        try { hist = raw ? JSON.parse(raw) : []; } catch (e) { hist = []; }
        const target = el('ml_verificationHistory');
        checkVerificationDue(hist);
        if (!hist.length) { target.innerHTML = `<div class="ml-history-item ml-muted">No verification logged yet.</div>`; return; }
        target.innerHTML = hist.slice().reverse().map(v => `
          <div class="ml-history-item"><span>${esc(v.verifiedDate || '(no date)')} · ${esc(v.verifiedBy)} <span class="ml-muted">(signed: ${esc(v.verifiedSig)})</span></span></div>`).join('');
      }
      el('ml_saveVerificationBtn').addEventListener('click', async () => {
        const verifiedBy = el('ml_verifiedBy').value.trim();
        const verifiedSig = el('ml_verifiedSig').value.trim();
        const verifiedDate = el('ml_verifiedDate').value;
        if (!verifiedBy || !verifiedSig || !verifiedDate) { toast('Verified by, signature and date are all required.'); return; }
        const raw = await storeGet('verification_log:' + config.recordKey, true);
        let hist = [];
        try { hist = raw ? JSON.parse(raw) : []; } catch (e) { hist = []; }
        hist.push({ verifiedBy, verifiedSig, verifiedDate, loggedAt: Date.now() });
        await storeSet('verification_log:' + config.recordKey, JSON.stringify(hist), true);
        toast('Verification logged.');
        el('ml_verifiedBy').value = ''; el('ml_verifiedSig').value = ''; el('ml_verifiedDate').value = '';
        renderVerificationHistory();
      });
      // Deliberately not called here -- the due check counts entries, so it runs at the
      // end of boot once the logs have loaded.
      refreshVerification = renderVerificationHistory;
    }

    // ---------- boot ----------
    await renderDocRevBadge();
    await loadSpec();
    await primary.load();
    primary.renderTable();
    if (secondary) { await secondary.load(); secondary.renderTable(); }
    refreshVerification();
  }

  window.MonitoringLog = { init };
})();

