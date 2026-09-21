/*
 * Rebuild the tables that are DERIVED from the KeyValue blobs, by replaying every formrecord: /
 * monitoring_log: key through the same functions the API runs on each write:
 *
 *   dates   SubmissionDateField   (src/submission-dates.js)
 *   links   RecordLink            (src/record-links.js)
 *   rows    sub_* tables          (src/submission-store.js)
 *
 * Use it after a change to a definition, a link field or a derived-table rule, so old records
 * pick the change up now instead of on their next save. KeyValue is never written.
 *
 *   node scripts/rebuild-derived.js                 all three
 *   node scripts/rebuild-derived.js dates links     just those
 *
 * Reads DATABASE_URL from .env (same as backup.js).
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ROOT = path.join(__dirname, '..');
const STEPS = ['dates', 'links', 'rows'];

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  });
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (expected in .env).'); process.exit(1); }

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const steps = wanted.length ? wanted : STEPS;
const unknown = steps.filter((s) => !STEPS.includes(s));
if (unknown.length) { console.error('Unknown step: ' + unknown.join(', ') + '  (choose from ' + STEPS.join(', ') + ')'); process.exit(1); }

const { syncSubmissionDates } = require('../src/submission-dates');
const { syncRecordLinks } = require('../src/record-links');
const { syncSubmissionRows } = require('../src/submission-store');
const dateFields = require('../src/date-field-map').load();
const recordKeys = require('../src/record-key-map').load();

async function main() {
  const prisma = new PrismaClient();
  const kvs = await prisma.keyValue.findMany({
    where: { OR: [{ key: { startsWith: 'formrecord:' } }, { key: { startsWith: 'monitoring_log:' } }] },
    orderBy: { key: 'asc' },
  });
  console.log(`replaying ${kvs.length} record keys through: ${steps.join(', ')}`);
  let failed = 0;
  for (const { key, value } of kvs) {
    for (const step of steps) {
      try {
        if (step === 'dates') await syncSubmissionDates(prisma, key, value, { dateFields, recordKeys });
        if (step === 'links') await syncRecordLinks(prisma, key, value);
        if (step === 'rows') await syncSubmissionRows(prisma, key, value);
      } catch (e) { failed++; console.error(`FAILED ${step} ${key}: ${e.message}`); }
    }
  }
  console.log(failed ? `done with ${failed} failure(s)` : 'done, no failures');
  await prisma.$disconnect();
  if (failed) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
