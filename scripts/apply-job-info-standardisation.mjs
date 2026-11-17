// Standardise job info sections in the DB to match the JSON snapshots updated 2026-11-17.
//
// Every record's Job info panel now shows exactly 4 canonical fields in this order:
//   1. Job number   (key: jobNo)
//   2. Harvest farm (keys: harvestFarm | jiReceivedFrom | receivedFrom)
//   3. Intake date  (keys: intakeDate | jiReceivingDate | receivingDate)
//   4. Whole weight (Kg) (keys: jiIntakeWeight | intakeWeight)
//
// For form-record records (sections[]):
//   - Labels fixed on canonical fields
//   - readOnly/hidden/timestamp extras silently deleted from RecordFieldDef
//   - Data-entry extras expelled to a new "Process details" section
//   - summaryField cleaned on the Job info section
//
// For monitoring-log records (entryFields):
//   - Labels fixed on canonical fields
//   - Non-canonical fields have their group removed (field stays in form, just not in job info panel)
//
// Idempotent. Skips canning-inspection (uses a different job info schema).
//
//   node scripts/apply-job-info-standardisation.mjs
//   node scripts/export-record-defs.mjs   (verify JSON snapshots unchanged)

import { PrismaClient } from '@prisma/client';

const SKIP = new Set(['canning-inspection']);

const CANONICAL = {
  jobNo:          { label: 'Job number',       order: 0 },
  harvestFarm:    { label: 'Harvest farm',      order: 1 },
  jiReceivedFrom: { label: 'Harvest farm',      order: 1 },
  receivedFrom:   { label: 'Harvest farm',      order: 1 },
  intakeDate:     { label: 'Intake date',       order: 2 },
  jiReceivingDate:{ label: 'Intake date',       order: 2 },
  receivingDate:  { label: 'Intake date',       order: 2 },
  jiIntakeWeight: { label: 'Whole weight (Kg)', order: 3 },
  intakeWeight:   { label: 'Whole weight (Kg)', order: 3 },
};

const STANDARD_INDICATORS = new Set([
  'harvestFarm','jiReceivedFrom','receivedFrom',
  'intakeDate','jiReceivingDate','receivingDate',
  'jiIntakeWeight','intakeWeight',
]);

const prisma = new PrismaClient();

const allRecords = await prisma.recordDefinition.findMany({ select: { recordKey: true } });

