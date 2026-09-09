// End-to-end check: for every record, assemble its config straight from the seeded Neon
// tables (the same code path GET /api/record-def/:key uses) and deep-compare it to what the
// page declares inline. This proves the full round trip page -> extract -> seed -> assemble,
// not just page -> JSON. Needs DATABASE_URL.
//
//   node scripts/verify-record-def-api.mjs

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client';
import { readPageConfig } from './lib/parse-record-config.mjs';

const require = createRequire(import.meta.url);
const { assembleRecordConfig } = require('../src/record-def.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECDIR = path.join(ROOT, 'public', 'records');
const prisma = new PrismaClient();

function diff(a, b, at, out) {
  if (typeof a === 'function' || typeof b === 'function') return;
  if (a === b) return;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
    out.push(`${at}: page=${JSON.stringify(a)} db=${JSON.stringify(b)}`); return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    const la = (a || []).length, lb = (b || []).length;
    if (la !== lb) out.push(`${at}: length page=${la} db=${lb}`);
    for (let i = 0; i < Math.max(la, lb); i++) diff(a?.[i], b?.[i], `${at}[${i}]`, out);
    return;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (typeof a[k] === 'function' || typeof b[k] === 'function') continue;
    if (!(k in a)) { out.push(`${at}.${k}: missing on page (db=${JSON.stringify(b[k])})`); continue; }
    if (!(k in b)) { out.push(`${at}.${k}: missing in db (page=${JSON.stringify(a[k])})`); continue; }
    diff(a[k], b[k], `${at}.${k}`, out);
  }
}

const defs = await prisma.recordDefinition.findMany({ select: { recordKey: true, pageFile: true } });
let pass = 0; const fails = [];
for (const { recordKey, pageFile } of defs) {
  const page = readPageConfig(pageFile, RECDIR)?.config;
  const assembled = await assembleRecordConfig(prisma, recordKey);
  if (!page || !assembled) { fails.push({ recordKey, diffs: ['missing page or db config'] }); continue; }
  const out = [];
  diff(page, assembled.config, '', out);
  const real = out.filter((d) => {
    if (/db=undefined$/.test(d) && /traceSummary|compute|onSubmit|Body|derive/i.test(d)) return false;
    if (/\.type: missing on page \(db="text"\)$/.test(d)) return false;
    // intended enrichments the definition adds on top of the original page config:
    if (/^\.clientHook: missing on page/.test(d)) return false;             // §6.3 named hook pointer
    if (/\.(linkField|linkRelation): missing on page/.test(d)) return false; // API indexing metadata
    return true;
  });
  if (real.length === 0) pass++;
  else fails.push({ recordKey, pageFile, diffs: real });
}

console.log(`\n=== verify-record-def-api — ${defs.length} records (from Neon) ===\n`);
console.log(`page === assembled-from-DB:  ${pass}`);
console.log(`with differences:            ${fails.length}\n`);
for (const f of fails) {
  console.log(`✗ ${f.recordKey}  (${f.pageFile || ''})`);
  for (const d of f.diffs.slice(0, 12)) console.log(`    ${d}`);
  console.log('');
}
await prisma.$disconnect();
process.exit(fails.length ? 1 : 0);
