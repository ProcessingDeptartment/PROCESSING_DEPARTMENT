// Entry-log extension for form-record.js (config.entryLog: true) -- built for REC 7.4.1 Drying Process.
// One submission = one ENTRY; every entry that shares a job number adds to that job's history. form-record.js
// calls attach() when the form is drawn, beforeSave() before every save, and sheetSection()/warningHtml() when
// printing. Everything here is driven by flags in the record definition (movement, recordSum, jobSequence,
// copyFromPrevious, changeReasonField, checkRanges, ...), so a second record could reuse it.
//
// What the browser does NOT decide: the entry date, each movement's date stamp, the lock on submitted entries,
// one-Yes-per-movement and the per-job steam numbers are all set by the server (src/drying-process-guard.js);
// this file only previews them and refuses obvious mistakes early.
(function () {
  'use strict';

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const blank = (v) => v == null || String(v).trim() === '';
  function fmtD(v) {
    if (blank(v)) return '';
    const s = String(v);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
    return isNaN(d) ? s : `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function fmtDT(v) {
    const d = new Date(v);
    return blank(v) || isNaN(d) ? '' : `${fmtD(d.toISOString())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const dayKey = (v) => { const d = new Date(v); return isNaN(d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const today = () => dayKey(new Date());

  const STYLE = `
  /* one type scale for everything this extension draws: 16px body (matches the inputs), 13px for secondary text */
  .el-panel{border:1px solid var(--palette-line,#d9d4c7);border-radius:6px;padding:10px 14px;margin-bottom:10px;background:#fff;font-size:16px}
  .el-muted{color:#6b665a;font-size:13px}
  .el-tbl{border-collapse:collapse;width:100%;font-size:15px;margin:4px 0 10px}
  .el-tbl th{font-size:13px;color:#6b665a;font-weight:700}
  .el-tbl th,.el-tbl td{border-bottom:1px solid #e6e2d6;padding:6px 8px;text-align:left}
  .el-last{font-size:16px;font-weight:700;margin:8px 0}
  .el-mv{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;border-bottom:1px solid #e6e2d6;padding:8px 2px;font-size:16px;min-height:52px}
  .el-mv.done{color:#5f5b50;background:#efede6}
  .el-mv.grey{color:#8a8577;background:#f6f4ee}
  .el-mv .el-muted{font-size:13px}
  .el-mv-q{font-weight:600;font-size:16px;flex:1 1 220px;margin:0}
  .el-mv-btns{display:flex;gap:8px;flex:0 0 auto}
  .el-mv-btns button{flex:0 0 84px !important;width:84px !important;min-width:0 !important;height:44px;min-height:44px !important;font-size:16px !important;padding:0 !important}
  .el-mv-btns button.on[data-v="Yes"]{background:#5f6670 !important;border-color:#5f6670 !important;color:#fff !important;font-weight:700}
  .el-mv-btns button.on[data-v="No"]{background:#d4d2cb !important;border-color:#9a978d !important;color:#33312b !important;font-weight:700}
  .el-note{font-size:13px;margin-top:4px;color:#6b665a;flex:1 1 100%}
  .el-note.warn{color:#8a5a10;font-weight:600}
  .el-note.bad{color:#b30000;font-weight:700}
  .el-suggest{color:#8a8577;font-style:italic}
  .el-warn{color:#b30000;font-weight:700;margin:8px 0}
  .el-link{background:none;border:0;color:#1a5fa8;text-decoration:underline;cursor:pointer;padding:0;font:inherit}
  `;
  function injectStyle() {
    if (document.getElementById('el-style')) return;
    const s = document.createElement('style'); s.id = 'el-style'; s.textContent = STYLE; document.head.appendChild(s);
  }

  // ---- config helpers ----
  function allFields(config) { const out = []; (config.sections || []).forEach((s) => (s.fields || []).forEach((f) => out.push(f))); return out; }
  function moveList(config) {
    return allFields(config).filter((f) => f.movement).map((f) => Object.assign({ flag: f.key, label: f.label }, f.movement))
      .sort((a, b) => a.order - b.order);
  }
  const jobKey = (config) => config.batchField || 'jobNo';
  const V = (e, k) => (e && e.values ? e.values[k] : undefined);
  const isDraft = (e) => e.status === 'draft';
  function whoOf(e) {
    const cb = e.completedBy;
    return cb ? (typeof cb === 'object' ? (cb.by || cb.title || '') : String(cb)) : '';
  }
  const entryAt = (e) => V(e, 'entryDate') || (e.submittedAt ? new Date(e.submittedAt).toISOString() : '') || (e.createdAt ? new Date(e.createdAt).toISOString() : '');

  // ---- the job's history, built from the other (submitted) entries ----
  function jobState(config, submissions, job, excludeId, beforeAt) {
    const jk = jobKey(config), moves = moveList(config);
    let entries = (submissions || []).filter((e) => e && !isDraft(e) && e.id !== excludeId && String(V(e, jk) || '').trim() === job && job);
    if (beforeAt) entries = entries.filter((e) => entryAt(e) < beforeAt);
    entries.sort((a, b) => String(entryAt(a)).localeCompare(String(entryAt(b))));
    const st = { entries, steams: [], moves: {}, trolleys: null, trolleysChanged: false };
    entries.forEach((e) => {
      moves.forEach((m) => { if (V(e, m.flag) === 'Yes' && !st.moves[m.key]) st.moves[m.key] = { entry: e, stamp: V(e, m.stamp) || '' }; });
      (e.roster || []).forEach((r) => { if (r) st.steams.push(Object.assign({ _entry: e }, r)); });
      const n = parseInt(V(e, 'noOfTrolleys'), 10);
      if (!isNaN(n) && n > 0) { if (st.trolleys != null && st.trolleys !== n) st.trolleysChanged = true; st.trolleys = n; }
    });
    st.steams.sort((a, b) => (parseInt(a.steamNo, 10) || 0) - (parseInt(b.steamNo, 10) || 0));
    st.maxSteam = st.steams.reduce((a, r) => Math.max(a, parseInt(r.steamNo, 10) || 0), 0);
    // 0 Loaded, 1 In dry room, 2 In container, 3 In grading room: the furthest movement done (grading can follow the dry room directly)
    st.stage = moves.reduce((a, m, i) => (st.moves[m.key] ? i + 1 : a), 0);
    return st;
  }
  const STAGES = ['Loaded', 'In dry room', 'In container', 'In grading room'];

  function lastSteamLine(st) {
    const r = st.steams[st.steams.length - 1];
    if (!r) return '';
    const bits = [`no. ${r.steamNo}`, fmtD(r.steamDate)];
    if (!blank(r.steamingTempC)) bits.push(`${r.steamingTempC} °C`);
    if (!blank(r.steamingTimeMin)) bits.push(`${r.steamingTimeMin} min`);
    if (!blank(r.startTime)) bits.push(`started ${r.startTime}`);
    return bits.join(', ');
  }
  function steamsTableHtml(steams) {
    if (!steams.length) return '';
    return `<table class="el-tbl"><thead><tr><th>Steam no.</th><th>Date</th><th>Temp (°C)</th><th>Time (min)</th><th>Start</th></tr></thead><tbody>`
      + steams.map((r) => `<tr><td>${esc(r.steamNo)}</td><td>${esc(fmtD(r.steamDate))}</td><td>${esc(r.steamingTempC || '')}</td><td>${esc(r.steamingTimeMin || '')}</td><td>${esc(r.startTime || '')}</td></tr>`).join('')
      + '</tbody></table>';
  }

  function stageStripHtml(st, moves) {
    return '<div class="el-stages">' + STAGES.map((name, i) => {
      const m = i > 0 ? moves[i - 1] : null;
      const hit = i === 0 || (m && st.moves[m.key]);
      const stamp = m && st.moves[m.key] ? fmtDT(st.moves[m.key].stamp) : '';
      return `<div class="el-stage${hit ? ' reached' : ''}${i === st.stage ? ' current' : ''}"><b>${esc(name)}</b>${esc(stamp)}</div>`;
    }).join('') + '</div>';
  }

  // Where the job is now (stage from the movements, plus the dry room area from the latest REC 7.4.2 check,
  // filled in by loadWhere) and the steam information. Nothing else.
  function whereText(st, moves) {
    const m = st.stage > 0 ? st.moves[moves[st.stage - 1].key] : null;
    return `<b>${esc(STAGES[st.stage])}</b>${m && m.stamp ? ` <span class="el-muted">since ${esc(fmtDT(m.stamp))}</span>` : ''}`;
  }
  function jobSoFarHtml(ctx, st, job) {
    if (!job) return '<div class="el-panel el-muted">Pick a job number to see where it is and its last steam.</div>';
    if (!st.entries.length) return '<div class="el-panel"><b>First entry for this job.</b> <span class="el-muted">Next steam number: 1</span></div>';
    const moves = moveList(ctx.config);
    const r = st.steams[st.steams.length - 1];
    const info = r ? [blank(r.steamingTempC) ? '' : r.steamingTempC + ' °C', blank(r.steamingTimeMin) ? '' : r.steamingTimeMin + ' min',
      blank(r.startTime) ? '' : 'started ' + r.startTime].filter(Boolean).join(', ') : '';
    const line = (k, v) => `<div style="margin:4px 0"><span class="el-muted" style="display:inline-block;min-width:150px">${k}</span> ${v}</div>`;
    return '<div class="el-panel">'
      + line('Location', `${whereText(st, moves)} <span id="el_where" class="el-muted"></span>`)
      + (st.trolleys != null ? line('Trolleys', `<b>${st.trolleys}</b>`) : '')
      + line('Last steam', r ? esc(fmtD(r.steamDate)) : '<span class="el-muted">No steams yet</span>')
      + (r ? line('Steam number', esc(r.steamNo || st.steams.length)) + line('Steam info', info ? esc(info) : '<span class="el-muted">not recorded</span>') : '')
      + line('Next steam number', `<b>${st.maxSteam + 1}</b>`)
      + '</div>';
  }


  // ---------------------------------------------------------------------------------------------
  function attach(ctx) {
    injectStyle();
    const { config, existing, locked, container, el } = ctx;
    const jk = jobKey(config);
    const jobEl = el('fr_f_' + jk);
    const moves = moveList(config);
    const rosterEl = el('fr_rosterRows');
    const ranges = config.checkRanges || {};
    let lastJob = null;
    let seq = 0;

    // saved-entry warning banner
    if (existing && existing.values && existing.values.warningAck) {
      const w = document.createElement('div'); w.className = 'el-warn';
      w.textContent = existing.values.warningNote || 'Entry submitted with a warning.';
      container.insertBefore(w, container.firstChild);
    }

    // a submitted entry is shown as the job stood at that entry (only earlier entries count)
    const state = () => jobState(config, ctx.submissions(), jobEl ? String(jobEl.value || '').trim() : '',
      existing && existing.id, locked && existing ? entryAt(existing) : undefined);
    const inp = (k) => el('fr_f_' + k);

    // ---- Job so far ----
    function drawPanel(st, job) {
      const box = el('fr_jobSoFar');
      if (!box) return;
      box.innerHTML = jobSoFarHtml(ctx, st, job);
      if (job && st.entries.length) loadWhere(job);
    }
    // the dry room area the job was last checked in (latest submitted REC 7.4.2 entry)
    async function loadWhere(job) {
      try {
        const raw = await ctx.storeGet('monitoring_log:dry-monitoring', true);
        let best = null;
        (raw ? JSON.parse(raw) : []).forEach((e) => {
          const v = (e && e.values) || {};
          if (!e || e.status === 'draft' || String(v.jobNo || '').trim() !== job || blank(v.dryRoomArea)) return;
          const at = v.entryDate || e.submittedAt || e.createdAt || 0;
          if (!best || String(at) > String(best.at)) best = { at, area: v.dryRoomArea };
        });
        const span = el('el_where');
        if (span && best && lastJob === job) span.textContent = `— ${best.area} (REC 7.4.2, ${fmtD(typeof best.at === 'number' ? new Date(best.at).toISOString() : best.at)})`;
      } catch (e) { /* the stage alone is shown */ }
    }

    // ---- Movements ----
    const yesNow = (k) => { const x = moves.find((y) => y.key === k); return !!x && (inp(x.flag) || {}).value === 'Yes'; };
    // why a movement cannot be asked right now ('' = it can): the earlier room is missing, or the grading room (final) is involved
    function blockedWhy(m, st) {
      if (m.requires && !st.moves[m.requires] && !yesNow(m.requires)) {
        return `Not yet — needs "${(moves.find((x) => x.key === m.requires) || {}).label}"`;
      }
      for (const k of (m.notAfter || [])) if (st.moves[k] || yesNow(k)) return 'Not possible — the grading room is the final room, nothing moves out of it';
      for (const k of (m.notWithInEntry || [])) if (yesNow(k)) return 'Not in the same entry as the dry container move — log the container move first';
      return '';
    }
    const canAsk = (m, st) => !blockedWhy(m, st);
    function isAdmin() {
      const r = window.Auth && window.Auth.getCurrentRole && window.Auth.getCurrentRole();
      return r === 'ADMINISTRATOR' || r === 'QA_MANAGER';
    }
    // steaming is closed once the job is in the grading room (moved earlier, or being moved in this entry)
    function syncSteamLock(st) {
      const g = moves.find((m) => m.key === 'gradingRoom');
      const inGrading = !!g && (!!st.moves[g.key] || (!locked && yesNow(g.key)));
      const closed = inGrading;
      const add = el('fr_addRosterRowBtn');
      if (add && !locked) add.style.display = closed ? 'none' : '';
      let note = el('el_steamLock');
      if (!note && rosterEl) { note = document.createElement('div'); note.id = 'el_steamLock'; note.className = 'el-note bad'; rosterEl.parentNode.insertBefore(note, rosterEl); }
      if (note) note.textContent = inGrading ? 'No steaming is possible — the job is in the grading room.' : '';
      st._steamClosed = closed;
    }

    function drawMovements(st) {
      const box = el('fr_movements');
      if (!box) return;
      const job = jobEl ? String(jobEl.value || '').trim() : '';
      box.innerHTML = moves.map((m) => {
        const flag = inp(m.flag), stamp = inp(m.stamp);
        const earlier = st.moves[m.key];
        if (earlier) {
          const e = earlier.entry;
          const rev = isAdmin() && !locked ? ` <button type="button" class="el-link" data-keep-enabled data-el-reverse="${esc(m.key)}">Admin: reverse</button>` : '';
          return `<div class="el-mv done"><b>${esc(m.done || m.label)}:</b> ${esc(fmtDT(earlier.stamp))} <span class="el-muted">(entry of ${esc(fmtD(entryAt(e)))}${whoOf(e) ? ', ' + esc(whoOf(e)) : ''})</span>${rev}</div>`;
        }
        if (locked) {
          const v = flag ? flag.value : '';
          if (v === 'Yes') return `<div class="el-mv done"><b>${esc(m.done || m.label)}:</b> ${esc(fmtDT(stamp && stamp.value))} <span class="el-muted">(this entry)</span></div>`;
          if (v === 'No') return `<div class="el-mv grey"><b>${esc(m.label)}:</b> answered No in this entry (did not happen yet)</div>`;
          return `<div class="el-mv grey"><b>${esc(m.label)}:</b> not answered</div>`;
        }
        if (!canAsk(m, st)) {
          if (flag) flag.value = '';
          return `<div class="el-mv grey"><b>${esc(m.label)}:</b> ${esc(blockedWhy(m, st))}</div>`;
        }
        const v = flag ? flag.value : '';
        return `<div class="el-mv"><div class="el-mv-q">${esc(m.question || m.label + '?')} <span class="el-note bad" style="display:${v === '' ? 'inline' : 'none'}">*</span></div>`
          + `<div class="el-mv-btns" role="radiogroup">`
          + ['Yes', 'No'].map((a) => `<button type="button" class="fr-btn fr-seg-btn${v === a ? ' on' : ''}" role="radio" aria-checked="${v === a}" data-el-mv="${esc(m.key)}" data-v="${a}">${a}</button>`).join('')
          + `</div>`
          + (v === 'Yes' ? `<div class="el-note">Will be stamped ${esc(fmtDT(new Date().toISOString()))} on submit — the date cannot be typed or changed.</div>` : '')
          + (v === 'No' ? '<div class="el-note">Did not happen in this entry — it stays a question on the next entry.</div>' : '')
          + `</div>`;
      }).join('');
      box.querySelectorAll('[data-el-mv]').forEach((b) => b.addEventListener('click', () => {
        const m = moves.find((x) => x.key === b.dataset.elMv);
        const flag = inp(m.flag); if (!flag) return;
        flag.value = b.dataset.v;
        // answering No on a movement resets any later movement answered Yes in this entry
        if (b.dataset.v !== 'Yes') moves.filter((x) => x.requires === m.key).forEach((x) => { const f = inp(x.flag); if (f) f.value = ''; });
        // a Yes here closes any movement this one excludes
        if (b.dataset.v === 'Yes') moves.filter((x) => (x.notAfter || []).indexOf(m.key) !== -1 || (x.notWithInEntry || []).indexOf(m.key) !== -1 || (m.notWithInEntry || []).indexOf(x.key) !== -1).forEach((x) => { const f = inp(x.flag); if (f) f.value = ''; });
        flag.dispatchEvent(new Event('input', { bubbles: true }));
        drawMovements(st);
        syncSteamLock(st);
      }));
      box.querySelectorAll('[data-el-reverse]').forEach((b) => b.addEventListener('click', async () => {
        const m = moves.find((x) => x.key === b.dataset.elReverse);
        const reason = prompt(`Reverse "${m.done || m.label}" for job ${job}?\nThis puts it back to an open question and is logged.\n\nReason:`);
        if (!reason || !reason.trim()) return;
        const name = prompt('Your name:', (window.Auth && window.Auth.getCurrentUsername && window.Auth.getCurrentUsername()) || '');
        if (!name || !name.trim()) return;
        try {
          const res = await window.FacilityApi.fetch('/api/drying-process/reverse-movement', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobNo: job, movement: m.key, reason: reason.trim(), name: name.trim() })
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) { alert(body.error || 'Could not reverse this movement.'); return; }
          await ctx.reload();
          ctx.toast('Movement reversed and logged.');
          refresh(true);
        } catch (e) { alert('Could not reach the server.'); }
      }));
    }

    // ---- Cooked weight (from REC 7.4.0 Cooking cards) ----
    async function loadCooked(job) {
      const f = allFields(config).find((x) => x.recordSum);
      if (!f) return;
      const rs = f.recordSum, target = inp(f.key), idsEl = inp(rs.idsField);
      const label = target && target.closest('label');
      if (!target || !label) return;
      let note = label.querySelector('.el-note');
      if (!note) { note = document.createElement('div'); note.className = 'el-note'; label.appendChild(note); }
      if (locked) { note.textContent = idsEl && idsEl.value ? rs.note + ' (saved with this entry)' : ''; return; }
      if (!job) { note.textContent = ''; return; }
      let pots = 0, kg = 0, drafts = 0; const ids = [];
      try {
        const raw = await ctx.storeGet('formrecord:' + rs.source, true);
        (raw ? JSON.parse(raw) : []).forEach((e) => {
          if (!e || String(V(e, rs.matchField) || '').trim() !== job) return;
          if (isDraft(e)) { drafts++; return; }
          let hit = false;
          (e.roster || []).forEach((r) => {
            if (r && (rs.filterIn || []).indexOf(r[rs.filterCol]) !== -1) { const n = parseFloat(r[rs.rosterCol]); if (!isNaN(n)) kg += n; pots++; hit = true; }
          });
          if (hit) ids.push(e.id);
        });
      } catch (e) { /* leave as is */ }
      if (jobEl && String(jobEl.value || '').trim() !== job) return; // job changed while loading
      if (pots) {
        target.value = String(Math.round(kg * 100) / 100); target.readOnly = true;
        if (idsEl) idsEl.value = ids.join(',');
        note.className = 'el-note';
        note.textContent = `${rs.note} — ${pots} cooking pot${pots === 1 ? '' : 's'}` + (drafts ? ` (${drafts} draft entr${drafts === 1 ? 'y' : 'ies'} ignored)` : '');
      } else {
        target.value = ''; target.readOnly = true; if (idsEl) idsEl.value = '';
        note.className = 'el-note warn';
        note.textContent = rs.missing + (drafts ? ` (${drafts} draft entr${drafts === 1 ? 'y' : 'ies'} ignored)` : '');
      }
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ---- Trolleys: asked ONCE, in a pop-up, when the first steam is added to a job with no count yet ----
    function askTrolleys() {
      return new Promise((resolve) => {
        const back = document.createElement('div');
        back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
        back.innerHTML = `<div role="dialog" aria-modal="true" style="background:#fff;border-radius:10px;padding:22px;max-width:420px;width:100%;font-size:16px">
          <div style="font-weight:700;font-size:18px;margin-bottom:6px">No. of trolleys</div>
          <div class="el-muted" style="margin-bottom:12px">Enter the number of trolleys for this job. It is set once and cannot be changed afterwards.</div>
          <input type="number" inputmode="numeric" min="1" step="1" style="width:100%;font-size:22px;padding:10px;border:1px solid #9a978d;border-radius:6px;box-sizing:border-box">
          <div class="el-note bad" data-err style="min-height:18px"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
            <button type="button" class="fr-btn fr-btn-flat" data-cancel>Cancel</button>
            <button type="button" class="fr-btn fr-btn-primary" data-ok>OK</button></div></div>`;
        document.body.appendChild(back);
        const input = back.querySelector('input'), err = back.querySelector('[data-err]');
        const done = (v) => { back.remove(); resolve(v); };
        const ok = () => { const n = parseInt(input.value, 10); if (!(n > 0)) { err.textContent = 'Enter a whole number of 1 or more.'; input.focus(); return; } done(n); };
        back.querySelector('[data-ok]').addEventListener('click', ok);
        back.querySelector('[data-cancel]').addEventListener('click', () => done(null));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } if (e.key === 'Escape') done(null); });
        setTimeout(() => { try { input.focus(); } catch (e) { /* ignore */ } }, 0);
      });
    }
    function wireTrolleys(st) {
      const t = inp('noOfTrolleys');
      if (!t || locked) return;
      if (st.trolleys != null) t.value = String(st.trolleys);   // already set on an earlier entry: carried, never edited
      const add = el('fr_addRosterRowBtn');
      if (!add || add._elAsk) return;
      add._elAsk = true;
      // capture phase: runs before the engine's own "+ Add steam" handler
      add.addEventListener('click', async (e) => {
        if (add._elGo) return;
        const cur = state(), have = cur.trolleys != null || parseInt(t.value, 10) > 0;
        if (have) return;
        e.stopImmediatePropagation(); e.preventDefault();
        const n = await askTrolleys();
        if (!n) return;
        t.value = String(n);
        t.dispatchEvent(new Event('input', { bubbles: true }));
        drawPanel(cur, lastJob);
        add._elGo = true; add.click(); add._elGo = false;
      }, true);
    }

    // ---- Steams: per-job numbering, previous steams, suggestions ----
    function wireSteams(st) {
      if (!rosterEl) return;
      
      const prevBox = rosterEl.parentNode.querySelector('#el_prevSteams') || (() => {
        const d = document.createElement('div'); d.id = 'el_prevSteams'; rosterEl.parentNode.insertBefore(d, rosterEl); return d;
      })();
      const last = lastSteamLine(st);
      prevBox.innerHTML = st.steams.length
        ? steamsTableHtml(st.steams)
        : '<div class="el-muted" style="margin:4px 0 8px">No earlier steams for this job.</div>';
      const rid = (i, k) => `fr_roster_${i}_${k}`;
      function apply() {
        const rows = rosterEl.querySelectorAll('.fr-roster-row');
        rows.forEach((row, i) => {
          const no = el(rid(i, 'steamNo'));
          const stored = locked && no && parseInt(no.value, 10) > 0 ? parseInt(no.value, 10) : 0;
          const num = stored || Math.max(1, st.maxSteam + i + 1);   // steam numbers start at 1: never blank, never 0
          if (no) { no.value = String(num); no.readOnly = true; }
          const title = row.querySelector('.fr-pot-title'); if (title) title.textContent = `Steam ${num}`;
          if (locked) return;
          const g = (k) => el(rid(i, k));
          if (g('steamDate') && blank(g('steamDate').value)) g('steamDate').value = today();   // never typed; the server dates it on submit
          const fresh = ['steamingTempC', 'steamingTimeMin', 'startTime'].every((k) => !g(k) || blank(g(k).value));
          if (!fresh) return;
          const src = i > 0 ? { steamingTempC: (el(rid(i - 1, 'steamingTempC')) || {}).value, steamingTimeMin: (el(rid(i - 1, 'steamingTimeMin')) || {}).value }
            : (st.steams.length ? st.steams[st.steams.length - 1] : {});
          ['steamingTempC', 'steamingTimeMin'].forEach((k) => {
            const c = g(k);
            if (c && !blank(src[k])) { c.value = String(src[k]); c.classList.add('el-suggest'); c.addEventListener('input', () => c.classList.remove('el-suggest'), { once: true }); }
          });
        });
      }
      rosterEl._onDraw = apply;
      apply();
    }

    function refresh(force) {
      const job = jobEl ? String(jobEl.value || '').trim() : '';
      if (job === lastJob && !force) return;
      lastJob = job;
      const st = state();
      drawPanel(st, job);
      drawMovements(st);
      syncSteamLock(st);
      wireTrolleys(st);
      wireSteams(st);
      syncSteamLock(st);
      loadCooked(job);
    }
    ctx._refresh = refresh;
    if (jobEl) ['input', 'change'].forEach((ev) => jobEl.addEventListener(ev, () => refresh(false)));
    refresh(true);
  }

  // ---------------------------------------------------------------------------------------------
  // Runs before every save. Draft saves are never blocked. On Submit: hard blocks first (toast, return
  // false), then one confirm listing the soft warnings; a confirmed override is stamped on the entry
  // (warningAck / warningNote) and shows as a red line on screen and print.
  async function beforeSave(x) {
    const { config, finalize, values, rosterRows, submissions, editingId, toast } = x;
    const rows = rosterRows || [];
    values.steamCount = String(rows.length);
    values.warningAck = ''; values.warningNote = '';
    if (!finalize) return true;
    const moves = moveList(config), ranges = config.checkRanges || {};
    const job = String(values[jobKey(config)] || '').trim();
    const st = jobState(config, submissions, job, editingId);

    // 2/5: every movement still shown as an open question is answered, in order
    for (const m of moves) {
      if (st.moves[m.key]) continue;
      const yes = (k) => values[moves.find((y) => y.key === k).flag] === 'Yes';
      const reqOk = !m.requires || st.moves[m.requires] || yes(m.requires);
      if (!reqOk) { if (values[m.flag] === 'Yes') { toast(`"${m.label}" needs "${moves.find((y) => y.key === m.requires).label}" first.`); return false; } continue; }
      const finalRoom = (m.notAfter || []).find((k) => st.moves[k] || yes(k));
      const clash = (m.notWithInEntry || []).find((k) => yes(k));
      if (finalRoom || clash) { if (values[m.flag] === 'Yes') { toast(`"${m.label}" is not possible here: ${finalRoom ? 'the grading room is the final room' : 'it cannot be in the same entry as the dry container move'}.`); return false; } continue; }
      if (values[m.flag] !== 'Yes' && values[m.flag] !== 'No') { toast(`Answer "${m.question || m.label + '?'}" Yes or No before submitting.`); return false; }
    }
    // 6: steam dates not in the future and not before the date into the dry room
    const dry = moves[0];
    const dryStamp = st.moves[dry.key] ? st.moves[dry.key].stamp : (values[dry.flag] === 'Yes' ? new Date().toISOString() : '');
    const dryDay = dryStamp ? dayKey(dryStamp) : '';
    for (let i = 0; i < rows.length; i++) {
      const d = String(rows[i].steamDate || '').slice(0, 10);
      if (!d) continue;
      const no = st.maxSteam + i + 1;
      if (d > today()) { toast(`Steam ${no} is dated ${fmtD(d)}, which is in the future (today is ${fmtD(today())}).`); return false; }
      if (dryDay && d < dryDay) { toast(`Steam ${no} is dated ${fmtD(d)}, before the date into the dry room (${fmtD(dryDay)}).`); return false; }
    }
    // the trolley count must be set before steaming
    if (rows.length && st.trolleys == null && !(parseInt(values.noOfTrolleys, 10) > 0)) { toast('Enter the No. of trolleys before steaming.'); return false; }
    // no steaming once the job is in (or going into) the grading room
    const gm = moves.find((m) => m.key === 'gradingRoom');
    if (gm && rows.length && (st.moves[gm.key] || values[gm.flag] === 'Yes')) { toast('No steaming is possible once the job is moved into the grading room. Remove the steam rows.'); return false; }
    // 7: cooked weight not greater than the whole weight
    const whole = parseFloat(values.jiIntakeWeight), cooked = parseFloat(values.cookedWeight);
    if (!isNaN(whole) && !isNaN(cooked) && cooked > whole) { toast(`Cooked weight (${cooked} kg) is more than the whole weight (${whole} kg).`); return false; }
    const n = parseInt(values.noOfTrolleys, 10);

    const warn = [];
    // 8: trolley count not recorded
    if ((isNaN(n) || n <= 0) && (values[dry.flag] === 'Yes' || st.trolleys == null)) warn.push('No. of trolleys not recorded');
    // 11: empty entry
    if (!moves.some((m) => values[m.flag] === 'Yes') && !rows.length) warn.push('Nothing recorded in this entry');
    // 12/13: steam rows
    const missing = [], odd = [];
    rows.forEach((r, i) => {
      const no = st.maxSteam + i + 1;
      if (blank(r.steamingTempC) || blank(r.steamingTimeMin) || blank(r.startTime)) missing.push(no);
      const t = parseFloat(r.steamingTempC), mn = parseFloat(r.steamingTimeMin);
      if (ranges.steamingTempC && !isNaN(t) && (t < ranges.steamingTempC[0] || t > ranges.steamingTempC[1])) odd.push(`steam ${no} temperature ${t} °C`);
      if (ranges.steamingTimeMin && !isNaN(mn) && (mn < ranges.steamingTimeMin[0] || mn > ranges.steamingTimeMin[1])) odd.push(`steam ${no} time ${mn} min`);
    });
    if (missing.length) warn.push(`Steam ${missing.join(', ')}: temperature, time or start time not filled in`);
    if (odd.length) warn.push(`Outside the normal range: ${odd.join(', ')}`);

    if (warn.length) {
      const ok = confirm('Please check before submitting:\n\n• ' + warn.join('\n• ') + '\n\nOK to submit anyway (this is recorded on the entry), or Cancel to go back?');
      if (!ok) return false;
      values.warningAck = 'Yes';
      values.warningNote = warn.join('; ');
    }
    return true;
  }

  // ---- printing ----
  function sheetSection(sec, sub, submissions, config) {
    const moves = moveList(config);
    const job = String(V(sub, jobKey(config)) || '').trim();
    const at = entryAt(sub);
    const st = jobState(config, submissions, job, sub.id, at);
    if (sec.jobSoFarPanel) {
      if (!job) return '';
      const last = lastSteamLine(st);
      return `<div><h3>${esc(sec.title)}</h3>` + (st.entries.length
        ? `<p>${st.entries.length} earlier entr${st.entries.length === 1 ? 'y' : 'ies'} · ${st.steams.length} steam(s) before this entry · stage before this entry: <b>${esc(STAGES[st.stage])}</b>`
          + (st.trolleys != null ? ` · trolleys before: ${st.trolleys}` : '') + '</p>'
          + (last ? `<p><b>Last steam:</b> ${esc(last)}</p>` : '') + steamsTableHtml(st.steams)
        : '<p>First entry for this job.</p>') + '</div>';
    }
    if (sec.movementBlock) {
      const rows = moves.map((m) => {
        const earlier = st.moves[m.key];
        let txt;
        if (earlier) txt = `${esc(fmtDT(earlier.stamp))} (entry of ${esc(fmtD(entryAt(earlier.entry)))}${whoOf(earlier.entry) ? ', ' + esc(whoOf(earlier.entry)) : ''})`;
        else if (V(sub, m.flag) === 'Yes') txt = `${esc(fmtDT(V(sub, m.stamp)))} (this entry)`;
        else if (V(sub, m.flag) === 'No') txt = 'Answered No in this entry (not yet)';
        else txt = 'Not yet';
        return `<tr><td class="fr-sheet-lbl">${esc(earlier || V(sub, m.flag) === 'Yes' ? (m.done || m.label) : m.label)}</td><td>${txt}</td></tr>`;
      }).join('');
      return `<div><h3>${esc(sec.title)}</h3><table><tbody>${rows}</tbody></table></div>`;
    }
    return '';
  }
  function warningHtml(sub) {
    if (!sub || !sub.values || !sub.values.warningAck) return '';
    return `<p style="color:#b30000;font-weight:bold;">${esc(sub.values.warningNote || 'Submitted with a warning.')}</p>`;
  }

  window.EntryLog = { attach, beforeSave, sheetSection, warningHtml, jobState, fmtDT, fmtD };
})();
