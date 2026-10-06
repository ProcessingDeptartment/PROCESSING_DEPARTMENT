(function () {
  const NS_ROOT = 'ml';

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
  /* Long lists (entries, verification queue, verification history) are collapsed
     behind a reveal button so a record opens as a form, not as a wall of rows. */
  .ml-collapsible{ display:none; }
  .ml-collapsible.ml-open{ display:block; }
  .ml-reveal-btn{ margin:0 0 10px; }
  .ml-instructions{ display:grid; gap:8px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
  .ml-instructions .instr-item{ background:var(--palette-head-bg,#fbfbfa); border:1px solid var(--palette-border,#e2e4e3); border-radius:4px; padding:8px 10px; }
  .ml-instructions .instr-item strong{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--palette-label,#54606b); margin-bottom:3px; }
  .ml-related a{ color:#1d4ed8; font-weight:600; text-decoration:none; }
  .ml-related a:hover{ text-decoration:underline; }
  .ml-grid{ display:grid; gap:10px; }
  .ml-grid-2{ grid-template-columns:repeat(2,1fr); }
  .ml-grid-3{ grid-template-columns:repeat(3,1fr); }
  .ml-grid-4{ grid-template-columns:repeat(4,1fr); }
  .ml-field{ display:flex; flex-direction:column; gap:3px; font-size:11.5px; color:var(--palette-label,#54606b); font-weight:600; }
  .ml-field.wide{ grid-column:1/-1; }
  .ml-grid.ml-custom-body{ display:block; }
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
  .ml-yesno{ display:flex; gap:10px; }
  .ml-yesno button{ flex:1; padding:7px 10px; font-size:12px; min-height:32px; border:1px solid #c9cdd1 !important; background:#fff; color:#54606b; }
  .ml-yesno button:hover:not(:disabled){ border-color:#8a939b !important; }
  /* Which answer is "good" (green) vs "bad" (red) varies by question -- set via
     data-good="Yes"|"No" on the .ml-yesno span (defaults to Yes when absent). */
  .ml-yesno[data-good="Yes"] button.on[data-v="Yes"], .ml-yesno[data-good="No"] button.on[data-v="No"], .ml-yesno:not([data-good]) button.on[data-v="Yes"]{ background:var(--palette-ok-bg,#e8f3ec); border-color:var(--palette-ok,#2f7a52) !important; color:var(--palette-ok,#2f7a52); }
  .ml-yesno[data-good="Yes"] button.on[data-v="No"], .ml-yesno[data-good="No"] button.on[data-v="Yes"], .ml-yesno:not([data-good]) button.on[data-v="No"]{ background:var(--palette-fail-bg,#fbe8e6); border-color:var(--palette-fail,#a3352d) !important; color:var(--palette-fail,#a3352d); }
  .ml-tick{ display:flex; align-items:center; gap:10px; min-height:44px; font-size:14px; }
  .ml-tick input[type=checkbox]{ width:26px !important; height:26px !important; min-width:26px; padding:0 !important; margin:0; flex:none; }
  .ml-tick > span{ flex:1; min-width:0; white-space:normal; text-transform:none; letter-spacing:0; font-weight:600; }
  .ml-yesno button:disabled{ opacity:.55; cursor:not-allowed; }
  /* Problem answer (the non-good one) is not colour-only: bold text plus a warning mark, and a border on paper. */
  .ml-yesno[data-good="Yes"] button.on[data-v="No"], .ml-yesno[data-good="No"] button.on[data-v="Yes"]{ font-weight:800; }
  .ml-yesno[data-good="Yes"] button.on[data-v="No"]::after, .ml-yesno[data-good="No"] button.on[data-v="Yes"]::after{ content:' \\26A0'; }
  .ml-bad{ color:var(--palette-fail,#a3352d); background:var(--palette-fail-bg,#fbe8e6); font-weight:800; border:1px solid var(--palette-fail,#a3352d); border-radius:4px; padding:1px 6px; white-space:nowrap; }
  .ml-fromnote{ display:block; margin-top:3px; font-size:11px; color:#6b7680; }
  .ml-fromnote.warn{ color:#8a5a00; background:#fff4d6; border:1px solid #e6c46a; border-radius:4px; padding:3px 6px; }
  /* REC 7.4.6 progressive stages: status line, sign-off banner, locked-from-an-earlier-stage values, job list with stage expander */
  .ml-stageline{ grid-column:1/-1; font-weight:700; font-size:13px; color:var(--palette-heading,#2f4356); background:#eef3f7; border:1px solid #d5dfe7; border-radius:6px; padding:8px 10px; }
  .ml-stageline.complete{ background:#e6f4ea; border-color:#b9dcc3; }
  .ml-so-banner{ margin:0 0 10px; padding:8px 10px; border-radius:6px; font-size:12.5px; font-weight:600; background:#fff4d6; color:#8a5a00; border:1px solid #e6c46a; }
  .ml-so-banner.info{ background:#eef3f7; color:#3a444d; border-color:#d5dfe7; font-weight:500; }
  .ml-signoff-block.ml-so-needed > summary::after{ content:' — required to submit'; color:#8a5a00; text-transform:none; letter-spacing:0; font-weight:700; }
  .ml-so-split{ border-top:1px solid var(--palette-border,#e2e4e3); margin:14px 0 10px; }
  .ml-field input.ml-stage-locked{ background:#f2f4f6; }
  .ml-stages-row > td{ background:#f7f9fb; padding:0 0 0 24px; }
  .ml-stages-row table{ width:100%; font-size:12px; }
  .ml-stages-row.ml-hide{ display:none; }
  .ml-commentprompt{ outline:2px solid var(--palette-fail,#a3352d); }
  .ml-field.ml-readonly-calc input:disabled, .ml-field input[readonly]{ background:#f2f4f6; color:#3a444d; }
  .ml-grouphead{ grid-column:1/-1; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--palette-heading,#2f4356);
    font-weight:700; border-bottom:1px solid var(--palette-border,#e2e4e3); padding-bottom:4px; margin:12px 0 2px; }
  .ml-grouphead:first-child{ margin-top:0; }
  /* Collapsible job-info block: the group's heading becomes the summary and the job number
     stays visible in it while collapsed. */
  .ml-section-collapsible{ grid-column:1/-1; margin:12px 0 2px; }
  .ml-section-collapsible > summary.ml-grouphead{ cursor:pointer; list-style:none; margin:0 0 8px; }
  .ml-section-collapsible > summary.ml-grouphead::-webkit-details-marker{ display:none; }
  .ml-section-collapsible > summary.ml-grouphead::before{ content:'\\25B8'; display:inline-block; width:1em; }
  .ml-section-collapsible[open] > summary.ml-grouphead::before{ content:'\\25BE'; }
  .ml-section-collapsible > label.ml-field{ display:flex; margin-bottom:8px; }
  .ml-section-collapsible > summary.ml-grouphead{ min-height:44px; display:flex; align-items:center; }
  .ml-section-collapsible > summary.ml-stagehead{ justify-content:flex-start; gap:8px; }
  .ml-section-collapsible > summary .ml-stage-state{ margin-left:auto; }
  .ml-section-collapsible > summary:focus-visible, .ml-collapse-ctl button:focus-visible{ outline:2px solid var(--palette-ink,#1b2330); outline-offset:2px; }
  .ml-section-body{ margin-bottom:8px; }
  .ml-collapse-ctl{ display:flex; justify-content:flex-end; gap:6px; align-items:center; margin:0 0 6px; font-size:12px; }
  .ml-collapse-ctl[hidden]{ display:none; }
  .ml-collapse-ctl button{ background:none; border:0; padding:6px 4px; color:var(--palette-link,#1f5fa8); text-decoration:underline; cursor:pointer; font-size:12px; }
  @media (prefers-reduced-motion:reduce){ .ml-section-collapsible > summary.ml-grouphead::before{ transition:none; } }
  .ml-section-summary{ font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; text-transform:none; letter-spacing:0; color:var(--palette-ink,#1b2330); font-weight:700; }
  .ml-section-summary:not(:empty){ margin-left:8px; }
  /* Work instructions are collapsed by default on every viewport -- they are reference
     text, not the task, and push the actual work down the page. One click to read them. */
  .ml-instr-toggle{ display:inline-block; }
  .ml-instr-panel .ml-panel-body{ display:none; }
  .ml-instr-panel.ml-open .ml-panel-body{ display:block; }
  .ml-stamp{ display:block; }
  .ml-prefixed{ display:flex; align-items:stretch; }
  .ml-prefix{ display:flex; align-items:center; padding:5px 9px; border:1px solid #c9cdd1; border-right:none;
    border-radius:3px 0 0 3px; background:var(--palette-paper,#f4f5f3); font-family:'IBM Plex Mono','SF Mono',Consolas,monospace;
    font-size:12.5px; font-weight:700; color:var(--palette-heading,#2f4356); }
  .ml-prefixed input[type=text]{ border-radius:0 3px 3px 0; letter-spacing:.12em; }
  .ml-continue-row{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; align-items:end; }
  .ml-continue .ml-muted{ font-size:11.5px; margin-top:8px; }
  .ml-continue > .ml-btn{ margin-top:10px; }
  @media (max-width:700px){
    .ml-continue-row{ grid-template-columns:1fr; }
    .ml-continue > .ml-btn{ width:100%; }
  }
  .ml-stagehead{ display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
  .ml-stage-state{ font-weight:600; text-transform:none; letter-spacing:0; font-size:11px; display:inline-flex; align-items:center; gap:6px; }
  .ml-stage-open{ color:var(--palette-ok,#2e6b45); }
  .ml-app label.ml-field input:disabled,.ml-app label.ml-field select:disabled,.ml-app label.ml-field textarea:disabled{
    background:var(--palette-paper,#f4f5f3); color:var(--palette-ink,#1b2330); opacity:1; cursor:not-allowed; }
  .ml-notice{ display:none; padding:8px 12px; border-radius:4px; font-size:11.5px; font-weight:600; margin-bottom:10px; }
  .ml-notice.show{ display:block; }
  .ml-notice-due{ background:var(--palette-fail-bg,#fbe8e6); color:var(--palette-fail,#a3352d); border:1px solid #e8b8b3; }
  .ml-notice-provisional{ background:#fbf0dc; color:#8a5a10; border:1px solid #e8d3a8; }
  .ml-app input.ml-provisional,.ml-app select.ml-provisional{ background:#fdf7ea; border-color:#d9ac5a; }
  .ml-empty{ padding:18px; text-align:center; color:#8a939b; }
  .ml-history-list{ max-height:220px; overflow:auto; border:1px solid var(--palette-border,#e2e4e3); border-radius:4px; }
  .ml-history-item{ padding:7px 10px; border-bottom:1px solid var(--palette-border,#e2e4e3); display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:11.5px; }
  .ml-history-item:last-child{ border-bottom:none; }
  .ml-modal-overlay{ position:fixed; inset:0; background:rgba(20,25,30,.5); z-index:500; align-items:center; justify-content:center; }
  .ml-modal-inner{ background:#fff; border-radius:8px; width:min(760px,94vw); max-height:90vh; overflow:auto; padding:16px; }
  .ml-locked{ padding:8px 11px; margin-bottom:10px; border-left:3px solid var(--palette-ok,#2f6b3a); background:var(--palette-ok-bg,#e4f0e6); color:var(--palette-ok,#2f6b3a); font-size:11.5px; font-weight:600; }
  .ml-locked[hidden]{ display:none; }
  .ml-modal-inner h2{ font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--palette-heading,#2f4356); margin-bottom:10px; }
  .ml-modal-inner h3{ font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--palette-label,#54606b); margin:14px 0 6px; }
  .ml-actions{ display:flex; gap:10px; justify-content:flex-end; margin-top:10px; flex-wrap:wrap; align-items:center; }
  .ml-toast{ position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:var(--palette-dark,#1d2b38); color:#fff; padding:9px 18px; border-radius:20px; font-size:12px; z-index:999; opacity:0; pointer-events:none; transition:opacity .25s; }
  .ml-toast.show{ opacity:1; }
  /* Entries table is wider than any tablet -- scroll it inside the panel rather
     than letting it stretch the page. Applies at every width. */
  .ml-table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
  @media (max-width:1024px){
    /* Tablet type scale + finger-sized tap targets (iPad portrait sits above
       the 768px phone breakpoint). */
    .ml-app{ font-size:14px; }
    .ml-field{ font-size:13.5px; }
    .ml-field span.hint{ font-size:12px; }
    .ml-panel-head h2{ font-size:13.5px; }
    .ml-app input,.ml-app select,.ml-app textarea{ font-size:15px; min-height:44px; }
    .ml-app table.ml-table input,.ml-app table.ml-table select,.ml-app table.ml-table textarea{ font-size:13px; min-height:0; }
    .ml-btn{ min-height:44px; }
    .ml-yesno button{ min-height:44px; font-size:14px; }
    .ml-grid-3{ grid-template-columns:repeat(2,1fr); }
    .ml-grid-4{ grid-template-columns:repeat(2,1fr); }
    .ml-body{ padding:14px 14px 60px; }
  }
  @media (max-width:900px){ .ml-grid-2,.ml-grid-3,.ml-grid-4{grid-template-columns:1fr;} }
  @media (max-width:768px){
    .ml-top{ padding:10px 12px; gap:10px; }
    .ml-topline{ width:100%; }
    .ml-topline .ml-btn{ flex:1 1 auto; }
    .ml-body{ padding:10px 12px 60px; }
    .ml-panel-head{ padding:8px 10px; }
    .ml-panel-body{ padding:10px; }
    /* >=16px stops iOS Safari zooming the page on focus. Inputs inside the
       entries table stay compact -- that table scrolls instead. */
    .ml-app input,.ml-app select,.ml-app textarea{ font-size:16px; padding:8px; min-height:44px; }
    .ml-app table.ml-table input,.ml-app table.ml-table select,.ml-app table.ml-table textarea{ font-size:13px; padding:4px; min-height:0; }
    /* Label text, section titles and instructions scale up too -- 11-12px is
       unreadable on a phone without zooming. Field labels hit the 16px
       readable-without-zooming floor; hints/headers step down but stay legible. */
    .ml-app{ font-size:16px; }
    .ml-field{ font-size:16px; }
    .ml-field span.hint{ font-size:13px; }
    .ml-panel-head h2{ font-size:15px; }
    .ml-grouphead{ font-size:14px; }
    .ml-instructions .instr-item strong{ font-size:13px; }
    .ml-btn{ min-height:44px; font-size:16px; }
    /* Small/secondary buttons still get a 44px tap target -- padding makes
       up the difference rather than the visible box growing. */
    .ml-btn-sm{ min-height:44px; padding:10px 14px; font-size:14px; }
    /* Y/N/None toggle buttons -- undersized (32px/12px) at the default scale;
       give them the same 44px tap target as every other button on a phone. */
    .ml-yesno button{ min-height:44px; font-size:15px; padding:10px; }
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
  /* Single-entry printout -- a screen-hidden replica of the paper form, so one entry
     prints as the controlled document rather than as a row of a web table. */
  .ml-sheet{ display:none; color:#000; font-family:'Segoe UI',system-ui,sans-serif; font-size:12px; }
  .ml-sheet table{ width:100%; border-collapse:collapse; margin-bottom:8px; }
  .ml-sheet td,.ml-sheet th{ border:1px solid #000; padding:3px 5px; vertical-align:top; text-align:left; color:#000; }
  .ml-sheet .sheet-logo{ width:78px; text-align:center; font-weight:700; font-size:14px; vertical-align:middle; }
  .ml-sheet .sheet-lbl{ font-weight:700; white-space:nowrap; width:88px; }
  .ml-sheet .sheet-head td{ font-size:14px; }
  .ml-sheet .sheet-body th{ background:#eee; font-weight:700; }
  .ml-sheet .sheet-body td.sheet-item{ width:46%; }
  .ml-sheet .sheet-body td.sheet-rec{ width:14%; text-align:center; font-weight:700; }
  .ml-sheet .sheet-sign td{ height:30px; font-size:14px; }
  .ml-sheet table.sheet-4col{ table-layout:fixed; }
  .ml-sheet .sheet-4col col{ width:25%; }
  .ml-sheet .sheet-4col th{ background:#eee; font-weight:700; text-transform:uppercase; letter-spacing:.04em; font-size:11px; }
  .ml-sheet .sheet-4col .s4-lbl{ font-weight:600; font-size:10.5px; }
  .ml-sheet .sheet-4col .s4-val{ font-weight:400; min-height:14px; white-space:pre-wrap; }
  .ml-sheet .sheet-4col .s4-old{ font-style:italic; color:#444; }
  .ml-sheet .sheet-title{ font-weight:700; font-size:14px; text-align:center; padding:4px; }
  @media print{
    body{ background:#fff; }
    .no-print{ display:none !important; }
    .ml-top{ display:none !important; }
    .ml-app{ font-size:10px; }
    .ml-table-wrap{ overflow:visible !important; }
    table.ml-table th,table.ml-table td{ border:1px solid #000; padding:3px 5px; }
    /* Printing one entry hides the whole app and shows only that entry's sheet.
     * The sheet carries its own controlled-copy header (sheet-head, built in
     * buildEntrySheet to match the paper form's layout exactly) -- so the
     * generic #dh-print-header block is hidden here too, the same way the
     * whole-log print hides it in favour of its own injected header row.
     * Without this, both headers printed, one after the other. */
    body.ml-printing-entry .ml-top,
    body.ml-printing-entry .ml-body{ display:none !important; }
    body.ml-printing-entry .ml-sheet{ display:block; }
    body.ml-printing-entry #dh-print-header{ display:none !important; }
    /* Printing the whole log: the controlled-copy header is injected into
     * table.ml-table's own thead instead (see injectListPrintHeader) so it repeats
     * using that table's native pagination -- the usual #dh-print-header block is
     * hidden here to avoid showing it twice. */
    body.ml-printing-list #dh-print-header{ display:none !important; }
    #ml-list-print-header-row td{ padding:0; border:none; }
  }`;


  function setPageOrientation(orientation) {
    let s = document.getElementById('ml-page-style');
    if (!s) { s = document.createElement('style'); s.id = 'ml-page-style'; document.head.appendChild(s); }
    const side = (window.DocHeader && window.DocHeader.PAGE_SIDE_MARGIN) || '12mm';
    s.textContent = `@page{ size:A4 ${orientation}; margin:${side}; @bottom-right{ content:"Page " counter(page) " of " counter(pages); font-family:'Segoe UI',system-ui,sans-serif; font-size:10px; color:#4a4a4a; } }`;
  }

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
    try { return await window.storage.set(key, value, shared) !== false; }
    catch (e) { console.error('storage set failed', e); return false; }
  }


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

    // hidden bookkeeping fields (source ids, "typed manually" flags) carry a value but draw nothing
    // hideInForm: job data the record still stores/prints (filled by autofill) but does not draw on the form
    if (field.hidden || field.hideInForm) return `<input type="hidden" id="${id}" value="${esc(v)}">`;

    // tick: a single confirmation box (stored as Yes / blank, like a Yes/No answer)
    if (field.type === 'yesno' && field.tick) {
      return `<span class="ml-tick"><input type="checkbox" data-tick-for="${id}"${v === 'Yes' ? ' checked' : ''}><span>${esc(field.tickText || 'Confirmed')}</span></span><input type="hidden" id="${id}" value="${esc(v)}">`;
    }
    if (field.type === 'yesno') {
      // a record that flags problem answers (redPrompt) spells the answer out: colour is never the only signal
      const yes = field.redPrompt ? 'Yes' : 'Y', no = field.redPrompt ? 'No' : 'N';
      return `<span class="ml-yesno" data-yesno-for="${id}" data-good="${field.good === 'No' ? 'No' : 'Yes'}" role="radiogroup">
        <button type="button" role="radio" data-v="" class="${v === '' ? 'on' : ''}" aria-checked="${v === '' ? 'true' : 'false'}" tabindex="${v === '' ? 0 : -1}">None</button>
        <button type="button" role="radio" data-v="Yes" class="${v === 'Yes' ? 'on' : ''}" aria-checked="${v === 'Yes' ? 'true' : 'false'}" tabindex="${v === 'Yes' ? 0 : -1}">${yes}</button>
        <button type="button" role="radio" data-v="No" class="${v === 'No' ? 'on' : ''}" aria-checked="${v === 'No' ? 'true' : 'false'}" tabindex="${v === 'No' ? 0 : -1}">${no}</button>
        <input type="hidden" id="${id}" value="${esc(v)}">
      </span>`;
    }
    if (field.type === 'select') {
      const opts = ['', ...(field.options || [])];

      if (v !== '' && opts.indexOf(v) === -1) opts.push(v);
      return `<select id="${id}">${opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${o === '' ? '—' : esc(o)}</option>`).join('')}</select>`;
    }

    const ro = field.readOnly ? ' readonly' : '';
    if (field.type === 'textarea') {
      return `<textarea id="${id}" rows="2"${ro}>${esc(v)}</textarea>`;
    }
    if (field.type === 'number') {
      return `<input type="number" step="0.01" id="${id}" value="${esc(v)}"${ro}>`;
    }
    if (field.type === 'computed') {
      return `<input type="text" id="${id}" value="${esc(v)}" disabled>`;
    }
    if (field.type === 'date') {
      return `<input type="date" id="${id}" value="${esc(v)}"${ro}>`;
    }

    if (field.type === 'datetime') {
      return `<input type="datetime-local" id="${id}" value="${esc(v)}">`;
    }
    if (field.type === 'time') {
      return `<input type="time" id="${id}" value="${esc(v)}">`;
    }
    if (field.type === 'month') {
      return `<input type="month" id="${id}" value="${esc(v)}">`;
    }

    if (field.type === 'jobsearch') {
      return `<select id="${id}" data-jobsearch="1"${field.jobEntry ? ` data-job-entry="${esc(field.jobEntry)}"` : ''}${field.route ? ` data-route="${esc(field.route)}"` : ''}>` +
        (v ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : '<option value="">—</option>') +
        `</select>`;
    }

    if (field.prefix && field.digits) {
      const digits = String(v).startsWith(field.prefix) ? String(v).slice(field.prefix.length) : '';
      return `<span class="ml-prefixed" data-prefix-for="${id}">
        <span class="ml-prefix">${esc(field.prefix)}</span>
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="${field.digits}"
               id="${id}__digits" value="${esc(digits)}" placeholder="${esc('0'.repeat(field.digits))}">
        <input type="hidden" id="${id}" value="${esc(v)}">
      </span>`;
    }

    if (field.type === 'digits') {
      return `<input type="text" inputmode="numeric" pattern="[0-9]*" id="${id}" value="${esc(v)}">`;
    }

    if (isStamp(field)) {

      return `<span class="ml-stamp" data-stamp-for="${id}">
        <input type="text" id="${id}__shown" value="${esc(stampText(v))}" disabled readonly
               placeholder="stamped on submit">
        <input type="hidden" id="${id}" value="${esc(v)}">
      </span>`;
    }

    const patternAttrs = field.pattern
      ? ` pattern="${esc(field.pattern)}"${field.patternMessage ? ` title="${esc(field.patternMessage)}"` : ''}`
      : '';
    return `<input type="text" id="${id}" value="${esc(v)}"${patternAttrs}${ro}>`;
  }


  // A stamped field is filled by the system when the entry is submitted, never typed: type 'timestamp',
  // or any field marked serverStamp (REC 7.4.2's date-only Entry date).
  function isStamp(f) { return f.type === 'timestamp' || !!f.serverStamp; }

  // Today's date in the facility's time zone (Africa/Johannesburg), so a late-night save never lands a day off.
  function facilityToday() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date()); }
    catch (e) { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; }
  }
  function facilityDateOf(ms) {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date(ms)); }
    catch (e) { return ''; }
  }
  // Calendar-day arithmetic on a YYYY-MM-DD string (no local-time drift); '' when the input is not a date.
  function addDaysISO(iso, days) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m || !isFinite(days)) return '';
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + Number(days)));
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  // The answer that counts as a problem for a Yes/No check, or null when the field does not flag problems.
  function badAnswerOf(f) { return f.type === 'yesno' && f.redPrompt ? (f.good === 'No' ? 'Yes' : 'No') : null; }

  function stampText(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(v || ''));
    if (!m) return v || '';
    return `${m[3]}/${m[2]}/${m[1]}` + (m[4] ? ` ${m[4]}:${m[5]}` : '');
  }

  function fieldLabel(field) {
    return field.label + (field.unit ? ` <span class="hint">(${esc(field.unit)})</span>` : '');
  }


  function wireJobRouteCheck(container, ns, entryFields) {
    (entryFields || []).forEach((f) => {
      if (!f.matchJobRoute || !window.Lookups || !window.Lookups.batch) return;
      const target = container.querySelector('#' + ns + '_f_' + f.key);
      const jobEl = container.querySelector('#' + ns + '_f_' + f.matchJobRoute);
      if (!target || !jobEl) return;
      const wrap = target.closest('.ml-field') || target.parentNode;
      let warn = wrap.querySelector('.ml-route-warn');
      if (!warn) {
        warn = document.createElement('div');
        warn.className = 'ml-notice ml-notice-due ml-route-warn';
        warn.style.marginTop = '4px';
        wrap.appendChild(warn);
      }
      const check = () => {
        const bad = target.value && jobEl.value
          && !window.Lookups.batch.routeMatches(jobEl.value, target.value);
        warn.textContent = bad ? window.Lookups.batch.routeError(jobEl.value) : '';
        warn.classList.toggle('show', !!bad);
      };
      [target, jobEl].forEach((e) => { e.addEventListener('input', check); e.addEventListener('change', check); });
      check();
    });
  }

  const SUMMARY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function summaryPart(key, value, isJob) {
    const v = String(value || '').trim();
    if (!v) return '';
    if (isJob) return v;
    const d = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (/^(jiReceivingDate|intakeDate)$/.test(key) && d) return 'Intake ' + Number(d[3]) + ' ' + SUMMARY_MONTHS[Number(d[2]) - 1];
    return v;
  }

  // Every group on the form (a heading plus the fields under it) becomes a collapsible block that
  // starts open. The block holding the job search shows the job no. alone in its header so
  // the job stays visible when it folds away. Nodes are moved, never re-created, so field ids,
  // listeners and the engine's lookups are untouched. Returns the number of blocks made.
  function wireSectionCollapsibles(container, ns, entryFields) {
    if (container.classList.contains('ml-custom-body') || container.querySelector('details.ml-section-collapsible')) return 0;
    const fieldsByKey = {};
    (entryFields || []).forEach((f) => { fieldsByKey[f.key] = f; });
    const heads = Array.prototype.filter.call(container.children, (k) => k.classList.contains('ml-grouphead'));
    heads.forEach((head) => {
      const groupName = head.getAttribute('data-group') || head.textContent.trim();
      const det = document.createElement('details');
      det.className = 'ml-section-collapsible';
      det.open = true;
      const sum = document.createElement('summary');
      sum.className = head.className;
      while (head.firstChild) sum.appendChild(head.firstChild);
      const span = document.createElement('span');
      span.className = 'ml-section-summary';
      sum.insertBefore(span, sum.firstChild ? sum.firstChild.nextSibling : null);
      // the stage "Edit" button lives inside the heading: pressing it must not fold the block
      sum.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('button')) ev.preventDefault(); });
      det.appendChild(sum);
      const body = document.createElement('div');
      body.className = 'ml-grid ml-grid-2 ml-section-body';
      det.appendChild(body);
      head.parentNode.insertBefore(det, head);
      let node = head.nextSibling;
      head.remove();
      while (node && !(node.nodeType === 1 && node.classList.contains('ml-grouphead'))) {
        const next = node.nextSibling;
        body.appendChild(node);
        node = next;
      }

      const inGroup = (entryFields || []).filter((f) => f.group === groupName && !f.hidden && !f.hideInForm);
      const jobField = inGroup.find((f) => f.type === 'jobsearch');
      if (!jobField) return;
      det.setAttribute('data-autofold', '1');
      const keys = [jobField.key];
      const pairs = keys.map((k) => ({ k, src: container.querySelector('#' + ns + '_f_' + k) })).filter((p) => p.src);
      if (!pairs.length) return;
      const paint = () => {
        const parts = pairs.map((p) => summaryPart(p.k, p.src.value, p.k === jobField.key)).filter(Boolean);
        span.textContent = parts.length ? '— ' + parts.join('  ·  ') : '';
      };
      pairs.forEach((p) => { p.src.addEventListener('input', paint); p.src.addEventListener('change', paint); });
      paint();
    });
    return heads.length;
  }

  // "Collapse all / Expand all" (hide only: nothing is removed or reset), wired once per page.
  function wireCollapseAll(ctl, scope) {
    if (!ctl || ctl._mlWired) return;
    ctl._mlWired = true;
    ctl.addEventListener('click', (ev) => {
      const b = ev.target.closest && ev.target.closest('[data-ml-collapse]');
      if (!b) return;
      const open = b.getAttribute('data-ml-collapse') === 'open';
      scope().querySelectorAll('details.ml-section-collapsible').forEach((d) => { d.open = open; });
    });
  }

  // Open every collapsed block around a field, scroll to it and focus it (validation failures).
  function revealField(target) {
    if (!target) return;
    if (target.matches && target.matches('select[data-jobsearch]')) {
      const wrap = target.closest('.jp-wrap');
      target = (wrap && (wrap.querySelector('.jp-search:not([hidden])') || wrap.querySelector('.jp-change'))) || target.closest('.ml-field') || target;
    }
    for (let d = target.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
    try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* older browsers */ }
    if (target.focus) { try { target.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } }
  }

  // Print / PDF always shows every block open, whatever is collapsed on screen.
  (function wirePrintExpand() {
    let reopen = [];
    window.addEventListener('beforeprint', () => {
      reopen = Array.prototype.filter.call(document.querySelectorAll('details.ml-section-collapsible:not([open])'), (d) => { d.open = true; return true; });
    });
    window.addEventListener('afterprint', () => { reopen.forEach((d) => { d.open = false; }); reopen = []; });
  })();


  function digitsOnly(value) {
    return String(value == null ? '' : value)
      .replace(/[\s,']/g, '')
      .replace(/[.].*$/, '')
      .replace(/\D/g, '');
  }

  function wirePrefixed(container) {
    container.querySelectorAll('.ml-prefixed').forEach(group => {
      const digitsInput = group.querySelector('input[type=text]');
      const hidden = group.querySelector('input[type=hidden]');
      const prefix = group.querySelector('.ml-prefix').textContent;
      const sync = () => {
        const clean = digitsOnly(digitsInput.value);
        if (clean !== digitsInput.value) digitsInput.value = clean;
        hidden.value = clean ? prefix + clean : '';
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
      };
      digitsInput.addEventListener('input', sync);
      digitsInput.addEventListener('blur', sync);
    });
  }


  function wireDigits(container) {
    container.querySelectorAll('input[inputmode="numeric"]').forEach(inp => {
      if (inp.closest('.ml-prefixed')) return;
      inp.addEventListener('input', () => {
        const clean = digitsOnly(inp.value);
        if (clean !== inp.value) inp.value = clean;
      });
    });
  }

  function wireTicks(container) {
    container.querySelectorAll('input[data-tick-for]').forEach((cb) => {
      const hidden = document.getElementById(cb.getAttribute('data-tick-for'));
      if (!hidden) return;
      cb.addEventListener('change', () => {
        hidden.value = cb.checked ? 'Yes' : '';
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
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


  async function autofillLookup(rule, value) {
    const path = `/api/lookup/${encodeURIComponent(rule.source)}/${encodeURIComponent(rule.matchField)}/${encodeURIComponent(value)}`;
    const res = await (window.FacilityApi ? window.FacilityApi.fetch(path)
      : fetch((window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com') + path));
    if (!res.ok) return null;
    return await res.json();
  }


  function markProvisional(elm, isProvisional) {
    if (!elm) return;
    if (isProvisional) elm.dataset.provisional = '1';
    else delete elm.dataset.provisional;
    elm.classList.toggle('ml-provisional', !!isProvisional);
  }

  function renderProvisionalNotice(container, ns) {
    const id = ns + '_provisionalNote';
    let note = document.getElementById(id);
    const any = container.querySelectorAll('[data-provisional="1"]').length;
    if (!note) {
      if (!any) return;
      note = document.createElement('div');
      note.id = id;
      note.className = 'ml-notice ml-notice-provisional';
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

  async function refreshProvisional(container, ns, autofillRules, finalize, toast) {
    if (!container || !container.querySelectorAll('[data-provisional="1"]').length) return true;
    let stillDraft = false;
    const changed = [];
    for (const rule of (autofillRules || [])) {
      const watchEl = container.querySelector('#' + ns + '_f_' + rule.watch);
      if (!watchEl || !watchEl.value) continue;
      let found = null;
      try { found = await autofillLookup(rule, watchEl.value); } catch (e) { found = null; }
      if (!found) continue;
      applyRestrict(container, ns, rule, found);
      const nowProvisional = found.__status && found.__status !== 'submitted';
      if (nowProvisional) stillDraft = true;
      Object.entries(rule.fill || {}).forEach(([targetKey, sourceKey]) => {
        const targetEl = container.querySelector('#' + ns + '_f_' + targetKey);
        if (!targetEl || targetEl.dataset.provisional !== '1') return;
        const latest = found[sourceKey];
        if (latest != null && String(latest) !== String(targetEl.value)) {
          const before = targetEl.value;
          if (setAutofilled(targetEl, latest)) changed.push(`${targetKey}: ${before} → ${latest}`);
        }
        markProvisional(targetEl, nowProvisional);
      });
    }
    renderProvisionalNotice(container, ns);
    if (changed.length) toast('Updated from source: ' + changed.join(', '));
    if (finalize && stillDraft) {
      toast('Cannot submit — the source record for this job is still a draft, so its values are provisional. Save as a draft instead.');
      return false;
    }
    return true;
  }


  function wireJobSearch(container, ns, entryFields, autofillRules, autofocus, recordKey) {
    const fields = (entryFields || []).filter((f) => f.type === 'jobsearch');
    const sels = fields.map((f) => container.querySelector('#' + ns + '_f_' + f.key)).filter(Boolean);
    if (!sels.length) return;
    const jobKey0 = fields[0].key;
    wireJobSelects(sels, {
      autofocus, recordKey, root: container.parentElement,
      autofillTargets: () => (autofillRules || []).filter((r) => r.watch === jobKey0)
        .reduce((a, r) => a.concat(Object.keys(r.fill || {})), [])
        .map((k) => container.querySelector('#' + ns + '_f_' + k)),
      requiredFocus: () => (entryFields || []).filter((f) => f.required).map((f) => container.querySelector('#' + ns + '_f_' + f.key))
    });
  }

  // Turn <select data-jobsearch> elements into job pickers and load their job list. On a new entry
  // (autofocus) the form opens behind the job: see the record-open gate in job-picker.js. The panel is
  // kept invisible only while the picker loads, so the full form never flashes.
  function wireJobSelects(sels, o) {
    const autofocus = o.autofocus;
    const gateRoot = autofocus && !sels[0].value && o.root ? o.root : null;
    let pre = null;
    if (gateRoot) { gateRoot.style.visibility = 'hidden'; pre = setTimeout(() => { gateRoot.style.visibility = ''; }, 5000); }
    const unprelock = () => { if (pre) { clearTimeout(pre); pre = null; } if (gateRoot) gateRoot.style.visibility = ''; };
    loadLib('job-picker.js?v=8', 'JobPicker').then((jp) => {
      try {
        if (!jp) return;
        sels.forEach((sel, i) => jp.enhance(sel, i === 0 ? {
          gateRoot, recordKey: o.recordKey, autofillTargets: o.autofillTargets, requiredFocus: o.requiredFocus
        } : {}));
        if (autofocus && !sels[0].value && sels[0]._jobPicker && sels[0]._jobPicker.focus) sels[0]._jobPicker.focus();
      } finally { unprelock(); }
    });
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


  function setAutofilled(targetEl, value) {
    if (targetEl.tagName === 'SELECT') {
      const match = [...targetEl.options].find((o) => String(o.value).toLowerCase() === String(value).toLowerCase());
      if (!match) return false;
      targetEl.value = match.value;
      return true;
    }
    targetEl.value = value;
    return true;
  }

  function applyRestrict(container, ns, rule, found) {
    if (!rule.restrict) return;
    Object.entries(rule.restrict).forEach(([targetKey, sourceCol]) => {
      const sel = container.querySelector('#' + ns + '_f_' + targetKey);
      if (!sel || sel.tagName !== 'SELECT') return;
      if (!sel._mlAllOptions) {
        sel._mlAllOptions = [...sel.options].map((o) => ({ value: o.value, text: o.textContent }));
      }
      const all = sel._mlAllOptions;
      const current = sel.value;
      const allowed = found && found.__rosterOptions && found.__rosterOptions[sourceCol];
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
    });
  }

  function wireAutofill(container, ns, autofillRules) {
    (autofillRules || []).forEach((rule) => {
      const watchEl = container.querySelector('#' + ns + '_f_' + rule.watch);
      if (!watchEl) return;
      let lastValue = '';
      const onPick = async () => {
        const value = watchEl.value;
        if (value === lastValue) return;
        lastValue = value;
        if (!value) { applyRestrict(container, ns, rule, null); return; }
        try {

          const found = await autofillLookup(rule, value);
          applyRestrict(container, ns, rule, found);
          if (!found) return;
          const provisional = found.__status && found.__status !== 'submitted';
          Object.entries(rule.fill || {}).forEach(([targetKey, sourceKey]) => {
            const targetEl = container.querySelector('#' + ns + '_f_' + targetKey);
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
          renderProvisionalNotice(container, ns);
        } catch (e) {
          console.error('autofill lookup failed', e);
        }
      };

      watchEl.addEventListener('input', onPick);
      watchEl.addEventListener('change', onPick);
    });
  }


  function expandCommentFields(fields) {
    const out = [];
    (fields || []).forEach(f => {
      out.push(f);
      if (!f.withComment) return;
      out.push({
        key: f.key + '__comment', label: 'Comment — ' + f.label, type: 'text',
        isComment: true, showInTable: false, group: f.group
      });
    });
    return out;
  }


  function makeLogController(opts) {
    const { ns, title, entryFields, storageKey, specGetter, toast, tableWrap, modalIds, deviationLabel, deviationPolarity, submitFlow, sheetMeta, docCode, docTitle, onEntriesChanged, afterSave, inline, recordKey, autofill, jobInfoGroup, customBody, traceConfig } = opts
    // The controller reads page-level options (recentEntries, warnOutOfSpec) from the record config. It used to rely on a
    // `config` that only exists inside init(), which threw a ReferenceError on every save (introduced with REC 7.9.3.1).
    const config = traceConfig || {};

    // A page can hand the engine its own entry-form body (render/read/validate/
    // summary/listColumns/sheetHtml) via config.customBody. The engine still owns
    // the entry list, the monitoring_log:* store, the draft/submit lifecycle,
    // verification, print, traceability and the doc-revision badge — only the
    // fields inside the form are the page's. Used where a flat entryFields list
    // cannot express the record (e.g. the double-seam measurement matrix).
    let customBodyReady = false;

    const entryStages = opts.entryStages && opts.entryStages.length ? opts.entryStages : null;

    const continueChain = (entryStages && opts.continueChain && opts.continueChain.length)
      ? opts.continueChain : null;

    let chainDriving = false;
    const chainValue = (entryRow, level) => level.keys
      .map(k => String(entryRow.values[k] == null ? '' : entryRow.values[k]).trim())
      .filter(Boolean).join(' · ');

    let unlockedStages = new Set();
    let keepUnlocked = false;

    let pendingStageEdits = [];

    function stagesOf(entryRow) { return (entryRow && entryRow.stages) || {}; }
    function stageDone(entryRow, key) { return !!stagesOf(entryRow)[key]; }

    function activeStageKey(entryRow) {
      if (!entryStages) return null;
      const done = stagesOf(entryRow);
      const next = entryStages.find((st) => !done[st.key]);
      return next ? next.key : null;
    }
    function stageIsEditable(entryRow, key) {
      if (!entryStages) return true;
      return !stageDone(entryRow, key) || unlockedStages.has(key);
    }
    let entries = [];
    let editingId = null;

    // ---- REC 7.4.6 progressive stages (config.progressive) -------------------------------------------------
    // One stock record per job grows over several submissions. Each submit is its own immutable stage (the server
    // numbers it and enforces the sign-off rule: src/dry-stock-guard.js). Picking the job again loads the latest
    // submitted stage's DATA (earlier values locked); sign-offs are never carried over. The sign-off trigger and
    // the completion fields come from the record definition (signOffTrigger / completionFields), not from code.
    const prog = !!(traceConfig && traceConfig.progressive);
    const finOn = !!(traceConfig && traceConfig.financeSignOff);
    let progPrev = null;        // the submitted stage the entry being filled in continues
    let progViewNote = '';      // text for the sign-off banner when a submitted stage is on screen
    let progLocked = false;     // a submitted stage is on screen: the banner must not be changed by the live trigger
    let progLockedKeys = [];    // inputs locked because an earlier stage holds their value
    const hasVal = (v) => v != null && String(v).trim() !== '';
    const jobKeyOf = () => (traceConfig && traceConfig.batchField) || 'jobNo';
    const entryJob = (e) => String(((e && e.values) || {})[jobKeyOf()] || '').trim().toUpperCase();
    const stageSort = (a, b) => (((a.stage && a.stage.no) || 0) - ((b.stage && b.stage.no) || 0))
      || ((a.submittedAt || a.createdAt || 0) - (b.submittedAt || b.createdAt || 0));
    const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayMon = (ts) => { const d = new Date(ts); return isNaN(d) ? '' : d.getDate() + ' ' + SHORT_MONTHS[d.getMonth()]; };
    function jobStages(job) { return entries.filter((e) => isSubmitted(e) && entryJob(e) === String(job).trim().toUpperCase()).sort(stageSort); }
    function stageNoOf(e, list) { return (e.stage && e.stage.no) || ((list || jobStages(entryJob(e))).indexOf(e) + 1); }
    function stageStatusOf(e) {
      if (e.stage && e.stage.status) return e.stage.status;
      const c = (traceConfig && traceConfig.completionFields) || [];
      return c.length && c.every((k) => hasVal((e.values || {})[k])) ? 'complete' : 'in_progress';
    }
    const statusLabel = (s) => (s === 'complete' ? 'Complete' : 'In progress');
    function stageSignedBy(e) { return (e.stage && e.stage.submittedBy) || (e.completedBy && e.completedBy.by) || ''; }
    function triggerMet() {
      return ((traceConfig && traceConfig.signOffTrigger) || []).some((k) => { const i = el(`${ns}_f_${k}`); return !!i && hasVal(i.value); });
    }
    // value an earlier stage holds for a field (empty string when none): used for "changed since last submission" and carry-forward
    function progPrevValue(key) { const v = progPrev && progPrev.values ? progPrev.values[key] : ''; return hasVal(v) ? v : ''; }
    function progStageNote() { return progPrev ? `Entered in stage ${stageNoOf(progPrev)}, ${dayMon(progPrev.submittedAt || progPrev.createdAt)}` : ''; }
    function updateSignOffUi() {
      if (!prog) return;
      const need = !progLocked && triggerMet();
      const b = el(`${ns}_soBanner`);
      if (b) {
        if (progLocked) {
          b.style.display = progViewNote ? '' : 'none'; b.className = 'ml-so-banner info'; b.textContent = progViewNote;
        } else {
          b.style.display = need ? '' : 'none'; b.className = 'ml-so-banner';
          b.textContent = need ? 'A weight or count is filled in: Completed by and Finance representative must sign before you submit.' : '';
        }
      }
      const blk = el(`${ns}_cb_by`) && el(`${ns}_cb_by`).closest('details');
      if (blk) blk.classList.toggle('ml-so-needed', need);
    }


    function isSubmitted(entryRow) {

      if (entryStages) return submitFlow && entryStages.every((st) => stageDone(entryRow, st.key));
      return submitFlow && (entryRow.status == null || entryRow.status === 'submitted');
    }

    function fmtSubmittedAt(ts) {
      if (!ts) return '—';
      const d = new Date(ts);
      if (isNaN(d)) return '—';
      const p = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    function entryCompletedBy(entryRow) {
      const cb = entryRow && entryRow.completedBy;
      if (cb && typeof cb === 'object' && cb.by && String(cb.by).trim()) return String(cb.by).trim();
      if (cb && typeof cb === 'string' && cb.trim()) return cb.trim();
      const v = entryRow && entryRow.values;
      if (!v) return '';
      const k = Object.keys(v).find(key => /(completed|recorded|checked|done|performed).*by|^operator$|^name$/i.test(key) && v[key]);
      return k ? String(v[k]) : '';
    }

    function entryJobRef(entryRow) {
      const v = entryRow && entryRow.values;
      if (!v) return { val: '', isJob: false };
      const jobKey = Object.keys(v).find(k => /job.*(no|number)/i.test(k) && v[k]);
      if (jobKey) return { val: String(v[jobKey]).trim(), isJob: true };
      const batchKey = Object.keys(v).find(k => /(batch|lot).*(no|num|id|code)/i.test(k) && v[k]);
      if (batchKey) return { val: String(v[batchKey]).trim(), isJob: false };
      return { val: entryRow.id ? String(entryRow.id).slice(0, 8) : '', isJob: false };
    }

    function specFor(key) {
      const spec = specGetter();
      return spec ? spec[key] : null;
    }

    function checkField(field, value) {

      if (field.type === 'yesno' && field.flagsDeviation) {
        const v = String(value == null ? '' : value).trim();
        if (!v) return null;
        return v === (field.good === 'No' ? 'No' : 'Yes') ? 'ok' : 'fail';
      }
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
      return !anyFail;
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
        if (f.type !== 'computed') return;
        try {
          if (typeof f.compute === 'function') values[f.key] = f.compute(values);
          else if (f.computeFn && window.ComputeRegistry) values[f.key] = window.ComputeRegistry.run(f.computeFn, f.computeArgs, values);
        } catch (e) { values[f.key] = ''; }
      });
      return values;
    }

    function filteredEntries() {
      const from = el(`${ns}_filterFrom`) ? el(`${ns}_filterFrom`).value : '';
      const to = el(`${ns}_filterTo`) ? el(`${ns}_filterTo`).value : '';
      const search = el(`${ns}_filterSearch`) ? el(`${ns}_filterSearch`).value.trim().toLowerCase() : '';
      const devOnly = el(`${ns}_filterDevOnly`) ? el(`${ns}_filterDevOnly`).checked : false;
      return entries.filter(e => {
        const d = entryDateOf(e);
        if (from && d && d < from) return false;
        if (to && d && d > to) return false;
        if (devOnly && e.inSpec !== false) return false;
        if (search) {
          const hay = JSON.stringify(e.values).toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      }).sort((a, b) => entryDateOf(b).localeCompare(entryDateOf(a)) || b.createdAt - a.createdAt);
    }

    // The date an entry belongs to for filtering and sorting: the typed date on records that have one, the
    // system-stamped entry date on records that dropped it (REC 7.4.2), else the day it was submitted or saved.
    function entryDateOf(e) {
      const v = e.values || {};
      const d = v.date || v.entryDate;
      if (d) return String(d).slice(0, 10);
      return (entryFields.some(isStampDate) && facilityDateOf(e.submittedAt || e.createdAt)) || '';
    }
    function isStampDate(f) { return !!f.serverStamp && f.type === 'date'; }

    // Fields that appear in the list, CSV and JSON: not the hidden bookkeeping ones, and not the "(old)" copies
    // of removed fields (those show only when an old entry is opened or printed).
    function listFields() { return entryFields.filter(f => f.showInTable !== false && !f.hidden && !f.legacy); }

    // Stored value of a field for display. Old entries saved before a field existed fall back to what they hold:
    // a "(old)" field reads the removed key (legacyFrom), and a stamped Entry date reads the submit date.
    function valueFor(entryRow, f) {
      const v = entryRow.values || {};
      if (v[f.key] != null && v[f.key] !== '') return v[f.key];
      if (f.legacyFrom && v[f.legacyFrom] != null && v[f.legacyFrom] !== '') return v[f.legacyFrom];
      if (isStampDate(f) && isSubmitted(entryRow)) return facilityDateOf(entryRow.submittedAt || entryRow.createdAt);
      return v[f.key];
    }
    function isBadValue(f, val) { const bad = badAnswerOf(f); return !!bad && val === bad; }


    function openBatches() {
      return entries.filter(e => !isSubmitted(e) && continueChain.every(lv => chainValue(e, lv) !== ''));
    }
    function chainSelections() {
      return continueChain.map((lv, i) => {
        const sel = el(`${ns}_continue${i}`);
        return sel ? sel.value : '';
      });
    }
    function chainMatches(sels) {
      return openBatches().filter(e => continueChain.every((lv, i) =>
        !sels[i] || chainValue(e, lv) === sels[i]));
    }
    function renderContinuePicker() {
      if (!continueChain) return;
      const sels = chainSelections();
      continueChain.forEach((lv, i) => {
        const sel = el(`${ns}_continue${i}`);
        if (!sel) return;

        const pool = openBatches().filter(e => continueChain.every((lv2, j) =>
          j >= i || !sels[j] || chainValue(e, lv2) === sels[j]));
        const vals = [];
        pool.forEach(e => { const v = chainValue(e, lv); if (v && vals.indexOf(v) === -1) vals.push(v); });
        vals.sort();
        const keep = vals.indexOf(sels[i]) !== -1 ? sels[i] : '';
        sel.innerHTML = '<option value="">— any —</option>' +
          vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
        sel.value = keep;
        sels[i] = keep;
      });
      const hint = el(`${ns}_continueHint`);
      if (!hint) return;
      const open = openBatches();
      const matches = chainMatches(sels);
      if (!open.length) { hint.textContent = 'No batches part-way through — fill in section 1 below to start one.'; return; }
      if (matches.length === 1 && sels.some(Boolean)) {
        const next = entryStages.find(st => !stageDone(matches[0], st.key));
        hint.textContent = `Showing this batch — next section to fill in: ${next ? next.label : 'none'}.`;
      } else {
        hint.textContent = `${open.length} batch${open.length === 1 ? '' : 'es'} part-way through, ${matches.length} matching. Narrow it down to one, or press "Start a new entry".`;
      }
    }

    function continueChainChanged() {
      const sels = chainSelections();
      renderContinuePicker();
      const matches = chainMatches(chainSelections());
      chainDriving = true;
      try {
        if (matches.length === 1 && sels.some(Boolean)) openForm(matches[0].id);
        else openForm(null);
      } finally { chainDriving = false; }
      renderContinuePicker();
    }
    function resetContinueChain() {
      if (!continueChain) return;
      continueChain.forEach((lv, i) => { const sel = el(`${ns}_continue${i}`); if (sel) sel.value = ''; });
      renderContinuePicker();
      openForm(null);
    }

    // REC 7.4.6: one line per job (latest stage, status, last submitted, finance rep, weights) with an expander
    // showing every stage oldest first, each with its own sign-offs.
    function signoffCell(e) {
      const st = e.stage || null;
      const fin = e.financeRep && e.financeRep.by ? e.financeRep.by : '';
      const cb = entryCompletedBy(e);
      if (st && st.signoffRequired === false) return 'No sign-off (no weights or counts in this stage)';
      if (!fin) return cb ? `${esc(cb)} · finance: not recorded (before finance sign-off was added)` : 'Not recorded (before finance sign-off was added)';
      return `${esc(cb || '—')} · finance: ${esc(fin)}`;
    }
    function renderStockTable() {
      const list = filteredEntries();
      if (!list.length) { tableWrap.innerHTML = `<div class="ml-empty">No entries yet${entries.length ? ' matching these filters' : ''}.</div>`; return; }
      const byJob = new Map();
      list.forEach((e) => { const j = entryJob(e) || '—'; if (!byJob.has(j)) byJob.set(j, []); byJob.get(j).push(e); });
      const num = (v) => (hasVal(v) ? esc(v) : '—');
      let html = `<table class="ml-table"><thead><tr><th>Job</th><th>Stage</th><th>Status</th><th>Last submitted</th><th>Finance rep.</th><th>Weight in (kg)</th><th>Weight out (kg)</th><th></th></tr></thead><tbody>`;
      byJob.forEach((rows, job) => {
        const subs = rows.filter(isSubmitted).sort(stageSort);
        const drafts = rows.filter((e) => !isSubmitted(e));
        const last = subs[subs.length - 1] || null;
        const jid = esc(job).replace(/[^A-Za-z0-9_-]/g, '_');
        if (last) {
          const lv = last.values || {};
          html += `<tr><td><strong>${esc(job)}</strong></td><td>${stageNoOf(last, subs)}${drafts.length ? ' <span class="ml-badge ml-badge-muted">+ draft</span>' : ''}</td>
            <td><span class="ml-badge ${stageStatusOf(last) === 'complete' ? 'ml-badge-ok' : 'ml-badge-muted'}">${statusLabel(stageStatusOf(last))}</span></td>
            <td style="white-space:nowrap;">${esc(dayMon(last.submittedAt))} · ${esc(stageSignedBy(last) || '—')}</td>
            <td>${esc((last.financeRep && last.financeRep.by) || '—')}</td><td class="ml-num">${num(lv.weightIn)}</td><td class="ml-num">${num(lv.weightOut)}</td>
            <td style="white-space:nowrap;"><button class="ml-btn ml-btn-flat ml-btn-sm" data-edit="${last.id}">View</button>
              <button class="ml-btn ml-btn-flat ml-btn-sm" data-pdf="${last.id}" title="Print the whole job: every stage, oldest first">PDF</button>
              <button class="ml-btn ml-btn-flat ml-btn-sm" data-expand="${jid}">Stages (${subs.length + drafts.length})</button></td></tr>`;
        } else {
          html += `<tr><td><strong>${esc(job)}</strong></td><td>—</td><td><span class="ml-badge ml-badge-muted">Draft</span></td><td>—</td><td>—</td><td>—</td><td>—</td>
            <td><button class="ml-btn ml-btn-flat ml-btn-sm" data-edit="${drafts[0].id}">Edit</button>
              <button class="ml-btn ml-btn-flat ml-btn-sm" data-expand="${jid}">Stages (${drafts.length})</button></td></tr>`;
        }
        html += `<tr class="ml-stages-row ml-hide" data-stages="${jid}"><td colspan="8"><table><thead><tr><th>Stage</th><th>Submitted</th><th>Sign-off</th><th>Status</th><th>Weight in</th><th>Weight out</th><th></th></tr></thead><tbody>`;
        subs.forEach((e) => {
          const v = e.values || {};
          html += `<tr><td>${stageNoOf(e, subs)}</td><td style="white-space:nowrap;">${esc(fmtSubmittedAt(e.submittedAt))}</td><td>${signoffCell(e)}</td>
            <td>${statusLabel(stageStatusOf(e))}</td><td class="ml-num">${num(v.weightIn)}</td><td class="ml-num">${num(v.weightOut)}</td>
            <td style="white-space:nowrap;"><button class="ml-btn ml-btn-flat ml-btn-sm" data-edit="${e.id}">View</button>
              <button class="ml-btn ml-btn-flat ml-btn-sm" data-json="${e.id}" title="Export this stage as JSON">JSON</button></td></tr>`;
        });
        drafts.forEach((e) => {
          html += `<tr><td colspan="6"><span class="ml-badge ml-badge-muted">Draft</span> started ${esc(dayMon(e.createdAt))}${e.completedBy && e.completedBy.by ? ' by ' + esc(e.completedBy.by) : ''}</td>
            <td><button class="ml-btn ml-btn-flat ml-btn-sm" data-edit="${e.id}">Edit</button></td></tr>`;
        });
        html += `</tbody></table></td></tr>`;
      });
      html += `</tbody></table>`;
      tableWrap.innerHTML = html;
      tableWrap.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openForm(b.dataset.edit)));
      tableWrap.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', () => printEntry(b.dataset.pdf)));
      tableWrap.querySelectorAll('[data-json]').forEach((b) => b.addEventListener('click', () => exportEntryJson(b.dataset.json)));
      tableWrap.querySelectorAll('[data-expand]').forEach((b) => b.addEventListener('click', () => {
        const r = tableWrap.querySelector(`tr[data-stages="${b.dataset.expand}"]`);
        if (r) r.classList.toggle('ml-hide');
      }));
    }

    function renderTable() {
      if (prog) return renderStockTable();
      renderContinuePicker();
      let list = filteredEntries();
      // recentEntries: show only the latest N logs (the previous readings) unless the person filters
      const recentN = Number(config.recentEntries) || 0;
      const filtering = ['filterFrom', 'filterTo', 'filterSearch'].some(k => el(`${ns}_${k}`) && el(`${ns}_${k}`).value) || (el(`${ns}_filterDevOnly`) && el(`${ns}_filterDevOnly`).checked);
      if (recentN && !filtering) list = list.slice(0, recentN);
      const table = tableWrap;
      if (!list.length) {
        table.innerHTML = `<div class="ml-empty">No entries yet${entries.length ? ' matching these filters' : ''}.</div>`;
        return;
      }
      const cols = customBody && Array.isArray(customBody.listColumns)
        ? customBody.listColumns.map(c => ({ label: c.label, custom: true, get: c.get }))
        : listFields();

      let html = `<table class="ml-table"><thead><tr>${submitFlow ? '<th>Submitted</th><th>Completed by</th><th>Job / Ref</th><th>Status</th>' : ''}${!submitFlow ? cols.map(f => `<th>${esc(f.label)}</th>`).join('') : ''}<th>In spec</th><th></th></tr></thead><tbody>`;
      list.forEach(entryRow => {
        const ref = entryJobRef(entryRow);
        const refCell = ref.val
          ? (ref.isJob ? `<strong>${esc(ref.val)}</strong>` : `<span style="color:#8a939b;font-size:11px;">${esc(ref.val)}</span>`)
          : '—';
        html += `<tr class="${entryRow.inSpec === false ? 'ml-fail' : ''}">`;
        if (submitFlow) {
          html += `<td style="white-space:nowrap;font-family:'IBM Plex Mono',monospace;font-size:11.5px;">${fmtSubmittedAt(entryRow.submittedAt)}</td>`;
          html += `<td>${esc(entryCompletedBy(entryRow) || '—')}</td>`;
          html += `<td>${refCell}</td>`;
          if (entryRow.verification) html += `<td><span class="ml-badge ml-badge-ok">✓ Verified</span><br><span class="ml-muted" style="font-size:10px;">${esc(entryRow.verification.verifiedBy)}</span></td>`;
          else if (isSubmitted(entryRow)) html += `<td><span class="ml-badge ml-badge-ok">✓ Submitted</span></td>`;
          else html += `<td><span class="ml-badge ml-badge-muted">Draft</span></td>`;
        } else {
          cols.forEach(f => {
            let v;
            if (f.custom) { try { v = f.get(entryRow.values, entryRow); } catch (e) { v = ''; } }
            else {
              v = valueFor(entryRow, f);
              if (isStamp(f)) v = stampText(v);
            }
            const bad = !f.custom && isBadValue(f, v);
            if (f.type === 'yesno' || f.type === 'select') v = v || '—';
            else if (v === '' || v == null) v = '—';
            html += `<td class="${f.type === 'number' || f.type === 'computed' ? 'ml-num' : ''}">${bad ? `<span class="ml-bad">${esc(v)} &#9888;</span>` : esc(v)}</td>`;
          });
        }
        html += `<td>${statusBadge(entryRow.inSpec)}</td>`;
        html += `<td style="white-space:nowrap;">
          <button class="ml-btn ml-btn-flat ml-btn-sm" data-edit="${entryRow.id}">${isSubmitted(entryRow) ? 'View' : 'Edit'}</button>
          <button class="ml-btn ml-btn-flat ml-btn-sm" data-pdf="${entryRow.id}" title="Print this entry as the paper form">PDF</button>
          <button class="ml-btn ml-btn-flat ml-btn-sm" data-json="${entryRow.id}" title="Export this entry as JSON">JSON</button>
        </td>`;
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      table.innerHTML = html;
      table.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => openForm(btn.dataset.edit));
      });
      table.querySelectorAll('[data-pdf]').forEach(btn => {
        btn.addEventListener('click', () => printEntry(btn.dataset.pdf));
      });
      table.querySelectorAll('[data-json]').forEach(btn => {
        btn.addEventListener('click', () => exportEntryJson(btn.dataset.json));
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


    function stageHeadHtml(field, existing, activeKey) {
      const plain = `<div class="ml-grouphead" data-group="${esc(field.group)}">${esc(field.group)}</div>`;
      if (!entryStages || !field.stage) return plain;
      const st = entryStages.find((x) => x.key === field.stage);
      if (!st) return plain;
      const done = stagesOf(existing)[field.stage];
      let state = '';
      if (done) {
        const when = done.at ? new Date(done.at).toLocaleDateString() : '';
        state = unlockedStages.has(field.stage)
          ? `<span class="ml-stage-state ml-stage-open">Unlocked for editing</span>`
          : `<span class="ml-stage-state">✓ Submitted ${esc(when)}` +
            (isSubmitted(existing) ? '' : ` <button type="button" class="ml-btn ml-btn-flat ml-btn-sm" data-unlock="${esc(field.stage)}">Edit</button>`) +
            `</span>`;
      } else if (field.stage === activeKey) {
        state = `<span class="ml-stage-state ml-stage-open">Fill in now</span>`;
      } else {
        state = `<span class="ml-stage-state ml-muted">Later</span>`;
      }
      return `<div class="ml-grouphead ml-stagehead" data-group="${esc(field.group)}"><span>${esc(field.group)}</span>${state}</div>`;
    }


    function applyStageLocks(container, existing) {
      if (!entryStages) return;
      const activeKey = activeStageKey(existing);
      entryFields.forEach((f) => {
        if (!f.stage) return;
        const inp = container.querySelector('#' + ns + '_f_' + f.key);
        if (!inp) return;
        const editable = stageIsEditable(existing, f.stage)
          && (f.stage === activeKey || unlockedStages.has(f.stage));
        inp.disabled = !editable;
        const grp = container.querySelector(`[data-yesno-for="${ns}_f_${f.key}"]`);
        if (grp) grp.querySelectorAll('button').forEach((b) => { b.disabled = !editable; });
        const pre = container.querySelector(`[data-prefix-for="${ns}_f_${f.key}"]`);
        if (pre) pre.querySelectorAll('input').forEach((i) => { i.disabled = !editable; });

        if (f.type === 'timestamp') {
          const shown = container.querySelector('#' + ns + '_f_' + f.key + '__shown');
          if (shown) shown.disabled = true;
        }
      });
      container.querySelectorAll('[data-unlock]').forEach((btn) => {
        btn.addEventListener('click', () => promptUnlock(btn.dataset.unlock, existing));
      });
    }


    function promptUnlock(stageKey, existing) {
      const st = entryStages.find((x) => x.key === stageKey);
      const reason = window.prompt(`Reason for changing "${st ? st.label : stageKey}" after it was submitted:`);
      if (reason == null) return;
      if (!reason.trim()) { toast('A reason is required to edit a submitted section.'); return; }
      const who = window.prompt('Your name:');
      if (who == null) return;
      if (!who.trim()) { toast('Your name is required to edit a submitted section.'); return; }
      pendingStageEdits.push({ stage: stageKey, reason: reason.trim(), by: who.trim(), at: Date.now() });
      unlockedStages.add(stageKey);
      keepUnlocked = true;
      openForm(existing.id);
      toast('Section unlocked — the change will be recorded against your name.');
    }


    function conditionMet(f) {
      if (!f.showWhen) return true;
      // "(old)" fields of removed inputs: shown only when the entry actually holds an old value
      if (f.showWhen.nonEmpty) { const own = el(`${ns}_f_${f.key}`); return !!(own && String(own.value || '').trim()); }
      const src = el(`${ns}_f_${f.showWhen.field}`);
      if (!src) return false;
      const want = f.showWhen.equals;
      const have = String(src.value == null ? '' : src.value).trim();
      return Array.isArray(want) ? want.indexOf(have) !== -1 : have === want;
    }
    function applyConditionalFields(container) {
      entryFields.forEach((f) => {
        if (!f.showWhen) return;
        const wrap = container.querySelector(`label.ml-field[data-field="${f.key}"]`);
        if (!wrap) return;
        const show = conditionMet(f);
        wrap.style.display = show ? '' : 'none';
        if (!show) {
          const inp = el(`${ns}_f_${f.key}`);
          if (inp && inp.value) inp.value = '';
        }
      });
    }

    // A small line under a field's input: grey for "From REC 7.4.0", amber when the source record is missing.
    function setFieldNote(key, text, warn) {
      const wrap = document.querySelector(`#${ns}_f_${key}`) ? document.querySelector(`#${ns}_f_${key}`).closest('label.ml-field') : null;
      if (!wrap) return;
      let n = wrap.querySelector('.ml-fromnote');
      if (!text) { if (n) n.remove(); return; }
      if (!n) { n = document.createElement('span'); n.className = 'ml-fromnote'; wrap.appendChild(n); }
      n.className = 'ml-fromnote' + (warn ? ' warn' : '');
      n.textContent = text;
    }

    // Fields marked fromRecord are read-only copies of what another record already holds for the job (REC 7.4.2
    // cooking date from REC 7.4.0, trolley count from REC 7.4.1). When the source record has nothing the field
    // unlocks so the person can type it, an amber note says why, and the entry is flagged "typed manually".
    // The stored value is a snapshot: submitted entries never re-read it.
    function wireFromRecord(container) {
      const rules = entryFields.filter(f => f.fromRecord);
      if (!rules.length) return;
      const jobField = entryFields.find(f => f.type === 'jobsearch');
      const jobEl = jobField ? el(`${ns}_f_${jobField.key}`) : null;
      if (!jobEl) return;
      rules.forEach((f) => {
        const r = f.fromRecord, inp = el(`${ns}_f_${f.key}`), flag = r.manualFlag ? el(`${ns}_f_${r.manualFlag}`) : null;
        if (!inp) return;
        if (r.prefill) {
          // a person changing a pulled value must confirm it again
          inp.addEventListener('change', () => { setTick(r.confirmField, false); inp.dataset.fromRec = ''; });
          return;
        }
        inp.addEventListener('input', () => { if (!inp.readOnly && flag) flag.value = String(inp.value || '').trim() ? 'Yes' : ''; });
      });
      const setTick = (key, on) => {
        if (!key) return;
        const h = el(`${ns}_f_${key}`);
        if (!h) return;
        h.value = on ? 'Yes' : '';
        const cb = container.querySelector(`input[data-tick-for="${ns}_f_${key}"]`);
        if (cb) cb.checked = !!on;
      };
      let lastJob = null;
      const apply = async () => {
        const job = String(jobEl.value || '').trim();
        if (job === lastJob) return;
        const opening = lastJob === null;   // first look at an entry that may already hold saved values
        lastJob = job;
        if (!job) { rules.forEach(f => { setFieldNote(f.key, '', false); const i = el(`${ns}_f_${f.key}`); if (i) i.readOnly = true; }); return; }
        let facts = null, failed = false;
        try {
          const path = `/api/dry-monitoring/job-facts/${encodeURIComponent(job)}`;
          const res = await (window.FacilityApi ? window.FacilityApi.fetch(path)
            : fetch((window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com') + path));
          if (res.ok) facts = await res.json(); else failed = true;
        } catch (e) { failed = true; console.error('job facts lookup failed', e); }
        if (String(jobEl.value || '').trim() !== job) return;   // the job changed while we were asking
        rules.forEach((f) => {
          const r = f.fromRecord, inp = el(`${ns}_f_${f.key}`);
          if (!inp) return;
          const flag = r.manualFlag ? el(`${ns}_f_${r.manualFlag}`) : null;
          const ids = r.idsField ? el(`${ns}_f_${r.idsField}`) : null;
          const hit = facts && facts[r.source];
          if (r.prefill) {
            // pulled but not locked: the person ticks the confirm box on the form
            const ids = r.idsField ? el(`${ns}_f_${r.idsField}`) : null;
            if (hit && hit.value != null && hit.value !== '') {
              if (opening && String(inp.value || '').trim()) return;   // keep what the saved entry holds
              inp.value = hit.value;
              inp.dataset.fromRec = '1';
              if (ids) ids.value = (hit.ids || []).join(',');
              setTick(r.confirmField, false);
              setFieldNote(f.key, r.note || '', false);
              inp.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              if (inp.dataset.fromRec === '1') { inp.value = ''; inp.dataset.fromRec = ''; setTick(r.confirmField, false); }
              if (ids) ids.value = '';
              setFieldNote(f.key, failed ? 'Could not check REC 7.4.1 just now. Choose the area.' : (r.missing || ''), true);
            }
            return;
          }
          if (hit && hit.value != null && hit.value !== '') {
            inp.readOnly = true;
            inp.value = hit.value;
            if (ids) ids.value = (hit.ids || []).join(',');
            if (flag) flag.value = 'No';
            setFieldNote(f.key, hit.note || r.note || '', false);
            // a stage continuing an earlier one: the source moved on since that stage was submitted
            const was = progPrevValue ? progPrevValue(f.key) : '';
            if (was !== '' && String(was) !== String(hit.value) && !(Number.isFinite(Number(was)) && Number(was) === Number(hit.value))) {
              setFieldNote(f.key, `Changed since last submission: was ${was}, now ${hit.value}`, true);
            }
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            inp.readOnly = !r.unlockWhenMissing;
            if (ids) ids.value = '';
            // a value copied from the previous job must not linger; only something a person typed is kept
            if (flag && flag.value === 'No' && String(inp.value || '').trim()) {
              inp.value = '';
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              inp.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (flag) flag.value = String(inp.value || '').trim() ? 'Yes' : '';
            setFieldNote(f.key, failed ? 'Could not check the source record just now. You can type this in.' : (r.missing || ''), true);
            // a value typed in an earlier stage (its source is still missing) carries forward, locked
            const kept = progPrevValue ? progPrevValue(f.key) : '';
            if (kept !== '' && !String(inp.value || '').trim()) {
              inp.value = kept;
              inp.readOnly = true;
              if (flag) flag.value = 'Yes';
              setFieldNote(f.key, progStageNote(), false);
              inp.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        });
      };
      jobEl.addEventListener('input', apply);
      jobEl.addEventListener('change', apply);
      apply();
    }

    // Calculated read-only dates (addDays) and the "a check is red, add a comment" prompt.
    function wireCalcAndFlags(container, locked) {
      if (locked) return;   // a submitted entry keeps exactly what it was saved with
      entryFields.filter(f => f.addDays).forEach((f) => {
        const a = f.addDays, src = el(`${ns}_f_${a.from}`), dst = el(`${ns}_f_${f.key}`);
        if (!src || !dst) return;
        const cfgDays = a.configKey && traceConfig ? Number(traceConfig[a.configKey]) : NaN;
        const days = isFinite(cfgDays) && cfgDays > 0 ? cfgDays : Number(a.days);
        const calc = () => { dst.value = addDaysISO(src.value, days); };
        src.addEventListener('input', calc);
        src.addEventListener('change', calc);
        calc();
      });
      const flagged = entryFields.filter(f => badAnswerOf(f));
      if (!flagged.length) return;
      const target = flagged[0].redPrompt;
      const box = el(`${ns}_f_${target}`);
      const refresh = () => {
        const anyBad = flagged.some(f => { const i = el(`${ns}_f_${f.key}`); return i && isBadValue(f, i.value); });
        if (box) box.classList.toggle('ml-commentprompt', anyBad && !String(box.value || '').trim());
        setFieldNote(target, anyBad ? 'A check is marked as a problem. Please describe what was found and what was done.' : '', anyBad);
      };
      flagged.forEach((f) => { const i = el(`${ns}_f_${f.key}`); if (i) i.addEventListener('input', refresh); });
      if (box) box.addEventListener('input', refresh);
      refresh();
    }

    function openForm(id) {

      if (keepUnlocked) keepUnlocked = false; else unlockedStages = new Set();
      editingId = id || null;

      if (continueChain && !chainDriving && !id) {
        continueChain.forEach((lv, i) => { const sel = el(`${ns}_continue${i}`); if (sel) sel.value = ''; });
      }
      const existing = id ? entries.find(e => e.id === id) : null;
      const locked = existing ? isSubmitted(existing) : false;
      const titleEl = el(modalIds.title);
      titleEl.hidden = true;
      let lockedNote = titleEl.nextElementSibling;
      if (!lockedNote || !lockedNote.classList.contains('ml-locked')) {
        lockedNote = document.createElement('div');
        lockedNote.className = 'ml-locked';
        titleEl.after(lockedNote);
      }
      lockedNote.hidden = !locked;
      lockedNote.textContent = locked
        ? `Submitted${existing.submittedAt ? ' on ' + new Date(existing.submittedAt).toLocaleString() : ''} — this submission can no longer be changed.`
        : '';
      const container = el(modalIds.fields);

      // the fields container is reused; a custom body draws full-width blocks, so it must not be a field grid
      container.classList.toggle('ml-custom-body', !!customBody);
      if (customBody) {
        container.innerHTML = '';
        const ctx = {
          mode: id ? 'edit' : 'new', locked, recordKey, docCode, toast,
          // job picker for a custom body's own <select data-jobsearch>; gates the form on a new entry
          wireJobSearch: (sel, o) => wireJobSelects([sel], Object.assign({ autofocus: !id && !locked, recordKey, root: container.parentElement }, o || {})),
          onChange: () => {},
          setSubmitDisabled: (v) => { const b = el(`${ns}_submitBtn`); if (b) b.disabled = !!v; },
          reopen: () => openForm(editingId),
          refresh: () => { renderTable(); if (onEntriesChanged) onEntriesChanged(); }
        };
        try { customBody.render(container, existing || null, ctx); } catch (e) { console.error('customBody.render failed', e); }
        const bodyCtl = el(`${ns}_collapseCtl`);
        if (bodyCtl) { bodyCtl.hidden = !container.querySelector('details'); wireCollapseAll(bodyCtl, () => container.parentElement || container); }
        if (submitFlow) {
          const saveBtn = el(`${ns}_saveBtn`), submitBtn = el(`${ns}_submitBtn`);
          if (saveBtn) saveBtn.style.display = locked ? 'none' : '';
          if (submitBtn) submitBtn.style.display = locked ? 'none' : '';
        }
        if (!inline) el(modalIds.overlay).style.display = 'flex';
        return;
      }

      let lastGroup = null;
      const activeKey = entryStages ? activeStageKey(existing) : null;
      container.innerHTML = entryFields.map(f => {
        let head = '';
        if (f.group && f.group !== lastGroup) { head = stageHeadHtml(f, existing, activeKey); lastGroup = f.group; }

        if (entryStages && f.stage && f.stage !== activeKey
            && !stageDone(existing, f.stage) && !unlockedStages.has(f.stage)) return head;
        const shownValue = existing ? valueFor(existing, f) : (f.default || '');
        if (f.hidden || f.hideInForm) return head + fieldInputHtml(ns, f, shownValue);
        return head + `
        <label class="ml-field" data-field="${esc(f.key)}">${fieldLabel(f)}
          ${fieldInputHtml(ns, f, shownValue)}
        </label>`;
      }).join('');
      wireYesNo(container);
      wireTicks(container);
      wirePrefixed(container);
      wireDigits(container);
      const blocks = wireSectionCollapsibles(container, ns, entryFields);
      const ctl = el(`${ns}_collapseCtl`);
      if (ctl) { ctl.hidden = !blocks; wireCollapseAll(ctl, () => container.parentElement || container); }
      if (!locked) { wireJobSearch(container, ns, entryFields, autofill, !existing, recordKey); wireAutofill(container, ns, autofill); wireJobRouteCheck(container, ns, entryFields); }
      if (!locked) wireFromRecord(container);
      wireCalcAndFlags(container, locked);

      // resumeByJob: this record is completed over more than one sitting. On a fresh entry,
      // picking a job that already has an unsubmitted draft reopens that draft so the earlier
      // data comes back instead of starting a blank second entry for the same job.
      if (!id && !locked && traceConfig && traceConfig.resumeByJob) {
        const jobKey = traceConfig.batchField
          || (entryFields.find((f) => f.type === 'jobsearch') || {}).key
          || 'jobNo';
        const jobEl = el(ns + '_f_' + jobKey);
        if (jobEl) {
          const tryResume = () => {
            if (editingId) return;
            const jobNo = String(jobEl.value || '').trim();
            if (!jobNo) return;
            const draft = entries
              .filter((e) => !isSubmitted(e) && String((e.values || {})[jobKey] || '').trim() === jobNo)
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

      if (existing && Array.isArray(existing.provisionalFields)) {
        existing.provisionalFields.forEach((k) => markProvisional(container.querySelector('#' + ns + '_f_' + k), true));
        renderProvisionalNotice(container, ns);
      }
      container.querySelectorAll('input,select,textarea').forEach(inp => {
        inp.addEventListener('input', recalcComputedInModal);
        inp.addEventListener('change', recalcComputedInModal);
        inp.addEventListener('input', () => applyConditionalFields(container));
        inp.addEventListener('change', () => applyConditionalFields(container));
      });
      recalcComputedInModal();
      applyConditionalFields(container);
      if (entryStages) {
        const fixing = unlockedStages.size ? Array.from(unlockedStages)[0] : null;
        const st = entryStages.find((x) => x.key === (fixing || activeKey));
        const submitBtn = el(`${ns}_submitBtn`);
        if (submitBtn) submitBtn.textContent = !st ? 'Submit'
          : (fixing ? `Save correction — ${st.label}` : `Submit — ${st.label}`);
      }
      if (submitFlow) {
        container.querySelectorAll('input,select,textarea,.ml-yesno button').forEach(inp => { inp.disabled = locked; });
        const saveBtn = el(`${ns}_saveBtn`), submitBtn = el(`${ns}_submitBtn`);
        if (saveBtn) saveBtn.style.display = locked ? 'none' : '';
        if (submitBtn) submitBtn.style.display = locked ? 'none' : '';
      }

      applyStageLocks(container, existing);
      fillCompletedBy(existing, locked);
      fillFinance(existing, locked);
      wireProgressive(container, existing, locked);
      updateSignOffUi();
      if (!inline) el(modalIds.overlay).style.display = 'flex';
    }

    // COMPLETED BY block (Completed by / Title / Date / Signature): the entry keeps it as
    // entry.completedBy = { by, title, date, signature }; the name also feeds the record's
    // completedBy column (src/submission-store.js).
    const cbInput = (k) => el(`${ns}_cb_${k}`);
    function fillCompletedBy(existing, locked) {
      const cb = (existing && existing.completedBy) || null;
      ['by', 'title', 'date', 'signature'].forEach((k) => {
        const i = cbInput(k);
        if (!i) return;
        i.value = cb && cb[k] ? cb[k] : '';
        i.disabled = !!locked;
      });
      // the login name is a role/account name, so it goes in Title; the person types their own name
      const byField = cbInput('by');
      if (byField && !locked && !byField.value.trim()) {
        const name = window.Auth && window.Auth.getCurrentUsername ? window.Auth.getCurrentUsername() : null;
        if (name) byField.value = name;
      }
      const title = cbInput('title');
      if (title && !locked && !title.value.trim()) {
        const role = window.Auth && window.Auth.getCurrentRole ? window.Auth.getCurrentRole() : null;
        if (role) title.value = (window.SignOffBlock && window.SignOffBlock.roleLabel) ? window.SignOffBlock.roleLabel(role) : role;
      }
    }
    function readCompletedBy() {
      const v = (k) => { const i = cbInput(k); return i ? (i.value || '').trim() : ''; };
      return { by: v('by'), title: v('title'), date: v('date'), signature: v('signature') };
    }
    // FINANCE REPRESENTATIVE block (REC 7.4.6): entry.financeRep = { by, title, date, signature }, per stage. It always opens
    // blank on a new stage (nothing carried from an earlier stage, no name suggested); a reopened draft keeps what was typed in it.
    const finInput = (k) => el(`${ns}_fin_${k}`);
    function fillFinance(existing, locked) {
      if (!finOn) return;
      const fr = (existing && existing.financeRep) || null;
      ['by', 'title', 'date', 'signature'].forEach((k) => {
        const i = finInput(k);
        if (!i) return;
        i.value = fr && fr[k] ? fr[k] : '';
        i.disabled = !!locked;
      });
    }
    function readFinance() {
      const v = (k) => { const i = finInput(k); return i ? (i.value || '').trim() : ''; };
      return { by: v('by'), title: v('title'), date: v('date'), signature: v('signature') };
    }
    const blockOk = (b) => !!(b && b.by && b.title && b.date && b.signature);

    // Status line + loading of the job's earlier stage. Runs after every openForm.
    function paintStageLine(container, text, complete) {
      let line = container.querySelector(':scope > .ml-stageline');
      if (!text) { if (line) line.remove(); return; }
      if (!line) { line = document.createElement('div'); container.insertBefore(line, container.firstChild); }
      line.className = 'ml-stageline' + (complete ? ' complete' : '');
      line.textContent = text;
    }
    function stageSummaryLine(last, list, next) {
      const n = stageNoOf(last, list);
      if (stageStatusOf(last) === 'complete') return `Complete, stage ${n} · submitted ${dayMon(last.submittedAt)} by ${stageSignedBy(last) || '—'}`;
      const fin = last.financeRep && last.financeRep.by ? `, finance: ${last.financeRep.by}` : '';
      return `In progress, ${next ? 'stage ' + (n + 1) : 'stage ' + n} · last submitted ${dayMon(last.submittedAt)} by ${stageSignedBy(last) || '—'}${fin}`;
    }
    function clearStageLocks() {
      progLockedKeys.forEach((k) => {
        const i = el(`${ns}_f_${k}`);
        if (!i) return;
        i.value = ''; i.readOnly = false; i.classList.remove('ml-stage-locked');
        setFieldNote(k, '', false);
      });
      progLockedKeys = [];
    }
    // Earlier-stage values: shown read-only with "Entered in stage n, dd Mon". Empty fields stay open. Fields that
    // autofill from another record are not locked here: they refresh from their source (wireFromRecord), with a chip.
    function lockFromStage(prev) {
      entryFields.forEach((f) => {
        if (f.type === 'jobsearch' || f.type === 'computed' || f.fromRecord || f.hidden || f.hideInForm || f.role) return;
        const i = el(`${ns}_f_${f.key}`);
        const v = prev.values ? prev.values[f.key] : '';
        if (!i || !hasVal(v)) return;
        if (!(i.matches && i.matches('input, textarea'))) return;
        i.value = v; i.readOnly = true; i.classList.add('ml-stage-locked');
        progLockedKeys.push(f.key);
        setFieldNote(f.key, progStageNote(), false);
        i.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    function wireProgressive(container, existing, locked) {
      if (!prog) return;
      progPrev = null; progLockedKeys = []; progLocked = !!locked; progViewNote = '';
      document.body.classList.add('ml-progressive');
      const jobEl = el(`${ns}_f_${jobKeyOf()}`);
      if (!container._soWired) {
        container._soWired = true;
        ['input', 'change'].forEach((ev) => container.addEventListener(ev, updateSignOffUi));
      }
      if (locked && existing) {
        const list = jobStages(entryJob(existing));
        paintStageLine(container, `Stage ${stageNoOf(existing, list)} · ${statusLabel(stageStatusOf(existing))} · submitted ${dayMon(existing.submittedAt)} by ${stageSignedBy(existing) || '—'}`, stageStatusOf(existing) === 'complete');
        const st = existing.stage || null;
        if (st && st.signoffRequired === false) progViewNote = 'No sign-off (no weights or counts in this stage).';
        else if (!existing.financeRep && !(existing.completedBy && existing.completedBy.signature)) progViewNote = 'Not recorded (before finance sign-off was added).';
        else if (!existing.financeRep) progViewNote = 'Finance representative: not recorded (before finance sign-off was added).';
        updateSignOffUi();
        return;
      }
      if (existing) {          // a reopened draft: its earlier stage is still locked, its own sign-offs are exactly what was typed
        const prev = existing.previousSubmissionId ? entries.find((x) => x.id === existing.previousSubmissionId) : null;
        if (prev) { progPrev = prev; lockFromStage(prev); paintStageLine(container, `Draft for stage ${stageNoOf(prev) + 1} · continues stage ${stageNoOf(prev)}`, false); }
        else paintStageLine(container, 'Draft · first entry for this job', false);
        updateSignOffUi();
        return;
      }
      if (!jobEl) return;
      let lastJob = '';
      const onJob = () => {
        const job = String(jobEl.value || '').trim();
        if (job === lastJob) return;
        lastJob = job;
        clearStageLocks(); progPrev = null;
        if (!job) { paintStageLine(container, '', false); updateSignOffUi(); return; }
        const stages = jobStages(job);
        const last = stages[stages.length - 1] || null;
        // two people must not enter the same stage at once: say so when a draft for this job is already open
        const drafts = entries.filter((e) => !isSubmitted(e) && entryJob(e) === job.toUpperCase())
          .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
        if (drafts.length) {
          const d = drafts[0], who = (d.completedBy && d.completedBy.by) || '';
          const ok = window.confirm(`A draft for this job was started${who ? ' by ' + who : ''} on ${dayMon(d.createdAt || d.updatedAt)}.\n\nOK = open that draft.\nCancel = start a new entry for this job.`);
          if (ok) { setTimeout(() => openForm(d.id), 0); return; }
        }
        if (!last) { paintStageLine(container, 'First entry for this job', false); updateSignOffUi(); return; }
        if (stageStatusOf(last) === 'complete') {
          toast(`Job ${job} is Complete. Showing it read-only.`);
          setTimeout(() => openForm(last.id), 0);
          return;
        }
        progPrev = last;
        lockFromStage(last);
        paintStageLine(container, stageSummaryLine(last, stages, true), false);
        updateSignOffUi();
      };
      ['input', 'change'].forEach((ev) => jobEl.addEventListener(ev, onJob));
      paintStageLine(container, '', false);
      onJob();
    }

    document.addEventListener('authSuccess', () => {
      const byField = cbInput('by');
      if (byField && !byField.disabled && !byField.value.trim()) {
        const name = window.Auth && window.Auth.getCurrentUsername ? window.Auth.getCurrentUsername() : null;
        if (name) byField.value = name;
      }
      const title = cbInput('title');
      if (title && !title.disabled && !title.value.trim()) {
        const role = window.Auth && window.Auth.getCurrentRole ? window.Auth.getCurrentRole() : null;
        if (role) title.value = (window.SignOffBlock && window.SignOffBlock.roleLabel) ? window.SignOffBlock.roleLabel(role) : role;
      }
    });

    function closeForm() {
      if (inline) { editingId = null; openForm(null); return; }
      el(modalIds.overlay).style.display = 'none';
    }

    async function saveForm(finalize) {

      if (!await refreshProvisional(el(modalIds.fields), ns, autofill, finalize, toast)) return;

      const existingForStage = editingId ? entries.find(e => e.id === editingId) : null;
      let values, inSpec;
      let softNote = '';
      let correctingStage = null, savingStage = null;

      if (customBody) {
        try { values = customBody.read(el(modalIds.fields)) || {}; }
        catch (e) { console.error('customBody.read failed', e); toast('Could not read the form.'); return; }
        let problems = [];
        if (typeof customBody.validate === 'function') {
          try { problems = customBody.validate(values, finalize) || []; } catch (e) { problems = []; }
        }
        if (problems.length && (finalize || !submitFlow)) {
          el(modalIds.fields).querySelectorAll('details').forEach((d) => { d.open = true; });
          toast(problems[0]);
          return;
        }
        inSpec = customBody.summary ? (customBody.summary(values) || {}).inSpec : null;
        if (inSpec === undefined) inSpec = null;
      } else {

      const raw = {};
      let missingRequired = null, missingKey = null;
      let badPattern = null, badPatternKey = null;
      let routeConflict = null, routeConflictKey = null;

      correctingStage = (entryStages && unlockedStages.size) ? Array.from(unlockedStages)[0] : null;
      savingStage = entryStages ? (correctingStage || activeStageKey(existingForStage)) : null;
      const stageInPlay = (f) => !entryStages || !f.stage
        || (correctingStage ? unlockedStages.has(f.stage) : f.stage === savingStage);
      entryFields.forEach(f => {
        if (f.type === 'computed') return;
        const inp = el(`${ns}_f_${f.key}`);

        raw[f.key] = inp ? inp.value
          : (existingForStage && existingForStage.values[f.key] != null ? existingForStage.values[f.key] : '');
        if (!stageInPlay(f)) return;

        if (f.showWhen && !conditionMet(f)) { raw[f.key] = ''; return; }

        if (isStamp(f)) return;
        if (f.required && !missingRequired && !String(raw[f.key] || '').trim()) { missingRequired = f.label; missingKey = f.key; }

        if (f.pattern && !badPattern && String(raw[f.key] || '').trim()
            && !new RegExp(f.pattern).test(String(raw[f.key]).trim())) {
          badPattern = f.patternMessage || `"${f.label}" is not in the expected format.`;
          badPatternKey = f.key;
        }

        if (f.matchJobRoute && window.Lookups && window.Lookups.batch && stageInPlay(f)) {
          const jobVal = raw[f.matchJobRoute]
            || (el(`${ns}_f_${f.matchJobRoute}`) ? el(`${ns}_f_${f.matchJobRoute}`).value : '');
          if (jobVal && raw[f.key] && !window.Lookups.batch.routeMatches(jobVal, raw[f.key])) {
            routeConflict = window.Lookups.batch.routeError(jobVal);
            routeConflictKey = f.key;
          }
        }
      });

      if (missingRequired && (finalize || !submitFlow)) { revealField(el(`${ns}_f_${missingKey}`)); toast(`"${missingRequired}" is required.`); return; }

      if (badPattern) { revealField(el(`${ns}_f_${badPatternKey}`)); toast(badPattern); return; }

      if (routeConflict && (finalize || !submitFlow)) { revealField(el(`${ns}_f_${routeConflictKey}`)); toast(routeConflict); return; }

      if (finalize) {
        entryFields.forEach(f => {
          if (!isStamp(f) || !stageInPlay(f) || String(raw[f.key] || '').trim()) return;
          const now = new Date();
          const pad = (n) => String(n).padStart(2, '0');
          raw[f.key] = f.type === 'timestamp'
            ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
            : facilityToday();
          const inp = el(`${ns}_f_${f.key}`);
          if (inp) inp.value = raw[f.key];
          const shown = el(`${ns}_f_${f.key}__shown`);
          if (shown) shown.value = stampText(raw[f.key]);
        });
      }
      // A red (problem) answer asks for a comment / corrective action. Never blocks a draft; blocks a submit
      // only if the record says so (redPrompt.blocksSubmit), otherwise it asks once.
      const rp = traceConfig && traceConfig.redPrompt;
      if (finalize && rp && rp.field && entryFields.some(f => isBadValue(f, raw[f.key])) && !String(raw[rp.field] || '').trim()) {
        if (rp.blocksSubmit) { toast('A check is marked as a problem. Please add a comment / corrective action.'); return; }
        if (window.confirm('A check is marked as a problem (red) but no comment / corrective action is entered.\n\nSubmit anyway?') === false) return;
      }
      const soft = traceConfig && traceConfig.submitChecks && traceConfig.submitChecks.softWarn;
      if (finalize && Array.isArray(soft)) {
        const missing = soft.filter(k => !String(raw[k] == null ? '' : raw[k]).trim())
          .map(k => (entryFields.find(f => f.key === k) || { label: k }).label);
        if (missing.length) softNote = ' Missing: ' + missing.join(', ') + '.';
      }
      values = computeAll(raw);
      inSpec = evaluateEntry(values);
      // Out-of-range reading: pop up the warning before it is saved. The deviation is still recorded if the person continues.
      if (config.warnOutOfSpec && inSpec === false) {
        const bad = entryFields.filter(f => checkField(f, values[f.key]) === 'fail').map(f => {
          const r = specFor(f.specKey) || {};
          return `${f.label}: ${values[f.key]}${f.unit ? ' ' + f.unit : ''} (allowed ${r.min != null ? r.min : 'no minimum'} to ${r.max != null ? r.max : 'no maximum'})`;
        });
        if (!window.confirm(['WARNING: OUT OF RANGE', ''].concat(bad, ['', 'This deviation must be reported. Enter the corrective action taken.', '', 'OK = save this reading as a deviation.  Cancel = go back and check the reading.']).join('\n'))) return;
      }
      } // end non-customBody field gathering

      // COMPLETED BY block. A customBody page that draws its own block (ownsCompletedBy) hands
      // the engine its values; everything else reads the engine's block.
      let completedBy = null, finance = null;
      if (customBody) {
        if (customBody.ownsCompletedBy) {
          const cb = { by: String(values.completedBy || '').trim(), title: String(values.completedSig || '').trim(),
            date: String(values.completedDate || '').trim(), signature: String(values.completedBySignature || '').trim() };
          if (cb.by || cb.title || cb.date || cb.signature) completedBy = cb;
        }
      } else {
        completedBy = readCompletedBy();
        if (finOn) finance = readFinance();
        // REC 7.4.6: the sign-offs are required only once a weight or count has a value (the trigger); every other record always
        const signRequired = prog ? (finalize && triggerMet()) : (finalize || !submitFlow);
        if (signRequired) {
          const missingBlocks = [];
          if (!blockOk(completedBy)) missingBlocks.push('Completed by');
          if (finOn && !blockOk(finance)) missingBlocks.push('Finance representative');
          if (missingBlocks.length) {
            const bad = !blockOk(completedBy) ? ['by', 'title', 'date', 'signature'].map(cbInput) : ['by', 'title', 'date', 'signature'].map(finInput);
            revealField(bad.find((i) => i && !String(i.value || '').trim()));
            toast(prog
              ? `A weight or count is filled in: ${missingBlocks.join(' and ')} (name, title, date and signature) ${missingBlocks.length > 1 ? 'are' : 'is'} required to submit.`
              : 'Completed by, title, date and signature are required to submit.');
            return;
          }
        }
        // a draft keeps whatever was typed so it comes back when the draft is reopened
        // (Title is pre-filled from the login, so a draft keeps the block only if the person typed a name, date or signature)
        if (!(completedBy.by || completedBy.date || completedBy.signature)) completedBy = null;
        if (finance && !(finance.by || finance.title || finance.date || finance.signature)) finance = null;
      }


      let stageMap = null;
      if (entryStages && finalize && savingStage && !correctingStage) {
        stageMap = Object.assign({}, stagesOf(existingForStage));
        stageMap[savingStage] = { at: Date.now() };
      }
      const allStagesDone = entryStages
        ? entryStages.every((st) => (stageMap || stagesOf(existingForStage))[st.key])
        : true;
      const status = submitFlow
        ? ((finalize && allStagesDone) ? 'submitted' : 'draft')
        : undefined;
      let savedEntry;
      if (editingId) {
        const existing = entries.find(e => e.id === editingId);
        if (isSubmitted(existing)) { toast('This entry is submitted and can no longer be changed.'); return; }
        existing.history = existing.history || [];
        existing.history.push({ ts: Date.now(), previousValues: existing.values });
        existing.values = values;
        existing.inSpec = inSpec;
        existing.updatedAt = Date.now();
        if (stageMap) existing.stages = stageMap;
        if (pendingStageEdits.length) {
          existing.stageEdits = (existing.stageEdits || []).concat(pendingStageEdits);
          pendingStageEdits = [];
        }
        if (submitFlow) { existing.status = status; if (finalize) existing.submittedAt = Date.now(); }
        if (completedBy) existing.completedBy = completedBy;
        if (prog) { if (finance) existing.financeRep = finance; else delete existing.financeRep; if (!completedBy) delete existing.completedBy; }
        savedEntry = existing;
      } else {
        savedEntry = {
          id: uid('entry'),
          values,
          inSpec,
          status,
          stages: stageMap || undefined,
          submittedAt: finalize ? Date.now() : undefined,
          completedBy: completedBy || undefined,
          financeRep: finance || undefined,
          previousSubmissionId: (prog && progPrev) ? progPrev.id : undefined,
          source: 'manual',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          history: []
        };
        entries.push(savedEntry);
      }

      const provisionalKeys = Array.from(el(modalIds.fields).querySelectorAll('[data-provisional="1"]'))
        .map((e) => e.id.slice((ns + '_f_').length));
      if (provisionalKeys.length) savedEntry.provisionalFields = provisionalKeys;
      else delete savedEntry.provisionalFields;
      const ok = await persist();
      if (!ok) {
        // a server refusal (sign-off rule, Complete job) says why; the stored record is re-read so the failed attempt is not left half-applied
        const why = prog && window.FacilityApi && window.FacilityApi.lastReject;
        if (prog) { await load(); if (editingId && !entries.some((e) => e.id === editingId)) editingId = null; }
        toast(why || 'Save failed — please retry.');
        return;
      }
      // the server stamps the stage (number, status, who/when): take the stored copy back
      if (prog && finalize) {
        await load();
        savedEntry = entries.find((e) => e.id === savedEntry.id) || savedEntry;
      }

      if (window.Traceability && traceConfig && traceConfig.batchField) {
        try { window.Traceability.indexSubmission(traceConfig, savedEntry); }
        catch (e) { console.error('traceability index failed', e); }
      }
      closeForm();
      renderTable();

      if (afterSave) { try { await afterSave(savedEntry, finalize); } catch (e) { console.error('afterSave failed', e); } }
      if (onEntriesChanged) onEntriesChanged();
      if (submitFlow) {
        if (entryStages && finalize && correctingStage) {
          const st = entryStages.find((x) => x.key === correctingStage);
          toast(`Correction saved to ${st ? st.label : 'that section'} — recorded against your name.`);
        } else if (entryStages && finalize) {
          const st = entryStages.find((x) => x.key === savingStage);
          toast(allStagesDone
            ? 'Final section submitted — this entry is now complete and locked.'
            : `${st ? st.label : 'Section'} submitted. Come back by job no. for the next section.`);
        } else if (prog && finalize) {
          toast(`Stage ${stageNoOf(savedEntry)} submitted${stageStatusOf(savedEntry) === 'complete' ? ' — this job is now Complete and locked.' : '. Pick the job again to continue it.'}`);
        } else toast(finalize ? 'Entry submitted.' + softNote : 'Draft saved.');
      }
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
      // hidden system stamps flagged exportCsv (entry date / time) go in the export only
      const cols = listFields().concat(entryFields.filter(f => f.hidden && f.exportCsv));
      // REC 7.4.6: one row per stage; stage_no / status / signoff_required after the usual columns, the Finance
      // representative (name, date) as the last two
      const stageHead = prog ? ['stage_no', 'completion_status', 'signoff_required'] : [];
      const finHead = finOn ? ['Finance representative', 'Finance representative date'] : [];
      const rows = [cols.map(f => f.label).concat(submitFlow ? ['Submission', 'Status'] : ['Status'], stageHead, finHead)];
      filteredEntries().forEach(e => {
        const tail = e.inSpec === null || e.inSpec === undefined ? '' : (e.inSpec ? 'OK' : 'DEVIATION');
        const stageCols = !prog ? [] : (isSubmitted(e)
          ? [stageNoOf(e), stageStatusOf(e), e.stage && typeof e.stage.signoffRequired === 'boolean' ? String(e.stage.signoffRequired) : '']
          : ['', '', '']);
        const finCols = !finOn ? [] : [(e.financeRep && e.financeRep.by) || '', (e.financeRep && e.financeRep.date) || ''];
        rows.push(cols.map(f => { const val = valueFor(e, f); return val == null ? '' : String(val); })
          .concat(submitFlow ? [isSubmitted(e) ? 'Submitted' : 'Draft', tail] : [tail], stageCols, finCols));
      });
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      download(new Blob([csv], { type: 'text/csv' }), safeKey(title) + '.csv');
    }


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



    function injectListPrintHeader() {
      const table = tableWrap && tableWrap.querySelector('table.ml-table');
      const thead = table && table.querySelector('thead');
      if (!thead || !window.DocHeader) return false;
      const h = window.DocHeader.current(recordKey);
      if (!h) return false;
      const tr = document.createElement('tr');
      tr.id = 'ml-list-print-header-row';
      const td = document.createElement('td');
      td.colSpan = 99;
      td.innerHTML = window.DocHeader.blockHtml(h, null, null, '../assets/abagold-logo.png');
      tr.appendChild(td);
      thead.insertBefore(tr, thead.firstChild);
      return true;
    }

    function removeListPrintHeader() {
      const row = document.getElementById('ml-list-print-header-row');
      if (row) row.remove();
    }

    function printPdf() {
      setPageOrientation('landscape');

      const injected = injectListPrintHeader();
      if (injected) {
        document.body.classList.add('ml-printing-list');
        document.body.setAttribute('data-dh-skip-wrap', '');
      }
      withPrintTitle(safeKey(title) + '_' + new Date().toISOString().slice(0, 10), () => window.print());
      if (injected) {
        removeListPrintHeader();
        document.body.removeAttribute('data-dh-skip-wrap');
        document.body.classList.remove('ml-printing-list');
      }
    }

    function withPrintTitle(name, fn) {
      const previousTitle = document.title;
      document.title = name;
      fn();
      document.title = previousTitle;
    }


    function roleField(role) { return entryFields.find(f => f.role === role) || null; }

    function sheetRowFields() {

      return entryFields.filter(f => !f.role && !f.isComment && !f.hidden);
    }

    // REC 7.4.6 print: the Finance representative row under Completed by, per stage. A stage with no sign-off says so.
    function finRowHtml(entryRow) {
      const fr = entryRow.financeRep || null;
      const st = entryRow.stage || null;
      const row = window.SignOffBlock.printRow({ label: 'Finance representative', by: fr && fr.by, title: fr && fr.title, date: fr && fr.date, signature: fr && fr.signature });
      if (fr) return row;
      const note = st && st.signoffRequired === false ? 'No sign-off (no weights or counts in this stage)' : 'Not recorded (before finance sign-off was added)';
      return row + `<tr style="font-size:12px;"><td colspan="8" class="sheet-lbl">${esc(note)}</td></tr>`;
    }
    // REC 7.4.6 print of a job: "Job so far" summary, then every stage oldest first, each with its own sign-off rows.
    function buildJobSheet(entryRow) {
      const stages = jobStages(entryJob(entryRow));
      const list = stages.includes(entryRow) || isSubmitted(entryRow) ? stages : stages.concat([entryRow]);
      if (list.length < 1) return buildEntrySheet(entryRow);
      const sum = list.map((e) => { const v = e.values || {};
        return `<tr><td>${isSubmitted(e) ? stageNoOf(e, stages) : 'Draft'}</td><td>${esc(isSubmitted(e) ? statusLabel(stageStatusOf(e)) : '—')}</td><td>${esc(dayMon(e.submittedAt) || '')}</td>
          <td>${esc(stageSignedBy(e) || '')}</td><td>${esc((e.financeRep && e.financeRep.by) || '')}</td><td>${esc(v.weightIn || '')}</td><td>${esc(v.weightOut || '')}</td></tr>`; }).join('');
      const head = `<div class="sheet-jobsofar"><h3 style="margin:0 0 6px;">Job so far: ${esc(entryJob(entryRow))}</h3>
        <table class="sheet-body"><tr><th>Stage</th><th>Status</th><th>Submitted</th><th>By</th><th>Finance rep.</th><th>Weight in (kg)</th><th>Weight out (kg)</th></tr>${sum}</table></div>`;
      return head + list.map((e) => `<div style="page-break-before:always;">${buildEntrySheet(e)}</div>`).join('');
    }

    function buildEntrySheet(entryRow) {
      const v = entryRow.values || {};
      const dateF = roleField('date'), opF = roleField('operator');
      const stampDateF = entryFields.find(f => isStampDate(f) && !f.hidden) || null;   // records with a system-stamped Entry date print it in the header
      const m = sheetMeta || {};
      if (customBody && typeof customBody.sheetHtml === 'function') {
        try { return customBody.sheetHtml(entryRow, { docCode, docTitle, meta: m }); }
        catch (e) { console.error('customBody.sheetHtml failed', e); }
      }
      const rows = sheetRowFields().map(f => {
        const raw = valueFor(entryRow, f);
        if (f.legacy && (raw === '' || raw == null)) return '';   // "(old)" rows print only on old entries
        const shown = (raw === '' || raw == null) ? '' : (isStamp(f) ? stampText(raw) : String(raw));
        const comment = v[f.key + '__comment'] || '';
        const cell = isBadValue(f, shown) ? `<span class="ml-bad">${esc(shown)} &#9888;</span>` : esc(shown);
        return `<tr><td class="sheet-item">${esc(f.label)}${f.unit ? ` (${esc(f.unit)})` : ''}</td>
          <td class="sheet-rec">${cell}</td><td>${esc(comment)}</td></tr>`;
      }).join('');
      const verified = entryRow.verification || null;
      const cb = entryRow.completedBy || {};
      // printLayout "4col" (REC 7.4.2): Job info as one full-width row, then every group as a
      // heading bar over a 4-column grid of label-over-value cells; free text spans the row.
      const body = config.printLayout === '4col' ? sheet4colBody(entryRow) : `
      <table class="sheet-body">
        <tr><th>Date: ${esc(dateF ? (v[dateF.key] || '') : (stampDateF ? stampText(valueFor(entryRow, stampDateF)) : ''))}</th><th style="text-align:center;">Record:</th><th>Comments:</th></tr>
        ${rows}
      </table>`;
      return `
      <table class="sheet-head">
        <tr><td class="sheet-logo" rowspan="4">${esc(m.logoText || 'ABAGOLD')}</td>
            <td class="sheet-lbl">Document:</td><td>${esc(docTitle)}</td>
            <td class="sheet-lbl">Doc number:</td><td>${esc(docCode)}</td></tr>
        <tr><td class="sheet-lbl">Prepared by:</td><td>${esc(m.preparedBy || '')}</td>
            <td class="sheet-lbl">Revision:</td><td>${esc(m.revision || '')}</td></tr>
        <tr><td class="sheet-lbl">Approved by:</td><td>${esc(m.approvedBy || '')}</td>
            <td class="sheet-lbl">Page:</td><td>1 of 1</td></tr>
        <tr><td class="sheet-lbl">Effective Date:</td><td>${esc(m.effectiveDate || '')}</td>
            <td class="sheet-lbl">Revision Date:</td><td>${esc(m.revisionDate || '')}</td></tr>
        <tr><td colspan="5">Distribution approved as controlled copy:</td></tr>
      </table>
      ${body}
      <table class="sheet-sign">
        <tr><td class="sheet-lbl">Completed by:</td><td>${esc(cb.by || (opF ? (v[opF.key] || '') : ''))}</td>
            <td class="sheet-lbl">Title:</td><td>${esc(cb.title || '')}</td>
            <td class="sheet-lbl">Date:</td><td>${esc(cb.date || (entryRow.submittedAt ? new Date(entryRow.submittedAt).toISOString().slice(0, 10) : ''))}</td>
            <td class="sheet-lbl">Signature:</td><td>${esc(cb.signature || '')}</td></tr>
        ${finOn ? finRowHtml(entryRow) : ''}
        <tr><td class="sheet-lbl">Verified by:</td><td>${esc(verified ? verified.verifiedBy : '')}</td>
            <td class="sheet-lbl">Title:</td><td>${esc(verified ? verified.verifiedSig : '')}</td>
            <td class="sheet-lbl">Date:</td><td>${esc(verified ? verified.verifiedDate : '')}</td>
            <td class="sheet-lbl">Signature:</td><td>${esc(verified ? verified.verifiedSignature : '')}</td></tr>
      </table>`;
    }

    function sheet4colBody(entryRow) {
      const cellText = (f) => {
        const raw = valueFor(entryRow, f);
        const shown = (raw === '' || raw == null) ? '' : (isStamp(f) ? stampText(raw) : String(raw));
        return isBadValue(f, shown) ? `<span class="ml-bad">${esc(shown)} &#9888;</span>` : esc(shown);
      };
      const groups = [];
      sheetRowFields().forEach(f => {
        if (f.legacy) { const raw = valueFor(entryRow, f); if (raw === '' || raw == null) return; }
        let g = groups.find(x => x.name === (f.group || ''));
        if (!g) { g = { name: f.group || '', fields: [] }; groups.push(g); }
        g.fields.push(f);
      });
      const wideF = (f) => f.type === 'textarea' || f.wide || f.legacy;
      const cell = (f) => `<td class="s4-cell${f.legacy ? ' s4-old' : ''}"${wideF(f) ? ' colspan="4"' : ''}><div class="s4-lbl">${esc(f.label)}${f.unit ? ` (${esc(f.unit)})` : ''}${f.legacy && !/\(old\)/i.test(f.label) ? ' (old)' : ''}</div><div class="s4-val">${cellText(f)}</div></td>`;
      return groups.map(g => {
        const trs = [];
        let row = [];
        const flush = () => { if (row.length) { while (row.length < 4) row.push('<td class="s4-cell"></td>'); trs.push('<tr>' + row.join('') + '</tr>'); row = []; } };
        g.fields.forEach(f => {
          if (wideF(f)) { flush(); trs.push('<tr>' + cell(f) + '</tr>'); return; }
          row.push(cell(f)); if (row.length === 4) flush();
        });
        flush();
        return `<table class="sheet-4col"><colgroup><col><col><col><col></colgroup>${g.name ? `<tr><th colspan="4">${esc(g.name)}</th></tr>` : ''}${trs.join('')}</table>`;
      }).join('');
    }

    function printEntry(id) {
      const entryRow = entries.find(e => e.id === id);
      if (!entryRow) return;
      const dateF = roleField('date');
      const sheet = el('ml_printSheet');
      sheet.innerHTML = prog ? buildJobSheet(entryRow) : buildEntrySheet(entryRow);
      setPageOrientation('portrait');
      document.body.classList.add('ml-printing-entry');
      const stamp = (dateF && entryRow.values[dateF.key]) || new Date(entryRow.createdAt).toISOString().slice(0, 10);
      withPrintTitle(safeKey(docCode) + '_' + safeKey(title) + '_' + stamp, () => window.print());
      document.body.classList.remove('ml-printing-entry');
    }

    function exportEntryJson(id) {
      const entryRow = entries.find(e => e.id === id);
      if (!entryRow) return;
      const dateF = roleField('date');
      const stamp = (dateF && entryRow.values[dateF.key]) || new Date(entryRow.createdAt).toISOString().slice(0, 10);
      const payload = {
        docCode, record: docTitle, log: title,
        exportedAt: new Date().toISOString(),
        entry: entryRow
      };
      download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        safeKey(docCode) + '_' + stamp + '.json');
    }

    return { load, renderTable, openForm, closeForm, saveForm, exportCsv, exportJson, printPdf, continueChainChanged, resetContinueChain,
      printEntry, exportEntryJson,
      // Find-or-create a row in this log keyed by matchKeys, merging in `row`.
      // Used by a primary log's `deriveInto` to keep a summary/secondary log in
      // step. A row that has already been submitted is left untouched.
      upsertDerived: async (matchKeys, row) => {
        const same = (a, b) => String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
        const match = entries.find(e => matchKeys.every(k => same(e.values[k], row[k])));
        if (match) {
          if (isSubmitted(match)) return false;
          const merged = computeAll(Object.assign({}, match.values, row));
          match.history = match.history || [];
          match.history.push({ ts: Date.now(), previousValues: match.values });
          match.values = merged;
          match.inSpec = evaluateEntry(merged);
          match.updatedAt = Date.now();
          match.source = 'derived';
        } else {
          const values = computeAll(row);
          entries.push({
            id: uid('entry'), values, inSpec: evaluateEntry(values),
            status: submitFlow ? 'draft' : undefined, source: 'derived',
            createdAt: Date.now(), updatedAt: Date.now(), history: []
          });
        }
        const ok = await persist();
        renderTable();
        if (onEntriesChanged) onEntriesChanged();
        return ok;
      },
      submittedEntries: () => entries.filter(isSubmitted).slice()
        .sort((a, b) => (b.values.date || '').localeCompare(a.values.date || '')),
      applyVerification: async (ids, record) => {
        const set = new Set(ids);
        entries.forEach(e => { if (set.has(e.id)) e.verification = record; });

        const ok = await persist();
        renderTable();
        if (!ok) { toast('Verification could not be saved — please retry.'); return false; }
        return true;
      },

      verifiableCount: () => submitFlow ? entries.filter(e => isSubmitted(e) && !e.verification).length : entries.length,
      // Deep-link support: open entry <id> in this log if it lives here.
      openIfPresent: (id) => {
        if (!entries.some(e => e.id === id)) return false;
        openForm(id);
        const c = el(modalIds.fields);
        if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      } };
  }

  // Definition source of truth is the DB -- see form-record.js's fetchRecordDef note.
  async function fetchRecordDef(recordKey) {
    if (!window.FacilityApi) return null;
    return window.FacilityApi.recordDef(recordKey);   // cached copy first, refreshed in background
  }

  async function init(config) {

    if (window.LoginUI) {
      await window.LoginUI.ensureAuthenticated();
    }

    injectStyleOnce();

    if (!config.entryFields && !config.customBody && config.recordKey) {
      const fetched = await fetchRecordDef(config.recordKey);
      if (fetched) Object.assign(config, fetched);
    }
    if (!config.entryFields && !config.customBody) {
      const m = typeof config.mount === 'string' ? document.querySelector(config.mount) : config.mount;
      if (m) m.innerHTML = '<p style="padding:20px;font:600 14px system-ui;color:#9c241d">'
        + 'Could not load this record’s definition. The records API may be starting up — reload in a moment.</p>';
      return;
    }

    try {
      const _teRaw = await window.FacilityApi.templateOverride(config.recordKey);
      if (_teRaw) {
        const override = JSON.parse(_teRaw);
        if (override && override.schemaVersion === 1 && override.engine === 'monitoring-log') {
          if (override.entryFields) config.entryFields = override.entryFields;
          if (override.specFields) config.specFields = override.specFields;
        }
      }
    } catch (e) { console.warn('ml: template override parse failed', e); }

    const canManageTemplates = !window.PermissionRules || window.PermissionRules.can('manageTemplates');

    const mount = typeof config.mount === 'string' ? document.querySelector(config.mount) : config.mount;
    mount.classList.add('ml-app');

    function toast(msg) {
      const t = el('ml_toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), msg.length > 60 ? 5000 : 2200);
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
      // A customBody page owns its own spec system (e.g. multiple named
      // profiles) — the engine must not seed or bind a single spec for it.
      if (config.customBody) return;
      let published = await SpecRegistry.getPublished(specKey);
      if (!published) {
        published = await SpecRegistry.proposeVersion(specKey, defaultSpecObject(), {
          changeReason: `Seeded from paper record ${config.docCode}`, publishedBy: 'System', changedByTitle: 'System'
        });
      }
      currentSpec = published;
    }


    async function renderDocRevBadge() {
      el('ml_docRev').textContent =
        window.DocHeader.badgeText(docRevisionKey, config.docRevisionStart);
      const modalTag = el('ml_docRevInModal');
      if (modalTag) {
        const h = window.DocHeader.current(docRevisionKey);
        const rev = h && h.revision !== '' && h.revision != null
          ? h.revision
          : await DocumentRevision.getCurrent(docRevisionKey, config.docRevisionStart || 1);
        modalTag.textContent = `Rev ${rev}`;
      }
    }
    async function renderDocRevHistory() {
      const target = el('ml_docRevHistoryList');
      if (!target) return;
      const hist = await DocumentRevision.history(docRevisionKey);
      if (!hist.length) { target.innerHTML = `<div class="ml-history-item ml-muted">No revisions logged yet (currently Rev ${config.docRevisionStart || 1}).</div>`; return; }
      target.innerHTML = hist.map(h => `
        <div class="ml-history-item"><span>Rev ${h.revisionNumber} · ${new Date(h.changedAt).toLocaleString()} · ${esc(h.changedBy)} (${esc(h.changedByTitle)})<br><span class="ml-muted">${esc(h.reason)}</span></span></div>`).join('');
    }


    const instructionsHtml = (config.instructions || []).length ? `
      <div class="ml-panel no-print ml-instr-panel"><div class="ml-panel-head"><h2>Work instructions</h2>
          <button class="ml-btn ml-btn-flat ml-btn-sm ml-instr-toggle" id="ml_instrToggle" type="button">Show</button></div>
        <div class="ml-panel-body ml-instructions" id="ml_instrBody">
          ${config.instructions.map(i => `<div class="instr-item"><strong>${esc(i.label)}</strong>${esc(i.text)}</div>`).join('')}
        </div></div>` : '';

    const relatedHtml = (config.relatedLinks || []).length ? `
      <div class="ml-panel no-print ml-related"><div class="ml-panel-body">
        ${config.relatedLinks.map(l => `<a href="${esc(l.href)}">→ ${esc(l.label)}</a>`).join('<br>')}
      </div></div>` : '';


    const submitFlow = config.entryWorkflow !== 'save-only';


    function logBlockHtml(ns, blockTitle, inline) {

      const chain = config.entryStages && config.continueChain ? config.continueChain : null;
      const continuePanel = chain ? `
      <div class="ml-panel no-print ml-continue-panel">
        <div class="ml-panel-head"><h2>Continue a job</h2></div>
        <div class="ml-panel-body">
          <div class="ml-continue">
            <div class="ml-continue-row">
              ${chain.map((lv, i) => `<label class="ml-field">${esc(lv.label)}
                <select id="${ns}_continue${i}"><option value="">— any —</option></select>
              </label>`).join('')}
            </div>
            <button type="button" class="ml-btn ml-btn-flat" id="${ns}_continueReset">Start a new entry</button>
            <div class="ml-muted" id="${ns}_continueHint"></div>
          </div>
        </div>
      </div>` : '';
      // Same COMPLETED BY block as every form-record page (Completed by / Title / Date / Signature).
      // A customBody page draws its own copy of the block, so the engine skips it there.
      const completedByPanel = config.customBody ? '' : `
          <details class="ml-section-collapsible ml-signoff-block" open>
            <summary class="ml-grouphead">Completed by</summary>
            ${config.progressive ? `<div class="ml-so-banner" id="${ns}_soBanner" style="display:none;"></div>` : ''}
            ${window.SignOffBlock.completedByHtml({ byId: ns + '_cb_by', titleId: ns + '_cb_title', dateId: ns + '_cb_date', signatureId: ns + '_cb_signature', gridClass: 'ml-grid ml-grid-4', fieldClass: 'ml-field' })}
            ${config.financeSignOff ? `<div class="ml-so-split"></div>
            ${window.SignOffBlock.completedByHtml({ byLabel: 'Finance representative', byId: ns + '_fin_by', titleId: ns + '_fin_title', dateId: ns + '_fin_date', signatureId: ns + '_fin_signature', gridClass: 'ml-grid ml-grid-4', fieldClass: 'ml-field' })}` : ''}
          </details>`;
      const fieldsAndActions = `
          <div class="ml-collapse-ctl no-print" id="${ns}_collapseCtl" hidden><button type="button" data-ml-collapse="close">Collapse all</button><span aria-hidden="true">·</span><button type="button" data-ml-collapse="open">Expand all</button></div>
          <div id="${ns}_modalFields" class="ml-grid ml-grid-2"></div>${completedByPanel}
          <div class="ml-actions">
            <button class="ml-btn ml-btn-flat" id="${ns}_cancelBtn">${inline ? 'Clear' : 'Cancel'}</button>
            <button class="ml-btn ${submitFlow ? 'ml-btn-flat' : 'ml-btn-primary'}" id="${ns}_saveBtn">${submitFlow ? 'Save draft' : 'Save entry'}</button>
            ${submitFlow ? `<button class="ml-btn ml-btn-primary" id="${ns}_submitBtn">Submit</button>` : ''}
          </div>`;
      const entriesPanel = `
      <div class="ml-panel no-print">
        <div class="ml-panel-head">
          <h2>${config.recentEntries ? 'Previous ' + Number(config.recentEntries) + ' logs' : esc(blockTitle)}</h2>
          <span>
            <button type="button" class="ml-btn ml-btn-flat ml-btn-sm ml-reveal-btn no-print" data-reveal="${ns}_entriesBody" data-label="entries">${config.recentEntries ? 'Hide' : 'View'} entries</button>
            ${inline ? '' : `<button class="ml-btn ml-btn-primary ml-btn-sm" id="${ns}_addEntryBtn">+ Add entry</button>`}
          </span>
        </div>
        <div class="ml-panel-body ml-collapsible${config.recentEntries ? ' ml-open' : ''}" id="${ns}_entriesBody">
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
      </div>`;
      if (inline) {
        return `
      ${continuePanel}
      <div class="ml-panel no-print">
        <div class="ml-panel-head"><h2 id="${ns}_modalTitle">${esc(blockTitle)}</h2></div>
        <div class="ml-panel-body">${fieldsAndActions}</div>
      </div>
      ${entriesPanel}`;
      }
      return `
      ${continuePanel}
      ${entriesPanel}
      <div id="${ns}_modal" class="ml-modal-overlay no-print" style="display:none;">
        <div class="ml-modal-inner">
          <h2 id="${ns}_modalTitle">Add entry</h2>
          ${fieldsAndActions}
        </div>
      </div>`;
    }

    const showVerification = config.showVerificationStrip !== false;
    const verificationHtml = showVerification ? `
      <div class="ml-panel no-print">
        <div class="ml-panel-head">
          <h2>Verification</h2>
          <button type="button" class="ml-btn ml-btn-flat ml-btn-sm ml-reveal-btn no-print" data-reveal="ml_verificationBody" data-label="verification">View verification</button>
        </div>
        <div class="ml-panel-body ml-collapsible" id="ml_verificationBody">
          <div class="ml-notice ml-notice-due" id="ml_verifyGate" style="display:none;"></div>
          <div class="ml-notice ml-notice-due" id="ml_verifyNotice"></div>
          ${submitFlow ? `
          <button type="button" class="ml-btn ml-btn-flat ml-btn-sm ml-reveal-btn no-print" data-reveal="ml_verifySelect" data-label="entries to verify">View entries to verify</button>
          <div class="ml-history-list ml-collapsible" id="ml_verifySelect" style="margin-bottom:10px;"></div>` : ''}
          ${window.SignOffBlock.verifyFieldsHtml({ idPrefix: 'ml_verified', gridClass: 'ml-grid ml-grid-4', fieldClass: 'ml-field' })}
          <div class="ml-actions" style="justify-content:flex-start; margin-top:0;">
            <button class="ml-btn ml-btn-primary ml-btn-sm" id="ml_saveVerificationBtn">Log verification</button>
          </div>
          <button type="button" class="ml-btn ml-btn-flat ml-btn-sm ml-reveal-btn no-print" data-reveal="ml_verificationHistory" data-label="verification history">View verification history</button>
          <div class="ml-history-list ml-collapsible" id="ml_verificationHistory"></div>
        </div>
      </div>` : '';


    const showThresholds = false;

    const topAddEntry = false;
    const entriesAtBottom = config.entriesPosition === 'bottom';
    const inlineEntryForm = true;

    const logsHtml = `
        ${logBlockHtml('ml_p', config.secondaryLog ? (config.primaryLogTitle || 'Entries') : 'Entries', inlineEntryForm)}
        ${config.secondaryLog ? logBlockHtml('ml_s', config.secondaryLog.title, inlineEntryForm) : ''}`;

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
      <div class="ml-sheet" id="ml_printSheet"></div>
    `;


    const primary = makeLogController({
      ns: 'ml_p',
      title: config.title,
      entryFields: expandCommentFields(config.entryFields),
      storageKey: 'monitoring_log:' + config.recordKey,
      recordKey: config.recordKey,
      sheetMeta: config.docMeta, docCode: config.docCode, docTitle: config.title,
      onEntriesChanged: () => refreshVerification(),
      afterSave: config.deriveInto ? async (savedEntry) => {
        if (!secondary) return;
        const d = config.deriveInto;
        const row = {};
        Object.entries(d.map || {}).forEach(([to, from]) => {
          row[to] = savedEntry.values[from] == null ? '' : savedEntry.values[from];
        });
        if (d.matchKeys.some((k) => String(row[k] == null ? '' : row[k]).trim() === '')) return;
        Object.entries(d.stampFields || {}).forEach(([to, kind]) => {
          if (kind === 'today') row[to] = new Date().toISOString().slice(0, 10);
        });
        await secondary.upsertDerived(d.matchKeys, row);
      } : null,
      specGetter: () => currentSpec,
      toast,
      tableWrap: el('ml_p_table'),
      modalIds: { overlay: 'ml_p_modal', title: 'ml_p_modalTitle', fields: 'ml_p_modalFields' },
      entryStages: config.entryStages,
      continueChain: config.continueChain,
      deviationLabel: config.deviationLabel || 'Deviation',
      deviationPolarity: config.deviationPolarity || 'deviation',
      submitFlow,
      inline: inlineEntryForm,
      autofill: config.autofill,
      jobInfoGroup: config.jobInfoGroup,
      customBody: config.customBody || null,
      traceConfig: config
    });
    let secondary = null;
    if (config.secondaryLog) {
      secondary = makeLogController({
        ns: 'ml_s',
        title: config.secondaryLog.title,
        entryFields: expandCommentFields(config.secondaryLog.entryFields),
        storageKey: 'monitoring_log:' + config.recordKey + '__' + config.secondaryLog.key,
        recordKey: config.recordKey,
        sheetMeta: config.docMeta, docCode: config.docCode, docTitle: config.title,
      onEntriesChanged: () => refreshVerification(),
        specGetter: () => currentSpec,
        toast,
        tableWrap: el('ml_s_table'),
        modalIds: { overlay: 'ml_s_modal', title: 'ml_s_modalTitle', fields: 'ml_s_modalFields' },
        deviationLabel: config.secondaryLog.deviationLabel || 'Deviation',
        deviationPolarity: config.secondaryLog.deviationPolarity || 'deviation',
        submitFlow,
        inline: inlineEntryForm
      });
    }

    function wireLog(ctrl, ns) {
      const addBtn = el(`${ns}_addEntryBtn`);
      if (addBtn) addBtn.addEventListener('click', () => ctrl.openForm(null));

      const cancelBtn = el(`${ns}_cancelBtn`);
      const baseLabel = cancelBtn.textContent;
      let armed = false, armTimer = null;
      function disarm() {
        armed = false;
        if (armTimer) { clearTimeout(armTimer); armTimer = null; }
        cancelBtn.textContent = baseLabel;
      }
      function hasInput() {
        const c = el(`${ns}_modalFields`);
        if (!c) return false;
        return Array.from(c.querySelectorAll('input,select,textarea')).some(i =>
          (i.type === 'checkbox' || i.type === 'radio') ? i.checked : String(i.value || '').trim() !== '');
      }
      cancelBtn.addEventListener('click', () => {
        const saveBtn = el(`${ns}_saveBtn`);
        const locked = !!saveBtn && saveBtn.style.display === 'none';
        if (!inlineEntryForm || locked || !hasInput() || armed) { disarm(); ctrl.closeForm(); return; }
        armed = true;
        cancelBtn.textContent = 'Tap again to clear';
        armTimer = setTimeout(disarm, 4000);
      });
      if (config.continueChain && config.entryStages) {
        config.continueChain.forEach((lv, i) => {
          const sel = el(`${ns}_continue${i}`);
          if (sel) sel.addEventListener('change', () => ctrl.continueChainChanged());
        });
        const resetBtn = el(`${ns}_continueReset`);
        if (resetBtn) resetBtn.addEventListener('click', () => ctrl.resetContinueChain());
      }
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
    const instrToggle = el('ml_instrToggle');
    if (instrToggle) {
      instrToggle.addEventListener('click', () => {
        const panel = instrToggle.closest('.ml-instr-panel');
        const open = panel.classList.toggle('ml-open');
        instrToggle.textContent = open ? 'Hide' : 'Show';
      });
    }
    if (topAddEntry) el('ml_topAddEntryBtn').addEventListener('click', () => primary.openForm(null));
    if (inlineEntryForm) {
      primary.openForm(null);
      if (secondary) secondary.openForm(null);
    }


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


    if (canManageTemplates && new URLSearchParams(location.search).get('editTemplate') === '1') {
      function doOpen() {
        window.TemplateEditor.open({
          recordKey: config.recordKey,
          engine: 'monitoring-log',
          currentConfig: {
            entryFields: JSON.parse(JSON.stringify(config.entryFields || [])),
            specFields: JSON.parse(JSON.stringify(config.specFields || []))
          },
          inlineConfig: null,
          docRevisionStart: config.docRevisionStart,
          onSave: () => location.reload()
        });
      }
      if (window.TemplateEditor) { doOpen(); }
      else {
        const s = document.createElement('script');
        s.src = '../lib/template-editor.js';
        s.onload = doOpen;
        document.head.appendChild(s);
      }
    }


    let refreshVerification = () => {};
    if (showVerification) {

      const notifyCfg = config.verificationNotify || null;
      const operatorField = (config.entryFields || []).find(f => f.role === 'operator') || null;

      let verifyGate = { allowed: true, signedIn: true, roles: [], rolesLabel: '' };

      function applyVerifyGate() {
        const btn = el('ml_saveVerificationBtn');
        const line = el('ml_verifyGate');
        if (btn) {
          btn.disabled = !verifyGate.allowed;
          btn.title = verifyGate.allowed ? '' : window.SignOffBlock.gateMessage(verifyGate);
        }
        if (line) {
          if (verifyGate.allowed) { line.style.display = 'none'; line.innerHTML = ''; }
          else {
            line.style.display = '';
            line.textContent = window.SignOffBlock.gateMessage(verifyGate) + ' ';
            if (!verifyGate.signedIn && window.LoginUI && window.LoginUI.showLoginModal) {
              const b = document.createElement('button');
              b.type = 'button';
              b.className = 'ml-btn ml-btn-flat ml-btn-sm';
              b.textContent = 'Sign in';
              b.addEventListener('click', () => window.LoginUI.showLoginModal());
              line.appendChild(b);
            }
          }
        }
      }

      async function loadVerifyGate() {
        try { verifyGate = await window.SignOffBlock.verifyGate(config.recordKey); }
        catch (e) { verifyGate = { allowed: true, signedIn: true, roles: [], rolesLabel: '' }; }
        applyVerifyGate();
      }


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


      function pendingForVerification() {
        const tag = (ctrl, which) => ctrl.submittedEntries()
          .filter(e => !e.verification)
          .map(e => ({ which, entry: e }));
        return tag(primary, 'primary').concat(secondary ? tag(secondary, 'secondary') : []);
      }

      function renderVerifySelect() {
        const target = el('ml_verifySelect');
        if (!target) return;
        const pending = pendingForVerification();
        if (!pending.length) {
          target.innerHTML = `<div class="ml-history-item ml-muted">No submitted entries are waiting to be verified.</div>`;
          return;
        }
        target.innerHTML = `<div class="ml-history-item"><label style="font-weight:700;">
            <input type="checkbox" id="ml_verifyAll"> Select all (${pending.length})</label></div>` +
          pending.map(p => `<div class="ml-history-item"><label>
            <input type="checkbox" class="ml-verify-pick" data-which="${p.which}" value="${esc(p.entry.id)}">
            ${esc(p.entry.values.date || '(no date)')}
            <span class="ml-muted">· ${esc(operatorField ? (p.entry.values[operatorField.key] || '—') : '')}</span></label>
            ${p.entry.inSpec === false ? '<span class="ml-badge ml-badge-fail">Deviation</span>' : ''}</div>`).join('');
        el('ml_verifyAll').addEventListener('change', ev => {
          target.querySelectorAll('.ml-verify-pick').forEach(cb => { cb.checked = ev.target.checked; });
        });
      }

      async function renderVerificationHistory() {
        const hist = await window.SignOffBlock.getVerificationHistory(config.recordKey);
        const target = el('ml_verificationHistory');
        renderVerifySelect();
        checkVerificationDue(hist);
        applyVerifyGate();
        if (!hist.length) { target.innerHTML = `<div class="ml-history-item ml-muted">No verification logged yet.</div>`; return; }
        target.innerHTML = hist.slice().reverse().map(v => `
          <div class="ml-history-item"><span>${window.SignOffBlock.historyLine(v)}</span></div>`).join('');
      }
      el('ml_saveVerificationBtn').addEventListener('click', async () => {
        verifyGate = await window.SignOffBlock.verifyGate(config.recordKey);
        applyVerifyGate();
        if (!verifyGate.allowed) { toast(window.SignOffBlock.gateMessage(verifyGate)); return; }

        const values = window.SignOffBlock.readVerifyInputs('ml_verified');
        if (!window.SignOffBlock.validateVerifyInputs(values)) { toast('Verified by, title, date and signature are all required.'); return; }


        let picked = [];
        if (submitFlow) {
          picked = [...document.querySelectorAll('.ml-verify-pick:checked')]
            .map(cb => ({ which: cb.dataset.which, id: cb.value }));
          if (pendingForVerification().length && !picked.length) {
            toast('Tick at least one entry to verify.'); return;
          }
        }

        const record = await window.SignOffBlock.logVerification({ recordKey: config.recordKey, values, picked: picked.map(p => p.id) });

        if (picked.length) {

          const okP = await primary.applyVerification(picked.filter(p => p.which === 'primary').map(p => p.id), record);
          const okS = secondary
            ? await secondary.applyVerification(picked.filter(p => p.which === 'secondary').map(p => p.id), record)
            : true;
          if (!okP || !okS) return;
        }
        toast(picked.length ? `Verification logged for ${picked.length} ${picked.length === 1 ? 'entry' : 'entries'}.` : 'Verification logged.');
        window.SignOffBlock.clearVerifyInputs('ml_verified');
        renderVerificationHistory();
      });

      refreshVerification = renderVerificationHistory;
      loadVerifyGate();
      if (typeof document !== 'undefined') {
        document.addEventListener('authSuccess', () => { loadVerifyGate(); });
      }
    }


    await mountDocHeader(config);
    await renderDocRevBadge();

    if (window.storage && window.storage.whenReady) await window.storage.whenReady();
    await loadSpec();
    await primary.load();
    primary.renderTable();
    if (secondary) { await secondary.load(); secondary.renderTable(); }
    refreshVerification();

    // #<entryId> deep link (e.g. from Batch Traceability) opens that entry.
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    function openFromHash() {
      let id = (location.hash || '').replace(/^#/, '');
      try { id = decodeURIComponent(id); } catch (e) { /* keep raw */ }
      id = id.trim();
      if (!id) return;
      if (!primary.openIfPresent(id) && !(secondary && secondary.openIfPresent(id))) {
        toast('That entry has not reached this device yet.');
      }
    }

    if (config.customBody && typeof config.customBody.init === 'function') {
      try {
        await config.customBody.init({
          recordKey: config.recordKey, docCode: config.docCode, docTitle: config.title,
          docRevisionStart: config.docRevisionStart, toast,
          refresh: () => { primary.renderTable(); refreshVerification(); },
          reopen: () => primary.openForm(null)
        });
      } catch (e) { console.error('customBody.init failed', e); }
      primary.openForm(null);
    }
  }


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

  window.MonitoringLog = { init };
})();

