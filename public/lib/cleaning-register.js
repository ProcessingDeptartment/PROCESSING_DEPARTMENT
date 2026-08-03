/*
 * CLEANING REGISTER -- shared engine for the REC 7.6.x cleaning family.
 *
 * This is the THIRD record shape in the system, alongside:
 *   monitoring-log.js  -- periodic date/shift entry logs (temp, humidity, pH, water)
 *   form-record.js     -- single-event structured forms (CAR, traceability, supplier)
 * Neither fitted cleaning. Cleaning is a checklist against a CONTROLLED ITEM MASTER with
 * exception drill-down and two-level sign-off: form-record.js could only offer a free-text
 * roster, which is why the digitised REC 7.6.1 had lost all 175 of its enumerated line
 * items and had become "type the area name yourself". See cleaning-system-reference.html.
 *
 * === THE COMPRESSION, IN ONE SENTENCE ===
 * Pages are VIEWS. REC 7.6.1.1, REC 7.6.2 and REC 7.6.2.2 all open the SAME weekly
 * submission (same family, same date) and each renders its own slice of it -- so answering
 * "Retort inside: C" on the deep-clean page answers it on the weekly summary page too,
 * instead of being written out three times in one week as it was on paper.
 *
 * Families (config.family), which is what actually decides "same submission":
 *   'exec'    REC 7.6.0 a/b/c  -- the cleaner records that cleaning was DONE
 *   'daily'   REC 7.6.1        -- QC daily visual inspection
 *   'weekly'  REC 7.6.1.1 + REC 7.6.2 + REC 7.6.2.2 -- weekly deep clean, summary, dispatch
 * config.scope selects which item slice this page shows; config.zones narrows further
 * (that is how REC 7.6.0 a/b/c stay three distinct controlled documents while writing
 * into one record).
 *
 * Storage: window.storage under 'cleaning:<family>' (shared:true), same adapter and the
 * same backend seam as every other record -- see data-store.js.
 *
 * === SWAP POINT for hardware/AI ingestion ===
 * Every submission carries `source` ('manual' today), matching monitoring-log.js and
 * form-record.js, so an ATP reader or an image-based cleanliness check could later write
 * entries with source:'device' without a schema change.
 */
