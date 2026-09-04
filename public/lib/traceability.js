/*
 * Batch traceability index for the online records system.
 *
 * Record bodies are stored by the record engines as usual. This lib maintains a thin INDEX
 * alongside them: one entry per (batch number x record x submission), so that given a batch/lot
 * number you can trace every record that touched it -- forwards and backwards along a timeline.
 *
 * A record opts in by declaring in its config:
 *     batchField:      'lotBatchNumber'     // which field holds the PRODUCT batch/lot or job no.
 *     extraBatchFields: ['saltBatchCode']   // (optional) other codes on the SAME submission that
 *                                           // should also be searchable -- e.g. a raw-material
 *                                           // batch used while processing this job. Each gets its
 *                                           // own index entry, cross-linked back to batchField's
 *                                           // value, so tracing either code finds the other.
 *     batchDateField:  'dateReceived'       // (optional) field to order the timeline by
 *     stage:           'intake'             // (optional) process stage label
 *     traceSummary:    sub => '...'         // (optional) one-line summary for the trace view
 * The shared engines call Traceability.indexSubmission() after every save; records with no
 * batchField never touch the index, so the ~40 differently-named ingredient "batch" fields never
 * create false links unless explicitly opted in via extraBatchFields.
 *
 * === STORAGE ===
 * Every entry goes through window.storage (see data-store.js) as a normal shared key:
 *
 *     batch_link:<batchNo>:<recordKey>:<submissionId>   ->  JSON row
 *
 * Segments are URI-encoded so a ':' inside a batch number can't split the key. Because this uses
 * the same adapter as everything else, connecting the real backend later moves traceability with
 * it -- there is no separate database handle to wire up. If the future API can answer these more
 * efficiently with a real relational query, override window.Traceability.trace/knownBatches after
 * this file loads; nothing else calls the index directly.
 *
 * All writes are best-effort: if the index fails, the record still saves normally.
 */
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
      } catch (e) { /* skip an unreadable entry rather than break the whole trace */ }
    });
    return rows;
  }

  function firstDateField(config) {
    const fields = [];
    // form-record.js groups fields under sections; monitoring-log.js uses a flat entryFields list.
    (config.sections || []).forEach(sec => (sec.fields || []).forEach(f => fields.push(f)));
    (config.entryFields || config.fields || []).forEach(f => fields.push(f));
    const d = fields.find(f => f.type === 'date');
    return d ? d.key : null;
  }

  // Normally the record indexes itself from its own page, so the current filename IS the link.
  // A config may name `pageFile` instead, for the one caller that indexes on another record's
  // behalf -- the backfill tool, which runs from pages/ and must still link back to records/.
  function hrefForThisPage(config, sub) {
    const file = (config && config.pageFile) || location.pathname.split('/').pop() || '';
    return sub && sub.id ? file + '#' + sub.id : file;
  }

  // Upsert (or clear) the index entry for one submission of one record.
  async function indexSubmission(config, sub) {
    try {
      if (!config || !config.batchField || !sub) return;

      const values = sub.values || {};
      const batchNo = String(values[config.batchField] || '').trim();

      // A submission can move from one batch number to another, and the old entry is keyed by the
      // OLD number -- so always clear this submission's previous entries before writing.
      await removeSubmission(config.recordKey, sub.id);
      if (!batchNo) return; // batch removed/blank -> indexed nowhere

      const dateField = config.batchDateField || firstDateField(config);
      let occurredOn = dateField ? String(values[dateField] || '').trim() : '';
      if (!occurredOn && values.date) occurredOn = String(values.date).trim(); // monitoring-log default
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

      // Other codes on this same submission (e.g. a salt batch code used while processing this
      // job) get their own index entry, cross-linked back to the primary code -- so tracing the
      // raw-material batch surfaces which job it went into, not just when it was logged here.
      for (const field of (config.extraBatchFields || [])) {
        const extraNo = String(values[field] || '').trim();
        if (!extraNo || extraNo === batchNo) continue;
        await window.storage.set(
          keyFor(extraNo, config.recordKey, sub.id + ':' + field),
          JSON.stringify(Object.assign({ batch_no: extraNo, linked_batch: batchNo }, baseRow)),
          true
        );
      }

      // Per-batch roster rows: a record like Salting & Tumbling runs many batches under one job,
      // each row carrying its own short batch id ("<job>/<n>") in config.roster.batchIdColumn.
      // Each gets its own index entry, cross-linked to the job, so that id can be traced on its
      // own later. removeSubmission's ':<recordKey>:<subId>%3A...' match cleans these up too.
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

  // Remove every entry a submission created, whatever batch number(s) it was filed under -- the
  // primary entry's last segment is exactly the submission id, extraBatchFields entries have
  // ':<field>' appended (URI-encoded, so the ':' inside is safe) -- match both.
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

  // Return every touchpoint for a batch number, ordered into a timeline.
  async function trace(batchNo) {
    const map = await window.storage.getByPrefix(batchPrefix(String(batchNo).trim()), true);
    return parseRows(map).sort((a, b) => {
      const da = a.occurred_on || '', db = b.occurred_on || '';
      if (da && db && da !== db) return da < db ? -1 : 1;
      return (a.updated_at || '') < (b.updated_at || '') ? -1 : 1;
    });
  }

  // Distinct batch numbers known to the index (for autocomplete / listing), most recent first.
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
