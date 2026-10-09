/**
 * delete-submission-modal.js
 *
 * Self-contained UI for deleting a single submission with double passkey sign-off.
 * Authorised roles: Administrator, Production Manager, QA Manager.
 *
 * Usage:
 *   window.DeleteSubmissionModal.open({
 *     recordKey : 'drying-process',          // the record key (without formrecord: prefix)
 *     prefix    : 'formrecord:',             // 'formrecord:' or 'monitoring_log:'
 *     entryId   : entry.id,                  // the submission's id
 *     summary   : 'Job DPR-0001 · 5 Oct',   // short human description shown in the modal
 *     onDeleted : () => { /* reload UI *\/ } // called after successful deletion
 *   });
 *
 * The modal injects its own <style> once on first open, and its <div> on each open.
 */
(function () {
  'use strict';

  // Authorised roles (display titles, lowercase-matched).
  const AUTHORISED_TITLE_FRAGMENTS = ['administrator', 'production manager', 'qa manager'];

  // ── Styles ─────────────────────────────────────────────────────────────────────────────────────
  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      .dsm-overlay {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0,0,0,.55);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
      }
      .dsm-modal {
        background: #fff; border-radius: 10px;
        box-shadow: 0 8px 40px rgba(0,0,0,.25);
        width: 100%; max-width: 520px;
        font-family: inherit; font-size: 14px;
        overflow: hidden;
      }
      .dsm-header {
        background: #b71c1c; color: #fff;
        padding: 16px 20px;
        display: flex; align-items: center; gap: 12px;
      }
      .dsm-header h2 { margin: 0; font-size: 17px; font-weight: 600; flex: 1; }
      .dsm-header button {
        background: none; border: none; color: #fff; font-size: 20px;
        cursor: pointer; line-height: 1; padding: 0;
      }
      .dsm-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
      .dsm-warning {
        background: #fff3e0; border: 1px solid #ffb300; border-radius: 6px;
        padding: 10px 14px; color: #e65100; font-size: 13px; line-height: 1.5;
      }
      .dsm-warning strong { display: block; margin-bottom: 4px; }
      .dsm-label { font-weight: 600; color: #333; margin-bottom: 4px; font-size: 13px; }
      .dsm-sublabel { font-size: 12px; color: #777; margin-top: 2px; }
      .dsm-pk-row { display: flex; flex-direction: column; gap: 4px; }
      .dsm-pk-input-row {
        display: flex; gap: 8px; align-items: center;
      }
      .dsm-pk-display {
        flex: 1; border: 1px solid #ccc; border-radius: 6px;
        padding: 8px 12px; font-size: 16px; letter-spacing: 4px;
        min-height: 38px; background: #fafafa; color: #222;
      }
      .dsm-pk-display.verified { border-color: #2e7d32; background: #e8f5e9; color: #2e7d32; letter-spacing: 1px; }
      .dsm-pk-display.error    { border-color: #b71c1c; background: #ffebee; }
      .dsm-pad-btn {
        background: #eee; border: 1px solid #ccc; border-radius: 6px;
        padding: 6px 10px; cursor: pointer; font-size: 13px;
        transition: background .15s;
      }
      .dsm-pad-btn:hover { background: #ddd; }
      .dsm-numpad {
        display: none; flex-direction: column; gap: 4px; margin-top: 4px;
        background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; padding: 10px;
      }
      .dsm-numpad.open { display: flex; }
      .dsm-numpad-row { display: flex; gap: 4px; justify-content: center; }
      .dsm-numpad-key {
        flex: 1; max-width: 70px; padding: 10px; font-size: 18px; font-weight: 500;
        border: 1px solid #ccc; border-radius: 6px; background: #fff; cursor: pointer;
        text-align: center; transition: background .1s;
      }
      .dsm-numpad-key:hover { background: #e3e3e3; }
      .dsm-numpad-key.wide { max-width: 150px; font-size: 13px; }
      .dsm-pk-err { color: #b71c1c; font-size: 12px; min-height: 16px; }
      .dsm-reason-field {
        width: 100%; box-sizing: border-box;
        border: 1px solid #ccc; border-radius: 6px;
        padding: 8px 12px; font-size: 13px; font-family: inherit;
        resize: vertical; min-height: 70px;
      }
      .dsm-reason-field:focus { outline: 2px solid #b71c1c; border-color: #b71c1c; }
      .dsm-footer {
        padding: 14px 20px;
        background: #f9f9f9; border-top: 1px solid #eee;
        display: flex; gap: 10px; justify-content: flex-end;
      }
      .dsm-btn {
        padding: 9px 20px; border-radius: 6px; font-size: 14px; font-weight: 600;
        cursor: pointer; border: none; transition: background .15s, opacity .15s;
      }
      .dsm-btn:disabled { opacity: .45; cursor: default; }
      .dsm-btn-cancel { background: #eee; color: #333; }
      .dsm-btn-cancel:hover:not(:disabled) { background: #ddd; }
      .dsm-btn-delete { background: #b71c1c; color: #fff; }
      .dsm-btn-delete:hover:not(:disabled) { background: #7f0000; }
      .dsm-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #fff6; border-top-color: #fff; border-radius: 50%; animation: dsm-spin .7s linear infinite; vertical-align: middle; margin-right: 6px; }
      @keyframes dsm-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }

  // ── Num-pad state per slot (1 or 2) ────────────────────────────────────────────────────────────
  const state = { 1: { pin: '', verified: false, name: '' }, 2: { pin: '', verified: false, name: '' } };

  function pinDots(slot) {
    return '●'.repeat(state[slot].pin.length) || '';
  }

  function dispEl(slot) { return document.getElementById(`dsm_pk${slot}_display`); }
  function errEl(slot)  { return document.getElementById(`dsm_pk${slot}_err`); }
  function padEl(slot)  { return document.getElementById(`dsm_pad${slot}`); }

  function updateDisplay(slot) {
    const d = dispEl(slot);
    if (!d) return;
    if (state[slot].verified) {
      d.textContent = '✓ ' + state[slot].name;
      d.className = 'dsm-pk-display verified';
    } else {
      d.textContent = pinDots(slot) || '—';
      d.className = 'dsm-pk-display';
    }
  }

  function addDigit(slot, digit) {
    if (state[slot].verified) return;
    if (state[slot].pin.length < 8) {
      state[slot].pin += digit;
      updateDisplay(slot);
      errEl(slot).textContent = '';
    }
  }

  function backspace(slot) {
    if (state[slot].verified) return;
    state[slot].pin = state[slot].pin.slice(0, -1);
    updateDisplay(slot);
  }

  function clearPin(slot) {
    if (state[slot].verified) return;
    state[slot].pin = '';
    updateDisplay(slot);
  }

  async function verifySlot(slot) {
    const pin = state[slot].pin.trim();
    if (pin.length < 4) {
      errEl(slot).textContent = 'Passkey must be at least 4 digits';
      return;
    }
    const btn = document.getElementById(`dsm_verify${slot}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }

    try {
      const apiBase = (window.FacilityApi && window.FacilityApi.base) || '';
      const resp = await (window.FacilityApi
        ? window.FacilityApi.fetch('/api/passkey/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passkey: pin }) })
        : fetch(apiBase + '/api/passkey/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passkey: pin }) }));

      const data = await resp.json();
      if (!resp.ok) {
        errEl(slot).textContent = data.error || 'Passkey not recognised';
        state[slot].pin = '';
        updateDisplay(slot);
        return;
      }

      // Check role via title.
      const title = String(data.title || '').toLowerCase();
      const allowed = AUTHORISED_TITLE_FRAGMENTS.some(f => title.includes(f));
      if (!allowed) {
        errEl(slot).textContent = `${data.displayName} (${data.title || 'no title'}) is not authorised to approve deletions`;
        state[slot].pin = '';
        updateDisplay(slot);
        return;
      }

      // For slot 2, ensure it's a different person than slot 1.
      if (slot === 2 && state[1].verified && data.username === document.getElementById('dsm_user1').value) {
        errEl(slot).textContent = 'Both passkeys belong to the same person — a second, different person must confirm';
        state[slot].pin = '';
        updateDisplay(slot);
        return;
      }

      state[slot].verified = true;
      state[slot].name = data.displayName;
      if (slot === 1) {
        const u = document.getElementById('dsm_user1');
        if (u) u.value = data.username || '';
      }
      updateDisplay(slot);
      errEl(slot).textContent = '';
      if (padEl(slot)) padEl(slot).classList.remove('open');
    } catch (e) {
      errEl(slot).textContent = 'Network error: ' + e.message;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Verify'; }
    }
  }

  function resetSlot(slot) {
    state[slot] = { pin: '', verified: false, name: '' };
    updateDisplay(slot);
    if (errEl(slot)) errEl(slot).textContent = '';
    const pad = padEl(slot);
    if (pad) pad.classList.remove('open');
  }

  // ── Build HTML ──────────────────────────────────────────────────────────────────────────────────
  function padHtml(slot) {
    return `
      <div id="dsm_pad${slot}" class="dsm-numpad">
        <div class="dsm-numpad-row">
          ${[1,2,3].map(d => `<button type="button" class="dsm-numpad-key" onclick="window._dsm.digit(${slot},'${d}')">${d}</button>`).join('')}
        </div>
        <div class="dsm-numpad-row">
          ${[4,5,6].map(d => `<button type="button" class="dsm-numpad-key" onclick="window._dsm.digit(${slot},'${d}')">${d}</button>`).join('')}
        </div>
        <div class="dsm-numpad-row">
          ${[7,8,9].map(d => `<button type="button" class="dsm-numpad-key" onclick="window._dsm.digit(${slot},'${d}')">${d}</button>`).join('')}
        </div>
        <div class="dsm-numpad-row">
          <button type="button" class="dsm-numpad-key wide" onclick="window._dsm.clear(${slot})">Clear</button>
          <button type="button" class="dsm-numpad-key" onclick="window._dsm.digit(${slot},'0')">0</button>
          <button type="button" class="dsm-numpad-key wide" onclick="window._dsm.back(${slot})">⌫</button>
        </div>
        <div class="dsm-numpad-row" style="margin-top:4px">
          <button type="button" id="dsm_verify${slot}" class="dsm-numpad-key wide" style="max-width:100%;background:#1565c0;color:#fff;border-color:#1565c0" onclick="window._dsm.verify(${slot})">Verify</button>
        </div>
      </div>`;
  }

  function buildModal(opts) {
    return `
      <div class="dsm-overlay" id="dsm_overlay" onclick="window._dsm.overlayClick(event)">
        <div class="dsm-modal" role="dialog" aria-modal="true" aria-labelledby="dsm_title">
          <div class="dsm-header">
            <h2 id="dsm_title">⚠ Delete Submission</h2>
            <button type="button" onclick="window._dsm.close()" aria-label="Close">✕</button>
          </div>
          <div class="dsm-body">
            <div class="dsm-warning">
              <strong>This action cannot be undone.</strong>
              You are about to permanently delete:<br>
              <span style="font-weight:600">${escHtml(opts.summary)}</span>
            </div>

            <!-- Slot 1 -->
            <div class="dsm-pk-row">
              <div class="dsm-label">First authorisation</div>
              <div class="dsm-sublabel">Administrator, Production Manager or QA Manager</div>
              <div class="dsm-pk-input-row">
                <div class="dsm-pk-display" id="dsm_pk1_display">—</div>
                <button type="button" class="dsm-pad-btn" onclick="window._dsm.togglePad(1)">Enter PIN</button>
                <button type="button" class="dsm-pad-btn" onclick="window._dsm.resetSlot(1)" style="color:#b71c1c">Reset</button>
              </div>
              ${padHtml(1)}
              <div class="dsm-pk-err" id="dsm_pk1_err"></div>
            </div>

            <!-- Slot 2 -->
            <div class="dsm-pk-row">
              <div class="dsm-label">Second authorisation <span style="font-size:12px;color:#777">(must be a different person)</span></div>
              <div class="dsm-sublabel">Administrator, Production Manager or QA Manager</div>
              <div class="dsm-pk-input-row">
                <div class="dsm-pk-display" id="dsm_pk2_display">—</div>
                <button type="button" class="dsm-pad-btn" onclick="window._dsm.togglePad(2)">Enter PIN</button>
                <button type="button" class="dsm-pad-btn" onclick="window._dsm.resetSlot(2)" style="color:#b71c1c">Reset</button>
              </div>
              ${padHtml(2)}
              <div class="dsm-pk-err" id="dsm_pk2_err"></div>
            </div>

            <!-- Reason -->
            <div>
              <div class="dsm-label">Reason for deletion <span style="font-size:12px;color:#777">(required, min 10 characters)</span></div>
              <textarea class="dsm-reason-field" id="dsm_reason" placeholder="e.g. Entry made against wrong job number, duplicate submission, test entry…" rows="3"></textarea>
            </div>

            <!-- Hidden -->
            <input type="hidden" id="dsm_user1" value="">
          </div>
          <div class="dsm-footer">
            <button type="button" class="dsm-btn dsm-btn-cancel" onclick="window._dsm.close()">Cancel</button>
            <button type="button" class="dsm-btn dsm-btn-delete" id="dsm_confirm_btn" onclick="window._dsm.confirm()">
              Delete Submission
            </button>
          </div>
        </div>
      </div>`;
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Public API ──────────────────────────────────────────────────────────────────────────────────
  let currentOpts = null;

  window._dsm = {
    digit: addDigit,
    back: backspace,
    clear: clearPin,
    verify: verifySlot,
    resetSlot,
    togglePad(slot) {
      const pad = padEl(slot);
      if (!pad) return;
      if (state[slot].verified) return; // already done
      pad.classList.toggle('open');
    },
    overlayClick(e) {
      if (e.target.id === 'dsm_overlay') this.close();
    },
    close() {
      const el = document.getElementById('dsm_overlay');
      if (el) el.remove();
      resetSlot(1); resetSlot(2);
      currentOpts = null;
    },
    async confirm() {
      if (!currentOpts) return;
      if (!state[1].verified) {
        document.getElementById('dsm_pk1_err').textContent = 'First passkey has not been verified';
        return;
      }
      if (!state[2].verified) {
        document.getElementById('dsm_pk2_err').textContent = 'Second passkey has not been verified';
        return;
      }
      const reason = (document.getElementById('dsm_reason').value || '').trim();
      if (reason.length < 10) {
        document.getElementById('dsm_reason').focus();
        if (window.toast) window.toast('Please enter a reason for deletion (at least 10 characters).');
        return;
      }

      const btn = document.getElementById('dsm_confirm_btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="dsm-spinner"></span>Deleting…';

      try {
        const body = {
          key: currentOpts.prefix + currentOpts.recordKey,
          submissionId: currentOpts.entryId,
          passkey1: state[1].pin || '__verified__' + state[1].name, // server will re-verify; pins cleared on verify — re-send from cache
          passkey2: state[2].pin || '__verified__' + state[2].name,
          reason,
        };
        // The server verifies the PINs. But we cleared state[slot].pin in verifySlot because the
        // verify step already ran against the API. We must store the raw pin until confirm.
        // Fix: hold rawPin separately (see open() which stores in _rawPin).
        body.passkey1 = currentOpts._rawPin1 || state[1].pin;
        body.passkey2 = currentOpts._rawPin2 || state[2].pin;

        const apiBase = (window.FacilityApi && window.FacilityApi.base) || '';
        const resp = await (window.FacilityApi
          ? window.FacilityApi.fetch('/api/submissions/delete-one', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          : fetch(apiBase + '/api/submissions/delete-one', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));

        const data = await resp.json();
        if (!resp.ok) {
          if (window.toast) window.toast('Delete failed: ' + (data.error || 'unknown error'));
          btn.disabled = false;
          btn.textContent = 'Delete Submission';
          return;
        }

        if (window.toast) window.toast(`Submission deleted — ${data.remaining} entr${data.remaining === 1 ? 'y' : 'ies'} remain`);
        this.close();
        if (currentOpts && typeof currentOpts.onDeleted === 'function') currentOpts.onDeleted();
        if (data && typeof currentOpts?.onDeleted === 'function') currentOpts.onDeleted(data);
      } catch (e) {
        if (window.toast) window.toast('Network error: ' + e.message);
        btn.disabled = false;
        btn.textContent = 'Delete Submission';
      }
    },
  };

  // Override verifySlot to store raw PIN before clearing display.
  const _origVerify = verifySlot;
  window._dsm.verify = async function(slot) {
    // Cache the raw pin before verifySlot might clear it.
    const rawPin = state[slot].pin;
    await _origVerify(slot);
    if (state[slot].verified) {
      if (slot === 1 && currentOpts) currentOpts._rawPin1 = rawPin;
      if (slot === 2 && currentOpts) currentOpts._rawPin2 = rawPin;
    }
  };

  window.DeleteSubmissionModal = {
    /**
     * Open the delete confirmation modal.
     * @param {object} opts
     * @param {string} opts.recordKey  - e.g. 'drying-process'
     * @param {string} [opts.prefix]   - 'formrecord:' (default) or 'monitoring_log:'
     * @param {string} opts.entryId    - the submission id to delete
     * @param {string} opts.summary    - human-readable description shown in the warning
     * @param {function} [opts.onDeleted] - callback after successful deletion
     */
    open(opts) {
      injectStyles();
      // Remove any leftover overlay.
      const existing = document.getElementById('dsm_overlay');
      if (existing) existing.remove();
      resetSlot(1); resetSlot(2);

      currentOpts = Object.assign({ prefix: 'formrecord:', _rawPin1: '', _rawPin2: '' }, opts);

      const wrapper = document.createElement('div');
      wrapper.innerHTML = buildModal(currentOpts);
      document.body.appendChild(wrapper.firstElementChild);
    }
  };
})();
