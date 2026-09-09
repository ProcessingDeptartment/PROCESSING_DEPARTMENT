// Load data/record-definitions.json into the RecordDefinition tables on Neon.
//
//   node scripts/extract-definitions.mjs --emit      (regenerate the JSON first)
//   node scripts/verify-definitions.mjs               (must be 131/131 before seeding)
//   node scripts/seed-definitions.mjs                 (this)
//
// Idempotent: each record's child rows (sections / fields / autofills) are deleted and
// recreated, the parent is upserted, and `version` bumps so a running engine cache-busts.
// Needs DATABASE_URL (from .env). Purely additive to the schema -- KeyValue etc. untouched.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { definitions } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'record-definitions.json'), 'utf8'));
const prisma = new PrismaClient();

const jsonOrNull = (v) => (v && typeof v === 'object' && Object.keys(v).length ? v : null);

let ok = 0;
for (const d of definitions) {
  const base = {
    engine: d.engine,
    mount: d.mount ?? null,
    pageFile: d.pageFile,
    docCode: d.docCode ?? null,
    title: d.title ?? null,
    docRevisionStart: d.docRevisionStart ?? null,
    jobInfoGroup: d.jobInfoGroup ?? null,
    clientHook: d.clientHook ?? null,
    primaryBatchField: d.primaryBatchField ?? null,
    extraBatchFields: Array.isArray(d.extraBatchFields) ? d.extraBatchFields : [],
    extraJson: jsonOrNull(d.extraJson),
  };

  const sections = (d.sections || []).map((s) => ({
    title: s.title ?? null, kind: s.kind || 'fields', position: s.position, extraJson: jsonOrNull(s.extraJson),
  }));
  const fields = (d.fields || []).map((f) => ({
    sectionIndex: f.sectionIndex ?? null,
    parentFieldKey: f.parentFieldKey ?? null,
    key: f.key,
    label: f.label ?? null,
    type: f.type || 'text',
    required: !!f.required,
    readOnly: !!f.readOnly,
    unit: f.unit ?? null,
    options: Array.isArray(f.options) ? f.options : [],
    group: f.group ?? null,
    position: f.position,
    computeFn: f.computeFn ?? null,
    computeArgs: jsonOrNull(f.computeArgs),
    recordPickSource: f.recordPickSource ?? null,
    linkField: f.linkField ?? null,
    linkRelation: f.linkRelation ?? null,
    validateJson: jsonOrNull(f.validateJson),
    extraJson: jsonOrNull(f.extraJson),
  }));
  const autofills = (d.autofills || []).map((a) => ({
    watchKey: a.watchKey ?? null,
    sourceRecordKey: a.sourceRecordKey ?? null,
    matchField: a.matchField ?? null,
    fillMap: a.fillMap && typeof a.fillMap === 'object' ? a.fillMap : {},
    extraJson: jsonOrNull(a.extraJson),
  }));

  await prisma.$transaction([
    prisma.recordFieldDef.deleteMany({ where: { recordKey: d.recordKey } }),
    prisma.recordSectionDef.deleteMany({ where: { recordKey: d.recordKey } }),
    prisma.recordAutofillDef.deleteMany({ where: { recordKey: d.recordKey } }),
    prisma.recordDefinition.upsert({
      where: { recordKey: d.recordKey },
      create: { recordKey: d.recordKey, ...base, version: 1 },
      update: { ...base, version: { increment: 1 } },
    }),
    prisma.recordSectionDef.createMany({ data: sections.map((s) => ({ ...s, recordKey: d.recordKey })) }),
    prisma.recordFieldDef.createMany({ data: fields.map((f) => ({ ...f, recordKey: d.recordKey })) }),
    prisma.recordAutofillDef.createMany({ data: autofills.map((a) => ({ ...a, recordKey: d.recordKey })) }),
  ]);
  ok++;
}

const [defs, secs, flds, afs] = await Promise.all([
  prisma.recordDefinition.count(), prisma.recordSectionDef.count(),
  prisma.recordFieldDef.count(), prisma.recordAutofillDef.count(),
]);
console.log(`seeded ${ok}/${definitions.length} definitions`);
console.log(`db now: ${defs} definitions, ${secs} sections, ${flds} fields, ${afs} autofills`);
await prisma.$disconnect();
