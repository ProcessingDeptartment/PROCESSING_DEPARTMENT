// Parse every record page's FormRecord.init / MonitoringLog.init config into the canonical
// RecordDefinition shape (see Claude outputs/relational-all-records-plan.md).
//
//   node scripts/extract-definitions.mjs            report only, writes nothing
//   node scripts/extract-definitions.mjs --emit     write data/record-definitions.json
//   node scripts/extract-definitions.mjs --json     dump the raw analysis
//
// Faithfulness of the parse is checked separately by scripts/verify-definitions.mjs, which
// rebuilds each engine config from the emitted definition and deep-compares it to the page.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractInitArg, evalConfig } from './lib/parse-record-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const RECDIR = path.join(ROOT, 'public', 'records');
const OUT = path.join(ROOT, 'data', 'record-definitions.json');
const mode = process.argv.includes('--emit') ? 'emit' : process.argv.includes('--json') ? 'json' : 'report';

// field types the generator maps 1:1 to a column + a renderer branch that already exists
const KNOWN_TYPES = new Set([
  'text', 'textarea', 'number', 'date', 'time', 'yesno', 'select',
  'jobsearch', 'jobnumber', 'computed', 'derived', 'batchseq', 'recordpick',
  'month', 'timestamp', 'datetime', 'digits',
]);
const NON_RECORD = new Set([
  '_shell-test.html', 'batch-trace.html', 'double-seam-trend.html', 'master-record-index.html',
  'quick-abalone-receiving.html', 'record-list.html', 'seam-quick-calculator.html',
]);
// config keys handled by an explicit column on RecordDefinition -- everything else on the
// config object is preserved verbatim in RecordDefinition.extraJson so the round-trip is loss-less.
const DEF_KEYS = new Set(['mount', 'recordKey', 'engine', 'docCode', 'title', 'docRevisionStart',
  'jobInfoGroup', 'clientHook', 'sections', 'roster', 'entryFields', 'fields', 'autofill']);
// field keys handled by an explicit column on RecordFieldDef
const FIELD_KEYS = new Set(['key', 'label', 'type', 'required', 'readOnly', 'unit', 'options',
  'group', 'computeExpr', 'recordPickSource', 'linkField', 'linkRelation', 'validateJson']);

const isFn = (v) => typeof v === 'function';
const plain = (v) => v && typeof v === 'object' && !Array.isArray(v);

// ---- one field row in canonical shape ----------------------------------------------
function fieldRow(f, sectionIndex, parentKey, position) {
  const row = {
    key: f.key ?? null,
    label: f.label ?? null,
    type: typeof f.type === 'string' ? f.type : 'text',
    required: !!f.required,
    readOnly: !!f.readOnly,
    unit: f.unit ?? null,
    options: Array.isArray(f.options) ? f.options : null,
    group: f.group ?? null,
    sectionIndex: sectionIndex ?? null,
    parentFieldKey: parentKey ?? null,
    position,
    computeExpr: typeof f.computeExpr === 'string' ? f.computeExpr : (isFn(f.compute) ? '(fn)' : null),
    recordPickSource: f.source ?? f.recordPickSource ?? null,
    linkField: f.linkField ?? null,
    linkRelation: f.linkRelation ?? null,
    validateJson: plain(f.validate) ? f.validate : null,
  };
  const extra = {};
  for (const [k, v] of Object.entries(f)) if (!FIELD_KEYS.has(k) && k !== 'source' && k !== 'compute' && k !== 'columns' && k !== 'fields' && !isFn(v)) extra[k] = v;
  if (Object.keys(extra).length) row.extraJson = extra;
  if (isFn(f.compute)) row.hasComputeFn = true;
  return row;
}

