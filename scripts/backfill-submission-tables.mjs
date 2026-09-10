#!/usr/bin/env node
// One-off backfill: reads every formrecord:* and monitoring_log:* row from KeyValue and
// replays it through syncSubmissionRows + syncRecordLinks, populating the per-record
// submission tables and RecordLink from existing data.
//
// Safe to re-run — each sync does an atomic delete-and-reinsert for that record key.
//
// Usage:
//   node scripts/backfill-submission-tables.mjs            # dry-run (report only)
//   node scripts/backfill-submission-tables.mjs --apply     # actually write

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { PrismaClient } = require('@prisma/client');
const { syncSubmissionRows } = require('../src/submission-store');
const { syncRecordLinks } = require('../src/record-links');

const dryRun = !process.argv.includes('--apply');
const prisma = new PrismaClient();

async function main() {
  if (dryRun) console.log('=== DRY RUN (pass --apply to write) ===\n');

  const prefixes = ['formrecord:', 'monitoring_log:'];
  let total = 0, ok = 0, skipped = 0, failed = 0;

  for (const prefix of prefixes) {
    const rows = await prisma.keyValue.findMany({
      where: { key: { startsWith: prefix } },
    });
    console.log(`${prefix}* → ${rows.length} key(s)`);

    for (const row of rows) {
      total++;
      const recordKey = row.key.slice(prefix.length);

      // Quick sanity: is it a JSON array?
      let entries;
      try { entries = JSON.parse(row.value); } catch {
        console.log(`  SKIP ${row.key} — not valid JSON`);
        skipped++;
        continue;
      }
      if (!Array.isArray(entries)) {
        console.log(`  SKIP ${row.key} — not an array (${typeof entries})`);
        skipped++;
        continue;
      }

      const entryCount = entries.length;
      const rosterCount = entries.reduce((n, e) => n + (Array.isArray(e.roster) ? e.roster.length : 0), 0);

      if (dryRun) {
        console.log(`  ${row.key} → ${entryCount} entries, ${rosterCount} roster rows`);
        ok++;
        continue;
      }

      try {
        await syncSubmissionRows(prisma, row.key, row.value);
        await syncRecordLinks(prisma, row.key, row.value);
        console.log(`  ✓ ${row.key} → ${entryCount} entries, ${rosterCount} roster rows`);
        ok++;
      } catch (e) {
        console.error(`  ✗ ${row.key} — ${e.message}`);
        failed++;
      }
    }
  }

  console.log(`\nDone: ${total} keys, ${ok} ok, ${skipped} skipped, ${failed} failed`);
  if (dryRun && ok > 0) console.log('Re-run with --apply to write.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
