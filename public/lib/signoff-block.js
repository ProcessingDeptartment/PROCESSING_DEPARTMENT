/*
 * Single source of truth for sign-off / verification UI and logic, used by bespoke record
 * pages directly (mountVerification) and by form-record.js / monitoring-log.js (which own
 * their own panel chrome -- notice banners, section headings -- but call the exported
 * field/logic helpers below instead of hand-rolling the Verified by/Title/Date/Signature
 * inputs, storage, validation and history formatting). Storage convention is
 * verification_log:<recordKey>, same shared-storage key across all three callers.
 *
 * Usage:
 *   SignOffBlock.completedByHtml({ byId, titleId, dateId, signatureId, byLabel })
 *     -> markup for the on-screen "Completed by / Title / Date / Signature" row (grid-4).
 *      Caller keeps wiring byId/dateId into its own state exactly as before; it only
 *      needs to also read/write titleId/signatureId alongside them.
 *
 *   SignOffBlock.printRow({ label, by, title, date, signature })
 *     -> one <tr> of a print-sheet sign-off table, consistent label set for both the
 *        Completed-by and Verified-by rows. Values are already-escaped or plain strings
 *        (this module HTML-escapes them).
 *
 *   SignOffBlock.mountVerification({
 *     recordKey,            // storage key suffix, same value the page's own record uses
 *     mount,                // selector or element for the whole Verification panel
 *     getPending,           // () => [{id, label}] entries awaiting verification right now
 *     onLogged              // (record, pickedIds) => void, called after a verification is saved
 *   })
 *     -> renders the full interactive panel (entries-to-verify list, Verified by/Title/
 *        Date/Signature inputs, Log verification button, verification history) and
 *        returns { refresh() } so the caller can re-render the pending list after its own
 *        state changes (e.g. a new entry gets submitted).
 *
 *   Lower-level helpers for callers that own their own panel markup (form-record.js,
 *   monitoring-log.js):
 *     verifyIds(idPrefix)              -> { by, title, date, signature } element ids
 *     verifyFieldsHtml({ idPrefix, gridClass, fieldClass })
 *                                       -> the 4 label/input elements only, no panel chrome
 *     readVerifyInputs(idPrefix)       -> { verifiedBy, verifiedSig, verifiedDate, verifiedSignature }
 *     validateVerifyInputs(values)     -> bool, all 4 fields required
 *     clearVerifyInputs(idPrefix)
 *     historyLine(v)                  -> formatted inner-HTML string for one history entry
 *     logVerification({ recordKey, values, picked }) -> appends to storage, returns the record
 *     getVerificationHistory(recordKey) -> stored history array
 */
