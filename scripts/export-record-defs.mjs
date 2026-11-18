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
const defs = await prisma.recordDefinition.findMany({ select: { recordKey: true, version: true } });
let n = 0;
for (const { recordKey, version } of defs) {
  const out = await assembleRecordConfig(prisma, recordKey);
  if (!out || !out.config) { console.warn('skip', recordKey); continue; }
  const json = JSON.stringify(out.config);
  fs.writeFileSync(path.join(OUT, encodeURIComponent(recordKey) + '.json'), json);
  fs.writeFileSync(path.join(OUT, 'snapshots', encodeURIComponent(recordKey) + '_v' + version + '.json'), json);
  if (!noSnapshot) {
    await prisma.recordDefinitionRevision.upsert({
      where: { recordKey_version: { recordKey, version } },
      create: { recordKey, version, config: out.config },
      update: {},
    });
  }
  n++;
}
console.log('wrote ' + n + ' definitions to ' + path.relative(ROOT, OUT));
await prisma.$disconnect();
