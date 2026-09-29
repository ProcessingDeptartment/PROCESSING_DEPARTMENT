// One-off migration: rebuild Dry NRCS Packs "Records included" roster as an auto-linked
// "Attachments checklist" (same pattern as scripts/apply-dry-export-checklist.mjs).
// Edits data/record-definitions.json in place. Then run:
//   node scripts/verify-definitions.mjs
//   node scripts/seed-definitions.mjs        (pushes to Neon -- makes it live)
//   node scripts/export-record-defs.mjs      (regenerates public/data/record-defs/*.json)
import fs from 'fs';

const path = new URL('../data/record-definitions.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const d = data.definitions.find(x => x.recordKey === 'dry-nrcs-packs');

const idx = d.sections.findIndex(s => s.kind === 'roster');
d.sections[idx] = { title: 'Attachments checklist', kind: 'fields', position: d.sections[idx].position };

const rows = [
  ['rec712Attached', 'REC 7.1.2 Abalone Receiving attached?', 'abalone-receiving', true],
  ['rec711Attached', 'REC 7.1.1 Basket Removal / Shucking / Gutting attached?', 'basket-removal-shucking-gutting', true],
  ['rec713Attached', 'REC 7.1.3 Bleeding & Salting Checklist attached?', 'bleeding-and-salting', true],
  ['rec714Attached', 'REC 7.1.4 Washing Control Sheet attached?', 'washing-control-sheet', true],
  ['rec781Attached', 'REC 7.8.1 Dry Chiller Batch Control attached?', 'dry-chiller-batch-control', true],
  ['rec740Attached', 'REC 7.4.0 Dry Cooking attached?', 'dry-cooking', true],
  ['rec742Attached', 'REC 7.4.2 Dry Monitoring attached?', 'dry-monitoring', true],
  // 7.4.3 exists as two records (cultivated / ranched); a batch only has one, so neither is required.
  ['rec7431Attached', 'REC 7.4.3.1 Grading Production Log (Cultivated) attached?', 'grading-production-log-cultivated', false],
  ['rec7432Attached', 'REC 7.4.3.2 Grading Production Log (Ranched) attached?', 'grading-production-log-ranched', false]
];

const keep = d.fields.filter(f => f.sectionIndex !== idx);
const checklist = rows.map(([key, label, src, req], i) => ({
  key, label, type: 'recordpick', required: req, readOnly: false,
  unit: null, options: null, group: null, sectionIndex: idx, parentFieldKey: null,
  position: 100 + i, computeFn: null, computeArgs: null, recordPickSource: 'jobtrace',
  linkField: null, linkRelation: null, validateJson: null,
  extraJson: { jobField: 'jobNo', sourceRecordKey: src }
}));
d.fields = keep.concat(checklist);

fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log('Applied Dry NRCS checklist edits to data/record-definitions.json');
