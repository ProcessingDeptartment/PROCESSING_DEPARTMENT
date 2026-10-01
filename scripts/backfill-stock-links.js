/*
 * REC 7.4.4 brief steps 2-3: backfill stock_link and reconcile legacy 7.4.4 against 7.4.3.x.
 *
 *   node scripts/backfill-stock-links.js           dry run: reports only, writes nothing
 *   node scripts/backfill-stock-links.js --apply   replace stock_link edges for the three source
 *                                                  records (run the stock_link migration first)
 *
 * Reports (1) edges per record type, (2) every submission that could not be linked, with the
 * reason, for a person to review (nothing is guessed), and (3) every bin whose job set differs
 * between legacy 7.4.4 and REC 7.4.3.1/7.4.3.2. KeyValue is never written. Reads DATABASE_URL
 * from .env.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  });
}
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (expected in .env).'); process.exit(1); }

const { extractEdges, syncStockLinks } = require('../src/stock-link');
const KEYS = ['grading-production-log-cultivated', 'grading-production-log-ranched', 'grading-boxing-traceability'];
const apply = process.argv.includes('--apply');

async function main() {
  const prisma = new PrismaClient();
  const perRecord = {};
  const allSkipped = [];
  const jobsByBin = { grading: new Map(), legacy: new Map() };

  for (const rk of KEYS) {
    const row = await prisma.keyValue.findUnique({ where: { key: 'formrecord:' + rk } });
    let entries = [];
    try { entries = row ? JSON.parse(row.value) : []; } catch { console.error('unreadable JSON in formrecord:' + rk); }
    const { edges, skipped } = extractEdges(rk, entries);
    perRecord[rk] = { submissions: entries.length, edges: edges.length, skipped: skipped.length };
    allSkipped.push(...skipped);
    const side = rk === 'grading-boxing-traceability' ? jobsByBin.legacy : jobsByBin.grading;
    for (const e of edges) {
      if (!side.has(e.toKey)) side.set(e.toKey, new Set());
      side.get(e.toKey).add(e.fromKey);
    }
    if (apply) await syncStockLinks(prisma, 'formrecord:' + rk, row ? row.value : '[]');
  }

  console.log(apply ? '== APPLIED ==' : '== DRY RUN (nothing written; pass --apply) ==');
  console.table(perRecord);

  console.log('\nCould not be linked (' + allSkipped.length + '):');
  allSkipped.forEach((s) => console.log('  ' + s.recordKey + ' / ' + s.submissionId + ': ' + s.reason));

  // Reconcile: only bins that legacy 7.4.4 actually names.
  const mismatches = [];
  for (const [bin, legacyJobs] of jobsByBin.legacy) {
    const gradingJobs = jobsByBin.grading.get(bin) || new Set();
    const missing = [...legacyJobs].filter((j) => !gradingJobs.has(j));
    const extra = [...gradingJobs].filter((j) => !legacyJobs.has(j));
    if (missing.length || extra.length) mismatches.push({ bin, only_in_7_4_4: missing.join(' '), only_in_7_4_3: extra.join(' ') });
  }
  console.log('\nReconcile: ' + jobsByBin.legacy.size + ' bin(s) in legacy 7.4.4, ' + mismatches.length + ' mismatch(es)');
  if (mismatches.length) console.table(mismatches);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
