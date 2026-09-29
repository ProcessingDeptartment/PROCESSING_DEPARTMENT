// One-off migration: Dry NRCS Packs "Attachments checklist".
// The checklist table (Attached Yes/No + linked submissions) is built by the page from the job
// number (see the page HTML). Only the per-record Comments boxes are real form fields, defined here
// so they are saved with the submission. Replaces the old manual roster.
// Edits data/record-definitions.json in place. Then: seed-definitions.mjs, export-record-defs.mjs.
import fs from 'fs';

const path = new URL('../data/record-definitions.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const d = data.definitions.find(x => x.recordKey === 'dry-nrcs-packs');

const idx = d.sections.findIndex(s => s.title === 'Attachments checklist' || s.kind === 'roster');
const pos = d.sections[idx].position;
d.sections[idx] = { title: 'Attachments checklist', kind: 'fields', position: pos };

const rows = [
  ['cmt712', 'Comments — REC 7.1.2 Abalone Receiving'],
  ['cmt711', 'Comments — REC 7.1.1 Basket Removal / Shucking / Gutting'],
  ['cmt713', 'Comments — REC 7.1.3 Bleeding & Salting Checklist'],
  ['cmt714', 'Comments — REC 7.1.4 Washing Control Sheet'],
  ['cmt781', 'Comments — REC 7.8.1 Chiller Batch Control'],
  ['cmt740', 'Comments — REC 7.4.0 Dry Cooking'],
  ['cmt742', 'Comments — REC 7.4.2 Dry Monitoring'],
  ['cmt743', 'Comments — REC 7.4.3 Grading / Packing / Boxing of Dried Abalone']
];
const fields = rows.map(([key, label], i) => ({
  key, label, type: 'text', required: false, readOnly: false, unit: null, options: null, group: null,
  sectionIndex: idx, parentFieldKey: null, position: 6 + i, computeFn: null, computeArgs: null,
  recordPickSource: null, linkField: null, linkRelation: null, validateJson: null
}));
d.fields = d.fields.filter(f => f.sectionIndex !== idx).concat(fields);

fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log('Applied Dry NRCS checklist comment fields to data/record-definitions.json');
