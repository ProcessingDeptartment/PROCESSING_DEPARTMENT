/*
 * Engine for Policy pages (public/policies/*.html).
 *
 * Mirrors sop-doc.js exactly, but scoped to Policies:
 *   - Permission gate: PermissionRules.can('managePolicies')
 *   - Storage key prefix: policy_doc:<recordKey>
 *   - Back link: policy-list.html
 *
 * Storage layout, keyed by recordKey:
 *   policy_doc:<recordKey>         -- { polNo, name, sections: { <sectionKey>: html, ... }, relatedDocs: [{code,name}] }
 *   document_revision:<recordKey>  -- revision history, via window.DocumentRevision
 */
(function () {
  const KEY = k => 'policy_doc:' + k;

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

  // Headings used when a page still supplies the old fixed four-section object.
  const LEGACY_HEADINGS = {
    objective: '1. Objective',
    roles: '2. Roles and Responsibilities',
    process: '3. Policy Statement',
    review: '4. Review'
  };

  // Policies do not share one layout -- each page declares its own ordered sections,
  // mirroring the headings of the source policy. `heading` may be omitted for a body
  // block that carries no heading of its own (e.g. a signature block).
  //   sections: [ { key, heading, html }, ... ]
  function normalizeSections(input) {
    if (Array.isArray(input)) {
      return input.map((s, i) => ({
        key: s.key || ('s' + (i + 1)),
        heading: s.heading == null ? '' : s.heading,
        html: s.html == null ? '' : s.html
      }));
    }
    return ['objective', 'roles', 'process', 'review']
      .filter(k => input && input[k] != null)
      .map(k => ({ key: k, heading: LEGACY_HEADINGS[k], html: input[k] }));
  }

  async function resolve(recordKey, defaults) {
    const stored = await loadOverrides(recordKey);
    const storedSections = stored.sections || {};
    const sections = normalizeSections(defaults.sections);
    sections.forEach(s => { if (storedSections[s.key] != null) s.html = storedSections[s.key]; });
    return {
      polNo: stored.polNo || defaults.polNo,
      name: stored.name || defaults.name,
      area: defaults.area || '',
      sections,
      relatedDocs: stored.relatedDocs || defaults.relatedDocs || []
    };
  }

  function canEdit() {
    return !window.PermissionRules || window.PermissionRules.can('managePolicies');
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
    .pd-section > *:last-child{ margin-bottom:0; }
    .pd-section + h2{ margin-top:22px; }
    .pd-sig{ margin-top:18px; font-size:12.5px; line-height:2.4; color:var(--label); }
    .doc-body h3{ font-size:12px; font-weight:700; color:var(--heading); margin:14px 0 6px;
                  letter-spacing:.01em; }
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
      .pd-related-docs{ page-break-before:always; }
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
    if (document.getElementById('policy-doc-styles')) return;
    const s = document.createElement('style');
    s.id = 'policy-doc-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // cfg: { recordKey, polNo, name, area, startRev, backHref, sections:[{key,heading,html}],
  //        relatedDocs:[{code,name}], baselineHistory:[{rev,reason,date}] }
  async function mount(cfg) {
    injectStyles();
    const root = document.getElementById('policy-root');
    root.innerHTML = `
      <div class="dc-top">
        <div class="dc-inner">
          <div class="doc-line"><span class="doc-code" id="pd-code"></span><span id="pd-name"></span></div>
          <div class="dc-meta">
            <div><b id="pd-rev"></b>Revision</div>
            <div><b id="pd-date"></b>Revision Date</div>
            <div><b>${esc(cfg.area)}</b>Area</div>
          </div>
          <div class="dc-actions">
            <button class="btn btn-primary" onclick="window.print()">Print</button>
            <button class="btn btn-ghost" id="pd-editBtn" style="display:none;">Edit</button>
          </div>
        </div>
      </div>
      <div class="doc-body">
        <div class="note">This page is the controlled copy of ${esc(cfg.polNo)} &mdash; there is no separate original file. Edits made here become the record, with each change logged below under Change Notification.</div>
        <div id="pd-sections"></div>
        <h2 class="pd-related-docs">Related Documents <button class="btn btn-ghost row-add" id="pd-refAdd" style="display:none;">+ Add</button></h2>
        <table class="refs"><tbody id="pd-refBody"></tbody></table>
        <h2>Change Notification</h2>
        <table class="hist">
          <thead><tr><th>Rev</th><th>Reason for Change</th><th>Changed By</th><th>Title</th><th>Date</th></tr></thead>
          <tbody id="pd-histBody"></tbody>
        </table>
        <div class="save-bar" id="pd-saveBar">
          <span class="msg" id="pd-saveBarMsg"></span>
          <div class="dc-actions" style="margin-top:0;">
            <button class="btn btn-ghost" id="pd-cancelBtn">Cancel</button>
            <button class="btn btn-primary" id="pd-saveBtn">Save &amp; Bump Revision</button>
          </div>
        </div>
        <a class="back-link" href="${esc(cfg.backHref || 'policy-list.html')}">&larr; Back to Policy List</a>
      </div>
      <div class="dh-modal" id="pd-modal">
        <div class="dh-modal-inner">
          <h3>Save changes to ${esc(cfg.polNo)}</h3>
          <p class="dh-hint">Every change to a controlled Policy needs a reason and who made it, so the Change Notification table stays a proper audit trail.</p>
          <label class="dh-f">Reason for change<input type="text" id="pd-reason" placeholder="e.g. Updated policy statement"></label>
          <label class="dh-f">Changed by<input type="text" id="pd-changedBy" placeholder="Your name"></label>
          <label class="dh-f">Title<input type="text" id="pd-changedByTitle" placeholder="e.g. QA Manager"></label>
          <div class="dh-error" id="pd-saveError">All three fields are required.</div>
          <div class="dh-actions">
            <button class="btn btn-ghost" id="pd-modalCancel">Cancel</button>
            <button class="btn btn-primary" id="pd-modalSave">Save &amp; Bump Revision</button>
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
      $('pd-code').textContent = r.polNo;
      $('pd-name').textContent = r.name;
      const host = $('pd-sections');
      host.innerHTML = '';
      r.sections.forEach(s => {
        if (s.heading) {
          const h = document.createElement('h2');
          h.textContent = s.heading;
          host.appendChild(h);
        }
        const body = document.createElement('div');
        body.className = 'pd-section';
        body.setAttribute('data-key', s.key);
        body.innerHTML = s.html || '';
        host.appendChild(body);
      });
      const refBody = $('pd-refBody');
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
      $('pd-rev').textContent = 'Rev ' + rev;
      if (dateIso) {
        const d = new Date(dateIso);
        $('pd-date').textContent = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
      } else if (cfg.baselineDate) {
        $('pd-date').textContent = cfg.baselineDate;
      }
      const hist = await window.DocumentRevision.history(cfg.recordKey);
      const tbody = $('pd-histBody');
      tbody.innerHTML = '';
      (cfg.baselineHistory || []).forEach(row => tbody.appendChild(histRow(row.rev, row.reason, '—', '—', row.date)));
      hist.slice().reverse().forEach(h => tbody.appendChild(histRow(h.revisionNumber, h.reason, h.changedBy, h.changedByTitle, fmtDate(h.changedAt))));
      $('pd-saveBarMsg').textContent = 'Editing ' + cfg.polNo + ' — saving bumps this to Rev ' + (rev + 1) + '.';
    }

    function setupProcessTableControls(editing) {
      document.querySelectorAll('#pd-sections .pd-section table').forEach(table => {
        const tbody = table.querySelector('tbody') || table;
        // strip any previously injected controls first (idempotent)
        table.querySelectorAll('.pd-row-rm-cell').forEach(td => td.remove());
        table.querySelectorAll('.pd-row-rm-head').forEach(th => th.remove());
        let next = table.nextElementSibling;
        if (next && next.classList && next.classList.contains('pd-table-addrow')) next.remove();
        if (!editing) return;

        const headRow = table.querySelector('thead tr');
        if (headRow) {
          const th = document.createElement('th');
          th.className = 'pd-row-rm-head';
          th.style.cssText = 'position:sticky;top:0;background:#f3f5f7;border:1px solid #d8dee4;width:1px;';
          headRow.appendChild(th);
        }

        function addRemoveCell(row) {
          const td = document.createElement('td');
          td.className = 'pd-row-rm-cell';
          td.style.cssText = 'border:1px solid #d8dee4;padding:4px;text-align:center;vertical-align:top;';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-ghost';
          btn.style.cssText = 'padding:2px 6px;font-size:10px;';
          btn.textContent = 'Remove';
          btn.addEventListener('click', () => row.remove());
          td.appendChild(btn);
          row.appendChild(td);
        }

        Array.from(tbody.rows).forEach(addRemoveCell);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-ghost pd-table-addrow';
        addBtn.style.cssText = 'margin-top:8px;font-size:11px;padding:4px 10px;';
        addBtn.textContent = '+ Add Row';
        addBtn.addEventListener('click', () => {
          const refRow = tbody.rows[tbody.rows.length - 1];
          const cols = refRow ? refRow.cells.length - 1 : (headRow ? headRow.cells.length - 1 : 1);
          const tr = document.createElement('tr');
          for (let i = 0; i < cols; i++) {
            const td = document.createElement('td');
            td.style.cssText = 'padding:6px 8px;border:1px solid #d8dee4;vertical-align:top';
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
          addRemoveCell(tr);
        });
        table.insertAdjacentElement('afterend', addBtn);
      });
    }

    function toggleEdit(cancel) {
      editing = !cancel && !editing;
      ['pd-code', 'pd-name'].forEach(id => {
        $(id).setAttribute('contenteditable', editing ? 'true' : 'false');
      });
      document.querySelectorAll('#pd-sections .pd-section').forEach(el =>
        el.setAttribute('contenteditable', editing ? 'true' : 'false'));
      document.querySelectorAll('#pd-refBody [data-code], #pd-refBody [data-name]').forEach(el =>
        el.setAttribute('contenteditable', editing ? 'true' : 'false'));
      setupProcessTableControls(editing);
      $('pd-saveBar').classList.toggle('open', editing);
      $('pd-editBtn').textContent = editing ? 'Editing…' : 'Edit';
      $('pd-refAdd').style.display = editing ? '' : 'none';
      document.querySelectorAll('.row-rm').forEach(el => el.style.display = editing ? '' : 'none');
      if (cancel) applyResolved(current);
    }

    $('pd-refAdd').addEventListener('click', () => $('pd-refBody').appendChild(refRow('REC X.X.X', 'New related document')));
    $('pd-editBtn').addEventListener('click', () => toggleEdit());
    $('pd-cancelBtn').addEventListener('click', () => toggleEdit(true));
    $('pd-modalCancel').addEventListener('click', () => $('pd-modal').classList.remove('open'));
    $('pd-saveBtn').addEventListener('click', () => $('pd-modal').classList.add('open'));

    $('pd-modalSave').addEventListener('click', async () => {
      const reason = $('pd-reason'), changedBy = $('pd-changedBy'), title = $('pd-changedByTitle');
      const err = $('pd-saveError');
      [reason, changedBy, title].forEach(el => el.classList.remove('err'));
      let ok = true;
      [reason, changedBy, title].forEach(el => { if (!el.value.trim()) { el.classList.add('err'); ok = false; } });
      err.style.display = ok ? 'none' : 'block';
      if (!ok) return;

      const relatedDocs = Array.from(document.querySelectorAll('#pd-refBody tr')).filter(tr => tr.querySelector('[data-code]')).map(tr => ({
        code: tr.querySelector('[data-code]').textContent.trim(),
        name: tr.querySelector('[data-name]').textContent.trim()
      }));
      setupProcessTableControls(false);
      const sectionsFromDom = () => {
        const out = {};
        document.querySelectorAll('#pd-sections .pd-section').forEach(el => {
          out[el.getAttribute('data-key')] = el.innerHTML;
        });
        return out;
      };
      await saveOverrides(cfg.recordKey, {
        polNo: $('pd-code').textContent.trim(),
        name: $('pd-name').textContent.trim(),
        sections: sectionsFromDom(),
        relatedDocs
      });
      await window.DocumentRevision.bump(cfg.recordKey, {
        reason: reason.value.trim(), changedBy: changedBy.value.trim(), changedByTitle: title.value.trim()
      }, startRev);

      reason.value = ''; changedBy.value = ''; title.value = '';
      $('pd-modal').classList.remove('open');
      current = await resolve(cfg.recordKey, cfg);
      toggleEdit(true);
      await refreshHeader();
    });

    if (window.DocHeader) {
      try {
        await window.DocHeader.mountPrintHeader({
          recordKey: cfg.recordKey,
          defaults: { document: cfg.name, docNumber: cfg.polNo },
          revisionStart: cfg.startRev || 1
        });
      } catch (e) { console.error('Policy title block unavailable', e); }
    }

    current = await resolve(cfg.recordKey, cfg);
    applyResolved(current);
    await refreshHeader();
    $('pd-editBtn').style.display = canEdit() ? '' : 'none';
  }

  window.PolicyDoc = { resolve, saveOverrides, loadOverrides, canEdit, esc, mount, normalizeSections };
})();
