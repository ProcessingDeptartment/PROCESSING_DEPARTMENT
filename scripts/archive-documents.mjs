// Archive the CURRENT version of every controlled document and record template (MD/10_Archive-System.md):
//   policies, procedures, SOPs, PRPs  -- public/<folder>/*.html (the page's built-in content) + any edits and
//                                        revision history saved in the database
//   record templates                  -- public/data/record-defs/*.json
//
// Each is written once per version: <code>_rev<N>_<revision date>. Re-running skips anything already archived with
// identical content, and archives a new copy when a document has been edited or its revision bumped -- so running
// this on a schedule (or after any document change) keeps every version.
// Read-only against the database. Needs DATABASE_URL (use --no-db to archive the built-in content only).
//
//   node scripts/archive-documents.mjs [--no-db] [--archive-out "<path>"] [--dry-run]

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noDb = args.includes('--no-db');
const ao = args.indexOf('--archive-out');
if (ao !== -1) {
  if (!args[ao + 1]) { console.error('--archive-out needs a path'); process.exit(1); }
  process.env.ARCHIVE_OUT = args[ao + 1];   // before archive-writer resolves the root
}

const require = createRequire(import.meta.url);
const { writeArchiveEntry, buildHtmlPage, documentToHtml, recordDefToHtml, archiveRoot, readIndex, safeSegment, beginBatch, endBatch } = require('./archive-writer.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const today = new Date().toISOString().slice(0, 10);

// folder -> archive type, the global the page calls .mount() on, the storage prefix of saved edits, the doc-number field.
const KINDS = [
  { dir: 'policies', type: 'policy', global: 'PolicyDoc', prefix: 'policy_doc:', codeField: 'polNo', noun: 'policy' },
  { dir: 'procedures', type: 'procedure', global: 'ProcedureDoc', prefix: 'procedure_doc:', codeField: 'procNo', noun: 'procedure' },
  { dir: 'sops', type: 'sop', global: 'SopDoc', prefix: 'sop_doc:', codeField: 'sopNo', noun: 'SOP' },
  { dir: 'prps', type: 'prp', global: 'PrpDoc', prefix: 'prp_doc:', codeField: 'prpNo', noun: 'PRP' },
];

// The document's content is the object literal the page passes to <Global>.mount(...). Evaluate just that call.
function mountConfig(html, globalName) {
  const at = html.indexOf(globalName + '.mount(');
  if (at === -1) return null;
  const end = html.indexOf('</script>', at);
  if (end === -1) return null;
  let captured = null;
  try { vm.runInNewContext(html.slice(at, end), { [globalName]: { mount: (c) => { captured = c; } } }, { timeout: 2000 }); }
  catch { return null; }
  return captured && typeof captured === 'object' ? captured : null;
}

const ddmmyyyy = (s) => { const m = /^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/.exec(String(s || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const parse = (v) => { try { return JSON.parse(v); } catch { return null; } };

// Saved edits and revision history, keyed by storage key. Empty when --no-db.
const stored = new Map();
let prisma = null;
if (!noDb) {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
  const prefixes = [...KINDS.map((k) => k.prefix), 'document_revision:'];
  const rows = await prisma.keyValue.findMany({ where: { OR: prefixes.map((p) => ({ key: { startsWith: p } })) }, select: { key: true, value: true } });
  for (const r of rows) stored.set(r.key, parse(r.value));
}

const root = archiveRoot();
console.log('archive: ' + root + (dryRun ? '  (dry run -- nothing will be written)' : '') + (noDb ? '  (built-in content only: database edits not read)' : ''));
const index = readIndex(root);
const hashes = new Set(index.filter((e) => e.sha256).map((e) => e.type + '|' + e.key + '|' + e.sha256));
const labels = new Set(index.map((e) => e.type + '|' + e.key + '|' + e.label));

const counts = {};
let failed = 0;
function put({ type, key, baseLabel, title, data, bodyHtml }) {
  const c = counts[type] || (counts[type] = { archived: 0, unchanged: 0 });
  const hash = sha(JSON.stringify(data));
  if (hashes.has(type + '|' + key + '|' + hash)) { c.unchanged++; return; }
  // Content changed without a new revision number: keep both, the newer one marked by its content hash.
  let label = safeSegment(baseLabel);
  if (labels.has(type + '|' + key + '|' + label)) label += '_' + hash.slice(0, 7);
  if (dryRun) { c.archived++; return; }
  const entry = writeArchiveEntry({
    type, key, label, title, data, meta: { sha256: hash },
    html: buildHtmlPage({ title, archivedAt: new Date().toISOString(), bodyHtml }),
  });
  if (entry) { c.archived++; hashes.add(type + '|' + key + '|' + hash); labels.add(type + '|' + key + '|' + label); }
  else failed++;
}

if (!dryRun) beginBatch();
try {
  for (const kind of KINDS) {
    const dir = path.join(PUBLIC, kind.dir);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
      const cfg = mountConfig(fs.readFileSync(path.join(dir, file), 'utf8'), kind.global);
      if (!cfg || !cfg.recordKey) continue;   // list pages and the like
      const edits = stored.get(kind.prefix + cfg.recordKey) || {};
      const revs = Array.isArray(stored.get('document_revision:' + cfg.recordKey)) ? stored.get('document_revision:' + cfg.recordKey) : [];
      const last = revs.length ? revs[revs.length - 1] : null;

      // Same merge the page does: saved edits win over the built-in content.
      let sections = cfg.sections;
      if (edits.sections) {
        if (Array.isArray(edits.sections)) sections = edits.sections;
        else if (Array.isArray(cfg.sections)) sections = cfg.sections.map((s, i) => { const k = s.key || 's' + (i + 1); return edits.sections[k] != null ? { ...s, html: edits.sections[k] } : s; });
        else sections = { ...(cfg.sections || {}), ...edits.sections };
      }
      const code = edits[kind.codeField] || cfg[kind.codeField] || '';
      const name = edits.name || cfg.name || cfg.recordKey;
      const revision = last ? last.revisionNumber : (cfg.startRev || 1);
      const revisionDate = last && last.changedAt ? new Date(last.changedAt).toISOString().slice(0, 10) : (ddmmyyyy(cfg.baselineDate) || cfg.baselineDate || null);
      const history = [
        ...(cfg.baselineHistory || []).map((h) => ({ revision: h.rev, reason: h.reason, date: h.date })),
        ...revs.map((r) => ({ revision: r.revisionNumber, reason: r.reason, date: r.changedAt ? new Date(r.changedAt).toISOString().slice(0, 10) : '', changedBy: [r.changedBy, r.changedByTitle].filter(Boolean).join(', ') })),
      ];
      const doc = { recordKey: cfg.recordKey, type: kind.type, code, name, area: cfg.area || '', revision, revisionDate, sections, relatedDocs: edits.relatedDocs || cfg.relatedDocs || [], history, sourceFile: kind.dir + '/' + file };
      put({
        type: kind.type, key: cfg.recordKey,
        baseLabel: (code || cfg.recordKey) + '_rev' + revision + '_' + (/^[0-9]{4}-/.test(revisionDate || '') ? revisionDate : today),
        title: [code, name].filter(Boolean).join(' — ') + ' (' + kind.noun + ', rev ' + revision + ')',
        data: doc, bodyHtml: documentToHtml(doc),
      });
    }
  }

  // Record templates: the current definition of every record form.
  const defsDir = path.join(PUBLIC, 'data', 'record-defs');
  for (const file of fs.readdirSync(defsDir).filter((f) => f.endsWith('.json')).sort()) {
    const cfg = parse(fs.readFileSync(path.join(defsDir, file), 'utf8'));
    if (!cfg) continue;
    const key = cfg.recordKey || decodeURIComponent(file.replace(/\.json$/, ''));
    const title = [cfg.docCode, cfg.title || key].filter(Boolean).join(' — ') + ' (record template)';
    put({ type: 'record-def', key, baseLabel: (cfg.version || cfg.docCode || key) + '_' + today, title, data: cfg, bodyHtml: recordDefToHtml(cfg) });
  }
} finally {
  if (!dryRun) endBatch();
}

for (const [type, c] of Object.entries(counts)) console.log(`${type}: ${dryRun ? 'would archive' : 'archived'} ${c.archived}, unchanged ${c.unchanged}`);
if (failed) console.log('FAILED ' + failed);
if (prisma) await prisma.$disconnect();
if (failed) process.exit(1);
