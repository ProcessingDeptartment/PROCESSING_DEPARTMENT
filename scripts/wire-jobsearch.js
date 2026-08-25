// One-off rollout: convert every genuine abalone job-number field (not raw-material batch
// numbers -- chemical/glass/salt batches are a different thing entirely) to a searchable
// jobsearch field sourced from Abalone Receiving, so nobody has to already know the job number.
// Also wires harvestFarm autofill where that field happens to exist under the same name.
const fs = require('fs');
const path = require('path');

const TARGETS = [
  { file: 'REC-1-gonad-inspection-report', key: 'jobNo', engine: 'MonitoringLog' },
  { file: 'REC-7.1.3-salting-and-tumbling', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC-7.1.3.1-bleeding-and-salting', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC-7.1.4-washing-control-sheet', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC-7.2.10-stock-loading', key: 'jobNo', engine: 'MonitoringLog' },
  { file: 'REC-7.2.13-rework-log', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC-7.2.16-stock-transfers', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC-7.2.6-can-filling-and-printing', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC-7.8.1-dry-chiller-batch-control', key: 'jobNo', engine: 'MonitoringLog', hasHarvestFarm: true },
  { file: 'REC-8.1.6-a-traceability-mock-recall-canned-braised-abalone', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC-8.1.6-traceability-mock-recall-canned-abalone', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC-8.1.6b-traceability-mock-recall-canned-minced-abalone', key: 'jobNo', engine: 'FormRecord' },
  { file: 'REC-8.1.7-traceability-mock-recall-dried-abalone', key: 'jobNo', engine: 'FormRecord' },
  { file: 'Dry-Export-Pack-Front-Page-dry-export-pack-front-page', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.2.11-qc-report', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.2.3-precooking-check-sheet', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.2.7-cans-produced', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.2.8-retorting-control-sheet', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.3.6-brine-mixing-report', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.4.0-dry-cooking', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.4.1-drying-process', key: 'jobNumber', engine: 'MonitoringLog' },
  { file: 'REC-7.4.10-dried-abalone-transfer', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.4.2-dry-monitoring', key: 'jobNumber', engine: 'MonitoringLog' },
  { file: 'REC-7.4.3.1-grading-production-log-cultivated', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.4.3.2-grading-production-log-ranched', key: 'jobNumber', engine: 'FormRecord' },
  { file: 'REC-7.8.8.1-dispatch-receiving-checklist', key: 'jobNumber', engine: 'MonitoringLog' }
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