(function () {
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function uid(p) { return p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function today() { return new Date().toISOString().slice(0, 10); }

  const STYLE = `
  .cr-app{ font-family:'Segoe UI',system-ui,sans-serif; color:var(--palette-ink,#1b2330); background:var(--palette-paper,#f4f5f3); font-size:13px; line-height:1.4; }
  .cr-app *{ box-sizing:border-box; }
  .cr-app h1,.cr-app h2,.cr-app h3{ margin:0; font-weight:700; }
  .cr-app input,.cr-app select,.cr-app textarea{
    font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; font-size:12.5px; border:1px solid #c9cdd1;
    border-radius:3px; padding:5px 7px; background:#fff; color:var(--palette-ink,#1b2330); width:100%; }
  .cr-app input:focus,.cr-app select:focus,.cr-app textarea:focus{ outline:2px solid var(--palette-focus,#2f4356); outline-offset:-1px; }
  .cr-app button{ font-family:'Segoe UI',system-ui,sans-serif; cursor:pointer; border:none; border-radius:3px; font-weight:600; }
  .cr-top{ background:var(--palette-dark,#1d2b38); color:var(--palette-dark-text,#f4f1e8); padding:14px 18px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
  .cr-btn{ padding:7px 13px; font-size:12.5px; }
  .cr-btn-primary{ background:var(--palette-primary,#c9832b); color:var(--palette-primary-text,#241a0a); }
  .cr-btn-primary:hover{ background:var(--palette-primary-hover,#dd9536); }
  .cr-btn-flat{ background:#e2e4e3; color:#1b2330; }
  .cr-btn-flat:hover{ background:#d5d8d6; }
  .cr-btn-sm{ padding:4px 10px; font-size:10.5px; }
  .cr-btn:disabled{ opacity:.45; cursor:not-allowed; }
  .cr-body{ padding:16px 18px 60px; max-width:1400px; margin:0 auto; }
  .cr-panel{ background:#fff; border:1px solid var(--palette-border,#e2e4e3); border-radius:6px; margin-bottom:14px; }
  .cr-panel-head{ padding:9px 14px; border-bottom:1px solid var(--palette-border,#e2e4e3); display:flex; justify-content:space-between; align-items:center; background:var(--palette-head-bg,#fbfbfa); border-radius:6px 6px 0 0; gap:10px; flex-wrap:wrap; }
  .cr-panel-head h2{ font-size:12.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--palette-heading,#2f4356); }
  .cr-panel-body{ padding:14px; }
  .cr-note{ background:var(--palette-head-bg,#fbfbfa); border:1px solid var(--palette-border,#e2e4e3); border-left:3px solid var(--palette-heading,#2f4356); border-radius:4px; padding:9px 11px; font-size:11.5px; color:#54606b; margin-bottom:12px; }
  .cr-field{ display:flex; flex-direction:column; gap:3px; font-size:11.5px; color:var(--palette-label,#54606b); font-weight:600; }
  .cr-head-grid{ display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); }
  .cr-muted{ color:#8a939b; }

  /* ---- area cards: one tap per area is the whole point ---- */
  .cr-zone-title{ font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--palette-label,#54606b); font-weight:700; margin:16px 0 8px; padding-bottom:4px; border-bottom:1px solid var(--palette-border,#e2e4e3); }
  .cr-zone-title:first-child{ margin-top:0; }
  .cr-area{ border:1px solid var(--palette-border,#e2e4e3); border-radius:5px; margin-bottom:8px; background:#fff; }
  .cr-area.is-nc{ border-color:#c0392b; }
  .cr-area.is-ok{ border-color:#4a8f5b; }
  .cr-area-head{ display:flex; align-items:center; gap:10px; padding:8px 10px; flex-wrap:wrap; }
  .cr-area-name{ font-weight:700; font-size:12.5px; flex:1 1 200px; }
  .cr-area-sub{ display:block; font-weight:400; font-size:10.5px; color:#8a939b; }
  .cr-seg{ display:inline-flex; border:1px solid #c9cdd1; border-radius:4px; overflow:hidden; }
  .cr-seg button{ padding:6px 12px; font-size:11.5px; background:#fff; color:#54606b; border-right:1px solid #c9cdd1; min-width:44px; }
  .cr-seg button:last-child{ border-right:none; }
  .cr-seg button.on[data-v="C"]{ background:#4a8f5b; color:#fff; }
  .cr-seg button.on[data-v="NC"]{ background:#c0392b; color:#fff; }
  .cr-seg button.on[data-v="NA"]{ background:#8a939b; color:#fff; }
  .cr-area-body{ border-top:1px solid var(--palette-border,#e2e4e3); padding:8px 10px; }
  .cr-sub{ font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--palette-label,#54606b); font-weight:700; margin:8px 0 5px; }
  .cr-sub:first-child{ margin-top:0; }
  .cr-item{ display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:1px dotted #e2e4e3; flex-wrap:wrap; }
  .cr-item:last-child{ border-bottom:none; }
  .cr-item-label{ flex:1 1 220px; font-size:12px; }
  .cr-tag{ display:inline-block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; padding:1px 5px; border-radius:3px; margin-left:5px; vertical-align:middle; }
  .cr-tag-fcs{ background:#2f4356; color:#fff; }
  .cr-tag-swab{ background:#c9832b; color:#241a0a; }
  .cr-tag-freq{ background:#eceeed; color:#54606b; }
  .cr-tag-gap{ background:#fdecea; color:#c0392b; border:1px solid #e8b4ae; }
  .cr-detail{ flex:1 1 100%; display:grid; gap:6px; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); padding:7px; margin-top:4px; background:#fdf6f5; border:1px solid #f0d5d1; border-radius:4px; }
  .cr-meta{ font-size:10.5px; color:#8a939b; flex:1 1 100%; margin-top:2px; }

  .cr-summary{ display:flex; gap:14px; flex-wrap:wrap; font-size:11.5px; }
  .cr-summary b{ font-size:16px; display:block; color:var(--palette-heading,#2f4356); }
  table.cr-table{ width:100%; border-collapse:collapse; }
  table.cr-table th,table.cr-table td{ border:1px solid var(--palette-border,#e2e4e3); padding:5px 7px; text-align:left; font-size:11.5px; vertical-align:top; }
  table.cr-table th{ background:var(--palette-head-bg,#fbfbfa); font-size:10.5px; text-transform:uppercase; letter-spacing:.03em; color:var(--palette-label,#54606b); font-weight:700; }
  .cr-table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .cr-empty{ padding:18px; text-align:center; color:#8a939b; }
  .cr-filters{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
  .cr-filters input[type=date]{ width:auto; }
  .cr-actions{ display:flex; gap:10px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap; align-items:center; }
  .cr-signoffs{ font-size:11.5px; color:#54606b; }
  .cr-signoffs div{ padding:2px 0; }
  .cr-toast{ position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:var(--palette-dark,#1d2b38); color:#fff; padding:9px 18px; border-radius:20px; font-size:12px; z-index:999; opacity:0; pointer-events:none; transition:opacity .25s; }
  .cr-toast.show{ opacity:1; }

  @media (max-width:768px){
    .cr-top{ padding:10px 12px; }
    .cr-body{ padding:10px 12px 60px; }
    .cr-panel-body{ padding:10px; }
    .cr-app input,.cr-app select,.cr-app textarea{ font-size:16px; padding:8px; }
    .cr-seg button{ min-height:40px; min-width:52px; font-size:13px; }
    .cr-btn{ min-height:40px; }
    .cr-btn-sm{ min-height:32px; }
    .cr-area-head{ padding:8px; }
    .cr-actions .cr-btn{ flex:1 1 auto; }
  }
  @media print{
    /* The top margin is not ours to choose -- that strip is reserved for the repeating
     * controlled-copy title block. Stated as the margin shorthand because Chrome
     * drops the individual margin longhands inside @page. See doc-header.js. */
    @page{ size:A4 portrait; margin:26mm 12mm 12mm; }
    body{ background:#fff; }
    .no-print{ display:none !important; }
    .cr-app{ font-size:9.5px; }
    .cr-area{ break-inside:avoid; }
    .cr-table-wrap{ overflow:visible !important; }
    .cr-seg button:not(.on){ display:none; }
    .cr-seg{ border:none; }
  }`;

  function injectStyleOnce() {
    if (document.getElementById('cr-style')) return;
    const s = document.createElement('style');
    s.id = 'cr-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  async function storeGet(key) {
    try { const r = await window.storage.get(key, true); return r ? r.value : null; } catch (e) { return null; }
  }
  async function storeSet(key, value) {
    try { return await window.storage.set(key, value, true); } catch (e) { console.error('cleaning store set failed', e); return false; }
  }

  // ------------------------------------------------------------------ engine
  async function init(config) {
    if (window.LoginUI) await window.LoginUI.ensureAuthenticated();
    injectStyleOnce();

    const M = window.CleaningMaster;
    if (!M) { console.error('cleaning-register: CleaningMaster not loaded'); return; }

    const mount = typeof config.mount === 'string' ? document.querySelector(config.mount) : config.mount;
    mount.classList.add('cr-app');

    const family = config.family;                    // 'exec' | 'daily' | 'weekly'
    const scope = config.scope;                      // 'exec'|'daily'|'weekly'|'summary'|'dispatch'
    const storageKey = 'cleaning:' + family;
    const useShift = config.shift !== false;

    // The areas THIS page shows. Other pages in the same family show other slices of
    // the very same submission -- that is the single-entry mechanism.
    let areas = M.areasForScope(scope);
    if (config.zones && config.zones.length) {
      areas = areas.filter(function (ar) { return config.zones.indexOf(ar.zone) !== -1; });
    }

    let submissions = [];
    let current = null;          // the submission open in the editor
    let dirty = false;

    function toast(msg) {
      const t = el('cr_toast'); t.textContent = msg;
      t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2400);
    }

    async function load() {
      const raw = await storeGet(storageKey);
      try { submissions = raw ? JSON.parse(raw) : []; } catch (e) { submissions = []; }
    }
    async function persist() { return storeSet(storageKey, JSON.stringify(submissions)); }

    // ---- submission helpers -------------------------------------------------
    function findSubmission(date, shift) {
      return submissions.find(function (s) {
        return s.date === date && (useShift ? (s.shift || '') === (shift || '') : true);
      }) || null;
    }

    function blankSubmission(date, shift) {
      return {
        id: uid('cln'),
        family: family,
        date: date,
        shift: useShift ? shift : '',
        masterVersion: M.meta.version,
        standardChecksVersion: M.STANDARD_CHECKS_VERSION,
        // Which views have contributed. Lets the reference page and an auditor see that
        // one weekly submission carries REC 7.6.1.1 + 7.6.2 + 7.6.2.2.
        contributingDocs: [],
        areas: {},
        signOffs: [],
        source: 'manual',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        history: []
      };
    }

    function areaState(sub, areaId) {
      if (!sub.areas[areaId]) sub.areas[areaId] = { std: '', stdChecks: {}, items: {} };
      const st = sub.areas[areaId];
      if (!st.stdChecks) st.stdChecks = {};
      if (!st.items) st.items = {};
      return st;
    }
    function itemState(sub, areaId, itemId) {
      const st = areaState(sub, areaId);
      if (!st.items[itemId]) st.items[itemId] = { s: '', nc: '', corr: '', due: '', swab: '', car: '' };
      return st.items[itemId];
    }

    // ---- open non-conformances across the whole page slice ------------------
    function collectNCs(sub) {
      const out = [];
      if (!sub) return out;
      areas.forEach(function (ar) {
        const st = sub.areas[ar.id];
        if (!st) return;
        if (st.std === 'NC') {
          M.STANDARD_CHECKS.forEach(function (c) {
            if (st.stdChecks[c.id] === 'NC') {
              out.push({ area: ar.label, item: c.label, kind: 'standard', d: st.items['std:' + c.id] || {} });
            }
          });
          if (!M.STANDARD_CHECKS.some(function (c) { return st.stdChecks[c.id] === 'NC'; })) {
            out.push({ area: ar.label, item: 'Area marked NC — no failing check selected', kind: 'standard', d: {} });
          }
        }
        // General items are only ever answered inside an NC drill-down; food contact
        // items are always answered, so both are picked up by walking every item.
        ar.items.forEach(function (it) {
          const d = st.items[it.id];
          if (d && d.s === 'NC') out.push({ area: ar.label, item: it.label, kind: 'item', d: d });
        });
      });
      return out;
    }

    // Controls the inspector actually has to touch: one per area (covering the standard
    // checks and the general items) plus every food contact item individually.
    function progress(sub) {
      let total = 0, done = 0;
      areas.forEach(function (ar) {
        const st = sub ? sub.areas[ar.id] : null;
        const crit = ar.items.filter(function (it) { return it.fcs; });
        const hasRollup = ar.standardChecks || ar.items.length > crit.length;
        if (hasRollup) { total += 1; if (st && st.std) done += 1; }
        crit.forEach(function (it) {
          total += 1;
          if (st && st.items[it.id] && st.items[it.id].s) done += 1;
        });
      });
      return { total: total, done: done };
    }

    // ---- rendering ----------------------------------------------------------
    function segHtml(name, value, disabled) {
      return ['C', 'NC', 'NA'].map(function (v) {
        return `<button type="button" data-seg="${esc(name)}" data-v="${v}" class="${value === v ? 'on' : ''}" ${disabled ? 'disabled' : ''}>${v === 'NA' ? 'N/A' : v}</button>`;
      }).join('');
    }

    function ncDetailHtml(key, d, opts) {
      d = d || {};
      opts = opts || {};
      return `<div class="cr-detail">
        <label class="cr-field">Finding
          <input type="text" data-d="${esc(key)}:nc" value="${esc(d.nc)}" placeholder="What was found"></label>
        <label class="cr-field">Correction taken
          <input type="text" data-d="${esc(key)}:corr" value="${esc(d.corr)}" placeholder="What was done"></label>
        <label class="cr-field">Corrective action due
          <input type="date" data-d="${esc(key)}:due" value="${esc(d.due)}"></label>
        <label class="cr-field">CAR ref (REC 8.1.1.a)
          <input type="text" data-d="${esc(key)}:car" value="${esc(d.car)}" placeholder="If repeat NC"></label>
        ${opts.swab ? `<label class="cr-field">Swab / ATP result
          <input type="text" data-d="${esc(key)}:swab" value="${esc(d.swab)}" placeholder="Pass / Fail / RLU"></label>` : ''}
      </div>`;
    }

    function itemRowHtml(ar, it, st) {
      const d = st.items[it.id] || {};
      const tags = [
        `<span class="cr-tag cr-tag-freq">${esc(it.freq)}</span>`,
        it.fcs ? '<span class="cr-tag cr-tag-fcs">Food contact</span>' : '',
        it.verify === 'swab' ? '<span class="cr-tag cr-tag-swab">Swab</span>' : '',
        (it.fcs && !it.chemical) ? '<span class="cr-tag cr-tag-gap">No chemical on file</span>' : ''
      ].join('');
      const meta = [
        it.chemical ? 'Chemical: ' + it.chemical : null,
        it.concentration ? 'Conc: ' + it.concentration : null,
        it.contactTime ? 'Contact: ' + it.contactTime : null,
        it.method ? 'Method: ' + it.method : null,
        it.note ? it.note : null
      ].filter(Boolean).join(' · ');
      return `<div class="cr-item">
        <span class="cr-item-label">${esc(it.label)}${tags}</span>
        <span class="cr-seg">${segHtml('item:' + ar.id + ':' + it.id, d.s)}</span>
        ${meta ? `<span class="cr-meta">${esc(meta)}</span>` : ''}
        ${d.s === 'NC' ? ncDetailHtml('item:' + ar.id + ':' + it.id, d, { swab: it.verify === 'swab' }) : ''}
      </div>`;
    }

    // An area's items split two ways, and the split is what makes the compression safe:
    //   CRITICAL (food contact surfaces) -- always shown, always ticked individually.
    //     These are the ones an auditor wants individual attention on, so they are never
    //     rolled up, no matter how clean the shift was.
    //   GENERAL (housekeeping observations: "no bins on the floor", "board clean")
    //     -- roll into the single area control alongside the 12 standard checks, and
    //     expand only when the area is marked NC.
    function splitItems(ar) {
      const crit = [], gen = [];
      ar.items.forEach(function (it) { (it.fcs ? crit : gen).push(it); });
      return { crit: crit, gen: gen };
    }

    function areaCardHtml(ar) {
      const st = areaState(current, ar.id);
      const cls = st.std === 'NC' ? ' is-nc' : (st.std === 'C' ? ' is-ok' : '');
      const parts = splitItems(ar);
      let body = '';

      // The exception drill-down. Everything below only exists on screen when the area
      // has actually been marked NC -- which is the whole reduction. The standard-check
      // list is versioned in the master and its version is stamped onto the saved
      // submission, so a record from any date can be replayed against the exact list
      // that was in force that day.
      if (st.std === 'NC') {
        if (ar.standardChecks) {
          body += `<div class="cr-sub">Standard checks — mark the failing one(s)</div>`;
          body += M.STANDARD_CHECKS.map(function (c) {
            const key = 'std:' + ar.id + ':' + c.id;
            const d = st.items['std:' + c.id] || {};
            return `<div class="cr-item">
              <span class="cr-item-label">${esc(c.label)}</span>
              <span class="cr-seg">${segHtml(key, st.stdChecks[c.id])}</span>
              ${st.stdChecks[c.id] === 'NC' ? ncDetailHtml(key, d) : ''}
            </div>`;
          }).join('');
        }
        if (parts.gen.length) {
          body += `<div class="cr-sub">Area items — mark the failing one(s)</div>`;
          body += parts.gen.map(function (it) { return itemRowHtml(ar, it, st); }).join('');
        }
      }

      if (parts.crit.length) {
        if (body) body += `<div class="cr-sub">Food contact surfaces — always recorded individually</div>`;
        body += parts.crit.map(function (it) { return itemRowHtml(ar, it, st); }).join('');
      }

      const covers = [
        ar.standardChecks ? M.STANDARD_CHECKS.length + ' standard checks' : null,
        parts.gen.length ? parts.gen.length + ' area items' : null
      ].filter(Boolean).join(' + ');

      return `<div class="cr-area${cls}" data-area="${esc(ar.id)}">
        <div class="cr-area-head">
          <span class="cr-area-name">${esc(ar.label)}
            <span class="cr-area-sub">${covers ? 'Area conforms? Covers ' + esc(covers) + '.' : 'Food contact items only'}</span></span>
          ${covers ? `<span class="cr-seg">${segHtml('std:' + ar.id, st.std)}</span>` : '<span class="cr-meta no-print">—</span>'}
        </div>
        ${body ? `<div class="cr-area-body">${body}</div>` : ''}
      </div>`;
    }

    function renderEditor() {
      const wrap = el('cr_editor');
      if (!current) { wrap.innerHTML = `<div class="cr-empty">Choose a date${useShift ? ' and shift' : ''} above, then press Open.</div>`; return; }

      const byZone = {};
      areas.forEach(function (ar) { (byZone[ar.zone] = byZone[ar.zone] || []).push(ar); });

      let html = '';
      M.ZONES.forEach(function (z) {
        const list = byZone[z.id];
        if (!list || !list.length) return;
        html += `<div class="cr-zone-title">${esc(z.label)}</div>`;
        html += list.map(areaCardHtml).join('');
      });
      wrap.innerHTML = html || `<div class="cr-empty">No areas in scope for this record.</div>`;
      bindEditor();
      renderStatus();
    }

    function renderStatus() {
      const p = progress(current);
      const ncs = collectNCs(current);
      el('cr_status').innerHTML = current
        ? `<div class="cr-summary">
             <span>Completed<b>${p.done} / ${p.total}</b></span>
             <span>Non-conformances<b>${ncs.length}</b></span>
             <span>Areas on this record<b>${areas.length}</b></span>
           </div>`
        : '';
      const canSign = window.Auth && window.Auth.isAuthenticated();
      el('cr_signoffs').innerHTML = current && current.signOffs.length
        ? current.signOffs.map(function (s) {
            return `<div>${esc(s.action)} — ${esc(s.by)} (${esc(s.byRole)}) · ${esc(String(s.at).slice(0, 16).replace('T', ' '))}</div>`;
          }).join('')
        : (canSign
            ? '<div class="cr-muted">Not signed off yet.</div>'
            : '<div style="color:#c0392b">Sign-off unavailable — no user is logged in. Drafts still save.</div>');
    }

    function bindEditor() {
      const wrap = el('cr_editor');
      wrap.querySelectorAll('[data-seg]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const parts = btn.dataset.seg.split(':');
          const v = btn.dataset.v;
          if (parts[0] === 'std' && parts.length === 2) {
            const st = areaState(current, parts[1]);
            st.std = (st.std === v) ? '' : v;
            if (st.std !== 'NC') {
              // Leaving NC collapses the drill-down, so its answers must go too --
              // otherwise a hidden NC would sit in the saved record with nothing on
              // screen to show it.
              st.stdChecks = {};
              const ar = areas.find(function (x) { return x.id === parts[1]; });
              if (ar) ar.items.forEach(function (it) { if (!it.fcs) delete st.items[it.id]; });
              Object.keys(st.items).forEach(function (k) { if (k.indexOf('std:') === 0) delete st.items[k]; });
            }
          } else if (parts[0] === 'std' && parts.length === 3) {
            const st = areaState(current, parts[1]);
            st.stdChecks[parts[2]] = (st.stdChecks[parts[2]] === v) ? '' : v;
          } else if (parts[0] === 'item') {
            const d = itemState(current, parts[1], parts[2]);
            d.s = (d.s === v) ? '' : v;
          }
          dirty = true;
          renderEditor();
        });
      });
      wrap.querySelectorAll('[data-d]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          const raw = inp.dataset.d;
          const field = raw.slice(raw.lastIndexOf(':') + 1);
          const key = raw.slice(0, raw.lastIndexOf(':'));
          const parts = key.split(':');
          let d;
          if (parts[0] === 'std') {
            const st = areaState(current, parts[1]);
            d = st.items['std:' + parts[2]] = st.items['std:' + parts[2]] || {};
          } else {
            d = itemState(current, parts[1], parts[2]);
          }
          d[field] = inp.value;
          dirty = true;
        });
      });
    }

    function renderList() {
      const wrap = el('cr_list');
      const list = submissions.slice().sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt;
      }).slice(0, 40);
      if (!list.length) { wrap.innerHTML = `<div class="cr-empty">No cleaning records saved yet.</div>`; return; }
      let html = `<table class="cr-table"><thead><tr><th>Date</th>${useShift ? '<th>Shift</th>' : ''}<th>Recorded on</th><th>NCs</th><th>Sign-offs</th><th></th></tr></thead><tbody>`;
      list.forEach(function (s) {
        let ncCount = 0;
        Object.keys(s.areas || {}).forEach(function (aid) {
          const st = s.areas[aid];
          if (st.std === 'NC') ncCount += 1;
          Object.keys(st.items || {}).forEach(function (k) { if (st.items[k].s === 'NC') ncCount += 1; });
        });
        html += `<tr>
          <td>${esc(s.date)}</td>
          ${useShift ? `<td>${esc(s.shift || '—')}</td>` : ''}
          <td>${esc((s.contributingDocs || []).join(', ') || '—')}</td>
          <td>${ncCount || '—'}</td>
          <td>${(s.signOffs || []).length}</td>
          <td><button class="cr-btn cr-btn-flat cr-btn-sm" data-open-sub="${esc(s.id)}">Open</button></td>
        </tr>`;
      });
      html += `</tbody></table>`;
      wrap.innerHTML = html;
      wrap.querySelectorAll('[data-open-sub]').forEach(function (b) {
        b.addEventListener('click', function () {
          const s = submissions.find(function (x) { return x.id === b.dataset.openSub; });
          if (!s) return;
          el('cr_date').value = s.date;
          if (useShift) el('cr_shift').value = s.shift || '';
          openSubmission();
        });
      });
    }

    function openSubmission() {
      const date = el('cr_date').value;
      if (!date) { toast('Pick a date first.'); return; }
      const shift = useShift ? el('cr_shift').value : '';
      let sub = findSubmission(date, shift);
      if (!sub) {
        sub = blankSubmission(date, shift);
        submissions.push(sub);
        toast('New record started for ' + date + '.');
      } else {
        const others = (sub.contributingDocs || []).filter(function (d) { return d !== config.docCode; });
        if (others.length) toast('Opened the existing record — already part-filled from ' + others.join(', ') + '.');
      }
      current = sub;
      dirty = false;
      renderEditor();
    }

    async function save(signAction) {
      if (!current) { toast('Nothing open to save.'); return; }

      // A non-conformance without a correction is the failure mode auditors look for.
      const open = collectNCs(current).filter(function (n) { return !String(n.d.corr || '').trim(); });
      if (open.length && signAction === 'verified') {
        toast(open.length + ' non-conformance(s) have no correction recorded.');
        return;
      }

      // Sign-off is only meaningful if it can be attributed to a person. Login is
      // currently disabled system-wide (login-ui.js ensureAuthenticated is a no-op), so
      // Auth.createSignOff() returns null and nothing would actually be recorded. Refuse
      // rather than report a signature that does not exist.
      if (signAction && !(window.Auth && window.Auth.isAuthenticated())) {
        toast('Cannot sign — no user is logged in. Sign-off needs login, which is disabled system-wide.');
        return;
      }

      if (signAction === 'verified') {
        const performed = (current.signOffs || []).filter(function (s) { return s.action !== 'verified'; });
        const user = window.Auth.getCurrentUsername();
        if (!performed.length) { toast('This record has not been signed by the person who did the check yet.'); return; }
        // Doer must not be the verifier -- FSSC wants independent verification.
        if (performed.some(function (s) { return s.by === user; })) {
          toast('Verification must be done by someone other than the person who did the check.');
          return;
        }
      }

      if (current.contributingDocs.indexOf(config.docCode) === -1) current.contributingDocs.push(config.docCode);
      current.updatedAt = Date.now();
      current.masterVersion = M.meta.version;
      current.standardChecksVersion = M.STANDARD_CHECKS_VERSION;

      if (signAction && window.Auth && window.Auth.isAuthenticated()) {
        const so = window.Auth.createSignOff(signAction);
        if (so) { so.doc = config.docCode; current.signOffs.push(so); }
      }

      const ok = await persist();
      if (!ok) { toast('Save failed — please retry.'); return; }
      dirty = false;
      renderList();
      renderStatus();
      toast(signAction ? 'Saved and signed as ' + signAction + '.' : 'Saved.');
    }

    // ---- shell --------------------------------------------------------------
    const gapCount = M.itemsMissingChemical().length;

    mount.innerHTML = `
      <div class="cr-top">
        <div class="doc-line">
          <span class="doc-code">${esc(config.docCode)}</span>
          <h1>${esc(config.title)}</h1>
          <span class="doc-rev" id="cr_docRev"></span>
        </div>
      </div>
      <div class="cr-body">
        <div class="cr-note no-print">
          <strong>${esc(config.docCode)}</strong> is a view over the shared cleaning item master
          (${M.counts().areas} areas, ${M.counts().items} items). ${esc(config.viewNote || '')}
          Items are never retyped — frequency, chemical and method come from the master.
          <a href="cleaning-system-reference.html">Why the cleaning records were restructured →</a>
        </div>

        ${(config.instructions || []).length ? `<div class="cr-panel no-print">
          <div class="cr-panel-head"><h2>Work instruction</h2></div>
          <div class="cr-panel-body">${config.instructions.map(function (t) { return `<p style="margin:0 0 6px">${esc(t)}</p>`; }).join('')}</div>
        </div>` : ''}

        <div class="cr-panel">
          <div class="cr-panel-head">
            <h2>Record</h2>
            <div id="cr_status"></div>
          </div>
          <div class="cr-panel-body">
            <div class="cr-head-grid no-print">
              <label class="cr-field">Date<input type="date" id="cr_date" value="${today()}"></label>
              ${useShift ? `<label class="cr-field">Shift<select id="cr_shift"><option value="Day">Day</option><option value="Night">Night</option></select></label>` : ''}
              <label class="cr-field">&nbsp;<button class="cr-btn cr-btn-primary" id="cr_openBtn">Open / start</button></label>
              <label class="cr-field">&nbsp;<button class="cr-btn cr-btn-flat" id="cr_printBtn">Print</button></label>
            </div>
            <div id="cr_editor" style="margin-top:12px"></div>
            <div class="cr-actions no-print">
              <div class="cr-signoffs" id="cr_signoffs" style="margin-right:auto"></div>
              <button class="cr-btn cr-btn-flat" id="cr_saveBtn">Save draft</button>
              <button class="cr-btn cr-btn-flat" id="cr_signBtn">Sign as ${esc(config.performLabel || 'inspected')}</button>
              <button class="cr-btn cr-btn-primary" id="cr_verifyBtn">Verify</button>
            </div>
          </div>
        </div>

        <div class="cr-panel no-print">
          <div class="cr-panel-head"><h2>Recent records (${esc(family)} family)</h2></div>
          <div class="cr-panel-body"><div id="cr_list" class="cr-table-wrap"></div></div>
        </div>

        ${gapCount ? `<div class="cr-panel no-print">
          <div class="cr-panel-head"><h2>Open document-control gap</h2></div>
          <div class="cr-panel-body cr-note" style="margin:0">
            ${gapCount} food contact item(s) have no cleaning chemical recorded in the master, and no
            item anywhere has a concentration or contact time — the source documents never stated any.
            FSSC (ISO/TS 22002-1 §11.2) expects cleaning agents and their conditions of use to be
            documented. These are left blank deliberately rather than guessed.
            <a href="cleaning-system-reference.html#gaps">See the full gap list →</a>
          </div>
        </div>` : ''}
      </div>
      <div class="cr-toast no-print" id="cr_toast"></div>
    `;

    // Surface the fact that no signature can be attributed today, rather than letting a
    // record be "signed" by nobody. This is a system-wide state, not specific to cleaning.
    if (!(window.Auth && window.Auth.isAuthenticated())) {
      el('cr_signBtn').disabled = true;
      el('cr_verifyBtn').disabled = true;
      el('cr_signoffs').innerHTML = '<div style="color:#c0392b">Sign-off unavailable — no user is logged in. Drafts still save.</div>';
    }

    el('cr_openBtn').addEventListener('click', openSubmission);
    el('cr_printBtn').addEventListener('click', function () { window.print(); });
    el('cr_saveBtn').addEventListener('click', function () { save(null); });
    el('cr_signBtn').addEventListener('click', function () { save(config.performAction || 'inspected'); });
    el('cr_verifyBtn').addEventListener('click', function () { save('verified'); });
    window.addEventListener('beforeunload', function (e) {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });

    const rev = await DocumentRevision.getCurrent(config.recordKey, config.docRevisionStart || 1);
    const revDate = await DocumentRevision.getCurrentDate(config.recordKey, config.docRevisionDate);
    el('cr_docRev').textContent = `Rev ${rev} · Rev date ${revDate || 'not set'}`;

    await mountDocHeader(config);

    await load();
    renderList();
    renderEditor();
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

  window.CleaningRegister = { init: init };
})();
