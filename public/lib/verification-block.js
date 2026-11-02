// public/lib/verification-block.js
// Hard block / warning when overdue verifications exist.
// Blocked users get an override escape hatch requiring a reason + passkey (audited).

(function () {
// ── Guard: only run once even if authSuccess fires multiple times ────────────
let _ran = false;

async function initVerificationBlock() {
  if (_ran) return;

  // ── 0. Per-user exemption / override check ────────────────────────────────
  if (window.__blockExempt === true || sessionStorage.getItem('blockExempt') === '1') return;
  if (sessionStorage.getItem('vb_override_granted') === '1') return;
  // Never block on the verification pages themselves — that's where users go to fix it.
  const _path = window.location.pathname;
  if (_path.includes('awaiting-verification') || _path.includes('verification-queue')) return;

  // ── 1. Read current user role ─────────────────────────────────────────────
  // Requires auth.js to have run and restored/set the session first.
  const userRole = (
    window.__currentUserRole ||
    sessionStorage.getItem('userRole') ||
    ''
  ).toLowerCase().trim();

  // Don't run until someone is actually logged in.
  if (!userRole) return;

  // Permitted = can see warning but continue (they are the verifiers).
  // Everyone else = hard block.
  const PERMITTED_ROLES = [
    'administrator', 'admin',
    'qa manager', 'qc manager',
    'quality supervisor', 'quality controller',
    'production manager', 'shift manager',
  ];
  const isPermitted = PERMITTED_ROLES.includes(userRole);

  // ── 2. Check overdue count ─────────────────────────────────────────────────
  // Primary: use VerificationQueue (reads localStorage, role-aware, covers all records).
  // Fallback: API endpoint (covers database-synced records only).
  const apiBase = (window.FacilityApi?.base?.() || window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com').replace(/\/$/, '');
  const roleKey = (window.__currentUserRoleKey || '').trim();
  const cutoff48 = Date.now() - 48 * 60 * 60 * 1000;

  let overdueCount = 0;
  try {
    if (window.VerificationQueue) {
      // Load per-record verifier assignments, then get this user's pending queue.
      await window.VerificationQueue.loadAssignments().catch(() => {});
      const q = await window.VerificationQueue.forCurrentUser();
      // Count entries whose oldest submission timestamp is > 48 h ago.
      overdueCount = (q.records || [])
        .filter(r => r.oldest && +new Date(r.oldest) < cutoff48)
        .reduce((n, r) => n + r.count, 0);
    } else {
      // Fallback to API (e.g. on pages that don't load verification-queue.js).
      const params = roleKey ? '?role=' + encodeURIComponent(roleKey) : '';
      const res = await fetch(apiBase + '/api/verification/count-overdue' + params, {
        headers: window.FacilityApi?.headers?.() || { 'x-access-key': window.getAccessKey?.() || '' },
      });
      if (res.ok) {
        const data = await res.json();
        overdueCount = data.overdue || 0;
      }
    }
  } catch {
    return; // Never block on network error
  }

  if (overdueCount === 0) return;

  // ── 3. Inject CSS ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
#vb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: sans-serif;
}
.vb-box {
  background: #fff;
  border-radius: 14px;
  padding: 2.5rem 3rem;
  max-width: 480px;
  width: 92%;
  text-align: center;
  box-shadow: 0 12px 48px rgba(0,0,0,0.30);
}
.vb-block .vb-icon  { font-size: 3rem; margin-bottom: 0.5rem; }
.vb-block .vb-title { color: #b91c1c; font-size: 1.4rem; font-weight: 800; margin-bottom: 0.75rem; }
.vb-block .vb-body  { color: #374151; font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
.vb-block           { border-top: 6px solid #b91c1c; }
.vb-warning .vb-icon  { font-size: 3rem; margin-bottom: 0.5rem; }
.vb-warning .vb-title { color: #b45309; font-size: 1.4rem; font-weight: 800; margin-bottom: 0.75rem; }
.vb-warning .vb-body  { color: #374151; font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem; }
.vb-warning           { border-top: 6px solid #d97706; }
.vb-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  flex-direction: column;
  align-items: center;
}
.vb-btn-primary {
  background: #1d4ed8;
  color: #fff;
  padding: 0.65rem 1.5rem;
  border-radius: 7px;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.95rem;
  border: none;
  cursor: pointer;
  display: inline-block;
}
.vb-btn-primary:hover { background: #1e40af; }
.vb-btn-secondary {
  background: #f3f4f6;
  color: #374151;
  padding: 0.65rem 1.5rem;
  border-radius: 7px;
  border: 1px solid #d1d5db;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
}
.vb-btn-secondary:hover { background: #e5e7eb; }
.vb-btn-override {
  background: transparent;
  color: #9ca3af;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #4b5563;
  font-size: 0.82rem;
  cursor: pointer;
  margin-top: 0.5rem;
}
.vb-btn-override:hover { color: #f3f4f6; border-color: #9ca3af; }
.vb-contact {
  margin-top: 1.25rem;
  font-size: 0.85rem;
  color: #6b7280;
}
#vb-escape-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  z-index: 100000;
  display: none;
  align-items: center;
  justify-content: center;
}
.vb-escape-box {
  background: #fff;
  border-radius: 12px;
  padding: 2rem 2.5rem;
  max-width: 460px;
  width: 94%;
  box-shadow: 0 16px 60px rgba(0,0,0,0.4);
}
.vb-escape-title   { font-size: 1.2rem; font-weight: 800; color: #111827; margin-bottom: 0.75rem; }
.vb-escape-warning { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 7px; padding: 0.75rem 1rem; font-size: 0.88rem; color: #92400e; margin-bottom: 1.25rem; }
.vb-label          { display: block; font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 0.35rem; text-align: left; }
.vb-required       { color: #dc2626; font-weight: 400; }
.vb-textarea       { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.6rem 0.75rem; font-size: 0.9rem; resize: vertical; box-sizing: border-box; }
.vb-textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
.vb-char-count     { font-size: 0.78rem; color: #6b7280; margin-top: 0.25rem; margin-bottom: 1rem; text-align: left; }
.vb-input          { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.6rem 0.75rem; font-size: 0.9rem; box-sizing: border-box; margin-bottom: 1rem; }
.vb-input:focus    { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
.vb-escape-error   { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 0.6rem 0.75rem; font-size: 0.85rem; color: #b91c1c; margin-bottom: 0.75rem; }
.vb-escape-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
@media (prefers-color-scheme: dark) {
  .vb-box        { background: #1f2937; }
  .vb-body       { color: #d1d5db; }
  .vb-contact    { color: #9ca3af; }
  .vb-btn-secondary { background: #374151; color: #f3f4f6; border-color: #4b5563; }
}
  `;
  document.head.appendChild(style);

  // ── 4. Inject overlay ─────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'vb-overlay';
  overlay.innerHTML = `
    <div class="vb-box ${isPermitted ? 'vb-warning' : 'vb-block'}">
      <div class="vb-icon">${isPermitted ? '⚠' : '🔒'}</div>
      <h2 class="vb-title">
        ${isPermitted
          ? 'Overdue Verifications — Action Required'
          : 'System Locked — Verifications Overdue'}
      </h2>
      <p class="vb-body">
        <strong>${overdueCount} record${overdueCount !== 1 ? 's' : ''}</strong>
        ${overdueCount !== 1 ? 'have' : 'has'} been awaiting verification for more than <strong>48 hours</strong>.
        ${isPermitted
          ? 'Please verify these records as soon as possible.'
          : 'You cannot use the system until all overdue records are verified by an authorised user.'}
      </p>
      <div class="vb-actions">
        <a href="/pages/awaiting-verification.html" class="vb-btn-primary">
          View Verifications (${overdueCount})
        </a>
        ${isPermitted
          ? '<button type="button" id="vb-continue" class="vb-btn-secondary">Continue to system</button>'
          : '<button type="button" id="vb-override-btn" class="vb-btn-override">Override — Enter Reason</button>'}
      </div>
    </div>

    ${!isPermitted ? `
    <div id="vb-escape-modal" style="display:none;">
      <div class="vb-escape-box">
        <h3 class="vb-escape-title">Override Verification Block</h3>
        <p class="vb-escape-warning">
          ⚠ This override will be <strong>permanently recorded</strong> in the audit log with your name, passkey identity, reason, and timestamp.
        </p>

        <label class="vb-label" for="vb-reason">
          Reason for override <span class="vb-required">(minimum 20 characters)</span>
        </label>
        <textarea
          id="vb-reason"
          class="vb-textarea"
          rows="4"
          maxlength="500"
          placeholder="Explain why you need to access the system before verifications are completed..."
        ></textarea>
        <div class="vb-char-count">
          <span id="vb-char-current">0</span> / 20 minimum
        </div>

        <label class="vb-label" for="vb-passkey">Your passkey</label>
        <input
          type="password"
          id="vb-passkey"
          class="vb-input"
          placeholder="Enter your passkey"
          autocomplete="off"
          inputmode="numeric"
        />

        <div id="vb-escape-error" class="vb-escape-error" style="display:none;"></div>

        <div class="vb-escape-actions">
          <button type="button" id="vb-escape-submit" class="vb-btn-primary" disabled>
            Submit Override
          </button>
          <button type="button" id="vb-escape-cancel" class="vb-btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
    ` : ''}
  `;
  document.body.appendChild(overlay);

  // ── 5. Permitted users can dismiss ────────────────────────────────────────
  if (isPermitted) {
    const continueBtn = document.getElementById('vb-continue');
    if (continueBtn) continueBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // ── 6. Blocked users: keyboard guard + override modal ─────────────────────
  if (!isPermitted) {
    overlay.style.pointerEvents = 'all';
    document.addEventListener('keydown', blockKey, true);

    const overrideBtn  = document.getElementById('vb-override-btn');
    const escapeModal  = document.getElementById('vb-escape-modal');
    const reasonEl     = document.getElementById('vb-reason');
    const charCurrent  = document.getElementById('vb-char-current');
    const passkeyEl    = document.getElementById('vb-passkey');
    const submitBtn    = document.getElementById('vb-escape-submit');
    const cancelBtn    = document.getElementById('vb-escape-cancel');
    const errorEl      = document.getElementById('vb-escape-error');

    overrideBtn.addEventListener('click', () => {
      escapeModal.style.display = 'flex';
      reasonEl.focus();
    });

    cancelBtn.addEventListener('click', () => {
      escapeModal.style.display = 'none';
      reasonEl.value = '';
      passkeyEl.value = '';
      errorEl.style.display = 'none';
      charCurrent.textContent = '0';
      submitBtn.disabled = true;
    });

    function updateSubmitState() {
      const len = reasonEl.value.trim().length;
      charCurrent.textContent = len;
      charCurrent.style.color = len >= 20 ? '#16a34a' : '#dc2626';
      submitBtn.disabled = !(len >= 20 && passkeyEl.value.length > 0);
    }
    reasonEl.addEventListener('input', updateSubmitState);
    passkeyEl.addEventListener('input', updateSubmitState);

    submitBtn.addEventListener('click', async () => {
      const reason   = reasonEl.value.trim();
      const passkey  = passkeyEl.value.trim();
      const userName = window.__currentUserName || sessionStorage.getItem('userName') || 'Unknown';
      const userRole = window.__currentUserRole || sessionStorage.getItem('userRole') || 'Unknown';

      if (reason.length < 20) { showError('Reason must be at least 20 characters.'); return; }
      if (!passkey)            { showError('Passkey is required.'); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying…';
      errorEl.style.display = 'none';

      try {
        // 1. Validate passkey
        const verifyRes = await fetch(apiBase + '/api/passkey/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-key': window.getAccessKey?.() || '',
          },
          body: JSON.stringify({ passkey }),
        });
        const verifyData = verifyRes.ok ? await verifyRes.json() : {};
        const passkeyValid = verifyData.valid === true || verifyData.ok === true
          || (verifyData.username != null);

        if (!passkeyValid) {
          showError('Passkey not recognised. Please try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Override';
          return;
        }

        // 2. Write audit log entry
        const auditRes = await fetch(apiBase + '/api/audit/block-override', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-access-key': window.getAccessKey?.() || '',
          },
          body: JSON.stringify({
            userName,
            userRole,
            reason,
            overdueCount,
            passkeyIdentity: verifyData.displayName || verifyData.username || userName,
          }),
        });

        if (!auditRes.ok) {
          showError('Failed to write audit log. Override not granted. Contact your administrator.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Override';
          return;
        }

        // 3. Grant access
        sessionStorage.setItem('vb_override_granted', '1');
        overlay.remove();
        document.removeEventListener('keydown', blockKey, true);

      } catch (err) {
        showError('Network error. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Override';
      }
    });

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
  }

  function blockKey(e) {
    if (!['Tab', 'Shift'].includes(e.key)) e.preventDefault();
  }

  // ── 7. Re-check after a verification completes (optional) ─────────────────
  window.addEventListener('verification-completed', async () => {
    try {
      let newCount = 0;
      if (window.VerificationQueue) {
        const q = await window.VerificationQueue.forCurrentUser();
        newCount = (q.records || [])
          .filter(r => r.oldest && +new Date(r.oldest) < cutoff48)
          .reduce((n, r) => n + r.count, 0);
      } else {
        const params = roleKey ? '?role=' + encodeURIComponent(roleKey) : '';
        const res = await fetch(apiBase + '/api/verification/count-overdue' + params, {
          headers: window.FacilityApi?.headers?.() || { 'x-access-key': window.getAccessKey?.() || '' },
        });
        if (res.ok) { const d = await res.json(); newCount = d.overdue || 0; }
      }
      if (newCount === 0) document.getElementById('vb-overlay')?.remove();
    } catch { /* silent */ }
  });

  // Mark as run so we don't inject the overlay twice.
  _ran = true;
}

// ── Fire on login (authSuccess) ───────────────────────────────────────────────
document.addEventListener('authSuccess', initVerificationBlock);

// ── Fire on page load if session was already restored before this script ran ──
if (window.Auth && window.Auth.isAuthenticated()) {
  initVerificationBlock();
} else {
  document.addEventListener('DOMContentLoaded', function () {
    if (window.Auth && window.Auth.isAuthenticated()) initVerificationBlock();
  });
}
})();
