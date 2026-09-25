// Job-level facts (receiving date, received-from farm, processing-for, intake weight) belong to
// the job, and live once: in REC 7.1.2 Abalone Receiving (sub_abalone_receiving), exposed to
// queries through the `job_info` view keyed by job number. Downstream records only SHOW them —
// the form autofills them read-only from 7.1.2 — so their sub_* tables do not store a copy.
// Join any sub_* table to job_info ON "jobNo" to get them — every job-scoped record's job field
// is keyed jobNo, in the form, the saved JSON and the column alike.
//
// A field is a job snapshot when it is a read-only target of an autofill whose source is
// abalone-receiving. Editable autofill targets are kept: an operator could have typed a
// different value, which would then be the record's own data. The full submission as the
// operator saw it is still in each row's rawJson (and the KeyValue blob).
//
// Shared by scripts/generate-submission-schema.mjs (which columns exist) and
// src/submission-store.js (which columns get written), so the two can never disagree.

const JOB_SOURCE = 'abalone-receiving';

function parseMap(m) {
  if (!m) return {};
  if (typeof m === 'string') { try { return JSON.parse(m); } catch { return {}; } }
  return m;
}

// def: { recordKey, fields: [{ key, readOnly }], autofills: [{ sourceRecordKey, fillMap }] }
function jobSnapshotKeys(def) {
  const keys = new Set();
  if (!def || def.recordKey === JOB_SOURCE) return keys;
  const readOnly = new Set((def.fields || []).filter(f => f.readOnly).map(f => f.key));
  for (const a of def.autofills || []) {
    if (a.sourceRecordKey !== JOB_SOURCE) continue;
    for (const target of Object.keys(parseMap(a.fillMap))) {
      if (readOnly.has(target)) keys.add(target);
    }
  }
  return keys;
}

module.exports = { jobSnapshotKeys, JOB_SOURCE };
