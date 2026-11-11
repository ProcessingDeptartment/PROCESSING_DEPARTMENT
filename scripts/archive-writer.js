// Shared writer for the permanent, human-readable archive (MD/10_Archive-System.md).
// Every archived item is written twice -- <label>.json (machine-readable, used to restore) and <label>.html
// (opened by staff) -- and listed in <archive root>/index.json, which public/pages/archive.html browses.
//
// The archive root is ARCHIVE_OUT, or "PROCESSING ARCHIVE" beside the repo (same level as "DB ARCHIVE").
// writeArchiveEntry never throws: archiving must not be able to fail a save or an export.

const fs = require('fs');
const path = require('path');

const TYPE_DIRS = {
  'record-def': 'record-defs',
  'completed-record': 'completed-records',
  policy: 'policies',
  procedure: 'procedures',
  sop: 'sops',
  prp: 'prps',
};
// The machine-readable copies live in their own tree (json/<same path>), apart from the pages staff open.
const JSON_DIR = 'json';

// The archive location is ONE setting: ARCHIVE_OUT=<folder> in the project's .env file (or the environment, or a
// script's --archive-out). Every archive script, the cmd files and server.js read it from here, so moving the archive
// is a one-line change. Only that one line is read from .env.
function envArchiveOut() {
  try {
    const text = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    const m = /^\s*ARCHIVE_OUT\s*=\s*(.*?)\s*$/m.exec(text);
    return m ? m[1].replace(/^(["'])(.*)\1$/, '$2') : '';
  } catch { return ''; }
}

function archiveRoot() {
  if (!process.env.ARCHIVE_OUT) { const v = envArchiveOut(); if (v) process.env.ARCHIVE_OUT = v; }
  return process.env.ARCHIVE_OUT
    ? path.resolve(process.env.ARCHIVE_OUT)
    : path.resolve(__dirname, '..', '..', 'PROCESSING ARCHIVE');
}

// Windows-safe single path segment: no separators, reserved characters, or trailing dots / spaces.
function safeSegment(s) {
  const out = String(s == null ? '' : s).trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return out.slice(0, 80) || 'unnamed';
}

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function readIndex(root) {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

// Written to a temp file then renamed, so a reader (or a crash) never sees a half-written index.
// Batch mode: a script writing many entries keeps the index in memory and writes it once at the end,
// instead of re-reading and re-writing index.json on the network drive for every entry.
let batch = null;
function beginBatch() { batch = readIndex(archiveRoot()); }
function endBatch() {
  if (!batch) return;
  try { fs.mkdirSync(archiveRoot(), { recursive: true }); writeIndex(archiveRoot(), batch); }
  catch (e) { console.error('archive index write failed', e && e.message ? e.message : e); }
  batch = null;
}

function writeIndex(root, list) {
  const file = path.join(root, 'index.json');
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 1));
  fs.renameSync(tmp, file);
}

// type: 'record-def' | 'completed-record' | 'policy' | 'procedure'. key: record key / document key.
// label: file name without extension. subdir: optional extra folder under the key (completed records use YYYY-MM).
// meta: optional extra fields kept on the index entry (e.g. a content hash). Returns the index entry, or null on failure.
function writeArchiveEntry({ type, key, label, title, data, html, subdir, meta }) {
  try {
    const typeDir = TYPE_DIRS[type];
    if (!typeDir) throw new Error('unknown archive type: ' + type);
    const root = archiveRoot();
    const parts = [typeDir, safeSegment(key)];
    if (subdir) parts.push(safeSegment(subdir));
    const name = safeSegment(label);
    fs.mkdirSync(path.join(root, ...parts), { recursive: true });
    fs.mkdirSync(path.join(root, JSON_DIR, ...parts), { recursive: true });

    const archivedAt = new Date().toISOString();
    const jsonPath = [JSON_DIR, ...parts, name + '.json'].join('/');
    const htmlPath = [...parts, name + '.html'].join('/');
    fs.writeFileSync(path.join(root, jsonPath), JSON.stringify(data, null, 2));
    fs.writeFileSync(path.join(root, htmlPath), html != null ? html : buildHtmlPage({
      title: title || key, archivedAt, bodyHtml: '<pre>' + esc(JSON.stringify(data, null, 2)) + '</pre>',
    }));

    const entry = { type, key, label: name, archivedAt, htmlPath, jsonPath, title: title || key, ...(meta || {}) };
    const current = batch || readIndex(root);
    // Keep the saved PDFs listed on the item when it is rewritten (archive-pdfs.mjs re-makes them if the content changed).
    const prev = current.find((e) => e.type === type && e.key === key && e.label === name);
    if (prev && prev.pdfPaths) { entry.pdfPaths = prev.pdfPaths; if (prev.pdfSha) entry.pdfSha = prev.pdfSha; }
    const rest = current.filter((e) => e !== prev);
    if (batch) batch = [entry, ...rest]; else writeIndex(root, [entry, ...rest]);
    return entry;
  } catch (e) {
    console.error('archive write failed (' + type + ' ' + key + ')', e && e.message ? e.message : e);
    return null;
  }
}

const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;font:14px/1.45 "Segoe UI",Arial,sans-serif;color:#1c2733;background:#f3f5f7}
header{background:#12344d;color:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
header h1{margin:0;font-size:18px;font-weight:600}
header .when{font-size:12px;opacity:.85}
main{max-width:1100px;margin:20px auto;padding:0 20px 40px}
h2{font-size:15px;margin:26px 0 8px;padding-bottom:4px;border-bottom:2px solid #12344d}
h3{font-size:13px;margin:16px 0 6px;color:#12344d}
table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:10px}
th,td{border:1px solid #cfd6dd;padding:5px 8px;text-align:left;vertical-align:top;font-size:12.5px;word-break:break-word}
th{background:#e8edf2;font-weight:600}
table.kv th{width:28%}
.entry{background:#fff;border:1px solid #cfd6dd;border-radius:4px;padding:12px 14px;margin-bottom:16px;page-break-inside:avoid}
.entry-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}
.entry-head strong{font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px 14px;margin-bottom:8px}
.cell{border-bottom:1px solid #e3e8ed;padding:3px 0}
.cell .l{display:block;font-size:11px;color:#5a6b7b}
.cell .v{font-size:13px;white-space:pre-wrap;word-break:break-word}
.badge{display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.badge.draft{background:#e3e8ed;color:#44525f}.badge.submitted{background:#fde9c8;color:#7a4b00}.badge.verified{background:#d3efd9;color:#165a2a}
.muted{color:#6b7a88}
pre{background:#fff;border:1px solid #cfd6dd;padding:10px;font-size:12px;white-space:pre-wrap;word-break:break-word}
img.sig{max-height:60px;max-width:220px;border:1px solid #e3e8ed}
.toolbar{max-width:1100px;margin:14px auto 0;padding:0 20px;display:flex;gap:8px;justify-content:flex-end}
.toolbar button{font:inherit;font-size:13px;padding:7px 14px;border:1px solid #12344d;border-radius:4px;background:#fff;color:#12344d;cursor:pointer}
.toolbar button.primary{background:#12344d;color:#fff}
.toolbar button:hover{opacity:.85}
.doc-body{background:#fff;border:1px solid #cfd6dd;border-radius:4px;padding:6px 18px 14px;margin-bottom:12px}
.doc-body h3{font-size:14px;margin:18px 0 6px}
.doc-body img{max-width:100%}
@media print{.toolbar{display:none}.doc-body{border:0;padding:0}body{background:#fff}header{background:#fff;color:#000;border-bottom:2px solid #000;padding:0 0 8px}main{margin:10px 0;padding:0;max-width:none}.entry{border-color:#999}}
`;

function buildHtmlPage({ title, archivedAt, bodyHtml }) {
  const at = archivedAt ? new Date(archivedAt) : new Date();
  const when = isNaN(at) ? String(archivedAt) : at.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — archived</title>
<style>${PAGE_CSS}</style></head>
<body>
<header><h1>${esc(title)}</h1><span class="when">Archived ${esc(when)}</span></header>
<div class="toolbar"><button type="button" class="primary" onclick="window.print()">Print / Save as PDF</button><button type="button" onclick="archiveToWord()">Download Word document</button></div>
<main>
${bodyHtml || ''}
</main>
<script>
// Word opens an HTML document saved as .doc, so the page is handed over as-is (minus the buttons and this script).
function archiveToWord() {
  var doc = document.documentElement.cloneNode(true);
  Array.prototype.forEach.call(doc.querySelectorAll('.toolbar, script'), function (n) { n.parentNode.removeChild(n); });
  var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' + doc.innerHTML + '</html>';
  var blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (document.title.replace(/ — archived$/, '').replace(/[<>:"/\|?*]+/g, '-').trim() || 'archive') + '.doc';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}
</script>
</body></html>
`;
}

// ---- value rendering ------------------------------------------------------------------------------------------------

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isBlank = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (isObj(v) && !Object.keys(v).length);

function scalarHtml(v) {
  if (v == null || v === '') return '<span class="muted">—</span>';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'string' && /^data:image\//.test(v)) return `<img class="sig" alt="signature" src="${esc(v)}">`;
  return esc(v);
}

function valueHtml(v, labels) {
  if (Array.isArray(v)) {
    if (!v.length) return '<span class="muted">—</span>';
    if (v.every(isObj)) return rowsTable(v, labels);
    return v.map((x) => (isObj(x) || Array.isArray(x) ? valueHtml(x, labels) : scalarHtml(x))).join(', ');
  }
  if (isObj(v)) return kvTable(v, labels);
  return scalarHtml(v);
}

const labelOf = (k, labels) => (labels && labels[k]) || k;

function kvTable(obj, labels) {
  const rows = Object.entries(obj).filter(([, v]) => !isBlank(v))
    .map(([k, v]) => `<tr><th>${esc(labelOf(k, labels))}</th><td>${valueHtml(v, labels)}</td></tr>`);
  return rows.length ? `<table class="kv">${rows.join('')}</table>` : '<span class="muted">—</span>';
}

function rowsTable(rows, labels) {
  const cols = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!cols.includes(k) && rows.some((x) => !isBlank(x[k]))) cols.push(k); }));
  if (!cols.length) return '<span class="muted">—</span>';
  return `<table><thead><tr><th>#</th>${cols.map((c) => `<th>${esc(labelOf(c, labels))}</th>`).join('')}</tr></thead><tbody>`
    + rows.map((r, i) => `<tr><td>${i + 1}</td>${cols.map((c) => `<td>${valueHtml(r[c], labels)}</td>`).join('')}</tr>`).join('')
    + '</tbody></table>';
}

// ---- record definition ----------------------------------------------------------------------------------------------

const FIELD_CORE = ['key', 'label', 'type', 'required', 'readOnly', 'unit', 'options', 'group'];

function fieldsTable(fields) {
  if (!Array.isArray(fields) || !fields.length) return '<p class="muted">No fields.</p>';
  const body = fields.map((f) => {
    const other = Object.entries(f || {}).filter(([k]) => !FIELD_CORE.includes(k))
      .map(([k, v]) => `${esc(k)}: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('<br>');
    const flags = [f.required ? 'required' : '', f.readOnly ? 'read-only' : ''].filter(Boolean).join(', ');
    return `<tr><td>${esc(f.key)}</td><td>${esc(f.label)}</td><td>${esc(f.type)}</td><td>${esc(flags)}</td><td>${esc(f.unit)}</td>`
      + `<td>${esc(Array.isArray(f.options) ? f.options.map((o) => (isObj(o) ? (o.label || o.value) : o)).join(', ') : '')}</td>`
      + `<td>${esc(f.group)}</td><td>${other}</td></tr>`;
  }).join('');
  return '<table><thead><tr><th>Key</th><th>Label</th><th>Type</th><th>Flags</th><th>Unit</th><th>Options</th><th>Group</th><th>Other settings</th></tr></thead>'
    + `<tbody>${body}</tbody></table>`;
}

function settingsTable(obj, skip) {
  const rest = {};
  Object.entries(obj || {}).forEach(([k, v]) => { if (!skip.includes(k) && !isBlank(v)) rest[k] = v; });
  const rows = Object.entries(rest)
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${typeof v === 'object' ? esc(JSON.stringify(v)) : scalarHtml(v)}</td></tr>`);
  return rows.length ? `<table class="kv">${rows.join('')}</table>` : '';
}

function recordDefToHtml(config) {
  const c = config || {};
  const STRUCT = ['sections', 'roster', 'rosters', 'fields', 'entryFields', 'autofill'];
  const out = [];
  out.push('<h2>Record</h2>' + settingsTable(c, STRUCT));

  const sections = Array.isArray(c.sections) ? c.sections : [];
  if (sections.length) {
    out.push('<h2>Sections</h2><table><thead><tr><th>#</th><th>Title</th><th>Fields</th><th>Settings</th></tr></thead><tbody>'
      + sections.map((s, i) => {
        const settings = Object.entries(s || {}).filter(([k]) => k !== 'title' && k !== 'fields')
          .map(([k, v]) => `${esc(k)}: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('<br>');
        return `<tr><td>${i + 1}</td><td>${esc(s.title)}</td><td>${(s.fields || []).length}</td><td>${settings}</td></tr>`;
      }).join('') + '</tbody></table>');
    sections.forEach((s, i) => {
      if ((s.fields || []).length) out.push(`<h3>Section ${i + 1}: ${esc(s.title || '(untitled)')}</h3>` + fieldsTable(s.fields));
    });
  }
  if (Array.isArray(c.fields) && c.fields.length) out.push('<h2>Fields</h2>' + fieldsTable(c.fields));
  if (Array.isArray(c.entryFields) && c.entryFields.length) out.push('<h2>Entry fields</h2>' + fieldsTable(c.entryFields));

  const rosters = [].concat(c.roster ? [c.roster] : [], Array.isArray(c.rosters) ? c.rosters : []);
  rosters.forEach((r) => {
    out.push(`<h2>Roster: ${esc(r.title || r.key || '(untitled)')}</h2>` + settingsTable(r, ['columns', 'title']) + '<h3>Columns</h3>' + fieldsTable(r.columns));
  });
  if (Array.isArray(c.autofill) && c.autofill.length) {
    out.push('<h2>Autofill rules</h2><table><thead><tr><th>Watch</th><th>Source record</th><th>Match field</th><th>Fills</th></tr></thead><tbody>'
      + c.autofill.map((a) => `<tr><td>${esc(a.watch)}</td><td>${esc(a.source)}</td><td>${esc(a.matchField)}</td><td>${esc(JSON.stringify(a.fill))}</td></tr>`).join('')
      + '</tbody></table>');
  }
  return out.join('\n');
}

// ---- submissions ----------------------------------------------------------------------------------------------------

function fieldLabels(config) {
  const labels = {};
  const add = (list) => (Array.isArray(list) ? list : []).forEach((f) => { if (f && f.key && f.label && !labels[f.key]) labels[f.key] = f.label; });
  const c = config || {};
  (c.sections || []).forEach((s) => add(s.fields));
  add(c.fields); add(c.entryFields);
  if (c.roster) add(c.roster.columns);
  (c.rosters || []).forEach((r) => add(r.columns));
  return labels;
}

function entryStatus(e) {
  if (e && (e.status === 'verified' || e.verification)) return 'verified';
  return e && e.status === 'draft' ? 'draft' : 'submitted';
}

function submissionToHtml(recordKey, jobNo, entries, recordConfig) {
  const c = recordConfig || {};
  const labels = fieldLabels(c);
  const list = Array.isArray(entries) ? entries : [];
  const head = kvTable({
    Record: [c.docCode, c.title || recordKey].filter(Boolean).join(' — '),
    'Job number': jobNo || '',
    Entries: String(list.length),
  });
  const body = list.map((e, i) => {
    const status = entryStatus(e);
    const scalars = [], blocks = [];
    // Form fields live under `values`: lift them into the entry so they render as the main field grid.
    const flat = isObj(e && e.values) ? { ...e.values, ...Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'values')) } : (e || {});
    Object.entries(flat).forEach(([k, v]) => {
      if (k === 'status' || isBlank(v)) return;
      if (typeof v === 'object') blocks.push(`<h3>${esc(labelOf(k, labels))}</h3>${valueHtml(v, labels)}`);
      else scalars.push(`<div class="cell"><span class="l">${esc(labelOf(k, labels))}</span><span class="v">${scalarHtml(v)}</span></div>`);
    });
    return `<section class="entry"><div class="entry-head"><strong>Entry ${i + 1}</strong><span class="badge ${status}">${status}</span></div>`
      + `<div class="grid">${scalars.join('')}</div>${blocks.join('')}</section>`;
  }).join('\n');
  return `<h2>Summary</h2>${head}<h2>Entries</h2>${body || '<p class="muted">No entries.</p>'}`;
}

// ---- controlled documents (policies, procedures, SOPs, PRPs) -------------------------------------------------------

const SECTION_HEADINGS = { objective: 'Objective', purpose: 'Purpose', scope: 'Scope', roles: 'Roles and Responsibilities', process: 'Process', review: 'Review' };
const headingOf = (k) => SECTION_HEADINGS[k] || String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

// doc: { code, name, area, revision, revisionDate, sections, relatedDocs, history }. sections is either a list of
// { heading | title, html } or a { key: html } map. Section HTML is the document's own authored content, kept as written.
function documentToHtml(doc) {
  const d = doc || {};
  const out = ['<h2>Document</h2>' + kvTable({ 'Document no.': d.code, Title: d.name, Area: d.area, Revision: d.revision == null ? '' : String(d.revision), 'Revision date': d.revisionDate })];
  const list = Array.isArray(d.sections)
    ? d.sections.map((s) => ({ heading: s.heading || s.title || '', html: s.html }))
    : Object.entries(d.sections || {}).map(([k, html]) => ({ heading: headingOf(k), html }));
  const body = list.filter((s) => !isBlank(s.html) || s.heading)
    .map((s) => (s.heading ? '<h3>' + esc(s.heading) + '</h3>' : '') + (typeof s.html === 'string' ? s.html : valueHtml(s.html))).join('');
  out.push('<h2>Content</h2><div class="doc-body">' + (body || '<p class="muted">No content.</p>') + '</div>');
  if (Array.isArray(d.relatedDocs) && d.relatedDocs.length) out.push('<h2>Related documents</h2>' + rowsTable(d.relatedDocs.map((r) => (isObj(r) ? r : { document: r }))));
  if (Array.isArray(d.history) && d.history.length) out.push('<h2>Revision history</h2>' + rowsTable(d.history));
  return out.join('');
}

// ---- CSV --------------------------------------------------------------------------------------------------------------

function csvCell(v) {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Writes csv/<name>.csv in the archive (UTF-8 with BOM and CRLF, so Excel opens it directly). Rewritten only when the
// content changed. Returns 'written' | 'unchanged' | null (failed). Never throws.
function writeCsv(name, header, rows) {
  try {
    const dir = path.join(archiveRoot(), 'csv');
    const file = path.join(dir, safeSegment(name) + '.csv');
    const text = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    let old = null;
    try { old = fs.readFileSync(file, 'utf8'); } catch {}
    if (old === text) return 'unchanged';
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, text);
    return 'written';
  } catch (e) {
    console.error('csv write failed (' + name + ')', e && e.message ? e.message : e);
    return null;
  }
}

module.exports = { writeCsv, fieldLabels, documentToHtml, beginBatch, endBatch, writeArchiveEntry, buildHtmlPage, recordDefToHtml, submissionToHtml, archiveRoot, safeSegment, readIndex };
