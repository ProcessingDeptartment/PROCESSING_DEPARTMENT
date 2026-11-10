// Pull verified records from the database into the PROCESSING ARCHIVE on the T drive (MD/10_Archive-System.md).
// The API archives on verify, but it runs on Render and cannot reach the T drive -- so this script, run from a
// machine on the office network, is what actually fills the archive with completed records.
//
// It reads the verification log (VerificationEvent), loads the entries each event verified, and writes one file per
// record + job + verification day: completed-records/<recordKey>/<YYYY-MM>/<jobNo>_<YYYY-MM-DD>.{json,html}.
// Safe to re-run (and to schedule): a group already archived with the same content is skipped; a group that has
// since gained entries is rewritten. Read-only against the database. Needs DATABASE_URL.
//
//   node scripts/archive-completed-records.mjs [--since YYYY-MM-DD] [--record <recordKey>] [--archive-out "<path>"] [--dry-run]

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
if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error('--since must be YYYY-MM-DD'); process.exit(1); }
if (opt('--archive-out')) process.env.ARCHIVE_OUT = opt('--archive-out');   // before archive-writer resolves the root

const require = createRequire(import.meta.url);
const { archiveRoot, readIndex, safeSegment } = require('./archive-writer.js');
const { maybeArchiveOnVerify, jobNoOf } = require('../src/archive-completed-record.js');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const iso = (d) => (d instanceof Date && !isNaN(d) ? d.toISOString() : null);
const subTable = (recordKey) => 'sub_' + recordKey.replace(/-/g, '_');

const prisma = new PrismaClient();
const root = archiveRoot();
console.log('archive: ' + root + (dryRun ? '  (dry run -- nothing will be written)' : ''));

const events = await prisma.verificationEvent.findMany({
  where: onlyRecord ? { recordKey: onlyRecord } : {},
  include: { entries: { select: { submissionId: true } } },
  orderBy: [{ recordKey: 'asc' }, { position: 'asc' }],
});

// The day a verification was logged (falling back to the date the verifier entered).
const eventDay = (ev) => (iso(ev.loggedAt) || iso(ev.verifiedDate) || '').slice(0, 10);

const byRecord = new Map();
for (const ev of events) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(ev.recordKey) || !ev.entries.length) continue;
  const day = eventDay(ev);
  if (!day || (since && day < since)) continue;
  if (!byRecord.has(ev.recordKey)) byRecord.set(ev.recordKey, []);
  byRecord.get(ev.recordKey).push(ev);
}

const already = new Map();   // "<recordKey>|<label>" -> content hash of what is archived
for (const e of readIndex(root)) if (e.type === 'completed-record') already.set(e.key + '|' + e.label, e.sha256 || '');

let archived = 0, unchanged = 0, failed = 0, noTable = 0;
for (const [recordKey, evs] of byRecord) {
  const ids = [...new Set(evs.flatMap((ev) => ev.entries.map((x) => x.submissionId)))];
  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(`SELECT id, status, "rawJson" FROM "${subTable(recordKey)}" WHERE id = ANY($1::text[])`, ids);
  } catch { noTable++; console.warn('skip ' + recordKey + ' (no submission table)'); continue; }
  const rowById = new Map(rows.map((r) => [r.id, r]));

  // One group per job per verification day. An entry verified more than once stays under its first verification.
  const groups = new Map();
  const seen = new Set();
  for (const ev of evs) {
    const day = eventDay(ev);
    const verification = {
      verifiedBy: ev.verifiedBy, verifiedSig: ev.verifiedTitle, verifiedDate: (iso(ev.verifiedDate) || '').slice(0, 10) || null,
      verifiedSignature: ev.verifiedSignature, loggedAt: ev.loggedAt ? ev.loggedAt.getTime() : null,
    };
    for (const { submissionId } of ev.entries) {
      const row = rowById.get(submissionId);
      if (!row || row.status === 'draft' || seen.has(submissionId)) continue;   // deleted since, or never submitted
      seen.add(submissionId);
      let parsed = {};
      try { parsed = JSON.parse(row.rawJson) || {}; } catch {}
      const entry = { ...parsed, id: row.id, status: 'verified', verification: parsed.verification || verification };
      const jobNo = jobNoOf(entry, recordKey);
      const gk = day + '|' + (jobNo == null ? '' : jobNo);
      if (!groups.has(gk)) groups.set(gk, { day, jobNo, entries: [] });
      groups.get(gk).entries.push(entry);
    }
  }

  for (const g of groups.values()) {
    const hash = sha(JSON.stringify(g.entries));
    // Same naming as maybeArchiveOnVerify, so a file the API (or an earlier run) wrote is recognised.
    const label = safeSegment((g.jobNo ? String(g.jobNo) : 'entry-' + String(g.entries[0].id || '').slice(0, 8)) + '_' + g.day);
    if (already.get(recordKey + '|' + label) === hash) { unchanged++; continue; }
    if (dryRun) { archived++; console.log('would archive ' + recordKey + ' ' + label + ' (' + g.entries.length + ' entries)'); continue; }
    const entry = await maybeArchiveOnVerify(prisma, recordKey, g.entries, { jobNo: g.jobNo, date: g.day, meta: { sha256: hash } });
    if (entry) { archived++; console.log('archived ' + entry.htmlPath + ' (' + g.entries.length + ' entries)'); }
    else { failed++; console.warn('FAILED ' + recordKey + ' ' + label); }
  }
}
console.log(`${dryRun ? 'would archive' : 'archived'} ${archived}, unchanged ${unchanged}` + (noTable ? `, records without a table ${noTable}` : '') + (failed ? `, FAILED ${failed}` : ''));
await prisma.$disconnect();
if (failed) process.exit(1);
