// sync-sop-refs.mjs — one-shot backfill: extract cross-references from all stored SOP content
// and populate the document_references table.
//
// Usage: node scripts/sync-sop-refs.mjs
// Requires DATABASE_URL in env (set in .env or export it first).

import { PrismaClient } from '@prisma/client';
import { extractReferences } from '../public/lib/ref-extractor.js';

const prisma = new PrismaClient();

async function main() {
  const sopRows = await prisma.keyValue.findMany({
    where: { key: { startsWith: 'sop_doc:' } }
  });

  console.log(`Found ${sopRows.length} SOP keys — extracting references…`);
  let total = 0;

  for (const row of sopRows) {
    const sourceKey = row.key.replace(/^sop_doc:/, '');
    let doc;
    try { doc = JSON.parse(row.value); } catch {
      console.warn(`  ${sourceKey}: could not parse JSON — skipped`);
      continue;
    }

    const plainText = [
      doc.sections?.objective,
      doc.sections?.roles,
      doc.sections?.process,
      doc.sections?.review
    ].filter(Boolean).join(' ');

    const sourceTitle = (doc.sopNo ? doc.sopNo + ' ' : '') + (doc.name || sourceKey);
    const rawRefs = extractReferences(plainText);
    const rows = rawRefs.map(r => ({
      sourceType:  'sop',
      sourceKey,
      sourceTitle,
      targetType:  r.targetType,
      targetKey:   r.targetKey,
      targetLabel: r.targetKey,
      contextText: r.contextText,
      updatedAt:   new Date()
    }));

    await prisma.$transaction([
      prisma.documentReference.deleteMany({ where: { sourceType: 'sop', sourceKey } }),
      ...(rows.length ? [prisma.documentReference.createMany({ data: rows })] : [])
    ]);

    console.log(`  ${sourceKey}: ${rows.length} ref(s)`);
    total += rows.length;
  }

  console.log(`\nDone — ${total} reference rows written across ${sopRows.length} SOPs.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
