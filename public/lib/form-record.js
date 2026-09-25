(function () {
  function el(id) { return document.getElementById(id); }

  // Shared libs loaded on demand from next to this engine: the job picker (search -> confirm
  // popup -> collapse) and JobStatus, which a few record pages never include themselves.
  const LIB_BASE = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, '') : '../lib/';
  })();
  const libLoads = {};
  function loadLib(file, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (!libLoads[file]) {
      libLoads[file] = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = LIB_BASE + file;
        s.onload = () => resolve(window[globalName] || null);
        s.onerror = () => { delete libLoads[file]; resolve(null); };
        document.head.appendChild(s);
      });
    }
    return libLoads[file];
  }
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
  /* Long lists (submissions, verification queue, verification history) are collapsed
     behind a reveal button so a record opens as a form, not as a wall of rows. */
  .fr-collapsible{ display:none; }
  .fr-collapsible.ml-open, .fr-collapsible.fr-open{ display:block; }
  .fr-reveal-btn{ margin:0 0 10px; }
  .fr-instructions{ display:grid; gap:8px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .fr-instructions .instr-item{ background:var(--palette-head-bg,#fbfbfa); border:1px solid var(--palette-border,#e2e4e3); border-radius:4px; padding:8px 10px; }
  .fr-instructions .instr-item strong{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--palette-label,#54606b); margin-bottom:3px; }
  /* Work instructions are collapsed by default on every viewport -- they are reference
     text, not the task, and push the actual form down the page. One click to read them. */
  .fr-instr-toggle{ display:inline-block; }
  .fr-instr-panel > .fr-panel-body{ display:none; }
  .fr-instr-panel.fr-open > .fr-panel-body{ display:block; }
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
  /* Roster recordpick status badges -- same classes/colors as submissions-log.html so a picked
     record's state reads consistently across pages. */
  .badge{ display:inline-block; padding:2px 8px; border-radius:20px; font-size:10.5px; font-weight:700; white-space:nowrap; }
  .badge-warn{ background:#fbe8e6; color:#a3352d; }
  .badge-ok{ background:#e8f3ec; color:#2f7a52; }
  .badge-muted{ background:#eee; color:#777; }
  .badge-info{ background:#e6eefb; color:#1d4ed8; }
  .fr-recordpick{ display:flex; flex-direction:column; gap:4px; }
  .fr-recordpick a.rec{ color:var(--palette-primary,#c9832b); text-decoration:none; font-weight:600; font-size:11px; }
  .fr-recordpick a.rec:hover{ text-decoration:underline; }
  .fr-upload{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
  .fr-upload-info{ font-size:11.5px; color:#8a939b; }
  .fr-upload a.fr-upload-dl{ color:var(--palette-primary,#c9832b); text-decoration:none; font-weight:600; font-size:11px; }
  .fr-upload a.fr-upload-dl:hover{ text-decoration:underline; }
  .fr-locked{ padding:8px 11px; margin-bottom:10px; border-left:3px solid var(--palette-ok,#2f6b3a); background:var(--palette-ok-bg,#e4f0e6); color:var(--palette-ok,#2f6b3a); font-size:11.5px; font-weight:600; }
  .fr-notice{ display:none; padding:8px 12px; border-radius:4px; font-size:11.5px; font-weight:600; margin-bottom:10px; }
  .fr-notice.show{ display:block; }
  .fr-notice-due{ background:var(--palette-fail-bg,#fbe8e6); color:var(--palette-fail,#a3352d); border:1px solid #e8b8b3; }
  .fr-notice-provisional{ background:#fbf0dc; color:#8a5a10; border:1px solid #e8d3a8; }
  .fr-app input.fr-provisional,.fr-app select.fr-provisional{ background:#fdf7ea; border-color:#d9ac5a; }
  .fr-history-list{ max-height:220px; overflow:auto; border:1px solid var(--palette-border,#e2e4e3); border-radius:4px; }
  .fr-history-item{ padding:7px 10px; border-bottom:1px solid var(--palette-border,#e2e4e3); display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:11.5px; }
  .fr-history-item:last-child{ border-bottom:none; }
  .fr-section-title{ font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--palette-label,#54606b); margin:14px 0 8px; }
  .fr-section-title:first-child{ margin-top:0; }
  .fr-section-collapsible{ margin:14px 0 8px; }
  .fr-section-collapsible:first-child{ margin-top:0; }
  .fr-section-collapsible > .fr-section-title{ cursor:pointer; margin:0 0 8px; list-style:none; }
  .fr-section-collapsible > .fr-section-title::-webkit-details-marker{ display:none; }
  .fr-section-collapsible > .fr-section-title::before{ content:'\\25B8'; display:inline-block; width:1em; transition:transform .15s; }
  .fr-section-collapsible[open] > .fr-section-title::before{ content:'\\25BE'; }
  .fr-section-summary{ font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; text-transform:none; letter-spacing:0; color:var(--palette-ink,#1b2330); font-weight:700; }
  .fr-section-summary:not(:empty){ margin-left:8px; }
  .fr-roster-row{ display:flex; gap:8px; align-items:flex-end; margin-bottom:6px; flex-wrap:wrap; }
  .fr-roster-row .fr-field{ flex:1; }
  /* A row the operator has finished collapses to a one-line summary; "Edit" reopens it. */
  .fr-roster-row-collapsed > .fr-field,
  .fr-roster-row-collapsed > [data-remove-roster-row]{ display:none; }
  .fr-roster-summary{ flex:1 1 100%; display:flex; gap:12px; align-items:center; padding:3px 0;
    font-size:12.5px; color:var(--palette-ink,#1b2330); }
  .fr-roster-summary-text{ font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; }
  @media print{ .fr-roster-summary{ display:none; }
    .fr-roster-row-collapsed > .fr-field, .fr-roster-row-collapsed > [data-remove-roster-row]{ display:block; } }
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
    /* Tablet type scale + finger-sized tap targets (iPad portrait sits above
       the 768px phone breakpoint). */
    .fr-app{ font-size:14px; }
    .fr-field{ font-size:13.5px; }
    .fr-field span.hint{ font-size:12px; }
    .fr-panel-head h2{ font-size:13.5px; }
    .fr-app input,.fr-app select,.fr-app textarea{ font-size:15px; min-height:44px; }
    .fr-app table.fr-table input,.fr-app table.fr-table select,.fr-app table.fr-table textarea{ font-size:13px; min-height:0; }
    .fr-btn{ min-height:44px; }
  }
  @media (max-width:900px){ .fr-grid-2,.fr-grid-3,.fr-grid-4{grid-template-columns:1fr;} }
  @media (max-width:768px){
    .fr-top{ padding:10px 12px; gap:10px; }
    .fr-body{ padding:10px 12px 60px; }
    .fr-panel-head{ padding:8px 10px; }
    .fr-panel-body{ padding:10px; }
    /* >=16px stops iOS Safari zooming the page on focus. Inputs inside the
       submissions table stay compact -- that table scrolls instead. */
    .fr-app input,.fr-app select,.fr-app textarea{ font-size:16px; padding:8px; min-height:44px; }
    .fr-app table.fr-table input,.fr-app table.fr-table select,.fr-app table.fr-table textarea{ font-size:13px; padding:4px; min-height:0; }
    /* Label text, section titles and instructions scale up too -- 11-12px is
       unreadable on a phone without zooming. Field labels hit the 16px
       readable-without-zooming floor; hints/headers step down but stay legible. */
    .fr-app{ font-size:16px; }
    .fr-field{ font-size:16px; }
    .fr-field span.hint{ font-size:13px; }
    .fr-panel-head h2{ font-size:15px; }
    .fr-section-title{ font-size:14px; }
    .fr-instructions .instr-item strong{ font-size:13px; }
    .fr-btn{ min-height:44px; font-size:16px; }
    /* Small/secondary buttons still get a 44px tap target -- padding makes
       up the difference rather than the visible box growing. */
    .fr-btn-sm{ min-height:44px; padding:10px 14px; font-size:14px; }
    /* Y/N/None toggle buttons -- undersized (32px/12px) at the default scale;
       give them the same 44px tap target as every other button on a phone. */
    .ml-yesno button{ min-height:44px; font-size:15px; padding:10px; }
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
  .fr-sheet{ display:none; color:#000; font-family:'Segoe UI',system-ui,sans-serif; font-size:12px; }
  .fr-sheet .fr-sheet-page{ page-break-after:always; }
  .fr-sheet .fr-sheet-page:last-child{ page-break-after:auto; }
  .fr-sheet h3{ font-size:12px; text-transform:uppercase; letter-spacing:.05em; margin:9px 0 4px; font-weight:400; }
  .fr-sheet h3:first-child{ margin-top:0; }
  .fr-sheet table{ width:100%; border-collapse:collapse; margin-bottom:7px; }
  .fr-sheet td,.fr-sheet th{ border:1px solid #000; padding:3px 5px; vertical-align:top; text-align:left; font-size:12px; color:#000; }
  .fr-sheet th{ background:#eee; font-weight:700; }
  .fr-sheet td.fr-sheet-lbl{ font-weight:700; width:26%; }
  .fr-sheet .fr-sheet-sign td{ height:26px; font-size:14px; }
  .fr-sheet .fr-sheet-sign td.fr-sheet-lbl{ width:13%; }
  .fr-sheet .fr-sheet-sign{ page-break-inside:avoid; break-inside:avoid; }
  @media print{
    @page{ size:A4; margin:12mm;
      @bottom-right{ content:"Page " counter(page) " of " counter(pages); font-family:'Segoe UI',system-ui,sans-serif; font-size:10px; color:#4a4a4a; }
    }
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
  .ml-yesno button{ flex:1; padding:7px 10px; font-size:12px; min-height:32px; border:1px solid #c9cdd1 !important; background:#fff; color:#54606b; }
  .ml-yesno button:hover:not(:disabled){ border-color:#8a939b !important; }
  /* Which answer is "good" (green) vs "bad" (red) varies by question -- set via
     data-good="Yes"|"No" on the .ml-yesno span (defaults to Yes when absent). */
  .ml-yesno[data-good="Yes"] button.on[data-v="Yes"], .ml-yesno[data-good="No"] button.on[data-v="No"], .ml-yesno:not([data-good]) button.on[data-v="Yes"]{ background:var(--palette-ok-bg,#e8f3ec); border-color:var(--palette-ok,#2f7a52) !important; color:var(--palette-ok,#2f7a52); }
  .ml-yesno[data-good="Yes"] button.on[data-v="No"], .ml-yesno[data-good="No"] button.on[data-v="Yes"], .ml-yesno:not([data-good]) button.on[data-v="No"]{ background:var(--palette-fail-bg,#fbe8e6); border-color:var(--palette-fail,#a3352d) !important; color:var(--palette-fail,#a3352d); }
  .ml-yesno button:disabled{ opacity:.55; cursor:not-allowed; }
  .fr-jobnumber{ display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
  .fr-jobnumber select{ width:auto; min-width:70px; }
  .fr-jobnumber input.fr-jn-digits{ width:auto; flex:1; min-width:80px; }
  .fr-jn-hint{ font-size:10.5px; font-weight:500; color:#8a939b; font-family:'IBM Plex Mono',monospace; }
  .fr-jn-hint.bad{ color:var(--palette-fail,#a3352d); }
  .fr-roster-totals{ font-size:11px; color:#54606b; margin-top:6px; font-weight:600; }
  /* fr-compact: one fixed field size (a quarter of the form) for everything that isn't free
     data entry -- a roster's quick-capture line, all-computed sections (totals), Completed by. */
  .fr-grid.fr-compact, .rt-content .fr-grid.fr-compact, body.rt-pc .rt-content .fr-grid.fr-compact{
    grid-template-columns:repeat(4,minmax(0,1fr)); align-items:end; }
  @media (max-width:699px){ .fr-grid.fr-compact, .rt-content .fr-grid.fr-compact, body.rt-pc .rt-content .fr-grid.fr-compact{
    grid-template-columns:repeat(2,minmax(0,1fr)); } }
  .fr-quick-entry{ margin:4px 0 12px; }
  .fr-quick-entry .fr-qe-btn .fr-btn{ width:100%; white-space:nowrap; }
  /* captured rows under a quick-capture line: one slim line each, same columns as the line above
     (its labels are the headings), no per-row card */
  .fr-qe-list .fr-roster-row, .rt-content .fr-qe-list .fr-roster-row, body.rt-pc .rt-content .fr-qe-list .fr-roster-row{
    display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-auto-flow:row; gap:0 18px; align-items:center;
    padding:6px 0; margin:0; border:0; border-top:1px solid var(--rt-border,#e3e6e4); border-radius:0; background:transparent; }
  @media (max-width:699px){ .fr-qe-list .fr-roster-row, .rt-content .fr-qe-list .fr-roster-row{ grid-template-columns:repeat(2,minmax(0,1fr)) 44px; gap:0 10px; } }
  .fr-qe-list .fr-roster-row > .fr-field, .rt-content .fr-qe-list .fr-roster-row > .fr-field{ font-size:0; gap:0; }
  .fr-qe-list .fr-roster-row > .fr-field input, .rt-content .fr-qe-list .fr-roster-row > .fr-field input{ font-size:15px; min-height:38px; }
  .fr-qe-list .fr-roster-row [data-remove-roster-row], .rt-content .fr-qe-list .fr-roster-row [data-remove-roster-row],
  body.rt-pc .rt-content .fr-qe-list .fr-roster-row [data-remove-roster-row]{
    grid-column:auto; justify-self:start; width:44px; min-height:38px; padding:0; }`;

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
    try { return await window.storage.set(key, value, shared) !== false; }
    catch (e) { console.error('storage set failed', e); return false; }
  }


  // Split a saved job number into the prefix dropdown + digits the field is drawn from. Prefixes come
  // from the same list the dropdown offers (Lookups.jobPrefixes: 3CP, 3DP, CPR, DPR -- two of them
  // START WITH A DIGIT, which the old letters-only pattern could not split, so a saved 3CP/3DP job
  // number loaded back blank). Longest prefix first; the pattern below covers a list that has not
  // loaded yet, with an optional leading digit for the same reason.
  function splitJobNo(value) {
    const s = String(value || '').trim().toUpperCase();
    const list = (window.Lookups ? window.Lookups.get('jobPrefixes') : []) || [];
    const known = list.slice().sort((a, b) => b.length - a.length)
      .find((p) => s.startsWith(p) && /^\d*$/.test(s.slice(p.length)));
    if (known) return { prefix: known, digits: s.slice(known.length) };
    const m = s.match(/^(\d?[A-Z]{2,3})(\d*)$/);
    return m ? { prefix: m[1], digits: m[2] } : { prefix: '', digits: '' };
  }


  function diffHHMM(from, to) {
    const mins = (s) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(s == null ? '' : s).trim());
      return m ? (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) : null;
    };
    const a = mins(from), b = mins(to);
    if (a == null || b == null) return '';
    let d = b - a;
    if (d < 0) d += 24 * 60;
    return String(Math.floor(d / 60)).padStart(2, '0') + ':' + String(d % 60).padStart(2, '0');
  }


  function lookupMapValue(mapName, key) {
    try {
      const m = window.Lookups && window.Lookups.lists && window.Lookups.lists[mapName];
      return (m && key != null && m[String(key)]) || '';
    } catch (e) { return ''; }
  }


  // Roster batch-sequence numbering: <date>-<01> per row (2-digit, resets each date), not
  // <jobNo>/<n> -- a job can span several processing dates and the date-based code is what's
  // written on the salt/tumble batch tags on the floor. Which field supplies the date is
  // configurable via roster.batchSeqDateField (default 'date'); falls back to '#01' if that
  // field is still blank.
  function formatBatchSeq(dateVal, i) {
    const seq = String(i + 1).padStart(2, '0');
    dateVal = String(dateVal == null ? '' : dateVal).trim();
    return dateVal ? dateVal + '-' + seq : '#' + seq;
  }

  // A `numlist` cell holds several weights in one box ("12.4 + 11.9 + 12.1"). Its value is their sum;
  // null when the cell is blank or any part isn't a number.
  function sumNumList(v) {
    const parts = String(v == null ? '' : v).split(/[+,;\s]+/).filter(Boolean);
    if (!parts.length) return null;
    let total = 0;
    for (const p of parts) {
      if (!/^-?\d+(\.\d+)?$/.test(p)) return null;
      total += parseFloat(p);
    }
    return total;
  }

  function computeRowDerived(col, row) {
    if (col.deriveDuration) return diffHHMM(row[col.deriveDuration.from], row[col.deriveDuration.to]);
    if (col.deriveLookup) return lookupMapValue(col.deriveLookup.map, row[col.deriveLookup.from]);
    // deriveJoin: { parts: ['sizeGrade','binNo'], sep: '-' } -> "8g-10g-1"; blank until every part is filled.
    if (col.deriveJoin) {
      const parts = col.deriveJoin.parts.map(k => String(row[k] == null ? '' : row[k]).trim());
      return parts.every(Boolean) ? parts.join(col.deriveJoin.sep == null ? '-' : col.deriveJoin.sep) : '';
    }
    // deriveSum: { add: [...], subtract: [...], require: [...], dp } -- numlist-aware; a missing
    // non-required input counts as 0, a missing required one leaves the result blank.
    if (col.deriveSum) {
      const s = col.deriveSum;
      if ((s.require || []).some(k => sumNumList(row[k]) === null)) return '';
      let total = 0;
      (s.add || []).forEach(k => { total += sumNumList(row[k]) || 0; });
      (s.subtract || []).forEach(k => { total -= sumNumList(row[k]) || 0; });
      return total.toFixed(s.dp == null ? 2 : s.dp);
    }
    return row[col.key] || '';
  }

  // Sum of a roster column over the rows, optionally only those matching sumRosterWhere
  // ({ sizeGrade: '8g-10g' }) -- used by computed top-level fields.
  function sumRosterRows(f, rows) {
    const where = f.sumRosterWhere || null;
    return rows.reduce((sum, r) => {
      if (where && Object.keys(where).some(k => String(r[k] || '').trim() !== String(where[k]))) return sum;
      const n = sumNumList(r[f.sumRosterColumn]);
      return sum + (n === null ? 0 : n);
    }, 0);
  }

  function fmtDDMMYYYY(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const pad = n => String(n).padStart(2, '0');
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  // A picked record's status comes from two possible sources that disagree on vocabulary:
  // the older per-row index snapshot (status: 'draft'|'submitted', plus a separate verified/
  // verifiedDate pair written at index time) and the server's /api/trace endpoint, which joins
  // live verification state server-side and returns status: 'draft'|'submitted'|'verified'
  // (see attachSubmissionStatus in src/index.js) without touching verified/verifiedDate. Treat
  // status === 'verified' as verified even when the separate `verified` flag wasn't set.
  function recordpickVerified(status, verified) { return status === 'verified' || !!verified; }
  function recordpickAttached(status) { return status === 'submitted' || status === 'verified'; }

  // The 4-state model a picked roster record can be in -- reused wherever a recordpick status
  // badge is rendered (initial HTML and after wireRecordPick updates it on pick/refresh).
  function recordpickBadgeHtml(value, status, verified, verifiedDate) {
    if (!value) return '<span class="badge badge-muted">Not attached</span>';
    if (!recordpickAttached(status)) return '<span class="badge badge-info">Draft — not yet submitted</span>';
    if (!recordpickVerified(status, verified)) return '<span class="badge badge-warn">Awaiting verification</span>';
    const dateStr = verifiedDate ? fmtDDMMYYYY(verifiedDate) : '';
    return '<span class="badge badge-ok">Verified' + (dateStr ? ' (' + esc(dateStr) + ')' : '') + '</span>';
  }

  function fieldInputHtml(id, field, value, row) {
    const v = value == null ? '' : value;
    row = row || {};

      const ro = field.readOnly ? ' readonly' : '';

      if (field.type === 'jobsearch') {
        return `<select id="${id}" data-jobsearch="1"${field.route ? ` data-route="${esc(field.route)}"` : ''}>` +
          (v ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : '<option value="">—</option>') +
          `</select>`;
      }

      if (field.type === 'computed') {
        return `<input type="text" id="${id}" value="${esc(v)}" disabled>`;
      }
      if (field.type === 'jobnumber') {
        const parts = splitJobNo(v);
        const prefixes = ['', ...(window.Lookups ? window.Lookups.get('jobPrefixes') : [])];
        const validate = field.validate !== false;
        return `<span class="fr-jobnumber" data-jobnumber-for="${id}" data-validate="${validate}">
            <select class="fr-jn-prefix">${prefixes.map(p => `<option value="${esc(p)}" ${p === parts.prefix ? 'selected' : ''}>${p || '—'}</option>`).join('')}</select>
            <input type="text" class="fr-jn-digits" inputmode="numeric" placeholder="Digits" value="${esc(parts.digits)}">
            <input type="hidden" id="${id}" value="${esc(v)}">
            <span class="fr-jn-hint"></span>
          </span>`;
      }
      if (field.type === 'yesno') {
        return `<span class="ml-yesno" data-yesno-for="${id}" data-good="${field.good === 'No' ? 'No' : 'Yes'}" role="radiogroup">
            <button type="button" role="radio" data-v="" class="${v === '' ? 'on' : ''}" aria-checked="${v === '' ? 'true' : 'false'}" tabindex="${v === '' ? 0 : -1}">None</button>
            <button type="button" role="radio" data-v="Yes" class="${v === 'Yes' ? 'on' : ''}" aria-checked="${v === 'Yes' ? 'true' : 'false'}" tabindex="${v === 'Yes' ? 0 : -1}">Y</button>
            <button type="button" role="radio" data-v="No" class="${v === 'No' ? 'on' : ''}" aria-checked="${v === 'No' ? 'true' : 'false'}" tabindex="${v === 'No' ? 0 : -1}">N</button>
            <input type="hidden" id="${id}" value="${esc(v)}">
          </span>`;
      }

      if (field.type === 'recordpick') {
        const trace = field.source === 'jobtrace' || field.source === 'bintrace';
        const status = row['__' + field.key + '_status'] || '';
        const verified = row['__' + field.key + '_verified'] === '1' || row['__' + field.key + '_verified'] === true;
        const verifiedDate = row['__' + field.key + '_verifiedDate'] || '';
        const href = row['__' + field.key + '_href'] || '';
        const select = `<select id="${id}" data-recordpick="1"` +
          ` data-fill-name="${esc(field.fillName || '')}" data-fill-code="${esc(field.fillCode || '')}"` +
          ` data-fill-map="${esc(JSON.stringify(field.fillMap || {}))}"` +
          ` data-jobtrace="${trace ? esc(field.source) : ''}" data-job-field="${esc(field.jobField || '')}"` +
          ` data-source-record-key="${esc(field.sourceRecordKey || '')}"` +
          ` data-value="${esc(v)}">` +
          (v ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : '<option value="">—</option>') +
          `</select>`;
        return `<span class="fr-recordpick">${select}` +
          `<input type="hidden" id="${id}__status" value="${esc(status)}">` +
          `<input type="hidden" id="${id}__verified" value="${verified ? '1' : ''}">` +
          `<input type="hidden" id="${id}__verifiedDate" value="${esc(verifiedDate)}">` +
          `<input type="hidden" id="${id}__href" value="${esc(href)}">` +
          (v && href ? `<a class="rec" href="${esc(href)}" target="_blank" rel="noopener">View record</a>` : '') +
          `<span id="${id}__badge">${recordpickBadgeHtml(v, status, verified, verifiedDate)}</span>` +
          `</span>`;
      }
      if (field.type === 'select') {
        const opts = ['', ...(field.options || [])];

        if (v !== '' && opts.indexOf(v) === -1) opts.push(v);
        return `<select id="${id}">${opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${o === '' ? '—' : esc(o)}</option>`).join('')}</select>`;
      }
      if (field.type === 'numlist') {
        return `<input type="text" id="${id}" value="${esc(v)}" inputmode="decimal" placeholder="${esc(field.placeholder || 'e.g. 12.4 + 11.9')}"${ro}>`;
      }
      // Tick-to-confirm (e.g. "start weight checked"). Stored as 'Yes' / '' in a hidden input.
      if (field.type === 'confirm') {
        return `<span class="fr-confirm"><input type="checkbox" id="${id}__cb" data-confirm-for="${id}"${v === 'Yes' ? ' checked' : ''}>` +
          `<input type="hidden" id="${id}" value="${v === 'Yes' ? 'Yes' : ''}">` +
          `<span class="fr-confirm-text">${esc(field.confirmText || 'Confirmed')}</span></span>`;
      }
      if (field.type === 'textarea') return `<textarea id="${id}" rows="3"${ro}>${esc(v)}</textarea>`;
      if (field.type === 'number') return `<input type="number" step="0.01" id="${id}" value="${esc(v)}"${ro}>`;
      if (field.type === 'date') return `<input type="date" id="${id}" value="${esc(v)}"${ro}>`;

      if (field.type === 'time') return `<input type="time" id="${id}" value="${esc(v)}">`;
      if (field.type === 'datetime') return `<input type="datetime-local" id="${id}" value="${esc(v)}"${ro}>`;

      if (field.type === 'batchseq' || field.type === 'derived') {
        return `<input type="text" id="${id}" value="${esc(v)}" readonly tabindex="-1">`;
      }
      if (field.type === 'upload') {
        // Value is a JSON blob {name,type,size,data} where `data` is a data: URL, stored inline
        // in the submission's own values (same place every other field lands) -- no new table or
        // upload endpoint. Kept small deliberately (see MAX_UPLOAD_BYTES in wireUpload) since it
        // rides the existing JSON column rather than dedicated blob storage.
        let meta = null;
        try { meta = v ? JSON.parse(v) : null; } catch (e) { meta = null; }
        const info = meta ? `${esc(meta.name)} (${Math.round((meta.size || 0) / 1024)} KB)` : 'No file attached';
        return `<span class="fr-upload" data-upload-for="${id}">` +
          `<input type="hidden" id="${id}" value="${esc(v)}">` +
          `<input type="file" id="${id}__file" accept="application/pdf,image/*">` +
          `<span class="fr-upload-info">${info}</span>` +
          (meta ? `<a class="fr-upload-dl" href="${esc(meta.data)}" download="${esc(meta.name)}">Download</a>` +
            `<button type="button" class="fr-btn fr-btn-flat fr-btn-sm" data-upload-remove="1">Remove</button>` : '') +
          `</span>`;
      }
      return `<input type="text" id="${id}" value="${esc(v)}"${ro}>`;
    }


    function wireYesNo(container) {
      container.querySelectorAll('.ml-yesno').forEach(group => {
        const hidden = group.querySelector('input[type=hidden]');
        const buttons = Array.from(group.querySelectorAll('button'));
        const current = hidden ? String(hidden.value) : '';
        group.setAttribute('role', 'radiogroup');
        buttons.forEach((btn, i) => {
          btn.setAttribute('role', 'radio');
          const is = String(btn.dataset.v) === current;
          btn.classList.toggle('on', is);
          btn.setAttribute('aria-checked', is ? 'true' : 'false');
          btn.tabIndex = is ? 0 : -1;

          btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const v = btn.dataset.v;
            if (hidden) hidden.value = v;
            buttons.forEach(b => {
              const on = b.dataset.v === v;
              b.classList.toggle('on', on);
              b.setAttribute('aria-checked', on ? 'true' : 'false');
              b.tabIndex = on ? 0 : -1;
            });
            if (hidden) hidden.dispatchEvent(new Event('input', { bubbles: true }));
          });

          btn.addEventListener('keydown', (ev) => {
            if (btn.disabled) return;
            const key = ev.key;
            let nextIndex = null;
            if (key === 'ArrowRight' || key === 'ArrowDown') nextIndex = (i + 1) % buttons.length;
            else if (key === 'ArrowLeft' || key === 'ArrowUp') nextIndex = (i - 1 + buttons.length) % buttons.length;
            else if (key === 'Home') nextIndex = 0;
            else if (key === 'End') nextIndex = buttons.length - 1;
            else if (key === 'Enter' || key === ' ' || key === 'Spacebar') { ev.preventDefault(); btn.click(); return; }
            if (nextIndex !== null) {
              ev.preventDefault();
              const nb = buttons[nextIndex];
              try { nb.focus(); } catch (e) {}
              nb.click();
            }
          });
        });
      });
    }


    const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stored inline in the submission JSON -- keep small

    function wireUpload(container) {
      container.querySelectorAll('.fr-upload').forEach(wrap => {
        if (wrap._uploadWired) return;
        wrap._uploadWired = true;
        const id = wrap.dataset.uploadFor;
        const hidden = el(id);
        const fileInp = el(id + '__file');
        if (!hidden || !fileInp) return;

        function paint() {
          let meta = null;
          try { meta = hidden.value ? JSON.parse(hidden.value) : null; } catch (e) { meta = null; }
          const info = wrap.querySelector('.fr-upload-info');
          if (info) info.textContent = meta ? `${meta.name} (${Math.round((meta.size || 0) / 1024)} KB)` : 'No file attached';
          let dl = wrap.querySelector('.fr-upload-dl');
          let rm = wrap.querySelector('[data-upload-remove]');
          if (meta) {
            if (!dl) { dl = document.createElement('a'); dl.className = 'fr-upload-dl'; wrap.appendChild(dl); }
            dl.href = meta.data; dl.download = meta.name; dl.textContent = 'Download';
            if (!rm) {
              rm = document.createElement('button');
              rm.type = 'button';
              rm.className = 'fr-btn fr-btn-flat fr-btn-sm';
              rm.textContent = 'Remove';
              rm.setAttribute('data-upload-remove', '1');
              wrap.appendChild(rm);
              rm.addEventListener('click', () => {
                hidden.value = '';
                hidden.dispatchEvent(new Event('input', { bubbles: true }));
                paint();
              });
            }
          } else {
            if (dl) dl.remove();
            if (rm) rm.remove();
          }
        }

        fileInp.addEventListener('change', function () {
          const file = this.files && this.files[0];
          this.value = '';
          if (!file) return;
          if (file.size > MAX_UPLOAD_BYTES) {
            alert('That file is larger than 4 MB — pick a smaller one (or a compressed scan).');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            hidden.value = JSON.stringify({ name: file.name, type: file.type, size: file.size, data: String(reader.result) });
            hidden.dispatchEvent(new Event('input', { bubbles: true }));
            paint();
          };
          reader.onerror = () => alert('Could not read that file.');
          reader.readAsDataURL(file);
        });
      });
    }


    // Suggests job number(s) for config.binJobsField (a free-text field, e.g. REC 7.4.4's
    // "Job numbers in bin") from config.binField's value, by looking up which grading-log
    // Collection Bins rows (indexed via roster.binIdColumn, see traceability.js) used that same
    // bin code. Fills only when the jobs field is currently empty -- this is a suggestion the
    // preparer can override, not an overwrite of something they already typed. The two records
    // otherwise capture overlapping info independently (grading log roster row's bin code vs.
    // this record's own free-text list) with nothing tying them together.
    function wireBinJobsAutofill(container, config) {
      if (!config.binField || !config.binJobsField) return;
      const binInput = el('fr_f_' + config.binField);
      const jobsInput = el('fr_f_' + config.binJobsField);
      if (!binInput || !jobsInput || binInput._binJobsWired) return;
      binInput._binJobsWired = true;
      const suggest = async () => {
        const binCode = String(binInput.value || '').trim();
        if (!binCode || String(jobsInput.value || '').trim() || !window.Traceability || !window.Traceability.jobsForBin) return;
        let rows = [];
        try { rows = await window.Traceability.jobsForBin(binCode); } catch (e) { return; }
        const jobs = [...new Set(rows.map(r => r.job_no || r.batch_no).filter(Boolean))];
        if (jobs.length) {
          jobsInput.value = jobs.join(', ');
          jobsInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
      ['change', 'blur'].forEach(ev => binInput.addEventListener(ev, suggest));
    }


    function masterIndexOptions(sourceRecordKey) {
      return ((window.MasterIndexData && window.MasterIndexData.rows) || [])
        .filter(r => !sourceRecordKey || r.recordKey === sourceRecordKey)
        .map(r => ({
          value: String(r.docNo || '').trim(),
          code: String(r.docNo || '').trim(),
          name: String(r.name || '').trim()
        }))
        .filter(o => o.value)
        .map(o => Object.assign(o, { label: o.code + (o.name ? ' — ' + o.name : '') }));
    }

    // Master Index rows are one per RECORD TYPE (its doc code/title), not per submission -- fine
    // for jobtrace/bintrace's true fallback (offering every record type to pick from generically),
    // but wrong for a recordpick scoped to one sourceRecordKey that isn't job/bin-traceable at all
    // (e.g. REC 7.4.8, indexed by agCode): the preparer needs to search actual filed submissions
    // of that one record, not see it listed once as a record type. Reads the same
    // `formrecord:<recordKey>` blob the record's own "View entries" list reads (see storageKey in
    // openForm), so status/verified reflect the real submission, not a server-side trace join.
    async function recordSubmissionOptions(sourceRecordKey) {
      if (!sourceRecordKey) return [];
      let raw = null;
      try { raw = await storeGet('formrecord:' + sourceRecordKey, true); } catch (e) { return []; }
      let subs = [];
      try { subs = raw ? JSON.parse(raw) : []; } catch (e) { subs = []; }
      if (!Array.isArray(subs) || !subs.length) return [];
      const indexRow = ((window.MasterIndexData && window.MasterIndexData.rows) || [])
        .find(r => r.recordKey === sourceRecordKey);
      const code = indexRow ? String(indexRow.docNo || '').trim() : '';
      const pageFile = indexRow ? String(indexRow.href || '') : '';
      return subs.map(sub => {
        const status = sub.verification ? 'verified' : (sub.status === 'draft' ? 'draft' : 'submitted');
        const values = sub.values || {};
        const bits = Object.keys(values).map(k => values[k]).filter(v => v && typeof v !== 'object').slice(0, 3);
        return {
          value: sourceRecordKey + '::' + sub.id,
          code: code,
          name: indexRow ? String(indexRow.name || '') : sourceRecordKey,
          href: pageFile ? pageFile + '#' + sub.id : '',
          values: values,
          status: status,
          verified: !!sub.verification,
          verifiedDate: (sub.verification && sub.verification.verifiedDate) || '',
          label: (code ? code + ' — ' : '') + bits.join(' · ') + ' [' + status + ']'
        };
      });
    }


    async function jobTraceOptions(jobNo, sourceRecordKey) {
      if (!jobNo || !window.Traceability) return [];
      let rows = [];
      try { rows = await window.Traceability.trace(jobNo); } catch (e) { return []; }
      if (sourceRecordKey) rows = rows.filter(r => r.record_key === sourceRecordKey);
      const byKey = {};
      ((window.MasterIndexData && window.MasterIndexData.rows) || []).forEach(r => {
        if (r.recordKey) byKey[r.recordKey] = String(r.docNo || '').trim();
      });
      return rows.map(r => {
        const code = byKey[r.record_key] || '';
        const name = r.record_title || r.record_key || '';
        const when = r.occurred_on || '';
        return {
          value: r.record_key + '::' + r.submission_id,
          code: code,
          name: name,
          href: r.href || '',
          values: r.values || {},
          status: r.status || 'submitted',
          verified: !!r.verified,
          verifiedDate: r.verifiedDate || '',
          label: (code ? code + ' — ' : '') + name + (when ? ' · ' + when : '') + (r.stage ? ' [' + r.stage + ']' : '')
        };
      });
    }


    // For records that only carry a bin code (e.g. boxing-and-labelling), not a job number:
    // resolve the job's bin(s) via Traceability.binsForJob, then trace() each bin code (records
    // opted into the bin index index a self row under batch_link:<binCode>:...) and merge,
    // de-duping by submission. Mirrors jobTraceOptions but hops through the bin_link index first.
    async function binTraceOptions(jobNo, sourceRecordKey) {
      if (!jobNo || !window.Traceability || !window.Traceability.binsForJob) return [];
      let binRows = [];
      try { binRows = await window.Traceability.binsForJob(jobNo); } catch (e) { return []; }
      const bins = [...new Set(binRows.map(r => r.bin_code).filter(Boolean))];
      if (!bins.length) return [];
      const byId = new Map();
      for (const bin of bins) {
        let rows = [];
        try { rows = await window.Traceability.trace(bin); } catch (e) { rows = []; }
        if (sourceRecordKey) rows = rows.filter(r => r.record_key === sourceRecordKey);
        rows.forEach(r => byId.set(r.record_key + '|' + r.submission_id, r));
      }
      const byKey = {};
      ((window.MasterIndexData && window.MasterIndexData.rows) || []).forEach(r => {
        if (r.recordKey) byKey[r.recordKey] = String(r.docNo || '').trim();
      });
      return [...byId.values()].map(r => {
        const code = byKey[r.record_key] || '';
        const name = r.record_title || r.record_key || '';
        const when = r.occurred_on || '';
        return {
          value: r.record_key + '::' + r.submission_id,
          code: code,
          name: name,
          href: r.href || '',
          values: r.values || {},
          status: r.status || 'submitted',
          verified: !!r.verified,
          verifiedDate: r.verifiedDate || '',
          label: (code ? code + ' — ' : '') + name + (when ? ' · ' + when : '') + (r.stage ? ' [' + r.stage + ']' : '')
        };
      });
    }


    // wireRecordPick runs async trace lookups per field and is invoked more than once in quick
    // succession (once on initial render, again on every job-number change/input event -- see the
    // listener wired near the end of openForm). Without a guard, a slower earlier call can still be
    // awaiting its fetches when a newer call starts, finishes, and paints the correct options --
    // then the stale call resolves and overwrites the DOM with its now-outdated (often empty)
    // results. _rpGen is a per-container generation counter: each call captures the generation it
    // started at and, after every await, bails before writing to the DOM if a newer call has since
    // started.
    async function wireRecordPick(container, config) {
      const sels = Array.from(container.querySelectorAll('select[data-recordpick]'));
      if (!sels.length) return;

      const myGen = (container._rpGen = (container._rpGen || 0) + 1);
      const stale = () => container._rpGen !== myGen;

      const traceCache = {};
      for (const sel of sels) {
        let current = sel.dataset.value || sel.value || '';
        let opts = [];
        let tracedMatch = false;
        if (sel.dataset.jobtrace) {
          const mode = sel.dataset.jobtrace; // 'jobtrace' or 'bintrace'
          const jobField = sel.dataset.jobField || ((config && config.batchField) || '');
          const jobInput = jobField ? el('fr_f_' + jobField) : null;
          const jobNo = jobInput ? String(jobInput.value || '').trim() : '';
          const sourceRecordKey = sel.dataset.sourceRecordKey || '';
          const cacheKey = mode + '::' + jobNo + '::' + sourceRecordKey;
          if (jobNo) {
            if (!(cacheKey in traceCache)) {
              traceCache[cacheKey] = mode === 'bintrace'
                ? await binTraceOptions(jobNo, sourceRecordKey)
                : await jobTraceOptions(jobNo, sourceRecordKey);
            }
            opts = traceCache[cacheKey];
            tracedMatch = opts.length > 0;
          }
        }

        if (!opts.length) {
          const scopeKey = sel.dataset.sourceRecordKey || '';
          opts = scopeKey ? await recordSubmissionOptions(scopeKey) : masterIndexOptions();
        }

        if (stale()) return; // a newer wireRecordPick call has started -- don't paint over it

        // Auto-add: an empty required/traced field with exactly one record actually found for
        // this job (or, for bintrace, this job's bin) gets pre-selected rather than left for the
        // preparer to notice and pick by hand -- the "auto-adds the records" behaviour. This only
        // fires off a genuine traced match, never off the broad/filtered master-index fallback,
        // so it never silently guesses at a record that isn't actually linked to this job.
        if (!current && tracedMatch && opts.length === 1) current = opts[0].value;

        if (current && !opts.some(o => o.value === current)) {
          opts = [{ value: current, code: current, name: '', label: current }].concat(opts);
        }
        sel.innerHTML = '<option value="">—</option>' + opts.map(o =>
          `<option value="${esc(o.value)}" data-code="${esc(o.code || '')}" data-name="${esc(o.name || '')}" data-href="${esc(o.href || '')}"` +
          ` data-values="${esc(JSON.stringify(o.values || {}))}"` +
          ` data-status="${esc(o.status || '')}" data-verified="${o.verified ? '1' : ''}" data-verified-date="${esc(o.verifiedDate || '')}"` +
          `${o.value === current ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
        sel.value = current;
        sel.dataset.value = current;

        // Refresh the persisted status/badge from the current option even when nothing was
        // just picked -- e.g. the picked submission got verified elsewhere since this draft
        // was last saved, and the badge should reflect that without requiring a re-pick.
        const currentOpt = current ? sel.options[sel.selectedIndex] : null;
        if (currentOpt && currentOpt.value === current) updateRecordPickStatus(sel, currentOpt);

        if (!sel._recordPickWired) {
          sel._recordPickWired = true;
          sel.addEventListener('change', () => {
            sel.dataset.value = sel.value;
            const opt = sel.options[sel.selectedIndex];
            const row = sel.closest('[data-roster-row]') || container;
            [['fillName', 'name'], ['fillCode', 'code']].forEach(([attr, dataKey]) => {
              const colKey = sel.dataset[attr === 'fillName' ? 'fillName' : 'fillCode'];
              if (!colKey) return;
              const target = row.querySelector(`[id$="_${colKey}"]`);
              if (!target) return;
              target.value = (opt && opt.dataset[dataKey]) || '';
              target.dispatchEvent(new Event('input', { bubbles: true }));
            });
            let fillMap = {};
            try { fillMap = JSON.parse(sel.dataset.fillMap || '{}'); } catch (e) { fillMap = {}; }
            let optValues = {};
            try { optValues = JSON.parse((opt && opt.dataset.values) || '{}'); } catch (e) { optValues = {}; }
            Object.keys(fillMap).forEach((targetColumnKey) => {
              const sourceValueKey = fillMap[targetColumnKey];
              let value = optValues[sourceValueKey];
              if (sourceValueKey === 'nrcsAgCode' && !value) value = optValues.agCode;
              const target = row.querySelector(`[id$="_${targetColumnKey}"]`);
              if (!target) return;
              target.value = value || '';
              target.dispatchEvent(new Event('input', { bubbles: true }));
            });
            updateRecordPickStatus(sel, sel.value ? opt : null);
          });
        }
      }
    }

    // Writes the picked option's status/verified/verifiedDate/href onto this recordpick's
    // persisted hidden fields (so it survives save/reload of a draft, same as fillCode/fillName)
    // and repaints the badge/view-link next to the select.
    function updateRecordPickStatus(sel, opt) {
      const status = (opt && opt.dataset.status) || '';
      const verified = !!(opt && opt.dataset.verified);
      const verifiedDate = (opt && opt.dataset.verifiedDate) || '';
      const href = (opt && opt.dataset.href) || '';
      const value = sel.value || '';
      const statusEl = el(sel.id + '__status');
      const verifiedEl = el(sel.id + '__verified');
      const verifiedDateEl = el(sel.id + '__verifiedDate');
      const hrefEl = el(sel.id + '__href');
      if (statusEl) statusEl.value = status;
      if (verifiedEl) verifiedEl.value = verified ? '1' : '';
      if (verifiedDateEl) verifiedDateEl.value = verifiedDate;
      if (hrefEl) hrefEl.value = href;
      const wrap = sel.closest('.fr-recordpick');
      if (!wrap) return;
      const linkEl = wrap.querySelector('a.rec');
      if (value && href) {
        if (linkEl) linkEl.href = href;
        else wrap.insertAdjacentHTML('beforeend',
          `<a class="rec" href="${esc(href)}" target="_blank" rel="noopener">View record</a>`);
      } else if (linkEl) {
        linkEl.remove();
      }
      const badgeEl = el(sel.id + '__badge');
      if (badgeEl) badgeEl.innerHTML = recordpickBadgeHtml(value, status, verified, verifiedDate);
    }


    function wireJobNumber(container) {
      container.querySelectorAll('.fr-jobnumber').forEach(group => {
        const hidden = group.querySelector('input[type=hidden]');
        const prefixSel = group.querySelector('.fr-jn-prefix');
        const digitsInp = group.querySelector('.fr-jn-digits');
        const hint = group.querySelector('.fr-jn-hint');
        const validate = group.dataset.validate === 'true';
        function sync() {
          if (prefixSel.disabled) return;
          const digits = digitsInp.value.replace(/\D/g, '').slice(0, 8);
          if (digits !== digitsInp.value) digitsInp.value = digits;
          const value = (prefixSel.value && digits) ? prefixSel.value + digits : '';
          hidden.value = value;
          if (!value) {
            hint.textContent = '';
            hint.classList.remove('bad');
          } else if (validate && window.Lookups && window.Lookups.batch) {
            const ok = window.Lookups.batch.isValid(value);
            hint.textContent = ok ? value : '4–8 digits required';
            hint.classList.toggle('bad', !ok);
          } else {
            hint.textContent = value;
            hint.classList.remove('bad');
          }
          hidden.dispatchEvent(new Event('input', { bubbles: true }));
        }
        prefixSel.addEventListener('change', sync);
        digitsInp.addEventListener('input', sync);
        // A saved value the dropdown cannot represent (an unknown prefix) must not be blanked just
        // by opening the record: sync() rebuilds the hidden value from the dropdown + digits, which
        // cannot represent it here. Keep what was saved, say so, and let the user re-pick a prefix.
        if (hidden.value && (prefixSel.value + digitsInp.value).toUpperCase() !== String(hidden.value).trim().toUpperCase()) {
          hint.textContent = hidden.value + ' - prefix not recognised, choose one to replace it';
          hint.classList.add('bad');
        } else {
          sync();
        }
      });
    }


  function wireSectionSummaries(container) {
    container.querySelectorAll('.fr-section-summary[data-summary-for]').forEach((span) => {
      const keys = (span.getAttribute('data-summary-for') || '').split(',').map((k) => k.trim()).filter(Boolean);
      const srcs = keys.map((k) => container.querySelector('#fr_f_' + k)).filter(Boolean);
      if (!srcs.length) return;
      const paint = () => {
        const parts = srcs.map((s) => String(s.value || '').trim()).filter(Boolean);
        span.textContent = parts.length ? '— ' + parts.join('  ·  ') : '';
      };
      srcs.forEach((s) => { s.addEventListener('input', paint); s.addEventListener('change', paint); });
      paint();
    });
  }


  function wireJobRouteCheck(container, config) {
    (allFields(config) || []).forEach((f) => {
      if (!f.matchJobRoute || !window.Lookups || !window.Lookups.batch) return;
      const target = container.querySelector('#fr_f_' + f.key);
      const jobEl = container.querySelector('#fr_f_' + f.matchJobRoute);
      if (!target || !jobEl) return;
      let warn = container.querySelector('#fr_routeWarn_' + f.key);
      if (!warn) {
        warn = document.createElement('div');
        warn.id = 'fr_routeWarn_' + f.key;
        warn.className = 'fr-notice fr-notice-due';
        warn.style.marginTop = '4px';
        (target.closest('.fr-field') || target.parentNode).appendChild(warn);
      }
      const check = () => {
        const bad = target.value && jobEl.value
          && !window.Lookups.batch.routeMatches(jobEl.value, target.value);
        warn.textContent = bad ? window.Lookups.batch.routeError(jobEl.value) : '';
        warn.classList.toggle('show', !!bad);
      };
      [target, jobEl].forEach((el) => {
        el.addEventListener('input', check);
        el.addEventListener('change', check);
      });
      check();
    });
  }


  function wireJobSearch(container, config) {
    const fields = allFields(config).filter((f) => f.type === 'jobsearch');
    const sels = fields.map((f) => container.querySelector('#fr_f_' + f.key)).filter(Boolean);
    if (!sels.length) return;
    loadLib('job-picker.js?v=3', 'JobPicker').then((jp) => { if (jp) sels.forEach((sel) => jp.enhance(sel)); });
    loadLib('job-status.js?v=3', 'JobStatus').then((js) => {
      if (!js) throw new Error('job-status.js unavailable');
      return js.list();
    }).then((rows) => {
      // Closed jobs stay findable (the picker tags them); open jobs list first.
      const status = new Map(rows.map((r) => [String(r.job_no), r.status === 'closed' ? 'closed' : 'open']));
      const all = rows.map((r) => String(r.job_no))
        .sort((a, b) => (status.get(a) === 'closed') - (status.get(b) === 'closed'));
      sels.forEach((sel) => {
        const current = sel.value;
        const options = all.slice();
        if (current && options.indexOf(current) === -1) options.unshift(current);
        sel.innerHTML = '<option value="">—</option>' +
          options.map((val) => `<option value="${esc(val)}" data-status="${status.get(val) || 'open'}">${esc(val)}</option>`).join('');
        sel.value = current;
        if (sel._jobPicker) sel._jobPicker.drawList();
      });
    }).catch((e) => console.error('job list load failed', e));
  }


  // ---------------------------------------------------------------------------------------
  // Business rules registry. Every cross-record check ("this can't exceed that", "this must
  // match that") lives as DATA in public/data/business-rules.json, not in this file or in any
  // record's own JSON. Adding, changing or retiring a rule is a one-line edit to that registry
  // -- it never touches form-record.js or a record's html page. This file only needs a new
  // `case` below when a genuinely new *kind* of check is needed (rare); everyday rules just
  // reuse an existing type with new parameters.
  let businessRulesCache = null;
  async function fetchBusinessRules() {
    if (businessRulesCache) return businessRulesCache;
    try {
      const r = await fetch('/data/business-rules.json', { cache: 'no-cache' });
      businessRulesCache = r.ok ? await r.json() : [];
    } catch (e) { businessRulesCache = []; }
    return businessRulesCache;
  }

  // capAgainstOtherRecord: this record's own numeric field, totalled across every previously
  // submitted entry for the same job (plus the value being saved now), must not exceed a total
  // already recorded on another record for the same job. Soft gate -- an operator can override
  // by explicitly confirming, and the override is stamped onto the record (oosWarningAck /
  // oosWarningNote) so it keeps showing as a warning on the submitted view and the printed sheet.
  async function checkCapAgainstOtherRecord(rule, config, values, editingId) {
    const jobVal = String(values[rule.ownJobField] || '').trim();
    delete values.oosWarningAck;
    delete values.oosWarningNote;
    if (!jobVal) return true;
    let capTotal = null;
    let ownTotal = null;
    try {
      const [capData, ownData] = await Promise.all([
        autofillLookup({ source: rule.source, matchField: rule.matchField }, jobVal),
        autofillLookup({ source: config.recordKey, matchField: rule.ownJobField }, jobVal, editingId)
      ]);
      if (capData && capData.__rosterSums && capData.__rosterSums[rule.sumColumn] != null) {
        capTotal = parseFloat(capData.__rosterSums[rule.sumColumn]);
      }
      const priorOwn = (ownData && ownData.__matchValueSums && ownData.__matchValueSums[rule.ownWeightField] != null)
        ? parseFloat(ownData.__matchValueSums[rule.ownWeightField]) : 0;
      const thisOwn = parseFloat(values[rule.ownWeightField]) || 0;
      ownTotal = priorOwn + thisOwn;
    } catch (e) { console.error('business rule lookup failed', rule, e); return true; }
    if (capTotal == null || isNaN(capTotal) || ownTotal == null || ownTotal <= capTotal) return true;
    const proceed = confirm(
      `${rule.message}\n\nTotal for this job so far (including this batch): ${ownTotal.toFixed(2)} kg\n` +
      `Recorded cap for this job: ${capTotal.toFixed(2)} kg\n\n` +
      `Click OK to confirm this is correct and submit anyway, or Cancel to go back and check.`);
    if (!proceed) return false;
    values.oosWarningAck = true;
    values.oosWarningNote = rule.message;
    return true;
  }

  // Runs every registry rule that applies to this record at finalize time. Returns false the
  // moment a rule vetoes the save (operator declined to override); saveForm aborts on that.
  async function runBusinessRules(config, values, editingId) {
    const rules = (await fetchBusinessRules()).filter(r => r.recordKey === config.recordKey);
    for (const rule of rules) {
      let ok = true;
      switch (rule.type) {
        case 'capAgainstOtherRecord': ok = await checkCapAgainstOtherRecord(rule, config, values, editingId); break;
        default: console.warn('business-rules.json: unknown rule type', rule.type);
      }
      if (!ok) return false;
    }
    return true;
  }

  async function autofillLookup(rule, value, excludeId) {

    let path = `/api/lookup/${encodeURIComponent(rule.source)}/${encodeURIComponent(rule.matchField)}/${encodeURIComponent(value)}`;
    if (excludeId) path += `?excludeId=${encodeURIComponent(excludeId)}`;
    const res = await (window.FacilityApi ? window.FacilityApi.fetch(path)
      : fetch((window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com') + path));
    if (!res.ok) return null;
    return await res.json();
  }


  function markProvisional(el, isProvisional) {
    if (!el) return;
    if (isProvisional) el.dataset.provisional = '1';
    else delete el.dataset.provisional;
    el.classList.toggle('fr-provisional', !!isProvisional);
  }

  function renderProvisionalNotice(container) {
    let note = el('fr_provisionalNote');
    const any = container.querySelectorAll('[data-provisional="1"]').length;
    if (!note) {
      if (!any) return;
      note = document.createElement('div');
      note.id = 'fr_provisionalNote';
      note.className = 'fr-notice fr-notice-provisional';
      container.prepend(note);
    }
    note.classList.toggle('show', !!any);
    if (any) {
      note.textContent = 'Warning: the Abalone Receiving record (REC 7.1.2) for this job is still a '
        + 'draft. The highlighted fields are provisional — they will be refreshed when you save. This '
        + 'entry can be saved as a draft, but not submitted as final until that receiving record is '
        + 'submitted.';
    }
  }


  function setAutofilled(targetEl, value) {
    if (targetEl.tagName === 'SELECT') {
      const has = [...targetEl.options].some((o) => String(o.value).toLowerCase() === String(value).toLowerCase());
      if (!has) return false;
      const match = [...targetEl.options].find((o) => String(o.value).toLowerCase() === String(value).toLowerCase());
      targetEl.value = match.value;
      return true;
    }
    targetEl.value = value;
    return true;
  }



  function restrictSelect(sel, allowed) {
    if (!sel || sel.tagName !== 'SELECT') return;
    if (!sel._frAllOptions) {
      sel._frAllOptions = [...sel.options].map((o) => ({ value: o.value, text: o.textContent }));
    }
    const all = sel._frAllOptions;
    const current = sel.value;
    let keep = all;
    if (Array.isArray(allowed) && allowed.length) {
      const want = new Set(allowed.map((v) => String(v).trim().toLowerCase()));
      const narrowed = all.filter((o) => o.value === '' || want.has(String(o.value).trim().toLowerCase()));

      if (narrowed.filter((o) => o.value !== '').length) keep = narrowed;
    }
    if (current && !keep.some((o) => o.value === current)) keep = keep.concat([{ value: current, text: current }]);
    sel.innerHTML = '';
    keep.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.text;
      sel.appendChild(opt);
    });
    sel.value = current;
  }


  function applyRestrict(container, rule, found) {
    if (!rule.restrict) return;
    Object.entries(rule.restrict).forEach(([targetKey, sourceCol]) => {
      const allowed = found && found.__rosterOptions && found.__rosterOptions[sourceCol];
      restrictSelect(container.querySelector('#fr_f_' + targetKey), allowed);
      container.querySelectorAll('#fr_rosterRows select[id$="_' + targetKey + '"]')
        .forEach((sel) => restrictSelect(sel, allowed));
    });
  }

  function wireAutofill(container, config) {
    if (!Array.isArray(config.autofill) || !config.autofill.length) return;
    config.autofill.forEach((rule) => {
      const watchEl = container.querySelector('#fr_f_' + rule.watch);
      if (!watchEl) return;
      let lastValue = '';
      const onPick = async () => {
        const value = watchEl.value;
        if (value === lastValue) return;
        lastValue = value;
        if (!value) { rule.__lastFound = null; applyRestrict(container, rule, null); return; }
        try {
          const found = await autofillLookup(rule, value);

          rule.__lastFound = found;
          applyRestrict(container, rule, found);
          if (!found) return;
          const provisional = found.__status && found.__status !== 'submitted';
          Object.entries(rule.fill || {}).forEach(([targetKey, sourceKey]) => {
            const targetEl = container.querySelector('#fr_f_' + targetKey);
            if (!targetEl) return;
            let filledNow = false;
            if (!targetEl.value && found[sourceKey] != null && found[sourceKey] !== '') {
              if (!setAutofilled(targetEl, found[sourceKey])) return;
              filledNow = true;
              targetEl.dispatchEvent(new Event('input', { bubbles: true }));
            }

            if (provisional && (filledNow || targetEl.readOnly)) markProvisional(targetEl, true);
            else if (!provisional) markProvisional(targetEl, false);
          });
          renderProvisionalNotice(container);
        } catch (e) {
          console.error('autofill lookup failed', e);
        }
      };

      watchEl.addEventListener('input', onPick);
      watchEl.addEventListener('change', onPick);
    });
  }


  async function refreshProvisional(container, config, finalize, toast) {
    const stale = container.querySelectorAll('[data-provisional="1"]');
    if (!stale.length) return true;
    let stillDraft = false;
    const changed = [];
    for (const rule of (config.autofill || [])) {
      const watchEl = container.querySelector('#fr_f_' + rule.watch);
      if (!watchEl || !watchEl.value) continue;
      let found = null;
      try { found = await autofillLookup(rule, watchEl.value); } catch (e) { found = null; }
      if (!found) continue;
      rule.__lastFound = found;
      applyRestrict(container, rule, found);
      const nowProvisional = found.__status && found.__status !== 'submitted';
      if (nowProvisional) stillDraft = true;
      Object.entries(rule.fill).forEach(([targetKey, sourceKey]) => {
        const targetEl = container.querySelector('#fr_f_' + targetKey);
        if (!targetEl || targetEl.dataset.provisional !== '1') return;
        const latest = found[sourceKey];
        if (latest != null && String(latest) !== String(targetEl.value)) {
          const before = targetEl.value;
          if (setAutofilled(targetEl, latest)) changed.push(`${targetKey}: ${before} → ${latest}`);
        }
        markProvisional(targetEl, nowProvisional);
      });
    }
    renderProvisionalNotice(container);
    if (changed.length) toast('Updated from source: ' + changed.join(', '));
    if (finalize && stillDraft) {
      toast('Cannot submit — the source record for this job is still a draft, so its values are provisional. Save as a draft instead.');
      return false;
    }
    return true;
  }

  function allFields(config) {
    const fields = [];
    (config.sections || []).forEach(sec => (sec.fields || []).forEach(f => fields.push(f)));
    return fields;
  }

  // Sections declared after the roster (afterRoster: true) render below the roster table
  // rather than above it -- keeps sign-off at the foot of the record, not under job entry.
  function sectionsAroundRoster(config) {
    const secs = config.sections || [];
    return { pre: secs.filter(s => !s.afterRoster), post: secs.filter(s => s.afterRoster) };
  }

  // A record can declare either a single `roster` (legacy shape, stored under sub.roster) or an
  // array of `rosters: [{ key, title, columns, ... }, ...]` rendered as separate repeating tables,
  // each wired through the same recordpick/add-row/save-load paths. `getRosterList` normalizes
  // both shapes into one array; `roster.key` (default 'roster' for a lone/legacy roster) is the
  // storage key -- the first roster in the list still persists to sub.roster for backward
  // compatibility with data saved before multi-roster support existed.
  function getRosterList(config) {
    if (Array.isArray(config.rosters)) {
      return config.rosters.filter(Boolean).map(r => Object.assign({}, r, { key: r.key || 'roster' }));
    }
    if (config.roster) return [Object.assign({}, config.roster, { key: config.roster.key || 'roster' })];
    return [];
  }

  function getRosterRows(sub, index, key) {
    if (!sub) return [];
    if (index === 0) return sub.roster || [];
    return (sub.rosters && sub.rosters[key]) || [];
  }

  function setRosterRows(sub, index, key, rows) {
    if (index === 0) { sub.roster = rows; return; }
    sub.rosters = sub.rosters || {};
    sub.rosters[key] = rows;
  }

  // The record's definition lives in the DB (RecordDefinition tables, seeded from the old
  // inline configs -- see Claude outputs/relational-all-records-plan.md). A page that passes
  // only { recordKey } gets its config assembled by GET /api/record-def/:key.
  async function fetchRecordDef(recordKey) {
    if (!window.FacilityApi) return null;
    return window.FacilityApi.recordDef(recordKey);   // cached copy first, refreshed in background
  }

  async function init(config) {

    if (window.LoginUI) {
      await window.LoginUI.ensureAuthenticated();
    }

    injectStyleOnce();

    if (!config.sections && !config.fields && config.recordKey) {
      const fetched = await fetchRecordDef(config.recordKey);
      if (fetched) Object.assign(config, fetched);
    }
    if (!config.sections && !config.fields) {
      const m = typeof config.mount === 'string' ? document.querySelector(config.mount) : config.mount;
      if (m) m.innerHTML = '<p style="padding:20px;font:600 14px system-ui;color:#9c241d">'
        + 'Could not load this record’s definition. The records API may be starting up — reload in a moment.</p>';
      return;
    }

    const inlineConfig = {
      sections: JSON.parse(JSON.stringify(config.sections || [])),
      roster: config.roster ? JSON.parse(JSON.stringify(config.roster)) : null,
      listColumns: config.listColumns ? config.listColumns.slice() : undefined
    };
    try {
      const overrideRaw = await window.FacilityApi.templateOverride(config.recordKey);
      if (overrideRaw) {
        const override = JSON.parse(overrideRaw);
        if (override && override.schemaVersion === 1 && override.engine === 'form-record') {
          config.sections = override.sections;
          if (override.roster !== undefined) config.roster = override.roster || undefined;
          if (override.rosters !== undefined) config.rosters = override.rosters || undefined;
          if (override.listColumns) config.listColumns = override.listColumns;
        }
      }
    } catch (e) { console.warn('fr: template override parse failed', e); }

    const rosterList = getRosterList(config);

    const canManageTemplates = !window.PermissionRules || window.PermissionRules.can('manageTemplates');

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

    let formLocked = false;
    let clearArmed = false;
    let clearTimer = null;
    function formHasInput() {
      const c = el('fr_modalSections');
      if (!c) return false;
      return Array.from(c.querySelectorAll('input,select,textarea')).some(i =>
        (i.type === 'checkbox' || i.type === 'radio') ? i.checked : String(i.value || '').trim() !== '');
    }
    function disarmClear() {
      clearArmed = false;
      if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
    }
    function onClearClick() {
      const btn = el('fr_cancelBtn');
      if (formLocked || !formHasInput()) { disarmClear(); closeForm(); return; }
      if (clearArmed) { disarmClear(); closeForm(); return; }
      clearArmed = true;
      btn.textContent = 'Tap again to clear';
      clearTimer = setTimeout(() => { clearArmed = false; clearTimer = null; btn.textContent = 'Clear'; }, 4000);
    }
    const hasRoster = rosterList.length > 0;
    function rosterNs(i) { return i === 0 ? 'fr' : 'fr' + i; }
    function rosterDomId(base, i) { return i === 0 ? base : base + '_' + i; }

    async function load() {
      const raw = await storeGet(storageKey, true);
      try { submissions = raw ? JSON.parse(raw) : []; } catch (e) { submissions = []; }
    }
    async function persist() { return storeSet(storageKey, JSON.stringify(submissions), true); }


    function renderDocBadge() {
      el('fr_docRev').textContent =
        window.DocHeader.badgeText(config.recordKey, config.docRevisionStart);
    }

    const instructionsHtml = (config.instructions || []).length ? `
      <div class="fr-panel no-print fr-instr-panel"><div class="fr-panel-head"><h2>Work instructions</h2>
          <button class="fr-btn fr-btn-flat fr-btn-sm fr-instr-toggle" id="fr_instrToggle" type="button">Show</button></div>
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


    const showVerification = config.showVerificationStrip !== false;
    const verificationHtml = showVerification ? `
        <div class="fr-panel no-print">
          <div class="fr-panel-head">
            <h2>Verification</h2>
            <button type="button" class="fr-btn fr-btn-flat fr-btn-sm fr-reveal-btn no-print" data-reveal="fr_verificationBody" data-label="verification">View verification</button>
          </div>
          <div class="fr-panel-body fr-collapsible" id="fr_verificationBody">
            <div class="fr-notice fr-notice-due" id="fr_verifyGate" style="display:none;"></div>
            <div class="fr-notice fr-notice-due" id="fr_verifyNotice"></div>
            <button type="button" class="fr-btn fr-btn-flat fr-btn-sm fr-reveal-btn no-print" data-reveal="fr_verifySelect" data-label="entries to verify">View entries to verify</button>
            <div class="fr-history-list fr-collapsible" id="fr_verifySelect" style="margin-bottom:10px;"></div>
            ${window.SignOffBlock.verifyFieldsHtml({ idPrefix: 'fr_verified', gridClass: 'fr-grid fr-grid-4', fieldClass: 'fr-field' })}
            <div class="fr-actions" style="justify-content:flex-start; margin-top:0;">
              <button class="fr-btn fr-btn-primary fr-btn-sm" id="fr_saveVerificationBtn">Log verification</button>
            </div>
            <button type="button" class="fr-btn fr-btn-flat fr-btn-sm fr-reveal-btn no-print" data-reveal="fr_verificationHistory" data-label="verification history">View verification history</button>
            <div class="fr-history-list fr-collapsible" id="fr_verificationHistory"></div>
          </div>
        </div>` : '';

    mount.innerHTML = `
      <div class="fr-top">
        <div class="doc-line">
          <span class="doc-code">${esc(config.docCode)}</span>
          <h1>${esc(config.title)}</h1>
          <span class="doc-rev" id="fr_docRev"></span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;" class="no-print">
        </div>
      </div>
      <div class="fr-body">
        ${instructionsHtml}
        ${relatedHtml}
        <!-- The entry form IS the page: opening a record shows the fields ready to
             complete, matching the paper form. There is no "+ New" button and no modal;
             the same openForm/saveForm code path now fills this always-visible panel. -->
        <div class="fr-panel no-print">
          <div class="fr-panel-head">
            <h2 id="fr_modalTitle" hidden></h2>
          </div>
          <div class="fr-panel-body">
            <div id="fr_modalSections"></div>
            <div class="fr-muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px;">Completed by</div>
            ${window.SignOffBlock.completedByHtml({ byId: 'fr_cb_by', titleId: 'fr_cb_title', dateId: 'fr_cb_date', signatureId: 'fr_cb_signature', gridClass: 'fr-grid fr-grid-4 fr-compact', fieldClass: 'fr-field' })}
            <div class="fr-actions">
              <button class="fr-btn fr-btn-flat" id="fr_cancelBtn">Clear</button>
              <button class="fr-btn fr-btn-flat" id="fr_saveBtn">Save draft</button>
              <button class="fr-btn fr-btn-primary" id="fr_submitBtn">Submit</button>
            </div>
          </div>
        </div>
        <div class="fr-panel no-print">
          <div class="fr-panel-head">
            <h2>Submissions</h2>
            <button type="button" class="fr-btn fr-btn-flat fr-btn-sm fr-reveal-btn no-print" data-reveal="fr_submissionsBody" data-label="entries">View entries</button>
          </div>
          <div class="fr-panel-body fr-collapsible" id="fr_submissionsBody">
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
      <div class="fr-toast no-print" id="fr_toast"></div>
    `;

    function suggestCompletedBy() {
      const by = el('fr_cb_by');
      if (!by || by.value.trim()) return;
      const name = window.Auth && window.Auth.getCurrentUsername ? window.Auth.getCurrentUsername() : null;
      if (name) by.value = name;
    }
    suggestCompletedBy();
    if (typeof document !== 'undefined') document.addEventListener('authSuccess', suggestCompletedBy);


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

    function rosterRowHtml(ns, idx, row, roster) {
      row = row || {};
      return `<div class="fr-roster-row" data-roster-row="${idx}">
        ${roster.columns.map(c => `<label class="fr-field">${esc(c.label)}${c.required ? ' *' : ''}
          ${fieldInputHtml(`${ns}_roster_${idx}_${c.key}`, c, row[c.key], row)}
        </label>`).join('')}
        <button type="button" class="fr-btn fr-btn-flat fr-btn-sm" data-remove-roster-row="${idx}">✕</button>
      </div>`;
    }


    // roster.quickEntry: one capture line (the roster's own columns + an add button) above the
    // list, instead of a blank row + "+ Add row". quickEntry may be true or
    // { addLabel, autoIncrement: '<numeric column key to prefill with last + 1>' }.
    function quickEntryHtml(roster, rosterIndex) {
      const qe = roster.quickEntry === true ? {} : roster.quickEntry;
      const ns = rosterNs(rosterIndex);
      return `<div class="fr-grid fr-compact fr-quick-entry no-print">
        ${roster.columns.filter(c => c.type !== 'batchseq' && c.type !== 'derived').map(c =>
          `<label class="fr-field">${esc(c.label)}${fieldInputHtml(`${ns}_qe_${c.key}`, c, '')}</label>`).join('')}
        <div class="fr-field fr-qe-btn"><button type="button" class="fr-btn" id="${ns}_qeAdd">${esc(qe.addLabel || '+ Add')}</button></div>
      </div>`;
    }
    function wireQuickEntry(roster, rosterIndex, rowsEl) {
      const qe = roster.quickEntry === true ? {} : roster.quickEntry;
      const ns = rosterNs(rosterIndex);
      const cols = roster.columns.filter(c => c.type !== 'batchseq' && c.type !== 'derived');
      const inp = key => el(`${ns}_qe_${key}`);
      const addBtn = el(`${ns}_qeAdd`);
      if (!addBtn) return;
      function prefill() {
        const k = qe.autoIncrement;
        if (!k || !inp(k)) return;
        const nums = rowsEl._getRows().map(r => parseFloat(r[k])).filter(n => !isNaN(n));
        inp(k).value = nums.length ? Math.max.apply(null, nums) + 1 : '';
      }
      function add() {
        const row = {};
        cols.forEach(c => { row[c.key] = String(inp(c.key).value || '').trim(); });
        const missing = cols.find(c => row[c.key] === '');
        if (missing) { inp(missing.key).focus(); return; }
        rowsEl._importRows([row]);
        rowsEl.dispatchEvent(new Event('input', { bubbles: true }));
        cols.forEach(c => { inp(c.key).value = ''; });
        prefill();
        const next = cols.find(c => inp(c.key).value === '') || cols[0];
        try { inp(next.key).focus(); } catch (e) {}
      }
      addBtn.addEventListener('click', add);
      cols.forEach(c => inp(c.key).addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); add(); }
      }));
      prefill();
    }

    function parseCsvText(text) {
      const rows = [];
      let row = [], cell = '', inQuotes = false;
      text = text.replace(/^\uFEFF/, '');
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
          if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
          else if (c === '"') inQuotes = false;
          else cell += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (c !== '\r') cell += c;
      }
      row.push(cell);
      rows.push(row);
      return rows.filter(r => r.some(v => String(v).trim() !== ''));
    }


    function importRosterCsv(text, rosterContainer, roster) {
      const cells = parseCsvText(text);
      if (!cells.length) { alert('That CSV is empty.'); return; }
      const norm = s => String(s == null ? '' : s).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const cols = roster.columns;
      const header = cells[0].map(norm);
      const mapping = header.map(h => {
        const col = cols.find(c => norm(c.key) === h || norm(c.label) === h);
        return col ? col.key : null;
      });
      const hasHeader = mapping.some(Boolean);
      const body = hasHeader ? cells.slice(1) : cells;
      const imported = [];
      body.forEach(r => {

        if (r.some(v => norm(v) === 'total' || norm(v) === 'totals')) return;
        const row = {};
        let any = false;
        r.forEach((v, i) => {
          const key = hasHeader ? mapping[i] : (cols[i] ? cols[i].key : null);
          if (!key) return;
          const val = String(v).trim();
          row[key] = val;
          if (val !== '') any = true;
        });
        if (any) imported.push(row);
      });
      if (!imported.length) { alert('No usable rows found in that CSV.'); return; }
      rosterContainer._importRows(imported);
      alert('Imported ' + imported.length + ' row' + (imported.length === 1 ? '' : 's') + '.');
    }

    // Computed fields that name a registry formula (computeFn/computeArgs) -- same code the API
    // validates with. Needs ../lib/compute/registry.js on the page; a no-op without it.
    function refreshComputeFns() {
      if (!window.ComputeRegistry) return;
      const fields = allFields(config);
      const fns = fields.filter(f => f.type === 'computed' && f.computeFn);
      if (!fns.length) return;
      const values = {};
      fields.forEach(f => { const inp = el('fr_f_' + f.key); if (inp) values[f.key] = inp.value; });
      fns.forEach(f => {
        const inp = el('fr_f_' + f.key);
        if (!inp) return;
        const r = window.ComputeRegistry.run(f.computeFn, f.computeArgs || {}, values);
        inp.value = r === '' || r == null ? '' : String(r);
        values[f.key] = inp.value;
      });
    }

    function renderRosterEditor(existingRows, roster, rosterIndex) {
      const ns = rosterNs(rosterIndex);
      const containerId = rosterDomId('fr_rosterRows', rosterIndex);
      const fid = (i, key) => `${ns}_roster_${i}_${key}`;
      const container = el(containerId);
      let rows = (existingRows || []).slice();
      // A checklist-style roster can pre-list its rows (roster.defaultRows) on a new record.
      if (!rows.length) (roster.defaultRows || (roster.quickEntry ? [] : [{}])).forEach(r => rows.push(Object.assign({}, r)));

      // Per-row cross-record group subtotals (e.g. OOSW's per-size-range "whole weight" pulled
      // from the Abalone Receiving baskets for this job). One fetch per job, cached; a column
      // opts in via extraJson.deriveGroupSum = { source, groupBy, sum }.
      const groupSumCol = (roster.columns || []).find(c => c.deriveGroupSum);
      const groupSumsCache = { job: null, data: {} };
      async function loadGroupSums() {
        if (!groupSumCol) return;
        const jobEl = el('fr_f_' + (config.batchField || 'jobNo'));
        const job = jobEl ? String(jobEl.value || '').trim() : '';
        if (job === groupSumsCache.job) return;
        groupSumsCache.job = job;
        groupSumsCache.data = {};
        if (job) {
          try {
            const found = await autofillLookup(
              { source: groupSumCol.deriveGroupSum.source, matchField: 'jobNo' }, job);
            groupSumsCache.data = (found && found.__rosterGroupSums) || {};
          } catch (e) { groupSumsCache.data = {}; }
        }
        renderRosterDerived();
        renderRosterTotals();
      }


      // Computed top-level fields fed by this roster (sumRosterColumn, optionally narrowed by
      // sumRosterWhere), then any computed field naming a registry formula (e.g. yield %).
      function renderComputedFields() {
        const cur = rows.map((_, i) => readRow(i));
        allFields(config).forEach((f) => {
          if (f.type !== 'computed' || !f.sumRosterColumn) return;
          if (!roster.columns.some(c => c.key === f.sumRosterColumn)) return;
          const inp = el(`fr_f_${f.key}`);
          if (inp) inp.value = sumRosterRows(f, cur).toFixed(2);
        });
        refreshComputeFns();
      }

      function renderRosterTotals() {
        renderComputedFields();
        if (!roster.totalsRow) return;
        const totals = {};
        roster.totalsRow.forEach(k => { totals[k] = 0; });
        rows.forEach((_, i) => {
          roster.totalsRow.forEach(k => {
            const inp = el(fid(i, k));
            const val = inp ? sumNumList(inp.value) : null;
            if (val !== null) totals[k] += val;
          });
        });
        const totalsEl = el(rosterDomId('fr_rosterTotals', rosterIndex));
        if (totalsEl) {
          totalsEl.innerHTML = 'Totals — ' + roster.totalsRow.map(k => {
            const col = roster.columns.find(c => c.key === k);
            return `${esc(col ? col.label : k)}: ${totals[k].toFixed(2)}`;
          }).join(' &nbsp;·&nbsp; ');
          // Optional percentage-of-a-top-field readout, e.g. OOSW %  =  Σ OOSW weight ÷ job whole weight.
          const p = roster.pctTotal;
          if (p) {
            const ofEl = el('fr_f_' + p.of);
            const denom = ofEl ? parseFloat(ofEl.value) : NaN;
            const numer = totals[p.num] || 0;
            const txt = (!isNaN(denom) && denom > 0) ? (numer / denom * 100).toFixed(2) + '%' : '—';
            totalsEl.innerHTML += ` &nbsp;·&nbsp; <strong>${esc(p.label || 'OOSW %')}: ${txt}</strong>`;
          }
        }
      }


      function renderRosterDerived() {
        const specials = (roster.columns || []).filter(c => c.type === 'batchseq' || c.type === 'derived' || c.deriveJoin);
        if (!specials.length) return;
        const dateEl = el('fr_f_' + (roster.batchSeqDateField || 'date'));
        const batchSeqDate = dateEl ? dateEl.value : '';
        rows.forEach((_, i) => {
          const cur = {};
          roster.columns.forEach(c => {
            const inp = el(fid(i, c.key));
            cur[c.key] = inp ? inp.value : '';
          });
          specials.forEach(c => {
            const inp = el(fid(i, c.key));
            if (!inp) return;
            if (c.type === 'batchseq') {
              inp.value = formatBatchSeq(batchSeqDate, i);
            } else if (c.deriveGroupSum) {
              const g = c.deriveGroupSum;
              const grp = groupSumsCache.data[g.groupBy] || {};
              const cell = grp[String(cur[g.groupBy] || '').trim()] || {};
              const val = cell[g.sum];
              inp.value = (val == null || val === '') ? '' : String(val);
            } else {
              inp.value = computeRowDerived(c, cur);
            }
          });
        });
      }


      // carryPrev: a column pre-filled from the last recorded value for the same physical item,
      // e.g. a collection bin's start weight = its final weight on the most recent earlier grading
      // log. { match, column, sources, dateField }. An earlier row in this record wins over the
      // server lookup. Only fills when the cell is empty or the item it was pulled for changed,
      // and never once the row's confirm tick (type 'confirm', confirms: <this column>) is set.
      const carryCols = roster.columns.filter(c => c.carryPrev);
      const confirmCols = roster.columns.filter(c => c.type === 'confirm');
      const lockCols = roster.columns.filter(c => c.lockUntil);
      function isConfirmedFor(cur, colKey) {
        return confirmCols.some(k => k.confirms === colKey && cur[k.key] === 'Yes');
      }
      function setCarryHint(inp, text) {
        let hint = el(inp.id + '__hint');
        if (!hint) {
          hint = document.createElement('small');
          hint.id = inp.id + '__hint';
          hint.className = 'fr-carry-hint';
          inp.insertAdjacentElement('afterend', hint);
        }
        hint.textContent = text || '';
      }
      function setCarry(inp, value, hintText) {
        inp.value = String(value);
        setCarryHint(inp, hintText);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      function renderRosterCarry() {
        if (!carryCols.length) return;
        rows.forEach((_, i) => {
          const cur = readRow(i);
          carryCols.forEach(c => {
            const cp = c.carryPrev;
            const inp = el(fid(i, c.key));
            if (!inp || isConfirmedFor(cur, c.key)) return;
            const key = String(cur[cp.match] || '').trim();
            if (inp.dataset.carryFor === key) return;
            const firstSeen = inp.dataset.carryFor === undefined;
            inp.dataset.carryFor = key;
            if (!key || (firstSeen && String(inp.value).trim())) return;
            for (let j = i - 1; j >= 0; j--) {
              const r = readRow(j);
              if (String(r[cp.match] || '').trim().toUpperCase() === key.toUpperCase()
                && sumNumList(r[cp.column]) !== null) {
                setCarry(inp, r[cp.column], `From row ${j + 1} of this job`);
                return;
              }
            }
            inp.value = '';
            setCarryHint(inp, 'Looking up last weight…');
            const dateEl = cp.dateField ? el('fr_f_' + cp.dateField) : null;
            const before = (dateEl && dateEl.value) || new Date().toISOString().slice(0, 10);
            const path = `/api/roster-last/${encodeURIComponent(cp.column)}?sources=${encodeURIComponent((cp.sources || [config.recordKey]).join(','))}`
              + `&match=${encodeURIComponent(cp.match)}&value=${encodeURIComponent(key)}&before=${encodeURIComponent(before)}`
              + (cp.dateField ? `&dateField=${encodeURIComponent(cp.dateField)}` : '')
              + (editingId ? `&excludeId=${encodeURIComponent(editingId)}` : '');
            (window.FacilityApi ? window.FacilityApi.fetch(path)
              : fetch((window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com') + path))
              .then(res => (res.ok ? res.json() : null))
              .catch(() => null)
              .then(found => {
                if (!document.body.contains(inp) || inp.dataset.carryFor !== key) return;
                if (isConfirmedFor(readRow(i), c.key)) return;
                if (found && found.value != null && found.value !== '') {
                  setCarry(inp, found.value, `Last final weight — job ${found.jobNumber || '?'}`
                    + (found.date ? ` (${fmtDDMMYYYY(found.date)})` : '')
                    + (found.status === 'draft' ? ', still a draft' : ''));
                } else {
                  setCarryHint(inp, 'No earlier weight for this bin — weigh it and enter the start weight');
                }
              });
          });
        });
      }
      // lockUntil: a column stays disabled until the row's confirm tick is set; a confirmed
      // column goes read-only (untick to correct it).
      function applyRowLocks() {
        if (!lockCols.length && !confirmCols.length) return;
        rows.forEach((_, i) => {
          const cur = readRow(i);
          lockCols.forEach(c => {
            const inp = el(fid(i, c.key));
            if (!inp) return;
            const open = cur[c.lockUntil] === 'Yes';
            inp.disabled = !open;
            inp.title = open ? '' : 'Tick the start-weight check first';
          });
          confirmCols.forEach(c => {
            const target = c.confirms ? el(fid(i, c.confirms)) : null;
            if (target) target.readOnly = cur[c.key] === 'Yes';
          });
        });
      }
      // seqWithin: picking the group (e.g. size grade) on a row with no number yet numbers it
      // next in sequence for that group in this record. Stays editable.
      function autoSeq(e) {
        const t = e && e.target;
        if (!t || !t.id) return;
        roster.columns.filter(c => c.seqWithin).forEach(c => {
          rows.forEach((_, i) => {
            if (t.id !== fid(i, c.seqWithin)) return;
            const inp = el(fid(i, c.key));
            const grp = String(t.value || '').trim();
            if (!inp || String(inp.value).trim() || !grp) return;
            let max = 0;
            rows.forEach((__, j) => {
              if (j === i) return;
              const r = readRow(j);
              if (String(r[c.seqWithin] || '').trim() !== grp) return;
              const n = parseInt(r[c.key], 10);
              if (!isNaN(n) && n > max) max = n;
            });
            inp.value = String(max + 1);
          });
        });
      }
      container.addEventListener('change', (e) => {
        const cb = e.target && e.target.closest && e.target.closest('input[data-confirm-for]');
        if (!cb) return;
        const hidden = el(cb.dataset.confirmFor);
        if (!hidden) return;
        const col = confirmCols.find(c => cb.dataset.confirmFor.endsWith('_' + c.key));
        const target = col && col.confirms ? el(cb.dataset.confirmFor.slice(0, -col.key.length) + col.confirms) : null;
        if (cb.checked && target && !String(target.value).trim()) {
          cb.checked = false;
          toast('Enter the start weight before confirming it.');
          return;
        }
        hidden.value = cb.checked ? 'Yes' : '';
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
      });

      const canCollapse = roster.collapseRows !== false && roster.columns.length > 2;
      const collapsedRows = new Set();
      const dataCols = roster.columns.filter(c => c.type !== 'batchseq');

      function rowHasData(i) {
        return dataCols.some(c => {
          const inp = el(fid(i, c.key));
          return inp && String(inp.value || '').trim() !== '';
        });
      }
      function rowSummaryHtml(i) {
        const bits = [];
        roster.columns.forEach(c => {
          const inp = el(fid(i, c.key));
          const v = inp ? String(inp.value || '').trim() : '';
          if (!v) return;
          bits.push(c.type === 'batchseq' ? esc(v) : `${esc(c.label)}: ${esc(v)}`);
        });
        const shown = bits.slice(0, 5).join('  ·  ') + (bits.length > 5 ? '  ·  …' : '');
        return `<span class="fr-roster-summary-text">${shown || '(empty row)'}</span>`
          + `<button type="button" class="fr-btn fr-btn-flat fr-btn-sm no-print" data-roster-edit="${i}">Edit</button>`;
      }
      function applyCollapse() {
        if (!canCollapse) return;
        container.querySelectorAll('.fr-roster-row').forEach(rowEl => {
          const i = Number(rowEl.dataset.rosterRow);
          const collapse = collapsedRows.has(i) && rowHasData(i);
          let sum = rowEl.querySelector(':scope > .fr-roster-summary');
          if (collapse) {
            if (!sum) {
              sum = document.createElement('div');
              sum.className = 'fr-roster-summary';
              rowEl.insertBefore(sum, rowEl.firstChild);
            }
            const html = rowSummaryHtml(i);
            if (sum.innerHTML !== html) sum.innerHTML = html;
            rowEl.classList.add('fr-roster-row-collapsed');
          } else {
            if (sum) sum.remove();
            rowEl.classList.remove('fr-roster-row-collapsed');
          }
        });
      }

      function draw() {
        container.innerHTML = rows.map((r, i) => rosterRowHtml(ns, i, r, roster)).join('');

              if (typeof wireYesNo === 'function') wireYesNo(container);
              if (typeof wireJobNumber === 'function') wireJobNumber(container);
              if (typeof wireRecordPick === 'function') wireRecordPick(container, config);

              (config.autofill || []).forEach((rule) =>
                applyRestrict(el('fr_modalSections'), rule, rule.__lastFound || null));
              renderRosterDerived();
              renderRosterCarry();
              applyRowLocks();
              renderRosterTotals();
              container.querySelectorAll('[data-remove-roster-row]').forEach(btn => {
                btn.addEventListener('click', () => {
                  const i = Number(btn.dataset.removeRosterRow);
                  rows.splice(i, 1);
                  if (!rows.length && !roster.quickEntry) rows.push({});

                  const next = new Set();
                  collapsedRows.forEach(x => { if (x < i) next.add(x); else if (x > i) next.add(x - 1); });
                  collapsedRows.clear(); next.forEach(x => collapsedRows.add(x));
                  draw();
                });
              });
              applyCollapse();
            }

      // Derived cells first so totals read the fresh values (e.g. graded weight -> grade totals).
      container.addEventListener('input', (e) => {
        autoSeq(e);
        renderRosterDerived();
        renderRosterCarry();
        applyRowLocks();
        renderRosterTotals();
      });

      function collapseAllExcept(openIdx) {
        if (!canCollapse) return;
        collapsedRows.clear();
        rows.forEach((_, i) => { if (i !== openIdx && rowHasData(i)) collapsedRows.add(i); });
        applyCollapse();
      }
      container.addEventListener('focusin', (e) => {
        if (!canCollapse) return;
        const rowEl = e.target.closest && e.target.closest('.fr-roster-row');
        if (!rowEl) return;
        collapseAllExcept(Number(rowEl.dataset.rosterRow));
      });

      container.addEventListener('focusout', (e) => {
        if (!canCollapse) return;
        const rowEl = e.target.closest && e.target.closest('.fr-roster-row');
        if (!rowEl) return;
        const i = Number(rowEl.dataset.rosterRow);
        setTimeout(() => {
          if (container.contains(document.activeElement)) return;
          if (rowHasData(i)) { collapsedRows.add(i); applyCollapse(); }
        }, 0);
      });

      container.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('[data-roster-edit]');
        if (!btn) return;
        const i = Number(btn.dataset.rosterEdit);
        collapsedRows.delete(i);
        applyCollapse();
        const first = el(fid(i, (dataCols[0] || roster.columns[0]).key));
        if (first) { try { first.focus(); } catch (err) {} }
      });

      const jobWatch = el('fr_f_' + (config.batchField || 'jobNo'));
      if (jobWatch) ['input', 'change'].forEach(ev => {
        jobWatch.addEventListener(ev, renderRosterDerived);
        jobWatch.addEventListener(ev, loadGroupSums);
      });
      // batchseq columns key off roster.batchSeqDateField (default 'date'), a separate field
      // from the job -- re-derive when it changes too, so codes update as soon as it's filled in.
      const batchSeqDateKey = roster.batchSeqDateField || 'date';
      if (batchSeqDateKey !== (config.batchField || 'jobNo')) {
        const dateWatch = el('fr_f_' + batchSeqDateKey);
        if (dateWatch) ['input', 'change'].forEach(ev => dateWatch.addEventListener(ev, renderRosterDerived));
      }
      if (roster.pctTotal) {
        const ofEl = el('fr_f_' + roster.pctTotal.of);
        if (ofEl) ['input', 'change'].forEach(ev => ofEl.addEventListener(ev, renderRosterTotals));
      }
      draw();
      loadGroupSums();

      if (canCollapse) {
        rows.forEach((_, i) => { if (rowHasData(i)) collapsedRows.add(i); });
        applyCollapse();
      }
      // recordpick columns persist their status/verified/verifiedDate/href alongside the picked
      // value, off the same hidden fields wireRecordPick keeps live -- read here so it survives
      // save/reload of a draft, same as fillCode/fillName already do.
      function readRow(i) {
        const row = {};
        roster.columns.forEach(c => {
          const inp = el(fid(i, c.key));
          row[c.key] = inp ? inp.value : '';
          if (c.type === 'recordpick') {
            ['status', 'verified', 'verifiedDate', 'href'].forEach(suffix => {
              const sInp = el(fid(i, c.key) + '__' + suffix);
              if (sInp) row['__' + c.key + '_' + suffix] = sInp.value;
            });
          }
        });
        return row;
      }

      container._getRows = () => {
        rows = rows.map((_, i) => readRow(i));
        return rows;
      };

      container._importRows = (newRows) => {
        rows = rows.map((_, i) => readRow(i))
          .filter(r => roster.columns.some(c => String(r[c.key] || '').trim() !== ''));
        rows = rows.concat(newRows);
        draw();

        if (canCollapse) {
          rows.forEach((_, i) => { if (rowHasData(i)) collapsedRows.add(i); });
          applyCollapse();
        }
      };
      container._addRow = () => {

        rows = rows.map((_, i) => readRow(i));
        rows.push({});

        if (canCollapse) rows.forEach((_, i) => { if (rowHasData(i)) collapsedRows.add(i); });
        draw();
        const first = el(fid(rows.length - 1, (dataCols[0] || roster.columns[0]).key));
        if (first) { try { first.focus(); } catch (err) {} }
      };
    }

    function openForm(id) {
      editingId = id || null;
      const existing = id ? submissions.find(s => s.id === id) : null;
      const locked = isSubmitted(existing);
      const container = el('fr_modalSections');
      let html = locked
        ? `<div class="fr-locked">Submitted${existing.submittedAt
            ? ' on ' + new Date(existing.submittedAt).toLocaleString() : ''} — this submission can no longer be changed.</div>`
        : '';
      if (existing && existing.values && existing.values.oosWarningAck) {
        html += `<div class="fr-oos-warning" style="color:#b30000;font-weight:bold;">
          ${esc(existing.values.oosWarningNote || 'Batch weight exceeding OOSW - possible batch mix')}</div>`;
      }
      const renderSection = sec => {
        const compact = sec.fields.length && sec.fields.every(f => f.type === 'computed' || f.readOnly);
        const fieldsHtml = `<div class="fr-grid fr-grid-2${compact ? ' fr-compact' : ''}">
          ${sec.fields.map(f => `<label class="fr-field${f.wide ? ' wide' : ''}">${esc(f.label)}
            ${fieldInputHtml(`fr_f_${f.key}`, f, existing ? existing.values[f.key] : (f.default || ''))}
          </label>`).join('')}
        </div>`;
        if (sec.collapsible) {

          const sfyd = sec.summaryField
            ? ` data-summary-for="${esc([].concat(sec.summaryField).join(','))}"` : '';
          return `<details class="fr-section-collapsible"${sec.collapsedByDefault ? '' : ' open'}>
            <summary class="fr-section-title">${esc(sec.title)}<span class="fr-section-summary"${sfyd}></span></summary>
            ${fieldsHtml}
          </details>`;
        }
        return `<div class="fr-section-title">${esc(sec.title)}</div>${fieldsHtml}`;
      };
      const { pre: preSecs, post: postSecs } = sectionsAroundRoster(config);
      html += preSecs.map(renderSection).join('');
      if (hasRoster) {
        html += rosterList.map((roster, i) => `
        <div class="fr-section-title">${esc(roster.title)}</div>
        ${roster.quickEntry ? quickEntryHtml(roster, i) : ''}
        <div id="${rosterDomId('fr_rosterRows', i)}"${roster.quickEntry ? ' class="fr-qe-list"' : ''}></div>
        ${roster.quickEntry ? '' : `<button type="button" class="fr-btn fr-btn-flat fr-btn-sm" id="${rosterDomId('fr_addRosterRowBtn', i)}">+ Add row</button>
        <button type="button" class="fr-btn fr-btn-flat fr-btn-sm" id="${rosterDomId('fr_importCsvBtn', i)}">Import CSV</button>
        <input type="file" id="${rosterDomId('fr_csvFile', i)}" accept=".csv,text/csv" style="display:none;">`}
        ${roster.totalsRow ? `<div id="${rosterDomId('fr_rosterTotals', i)}" class="fr-roster-totals"></div>` : ''}`).join('');
      }
      html += postSecs.map(renderSection).join('');

      if (existing && existing.values) {
        const currentKeys = new Set(allFields(config).map(f => f.key));
        const removed = Object.entries(existing.values).filter(([k, v]) => !currentKeys.has(k) && v !== '' && v != null);
        if (removed.length) {
          html += `<div class="fr-section-title">Previously captured</div>
            <div class="fr-grid fr-grid-2">${removed.map(([k, v]) =>
              `<label class="fr-field">${esc(k)}<input type="text" value="${esc(v)}" disabled></label>`).join('')}</div>`;
        }
      }
      container.innerHTML = html;
      if (hasRoster) {
        rosterList.forEach((roster, i) => {
          renderRosterEditor(existing ? getRosterRows(existing, i, roster.key) : null, roster, i);
          const rowsId = rosterDomId('fr_rosterRows', i);
          if (roster.quickEntry) { wireQuickEntry(roster, i, container.querySelector('#' + rowsId)); return; }
          el(rosterDomId('fr_addRosterRowBtn', i)).addEventListener('click',
            () => container.querySelector('#' + rowsId)._addRow());
          el(rosterDomId('fr_importCsvBtn', i)).addEventListener('click',
            () => el(rosterDomId('fr_csvFile', i)).click());
          el(rosterDomId('fr_csvFile', i)).addEventListener('change', function () {
            const file = this.files && this.files[0];
            this.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => importRosterCsv(String(reader.result), container.querySelector('#' + rowsId), roster);
            reader.onerror = () => alert('Could not read that file.');
            reader.readAsText(file);
          });
        });
      }

      if (typeof wireYesNo === 'function') wireYesNo(container);
      if (typeof wireJobNumber === 'function') wireJobNumber(container);
      if (typeof wireUpload === 'function') wireUpload(container);
      if (typeof wireBinJobsAutofill === 'function') wireBinJobsAutofill(container, config);
      if (typeof wireRecordPick === 'function') wireRecordPick(container, config);
      wireSectionSummaries(container);
      if (!locked) { wireJobSearch(container, config); wireAutofill(container, config); wireJobRouteCheck(container, config); }
      if (!locked) { container.addEventListener('input', refreshComputeFns); refreshComputeFns(); }

      const pickFields = allFields(config).concat(rosterList.reduce((acc, r) => acc.concat(r.columns || []), []));
      const traceJobField = (pickFields.find(f => f.type === 'recordpick' && f.jobField) || {}).jobField
        || config.batchField;
      const traceJobInput = traceJobField ? el('fr_f_' + traceJobField) : null;
      if (traceJobInput && container.querySelector('select[data-recordpick][data-jobtrace]:not([data-jobtrace=""])')) {
        ['change', 'input'].forEach(ev =>
          traceJobInput.addEventListener(ev, () => wireRecordPick(container, config)));
      }

      if (existing && Array.isArray(existing.provisionalFields)) {
        existing.provisionalFields.forEach((k) => markProvisional(container.querySelector('#fr_f_' + k), true));
        renderProvisionalNotice(container);
      }

      // resumeByJob: this record is completed over more than one sitting (e.g. REC 7.1.3 —
      // start times captured now, finish times added later). On a fresh entry, picking a job
      // that already has an unsubmitted draft reopens that draft so the earlier data comes
      // back instead of starting a blank second record for the same job.
      if (!id && !locked && config.resumeByJob) {
        const jobKey = config.batchField || 'jobNo';
        const jobEl = el('fr_f_' + jobKey);
        if (jobEl) {
          const tryResume = () => {
            if (editingId) return;
            const jobNo = String(jobEl.value || '').trim();
            if (!jobNo) return;
            const draft = submissions
              .filter((s) => !isSubmitted(s) && String((s.values || {})[jobKey] || '').trim() === jobNo)
              .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0];
            if (draft) {
              jobEl.removeEventListener('change', tryResume);
              jobEl.removeEventListener('input', tryResume);
              toast('Continuing the saved draft for job ' + jobNo + '.');
              openForm(draft.id);
            }
          };
          ['change', 'input'].forEach((ev) => jobEl.addEventListener(ev, tryResume));
        }
      }

      const computedIds = new Set(allFields(config).filter((f) => f.type === 'computed').map((f) => `fr_f_${f.key}`));
      container.querySelectorAll('input,select,textarea,button').forEach(i => { i.disabled = locked || computedIds.has(i.id); });
      el('fr_saveBtn').style.display = locked ? 'none' : '';
      el('fr_submitBtn').style.display = locked ? 'none' : '';
      el('fr_cancelBtn').textContent = locked ? 'Close' : 'Clear';
      formLocked = locked;
      disarmClear();
    }

    function closeForm() { editingId = null; openForm(null); }


    async function saveForm(finalize) {

      if (!await refreshProvisional(el('fr_modalSections'), config, finalize, toast)) return;

      const values = {};
      let missingRequired = null;
      let unverifiedRequired = null;
      let invalidJobNumber = null;
      let routeConflict = null;
      allFields(config).forEach(f => {
        const inp = el(`fr_f_${f.key}`);
        values[f.key] = inp ? inp.value : '';
        if (f.required && !String(values[f.key] || '').trim()) missingRequired = f.label;
        // A required top-level recordpick field (e.g. an attachment checklist row) must not just
        // be picked -- the real linked record it points to must have reached Verified status,
        // same gate as required recordpick columns inside a roster (see incompleteRoster below).
        if (f.type === 'recordpick' && f.required && String(values[f.key] || '').trim()) {
          const status = (el(`fr_f_${f.key}__status`) || {}).value;
          const verified = (el(`fr_f_${f.key}__verified`) || {}).value === '1';
          if (!recordpickVerified(status, verified)) unverifiedRequired = f.label;
        }
        if (f.type === 'jobnumber' && f.validate !== false && values[f.key] &&
            window.Lookups && window.Lookups.batch && !window.Lookups.batch.isValid(values[f.key])) {
          invalidJobNumber = f.label;
        }
      });

      allFields(config).forEach(f => {
        if (!f.matchJobRoute || !window.Lookups || !window.Lookups.batch) return;
        const jobVal = values[f.matchJobRoute];
        if (jobVal && values[f.key] && !window.Lookups.batch.routeMatches(jobVal, values[f.key])) {
          routeConflict = window.Lookups.batch.routeError(jobVal);
        }
      });
      if (missingRequired && finalize) { toast(`"${missingRequired}" is required.`); return; }
      if (unverifiedRequired && finalize) { toast(`"${unverifiedRequired}" must be attached and verified before this can be submitted.`); return; }
      if (invalidJobNumber && finalize) { toast(`"${invalidJobNumber}" is not a valid job number.`); return; }
      if (routeConflict && finalize) { toast(routeConflict); return; }

      // Business rules (see BusinessRules.run / public/data/business-rules.json): every
      // cross-record check for every form lives in that one registry, not in form code or record
      // JSON. A rule can veto the finalize (returns false -> abort, same as the gates above).
      if (finalize) {
        const ok = await runBusinessRules(config, values, editingId);
        if (!ok) return;
      }

      let completedBy = null;
      if (finalize) {
        completedBy = {
          by: (el('fr_cb_by').value || '').trim(),
          title: (el('fr_cb_title').value || '').trim(),
          date: (el('fr_cb_date').value || '').trim(),
          signature: (el('fr_cb_signature').value || '').trim()
        };
        if (window.AUTH_GATES_ENABLED === true && (!completedBy.by || !completedBy.title || !completedBy.date || !completedBy.signature)) {
          toast('Completed by, title, date and signature are required to submit.');
          return;
        }
      }

      if (config.batchField && window.BatchValidation) {
        const batchValue = values[config.batchField];
        if (batchValue && !window.BatchValidation.isValid(batchValue)) {
          toast(window.BatchValidation.formatError());
          return;
        }
      }
      const rosterRowsByIndex = hasRoster
        ? rosterList.map((roster, i) => el(rosterDomId('fr_rosterRows', i))._getRows())
        : undefined;

      // Finalize-only gate: every row in a roster column marked `required: true` (type
      // 'recordpick') must be attached to a specific submission AND that submission verified,
      // before this record can be submitted. Saving a draft is always allowed regardless.
      let incompleteRoster = null;
      if (rosterRowsByIndex && finalize) {
        rosterList.forEach((roster, i) => {
          if (incompleteRoster) return;
          const requiredCols = (roster.columns || []).filter(c => c.type === 'recordpick' && c.required);
          if (!requiredCols.length) return;
          const rows = rosterRowsByIndex[i];
          const incomplete = rows.some(r => requiredCols.some(c => {
            const value = r[c.key];
            if (!value) return true;
            const status = r['__' + c.key + '_status'];
            const verified = r['__' + c.key + '_verified'] === '1' || r['__' + c.key + '_verified'] === true;
            return !recordpickVerified(status, verified);
          }));
          if (incomplete) incompleteRoster = roster;
        });
      }
      if (incompleteRoster && finalize) {
        toast(`All records in "${incompleteRoster.title}" must be attached and verified before this can be submitted.`);
        return;
      }
      // Required confirm ticks (e.g. bin start weight checked) on every row that holds data.
      if (rosterRowsByIndex && finalize) {
        let unconfirmed = null;
        rosterList.forEach((roster, i) => {
          if (unconfirmed) return;
          const reqConfirm = (roster.columns || []).filter(c => c.type === 'confirm' && c.required);
          if (!reqConfirm.length) return;
          const idx = rosterRowsByIndex[i].findIndex(r =>
            (roster.columns || []).some(c => c.type !== 'confirm' && String(r[c.key] || '').trim() !== '')
            && reqConfirm.some(c => r[c.key] !== 'Yes'));
          if (idx !== -1) unconfirmed = { roster, row: idx + 1, col: reqConfirm[0] };
        });
        if (unconfirmed) {
          toast(`"${unconfirmed.roster.title}" row ${unconfirmed.row}: ${unconfirmed.col.label} must be ticked before submitting.`);
          return;
        }
      }

      if (rosterRowsByIndex) {
        const allRosterRows = rosterRowsByIndex.reduce((acc, rows) => acc.concat(rows), []);
        allFields(config).forEach((f) => {
          if (f.type !== 'computed' || !f.sumRosterColumn) return;
          values[f.key] = sumRosterRows(f, allRosterRows).toFixed(2);
        });

        rosterList.forEach((roster, i) => {
          const rosterCols = roster.columns || [];
          const batchSeqDate = values[roster.batchSeqDateField || 'date'];
          rosterRowsByIndex[i].forEach((r, idx) => {
            rosterCols.forEach((c) => {
              if (c.type === 'batchseq') r[c.key] = formatBatchSeq(batchSeqDate, idx);
              else if ((c.type === 'derived' || c.deriveJoin) && !c.deriveGroupSum) r[c.key] = computeRowDerived(c, r);
            });
          });
        });
      }
      if (window.ComputeRegistry) {
        allFields(config).forEach((f) => {
          if (f.type !== 'computed' || !f.computeFn) return;
          const r = window.ComputeRegistry.run(f.computeFn, f.computeArgs || {}, values);
          values[f.key] = r === '' || r == null ? '' : String(r);
        });
      }

      const status = finalize ? 'submitted' : 'draft';
      let savedSub;
      if (editingId) {
        const existing = submissions.find(s => s.id === editingId);
        if (isSubmitted(existing)) { toast('This submission is submitted and can no longer be changed.'); return; }
        existing.history = existing.history || [];
        existing.history.push({
          ts: Date.now(), previousValues: existing.values,
          previousRoster: existing.roster, previousRosters: existing.rosters
        });
        existing.values = values;
        if (hasRoster) rosterList.forEach((roster, i) => setRosterRows(existing, i, roster.key, rosterRowsByIndex[i]));
        existing.updatedAt = Date.now();
        existing.status = status;
        if (finalize) { existing.submittedAt = Date.now(); existing.completedBy = completedBy; }
        savedSub = existing;
      } else {
        const sub = {
          id: uid('sub'),
          values,
          status,
          source: 'manual',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          history: [],
          signOffs: []
        };
        if (finalize) { sub.submittedAt = Date.now(); sub.completedBy = completedBy; }
        if (hasRoster) rosterList.forEach((roster, i) => setRosterRows(sub, i, roster.key, rosterRowsByIndex[i]));
        submissions.push(sub);
        savedSub = sub;
      }

      const provisionalKeys = Array.from(el('fr_modalSections').querySelectorAll('[data-provisional="1"]'))
        .map((e) => e.id.replace(/^fr_f_/, ''));
      if (provisionalKeys.length) savedSub.provisionalFields = provisionalKeys;
      else delete savedSub.provisionalFields;

      if (window.Auth && window.Auth.isAuthenticated()) {
        const signOff = window.Auth.createSignOff(status);
        if (signOff && savedSub.signOffs) {
          savedSub.signOffs.push(signOff);
        }
      }
      const ok = await persist();
      if (!ok) { toast('Save failed — please retry.'); return; }

      if (window.Traceability && config.batchField) window.Traceability.indexSubmission(config, savedSub);
      if (finalize) {
        ['fr_cb_by', 'fr_cb_title', 'fr_cb_date', 'fr_cb_signature'].forEach(id => { const i = el(id); if (i) i.value = ''; });
        suggestCompletedBy();
      }
      closeForm();
      renderTable();

      refreshVerification();
      toast(finalize ? 'Submitted for verification.' : 'Draft saved.');
    }


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



    function displayValue(field, raw) {
      if (raw === '' || raw == null) return '';
      if (field && field.type === 'date') return window.DocHeader.fmtDate(raw);
      return String(raw);
    }

    function sheetSectionsHtml(sub, which) {
      const { pre, post } = sectionsAroundRoster(config);
      const secs = which === 'post' ? post : which === 'pre' ? pre : (config.sections || []);
      return secs.map(sec => {
        const rows = (sec.fields || []).map(f =>
          `<tr><td class="fr-sheet-lbl">${esc(f.label)}${f.unit ? ' (' + esc(f.unit) + ')' : ''}</td>
             <td>${esc(displayValue(f, sub.values[f.key]))}</td></tr>`).join('');
        if (!rows) return '';

        const pageBreak = sec.newPage ? ' style="page-break-before:always;"' : '';
        return `<div${pageBreak}><h3>${esc(sec.title)}</h3><table><tbody>${rows}</tbody></table></div>`;
      }).join('');
    }

    function sheetRosterHtml(sub) {
      if (!hasRoster) return '';
      return rosterList.map((roster, i) => sheetOneRosterHtml(sub, roster, i)).join('');
    }

    function sheetOneRosterHtml(sub, roster, i) {
      const cols = roster.columns || [];
      const rows = getRosterRows(sub, i, roster.key).filter(r =>
        cols.some(c => String(r[c.key] || '').trim() !== ''));

      const body = (rows.length ? rows : [{}, {}, {}]).map(r =>
        `<tr>${cols.map(c => `<td>${esc(displayValue(c, r[c.key]))}</td>`).join('')}</tr>`).join('');
      let totalsRowHtml = '';
      if (roster.totalsRow && rows.length) {
        const totals = {};
        roster.totalsRow.forEach(k => { totals[k] = 0; });
        rows.forEach(r => roster.totalsRow.forEach(k => {
          const val = parseFloat(r[k]);
          if (!isNaN(val)) totals[k] += val;
        }));
        totalsRowHtml = `<tr>${cols.map((c, ci) => {
          if (roster.totalsRow.includes(c.key)) return `<td><strong>${totals[c.key].toFixed(2)}</strong></td>`;
          return `<td><strong>${ci === 0 ? 'Total' : ''}</strong></td>`;
        }).join('')}</tr>`;
      }
      let pctHtml = '';
      const p = roster.pctTotal;
      if (p && rows.length) {
        const numer = rows.reduce((s, r) => { const n = parseFloat(r[p.num]); return s + (isNaN(n) ? 0 : n); }, 0);
        const denom = parseFloat(sub.values[p.of]);
        const txt = (!isNaN(denom) && denom > 0) ? (numer / denom * 100).toFixed(2) + '%' : '—';
        pctHtml = `<p class="fr-roster-totals"><strong>${esc(p.label || 'OOSW %')}: ${txt}</strong></p>`;
      }
      return `<h3>${esc(roster.title)}</h3>
        <table><thead><tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${body}${totalsRowHtml}</tbody></table>${pctHtml}`;
    }


    function fmtDateTime(ts) {
      const d = new Date(ts);
      if (isNaN(d)) return '';
      return window.DocHeader.fmtDate(d) + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }


    function sheetSignHtml(sub) {
      const done = isSubmitted(sub);
      const signOff = (sub.signOffs || []).filter(s => s.action === 'submitted').slice(-1)[0];
      const who = done && signOff ? (signOff.by || '') : '';

      const when = done && sub.submittedAt
        ? (config.submitStamp ? fmtDateTime(sub.submittedAt)
                              : window.DocHeader.fmtDate(new Date(sub.submittedAt))) : '';
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

    function oosWarningHtml(sub) {
      if (!sub.values || !sub.values.oosWarningAck) return '';
      return `<p class="fr-oos-warning" style="color:#b30000;font-weight:bold;">
        ${esc(sub.values.oosWarningNote || 'Batch weight exceeding OOSW - possible batch mix')}</p>`;
    }

    function buildSheet(sub) {
      return `<div class="fr-sheet-page">
        ${sheetSectionsHtml(sub, 'pre')}${sheetRosterHtml(sub)}${sheetSectionsHtml(sub, 'post')}${oosWarningHtml(sub)}${sheetSignHtml(sub)}
      </div>`;
    }

    function withPrintTitle(name, fn) {
      const previousTitle = document.title;
      document.title = name;
      try { fn(); } finally { document.title = previousTitle; }
    }

    function printSheets(list, filename) {
      if (!list.length) { toast('Nothing to print — no submissions match these filters.'); return; }
      el('fr_printSheet').innerHTML = list.map(buildSheet).join('');
      document.body.classList.add('fr-printing');
      try { withPrintTitle(filename, () => window.print()); }
      finally { document.body.classList.remove('fr-printing'); }
    }


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


    let refreshVerification = () => {};
    if (showVerification) {
      let verifyGate = { allowed: true, signedIn: true, roles: [], rolesLabel: '' };

      async function loadVerifyGate() {
        try { verifyGate = await window.SignOffBlock.verifyGate(config.recordKey); }
        catch (e) { verifyGate = { allowed: true, signedIn: true, roles: [], rolesLabel: '' }; }
        applyVerifyGate();
      }

      function applyVerifyGate() {
        const btn = el('fr_saveVerificationBtn');
        if (btn) {
          btn.disabled = !verifyGate.allowed;
          btn.title = verifyGate.allowed ? '' : window.SignOffBlock.gateMessage(verifyGate);
        }
        const line = el('fr_verifyGate');
        if (!line) return;
        if (verifyGate.allowed) { line.style.display = 'none'; line.innerHTML = ''; return; }
        line.style.display = '';
        line.textContent = window.SignOffBlock.gateMessage(verifyGate) + ' ';
        if (!verifyGate.signedIn && window.LoginUI && window.LoginUI.showLoginModal) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'fr-btn fr-btn-flat fr-btn-sm';
          b.textContent = 'Sign in';
          b.addEventListener('click', () => window.LoginUI.showLoginModal());
          line.appendChild(b);
        }
      }

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
        applyVerifyGate();
        const target = el('fr_verificationHistory');
        if (!hist.length) { target.innerHTML = `<div class="fr-history-item fr-muted">No verification logged yet.</div>`; return; }
        target.innerHTML = hist.slice().reverse().map(v => `
          <div class="fr-history-item"><span>${window.SignOffBlock.historyLine(v)}</span></div>`).join('');
      }

      el('fr_saveVerificationBtn').addEventListener('click', async () => {
        verifyGate = await window.SignOffBlock.verifyGate(config.recordKey);
        applyVerifyGate();
        if (!verifyGate.allowed) { toast(window.SignOffBlock.gateMessage(verifyGate)); return; }

        const values = window.SignOffBlock.readVerifyInputs('fr_verified');
        if (!window.SignOffBlock.validateVerifyInputs(values)) { toast('Verified by, title, date and signature are all required.'); return; }

        const picked = [...document.querySelectorAll('.fr-verify-pick:checked')].map(cb => cb.value);
        if (pendingForVerification().length && !picked.length) { toast('Tick at least one entry to verify.'); return; }

        const record = await window.SignOffBlock.logVerification({ recordKey: config.recordKey, values, picked });

        if (picked.length) {
          const set = new Set(picked);
          submissions.forEach(s => { if (set.has(s.id)) s.verification = record; });

          if (!await persist()) { toast('Verification could not be saved — please retry.'); return; }
          renderTable();
        }
        toast(picked.length ? `Verification logged for ${picked.length} ${picked.length === 1 ? 'entry' : 'entries'}.` : 'Verification logged.');
        window.SignOffBlock.clearVerifyInputs('fr_verified');
        renderVerificationHistory();
      });
      refreshVerification = renderVerificationHistory;
      loadVerifyGate();
      if (typeof document !== 'undefined') {
        document.addEventListener('authSuccess', () => { loadVerifyGate(); });
      }
    }

    el('fr_cancelBtn').addEventListener('click', onClearClick);
    el('fr_saveBtn').addEventListener('click', () => saveForm(false));
    el('fr_submitBtn').addEventListener('click', () => saveForm(true));
    el('fr_exportJsonBtn').addEventListener('click', exportJson);
    el('fr_printBtn').addEventListener('click', printPdf);
    const instrToggle = el('fr_instrToggle');
    if (instrToggle) {
      instrToggle.addEventListener('click', () => {
        const panel = instrToggle.closest('.fr-instr-panel');
        const open = panel.classList.toggle('fr-open');
        instrToggle.textContent = open ? 'Hide' : 'Show';
      });
    }
    ['filterFrom', 'filterTo', 'filterSearch'].forEach(suffix => {
      el(`fr_${suffix}`).addEventListener('input', renderTable);
    });


    openForm(null);


    if (canManageTemplates && new URLSearchParams(location.search).get('editTemplate') === '1') {
      function doOpen() {
        window.TemplateEditor.open({
          recordKey: config.recordKey,
          engine: 'form-record',
          currentConfig: {
            sections: JSON.parse(JSON.stringify(config.sections || [])),
            roster: config.roster ? JSON.parse(JSON.stringify(config.roster)) : null,
            listColumns: config.listColumns ? config.listColumns.slice() : undefined
          },
          inlineConfig,
          docRevisionStart: config.docRevisionStart,
          onSave: () => location.reload()
        });
      }
      if (window.TemplateEditor) { doOpen(); }
      else {
        const s = document.createElement('script');
        s.src = (config.libPath || '../lib/') + 'template-editor.js';
        s.onload = doOpen;
        document.head.appendChild(s);
      }
    }



    if (window.storage && window.storage.whenReady) await window.storage.whenReady();
    await mountDocHeader(config);
    renderDocBadge();
    await load();
    renderTable();
    refreshVerification();

    // Deep link from Batch Traceability etc.: #<submissionId> opens that entry
    // (read-only if already submitted) rather than a blank new-entry form.
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    function openFromHash() {
      let id = (location.hash || '').replace(/^#/, '');
      try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
      id = id.trim();
      if (!id) return;
      if (!submissions.some(s => s.id === id)) { toast('That entry has not reached this device yet.'); return; }
      openForm(id);
      const panel = el('fr_modalSections');
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }


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


  if (!window.__revealToggleWired) {
    window.__revealToggleWired = true;
    document.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('[data-reveal]') : null;
      if (!btn) return;
      var target = document.getElementById(btn.getAttribute('data-reveal'));
      if (!target) return;
      ev.preventDefault();
      var open = target.classList.toggle('ml-open');
      target.classList.toggle('fr-open', open);
      btn.textContent = (open ? 'Hide ' : 'View ') + btn.getAttribute('data-label');
    });
  }

  window.FormRecord = { init };
})();
