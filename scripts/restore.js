/*
 * Restore the records database from a backup written by scripts/backup.js.
 *
 * DRY RUN BY DEFAULT. Nothing is written without --confirm. This exists because a record was once
 * lost to a delete aimed at live data, and a restore tool is exactly the wrong place to make that
 * easy to repeat: it prints what it would change, and you have to ask again to mean it.
 *
 * By default it only ADDS BACK what is missing and leaves everything else alone, which is what you
 * want after an accidental delete. --overwrite additionally replaces rows whose content differs,
 * for rolling the whole database back to the state in the file.
 *
 * Restores the KeyValue table only. SubmissionDateField is derived data -- the API rebuilds it from
 * the record contents on write -- so replaying the records regenerates it, and forcing old rows
 * back in could contradict what the records now say.
 *
 * Usage:
 *   node scripts/restore.js                          dry run against latest.json
 *   node scripts/restore.js --file <path>            dry run against a specific backup
 *   node scripts/restore.js --confirm                write missing keys
 *   node scripts/restore.js --confirm --overwrite    also replace differing keys
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : null;
}
const has = (name) => process.argv.includes(name);
const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

function backupDir() {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  return path.resolve(__dirname, '..', '..', 'RECORD BACKUPS');
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (expected in .env) — cannot restore.');
    process.exit(1);
  }

  const file = arg('--file') || path.join(backupDir(), 'latest.json');
  if (!fs.existsSync(file)) {
    console.error('Backup not found: ' + file);
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(backup.KeyValue)) {
    console.error('That file does not look like a records backup (no KeyValue array).');
    process.exit(1);
  }

  const confirm = has('--confirm');
  const overwrite = has('--overwrite');
  const prisma = new PrismaClient();

  const live = new Map((await prisma.keyValue.findMany()).map((r) => [r.key, r.value]));
  const missing = [], differing = [], same = [];
  for (const row of backup.KeyValue) {
    if (!live.has(row.key)) missing.push(row);
    else if (live.get(row.key) !== row.value) differing.push(row);
    else same.push(row);
  }

  console.log(`backup : ${path.basename(file)}  (taken ${backup.takenAt})`);
  console.log(`keys   : ${backup.KeyValue.length} in backup, ${live.size} live`);
  console.log(`         ${same.length} identical, ${missing.length} missing, ${differing.length} differing`);
  console.log('');
  missing.forEach((r) => console.log(`  + would ADD      ${r.key}  (${r.value.length} chars, md5 ${md5(r.value).slice(0, 8)})`));
  differing.forEach((r) => console.log(`  ~ ${overwrite ? 'would REPLACE' : 'differs (use --overwrite)'}  ${r.key}`));
  if (!missing.length && !(overwrite && differing.length)) {
    console.log('  nothing to do.');
  }

  if (!confirm) {
    console.log('\nDRY RUN — nothing written. Re-run with --confirm to apply.');
    await prisma.$disconnect();
    return;
  }

  let added = 0, replaced = 0;
  for (const row of missing) {
    await prisma.keyValue.create({ data: { key: row.key, value: row.value } });
    added++;
  }
  if (overwrite) {
    for (const row of differing) {
      await prisma.keyValue.update({ where: { key: row.key }, data: { value: row.value } });
      replaced++;
    }
  }

  // Verify by reading back and comparing content, not just counting.
  const after = new Map((await prisma.keyValue.findMany()).map((r) => [r.key, r.value]));
  const bad = [];
  for (const row of missing.concat(overwrite ? differing : [])) {
    if (after.get(row.key) !== row.value) bad.push(row.key);
  }

  console.log(`\nadded ${added}, replaced ${replaced}.`);
  if (bad.length) {
    console.log('VERIFY FAILED for: ' + bad.join(', '));
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('verified — restored rows match the backup byte-for-byte.');
  console.log('note: SubmissionDateField rebuilds itself as records are next written through the API.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('RESTORE FAILED:', e.message);
  process.exit(1);
});
