/**
 * Passkey Number Pad Input
 * Replaces typed signature with numeric passkey entry via popup
 */

(function () {
  function el(id) { return document.getElementById(id); }

  function updateDots() {
    const display = document.getElementById('passkey-display');
    if (!display) return;
    display.innerHTML = '';
    const len = currentPasskey.length;
    const total = 6; // fixed 6-dot row
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span');
      dot.className = 'passkey-dot' + (i < len ? ' filled' : '');
      display.appendChild(dot);
    }
  }

  // Create number pad popup
  function createNumberPad() {
    const html = `
      <div id="passkey-modal-overlay" class="passkey-modal-overlay">
        <div class="passkey-modal">
          <div class="passkey-modal-header">
            <div class="passkey-header-title" id="passkey-header-title">Enter your passkey</div>
            <div class="passkey-header-sub" id="passkey-header-sub"></div>
            <button type="button" class="passkey-close" onclick="PasskeyInput.closeModal()">✕</button>
          </div>
          <div class="passkey-modal-body">
            <div class="passkey-dots" id="passkey-display"></div>
            <div id="passkey-error" class="passkey-error"></div>
            <div class="passkey-pad">
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('1')">1</button>
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('2')">2</button>
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('3')">3</button>
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('4')">4</button>
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('5')">5</button>
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('6')">6</button>
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('7')">7</button>
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('8')">8</button>
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('9')">9</button>
              <button type="button" class="pad-btn pad-delete" onclick="PasskeyInput.backspace()">⌫</button>
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('0')">0</button>
              <button type="button" class="pad-btn pad-confirm" onclick="PasskeyInput.submit()">✓</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .passkey-modal-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 9999;
        justify-content: center;
        align-items: center;
      }
      .passkey-modal-overlay.active { display: flex; }
      .passkey-modal {
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.18);
        width: 90%;
        max-width: 320px;
        overflow: hidden;
      }
      .passkey-modal-header {
        background: #1d2b38;
        color: #f4f1e8;
        padding: 20px 20px 16px;
        position: relative;
      }
      .passkey-header-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 2px;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }
      .passkey-header-sub {
        font-size: 12px;
        color: #b9c3cc;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }
      .passkey-close {
        position: absolute;
        top: 12px;
        right: 14px;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #b9c3cc;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 4px;
      }
      .passkey-close:hover { color: #fff; }
      .passkey-modal-body { padding: 20px 20px 24px; }
      .passkey-dots {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-bottom: 8px;
        min-height: 20px;
      }
      .passkey-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid #d4d4d8;
        background: transparent;
        transition: background 0.1s, border-color 0.1s;
        flex-shrink: 0;
      }
      .passkey-dot.filled {
        background: #1a1a1a;
        border-color: #1a1a1a;
        animation: passkey-dot-pop 0.15s ease;
      }
      @keyframes passkey-dot-pop {
        0%   { transform: scale(1); }
        50%  { transform: scale(1.3); }
        100% { transform: scale(1); }
      }
      .passkey-error {
        color: #dc2626;
        font-size: 12px;
        text-align: center;
        min-height: 18px;
        margin-bottom: 14px;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }
      .passkey-pad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }
      .pad-btn {
        height: 60px;
        font-size: 22px;
        font-weight: 600;
        color: #1a1a1a;
        background: #f4f4f5;
        border: 1px solid #d4d4d8;
        border-radius: 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        cursor: pointer;
        transition: background 0.1s, transform 0.08s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }
      .pad-btn:hover { background: #e4e4e7; }
      .pad-btn:active { background: #d4d4d8; transform: scale(0.96); }
      .pad-delete { font-size: 18px; color: #555; }
      .pad-confirm {
        background: #2f7a52;
        border-color: #2f7a52;
        color: #fff;
      }
      .pad-confirm:hover { background: #256640; border-color: #256640; }
      .pad-confirm:active { background: #1d5233; border-color: #1d5233; transform: scale(0.96); }
    `;
    document.head.appendChild(style);

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  let currentPasskey = '';
  let currentFieldId = null;
  let approvalResolve = null;
  let enrollContext = null; // { deviceId, label, resolve }

  // Public API
  window.PasskeyInput = {
    // Initialize - call once on page load
    init: function() {
      createNumberPad();
    },

    // Open modal for signature field
    openForField: function(fieldId) {
      currentPasskey = '';
      currentFieldId = fieldId;
      approvalResolve = null;
      enrollContext = null;
      updateDots();
      document.getElementById('passkey-error').textContent = '';
      document.getElementById('passkey-modal-overlay').classList.add('active');
    },

    // Open modal for device enrollment — calls /api/auth/device-enroll, stores key, resolves {displayName, key} or null
    openForEnroll: function(deviceId, label) {
      return new Promise(function(resolve) {
        currentPasskey = '';
        currentFieldId = null;
        approvalResolve = null;
        enrollContext = { deviceId: deviceId || '', label: label || navigator.userAgent, resolve: resolve };
        const title = document.getElementById('passkey-header-title');
        if (title) title.textContent = 'Set up this device';
        const sub = document.getElementById('passkey-header-sub');
        if (sub) sub.textContent = 'Enter your passkey to register this device';
        updateDots();
        document.getElementById('passkey-error').textContent = '';
        document.getElementById('passkey-modal-overlay').classList.add('active');
      });
    },

    // Open modal for approval — returns a Promise resolving to {displayName, title} or null on cancel
    openForApproval: function(promptText) {
      return new Promise(function(resolve) {
        currentPasskey = '';
        currentFieldId = null;
        approvalResolve = resolve;
        enrollContext = null;
        const title = document.getElementById('passkey-header-title');
        if (title) title.textContent = promptText || 'Approve change — enter your passkey';
        updateDots();
        document.getElementById('passkey-error').textContent = '';
        document.getElementById('passkey-modal-overlay').classList.add('active');
      });
    },

    // Add digit
    addDigit: function(digit) {
      if (currentPasskey.length < 8) {
        currentPasskey += digit;
        updateDots();
        document.getElementById('passkey-error').textContent = '';
      }
    },

    // Delete last digit
    backspace: function() {
      if (currentPasskey.length > 0) {
        currentPasskey = currentPasskey.slice(0, -1);
        updateDots();
        document.getElementById('passkey-error').textContent = '';
      }
    },

    // Clear all
    clear: function() {
      currentPasskey = '';
      updateDots();
      document.getElementById('passkey-error').textContent = '';
    },

    // Submit passkey
    submit: async function() {
      if (currentPasskey.length < 4) {
        document.getElementById('passkey-error').textContent = 'Passkey must be at least 4 digits';
        return;
      }

      try {
        const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passkey: currentPasskey, role: window.Auth && window.Auth.getCurrentRole ? window.Auth.getCurrentRole() || '' : '' }) };
        const response = window.FacilityApi ? await window.FacilityApi.fetch('/api/passkey/verify', opts) : await fetch('/api/passkey/verify', opts);

        const result = await response.json();

        if (!response.ok) {
          document.getElementById('passkey-error').textContent = result.error || 'Passkey not recognized';
          return;
        }

        // Enroll-mode: call device-enroll endpoint
        if (enrollContext) {
          const ctx = enrollContext;
          enrollContext = null;
          try {
            const API_BASE = window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com';
            const enrollOpts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passkey: currentPasskey, deviceId: ctx.deviceId, label: ctx.label }) };
            const enrollRes = window.FacilityApi ? await window.FacilityApi.fetch('/api/auth/device-enroll', enrollOpts) : await fetch(API_BASE + '/api/auth/device-enroll', enrollOpts);
            const enrollJson = await enrollRes.json().catch(() => ({}));
            if (!enrollRes.ok || !enrollJson.ok) {
              document.getElementById('passkey-error').textContent = enrollJson.error || ('Enrolment failed (' + enrollRes.status + ')');
              enrollContext = ctx; // restore so closeModal can cancel it
              enrollContext.resolve = ctx.resolve;
              return;
            }
            if (window.FacilityApi) window.FacilityApi.setKey(enrollJson.key);
            this.closeModal();
            ctx.resolve({ displayName: enrollJson.displayName, key: enrollJson.key });
          } catch (e) {
            document.getElementById('passkey-error').textContent = 'Could not reach the server: ' + e.message;
            enrollContext = ctx;
          }
          return;
        }

        // Approval-mode: resolve the promise and close
        if (approvalResolve) {
          const cb = approvalResolve;
          approvalResolve = null; // clear before closeModal so it doesn't fire cb(null)
          this.closeModal();
          if (window.toast) window.toast(`Approved by ${result.displayName}`);
          cb({ displayName: result.displayName, title: result.title });
          return;
        }

        // Success! Fill the form fields
        const fieldEl = document.getElementById(currentFieldId);
        if (fieldEl) {
          fieldEl.value = 'Confirmed'; // signature shows only 'Confirmed'; the name goes in Completed/Verified by
          fieldEl.dataset.displayName = result.displayName;
          fieldEl.dataset.verified = 'true';

          // Auto-fill sibling Completed/Verified-by, Title and Date fields (ids share a prefix)
          const base = currentFieldId.replace(/_signature$/, '');
          const nameEl = document.getElementById(base + '_by');
          if (nameEl) nameEl.value = result.displayName;
          const titleEl = document.getElementById(base + '_title');
          if (titleEl && result.title) titleEl.value = result.title;
          const dateEl = document.getElementById(base + '_date');
          if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);

          // Update display
          const display = document.getElementById(currentFieldId + '_display');
          if (display) {
            const text = 'Confirmed ✓';
            display.textContent = text;
            display.title = text;
          }
          const field = fieldEl.closest('.pk-field');
          if (field) field.classList.add('is-verified');
        }

        // Close modal
        this.closeModal();

        // Show toast
        if (window.toast) {
          window.toast(`Signed by ${result.displayName}`);
        }
      } catch (error) {
        document.getElementById('passkey-error').textContent = 'Error: ' + error.message;
      }
    },

    // Close modal
    closeModal: function() {
      document.getElementById('passkey-modal-overlay').classList.remove('active');
      currentPasskey = '';
      currentFieldId = null;
      if (enrollContext) {
        const ctx = enrollContext;
        enrollContext = null;
        ctx.resolve(null); // cancelled
      }
      if (approvalResolve) {
        const cb = approvalResolve;
        approvalResolve = null;
        cb(null); // cancelled
      }
      const title = document.getElementById('passkey-header-title');
      if (title) title.textContent = 'Enter your passkey';
      const sub = document.getElementById('passkey-header-sub');
      if (sub) sub.textContent = '';
    }
  };

  // Init on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.PasskeyInput.init(); });
  } else {
    window.PasskeyInput.init();
  }
})();
