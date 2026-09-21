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
const OUT = path.join(ROOT, 'public', 'data', 'record-defs');
const prisma = new PrismaClient();

fs.mkdirSync(OUT, { recursive: true });
const defs = await prisma.recordDefinition.findMany({ select: { recordKey: true } });
let n = 0;
for (const { recordKey } of defs) {
  const out = await assembleRecordConfig(prisma, recordKey);
  if (!out || !out.config) { console.warn('skip', recordKey); continue; }
  fs.writeFileSync(path.join(OUT, encodeURIComponent(recordKey) + '.json'), JSON.stringify(out.config));
  n++;
}
console.log('wrote ' + n + ' definitions to ' + path.relative(ROOT, OUT));
await prisma.$disconnect();
