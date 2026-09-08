(function () {
  async function loadHistory(recordKey) {
    const raw = await window.storage.get('document_revision:' + recordKey, true);
    if (!raw) return [];
    try {
      return JSON.parse(raw.value);
    } catch (e) {
      return [];
    }
  }


  async function getCurrent(recordKey, startAt) {
    const history = await loadHistory(recordKey);
    if (!history.length) return startAt || 1;
    return history[history.length - 1].revisionNumber;
  }


  async function getCurrentDate(recordKey, baselineDate) {
    const history = await loadHistory(recordKey);
    if (!history.length) return baselineDate || null;
    const at = history[history.length - 1].changedAt;
    return at ? new Date(at).toISOString().slice(0, 10) : (baselineDate || null);
  }

  async function history(recordKey) {
    return (await loadHistory(recordKey)).slice().reverse();
  }


  async function bump(recordKey, meta, startAt) {
    meta = meta || {};
    if (!meta.reason || !String(meta.reason).trim()) {
      throw new Error('A reason is required to change the document revision.');
    }
    if (!meta.changedBy || !String(meta.changedBy).trim()) {
      throw new Error('A name is required to change the document revision.');
    }
    if (!meta.changedByTitle || !String(meta.changedByTitle).trim()) {
      throw new Error('A title is required to change the document revision.');
    }
    const existing = await loadHistory(recordKey);
    const nextRevision = existing.length ? existing[existing.length - 1].revisionNumber + 1 : (startAt || 1) + 1;
    const entry = {
      revisionNumber: nextRevision,
      reason: meta.reason,
      changedBy: meta.changedBy,
      changedByTitle: meta.changedByTitle,
      changedAt: Date.now()
    };
    existing.push(entry);
    await window.storage.set('document_revision:' + recordKey, JSON.stringify(existing), true);
    return entry;
  }


  async function bumpAll(items, meta) {
    const out = {};
    for (const item of items) {
      out[item.recordKey] = await bump(item.recordKey, meta, item.startAt);
    }
    return out;
  }


  async function latestAll() {
    const raw = await window.storage.getByPrefix('document_revision:', true);
    const out = {};
    Object.keys(raw || {}).forEach(function (key) {
      const recordKey = key.slice('document_revision:'.length);
      try {
        const hist = JSON.parse(raw[key]);
        if (Array.isArray(hist) && hist.length) out[recordKey] = hist[hist.length - 1];
      } catch (e) {  }
    });
    return out;
  }

  window.DocumentRevision = { getCurrent, getCurrentDate, history, bump, bumpAll, latestAll };
})();
