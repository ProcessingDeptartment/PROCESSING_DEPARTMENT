/*
 * In-app template editor for record forms. Authorized users (manageTemplates)
 * can add, remove, reorder, and rename sections/fields directly in the browser.
 * Overrides are stored at 'record_template:<recordKey>' (shared:true) and
 * replace the inline HTML config at init time. Each save bumps DocumentRevision.
 */
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function uid() { return 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

  const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Dropdown' },
    { value: 'textarea', label: 'Text area' },
    { value: 'yesno', label: 'Yes / No' },
  ];

  const STYLE = `
  .te-overlay{ position:fixed; inset:0; background:rgba(20,25,30,.55); z-index:600; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:24px 8px; }
  .te-inner{ background:#fff; border-radius:8px; width:min(960px,96vw); padding:18px; color:#1b2330; font-family:'Segoe UI',system-ui,sans-serif; font-size:13px; }
  .te-inner *{ box-sizing:border-box; }
  .te-inner h2{ font-size:14px; text-transform:uppercase; letter-spacing:.05em; color:#2f4356; margin:0 0 12px; }
  .te-inner h3{ font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#54606b; margin:16px 0 6px; font-weight:700; }
  .te-inner h3:first-child{ margin-top:0; }
  .te-inner input,.te-inner select,.te-inner textarea{ font-size:12.5px; border:1px solid #c9cdd1; border-radius:3px; padding:5px 7px; background:#fff; color:#1b2330; width:100%; font-family:'Segoe UI',system-ui,sans-serif; }
  .te-inner input:focus,.te-inner select:focus,.te-inner textarea:focus{ outline:2px solid #2f4356; outline-offset:-1px; }
  .te-inner button{ font-family:'Segoe UI',system-ui,sans-serif; cursor:pointer; border:none; border-radius:3px; font-weight:600; font-size:12px; padding:5px 10px; }
  .te-btn-primary{ background:#c9832b; color:#241a0a; }
  .te-btn-primary:hover{ background:#dd9536; }
  .te-btn-flat{ background:#e2e4e3; color:#1b2330; }
  .te-btn-flat:hover{ background:#d5d8d6; }
  .te-btn-danger{ background:#fbe8e6; color:#a3352d; }
  .te-btn-danger:hover{ background:#f5d0cc; }
  .te-actions{ display:flex; gap:8px; justify-content:flex-end; margin-top:14px; flex-wrap:wrap; }
  .te-section{ border:1px solid #e2e4e3; border-radius:6px; margin-bottom:12px; }
  .te-section-head{ display:flex; gap:8px; align-items:center; padding:8px 10px; background:#fbfbfa; border-radius:6px 6px 0 0; border-bottom:1px solid #e2e4e3; flex-wrap:wrap; }
  .te-section-head input{ max-width:260px; font-weight:600; }
  .te-section-body{ padding:10px; }
  .te-field-row{ display:flex; gap:6px; align-items:center; padding:5px 0; border-bottom:1px solid #f0f1f0; flex-wrap:wrap; }
  .te-field-row:last-child{ border-bottom:none; }
  .te-field-row input{ max-width:180px; }
  .te-field-row select{ max-width:110px; }
  .te-field-row label{ font-size:11px; color:#54606b; display:flex; align-items:center; gap:4px; white-space:nowrap; }
  .te-arrows{ display:flex; flex-direction:column; gap:1px; }
  .te-arrows button{ padding:1px 5px; font-size:10px; line-height:1; background:#e2e4e3; }
  .te-arrows button:hover{ background:#d5d8d6; }
  .te-locked{ opacity:.5; pointer-events:none; }
  .te-opts-wrap{ margin-top:3px; }
  .te-opts-wrap textarea{ font-size:11px; min-height:50px; width:200px; }
  .te-grid-3{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .te-grid-3 label{ display:flex; flex-direction:column; gap:3px; font-size:11.5px; color:#54606b; font-weight:600; }
  .te-toast{ position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:#1d2b38; color:#fff; padding:9px 18px; border-radius:20px; font-size:12px; z-index:999; opacity:0; pointer-events:none; transition:opacity .25s; }
  .te-toast.show{ opacity:1; }
  @media (max-width:768px){
    .te-inner{ width:100vw; min-height:100vh; border-radius:0; padding:12px; }
    .te-field-row input{ max-width:100%; }
    .te-field-row select{ max-width:100%; }
    .te-field-row{ flex-direction:column; align-items:stretch; }
    .te-grid-3{ grid-template-columns:1fr; }
  }`;

  function injectStyle() {
    if (document.getElementById('te-style')) return;
    const s = document.createElement('style');
    s.id = 'te-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  // ---- storage helpers ----
  async function storeGet(key) {
    try { const r = await window.storage.get(key, true); return r ? r.value : null; } catch (e) { return null; }
  }
  async function storeSet(key, value) {
    try { await window.storage.set(key, value, true); return true; } catch (e) { console.error('te: storage set failed', e); return false; }
  }
  async function storeRemove(key) {
    try { await window.storage.remove(key, true); return true; } catch (e) { return false; }
  }

  function storageKey(recordKey) { return 'record_template:' + recordKey; }

  // ---- public API ----

  async function load(recordKey) {
    const raw = await storeGet(storageKey(recordKey));
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (obj && obj.schemaVersion === 1) return obj;
    } catch (e) { console.warn('te: corrupt template override for', recordKey, e); }
    return null;
  }

  // ---- field row HTML ----
  function fieldRowHtml(f, idx, prefix, opts) {
    const isComputed = f.type === 'computed';
    const locked = isComputed ? ' te-locked' : '';
    const typeOpts = FIELD_TYPES.map(t =>
      `<option value="${t.value}" ${f.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('');
    const showOpts = f.type === 'select';
    const optionsVal = (f.options || []).join('\n');

    let html = `<div class="te-field-row${locked}" data-idx="${idx}">
      <div class="te-arrows">
        <button type="button" data-move="${prefix},${idx},-1" title="Move up">▲</button>
        <button type="button" data-move="${prefix},${idx},1" title="Move down">▼</button>
      </div>
      <input type="text" value="${esc(f.label)}" data-prop="${prefix},${idx},label" placeholder="Label" title="Label">
      <select data-prop="${prefix},${idx},type" title="Type">${isComputed ? '<option value="computed" selected>Computed</option>' : typeOpts}</select>
      <label><input type="checkbox" ${f.required ? 'checked' : ''} data-prop="${prefix},${idx},required"> Req</label>`;

    if (opts.showUnit) html += `<input type="text" value="${esc(f.unit || '')}" data-prop="${prefix},${idx},unit" placeholder="Unit" style="max-width:70px;" title="Unit">`;
    if (opts.showGroup) html += `<input type="text" value="${esc(f.group || '')}" data-prop="${prefix},${idx},group" placeholder="Group" style="max-width:100px;" title="Group">`;
    if (opts.showInTable) html += `<label><input type="checkbox" ${f.showInTable !== false ? 'checked' : ''} data-prop="${prefix},${idx},showInTable"> Table</label>`;
    if (opts.showWide) html += `<label><input type="checkbox" ${f.wide ? 'checked' : ''} data-prop="${prefix},${idx},wide"> Wide</label>`;
    if (opts.showGood) html += `<select data-prop="${prefix},${idx},good" title="Good answer" style="max-width:80px;"><option value="Yes" ${f.good !== 'No' ? 'selected' : ''}>Good=Yes</option><option value="No" ${f.good === 'No' ? 'selected' : ''}>Good=No</option></select>`;

    html += `<button type="button" class="te-btn-danger" data-remove="${prefix},${idx}" title="Remove field">✕</button>`;
    html += `</div>`;
    if (showOpts) {
      html += `<div class="te-opts-wrap" style="padding-left:36px;">
        <textarea data-prop="${prefix},${idx},options" placeholder="One option per line" title="Dropdown options">${esc(optionsVal)}</textarea>
      </div>`;
    }
    return html;
  }

  // ---- editor modal ----

  function open(options) {
    injectStyle();
    const { recordKey, engine, currentConfig, inlineConfig, docRevisionStart, onSave } = options;

    // Deep clone working copy
    let working = JSON.parse(JSON.stringify(currentConfig));

    const overlay = document.createElement('div');
    overlay.className = 'te-overlay';
    const toast = document.createElement('div');
    toast.className = 'te-toast';
    document.body.appendChild(toast);

    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2400);
    }

    function render() {
      let html = `<div class="te-inner">
        <h2>Edit Template</h2>`;

      if (engine === 'form-record') {
        html += renderFormRecord(working);
      } else {
        html += renderMonitoringLog(working);
      }

      html += `<h3>Change attribution (required to save)</h3>
        <div class="te-grid-3">
          <label>Reason for this change<input id="te_reason"></label>
          <label>Your name<input id="te_changedBy"></label>
          <label>Your title<input id="te_changedByTitle"></label>
        </div>
        <div class="te-actions">
          <button type="button" class="te-btn-danger" id="te_resetBtn">Reset to default</button>
          <span style="flex:1;"></span>
          <button type="button" class="te-btn-flat" id="te_cancelBtn">Cancel</button>
          <button type="button" class="te-btn-primary" id="te_saveBtn">Save template</button>
        </div>
      </div>`;

      overlay.innerHTML = html;
      document.body.appendChild(overlay);
      wireEvents();
    }

    function renderFormRecord(w) {
      let html = '';
      (w.sections || []).forEach((sec, si) => {
        html += `<div class="te-section">
          <div class="te-section-head">
            <div class="te-arrows">
              <button type="button" data-movesec="${si},-1" title="Move up">▲</button>
              <button type="button" data-movesec="${si},1" title="Move down">▼</button>
            </div>
            <input type="text" value="${esc(sec.title)}" data-sectitle="${si}" placeholder="Section title">
            <button type="button" class="te-btn-danger" data-remsec="${si}" title="Remove section">✕ Section</button>
          </div>
          <div class="te-section-body">
            ${(sec.fields || []).map((f, fi) => fieldRowHtml(f, fi, 'sec_' + si, { showWide: true, showGood: f.type === 'yesno' })).join('')}
            <button type="button" class="te-btn-flat" data-addfield="sec_${si}" style="margin-top:6px;">+ Add field</button>
          </div>
        </div>`;
      });
      html += `<button type="button" class="te-btn-flat" id="te_addSectionBtn" style="margin-bottom:12px;">+ Add section</button>`;

      if (w.roster) {
        html += `<h3>Roster: ${esc(w.roster.title)}</h3>
          <div class="te-section"><div class="te-section-head">
            <input type="text" value="${esc(w.roster.title)}" id="te_rosterTitle" placeholder="Roster title">
            <button type="button" class="te-btn-danger" id="te_removeRosterBtn">✕ Remove roster</button>
          </div><div class="te-section-body">
            ${(w.roster.columns || []).map((c, ci) => fieldRowHtml(c, ci, 'roster', {})).join('')}
            <button type="button" class="te-btn-flat" data-addfield="roster" style="margin-top:6px;">+ Add column</button>
          </div></div>`;
      } else {
        html += `<button type="button" class="te-btn-flat" id="te_addRosterBtn" style="margin-bottom:12px;">+ Add roster</button>`;
      }

      // listColumns picker
      const allKeys = [];
      (w.sections || []).forEach(sec => (sec.fields || []).forEach(f => { if (f.key) allKeys.push(f); }));
      const lc = new Set(w.listColumns || []);
      html += `<h3>List columns (shown in submissions table)</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${allKeys.map(f => `<label style="font-size:11px;"><input type="checkbox" data-listcol="${f.key}" ${lc.has(f.key) ? 'checked' : ''}> ${esc(f.label || f.key)}</label>`).join('')}
        </div>`;

      return html;
    }

    function renderMonitoringLog(w) {
      let html = '<h3>Entry fields</h3>';
      html += `<div class="te-section"><div class="te-section-body">
        ${(w.entryFields || []).map((f, i) => fieldRowHtml(f, i, 'entry', { showUnit: true, showGroup: true, showInTable: true })).join('')}
        <button type="button" class="te-btn-flat" data-addfield="entry" style="margin-top:6px;">+ Add field</button>
      </div></div>`;

      html += '<h3>Spec fields (thresholds)</h3>';
      html += `<div class="te-section"><div class="te-section-body">
        ${(w.specFields || []).map((f, i) => specFieldRowHtml(f, i)).join('')}
        <button type="button" class="te-btn-flat" data-addfield="spec" style="margin-top:6px;">+ Add spec field</button>
      </div></div>`;

      return html;
    }

    function specFieldRowHtml(f, idx) {
      return `<div class="te-field-row" data-idx="${idx}">
        <div class="te-arrows">
          <button type="button" data-move="spec,${idx},-1" title="Move up">▲</button>
          <button type="button" data-move="spec,${idx},1" title="Move down">▼</button>
        </div>
        <input type="text" value="${esc(f.label)}" data-prop="spec,${idx},label" placeholder="Label" title="Label">
        <input type="text" value="${esc(f.unit || '')}" data-prop="spec,${idx},unit" placeholder="Unit" style="max-width:70px;" title="Unit">
        <button type="button" class="te-btn-danger" data-remove="spec,${idx}" title="Remove">✕</button>
      </div>`;
    }

    // ---- resolve prefix to array reference ----
    function getArray(prefix) {
      if (prefix === 'roster') return working.roster ? working.roster.columns : null;
      if (prefix === 'entry') return working.entryFields;
      if (prefix === 'spec') return working.specFields;
      const m = prefix.match(/^sec_(\d+)$/);
      if (m) {
        const sec = (working.sections || [])[Number(m[1])];
        return sec ? sec.fields : null;
      }
      return null;
    }

    // ---- read current input values back into working model ----
    function sync() {
      // section titles
      overlay.querySelectorAll('[data-sectitle]').forEach(inp => {
        const si = Number(inp.dataset.sectitle);
        if (working.sections && working.sections[si]) working.sections[si].title = inp.value;
      });
      // roster title
      const rt = overlay.querySelector('#te_rosterTitle');
      if (rt && working.roster) working.roster.title = rt.value;
      // field properties
      overlay.querySelectorAll('[data-prop]').forEach(inp => {
        const [prefix, idxStr, prop] = inp.dataset.prop.split(',');
        const arr = getArray(prefix);
        if (!arr) return;
        const idx = Number(idxStr);
        if (!arr[idx]) return;
        if (prop === 'required' || prop === 'wide' || prop === 'showInTable') {
          arr[idx][prop] = inp.checked;
        } else if (prop === 'options') {
          arr[idx].options = inp.value.split('\n').map(l => l.trim()).filter(Boolean);
        } else {
          arr[idx][prop] = inp.value;
        }
      });
      // listColumns
      if (engine === 'form-record') {
        const cols = [];
        overlay.querySelectorAll('[data-listcol]').forEach(cb => {
          if (cb.checked) cols.push(cb.dataset.listcol);
        });
        working.listColumns = cols;
      }
    }

    function wireEvents() {
      // Cancel
      overlay.querySelector('#te_cancelBtn').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

      // Save
      overlay.querySelector('#te_saveBtn').addEventListener('click', doSave);

      // Reset
      overlay.querySelector('#te_resetBtn').addEventListener('click', doReset);

      // Add section (form-record)
      const addSecBtn = overlay.querySelector('#te_addSectionBtn');
      if (addSecBtn) addSecBtn.addEventListener('click', () => {
        sync();
        working.sections = working.sections || [];
        working.sections.push({ id: uid(), title: 'New section', fields: [] });
        rerender();
      });

      // Add roster (form-record)
      const addRostBtn = overlay.querySelector('#te_addRosterBtn');
      if (addRostBtn) addRostBtn.addEventListener('click', () => {
        sync();
        working.roster = { title: 'New roster', columns: [] };
        rerender();
      });

      // Remove roster
      const remRostBtn = overlay.querySelector('#te_removeRosterBtn');
      if (remRostBtn) remRostBtn.addEventListener('click', () => {
        sync();
        working.roster = null;
        rerender();
      });

      // Move section
      overlay.querySelectorAll('[data-movesec]').forEach(btn => {
        btn.addEventListener('click', () => {
          sync();
          const [siStr, dirStr] = btn.dataset.movesec.split(',');
          const si = Number(siStr), dir = Number(dirStr);
          const arr = working.sections;
          const ni = si + dir;
          if (ni < 0 || ni >= arr.length) return;
          [arr[si], arr[ni]] = [arr[ni], arr[si]];
          rerender();
        });
      });

      // Remove section
      overlay.querySelectorAll('[data-remsec]').forEach(btn => {
        btn.addEventListener('click', () => {
          sync();
          working.sections.splice(Number(btn.dataset.remsec), 1);
          rerender();
        });
      });

      // Move field
      overlay.querySelectorAll('[data-move]').forEach(btn => {
        btn.addEventListener('click', () => {
          sync();
          const [prefix, idxStr, dirStr] = btn.dataset.move.split(',');
          const arr = getArray(prefix);
          if (!arr) return;
          const idx = Number(idxStr), dir = Number(dirStr);
          const ni = idx + dir;
          if (ni < 0 || ni >= arr.length) return;
          [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
          rerender();
        });
      });

      // Remove field
      overlay.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          sync();
          const [prefix, idxStr] = btn.dataset.remove.split(',');
          const arr = getArray(prefix);
          if (!arr) return;
          arr.splice(Number(idxStr), 1);
          rerender();
        });
      });

      // Add field
      overlay.querySelectorAll('[data-addfield]').forEach(btn => {
        btn.addEventListener('click', () => {
          sync();
          const prefix = btn.dataset.addfield;
          if (prefix === 'spec') {
            working.specFields = working.specFields || [];
            working.specFields.push({ key: uid(), label: '', unit: '' });
          } else {
            const arr = getArray(prefix);
            if (!arr) return;
            arr.push({ key: uid(), label: '', type: 'text', required: false });
          }
          rerender();
        });
      });

      // Type change shows/hides options textarea -- handled by rerender on change
      overlay.querySelectorAll('select[data-prop$=",type"]').forEach(sel => {
        sel.addEventListener('change', () => { sync(); rerender(); });
      });
    }

    function rerender() {
      const reason = overlay.querySelector('#te_reason');
      const changedBy = overlay.querySelector('#te_changedBy');
      const changedByTitle = overlay.querySelector('#te_changedByTitle');
      const savedReason = reason ? reason.value : '';
      const savedBy = changedBy ? changedBy.value : '';
      const savedTitle = changedByTitle ? changedByTitle.value : '';
      render();
      const r2 = overlay.querySelector('#te_reason');
      const c2 = overlay.querySelector('#te_changedBy');
      const t2 = overlay.querySelector('#te_changedByTitle');
      if (r2) r2.value = savedReason;
      if (c2) c2.value = savedBy;
      if (t2) t2.value = savedTitle;
    }

    function close() {
      overlay.remove();
      toast.remove();
    }

    async function doSave() {
      sync();
      const reason = overlay.querySelector('#te_reason').value.trim();
      const changedBy = overlay.querySelector('#te_changedBy').value.trim();
      const changedByTitle = overlay.querySelector('#te_changedByTitle').value.trim();

      // Validate fields have keys and labels
      const allFields = [];
      if (engine === 'form-record') {
        (working.sections || []).forEach(s => (s.fields || []).forEach(f => allFields.push(f)));
        if (working.roster) (working.roster.columns || []).forEach(f => allFields.push(f));
      } else {
        (working.entryFields || []).forEach(f => allFields.push(f));
        (working.specFields || []).forEach(f => allFields.push(f));
      }

      for (const f of allFields) {
        if (!f.key || !String(f.label).trim()) {
          showToast('Every field needs a label.');
          return;
        }
      }
      const keys = allFields.map(f => f.key);
      if (new Set(keys).size !== keys.length) {
        showToast('Duplicate field keys detected — remove the duplicate first.');
        return;
      }

      // Bump document revision (validates attribution)
      try {
        await window.DocumentRevision.bump(recordKey, { reason, changedBy, changedByTitle }, docRevisionStart || 1);
      } catch (e) { showToast(e.message); return; }

      // Ensure sections have stable IDs
      if (engine === 'form-record') {
        (working.sections || []).forEach(s => { if (!s.id) s.id = uid(); });
      }

      const override = {
        schemaVersion: 1,
        engine,
        savedAt: Date.now(),
        savedBy: changedBy,
      };
      if (engine === 'form-record') {
        override.sections = working.sections;
        override.roster = working.roster || null;
        override.listColumns = working.listColumns;
      } else {
        override.entryFields = working.entryFields;
        override.specFields = working.specFields;
      }

      const ok = await storeSet(storageKey(recordKey), JSON.stringify(override));
      if (!ok) { showToast('Save failed — please retry.'); return; }

      close();
      if (onSave) onSave();
      else location.reload();
    }

    async function doReset() {
      if (!confirm('This will discard all template customizations and revert to the original record layout. Continue?')) return;

      const reason = overlay.querySelector('#te_reason').value.trim();
      const changedBy = overlay.querySelector('#te_changedBy').value.trim();
      const changedByTitle = overlay.querySelector('#te_changedByTitle').value.trim();

      try {
        await window.DocumentRevision.bump(recordKey, { reason: reason || 'Reset template to default', changedBy, changedByTitle }, docRevisionStart || 1);
      } catch (e) { showToast(e.message); return; }

      await storeRemove(storageKey(recordKey));
      close();
      if (onSave) onSave();
      else location.reload();
    }

    render();
  }

  window.TemplateEditor = { load, open };
})();
