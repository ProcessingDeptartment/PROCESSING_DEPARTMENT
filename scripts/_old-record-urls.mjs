// Helper for the record rename (see rename-records-to-header-format.mjs): finds, and with --apply
// rewrites, old record page names everywhere outside public/records (docs, scripts, tools).
// The old -> new map is read from the redirect pages left at the old names.
//
//   node scripts/_old-record-urls.mjs            (dry run)
//   node scripts/_old-record-urls.mjs --apply
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REC = path.join(ROOT, 'public', 'records');
const APPLY = process.argv.includes('--apply');
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const map = [];
for (const f of fs.readdirSync(REC)) {
  if (!/^REC-.*\.html$/.test(f)) continue;
  const m = fs.readFileSync(path.join(REC, f), 'utf8').match(/location\.replace\("([^"]+)"/);
  if (m) map.push([f, decodeURI(m[1])]);
}
map.sort((a, b) => b[0].length - a[0].length);

const skipDir = new Set(['.git', 'node_modules', 'worktrees']);
const exts = new Set(['.md', '.html', '.js', '.mjs', '.cjs', '.json', '.ps1', '.txt', '.css', '.yaml', '.yml', '.prisma', '.ts']);
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (skipDir.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (p !== REC) walk(p, out); }
    else if (exts.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

let files = 0, hits = 0;
const stemHits = {};
for (const file of walk(ROOT)) {
  if (/rename-records-to-header-format|_old-record-urls/.test(file)) continue;
  const buf = fs.readFileSync(file);
  let s = buf.toString('utf8');
  const enc = Buffer.from(s, 'utf8').equals(buf) ? 'utf8' : 'latin1';
  if (enc === 'latin1') s = buf.toString('latin1');
  let out = s, n = 0;
  for (const [o, nw] of map) {
    const stem = o.slice(0, -5);
    if (!out.includes(stem)) continue;
    // markdown link target ](...old.html#x) -> ](<...new.html#x>) so spaces and brackets stay legal
    out = out.replace(new RegExp('\\]\\(([^()<>\\s]*)' + reEsc(o) + '(#[^()\\s]*)?\\)', 'g'),
      (m, pre, hash) => { n++; return '](<' + pre + nw + (hash || '') + '>)'; });
    const parts = out.split(o);
    n += parts.length - 1;
    out = parts.join(nw);
    const c = out.split(stem).length - 1;
    if (c) { const rel = path.relative(ROOT, file); stemHits[rel] = (stemHits[rel] || 0) + c; }
  }
  if (out !== s) {
    files++; hits += n;
    console.log(String(n).padStart(4), path.relative(ROOT, file));
    if (APPLY) fs.writeFileSync(file, Buffer.from(out, enc));
  }
}
console.log('files', files, 'replacements', hits, APPLY ? '(applied)' : '(dry run)');
console.log('old name without .html still present in:', stemHits);
