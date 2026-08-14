/*
 * Engine for PRP pages (public/prps/*.html).
 *
 * Mirrors sop-doc.js exactly, but scoped to Pre-Requisite Programmes (PRPs):
 *   - Permission gate: PermissionRules.can('managePRPs')
 *   - Storage key prefix: prp_doc:<recordKey>
 *   - Back link: prp-list.html
 *
 * Storage layout, keyed by recordKey:
 *   prp_doc:<recordKey>            -- { prpNo, name, sections: { objective, roles, process, review }, relatedDocs: [{code,name}] }
 *   document_revision:<recordKey>  -- revision history, via window.DocumentRevision
 */
(function () {
  const KEY = k => 'prp_doc:' + k;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function loadOverrides(recordKey) {
    try {
      const raw = await window.storage.get(KEY(recordKey), true);
      return raw ? JSON.parse(raw.value) : {};
    } catch (e) { return {}; }
  }

  async function saveOverrides(recordKey, obj) {
    await window.storage.set(KEY(recordKey), JSON.stringify(obj), true);
  }

  async function resolve(recordKey, defaults) {
    const stored = await loadOverrides(recordKey);
    return {
      prpNo: stored.prpNo || defaults.prpNo,
      name: stored.name || defaults.name,
      area: defaults.area || '',
      sections: Object.assign({}, defaults.sections, stored.sections),
      relatedDocs: stored.relatedDocs || defaults.relatedDocs || []
    };
  }

  function canEdit() {
    return !window.PermissionRules || window.PermissionRules.can('managePRPs');
  }

  function fmtDate(ms) {
    const d = new Date(ms);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  const STYLES = `
    :root{
      --ink: var(--palette-ink, #1b2330); --paper: var(--palette-paper, #f4f5f3);
      --border: var(--palette-border, #e2e4e3); --label: var(--palette-label, #5c6771);
      --dark: var(--palette-dark, #1d2b38); --dark-text: var(--palette-dark-text, #f4f1e8);
      --dark-muted: var(--palette-dark-muted, #b9c3cc);
      --primary: var(--palette-primary, #a9763a); --primary-hover: var(--palette-primary-hover, #96682f);
      --heading: var(--palette-heading, #1d2b38); --head-bg: var(--palette-head-bg, #f7f4ee);
    }
    @media (prefers-color-scheme: dark){
      :root:not([data-palette]){
        --ink:#e5e7eb; --paper:#14181d; --border:#2a2f36; --label:#9aa4ad;
        --dark:#0f151b; --dark-text:#f4f1e8; --dark-muted:#8a95a1;
        --primary:#c9832b; --primary-hover:#d99640; --heading:#e8c99a; --head-bg:#1c232b;
      }
    }
    body{ font-family:'Segoe UI',system-ui,sans-serif; color:var(--ink); background:var(--paper);
          font-size:13px; line-height:1.5; margin:0; }
    .dc-top{ background:var(--dark); color:var(--dark-text); padding:14px 18px; }
    .dc-inner{ max-width:900px; margin:0 auto; }
    .doc-line{ display:flex; align-items:center; gap:10px; font-size:15px; font-weight:600; }
    .doc-code{ background:rgba(255,255,255,.12); padding:2px 8px; border-radius:3px; font-family:'IBM Plex Mono',monospace; font-size:13px; }
    .dc-meta{ display:flex; gap:22px; flex-wrap:wrap; margin-top:10px; font-size:11px; color:var(--dark-muted); }
    .dc-meta b{ color:var(--dark-text); font-weight:600; display:block; font-size:11.5px; font-family:'IBM Plex Mono',monospace; }
    .dc-actions{ margin-top:10px; display:flex; gap:8px; align-items:center; }
    .btn{ padding:5px 11px; font-size:11.5px; border:none; border-radius:3px; cursor:pointer; font-weight:600; font-family:inherit; }
    .btn-primary{ background:var(--primary); color:#fff; }
    .btn-primary:hover{ background:var(--primary-hover); }
    .btn-ghost{ background:rgba(255,255,255,.14); color:var(--dark-text); }
    .btn-ghost:hover{ background:rgba(255,255,255,.24); }
    .doc-body{ max-width:900px; margin:0 auto; padding:20px; background:var(--paper); }
    .doc-body h2{ font-size:12.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--heading);
                  border-bottom:2px solid var(--border); padding-bottom:6px; margin:22px 0 10px;
                  display:flex; align-items:center; gap:8px; justify-content:space-between; }
    .doc-body h2:first-child{ margin-top:0; }
    .doc-body p{ margin:0 0 10px; }
    .doc-body ol, .doc-body ul{ margin:0 0 10px; padding-left:22px; }
    .doc-body li{ margin-bottom:6px; }
    .doc-body table.refs, .doc-body table.hist{ border-collapse:collapse; font-size:12px; width:100%; }
    .doc-body table.hist th, .doc-body table.hist td{ border-bottom:1px solid var(--border); padding:6px 10px; text-align:left; }
    .doc-body table.hist th{ color:var(--label); font-size:10.5px; text-transform:uppercase; letter-spacing:.03em; }
    .doc-body table.refs td{ padding:4px 10px 4px 0; color:var(--label); }
    .doc-body table.refs td.rcode{ font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--heading); }
    .row-add{ font-size:10px; padding:2px 8px; }
    .row-rm{ display:none; }
    .back-link{ display:inline-block; margin:16px 0 0; color:var(--heading); text-decoration:none; font-size:12.5px; font-weight:600; }
    .back-link:hover{ text-decoration:underline; }
    .note{ background:var(--head-bg); border-left:3px solid var(--primary); padding:10px 14px;
           border-radius:3px; margin-bottom:14px; font-size:11.5px; color:var(--label); }
    .no-refs{ color:var(--label); font-style:italic; }
    [contenteditable="true"]{ outline:2px dashed rgba(169,118,58,.5); outline-offset:3px; border-radius:3px;
          background: rgba(169,118,58,.05); cursor:text; }
    .save-bar{ position:sticky; bottom:0; margin-top:20px; background:var(--dark); color:var(--dark-text);
          padding:10px 18px; border-radius:8px; display:none; align-items:center; justify-content:space-between;
          gap:14px; flex-wrap:wrap; box-shadow:0 4px 16px rgba(0,0,0,.25); }
    .save-bar.open{ display:flex; }
    .save-bar .msg{ font-size:11.5px; color:var(--dark-muted); }
    .dh-modal{ position:fixed; inset:0; background:rgba(20,25,30,.5); z-index:600;
               align-items:center; justify-content:center; display:none; }
    .dh-modal.open{ display:flex; }
    .dh-modal-inner{ background:var(--paper); border-radius:8px; width:min(460px,92vw);
               padding:18px; box-shadow:0 8px 30px rgba(0,0,0,.3); }
    .dh-modal-inner h3{ font-size:13px; text-transform:uppercase; letter-spacing:.05em;
               color:var(--heading); margin:0 0 6px; }
    .dh-hint{ font-size:11.5px; color:var(--label); margin:0 0 14px; }
    .dh-f{ display:flex; flex-direction:column; gap:3px; font-size:11px; font-weight:700;
               text-transform:uppercase; letter-spacing:.04em; color:var(--label); margin-bottom:10px; }
    .dh-f input{ padding:7px 9px; border:1px solid var(--border); border-radius:4px; font-size:13px;
               font-family:inherit; background:var(--paper); color:var(--ink); font-weight:400;
               text-transform:none; letter-spacing:0; width:100%; }
    .dh-f input.err{ border-color:#c0392b; }
    .dh-actions{ display:flex; gap:10px; justify-content:flex-end; }
    .dh-error{ font-size:11px; color:#c0392b; margin:-6px 0 10px; display:none; }
    @media print{
      .dc-actions, .save-bar, .back-link, .row-add, .row-rm{ display:none !important; }
      [contenteditable]{ outline:none; background:none; }
      .prp-related-docs{ page-break-before:always; }
    }
    @media (max-width: 768px){
      .dc-top{ padding:10px 12px; }
      .doc-line{ gap:8px; font-size:14px; }
      .doc-code{ font-size:11.5px; }
      .dc-meta{ gap:14px; font-size:10.5px; margin-top:8px; }
      .dc-actions{ margin-top:8px; }
      .doc-body{ padding:12px; }
      .doc-body table.refs, .doc-body table.hist{ display:block; overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .save-bar{ flex-direction:column; align-items:stretch; }
      .save-bar .msg{ order:2; }
    }
    @media (max-width: 480px){
      .doc-line{ font-size:13px; }
      .dc-meta{ flex-direction:column; gap:6px; }
      .doc-body{ padding:10px; }
      .dh-modal-inner{ width:min(340px,92vw); padding:14px; }
    }
  `;

  function injectStyles() {
    if (document.getElementById('prp-doc-styles')) return;
    const s = document.createElement('style');
    s.id = 'prp-doc-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // cfg: { recordKey, prpNo, name, area, startRev, backHref, sections:{objective,roles,process,review},
  //        relatedDocs:[{code,name}], baselineHistory:[{rev,reason,date}] }
  async function mount(cfg) {
    injectStyles();
    const root = document.getElementById('prp-root');
    root.innerHTML = `
      <div class="dc-top">
        <div class="dc-inner">
          <div class="doc-line"><span class="doc-code" id="rp-code"></span><span id="rp-name"></span></div>
          <div class="dc-meta">
            <div><b id="rp-rev"></b>Revision</div>
            <div><b id="rp-date"></b>Revision Date</div>
            <div><b>${esc(cfg.area)}</b>Area</div>
          </div>
          <div class="dc-actions">
            <button class="btn btn-primary" onclick="window.print()">Print</button>
            <button class="btn btn-ghost" id="rp-editBtn" style="display:none;">Edit</button>
          </div>
        </div>
      </div>
      <div class="doc-body">
        <div class="note">This page is the controlled copy of ${esc(cfg.prpNo)} &mdash; there is no separate original file. Edits made here become the record, with each change logged below under Change Notification.</div>
        <h2>1. Objective</h2>
        <p id="rp-objective"></p>
        <h2>2. Roles and Responsibilities</h2>
        <div id="rp-roles"></div>
        <h2>3. Programme Requirements</h2>
        <div id="rp-process"></div>
        <h2>4. Review</h2>
        <p id="rp-review"></p>
        <h2 class="prp-related-docs">Related Documents <button class="btn btn-ghost row-add" id="rp-refAdd" style="display:none;">+ Add</button></h2>
        <table class="refs"><tbody id="rp-refBody"></tbody></table>
        <h2>Change Notification</h2>
        <table class="hist">
          <thead><tr><th>Rev</th><th>Reason for Change</th><th>Changed By</th><th>Title</th><th>Date</th></tr></thead>
          <tbody id="rp-histBody"></tbody>
        </table>
        <div class="save-bar" id="rp-saveBar">
          <span class="msg" id="rp-saveBarMsg"></span>
          <div class="dc-actions" style="margin-top:0;">
            <button class="btn btn-ghost" id="rp-cancelBtn">Cancel</button>
            <button class="btn btn-primary" id="rp-saveBtn">Save &amp; Bump Revision</button>
          </div>
        </div>
        <a class="back-link" href="${esc(cfg.backHref || 'prp-list.html')}">&larr; Back to PRP List</a>
      </div>
      <div class="dh-modal" id="rp-modal">
        <div class="dh-modal-inner">
          <h3>Save changes to ${esc(cfg.prpNo)}</h3>
          <p class="dh-hint">Every change to a controlled PRP needs a reason and who made it, so the Change Notification table stays a proper audit trail.</p>
          <label class="dh-f">Reason for change<input type="text" id="rp-reason" placeholder="e.g. Updated programme requirement"></label>
          <label class="dh-f">Changed by<input type="text" id="rp-changedBy" placeholder="Your name"></label>
          <label class="dh-f">Title<input type="text" id="rp-changedByTitle" placeholder="e.g. QA Manager"></label>
          <div class="dh-error" id="rp-saveError">All three fields are required.</div>
          <div class="dh-actions">
            <button class="btn btn-ghost" id="rp-modalCancel">Cancel</button>
            <button class="btn btn-primary" id="rp-modalSave">Save &amp; Bump Revision</button>
          </div>
        </div>
      </div>
    `;

    const $ = id => document.getElementById(id);
    const startRev = cfg.startRev || 1;
    let editing = false;
    let current = null;

    function refRow(code, name) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="rcode" data-code="true">${esc(code)}</td>`
        + `<td data-name="true">${esc(name)}</td>`
        + `<td class="row-rm"><button class="btn btn-ghost" style="padding:2px 8px; font-size:10px;" onclick="this.closest('tr').remove()">Remove</button></td>`;
      return tr;
    }

    function applyResolved(r) {
      $('rp-code').textContent = r.prpNo;
      $('rp-name').textContent = r.name;
      $('rp-objective').innerHTML = r.sections.objective || '';
      $('rp-roles').innerHTML = r.sections.roles || '';
      $('rp-process').innerHTML = r.sections.process || '';
      $('rp-review').innerHTML = r.sections.review || '';
      const refBody = $('rp-refBody');
      refBody.innerHTML = '';
      if (r.relatedDocs.length) {
        r.relatedDocs.forEach(doc => refBody.appendChild(refRow(doc.code, doc.name)));
      } else {
        refBody.innerHTML = '<tr><td class="no-refs">No related documents listed.</td></tr>';
      }
    }

    function histRow(rev, reason, by, title, date) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(rev)}</td><td>${esc(reason)}</td><td>${esc(by)}</td><td>${esc(title)}</td><td>${esc(date)}</td>`;
      return tr;
    }

    async function refreshHeader() {
      const rev = await window.DocumentRevision.getCurrent(cfg.recordKey, startRev);
      const dateIso = await window.DocumentRevision.getCurrentDate(cfg.recordKey, null);
      $('rp-rev').textContent = 'Rev ' + rev;
      if (dateIso) {
        const d = new Date(dateIso);
        $('rp-date').textContent = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
      } else if (cfg.baselineDate) {
        $('rp-date').textContent = cfg.baselineDate;
      }
      const hist = await window.DocumentRevision.history(cfg.recordKey);
      const tbody = $('rp-histBody');
      tbody.innerHTML = '';
      (cfg.baselineHistory || []).forEach(row => tbody.appendChild(histRow(row.rev, row.reason, '—', '—', row.date)));
      hist.slice().reverse().forEach(h => tbody.appendChild(histRow(h.revisionNumber, h.reason, h.changedBy, h.changedByTitle, fmtDate(h.changedAt))));
      $('rp-saveBarMsg').textContent = 'Editing ' + cfg.prpNo + ' — saving bumps this to Rev ' + (rev + 1) + '.';
    }

    function toggleEdit(cancel) {
      editing = !cancel && !editing;
      ['rp-objective', 'rp-roles', 'rp-process', 'rp-review', 'rp-code', 'rp-name'].forEach(id => {
        $(id).setAttribute('contenteditable', editing ? 'true' : 'false');
      });
      document.querySelectorAll('#rp-refBody [data-code], #rp-refBody [data-name]').forEach(el =>
        el.setAttribute('contenteditable', editing ? 'true' : 'false'));
      $('rp-saveBar').classList.toggle('open', editing);
      $('rp-editBtn').textContent = editing ? 'Editing…' : 'Edit';
      $('rp-refAdd').style.display = editing ? '' : 'none';
      document.querySelectorAll('.row-rm').forEach(el => el.style.display = editing ? '' : 'none');
      if (cancel) applyResolved(current);
    }

    $('rp-refAdd').addEventListener('click', () => $('rp-refBody').appendChild(refRow('REC X.X.X', 'New related document')));
    $('rp-editBtn').addEventListener('click', () => toggleEdit());
    $('rp-cancelBtn').addEventListener('click', () => toggleEdit(true));
    $('rp-modalCancel').addEventListener('click', () => $('rp-modal').classList.remove('open'));
    $('rp-saveBtn').addEventListener('click', () => $('rp-modal').classList.add('open'));

    $('rp-modalSave').addEventListener('click', async () => {
      const reason = $('rp-reason'), changedBy = $('rp-changedBy'), title = $('rp-changedByTitle');
      const err = $('rp-saveError');
      [reason, changedBy, title].forEach(el => el.classList.remove('err'));
      let ok = true;
      [reason, changedBy, title].forEach(el => { if (!el.value.trim()) { el.classList.add('err'); ok = false; } });
      err.style.display = ok ? 'none' : 'block';
      if (!ok) return;

      const relatedDocs = Array.from(document.querySelectorAll('#rp-refBody tr')).filter(tr => tr.querySelector('[data-code]')).map(tr => ({
        code: tr.querySelector('[data-code]').textContent.trim(),
        name: tr.querySelector('[data-name]').textContent.trim()
      }));
      await saveOverrides(cfg.recordKey, {
        prpNo: $('rp-code').textContent.trim(),
        name: $('rp-name').textContent.trim(),
        sections: {
          objective: $('rp-objective').innerHTML,
          roles: $('rp-roles').innerHTML,
          process: $('rp-process').innerHTML,
          review: $('rp-review').innerHTML
        },
        relatedDocs
      });
      await window.DocumentRevision.bump(cfg.recordKey, {
        reason: reason.value.trim(), changedBy: changedBy.value.trim(), changedByTitle: title.value.trim()
      }, startRev);

      reason.value = ''; changedBy.value = ''; title.value = '';
      $('rp-modal').classList.remove('open');
      current = await resolve(cfg.recordKey, cfg);
      toggleEdit(true);
      await refreshHeader();
    });

    if (window.DocHeader) {
      try {
        await window.DocHeader.mountPrintHeader({
          recordKey: cfg.recordKey,
          defaults: { document: cfg.name, docNumber: cfg.prpNo },
          revisionStart: cfg.startRev || 1
        });
      } catch (e) { console.error('PRP title block unavailable', e); }
    }

    current = await resolve(cfg.recordKey, cfg);
    applyResolved(current);
    await refreshHeader();
    $('rp-editBtn').style.display = canEdit() ? '' : 'none';
  }

  window.PrpDoc = { resolve, saveOverrides, loadOverrides, canEdit, esc, mount };
})();
