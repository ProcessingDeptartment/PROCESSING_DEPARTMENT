(function () {
  const KEY = k => 'sop_doc:' + k;
  const LINKS_KEY = k => 'sop_record_links:' + k;

  // Roles whose title (lowercase) qualifies a single passkey as sufficient.
  const AUTH_TITLES = ['administrator', 'ppicm', 'production manager', 'qa manager'];

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

  async function loadRecordLinks(recordKey) {
    try {
      const raw = await window.storage.get(LINKS_KEY(recordKey), true);
      const arr = raw ? JSON.parse(raw.value) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  async function resolve(recordKey, defaults) {
    const stored = await loadOverrides(recordKey);
    const related = (stored.relatedDocs || defaults.relatedDocs || []).slice();

    const seen = new Set(related.map(d => String(d.code || '').trim().toLowerCase()));
    for (const link of await loadRecordLinks(recordKey)) {
      const code = String(link.code || '').trim();
      if (!code || seen.has(code.toLowerCase())) continue;
      seen.add(code.toLowerCase());
      related.push({ code: code, name: link.name || '' });
    }
    return {
      sopNo: stored.sopNo || defaults.sopNo,
      name: stored.name || defaults.name,
      area: defaults.area || '',
      sections: Object.assign({}, defaults.sections, stored.sections),
      relatedDocs: related
    };
  }

  function canEdit() {
    return !window.PermissionRules || window.PermissionRules.can('manageSOPs');
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

    /* ── Passkey step modal ───────────────────────────────────────────── */
    .spk-overlay{ position:fixed; inset:0; background:rgba(20,25,30,.55); z-index:700;
                  align-items:center; justify-content:center; display:none; padding:16px; }
    .spk-overlay.open{ display:flex; }
    .spk-box{ background:var(--paper); border-radius:10px; width:min(500px,96vw);
              box-shadow:0 8px 40px rgba(0,0,0,.3); overflow:hidden; }
    .spk-head{ background:var(--dark); color:var(--dark-text); padding:14px 18px;
               display:flex; align-items:center; justify-content:space-between; }
    .spk-head h3{ margin:0; font-size:14px; font-weight:600; }
    .spk-head button{ background:none; border:none; color:var(--dark-text); font-size:18px;
                      cursor:pointer; opacity:.7; line-height:1; padding:0; }
    .spk-head button:hover{ opacity:1; }
    .spk-body{ padding:16px; display:flex; flex-direction:column; gap:14px; }
    .spk-slot-label{ font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:.05em;
                     color:var(--label); margin-bottom:3px; }
    .spk-slot-sub{ font-size:11px; color:var(--label); margin-bottom:6px; }
    .spk-row{ display:flex; gap:8px; align-items:center; }
    .spk-display{ flex:1; border:1px solid var(--border); border-radius:5px; padding:7px 10px;
                  font-size:16px; letter-spacing:4px; background:var(--paper); color:var(--ink);
                  min-height:36px; }
    .spk-display.verified{ border-color:#2e7d32; background:#e8f5e9; color:#2e7d32;
                           letter-spacing:1px; font-size:13px; }
    .spk-display.error{ border-color:#c0392b; background:#ffebee; }
    .spk-pad-btn{ background:rgba(0,0,0,.08); border:1px solid var(--border); border-radius:5px;
                  padding:5px 10px; cursor:pointer; font-size:12px; font-family:inherit;
                  color:var(--ink); white-space:nowrap; }
    .spk-pad-btn:hover{ background:rgba(0,0,0,.14); }
    .spk-numpad{ display:none; flex-direction:column; gap:4px; margin-top:6px;
                 background:var(--head-bg); border:1px solid var(--border);
                 border-radius:8px; padding:10px; }
    .spk-numpad.open{ display:flex; }
    .spk-numpad-row{ display:flex; gap:5px; justify-content:center; }
    .spk-key{ flex:1; max-width:72px; padding:10px; font-size:17px; font-weight:500;
              border:1px solid var(--border); border-radius:5px; background:var(--paper);
              cursor:pointer; text-align:center; transition:background .1s; color:var(--ink); }
    .spk-key:hover{ background:var(--head-bg); }
    .spk-key.wide{ max-width:none; flex:1.5; font-size:12px; }
    .spk-key.verify-key{ background:var(--primary); color:#fff; border-color:var(--primary); flex:1; max-width:none; font-size:12px; font-weight:700; }
    .spk-key.verify-key:hover{ background:var(--primary-hover); }
    .spk-err{ color:#c0392b; font-size:11.5px; min-height:16px; }
    .spk-foot{ padding:12px 16px; background:var(--head-bg); border-top:1px solid var(--border);
               display:flex; gap:10px; justify-content:flex-end; }
    .spk-btn{ padding:7px 16px; border-radius:5px; font-size:13px; font-weight:600;
              cursor:pointer; border:none; font-family:inherit; }
    .spk-btn-cancel{ background:rgba(0,0,0,.1); color:var(--ink); }
    .spk-btn-cancel:hover{ background:rgba(0,0,0,.18); }
    .spk-btn-ok{ background:var(--primary); color:#fff; }
    .spk-btn-ok:hover{ background:var(--primary-hover); }
    .spk-btn-ok:disabled{ opacity:.45; cursor:default; }

    @media print{
      .dc-actions, .save-bar, .back-link, .row-add, .row-rm{ display:none !important; }
      [contenteditable]{ outline:none; background:none; }
      .sd-related-docs{ page-break-before:always; }
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
    if (document.getElementById('sop-doc-styles')) return;
    const s = document.createElement('style');
    s.id = 'sop-doc-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // ── Passkey numpad HTML builder ─────────────────────────────────────
  function spkNumpadHtml(slot) {
    const d = n => `<button type="button" class="spk-key" onclick="window._sopPk.digit(${slot},'${n}')">${n}</button>`;
    return `
      <div id="spk_pad${slot}" class="spk-numpad">
        <div class="spk-numpad-row">${d(1)}${d(2)}${d(3)}</div>
        <div class="spk-numpad-row">${d(4)}${d(5)}${d(6)}</div>
        <div class="spk-numpad-row">${d(7)}${d(8)}${d(9)}</div>
        <div class="spk-numpad-row">
          <button type="button" class="spk-key wide" onclick="window._sopPk.clear(${slot})">Clear</button>
          ${d(0)}
          <button type="button" class="spk-key wide" onclick="window._sopPk.back(${slot})">⌫</button>
        </div>
        <div class="spk-numpad-row" style="margin-top:4px">
          <button type="button" id="spk_verifyBtn${slot}" class="spk-key verify-key" onclick="window._sopPk.verify(${slot})">Verify</button>
        </div>
      </div>`;
  }

  function spkSlotHtml(slot, label, sublabel) {
    return `
      <div id="spk_slot${slot}">
        <div class="spk-slot-label">${label}</div>
        <div class="spk-slot-sub">${sublabel}</div>
        <div class="spk-row">
          <div class="spk-display" id="spk_display${slot}">—</div>
          <button type="button" class="spk-pad-btn" onclick="window._sopPk.togglePad(${slot})">Enter PIN</button>
          <button type="button" class="spk-pad-btn" style="color:#c0392b" onclick="window._sopPk.reset(${slot})">Reset</button>
        </div>
        ${spkNumpadHtml(slot)}
        <div class="spk-err" id="spk_err${slot}"></div>
      </div>`;
  }

  async function mount(cfg) {
    injectStyles();
    const root = document.getElementById('sop-root');
    root.innerHTML = `
      <div class="dc-top">
        <div class="dc-inner">
          <div class="doc-line"><span class="doc-code" id="sd-code"></span><span id="sd-name"></span></div>
          <div class="dc-meta">
            <div><b id="sd-rev"></b>Revision</div>
            <div><b id="sd-date"></b>Revision Date</div>
            <div><b>${esc(cfg.area)}</b>Area</div>
          </div>
          <div class="dc-actions">
            <button class="btn btn-primary" onclick="window.print()">Print</button>
            <button class="btn btn-ghost" id="sd-editBtn" style="display:none;">Edit</button>
          </div>
        </div>
      </div>
      <div class="doc-body">
        <div class="note">This page is the controlled copy of ${esc(cfg.sopNo)} &mdash; there is no separate original file. Edits made here become the record, with each change logged below under Change Notification.</div>
        <h2>1. Objective</h2>
        <p id="sd-objective"></p>
        <h2>2. Roles and Responsibilities</h2>
        <div id="sd-roles"></div>
        <h2>3. Process</h2>
        <div id="sd-process"></div>
        <h2>4. Review</h2>
        <p id="sd-review"></p>
        <h2 class="sd-related-docs">Related Documents <button class="btn btn-ghost row-add" id="sd-refAdd" style="display:none;">+ Add</button></h2>
        <table class="refs"><tbody id="sd-refBody"></tbody></table>
        <h2>Change Notification</h2>
        <table class="hist">
          <thead><tr><th>Rev</th><th>Reason for Change</th><th>Changed By</th><th>Title</th><th>Date</th></tr></thead>
          <tbody id="sd-histBody"></tbody>
        </table>
        <div class="save-bar" id="sd-saveBar">
          <span class="msg" id="sd-saveBarMsg"></span>
          <div class="dc-actions" style="margin-top:0;">
            <button class="btn btn-ghost" id="sd-cancelBtn">Cancel</button>
            <button class="btn btn-primary" id="sd-saveBtn">Save &amp; Bump Revision</button>
          </div>
        </div>
        <a class="back-link" href="${esc(cfg.backHref || 'sop-list.html')}">&larr; Back to SOP List</a>
      </div>

      <!-- Passkey authorisation step -->
      <div class="spk-overlay" id="sd-pkOverlay">
        <div class="spk-box">
          <div class="spk-head">
            <h3>Authorise Save — ${esc(cfg.sopNo)}</h3>
            <button type="button" onclick="window._sopPk.cancel()">✕</button>
          </div>
          <div class="spk-body" id="sd-pkBody">
            ${spkSlotHtml(1,
              'Authorisation',
              'Administrator, QA Manager or Production Manager — 1 passkey is enough. Anyone else requires a second.'
            )}
            <div id="spk_slot2wrap">
              ${spkSlotHtml(2,
                'Second authorisation <span style="font-size:11px;font-weight:400">(must be a different person)</span>',
                'Administrator, QA Manager or Production Manager'
              )}
            </div>
          </div>
          <div class="spk-foot">
            <button type="button" class="spk-btn spk-btn-cancel" onclick="window._sopPk.cancel()">Cancel</button>
            <button type="button" class="spk-btn spk-btn-ok" id="sd-pkConfirm" onclick="window._sopPk.confirm()">Continue to save…</button>
          </div>
        </div>
      </div>

      <!-- Reason / changed-by modal -->
      <div class="dh-modal" id="sd-modal">
        <div class="dh-modal-inner">
          <h3>Save changes to ${esc(cfg.sopNo)}</h3>
          <p class="dh-hint">Every change to a controlled SOP needs a reason and who made it, so the Change Notification table stays a proper audit trail.</p>
          <label class="dh-f">Reason for change<input type="text" id="sd-reason" placeholder="e.g. Clarified a step"></label>
          <label class="dh-f">Changed by<input type="text" id="sd-changedBy" placeholder="Your name"></label>
          <label class="dh-f">Title<input type="text" id="sd-changedByTitle" placeholder="e.g. QA Manager"></label>
          <div class="dh-error" id="sd-saveError">All three fields are required.</div>
          <div class="dh-actions">
            <button class="btn btn-ghost" id="sd-modalCancel">Cancel</button>
            <button class="btn btn-primary" id="sd-modalSave">Save &amp; Bump Revision</button>
          </div>
        </div>
      </div>
    `;

    const $ = id => document.getElementById(id);
    const startRev = cfg.startRev || 1;
    let editing = false;
    let current = null;

    // ── Passkey step state ──────────────────────────────────────────────
    const pkState = {
      1: { pin: '', verified: false, name: '', title: '', rawPin: '' },
      2: { pin: '', verified: false, name: '', title: '', rawPin: '' },
      singleAuthMode: false  // true once slot 1 verifies as an authorised title
    };

    function pkDots(slot) { return '●'.repeat(pkState[slot].pin.length) || ''; }

    function pkUpdateDisplay(slot) {
      const d = $('spk_display' + slot);
      if (!d) return;
      if (pkState[slot].verified) {
        d.textContent = '✓ ' + pkState[slot].name;
        d.className = 'spk-display verified';
      } else {
        d.textContent = pkDots(slot) || '—';
        d.className = 'spk-display';
      }
    }

    function pkTogglePad(slot) {
      const pad = $('spk_pad' + slot);
      if (!pad || pkState[slot].verified) return;
      pad.classList.toggle('open');
    }

    function pkResetSlot(slot) {
      pkState[slot] = { pin: '', verified: false, name: '', title: '', rawPin: '' };
      pkUpdateDisplay(slot);
      const err = $('spk_err' + slot);
      if (err) err.textContent = '';
      const pad = $('spk_pad' + slot);
      if (pad) pad.classList.remove('open');
    }

    async function pkVerifySlot(slot) {
      const pin = pkState[slot].pin.trim();
      if (pin.length < 4) {
        $('spk_err' + slot).textContent = 'Passkey must be at least 4 digits';
        return;
      }
      const btn = $('spk_verifyBtn' + slot);
      if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }

      try {
        const opts = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passkey: pin, role: window.Auth && window.Auth.getCurrentRole ? window.Auth.getCurrentRole() || '' : '' })
        };
        const resp = window.FacilityApi
          ? await window.FacilityApi.fetch('/api/passkey/verify', opts)
          : await fetch('/api/passkey/verify', opts);
        const data = await resp.json();

        if (!resp.ok) {
          $('spk_err' + slot).textContent = data.error || 'Passkey not recognised';
          pkState[slot].pin = '';
          pkUpdateDisplay(slot);
          return;
        }

        const titleLc = String(data.title || '').toLowerCase();
        const isAuth = AUTH_TITLES.some(f => titleLc.includes(f));

        // Slot 2: must be a different person from slot 1
        if (slot === 2 && pkState[1].verified && data.username && data.username === pkState[1]._username) {
          $('spk_err' + slot).textContent = 'Both passkeys belong to the same person — a second, different person must confirm';
          pkState[slot].pin = '';
          pkUpdateDisplay(slot);
          return;
        }

        pkState[slot].verified = true;
        pkState[slot].name = data.displayName || '';
        pkState[slot].title = data.title || '';
        pkState[slot].rawPin = pin;
        pkState[slot]._username = data.username || '';

        if (slot === 1 && isAuth) {
          // Authorised role — single passkey is enough; hide second slot
          pkState.singleAuthMode = true;
          const wrap2 = $('spk_slot2wrap');
          if (wrap2) wrap2.style.display = 'none';
        } else if (slot === 1 && !isAuth) {
          // Not an authorised title — second passkey required; show slot 2
          pkState.singleAuthMode = false;
          const wrap2 = $('spk_slot2wrap');
          if (wrap2) wrap2.style.display = '';
        }

        pkUpdateDisplay(slot);
        $('spk_err' + slot).textContent = '';
        const pad = $('spk_pad' + slot);
        if (pad) pad.classList.remove('open');

      } catch (e) {
        $('spk_err' + slot).textContent = 'Network error: ' + e.message;
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Verify'; }
      }
    }

    // Public bridge used by inline onclick handlers
    window._sopPk = {
      digit(slot, d) {
        if (pkState[slot].verified) return;
        if (pkState[slot].pin.length < 8) {
          pkState[slot].pin += d;
          pkUpdateDisplay(slot);
          $('spk_err' + slot).textContent = '';
        }
      },
      back(slot) {
        if (pkState[slot].verified) return;
        pkState[slot].pin = pkState[slot].pin.slice(0, -1);
        pkUpdateDisplay(slot);
      },
      clear(slot) {
        if (pkState[slot].verified) return;
        pkState[slot].pin = '';
        pkUpdateDisplay(slot);
      },
      verify: pkVerifySlot,
      reset: pkResetSlot,
      togglePad: pkTogglePad,
      cancel() {
        $('sd-pkOverlay').classList.remove('open');
        pkResetSlot(1); pkResetSlot(2);
        pkState.singleAuthMode = false;
        const wrap2 = $('spk_slot2wrap');
        if (wrap2) wrap2.style.display = '';
      },
      confirm() {
        if (!pkState[1].verified) {
          $('spk_err1').textContent = 'Passkey has not been verified';
          return;
        }
        if (!pkState.singleAuthMode && !pkState[2].verified) {
          $('spk_err2').textContent = 'Second passkey has not been verified';
          return;
        }
        // All good — close passkey overlay, pre-fill reason modal
        $('sd-pkOverlay').classList.remove('open');

        // Pre-fill Changed by / Title from the passkey that was entered
        const byEl = $('sd-changedBy'), titleEl = $('sd-changedByTitle');
        if (byEl && !byEl.value) byEl.value = pkState[1].name;
        if (titleEl && !titleEl.value) titleEl.value = pkState[1].title;

        $('sd-modal').classList.add('open');
      }
    };

    // ── Build a normalised docNo -> href lookup from MasterIndexData ──────
    function buildDocLookup() {
      const map = new Map();
      const rows = window.MasterIndexData && window.MasterIndexData.rows;
      if (!rows) return map;
      for (const row of rows) {
        if (row.docNo && row.href) {
          map.set(row.docNo.replace(/\s+/g,'').toUpperCase(), '../records/' + row.href);
        }
      }
      return map;
    }
    let _docLookup = null;
    function docLookup() { return _docLookup || (_docLookup = buildDocLookup()); }

    function codeLink(code) {
      const norm = code.trim().replace(/[.\s]+$/g, '').replace(/\s+/g, '').toUpperCase();
      const href = docLookup().get(norm);
      const recMatch = /^REC\s*\d/i.test(code.trim());
      if (recMatch) {
        const dest = href || ('#');
        return `<a href="${dest}" class="doc-ref doc-ref--record" title="Open record">${esc(code)}</a>`;
      }
      const sansMatch = /^SANS\s*(\d+(?::\d+)?)$/i.exec(code.trim());
      if (sansMatch) {
        const key = 'SANS-' + sansMatch[1];
        return `<a href="../pages/specifications.html#${key}" class="doc-ref doc-ref--spec" title="View specification">${esc(code)}</a>`;
      }
      return esc(code);
    }

    function refRow(code, name) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="rcode" data-code="true">${codeLink(code)}</td>`
        + `<td data-name="true">${esc(name)}</td>`
        + `<td class="row-rm"><button class="btn btn-ghost" style="padding:2px 8px; font-size:10px;" onclick="this.closest('tr').remove()">Remove</button></td>`;
      return tr;
    }

    function linkifyContent(containerEl) {
      if (!containerEl) return;
      let html = containerEl.innerHTML;
      html = html.replace(/\b(REC\s*\d+(?:\.\d+)*[a-z]?)\b/gi, (match) => {
        const norm = match.replace(/\s+/g, '').toUpperCase();
        const href = docLookup().get(norm) || ('#');
        return `<a href="${href}" class="doc-ref doc-ref--record" title="Open ${esc(match)}">${match}</a>`;
      });
      html = html.replace(/\b(SANS\s*\d+(?::\d+)?)\b/gi, (match) => {
        const key = match.replace(/\s+/g, '-').toUpperCase();
        return `<a href="../pages/specifications.html#${key}" class="doc-ref doc-ref--spec" title="View specification">${match}</a>`;
      });
      html = html.replace(/\bISO(?:\/TS\s*)?\d+(?:[:\-]\d+)*\b/gi, (match) => {
        const key = match.replace(/\s+/g, '-').toUpperCase();
        return `<a href="../pages/specifications.html#${key}" class="doc-ref doc-ref--spec" title="View specification">${match}</a>`;
      });
      html = html.replace(/\b(VC\s*\d+(?::\d+)?)\b/gi, (match) => {
        const key = match.replace(/\s+/g, '-').toUpperCase();
        return `<a href="../pages/specifications.html#${key}" class="doc-ref doc-ref--spec" title="View specification">${match}</a>`;
      });
      html = html.replace(/\bFSSC\s*22000(?:\s*[Vv]\d+)?\b/gi, (match) =>
        `<a href="../pages/specifications.html#FSSC-22000" class="doc-ref doc-ref--cert" title="View certification">${match}</a>`);
      containerEl.innerHTML = html;
    }

    function detectMissingRefs(sections, relatedDocs) {
      const text = [sections.objective, sections.roles, sections.process, sections.review]
        .map(s => (s || '').replace(/<[^>]+>/g, ' ')).join(' ');
      const seen = new Set(relatedDocs.map(d => String(d.code || '').replace(/\s+/g, '').toUpperCase()));
      const extra = [];
      function tryAdd(raw) {
        const norm = raw.replace(/\s+/g, '').toUpperCase();
        if (seen.has(norm)) return;
        seen.add(norm);
        extra.push({ code: raw, name: '' });
      }
      for (const m of text.matchAll(/\bREC\s*(\d+(?:\.\d+)*[a-z]?)\b/gi)) tryAdd(m[0]);
      for (const m of text.matchAll(/\bSANS\s*(\d+(?::\d+)?)\b/gi)) tryAdd(m[0]);
      for (const m of text.matchAll(/\bISO(?:\/TS\s*)?\d+(?:[:\-]\d+)*\b/gi)) tryAdd(m[0]);
      for (const m of text.matchAll(/\bVC\s*(\d+(?::\d+)?)\b/gi)) tryAdd(m[0]);
      for (const m of text.matchAll(/\bFSSC\s*22000(?:\s*[Vv]\d+)?\b/gi)) tryAdd(m[0]);
      return extra;
    }

    function applyResolved(r) {
      $('sd-code').textContent = r.sopNo;
      $('sd-name').textContent = r.name;
      $('sd-objective').innerHTML = r.sections.objective || '';
      $('sd-roles').innerHTML = r.sections.roles || '';
      $('sd-process').innerHTML = r.sections.process || '';
      $('sd-review').innerHTML = r.sections.review || '';
      _docLookup = null; // reset so lookup rebuilds after MasterIndexData loads
      const refBody = $('sd-refBody');
      refBody.innerHTML = '';
      const autoRefs = detectMissingRefs(r.sections, r.relatedDocs);
      const allDocs = [...r.relatedDocs, ...autoRefs];
      if (allDocs.length) {
        allDocs.forEach((doc, i) => {
          const tr = refRow(doc.code, doc.name);
          if (i >= r.relatedDocs.length) tr.classList.add('ref-row--auto');
          refBody.appendChild(tr);
        });
      } else {
        refBody.innerHTML = '<tr><td class="no-refs">No related documents listed.</td></tr>';
      }
      if (!editing) {
        ['sd-objective', 'sd-roles', 'sd-process', 'sd-review'].forEach(id => linkifyContent($(id)));
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
      $('sd-rev').textContent = 'Rev ' + rev;
      if (dateIso) {
        const d = new Date(dateIso);
        $('sd-date').textContent = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
      } else if (cfg.baselineDate) {
        $('sd-date').textContent = cfg.baselineDate;
      }
      const hist = await window.DocumentRevision.history(cfg.recordKey);
      const tbody = $('sd-histBody');
      tbody.innerHTML = '';
      (cfg.baselineHistory || []).forEach(row => tbody.appendChild(histRow(row.rev, row.reason, '—', '—', row.date)));
      hist.slice().reverse().forEach(h => tbody.appendChild(histRow(h.revisionNumber, h.reason, h.changedBy, h.changedByTitle, fmtDate(h.changedAt))));
      $('sd-saveBarMsg').textContent = 'Editing ' + cfg.sopNo + ' — saving bumps this to Rev ' + (rev + 1) + '.';
    }

    function toggleEdit(cancel) {
      editing = !cancel && !editing;
      ['sd-objective', 'sd-roles', 'sd-process', 'sd-review', 'sd-code', 'sd-name'].forEach(id => {
        $(id).setAttribute('contenteditable', editing ? 'true' : 'false');
      });
      document.querySelectorAll('#sd-refBody [data-code], #sd-refBody [data-name]').forEach(el =>
        el.setAttribute('contenteditable', editing ? 'true' : 'false'));
      $('sd-saveBar').classList.toggle('open', editing);
      $('sd-editBtn').textContent = editing ? 'Editing…' : 'Edit';
      $('sd-refAdd').style.display = editing ? '' : 'none';
      document.querySelectorAll('.row-rm').forEach(el => el.style.display = editing ? '' : 'none');
      if (cancel) applyResolved(current);
    }

    $('sd-refAdd').addEventListener('click', () => $('sd-refBody').appendChild(refRow('REC X.X.X', 'New related document')));
    $('sd-editBtn').addEventListener('click', () => toggleEdit());
    $('sd-cancelBtn').addEventListener('click', () => toggleEdit(true));
    $('sd-modalCancel').addEventListener('click', () => $('sd-modal').classList.remove('open'));

    // Save button → open passkey step first
    $('sd-saveBtn').addEventListener('click', () => {
      pkResetSlot(1); pkResetSlot(2);
      pkState.singleAuthMode = false;
      const wrap2 = $('spk_slot2wrap');
      if (wrap2) wrap2.style.display = '';
      // Clear pre-filled reason modal fields so they can be re-filled from passkey
      $('sd-changedBy').value = '';
      $('sd-changedByTitle').value = '';
      $('sd-reason').value = '';
      $('sd-pkOverlay').classList.add('open');
    });

    $('sd-modalSave').addEventListener('click', async () => {
      const reason = $('sd-reason'), changedBy = $('sd-changedBy'), title = $('sd-changedByTitle');
      const err = $('sd-saveError');
      [reason, changedBy, title].forEach(el => el.classList.remove('err'));
      let ok = true;
      [reason, changedBy, title].forEach(el => { if (!el.value.trim()) { el.classList.add('err'); ok = false; } });
      err.style.display = ok ? 'none' : 'block';
      if (!ok) return;

      const relatedDocs = Array.from(document.querySelectorAll('#sd-refBody tr')).filter(tr => tr.querySelector('[data-code]')).map(tr => ({
        code: tr.querySelector('[data-code]').textContent.trim(),
        name: tr.querySelector('[data-name]').textContent.trim()
      }));
      await saveOverrides(cfg.recordKey, {
        sopNo: $('sd-code').textContent.trim(),
        name: $('sd-name').textContent.trim(),
        sections: {
          objective: $('sd-objective').innerHTML,
          roles: $('sd-roles').innerHTML,
          process: $('sd-process').innerHTML,
          review: $('sd-review').innerHTML
        },
        relatedDocs
      });
      await window.DocumentRevision.bump(cfg.recordKey, {
        reason: reason.value.trim(), changedBy: changedBy.value.trim(), changedByTitle: title.value.trim()
      }, startRev);

      // Extract cross-references from the newly saved content and sync the registry
      try {
        const plainText = [
          $('sd-objective').textContent,
          $('sd-roles').textContent,
          $('sd-process').textContent,
          $('sd-review').textContent
        ].join(' ');
        if (window.SopRefSync) {
          await window.SopRefSync.sync(cfg.recordKey, $('sd-code').textContent.trim() + ' ' + $('sd-name').textContent.trim(), plainText);
        }
      } catch (e) { console.warn('ref sync failed (non-fatal)', e); }

      reason.value = ''; changedBy.value = ''; title.value = '';
      $('sd-modal').classList.remove('open');
      // Clear passkey state after successful save
      pkResetSlot(1); pkResetSlot(2);
      pkState.singleAuthMode = false;
      current = await resolve(cfg.recordKey, cfg);
      toggleEdit(true);
      await refreshHeader();
    });

    if (window.DocHeader) {
      try {
        await window.DocHeader.mountPrintHeader({
          recordKey: cfg.recordKey,
          defaults: { document: cfg.name, docNumber: cfg.sopNo },
          revisionStart: cfg.startRev || 1
        });
      } catch (e) { console.error('SOP title block unavailable', e); }
    }

    current = await resolve(cfg.recordKey, cfg);
    applyResolved(current);
    await refreshHeader();
    $('sd-editBtn').style.display = canEdit() ? '' : 'none';
  }

  // SopRefSync.sync(sourceKey, sourceTitle, plainText) — fire-and-forget ref extraction + API POST
  const SopRefSync = {
    async sync(sourceKey, sourceTitle, plainText) {
      const { extractReferences } = await import('./ref-extractor.js');
      const refs = extractReferences(plainText).map(r => ({
        targetType: r.targetType,
        targetKey: r.targetKey,
        targetLabel: r.targetKey,
        contextText: r.contextText
      }));
      const API_BASE = window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com';
      const apiKey = (() => { try { return localStorage.getItem('facility_api_key') || ''; } catch { return ''; } })();
      const h = { 'Content-Type': 'application/json' };
      if (apiKey) h.Authorization = 'Bearer ' + apiKey;
      await fetch(API_BASE + '/api/refs/sync', {
        method: 'POST', headers: h,
        body: JSON.stringify({ sourceType: 'sop', sourceKey, sourceTitle, refs })
      });
    }
  };

  window.SopDoc = { resolve, saveOverrides, loadOverrides, canEdit, esc, mount };
  window.SopRefSync = SopRefSync;
})();
