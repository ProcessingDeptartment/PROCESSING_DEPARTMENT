// Adds batchField (job number) to every record already wired with job-number search/autofill but
// not yet opted into the Traceability index -- being searchable via the job-number picker and
// being traceable via batch-trace.html are two separate systems; this closes that gap.
const fs = require('fs');
const path = require('path');

const TARGETS = [
  ['REC-7.1.1-basket-removal-shucking-gutting', 'jobNo'],
  ['REC-7.1.2-abalone-receiving', 'jobNo'],
  ['REC-7.1.3-salting-and-tumbling', 'jobNo'],
  ['REC-7.1.3.1-bleeding-and-salting', 'jobNo'],
  ['REC-7.1.4-washing-control-sheet', 'jobNo'],
  ['REC-7.1.5-salting-oosw', 'jobNo'],
  ['REC-7.1.6-scrubbing-check-supervisor', 'jobNo'],
  ['REC-7.2.9-retort-inspection-report', 'jobNo'],
  ['REC-7.2.10-stock-loading', 'jobNo'],
  ['REC-7.2.13-rework-log', 'jobNo'],
  ['REC-7.2.16-stock-transfers', 'jobNo'],
  ['REC-7.2.6-can-filling-and-printing', 'jobNo'],
  ['REC-7.4.6-dry-stock-control', 'jobNo'],
  ['REC-7.8.1-dry-chiller-batch-control', 'jobNo'],
  ['Dry-Export-Pack-Front-Page-dry-export-pack-front-page', 'jobNumber'],
  ['REC-7.3.6-brine-mixing-report', 'jobNumber'],
  ['REC-7.4.0-dry-cooking', 'jobNumber'],
  ['REC-7.4.1-drying-process', 'jobNumber'],
  ['REC-7.4.2-dry-monitoring', 'jobNumber'],
  ['REC-7.4.3.1-grading-production-log-cultivated', 'jobNumber'],
  ['REC-7.4.3.2-grading-production-log-ranched', 'jobNumber'],
  ['REC-7.8.8.1-dispatch-receiving-checklist', 'jobNumber'],
  ['REC-1-gonad-inspection-report', 'jobNo']
];

const DIR = path.join(__dirname, '..', 'public', 'records');
let changed = 0, skipped = [];

for (const [file, key] of TARGETS) {
  const filePath = path.join(DIR, file + '.html');
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.includes('batchField:')) { skipped.push(file + ' (already has batchField)'); continue; }

  const re = /(recordKey: '[^']*',(?:\r\n|\n))/;
  if (!re.test(text)) { skipped.push(file + ' (recordKey line not found)'); continue; }
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  text = text.replace(re, (m, p1) => p1 + `    batchField: '${key}',${nl}`);

  fs.writeFileSync(filePath, text);
  changed++;
}

console.log('changed:', changed);
console.log('skipped:', JSON.stringify(skipped, null, 2));