(function () {
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function completedByHtml(opts) {
    const byId = opts.byId, titleId = opts.titleId, dateId = opts.dateId, signatureId = opts.signatureId;
    const byLabel = opts.byLabel || 'Completed by';
    return `<div class="grid grid-4">
      <label class="field">${esc(byLabel)}<input id="${byId}"></label>
      <label class="field">Title<input id="${titleId}"></label>
      <label class="field">Date<input id="${dateId}" type="date"></label>
      <label class="field">Signature<input id="${signatureId}"></label>
    </div>`;
  }

  function printRow(opts) {
    return `<tr style="font-size:14px;"><td class="sheet-lbl">${esc(opts.label)}:</td><td>${esc(opts.by || '')}</td>
      <td class="sheet-lbl">Title:</td><td>${esc(opts.title || '')}</td>
      <td class="sheet-lbl">Date:</td><td>${esc(opts.date || '')}</td>
      <td class="sheet-lbl">Signature:</td><td>${esc(opts.signature || '')}</td></tr>`;
  }

  // Shared verification field ids for a given idPrefix, so markup and logic never drift apart.
  function verifyIds(idPrefix) {
    return { by: idPrefix + '_by', title: idPrefix + '_title', date: idPrefix + '_date', signature: idPrefix + '_signature' };
  }

  // Renders the Verified by / Title / Date / Signature inputs so callers (bespoke pages via
  // mountVerification, or FormRecord/monitoring-log which own their surrounding panel markup)
  // share one field set. `gridClass`/`fieldClass` let each page family keep its own CSS look.
  function verifyFieldsHtml(opts) {
    const ids = verifyIds(opts.idPrefix);
    const gridClass = opts.gridClass || 'grid grid-4';
    const fieldClass = opts.fieldClass || 'field';
    return `<div class="${gridClass}" style="margin-bottom:8px;">
      <label class="${fieldClass}">Verified by<input id="${ids.by}"></label>
      <label class="${fieldClass}">Title<input id="${ids.title}"></label>
      <label class="${fieldClass}">Date<input id="${ids.date}" type="date"></label>
      <label class="${fieldClass}">Signature<input id="${ids.signature}"></label>
    </div>`;
  }

  function readVerifyInputs(idPrefix) {
    const ids = verifyIds(idPrefix);
    return {
      verifiedBy: (el(ids.by).value || '').trim(),
      verifiedSig: (el(ids.title).value || '').trim(),
      verifiedDate: el(ids.date).value,
      verifiedSignature: (el(ids.signature).value || '').trim()
    };
  }

  function clearVerifyInputs(idPrefix) {
    const ids = verifyIds(idPrefix);
    el(ids.by).value = ''; el(ids.title).value = ''; el(ids.date).value = ''; el(ids.signature).value = '';
  }

  function validateVerifyInputs(v) {
    return !!(v.verifiedBy && v.verifiedSig && v.verifiedDate && v.verifiedSignature);
  }

  // One line of formatted verification-history text (caller supplies the wrapping element/class).
  function historyLine(v) {
    const entryNote = v.entryIds && v.entryIds.length ? ` · ${v.entryIds.length} ${v.entryIds.length === 1 ? 'entry' : 'entries'}` : '';
    return `${esc(v.verifiedDate || '(no date)')} · ${esc(v.verifiedBy)} `
      + `<span class="muted">(title: ${esc(v.verifiedSig)} · signature: ${esc(v.verifiedSignature || '')}${entryNote})</span>`;
  }

  async function logVerification(opts) {
    const recordKey = opts.recordKey;
    const values = opts.values;
    const picked = opts.picked || [];
    const storageKey = 'verification_log:' + recordKey;
    const record = { verifiedBy: values.verifiedBy, verifiedSig: values.verifiedSig, verifiedDate: values.verifiedDate, verifiedSignature: values.verifiedSignature, loggedAt: Date.now() };
    const raw = await storeGet(storageKey, true);
    let hist = [];
    try { hist = raw ? JSON.parse(raw) : []; } catch (e) { hist = []; }
    hist.push(Object.assign({ entryIds: picked }, record));
    await storeSet(storageKey, JSON.stringify(hist), true);
    return record;
  }

  async function getVerificationHistory(recordKey) {
    const raw = await storeGet('verification_log:' + recordKey, true);
    try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
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
    const uid = 'sob_' + Math.random().toString(36).slice(2, 8);
    const idPrefix = uid + '_verified';

    mountEl.innerHTML = `
      <div class="panel-head"><h2>Verification</h2></div>
      <div class="panel-body">
        <div class="muted" style="margin-bottom:6px; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em;">Entries to verify</div>
        <div id="${uid}_select" style="margin-bottom:10px;"></div>
        ${verifyFieldsHtml({ idPrefix })}
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
      const hist = await getVerificationHistory(recordKey);
      const target = el(uid + '_history');
      if (!hist.length) { target.innerHTML = `<div class="muted" style="font-size:11px;">No verification logged yet.</div>`; return; }
      target.innerHTML = hist.slice().reverse().map(v => `
        <div style="font-size:11.5px; padding:4px 0; border-bottom:1px solid #e2e4e3;">${historyLine(v)}</div>`).join('');
    }

    function toast(msg) {
      if (window.toast) { window.toast(msg); return; }
      const t = document.getElementById('toast');
      if (!t) { console.log(msg); return; }
      t.textContent = msg; t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2200);
    }

    el(uid + '_log').addEventListener('click', async () => {
      const values = readVerifyInputs(idPrefix);
      if (!validateVerifyInputs(values)) { toast('Verified by, title, date and signature are all required.'); return; }

      const pending = opts.getPending() || [];
      const picked = [...document.querySelectorAll('.' + uid + '_pick:checked')].map(cb => cb.value);
      if (pending.length && !picked.length) { toast('Tick at least one entry to verify.'); return; }

      const record = await logVerification({ recordKey, values, picked });

      if (opts.onLogged) opts.onLogged(record, picked);

      toast(picked.length ? `Verification logged for ${picked.length} ${picked.length === 1 ? 'entry' : 'entries'}.` : 'Verification logged.');
      clearVerifyInputs(idPrefix);
      renderSelect();
      renderHistory();
    });

    renderSelect();
    renderHistory();
    return { refresh() { renderSelect(); renderHistory(); } };
  }

  window.SignOffBlock = {
    completedByHtml, printRow, mountVerification,
    verifyIds, verifyFieldsHtml, readVerifyInputs, clearVerifyInputs, validateVerifyInputs,
    historyLine, logVerification, getVerificationHistory
  };
})();
