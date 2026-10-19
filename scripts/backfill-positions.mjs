#!/usr/bin/env node
// Fill sub_*."position" (the entry's index in the saved list) from the KeyValue blobs. Position-only UPDATEs: no rows
// are deleted or re-inserted, so it is quick even for abalone-receiving. Safe to re-run.
//   node scripts/backfill-positions.mjs            # dry run
//   node scripts/backfill-positions.mjs --apply
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  console.log(apply ? '=== APPLY ===' : '=== DRY RUN (pass --apply) ===');
  for (const prefix of ['formrecord:', 'monitoring_log:']) {
    for (const row of await prisma.keyValue.findMany({ where: { key: { startsWith: prefix } } })) {
      const recordKey = row.key.slice(prefix.length);
      const table = 'sub_' + recordKey.replace(/-/g, '_');
      let entries; try { entries = JSON.parse(row.value); } catch { continue; }
      if (!Array.isArray(entries) || !entries.length) continue;
      const has = await prisma.$queryRawUnsafe(`SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'position'`, table);
      if (!has.length) { console.log(`${row.key}: no table/position column -- skipped`); continue; }
      const ps = [], vals = [];
      entries.forEach((e, pos) => { if (e && e.id) { ps.push(e.id, pos); vals.push(`($${ps.length - 1}::text, $${ps.length}::int)`); } });
      const sql = `UPDATE "${table}" t SET "position" = v.pos FROM (VALUES ${vals.join(',')}) AS v(id, pos) WHERE t.id = v.id AND t."position" IS DISTINCT FROM v.pos`;
      const n = apply ? await prisma.$executeRawUnsafe(sql, ...ps) : (await prisma.$queryRawUnsafe(`SELECT count(*)::int n FROM "${table}" t JOIN (VALUES ${vals.join(',')}) AS v(id, pos) ON t.id = v.id WHERE t."position" IS DISTINCT FROM v.pos`, ...ps))[0].n;
      console.log(`${row.key}: ${entries.length} entries, ${n} position(s) ${apply ? 'set' : 'to set'}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
