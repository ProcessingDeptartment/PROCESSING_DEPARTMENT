(function(){
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const num = v => { const n = parseFloat(v); return (v === '' || v == null || isNaN(n)) ? null : n; };
  const safeKey = s => String(s == null ? '' : s).trim().replace(/[\s\/\\'"]+/g, '_');

  const DOC_REVISION_KEY = 'double-seam-inspection-report';
  const DOC_REVISION_START = 11;
  const STAGES = [
    { key: 'before', label: 'Before production' },
    { key: 'during', label: 'During production' },
    { key: 'after', label: 'After production' }
  ];
  const CANS = ['can1', 'can2'];
  const POINTS = [0, 1, 2];
  const ROWS = [
    { key: 'seamLength', label: 'Seam length', unit: 'mm' },
    { key: 'seamThickness', label: 'Seam thickness', unit: 'mm' },
    { key: 'bodyHook', label: 'Body hook', unit: 'mm' },
    { key: 'coverHook', label: 'Cover hook', unit: 'mm' },
    { key: 'bhbPct', label: '% B.H.B.', unit: '%' },
    { key: 'freespace', label: 'Freespace', unit: 'mm' },
    { key: 'internal', label: 'Internal', unit: 'mm' },
    { key: 'tightnessPct', label: 'Tightness / wrinkle', unit: '%' },
    { key: 'plateThicknessEnd', label: 'Plate thickness (tin end)', unit: 'mm' },
    { key: 'plateThicknessBody', label: 'Plate thickness (tin body)', unit: 'mm' },
    { key: 'countersinkDepth', label: 'Countersink depth', unit: 'mm' }
  ];
  const RANGE_ROWS = ROWS.filter(r => r.key !== 'tightnessPct');
  const DERIVED_ROWS = ['bhbPct', 'freespace'];
  const HEADER_KEYS = ['jobNo', 'agCode', 'reportDate', 'canSize', 'dateProduced', 'batchCans', 'batchEnds', 'microSerial', 'microVerified', 'gauge121', 'gauge300'];
  const SIGNOFF_KEYS = ['completedBy', 'completedSig', 'completedDate', 'completedBySignature'];

  const PR = window.PermissionRules;
  const DEFAULT_SPEC_EOA = window.Thresholds.DOUBLE_SEAM_DEFAULT_SPEC_EOA;
  const DEFAULT_SPEC_NEO = window.Thresholds.DOUBLE_SEAM_DEFAULT_SPEC_NEO;

  // ---- calculation --------------------------------------------------------------
  const overlapDenom = (SL, Te, Tb) => SL - (2.2 * Te) - (1.1 * Tb);
  function calcPoint(p) {
    const SL = num(p.seamLength), ST = num(p.seamThickness), BH = num(p.bodyHook),
      Te = num(p.plateThicknessEnd), Tb = num(p.plateThicknessBody);
    let bhbPct = null, freespace = null;
    if (BH !== null && SL !== null && Te !== null && Tb !== null) {
      const d = overlapDenom(SL, Te, Tb);
      if (d !== 0) bhbPct = Math.round((100 * (BH - 1.1 * Tb) / d) * 10) / 10;
    }
    if (ST !== null && Te !== null && Tb !== null)
      freespace = Math.round((ST - 3 * Te - 2 * Tb) * 1000) / 1000;
    return { bhbPct, freespace };
  }
  function calcOverlapForCan(can) {
    const pts = can.points;
    const bh = pts.map(p => num(p.bodyHook)).filter(v => v !== null);
    const ch = pts.map(p => num(p.coverHook)).filter(v => v !== null);
    const sl = pts.map(p => num(p.seamLength)).filter(v => v !== null);
    const te = pts.map(p => num(p.plateThicknessEnd)).filter(v => v !== null);
    const tb = pts.map(p => num(p.plateThicknessBody)).filter(v => v !== null);
    if (!bh.length || !ch.length || !sl.length || !te.length || !tb.length) return { overlapPct: null, actualOverlap: null };
    const BH = Math.min(...bh), CH = Math.min(...ch), SH = Math.max(...sl), T = Math.min(...te), BPT = Math.min(...tb);
    const actualOverlap = BH + CH + 1.1 * T - SH;
    const denom = overlapDenom(SH, T, BPT);
    const overlapPct = denom !== 0 ? (100 * actualOverlap / denom) : null;
    return {
      overlapPct: overlapPct !== null ? Math.round(overlapPct * 10) / 10 : null,
      actualOverlap: Math.round(actualOverlap * 1000) / 1000
    };
  }
  const checkRange = (val, range) => {
    if (val === null || !range) return null;
    if (range.min !== undefined && val < range.min) return 'fail';
    if (range.max !== undefined && val > range.max) return 'fail';
    return 'ok';
  };
  const checkMin = (val, min) => (val === null || min === undefined || min === null) ? null : (val >= min ? 'ok' : 'fail');

  // ---- blank record -----------------------------------------------------------
  const blankPoint = () => ROWS.reduce((o, r) => (o[r.key] = '', o), {});
  const blankCan = () => ({ vacuum: '', points: [blankPoint(), blankPoint(), blankPoint()] });
  const blankStage = () => ({ can1: blankCan(), can2: blankCan() });
  function blankState() {
    return {
      specProfileId: '', specVersionAtSave: null,
      header: HEADER_KEYS.reduce((o, k) => (o[k] = '', o), {}),
      stages: { before: blankStage(), during: blankStage(), after: blankStage() },
      comments: '',
      completedBy: '', completedSig: '', completedDate: '', completedBySignature: ''
    };
  }
  function stateFromValues(v) {
    const s = blankState();
    if (!v) return s;
    HEADER_KEYS.forEach(k => { s.header[k] = (v.header && v.header[k]) || v[k] || ''; });
    SIGNOFF_KEYS.forEach(k => { s[k] = v[k] || ''; });
    s.comments = v.comments || '';
    s.specProfileId = v.specProfileId || '';
    s.specVersionAtSave = v.specVersionAtSave == null ? null : v.specVersionAtSave;
    STAGES.forEach(st => {
      CANS.forEach(ck => {
        const src = v.stages && v.stages[st.key] && v.stages[st.key][ck];
        if (!src) return;
        s.stages[st.key][ck].vacuum = src.vacuum || '';
        (src.points || []).forEach((p, i) => {
          if (!s.stages[st.key][ck].points[i]) return;
          ROWS.forEach(r => { s.stages[st.key][ck].points[i][r.key] = p[r.key] == null ? '' : String(p[r.key]); });
        });
      });
    });
    return s;
  }

  // ---- module state ---------------------------------------------------------
  let state = blankState();
  let formContainer = null;
  let activeStage = 'before';
  let specProfiles = {};   // id -> published spec content
  let specIndex = [];      // [{id, name}]
  let mlCtx = null;
  let specFormEditingId = null;
  let specFormPdfDataUrl = null;

  function currentSpec() { return specProfiles[state.specProfileId] || specProfiles[specIndex[0] && specIndex[0].id] || DEFAULT_SPEC_EOA; }
  function currentProfileName() { const e = specIndex.find(s => s.id === state.specProfileId); return e ? e.name : (specIndex[0] ? specIndex[0].name : 'Unknown'); }

  async function storeGet(key) { try { const r = await window.storage.get(key, true); return r ? r.value : null; } catch (e) { return null; } }
  async function storeSet(key, val) { try { return await window.storage.set(key, val, true) !== false; } catch (e) { return false; } }

  async function loadSpecProfiles() {
    const idxRaw = await storeGet('spec_profiles_index');
    if (idxRaw) { try { specIndex = JSON.parse(idxRaw); } catch (e) { specIndex = []; } }
    if (!specIndex.length) {
      specIndex = [
        { id: 'fujian-73x119-eoa', name: DEFAULT_SPEC_EOA.name },
        { id: 'fujian-73x119-neo', name: DEFAULT_SPEC_NEO.name }
      ];
      await storeSet('spec_profiles_index', JSON.stringify(specIndex));
      await window.SpecRegistry.proposeVersion('fujian-73x119-eoa', DEFAULT_SPEC_EOA, { changeReason: 'Seeded from 73 dia. double seam inspection sheet', publishedBy: 'System', changedByTitle: 'System' });
      await window.SpecRegistry.proposeVersion('fujian-73x119-neo', DEFAULT_SPEC_NEO, { changeReason: 'Seeded from 73 dia. double seam inspection sheet (mirrors EOA pending NEO-specific tolerances)', publishedBy: 'System', changedByTitle: 'System' });
    }
    specProfiles = {};
    for (const s of specIndex) {
      let content = await window.SpecRegistry.getPublished(s.id);
      if (!content) content = await window.SpecRegistry.proposeVersion(s.id, DEFAULT_SPEC_EOA, { changeReason: 'Backfilled missing spec version', publishedBy: 'System', changedByTitle: 'System' });
      specProfiles[s.id] = content;
    }
    if (!state.specProfileId || !(state.specProfileId in specProfiles)) state.specProfileId = specIndex[0].id;
  }

  function specMismatchInfo() {
    const spec = currentSpec();
    if (!spec || spec.versionNumber == null || state.specVersionAtSave == null) return null;
    return state.specVersionAtSave < spec.versionNumber ? spec : null;
  }

  // ---- issue evaluation -----------------------------------------------------
  function syncDerived() {
    STAGES.forEach(st => CANS.forEach(ck => state.stages[st.key][ck].points.forEach(p => {
      const d = calcPoint(p);
      p.bhbPct = d.bhbPct === null ? '' : String(d.bhbPct);
      p.freespace = d.freespace === null ? '' : String(d.freespace);
    })));
  }
  function evaluateRecord() {
    syncDerived();
    const spec = currentSpec();
    const issues = [];
    const g121 = num(state.header.gauge121), g300 = num(state.header.gauge300);
    if (g121 !== null && spec.gauge121Target != null && Math.abs(g121 - spec.gauge121Target) > spec.gaugeTolerance)
      issues.push('1.21mm gauge block reading out of tolerance (+/-' + spec.gaugeTolerance + 'mm).');
    if (g300 !== null && spec.gauge300Target != null && Math.abs(g300 - spec.gauge300Target) > spec.gaugeTolerance)
      issues.push('3.00mm gauge block reading out of tolerance (+/-' + spec.gaugeTolerance + 'mm).');
    if (state.header.microVerified === 'no') issues.push('Micrometer verification marked NO.');
    STAGES.forEach(stage => CANS.forEach(canKey => {
      const can = state.stages[stage.key][canKey];
      const vac = num(can.vacuum);
      if (vac !== null && spec.vacuum && spec.vacuum.op === 'gt' && !(vac > spec.vacuum.value))
        issues.push(stage.label + ' / ' + canKey.toUpperCase() + ': vacuum ' + vac + ' kPa fails spec (' + spec.vacuum.label + ').');
      can.points.forEach((p, i) => {
        const lbl = stage.label + ' / ' + canKey.toUpperCase() + ' / pt' + (i + 1);
        RANGE_ROWS.forEach(row => {
          const v = num(p[row.key]), range = spec[row.key];
          if (v !== null && range && checkRange(v, range) === 'fail')
            issues.push(lbl + ': ' + row.label + ' ' + v + ' out of spec (' + (range.min ?? '-') + '-' + (range.max ?? '-') + ').');
        });
        const tp = num(p.tightnessPct);
        if (tp !== null && checkMin(tp, spec.tightnessPctMin) === 'fail')
          issues.push(lbl + ': tightness ' + tp + '% below minimum ' + spec.tightnessPctMin + '%.');
      });
      const { overlapPct, actualOverlap } = calcOverlapForCan(can);
      if (overlapPct !== null && checkMin(overlapPct, spec.overlapPctMin) === 'fail')
        issues.push(stage.label + ' / ' + canKey.toUpperCase() + ': % overlap ' + overlapPct + '% below minimum ' + spec.overlapPctMin + '%.');
      if (actualOverlap !== null && checkMin(actualOverlap, spec.actualOverlapMin) === 'fail')
        issues.push(stage.label + ' / ' + canKey.toUpperCase() + ': actual overlap ' + actualOverlap + 'mm below minimum ' + spec.actualOverlapMin + 'mm.');
    }));
    return issues;
  }

  // ---- rendering ----------------------------------------------------------------
  function specLabelFor(rowKey, spec) {
    if (rowKey === 'tightnessPct') return spec.tightnessPctMin != null ? 'min ' + spec.tightnessPctMin + '%' : 'record only';
    const row = ROWS.find(r => r.key === rowKey), range = spec[rowKey];
    if (!range) return 'record only';
    return (range.min ?? '-') + '-' + (range.max ?? '-') + row.unit;
  }
  function cellClass(rowKey, value, spec) {
    const v = num(value);
    if (v === null) return '';
    if (rowKey === 'tightnessPct') return (spec.tightnessPctMin != null && checkMin(v, spec.tightnessPctMin) === 'fail') ? 'oor' : '';
    const range = spec[rowKey];
    return range && checkRange(v, range) === 'fail' ? 'oor' : '';
  }
  function canTableHtml(stageKey, canKey) {
    const spec = currentSpec();
    const can = state.stages[stageKey][canKey];
    const { overlapPct, actualOverlap } = calcOverlapForCan(can);
    const overlapFail = overlapPct !== null && checkMin(overlapPct, spec.overlapPctMin) === 'fail';
    const actualFail = actualOverlap !== null && checkMin(actualOverlap, spec.actualOverlapMin) === 'fail';
    let html = '<div class="ds-can-block"><h4>' + (canKey === 'can1' ? 'Can 1' : 'Can 2') +
      '<span class="ds-badge ' + (overlapFail || actualFail ? 'ds-badge-fail' : 'ds-badge-ok') + '">' + (overlapFail || actualFail ? 'Check overlap' : 'Overlap OK') + '</span></h4>' +
      '<div class="ds-vac-row"><label>Vacuum kPa (' + (spec.vacuum ? esc(spec.vacuum.label) : '') + ')</label>' +
      '<input type="number" step="0.1" data-path="' + stageKey + '.' + canKey + '.vacuum" value="' + esc(can.vacuum) + '"></div>' +
      '<table class="ds-meas"><thead><tr><th style="text-align:left;">Measurement</th><th>Point 1</th><th>Point 2</th><th>Point 3</th></tr></thead><tbody>';
    ROWS.forEach(row => {
      const derived = DERIVED_ROWS.includes(row.key);
      html += '<tr><td class="row-label">' + esc(row.label) + '<span class="spec">' + specLabelFor(row.key, spec) + (derived ? '  -  calc' : '') + '</span></td>';
      POINTS.forEach(i => {
        const val = can.points[i][row.key];
        const oor = cellClass(row.key, val, spec) === 'oor' ? 'oor' : '';
        if (derived) html += '<td class="' + oor + '" style="font-family:\'IBM Plex Mono\',monospace;font-weight:600;background:#f7f9f8;">' + (val === '' ? '-' : esc(val)) + '</td>';
        else html += '<td class="' + oor + '"><input type="number" step="0.001" data-path="' + stageKey + '.' + canKey + '.points.' + i + '.' + row.key + '" value="' + esc(val) + '"></td>';
      });
      html += '</tr>';
    });
    html += '<tr class="ds-calc-row"><td class="row-label">Calculated % overlap<span class="spec">min ' + (spec.overlapPctMin ?? '-') + '%</span></td>' +
      '<td colspan="3" class="' + (overlapFail ? 'fail-calc' : '') + '">' + (overlapPct === null ? '-' : overlapPct + '%') + '</td></tr>' +
      '<tr class="ds-calc-row"><td class="row-label">Calculated actual overlap<span class="spec">min ' + (spec.actualOverlapMin ?? '-') + 'mm</span></td>' +
      '<td colspan="3" class="' + (actualFail ? 'fail-calc' : '') + '">' + (actualOverlap === null ? '-' : actualOverlap + 'mm') + '</td></tr>';
    html += '</tbody></table></div>';
    return html;
  }

  function headerFieldHtml(k, label, type, hint) {
    if (k === 'microVerified') {
      return '<label class="ds-field">' + esc(label) + '<select data-hkey="microVerified">' +
        ['', 'yes', 'no'].map(o => '<option value="' + o + '"' + (state.header.microVerified === o ? ' selected' : '') + '>' + (o || '-') + '</option>').join('') + '</select></label>';
    }
    return '<label class="ds-field">' + esc(label) + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') +
      '<input data-hkey="' + k + '" type="' + (type || 'text') + '"' + (type === 'number' ? ' step="0.001"' : '') + ' value="' + esc(state.header[k]) + '"></label>';
  }

  function issuesHtml() {
    const issues = evaluateRecord();
    const mismatch = specMismatchInfo();
    let html = '';
    if (mismatch) {
      html += '<div class="ds-issues warn"><h4>Specification updated - re-validation required</h4>' +
        '<div>Profile "' + esc(currentProfileName()) + '" is now version <strong>' + mismatch.versionNumber + '</strong>' +
        ' (this record was validated against v' + (state.specVersionAtSave ?? '-') + ').</div>' +
        '<div style="margin-top:8px;"><button type="button" class="ds-btn-primary" id="ds_ackSpec"' + (PR.can('acknowledgeSpecChange') ? '' : ' disabled') + '>Acknowledge &amp; re-validate against v' + mismatch.versionNumber + '</button></div></div>';
    }
    if (!issues.length) html += '<div class="ds-issues ok"><h4>No spec breaches detected</h4></div>';
    else html += '<div class="ds-issues"><h4>' + issues.length + ' item(s) out of spec - resolve before submitting</h4><ul>' + issues.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></div>';
    return html;
  }

  function repaintDynamic(container) {
    const active = document.activeElement;
    const activePath = active && active.dataset ? active.dataset.path : null;
    container.querySelector('#ds_issues').innerHTML = issuesHtml();
    container.querySelector('#ds_stageContent').innerHTML =
      canTableHtml(activeStage, 'can1') + canTableHtml(activeStage, 'can2');
    wireStageInputs(container);
    wireIssueButtons(container);
    if (activePath) {
      const el = container.querySelector('#ds_stageContent [data-path="' + activePath + '"]');
      if (el) { try { el.focus(); const v = el.value; el.value = ''; el.value = v; } catch (e) {} }
    }
    updateSubmitGate();
  }
  function updateSubmitGate() {
    if (!mlCtx) return;
    const blocked = evaluateRecord().length > 0 || !!specMismatchInfo() || !PR.can('completeRecord');
    mlCtx.setSubmitDisabled(blocked);
  }

  function setDeep(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = value;
  }
  function wireStageInputs(container) {
    container.querySelectorAll('#ds_stageContent input[data-path]').forEach(inp => {
      inp.addEventListener('input', () => { setDeep(state.stages, inp.dataset.path, inp.value); repaintDynamic(container); });
    });
  }
  function wireIssueButtons(container) {
    const ack = container.querySelector('#ds_ackSpec');
    if (ack) ack.addEventListener('click', () => {
      if (!PR.can('acknowledgeSpecChange')) { mlCtx.toast('You do not have permission to do this.'); return; }
      state.specVersionAtSave = currentSpec().versionNumber;
      mlCtx.toast('Re-validated against spec version ' + state.specVersionAtSave + '.');
      repaintDynamic(container);
    });
  }

  function refreshSpecUI() {
    if (!formContainer) return;
    const sel = formContainer.querySelector('#ds_specSelect');
    if (sel) {
      sel.innerHTML = specIndex.map(s => '<option value="' + esc(s.id) + '"' + (s.id === state.specProfileId ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
      sel.value = state.specProfileId;
    }
    repaintDynamic(formContainer);
  }

  function render(container, entry, ctx) {
    mlCtx = ctx;
    formContainer = container;
    state = stateFromValues(entry ? entry.values : null);
    if (!state.specProfileId && specIndex[0]) state.specProfileId = specIndex[0].id;
    activeStage = 'before';

    container.innerHTML =
      '<div class="ds-toolbar">' +
        '<label class="ds-field" style="flex-direction:row;align-items:center;gap:6px;">Spec profile' +
        '<select id="ds_specSelect">' + specIndex.map(s => '<option value="' + esc(s.id) + '"' + (s.id === state.specProfileId ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select></label>' +
        '<button type="button" class="ds-btn-flat" id="ds_manageSpecs">Manage specs</button>' +
        '<a class="ds-btn-flat" href="double-seam-trend.html" style="text-decoration:none;">Trend</a>' +
      '</div>' +
      '<div id="ds_issues">' + issuesHtml() + '</div>' +
      '<div class="ds-panel"><div class="ds-panel-head"><h3>Header</h3></div><div class="ds-panel-body">' +
        '<div class="ds-grid" style="margin-bottom:10px;">' +
          headerFieldHtml('jobNo', 'Job no.') + headerFieldHtml('agCode', 'AG Code') +
          headerFieldHtml('reportDate', 'Date', 'date') + headerFieldHtml('canSize', 'Can size') +
        '</div><div class="ds-grid" style="margin-bottom:10px;">' +
          headerFieldHtml('dateProduced', 'Date produced', 'date') +
          headerFieldHtml('batchCans', 'Fujian batch code (cans)') +
          headerFieldHtml('batchEnds', 'Fujian batch code (can ends)') +
        '</div><div class="ds-grid">' +
          headerFieldHtml('microSerial', 'Micrometer serial number') +
          headerFieldHtml('microVerified', 'Micrometer verified (+/-0.02mm)') +
          headerFieldHtml('gauge121', 'Size 1.21mm - actual reading', 'number', 'tol +/-0.02mm') +
          headerFieldHtml('gauge300', 'Size 3.00mm - actual reading', 'number', 'tol +/-0.02mm') +
        '</div>' +
      '</div></div>' +
      '<div class="ds-stage-tabs" id="ds_stageTabs">' + STAGES.map(s => '<div class="ds-stage-tab' + (s.key === activeStage ? ' active' : '') + '" data-stage="' + s.key + '">' + esc(s.label) + '</div>').join('') + '</div>' +
      '<div class="ds-panel"><div class="ds-panel-head"><h3 id="ds_stageTitle"></h3></div><div class="ds-panel-body" id="ds_stageContent"></div></div>' +
      '<div class="ds-panel"><div class="ds-panel-head"><h3>Comments</h3></div><div class="ds-panel-body">' +
        '<textarea id="ds_comments" rows="3" style="width:100%;">' + esc(state.comments) + '</textarea></div></div>' +
      '<div class="ds-panel"><div class="ds-panel-head"><h3>Completed by</h3></div><div class="ds-panel-body"><div class="ds-grid">' +
        '<label class="ds-field">Completed by<input id="ds_completedBy" value="' + esc(state.completedBy) + '"></label>' +
        '<label class="ds-field">Title<input id="ds_completedSig" value="' + esc(state.completedSig) + '"></label>' +
        '<label class="ds-field">Date<input id="ds_completedDate" type="date" value="' + esc(state.completedDate) + '"></label>' +
        '<label class="ds-field">Signature<input id="ds_completedBySignature" value="' + esc(state.completedBySignature) + '"></label>' +
      '</div></div></div>';

    // stage content
    const paintStage = () => {
      container.querySelector('#ds_stageTitle').textContent = STAGES.find(s => s.key === activeStage).label + ' - 2 cans x 3 points each';
      container.querySelectorAll('#ds_stageTabs .ds-stage-tab').forEach(t => t.classList.toggle('active', t.dataset.stage === activeStage));
      container.querySelector('#ds_stageContent').innerHTML = canTableHtml(activeStage, 'can1') + canTableHtml(activeStage, 'can2');
      wireStageInputs(container);
    };
    container.querySelectorAll('#ds_stageTabs .ds-stage-tab').forEach(t => {
      t.addEventListener('click', () => { activeStage = t.dataset.stage; paintStage(); });
    });
    paintStage();
    wireIssueButtons(container);

    // header inputs
    container.querySelectorAll('[data-hkey]').forEach(inp => {
      inp.addEventListener('input', () => { state.header[inp.dataset.hkey] = inp.value; repaintDynamic(container); });
      inp.addEventListener('change', () => { state.header[inp.dataset.hkey] = inp.value; repaintDynamic(container); });
    });
    container.querySelector('#ds_comments').addEventListener('input', e => { state.comments = e.target.value; });
    SIGNOFF_KEYS.forEach(k => {
      const el = container.querySelector('#ds_' + k);
      if (el) el.addEventListener('input', () => { state[k] = el.value; });
    });
    container.querySelector('#ds_specSelect').addEventListener('change', e => {
      state.specProfileId = e.target.value;
      state.specVersionAtSave = null;
      repaintDynamic(container);
    });
    container.querySelector('#ds_manageSpecs').addEventListener('click', openSpecManager);

    if (ctx.locked) {
      container.querySelectorAll('input,select,textarea,button').forEach(el => { el.disabled = true; });
    }
    updateSubmitGate();
  }

  function read(container) {
    // state is kept live by the input handlers; also mirror key fields to the
    // top level for the engine's list / filter / traceability.
    const spec = currentSpec();
    if (state.specVersionAtSave == null && spec && spec.versionNumber != null) state.specVersionAtSave = spec.versionNumber;
    syncDerived();
    return {
      jobNo: state.header.jobNo, reportDate: state.header.reportDate, date: state.header.reportDate,
      batchCans: state.header.batchCans,
      specProfileId: state.specProfileId, specProfileName: currentProfileName(),
      specVersionAtSave: state.specVersionAtSave,
      header: JSON.parse(JSON.stringify(state.header)),
      stages: JSON.parse(JSON.stringify(state.stages)),
      comments: state.comments,
      completedBy: state.completedBy, completedSig: state.completedSig,
      completedDate: state.completedDate, completedBySignature: state.completedBySignature
    };
  }

  function validate(values, finalize) {
    const issues = evaluateRecord();
    if (specMismatchInfo()) return ['Acknowledge the updated specification before submitting.'];
    if (finalize && !PR.can('completeRecord')) return ['Your current role cannot submit a record as complete.'];
    return issues;
  }

  function summary(values) {
    const issues = evaluateRecord();
    return { inSpec: issues.length === 0, text: (values.batchCans || '(no batch)') + '  -  ' + (values.reportDate || '') };
  }

  const listColumns = [
    { label: 'Date', get: v => v.reportDate || '' },
    { label: 'Job no.', get: v => v.jobNo || '' },
    { label: 'Fujian batch (cans)', get: v => v.batchCans || '' },
    { label: 'Spec profile', get: v => v.specProfileName || '' }
  ];

  // ---- print sheet -------------------------------------------------------------
  function sheetHtml(entry, meta) {
    const v = entry.values || {};
    const h = v.header || {};
    const spec = specProfiles[v.specProfileId] || currentSpec();
    const headerRows = [
      ['Job no.', h.jobNo], ['AG Code', h.agCode], ['Date', h.reportDate], ['Can size', h.canSize],
      ['Date produced', h.dateProduced], ['Fujian batch (cans)', h.batchCans], ['Fujian batch (ends)', h.batchEnds],
      ['Micrometer serial', h.microSerial], ['Micrometer verified', h.microVerified],
      ['Gauge 1.21mm', h.gauge121], ['Gauge 3.00mm', h.gauge300]
    ].map(([l, val]) => '<tr><td class="sheet-lbl">' + esc(l) + '</td><td>' + esc(val || '') + '</td></tr>').join('');
    let stagesHtml = '';
    STAGES.forEach(st => {
      CANS.forEach(ck => {
        const can = (v.stages && v.stages[st.key] && v.stages[st.key][ck]) || blankCan();
        stagesHtml += '<h3>' + esc(st.label) + ' - ' + ck.toUpperCase() + ' (vacuum ' + esc(can.vacuum || '-') + ' kPa)</h3><table><thead><tr><th>Measurement</th><th>Pt 1</th><th>Pt 2</th><th>Pt 3</th></tr></thead><tbody>';
        ROWS.forEach(row => {
          stagesHtml += '<tr><td class="sheet-lbl">' + esc(row.label) + '</td>' +
            POINTS.map(i => '<td>' + esc((can.points && can.points[i] && can.points[i][row.key]) || '') + '</td>').join('') + '</tr>';
        });
        stagesHtml += '</tbody></table>';
      });
    });
    return '<table class="sheet-head"><tr><td class="sheet-logo" rowspan="3">' + esc((meta.meta && meta.meta.logoText) || 'ABAGOLD') + '</td>' +
      '<td class="sheet-lbl">Document:</td><td>' + esc(meta.docTitle) + '</td><td class="sheet-lbl">Doc number:</td><td>' + esc(meta.docCode) + '</td></tr>' +
      '<tr><td class="sheet-lbl">Spec profile:</td><td>' + esc(v.specProfileName || '') + ' (v' + (v.specVersionAtSave ?? '-') + ')</td>' +
      '<td class="sheet-lbl">Result:</td><td>' + (entry.inSpec === false ? 'DEVIATION' : 'In spec') + '</td></tr></table>' +
      '<table><tbody>' + headerRows + '</tbody></table>' + stagesHtml +
      '<table><tbody><tr><td class="sheet-lbl">Comments</td><td>' + esc(v.comments || '') + '</td></tr>' +
      '<tr><td class="sheet-lbl">Completed by</td><td>' + esc(v.completedBy || '') + ' &nbsp; ' + esc(v.completedDate || '') + '</td></tr></tbody></table>';
  }

  // ---- spec manager modal ----------------------------------------------------
  function buildSpecModal() {
    if (document.getElementById('ds_specModal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'ds_specModal';
    wrap.className = 'ds-modal-overlay';
    wrap.innerHTML =
      '<div class="ds-modal-inner">' +
        '<div id="ds_specListView">' +
          '<h2>Specifications</h2>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
            '<span class="ds-muted">Document revision: <strong id="ds_docRevInModal"></strong></span>' +
            '<button type="button" class="ds-btn-primary" id="ds_specAddNew">+ Add specification</button></div>' +
          '<div class="ds-history-list" id="ds_specListing"></div>' +
          '<h3>Document revision history</h3><div class="ds-history-list" id="ds_docRevHistory"></div>' +
          '<div class="ds-modal-actions"><button type="button" class="ds-btn-flat" id="ds_specClose">Close</button></div>' +
        '</div>' +
        '<div id="ds_specFormView" style="display:none;">' +
          '<h2 id="ds_specFormTitle">Add specification</h2>' +
          '<div class="ds-grid-2" style="display:grid;gap:10px;">' +
            '<label>Specification name / can type<input id="ds_sf_name" placeholder="e.g. Fujian 73x119mm EOA"></label>' +
            '<label>Attach original spec (PDF)<input id="ds_sf_pdf" type="file" accept="application/pdf"><span class="ds-muted" id="ds_sf_pdfStatus">No PDF attached</span></label>' +
          '</div>' +
          '<h3>Vacuum &amp; gauge</h3><div class="ds-grid">' +
            '<label>Vacuum minimum (kPa, must exceed)<input id="ds_sf_vacuum" type="number" step="0.1"></label>' +
            '<label>1.21mm gauge target<input id="ds_sf_gauge121" type="number" step="0.001"></label>' +
            '<label>3.00mm gauge target<input id="ds_sf_gauge300" type="number" step="0.001"></label></div>' +
          '<label style="max-width:220px;margin-top:8px;">Gauge tolerance (+/-mm)<input id="ds_sf_gaugeTol" type="number" step="0.001"></label>' +
          '<h3>Measurement points <span class="ds-muted">(blank = record only)</span></h3><div id="ds_sf_rows"></div>' +
          '<h3>Minimum-only checks</h3><div class="ds-grid">' +
            '<label>% Overlap minimum<input id="ds_sf_overlapPctMin" type="number" step="1"></label>' +
            '<label>Actual overlap minimum (mm)<input id="ds_sf_actualOverlapMin" type="number" step="0.01"></label>' +
            '<label>Tightness/wrinkle minimum (%)<input id="ds_sf_tightnessPctMin" type="number" step="1"></label></div>' +
          '<h3>Change attribution (required)</h3><div class="ds-grid">' +
            '<label>Reason for this change<input id="ds_sf_reason"></label>' +
            '<label>Your name<input id="ds_sf_changedBy"></label>' +
            '<label>Your title<input id="ds_sf_changedByTitle"></label></div>' +
          '<div class="ds-modal-actions"><button type="button" class="ds-btn-flat" id="ds_sf_cancel">Cancel</button>' +
            '<button type="button" class="ds-btn-primary" id="ds_sf_save">Save specification</button></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#ds_sf_rows').innerHTML = '<table><thead><tr><th style="text-align:left;">Measurement</th><th>Low</th><th>High</th></tr></thead><tbody>' +
      RANGE_ROWS.map(row => '<tr><td>' + esc(row.label) + ' (' + row.unit + ')</td>' +
        '<td><input type="number" step="0.001" id="ds_sf_' + row.key + '_min"></td>' +
        '<td><input type="number" step="0.001" id="ds_sf_' + row.key + '_max"></td></tr>').join('') + '</tbody></table>';
    wrap.querySelector('#ds_specClose').addEventListener('click', () => wrap.classList.remove('open'));
    wrap.querySelector('#ds_specAddNew').addEventListener('click', () => openSpecForm(null));
    wrap.querySelector('#ds_sf_cancel').addEventListener('click', closeSpecForm);
    wrap.querySelector('#ds_sf_save').addEventListener('click', saveSpecForm);
    wrap.querySelector('#ds_sf_pdf').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.type !== 'application/pdf') { mlCtx.toast('Please attach a PDF file.'); e.target.value = ''; return; }
      specFormPdfDataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      wrap.querySelector('#ds_sf_pdfStatus').textContent = 'Attached: ' + file.name;
      e.target.value = '';
    });
  }

  async function renderDocRev() {
    const rev = await window.DocumentRevision.getCurrent(DOC_REVISION_KEY, DOC_REVISION_START);
    const t = document.getElementById('ds_docRevInModal');
    if (t) t.textContent = 'Rev ' + rev;
    const hist = await window.DocumentRevision.history(DOC_REVISION_KEY);
    const el = document.getElementById('ds_docRevHistory');
    if (el) el.innerHTML = hist.length
      ? hist.map(h => '<div class="ds-history-item">Rev ' + h.revisionNumber + '  -  ' + new Date(h.changedAt).toLocaleString() + '  -  ' + esc(h.changedBy) + ' (' + esc(h.changedByTitle) + ')<br><span class="ds-muted">' + esc(h.reason) + '</span></div>').join('')
      : '<div class="ds-history-item ds-muted">No revisions logged yet (currently Rev ' + DOC_REVISION_START + ').</div>';
  }
  function renderSpecListing() {
    const canManage = PR.can('manageSpecs');
    const el = document.getElementById('ds_specListing');
    el.innerHTML = specIndex.map(s => {
      const spec = specProfiles[s.id] || {};
      return '<div class="ds-history-item" style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
        '<span>' + esc(s.name) + '  -  v' + (spec.versionNumber ?? '-') + (spec.pdfDataUrl ? '  -  <a href="#" data-pdf="' + esc(s.id) + '">PDF</a>' : '') + '</span>' +
        '<button type="button" class="ds-btn-flat" data-edit="' + esc(s.id) + '"' + (canManage ? '' : ' disabled') + '>Edit</button></div>';
    }).join('');
    el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openSpecForm(b.dataset.edit)));
    el.querySelectorAll('[data-pdf]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const sp = specProfiles[a.dataset.pdf]; if (sp && sp.pdfDataUrl) window.open(sp.pdfDataUrl, '_blank'); }));
    document.getElementById('ds_specAddNew').disabled = !canManage;
  }
  async function openSpecManager() {
    buildSpecModal();
    document.getElementById('ds_specListView').style.display = 'block';
    document.getElementById('ds_specFormView').style.display = 'none';
    document.getElementById('ds_specModal').classList.add('open');
    await renderDocRev();
    renderSpecListing();
  }
  function fillSpecForm(spec) {
    const g = id => document.getElementById(id);
    g('ds_sf_name').value = spec ? spec.name || '' : '';
    g('ds_sf_vacuum').value = spec && spec.vacuum ? spec.vacuum.value : -10;
    g('ds_sf_gauge121').value = spec ? (spec.gauge121Target ?? 1.21) : 1.21;
    g('ds_sf_gauge300').value = spec ? (spec.gauge300Target ?? 3.00) : 3.00;
    g('ds_sf_gaugeTol').value = spec ? (spec.gaugeTolerance ?? 0.02) : 0.02;
    RANGE_ROWS.forEach(row => {
      const range = spec ? spec[row.key] : null;
      g('ds_sf_' + row.key + '_min').value = (range && range.min != null) ? range.min : '';
      g('ds_sf_' + row.key + '_max').value = (range && range.max != null) ? range.max : '';
    });
    g('ds_sf_overlapPctMin').value = spec ? (spec.overlapPctMin ?? '') : '';
    g('ds_sf_actualOverlapMin').value = spec ? (spec.actualOverlapMin ?? '') : '';
    g('ds_sf_tightnessPctMin').value = spec ? (spec.tightnessPctMin ?? '') : '';
    specFormPdfDataUrl = spec ? (spec.pdfDataUrl || null) : null;
    g('ds_sf_pdfStatus').textContent = specFormPdfDataUrl ? 'PDF attached - choose a file to replace it' : 'No PDF attached';
    g('ds_sf_reason').value = '';
    g('ds_sf_changedBy').value = '';
    g('ds_sf_changedByTitle').value = (PR.ROLE_LABELS && PR.ROLE_LABELS[PR.getCurrentRole && PR.getCurrentRole()]) || '';
  }
  function openSpecForm(id) {
    if (!PR.can('manageSpecs')) { mlCtx.toast('You do not have permission to manage specifications.'); return; }
    specFormEditingId = id || null;
    fillSpecForm(id ? specProfiles[id] : null);
    document.getElementById('ds_specFormTitle').textContent = id ? 'Edit specification' : 'Add specification';
    document.getElementById('ds_specListView').style.display = 'none';
    document.getElementById('ds_specFormView').style.display = 'block';
  }
  function closeSpecForm() {
    document.getElementById('ds_specFormView').style.display = 'none';
    document.getElementById('ds_specListView').style.display = 'block';
  }
  function readSpecForm() {
    const g = id => document.getElementById(id);
    const data = { name: g('ds_sf_name').value.trim() || 'Untitled specification' };
    const vac = num(g('ds_sf_vacuum').value);
    data.vacuum = { op: 'gt', value: vac, label: vac != null ? '>' + vac + ' kPa' : '' };
    data.gauge121Target = num(g('ds_sf_gauge121').value);
    data.gauge300Target = num(g('ds_sf_gauge300').value);
    data.gaugeTolerance = num(g('ds_sf_gaugeTol').value);
    RANGE_ROWS.forEach(row => {
      const mn = num(g('ds_sf_' + row.key + '_min').value), mx = num(g('ds_sf_' + row.key + '_max').value);
      data[row.key] = (mn === null && mx === null) ? null : { min: mn === null ? undefined : mn, max: mx === null ? undefined : mx };
    });
    data.overlapPctMin = num(g('ds_sf_overlapPctMin').value);
    data.actualOverlapMin = num(g('ds_sf_actualOverlapMin').value);
    data.tightnessPctMin = num(g('ds_sf_tightnessPctMin').value);
    if (specFormPdfDataUrl) data.pdfDataUrl = specFormPdfDataUrl;
    return data;
  }
  async function saveSpecForm() {
    if (!PR.can('manageSpecs')) { mlCtx.toast('You do not have permission.'); return; }
    const g = id => document.getElementById(id);
    const reason = g('ds_sf_reason').value.trim();
    const changedBy = g('ds_sf_changedBy').value.trim();
    const changedByTitle = g('ds_sf_changedByTitle').value.trim();
    const data = readSpecForm();
    const id = specFormEditingId || ('spec_' + safeKey(data.name.toLowerCase()) + '_' + Date.now());
    try {
      const full = await window.SpecRegistry.proposeVersion(id, data, { changeReason: reason, publishedBy: changedBy, changedByTitle });
      specProfiles[id] = full;
      if (!specFormEditingId) specIndex.push({ id, name: data.name });
      else { const e = specIndex.find(s => s.id === id); if (e) e.name = data.name; }
      await storeSet('spec_profiles_index', JSON.stringify(specIndex));
      const rev = await window.DocumentRevision.bump(DOC_REVISION_KEY, { reason, changedBy, changedByTitle }, DOC_REVISION_START);
      if (!specFormEditingId) { state.specProfileId = id; state.specVersionAtSave = full.versionNumber; }
      closeSpecForm();
      await renderDocRev();
      renderSpecListing();
      refreshSpecUI();
      mlCtx.toast('Specification saved - document is now Rev ' + rev.revisionNumber + '.');
    } catch (e) { console.error('saveSpecForm', e); mlCtx.toast(e && e.message ? e.message : 'Could not save the specification.'); }
  }

  // ---- go ----------------------------------------------------------------------
  MonitoringLog.init({
    mount: '#mlRoot',
    recordKey: 'double-seam-inspection-report',
    docCode: 'REC 7.2.12',
    title: 'Double Seam Inspection Report',
    docRevisionStart: DOC_REVISION_START,
    batchField: 'jobNo',
    batchDateField: 'reportDate',
    stage: 'canning',
    deviationLabel: 'In spec',
    deviationPolarity: 'accurate',
    instructions: [
      { label: 'Measurement matrix', text: 'Record 2 cans x 3 points for each production stage (before / during / after). % B.H.B. and freespace are calculated from the point readings; % overlap and actual overlap are calculated per can.' },
      { label: 'Spec profiles', text: 'Choose the can-type spec profile (e.g. Fujian EOA vs NEO) at the top of the form. Manage specs adds or edits a profile and bumps this record's document revision.' },
      { label: 'Submitting', text: 'A record with any out-of-spec item, or an unacknowledged spec update, cannot be submitted as complete.' }
    ],
    customBody: {
      init: async (ctx) => {
        mlCtx = ctx;
        buildSpecModal();
        await loadSpecProfiles();
      },
      render,
      read,
      validate,
      summary,
      listColumns,
      sheetHtml
    }
  });
})();