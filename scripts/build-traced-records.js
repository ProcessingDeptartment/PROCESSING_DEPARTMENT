// Regenerates public/lib/traced-records.js -- the list of every record that opts into the batch
// traceability index, read straight out of the record pages so it cannot drift from them.
//
//     node scripts/build-traced-records.js
//
// Only the backfill tool (pages/backfill-traceability.html) consumes this. Records index
// themselves from their own page during a normal save and never need the manifest.

const fs = require('fs');
const path = require('path');

const RECDIR = path.join(__dirname, '..', 'public', 'records');
const OUT = path.join(__dirname, '..', 'public', 'lib', 'traced-records.js');

const one = (src, key) => {
  const m = src.match(new RegExp(key + ": '([^']*)'"));
  return m ? m[1] : null;
};

const records = [];
for (const file of fs.readdirSync(RECDIR).filter(f => f.endsWith('.html')).sort()) {
  const src = fs.readFileSync(path.join(RECDIR, file), 'utf8');
  if (!/batchField: '/.test(src)) continue;

  const recordKey = one(src, 'recordKey');
  if (!recordKey) continue;

  // Which engine owns the submissions decides which storage key they live under. The one custom
  // page (REC 7.2.12) stores each inspection as its own record:<id> key instead of a list.
  let store = 'custom';
  if (/FormRecord\.init/.test(src)) store = 'formrecord:' + recordKey;
  else if (/MonitoringLog\.init/.test(src)) store = 'monitoring_log:' + recordKey;

  const extraM = src.match(/extraBatchFields: \[([^\]]*)\]/);

  records.push({
    recordKey,
    pageFile: file,
    docCode: one(src, 'docCode'),
    title: one(src, 'title') || recordKey,
    batchField: one(src, 'batchField'),
    batchDateField: one(src, 'batchDateField') || null,
    stage: one(src, 'stage') || null,
    extraBatchFields: extraM ? (extraM[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)) : [],
    store
  });
}

const banner = `/*
 * GENERATED -- do not hand-edit. Run: node scripts/build-traced-records.js
 *
 * Every record that declares a batchField, with the storage key its submissions live under.
 * Used only by pages/backfill-traceability.html to re-index submissions saved before the record
 * opted into traceability. During a normal save each record indexes itself from its own page.
 *
 * Generated ${new Date().toISOString().slice(0, 10)} from ${records.length} record pages.
 */
`;

fs.writeFileSync(OUT, banner + 'window.TracedRecords = ' + JSON.stringify(records, null, 2) + ';\n', 'utf8');
console.log('wrote ' + path.relative(process.cwd(), OUT) + ' (' + records.length + ' records)');
