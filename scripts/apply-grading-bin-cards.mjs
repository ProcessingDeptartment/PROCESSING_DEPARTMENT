// REC 7.4.3.1 / 7.4.3.2 Grading Production Logs: lay the Collection bins roster out as cards.
// Edits data/record-definitions.json in place; idempotent. No field, column or calculation changes.
//
//   node scripts/apply-grading-bin-cards.mjs
//   node scripts/snapshot-one-def.mjs grading-production-log-cultivated
//   node scripts/snapshot-one-def.mjs grading-production-log-ranched
//   node scripts/seed-definitions.mjs        (load into Neon)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const LINE = { sizeGrade: 1, binNo: 1, binCode: 1, binWeightStart: 2, startConfirmed: 2,
  fullBoxWeight: 3, finalBinWeight: 3, gradedWeight: 3 };

for (const key of ['grading-production-log-cultivated', 'grading-production-log-ranched']) {
  const def = doc.definitions.find((d) => d.recordKey === key);
  const sec = def.sections.find((s) => s.kind === 'roster');
  sec.extraJson = { ...(sec.extraJson || {}), cardLayout: true, rowTitle: 'Bin' };
  const viewer = def.sections.find((x) => x.title === 'Size grade weights (kg)');
  viewer.extraJson = { ...(viewer.extraJson || {}), viewer: true };
  const ri = def.sections.indexOf(sec);
  let n = 0;
  for (const f of def.fields) {
    if (f.sectionIndex !== ri || f.parentFieldKey !== '@roster') continue;
    if (!LINE[f.key]) throw new Error('unexpected column ' + f.key);
    f.extraJson = { ...(f.extraJson || {}), layoutRow: LINE[f.key] };
    n++;
  }
  console.log(key + ':', n, 'bin columns laid out');
}
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
