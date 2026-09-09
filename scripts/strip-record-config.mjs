// Migrate a record page to fetch its definition from the DB: replace the inline
// FormRecord.init({...big config...}) / MonitoringLog.init({...}) with just
// .init({ mount, recordKey }). The engine then does GET /api/record-def/:key.
//
//   node scripts/strip-record-config.mjs <recordKey> [<recordKey> ...]
//   node scripts/strip-record-config.mjs --area 7.4        (all clean, un-migrated pages whose docCode starts REC 7.4)
//
// Refuses a page that still has bespoke behaviour (a second inline <script>, customBody,
// window.Rec* hardware hook) -- those keep their JS. Run extract-definitions.mjs --emit
// afterwards (it carries the stored definition forward for stripped pages), then verify.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractInitArg, evalConfig } from './lib/parse-record-config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECDIR = path.join(ROOT, 'public', 'records');
const defs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'record-definitions.json'), 'utf8')).definitions;
const byKey = Object.fromEntries(defs.map((d) => [d.recordKey, d]));

const args = process.argv.slice(2);
let targets = [];
const areaIdx = args.indexOf('--area');
if (areaIdx !== -1) {
  const area = args[areaIdx + 1];
  targets = defs.filter((d) => (d.docCode || '').replace(/\s+/g, ' ').startsWith('REC ' + area + '.') || (d.docCode || '') === 'REC ' + area)
    .map((d) => d.recordKey);
} else {
  targets = args.filter((a) => !a.startsWith('--'));
}
if (!targets.length) { console.error('nothing to do -- pass recordKeys or --area <n>'); process.exit(1); }

let stripped = 0, skipped = 0;
for (const key of targets) {
  const def = byKey[key];
  if (!def) { console.log(`skip ${key}: no definition`); skipped++; continue; }
  const file = path.join(RECDIR, def.pageFile);
  const src = fs.readFileSync(file, 'utf8');

  const inlineScripts = (src.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []).length;
  if (inlineScripts > 1 || /customBody\s*:/.test(src) || /window\.Rec[A-Z]\w*/.test(src)) {
    console.log(`skip ${key}: bespoke behaviour (keeps its JS)`);
    skipped++;
    continue;
  }

  const parsed = extractInitArg(src);
  if (!parsed) { console.log(`skip ${key}: no .init() call`); skipped++; continue; }
  let cfg;
  try { cfg = evalConfig(parsed.text); } catch (e) { console.log(`skip ${key}: unparseable (${e.message})`); skipped++; continue; }
  if (!cfg.sections && !cfg.fields && !cfg.entryFields) { console.log(`skip ${key}: already migrated`); skipped++; continue; }

  const engine = parsed.engine === 'form-record' ? 'FormRecord' : 'MonitoringLog';
  const mount = typeof cfg.mount === 'string' ? cfg.mount : (parsed.engine === 'form-record' ? '#frRoot' : '#mlRoot');
  const call = `${engine}.init(${parsed.text})`;
  const replacement =
    `// Definition lives in the DB — fetched by the engine from GET /api/record-def/${key}\n`
    + `  // (was inline until migration; see Claude outputs/relational-all-records-plan.md).\n`
    + `  ${engine}.init({ mount: '${mount}', recordKey: '${key}' })`;

  const at = src.indexOf(call);
  if (at === -1) { console.log(`skip ${key}: could not locate the init call to replace`); skipped++; continue; }
  fs.writeFileSync(file, src.slice(0, at) + replacement + src.slice(at + call.length));
  console.log(`stripped ${key}  (${def.pageFile})`);
  stripped++;
}
console.log(`\n${stripped} stripped, ${skipped} skipped`);
