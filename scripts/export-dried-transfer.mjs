#!/usr/bin/env node
// REC 7.4.10 Dried Abalone Transfer crates -> CSV: the "move to another format" path and a backup. One CSV per view
// (header row even when empty, ISO dates, UTF-8 with a byte-order mark so Excel opens it cleanly). Plain SQL views only.
// Needs DATABASE_URL.
//
//   node scripts/export-dried-transfer.mjs [outDir]        default: exports/dried-transfer-YYYY-MM-DD

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'exports', 'dried-transfer-' + new Date().toISOString().slice(0, 10));
const SOURCES = [
  ['dried_transfer_crate', 'ORDER BY job_no, crate_no, id'],
  ['v_dry_transfer_crates_by_job', 'ORDER BY job_no'],
  ['v_dry_transfer_crate_review', 'ORDER BY job_no, submission_id, row_no'],
];

function cell(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    const iso = v.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso; // DATE columns come back as midnight UTC
  }
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  const s = String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const prisma = new PrismaClient();
fs.mkdirSync(OUT, { recursive: true });
for (const [name, order] of SOURCES) {
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${name}" ${order}`);
  const cols = rows.length ? Object.keys(rows[0])
    : (await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, name)).map((r) => r.column_name);
  const lines = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))];
  fs.writeFileSync(path.join(OUT, name + '.csv'), '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
  console.log(name.padEnd(34), String(rows.length).padStart(6), 'rows');
}
console.log('wrote CSVs to', path.relative(ROOT, OUT));
await prisma.$disconnect();
