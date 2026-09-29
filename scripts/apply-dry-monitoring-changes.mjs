// REC 7.4.2 Dry Monitoring: field changes (spec "REC 7.4.2 Dry Monitoring: field changes", 2026-09-29).
// Rewrites the dry-monitoring definition in data/record-definitions.json (idempotent):
//   - Date, QC check, Supervisor removed from the definition (old values live in dateOld / qcCheckOld / supervisorOld)
//   - Entry date: read-only, server-stamped at save
//   - Cooking date / No. of trolleys: read-only, filled from REC 7.4.0 / REC 7.4.1 (engine work = build step 4)
//   - Dry room area: dropdown
//   - Estimated drying date: calculated (cooking date + dryingDaysEstimate), read-only
//   - Yes/No colouring: extraJson.good = "No" means Yes is the problem (shows red); "Yes" = Yes is good
//
//   node scripts/apply-dry-monitoring-changes.mjs
//   node scripts/snapshot-one-def.mjs dry-monitoring      (offline snapshot)  or export-record-defs.mjs
//   node scripts/seed-definitions.mjs                     (load into Neon - only when the engine ships)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-monitoring');

const REMOVED = ['date', 'qcCheck', 'supervisor'];
const byKey = Object.fromEntries(def.fields.map((f) => [f.key, f]));

const fld = (key, label, type, o = {}) => ({
  key, label, type,
  required: !!o.required, readOnly: !!o.readOnly,
  unit: o.unit || null, options: o.options || null, group: o.group || null,
  sectionIndex: null, parentFieldKey: null, position: 0,
  computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
  ...(o.extra ? { extraJson: o.extra } : {}),
});
// keep an existing field's identity, change only what the spec changes
const patch = (key, changes, extra) => {
  const f = byKey[key];
  if (!f) throw new Error('missing field ' + key);
  Object.assign(f, changes);
  if (extra) f.extraJson = { ...(f.extraJson || {}), ...extra };
  return f;
};

const AREAS = ['Main dry room', 'Dry container', 'Grading room'];

patch('jobNo', { required: true });
patch('cookingDate', { readOnly: true }, {
  fromRecord: {
    source: 'dry-cooking', matchField: 'jobNo', pick: 'latest', field: 'recordDate', filterCol: 'process', filterIn: ['Cooking'],
    submittedOnly: true, idsField: 'cookingDateSourceIds', manualFlag: 'cookingDateTypedManually',
    note: 'From REC 7.4.0', missing: 'No REC 7.4.0 cooking date for this job. Fill in REC 7.4.0 first', unlockWhenMissing: true,
  },
});
patch('dryRoomArea', { type: 'select', options: AREAS, required: true });
patch('noOfTrolleys', { readOnly: true }, {
  fromRecord: {
    source: 'drying-process', matchField: 'jobNo', pick: 'latest', field: 'noOfTrolleys', nonEmpty: true, submittedOnly: true,
    idsField: 'trolleysSourceSubmissionId', manualFlag: 'trolleysTypedManually',
    note: 'From REC 7.4.1', missing: 'No REC 7.4.1 trolley count for this job. Fill in REC 7.4.1 first', unlockWhenMissing: true,
  },
});
patch('estimatedDryDate', { label: 'Estimated drying date', readOnly: true }, {
  addDays: { from: 'cookingDate', days: 22, configKey: 'dryingDaysEstimate' },
});

// Yes = problem on every check except "Trolleys clearly marked" (Yes = good)
for (const k of ['mouldVisible', 'whiteSaltOnSurface', 'caseHardening', 'surfaceShine', 'footDamage']) {
  patch(k, {}, { good: 'No', redPrompt: 'correctiveActions' });
}
patch('trolleysClearlyMarked', {}, { good: 'Yes', redPrompt: 'correctiveActions' });
patch('correctiveActions', { label: 'Comment / corrective action' });

// Rebuild the field list: drop removed keys, add new ones in place
const entryDate = fld('entryDate', 'Entry date', 'date', { readOnly: true, extra: { serverStamp: true, timeZone: 'Africa/Johannesburg' } });
const hidden = (k, l, t) => fld(k, l, t, { readOnly: true, extra: { hidden: true } });
// old entries hold the removed value under its original key (legacyFrom); the engine shows it labelled "(old)"
const legacy = (k, l, t, from) => fld(k, l, t, { readOnly: true, extra: { legacy: true, legacyFrom: from, showWhen: { nonEmpty: true } } });

let fields = def.fields.filter((f) => !REMOVED.includes(f.key) && !['entryDate', 'dateOld', 'qcCheckOld', 'supervisorOld',
  'cookingDateSourceIds', 'cookingDateTypedManually', 'trolleysSourceSubmissionId', 'trolleysTypedManually'].includes(f.key));
const at = fields.findIndex((f) => f.key === 'cookingDate');   // where the typed Date used to sit, just before Cooking date
fields.splice(at, 0, entryDate);
fields.push(
  hidden('cookingDateSourceIds', 'Cooking date source entries', 'text'),
  hidden('cookingDateTypedManually', 'Cooking date typed manually', 'yesno'),
  hidden('trolleysSourceSubmissionId', 'Trolley count source entry', 'text'),
  hidden('trolleysTypedManually', 'Trolley count typed manually', 'yesno'),
  legacy('dateOld', 'Date (old)', 'date', 'date'),
  legacy('qcCheckOld', 'QC check (old)', 'text', 'qcCheck'),
  legacy('supervisorOld', 'Supervisor (old)', 'text', 'supervisor'),
);
fields.forEach((f, i) => { f.position = i; });
def.fields = fields;

def.extraJson = {
  ...(def.extraJson || {}),
  dryingDaysEstimate: 22,               // calendar days, cooking date -> estimated drying date; admin-editable, new entries only
  dryRoomAreas: AREAS,                  // single editable list (also mirrored in the dryRoomArea field options)
  redPrompt: { field: 'correctiveActions', blocksSubmit: false },   // D-F: prompt, never block
  submitChecks: { hardBlock: ['jobNo', 'dryRoomArea'], softWarn: ['cookingDate', 'noOfTrolleys', 'estimatedDryDate'] },
};
if (typeof def.version === 'number') def.version += 1;

fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('dry-monitoring:', def.fields.length, 'fields;', 'removed', REMOVED.join(', '), '; version', def.version ?? '(n/a)');
