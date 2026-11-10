// Archive every record definition that is about to change (MD/10_Archive-System.md).
// Run BEFORE export-record-defs.mjs: it compares each on-disk snapshot in public/data/record-defs/ with what the
// database would now export, and where they differ it archives the on-disk (old) version to the PROCESSING ARCHIVE.
// Safe to re-run -- a version already archived (same content) is skipped. Needs DATABASE_URL.
//
//   node scripts/archive-record-defs.mjs [--archive-out "<path>"]
//   node scripts/export-record-defs.mjs

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client';

const argOut = process.argv.indexOf('--archive-out');
if (argOut !== -1) {
  if (!process.argv[argOut + 1]) { console.error('--archive-out needs a path'); process.exit(1); }
  process.env.ARCHIVE_OUT = process.argv[argOut + 1];   // before archive-writer resolves the root
}

const require = createRequire(import.meta.url);
const { assembleRecordConfig } = require('../src/record-def.js');
const { writeArchiveEntry, buildHtmlPage, recordDefToHtml, archiveRoot, safeSegment, readIndex } = require('./archive-writer.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOTS = path.join(ROOT, 'public', 'data', 'record-defs');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const today = new Date().toISOString().slice(0, 10);

const prisma = new PrismaClient();
const root = archiveRoot();
console.log('archive: ' + root);

const defs = await prisma.recordDefinition.findMany({ select: { recordKey: true } });
let archived = 0, unchanged = 0, skipped = 0, failed = 0;
for (const { recordKey } of defs) {
  const file = path.join(SNAPSHOTS, encodeURIComponent(recordKey) + '.json');
  if (!fs.existsSync(file)) { skipped++; continue; }           // brand-new definition: nothing old to keep
  const onDisk = fs.readFileSync(file, 'utf8');
  const out = await assembleRecordConfig(prisma, recordKey);
  if (!out || !out.config) { console.warn('skip', recordKey); skipped++; continue; }
  // Compared exactly as export-record-defs.mjs writes it, so "differs" means "the export will change this file".
  if (sha(onDisk) === sha(JSON.stringify(out.config))) { unchanged++; continue; }

  let old;
  try { old = JSON.parse(onDisk); } catch { console.warn('skip (snapshot is not valid JSON)', recordKey); skipped++; continue; }
  const hash = sha(onDisk);
  const index = readIndex(root).filter((e) => e.type === 'record-def' && e.key === recordKey);
  if (index.some((e) => e.sha256 === hash)) { unchanged++; continue; }   // this exact version is already archived

  // A second change on the same day must not overwrite the version archived earlier that day.
  let label = safeSegment(old.version || old.docCode || recordKey) + '_' + today;
  if (index.some((e) => e.label === label)) label += '_' + hash.slice(0, 7);

  const title = [old.docCode, old.title || recordKey].filter(Boolean).join(' — ') + ' (record definition)';
  const entry = writeArchiveEntry({
    type: 'record-def', key: recordKey, label, title, data: old, meta: { sha256: hash },
    html: buildHtmlPage({ title, archivedAt: new Date().toISOString(), bodyHtml: recordDefToHtml(old) }),
  });
  if (entry) { archived++; console.log('archived ' + recordKey + ' -> ' + entry.htmlPath); } else failed++;
}
console.log(`archived ${archived}, unchanged ${unchanged}, skipped ${skipped}` + (failed ? `, FAILED ${failed}` : ''));
await prisma.$disconnect();
if (failed) process.exit(1);
