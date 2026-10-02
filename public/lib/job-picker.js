// Job picker: replaces every job-number <select data-jobsearch> on a record form with a
// search -> pick -> confirm flow. Typing narrows the open-job list; picking a job opens a
// popup with that job's receiving details (REC 7.1.2) so the operator can check it is the
// right job; only on Confirm is the value written to the (hidden) select and change fired,
// which is what triggers the engines' autofill. After confirming, the enclosing Job info
// section collapses to a single small "Job no. XXX" line.
//
// The search is split by route: the operator first picks Can or Dry, and the list only
// offers jobs whose prefix belongs to that route (3CP/CPR = Can, 3DP/DPR = Dry). Closed
// jobs stay in the list, tagged "Closed", so a job can still be found after close-out.
// A jobsearch field with `route: 'Dried'` (or 'Can') -> <select data-route> locks the picker to that
// route: no Can/Dry toggle, and only jobs whose prefix is that route can be picked (dry records).
//
// The <select> stays in the DOM as the value holder, so saving, autofill, summaries and
// route checks keep working unchanged. Loaded on demand by form-record.js / monitoring-log.js.
(function () {
  if (window.JobPicker) return;

  const RECEIVING_KEY = 'abalone-receiving';
  const ROUTE_PREF_KEY = 'jp_route';
  const ROUTES = [['Can', 'Can'], ['Dried', 'Dry']];
  const PREFIX_ROUTE = { '3CP': 'Can', 'CPR': 'Can', '3DP': 'Dried', 'DPR': 'Dried' };
  // Records that CREATE the job number (nothing to search for), so the open-gate never applies to them.
  // (REC 7.1.2 has no jobsearch field at all; the constant is a second guard keyed on recordKey.)
  const JOB_START_RECORDS = ['abalone-receiving'];

  // 'Can' | 'Dried' | null, from the job-number prefix.
  function routeOf(jobNo) {
    if (window.Lookups && window.Lookups.batch && window.Lookups.batch.route) return window.Lookups.batch.route(jobNo);
    const v = String(jobNo == null ? '' : jobNo).trim().toUpperCase();
    for (const p in PREFIX_ROUTE) if (v.indexOf(p) === 0) return PREFIX_ROUTE[p];
    return null;
  }

  function loadRoutePref() {
    try { const v = localStorage.getItem(ROUTE_PREF_KEY); return v === 'Can' || v === 'Dried' ? v : ''; } catch (e) { return ''; }
  }
  function saveRoutePref(v) {
    try { localStorage.setItem(ROUTE_PREF_KEY, v); } catch (e) { }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function apiFetch(path) {
    return window.FacilityApi ? window.FacilityApi.fetch(path)
      : fetch((window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com') + path);
  }

  function injectCss() {
    if (document.getElementById('jp_css')) return;
    const st = document.createElement('style');
    st.id = 'jp_css';
    st.textContent = `
  .jp-wrap{ position:relative; display:block; width:100%; }
  .jp-wrap select[data-jobsearch]{ display:none !important; }
  .jp-search{ width:100%; box-sizing:border-box; }
  .jp-search:disabled{ background:#f3f4f6; cursor:not-allowed; }
  .jp-route{ display:inline-flex; margin-bottom:6px; border:1px solid var(--palette-rule,#c9ced6); border-radius:6px; overflow:hidden; }
  .jp-route[hidden]{ display:none; }
  .jp-route button{ min-width:72px; padding:8px 16px; border:0; background:#fff; color:var(--palette-ink,#1b2330); font-size:14px; font-weight:600; cursor:pointer; }
  .jp-route button + button{ border-left:1px solid var(--palette-rule,#c9ced6); }
  .jp-route button[aria-pressed="true"]{ background:var(--palette-ink,#1b2330); color:#fff; }
  .jp-opt{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
  .jp-tag{ font-family:"Segoe UI",system-ui,sans-serif; font-size:11px; font-weight:600; padding:1px 7px; border-radius:10px; background:#e7e9ed; color:#4a5261; }
  .jp-list{ position:absolute; z-index:50; left:0; right:0; top:100%; margin-top:2px; max-height:260px; overflow:auto;
    background:#fff; border:1px solid var(--palette-rule,#c9ced6); border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.15); }
  .jp-list[hidden]{ display:none; }
  .jp-opt{ padding:9px 12px; cursor:pointer; font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; font-size:14px; }
  .jp-opt.active, .jp-opt:hover{ background:var(--palette-hover,#eef2f7); }
  .jp-empty{ padding:9px 12px; color:#6b7380; font-size:13px; }
  .jp-picked{ display:flex; align-items:center; gap:10px; min-height:36px; }
  .jp-picked[hidden], .jp-search[hidden]{ display:none; }
  /* the picker owns its row: Can/Dry sits beside the search box, so the job-info fields after it
     line up as one even row instead of wrapping around a double-height cell */
  .fr-field.jp-field, .ml-field.jp-field{ grid-column:1 / -1; }
  .jp-field .jp-wrap{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
  .jp-field .jp-route{ margin-bottom:0; }
  .jp-field .jp-search{ flex:1 1 220px; width:auto; max-width:420px; }
  .jp-picked-no{ font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; font-weight:700; font-size:15px; }
  .jp-change{ background:none; border:0; padding:4px 6px; color:var(--palette-link,#1f5fa8); text-decoration:underline; cursor:pointer; font-size:13px; }
  .jp-search{ min-height:48px; font-size:16px; padding:8px 12px; }
  .jp-opt{ min-height:44px; box-sizing:border-box; align-items:center; }
  /* record-open gate: everything but the job search stays out of sight (and out of the tab order) until a job is confirmed */
  .jp-gated{ display:none !important; }
  /* the open list must not be clipped by a scrolling form panel while the rest of the form is hidden */
  .jp-gate-root{ overflow:visible !important; max-height:none !important; min-height:360px; }
  .jp-reveal{ animation:jpReveal .15s ease-out; }
  @keyframes jpReveal{ from{ opacity:0; } to{ opacity:1; } }
  @media (prefers-reduced-motion:reduce){ .jp-reveal{ animation:none; } }
  .jp-gate-back{ flex:1 0 100%; margin-top:6px; }
  .jp-gate-back button{ background:none; border:0; padding:10px 4px; min-height:44px; color:var(--palette-link,#1f5fa8); text-decoration:underline; cursor:pointer; font-size:14px; }
  body.jp-gate-on .rt-rail, body.jp-gate-on .rt-actionbar-fixed{ display:none !important; }
  .jp-actions button{ min-height:44px; }
  .jp-modal{ font-family:"Segoe UI",system-ui,sans-serif; position:fixed; inset:0; z-index:1000; background:rgba(15,20,30,.45); display:flex; align-items:center; justify-content:center; padding:16px; }
  .jp-card{ background:#fff; color:#1b2330; border-radius:10px; width:100%; max-width:440px; box-shadow:0 12px 40px rgba(0,0,0,.3); overflow:hidden; }
  .jp-card h3{ margin:0; padding:14px 18px; font-size:17px; border-bottom:1px solid #e3e6eb; }
  .jp-card h3 span{ font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; }
  .jp-body{ padding:12px 18px; }
  .jp-dl{ display:grid; grid-template-columns:auto 1fr; gap:6px 14px; margin:0; font-size:14px; }
  .jp-dl dt{ color:#6b7380; }
  .jp-dl dd{ margin:0; font-weight:600; }
  .jp-warn{ margin-top:10px; padding:8px 10px; border-radius:6px; background:#fff4d6; color:#7a5200; font-size:13px; }
  .jp-actions{ display:flex; justify-content:flex-end; gap:10px; padding:12px 18px; border-top:1px solid #e3e6eb; }
  .jp-actions button{ padding:9px 16px; border-radius:6px; font-size:14px; cursor:pointer; border:1px solid #c9ced6; background:#fff; }
  .jp-actions .jp-confirm{ background:var(--palette-ink,#1b2330); color:#fff; border-color:transparent; font-weight:600; }
  .jp-actions .jp-confirm:disabled{ opacity:.5; cursor:default; }
  `;
    document.head.appendChild(st);
  }

  async function fetchDetails(jobNo) {
    const [rec, status] = await Promise.all([
      apiFetch(`/api/lookup/${RECEIVING_KEY}/jobNo/${encodeURIComponent(jobNo)}`)
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
      window.JobStatus ? window.JobStatus.get(jobNo).catch(() => null) : Promise.resolve(null)
    ]);
    return { rec, status };
  }

  function intakeOf(rec) {
    if (!rec) return '';
    if (rec.intakeWeight != null && rec.intakeWeight !== '') return rec.intakeWeight;
    const s = rec.__rosterSums && rec.__rosterSums.wholeWeight;
    return s ? (Math.round(parseFloat(s) * 100) / 100).toFixed(2) : '';
  }

  // Resolves true (Confirm) or false ("Choose a different job" / Esc). The popup stays until one of
  // them is pressed: no backdrop-click close, no timer. Enter = Confirm. Focus is trapped inside.
  function confirmJob(jobNo) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'jp-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `<div class="jp-card">
        <h3>Confirm job <span>${esc(jobNo)}</span></h3>
        <div class="jp-body"><div class="jp-empty">Loading job details…</div></div>
        <div class="jp-actions">
          <button type="button" class="jp-cancel">Choose a different job</button>
          <button type="button" class="jp-confirm" disabled>Confirm</button>
        </div></div>`;
      document.body.appendChild(modal);
      const okBtn = modal.querySelector('.jp-confirm');
      const noBtn = modal.querySelector('.jp-cancel');
      const done = (ok) => {
        document.removeEventListener('keydown', onKey, true);
        modal.remove();
        resolve(ok);
      };
      const onKey = (ev) => {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); done(false); }
        else if (ev.key === 'Enter' && !okBtn.disabled && !(ev.target && ev.target === noBtn)) { ev.preventDefault(); ev.stopPropagation(); done(true); }
        else if (ev.key === 'Tab') {
          const items = [noBtn, okBtn].filter((b) => !b.disabled);
          if (!items.length) { ev.preventDefault(); return; }
          const i = items.indexOf(document.activeElement);
          ev.preventDefault();
          items[(i + (ev.shiftKey ? -1 : 1) + items.length) % items.length].focus();
        }
      };
      document.addEventListener('keydown', onKey, true);
      noBtn.addEventListener('click', () => done(false));
      okBtn.addEventListener('click', () => done(true));
      try { noBtn.focus(); } catch (e) { }

      fetchDetails(jobNo).then(({ rec, status }) => {
        if (!modal.isConnected) return;
        const r = rec || {};
        const sizes = r.__rosterOptions && r.__rosterOptions.sizeRange;
        const rows = [
          ['Job no.', jobNo],
          ['Receiving date', r.receivingDate],
          ['Received from', r.receivedFrom],
          ['To be processed for', r.toBeProcessedFor],
          ['Whole weight (kg)', intakeOf(r)],
          ['Size ranges', Array.isArray(sizes) && sizes.length ? sizes.join(', ') : ''],
          ['Job status', status && status.status === 'closed' ? 'Closed' : 'Open']
        ];
        let warn = '';
        if (status && status.status === 'closed') warn = 'This job has been closed out. Only confirm if this record genuinely belongs to it. ';
        if (!rec) warn += 'No Abalone Receiving record (REC 7.1.2) was found for this job. Check the job number before confirming.';
        else if (r.__status && r.__status !== 'submitted') warn += 'The Abalone Receiving record (REC 7.1.2) for this job is still a draft — its details are provisional. ';
        if (rec && !(Array.isArray(sizes) && sizes.length)) warn += 'No size ranges are captured on the Abalone Receiving record (REC 7.1.2) for this job, so size-range pickers will list every size.';
        modal.querySelector('.jp-body').innerHTML = `<dl class="jp-dl">${rows.map(([k, v]) =>
          `<dt>${esc(k)}</dt><dd>${esc(v == null || v === '' ? '—' : v)}</dd>`).join('')}</dl>` +
          (warn ? `<div class="jp-warn">${esc(warn)}</div>` : '');
        okBtn.disabled = false;
        try { okBtn.focus(); } catch (e) { }
      });
    });
  }

  // ---- Job info block: job data only -----------------------------------------------------------------
  const JOB_DATA = /^(jobNo|ji[A-Z]\w*|receivingDate|intakeDate|intakeWeight|wholeWeight|agCode|nrcsAgCode|harvestFarm|receivedFrom|processingFor|processedFor|toBeProcessedFor)$/i;
  function fieldKey(f) {
    const m = /_f_(.+)$/.exec(f.id || '');
    const holder = f.closest('[data-field]');
    return (m && m[1]) || (holder && holder.getAttribute('data-field')) || '';
  }
  // Editable fields in `details` that are not the picker and not job data. `needShown`: only those on screen.
  function strayFields(details, wrap, sel, needShown) {
    return [...details.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((f) => {
      if (wrap.contains(f) || f === sel || f.disabled || f.readOnly) return false;
      if (needShown && !f.getClientRects().length) return false;
      return !JOB_DATA.test(fieldKey(f));
    });
  }
  // Move the non-job fields of a Job info block, untouched, into a block of their own right after it.
  function splitStrays(details, wrap, sel) {
    if (details.getAttribute('data-jp-split')) return;
    const strays = strayFields(details, wrap, sel, false);
    if (!strays.length) return;
    const holders = [];
    for (const f of strays) {
      const h = f.closest('.fr-field, .ml-field');
      if (!h || !details.contains(h) || h.contains(sel)) return;   // cannot move cleanly: leave the block as it is
      if (holders.indexOf(h) < 0) holders.push(h);
    }
    const ml = details.classList.contains('ml-section-collapsible');
    const nd = document.createElement('details');
    nd.className = details.className;
    nd.removeAttribute('data-autofold');
    nd.open = details.open;
    const sm = document.createElement('summary');
    sm.className = ml ? 'ml-grouphead' : 'fr-section-title';
    sm.textContent = 'Entry details';
    const body = document.createElement('div');
    body.className = ml ? 'ml-grid ml-grid-2 ml-section-body' : 'fr-grid fr-grid-2';
    holders.forEach((h) => body.appendChild(h));
    nd.appendChild(sm);
    nd.appendChild(body);
    details.parentNode.insertBefore(nd, details.nextSibling);
    details.setAttribute('data-jp-split', '1');
  }

  // ---- record-open gate ---------------------------------------------------------------------
  // While no job is confirmed, every element in `root` that is not on the path to the job search is
  // hidden and inert (kept in the DOM, so rosters / calculations initialise normally once revealed).
  const gates = new Set();
  let gateTimer = null;
  function syncGateFlag() {
    // a gate whose form was re-rendered away (Save & New, shell re-parenting) is dropped and its elements handed back
    gates.forEach((g) => { if (!g.root.isConnected || !g.wrap.isConnected) { g.release(); } });
    if (document.body) document.body.classList.toggle('jp-gate-on', gates.size > 0);
    if (!gates.size && gateTimer) { clearInterval(gateTimer); gateTimer = null; }
  }

  function makeGate(wrap, root) {
    const path = [];
    for (let n = wrap; n && n !== root; n = n.parentElement) path.push(n);
    if (!path.length || !root.contains(wrap)) return null;
    const hidden = [];
    let observer = null;
    root.classList.add('jp-gate-root');
    const keep = (n) => path.indexOf(n) >= 0 || n.tagName === 'SUMMARY' || n.classList.contains('jp-gate-back');
    // Elements outside the path (e.g. the action row) can be shared with an earlier gate on the same panel:
    // ownership moves to the newest gate so the right one gives them back.
    const hide = (n) => {
      if (n.nodeType !== 1 || keep(n) || n._jpGate === gate) return;
      n.classList.add('jp-gated');
      n.setAttribute('inert', '');
      n._jpGate = gate;
      hidden.push(n);
    };
    const hideAll = () => path.forEach((n) => { if (n.parentElement) Array.prototype.forEach.call(n.parentElement.children, hide); });
    // the heading of the job section is not a toggle while the form is locked
    const sums = path.filter((n) => n.tagName === 'DETAILS').map((d) => d.querySelector(':scope > summary')).filter(Boolean);
    const noToggle = (ev) => ev.preventDefault();
    sums.forEach((sm) => sm.addEventListener('click', noToggle));
    const gate = {
      root, wrap, locked: true,
      release() {
        if (observer) observer.disconnect();
        observer = null;
        sums.forEach((sm) => sm.removeEventListener('click', noToggle));
        this.locked = false;
        gates.delete(gate);
        if (![...gates].some((g) => g.root === root)) root.classList.remove('jp-gate-root');
        const motion = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        hidden.forEach((n) => {
          if (n._jpGate !== gate) return;   // now held by a newer gate
          n._jpGate = null;
          n.classList.remove('jp-gated');
          n.removeAttribute('inert');
          if (motion && wrap.isConnected) { n.classList.add('jp-reveal'); setTimeout(() => n.classList.remove('jp-reveal'), 220); }
        });
        hidden.length = 0;
        syncGateFlag();
      }
    };
    hideAll();
    observer = new MutationObserver(hideAll);
    path.forEach((n) => { if (n.parentElement) observer.observe(n.parentElement, { childList: true }); });
    gates.add(gate);
    syncGateFlag();
    if (!gateTimer) gateTimer = setInterval(syncGateFlag, 700);
    return gate;
  }

  // Small cancel / continue dialog (same look as the job popup). Resolves true on Continue.
  function askContinue(message, okLabel) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'jp-modal';
      modal.setAttribute('role', 'alertdialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `<div class="jp-card"><div class="jp-body"><p style="margin:6px 0">${esc(message)}</p></div>
        <div class="jp-actions"><button type="button" class="jp-cancel">Cancel</button>
        <button type="button" class="jp-confirm">${esc(okLabel || 'Continue')}</button></div></div>`;
      document.body.appendChild(modal);
      const done = (ok) => { document.removeEventListener('keydown', onKey, true); modal.remove(); resolve(ok); };
      const onKey = (ev) => {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); done(false); }
        else if (ev.key === 'Tab') { ev.preventDefault(); const b = modal.querySelectorAll('button'); b[document.activeElement === b[0] ? 1 : 0].focus(); }
      };
      document.addEventListener('keydown', onKey, true);
      modal.querySelector('.jp-cancel').addEventListener('click', () => done(false));
      modal.querySelector('.jp-confirm').addEventListener('click', () => done(true));
      try { modal.querySelector('.jp-confirm').focus(); } catch (e) { }
    });
  }

  // opts: { gateRoot: Element   (new entries only; omit for no gate),
  //         recordKey: string,
  //         autofillTargets: () => Element[]   fields autofill writes for this job (overwrite warning / refill),
  //         requiredFocus: () => Element[]     fields to try first when focusing after Confirm }
  function enhance(sel, opts) {
    if (!sel || sel._jobPicker) return sel && sel._jobPicker;
    opts = opts || {};
    injectCss();
    const wrap = document.createElement('span');
    wrap.className = 'jp-wrap';
    const field = sel.closest('.fr-field, .ml-field');
    if (field) field.classList.add('jp-field');
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    wrap.insertAdjacentHTML('beforeend', `
      <span class="jp-picked" hidden><span class="jp-picked-no"></span>
        <button type="button" class="jp-change">Change</button></span>
      <span class="jp-route" role="group" aria-label="Job type" hidden>${ROUTES.map(([v, label]) =>
        `<button type="button" data-route="${v}" aria-pressed="false">${label}</button>`).join('')}</span>
      <input type="search" class="jp-search" placeholder="Search job number…" autocomplete="off" hidden>
      <div class="jp-list" role="listbox" hidden></div>`);
    const picked = wrap.querySelector('.jp-picked');
    const pickedNo = wrap.querySelector('.jp-picked-no');
    const input = wrap.querySelector('.jp-search');
    const list = wrap.querySelector('.jp-list');
    const routeBar = wrap.querySelector('.jp-route');
    const fixedRoute = sel.getAttribute('data-route') || '';
    // The Can/Dry buttons are an optional filter: with neither chosen the search covers every job, so the
    // list can open straight away.
    let route = fixedRoute || loadRoutePref();
    // jobEntry:'merged' = the job picker sits in the same section as the rest of the form (REC 7.4.6): that section never folds or splits
    const focusBlock = sel.closest('details');
    const details = sel.getAttribute('data-job-entry') === 'merged' ? null : focusBlock;
    let active = -1;
    let matches = [];

    // ---- gate (new entries on a record with a job picker only) ----
    let gate = null;
    if (opts.gateRoot && !sel.value && !sel.disabled && JOB_START_RECORDS.indexOf(opts.recordKey) < 0) {
      gate = makeGate(wrap, opts.gateRoot);
      if (gate) {
        const back = document.createElement('span');
        back.className = 'jp-gate-back';
        back.innerHTML = '<button type="button">← Back to list</button>';
        back.querySelector('button').addEventListener('click', () => {
          const shellBack = document.querySelector('.rt-back');
          if (shellBack) shellBack.click(); else history.back();
        });
        wrap.appendChild(back);
        gate.back = back;
      }
    }

    const jobs = () => [...sel.options].filter((o) => o.value)
      .map((o) => ({ no: o.value, closed: o.getAttribute('data-status') === 'closed' }));
    // Jobs with no recognised prefix are offered under both routes rather than hidden.
    const routeJobs = () => jobs().filter((j) => { const r = routeOf(j.no); return fixedRoute ? r === fixedRoute : (!route || !r || r === route); });

    function paintRoute() {
      routeBar.querySelectorAll('button').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.getAttribute('data-route') === route)));
      input.disabled = false;
      input.placeholder = route ? 'Search ' + (route === 'Can' ? 'Can' : 'Dry') + ' job number…' : 'Search job number…';
    }

    function paint() {
      const v = sel.value;
      picked.hidden = !v;
      input.hidden = !!v;
      routeBar.hidden = !!v || !!fixedRoute;
      paintRoute();
      pickedNo.textContent = v;
      wrap.querySelector('.jp-change').hidden = sel.disabled;
    }

    // First empty field after the job block: a required one if the engine names any, else any empty field.
    function focusNextField() {
      if (!focusBlock) return;
      const host = focusBlock.closest('#fr_modalSections, [id$="_modalFields"]') || opts.gateRoot || null;
      if (!host) return;
      const ok = (f) => !(f.disabled || f.readOnly || String(f.value || '').trim() !== '' || !f.getClientRects().length)
        && (details ? !details.contains(f) : true) && (focusBlock.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING || (!details && focusBlock.contains(f)));
      const first = (opts.requiredFocus ? opts.requiredFocus() : []).filter(Boolean).find(ok);
      const fields = host.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea');
      const target = first || [...fields].find(ok);
      if (!target) return;
      try { target.focus({ preventScroll: true }); } catch (e) { return; }
      try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { }
    }

    // The block may only fold away when it holds the job picker plus job data. Anything else someone still
    // has to fill in (e.g. a Date on a record whose definition groups it under Job info) is moved, as is, into
    // a section of its own just below (splitStrays), so folding never hides an input. Should a field be
    // un-movable the block stays open and the console says which record needs its grouping fixed.
    function foldSafe() {
      if (!details) return false;
      const stray = strayFields(details, wrap, sel, true);
      if (!stray.length) return true;
      try { console.warn('[job-picker] Job info section not auto-collapsed on "' + (document.title || location.pathname) + '": it also holds ' + stray.length + ' other field(s) (' + stray.slice(0, 5).map((f) => f.id || f.name || f.tagName).join(', ') + '). Move them to their own section in the record definition.'); } catch (e) { }
      return false;
    }
    if (details) splitStrays(details, wrap, sel);

    // Start a new entry on the job number: focus the search box (which opens its list). Never when a job
    // is already picked.
    function tryFocus() {
      if (sel.value || sel.disabled || !sel.isConnected) return false;
      const target = !input.hidden && !input.disabled ? input : routeBar.querySelector('button');
      if (!target) return false;
      try { target.focus({ preventScroll: true }); } catch (e) { return false; }
      return true;
    }
    function ensureVisible() {
      const r = wrap.getBoundingClientRect();
      if (r.top < 0 || r.bottom > (window.innerHeight || 0)) { try { wrap.scrollIntoView({ block: 'center' }); } catch (e) { } }
    }
    // The record shell re-parents the form a moment after it opens, which drops focus; if nothing
    // else has taken focus by then, put it back on the picker. The page is only scrolled once the
    // layout has settled, and only if the picker is off screen (e.g. after Save & New).
    function focusPicker() {
      if (!tryFocus()) return false;
      [350, 900].forEach((ms) => setTimeout(() => {
        if (!sel.value && !document.querySelector('.jp-modal') && (!document.activeElement || document.activeElement === document.body)) tryFocus();
      }, ms));
      setTimeout(() => { if (!sel.value && wrap.contains(document.activeElement)) ensureVisible(); }, 1300);
      return true;
    }

    function drawList() {
      const q = input.value.trim().toUpperCase();
      const pool = routeJobs();
      const hits = pool.filter((j) => !q || j.no.toUpperCase().includes(q)).slice(0, 60);
      matches = hits.map((j) => j.no);
      active = matches.length ? 0 : -1;
      list.innerHTML = hits.length
        ? hits.map((j, i) => `<div class="jp-opt${i === active ? ' active' : ''}" role="option" data-v="${esc(j.no)}">` +
            `<span>${esc(j.no)}</span>${j.closed ? '<span class="jp-tag">Closed</span>' : ''}</div>`).join('')
        : `<div class="jp-empty">${!jobs().length ? 'Loading jobs…' : 'No jobs found'}</div>`;
      list.hidden = false;
    }

    function setActive(i) {
      const rows = list.querySelectorAll('.jp-opt');
      if (!rows.length) return;
      active = (i + rows.length) % rows.length;
      rows.forEach((o, k) => o.classList.toggle('active', k === active));
      rows[active].scrollIntoView({ block: 'nearest' });
    }

    // Fields the autofill writes for the current job that already hold a value.
    function overwriteTargets() {
      return (opts.autofillTargets ? opts.autofillTargets() : []).filter((t) => t && String(t.value || '').trim() !== '');
    }

    async function choose(jobNo) {
      list.hidden = true;
      if (fixedRoute && routeOf(jobNo) !== fixedRoute) return;
      // Same job as the one already confirmed: nothing to confirm again.
      if (sel.value && jobNo === sel.value) { input.value = ''; paint(); return; }
      input.blur();
      const ok = await confirmJob(jobNo);
      if (!ok) {
        // Cancel: the search comes back focused with its list open. A change in progress keeps the
        // original job and the form is not re-locked.
        input.value = '';
        if (sel.value) paint();
        try { input.focus(); } catch (e) { }
        return;
      }
      // 1. set the job and run the existing autofill; changing job first clears what autofill had
      //    filled so it is replaced by the new job's values
      if (sel.value) overwriteTargets().forEach((t) => { t.value = ''; });
      if (![...sel.options].some((o) => o.value === jobNo)) {
        const o = document.createElement('option');
        o.value = jobNo; o.textContent = jobNo;
        sel.appendChild(o);
      }
      sel.value = jobNo;
      input.value = '';
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      paint();
      // 3-5. unlock, fold the Job info block, reveal the rest (the popup is already closed: step 2)
      if (gate) { if (gate.back) gate.back.remove(); gate.release(); gate = null; }
      if (details && foldSafe()) details.open = false;
      // 6. focus the first empty required field
      setTimeout(focusNextField, 50);
    }

    routeBar.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-route]');
      if (!b) return;
      const r = b.getAttribute('data-route');
      route = route === r ? '' : r;
      saveRoutePref(route);
      input.value = '';
      paintRoute();
      try { input.focus(); } catch (e) { }
      drawList();
    });
    input.addEventListener('focus', drawList);
    input.addEventListener('click', () => { if (list.hidden) drawList(); });
    input.addEventListener('input', drawList);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (list.hidden) drawList(); else setActive(active + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(active - 1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (matches[active]) choose(matches[active]); }
      else if (ev.key === 'Escape') { list.hidden = true; if (sel.value) paint(); }
    });
    // Keep focus in the search box when switching Can/Dry.
    routeBar.addEventListener('mousedown', (ev) => { if (!input.disabled) ev.preventDefault(); });
    input.addEventListener('blur', () => setTimeout(() => {
      if (document.activeElement === input || document.querySelector('.jp-modal')) return;
      list.hidden = true;
      // Leaving the search without picking keeps the previously confirmed job.
      if (sel.value && !input.value.trim()) paint();
    }, 150));
    list.addEventListener('mousedown', (ev) => {
      const opt = ev.target.closest('.jp-opt');
      if (!opt) return;
      ev.preventDefault();
      choose(opt.getAttribute('data-v'));
    });
    wrap.querySelector('.jp-change').addEventListener('click', async () => {
      if (sel.disabled) return;
      if (overwriteTargets().length &&
          !(await askContinue('Changing the job will replace auto-filled values. Continue?'))) return;
      // Changing a job starts on the current job's route.
      route = fixedRoute || routeOf(sel.value) || route;
      picked.hidden = true;
      routeBar.hidden = !!fixedRoute;
      input.hidden = false;
      input.value = '';
      paintRoute();
      try { input.focus(); } catch (e) { }
      drawList();
    });
    sel.addEventListener('change', paint);

    paint();
    syncGateFlag();
    sel._jobPicker = { refresh: paint, focus: focusPicker, drawList: () => { if (!input.hidden && document.activeElement === input) drawList(); }, gated: () => !!gate };
    return sel._jobPicker;
  }

  window.JobPicker = { enhance, confirmJob, JOB_START_RECORDS };
})();
