// Snapshot every record definition to public/data/record-defs/<recordKey>.json so record pages can
// draw instantly from the static site even while the (sleeping) API is waking. api-backend.js
// serves cached -> this snapshot -> live API, and refreshes the device cache from the API in the
// background. Re-run after any definition change (seed-definitions / template edits), then deploy.
// Needs DATABASE_URL.
//
//   node scripts/export-record-defs.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const { assembleRecordConfig } = require('../src/record-def.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// RECORD_DEFS_OUT lets the check script export to a temp folder without touching the committed files
const OUT = process.env.RECORD_DEFS_OUT ? path.resolve(process.env.RECORD_DEFS_OUT) : path.join(ROOT, 'public', 'data', 'record-defs');
// --no-snapshot suppresses DB revision upserts (for check/lint runs using RECORD_DEFS_OUT)
const noSnapshot = process.argv.includes('--no-snapshot') || !!process.env.RECORD_DEFS_OUT;
const prisma = new PrismaClient();

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'snapshots'), { recursive: true });

// Batch-fetch everything in 4 queries instead of one per record.
const [allDefs, allSections, allFields, allAutofills] = await Promise.all([
  prisma.recordDefinition.findMany(),
  prisma.recordSectionDef.findMany({ orderBy: { position: 'asc' } }),
  prisma.recordFieldDef.findMany({ orderBy: { position: 'asc' } }),
  prisma.recordAutofillDef.findMany(),
]);
let allSpecs = [];
try { allSpecs = await prisma.fieldSpec.findMany({ where: { active: true } }); } catch { /* table may not exist */ }

// Build per-record maps so assembleRecordConfig's prisma.recordDefinition.findUnique is served from memory.
const defByKey     = new Map(allDefs.map((d) => [d.recordKey, { ...d,
  sections:  allSections.filter((s) => s.recordKey === d.recordKey),
  fields:    allFields.filter((f) => f.recordKey === d.recordKey),
  autofills: allAutofills.filter((a) => a.recordKey === d.recordKey),
}]));
const specsByKey   = new Map();
for (const s of allSpecs) {
  if (!specsByKey.has(s.recordKey)) specsByKey.set(s.recordKey, []);
  specsByKey.get(s.recordKey).push(s);
}

// Fake prisma that serves from memory maps.
const fakePrisma = {
  recordDefinition: {
    findUnique: async ({ where }) => defByKey.get(where.recordKey) ?? null,
  },
  fieldSpec: {
    findMany: async ({ where }) => (specsByKey.get(where.recordKey) || []).filter((s) => s.active),
  },
};

let n = 0;
const revisionUpserts = [];
for (const def of allDefs) {
  const { recordKey, version } = def;
  const out = await assembleRecordConfig(fakePrisma, recordKey);
  if (!out || !out.config) { console.warn('skip', recordKey); continue; }
  const json = JSON.stringify(out.config);
  fs.writeFileSync(path.join(OUT, encodeURIComponent(recordKey) + '.json'), json);
  fs.writeFileSync(path.join(OUT, 'snapshots', encodeURIComponent(recordKey) + '_v' + version + '.json'), json);
  if (!noSnapshot) revisionUpserts.push({ recordKey, version, config: out.config });
  n++;
}

// Write all revision upserts in parallel.
if (revisionUpserts.length) {
  try {
    await Promise.all(revisionUpserts.map(({ recordKey, version, config }) =>
      prisma.recordDefinitionRevision.upsert({
        where: { recordKey_version: { recordKey, version } },
        create: { recordKey, version, config },
        update: {},
      })
    ));
  } catch { /* table not yet migrated */ }
}

console.log('wrote ' + n + ' definitions to ' + path.relative(ROOT, OUT));
await prisma.$disconnect();
