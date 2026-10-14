/*
 * Permanent, change-only archive of the whole records database.
 *
 * WHY THIS EXISTS (and how it differs from backup.js)
 * backup.js writes a complete snapshot every run. Run daily, that stores the same unchanged
 * rows again and again. This script keeps ONE copy of every version of every row, forever:
 * a row is written only the first time it is seen, and again only when its content changes.
 * Nothing is ever pruned or overwritten. An unchanged night writes nothing at all.
 * backup.js is left as it is -- the two complement each other.
 *
 * LAYOUT (outside the git repo, beside RECORD BACKUPS, like backup.js)
 *   DB ARCHIVE\changes\<table>\<table>_YYYY-MM.jsonl   append-only change log, one file per month
 *   DB ARCHIVE\README.txt                              what this is and how to restore
 *   DB EXPORTS\<table>\<table>_<stamp>.csv             readable full copy, ONLY when that table changed
 *
 * Each log line:  {"at","op":"put"|"del","id","hash","row"}
 *   put = row is new or changed (row holds the full content)   del = row no longer in the database
 * The current state of a table is found by replaying its log, so there is no separate state file
 * to drift out of step. A run that dies half-way is harmless: the next run replays what was
 * written and writes whatever is still missing.
 *
 * All tables are read in ONE repeatable-read transaction (a consistent snapshot) and every run is
 * verified by replaying the logs and comparing against what was read.
 * Restore: node scripts/archive-to-sql.js [--as-of <ISO date>] writes a .sql file.
 *
 * Folder resolution, in order: --out "<folder>" / ARCHIVE_DIR in .env / ..\DB ARCHIVE
 *   (CSV: EXPORT_DIR in .env / ..\DB EXPORTS). No hardcoded personal path, same reasoning as backup.js.
 *
 * Usage:  node scripts/archive-changes.js [--out "<folder>"] [--no-csv]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const arg = (n) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : undefined; };
const archiveDir = () => arg('--out') || process.env.ARCHIVE_DIR || path.resolve(__dirname, '..', '..', 'DB ARCHIVE');
const exportDir = () => process.env.EXPORT_DIR || path.resolve(__dirname, '..', '..', 'DB EXPORTS');

const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
// Stable text for a value: object keys sorted, so column order can never fake a "change".
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const safeName = (t) => t.replace(/[^A-Za-z0-9_.-]/g, '_');

// Replay a table's log into Map(id -> {hash,row}). Shared shape with archive-to-sql.js.
function replay(dir, table, asOf) {
  const tdir = path.join(dir, 'changes', safeName(table));
  const state = new Map();
  if (!fs.existsSync(tdir)) return state;
  for (const f of fs.readdirSync(tdir).filter((x) => x.endsWith('.jsonl')).sort()) {
    for (const line of fs.readFileSync(path.join(tdir, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const e = JSON.parse(line);
      if (asOf && e.at > asOf) continue;
      if (e.op === 'del') state.delete(e.id); else state.set(e.id, { hash: e.hash, row: e.row });
    }
  }
  return state;
}

function csv(rows) {
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    });
  }
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (expected in .env) — cannot archive.'); process.exit(1); }

  const prisma = new PrismaClient();
  const dir = archiveDir();
  fs.mkdirSync(path.join(dir, 'changes'), { recursive: true });

  const { names, pks, snap } = await prisma.$transaction(async (tx) => {
    const names = (await tx.$queryRawUnsafe(
      `SELECT table_name AS t FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
       ORDER BY table_name`)).map((r) => r.t);
    const pks = {};
    for (const r of await tx.$queryRawUnsafe(
      `SELECT c.relname AS t, a.attname AS col FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
       WHERE i.indisprimary AND n.nspname = 'public' ORDER BY c.relname, a.attnum`)) (pks[r.t] ||= []).push(r.col);
    const snap = names.length ? await tx.$queryRawUnsafe(
      names.map((t) => `SELECT '${t}' AS t, COALESCE(json_agg(x), '[]'::json) AS rows FROM "${t}" x`).join(' UNION ALL ')) : [];
    return { names, pks, snap };
  }, { isolationLevel: 'RepeatableRead', maxWait: 30000, timeout: 120000 });

  const now = new Date();
  const at = now.toISOString();
  const month = at.slice(0, 7);
  const stamp = at.replace(/\.\d+Z$/, '').replace(/:/g, '-');
  const doCsv = !process.argv.includes('--no-csv');
  let totalNew = 0, totalChanged = 0, totalDeleted = 0;
  const touched = [], bad = [];

  for (const { t, rows } of snap) {
    const prev = replay(dir, t);
    const cur = new Map();
    for (const row of rows) {
      const h = sha(canon(row));
      // No primary key -> the row's own content is its identity (a changed row = old removed + new added).
      const id = pks[t] ? pks[t].map((c) => String(row[c])).join('|') : h;
      cur.set(id, { hash: h, row });
    }
    const lines = [];
    let n = 0, c = 0, d = 0;
    for (const [id, v] of cur) {
      const old = prev.get(id);
      if (!old) { n++; lines.push({ at, op: 'put', id, hash: v.hash, row: v.row }); }
      else if (old.hash !== v.hash) { c++; lines.push({ at, op: 'put', id, hash: v.hash, row: v.row }); }
    }
    for (const id of prev.keys()) if (!cur.has(id)) { d++; lines.push({ at, op: 'del', id, hash: prev.get(id).hash }); }

    if (lines.length) {
      const tdir = path.join(dir, 'changes', safeName(t));
      fs.mkdirSync(tdir, { recursive: true });
      fs.appendFileSync(path.join(tdir, `${safeName(t)}_${month}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
      touched.push(`${t} (+${n} new, ~${c} changed, -${d} removed)`);
      totalNew += n; totalChanged += c; totalDeleted += d;
      if (doCsv && rows.length) {
        const edir = path.join(exportDir(), safeName(t));
        fs.mkdirSync(edir, { recursive: true });
        fs.writeFileSync(path.join(edir, `${safeName(t)}_${stamp}.csv`), csv(rows), 'utf8');
      }
    }
    // Verify: replay what is now on disk and compare against what was read.
    const after = replay(dir, t);
    if (after.size !== cur.size || [...cur].some(([id, v]) => !after.has(id) || after.get(id).hash !== v.hash)) bad.push(t);
  }

  if (!fs.existsSync(path.join(dir, 'README.txt'))) {
    fs.writeFileSync(path.join(dir, 'README.txt'),
`DB ARCHIVE -- permanent, change-only archive of the processing database.

changes\\<table>\\<table>_YYYY-MM.jsonl
  Append-only. A row is written the first time it is seen and again only when it changes
  (op "put"), or when it disappears from the database (op "del"). Never edit or delete these
  files: they are the permanent record. An unchanged night adds nothing.

Written by:   node scripts/archive-changes.js   (Task Scheduler "Abagold FSMS Change Archive")
Restore:      node scripts/archive-to-sql.js [--as-of 2026-10-01T00:00:00Z] > restore.sql
              The .sql file loads into an empty database that already has the schema
              (prisma migrate deploy). --as-of rebuilds the data as it stood at that moment.
Readable copies: ..\\DB EXPORTS\\<table>\\*.csv (a new file only when that table changed).
`, 'utf8');
  }

  console.log(`${bad.length ? 'FAIL' : 'OK  '}  archive ${at}  (${names.length} tables checked)`);
  console.log(touched.length
    ? `      changed: ${totalNew} new, ${totalChanged} changed, ${totalDeleted} removed across ${touched.length} table(s)`
    : '      no changes since last run — nothing written');
  for (const x of touched.slice(0, 15)) console.log('        ' + x);
  if (touched.length > 15) console.log(`        ...and ${touched.length - 15} more`);
  if (bad.length) console.log(`      MISMATCH after re-read: ${bad.join(', ')}`);
  console.log(`      -> ${dir}`);

  await prisma.$disconnect();
  if (bad.length) process.exit(1);
}

module.exports = { replay };
if (require.main === module) main().catch((e) => { console.error('ARCHIVE FAILED:', e.message); process.exit(1); });
