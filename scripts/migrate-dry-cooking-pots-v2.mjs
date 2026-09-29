#!/usr/bin/env node
// REC 7.4.0 Dry Cooking, revision 2: every stored entry becomes pot CARDS (Blanching, then Cooking).
// Input can be the original single-pot entry (values on the entry) or the first-revision entry (one
// process "Both" roster row). Output per entry:
//   Card 1 Blanching (only if any blanching value exists), Card 2 Cooking (only if any cooking/additive
//   value exists); an entry with neither but a weight gets a Cooking card so its kg is kept.
//   Old typed values are kept in read-only *Old fields: potNumberOld, cookingDateOld, blanchTempOld,
//   blanchSeaWaterLtOld, cookSeaWaterLtOld. Sea water: exactly 100 -> Yes, any other number -> No,
//   none -> empty. The entry's cookingDate (record date) = the day it was completed (submittedAt).
// Original JSON is backed up under data/backups/ and written to KeyValueHistory. Idempotent.
//
//   node scripts/migrate-dry-cooking-pots-v2.mjs            dry run (report + per-job cooking-kg check)
//   node scripts/migrate-dry-cooking-pots-v2.mjs --apply     write + re-project sub_dry_cooking(_row)
// Run order: dry run -> `prisma migrate deploy` -> seed-definitions -> --apply.

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

const blank = (v) => v == null || String(v).trim() === '';
const kg = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; };
const any = (o, keys) => keys.some((k) => !blank(o[k]));
const put = (o, k, v) => { if (!blank(v)) o[k] = String(v); };

const BLANCH_KEYS = ['blanchSeaWaterLt', 'blanchPh', 'blanchSaltKg', 'blanchTemp', 'cookingTime', 'blanchBatchNumber'];
const COOK_KEYS = ['startTime', 'startingTemp', 'temp20MinAfter', 'endOfCookingTemp', 'timeOut', 'totalCookingTime',
  'cookSeaWaterLt', 'cookPh', 'saltKg', 'saltBatchNumber', 'sugarKg', 'sugarBatchNumber', 'vinegarKg', 'vinegarBatchNumber'];
const OLD_TOP = ['cookingDate', 'potNumber', 'abaloneKg', 'blanchSeaWater', 'blanchPh', 'blanchSaltKg', 'blanchTemp', 'cookingTime',
  'blanchBatchNumber', 'startTime', 'startingTemp', 'temp20MinAfter', 'endOfCookingTemp', 'timeOut', 'totalCookingTime',
  'cookSeaWater', 'cookPh', 'saltKg', 'saltBatchNumber', 'sugarKg', 'sugarBatchNumber', 'vinegarKg', 'vinegarBatchNumber'];

const yesNoFromLitres = (lt) => (blank(lt) ? '' : (parseFloat(lt) === 100 ? 'Yes' : 'No'));
const dayOf = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

function isDone(entry) {
  return Array.isArray(entry.roster) && entry.roster.length > 0
    && entry.roster.every((r) => r && (r.process === 'Blanching' || r.process === 'Cooking'));
}

