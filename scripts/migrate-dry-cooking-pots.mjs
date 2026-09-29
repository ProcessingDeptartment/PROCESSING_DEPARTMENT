#!/usr/bin/env node
// REC 7.4.0 Dry Cooking -> Pots roster. Converts each existing single-pot entry in KeyValue
// `formrecord:dry-cooking` into ONE pot row (row 1, process = "Both": blanched then cooked), keeping
// every blanching / cooking / additive value, the pot number, cooking date and abalone kg.
//
// Sea water: the fields are now a "100 Lt sea water used?" Yes/No tick. The old typed litre number
// is kept in read-only legacy columns (blanchSeaWaterLitres / cookSeaWaterLitres); the tick is
// "Yes" only where the old value was exactly 100, otherwise blank (never "No").
//
// The original KeyValue JSON is saved to RECORD BACKUPS-style file under data/backups/, and the
// change is written through KeyValueHistory (action 'set', before = original) like any other edit.
// Idempotent: entries that already have a roster are skipped. Prints per-job total kg before/after.
//
//   node scripts/migrate-dry-cooking-pots.mjs            dry run (report + totals check, writes nothing)
//   node scripts/migrate-dry-cooking-pots.mjs --apply     write it, then re-project sub_dry_cooking(_row)
//
// Run order on deploy: this script's dry run -> `prisma migrate deploy` -> --apply.
// (Apply needs the new sub_dry_cooking_row table, so it must follow the migration.)

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

const POT_KEYS = ['cookingDate', 'potNumber', 'abaloneKg', 'blanchSeaWater', 'blanchPh', 'blanchSaltKg', 'blanchTemp',
  'cookingTime', 'blanchBatchNumber', 'startTime', 'startingTemp', 'temp20MinAfter', 'endOfCookingTemp', 'timeOut',
  'totalCookingTime', 'cookSeaWater', 'cookPh', 'saltKg', 'saltBatchNumber', 'sugarKg', 'sugarBatchNumber',
  'vinegarKg', 'vinegarBatchNumber'];

const blank = (v) => v == null || String(v).trim() === '';
const kg = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; };

function convert(entry) {
  if (Array.isArray(entry.roster) && entry.roster.some((r) => r && r.process)) return null; // already migrated
  const values = entry.values || entry;
  const row = { process: 'Both' };
  for (const k of POT_KEYS) if (!blank(values[k])) row[k] = String(values[k]);
  for (const [oldKey, litresKey] of [['blanchSeaWater', 'blanchSeaWaterLitres'], ['cookSeaWater', 'cookSeaWaterLitres']]) {
    if (blank(values[oldKey])) { delete row[oldKey]; continue; }
    row[litresKey] = String(values[oldKey]);
    if (parseFloat(values[oldKey]) === 100) row[oldKey] = 'Yes'; else delete row[oldKey];
  }
  const out = { ...entry, roster: [row] };
  const newValues = { ...values };
  POT_KEYS.forEach((k) => delete newValues[k]);
  if (entry.values) out.values = newValues; else Object.assign(out, newValues);
  return out;
}

const COOKED = new Set(['Cooking', 'Both']);
function totals(entries, mode) {
  const byJob = {};
  for (const e of entries) {
    if (!e || e.status !== 'submitted') continue;
    const v = e.values || e;
    const job = String(v.jobNo || '').trim();
    const sum = mode === 'before' ? kg(v.abaloneKg)
      : (e.roster || []).reduce((a, r) => a + (r && COOKED.has(r.process) ? kg(r.abaloneKg) : 0), 0);
    byJob[job] = (byJob[job] || 0) + sum;
  }
  return byJob;
}

const row = await prisma.keyValue.findUnique({ where: { key: KEY } });
if (!row) { console.log('No', KEY, 'in KeyValue - nothing to migrate.'); process.exit(0); }
const entries = JSON.parse(row.value);
const converted = entries.map((e) => convert(e) || e);
const nChanged = entries.filter((e, i) => converted[i] !== e).length;

const before = totals(entries, 'before');
const after = totals(converted, 'after');
let mismatch = 0;
console.log(`${entries.length} entries, ${nChanged} to convert`);
for (const job of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const same = Math.abs((before[job] || 0) - (after[job] || 0)) < 1e-9;
  if (!same) mismatch++;
  console.log(`  job ${job || '(none)'}: before ${(before[job] || 0).toFixed(2)} kg  after ${(after[job] || 0).toFixed(2)} kg  ${same ? 'OK' : 'MISMATCH'}`);
}
console.log(`rows after: ${converted.reduce((a, e) => a + (e.roster || []).length, 0)} pot rows (expected ${entries.length} when none were migrated before)`);
if (mismatch) { console.error('Totals mismatch - aborting.'); process.exit(1); }

if (!apply) { console.log('Dry run only. Re-run with --apply after `prisma migrate deploy`.'); process.exit(0); }

const dir = path.join(ROOT, 'data', 'backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `formrecord-dry-cooking.before-pots.${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, row.value);
console.log('original saved to', path.relative(ROOT, file));

const value = JSON.stringify(converted);
await prisma.$transaction(async (tx) => {
  await tx.keyValue.update({ where: { key: KEY }, data: { value } });
  await tx.keyValueHistory.create({ data: { key: KEY, action: 'set', before: row.value, after: value, actor: 'migrate-dry-cooking-pots', role: 'script' } });
});
await syncSubmissionRows(prisma, KEY, value);
const n = await prisma.$queryRawUnsafe('SELECT count(*)::int AS n FROM "sub_dry_cooking_row"');
console.log('applied; sub_dry_cooking_row rows:', n[0].n);
await prisma.$disconnect();
