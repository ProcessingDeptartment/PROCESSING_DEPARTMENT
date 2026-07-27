/*
 * Tracks the document control revision of a RECORD TEMPLATE itself (e.g. "REC 7.2.12 ·
 * Rev 11") 
 * Not the count of no. of records submitted.
 * Revision bumps are required when the record template changes, a specification is updated, or tolerances are changed. This is a document control requirement for the Abagold Processing Facility. (FSSC) 
 * Every bump requires a reason, the name of who made the change, and their title, per the system overview's change-management rules ("every new publish requires a reason... and must indicate who made the change").  
 * Will automatically increment the revision number and record the date of the bump.
 * Will push to master index.html and the record template's HTML file, so the next user will see the new revision number and date.
 * Backed by window.storage (see data-store.js), keyed by an arbitrary recordKey so any
 * record in this system can use it (e.g. 'double-seam-inspection-report').
 */
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

  // Current revision number, or `startAt` (default 1) if this record has never bumped.
  async function getCurrent(recordKey, startAt) {
    const history = await loadHistory(recordKey);
    if (!history.length) return startAt || 1;
    return history[history.length - 1].revisionNumber;
  }

  // Date the current revision took effect, as YYYY-MM-DD. Null when the record has
  // never been bumped here -- the baseline revision came off paper, so its date is
  // only known if the caller supplies `baselineDate`. Never guess one: an invented
  // revision date on a printed record is a document-control failure.
  async function getCurrentDate(recordKey, baselineDate) {
    const history = await loadHistory(recordKey);
    if (!history.length) return baselineDate || null;
    const at = history[history.length - 1].changedAt;
    return at ? new Date(at).toISOString().slice(0, 10) : (baselineDate || null);
  }

  async function history(recordKey) {
    return (await loadHistory(recordKey)).slice().reverse();
  }

  // meta: { reason, changedBy, changedByTitle }. Throws if any are missing.
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

  window.DocumentRevision = { getCurrent, getCurrentDate, history, bump };
})();
