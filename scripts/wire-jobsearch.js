// One-off rollout: convert every genuine abalone job-number field (not raw-material batch
// numbers -- chemical/glass/salt batches are a different thing entirely) to a searchable
// jobsearch field sourced from Abalone Receiving, so nobody has to already know the job number.
// Also wires harvestFarm autofill where that field happens to exist under the same name.
const fs = require('fs');
const path = require('path');

const TARGETS = [
  { file: 'REC 1_Gonad Inspection Report', key: 'jobNo', engine: 'MonitoringLog' },
  { file: 'REC 7.1.3_Salting and Tumbling', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC 7.1.3.1_Bleeding and Salting', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC 7.1.4_Washing Control Sheet', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC 7.2.10_Stock Loading', key: 'jobNo', engine: 'MonitoringLog' },
  { file: 'REC 7.2.13_Rework Log', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC 7.2.16_Stock Transfers', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC 7.2.6_Can Filling and Printing', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC 7.8.1_Dry Chiller Batch Control', key: 'jobNo', engine: 'MonitoringLog', hasHarvestFarm: true },
  { file: 'REC 8.1.6a_Traceability & Mock Recall Checklist for Canned Braised Abalone', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC 8.1.6_Traceability & Mock Recall Checklist for Canned Abalone', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC 8.1.6b_Traceability & Mock Recall Checklist for Canned Minced Abalone', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC 8.1.7_Traceability & Mock Recall Checklist for Dried Abalone', key: 'jobNo', engine: 'FormRecord' },
  { file: 'Dry-Export-Pack-Front-Page-dry-export-pack-front-page', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.2.11_QC Report', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.2.3_Precooking Check Sheet', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.2.7_Canning Production', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.2.8_Retorting Control Sheet', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.3.6_Brine Mixing Report', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.4.0_Dry Cooking', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.4.1_Drying Process', key: 'jobNumber', engine: 'MonitoringLog' },
  { file: 'REC 7.4.10_Dried Abalone Transfer', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.4.2_Dry Monitoring', key: 'jobNumber', engine: 'MonitoringLog' },
  { file: 'REC 7.4.3.1_Grading Production Log (Cultivated)', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.4.3.2_Grading Production Log (Ranched)', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC 7.8.8.1_Dispatch Receiving Checklist', key: 'jobNumber', engine: 'MonitoringLog' }
];

const DIR = path.join(__dirname, '..', 'public', 'records');
let changed = 0, skipped = [];

for (const t of TARGETS) {
  const filePath = path.join(DIR, t.file + '.html');
  let text = fs.readFileSync(filePath, 'utf8');

  if (text.includes('autofill:')) { skipped.push(t.file + ' (already has autofill)'); continue; }

  // Convert the job field's type to jobsearch, preserving any `required: true`. Tolerant of
  // CRLF vs LF since this repo has a mix.
  const fieldRe = new RegExp(`(\\{ key: '${t.key}', label: '[^']*', type: ')text('(?:, required: true)?)`, '');
  if (!fieldRe.test(text)) { skipped.push(t.file + ' (field pattern not found)'); continue; }
  text = text.replace(fieldRe, '$1jobsearch$2');

  const fill = t.hasHarvestFarm ? "{ harvestFarm: 'receivedFrom' }" : '{}';
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const autofillBlock = `    // Job number search-select, sourced from Abalone Receiving (REC 7.1.2) -- pick from what's${nl}` +
    `    // actually been received instead of typing blind.${t.hasHarvestFarm ? ' Also autofills harvest farm.' : ''}${nl}` +
    `    autofill: [${nl}` +
    `      { watch: '${t.key}', source: 'abalone-receiving', matchField: 'jobNo', fill: ${fill} }${nl}` +
    `    ],${nl}`;

  // Anchor on the field-list keyword itself (whichever indent it's at), not on what precedes it
  // -- some pages have extra config (batchField, stage, listColumns) between docRevisionStart and
  // the actual field list, and line endings aren't consistent across the repo.
  const initRe = t.engine === 'FormRecord'
    ? /( *)(sections: *\[)/
    : /( *)(entryFields: *\[)/;
  if (!initRe.test(text)) { skipped.push(t.file + ' (insertion point not found)'); continue; }
  text = text.replace(initRe, (m, indent, kw) => indent + autofillBlock + indent + kw);

  fs.writeFileSync(filePath, text);
  changed++;
}

console.log('changed:', changed);
console.log('skipped:', JSON.stringify(skipped, null, 2));
