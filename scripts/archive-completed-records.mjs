// Pull every submitted record from the database into the PROCESSING ARCHIVE on the T drive (MD/10_Archive-System.md).
// The API archives on verify, but it runs on Render and cannot reach the T drive -- so this script, run from a
// machine on the office network, is what actually fills the archive with records.
//
// It archives ALL submissions (drafts excluded), verified or not: one page per record + job + submission day, at
// completed-records/<recordKey>/<YYYY-MM>/<jobNo>_<YYYY-MM-DD>.html (JSON copy under json/...). Each entry shows
// whether it is submitted or verified. Safe to re-run (and to schedule): a group already archived with the same
// content is skipped; a group that has changed (new entry, edit, now verified) is rewritten.
// Read-only against the database. Needs DATABASE_URL.
//
//   node scripts/archive-completed-records.mjs [--since YYYY-MM-DD] [--record <recordKey>] [--verified-only]
//                                              [--archive-out "<path>"] [--dry-run]

import crypto from 'crypto';
import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  if (!args[i + 1] || args[i + 1].startsWith('--')) { console.error(name + ' needs a value'); process.exit(1); }
  return args[i + 1];
};
const since = opt('--since');
const onlyRecord = opt('--record');
const dryRun = args.includes('--dry-run');
const verifiedOnly = args.includes('--verified-only');
if (since && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(since)) { console.error('--since must be YYYY-MM-DD'); process.exit(1); }
if (opt('--archive-out')) process.env.ARCHIVE_OUT = opt('--archive-out');   // before archive-writer resolves the root

const require = createRequire(import.meta.url);
const { archiveRoot, readIndex, safeSegment, beginBatch, endBatch, writeCsv, fieldLabels } = require('./archive-writer.js');
const { archiveSubmissions, jobNoOf, loadRecordConfig } = require('../src/archive-completed-record.js');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const subTable = (recordKey) => 'sub_' + recordKey.replace(/-/g, '_');
// Facility time (SAST, UTC+2, no daylight saving), so a late-evening entry is filed under the right day.
const dayOf = (v) => {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(typeof v === 'string' && /^[0-9]+$/.test(v) ? Number(v) : v);
  return isNaN(d) ? null : new Date(d.getTime() + 2 * 3600 * 1000).toISOString().slice(0, 10);
};

const prisma = new PrismaClient();
const root = archiveRoot();
console.log('archive: ' + root + (dryRun ? '  (dry run -- nothing will be written)' : ''));

const defs = await prisma.recordDefinition.findMany({ where: onlyRecord ? { recordKey: onlyRecord } : {}, select: { recordKey: true }, orderBy: { recordKey: 'asc' } });

// submission id -> the verification that covers it (entries verified before `verification` was stamped on them).
const events = await prisma.verificationEvent.findMany({
  where: onlyRecord ? { recordKey: onlyRecord } : {},
  include: { entries: { select: { submissionId: true } } },
  orderBy: [{ recordKey: 'asc' }, { position: 'asc' }],
});
const verifiedBy = new Map();
for (const ev of events) {
  const verification = {
    verifiedBy: ev.verifiedBy, verifiedSig: ev.verifiedTitle,
    verifiedDate: ev.verifiedDate ? ev.verifiedDate.toISOString().slice(0, 10) : null,
    verifiedSignature: ev.verifiedSignature, loggedAt: ev.loggedAt ? ev.loggedAt.getTime() : null,
  };
  for (const { submissionId } of ev.entries) {
    const k = ev.recordKey + '|' + submissionId;
    if (!verifiedBy.has(k)) verifiedBy.set(k, verification);
  }
}

const already = new Map();   // "<recordKey>|<label>" -> content hash of what is archived
for (const e of readIndex(root)) if (e.type === 'completed-record') already.set(e.key + '|' + e.label, e.sha256 || '');

