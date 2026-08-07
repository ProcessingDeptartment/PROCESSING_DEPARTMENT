/*
 * Shared engine for "single-event structured form" online records -- the family of
 * paper forms that are filled once per incident/event/batch rather than accumulating
 * daily table rows (Internal CAR, Disposition Investigation, Training Register,
 * Supplier Questionnaire, Traceability & Mock Recall Checklists, etc.). Sits alongside
 * monitoring-log.js (see public/lib/monitoring-log.js) which covers the other shape --
 * periodic date/shift entry logs.
 *
 * A page calls FormRecord.init(config) once. Config declares one or more field
 * `sections` (grouped fields shown together in the form) and an optional `roster`
 * block (a repeatable sub-table, e.g. a training attendee list). Each save is one
 * whole submission, browsable in a list (not a wide table of columns like
 * monitoring-log, since a submission has far more fields than fit as columns).
 *
 * Reuses the same shared libs as monitoring-log.js:
 *  - data-store.js       window.storage.get/set(key, shared).  Submissions live under
 *                        'formrecord:<recordKey>'.
 *  - document-revision.js  the record TEMPLATE's own revision badge. Unlike
 *                        monitoring-log/double-seam there is no in-app editing flow
 *                        that bumps it (no spec/tolerances here) -- it just displays
 *                        config.docRevisionStart as a read-only badge.
 * Deliberately skips spec-registry.js (no numeric tolerances in this shape) and
 * permission-rules.js (role-gated login is deferred -- see memory).
 *
 * === SWAP POINT for hardware/AI ingestion ===
 * Every submission carries `source` ('manual' today), exactly like monitoring-log.js,
 * so a future automated feed (e.g. an auto-generated QC/NRCS report) can write into
 * the same array with source:'device' without a schema change. No such endpoint
 * exists yet; this comment marks where it plugs in.
 */
