// One-off migration: rebuild Dry NRCS Packs as an "Attachments checklist" roster:
//   Record (name + number) | Attached (Yes/No) | Comments
// The list of records linked to the job number is added by the page itself (see the page HTML).
// Edits data/record-definitions.json in place. Then: seed-definitions.mjs, export-record-defs.mjs.
import fs from 'fs';

const path = new URL('../data/record-definitions.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const d = data.definitions.find(x => x.recordKey === 'dry-nrcs-packs');

const idx = d.sections.findIndex(s => s.title === 'Attachments checklist' || s.kind === 'roster');
const pos = d.sections[idx].position;
d.sections[idx] = {
  title: 'Attachments checklist', kind: 'roster', position: pos,
  extraJson: {
    collapseRows: false,
    defaultRows: [
      'REC 7.1.2 Abalone Receiving',
      'REC 7.1.1 Basket Removal / Shucking / Gutting',
      'REC 7.1.3 Bleeding & Salting Checklist',
      'REC 7.1.4 Washing Control Sheet',
      'REC 7.8.1 Dry Chiller Batch Control',
      'REC 7.4.0 Dry Cooking',
      'REC 7.4.2 Dry Monitoring',
      'REC 7.4.3.1 Grading Production Log (Cultivated)',
      'REC 7.4.3.2 Grading Production Log (Ranched)'
    ].map(recordName => ({ recordName }))
  }
};

const base = { required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: idx,
  parentFieldKey: '@roster', computeFn: null, computeArgs: null, recordPickSource: null,
  linkField: null, linkRelation: null, validateJson: null };
const cols = [
  { ...base, key: 'recordName', label: 'Record', type: 'text', position: 8 },
  { ...base, key: 'attached', label: 'Attached', type: 'select', options: ['Yes', 'No'], position: 9 },
  { ...base, key: 'comments', label: 'Comments', type: 'text', position: 10 }
];
d.fields = d.fields.filter(f => f.sectionIndex !== idx).concat(cols);

fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log('Applied Dry NRCS checklist roster to data/record-definitions.json');
