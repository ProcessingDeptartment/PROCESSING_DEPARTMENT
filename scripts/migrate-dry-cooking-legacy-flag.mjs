#!/usr/bin/env node
// REC 7.4.0 weight rules: flag migrated cooking-only entries. An existing entry whose cards include
// Cooking but no Blanching card never had blanching values recorded, so its Cooking cards get
// legacyNoBlanching = "Yes". The flag leaves those kg out of rule R3 (Cooking <= Blanching) and out of
// "Available to cook"; they still count for R1 (Cooking vs OOSW). No weight is invented or changed.
// Per-job blanching, cooking and R3-side cooking kg are printed before and after; blanching and total
// cooking must be identical, otherwise the script aborts. Backed up under data/backups/ and written to
// KeyValueHistory. Idempotent.
//
//   node scripts/migrate-dry-cooking-legacy-flag.mjs            dry run
//   node scripts/migrate-dry-cooking-legacy-flag.mjs --apply     write + re-project sub_dry_cooking(_row)
// Run order: prisma migrate deploy -> seed-definitions -> this script (--apply) -> push the code.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { syncSubmissionRows } = require('../src/submission-store');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'formrecord:dry-cooking';
const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

const kg = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; };
const isYes = (v) => /^(yes|true|1)$/i.test(String(v == null ? '' : v).trim());

function flag(entry) {
  const roster = Array.isArray(entry.roster) ? entry.roster : [];
  if (!roster.some((r) => r && r.process === 'Cooking')) return entry;
  if (roster.some((r) => r && r.process === 'Blanching')) return entry;
  return { ...entry, roster: roster.map((r) => (r && r.process === 'Cooking' ? { ...r, legacyNoBlanching: 'Yes' } : r)) };
}

function totals(entries) {
  const byJob = {};
  for (const e of entries) {
    if (!e || e.status !== 'submitted') continue;
    const job = String((e.values || e).jobNo || '').trim() || '(none)';
    const t = (byJob[job] = byJob[job] || { blanched: 0, cooked: 0, cookedR3: 0 });
    for (const r of e.roster || []) {
      if (!r) continue;
      if (r.process === 'Blanching') t.blanched += kg(r.abaloneKg);
      if (r.process === 'Cooking') { t.cooked += kg(r.abaloneKg); if (!isYes(r.legacyNoBlanching)) t.cookedR3 += kg(r.abaloneKg); }
    }
  }
  return byJob;
}

const row = await prisma.keyValue.findUnique({ where: { key: KEY } });
if (!row) { console.log('No', KEY, '- nothing to do.'); process.exit(0); }
const entries = JSON.parse(row.value);
const flagged = entries.map(flag);
const nChanged = entries.filter((e, i) => flagged[i] !== e).length;
console.log(`${entries.length} entries, ${nChanged} to flag`);

const before = totals(entries);
const after = totals(flagged);
let bad = 0;
for (const job of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const b = before[job] || { blanched: 0, cooked: 0, cookedR3: 0 };
  const a = after[job] || { blanched: 0, cooked: 0, cookedR3: 0 };
  const same = Math.abs(b.blanched - a.blanched) < 1e-9 && Math.abs(b.cooked - a.cooked) < 1e-9;
  if (!same) bad++;
  console.log(`  job ${job}: blanched ${b.blanched.toFixed(2)} -> ${a.blanched.toFixed(2)}  cooked ${b.cooked.toFixed(2)} -> ${a.cooked.toFixed(2)}  cooked for R3 ${b.cookedR3.toFixed(2)} -> ${a.cookedR3.toFixed(2)}  ${same ? 'OK' : 'MISMATCH'}`);
}
if (bad) { console.error('Blanching/cooking totals changed - aborting.'); process.exit(1); }
if (!apply) { console.log('Dry run only.'); process.exit(0); }
if (!nChanged) { console.log('Nothing to change.'); process.exit(0); }

const dir = path.join(ROOT, 'data', 'backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `formrecord-dry-cooking.before-legacy-flag.${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, row.value);
console.log('original saved to', path.relative(ROOT, file));
const value = JSON.stringify(flagged);
await prisma.$transaction(async (tx) => {
  await tx.keyValue.update({ where: { key: KEY }, data: { value } });
  await tx.keyValueHistory.create({ data: { key: KEY, action: 'set', before: row.value, after: value, actor: 'migrate-dry-cooking-legacy-flag', role: 'script' } });
});
await syncSubmissionRows(prisma, KEY, value);
console.log('done');
await prisma.$disconnect();
