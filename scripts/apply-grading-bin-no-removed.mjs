// REC 7.4.3.1 / 7.4.3.2 Collection bins: there is no bin number -- a bin is identified by its size grade.
// Drops the binNo column; binCode (kept for the bin traceability index, REC 7.4.4/7.4.5) now = size grade
// and is hidden on the card. Start-weight carry matches on size grade. Card re-laid out to two lines:
//   1: Size grade | Bin weight start | Start weight checked
//   2: Full box weights | Final bin weight | Graded weight
// Idempotent. Then: snapshot-one-def.mjs for both keys, seed-definitions.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const LINE = { sizeGrade: 1, binCode: 1, binWeightStart: 1, startConfirmed: 1,
  fullBoxWeight: 2, finalBinWeight: 2, gradedWeight: 2 };

for (const key of ['grading-production-log-cultivated', 'grading-production-log-ranched']) {
  const def = doc.definitions.find((d) => d.recordKey === key);
  const ri = def.sections.findIndex((s) => s.kind === 'roster');
  def.fields = def.fields.filter((f) => !(f.sectionIndex === ri && f.key === 'binNo'));
  for (const f of def.fields) {
    if (f.sectionIndex !== ri || f.parentFieldKey !== '@roster') continue;
    if (!LINE[f.key]) throw new Error('unexpected column ' + f.key);
    const x = { ...(f.extraJson || {}), layoutRow: LINE[f.key] };
    if (f.key === 'binCode') { x.deriveJoin = { parts: ['sizeGrade'], sep: '-' }; x.hidden = true; }
    if (f.key === 'binWeightStart') x.carryPrev = { ...x.carryPrev, match: 'sizeGrade' };
    f.extraJson = x;
  }
  console.log(key + ': binNo removed, card re-laid out');
}
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
