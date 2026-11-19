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

// Pick the config version that was in force on `day` (YYYY-MM-DD).
// revisionRows must be sorted by snapshotAt asc (as returned by the archive script).
// Falls back to the current snapshot if no matching revision is found.
function configForDay(recordKey, day, revisionRows) {
  if (!revisionRows || !revisionRows.length) return loadRecordConfig(recordKey);
  const match = [...revisionRows]
    .reverse()
    .find(r => r.snapshotAt.toISOString().slice(0, 10) <= day);
  if (!match) return loadRecordConfig(recordKey);
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(SNAPSHOTS, 'snapshots', encodeURIComponent(recordKey) + '_v' + match.version + '.json'),
        'utf8'
      )
    );
  } catch { return loadRecordConfig(recordKey); }
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
// date (YYYY-MM-DD, default: first entry's own date) names the page and its month folder; name overrides the page name
// (default: the job number); meta is kept on the index entry. Returns the index entry or null.
// For job-based records the label is just the job number (no date suffix) so re-archiving the same job always
// overwrites the previous file rather than accumulating a new one on each verification.
function archiveSubmissions(recordKey, entries, { jobNo, name: pageName, date: day, meta, revisions, startDay } = {}) {
  try {
    if (!Array.isArray(entries) || !entries.length) return null;
    const config = (revisions ? configForDay(recordKey, startDay || day, revisions) : null) || loadRecordConfig(recordKey) || {};
    const now = new Date().toISOString();
    // Derive a stable anchor date from the first entry so the month folder stays consistent across re-archives.
    function stableDateFrom(e) {
      if (!e) return null;
      const v = (e.values && typeof e.values === 'object') ? e.values : {};
      const ts = v.entryDate || e.submittedAt || e.createdAt;
      return ts ? String(ts).slice(0, 10) : null;
    }
    const date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day || '') ? day
      : (stableDateFrom(entries[0]) || now.slice(0, 10));
    // Records with no job number (monitoring logs) are named by their first entry so two same-day verifications stay apart.
    const name = pageName || (jobNo ? String(jobNo) : 'entry-' + String(entries[0].id || '').slice(0, 8));
    const title = [config.docCode, config.title || recordKey].filter(Boolean).join(' — ') + (jobNo ? ' · Job ' + jobNo : '') + ' · ' + date;
    return writeArchiveEntry({
      type: 'completed-record',
      key: recordKey,
      subdir: date.slice(0, 7),
      label: name,   // stable: just the job/entry id, no date suffix — re-archiving overwrites
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

module.exports = { maybeArchiveOnVerify, archiveSubmissions, jobNoOf, loadRecordConfig, configForDay };
