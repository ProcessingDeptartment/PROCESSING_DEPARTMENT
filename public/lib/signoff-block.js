/*
 * Shared sign-off / verification UI for bespoke (non-FormRecord/monitoring-log) record
 * pages. Those pages have their own custom state/save/print logic, so this module does
 * NOT own the record's data -- it only renders the standard "Completed by / Title /
 * Date" + "Verified by / Title / Date" markup and, for the interactive Verification
 * panel, owns its own storage (verification_log:<recordKey>, same shape and same
 * localStorage key convention as form-record.js / monitoring-log.js) so bespoke pages
 * stop hand-rolling that panel.
 *
 * Usage:
 *   SignOffBlock.completedByHtml({ byId, titleId, dateId, byLabel })
 *     -> markup for the on-screen "Completed by / Title / Date" row (grid-3).
 *      Caller keeps wiring byId/dateId into its own state exactly as before; it only
 *      needs to also read/write titleId alongside them.
 *
 *   SignOffBlock.printRow({ label, by, title, date })
 *     -> one <tr> of a print-sheet sign-off table, consistent label set for both the
 *        Completed-by and Verified-by rows. `by`/`title`/`date` are already-escaped or
 *        plain strings (this module HTML-escapes them).
 *
 *   SignOffBlock.mountVerification({
 *     recordKey,            // storage key suffix, same value the page's own record uses
 *     mount,                // selector or element for the whole Verification panel
 *     getPending,           // () => [{id, label}] entries awaiting verification right now
 *     onLogged              // (record, pickedIds) => void, called after a verification is saved
 *   })
 *     -> renders the full interactive panel (entries-to-verify list, Verified by/Title/
 *        Date inputs, Log verification button, verification history) and returns
 *        { refresh() } so the caller can re-render the pending list after its own state
 *        changes (e.g. a new entry gets submitted).
 */
(function () {
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function completedByHtml(opts) {
    const byId = opts.byId, titleId = opts.titleId, dateId = opts.dateId;
    const byLabel = opts.byLabel || 'Completed by';
    return `<div class="grid grid-3">
      <label class="field">${esc(byLabel)}<input id="${byId}"></label>
      <label class="field">Title<input id="${titleId}"></label>
      <label class="field">Date<input id="${dateId}" type="date"></label>
    </div>`;
  }

  function printRow(opts) {
    return `<tr style="font-size:14px;"><td class="sheet-lbl">${esc(opts.label)}:</td><td>${esc(opts.by || '')}</td>
      <td class="sheet-lbl">Title:</td><td>${esc(opts.title || '')}</td>
      <td class="sheet-lbl">Date:</td><td>${esc(opts.date || '')}</td></tr>`;
  }

  async function storeGet(key, shared) {
    try { const r = await window.storage.get(key, shared); return r ? r.value : null; } catch (e) { return null; }
  }
  async function storeSet(key, value, shared) {
    try { await window.storage.set(key, value, shared); return true; } catch (e) { console.error('storage set failed', e); return false; }
  }

  function mountVerification(opts) {
    const recordKey = opts.recordKey;
    const mountEl = typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount;
    const storageKey = 'verification_log:' + recordKey;
    const uid = 'sob_' + Math.random().toString(36).slice(2, 8);

    mountEl.innerHTML = `
      <div class="panel-head"><h2>Verification</h2></div>
      <div class="panel-body">
        <div class="muted" style="margin-bottom:6px; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em;">Entries to verify</div>
        <div id="${uid}_select" style="margin-bottom:10px;"></div>
        <div class="grid grid-3" style="margin-bottom:8px;">
          <label class="field">Verified by<input id="${uid}_by"></label>
          <label class="field">Title<input id="${uid}_title"></label>
          <label class="field">Date<input id="${uid}_date" type="date"></label>
        </div>
        <div class="actions no-print" style="justify-content:flex-start; margin-top:0;">
          <button class="btn btn-primary" id="${uid}_log">Log verification</button>
        </div>
        <div class="muted" style="margin:10px 0 4px; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em;">Verification history</div>
        <div id="${uid}_history"></div>
      </div>`;

    function renderSelect() {
      const target = el(uid + '_select');
      const pending = opts.getPending() || [];
      if (!pending.length) {
        target.innerHTML = `<div class="muted" style="font-size:11px;">No submitted entries are waiting to be verified.</div>`;
        return;
      }
      target.innerHTML = `<div style="margin-bottom:4px;"><label style="font-weight:700; font-size:11.5px;">
          <input type="checkbox" id="${uid}_all"> Select all (${pending.length})</label></div>` +
        pending.map(p => `<div style="font-size:11.5px; margin-bottom:2px;"><label>
          <input type="checkbox" class="${uid}_pick" value="${esc(p.id)}"> ${esc(p.label)}</label></div>`).join('');
      el(uid + '_all').addEventListener('change', ev => {
        target.querySelectorAll('.' + uid + '_pick').forEach(cb => { cb.checked = ev.target.checked; });
      });
    }

    async function renderHistory() {
      const raw = await storeGet(storageKey, true);
      let hist = [];
      try { hist = raw ? JSON.parse(raw) : []; } catch (e) { hist = []; }
      const target = el(uid + '_history');
      if (!hist.length) { target.innerHTML = `<div class="muted" style="font-size:11px;">No verification logged yet.</div>`; return; }
      target.innerHTML = hist.slice().reverse().map(v => `
        <div style="font-size:11.5px; padding:4px 0; border-bottom:1px solid #e2e4e3;">
          ${esc(v.verifiedDate || '(no date)')} · ${esc(v.verifiedBy)}
          <span class="muted">(title: ${esc(v.verifiedSig)}${v.entryIds && v.entryIds.length ? ` · ${v.entryIds.length} ${v.entryIds.length === 1 ? 'entry' : 'entries'}` : ''})</span>
        </div>`).join('');
    }

    function toast(msg) {
      if (window.toast) { window.toast(msg); return; }
      const t = document.getElementById('toast');
      if (!t) { console.log(msg); return; }
      t.textContent = msg; t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2200);
    }

    el(uid + '_log').addEventListener('click', async () => {
      const verifiedBy = el(uid + '_by').value.trim();
      const verifiedSig = el(uid + '_title').value.trim();
      const verifiedDate = el(uid + '_date').value;
      if (!verifiedBy || !verifiedSig || !verifiedDate) { toast('Verified by, title and date are all required.'); return; }

      const pending = opts.getPending() || [];
      const picked = [...document.querySelectorAll('.' + uid + '_pick:checked')].map(cb => cb.value);
      if (pending.length && !picked.length) { toast('Tick at least one entry to verify.'); return; }

      const record = { verifiedBy, verifiedSig, verifiedDate, loggedAt: Date.now() };
      const raw = await storeGet(storageKey, true);
      let hist = [];
      try { hist = raw ? JSON.parse(raw) : []; } catch (e) { hist = []; }
      hist.push(Object.assign({ entryIds: picked }, record));
      await storeSet(storageKey, JSON.stringify(hist), true);

      if (opts.onLogged) opts.onLogged(record, picked);

      toast(picked.length ? `Verification logged for ${picked.length} ${picked.length === 1 ? 'entry' : 'entries'}.` : 'Verification logged.');
      el(uid + '_by').value = ''; el(uid + '_title').value = ''; el(uid + '_date').value = '';
      renderSelect();
      renderHistory();
    });

    renderSelect();
    renderHistory();
    return { refresh() { renderSelect(); renderHistory(); } };
  }

  window.SignOffBlock = { completedByHtml, printRow, mountVerification };
})();