for (const { recordKey } of allRecords) {
  if (SKIP.has(recordKey)) { console.log(`SKIP  ${recordKey}`); continue; }

  const def = await prisma.recordDefinition.findUnique({
    where: { recordKey },
    include: {
      sections: { orderBy: { position: 'asc' } },
      fields:   { where: { parentFieldKey: null }, orderBy: { position: 'asc' } },
    },
  });

  const ops = [];
  const sections = def.sections; // sorted by position, so indexOf === sectionIndex

  // ── FORMAT A: form-record sections ────────────────────────────────────────
  const jiSection = sections.find(s => s.kind === 'fields' && s.title === 'Job info');
  if (jiSection) {
    const jiIdx = sections.indexOf(jiSection); // = sectionIndex for Job info fields
    const jiFields = def.fields.filter(f => f.sectionIndex === jiIdx);

    if (jiFields.some(f => STANDARD_INDICATORS.has(f.key))) {
      const dropIds  = [];
      const expelIds = [];
      const keptKeys = new Set();

      for (const f of jiFields) {
        if (f.key in CANONICAL) {
          keptKeys.add(f.key);
          const newLabel = CANONICAL[f.key].label;
          if (f.label !== newLabel) {
            ops.push(prisma.recordFieldDef.update({ where: { id: f.id }, data: { label: newLabel } }));
          }
        } else if (f.readOnly || f.type === 'timestamp' || (f.extraJson && f.extraJson.hidden)) {
          dropIds.push(f.id);
        } else {
          expelIds.push(f.id);
        }
      }

      // Delete dropped fields
      if (dropIds.length) {
        ops.push(prisma.recordFieldDef.deleteMany({ where: { id: { in: dropIds } } }));
      }

      // Fix summaryField on Job info section
      if (jiSection.extraJson && jiSection.extraJson.summaryField) {
        const filtered = jiSection.extraJson.summaryField.filter(k => keptKeys.has(k));
        const newSF = filtered.length ? filtered : ['jobNo'];
        if (JSON.stringify(jiSection.extraJson.summaryField) !== JSON.stringify(newSF)) {
          ops.push(prisma.recordSectionDef.update({
            where: { id: jiSection.id },
            data: { extraJson: { ...jiSection.extraJson, summaryField: newSF } },
          }));
        }
      }

      // Expelled fields → "Process details" section
      if (expelIds.length) {
        const nextSection = sections[jiIdx + 1];

        if (nextSection && nextSection.title === 'Process details' && nextSection.kind === 'fields') {
          // Section already exists; just move fields into it
          ops.push(prisma.recordFieldDef.updateMany({
            where: { id: { in: expelIds } },
            data: { sectionIndex: jiIdx + 1 },
          }));
        } else {
          // Create the section. Must cascade sectionIndex on fields in sections that come after.
          // Step 1: for each section at position > jiSection.position (they'll shift), update
          // their fields' sectionIndex in DESCENDING order to avoid collisions.
          const sectionsToShift = sections.filter(s => s.position > jiSection.position);
          // Descending so highest sectionIndex moves first
          for (const s of [...sectionsToShift].reverse()) {
            const oldIdx = sections.indexOf(s);
            ops.push(prisma.recordFieldDef.updateMany({
              where: { recordKey, sectionIndex: oldIdx },
              data: { sectionIndex: oldIdx + 1 },
            }));
          }
          // Step 2: shift the section positions themselves
          for (const s of sectionsToShift) {
            ops.push(prisma.recordSectionDef.update({
              where: { id: s.id },
              data: { position: s.position + 1 },
            }));
          }
          // Step 3: create Process details section at jiSection.position + 1
          ops.push(prisma.recordSectionDef.create({
            data: {
              recordKey,
              title: 'Process details',
              kind:  'fields',
              position: jiSection.position + 1,
              extraJson: null,
            },
          }));
          // Step 4: move expelled fields to new section (sectionIndex = jiIdx + 1)
          ops.push(prisma.recordFieldDef.updateMany({
            where: { id: { in: expelIds } },
            data: { sectionIndex: jiIdx + 1 },
          }));
        }
      }
    }
  }

  // ── FORMAT B: monitoring-log entryFields (sectionIndex IS NULL) ───────────
  const topFields  = def.fields.filter(f => f.sectionIndex === null);
  const jiGroup    = topFields.filter(f => f.group === 'Job info');

  if (jiGroup.length && jiGroup.some(f => STANDARD_INDICATORS.has(f.key))) {
    for (const f of topFields) {
      if (f.group === 'Job info') {
        if (f.key in CANONICAL) {
          const newLabel = CANONICAL[f.key].label;
          if (f.label !== newLabel) {
            ops.push(prisma.recordFieldDef.update({ where: { id: f.id }, data: { label: newLabel } }));
          }
        } else {
          ops.push(prisma.recordFieldDef.update({ where: { id: f.id }, data: { group: null } }));
        }
      } else if (f.key in CANONICAL) {
        const newLabel = CANONICAL[f.key].label;
        if (f.label !== newLabel) {
          ops.push(prisma.recordFieldDef.update({ where: { id: f.id }, data: { label: newLabel } }));
        }
      }
    }
  }

  // ── Commit ─────────────────────────────────────────────────────────────────
  if (ops.length) {
    ops.push(prisma.recordDefinition.update({ where: { recordKey }, data: { version: { increment: 1 } } }));
    await prisma.$transaction(ops);
    console.log(`UPDATED  ${recordKey}  (${ops.length - 1} op(s))`);
  } else {
    console.log(`no-op    ${recordKey}`);
  }
}

await prisma.$disconnect();
console.log('\nDone. Run: node scripts/export-record-defs.mjs   to verify snapshots.');
