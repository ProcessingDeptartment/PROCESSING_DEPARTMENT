#!/usr/bin/env node
// Read-only audit. For every formrecord:* / monitoring_log:* blob in KeyValue:
//   - size (KB) and headroom against the 5 MB request limit
//   - submission count in the blob vs rows in its sub_* table (parity)
// Writes nothing. Run after any change to the submission sync to prove no submission was lost.
//
//   node scripts/audit-submission-parity.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const LIMIT = 5 * 1024 * 1024;

async function main() {
  const out = [];
  for (const prefix of ['formrecord:', 'monitoring_log:']) {
    const rows = await prisma.keyValue.findMany({ where: { key: { startsWith: prefix } } });
    for (const r of rows) {
      const recordKey = r.key.slice(prefix.length);
      let n = null;
      try { const a = JSON.parse(r.value); n = Array.isArray(a) ? a.filter((e) => e && e.id).length : null; } catch { /* leave null */ }
      const table = 'sub_' + recordKey.replace(/-/g, '_');
      let t = null, orderOk = '-', contentOk = '-';
      try { const c = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "${table}"`); t = c[0].n; } catch { /* no table */ }
      if (t != null && n != null) {
        try {
          const arr = JSON.parse(r.value).filter((e) => e && e.id);
          const rows = await prisma.$queryRawUnsafe(`SELECT "id", "rawJson", "position" FROM "${table}" ORDER BY "position" ASC NULLS LAST`);
          orderOk = rows.length === arr.length && rows.every((x, i) => x.id === arr[i].id && x.position === i) ? 'OK' : 'DIFF';
          contentOk = rows.every((x, i) => arr[i] && x.rawJson === JSON.stringify(arr[i])) ? 'OK' : 'DIFF';
        } catch { orderOk = contentOk = 'n/a'; }
      }
      out.push({ key: r.key, kb: Math.round(Buffer.byteLength(r.value) / 1024), pct: +(Buffer.byteLength(r.value) / LIMIT * 100).toFixed(1), blob: n, table: t, ok: t == null ? 'no-table' : (t === n && orderOk !== 'DIFF' && contentOk !== 'DIFF' ? 'OK' : 'MISMATCH'), order: orderOk, content: contentOk });
    }
  }
  out.sort((a, b) => b.kb - a.kb);
  console.table(out);
  const bad = out.filter((o) => o.ok === 'MISMATCH');
  console.log(bad.length ? `\n${bad.length} MISMATCH(ES) -- blob and table disagree` : '\nAll tabled records match their blob.');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
