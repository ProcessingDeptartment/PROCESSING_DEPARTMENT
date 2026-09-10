// One-off: move each record's "Sign-off" field section to sit AFTER its roster section,
// so sign-off renders at the foot of the record rather than directly under job entry.
// Rewrites data/record-definitions.json in place. Safe to re-run (idempotent).
//
//   node scripts/reorder-signoff-after-roster.mjs            report only
//   node scripts/reorder-signoff-after-roster.mjs --write    write the file

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const write = process.argv.includes('--write');

const SIGNOFF = /sign.?off/i;
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let changed = 0;

for (const def of data.definitions) {
  const secs = def.sections || [];
  const rosterIdx = secs.findIndex((s) => s.kind === 'roster');
  if (rosterIdx === -1) continue;
  const soIdx = secs.findIndex((s) => s.kind === 'fields' && SIGNOFF.test(s.title || ''));
  if (soIdx === -1 || soIdx > rosterIdx) continue; // no sign-off, or already after roster

  // new section array order: everything except sign-off, with sign-off spliced back in
  // immediately after the roster's new position.
  const soSec = secs[soIdx];
  const without = secs.filter((_, i) => i !== soIdx);
  const newRosterIdx = without.findIndex((s) => s.kind === 'roster');
  without.splice(newRosterIdx + 1, 0, soSec);

  // old array index -> new array index, then renumber positions to match array order
  const oldToNew = new Map();
  secs.forEach((s, oi) => oldToNew.set(oi, without.indexOf(s)));
  without.forEach((s, ni) => { s.position = ni; });
  def.sections = without;

  for (const f of def.fields || []) {
    if (f.sectionIndex != null && oldToNew.has(f.sectionIndex)) {
      f.sectionIndex = oldToNew.get(f.sectionIndex);
    }
  }

  changed++;
  console.log(`${def.recordKey.padEnd(42)} -> ${without.map((s) => (s.kind === 'roster' ? `{${s.title}}` : s.title)).join(' | ')}`);
}

console.log(`\n${changed} record(s) reordered.`);
if (write && changed) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  console.log('written: data/record-definitions.json');
} else if (!write) {
  console.log('(dry run -- pass --write to save)');
}
