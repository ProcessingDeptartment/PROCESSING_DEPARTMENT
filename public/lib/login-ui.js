(function () {
  const STYLE = `
  .login-modal { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999; }
  .login-modal.hidden { display:none; }
  .login-box { background:#fff; border-radius:8px; padding:0; max-width:380px; box-shadow:0 20px 60px rgba(0,0,0,0.3); overflow:hidden; }
  .login-box-header { background:#1d2b38; color:#f4f1e8; padding:24px 32px; }
  .login-box-header h1 { margin:0 0 4px; font-size:18px; font-weight:600; }
  .login-box-header p { margin:0; font-size:12px; color:#b9c3cc; }
  .login-box-content { padding:32px; }
  .login-box .error { background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; padding:10px 12px; border-radius:4px; font-size:12px; margin-bottom:16px; }
  .login-box button { width:100%; padding:12px; background:#1d4ed8; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:14px; margin-top:8px; }
  .login-box button:hover { background:#1d3a9e; }
  .login-box button.login-cancel { background:#fff; color:#1d2b38; border:1px solid #1d2b38; }
  .login-box button.login-cancel:hover { background:#eef1f4; }
  .login-box button:disabled { background:#cbd5e1; cursor:default; }
  `;

  function injectStyle() {
    const id = 'login-ui-style';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function showLoginModal() {
    injectStyle();
    const modal = document.getElementById('loginModal') || createLoginModal();
    modal.classList.remove('hidden');
  }

  function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('hidden');
  }

  function createLoginModal() {
    const modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.className = 'login-modal hidden';

    const box = document.createElement('div');
    box.className = 'login-box';

    box.innerHTML = `
      <div class="login-box-header">
        <div>
          <div class="doc-code">PROCESSING</div>
          <h1>Department Records</h1>
        </div>
        <p style="margin:0; color:#b9c3cc; font-size:12px;">Enter your passkey to sign in</p>
      </div>
      <div class="login-box-content">
        <div id="loginError" class="error" style="display:none;"></div>
        <button id="loginPasskeyBtn" type="button">Enter Passkey</button>
        <button id="loginCancelBtn" type="button" class="login-cancel" style="margin-top:10px;">Cancel</button>
      </div>
    `;

    modal.appendChild(box);
    document.body.appendChild(modal);

    const errorDiv = modal.querySelector('#loginError');

    async function doPasskeyLogin() {
      if (!window.PasskeyInput) {
        errorDiv.textContent = 'Passkey input not available on this page';
        errorDiv.style.display = 'block';
        return;
      }
      hideLoginModal();
      const result = await window.PasskeyInput.openForApproval('Enter your passkey to sign in');
      if (!result) { showLoginModal(); return; }
      if (window.Auth) {
        const loginResult = window.Auth.loginByPasskeyResult(result);
        if (loginResult.ok) {
          document.dispatchEvent(new CustomEvent('authSuccess', { detail: loginResult.user }));
        } else {
          showLoginModal();
          errorDiv.textContent = loginResult.error || 'Sign-in failed';
          errorDiv.style.display = 'block';
        }
      }
    }

    modal.querySelector('#loginPasskeyBtn').addEventListener('click', doPasskeyLogin);
    modal.querySelector('#loginCancelBtn').addEventListener('click', hideLoginModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) hideLoginModal();
    });

    return modal;
  }

  window.AUTH_GATES_ENABLED = true;

  function ensureAuthenticated() {
    if (!window.AUTH_GATES_ENABLED) return Promise.resolve();
    if (window.Auth && window.Auth.isAuthenticated()) return Promise.resolve();
    return new Promise((resolve) => {
      showLoginModal();
      document.addEventListener('authSuccess', function handler() {
        document.removeEventListener('authSuccess', handler);
        resolve();
      });
    });
  }

  window.LoginUI = { ensureAuthenticated, showLoginModal, hideLoginModal };
})();
