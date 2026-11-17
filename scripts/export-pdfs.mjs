// Organises archived PDFs into two export folders inside 27. Completed records:
//
//   <COMPLETED_RECORDS_DIR>\<jobNo>\<RecordTitle> - <date>.pdf
//       One folder per job number; every verified record entry for that job.
//
//   <COMPLETED_RECORDS_DIR>\Monitoring\<Record Name>\<YYYY-MM>.pdf
//       One file per month per monitoring record, named by the month of the latest
//       verification (so the file only appears once all entries are signed off).
//
// Always replaces existing files -- re-running is safe. Needs COMPLETED_RECORDS_DIR
// in .env (or the environment). Runs after archive-pdfs.mjs.
//
//   node scripts/export-pdfs.mjs [--archive-out "<path>"]

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

if (process.argv[2] === '--archive-out' && process.argv[3]) process.env.ARCHIVE_OUT = process.argv[3];

const require = createRequire(import.meta.url);
const { archiveRoot, readIndex } = require('./archive-writer.js');
const { jobNoOf, loadRecordConfig } = require('../src/archive-completed-record.js');

// ── Config ───────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const text = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch {}
}
loadEnv();

const ARCHIVE = archiveRoot();
const EXPORT = process.env.COMPLETED_RECORDS_DIR;
if (!EXPORT) {
  console.error('COMPLETED_RECORDS_DIR is not set in .env');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ARCHIVE, rel), 'utf8')); } catch { return null; } };
const safeFile = (s) => String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim();
const engineOfDef = (cfg) => (/ml/i.test(String((cfg || {}).mount || '')) || (cfg || {}).entryFields ? 'log' : 'form');

function copyPdf(src, dest) {
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return true;
  } catch (e) {
    console.warn('  copy failed:', dest, e.message);
    return false;
  }
}

// ── Build export ─────────────────────────────────────────────────────────────

const index = readIndex(ARCHIVE);

// Monitoring: group all index entries by (recordKey, submissionMonth) first so we
// can find the latest verification date across all entries of that month.
// Map key: `${recordKey}|${submissionMonth}`
const monGroups = new Map();

let jobsCopied = 0, monitoringCopied = 0, jobsSkipped = 0;

for (const e of index) {
  if (e.type !== 'completed-record') continue;
  if (!Array.isArray(e.pdfPaths) || !e.pdfPaths.length) continue;

  const cfg = loadRecordConfig(e.key) || {};

  if (engineOfDef(cfg) === 'log') {
    // Extract submission month from jsonPath, e.g. "json/completed-records/water-monitoring/2026-11/..."
    const m = e.jsonPath.match(/\/(\d{4}-\d{2})\//);
    if (!m) continue;
    const submissionMonth = m[1];
    const gk = e.key + '|' + submissionMonth;
    if (!monGroups.has(gk)) {
      monGroups.set(gk, {
        key: e.key,
        submissionMonth,
        recordName: safeFile(cfg.title || e.key),
        entries: [],
      });
    }
    monGroups.get(gk).entries.push(e);
    continue;
  }

  // ── Job-linked record ──────────────────────────────────────────────────────
  // Job number comes from the label (format: JOBNO_YYYY-MM-DD).
  const labelMatch = e.label && e.label.match(/^(.+?)_(\d{4}-\d{2}-\d{2})$/);
  const jobNo = labelMatch ? labelMatch[1] : null;
  const dateStr = labelMatch ? labelMatch[2] : null;
  if (!jobNo || !dateStr) { jobsSkipped++; continue; }

  const recordTitle = safeFile(cfg.title || e.key);

  for (const pdfPath of e.pdfPaths) {
    const src = path.join(ARCHIVE, pdfPath);
    if (!fs.existsSync(src)) continue;
    // Multiple entries on the same day get an entry-id suffix in the basename; keep it.
    const baseSuffix = path.basename(pdfPath, '.pdf').replace(/^[^_]*_\d{4}-\d{2}-\d{2}/, '').replace(/^_/, '');
    const filename = recordTitle + (baseSuffix ? ' (' + baseSuffix + ')' : '') + ' - ' + dateStr + '.pdf';
    if (copyPdf(src, path.join(EXPORT, jobNo, filename))) jobsCopied++;
  }
}

// ── Monitoring export ─────────────────────────────────────────────────────────
for (const { key, submissionMonth, recordName, entries } of monGroups.values()) {
  // Find the latest verification date across all entries of this month.
  let latestVerifMonth = null;
  for (const e of entries) {
    const data = readJson(e.jsonPath);
    if (!data) continue;
    for (const entry of (data.entries || [])) {
      const vd = entry?.verification?.verifiedDate;
      if (vd && vd.slice(0, 7) > (latestVerifMonth || '')) latestVerifMonth = vd.slice(0, 7);
    }
  }
  const exportMonth = latestVerifMonth || submissionMonth;

  // Pick the most recently archived PDF that exists on disk.
  const sorted = [...entries].sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || ''));
  let srcPdf = null;
  outer: for (const e of sorted) {
    for (const p of (e.pdfPaths || [])) {
      const f = path.join(ARCHIVE, p);
      if (fs.existsSync(f)) { srcPdf = f; break outer; }
    }
  }
  if (!srcPdf) continue;

  const dest = path.join(EXPORT, 'Monitoring', recordName, exportMonth + '.pdf');
  if (copyPdf(srcPdf, dest)) monitoringCopied++;
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`export: ${path.resolve(EXPORT)}`);
console.log(`jobs: ${jobsCopied} PDFs copied${jobsSkipped ? ', ' + jobsSkipped + ' skipped (no job number)' : ''}`);
console.log(`monitoring: ${monitoringCopied} PDFs copied`);
