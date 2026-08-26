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

  const keyValues = await prisma.keyValue.findMany({ orderBy: { key: 'asc' } });
  const dateFields = await prisma.submissionDateField.findMany({ orderBy: { id: 'asc' } });

  const payload = {
    takenAt: new Date().toISOString(),
    source: 'neon/production',
    counts: { KeyValue: keyValues.length, SubmissionDateField: dateFields.length },
    KeyValue: keyValues,
    SubmissionDateField: dateFields
  };

  const file = path.join(dir, `records-backup-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(payload, null, 2), 'utf8');

  // Verify: read it back off disk and confirm it parses and still has everything.
  const check = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ok = check.KeyValue.length === keyValues.length
    && check.SubmissionDateField.length === dateFields.length;

  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${path.basename(file)}  (${kb} KB)`);
  console.log(`      KeyValue: ${keyValues.length}   SubmissionDateField: ${dateFields.length}`);
  console.log(`      -> ${dir}`);

  await prisma.$disconnect();
  if (!ok) process.exit(1);
}

main().catch(async (e) => {
  console.error('BACKUP FAILED:', e.message);
  process.exit(1);
});
