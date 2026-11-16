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
 * Each log line:  {"at","op":"put"|"del"|"sh","id","hash","sh","row"}
 *   put = row is new or changed (row holds the full content)   del = row no longer in the database
 *   sh  = fingerprint recorded for a row that is already archived unchanged (no content, not a change)
 * The current state of a table is found by replaying its log, so there is no separate state file
 * to drift out of step. A run that dies half-way is harmless: the next run replays what was
 * written and writes whatever is still missing.
 *
 * All tables are read in ONE repeatable-read transaction (a consistent snapshot) and every run is
 * verified by replaying the logs and comparing against what was read.
 *
 * ONLY CHANGED ROWS ARE DOWNLOADED. The link to the database is slow (over a second per query and
 * well under 1 MB/s from the factory), and downloading every row of every table each run overran
 * even a 15-minute limit (2026-11-16). So the database is first asked for just the id and an md5
 * fingerprint ("sh") of every row; a row's content is downloaded only when it is new or its
 * fingerprint differs from the one stored in the log. Rows archived before fingerprints existed are
 * downloaded once more, compared, and given a small {"op":"sh"} line -- so the first run after this
 * change is slow and every run after it is quick. "sh" lines are bookkeeping, not changes.
 * Restore: node scripts/archive-to-sql.js [--as-of <ISO date>] writes a .sql file.
 *
 * Folder resolution, in order: --out "<folder>" / ARCHIVE_DIR in .env / ..\DB ARCHIVE
 *   (CSV: EXPORT_DIR in .env / ..\DB EXPORTS). No hardcoded personal path, same reasoning as backup.js.
 *
 * submission_images.image_data (photos) is excluded -- see EXCLUDE_COLUMNS.
 *
 * Usage:  node scripts/archive-changes.js [--out "<folder>"] [--no-csv] [--csv-all] [--dry-run]
 *   --dry-run  read and compare, report what would be written, write nothing.
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

