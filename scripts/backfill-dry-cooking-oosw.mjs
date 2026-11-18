// Backfill ooswKg on dry-cooking entries where it is missing.
// Reads the salting-oosw record, sums the roster weight column per jobNo,
// and writes the total back into matching dry-cooking entries.
//
// Safe to re-run: skips entries that already have ooswKg set.
// Run: node scripts/backfill-dry-cooking-oosw.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Load salting-oosw entries
  const ooswRow = await prisma.keyValue.findUnique({ where: { key: 'formrecord:salting-oosw' } });
  if (!ooswRow) { console.log('No salting-oosw record found'); return; }

  const ooswEntries = JSON.parse(ooswRow.value);
  if (!Array.isArray(ooswEntries)) { console.log('salting-oosw value is not an array'); return; }

  // Build a map: jobNo -> total OOSW kg (sum of roster weight column)
  const ooswByJob = new Map();
  for (const entry of ooswEntries) {
    if (!entry || typeof entry !== 'object') continue;
    const jobNo = String((entry.values || {}).jobNo || '').trim();
    if (!jobNo) continue;

    const rosterRows = Object.values(entry.roster || {}).flat();
    const total = rosterRows.reduce((sum, r) => {
      if (!r || typeof r !== 'object') return sum;
      const kg = parseFloat(r.weight);
      return sum + (isNaN(kg) ? 0 : kg);
    }, 0);

    if (total > 0) {
      const rounded = parseFloat(total.toFixed(2));
      // Keep the highest total if multiple salting-oosw entries exist for the same job
      if (!ooswByJob.has(jobNo) || rounded > ooswByJob.get(jobNo)) {
        ooswByJob.set(jobNo, rounded);
      }
    }
  }
  console.log(`Built OOSW map for ${ooswByJob.size} jobs`);

  // Load dry-cooking entries
  const dcRow = await prisma.keyValue.findUnique({ where: { key: 'formrecord:dry-cooking' } });
  if (!dcRow) { console.log('No dry-cooking record found'); return; }

  const dcEntries = JSON.parse(dcRow.value);
  if (!Array.isArray(dcEntries)) { console.log('dry-cooking value is not an array'); return; }
  console.log(`Found ${dcEntries.length} dry-cooking entries`);

  let filled = 0, missing = 0, skipped = 0;
  for (const entry of dcEntries) {
    if (!entry || typeof entry !== 'object') continue;
    const v = entry.values || {};

    if (v.ooswKg != null && String(v.ooswKg).trim() !== '') { skipped++; continue; }

    const jobNo = String(v.jobNo || '').trim();
    if (!jobNo) { missing++; continue; }

    const oosw = ooswByJob.get(jobNo);
    if (oosw == null) { console.log(`  No OOSW found for job ${jobNo}`); missing++; continue; }

    v.ooswKg = oosw;
    entry.values = v;
    filled++;
    console.log(`  ${jobNo} -> ${oosw} kg`);
  }

  if (filled > 0) {
    await prisma.keyValue.update({
      where: { key: 'formrecord:dry-cooking' },
      data: { value: JSON.stringify(dcEntries) },
    });
    console.log(`Done. Filled ${filled}, already set ${skipped}, no OOSW found ${missing}.`);
  } else {
    console.log(`Nothing to update. Already set ${skipped}, no OOSW found ${missing}.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
