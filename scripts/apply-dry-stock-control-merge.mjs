// REC 7.4.6 Dry Stock Control: one section, hidden job data, autofilled weights/dates, Finance sign-off, progressive stages
// (spec: claude/rec-7.4.6-dry-stock-control-merge-job-info-instructions.md section 5).
// Edits data/record-definitions.json in place and writes the static mirror public/data/record-defs/dry-stock-control.json
// (built with the same assembleRecordConfig the API uses, no database needed). Idempotent. Then:
//   node scripts/snapshot-one-def.mjs dry-stock-control      (optional backup of the live definition)
//   node scripts/seed-definitions-only.mjs dry-stock-control (Neon -- makes it live; AFTER the stage-columns migration)
//
// Nothing is deleted: Received from / Processing for / Whole weight (receiving copy) / Intake date / Month stay as hidden
// fields so old entries, CSV and the sub_dry_stock_control columns are unchanged.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-stock-control');
const old = Object.fromEntries(def.fields.map((f) => [f.key, f]));
const GROUP = 'Dry stock control';

const TRIGGER = ['weightIn', 'countInFactory', 'countInFinance', 'weightOut', 'countOutFactory', 'countOutFinance'];
const COMPLETION = ['weightIn', 'dateIn', 'countInFactory', 'countInFinance', 'weightOut', 'dateOut', 'countOutFactory', 'countOutFinance'];

const field = (key, o = {}) => {
  const prev = old[key] || {};
  return {
    key, label: o.label || prev.label, type: o.type || prev.type,
    required: o.required != null ? o.required : false,
    readOnly: o.readOnly != null ? o.readOnly : !!prev.readOnly,
    unit: prev.unit != null ? prev.unit : (o.unit || null), options: null, group: GROUP,
    sectionIndex: null, parentFieldKey: null, position: 0,
    computeFn: null, computeArgs: null, recordPickSource: null,
    linkField: prev.linkField || null, linkRelation: prev.linkRelation || null, validateJson: null,
    ...(o.extra ? { extraJson: o.extra } : (prev.extraJson ? { extraJson: prev.extraJson } : {})),
  };
};
const hidden = (key, label, type) => field(key, { label, type, readOnly: true, extra: { hidden: true } });
const from = (r) => ({ fromRecord: { matchField: 'jobNo', submittedOnly: true, unlockWhenMissing: true, ...r } });

const ordered = [
  field('jobNo', { required: true, extra: { route: 'Dried', jobEntry: 'merged' } }),
  field('wholeWeight', { readOnly: true, extra: from({ source: 'receiving-weight', idsField: 'wholeWeightSourceIds', manualFlag: 'wholeWeightTypedManually',
    note: 'From REC 7.1.2 receiving', missing: 'No receiving weight found for this job. Check REC 7.1.2, or type it in.' }) }),
  field('cookingDate', { readOnly: true, extra: from({ source: 'dry-cooking', pick: 'latest', field: 'recordDate', filterCol: 'process', filterIn: ['Cooking'],
    idsField: 'cookingDateSourceIds', manualFlag: 'cookingDateTypedManually', note: 'From REC 7.4.0',
    missing: 'No REC 7.4.0 cooking date for this job. Fill in REC 7.4.0 first' }) }),
  field('noOfTrolleys', { readOnly: true, extra: from({ source: 'drying-process', pick: 'latest', field: 'noOfTrolleys', nonEmpty: true,
    idsField: 'trolleysSourceSubmissionId', manualFlag: 'trolleysTypedManually', note: 'From REC 7.4.1',
    missing: 'No REC 7.4.1 trolley count for this job. Fill in REC 7.4.1 first' }) }),
  field('weightIn', { readOnly: true, extra: from({ source: 'dry-cooked-weight', idsField: 'cookedWeightSourceIds', manualFlag: 'weightInTypedManually',
    note: 'Total cooked weight from REC 7.4.0',
    missing: 'No REC 7.4.0 cooking weight found for this job. Fill in REC 7.4.0 first' }) }),
  field('dateIn'),
  field('countInFactory'),
  field('countInFinance'),
  field('weightOut', { readOnly: true, extra: from({ source: 'dried-transfer-weight', idsField: 'weightOutSourceIds', manualFlag: 'weightOutTypedManually',
    note: 'Total weight from REC 7.4.10',
    missing: 'No REC 7.4.10 found for this job. Fill in REC 7.4.10 first' }) }),
  field('dateOut'),
  field('countOutFactory'),
  field('countOutFinance'),
  // hidden: job data kept for old entries / CSV / lookups (nothing deleted); Month is off the form and out of required validation
  field('jiReceivedFrom', { readOnly: true, extra: { hidden: true, exportCsv: true } }),
  field('jiProcessingFor', { readOnly: true, extra: { hidden: true, exportCsv: true } }),
  field('jiIntakeWeight', { readOnly: true, extra: { hidden: true, exportCsv: true } }),
  field('intakeDate', { extra: { hidden: true, exportCsv: true } }),
  field('month', { required: false, extra: { hidden: true, exportCsv: true } }),
  // hidden audit snapshot of where each autofilled value came from
  hidden('wholeWeightSourceIds', 'Whole weight source entries', 'text'),
  hidden('wholeWeightTypedManually', 'Whole weight typed manually', 'yesno'),
  hidden('cookingDateSourceIds', 'Cooking date source entries', 'text'),
  hidden('cookingDateTypedManually', 'Cooking date typed manually', 'yesno'),
  hidden('trolleysSourceSubmissionId', 'Trolley count source entry', 'text'),
  hidden('trolleysTypedManually', 'Trolley count typed manually', 'yesno'),
  hidden('cookedWeightSourceIds', 'Weight in source entries (REC 7.4.0)', 'text'),
  hidden('weightInTypedManually', 'Weight in typed manually', 'yesno'),
  hidden('weightOutSourceIds', 'Weight out source entries (REC 7.4.10)', 'text'),
  hidden('weightOutTypedManually', 'Weight out typed manually', 'yesno'),
];
ordered.forEach((f, i) => { f.position = i; });
def.fields = ordered;
def.jobInfoGroup = GROUP;
def.extraJson = {
  ...def.extraJson,
  progressive: true,
  financeSignOff: true,
  signOffTrigger: TRIGGER,
  signOffRule: 'anyHasValue',
  completionFields: COMPLETION,
};
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('definition updated:', ordered.length, 'fields');

// static mirror (what the page paints from before the API wakes), built from the definition just written
const { assembleRecordConfig } = require('../src/record-def.js');
const fake = { recordDefinition: { findUnique: async () => ({ ...def, version: 1, autofills: def.autofills.map((a) => ({ ...a, extraJson: a.extraJson || null })),
  sections: def.sections || [], fields: def.fields.map((f) => ({ ...f })) }) } };
const out = await assembleRecordConfig(fake, 'dry-stock-control');
const mirror = path.join(ROOT, 'public', 'data', 'record-defs', 'dry-stock-control.json');
fs.writeFileSync(mirror, JSON.stringify(out.config));
console.log('mirror written:', path.relative(ROOT, mirror));
