/*
 * Rebuild the database contents from the change archive (see archive-changes.js) as a SQL file.
 * This is the way off Neon from the archive: create the schema on the new host
 * (prisma migrate deploy), then run the .sql this writes.
 *
 *   node scripts/archive-to-sql.js [--as-of 2026-10-01T00:00:00Z] [--out restore.sql] [--archive "<folder>"]
 *
 * --as-of  data as it stood at that moment (default: latest). Only the archive's own timestamps
 *          are used, so this works with Neon switched off.
 * Rows are loaded with json_populate_recordset, so column types are taken from the target schema.
 * Foreign keys are switched off for the load (session_replication_role = replica) and back on after.
 */
const fs = require('fs');
const path = require('path');
const { replay } = require('./archive-changes');

const arg = (n) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : undefined; };
const dir = arg('--archive') || process.env.ARCHIVE_DIR || path.resolve(__dirname, '..', '..', 'DB ARCHIVE');
const asOf = arg('--as-of') ? new Date(arg('--as-of')).toISOString() : undefined;
const out = arg('--out') || `restore-${(asOf || new Date().toISOString()).replace(/[:.]/g, '-')}.sql`;

const root = path.join(dir, 'changes');
if (!fs.existsSync(root)) { console.error('No archive found at ' + root); process.exit(1); }

const sql = [`-- Restored from change archive ${dir}${asOf ? ' as of ' + asOf : ' (latest)'}`, 'BEGIN;', 'SET session_replication_role = replica;'];
let tables = 0, rows = 0;
for (const t of fs.readdirSync(root).sort()) {
  // Folder names are sanitised table names; the real name is in the SQL only if unchanged, which
  // holds for every Prisma-generated table here (letters, digits, underscore).
  const all = [...replay(dir, t, asOf).values()].map((v) => v.row);
  if (!all.length) continue;
  tables++; rows += all.length;
  for (let i = 0; i < all.length; i += 200) {
    sql.push(`INSERT INTO "${t}" SELECT * FROM json_populate_recordset(null::"${t}", $arch$${JSON.stringify(all.slice(i, i + 200))}$arch$);`);
  }
}
sql.push('SET session_replication_role = DEFAULT;', 'COMMIT;');
fs.writeFileSync(out, sql.join('\n') + '\n', 'utf8');
console.log(`Wrote ${out}: ${rows} rows across ${tables} tables${asOf ? ' as of ' + asOf : ''}.`);
