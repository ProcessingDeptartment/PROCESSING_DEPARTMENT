// One-off: bring REC record pages in line with the header (record definition docCode + title).
//
//   file name   REC-7.4.1-drying-process.html  ->  REC 7.4.1_Drying Process.html
//   <title>     REC 7.4.1 Drying Process       ->  REC 7.4.1_Drying Process
//   master index row name                      ->  definition title (the header name)
//
// Record keys are NOT changed. Records without a REC number are left alone.
// A small redirect page is left at every old file name so bookmarks and stored links keep working.
//
//   node scripts/rename-records-to-header-format.mjs          (dry run, prints the plan)
//   node scripts/rename-records-to-header-format.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const REC = path.join(PUB, 'records');
const APPLY = process.argv.includes('--apply');

// Read/write without damaging files that are not clean UTF-8.
function read(file) {
  const buf = fs.readFileSync(file);
  const s = buf.toString('utf8');
  const enc = Buffer.from(s, 'utf8').equals(buf) ? 'utf8' : 'latin1';
  return { text: enc === 'utf8' ? s : buf.toString('latin1'), enc };
}
function write(file, text, enc) { fs.writeFileSync(file, Buffer.from(text, enc)); }
const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escJs = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// ---- definitions (the header) ----
const defs = {};
for (const f of fs.readdirSync(path.join(PUB, 'data', 'record-defs'))) {
  const j = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'record-defs', f), 'utf8'));
  defs[j.recordKey] = j;
}

// ---- master index ----
const MI_FILE = path.join(PUB, 'lib', 'master-index-data.js');
const mi = read(MI_FILE);
const sandbox = {};
new Function('window', mi.text)(sandbox);
const miRows = sandbox.MasterIndexData.rows;
const keyByHref = {};
miRows.forEach(r => { if (r.href && r.recordKey) keyByHref[r.href] = r.recordKey; });

// ---- plan the renames ----
const fileName = (docCode, title) =>
  (docCode + '_' + title).replace(/\s*[\\/]\s*/g, ' - ').replace(/[:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() + '.html';

const plan = []; // { old, neu, key, docCode, title }
for (const f of fs.readdirSync(REC).filter(f => /^REC-.*\.html$/.test(f))) {
  const src = read(path.join(REC, f)).text;
  const key = (src.match(/recordKey:\s*'([^']+)'/) || [])[1] || keyByHref[f];
  const d = key && defs[key];
  if (!d || !/^REC \S/.test(d.docCode || '') || !d.title) { console.log('SKIP (no REC definition):', f); continue; }
  plan.push({ old: f, neu: fileName(d.docCode, d.title), key, docCode: d.docCode, title: d.title });
}
const dup = plan.map(p => p.neu.toLowerCase()).filter((n, i, a) => a.indexOf(n) !== i);
if (dup.length) { console.error('Name collision:', dup); process.exit(1); }

console.log(plan.length + ' pages to rename');
if (!APPLY) { plan.forEach(p => console.log('  ' + p.old + '  ->  ' + p.neu)); }

// ---- master index: name follows the header ----
let miText = mi.text, nameChanges = 0;
for (const key of Object.keys(defs)) {
  const d = defs[key];
  if (!d.title) continue;
  const re = new RegExp('("name":\\s*")((?:[^"\\\\]|\\\\.)*)("(?:(?!\\n\\s*\\}),?[^{}])*?"recordKey":\\s*"' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '")');
  miText = miText.replace(re, (m, a, old, c) => {
    const want = escJs(d.title);
    if (old !== want) { nameChanges++; if (!APPLY) console.log('  index name: "' + old + '" -> "' + want + '"'); }
    return a + want + c;
  });
}
console.log(nameChanges + ' master index names to update');
if (!APPLY) { console.log('\nDry run only. Re-run with --apply.'); process.exit(0); }

write(MI_FILE, miText, mi.enc);

// ---- rename + retitle ----
for (const p of plan) {
  const from = path.join(REC, p.old), to = path.join(REC, p.neu);
  const { text, enc } = read(from);
  const out = text.replace(/<title>[^<]*<\/title>/i, '<title>' + escHtml(p.docCode + '_' + p.title) + '</title>');
  fs.renameSync(from, to);
  write(to, out, enc);
}

// ---- rewrite references everywhere in the live site + scripts ----
const exts = new Set(['.html', '.js', '.mjs', '.json', '.css', '.webmanifest']);
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (exts.has(path.extname(e.name))) out.push(full);
  }
  return out;
}
const self = fileURLToPath(import.meta.url);
let touched = 0;
for (const file of [...walk(PUB), ...walk(path.join(ROOT, 'scripts')), ...walk(path.join(ROOT, 'src'))]) {
  if (file === self) continue;
  const { text, enc } = read(file);
  let out = text;
  for (const p of plan) if (out.includes(p.old)) out = out.split(p.old).join(p.neu);
  if (out !== text) { write(file, out, enc); touched++; }
}
console.log('references rewritten in ' + touched + ' files');

// ---- redirect pages at the old names ----
for (const p of plan) {
  const target = encodeURI(p.neu);
  write(path.join(REC, p.old),
    '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8">\n' +
    '<title>' + escHtml(p.docCode + '_' + p.title) + '</title>\n' +
    '<meta name="robots" content="noindex">\n' +
    '<script>location.replace(' + JSON.stringify(target) + ' + location.search + location.hash);</script>\n' +
    '<noscript><meta http-equiv="refresh" content="0; url=' + target + '"></noscript>\n' +
    '</head><body>This record has moved to <a href="' + target + '">' + escHtml(p.docCode + '_' + p.title) + '</a>.</body></html>\n',
    'utf8');
}
console.log('redirect pages written: ' + plan.length);
