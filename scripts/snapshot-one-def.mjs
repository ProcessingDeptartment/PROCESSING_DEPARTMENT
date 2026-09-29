// Offline equivalent of export-record-defs.mjs for ONE record: builds the public/data/record-defs
// snapshot straight from data/record-definitions.json (no database needed). Same assembler code.
//   node scripts/snapshot-one-def.mjs dry-cooking [--check]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { assembleRecordConfig } = require('../src/record-def.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const key = process.argv[2];
const { definitions } = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'record-definitions.json'), 'utf8'));
const d = definitions.find((x) => x.recordKey === key);
if (!d) { console.error('no such record', key); process.exit(1); }
const sortBy = (arr) => [...(arr || [])].sort((a, b) => a.position - b.position);
const prisma = { recordDefinition: { findUnique: async () => ({
  ...d, extraJson: d.extraJson || null, extraBatchFields: d.extraBatchFields || [],
  sections: sortBy(d.sections), fields: sortBy(d.fields), autofills: d.autofills || [], version: 1,
}) } };
const out = await assembleRecordConfig(prisma, key);
const json = JSON.stringify(out.config);
const file = path.join(ROOT, 'public', 'data', 'record-defs', encodeURIComponent(key) + '.json');
if (process.argv.includes('--check')) {
  const cur = fs.readFileSync(file, 'utf8').trim();
  console.log(cur === json ? 'IDENTICAL' : 'DIFFERENT');
} else { fs.writeFileSync(file, json); console.log('wrote', path.relative(ROOT, file)); }
