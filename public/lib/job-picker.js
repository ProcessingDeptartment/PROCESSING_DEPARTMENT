// Job picker: replaces every job-number <select data-jobsearch> on a record form with a
// search -> pick -> confirm flow. Typing narrows the open-job list; picking a job opens a
// popup with that job's receiving details (REC 7.1.2) so the operator can check it is the
// right job; only on Confirm is the value written to the (hidden) select and change fired,
// which is what triggers the engines' autofill. After confirming, the enclosing Job info
// section collapses to a single small "Job no. XXX" line.
//
// The <select> stays in the DOM as the value holder, so saving, autofill, summaries and
// route checks keep working unchanged. Loaded on demand by form-record.js / monitoring-log.js.
(function () {
  if (window.JobPicker) return;

  const RECEIVING_KEY = 'abalone-receiving';

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
          ['Intake weight (kg)', intakeOf(r)],
          ['Size ranges', Array.isArray(sizes) && sizes.length ? sizes.join(', ') : ''],
          ['Job status', status && status.status === 'closed' ? 'Closed' : 'Open']
        ];
        let warn = '';
        if (!rec) warn = 'No Abalone Receiving record (REC 7.1.2) was found for this job. Check the job number before confirming.';
        else if (r.__status && r.__status !== 'submitted') warn = 'The Abalone Receiving record (REC 7.1.2) for this job is still a draft — its details are provisional.';
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
      <input type="search" class="jp-search" placeholder="Search job no…" autocomplete="off" hidden>
      <div class="jp-list" role="listbox" hidden></div>`);
    const picked = wrap.querySelector('.jp-picked');
    const pickedNo = wrap.querySelector('.jp-picked-no');
    const input = wrap.querySelector('.jp-search');
    const list = wrap.querySelector('.jp-list');
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

    const jobs = () => [...sel.options].map((o) => o.value).filter(Boolean);

    function paint() {
      const v = sel.value;
      picked.hidden = !v;
      input.hidden = !!v;
      pickedNo.textContent = v;
      wrap.querySelector('.jp-change').hidden = sel.disabled;
      if (compactLabel) compactLabel.textContent = v ? 'Job no. ' + v : '';
      if (details) details.classList.toggle('jp-compact', !!v);
    }

    function drawList() {
      const q = input.value.trim().toUpperCase();
      matches = jobs().filter((j) => !q || j.toUpperCase().includes(q)).slice(0, 60);
      active = matches.length ? 0 : -1;
      list.innerHTML = matches.length
        ? matches.map((j, i) => `<div class="jp-opt${i === active ? ' active' : ''}" role="option" data-v="${esc(j)}">${esc(j)}</div>`).join('')
        : `<div class="jp-empty">${jobs().length ? 'No open job matches' : 'Loading jobs…'}</div>`;
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

    input.addEventListener('focus', drawList);
    input.addEventListener('input', drawList);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (list.hidden) drawList(); else setActive(active + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(active - 1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (matches[active]) choose(matches[active]); }
      else if (ev.key === 'Escape') { list.hidden = true; if (sel.value) paint(); }
    });
    input.addEventListener('blur', () => setTimeout(() => {
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
      picked.hidden = true;
      input.hidden = false;
      input.value = '';
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
