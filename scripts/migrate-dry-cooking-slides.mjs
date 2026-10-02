#!/usr/bin/env node
// REC 7.4.0 Dry Cooking pot SLIDES: renumber stored entries (spec section 10).
//   1. slide order (seq_no) = the existing row order (sub_dry_cooking_row.position, shown as "seqNo" in the view)
//   2. potNoOld  <- the pot number the row carried before
//   3. potNo     <- NULL for Blanching rows; Cooking rows renumbered 1, 2, 3 ... within each entry
//   Nothing else is touched: abaloneKg, old blanching values, batch codes, warnings and dates stay exactly as stored.
//   blanchTempC / blanchTime are NOT backfilled (old blanching used different fields).
// Check before applying (and enforced): per job, total Cooking kg, number of Cooking rows and the OOSW comparison are
// identical before and after. Original JSON is backed up under data/backups/ and written to KeyValueHistory. Idempotent.
//
//   node scripts/migrate-dry-cooking-slides.mjs            dry run (report + per-job check)
//   node scripts/migrate-dry-cooking-slides.mjs --apply     write + re-project sub_dry_cooking(_row)
// Run order: `prisma migrate deploy` (20261002130000_dry_cooking_slides) -> seed-definitions (new columns) -> dry run -> --apply.

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

function convert(entry) {
  const rows = Array.isArray(entry.roster) ? entry.roster : null;
  if (!rows || !rows.length) return entry;
  let n = 0;
  const out = rows.map((r) => {
    if (!r) return r;
    const target = r.process === 'Cooking' ? String(++n) : '';
    if (String(r.potNo == null ? '' : r.potNo) === target) return r;                  // already numbered this way (new entry / re-run)
    const next = { ...r, potNo: target };
    if (blank(next.potNoOld) && !blank(r.potNo)) next.potNoOld = String(r.potNo);     // keep the number the card had
    return next;
  });
  return { ...entry, roster: out };
}

function jobFigures(entries) {
  const byJob = {};
  for (const e of entries) {
    if (!e || e.status !== 'submitted') continue;
    const job = String((e.values || e).jobNo || '').trim();
    const j = byJob[job] || (byJob[job] = { kg: 0, cookingRows: 0 });
    for (const r of e.roster || []) if (r && r.process === 'Cooking') { j.kg += kg(r.abaloneKg); j.cookingRows++; }
  }
  return byJob;
}

const row = await prisma.keyValue.findUnique({ where: { key: KEY } });
if (!row) { console.log('No', KEY, '- nothing to migrate.'); process.exit(0); }
const entries = JSON.parse(row.value);
const converted = entries.map(convert);
const changed = entries.filter((e, i) => JSON.stringify(e) !== JSON.stringify(converted[i])).length;
console.log(`${entries.length} entries, ${changed} to renumber`);

const before = jobFigures(entries), after = jobFigures(converted);
let mismatch = 0;
for (const job of new Set([...Object.keys(before), ...Object.keys(after)])) {
  const b = before[job] || { kg: 0, cookingRows: 0 }, a = after[job] || { kg: 0, cookingRows: 0 };
  const same = Math.abs(b.kg - a.kg) < 1e-9 && b.cookingRows === a.cookingRows;
  if (!same) mismatch++;
  console.log(`  job ${job || '(none)'}: Cooking kg ${b.kg.toFixed(2)} -> ${a.kg.toFixed(2)}, Cooking rows ${b.cookingRows} -> ${a.cookingRows}  ${same ? 'OK' : 'MISMATCH'}`);
}
if (mismatch) { console.error('Per-job totals differ - aborting. Nothing was written.'); process.exit(1); }
if (!apply) { console.log('Dry run only.'); await prisma.$disconnect(); process.exit(0); }
if (!changed) { console.log('Already migrated.'); await prisma.$disconnect(); process.exit(0); }

const dir = path.join(ROOT, 'data', 'backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `formrecord-dry-cooking.before-slides.${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, row.value);
console.log('original saved to', path.relative(ROOT, file));
const value = JSON.stringify(converted);
await prisma.$transaction(async (tx) => {
  await tx.keyValue.update({ where: { key: KEY }, data: { value } });
  await tx.keyValueHistory.create({ data: { key: KEY, action: 'set', before: row.value, after: value, actor: 'migrate-dry-cooking-slides', role: 'script' } });
});
await syncSubmissionRows(prisma, KEY, value);
console.log(await prisma.$queryRawUnsafe('SELECT "submissionId","seqNo","potNo","potNoOld","process","abaloneKg" FROM dry_cooking_pot ORDER BY "submissionId","seqNo"'));
await prisma.$disconnect();
