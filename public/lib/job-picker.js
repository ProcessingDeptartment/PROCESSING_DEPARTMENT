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
  .jp-picked-no{ font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; font-weight:700; font-size:15px; }
  .jp-change{ background:none; border:0; padding:4px 6px; color:var(--palette-link,#1f5fa8); text-decoration:underline; cursor:pointer; font-size:13px; }
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
  details.jp-compact:not([open]) > summary{ font-size:0 !important; margin-bottom:4px !important; }
  details.jp-compact:not([open]) > summary::before{ font-size:12px; }
  details.jp-compact:not([open]) > summary > *{ display:none !important; }
  details.jp-compact:not([open]) > summary > .jp-compact-label{ display:inline !important; }
  .jp-compact-label{ display:none; font-size:12px; font-weight:600; text-transform:none; letter-spacing:0;
    color:var(--palette-ink,#1b2330); font-family:'IBM Plex Mono','SF Mono',Consolas,monospace; }`;
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

  // Resolves true (Confirm) or false (Cancel / Esc / backdrop).
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
          <button type="button" class="jp-cancel">Cancel</button>
          <button type="button" class="jp-confirm" disabled>Confirm job</button>
        </div></div>`;
      document.body.appendChild(modal);
      const okBtn = modal.querySelector('.jp-confirm');
      const done = (ok) => {
        document.removeEventListener('keydown', onKey, true);
        modal.remove();
        resolve(ok);
      };
      const onKey = (ev) => {
        if (ev.key === 'Escape') { ev.preventDefault(); done(false); }
        else if (ev.key === 'Enter' && !okBtn.disabled) { ev.preventDefault(); done(true); }
      };
      document.addEventListener('keydown', onKey, true);
      modal.addEventListener('click', (ev) => { if (ev.target === modal) done(false); });
      modal.querySelector('.jp-cancel').addEventListener('click', () => done(false));
      okBtn.addEventListener('click', () => done(true));

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

  function enhance(sel) {
    if (!sel || sel._jobPicker) return sel && sel._jobPicker;
    injectCss();
    const wrap = document.createElement('span');
    wrap.className = 'jp-wrap';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    wrap.insertAdjacentHTML('beforeend', `
      <span class="jp-picked" hidden><span class="jp-picked-no"></span>
        <button type="button" class="jp-change">Change</button></span>
      <span class="jp-route" role="group" aria-label="Job type" hidden>${ROUTES.map(([v, label]) =>
        `<button type="button" data-route="${v}" aria-pressed="false">${label}</button>`).join('')}</span>
      <input type="search" class="jp-search" placeholder="Search job no…" autocomplete="off" hidden>
      <div class="jp-list" role="listbox" hidden></div>`);
    const picked = wrap.querySelector('.jp-picked');
    const pickedNo = wrap.querySelector('.jp-picked-no');
    const input = wrap.querySelector('.jp-search');
    const list = wrap.querySelector('.jp-list');
    const routeBar = wrap.querySelector('.jp-route');
    const fixedRoute = sel.getAttribute('data-route') || '';
    let route = fixedRoute || loadRoutePref();
    const details = sel.closest('details');
    const summary = details && details.querySelector(':scope > summary');
    let compactLabel = null;
    if (summary) {
      compactLabel = document.createElement('span');
      compactLabel.className = 'jp-compact-label';
      summary.appendChild(compactLabel);
    }
    let active = -1;
    let matches = [];

    const jobs = () => [...sel.options].filter((o) => o.value)
      .map((o) => ({ no: o.value, closed: o.getAttribute('data-status') === 'closed' }));
    // Jobs with no recognised prefix are offered under both routes rather than hidden.
    const routeJobs = () => jobs().filter((j) => { const r = routeOf(j.no); return fixedRoute ? r === fixedRoute : (!r || r === route); });

    function paintRoute() {
      routeBar.querySelectorAll('button').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.getAttribute('data-route') === route)));
      input.disabled = !route;
      input.placeholder = route ? 'Search ' + (route === 'Can' ? 'Can' : 'Dry') + ' job no…' : 'Select Can or Dry first';
    }

    function paint() {
      const v = sel.value;
      picked.hidden = !v;
      input.hidden = !!v;
      routeBar.hidden = !!v || !!fixedRoute;
      paintRoute();
      pickedNo.textContent = v;
      wrap.querySelector('.jp-change').hidden = sel.disabled;
      if (compactLabel) compactLabel.textContent = v ? 'Job no. ' + v : '';
      if (details) details.classList.toggle('jp-compact', !!v);
    }

    function drawList() {
      const q = input.value.trim().toUpperCase();
      if (!route) { list.hidden = true; matches = []; return; }
      const pool = routeJobs();
      const hits = pool.filter((j) => !q || j.no.toUpperCase().includes(q)).slice(0, 60);
      matches = hits.map((j) => j.no);
      active = matches.length ? 0 : -1;
      const kind = route === 'Can' ? 'Can' : 'Dry';
      list.innerHTML = hits.length
        ? hits.map((j, i) => `<div class="jp-opt${i === active ? ' active' : ''}" role="option" data-v="${esc(j.no)}">` +
            `<span>${esc(j.no)}</span>${j.closed ? '<span class="jp-tag">Closed</span>' : ''}</div>`).join('')
        : `<div class="jp-empty">${!jobs().length ? 'Loading jobs…' : pool.length ? 'No ' + kind + ' job matches' : 'No ' + kind + ' jobs found'}</div>`;
      list.hidden = false;
    }

    function setActive(i) {
      const opts = list.querySelectorAll('.jp-opt');
      if (!opts.length) return;
      active = (i + opts.length) % opts.length;
      opts.forEach((o, k) => o.classList.toggle('active', k === active));
      opts[active].scrollIntoView({ block: 'nearest' });
    }

    async function choose(jobNo) {
      list.hidden = true;
      if (fixedRoute && routeOf(jobNo) !== fixedRoute) return;
      input.blur();
      const ok = await confirmJob(jobNo);
      if (!ok) { try { input.focus(); } catch (e) { } return; }
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
      if (details) details.open = false;
    }

    routeBar.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-route]');
      if (!b) return;
      route = b.getAttribute('data-route');
      saveRoutePref(route);
      input.value = '';
      paintRoute();
      try { input.focus(); } catch (e) { }
      drawList();
    });
    input.addEventListener('focus', drawList);
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
      if (document.activeElement === input) return;
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
    wrap.querySelector('.jp-change').addEventListener('click', () => {
      if (sel.disabled) return;
      // Changing a job starts on the current job's route.
      route = fixedRoute || routeOf(sel.value) || route;
      picked.hidden = true;
      routeBar.hidden = !!fixedRoute;
      input.hidden = false;
      input.value = '';
      paintRoute();
      try { input.focus(); } catch (e) { }
    });
    sel.addEventListener('change', paint);

    paint();
    // A record reopened with a job already on it starts collapsed.
    if (details && sel.value) details.open = false;
    sel._jobPicker = { refresh: paint, drawList: () => { if (!input.hidden && document.activeElement === input) drawList(); } };
    return sel._jobPicker;
  }

  window.JobPicker = { enhance, confirmJob };
})();
