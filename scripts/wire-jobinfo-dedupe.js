// Follow-up to wire-jobinfo.js: several job-scoped pages already carried their own autofilled
// snapshot field (intakeDate / harvestFarm / processingFor), so adding the standard ji* field
// showed the same thing twice. This removes the ji* field line AND its `fill:` map entry
// wherever the page already has an equivalent field of its own. The page's own field stays where
// it is (still autofilled); only the job number itself is guaranteed inside the collapsible block.
// Idempotent.

const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'public', 'records');

// ji key -> keys that mean "this page already has that field"
const EQUIV = {
  jiReceivingDate: ['intakeDate', 'receivingDate'],
  jiReceivedFrom:  ['harvestFarm', 'receivedFrom'],
  jiProcessingFor: ['processingFor', 'toBeProcessedFor'],
  jiIntakeWeight:  ['intakeWeight'],
};

function hasOwnField(text, jiKey) {
  // a field/column definition for one of the equivalent keys, that is NOT the ji line itself
  return EQUIV[jiKey].some((k) =>
    new RegExp(`key: '${k}'`).test(text) && !new RegExp(`key: '${k}'[^\\n]*ji`).test(text));
}

let changed = 0;
const touched = [];
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.html')) continue;
  const p = path.join(DIR, f);
  let t = fs.readFileSync(p, 'utf8');
  if (!/key: 'ji(ReceivingDate|ReceivedFrom|ProcessingFor|IntakeWeight)'/.test(t)) continue;
  const before = t;

  for (const jiKey of Object.keys(EQUIV)) {
    if (!hasOwnField(t, jiKey)) continue;
    // drop the ji field/column line (form-record or monitoring-log shape)
    t = t.replace(new RegExp(`[ \\t]*\\{ (?:group: 'Job info', )?key: '${jiKey}',[^\\n]*\\},?[ \\t]*\\r?\\n`), '');
    // drop its fill: map entry (any position, with or without trailing comma)
    t = t.replace(new RegExp(`\\s*${jiKey}: '[^']*',?`), '');
  }
  // tidy a fill map that lost its last entry: "fill: { a: 'x', }" -> "fill: { a: 'x' }"
  t = t.replace(/fill:\s*\{([^}]*?),\s*\}/g, 'fill: {$1 }');
  t = t.replace(/fill:\s*\{\s*\}/g, 'fill: {}');

  if (t !== before) { fs.writeFileSync(p, t); changed++; touched.push(f); }
}
console.log('deduped:', changed);
touched.forEach((f) => console.log('  ~', f));
