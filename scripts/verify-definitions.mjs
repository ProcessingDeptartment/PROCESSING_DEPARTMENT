// Faithfulness gate for the definition extraction.
//
//   node scripts/extract-definitions.mjs --emit     (first)
//   node scripts/verify-definitions.mjs
//
// For every record page: rebuild the engine config object from data/record-definitions.json
// and deep-compare it to the config the page actually passes to FormRecord.init /
// MonitoringLog.init. Functions (traceSummary, compute, ...) can't survive the round trip and
// are reported as expected differences, not failures. Anything else that differs is a real
// extraction bug and must be fixed before the definition layer can replace the inline configs.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readPageConfig } from './lib/parse-record-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const RECDIR = path.join(ROOT, 'public', 'records');
const defs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'record-definitions.json'), 'utf8')).definitions;

const pageConfig = (file) => readPageConfig(file, RECDIR)?.config ?? null;

// ---- rebuild an engine config from a stored definition -----------------------------
function rebuild(def) {
  const cfg = { mount: def.mount, recordKey: def.recordKey };
  if (def.docCode != null) cfg.docCode = def.docCode;
  if (def.title != null) cfg.title = def.title;
  if (def.docRevisionStart != null) cfg.docRevisionStart = def.docRevisionStart;
  if (def.jobInfoGroup != null) cfg.jobInfoGroup = def.jobInfoGroup;
  for (const [k, v] of Object.entries(def.extraJson || {})) if (!k.startsWith('__fn_')) cfg[k] = v;

  const secByIndex = (i) => def.sections[i];
  const fieldOut = (f) => {
    const o = { key: f.key, label: f.label, type: f.type };
    if (f.required) o.required = true;
    if (f.readOnly) o.readOnly = true;
    if (f.unit != null) o.unit = f.unit;
    if (f.options != null) o.options = f.options;
    if (f.group != null) o.group = f.group;
    if (f.recordPickSource != null) o.source = f.recordPickSource;
    for (const [k, v] of Object.entries(f.extraJson || {})) o[k] = v;
    return o;
  };
  const inSection = (i, parent) => def.fields
    .filter((f) => f.sectionIndex === i && (f.parentFieldKey ?? null) === parent)
    .sort((a, b) => a.position - b.position).map(fieldOut);
  const topLevel = (parent) => def.fields
    .filter((f) => f.sectionIndex == null && (f.parentFieldKey ?? null) === parent)
    .sort((a, b) => a.position - b.position).map(fieldOut);

  const rosterSec = def.sections.find((s) => s.kind === 'roster');
  if (rosterSec) {
    const ri = def.sections.indexOf(rosterSec);
    cfg.roster = {
      ...(rosterSec.title != null ? { title: rosterSec.title } : {}),
      ...(rosterSec.extraJson || {}),
      columns: def.fields.filter((f) => f.sectionIndex === ri).sort((a, b) => a.position - b.position).map(fieldOut),
    };
  }
  const fieldSecs = def.sections.filter((s) => s.kind === 'fields');
  if (fieldSecs.length) {
    cfg.sections = fieldSecs.map((s) => ({ title: s.title, ...(s.extraJson || {}), fields: inSection(def.sections.indexOf(s), null) }));
  }
  const tl = topLevel(null);
  if (tl.length) cfg[def.engine === 'monitoring-log' ? 'entryFields' : 'fields'] = tl;

  if (def.autofills?.length) cfg.autofill = def.autofills.map((a) => ({ watch: a.watchKey, source: a.sourceRecordKey, matchField: a.matchField, fill: a.fillMap, ...(a.extraJson || {}) }));
  if (def.extraBatchFields) cfg.extraBatchFields = def.extraBatchFields;
  return cfg;
}

// ---- structural diff, ignoring functions and key order ----------------------------
function diff(a, b, at, out) {
  if (typeof a === 'function' || typeof b === 'function') return;
  if (a === b) return;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
    out.push(`${at}: page=${JSON.stringify(a)} def=${JSON.stringify(b)}`); return;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    const la = (a || []).length, lb = (b || []).length;
    if (la !== lb) out.push(`${at}: length page=${la} def=${lb}`);
    for (let i = 0; i < Math.max(la, lb); i++) diff(a?.[i], b?.[i], `${at}[${i}]`, out);
    return;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (typeof a[k] === 'function' || typeof b[k] === 'function') continue;
    if (!(k in a)) { out.push(`${at}.${k}: missing on page (def=${JSON.stringify(b[k])})`); continue; }
    if (!(k in b)) { out.push(`${at}.${k}: missing in def (page=${JSON.stringify(a[k])})`); continue; }
    diff(a[k], b[k], `${at}.${k}`, out);
  }
}

// ---- run --------------------------------------------------------------------------
let pass = 0; const fails = [];
for (const def of defs) {
  const page = pageConfig(def.pageFile);
  if (!page) { fails.push({ key: def.recordKey, diffs: ['could not re-read page config'] }); continue; }
  const rebuilt = rebuild(def);
  const out = [];
  diff(page, rebuilt, '', out);
  const real = out.filter((d) => {
    // a function on the page can't round-trip -- expected, not a fault
    if (/def=undefined$/.test(d) && /traceSummary|compute|onSubmit|Body|derive/i.test(d)) return false;
    // an implicit text field made explicit (type absent on page -> "text" in def) is safe normalisation
    if (/\.type: missing on page \(def="text"\)$/.test(d)) return false;
    return true;
  });
  if (real.length === 0) pass++;
  else fails.push({ key: def.recordKey, file: def.pageFile, diffs: real });
}

console.log(`\n=== verify-definitions — ${defs.length} records ===\n`);
console.log(`round-trip identical (ignoring functions):  ${pass}`);
console.log(`with real differences:                       ${fails.length}\n`);
for (const f of fails) {
  console.log(`✗ ${f.key}  (${f.file || ''})`);
  for (const d of f.diffs.slice(0, 12)) console.log(`    ${d}`);
  if (f.diffs.length > 12) console.log(`    … ${f.diffs.length - 12} more`);
  console.log('');
}
process.exit(fails.length ? 1 : 0);
