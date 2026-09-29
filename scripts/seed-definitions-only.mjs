// Seed ONLY the named records' definitions from data/record-definitions.json into the RecordDefinition tables
// on Neon (every other record is left untouched). Same behaviour as seed-definitions.mjs, one transaction,
// `version` bumps per record so a running engine cache-busts. Idempotent. Needs DATABASE_URL (from .env).
//
//   node scripts/seed-definitions-only.mjs drying-process dry-monitoring
//   node scripts/snapshot-one-def.mjs <key>      (the static snapshot for each, if not already made)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = process.argv.slice(2);
if (!KEYS.length) { console.error('usage: node scripts/seed-definitions-only.mjs <recordKey> [<recordKey> ...]'); process.exit(1); }
const definitions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'record-definitions.json'), 'utf8')).definitions.filter((d) => KEYS.includes(d.recordKey));
if (definitions.length !== KEYS.length) throw new Error('not all of these records are in data/record-definitions.json: ' + KEYS.join(', '));
const prisma = new PrismaClient();

const jsonOrNull = (v) => (v && typeof v === 'object' && Object.keys(v).length ? v : null);

// keep the cache-bust-on-reseed behaviour without a per-row upsert
const priorVersions = Object.fromEntries(
  (await prisma.recordDefinition.findMany({ where: { recordKey: { in: KEYS } }, select: { recordKey: true, version: true } }))
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
  prisma.recordFieldDef.deleteMany({ where: { recordKey: { in: KEYS } } }),
  prisma.recordSectionDef.deleteMany({ where: { recordKey: { in: KEYS } } }),
  prisma.recordAutofillDef.deleteMany({ where: { recordKey: { in: KEYS } } }),
  prisma.recordDefinition.deleteMany({ where: { recordKey: { in: KEYS } } }),
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