// Columns left out of the archive. submission_images.image_data is the base64 photo: every photo is
// already a file under PROCESSING_DEPARTMENT\Images (scripts/image-archive-agent.mjs), and copying it
// into the monthly .jsonl and the CSV would double the storage. The column is nullable, so a restore
// loads these rows with image_data NULL (the files on disk are the copy). This also means the
// 90-day purge (image_data -> NULL) does not register as a change.
// Only list nullable columns: archive-to-sql.js restores a missing key as NULL.
const EXCLUDE_COLUMNS = { submission_images: ['image_data'] };
const lit = (v) => "'" + String(v).replace(/'/g, "''") + "'";
// One row of table t as jsonb "j" (excluded columns dropped), its id the way the log spells it
// (primary-key values joined by |) and "sh", the database's own md5 fingerprint of the row.
const rowSource = (t) => `(SELECT to_jsonb(x)${(EXCLUDE_COLUMNS[t] || []).map((c) => ' - ' + lit(c)).join('')} AS j FROM "${t}" x) s`;
const idExpr = (pk) => `concat_ws('|', ${pk.map((c) => 'j->>' + lit(c)).join(', ')})`;
const chunk = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };
const TABLES_PER_QUERY = 30;   // each query costs over a second of round trip, so tables are read in groups

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
      if (e.op === 'del') state.delete(e.id);
      else if (e.op === 'sh') { const cur = state.get(e.id); if (cur) cur.sh = e.sh; }
      else state.set(e.id, { hash: e.hash, row: e.row, sh: e.sh });
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

  const dryRun = process.argv.includes('--dry-run');
  const prevOf = {};                       // table -> replayed log state, loaded once
  const prevFor = (t) => (prevOf[t] ||= replay(dir, t));
  let downloaded = 0;

  // snap: [{ t, cur: Map(id -> { hash, row, sh }), fetched: Set(id) }]
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

    // 1. id + fingerprint of every row (small). Tables with no primary key have no stable id: read whole.
    const keyed = names.filter((t) => pks[t]);
    const fp = Object.fromEntries(keyed.map((t) => [t, new Map()]));
    for (const group of chunk(keyed, TABLES_PER_QUERY)) {
      for (const r of await tx.$queryRawUnsafe(group.map((t) =>
        `SELECT ${lit(t)}::text AS t, ${idExpr(pks[t])} AS id, md5(j::text) AS sh FROM ${rowSource(t)}`).join(' UNION ALL '))) fp[r.t].set(r.id, r.sh);
    }

    // 2. which rows need their content: new, fingerprint changed, or archived before fingerprints existed
    const want = {};                       // table -> array of ids, or null = every row
    for (const t of names) {
      if (!pks[t]) { want[t] = null; continue; }
      const prev = prevFor(t);
      const ids = [];
      for (const [id, sh] of fp[t]) { const old = prev.get(id); if (!old || old.sh !== sh) ids.push(id); }
      if (ids.length) want[t] = ids.length > fp[t].size / 2 ? null : ids;
    }

    // 3. download just those rows, again in groups
    const got = Object.fromEntries(names.map((t) => [t, []]));
    for (const group of chunk(Object.keys(want), TABLES_PER_QUERY)) {
      const params = [];
      const sql = group.map((t) => {
        const id = pks[t] ? idExpr(pks[t]) : "''";
        let where = '';
        if (want[t]) { params.push(want[t]); where = ` WHERE ${id} = ANY($${params.length}::text[])`; }
        return `SELECT ${lit(t)}::text AS t, ${id} AS id, md5(j::text) AS sh, j AS row FROM ${rowSource(t)}${where}`;
      }).join(' UNION ALL ');
      for (const r of await tx.$queryRawUnsafe(sql, ...params)) { got[r.t].push(r); downloaded++; }
    }

    // 4. the table as it stands now = rows just downloaded + rows already archived with a matching fingerprint
    const snap = names.map((t) => {
      const prev = prevFor(t), cur = new Map(), fetched = new Set();
      for (const r of got[t]) {
        const hash = sha(canon(r.row));
        // No primary key -> the row's own content is its identity (a changed row = old removed + new added).
        const id = pks[t] ? pks[t].map((c) => String(r.row[c])).join('|') : hash;
        if (pks[t] && id !== r.id) throw new Error(`row id mismatch in ${t}: database says "${r.id}", log would say "${id}" -- nothing written`);
        cur.set(id, { hash, row: r.row, sh: pks[t] ? r.sh : undefined });
        fetched.add(id);
      }
      if (pks[t]) for (const id of fp[t].keys()) {
        if (cur.has(id)) continue;
        const old = prev.get(id);
        if (!old) throw new Error(`row ${id} of ${t} was expected from the database but did not arrive -- nothing written`);
        cur.set(id, old);
      }
      return { t, cur, fetched };
    });
    return { names, pks, snap };
  }, { isolationLevel: 'RepeatableRead', maxWait: 30000, timeout: 3 * 3600000 });   // 3 h ceiling: a normal run reads only fingerprints and changed rows; only the first run (or a full re-read) is long

  const now = new Date();
  const at = now.toISOString();
  const month = at.slice(0, 7);
  const stamp = at.replace(/\.\d+Z$/, '').replace(/:/g, '-');
  const doCsv = !process.argv.includes('--no-csv');
  // --csv-all: write a readable CSV for EVERY table this run, changed or not, empty ones included (header row only).
  // Used to start a fresh, complete set of exports (e.g. after moving the export folder).
  const csvAll = doCsv && process.argv.includes('--csv-all');
  const colsOf = {};
  if (csvAll) for (const r of await prisma.$queryRawUnsafe(
    `SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`)) (colsOf[r.t] ||= []).push(r.c);
  let csvCount = 0;
  let totalNew = 0, totalChanged = 0, totalDeleted = 0;
  const touched = [], bad = [];

  let fingerprinted = 0;
  for (const { t, cur, fetched } of snap) {
    const prev = prevFor(t);
    const lines = [], marks = [];
    let n = 0, c = 0, d = 0;
    for (const id of fetched) {
      const v = cur.get(id), old = prev.get(id);
      if (!old) { n++; lines.push({ at, op: 'put', id, hash: v.hash, sh: v.sh, row: v.row }); }
      else if (old.hash !== v.hash) { c++; lines.push({ at, op: 'put', id, hash: v.hash, sh: v.sh, row: v.row }); }
      else if (v.sh && old.sh !== v.sh) marks.push({ at, op: 'sh', id, sh: v.sh });   // same content, fingerprint not yet on file
    }
    for (const id of prev.keys()) if (!cur.has(id)) { d++; lines.push({ at, op: 'del', id, hash: prev.get(id).hash }); }
    fingerprinted += marks.length;

    if (lines.length) {
      touched.push(`${t} (+${n} new, ~${c} changed, -${d} removed)`);
      totalNew += n; totalChanged += c; totalDeleted += d;
    }
    if (dryRun) continue;
    if (lines.length || marks.length) {
      const tdir = path.join(dir, 'changes', safeName(t));
      fs.mkdirSync(tdir, { recursive: true });
      fs.appendFileSync(path.join(tdir, `${safeName(t)}_${month}.jsonl`), [...lines, ...marks].map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
    }
    const rows = [...cur.values()].map((v) => v.row);
    if (doCsv && (csvAll || (lines.length && rows.length))) {
      const edir = path.join(exportDir(), safeName(t));
      fs.mkdirSync(edir, { recursive: true });
      fs.writeFileSync(path.join(edir, `${safeName(t)}_${stamp}.csv`), rows.length ? csv(rows) : (colsOf[t] || []).join(',') + '\r\n', 'utf8');
      csvCount++;
    }
    // Verify: replay what is now on disk and compare against what was read.
    const after = replay(dir, t);
    if (after.size !== cur.size || [...cur].some(([id, v]) => !after.has(id) || after.get(id).hash !== v.hash || (v.sh && after.get(id).sh !== v.sh))) bad.push(t);
  }

  if (!dryRun && !fs.existsSync(path.join(dir, 'README.txt'))) {
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

  console.log(`${bad.length ? 'FAIL' : 'OK  '}  archive ${at}  (${names.length} tables checked, ${downloaded} rows downloaded)${dryRun ? '  DRY RUN -- nothing written' : ''}`);
  console.log(touched.length
    ? `      changed: ${totalNew} new, ${totalChanged} changed, ${totalDeleted} removed across ${touched.length} table(s)`
    : '      no changes since last run — nothing written');
  if (fingerprinted) console.log(`      fingerprints ${dryRun ? 'to record' : 'recorded'} for ${fingerprinted} already-archived rows (one-off, not changes)`);
  for (const x of touched.slice(0, 15)) console.log('        ' + x);
  if (touched.length > 15) console.log(`        ...and ${touched.length - 15} more`);
  if (bad.length) console.log(`      MISMATCH after re-read: ${bad.join(', ')}`);
  console.log(`      -> ${dir}`);
  if (doCsv) console.log(`      CSV files written: ${csvCount}${csvAll ? ' (every table)' : ''} -> ${exportDir()}`);

  await prisma.$disconnect();
  if (bad.length) process.exit(1);
}

module.exports = { replay };
if (require.main === module) main().catch((e) => { console.error('ARCHIVE FAILED:', e.message); process.exit(1); });
