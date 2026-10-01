/**
 * Passkey Authentication Module
 *
 * Provides WebAuthn/FIDO2 passkey registration and verification for signature verification.
 * Replaces typed signatures with cryptographic passkey authentication.
 *
 * API Requirements:
 * - POST /api/auth/passkey/register-options - Get registration options
 * - POST /api/auth/passkey/register-verify - Verify registration response
 * - POST /api/auth/passkey/authenticate-options - Get authentication options
 * - POST /api/auth/passkey/authenticate-verify - Verify authentication response
 */

(function () {
  // Browser compatibility check
  function isWebAuthnSupported() {
    const supported = !!(
      navigator.credentials &&
      navigator.credentials.create &&
      navigator.credentials.get &&
      window.PublicKeyCredential
    );
    return supported;
  }

  // Convert ArrayBuffer to base64url string
  function bufferToBase64url(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // Convert base64url string to ArrayBuffer
  function base64urlToBuffer(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (str.length % 4)) % 4;
    str += '='.repeat(padLen);
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Get passkey registration options from server
  async function getRegistrationOptions(username, displayName) {
    try {
      const response = await fetch('/api/auth/passkey/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      // Convert challenge from base64url to ArrayBuffer
      data.challenge = base64urlToBuffer(data.challenge);
      // Convert user ID if provided
      if (data.user && data.user.id) {
        data.user.id = base64urlToBuffer(data.user.id);
      }

      return data;
    } catch (e) {
      console.error('getRegistrationOptions failed:', e);
      throw e;
    }
  }

  // Register a new passkey credential
  async function registerPasskey(username, displayName) {
    if (!isWebAuthnSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    try {
      // Step 1: Get registration options from server
      const options = await getRegistrationOptions(username, displayName);

      // Step 2: Create credential (browser prompts user)
      const credential = await navigator.credentials.create({
        publicKey: options
      });

      if (!credential) {
        throw new Error('User cancelled passkey registration');
      }

      // Step 3: Send attestation response to server
      const response = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          id: bufferToBase64url(credential.id),
          rawId: bufferToBase64url(credential.id),
          response: {
            clientDataJSON: bufferToBase64url(credential.response.clientDataJSON),
            attestationObject: bufferToBase64url(credential.response.attestationObject)
          },
          type: credential.type
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        credentialId: bufferToBase64url(credential.id),
        message: result.message || 'Passkey registered successfully'
      };
    } catch (e) {
      console.error('registerPasskey failed:', e);
      throw e;
    }
  }

  // Get authentication options from server
  async function getAuthenticationOptions(username) {
    try {
      const response = await fetch('/api/auth/passkey/authenticate-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      // Convert challenge from base64url to ArrayBuffer
      data.challenge = base64urlToBuffer(data.challenge);

      // Convert allowCredentials if provided
      if (data.allowCredentials && Array.isArray(data.allowCredentials)) {
        data.allowCredentials = data.allowCredentials.map(cred => ({
          ...cred,
          id: base64urlToBuffer(cred.id)
        }));
      }

      return data;
    } catch (e) {
      console.error('getAuthenticationOptions failed:', e);
      throw e;
    }
  }

  // Authenticate with a passkey (for verification signing)
  async function authenticateWithPasskey(username) {
    if (!isWebAuthnSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    try {
      // Step 1: Get authentication options from server
      const options = await getAuthenticationOptions(username);

      // Step 2: Get assertion from credential (browser prompts user)
      const assertion = await navigator.credentials.get({
        publicKey: options
      });

      if (!assertion) {
        throw new Error('User cancelled passkey authentication');
      }

      // Step 3: Send assertion response to server
      const response = await fetch('/api/auth/passkey/authenticate-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          id: bufferToBase64url(assertion.id),
          rawId: bufferToBase64url(assertion.id),
          response: {
            clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
            authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
            signature: bufferToBase64url(assertion.response.signature)
          },
          type: assertion.type
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        credentialId: bufferToBase64url(assertion.id),
        signature: bufferToBase64url(assertion.response.signature),
        message: result.message || 'Passkey authentication successful'
      };
    } catch (e) {
      console.error('authenticateWithPasskey failed:', e);
      throw e;
    }
  }

  // UI Helper: Create passkey registration UI
  function createRegistrationUI(opts) {
    const container = typeof opts.container === 'string'
      ? document.getElementById(opts.container)
      : opts.container;

    const uid = 'pk_reg_' + Math.random().toString(36).slice(2, 8);

    if (!isWebAuthnSupported()) {
      container.innerHTML = `<div class="alert alert-error">
        WebAuthn is not supported in this browser. Please use a modern browser or device.
      </div>`;
      return;
    }

    container.innerHTML = `
      <div class="panel-body">
        <h3>Set Up Passkey Authentication</h3>
        <p class="muted" style="margin-bottom: 12px;">
          Register a passkey to sign verifications securely. You'll use your device's biometric or PIN.
        </p>
        <div style="margin-bottom: 12px;">
          <label class="field">
            Your Name (for passkey registration)
            <input type="text" id="${uid}_displayName" placeholder="e.g., John Smith">
          </label>
        </div>
        <div class="actions">
          <button class="btn btn-primary" id="${uid}_register">Register Passkey</button>
          <button class="btn btn-secondary" id="${uid}_skip">Skip for Now</button>
        </div>
        <div id="${uid}_status"></div>
      </div>
    `;

    const displayNameInput = document.getElementById(`${uid}_displayName`);
    const registerBtn = document.getElementById(`${uid}_register`);
    const skipBtn = document.getElementById(`${uid}_skip`);
    const statusDiv = document.getElementById(`${uid}_status`);

    function setStatus(msg, type = 'info') {
      statusDiv.innerHTML = `<div class="alert alert-${type}" style="margin-top: 12px;">${msg}</div>`;
    }

    registerBtn.addEventListener('click', async () => {
      const displayName = displayNameInput.value.trim();
      if (!displayName) {
        setStatus('Please enter your name', 'error');
        return;
      }

      registerBtn.disabled = true;
      setStatus('Setting up passkey... Please follow the prompts on your device.', 'info');

      try {
        const username = opts.username || (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || displayName;
        const result = await registerPasskey(username, displayName);
        setStatus('✓ Passkey registered successfully! ' + result.message, 'success');
        if (opts.onSuccess) opts.onSuccess(result);
      } catch (e) {
        setStatus('Error: ' + (e.message || 'Failed to register passkey'), 'error');
        registerBtn.disabled = false;
      }
    });

    skipBtn.addEventListener('click', () => {
      if (opts.onSkip) opts.onSkip();
    });
  }

  // UI Helper: Create passkey authentication button for verification signing
  function createAuthenticationButton(opts) {
    const button = typeof opts.button === 'string'
      ? document.getElementById(opts.button)
      : opts.button;

    if (!isWebAuthnSupported()) {
      button.disabled = true;
      button.title = 'WebAuthn not supported in this browser';
      return;
    }

    button.addEventListener('click', async () => {
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = 'Authenticating...';

      try {
        const username = opts.username || (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser());
        if (!username) {
          throw new Error('User not signed in');
        }

        const result = await authenticateWithPasskey(username);
        button.textContent = '✓ ' + originalText;
        if (opts.onSuccess) opts.onSuccess(result);
      } catch (e) {
        button.textContent = originalText;
        button.disabled = false;
        if (opts.onError) {
          opts.onError(e);
        } else {
          alert('Passkey authentication failed: ' + (e.message || 'Unknown error'));
        }
      }
    });
  }

  // Export public API
  window.PasskeyAuth = {
    isSupported: isWebAuthnSupported,
    register: registerPasskey,
    authenticate: authenticateWithPasskey,
    createRegistrationUI,
    createAuthenticationButton,
    bufferToBase64url,
    base64urlToBuffer
  };
})();
