// Load data/record-definitions.json into the RecordDefinition tables on Neon.
//
//   node scripts/extract-definitions.mjs --emit      (regenerate the JSON first)
//   node scripts/verify-definitions.mjs               (must pass before seeding)
//   node scripts/seed-definitions.mjs                 (this)
//
// One transaction: clear the four tables, then createMany each in bulk (~8 statements total,
// not ~800). `version` bumps per record so a running engine cache-busts. Idempotent.
// Needs DATABASE_URL (from .env). Additive to the schema -- KeyValue etc. untouched.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { definitions } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'record-definitions.json'), 'utf8'));
const prisma = new PrismaClient();

const jsonOrNull = (v) => (v && typeof v === 'object' && Object.keys(v).length ? v : null);

// keep the cache-bust-on-reseed behaviour without a per-row upsert
const priorVersions = Object.fromEntries(
  (await prisma.recordDefinition.findMany({ select: { recordKey: true, version: true } }))
    .map((r) => [r.recordKey, r.version]),
);

const defRows = [];
const sectionRows = [];
const fieldRows = [];
const autofillRows = [];

for (const d of definitions) {
  defRows.push({
    recordKey: d.recordKey,
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
    version: (priorVersions[d.recordKey] ?? 0) + 1,
  });
  for (const s of d.sections || []) {
    sectionRows.push({
      recordKey: d.recordKey, title: s.title ?? null, kind: s.kind || 'fields',
      position: s.position, extraJson: jsonOrNull(s.extraJson),
    });
  }
  for (const f of d.fields || []) {
    fieldRows.push({
      recordKey: d.recordKey,
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
    });
  }
  for (const a of d.autofills || []) {
    autofillRows.push({
      recordKey: d.recordKey,
      watchKey: a.watchKey ?? null,
      sourceRecordKey: a.sourceRecordKey ?? null,
      matchField: a.matchField ?? null,
      fillMap: a.fillMap && typeof a.fillMap === 'object' ? a.fillMap : {},
      extraJson: jsonOrNull(a.extraJson),
    });
  }
}

await prisma.$transaction([
  prisma.recordFieldDef.deleteMany({}),
  prisma.recordSectionDef.deleteMany({}),
  prisma.recordAutofillDef.deleteMany({}),
  prisma.recordDefinition.deleteMany({}),
  prisma.recordDefinition.createMany({ data: defRows }),
  prisma.recordSectionDef.createMany({ data: sectionRows }),
  prisma.recordFieldDef.createMany({ data: fieldRows }),
  prisma.recordAutofillDef.createMany({ data: autofillRows }),
], { timeout: 120000 });

const [defs, secs, flds, afs] = await Promise.all([
  prisma.recordDefinition.count(), prisma.recordSectionDef.count(),
  prisma.recordFieldDef.count(), prisma.recordAutofillDef.count(),
]);
console.log(`seeded ${definitions.length} definitions`);
console.log(`db now: ${defs} definitions, ${secs} sections, ${flds} fields, ${afs} autofills`);
await prisma.$disconnect();
