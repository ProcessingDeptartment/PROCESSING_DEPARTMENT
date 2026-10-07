// One-time import of the QAM's yearly FSMS calendar spreadsheets (2020-2026) into fsms_year / fsms_event.
// Spec: MD/fsms-calendar-instructions.md section 9. Needs DATABASE_URL and the xlsx package, which the
// running app does not use, so install it without saving:
//
//   npm i --no-save xlsx
//   node scripts/import-fsms-calendar.mjs "<folder with the yearly .xlsx files>"            # dry run: prints what it would load
//   node scripts/import-fsms-calendar.mjs "<folder>" --apply                               # writes to the DB
//
// Each file is matched to a year by the 4-digit year in its filename. Re-running is safe: a year that
// already has events is skipped (use --replace to wipe and reload that year).
//
// Sheet layout assumed: a header row containing month names (Jan..Dec, or full names) and a category
// in the first column of each row. Category cells left blank (merged) carry the category above. Every
// non-empty cell in a month column becomes one event; a cell with several lines becomes several events.
// Cells whose row can't be matched to a category are listed at the end instead of guessed.

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
let XLSX;
try { XLSX = require('xlsx'); } catch { console.error('Missing xlsx. Run: npm i --no-save xlsx'); process.exit(1); }

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const APPLY = args.includes('--apply'), REPLACE = args.includes('--replace');
if (!dir || !fs.existsSync(dir)) { console.error('Usage: node scripts/import-fsms-calendar.mjs "<folder>" [--apply] [--replace]'); process.exit(1); }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const monthOf = (v) => { const i = MONTHS.indexOf(String(v || '').trim().toLowerCase().slice(0, 3)); return i < 0 ? 0 : i + 1; };

// Spreadsheet wording -> category name. First match wins, so keep the specific ones first.
const CATEGORY_RULES = [
  [/annual|verification|validation/i, 'Annual Testing/Verification'],
  [/monthly|micro|testing/i, 'Monthly Testing'],
  [/audit|inspection/i, 'Audits'],
  [/calibrat/i, 'Calibration'],
  [/medical/i, 'Medicals'],
  [/recall|traceab/i, 'Mock Recalls'],
  [/gmp/i, 'GMP'],
  [/training/i, 'Training'],
  [/meeting|review/i, 'Meetings'],
];
// 2020-2024 sheets have no category column, so those events are classified by their title instead.
const TITLE_RULES = [
  [/GMP|facility.*inspect/i, 'GMP'],
  [/recall|traceability exercise/i, 'Mock Recalls'],
  [/medical/i, 'Medicals'],
  [/calibrat/i, 'Calibration'],
  [/training/i, 'Training'],
  [/meeting|review|new qcs/i, 'Meetings'],
  [/audit|nrcs|risk assessment/i, 'Audits'],
  [/micro|airplate|swab/i, 'Monthly Testing'],
  [/annual|validation|heat dr?istubution|F0|oprp|sterility|heavy metal|water test/i, 'Annual Testing/Verification'],
];
const categoryOf = (label) => { const r = CATEGORY_RULES.find(([re]) => re.test(label)); return r ? r[1] : null; };

const files = fs.readdirSync(dir).filter((f) => /\.xlsx?$/i.test(f) && !f.startsWith('~$'))
  .map((f) => ({ f, year: +(f.match(/(20\d\d)/) || [])[1] })).filter((x) => x.year).sort((a, b) => a.year - b.year);
if (!files.length) { console.error('No .xlsx files with a 4-digit year in the name found in ' + dir); process.exit(1); }

const parsed = [];
for (const { f, year } of files) {
  const wb = XLSX.readFile(path.join(dir, f));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  const hdr = grid.findIndex((row) => row.filter((c) => monthOf(c)).length >= 6);
  if (hdr < 0) { console.warn(`${f}: no month header row found, skipped`); continue; }
  const cols = grid[hdr].map((c, i) => [i, monthOf(c)]).filter(([, m]) => m);
  const events = [], unmatched = [];
  let label = '';
  for (const row of grid.slice(hdr + 1)) {
    const first = String(row[0] || '').trim();
    if (first) label = first;
    for (const [i, month] of cols) {
      for (const line of String(row[i] || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
        const category = categoryOf(label) || (TITLE_RULES.find(([re]) => re.test(line)) || [])[1] || null;
        (category ? events : unmatched).push({ year, month, category, title: line.slice(0, 300), label });
      }
    }
  }
  parsed.push({ f, year, events, unmatched });
}

for (const p of parsed) {
  const per = {}; p.events.forEach((e) => { per[e.category] = (per[e.category] || 0) + 1; });
  console.log(`${p.year}  ${p.f}: ${p.events.length} events`, per, p.unmatched.length ? `| ${p.unmatched.length} UNMATCHED` : '');
  p.unmatched.slice(0, 10).forEach((u) => console.log(`     ? [${u.label}] month ${u.month}: ${u.title}`));
}
if (!APPLY) { console.log('\nDry run only. Re-run with --apply to write.'); process.exit(0); }

const prisma = new PrismaClient();
const cats = Object.fromEntries((await prisma.fsmsCategory.findMany()).map((c) => [c.name, c.id]));
if (!Object.keys(cats).length) { console.error('fsms_category is empty: run the 20261007150000_fsms_calendar migration first.'); process.exit(1); }
for (const p of parsed) {
  const y = await prisma.fsmsYear.upsert({ where: { year: p.year }, update: {}, create: { year: p.year } });
  const have = await prisma.fsmsEvent.count({ where: { yearId: y.id } });
  if (have && !REPLACE) { console.log(`${p.year}: already has ${have} events, skipped (--replace to reload)`); continue; }
  if (have) await prisma.fsmsEvent.deleteMany({ where: { yearId: y.id } });
  await prisma.fsmsEvent.createMany({ data: p.events.map((e) => ({ yearId: y.id, categoryId: cats[e.category], month: e.month, title: e.title })) });
  console.log(`${p.year}: loaded ${p.events.length} events`);
}
await prisma.$disconnect();
