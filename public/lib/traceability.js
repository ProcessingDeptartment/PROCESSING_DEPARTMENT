/*
 * Batch traceability index for the online records system.
 *
 * Record bodies stay in kv_store as before. This lib maintains a thin INDEX in the
 * Supabase `batch_link` table (see supabase/traceability.sql): one row per
 * (batch number x record x submission), so that given a batch/lot number you can
 * trace every record that touched it -- forwards and backwards along the timeline.
 *
 * A record opts in by declaring in its config:
 *     batchField:     'lotBatchNumber'      // which field holds the PRODUCT batch/lot
 *     batchDateField: 'dateReceived'        // (optional) field to order the timeline by
 *     stage:          'intake'              // (optional) process stage label
 *     traceSummary:   sub => '...'          // (optional) one-line summary for the trace view
 * The shared engines call Traceability.indexSubmission() after every save; records
 * with no batchField never touch this table, so the ~40 differently-named ingredient
 * "batch" fields never create false links.
 *
 * All calls are best-effort: if Supabase is in local-only mode or a network call
 * fails, the record still saves normally -- traceability just doesn't update.
 */
(function () {
  function client() {
    const c = window.storage && window.storage.supabaseClient;
    return c ? c() : null; // promise<client> or null in local-only mode
  }

  function firstDateField(config) {
    const fields = [];
    // form-record.js groups fields under sections; monitoring-log.js uses a flat entryFields list.
    (config.sections || []).forEach(sec => (sec.fields || []).forEach(f => fields.push(f)));
    (config.entryFields || config.fields || []).forEach(f => fields.push(f));
    const d = fields.find(f => f.type === 'date');
    return d ? d.key : null;
  }

  function hrefForThisPage(sub) {
    const file = location.pathname.split('/').pop() || '';
    return sub && sub.id ? file + '#' + sub.id : file;
  }

  // Upsert (or clear) the batch_link row for one submission of one record.
  async function indexSubmission(config, sub) {
    try {
      if (!config || !config.batchField || !sub) return;
      const cp = client();
      if (!cp) return; // local-only mode
      const supabase = await cp;

      const values = sub.values || {};
      const batchNo = String(values[config.batchField] || '').trim();

      // Batch removed/blank on this submission -> drop any existing link for it.
      if (!batchNo) {
        await supabase.from('batch_link')
          .delete()
          .eq('record_key', config.recordKey)
          .eq('submission_id', sub.id);
        return;
      }

      const dateField = config.batchDateField || firstDateField(config);
      let occurredOn = dateField ? String(values[dateField] || '').trim() : '';
      if (!occurredOn && values.date) occurredOn = String(values.date).trim(); // monitoring-log default
      let summary = '';
      try { summary = config.traceSummary ? String(config.traceSummary(sub) || '') : ''; } catch (e) { summary = ''; }

      await supabase.from('batch_link').upsert({
        batch_no: batchNo,
        record_key: config.recordKey,
        record_title: config.title || config.recordKey,
        submission_id: sub.id,
        stage: config.stage || null,
        occurred_on: occurredOn || null,
        href: hrefForThisPage(sub),
        summary: summary || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'batch_no,record_key,submission_id' });
    } catch (e) {
      console.warn('[traceability] index failed (record still saved)', e);
    }
  }

  // Remove every link a submission created (used when a submission is deleted).
  async function removeSubmission(recordKey, submissionId) {
    try {
      const cp = client();
      if (!cp) return;
      const supabase = await cp;
      await supabase.from('batch_link').delete()
        .eq('record_key', recordKey).eq('submission_id', submissionId);
    } catch (e) {
      console.warn('[traceability] remove failed', e);
    }
  }

  // Return every touchpoint for a batch number, ordered into a timeline.
  async function trace(batchNo) {
    const cp = client();
    if (!cp) throw new Error('Traceability needs Supabase to be configured.');
    const supabase = await cp;
    const { data, error } = await supabase
      .from('batch_link')
      .select('*')
      .eq('batch_no', String(batchNo).trim());
    if (error) throw error;
    return (data || []).sort((a, b) => {
      const da = a.occurred_on || '', db = b.occurred_on || '';
      if (da && db && da !== db) return da < db ? -1 : 1;
      return (a.updated_at || '') < (b.updated_at || '') ? -1 : 1;
    });
  }

  // Distinct batch numbers known to the index (for autocomplete / listing).
  async function knownBatches() {
    const cp = client();
    if (!cp) return [];
    const supabase = await cp;
    const { data, error } = await supabase
      .from('batch_link')
      .select('batch_no')
      .order('updated_at', { ascending: false })
      .limit(1000);
    if (error) throw error;
    const seen = [];
    (data || []).forEach(r => { if (r.batch_no && seen.indexOf(r.batch_no) === -1) seen.push(r.batch_no); });
    return seen;
  }

  window.Traceability = { indexSubmission, removeSubmission, trace, knownBatches };
})();
