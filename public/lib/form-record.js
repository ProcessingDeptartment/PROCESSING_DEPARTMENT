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
    .fr-body{ padding:14px 14px 60px; }
  }
  @media (max-width:900px){ .fr-grid-2,.fr-grid-3{grid-template-columns:1fr;} }
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
  @media print{
    /* The top margin is not ours to choose -- that strip is reserved for the repeating
     * controlled-copy title block. Stated as the shorthand because Chrome drops
     * `margin-top` inside @page. See doc-header.js. */
    @page{ size:A4; margin:26mm 12mm 12mm; }
    body{ background:#fff; }
    .no-print{ display:none !important; }
    .fr-app{ font-size:10px; }
    .fr-table-wrap{ overflow:visible !important; }
  }`;

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
    if (field.type === 'select' || field.type === 'yesno') {
      const opts = field.type === 'yesno' ? ['', 'Yes', 'No'] : ['', ...(field.options || [])];
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

    async function renderDocBadge() {
      const rev = await DocumentRevision.getCurrent(config.recordKey, config.docRevisionStart || 1);
      const date = await DocumentRevision.getCurrentDate(config.recordKey, config.docRevisionDate);
      el('fr_docRev').textContent = `Rev ${rev} · Rev date ${date || 'not set'}`;
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
              <button class="fr-btn fr-btn-flat fr-btn-sm" id="fr_printBtn">Print</button>
            </div>
            <div id="fr_table" class="fr-table-wrap"></div>
          </div>
        </div>
      </div>
      <div id="fr_modal" class="fr-modal-overlay no-print" style="display:none;">
        <div class="fr-modal-inner">
          <h2 id="fr_modalTitle">New submission</h2>
          <div id="fr_modalSections"></div>
          <div class="fr-actions">
            <button class="fr-btn fr-btn-flat" id="fr_cancelBtn">Cancel</button>
            <button class="fr-btn fr-btn-primary" id="fr_saveBtn">Save</button>
          </div>
        </div>
      </div>
      <div class="fr-toast no-print" id="fr_toast"></div>
    `;

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
      let html = `<table class="fr-table"><thead><tr>${cols.map(k => `<th>${esc(labelFor(k))}</th>`).join('')}<th></th></tr></thead><tbody>`;
      list.forEach(sub => {
        html += `<tr>`;
        cols.forEach(k => {
          let v = sub.values[k];
          if (v === '' || v == null) v = '—';
          html += `<td>${esc(v)}</td>`;
        });
        html += `<td><button class="fr-btn fr-btn-flat fr-btn-sm" data-open="${sub.id}">Open</button></td>`;
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      wrap.innerHTML = html;
      wrap.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => openForm(btn.dataset.open)));
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
      el('fr_modalTitle').textContent = id ? 'Edit submission' : 'New submission';
      const container = el('fr_modalSections');
      let html = (config.sections || []).map(sec => `
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
      el('fr_modal').style.display = 'flex';
    }
    function closeForm() { el('fr_modal').style.display = 'none'; }

    async function saveForm() {
      const values = {};
      let missingRequired = null;
      allFields(config).forEach(f => {
        const inp = el(`fr_f_${f.key}`);
        values[f.key] = inp ? inp.value : '';
        if (f.required && !String(values[f.key] || '').trim()) missingRequired = f.label;
      });
      if (missingRequired) { toast(`"${missingRequired}" is required.`); return; }
      // Validate batch number format if this record has a batchField
      if (config.batchField && window.BatchValidation) {
        const batchValue = values[config.batchField];
        if (batchValue && !window.BatchValidation.isValid(batchValue)) {
          toast(window.BatchValidation.formatError());
          return;
        }
      }
      const rosterRows = hasRoster ? el('fr_rosterRows')._getRows() : undefined;

      let savedSub;
      if (editingId) {
        const existing = submissions.find(s => s.id === editingId);
        existing.history = existing.history || [];
        existing.history.push({ ts: Date.now(), previousValues: existing.values, previousRoster: existing.roster });
        existing.values = values;
        if (hasRoster) existing.roster = rosterRows;
        existing.updatedAt = Date.now();
        savedSub = existing;
      } else {
        const sub = {
          id: uid('sub'),
          values,
          source: 'manual', // future automated feeds set 'device' here
          createdAt: Date.now(),
          updatedAt: Date.now(),
          history: [],
          signOffs: []
        };
        if (hasRoster) sub.roster = rosterRows;
        submissions.push(sub);
        savedSub = sub;
      }
      // Add sign-off from current authenticated user
      if (window.Auth && window.Auth.isAuthenticated()) {
        const signOff = window.Auth.createSignOff('submitted');
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
      toast(editingId ? 'Submission updated.' : 'Submission saved.');
    }

    el('fr_addBtn').addEventListener('click', () => openForm(null));
    el('fr_cancelBtn').addEventListener('click', closeForm);
    el('fr_saveBtn').addEventListener('click', saveForm);
    el('fr_printBtn').addEventListener('click', () => window.print());
    ['filterFrom', 'filterTo', 'filterSearch'].forEach(suffix => {
      el(`fr_${suffix}`).addEventListener('input', renderTable);
    });

    await renderDocBadge();
    await mountDocHeader(config);
    await load();
    renderTable();
  }

  /* Controlled-copy title block on every printed page. The paper baseline comes from the
   * Master Index List via DocHeader; what the record declares is only the fallback for a
   * row the index doesn't carry. Non-fatal by design -- a record that can't resolve its
   * header still prints, it just prints without the block. */
  async function mountDocHeader(config) {
    if (!window.DocHeader) return;
    try {
      await window.DocHeader.mountPrintHeader({
        recordKey: config.recordKey,
        defaults: {
          document: config.title,
          docNumber: config.docCode,
          revisionDate: config.docRevisionDate
        },
        revisionStart: config.docRevisionStart || 1
      });
    } catch (e) { console.error('title block unavailable', e); }
  }

  window.FormRecord = { init };
})();
