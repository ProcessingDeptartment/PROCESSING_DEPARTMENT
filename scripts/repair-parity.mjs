#!/usr/bin/env node
// Re-syncs the sub_* table for each mismatched record from its KeyValue blob.
// Safe to re-run: the sync is a full DELETE + re-INSERT (non-incremental) so the table
// always ends up matching the blob exactly.
//
//   node scripts/repair-parity.mjs [recordKey ...]
//   node scripts/repair-parity.mjs                      ← repairs all MISMATCH records
//   node scripts/repair-parity.mjs abalone-receiving     ← repairs one specific record

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { syncSubmissionRows } = require('../src/submission-store');
const prisma = new PrismaClient();

const PREFIXES = ['formrecord:', 'monitoring_log:'];

async function checkParity(prisma, recordKey, arr) {
  const table = 'sub_' + recordKey.replace(/-/g, '_');
  try {
    const t = await prisma.$queryRawUnsafe(
      `SELECT "id", "rawJson", "position" FROM "${table}" ORDER BY "position" ASC NULLS LAST`
    );
    const countOk = t.length === arr.length;
    const orderOk = countOk && t.every((x, i) => x.id === arr[i].id && x.position === i);
    const contentOk = countOk && t.every((x, i) => x.rawJson === JSON.stringify(arr[i]));
    return { tableRows: t.length, countOk, orderOk, contentOk };
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  const targetKeys = process.argv.slice(2);

  const rows = await prisma.keyValue.findMany({
    where: {
      OR: PREFIXES.map(p => ({ key: { startsWith: p } })),
    },
  });

  const toRepair = [];
  for (const r of rows) {
    const prefix = PREFIXES.find(p => r.key.startsWith(p));
    const recordKey = r.key.slice(prefix.length);

    if (targetKeys.length && !targetKeys.includes(recordKey)) continue;

    let arr;
    try {
      const a = JSON.parse(r.value);
      arr = Array.isArray(a) ? a.filter(e => e && e.id) : null;
    } catch { arr = null; }
    if (!arr || !arr.length) continue;

    const before = await checkParity(prisma, recordKey, arr);
    if (before.error) { console.log(`${recordKey}: no table (${before.error})`); continue; }

    const allOk = before.countOk && before.orderOk && before.contentOk;
    if (!targetKeys.length && allOk) {
      console.log(`${recordKey}: OK (${arr.length} entries) — skipping`);
      continue;
    }

    toRepair.push({ key: r.key, recordKey, arr, before });
  }

  if (!toRepair.length) {
    console.log('Nothing to repair.');
    await prisma.$disconnect();
    return;
  }

  for (const { key, recordKey, arr, before } of toRepair) {
    process.stdout.write(`${recordKey}: blob=${arr.length} table=${before.tableRows} — resyncing... `);
    await syncSubmissionRows(prisma, key, JSON.stringify(arr));
    const after = await checkParity(prisma, recordKey, arr.filter(e => e && e.id));
    const ok = after.countOk && after.orderOk && after.contentOk;
    console.log(ok ? `✓ fixed (${after.tableRows} rows)` : `STILL MISMATCHED — count=${after.countOk} order=${after.orderOk} content=${after.contentOk}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
