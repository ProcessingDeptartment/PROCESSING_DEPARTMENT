/**
 * Passkey Number Pad Input
 * Replaces typed signature with numeric passkey entry via popup
 */

(function () {
  function el(id) { return document.getElementById(id); }

  // Create number pad popup
  function createNumberPad() {
    const html = `
      <div id="passkey-modal-overlay" class="passkey-modal-overlay">
        <div class="passkey-modal">
          <div class="passkey-modal-header">
            <h3>Enter Your Passkey</h3>
            <button type="button" class="close" onclick="PasskeyInput.closeModal()">✕</button>
          </div>
          <div class="passkey-modal-body">
            <div class="passkey-display" id="passkey-display"></div>
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
              <button type="button" class="pad-btn" onclick="PasskeyInput.addDigit('0')">0</button>
              <button type="button" class="pad-btn clear" onclick="PasskeyInput.clear()">Clear</button>
              <button type="button" class="pad-btn delete" onclick="PasskeyInput.backspace()">← Delete</button>
            </div>
          </div>
          <div class="passkey-modal-footer">
            <button type="button" class="btn btn-secondary" onclick="PasskeyInput.closeModal()">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="PasskeyInput.submit()">Verify</button>
          </div>
          <div id="passkey-error" class="passkey-error"></div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .passkey-modal-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        justify-content: center;
        align-items: center;
      }
      .passkey-modal-overlay.active {
        display: flex;
      }
      .passkey-modal {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        width: 90%;
        max-width: 400px;
      }
      .passkey-modal-header {
        padding: 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .passkey-modal-header h3 {
        margin: 0;
        font-size: 18px;
      }
      .passkey-modal-header .close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
      }
      .passkey-modal-header .close:hover {
        color: #333;
      }
      .passkey-modal-body {
        padding: 20px;
      }
      .passkey-display {
        text-align: center;
        font-size: 32px;
        letter-spacing: 8px;
        font-weight: bold;
        color: #333;
        min-height: 50px;
        margin-bottom: 20px;
        font-family: monospace;
      }
      .passkey-pad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 20px;
      }
      .pad-btn {
        padding: 15px;
        font-size: 18px;
        font-weight: bold;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #f9f9f9;
        cursor: pointer;
        transition: all 0.2s;
      }
      .pad-btn:hover {
        background: #e3f2fd;
        border-color: #2196F3;
      }
      .pad-btn:active {
        background: #2196F3;
        color: white;
      }
      .pad-btn.clear, .pad-btn.delete {
        grid-column: span 1;
        background: #ffebee;
        color: #d32f2f;
      }
      .pad-btn.clear:hover, .pad-btn.delete:hover {
        background: #ffcdd2;
        border-color: #d32f2f;
      }
      .passkey-modal-footer {
        padding: 20px;
        border-top: 1px solid #eee;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      .passkey-error {
        color: #d32f2f;
        font-size: 14px;
        margin-top: 10px;
      }
      input[placeholder="Enter passkey"] {
        cursor: pointer;
        background: #f5f5f5 !important;
        border: 2px solid #2196F3 !important;
      }
      input[placeholder="Enter passkey"]:hover {
        background: #e3f2fd !important;
      }
      .passkey-verified-display {
        font-size: 12px;
        color: green;
        margin-top: 4px;
      }
      .verified-badge {
        background: #4caf50;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: bold;
      }
    `;
    document.head.appendChild(style);

    // Add HTML to body
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  let currentPasskey = '';
  let currentFieldId = null;

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
      document.getElementById('passkey-display').textContent = '';
      document.getElementById('passkey-error').textContent = '';
      document.getElementById('passkey-modal-overlay').classList.add('active');
    },

    // Add digit
    addDigit: function(digit) {
      if (currentPasskey.length < 8) {
        currentPasskey += digit;
        document.getElementById('passkey-display').textContent = '•'.repeat(currentPasskey.length);
        document.getElementById('passkey-error').textContent = '';
      }
    },

    // Delete last digit
    backspace: function() {
      if (currentPasskey.length > 0) {
        currentPasskey = currentPasskey.slice(0, -1);
        document.getElementById('passkey-display').textContent = '•'.repeat(currentPasskey.length);
        document.getElementById('passkey-error').textContent = '';
      }
    },

    // Clear all
    clear: function() {
      currentPasskey = '';
      document.getElementById('passkey-display').textContent = '';
      document.getElementById('passkey-error').textContent = '';
    },

    // Submit passkey
    submit: async function() {
      if (currentPasskey.length < 4) {
        document.getElementById('passkey-error').textContent = 'Passkey must be at least 4 digits';
        return;
      }

      try {
        const response = await fetch('/api/passkey/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passkey: currentPasskey })
        });

        const result = await response.json();

        if (!response.ok) {
          document.getElementById('passkey-error').textContent = result.error || 'Passkey not recognized';
          return;
        }

        // Success! Fill the form fields
        const fieldEl = document.getElementById(currentFieldId);
        if (fieldEl) {
          fieldEl.value = result.displayName;
          fieldEl.dataset.passkey = currentPasskey;
          fieldEl.dataset.displayName = result.displayName;
          fieldEl.dataset.verified = 'true';

          // Update display
          const fieldGroup = fieldEl.closest('.field') || fieldEl.parentElement;
          const display = fieldGroup.querySelector('.passkey-verified-display');
          if (display) {
            display.innerHTML = `<strong>${result.displayName}</strong> <span class="verified-badge">Confirmed ✓</span>`;
          }
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
    }
  };

  // Init on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.PasskeyInput.init(); });
  } else {
    window.PasskeyInput.init();
  }
})();
