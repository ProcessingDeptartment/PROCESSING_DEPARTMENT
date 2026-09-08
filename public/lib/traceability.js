(function () {
  const NS = 'batch_link:';
  const seg = s => encodeURIComponent(String(s == null ? '' : s));
  const keyFor = (batchNo, recordKey, subId) =>
    NS + seg(batchNo) + ':' + seg(recordKey) + ':' + seg(subId);
  const batchPrefix = batchNo => NS + seg(batchNo) + ':';

  function parseRows(map) {
    const rows = [];
    Object.keys(map || {}).forEach(function (k) {
      try {
        const row = JSON.parse(map[k]);
        if (row && typeof row === 'object') rows.push(row);
      } catch (e) {  }
    });
    return rows;
  }

  function firstDateField(config) {
    const fields = [];

    (config.sections || []).forEach(sec => (sec.fields || []).forEach(f => fields.push(f)));
    (config.entryFields || config.fields || []).forEach(f => fields.push(f));
    const d = fields.find(f => f.type === 'date');
    return d ? d.key : null;
  }


  function hrefForThisPage(config, sub) {
    const file = (config && config.pageFile) || location.pathname.split('/').pop() || '';
    return sub && sub.id ? file + '#' + sub.id : file;
  }


  async function indexSubmission(config, sub) {
    try {
      if (!config || !config.batchField || !sub) return;

      const values = sub.values || {};
      const batchNo = String(values[config.batchField] || '').trim();


      await removeSubmission(config.recordKey, sub.id);
      if (!batchNo) return;

      const dateField = config.batchDateField || firstDateField(config);
      let occurredOn = dateField ? String(values[dateField] || '').trim() : '';
      if (!occurredOn && values.date) occurredOn = String(values.date).trim();
      let summary = '';
      try { summary = config.traceSummary ? String(config.traceSummary(sub) || '') : ''; } catch (e) { summary = ''; }

      const baseRow = {
        record_key: config.recordKey,
        record_title: config.title || config.recordKey,
        submission_id: sub.id,
        stage: config.stage || null,
        occurred_on: occurredOn || null,
        href: hrefForThisPage(config, sub),
        summary: summary || null,
        updated_at: new Date().toISOString()
      };
      await window.storage.set(
        keyFor(batchNo, config.recordKey, sub.id),
        JSON.stringify(Object.assign({ batch_no: batchNo }, baseRow)),
        true
      );


      for (const field of (config.extraBatchFields || [])) {
        const extraNo = String(values[field] || '').trim();
        if (!extraNo || extraNo === batchNo) continue;
        await window.storage.set(
          keyFor(extraNo, config.recordKey, sub.id + ':' + field),
          JSON.stringify(Object.assign({ batch_no: extraNo, linked_batch: batchNo }, baseRow)),
          true
        );
      }


      const rbCol = config.roster && config.roster.batchIdColumn;
      if (rbCol && Array.isArray(sub.roster)) {
        for (let i = 0; i < sub.roster.length; i++) {
          const rowNo = String((sub.roster[i] || {})[rbCol] || '').trim();
          if (!rowNo || rowNo === batchNo) continue;
          await window.storage.set(
            keyFor(rowNo, config.recordKey, sub.id + ':row' + i),
            JSON.stringify(Object.assign({ batch_no: rowNo, linked_batch: batchNo }, baseRow)),
            true
          );
        }
      }
    } catch (e) {
      console.warn('[traceability] index failed (record still saved)', e);
    }
  }


  async function removeSubmission(recordKey, submissionId) {
    try {
      const map = await window.storage.getByPrefix(NS, true);
      const suffix = ':' + seg(recordKey) + ':' + seg(submissionId);
      const doomed = Object.keys(map || {}).filter(function (k) {
        return k.endsWith(suffix) || k.includes(suffix + '%3A');
      });
      for (const k of doomed) await window.storage.remove(k, true);
    } catch (e) {
      console.warn('[traceability] remove failed', e);
    }
  }


  async function trace(batchNo) {
    const map = await window.storage.getByPrefix(batchPrefix(String(batchNo).trim()), true);
    return parseRows(map).sort((a, b) => {
      const da = a.occurred_on || '', db = b.occurred_on || '';
      if (da && db && da !== db) return da < db ? -1 : 1;
      return (a.updated_at || '') < (b.updated_at || '') ? -1 : 1;
    });
  }


  async function knownBatches() {
    try {
      const rows = parseRows(await window.storage.getByPrefix(NS, true));
      rows.sort((a, b) => (a.updated_at || '') < (b.updated_at || '') ? 1 : -1);
      const seen = [];
      rows.forEach(r => { if (r.batch_no && seen.indexOf(r.batch_no) === -1) seen.push(r.batch_no); });
      return seen;
    } catch (e) {
      console.warn('[traceability] knownBatches failed', e);
      return [];
    }
  }

  window.Traceability = { indexSubmission, removeSubmission, trace, knownBatches };
})();