let archived = 0, unchanged = 0, failed = 0, entriesTotal = 0, csvWritten = 0;
if (!dryRun) beginBatch();
try {
  for (const { recordKey } of defs) {
    if (!/^[a-z0-9][a-z0-9_.-]*$/.test(recordKey)) continue;
    let rows;
    try { rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${subTable(recordKey)}"`); }
    catch { continue; }   // record has no submission table yet

    const groups = new Map();
    const all = [];
    for (const row of rows) {
      if (row.status === 'draft') continue;
      let parsed = {};
      try { parsed = JSON.parse(row.rawJson) || {}; } catch {}
      const verification = parsed.verification || verifiedBy.get(recordKey + '|' + row.id) || null;
      if (verifiedOnly && !verification) continue;
      const day = dayOf(row.submissionDate) || dayOf(row.submittedAt) || dayOf(parsed.submittedAt) || dayOf(row.createdAt) || dayOf(parsed.createdAt);
      if (!day || (since && day < since)) continue;
      const entry = { ...parsed, id: row.id, status: verification ? 'verified' : 'submitted', ...(verification ? { verification } : {}) };
      const jobNo = jobNoOf(entry, recordKey);
      const gk = day + '|' + (jobNo == null ? '' : jobNo);
      if (!groups.has(gk)) groups.set(gk, { day, jobNo, entries: [] });
      groups.get(gk).entries.push(entry);
      all.push({ entry, day, jobNo });
    }

    // csv/<recordKey>.csv: one row per submission, one column per field. Repeating rows (steams, crates, ...) go to
    // csv/<recordKey>_rows.csv. Only on a full run, so a filtered run never leaves a partial file behind.
    if (!dryRun && !since && !verifiedOnly && all.length) {
      all.sort((a, b) => (a.day + a.entry.id).localeCompare(b.day + b.entry.id));
      const labels = fieldLabels(loadRecordConfig(recordKey) || {});
      const head = (k) => (labels[k] && labels[k] !== k ? labels[k] + ' [' + k + ']' : k);
      const valueKeys = [], rowKeys = [], rosterRows = [];
      for (const { entry } of all) for (const k of Object.keys(entry.values || {})) if (!valueKeys.includes(k)) valueKeys.push(k);
      const rows = all.map(({ entry, day, jobNo }) => {
        const v = entry.values || {}, ver = entry.verification || {}, by = entry.completedBy || {};
        const rosters = Array.isArray(entry.roster) ? { roster: entry.roster } : (entry.rosters && typeof entry.rosters === 'object' ? entry.rosters : {});
        for (const [rk, list] of Object.entries(rosters)) (Array.isArray(list) ? list : []).forEach((r, i) => {
          if (!r || typeof r !== 'object') return;
          for (const k of Object.keys(r)) if (!rowKeys.includes(k)) rowKeys.push(k);
          rosterRows.push({ id: entry.id, day, jobNo, rk, i: i + 1, r });
        });
        return [entry.id, day, jobNo || '', entry.status, typeof by === 'object' ? (by.by || '') : by, ver.verifiedBy || '', ver.verifiedDate || '', ...valueKeys.map((k) => v[k])];
      });
      if (writeCsv(recordKey, ['Submission id', 'Date', 'Job number', 'Status', 'Completed by', 'Verified by', 'Verified date', ...valueKeys.map(head)], rows) === 'written') csvWritten++;
      if (rosterRows.length && writeCsv(recordKey + '_rows', ['Submission id', 'Date', 'Job number', 'Section', 'Row no.', ...rowKeys.map(head)],
        rosterRows.map((x) => [x.id, x.day, x.jobNo || '', x.rk, x.i, ...rowKeys.map((k) => x.r[k])])) === 'written') csvWritten++;
    }

    let n = 0;
    for (const g of groups.values()) {
      g.entries.sort((a, b) => String(a.id).localeCompare(String(b.id)));   // stable order -> stable hash
      entriesTotal += g.entries.length;
      const hash = sha(JSON.stringify(g.entries));
      // Records with no job number (monitoring logs) get one page per day.
      const name = g.jobNo ? String(g.jobNo) : 'log';
      const label = safeSegment(name + '_' + g.day);
      if (already.get(recordKey + '|' + label) === hash) { unchanged++; continue; }
      if (dryRun) { archived++; n++; continue; }
      const entry = archiveSubmissions(recordKey, g.entries, { jobNo: g.jobNo, name, date: g.day, meta: { sha256: hash } });
      if (entry) { archived++; n++; } else { failed++; console.warn('FAILED ' + recordKey + ' ' + label); }
    }
    if (n) console.log((dryRun ? 'would archive ' : 'archived ') + recordKey + ': ' + n + ' page' + (n === 1 ? '' : 's'));
  }
} finally {
  if (!dryRun) endBatch();
}
console.log(`${dryRun ? 'would archive' : 'archived'} ${archived} pages (${entriesTotal} entries seen), unchanged ${unchanged}, CSV files updated ${csvWritten}` + (failed ? `, FAILED ${failed}` : ''));
await prisma.$disconnect();
if (failed) process.exit(1);
