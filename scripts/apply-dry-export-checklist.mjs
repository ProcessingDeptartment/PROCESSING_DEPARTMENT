// One-off migration script for the Dry Export Pack Front Page attachment-checklist rework.
// Edits data/record-definitions.json in place. Run, then:
//   node scripts/verify-definitions.mjs   (sanity check, optional)
//   node scripts/seed-definitions.mjs     (pushes to Neon -- makes it live)
//   node scripts/export-record-defs.mjs   (regenerates public/data/record-defs/*.json mirrors)
import fs from 'fs';

const path = new URL('../data/record-definitions.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const byKey = k => data.definitions.find(d => d.recordKey === k);

function nextPos(def) {
  return 1 + def.fields.reduce((m, f) => Math.max(m, f.position || 0), -1);
}

// 1. grading-boxing-traceability (REC 7.4.4): opt its existing binCode + jobNumbersInBin
//    fields into the bin index -- this is the record that already captures "these job(s) fed
//    this bin", just not indexed yet.
{
  const d = byKey('grading-boxing-traceability');
  d.extraJson = Object.assign({}, d.extraJson, { binField: 'binCode', binJobsField: 'jobNumbersInBin' });
}

// 2. boxing-and-labelling (REC 7.4.5): has a binCode field (already noted on the form: "the bin
//    code is used as the box code on the label") but no job number of its own. Index it by bin
//    code instead, so it resolves via the bin index rather than needing an invented job field.
{
  const d = byKey('boxing-and-labelling');
  d.extraJson = Object.assign({}, d.extraJson, { batchField: 'binCode' });
}

// 3. labelling-of-dry-boxes (REC 7.4.7) and dry-stock-transfers (REC 7.4.9): neither currently
//    captures anything that links back to a job or bin at all. Add the same "Job no." field used
//    throughout the rest of the dry chain (type jobsearch, group "Job info", linkField/linkRelation
//    self) and opt each into batchField so they become directly job-traceable like every other
//    required record on this checklist.
for (const key of ['labelling-of-dry-boxes', 'dry-stock-transfers']) {
  const d = byKey(key);
  d.fields.unshift({
    key: 'jobNo', label: 'Job no.', type: 'jobsearch', required: false, readOnly: false,
    unit: null, options: null, group: 'Job info', sectionIndex: null, parentFieldKey: null,
    position: -1, computeFn: null, computeArgs: null, recordPickSource: null,
    linkField: 'jobNo', linkRelation: 'self', validateJson: null
  });
  // shift every other field's position up by one so jobNo sorts first, then normalize to 0..n
  d.fields.sort((a, b) => (a.position || 0) - (b.position || 0));
  d.fields.forEach((f, i) => { f.position = i; });
  d.extraJson = Object.assign({}, d.extraJson, { batchField: 'jobNo' });
}

// 4. dry-labelling-list (REC 7.4.8): add a "Bin code" column to the Boxes roster, alongside
//    Box No./Grade Range/Box code/NRCS AG Code -- captured at the same labelling step, per spec.
{
  const d = byKey('dry-labelling-list');
  const rosterSecIdx = d.sections.findIndex(s => s.kind === 'roster');
  d.fields.push({
    key: 'binCode', label: 'Bin code', type: 'text', required: false, readOnly: false,
    unit: null, options: null, group: null, sectionIndex: rosterSecIdx, parentFieldKey: '@roster',
    position: nextPos(d), computeFn: null, computeArgs: null, recordPickSource: null,
    linkField: null, linkRelation: null, validateJson: null
  });
}

// 5. dry-export-pack-front-page: rebuild the "Attachments checklist" section as a verify-gated
//    roster of required records (all recordpick/required, matched by job number where a record
//    is directly job-traceable, or by bin via boxing-and-labelling's binCode, or -- for REC 7.4.8,
//    which is agCode-indexed and not reliably resolvable from job number alone -- a manual pick
//    restricted to Dry Labelling List submissions). Trimmed required set confirmed with Michaela:
//    packing/labelling/transfer/health-cert end of the chain only, not grading/drying/cooking.
{
  const d = byKey('dry-export-pack-front-page');
  const checklistSecIdx = d.sections.findIndex(s => s.title === 'Attachments checklist');
  const keep = d.fields.filter(f => f.sectionIndex !== checklistSecIdx);
  const checklist = [
    { key: 'rec745Attached', label: 'REC 7.4.5 Boxing & Labelling attached?', sourceRecordKey: 'boxing-and-labelling', source: 'bintrace' },
    { key: 'rec746Attached', label: 'REC 7.4.6 Dry Stock Control attached?', sourceRecordKey: 'dry-stock-control', source: 'jobtrace' },
    { key: 'rec747Attached', label: 'REC 7.4.7 Labelling of Dry Boxes attached?', sourceRecordKey: 'labelling-of-dry-boxes', source: 'jobtrace' },
    { key: 'rec748Attached', label: 'REC 7.4.8 Dry Labelling List attached? (not linked by job number -- search and pick the specific submission for this shipment)', sourceRecordKey: 'dry-labelling-list', source: 'jobtrace' },
    { key: 'rec749Attached', label: 'REC 7.4.9 Dry Stock Transfers attached?', sourceRecordKey: 'dry-stock-transfers', source: 'jobtrace' },
    { key: 'rec7410Attached', label: 'REC 7.4.10 Dried Abalone Transfer attached?', sourceRecordKey: 'dried-abalone-transfer', source: 'jobtrace' }
  ].map((c, i) => ({
    key: c.key, label: c.label, type: 'recordpick', required: true, readOnly: false,
    unit: null, options: null, group: null, sectionIndex: checklistSecIdx, parentFieldKey: null,
    position: 100 + i, computeFn: null, computeArgs: null, recordPickSource: c.source,
    linkField: null, linkRelation: null, validateJson: null,
    extraJson: { jobField: 'jobNumber', sourceRecordKey: c.sourceRecordKey }
  }));
  const tail = [
    { key: 'signedPackingListsAttached', label: 'Signed packing lists attached?', type: 'yesno', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: checklistSecIdx, parentFieldKey: null, position: 200, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null },
    { key: 'healthCertificatesAttached', label: 'Health certificates attached?', type: 'yesno', required: false, readOnly: false, unit: null, options: null, group: null, sectionIndex: checklistSecIdx, parentFieldKey: null, position: 201, computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null }
  ];
  d.fields = keep.concat(checklist, tail);
}

fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log('Applied dry export checklist edits to data/record-definitions.json');