function convert(entry) {
  if (isDone(entry)) return null;
  const values = entry.values || entry;
  // Source = first-revision "Both" row when present, else the entry's own values (original format).
  const src = Array.isArray(entry.roster) && entry.roster[0] ? { ...entry.roster[0] } : {};
  const g = (k) => (!blank(src[k]) ? src[k] : values[k]);
  // Litre figures: first-revision rows keep them in *Litres, originals as the typed blanch/cookSeaWater.
  const blLt = !blank(src.blanchSeaWaterLitres) ? src.blanchSeaWaterLitres : (Array.isArray(entry.roster) ? '' : values.blanchSeaWater);
  const ckLt = !blank(src.cookSeaWaterLitres) ? src.cookSeaWaterLitres : (Array.isArray(entry.roster) ? '' : values.cookSeaWater);
  const flat = { ...src, blanchSeaWaterLt: blLt, cookSeaWaterLt: ckLt };
  OLD_TOP.forEach((k) => { if (blank(flat[k])) flat[k] = values[k]; });
  flat.blanchSeaWaterLt = blLt; flat.cookSeaWaterLt = ckLt;

  const oldCommon = {};
  put(oldCommon, 'potNumberOld', g('potNumber'));
  put(oldCommon, 'cookingDateOld', g('cookingDate'));

  const cards = [];
  if (any(flat, BLANCH_KEYS)) {
    const c = { process: 'Blanching', ...oldCommon };
    put(c, 'abaloneKg', g('abaloneKg'));
    put(c, 'blanchSeaWater', yesNoFromLitres(blLt));
    put(c, 'blanchSeaWaterLtOld', blLt);
    ['blanchPh', 'blanchSaltKg', 'blanchBatchNumber', 'cookingTime'].forEach((k) => put(c, k, flat[k]));
    put(c, 'blanchTempOld', flat.blanchTemp);
    cards.push(c);
  }
  if (any(flat, COOK_KEYS) || (!cards.length && !blank(g('abaloneKg')))) {
    const c = { process: 'Cooking', ...oldCommon };
    put(c, 'abaloneKg', g('abaloneKg'));
    put(c, 'cookSeaWater', yesNoFromLitres(ckLt));
    put(c, 'cookSeaWaterLtOld', ckLt);
    ['startTime', 'startingTemp', 'temp20MinAfter', 'endOfCookingTemp', 'timeOut', 'totalCookingTime', 'cookPh', 'saltKg',
      'saltBatchNumber', 'sugarKg', 'sugarBatchNumber', 'vinegarKg', 'vinegarBatchNumber'].forEach((k) => put(c, k, flat[k]));
    cards.push(c);
  }
  cards.forEach((c, i) => { c.potNo = String(i + 1); });

  const newValues = { ...values };
  OLD_TOP.forEach((k) => delete newValues[k]);
  const stamp = entry.submittedAt || null;
  if (stamp) newValues.cookingDate = dayOf(stamp);
  const out = { ...entry, roster: cards };
  if (entry.values) out.values = newValues; else Object.assign(out, newValues);
  return out;
}

function cookingTotals(entries, mode) {
  const byJob = {};
  for (const e of entries) {
    if (!e || e.status !== 'submitted') continue;
    const v = e.values || e;
    const job = String(v.jobNo || '').trim();
    let sum = 0;
    if (Array.isArray(e.roster) && e.roster.length) {
      sum = e.roster.reduce((a, r) => a + (r && (r.process === 'Cooking' || (mode === 'before' && r.process === 'Both')) ? kg(r.abaloneKg) : 0), 0);
    } else sum = kg(v.abaloneKg);
    byJob[job] = (byJob[job] || 0) + sum;
  }
  return byJob;
}

const row = await prisma.keyValue.findUnique({ where: { key: KEY } });
if (!row) { console.log('No', KEY, '- nothing to migrate.'); process.exit(0); }
const entries = JSON.parse(row.value);
const converted = entries.map((e) => convert(e) || e);
const nChanged = entries.filter((e, i) => converted[i] !== e).length;
console.log(`${entries.length} entries, ${nChanged} to convert`);
converted.forEach((e, i) => {
  if (converted[i] === entries[i]) return;
  console.log(`  entry ${e.id}: ` + e.roster.map((c) => `Pot ${c.potNo} ${c.process} ${c.abaloneKg || 0} kg`).join(', ') || '(no cards)');
});

const before = cookingTotals(entries, 'before');
const after = cookingTotals(converted, 'after');
let mismatch = 0;
for (const job of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const same = Math.abs((before[job] || 0) - (after[job] || 0)) < 1e-9;
  if (!same) mismatch++;
  console.log(`  job ${job || '(none)'}: cooking kg before ${(before[job] || 0).toFixed(2)}  after ${(after[job] || 0).toFixed(2)}  ${same ? 'OK' : 'MISMATCH'}`);
}
console.log('cards after:', converted.reduce((a, e) => a + (e.roster || []).length, 0));
if (mismatch && !process.argv.includes('--allow-mismatch')) { console.error('Cooking-kg totals differ - aborting (an entry with blanching values only loses its kg from the OOSW total; check it, then --allow-mismatch).'); process.exit(1); }
if (!apply) { console.log('Dry run only.'); process.exit(0); }

const dir = path.join(ROOT, 'data', 'backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `formrecord-dry-cooking.before-pot-cards.${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, row.value);
console.log('original saved to', path.relative(ROOT, file));
const value = JSON.stringify(converted);
await prisma.$transaction(async (tx) => {
  await tx.keyValue.update({ where: { key: KEY }, data: { value } });
  await tx.keyValueHistory.create({ data: { key: KEY, action: 'set', before: row.value, after: value, actor: 'migrate-dry-cooking-pots-v2', role: 'script' } });
});
await syncSubmissionRows(prisma, KEY, value);
console.log(await prisma.$queryRawUnsafe('SELECT "potNo","process","abaloneKg","recordDate" FROM dry_cooking_pot ORDER BY "submissionId","potNo"'));
await prisma.$disconnect();
