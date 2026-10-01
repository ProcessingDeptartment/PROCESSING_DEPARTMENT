// REC 7.4.5 Closed Box Inspection: client extension for the shared form engine (form-record.js),
// switched on by `boxInspection: true` in the record config. Mirrors how EntryLog plugs in.
//
//  - refresh()          loads GET /api/closed-box/awaiting (closed boxes with no submitted inspection)
//  - mergeRows()        new record: every awaiting box becomes a roster row; draft: its saved rows plus
//                       any newly closed boxes; submitted: its saved rows only
//  - afterRender()      locks rows held by somebody else's draft ("Draft in progress")
//  - beforeSave()       drops untouched rows, validates started ones, warn-then-allow for the rest
// The pass value for every check is a ticked box. Nothing here is a gate on Save draft.
(function () {
  const CHECKS = ['colourUniform', 'sizeGradeCorrect', 'frillsPresent', 'bagSealed', 'boxSealed', 'silicaPresent'];
  const CHECK_LABELS = {
    colourUniform: 'Colour uniform', sizeGradeCorrect: 'Correct size grade', frillsPresent: 'Frills present',
    bagSealed: 'Bag sealed', boxSealed: 'Box sealed', silicaPresent: 'Silica satchets present',
  };
  // Nett weight must equal the 7.4.3 value to 2 decimals within this many kg (loosen here, no code change).
  const NETT_TOLERANCE_KG = 0.0;

  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const filled = (v) => String(v == null ? '' : v).trim() !== '';
  const ticked = (v) => v === 'Yes' || v === true;

  // A row is "started" once anything an inspector enters is present.
  function isStarted(r) {
    return filled(r.tareKg) || filled(r.nettKg) || filled(r.comment) || CHECKS.some((k) => ticked(r[k]));
  }

  // Pure. Returns { started, outstanding, problem } where problem is the first message that blocks
  // Submit (or null). `outstanding` are the untouched box codes.
  function evaluate(rows) {
    const started = rows.filter(isStarted);
    const outstanding = rows.filter((r) => !isStarted(r)).map((r) => r.boxCode);
    for (const r of started) {
      const tare = num(r.tareKg), nett = num(r.nettKg), set = num(r.nettKg743);
      if (!(tare > 0)) return { started, outstanding, problem: `Box ${r.boxCode}: tare weight is required.` };
      if (!(nett > 0)) return { started, outstanding, problem: `Box ${r.boxCode}: nett weight is required.` };
      if (set != null && Math.abs(Math.round(nett * 100) - Math.round(set * 100)) / 100 > NETT_TOLERANCE_KG + 1e-9) {
        return { started, outstanding, problem: `Box ${r.boxCode}: nett weight does not match 7.4.3 (7.4.3: ${set.toFixed(2)} kg).` };
      }
      const unticked = CHECKS.filter((k) => !ticked(r[k]));
      if (unticked.length && !filled(r.comment)) {
        return { started, outstanding, problem: `Box ${r.boxCode}: a comment is required because ${unticked.map((k) => CHECK_LABELS[k]).join(', ')} not ticked.` };
      }
    }
    return { started, outstanding, problem: null };
  }

  let awaiting = [];
  async function refresh() {
    try {
      const res = await window.FacilityApi.fetch('/api/closed-box/awaiting');
      const data = await res.json();
      if (res.ok && data.ok) awaiting = data.boxes || [];
    } catch (e) { console.warn('[box-inspection] could not load awaiting boxes', e); }
  }

  const fmt = (iso) => { try { return new Date(iso).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } };
  function toRow(b) {
    return {
      boxCode: b.boxCode, sizeGrade: b.sizeGrade || '', closedAt: fmt(b.closedAt), jobs: (b.jobs || []).join(', '),
      nettKg743: b.nettKg743 == null ? '' : Number(b.nettKg743).toFixed(2),
      note: b.draftSubmissionId ? 'Draft in progress' : (b.fromDraft ? 'From draft grading log' : ''),
      __draftId: b.draftSubmissionId || '',
    };
  }

  // existingRows: the record's saved rows (null for a new record). editingId: this record's id.
  function mergeRows(existingRows, locked, editingId) {
    const saved = (existingRows || []).slice();
    if (locked) return saved;
    const have = new Set(saved.map((r) => r.boxCode));
    awaiting.forEach((b) => {
      if (have.has(b.boxCode)) return;
      if (b.draftSubmissionId && b.draftSubmissionId === editingId) return;
      saved.push(toRow(b));
    });
    return saved;
  }

  function rowValues(row) {
    const v = {};
    row.querySelectorAll('input[id],select[id],textarea[id]').forEach((i) => {
      const m = /^fr_roster_\d+_(\w+?)(__cb)?$/.exec(i.id);
      if (m && !m[2]) v[m[1]] = i.value;
    });
    return v;
  }

  // Done: check this box, then open the next one at the top of the screen (focusing it collapses this one).
  function doneClick(row, container, toast) {
    const r = rowValues(row);
    if (!isStarted(r)) { toast('Enter the weights and ticks for this box first.'); return; }
    const ev = evaluate([r]);
    if (ev.problem) { toast(ev.problem); return; }
    let next = row.nextElementSibling;
    while (next && !(next.classList.contains('fr-roster-row') && next.dataset.biLocked !== '1')) next = next.nextElementSibling;
    const target = next && next.querySelector('[id$="_tareKg"]');
    if (!target) {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      toast('All boxes done. Fill in Sign off and Submit.');
      return;
    }
    const edit = next.querySelector('[data-roster-edit]');
    if (edit) edit.click();
    target.focus();
    target.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    setTimeout(() => next.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  }

  function afterRender({ container, locked, el, toast }) {
    if (document.getElementById('bi-style')) { /* already injected */ } else {
      const st = document.createElement('style');
      st.id = 'bi-style';
      st.textContent = '.fr-fixed-rows [data-remove-roster-row]{display:none}'
        + '.bi-row .fr-confirm input[type=checkbox]{width:44px;height:44px;margin:0 8px 0 0}'
        + '.bi-row .fr-confirm{display:flex;align-items:center;min-height:44px}'
        + '.bi-row[data-bi-locked="1"]{opacity:.55}'
        + '.bi-done{display:block;width:100%;min-height:48px;margin-top:12px;font-weight:600}'
        + '.bi-row.fr-roster-row-collapsed .bi-done{display:none}';
      document.head.appendChild(st);
    }
    container.querySelectorAll('.fr-roster-row').forEach((row) => {
      row.classList.add('bi-row');
      const code = row.querySelector('[id$="_boxCode"]');
      const note = row.querySelector('[id$="_note"]');
      if (!locked && note && note.value === 'Draft in progress') {
        row.dataset.biLocked = '1';
        row.querySelectorAll('input,select,textarea,button').forEach((i) => { i.disabled = true; });
        if (code) code.title = 'This box is in a saved draft of REC 7.4.5';
      }
      if (!locked && !row.dataset.biLocked && !row.querySelector('.bi-done')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fr-btn bi-done no-print';
        b.textContent = 'Done – next box';
        b.addEventListener('click', () => doneClick(row, container, toast));
        row.appendChild(b);
      }
    });
  }

  // Called by saveForm before persisting. `rows` is the live roster array: untouched rows are removed
  // from it IN PLACE so they are neither saved nor given a packing date. Returns false to abort.
  async function beforeSave({ finalize, values, rows, toast }) {
    // Rows held by another draft are never part of this record.
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].note === 'Draft in progress' && !isStarted(rows[i])) rows.splice(i, 1);
    const ev = evaluate(rows);
    if (finalize) {
      if (ev.problem) { toast(ev.problem); return false; }
      if (!ev.started.length) { toast('Inspect at least one box before submitting.'); return false; }
      if (ev.outstanding.length) {
        const list = ev.outstanding.slice(0, 15).join(', ') + (ev.outstanding.length > 15 ? ', ...' : '');
        const go = window.confirm(`${ev.outstanding.length} closed box${ev.outstanding.length === 1 ? '' : 'es'} on this list ${ev.outstanding.length === 1 ? 'has' : 'have'} not been inspected:\n${list}\n\nOK = Submit anyway (they stay on the list for the next record).\nCancel = Go back.`);
        if (!go) return false;
      }
      values.outstandingNote = ev.outstanding.length ? `Submitted with ${ev.outstanding.length} boxes outstanding: ${ev.outstanding.join(', ')}` : '';
    }
    // Only inspected boxes are kept on the record (draft and submit alike).
    for (let i = rows.length - 1; i >= 0; i--) if (!isStarted(rows[i])) rows.splice(i, 1);
    rows.forEach((r) => { delete r.__draftId; });
    return true;
  }

  window.BoxInspection = { refresh, mergeRows, afterRender, beforeSave, evaluate, isStarted, CHECKS };
  if (typeof module !== 'undefined') module.exports = window.BoxInspection;
})();
