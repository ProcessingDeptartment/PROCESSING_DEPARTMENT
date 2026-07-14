/*
 * Shared login UI for all records.
 * Call LoginUI.ensureAuthenticated() at record load to prompt for login if needed.
 * Once authenticated, Auth.getCurrentUsername() / Auth.getCurrentRole() are available.
 */
(function () {
  const STYLE = `
  .login-modal { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999; }
  .login-modal.hidden { display:none; }
  .login-box { background:#fff; border-radius:8px; padding:0; max-width:380px; box-shadow:0 20px 60px rgba(0,0,0,0.3); overflow:hidden; }
  .login-box-header { background:#1d2b38; color:#f4f1e8; padding:24px 32px; }
  .login-box-header h1 { margin:0 0 4px; font-size:18px; font-weight:600; }
  .login-box-header p { margin:0; font-size:12px; color:#b9c3cc; }
  .login-box-content { padding:32px; }
  .login-box label { display:block; margin-bottom:16px; }
  .login-box label .label-text { font-size:12px; font-weight:600; color:#1b2330; margin-bottom:4px; display:block; text-transform:uppercase; letter-spacing:0.02em; }
  .login-box input { width:100%; padding:10px 12px; border:1px solid #d0d5db; border-radius:6px; font-size:14px; font-family:'Segoe UI',system-ui,sans-serif; box-sizing:border-box; }
  .login-box input:focus { outline:none; border-color:#1d4ed8; box-shadow:0 0 0 3px rgba(29,78,216,0.1); }
  .login-box .error { background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; padding:10px 12px; border-radius:4px; font-size:12px; margin-bottom:16px; }
  .login-box .user-list { margin:24px 0; padding:16px; background:#f9fafb; border-radius:6px; border:1px solid #e2e8f0; }
  .login-box .user-list label { margin-bottom:8px; display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; }
  .login-box .user-list label:last-child { margin-bottom:0; }
  .login-box .user-list input[type=radio] { margin:0; width:auto; }
  .login-box button { width:100%; padding:12px; background:#1d4ed8; color:#fff; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:14px; margin-top:8px; }
  .login-box button:hover { background:#1d3a9e; }
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

    const users = window.Auth ? window.Auth.getAvailableUsers() : [];

    box.innerHTML = `
      <div class="login-box-header">
        <h1>Processing Department</h1>
        <p>Sign in to access records</p>
      </div>
      <div class="login-box-content">
        <div id="loginError" class="error" style="display:none;"></div>
        <div class="user-list">
          ${users.map((u, i) => `
            <label>
              <input type="radio" name="user" value="${u.username}" ${i === 0 ? 'checked' : ''}>
              <span>${u.displayName}</span>
            </label>
          `).join('')}
        </div>
        <label>
          <span class="label-text">User Password</span>
          <input type="password" id="loginPassword" placeholder="Enter password" autocomplete="current-password">
        </label>
        <button id="loginBtn">Sign In</button>
      </div>
    `;

    modal.appendChild(box);
    document.body.appendChild(modal);

    const loginBtn = modal.querySelector('#loginBtn');
    const passwordInput = modal.querySelector('#loginPassword');
    const errorDiv = modal.querySelector('#loginError');
    const userRadios = modal.querySelectorAll('input[name=user]');

    function attemptLogin() {
      errorDiv.style.display = 'none';
      const selectedUser = modal.querySelector('input[name=user]:checked')?.value;
      const password = passwordInput.value;
      if (!selectedUser || !password) {
        errorDiv.textContent = 'Please select a user and enter password';
        errorDiv.style.display = 'block';
        return;
      }
      if (window.Auth) {
        const result = window.Auth.login(selectedUser, password);
        if (result.ok) {
          hideLoginModal();
          document.dispatchEvent(new CustomEvent('authSuccess', { detail: result.user }));
        } else {
          errorDiv.textContent = result.error || 'Login failed';
          errorDiv.style.display = 'block';
          passwordInput.value = '';
          passwordInput.focus();
        }
      }
    }

    loginBtn.addEventListener('click', attemptLogin);
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') attemptLogin();
    });

    return modal;
  }

  function ensureAuthenticated() {
    return new Promise((resolve) => {
      if (window.Auth && window.Auth.isAuthenticated()) {
        resolve();
      } else {
        showLoginModal();
        document.addEventListener('authSuccess', () => resolve(), { once: true });
      }
    });
  }

  window.LoginUI = { ensureAuthenticated, showLoginModal, hideLoginModal };
})();
