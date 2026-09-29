#!/usr/bin/env node
// REC 7.4.1 Drying Process -> CSV: the "move to another format" path and a backup. Writes one CSV per table/view
// (header row, ISO dates, UTF-8 with a byte-order mark so Excel opens it cleanly). Plain SQL views only, no
// database-specific features, so the same files load into any other database.
// Needs DATABASE_URL.
//
//   node scripts/export-dry-process.mjs [outDir]        default: exports/dry-process-YYYY-MM-DD

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'exports', 'dry-process-' + new Date().toISOString().slice(0, 10));
const SOURCES = [
  ['dry_process_entry', 'ORDER BY job_no, entry_at, id'],
  ['dry_process_steam', 'ORDER BY job_no, steam_no, id'],
  ['v_dry_job_progress', 'ORDER BY job_no'],
  ['v_dry_yield_by_month', 'ORDER BY month'],
  ['v_dry_yield_by_farm', 'ORDER BY farm'],
  ['v_dry_trolley_loading', 'ORDER BY job_no'],
  ['v_dry_steam_profile', 'ORDER BY job_no'],
  ['v_dry_jobs_in_dry_room', 'ORDER BY job_no'],
  ['v_dry_monitoring_trolley_check', 'ORDER BY job_no, monitoring_date'],
  ['dry_process_movement_audit', 'ORDER BY id'],
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
  const cols = rows.length ? Object.keys(rows[0]) : (await prisma.$queryRawUnsafe(`SELECT * FROM "${name}" LIMIT 0`), []);
  const lines = rows.length ? [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))] : [];
  fs.writeFileSync(path.join(OUT, name + '.csv'), '﻿' + lines.join('\r\n') + (lines.length ? '\r\n' : ''), 'utf8');
  console.log(name.padEnd(34), String(rows.length).padStart(6), 'rows');
}
console.log('wrote CSVs to', path.relative(ROOT, OUT));
await prisma.$disconnect();
