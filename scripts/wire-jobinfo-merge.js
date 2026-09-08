// Fold every job / intake / processing identity field under the one "Job info" heading, and
// make the collapsed header show job number + processing-for. Follows wire-jobinfo.js.
//
//  - form-record pages: loose intakeDate / harvestFarm / receivedFrom / processingFor /
//    intakeWeight fields move into the "Job info" section; emptied sections are dropped;
//    summaryField becomes [<jobKey>, <processing-for key>].
//  - monitoring-log pages: the same fields gain `group: 'Job info'` and are moved to sit with
//    the other Job info group fields (the engine's summary then shows job no. + processing-for).
//
// Idempotent. Pass --write to apply; default is a dry run.

const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'public', 'records');
const WRITE = process.argv.includes('--write');

const MOVE_KEY = /^(intakeDate|harvestFarm|receivedFrom|processingFor|toBeProcessedFor|intakeWeight|receivingDate)$/;
const keyOf = (l) => { const m = l.match(/key: '([a-zA-Z0-9_]+)'/); return m ? m[1] : null; };
function isLoose(l) {
  const k = keyOf(l);
  if (!k || !MOVE_KEY.test(k)) return false;
  if (/readOnly/.test(l)) return false;
  if (/key: 'ji[A-Z]/.test(l)) return false;
  if (/watch:|matchField:|fill:/.test(l)) return false;
  return /^\s*(\{|Lookups\.field\(\{)/.test(l);
}
const norm = (l) => l.trim().replace(/,\s*$/, '');

function processFR(text) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  // The Job info section object, from its opening brace to the `]}` that closes its field list.
  const re = /(\{ title: 'Job info'[^\n]*?fields: \[)([\s\S]*?)(\n[ \t]*\]\},?)/;
  const m = text.match(re);
  if (!m) return null;
  const head = m[1], body = m[2], tail = m[3];
  const ind = (body.match(/\n([ \t]+)\S/) || [, '        '])[1];

  const existing = body.split('\n').map((s) => s.trim()).filter(Boolean).map(norm);

  // Collect loose lines from the rest of the file (outside this section).
  const before = text.slice(0, m.index);
  const after = text.slice(m.index + m[0].length);
  const moved = [];
  const scrub = (chunk) => chunk.split('\n').filter((l) => {
    if (isLoose(l)) { moved.push(norm(l)); return false; }
    return true;
  }).join('\n');
  let newBefore = scrub(before), newAfter = scrub(after);

  if (!moved.length && /summaryField: \[/.test(head)) return null; // already merged

  // De-dupe by key (a page might already carry the field in Job info).
  const seen = new Set(existing.map(keyOf));
  const add = moved.filter((l) => { const k = keyOf(l); if (seen.has(k)) return false; seen.add(k); return true; });
  const fields = existing.concat(add);
  const newSection = head + nl + fields.map((l) => ind + l).join(',' + nl) + nl + ind.slice(0, -2) + tail.trim().replace(/^\n\s*/, '');

  let out = newBefore + newSection + newAfter;

  // summaryField: [<jobKey>, <processing-for key>]
  const jobKey = (head.match(/summaryField: (?:'([a-zA-Z]+)'|\['([a-zA-Z]+)')/) || [])[1]
    || (head.match(/summaryField: \['([a-zA-Z]+)'/) || [])[1] || 'jobNo';
  const pfKey = /key: 'processingFor'/.test(out) ? 'processingFor'
    : /key: 'toBeProcessedFor'/.test(out) ? 'toBeProcessedFor'
    : /key: 'jiProcessingFor'/.test(out) ? 'jiProcessingFor' : null;
  const sf = 'summaryField: [' + [jobKey].concat(pfKey ? [pfKey] : []).map((k) => `'${k}'`).join(', ') + ']';
  out = out.replace(/summaryField: (?:'[a-zA-Z]+'|\[[^\]]*\])/, sf);

  // Drop any section now left with empty fields: [ ].
  out = out.replace(/\n[ \t]*\{ title: '[^']*',[^\n]*fields: \[\s*\]\s*\},?/g, '');
  // Collapse a doubled blank line left by a removal.
  out = out.replace(/\n[ \t]*\n([ \t]*\{ title: ')/g, '\n$1');
  return out;
}

function processML(text) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  let lastJI = -1;
  for (let i = 0; i < lines.length; i++) if (/group: 'Job info'/.test(lines[i])) lastJI = i;
  if (lastJI < 0) return null;
  const looseIdx = [];
  for (let i = lastJI + 1; i < lines.length; i++) {
    if (isLoose(lines[i]) && !/group:/.test(lines[i])) looseIdx.push(i);
  }
  if (!looseIdx.length) return null;
  const ind = lines[lastJI].match(/^\s*/)[0];
  const movedLines = looseIdx.map((i) => ind
    + norm(lines[i]).replace(/^\{ /, "{ group: 'Job info', ").replace(/^Lookups\.field\(\{ /, "Lookups.field({ group: 'Job info', ")
    + ',');
  const drop = new Set(looseIdx);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (drop.has(i)) continue;
    out.push(lines[i]);
    if (i === lastJI) movedLines.forEach((m) => out.push(m));
  }
  return out.join(nl);
}

let n = 0;
const report = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.html'))) {
  const p = path.join(DIR, f);
  const text = fs.readFileSync(p, 'utf8');
  if (!/'Job info'/.test(text)) continue;
  const fr = /form-record\.js/.test(text);
  let next;
  try { next = fr ? processFR(text) : processML(text); } catch (e) { report.push(f + '  ERROR ' + e.message); continue; }
  if (!next || next === text) continue;
  report.push((fr ? 'fr ' : 'ml ') + f);
  if (WRITE) fs.writeFileSync(p, next);
  n++;
}
console.log((WRITE ? 'wrote ' : 'would change ') + n);
report.forEach((r) => console.log('  ' + r));