(function () {
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function uid(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function safeKey(s) { return String(s || '').trim().replace(/[\s\/\\'"]+/g, '_'); }

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  const STYLE = `
  .fr-app{ font-family:'Segoe UI',system-ui,sans-serif; color:var(--palette-ink,#1b2330); background:var(--palette-paper,#f4f5f3); font-size:13px; line-height:1.4; }
  .fr-app *{ box-sizing:border-box; }
  .fr-app h1,.fr-app h2,.fr-app h3{ margin:0; font-weight:700; }
  .fr-app input,.fr-app select,.fr-app textarea{
    font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; font-size:12.5px; border:1px solid #c9cdd1; border-radius:3px;
    padding:5px 7px; background:#fff; color:var(--palette-ink,#1b2330); width:100%;
  }
  .fr-app input:focus,.fr-app select:focus,.fr-app textarea:focus{ outline:2px solid var(--palette-focus,#2f4356); outline-offset:-1px; }
  .fr-app button{ font-family:'Segoe UI',system-ui,sans-serif; cursor:pointer; border:none; border-radius:3px; font-weight:600; }
  .fr-top{ background:var(--palette-dark,#1d2b38); color:var(--palette-dark-text,#f4f1e8); padding:14px 18px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
  .fr-btn{ padding:7px 13px; font-size:12.5px; }
  .fr-btn-primary{ background:var(--palette-primary,#c9832b); color:var(--palette-primary-text,#241a0a); }
  .fr-btn-primary:hover{ background:var(--palette-primary-hover,#dd9536); }
  .fr-btn-flat{ background:#e2e4e3; color:#1b2330; }
  .fr-btn-flat:hover{ background:#d5d8d6; }
  .fr-btn:disabled{ opacity:.45; cursor:not-allowed; }
  .fr-btn-sm{ padding:4px 10px; font-size:10.5px; }
  .fr-body{ padding:16px 18px 60px; max-width:1400px; margin:0 auto; }
  .fr-panel{ background:#fff; border:1px solid var(--palette-border,#e2e4e3); border-radius:6px; margin-bottom:14px; }
  .fr-panel-head{ padding:9px 14px; border-bottom:1px solid var(--palette-border,#e2e4e3); display:flex; justify-content:space-between; align-items:center; background:var(--palette-head-bg,#fbfbfa); border-radius:6px 6px 0 0; gap:10px; flex-wrap:wrap; }
  .fr-panel-head h2{ font-size:12.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--palette-heading,#2f4356); }
  .fr-panel-body{ padding:14px; }
  .fr-instructions{ display:grid; gap:8px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .fr-instructions .instr-item{ background:var(--palette-head-bg,#fbfbfa); border:1px solid var(--palette-border,#e2e4e3); border-radius:4px; padding:8px 10px; }
  .fr-instructions .instr-item strong{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--palette-label,#54606b); margin-bottom:3px; }
  .fr-grid{ display:grid; gap:10px; }
  .fr-grid-2{ grid-template-columns:repeat(2,1fr); }
  .fr-grid-3{ grid-template-columns:repeat(3,1fr); }
  .fr-grid-4{ grid-template-columns:repeat(4,1fr); }
  .fr-field{ display:flex; flex-direction:column; gap:3px; font-size:11.5px; color:var(--palette-label,#54606b); font-weight:600; }
  .fr-field.wide{ grid-column:1/-1; }
  .fr-filters{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
  .fr-filters input[type=date]{ width:auto; }
  .fr-filters input[type=text]{ max-width:220px; }
  table.fr-table{ width:100%; border-collapse:collapse; }
  table.fr-table th,table.fr-table td{ border:1px solid var(--palette-border,#e2e4e3); padding:5px 7px; text-align:left; vertical-align:middle; font-size:11.5px; }
  table.fr-table th{ background:var(--palette-head-bg,#fbfbfa); font-size:10.5px; text-transform:uppercase; letter-spacing:.03em; color:var(--palette-label,#54606b); font-weight:700; white-space:nowrap; }
  .fr-muted{ color:#8a939b; }
  .fr-empty{ padding:18px; text-align:center; color:#8a939b; }
  .fr-badge{ display:inline-block; padding:1px 7px; border-radius:9px; font-size:10px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; background:#eceeef; color:#54606b; white-space:nowrap; }
  .fr-badge-ok{ background:var(--palette-ok-bg,#e4f0e6); color:var(--palette-ok,#2f6b3a); }
  .fr-badge-fail{ background:var(--palette-fail-bg,#fbe8e6); color:var(--palette-fail,#a3352d); }
  .fr-locked{ padding:8px 11px; margin-bottom:10px; border-left:3px solid var(--palette-ok,#2f6b3a); background:var(--palette-ok-bg,#e4f0e6); color:var(--palette-ok,#2f6b3a); font-size:11.5px; font-weight:600; }
  .fr-notice{ display:none; padding:8px 12px; border-radius:4px; font-size:11.5px; font-weight:600; margin-bottom:10px; }
  .fr-notice.show{ display:block; }
  .fr-notice-due{ background:var(--palette-fail-bg,#fbe8e6); color:var(--palette-fail,#a3352d); border:1px solid #e8b8b3; }
  .fr-history-list{ max-height:220px; overflow:auto; border:1px solid var(--palette-border,#e2e4e3); border-radius:4px; }
  .fr-history-item{ padding:7px 10px; border-bottom:1px solid var(--palette-border,#e2e4e3); display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:11.5px; }
  .fr-history-item:last-child{ border-bottom:none; }
  .fr-section-title{ font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--palette-label,#54606b); margin:14px 0 8px; }
  .fr-section-title:first-child{ margin-top:0; }
  .fr-roster-row{ display:flex; gap:8px; align-items:flex-end; margin-bottom:6px; }
  .fr-roster-row .fr-field{ flex:1; }
  .fr-modal-overlay{ position:fixed; inset:0; background:rgba(20,25,30,.5); z-index:500; align-items:center; justify-content:center; }
  .fr-modal-inner{ background:#fff; border-radius:8px; width:min(880px,94vw); max-height:90vh; overflow:auto; padding:16px; }
  .fr-modal-inner h2{ font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--palette-heading,#2f4356); margin-bottom:10px; }
  .fr-actions{ display:flex; gap:10px; justify-content:flex-end; margin-top:10px; flex-wrap:wrap; align-items:center; }
  .fr-toast{ position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:var(--palette-dark,#1d2b38); color:#fff; padding:9px 18px; border-radius:20px; font-size:12px; z-index:999; opacity:0; pointer-events:none; transition:opacity .25s; }
  .fr-toast.show{ opacity:1; }
  /* Submission list can carry more columns than a phone is wide -- scroll it
     inside the panel rather than letting it stretch the page. */
  .fr-table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
  @media (max-width:1024px){
    .fr-grid-3{ grid-template-columns:repeat(2,1fr); }
    .fr-grid-4{ grid-template-columns:repeat(2,1fr); }
    .fr-body{ padding:14px 14px 60px; }
  }
  @media (max-width:900px){ .fr-grid-2,.fr-grid-3,.fr-grid-4{grid-template-columns:1fr;} }
  @media (max-width:768px){
    .fr-top{ padding:10px 12px; gap:10px; }
    .fr-body{ padding:10px 12px 60px; }
    .fr-panel-head{ padding:8px 10px; }
    .fr-panel-body{ padding:10px; }
    /* >=16px stops iOS Safari zooming the page on focus. Inputs inside the
       submissions table stay compact -- that table scrolls instead. */
    .fr-app input,.fr-app select,.fr-app textarea{ font-size:16px; padding:8px; }
    .fr-app table.fr-table input,.fr-app table.fr-table select,.fr-app table.fr-table textarea{ font-size:13px; padding:4px; }
    .fr-btn{ min-height:40px; }
    .fr-btn-sm{ min-height:32px; padding:6px 10px; font-size:11.5px; }
    .fr-filters{ gap:6px; }
    .fr-filters label,.fr-filters input[type=text]{ flex:1 1 140px; max-width:none; }
    .fr-filters input[type=date]{ width:100%; }
    /* Roster rows are a horizontal strip of inputs on desktop; on a phone they
       stack, with the remove button on its own full-width line. */
    .fr-roster-row{ flex-direction:column; align-items:stretch; gap:6px; padding:8px; border:1px solid var(--palette-border,#e2e4e3); border-radius:4px; margin-bottom:8px; }
    .fr-roster-row .fr-btn-sm{ align-self:flex-end; }
    .fr-modal-inner{ width:100vw; max-width:100vw; min-height:100vh; max-height:100vh; border-radius:0; padding:14px; }
    .fr-actions{ justify-content:flex-start; }
    .fr-actions .fr-btn{ flex:1 1 auto; }
  }
  @media (max-width:480px){
    .fr-top{ padding:8px 10px; }
    .fr-body{ padding:8px 10px 60px; }
    .fr-panel-body{ padding:8px; }
    .fr-filters label,.fr-filters input[type=text]{ flex:1 1 100%; }
    .fr-actions .fr-btn{ flex:1 1 100%; }
    .fr-actions .fr-btn-sm{ flex:0 1 auto; }
  }
  /* Print sheet: one submission laid out as the paper form. Hidden on screen; the
     whole on-screen app is swapped out for it while printing. */
  .fr-sheet{ display:none; color:#000; font-family:'Segoe UI',system-ui,sans-serif; font-size:14px; }
  .fr-sheet .fr-sheet-page{ page-break-after:always; }
  .fr-sheet .fr-sheet-page:last-child{ page-break-after:auto; }
  .fr-sheet h3{ font-size:14px; text-transform:uppercase; letter-spacing:.05em; margin:9px 0 4px; font-weight:700; }
  .fr-sheet h3:first-child{ margin-top:0; }
  .fr-sheet table{ width:100%; border-collapse:collapse; margin-bottom:7px; }
  .fr-sheet td,.fr-sheet th{ border:1px solid #000; padding:3px 5px; vertical-align:top; text-align:left; font-size:14px; }
  .fr-sheet th{ background:#eee; font-weight:700; }
  .fr-sheet td.fr-sheet-lbl{ font-weight:700; width:26%; }
  .fr-sheet .fr-sheet-sign td{ height:26px; }
  .fr-sheet .fr-sheet-sign td.fr-sheet-lbl{ width:13%; }
  @media print{
    @page{ size:A4; margin:12mm; }
    body{ background:#fff; }
    .no-print{ display:none !important; }
    .fr-top{ display:none !important; }
    .fr-app{ font-size:10px; }
    .fr-table-wrap{ overflow:visible !important; }
    /* Printing swaps the app for the filled sheets -- the on-screen body is a
       submissions browser (filters, list, buttons), none of which is the record. */
    body.fr-printing .fr-body{ display:none !important; }
    body.fr-printing .fr-sheet{ display:block; }
  }
  /* Yes/No button group styles copied from monitoring-log.js to match appearance */
  .ml-yesno{ display:flex; gap:10px; }
  .ml-yesno button{ flex:1; padding:7px 10px; font-size:12px; border:1px solid #c9cdd1 !important; background:#fff; color:#54606b; }
  .ml-yesno button:hover:not(:disabled){ border-color:#8a939b !important; }
  /* Which answer is "good" (green) vs "bad" (red) varies by question -- set via
     data-good="Yes"|"No" on the .ml-yesno span (defaults to Yes when absent). */
  .ml-yesno[data-good="Yes"] button.on[data-v="Yes"], .ml-yesno[data-good="No"] button.on[data-v="No"], .ml-yesno:not([data-good]) button.on[data-v="Yes"]{ background:var(--palette-ok-bg,#e8f3ec); border-color:var(--palette-ok,#2f7a52) !important; color:var(--palette-ok,#2f7a52); }
  .ml-yesno[data-good="Yes"] button.on[data-v="No"], .ml-yesno[data-good="No"] button.on[data-v="Yes"], .ml-yesno:not([data-good]) button.on[data-v="No"]{ background:var(--palette-fail-bg,#fbe8e6); border-color:var(--palette-fail,#a3352d) !important; color:var(--palette-fail,#a3352d); }
  .ml-yesno button:disabled{ opacity:.55; cursor:not-allowed; }`;

  function injectStyleOnce() {
    if (document.getElementById('fr-style')) return;
    const s = document.createElement('style');
    s.id = 'fr-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  async function storeGet(key, shared) {
    try { const r = await window.storage.get(key, shared); return r ? r.value : null; } catch (e) { return null; }
  }
  async function storeSet(key, value, shared) {
    try { await window.storage.set(key, value, shared); return true; } catch (e) { console.error('storage set failed', e); return false; }
  }

  function fieldInputHtml(id, field, value) {
    const v = value == null ? '' : value;
      if (field.type === 'yesno') {
        return `<span class="ml-yesno" data-yesno-for="${id}" data-good="${field.good === 'No' ? 'No' : 'Yes'}">
            <button type="button" data-v="Yes" class="${v === 'Yes' ? 'on' : ''}">Y</button>
            <button type="button" data-v="No" class="${v === 'No' ? 'on' : ''}">N</button>
            <input type="hidden" id="${id}" value="${esc(v)}">
          </span>`;
      }
      if (field.type === 'select') {
        const opts = ['', ...(field.options || [])];
        // Keep a stored value that is no longer an option (e.g. an option list
        // that was since renamed) so old records still show what was captured.
        if (v !== '' && opts.indexOf(v) === -1) opts.push(v);
        return `<select id="${id}">${opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${o === '' ? '—' : esc(o)}</option>`).join('')}</select>`;
      }
      if (field.type === 'textarea') return `<textarea id="${id}" rows="3">${esc(v)}</textarea>`;
      if (field.type === 'number') return `<input type="number" step="0.01" id="${id}" value="${esc(v)}">`;
      if (field.type === 'date') return `<input type="date" id="${id}" value="${esc(v)}">`;
      return `<input type="text" id="${id}" value="${esc(v)}">`;
    }

    // Clicking a Yes/No button writes the hidden input and re-fires 'input' so anything
    // listening for a normal field change (computed fields) still sees it. Clicking the
    // active choice again clears it -- there is no other way back to "not answered".
    function wireYesNo(container) {
      container.querySelectorAll('.ml-yesno').forEach(group => {
        const hidden = group.querySelector('input[type=hidden]');
        group.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const next = btn.dataset.v;
            hidden.value = next;
            group.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === next));
            hidden.dispatchEvent(new Event('input', { bubbles: true }));
          });
        });
      });
    }

  function allFields(config) {
    const fields = [];
    (config.sections || []).forEach(sec => (sec.fields || []).forEach(f => fields.push(f)));
    return fields;
  }

  async function init(config) {
    // Require authentication before showing the record
    if (window.LoginUI) {
      await window.LoginUI.ensureAuthenticated();
    }

    injectStyleOnce();
    const mount = typeof config.mount === 'string' ? document.querySelector(config.mount) : config.mount;
    mount.classList.add('fr-app');

    function toast(msg) {
      const t = el('fr_toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2200);
    }

    const storageKey = 'formrecord:' + config.recordKey;
    let submissions = [];
    let editingId = null;
    const hasRoster = !!config.roster;

    async function load() {
      const raw = await storeGet(storageKey, true);
      try { submissions = raw ? JSON.parse(raw) : []; } catch (e) { submissions = []; }
    }
    async function persist() { return storeSet(storageKey, JSON.stringify(submissions), true); }

    /* Reads the resolved title block rather than resolving the revision a second time --
     * it used to pass a baseline date no record sets, so it always said "not set" while
     * the block beside it printed the real date off the Master Index. */
    function renderDocBadge() {
      el('fr_docRev').textContent =
        window.DocHeader.badgeText(config.recordKey, config.docRevisionStart);
    }

    const instructionsHtml = (config.instructions || []).length ? `
      <div class="fr-panel no-print"><div class="fr-panel-head"><h2>Work instructions</h2></div>
        <div class="fr-panel-body fr-instructions">
          ${config.instructions.map(i => `<div class="instr-item"><strong>${esc(i.label)}</strong>${esc(i.text)}</div>`).join('')}
        </div></div>` : '';

    const relatedHtml = (config.relatedLinks || []).length ? `
      <div class="fr-panel no-print"><div class="fr-panel-body">
        ${config.relatedLinks.map(l => `<a href="${esc(l.href)}">→ ${esc(l.label)}</a>`).join('<br>')}
      </div></div>` : '';

    const listCols = config.listColumns || [];
    function labelFor(key) {
      const f = allFields(config).find(x => x.key === key);
      return f ? f.label : key;
    }

    // On by default -- every controlled record needs a verification step -- so a
    // record opts OUT with showVerificationStrip:false rather than opting in.
    const showVerification = config.showVerificationStrip !== false;
    const verificationHtml = showVerification ? `
        <div class="fr-panel no-print">
          <div class="fr-panel-head"><h2>Verification</h2></div>
          <div class="fr-panel-body">
            <div class="fr-notice fr-notice-due" id="fr_verifyNotice"></div>
            <h3 class="fr-section-title" style="margin-top:0;">Entries to verify</h3>
            <div class="fr-history-list" id="fr_verifySelect" style="margin-bottom:10px;"></div>
            ${window.SignOffBlock.verifyFieldsHtml({ idPrefix: 'fr_verified', gridClass: 'fr-grid fr-grid-4', fieldClass: 'fr-field' })}
            <div class="fr-actions" style="justify-content:flex-start; margin-top:0;">
              <button class="fr-btn fr-btn-primary fr-btn-sm" id="fr_saveVerificationBtn">Log verification</button>
            </div>
            <h3 class="fr-section-title">Verification history</h3>
            <div class="fr-history-list" id="fr_verificationHistory"></div>
          </div>
        </div>` : '';

    mount.innerHTML = `
      <div class="fr-top">
        <div class="doc-line">
          <span class="doc-code">${esc(config.docCode)}</span>
          <h1>${esc(config.title)}</h1>
          <span class="doc-rev" id="fr_docRev"></span>
        </div>
      </div>
      <div class="fr-body">
        ${instructionsHtml}
        ${relatedHtml}
        <div class="fr-panel no-print">
          <div class="fr-panel-head">
            <h2>Submissions</h2>
            <button class="fr-btn fr-btn-primary fr-btn-sm" id="fr_addBtn">+ New</button>
          </div>
          <div class="fr-panel-body">
            <div class="fr-filters">
              <label>From <input type="date" id="fr_filterFrom"></label>
              <label>To <input type="date" id="fr_filterTo"></label>
              <input type="text" id="fr_filterSearch" placeholder="Search submissions…">
              <button class="fr-btn fr-btn-flat fr-btn-sm" id="fr_exportJsonBtn">Export JSON</button>
              <button class="fr-btn fr-btn-flat fr-btn-sm" id="fr_printBtn">Print</button>
            </div>
            <div id="fr_table" class="fr-table-wrap"></div>
          </div>
        </div>
        ${verificationHtml}
      </div>
      <div id="fr_printSheet" class="fr-sheet"></div>
      <div id="fr_modal" class="fr-modal-overlay no-print" style="display:none;">
        <div class="fr-modal-inner">
          <h2 id="fr_modalTitle">New submission</h2>
          <div id="fr_modalSections"></div>
          <div class="fr-actions">
            <button class="fr-btn fr-btn-flat" id="fr_cancelBtn">Cancel</button>
            <button class="fr-btn fr-btn-flat" id="fr_saveBtn">Save draft</button>
            <button class="fr-btn fr-btn-primary" id="fr_submitBtn">Submit</button>
          </div>
        </div>
      </div>
      <div class="fr-toast no-print" id="fr_toast"></div>
    `;

    /* Submissions saved before the draft/submit lifecycle existed carry no `status`.
     * They are read as SUBMITTED -- the same call monitoring-log.js makes -- because they
     * were saved through a single "Save" button with no draft to come back to, and the
     * old code signed each one off as 'submitted'. They lock like any other submitted
     * record; a correction is a new submission, not a silent edit. */
    function isSubmitted(sub) { return !!sub && (sub.status == null || sub.status === 'submitted'); }

    function dateOf(values) {
      const dateField = allFields(config).find(f => f.type === 'date');
      return dateField ? (values[dateField.key] || '') : '';
    }

    function filtered() {
      const from = el('fr_filterFrom').value;
      const to = el('fr_filterTo').value;
      const search = el('fr_filterSearch').value.trim().toLowerCase();
      return submissions.filter(s => {
        const d = dateOf(s.values);
        if (from && d && d < from) return false;
        if (to && d && d > to) return false;
        if (search) {
          const hay = JSON.stringify(s.values).toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      }).sort((a, b) => (dateOf(b.values) || '').localeCompare(dateOf(a.values) || '') || b.createdAt - a.createdAt);
    }

    function renderTable() {
      const list = filtered();
      const wrap = el('fr_table');
      if (!list.length) {
        wrap.innerHTML = `<div class="fr-empty">No submissions yet${submissions.length ? ' matching these filters' : ''}.</div>`;
        return;
      }
      const cols = listCols.length ? listCols : allFields(config).slice(0, 4).map(f => f.key);
      /* Status and the open button are screen-only affordances -- a printed controlled
       * copy should carry the captured values, not the app's draft/submitted workflow
       * state or a button. Header and cell are both tagged so columns stay aligned. */
      let html = `<table class="fr-table"><thead><tr>${cols.map(k => `<th>${esc(labelFor(k))}</th>`).join('')}<th class="no-print">Status</th><th class="no-print"></th></tr></thead><tbody>`;
      list.forEach(sub => {
        html += `<tr>`;
        cols.forEach(k => {
          let v = sub.values[k];
          if (v === '' || v == null) v = '—';
          html += `<td>${esc(v)}</td>`;
        });
        html += `<td class="no-print">${sub.verification
          ? '<span class="fr-badge fr-badge-ok">✓ Verified</span>'
          : isSubmitted(sub)
            ? '<span class="fr-badge fr-badge-ok">✓ Submitted</span>'
            : '<span class="fr-badge">Draft</span>'}</td>`;
        html += `<td class="no-print" style="white-space:nowrap;">
          <button class="fr-btn fr-btn-flat fr-btn-sm" data-open="${sub.id}">${isSubmitted(sub) ? 'View' : 'Open'}</button>
          <button class="fr-btn fr-btn-flat fr-btn-sm" data-pdf="${sub.id}" title="Print this submission as the paper form">PDF</button>
        </td>`;
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      wrap.innerHTML = html;
      wrap.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openForm(btn.dataset.open)));
      wrap.querySelectorAll('[data-pdf]').forEach(btn => btn.addEventListener('click', () => printSubmission(btn.dataset.pdf)));
    }

    function rosterRowHtml(ns, idx, row) {
      row = row || {};
      return `<div class="fr-roster-row" data-roster-row="${idx}">
        ${config.roster.columns.map(c => `<label class="fr-field">${esc(c.label)}
          ${fieldInputHtml(`${ns}_roster_${idx}_${c.key}`, c, row[c.key])}
        </label>`).join('')}
        <button type="button" class="fr-btn fr-btn-flat fr-btn-sm" data-remove-roster-row="${idx}">✕</button>
      </div>`;
    }

    function renderRosterEditor(existingRows) {
      const container = el('fr_rosterRows');
      let rows = (existingRows || []).slice();
      if (!rows.length) rows.push({});
      function draw() {
        container.innerHTML = rows.map((r, i) => rosterRowHtml('fr', i, r)).join('');
              // Wire Yes/No button groups inside roster rows
              if (typeof wireYesNo === 'function') wireYesNo(container);
              container.querySelectorAll('[data-remove-roster-row]').forEach(btn => {
                btn.addEventListener('click', () => {
                  const i = Number(btn.dataset.removeRosterRow);
                  rows.splice(i, 1);
                  if (!rows.length) rows.push({});
                  draw();
                });
              });
            }
      draw();
      container._getRows = () => {
        // capture current input values before returning
        rows = rows.map((_, i) => {
          const row = {};
          config.roster.columns.forEach(c => {
            const inp = el(`fr_roster_${i}_${c.key}`);
            row[c.key] = inp ? inp.value : '';
          });
          return row;
        });
        return rows;
      };
      container._addRow = () => {
        // sync existing inputs into `rows` before appending a blank one
        rows = rows.map((_, i) => {
          const row = {};
          config.roster.columns.forEach(c => {
            const inp = el(`fr_roster_${i}_${c.key}`);
            row[c.key] = inp ? inp.value : '';
          });
          return row;
        });
        rows.push({});
        draw();
      };
    }

    function openForm(id) {
      editingId = id || null;
      const existing = id ? submissions.find(s => s.id === id) : null;
      const locked = isSubmitted(existing);
      el('fr_modalTitle').textContent = !id ? 'New submission'
        : (locked ? 'Submitted submission (read-only)' : 'Edit submission');
      const container = el('fr_modalSections');
      let html = locked
        ? `<div class="fr-locked">Submitted${existing.submittedAt
            ? ' on ' + new Date(existing.submittedAt).toLocaleString() : ''} — this submission can no longer be changed.</div>`
        : '';
      html += (config.sections || []).map(sec => `
        <div class="fr-section-title">${esc(sec.title)}</div>
        <div class="fr-grid fr-grid-2">
          ${sec.fields.map(f => `<label class="fr-field${f.wide ? ' wide' : ''}">${esc(f.label)}
            ${fieldInputHtml(`fr_f_${f.key}`, f, existing ? existing.values[f.key] : (f.default || ''))}
          </label>`).join('')}
        </div>`).join('');
      if (hasRoster) {
        html += `
        <div class="fr-section-title">${esc(config.roster.title)}</div>
        <div id="fr_rosterRows"></div>
        <button type="button" class="fr-btn fr-btn-flat fr-btn-sm" id="fr_addRosterRowBtn">+ Add row</button>`;
      }
      container.innerHTML = html;
      if (hasRoster) {
        renderRosterEditor(existing ? existing.roster : null);
        el('fr_addRosterRowBtn').addEventListener('click', () => container.querySelector('#fr_rosterRows')._addRow());
      }
      // Wire Yes/No button groups in the modal
      if (typeof wireYesNo === 'function') wireYesNo(container);
      // A submitted record is evidence -- it opens to be read, never to be re-typed.
      container.querySelectorAll('input,select,textarea,button').forEach(i => { i.disabled = locked; });
      el('fr_saveBtn').style.display = locked ? 'none' : '';
      el('fr_submitBtn').style.display = locked ? 'none' : '';
      el('fr_cancelBtn').textContent = locked ? 'Close' : 'Cancel';
      el('fr_modal').style.display = 'flex';
    }
    function closeForm() { el('fr_modal').style.display = 'none'; }

    /* finalize=false saves a draft, finalize=true submits. A draft is a part-filled shift
     * that someone comes back to, so required fields are only enforced on submit -- the
     * same rule monitoring-log.js applies. */
    async function saveForm(finalize) {
      const values = {};
      let missingRequired = null;
      allFields(config).forEach(f => {
        const inp = el(`fr_f_${f.key}`);
        values[f.key] = inp ? inp.value : '';
        if (f.required && !String(values[f.key] || '').trim()) missingRequired = f.label;
      });
      if (missingRequired && finalize) { toast(`"${missingRequired}" is required.`); return; }
      // Validate batch number format if this record has a batchField
      if (config.batchField && window.BatchValidation) {
        const batchValue = values[config.batchField];
        if (batchValue && !window.BatchValidation.isValid(batchValue)) {
          toast(window.BatchValidation.formatError());
          return;
        }
      }
      const rosterRows = hasRoster ? el('fr_rosterRows')._getRows() : undefined;

      const status = finalize ? 'submitted' : 'draft';
      let savedSub;
      if (editingId) {
        const existing = submissions.find(s => s.id === editingId);
        if (isSubmitted(existing)) { toast('This submission is submitted and can no longer be changed.'); return; }
        existing.history = existing.history || [];
        existing.history.push({ ts: Date.now(), previousValues: existing.values, previousRoster: existing.roster });
        existing.values = values;
        if (hasRoster) existing.roster = rosterRows;
        existing.updatedAt = Date.now();
        existing.status = status;
        if (finalize) existing.submittedAt = Date.now();
        savedSub = existing;
      } else {
        const sub = {
          id: uid('sub'),
          values,
          status,
          source: 'manual', // future automated feeds set 'device' here
          createdAt: Date.now(),
          updatedAt: Date.now(),
          history: [],
          signOffs: []
        };
        if (finalize) sub.submittedAt = Date.now();
        if (hasRoster) sub.roster = rosterRows;
        submissions.push(sub);
        savedSub = sub;
      }
      // Sign-off records the action that was actually taken. It used to log 'submitted'
      // on every save, back when a save was the only action there was.
      if (window.Auth && window.Auth.isAuthenticated()) {
        const signOff = window.Auth.createSignOff(status);
        if (signOff && savedSub.signOffs) {
          savedSub.signOffs.push(signOff);
        }
      }
      const ok = await persist();
      if (!ok) { toast('Save failed — please retry.'); return; }
      // Best-effort batch traceability index (only if this record declares a batchField).
      if (window.Traceability && config.batchField) window.Traceability.indexSubmission(config, savedSub);
      closeForm();
      renderTable();
      // Submitting adds it to the verifier's pick list, so that has to redraw too.
      refreshVerification();
      toast(finalize ? 'Submitted for verification.' : 'Draft saved.');
    }

    /* Full-fidelity export: keeps edit history, sign-offs and timestamps that the printed
     * form drops, so a submission round-trips into the future backend. Exports what the
     * filters currently show, which is what the person is looking at. */
    function exportJson() {
      const list = filtered();
      const payload = {
        record: config.title,
        docCode: config.docCode,
        recordKey: config.recordKey,
        exportedAt: new Date().toISOString(),
        submissionCount: list.length,
        submissions: list
      };
      download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        safeKey(config.title) + '_' + new Date().toISOString().slice(0, 10) + '.json');
    }

    /* ---- printed output: one submission = one sheet of the paper form ----
     *
     * The on-screen body is a submissions BROWSER (filters, list, row buttons), so it is
     * all no-print -- which left window.print() emitting a page carrying nothing but the
     * controlled-copy header. The captured values were never on the printed page at all.
     * These build the actual form, the same way monitoring-log.js builds ml-sheet.
     *
     * The sheet deliberately does not restate document name/number/revision: the
     * controlled-copy block from doc-header.js already prints those at the top. */

    function displayValue(field, raw) {
      if (raw === '' || raw == null) return '';
      if (field && field.type === 'date') return window.DocHeader.fmtDate(raw);
      return String(raw);
    }

    function sheetSectionsHtml(sub) {
      return (config.sections || []).map(sec => {
        const rows = (sec.fields || []).map(f =>
          `<tr><td class="fr-sheet-lbl">${esc(f.label)}${f.unit ? ' (' + esc(f.unit) + ')' : ''}</td>
             <td>${esc(displayValue(f, sub.values[f.key]))}</td></tr>`).join('');
        if (!rows) return '';
        return `<h3>${esc(sec.title)}</h3><table><tbody>${rows}</tbody></table>`;
      }).join('');
    }

    function sheetRosterHtml(sub) {
      if (!hasRoster) return '';
      const cols = config.roster.columns || [];
      const rows = (sub.roster || []).filter(r =>
        cols.some(c => String(r[c.key] || '').trim() !== ''));
      // An empty roster still prints its ruled grid -- the paper form has blank lines to
      // sign on, and a printed copy is often completed by hand.
      const body = (rows.length ? rows : [{}, {}, {}]).map(r =>
        `<tr>${cols.map(c => `<td>${esc(displayValue(c, r[c.key]))}</td>`).join('')}</tr>`).join('');
      return `<h3>${esc(config.roster.title)}</h3>
        <table><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody></table>`;
    }

    /* Signature line. A draft prints an empty one: an unsubmitted form is not evidence,
     * and pre-printing a name beside "Signature" would assert a sign-off nobody made. */
    function sheetSignHtml(sub) {
      const done = isSubmitted(sub);
      const signOff = (sub.signOffs || []).filter(s => s.action === 'submitted').slice(-1)[0];
      const who = done && signOff ? (signOff.by || '') : '';
      const when = done && sub.submittedAt
        ? window.DocHeader.fmtDate(new Date(sub.submittedAt)) : '';
      return `<table class="fr-sheet-sign"><tbody>
        <tr><td class="fr-sheet-lbl">Completed by:</td><td>${esc(who)}</td>
            <td class="fr-sheet-lbl">Title:</td><td></td>
            <td class="fr-sheet-lbl">Date:</td><td>${esc(when)}</td>
            <td class="fr-sheet-lbl">Signature:</td><td></td></tr>
        <tr><td class="fr-sheet-lbl">Verified by:</td><td>${esc(sub.verification ? sub.verification.verifiedBy : '')}</td>
            <td class="fr-sheet-lbl">Title:</td><td>${esc(sub.verification ? sub.verification.verifiedSig : '')}</td>
            <td class="fr-sheet-lbl">Date:</td><td>${esc(sub.verification ? sub.verification.verifiedDate : '')}</td>
            <td class="fr-sheet-lbl">Signature:</td><td>${esc(sub.verification ? sub.verification.verifiedSignature : '')}</td></tr>
      </tbody></table>`;
    }

    function buildSheet(sub) {
      return `<div class="fr-sheet-page">
        ${sheetSectionsHtml(sub)}${sheetRosterHtml(sub)}${sheetSignHtml(sub)}
      </div>`;
    }

    function withPrintTitle(name, fn) {
      const previousTitle = document.title;
      document.title = name; // browsers use the document title as the PDF filename
      try { fn(); } finally { document.title = previousTitle; }
    }

    function printSheets(list, filename) {
      if (!list.length) { toast('Nothing to print — no submissions match these filters.'); return; }
      el('fr_printSheet').innerHTML = list.map(buildSheet).join('');
      document.body.classList.add('fr-printing');
      try { withPrintTitle(filename, () => window.print()); }
      finally { document.body.classList.remove('fr-printing'); }
    }

    // The toolbar button prints what the filters currently show, matching Export JSON.
    function printPdf() {
      printSheets(filtered(),
        safeKey(config.title) + '_' + new Date().toISOString().slice(0, 10));
    }

    function printSubmission(id) {
      const sub = submissions.find(s => s.id === id);
      if (!sub) return;
      const stamp = dateOf(sub.values) || new Date(sub.createdAt).toISOString().slice(0, 10);
      printSheets([sub], safeKey(config.docCode) + '_' + safeKey(config.title) + '_' + safeKey(stamp));
    }

    // ---------- verification strip ----------
    // Mirrors monitoring-log.js's verification strip: the verifier signs off named
    // submissions, not "the record" in the abstract, so they pick exactly which
    // submitted entries this signature covers.
    let refreshVerification = () => {};
    if (showVerification) {
      function pendingForVerification() {
        return submissions.filter(s => isSubmitted(s) && !s.verification);
      }

      function renderVerifySelect() {
        const target = el('fr_verifySelect');
        if (!target) return;
        const pending = pendingForVerification();
        if (!pending.length) {
          target.innerHTML = `<div class="fr-history-item fr-muted">No submitted entries are waiting to be verified.</div>`;
          return;
        }
        target.innerHTML = `<div class="fr-history-item"><label style="font-weight:700;">
            <input type="checkbox" id="fr_verifyAll"> Select all (${pending.length})</label></div>` +
          pending.map(s => `<div class="fr-history-item"><label>
            <input type="checkbox" class="fr-verify-pick" value="${esc(s.id)}">
            ${esc(dateOf(s.values) || '(no date)')}</label></div>`).join('');
        el('fr_verifyAll').addEventListener('change', ev => {
          target.querySelectorAll('.fr-verify-pick').forEach(cb => { cb.checked = ev.target.checked; });
        });
      }

      async function renderVerificationHistory() {
        const hist = await window.SignOffBlock.getVerificationHistory(config.recordKey);
        renderVerifySelect();
        const notice = el('fr_verifyNotice');
        const pendingCount = pendingForVerification().length;
        if (pendingCount) {
          notice.innerHTML = `${pendingCount} submitted ${pendingCount === 1 ? 'entry is' : 'entries are'} awaiting verification.`;
          notice.classList.add('show');
        } else {
          notice.innerHTML = '';
          notice.classList.remove('show');
        }
        const target = el('fr_verificationHistory');
        if (!hist.length) { target.innerHTML = `<div class="fr-history-item fr-muted">No verification logged yet.</div>`; return; }
        target.innerHTML = hist.slice().reverse().map(v => `
          <div class="fr-history-item"><span>${window.SignOffBlock.historyLine(v)}</span></div>`).join('');
      }

      el('fr_saveVerificationBtn').addEventListener('click', async () => {
        const values = window.SignOffBlock.readVerifyInputs('fr_verified');
        if (!window.SignOffBlock.validateVerifyInputs(values)) { toast('Verified by, title, date and signature are all required.'); return; }

        const picked = [...document.querySelectorAll('.fr-verify-pick:checked')].map(cb => cb.value);
        if (pendingForVerification().length && !picked.length) { toast('Tick at least one entry to verify.'); return; }

        const record = await window.SignOffBlock.logVerification({ recordKey: config.recordKey, values, picked });

        if (picked.length) {
          const set = new Set(picked);
          submissions.forEach(s => { if (set.has(s.id)) s.verification = record; });
          await persist();
          renderTable();
        }
        toast(picked.length ? `Verification logged for ${picked.length} ${picked.length === 1 ? 'entry' : 'entries'}.` : 'Verification logged.');
        window.SignOffBlock.clearVerifyInputs('fr_verified');
        renderVerificationHistory();
      });
      refreshVerification = renderVerificationHistory;
    }

    el('fr_addBtn').addEventListener('click', () => openForm(null));
    el('fr_cancelBtn').addEventListener('click', closeForm);
    el('fr_saveBtn').addEventListener('click', () => saveForm(false));
    el('fr_submitBtn').addEventListener('click', () => saveForm(true));
    el('fr_exportJsonBtn').addEventListener('click', exportJson);
    el('fr_printBtn').addEventListener('click', printPdf);
    ['filterFrom', 'filterTo', 'filterSearch'].forEach(suffix => {
      el(`fr_${suffix}`).addEventListener('input', renderTable);
    });

    /* Header first, then the badge FROM it: the on-screen badge and the printed block
     * state the same revision, so they can never disagree. */
    await mountDocHeader(config);
    renderDocBadge();
    await load();
    renderTable();
    refreshVerification();
  }

  /* Controlled-copy title block on every printed page. The paper baseline comes from the
   * Master Index List via DocHeader; what the record declares is only the fallback for a
   * row the index doesn't carry. Non-fatal by design -- a record that can't resolve its
   * header still prints, it just prints without the block. */
  async function mountDocHeader(config) {
    if (!window.DocHeader) return null;
    try {
      return await window.DocHeader.mountPrintHeader({
        recordKey: config.recordKey,
        defaults: {
          document: config.title,
          docNumber: config.docCode,
          revisionDate: config.docRevisionDate
        },
        revisionStart: config.docRevisionStart || 1
      });
    } catch (e) { console.error('title block unavailable', e); return null; }
  }

  window.FormRecord = { init };
})();