// ---- build the canonical definition + collect review flags -------------------------
function build(file, src) {
  const flags = [];
  const scriptBlocks = (src.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []).length;
  if (scriptBlocks > 1) flags.push(`bespoke: ${scriptBlocks} inline <script> blocks`);
  if (/customBody\s*:/.test(src)) flags.push('customBody hook');
  if (/deriveInto\s*:/.test(src)) flags.push('deriveInto hook');
  if (/window\.Rec[A-Z]\w*/.test(src)) flags.push('hardware/window.Rec* integration');

  const parsed = extractInitArg(src);
  if (!parsed) return { file, flags: [...flags, 'NO .init() call found'], def: null };

  let cfg;
  try { cfg = evalConfig(parsed.text); }
  catch (e) { return { file, flags: [...flags, 'UNPARSEABLE: ' + String(e.message).slice(0, 100)], def: null }; }

  const def = {
    recordKey: typeof cfg.recordKey === 'string' ? cfg.recordKey : null,
    engine: parsed.engine,
    mount: typeof cfg.mount === 'string' ? cfg.mount : null,
    pageFile: file,
    docCode: typeof cfg.docCode === 'string' ? cfg.docCode : null,
    title: typeof cfg.title === 'string' ? cfg.title : null,
    docRevisionStart: Number.isInteger(cfg.docRevisionStart) ? cfg.docRevisionStart : null,
    jobInfoGroup: typeof cfg.jobInfoGroup === 'string' ? cfg.jobInfoGroup : null,
    clientHook: null,
    sections: [],
    fields: [],
    autofills: [],
  };
  if (!def.recordKey) flags.push('recordKey not a string literal');

  const extra = {};
  for (const [k, v] of Object.entries(cfg)) if (!DEF_KEYS.has(k) && !isFn(v)) extra[k] = v;
  for (const [k, v] of Object.entries(cfg)) if (isFn(v)) { flags.push(`function-valued config: ${k}()`); extra[`__fn_${k}`] = true; }
  if (Object.keys(extra).length) def.extraJson = extra;

  let pos = 0;
  const addField = (f, sIdx, parentKey) => {
    if (!plain(f)) return;
    const row = fieldRow(f, sIdx, parentKey, pos++);
    def.fields.push(row);
    if (!KNOWN_TYPES.has(row.type)) flags.push(`unknown field type: '${row.type}' (${row.key})`);
    if (row.type === 'select' && !row.options) flags.push(`select without options[]: ${row.key}`);
    if ((row.type === 'computed' || row.type === 'derived') && row.computeExpr === '(fn)')
      flags.push(`${row.type} field '${row.key}' computed by a JS function`);
    else if ((row.type === 'computed' || row.type === 'derived') && !row.computeExpr)
      flags.push(`${row.type} field '${row.key}' has no expression`);
    if (row.hasComputeFn && row.type !== 'computed' && row.type !== 'derived')
      flags.push(`field '${row.key}' has a compute() function`);
    const kids = Array.isArray(f.columns) ? f.columns : (f.type === 'roster' && Array.isArray(f.fields) ? f.fields : null);
    if (kids) kids.forEach((c) => addField(c, sIdx, f.key));
  };

  if (Array.isArray(cfg.sections)) {
    cfg.sections.forEach((s, i) => {
      if (!plain(s)) return;
      const sExtra = {};
      for (const [k, v] of Object.entries(s)) if (k !== 'title' && k !== 'fields' && k !== 'roster' && !isFn(v)) sExtra[k] = v;
      def.sections.push({ title: s.title ?? null, kind: 'fields', position: def.sections.length, ...(Object.keys(sExtra).length ? { extraJson: sExtra } : {}) });
      (s.fields || []).forEach((f) => addField(f, i, null));
      if (s.roster && Array.isArray(s.roster.columns)) {
        const ri = def.sections.length;
        def.sections.push({ title: s.roster.title ?? 'Roster', kind: 'roster', position: ri });
        s.roster.columns.forEach((c) => addField({ ...c, type: c.type || 'text' }, ri, '@roster'));
      }
    });
  }
  (cfg.entryFields || []).forEach((f) => addField(f, null, null));
  (cfg.fields || []).forEach((f) => addField(f, null, null));
  if (cfg.roster && Array.isArray(cfg.roster.columns)) {
    const ri = def.sections.length;
    def.sections.push({ title: cfg.roster.title ?? 'Roster', kind: 'roster', position: ri });
    if (cfg.roster.title || Object.keys(cfg.roster).some((k) => k !== 'title' && k !== 'columns'))
      def.rosterExtra = Object.fromEntries(Object.entries(cfg.roster).filter(([k]) => k !== 'columns'));
    cfg.roster.columns.forEach((c) => addField({ ...c, type: c.type || 'text' }, ri, '@roster'));
  }

  if (Array.isArray(cfg.autofill)) {
    for (const a of cfg.autofill) {
      if (!plain(a)) continue;
      const row = {
        watchKey: a.watch ?? a.watchKey ?? null,
        sourceRecordKey: a.source ?? a.sourceRecordKey ?? null,
        matchField: a.matchField ?? null,
        fillMap: plain(a.fill) ? a.fill : (plain(a.fillMap) ? a.fillMap : {}),
      };
      const aExtra = {};
      for (const [k, v] of Object.entries(a)) if (!['watch', 'watchKey', 'source', 'sourceRecordKey', 'matchField', 'fill', 'fillMap'].includes(k) && !isFn(v)) aExtra[k] = v;
      if (Object.keys(aExtra).length) row.extraJson = aExtra;
      def.autofills.push(row);
    }
  }
  if (cfg.batchField) {
    const bf = def.fields.find((f) => f.key === cfg.batchField && f.parentFieldKey === null);
    if (bf) { bf.linkField = bf.linkField || 'batch'; bf.linkRelation = bf.linkRelation || 'self'; }
    def.primaryBatchField = cfg.batchField;
  }
  if (Array.isArray(cfg.extraBatchFields)) def.extraBatchFields = cfg.extraBatchFields;

  if (flags.some((x) => x.startsWith('customBody') || x.startsWith('deriveInto') || x.startsWith('hardware') || x.startsWith('bespoke')))
    def.clientHook = def.recordKey; // placeholder name; real hook wired during that record's migration

  return { file, flags, def };
}

