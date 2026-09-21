/*
 * Full backup of the records database to a OneDrive-synced folder.
 *
 * WHY THIS EXISTS, AND WHAT IT IS NOT
 * Neon's history window is 6 hours. That is an UNDO buffer, not an archive -- it is what let us
 * recover a record deleted 3 hours earlier, and it would not have helped the next day. Nobody
 * sells 5 years of point-in-time recovery; a 5-year compliance requirement is met with backups,
 * which is what this is.
 *
 * Reads straight from Postgres via Prisma rather than through the API, so a backup does not
 * depend on the API being awake, on the access key, or on the free tier having spun the web
 * service back up. It needs DATABASE_URL in .env, the same one the API uses.
 *
 * Writes to a folder OUTSIDE the git repo but beside it, so backups are never committed to the
 * repository but do sit inside whatever synced/backed-up location the project lives in. Today
 * that is OneDrive, so they reach M365 with whatever retention IT already applies there.
 *
 * DELIBERATELY NO HARDCODED PATH. This project will move out of one person's OneDrive at handover,
 * and a baked-in personal path would either break then or -- worse -- keep quietly writing
 * somewhere the new owner cannot see. Resolution order:
 *   1. --out "<folder>"        one-off override
 *   2. BACKUP_DIR in .env      permanent override once the project moves somewhere unrelated
 *   3. ../RECORD BACKUPS       default, relative to the repo, so it follows the project as it moves
 *
 * WHAT IS IN THE FILE
 *   KeyValue, SubmissionDateField   the original two tables, at the top level (restore.js reads these)
 *   relational                      every OTHER public table, discovered from information_schema so
 *                                   new sub_* tables are picked up with no change here: RecordLink
 *                                   and the per-record sub_* submission tables and their _row
 *                                   children. Empty tables are listed in `counts` but carry no rows.
 *   definitions                     the definition layer (RecordDefinition / Section / Field /
 *                                   Autofill) is ~85% of the bytes and identical run to run, so it
 *                                   is written ONCE to definitions-<hash>.json beside the backups
 *                                   and each backup just names the file + its sha256. A new file
 *                                   appears only when the definitions actually change (a reseed).
 *   migrations                      names of the applied Prisma migrations, so a backup says which
 *                                   schema its relational tables belong to
 * All tables are read inside ONE repeatable-read transaction, so the file is a single consistent
 * snapshot rather than tables read a moment apart while a form is saving.
 * The relational tables are derived -- KeyValue is still the source of truth for submissions, and
 * the definitions rebuild from data/record-definitions.json -- so restore.js stays KeyValue-only.
 * They are here so nothing that lives only in those tables can be lost, and so a rebuild can be
 * checked against what was there.
 *
 * Each run writes one timestamped file and refreshes `latest.json`. Files are small -- the whole
 * database is well under a megabyte -- so nothing is pruned; five years of daily runs is a few
 * thousand small files.
 *
 * Every backup is verified after writing: re-read from disk, re-parsed, and row counts compared
 * against what was exported. An unverified backup is not a backup.
 *
 * Usage:  node scripts/backup.js  [--out "<folder>"]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEF_TABLES = ['RecordDefinition', 'RecordSectionDef', 'RecordFieldDef', 'RecordAutofillDef'];
const { PrismaClient } = require('@prisma/client');

function outDir() {
  const i = process.argv.indexOf('--out');
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  return path.resolve(__dirname, '..', '..', 'RECORD BACKUPS');
}

// 2026-08-26T14-32-05 -- filename-safe, and sorts chronologically as plain text.
function stamp() {
  return new Date().toISOString().replace(/\.\d+Z$/, '').replace(/:/g, '-');
}

async function main() {
  // dotenv isn't a dependency; read .env directly rather than adding one for this. Loaded
  // unconditionally (real env still wins) so BACKUP_DIR is picked up even when DATABASE_URL
  // happens to be set some other way.
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    });
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (expected in .env) — cannot back up.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const dir = outDir();
  fs.mkdirSync(dir, { recursive: true });

  // One snapshot for everything (see header). Raw SQL for the relational tables: there are 180+
  // generated models and their names are only known at runtime.
  const snap = await prisma.$transaction(async (tx) => {
    const keyValues = await tx.keyValue.findMany({ orderBy: { key: 'asc' } });
    const dateFields = await tx.submissionDateField.findMany({ orderBy: { id: 'asc' } });
    const names = (await tx.$queryRawUnsafe(
      `SELECT table_name AS t FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         AND table_name NOT IN ('KeyValue', 'SubmissionDateField', '_prisma_migrations')
       ORDER BY table_name`
    )).map((r) => r.t);
    // All tables in ONE statement (json_agg per table, UNION ALL) -- 185 separate round trips to
    // Neon took ~110s; this is one. Rows come back as JSON, so dates/times are already ISO strings.
    // Ordered by each table's first column (id / recordKey) so output is stable run to run.
    const firstCol = new Map((await tx.$queryRawUnsafe(
      `SELECT table_name AS t, column_name AS c FROM information_schema.columns
       WHERE table_schema = 'public' AND ordinal_position = 1`
    )).map((r) => [r.t, r.c]));
    const relational = {}, counts = { KeyValue: keyValues.length, SubmissionDateField: dateFields.length };
    const rowsByTable = names.length ? await tx.$queryRawUnsafe(
      names.map((t) =>
        `SELECT '${t}' AS t, COALESCE(json_agg(x ORDER BY x."${firstCol.get(t)}"), '[]'::json) AS rows FROM "${t}" x`
      ).join(' UNION ALL ')
    ) : [];
    for (const { t, rows } of rowsByTable) {
      counts[t] = rows.length;
      if (rows.length) relational[t] = rows;
    }
    const migrations = (await tx.$queryRawUnsafe(
      `SELECT migration_name AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY started_at`
    )).map((r) => r.n);
    return { keyValues, dateFields, relational, counts, migrations };
  }, { isolationLevel: 'RepeatableRead', maxWait: 30000, timeout: 120000 });
  const { keyValues, dateFields, relational, counts, migrations } = snap;

  // Definition layer -> its own content-addressed file (see header).
  const defTables = {};
  for (const t of DEF_TABLES) { if (relational[t]) { defTables[t] = relational[t]; delete relational[t]; } }
  const defJson = JSON.stringify(defTables);
  const defHash = crypto.createHash('sha256').update(defJson, 'utf8').digest('hex');
  const defFile = `definitions-${defHash.slice(0, 12)}.json`;
  const defPath = path.join(dir, defFile);
  const defIsNew = !fs.existsSync(defPath);
  if (defIsNew) fs.writeFileSync(defPath, defJson, 'utf8');

  const payload = {
    takenAt: new Date().toISOString(),
    source: 'neon/production',
    counts,
    migrations,
    definitions: { file: defFile, sha256: defHash },
    KeyValue: keyValues,
    SubmissionDateField: dateFields,
    relational
  };

  const file = path.join(dir, `records-backup-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(payload, null, 2), 'utf8');

  // Verify: read it back off disk and confirm it parses and still has everything.
  const check = JSON.parse(fs.readFileSync(file, 'utf8'));
  const bad = [];
  if (check.KeyValue.length !== keyValues.length) bad.push('KeyValue');
  if (check.SubmissionDateField.length !== dateFields.length) bad.push('SubmissionDateField');
  const defCheckRaw = fs.readFileSync(defPath, 'utf8');
  const defCheck = JSON.parse(defCheckRaw);
  if (crypto.createHash('sha256').update(defCheckRaw, 'utf8').digest('hex') !== check.definitions.sha256) bad.push('definitions (hash)');
  for (const [t, n] of Object.entries(counts)) {
    if (t === 'KeyValue' || t === 'SubmissionDateField') continue;
    const got = DEF_TABLES.includes(t) ? (defCheck[t] || []).length : ((check.relational || {})[t] || []).length;
    if (got !== n) bad.push(t);
  }
  const ok = bad.length === 0;

  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${path.basename(file)}  (${kb} KB)`);
  const relTables = Object.keys(counts).length - 2;
  const relRows = Object.entries(counts).reduce((n, [t, c]) => n + (t === 'KeyValue' || t === 'SubmissionDateField' ? 0 : c), 0);
  const nonEmpty = Object.keys(relational).length + Object.keys(defTables).length;
  console.log(`      KeyValue: ${keyValues.length}   SubmissionDateField: ${dateFields.length}`);
  console.log(`      relational: ${relRows} rows across ${nonEmpty} non-empty of ${relTables} tables   (schema: ${migrations[migrations.length - 1] || 'unknown'})`);
  console.log(`      definitions: ${defFile}  (${defIsNew ? 'NEW - definitions changed since last backup' : 'unchanged, reused'})`);
  if (!ok) console.log(`      MISMATCH after re-read: ${bad.join(', ')}`);
  console.log(`      -> ${dir}`);

  await prisma.$disconnect();
  if (!ok) process.exit(1);
}

main().catch(async (e) => {
  console.error('BACKUP FAILED:', e.message);
  process.exit(1);
});
