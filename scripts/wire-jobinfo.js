// Rollout: give every job-scoped record the SAME collapsible "Job info" block as Abalone
// Receiving -- the operator picks only the job number and the receiving snapshot (date, farm,
// processing-for, intake weight) autofills read-only from REC 7.1.2. The block opens expanded
// and collapses with the job number still visible in its header (form-record.js / monitoring-log.js
// summaryField + jobInfoGroup support).
//
// Two mechanical passes:
//   1. VERSION BUMP  -- every page that loads form-record.js or monitoring-log.js (a lib edit
//      shipped with this change, so a stale cached copy would silently break the page).
//   2. CONFIG        -- the ~25 job-scoped pages listed in TARGETS: pull the existing jobsearch
//      field into a new first "Job info" section, add the four read-only snapshot fields, and
//      extend the autofill `fill:` map to populate them.
//
// Idempotent: rerunning is a no-op (guards on 'Job info' / the bumped version).
// Edge cases handled by hand, NOT here: REC 7.1.2 (the source), REC 7.1 incubator-cans and the
// 8.1.x traceability mock-recalls (their job field carries stage/group or bespoke structure).

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'public', 'records');
const FR_FROM = 'form-record.js?v=21',      FR_TO = 'form-record.js?v=22';
const ML_FROM = 'monitoring-log.js?v=20',   ML_TO = 'monitoring-log.js?v=21';

// job-scoped pages: file (no .html) -> engine + job field key
const TARGETS = [
  ['REC 1_Gonad Inspection Report',                 'ml', 'jobNo'],
  ['REC 7.1.1_Basket Removal, Shucking & Gutting',     'fr', 'jobNo'],
  ['REC 7.1.3.1_Bleeding and Salting',              'fr', 'jobNo'],
  ['REC 7.1.4_Washing Control Sheet',               'fr', 'jobNo'],
  ['REC 7.1.5_Salting (OOSW)',                        'fr', 'jobNo'],
  ['REC 7.1.6_Scrubbing Check - Supervisor',          'ml', 'jobNo'],
  ['REC 7.2_Sampling Log',                          'ml', 'jobNo'],
  ['REC 7.2.10_Stock Loading',                      'ml', 'jobNo'],
  ['REC 7.2.11_QC Report',                          'fr', 'jobNumber'],
  ['REC 7.2.13_Rework Log',                         'fr', 'jobNo'],
  ['REC 7.2.16_Stock Transfers',                    'fr', 'jobNo'],
  ['REC 7.2.2_Scrubbing Checklist',              'ml', 'jobNo'],
  ['REC 7.2.3_Precooking Check Sheet',              'fr', 'jobNumber'],
  ['REC 7.2.5_Can Packing Control Sheet',           'fr', 'jobNo'],
  ['REC 7.2.6_Can Filling and Printing',            'fr', 'jobNo'],
  ['REC 7.2.7_Canning Production',                       'fr', 'jobNumber'],
  ['REC 7.2.8_Retorting Control Sheet',             'fr', 'jobNumber'],
  ['REC 7.2.9_Retort Inspection Report',            'fr', 'jobNo'],
  ['REC 7.3.1_Broth Cooking',                       'fr', 'jobNo'],
  ['REC 7.3.2_Ingredient Weighing',                 'fr', 'jobNo'],
  ['REC 7.3.3_Sauce Mixing',                        'fr', 'jobNo'],
  ['REC 7.3.6_Brine Mixing Report',                 'fr', 'jobNumber'],
  ['REC 7.4.0_Dry Cooking',                         'fr', 'jobNumber'],
  ['REC 7.4.1_Drying Process',                      'ml', 'jobNumber'],
  ['REC 7.4.10_Dried Abalone Transfer',             'fr', 'jobNumber'],
  ['REC 7.4.2_Dry Monitoring',                      'ml', 'jobNumber'],
  ['REC 7.4.3.1_Grading Production Log (Cultivated)', 'fr', 'jobNumber'],
  ['REC 7.4.3.2_Grading Production Log (Ranched)',    'fr', 'jobNumber'],
  ['REC 7.4.4_Grading, Boxing & Traceability',         'fr', 'jobNo'],
  ['REC 7.4.6_Dry Stock Control',                   'ml', 'jobNo'],
  ['REC 7.5.1_Live Production Pack',                'ml', 'jobNumber'],
  ['REC 7.8.1_Chiller Batch Control (Canning)',               'ml', 'jobNo'],
  ['REC 7.8.1_Dry Chiller Batch Control',           'ml', 'jobNo'],
  ['REC 7.8.4_Seamer Inspection Report',            'ml', 'jobNo'],
  ['REC 7.8.6_Cans Incoming Inspection',            'ml', 'jobNo'],
  ['REC 7.8.8_Dispatch Loading Inspection Checklist','ml', 'jobNo'],
  ['REC 7.8.8.1_Dispatch Receiving Checklist',      'ml', 'jobNumber'],
  ['REC 7.9.1_Chiller Temperature Monitoring',      'ml', 'jobNo'],
];

const SNAP = [
  ['jiReceivingDate', 'Receiving date',        'date', 'receivingDate'],
  ['jiReceivedFrom',  'Received from (farm)',  'text', 'receivedFrom'],
  ['jiProcessingFor', 'Processing for',        'text', 'toBeProcessedFor'],
  ['jiIntakeWeight',  'Whole weight (kg)',    'text', 'intakeWeight'],
];

