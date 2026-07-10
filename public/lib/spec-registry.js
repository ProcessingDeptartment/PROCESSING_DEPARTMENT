/*
 * Versioned specification storage, shared by any record that needs manufacturer/
 * product specs (tolerances, minimums, etc.) with a real revision history.
 *
 * Each spec profile is identified by a specKey (e.g. a profile id). Every change to
 * a profile's data creates a new, numbered version with a required change reason and
 * publisher -- it does not overwrite history. The previously published version is kept
 * (marked OBSOLETE) so "what did the spec say on date X" can always be answered later.
 *
 * This does not yet implement an approve-before-publish queue (see System overview's
 * "apply / approve function") -- proposeVersion() publishes immediately. Gate who is
 * allowed to call it using PermissionRules.can('publishSpecVersion') in the caller.
 *
 * Backed by window.storage (see data-store.js), so it inherits the same swap point
 * when server-side storage replaces localStorage.
 */
(function () {
  async function loadIndex(specKey) {
    const raw = await window.storage.get('spec_versions_index:' + specKey, true);
    if (!raw) return [];
    try {
      return JSON.parse(raw.value);
    } catch (e) {
      return [];
    }
  }

  async function saveIndex(specKey, index) {
    await window.storage.set('spec_versions_index:' + specKey, JSON.stringify(index), true);
  }

  async function getVersion(specKey, versionNumber) {
    const raw = await window.storage.get('spec_version:' + specKey + ':' + versionNumber, true);
    if (!raw) return null;
    try {
      return JSON.parse(raw.value);
    } catch (e) {
      return null;
    }
  }

  async function getLatestEntry(specKey) {
    const idx = await loadIndex(specKey);
    if (!idx.length) return null;
    return idx.slice().sort((a, b) => b.versionNumber - a.versionNumber)[0];
  }

  // Latest published spec content, or null if this specKey has never been published.
  async function getPublished(specKey) {
    const entry = await getLatestEntry(specKey);
    if (!entry) return null;
    return await getVersion(specKey, entry.versionNumber);
  }

  // data: the spec JSON object (may itself carry a pdfDataUrl for the original doc).
  // meta: { changeReason, publishedBy, changedByTitle }.
  // Throws if any of those is missing -- every version must be attributable (who, what
  // title, and why), per the system overview's change-management rules.
  async function proposeVersion(specKey, data, meta) {
    meta = meta || {};
    if (!meta.changeReason || !String(meta.changeReason).trim()) {
      throw new Error('A change reason is required to publish a spec version.');
    }
    if (!meta.publishedBy || !String(meta.publishedBy).trim()) {
      throw new Error('A name is required to publish a spec version.');
    }
    if (!meta.changedByTitle || !String(meta.changedByTitle).trim()) {
      throw new Error('A title is required to publish a spec version.');
    }
    const idx = await loadIndex(specKey);
    const nextVersion = idx.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;
    idx.forEach((v) => {
      if (v.status === 'PUBLISHED') v.status = 'OBSOLETE';
    });
    const publishedAt = Date.now();
    idx.push({
      versionNumber: nextVersion,
      status: 'PUBLISHED',
      changeReason: meta.changeReason,
      publishedBy: meta.publishedBy,
      changedByTitle: meta.changedByTitle,
      publishedAt
    });
    await saveIndex(specKey, idx);
    const full = Object.assign({}, data, {
      versionNumber: nextVersion,
      changeReason: meta.changeReason,
      publishedBy: meta.publishedBy,
      changedByTitle: meta.changedByTitle,
      publishedAt
    });
    await window.storage.set('spec_version:' + specKey + ':' + nextVersion, JSON.stringify(full), true);
    return full;
  }

  async function history(specKey) {
    const idx = await loadIndex(specKey);
    return idx.slice().sort((a, b) => b.versionNumber - a.versionNumber);
  }

  window.SpecRegistry = { getPublished, getVersion, proposeVersion, history };
})();
