// Adds batchField (job number) to every record already wired with job-number search/autofill but
// not yet opted into the Traceability index -- being searchable via the job-number picker and
// being traceable via batch-trace.html are two separate systems; this closes that gap.
const fs = require('fs');
const path = require('path');

const TARGETS = [
  ['REC 7.1.1_Basket Removal, Shucking & Gutting', 'jobNo'],
  ['REC 7.1.2_Abalone Receiving', 'jobNo'],
  ['REC 7.1.3_Salting and Tumbling', 'jobNo'],
  ['REC 7.1.3.1_Bleeding and Salting', 'jobNo'],
  ['REC 7.1.4_Washing Control Sheet', 'jobNo'],
  ['REC 7.1.5_Salting (OOSW)', 'jobNo'],
  ['REC 7.1.6_Scrubbing Check - Supervisor', 'jobNo'],
  ['REC 7.2.9_Retort Inspection Report', 'jobNo'],
  ['REC 7.2.10_Stock Loading', 'jobNo'],
  ['REC 7.2.13_Rework Log', 'jobNo'],
  ['REC 7.2.16_Stock Transfers', 'jobNo'],
  ['REC 7.2.6_Can Filling and Printing', 'jobNo'],
  ['REC 7.4.6_Dry Stock Control', 'jobNo'],
  ['REC 7.8.1_Dry Chiller Batch Control', 'jobNo'],
  ['Dry-Export-Pack-Front-Page-dry-export-pack-front-page', 'jobNumber'],
  ['REC 7.3.6_Brine Mixing Report', 'jobNumber'],
  ['REC 7.4.0_Dry Cooking', 'jobNumber'],
  ['REC 7.4.1_Drying Process', 'jobNumber'],
  ['REC 7.4.2_Dry Monitoring', 'jobNumber'],
  ['REC 7.4.3.1_Grading Production Log (Cultivated)', 'jobNumber'],
  ['REC 7.4.3.2_Grading Production Log (Ranched)', 'jobNumber'],
  ['REC 7.8.8.1_Dispatch Receiving Checklist', 'jobNumber'],
  ['REC 1_Gonad Inspection Report', 'jobNo']
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
