// Archive a completed record once it has been verified (MD/10_Archive-System.md).
// Called from the PUT pipeline in index.js after a verification_log:<record> key is written. Writes the group's
// entries to <archive>/completed-records/<recordKey>/<YYYY-MM>/<jobNo>_<YYYY-MM-DD>.{json,html}.
// Nothing here may throw: an archive problem must never fail the save that triggered it.

const fs = require('fs');
const path = require('path');
const { writeArchiveEntry, buildHtmlPage, submissionToHtml } = require('../scripts/archive-writer');

const SNAPSHOTS = path.join(__dirname, '..', 'public', 'data', 'record-defs');

// The static snapshot, not the DB: it is what the form was rendered from, and costs no query.
function loadRecordConfig(recordKey) {
  try { return JSON.parse(fs.readFileSync(path.join(SNAPSHOTS, encodeURIComponent(recordKey) + '.json'), 'utf8')); }
  catch { return null; }
}

// Entries keep their form fields under `values`; the job number is the record's batch field (usually jobNo).
function jobNoOf(entry, recordKey) {
  const e = entry || {}, v = (e.values && typeof e.values === 'object') ? e.values : {};
  const cfg = loadRecordConfig(recordKey) || {};
  const job = (cfg.batchField && v[cfg.batchField]) || v.jobNo || e.jobNo || e.job_no || null;
  return job == null || job === '' ? null : String(job);
}

const isVerified = (e) => !!e && (e.status === 'verified' || !!e.verification);

// Write one group of entries (one job, one day) to the archive, whatever their status. Never throws.
// date (YYYY-MM-DD, default today) names the page and its month folder; name overrides the page name (default: the
// job number); meta is kept on the index entry. Returns the index entry or null.
function archiveSubmissions(recordKey, entries, { jobNo, name: pageName, date: day, meta } = {}) {
  try {
    if (!Array.isArray(entries) || !entries.length) return null;
    const config = loadRecordConfig(recordKey) || {};
    const now = new Date().toISOString();
    const date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day || '') ? day : now.slice(0, 10);
    // Records with no job number (monitoring logs) are named by their first entry so two same-day verifications stay apart.
    const name = pageName || (jobNo ? String(jobNo) : 'entry-' + String(entries[0].id || '').slice(0, 8));
    const title = [config.docCode, config.title || recordKey].filter(Boolean).join(' — ') + (jobNo ? ' · Job ' + jobNo : '') + ' · ' + date;
    return writeArchiveEntry({
      type: 'completed-record',
      key: recordKey,
      subdir: date.slice(0, 7),
      label: name + '_' + date,
      title,
      meta,
      data: { recordKey, docCode: config.docCode || null, title: config.title || null, jobNo: jobNo || null, date, archivedAt: now, entries },
      html: buildHtmlPage({ title, archivedAt: now, bodyHtml: submissionToHtml(recordKey, jobNo, entries, config) }),
    });
  } catch (e) {
    console.error('archiveSubmissions failed', e && e.message ? e.message : e);
    return null;
  }
}

// Called by the API when a verification is logged: archives the group only when every entry in it is verified.
async function maybeArchiveOnVerify(prisma, recordKey, entries, opts = {}) {
  if (!Array.isArray(entries) || !entries.length || !entries.every(isVerified)) return null;
  return archiveSubmissions(recordKey, entries, opts);
}

module.exports = { maybeArchiveOnVerify, archiveSubmissions, jobNoOf, loadRecordConfig };
