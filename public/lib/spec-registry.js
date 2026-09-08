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

  async function getPublished(specKey) {
    const entry = await getLatestEntry(specKey);
    if (!entry) return null;
    return await getVersion(specKey, entry.versionNumber);
  }

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
