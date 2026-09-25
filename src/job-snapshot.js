// Job-level facts (receiving date, received-from farm, processing-for, intake weight) belong to
// the job, and live once: in REC 7.1.2 Abalone Receiving (sub_abalone_receiving), exposed to
// queries through the `job_info` view keyed by job number. Downstream records only SHOW them —
// the form autofills them read-only from 7.1.2 — so their sub_* tables do not store a copy.
// Join any sub_* table to job_info ON "jobNo" (every table names its job column jobNo) to get them.
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

// Every sub_* table names its job-number column "jobNo", whatever the form calls the field
// (jobNo on most records, jobNumber on ~15). Only the DB column is renamed; the form field key,
// autofill watchKey and saved JSON keep the form's own name.
const JOB_COL = 'jobNo';

// The record's top-level job picker field key, or null for records not scoped to a job.
function jobFieldKey(def) {
  const sections = (def && def.sections) || [];
  const f = ((def && def.fields) || []).find(f =>
    (f.type === 'jobsearch' || f.type === 'jobnumber') &&
    !(sections[f.sectionIndex] && sections[f.sectionIndex].kind === 'roster'));
  return f ? f.key : null;
}

module.exports = { jobSnapshotKeys, jobFieldKey, JOB_SOURCE, JOB_COL };