// ---- run ---------------------------------------------------------------------------
const files = fs.readdirSync(RECDIR).filter((f) => f.endsWith('.html') && !NON_RECORD.has(f)).sort();
const results = files.map((f) => build(f, fs.readFileSync(path.join(RECDIR, f), 'utf8')));

if (mode === 'json') { console.log(JSON.stringify(results, null, 2)); process.exit(0); }

if (mode === 'emit') {
  const defs = results.filter((r) => r.def).map((r) => r.def);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), count: defs.length, definitions: defs }, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, OUT)} — ${defs.length} definitions (${results.length - defs.length} pages had no parseable init)`);
  process.exit(0);
}

const clean = results.filter((r) => r.flags.length === 0);
const flagged = results.filter((r) => r.flags.length > 0);
const unparse = results.filter((r) => r.flags.some((x) => x.startsWith('UNPARSEABLE') || x.startsWith('NO .init')));
console.log(`\n=== extract-definitions — ${results.length} record pages ===\n`);
console.log(`clean (map with no manual review):   ${clean.length}`);
console.log(`flagged:                             ${flagged.length}`);
console.log(`  unparseable / no init:             ${unparse.length}`);
console.log(`records with declarative autofill:   ${results.filter((r) => r.def && r.def.autofills.length).length}`);
console.log(`engines: ${results.filter((r) => r.def && r.def.engine === 'form-record').length} form-record · ${results.filter((r) => r.def && r.def.engine === 'monitoring-log').length} monitoring-log\n`);
console.log('--- flagged ---\n');
for (const r of flagged) {
  console.log(`${r.file}  (key=${r.def?.recordKey ?? '?'} engine=${r.def?.engine ?? '?'} fields=${r.def?.fields.length ?? 0})`);
  for (const fl of r.flags) console.log(`   - ${fl}`);
  console.log('');
}
