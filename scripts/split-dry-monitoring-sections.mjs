// REC 7.4.2 Dry Monitoring: split the single "Job info" section (2026-10-01).
// Every field was inheriting the Job info group, so picking a job folded the whole form away.
// New layout: Job info (job number only) / Dry room details / Checks / Comments. Sign off is untouched.
//   - Field keys, labels, storage columns, calculations: unchanged. Only `group` and field order change
//     (order within each section is kept; sections must be contiguous for the engine to draw headings).
//   - Received from / Processing for / Whole weight / Intake date: extraJson.hideInForm -- kept as hidden
//     inputs (autofill still fills them and they still save, list and print), just not drawn on the form.
//   - "(old)" fields: grouped at the end of Dry room details; showWhen.nonEmpty keeps them off new entries.
//
//   node scripts/split-dry-monitoring-sections.mjs
//   node scripts/snapshot-one-def.mjs dry-monitoring
//   node scripts/seed-definitions-only.mjs   (load into Neon -- only when the engine ships)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-monitoring');

const SECTIONS = [
  ['Job info', ['jobNo', 'jiReceivedFrom', 'jiProcessingFor', 'intakeWeight', 'intakeDate']],
  ['Dry room details', ['entryDate', 'cookingDate', 'dryRoomArea', 'noOfTrolleys', 'estimatedDryDate',
    'cookingDateSourceIds', 'cookingDateTypedManually', 'trolleysSourceSubmissionId', 'trolleysTypedManually',
    'dateOld', 'qcCheckOld', 'supervisorOld']],
  ['Checks', ['trolleysClearlyMarked', 'mouldVisible', 'whiteSaltOnSurface', 'caseHardening', 'surfaceShine', 'footDamage', 'correctiveActions']],
  ['Comments', ['comments']],
];
const HIDE_IN_FORM = ['jiReceivedFrom', 'jiProcessingFor', 'intakeWeight', 'intakeDate'];

const byKey = Object.fromEntries(def.fields.map((f) => [f.key, f]));
const ordered = [];
for (const [group, keys] of SECTIONS) {
  for (const k of keys) {
    const f = byKey[k];
    if (!f) throw new Error('missing field ' + k);
    f.group = group;
    if (HIDE_IN_FORM.includes(k)) f.extraJson = { ...(f.extraJson || {}), hideInForm: true };
    ordered.push(f);
  }
}
if (ordered.length !== def.fields.length) throw new Error('field count mismatch: ' + ordered.length + ' vs ' + def.fields.length);
ordered.forEach((f, i) => { f.position = i; });
def.fields = ordered;
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('regrouped', ordered.length, 'fields');
