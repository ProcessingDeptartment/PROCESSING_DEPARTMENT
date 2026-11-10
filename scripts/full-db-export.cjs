// One-off: export EVERY table and view in the database to CSV, including empty ones (header row only), plus a
// manifest that proves it: one line per object with the row count in the database and the rows written.
// Read-only. Run from the repo folder (needs its node_modules and .env):
//   node <this file> "<output folder>"
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require(path.join(process.cwd(), 'node_modules', '@prisma', 'client'));

const OUT = process.argv[2];
if (!OUT) { console.error('output folder required'); process.exit(1); }
const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';
const cell = (v) => {
  if (v == null) return '';
  let s;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === 'bigint') s = v.toString();
  else if (Buffer.isBuffer(v) || v instanceof Uint8Array) s = Buffer.from(v).toString('base64');
  else if (typeof v === 'object') s = JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x.toString() : x));
  else s = String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const line = (arr) => arr.map(cell).join(',') + '\r\n';

(async () => {
  const prisma = new PrismaClient();
  fs.mkdirSync(path.join(OUT, 'tables'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'views'), { recursive: true });
  const startedAt = new Date().toISOString();
  const manifest = [];
  // One repeatable-read transaction: every table is read from the same instant.
  await prisma.$transaction(async (tx) => {
    const objs = await tx.$queryRawUnsafe(
      `SELECT c.relname AS name, c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m') ORDER BY c.relkind, c.relname`);
    const cols = await tx.$queryRawUnsafe(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`);
    const colsOf = new Map();
    for (const c of cols) { if (!colsOf.has(c.table_name)) colsOf.set(c.table_name, []); colsOf.get(c.table_name).push(c.column_name); }
    for (const o of objs) {
      const kind = o.kind === 'v' || o.kind === 'm' ? 'view' : 'table';
      const columns = colsOf.get(o.name) || [];
      const rec = { name: o.name, kind, columns: columns.length, rowsInDatabase: null, rowsWritten: 0, bytes: 0, status: '' };
      try {
        const [{ n }] = await tx.$queryRawUnsafe(`SELECT count(*)::bigint AS n FROM ${q(o.name)}`);
        rec.rowsInDatabase = Number(n);
        // Text-cast every column server-side so nothing is lost to driver type handling (decimals, timestamps, json).
        const select = columns.length ? columns.map((c) => `${q(c)}::text AS ${q(c)}`).join(', ') : '*';
        const rows = await tx.$queryRawUnsafe(`SELECT ${select} FROM ${q(o.name)}`);
        const file = path.join(OUT, kind + 's', o.name + '.csv');
        const fd = fs.openSync(file, 'w');
        fs.writeSync(fd, '﻿' + line(columns));
        for (const r of rows) fs.writeSync(fd, line(columns.map((c) => r[c])));
        fs.closeSync(fd);
        rec.rowsWritten = rows.length;
        rec.bytes = fs.statSync(file).size;
        rec.status = rows.length === rec.rowsInDatabase ? (rows.length ? 'OK' : 'OK (empty)') : 'MISMATCH';
      } catch (e) { rec.status = 'FAILED: ' + String(e && e.message ? e.message : e).split('\n').pop().slice(0, 200); }
      manifest.push(rec);
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 900000, maxWait: 30000 });
  await prisma.$disconnect();

  const head = ['name', 'kind', 'columns', 'rowsInDatabase', 'rowsWritten', 'bytes', 'status'];
  fs.writeFileSync(path.join(OUT, '_manifest.csv'), '﻿' + line(head) + manifest.map((m) => line(head.map((h) => m[h]))).join(''));
  const t = manifest.filter((m) => m.kind === 'table'), v = manifest.filter((m) => m.kind === 'view');
  const bad = manifest.filter((m) => !m.status.startsWith('OK'));
  const summary = [
    'Full database export (one-off)', 'Started: ' + startedAt, 'Finished: ' + new Date().toISOString(), '',
    `Tables: ${t.length}  (with rows: ${t.filter((m) => m.rowsWritten).length}, empty: ${t.filter((m) => !m.rowsWritten && m.status.startsWith('OK')).length})`,
    `Views:  ${v.length}`,
    `Rows written (tables): ${t.reduce((a, m) => a + m.rowsWritten, 0)}`,
    `Problems: ${bad.length}` + (bad.length ? '\r\n' + bad.map((m) => '  ' + m.name + ' -- ' + m.status).join('\r\n') : ''),
    '', 'Every table and view has its own CSV (tables\\, views\\); an empty table is a CSV with only the header row.',
    'See _manifest.csv for the row count in the database against the rows written, per table.',
  ].join('\r\n');
  fs.writeFileSync(path.join(OUT, '_README.txt'), summary + '\r\n');
  console.log(summary);
  if (bad.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
