// Backfill operator field on submitted dry-cooking entries.
// For each entry where operator is blank, sets operator = the name of the user who submitted it.
// Safe to re-run: skips entries that already have operator set.
//
// Run: node scripts/backfill-dry-cooking-operator.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.keyValue.findMany({
    where: { key: 'formrecord:dry-cooking' },
    select: { key: true, value: true },
  });

  console.log(`Found ${rows.length} dry-cooking records`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    let entries;
    try { entries = JSON.parse(row.value); } catch { continue; }
    if (!Array.isArray(entries)) continue;

    let changed = false;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const v = entry.values || {};
      if (v.operator && String(v.operator).trim() !== '') continue; // already set

      // Primary: completedBy.by (the name filled in on the sign-off block)
      const cb = entry.completedBy;
      const cbName = cb && (typeof cb === 'object' ? cb.by : cb);
      // Fallback: signOffs array
      const signOff = (entry.signOffs || []).filter(s => s && s.action === 'submitted').slice(-1)[0];
      const name = (cbName && String(cbName).trim()) || (signOff && signOff.by && String(signOff.by).trim()) || '';
      if (!name) continue;

      v.operator = name;
      entry.values = v;
      changed = true;
    }

    if (!changed) { skipped++; continue; }

    await prisma.keyValue.update({
      where: { key: row.key },
      data: { value: JSON.stringify(entries) },
    });
    console.log(`  Updated: ${row.key}`);
    updated++;
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped}.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