function bumpVersions() {
  let n = 0;
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith('.html')) continue;
    const p = path.join(DIR, f);
    let t = fs.readFileSync(p, 'utf8'), before = t;
    t = t.split(FR_FROM).join(FR_TO).split(ML_FROM).join(ML_TO);
    if (t !== before) { fs.writeFileSync(p, t); n++; }
  }
  console.log('version bump:', n, 'pages');
}

function fillEntries(indent) {
  return SNAP.map(([k, , , src]) => `${indent}${k}: '${src}'`).join(',\n');
}

function snapFieldLines(indent) {
  return SNAP.map(([k, label, type]) =>
    `${indent}{ key: '${k}', label: '${label}', type: '${type}', readOnly: true }`).join(',\n');
}

function doFrPage(t, key) {
  const nl = t.includes('\r\n') ? '\r\n' : '\n';
  if (t.includes("title: 'Job info'")) return { skip: 'already done' };

  // 1. locate the single jobsearch field line for this key and cut it out
  const fieldRe = new RegExp(
    `[ \\t]*\\{ key: '${key}', label: '[^']*', type: 'jobsearch'[^}]*\\},?[ \\t]*(?:\\r?\\n)`, '');
  const fm = t.match(fieldRe);
  if (!fm) return { skip: 'job field line not found' };
  let jobFieldObj = fm[0].trim().replace(/,$/, '');
  t = t.replace(fieldRe, '');

  // 2. extend the autofill fill: { ... } map (all targets already carry `fill: {`)
  const fillRe = /fill:\s*\{([^}]*)\}/;
  const fmatch = t.match(fillRe);
  if (!fmatch) return { skip: 'fill: {} not found' };
  const existing = fmatch[1].trim().replace(/,$/, '').trim();
  const merged = (existing ? existing + ',' + nl : nl) + fillEntries('          ') + nl + '        ';
  t = t.replace(fillRe, 'fill: {' + merged + '}');

  // 3. prepend the Job info section as the first entry of sections: [
  const secRe = /(sections:\s*\[\s*(?:\r?\n)?)(\s*)\{/;
  if (!secRe.test(t)) return { skip: 'sections: [ not found' };
  const block =
    `{ title: 'Job info', collapsible: true, summaryField: '${key}', fields: [` + nl +
    `        ${jobFieldObj},` + nl +
    snapFieldLines('        ') + nl +
    `      ]},` + nl + `      `;
  t = t.replace(secRe, (m, head, ind) => head + ind + block + '{');
  return { text: t };
}

function doMlPage(t, key) {
  const nl = t.includes('\r\n') ? '\r\n' : '\n';
  if (t.includes("group: 'Job info'")) return { skip: 'already done' };

  // 1. add group: 'Job info' to the jobsearch field, keeping it where it is (must be first entry)
  const fieldRe = new RegExp(`\\{ key: '${key}', label: '([^']*)', type: 'jobsearch'([^}]*)\\}`);
  const fm = t.match(fieldRe);
  if (!fm) return { skip: 'job field line not found' };
  t = t.replace(fieldRe, `{ group: 'Job info', key: '${key}', label: '${fm[1]}', type: 'jobsearch'${fm[2]}}`);

  // 2. add the four read-only snapshot fields right after the job field line
  const anchorRe = new RegExp(`([ \\t]*)(\\{ group: 'Job info', key: '${key}',[^\\n]*\\},?)(\\r?\\n)`);
  const am = t.match(anchorRe);
  if (!am) return { skip: 'anchor not found' };
  const ind = am[1];
  const extra = SNAP.map(([k, label, type]) =>
    `${ind}{ group: 'Job info', key: '${k}', label: '${label}', type: '${type}', readOnly: true },`).join(nl);
  t = t.replace(anchorRe, `$1$2$3${extra}${nl}`);

  // 3. extend fill: { ... }
  const fillRe = /fill:\s*\{([^}]*)\}/;
  const fmatch = t.match(fillRe);
  if (!fmatch) return { skip: 'fill: {} not found' };
  const existing = fmatch[1].trim().replace(/,$/, '').trim();
  const merged = (existing ? existing + ', ' : '') + SNAP.map(([k, , , src]) => `${k}: '${src}'`).join(', ');
  t = t.replace(fillRe, 'fill: { ' + merged + ' }');

  // 4. declare jobInfoGroup on the init config
  if (!t.includes('jobInfoGroup:')) {
    t = t.replace(/(\n\s*)(autofill:\s*\[)/, `$1jobInfoGroup: 'Job info',$1$2`);
  }
  return { text: t };
}

function main() {
  bumpVersions();
  const done = [], skipped = [];
  for (const [file, engine, key] of TARGETS) {
    const p = path.join(DIR, file + '.html');
    if (!fs.existsSync(p)) { skipped.push(file + ' (missing)'); continue; }
    let t = fs.readFileSync(p, 'utf8');
    const r = engine === 'fr' ? doFrPage(t, key) : doMlPage(t, key);
    if (r.skip) { skipped.push(file + ' (' + r.skip + ')'); continue; }
    fs.writeFileSync(p, r.text);
    done.push(file);
  }
  console.log('\nconfig updated:', done.length);
  done.forEach(f => console.log('  +', f));
  console.log('\nskipped:', skipped.length);
  skipped.forEach(f => console.log('  -', f));
}

main();
