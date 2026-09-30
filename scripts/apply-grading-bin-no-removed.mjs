// REC 7.4.3.1 / 7.4.3.2 Collection bins: no bin number to enter -- the bin code counts up by itself
// within each size grade (8g-10g-1, 8g-10g-2 ...). binNo is a hidden seqWithin counter; binCode =
// sizeGrade-binNo, read-only and shown. roster.fixedGroups: a new log opens with one card per
// size grade (grade = card title), each on its current bin no. from the database; "New bin"
// counts it up. Every "+ Full box" takes the current bin code as that box's code and counts the
// bin on by one (fixedGroups.boxList); start weight carries by size grade. Card lines:
//   1: Bin code | Bin weight start | Start weight checked
//   2: Full boxes | Final bin weight | Graded weight
// Idempotent. Then: snapshot-one-def.mjs for both keys, seed-definitions.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const LINE = { sizeGrade: 1, binNo: 1, binCode: 1, binWeightStart: 1, startConfirmed: 1,
  fullBoxWeight: 2, finalBinWeight: 2, gradedWeight: 2 };

for (const key of ['grading-production-log-cultivated', 'grading-production-log-ranched']) {
  const def = doc.definitions.find((d) => d.recordKey === key);
  const ri = def.sections.findIndex((s) => s.kind === 'roster');
  const cols = def.fields.filter((f) => f.sectionIndex === ri && f.parentFieldKey === '@roster');
  if (!cols.some((f) => f.key === 'binNo')) {
    const grade = cols.find((f) => f.key === 'sizeGrade');
    def.fields.forEach((f) => { if (f.position > grade.position) f.position++; });
    def.fields.splice(def.fields.indexOf(grade) + 1, 0, {
      required: false, readOnly: true, unit: null, options: null, group: null, parentFieldKey: '@roster',
      computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null,
      validateJson: null, key: 'binNo', label: 'Bin no.', type: 'number', extraJson: {},
      sectionIndex: ri, position: grade.position + 1 });
  }
  // One fixed card per size grade, current bin no. from the database; "New bin" counts it up.
  const sec = def.sections[ri];
  sec.extraJson = { ...(sec.extraJson || {}), fixedGroups: {
    column: 'sizeGrade', seqColumn: 'binNo', dateField: 'gradingDate',
    sources: ['grading-production-log-cultivated', 'grading-production-log-ranched'],
    boxList: 'fullBoxWeight' } };
  for (const f of def.fields) {
    if (f.sectionIndex !== ri || f.parentFieldKey !== '@roster') continue;
    if (!LINE[f.key]) throw new Error('unexpected column ' + f.key);
    const x = { ...(f.extraJson || {}), layoutRow: LINE[f.key] };
    if (f.key === 'binNo') { f.required = false; x.seqWithin = 'sizeGrade'; x.hidden = true; }
    if (f.key === 'binCode') { x.deriveJoin = { parts: ['sizeGrade', 'binNo'], sep: '-' }; delete x.hidden; }
    if (f.key === 'sizeGrade') x.hidden = true;           // it is the card title
    if (f.key === 'fullBoxWeight') { x.boxEntry = true; delete x.placeholder; }
    if (f.key === 'binWeightStart') x.carryPrev = { ...x.carryPrev, match: 'sizeGrade' };
    f.extraJson = x;
  }
  console.log(key + ': bin code auto-numbered, card laid out');
}
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
