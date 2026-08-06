(function () {
  const STORAGE_PREFIX = 'handover-db:';
  const INDEX_KEY = STORAGE_PREFIX + 'index';
  const RECORD_PREFIX = STORAGE_PREFIX + 'record:';
  const UNSAVED_PREFIX = STORAGE_PREFIX + 'unsaved:';
  const SYNC_QUEUE_KEY = STORAGE_PREFIX + 'sync-queue';

  // URL of the standalone handover-backend service (separate container/deploy).
  // Override before this script loads with: window.HANDOVER_BACKEND_URL = '...'
  const BACKEND_URL = window.HANDOVER_BACKEND_URL || 'https://handover-backend.onrender.com';

  const pageConfigs = [
    { suffix: 'production-handover-report.html', pageKey: 'production', pageLabel: 'Production' },
    { suffix: 'quality-handover-report.html', pageKey: 'quality', pageLabel: 'Quality' }
  ];

  const pageConfig = pageConfigs.find(cfg => window.location.pathname.includes(cfg.suffix));
  if (!pageConfig) {
    return;
  }

  const root = document.querySelector('.max-w-5xl') || document.body;
  let statusEl = null;
  let loadBtn = null;
  let saveBtn = null;
  let recordSelect = null;

  let debounceTimer = null;

  function getInputValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function getCurrentRecordId() {
    const date = getInputValue('hDate');
    const shift = getInputValue('hShift');
    if (!date || !shift) {
      return null;
    }
    return `${pageConfig.pageKey}:${date}:${shift}`;
  }

  function getRecordKey(recordId) {
    return RECORD_PREFIX + recordId;
  }

  function getUnsavedKey() {
    return UNSAVED_PREFIX + pageConfig.pageKey;
  }

  function updateStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#b91c1c' : '#0f172a';
  }

  function getSavedRecordsForSelect() {
    return getAllSavedRecords().map(record => {
      const [, date, shift] = record.id.split(':');
      return {
        id: record.id,
        label: `${date} - ${shift} (${record.status || 'draft'})`
      };
    }).sort((a, b) => a.id.localeCompare(b.id));
  }

  function populateRecordSelect() {
    if (!recordSelect) return;
    const records = getSavedRecordsForSelect();
    recordSelect.innerHTML = '';
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'Select saved handover';
    recordSelect.appendChild(emptyOption);
    records.forEach(record => {
      const opt = document.createElement('option');
      opt.value = record.id;
      opt.textContent = record.label;
      recordSelect.appendChild(opt);
    });
  }

  function selectSavedRecord(recordId) {
    if (!recordId) return;
    const record = getAllSavedRecords().find(r => r.id === recordId);
    if (!record) {
      updateStatus('Selected saved handover not found.', true);
      return;
    }
    const [, date, shift] = recordId.split(':');
    const dateEl = document.getElementById('hDate');
    const shiftEl = document.getElementById('hShift');
    if (dateEl) dateEl.value = date;
    if (shiftEl) shiftEl.value = shift;
    restoreFormState(record);
    updateStatus(`Loaded saved handover ${recordId}.`);
  }

  function getIndex() {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveIndex(index) {
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    } catch (e) {
      console.error('handover-db: unable to save index', e);
    }
  }

  function getAllRecords() {
    const records = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(RECORD_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const state = JSON.parse(raw);
        const id = key.slice(RECORD_PREFIX.length);
        if (state.page !== pageConfig.pageKey) continue;
        records.push({ id, ...state });
      } catch (e) {
        console.error('handover-db: invalid record in storage', key, e);
      }
    }
    return records;
  }

  function getAllSavedRecords() {
    return getAllRecords().filter(record => record.status !== 'submitted');
  }

  function collectFormState() {
    const state = {
      page: pageConfig.pageKey,
      pageLabel: pageConfig.pageLabel,
      updatedAt: Date.now(),
      status: 'draft',
      fields: {},
      bubbleButtons: {},
      jobLists: {},
      savedAt: null
    };

    const fieldElements = Array.from(root.querySelectorAll('input,textarea,select'));
    fieldElements.forEach(el => {
      const key = el.id || el.name;
      if (!key) return;
      if (el.type === 'checkbox' || el.type === 'radio') {
        state.fields[key] = { type: el.type, checked: el.checked, value: el.value };
      } else {
        state.fields[key] = { type: el.type || el.tagName.toLowerCase(), value: el.value };
      }
    });

    const bubbleButtons = Array.from(root.querySelectorAll('.bubble-btn[data-name]'));
    bubbleButtons.forEach(btn => {
      state.bubbleButtons[btn.dataset.name] = {
        conforming: btn.classList.contains('conforming'),
        nc: btn.classList.contains('nc')
      };
    });

    Array.from(root.querySelectorAll('.section-job-list, #nrcs-container')).forEach(container => {
      if (!container.id) return;
      state.jobLists[container.id] = container.innerHTML;
    });

    return state;
  }

  function restoreFormState(state) {
    if (!state || !state.fields) {
      return;
    }

    Object.entries(state.fields).forEach(([key, info]) => {
      const el = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
      if (!el) return;
      if (info.type === 'checkbox' || info.type === 'radio') {
        el.checked = !!info.checked;
      }
      if (info.value !== undefined) {
        el.value = info.value;
      }
    });

    Object.entries(state.bubbleButtons || {}).forEach(([name, buttonState]) => {
      const btn = root.querySelector(`.bubble-btn[data-name="${CSS.escape(name)}"]`);
      if (!btn) return;
      btn.classList.toggle('conforming', !!buttonState.conforming);
      btn.classList.toggle('nc', !!buttonState.nc);
    });

    Object.entries(state.jobLists || {}).forEach(([containerId, html]) => {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = html;
      }
    });

    if (typeof window.updateComplianceIcons === 'function') {
      window.updateComplianceIcons();
    }
    if (typeof window.validatePrint === 'function') {
      window.validatePrint();
    }
    if (typeof window.updateDaysInDrying === 'function') {
      window.updateDaysInDrying();
    }
  }

  function maybeAssignUnsaved(recordId) {
    const unsavedKey = getUnsavedKey();
    const specificKey = getRecordKey(recordId);
    const unsavedValue = localStorage.getItem(unsavedKey);
    if (!unsavedValue || localStorage.getItem(specificKey)) {
      return;
    }
    localStorage.setItem(specificKey, unsavedValue);
    localStorage.removeItem(unsavedKey);
  }

  function updateIndexForRecord(recordId, state) {
    if (!recordId) return;
    const index = getIndex();
    const [pageKey, date, shift] = recordId.split(':');
    index[recordId] = {
      page: pageKey,
      pageLabel: pageConfig.pageLabel,
      date,
      shift,
      status: state.status,
      updatedAt: state.updatedAt,
      savedAt: state.savedAt || state.updatedAt
    };
    saveIndex(index);
  }

  function saveDraft(options = {}) {
    const recordId = getCurrentRecordId();
    if (!recordId && options.reason === 'manual') {
      updateStatus('Enter a date and shift before saving. Handovers are saved as date + shift.', true);
      return false;
    }

    const state = collectFormState();
    state.status = options.finalize ? 'submitted' : 'draft';
    state.savedAt = Date.now();
    if (options.finalize) {
      state.submittedAt = Date.now();
    }
    const storageKey = recordId ? getRecordKey(recordId) : getUnsavedKey();

    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      if (recordId) {
        maybeAssignUnsaved(recordId);
        updateIndexForRecord(recordId, state);
        if (state.status === 'submitted') {
          removeSavedRecordFromSelect(recordId);
        }
        populateRecordSelect();
        updateStatus(`Saved ${state.status} record ${recordId}.`);
      } else {
        updateStatus('Draft saved locally. Choose a date and shift to store under a handover ID.');
      }
      return { recordId, state };
    } catch (e) {
      console.error('handover-db: save failed', e);
      updateStatus('Save failed: local storage not available.', true);
      return false;
    }
  }

  function removeSavedRecordFromSelect(recordId) {
    if (!recordSelect) return;
    const option = recordSelect.querySelector(`option[value="${CSS.escape(recordId)}"]`);
    if (option) {
      option.remove();
    }
  }

  function loadDraft() {
    const recordId = getCurrentRecordId();
    if (!recordId) {
      updateStatus('Choose a date and shift before loading a saved handover.', true);
      return;
    }

    maybeAssignUnsaved(recordId);
    const storageKey = getRecordKey(recordId);
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      updateStatus(`No saved handover found for ${recordId}.`, true);
      return;
    }

    try {
      const state = JSON.parse(raw);
      restoreFormState(state);
      const statusText = state.status === 'submitted' ? 'submitted' : 'draft';
      updateStatus(`Loaded saved ${statusText} handover for ${recordId}.`);
    } catch (e) {
      console.error('handover-db: load failed', e);
      updateStatus('Saved handover could not be loaded.', true);
    }
  }

  async function syncToBackend(recordId, state) {
    const [, date, shift] = recordId.split(':');
    const ownerName = (state.fields && state.fields.hName && state.fields.hName.value) || '';
    const body = {
      id: recordId,
      page: state.page,
      pageLabel: state.pageLabel,
      date,
      shift,
      ownerName,
      status: state.status,
      updatedAt: state.updatedAt,
      submittedAt: state.submittedAt || null,
      payload: state
    };

    try {
      const resp = await fetch(BACKEND_URL + '/api/handovers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error('Backend returned ' + resp.status);
      removeSyncQueueItem(recordId);
      return true;
    } catch (err) {
      console.warn('handover-db: backend sync failed, queued for retry', err);
      addSyncQueueItem(recordId);
      return false;
    }
  }

  function getSyncQueue() {
    try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]'); } catch { return []; }
  }
  function addSyncQueueItem(recordId) {
    const q = getSyncQueue();
    if (!q.includes(recordId)) { q.push(recordId); }
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q));
  }
  function removeSyncQueueItem(recordId) {
    const q = getSyncQueue().filter(id => id !== recordId);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q));
  }
  async function retrySyncQueue() {
    const q = getSyncQueue();
    for (const recordId of q) {
      const raw = localStorage.getItem(getRecordKey(recordId));
      if (!raw) { removeSyncQueueItem(recordId); continue; }
      try {
        const state = JSON.parse(raw);
        await syncToBackend(recordId, state);
      } catch { /* will retry next time */ }
    }
  }

  async function finalizeAndExport() {
    const recordId = getCurrentRecordId();
    if (!recordId) {
      updateStatus('Cannot finalize: date and shift are required.', true);
      return false;
    }

    const result = saveDraft({ finalize: true });
    if (!result) {
      updateStatus('Finalizing handover failed.', true);
      return false;
    }

    updateStatus('Submitting handover to database...');
    const synced = await syncToBackend(recordId, result.state);
    if (synced) {
      updateStatus(`Handover ${recordId} submitted to database.`);
    } else {
      updateStatus(`Handover ${recordId} saved locally. Will sync to database when connection is available.`);
    }
    return true;
  }

  function debounceSave() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => saveDraft({ reason: 'autosave' }), 600);
  }

  function handleFieldInput(event) {
    const id = event.target.id;
    if (id === 'hDate' || id === 'hShift') {
      checkCurrentRecord();
    }
    debounceSave();
  }

  function handleBubbleClick() {
    setTimeout(() => saveDraft({ reason: 'autosave' }), 100);
  }

  function checkCurrentRecord() {
    const recordId = getCurrentRecordId();
    const unsavedKey = getUnsavedKey();
    const unsavedExists = !!localStorage.getItem(unsavedKey);
    if (!recordId) {
      if (unsavedExists) {
        updateStatus('Temporary draft exists. Choose a date and shift to save it under a handover ID.');
      } else {
        updateStatus('Autosave is active. Choose date + shift to identify this handover.');
      }
      return;
    }

    const recordKey = getRecordKey(recordId);
    if (localStorage.getItem(recordKey)) {
      updateStatus(`Existing handover record found for ${recordId}. Click Load draft.`);
      return;
    }

    if (unsavedExists) {
      updateStatus('No saved handover exists for this ID. A temporary draft is available and can be saved here.');
      return;
    }

    updateStatus(`No saved handover exists for ${recordId}. Changes will autosave.`);
  }

  function attachListeners() {
    if (loadBtn) {
      loadBtn.addEventListener('click', loadDraft);
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveDraft({ reason: 'manual' }));
    }
    if (recordSelect) {
      recordSelect.addEventListener('change', () => selectSavedRecord(recordSelect.value));
    }

    const fieldElements = Array.from(root.querySelectorAll('input,textarea,select'));
    fieldElements.forEach(el => {
      el.addEventListener('input', handleFieldInput);
      el.addEventListener('change', handleFieldInput);
    });

    Array.from(root.querySelectorAll('.bubble-btn, .yesno-toggle button')).forEach(button => {
      if (button.classList.contains('handover-db-controls-btn')) return;
      button.addEventListener('click', handleBubbleClick);
    });

    window.addEventListener('beforeunload', () => saveDraft({ reason: 'unload' }));
  }

  function insertStatusPanel() {
    const controls = document.getElementById('handover-db-controls');
    if (controls) return;

    const panel = document.createElement('div');
    panel.id = 'handover-db-controls';
    panel.className = 'no-print';
    panel.style.padding = '1rem';
    panel.style.border = '1px solid #cbd5e1';
    panel.style.background = '#ffffff';
    panel.style.borderRadius = '16px';
    panel.style.marginTop = '1rem';
    panel.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <select id="handover-db-record-select" class="bubble-btn w-full text-left" style="min-height:40px; font-size:12px; background:#f8fafc; border:1px solid #cbd5e1; color:#0f172a;">
            <option value="">Select saved handover</option>
          </select>
        </div>
        <div><button id="handover-db-load-btn" type="button" class="bubble-btn handover-db-controls-btn w-full" style="font-size:12px; background:#2563eb; color:#fff;">Load draft</button></div>
        <div><button id="handover-db-save-btn" type="button" class="bubble-btn handover-db-controls-btn w-full" style="font-size:12px; background:#10b981; color:#fff;">Save now</button></div>
      </div>
      <div id="handover-db-status" class="mt-3 text-sm text-slate-700" style="display:none;"></div>
    `;

    const header = root.querySelector('.report-header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(panel, header.nextSibling);
    } else {
      root.insertBefore(panel, root.firstChild);
    }

    statusEl = document.getElementById('handover-db-status');
    loadBtn = document.getElementById('handover-db-load-btn');
    saveBtn = document.getElementById('handover-db-save-btn');
    recordSelect = document.getElementById('handover-db-record-select');
    populateRecordSelect();
  }

  function init() {
    insertStatusPanel();
    attachListeners();
    window.requestAnimationFrame(() => {
      updateStatus('Autosave is active. Choose date + shift to identify this handover.');
      checkCurrentRecord();
      retrySyncQueue();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.HandoverDB = {
    saveDraft,
    loadDraft,
    finalizeAndExport,
    getAllSavedRecords
  };
})();
