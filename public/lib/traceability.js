(function () {
  const NS = 'batch_link:';
  const seg = s => encodeURIComponent(String(s == null ? '' : s));
  const keyFor = (batchNo, recordKey, subId) =>
    NS + seg(batchNo) + ':' + seg(recordKey) + ':' + seg(subId);
  const batchPrefix = batchNo => NS + seg(batchNo) + ':';

  // Link direction. Every stored row carries `rel`, the relationship of THIS row's batch_no to the
  // record's primary batch (`linked_batch`):
  //   'self'   -- this row IS the record's own product/job batch (no linked_batch)
  //   'input'  -- this batch_no was consumed INTO linked_batch (salt lot, receiving lot, sub-batch)
  //   'output' -- this batch_no was produced FROM linked_batch (a rework/split job number)
  // Default for extra + roster links is 'input': ingredient and consumable batches, and roster
  // sub-batches rolling up into a job, are overwhelmingly inputs. A record that splits or reworks
  // one batch into a new one declares rel:'output' explicitly.
  const REL_INPUT = 'input';
  const REL_OUTPUT = 'output';
  const REL_SELF = 'self';

  function normExtraFields(config) {
    // Accepts ['saltBatchCode', ...] or [{ field:'saltBatchCode', rel:'input' }, ...] or a mix.
    return (config.extraBatchFields || []).map(function (e) {
      if (typeof e === 'string') return { field: e, rel: REL_INPUT };
      if (e && e.field) return { field: e.field, rel: e.rel === REL_OUTPUT ? REL_OUTPUT : REL_INPUT };
      return null;
    }).filter(Boolean);
  }

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

  function sortRows(rows) {
    return rows.sort((a, b) => {
      const da = a.occurred_on || '', db = b.occurred_on || '';
      if (da && db && da !== db) return da < db ? -1 : 1;
      return (a.updated_at || '') < (b.updated_at || '') ? -1 : 1;
    });
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
        JSON.stringify(Object.assign({ batch_no: batchNo, rel: REL_SELF }, baseRow)),
        true
      );


      for (const spec of normExtraFields(config)) {
        const extraNo = String(values[spec.field] || '').trim();
        if (!extraNo || extraNo === batchNo) continue;
        await window.storage.set(
          keyFor(extraNo, config.recordKey, sub.id + ':' + spec.field),
          JSON.stringify(Object.assign(
            { batch_no: extraNo, linked_batch: batchNo, rel: spec.rel, link_field: spec.field },
            baseRow
          )),
          true
        );
      }


      const rosterCfg = config.roster || {};
      const rbCol = rosterCfg.batchIdColumn;
      const rbRel = rosterCfg.batchIdRel === REL_OUTPUT ? REL_OUTPUT : REL_INPUT;
      if (rbCol && Array.isArray(sub.roster)) {
        for (let i = 0; i < sub.roster.length; i++) {
          const rowNo = String((sub.roster[i] || {})[rbCol] || '').trim();
          if (!rowNo || rowNo === batchNo) continue;
          await window.storage.set(
            keyFor(rowNo, config.recordKey, sub.id + ':row' + i),
            JSON.stringify(Object.assign(
              { batch_no: rowNo, linked_batch: batchNo, rel: rbRel, link_field: rbCol },
              baseRow
            )),
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


  // Local prefix scan over the batch_link index. Kept as the fallback and offline path; when the
  // API is reachable `trace` below merges the server's relational answer over the top so that
  // records still draining from the write-ahead queue are not lost.
  async function traceLocal(batchNo) {
    const map = await window.storage.getByPrefix(batchPrefix(String(batchNo).trim()), true);
    return sortRows(parseRows(map));
  }

  function rowId(r) {
    return (r.record_key || '') + '|' + (r.submission_id || '') + '|' + (r.link_field || '');
  }

  async function traceRemote(batchNo) {
    if (!window.FacilityApi) return null;
    try {
      const res = await window.FacilityApi.fetch('/api/trace/' + encodeURIComponent(String(batchNo).trim()));
      if (!res.ok) return null;
      const data = await res.json();
      return data && Array.isArray(data.records) ? data : null;
    } catch (e) {
      return null;
    }
  }

  async function trace(batchNo) {
    const local = await traceLocal(batchNo);
    const remote = await traceRemote(batchNo);
    if (!remote) return local;
    const byId = new Map();
    remote.records.forEach(r => byId.set(rowId(r), r));
    // keep any local row the server hasn't seen yet (unsynced write-ahead queue)
    local.forEach(r => { if (!byId.has(rowId(r))) byId.set(rowId(r), r); });
    return sortRows([...byId.values()]);
  }

  // One-up / one-down genealogy, computed locally from the full index. `rel` on a row is the
  // relationship of that row's batch_no to its linked_batch; the queried batch can be on either
  // side of a link (its own ingredient rows, or another batch's row that names it as linked_batch).
  async function genealogyLocal(batchNo) {
    const all = parseRows(await window.storage.getByPrefix(NS, true));
    const direct = all.filter(r => r.batch_no === batchNo);
    const reverse = all.filter(r => r.linked_batch === batchNo && r.batch_no !== batchNo);
    const inputs = new Set(), outputs = new Set();
    direct.forEach(r => {
      if (!r.linked_batch || r.linked_batch === batchNo) return;
      (r.rel === REL_OUTPUT ? inputs : outputs).add(r.linked_batch);
    });
    reverse.forEach(r => (r.rel === REL_OUTPUT ? outputs : inputs).add(r.batch_no));
    return {
      batch: batchNo,
      records: sortRows(direct.concat(reverse)),
      inputs: [...inputs],
      outputs: [...outputs]
    };
  }

  async function traceGraph(batchNo) {
    const b = String(batchNo).trim();
    const remote = await traceRemote(b);
    if (remote) return remote;
    return genealogyLocal(b);
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

  window.Traceability = { indexSubmission, removeSubmission, trace, traceGraph, knownBatches };
})();
