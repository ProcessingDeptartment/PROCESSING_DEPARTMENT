// Run the whole archive in one go (MD/10_Archive-System.md). Each step only writes what is new or changed, so this
// is safe to run as often as you like:
//
//   1. Database change archive        scripts/archive-changes.js          -> ..\DB ARCHIVE, ..\DB EXPORTS
//   2. Superseded record templates    scripts/archive-record-defs.mjs     -> PROCESSING ARCHIVE\record-defs
//   3. Policies, procedures, SOPs,    scripts/archive-documents.mjs       -> PROCESSING ARCHIVE\policies ... , record-defs
//      PRPs, current record templates
//   4. All submitted records + CSV    scripts/archive-completed-records.mjs -> PROCESSING ARCHIVE\completed-records, csv
//   5. Real PDFs (online print)       scripts/archive-pdfs.mjs            -> PROCESSING ARCHIVE\pdf
//
// A failed step does not stop the ones after it; the summary at the end says what failed, and the exit code is 1.
// Nothing here is wired into the existing scheduled database archive -- run this (or scripts\archive-all.cmd) yourself.
//
//   node scripts/archive-all.mjs [--skip-db] [--skip-pdfs] [--csv-all]
//   --csv-all: the database step writes a CSV for every table this run (changed or not, empty ones included).

import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const steps = [
  { name: 'Database change archive', script: 'scripts/archive-changes.js', skip: args.includes('--skip-db'), args: args.includes('--csv-all') ? ['--csv-all'] : [] },
  { name: 'Superseded record templates', script: 'scripts/archive-record-defs.mjs' },
  { name: 'Documents and current record templates', script: 'scripts/archive-documents.mjs' },
  { name: 'Submitted records and CSV files', script: 'scripts/archive-completed-records.mjs' },
  { name: 'PDFs (online print layout)', script: 'scripts/archive-pdfs.mjs', skip: args.includes('--skip-pdfs') },
];

const results = [];
const started = Date.now();
for (const [i, step] of steps.entries()) {
  if (step.skip) { results.push({ ...step, status: 'skipped' }); continue; }
  console.log(`\n=== ${i + 1}/${steps.length}  ${step.name}  (${step.script}) ===`);
  const t = Date.now();
  const r = spawnSync(process.execPath, [step.script, ...(step.args || [])], { cwd: ROOT, stdio: 'inherit' });
  const ok = r.status === 0;
  results.push({ ...step, status: ok ? 'ok' : 'FAILED' + (r.error ? ' (' + r.error.message + ')' : ' (exit ' + r.status + ')'), secs: Math.round((Date.now() - t) / 1000) });
}

console.log('\n=== Archive run finished ' + new Date().toISOString() + ' (' + Math.round((Date.now() - started) / 1000) + 's) ===');
for (const r of results) console.log('  ' + r.status.padEnd(8) + ' ' + r.name + (r.secs != null ? '  ' + r.secs + 's' : ''));
process.exit(results.some((r) => r.status.startsWith('FAILED')) ? 1 : 0);
