// Fails if the committed record-def JSON files do not match what the database exports.
// Run before committing any record-definition change, and in CI if available.
//
//   node scripts/check-record-defs.mjs        (needs DATABASE_URL)
//
// It exports into a temporary folder, then compares each file with public/data/record-defs.
// Key order is ignored; values and array order are not.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMITTED = path.join(ROOT, 'public', 'data', 'record-defs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'record-defs-check-'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Cannot check record definitions against the database.');
  process.exit(2);
}

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'export-record-defs.mjs')], {
  stdio: 'inherit', env: { ...process.env, RECORD_DEFS_OUT: TMP },
});

const canon = (x) => JSON.stringify(x, (k, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.keys(v).sort().reduce((o, kk) => ((o[kk] = v[kk]), o), {})
    : v);

const committed = new Set(fs.readdirSync(COMMITTED).filter((f) => f.endsWith('.json')));
const exported = new Set(fs.readdirSync(TMP).filter((f) => f.endsWith('.json')));
const problems = [];
for (const f of exported) {
  if (!committed.has(f)) { problems.push('missing from git: ' + f); continue; }
  const a = JSON.parse(fs.readFileSync(path.join(TMP, f), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.join(COMMITTED, f), 'utf8'));
  if (canon(a) !== canon(b)) problems.push('differs from database: ' + f);
}
for (const f of committed) if (!exported.has(f)) problems.push('not in database any more: ' + f);

fs.rmSync(TMP, { recursive: true, force: true });

if (problems.length) {
  console.error('\nRecord definitions are out of sync with the database (' + problems.length + '):');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nFix: run node scripts/export-record-defs.mjs and commit the JSON it writes. See MD/Instructions/records/record-definitions-change-process.md');
  process.exit(1);
}
console.log('OK: all ' + exported.size + ' record definitions match the database.');
