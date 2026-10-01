// REC 7.4.10 Dried Abalone Transfer: the Crate number is automatic (brief 2026-10-01).
// Edits data/record-definitions.json in place (idempotent):
//   - crateNumber becomes a read-only whole number (digits): never typed, shown as a greyed label in the row
//   - the roster is flagged jobNumbered: the engine numbers the crates 1,2,3 per job (continuing across
//     entries) and the server (src/crate-number-guard.js) assigns the real numbers at Submit
//   - quickEntry no longer prefills a crate number (the capture line is weight only)
//   - hidden roster columns: jobNo (job copy so the DB can enforce UNIQUE (jobNo, crateNumber)),
//     crateNoOld (what was typed before this change), voided/voidReason/voidedBy/voidedAt (a voided crate
//     keeps its number)
//
//   node scripts/apply-crate-numbering.mjs
//   node scripts/generate-submission-schema.mjs    (then check prisma diff)
//   node scripts/snapshot-one-def.mjs dried-abalone-transfer   (offline snapshot; never hand-edit it)
//   node scripts/seed-definitions-only.mjs / seed-definitions.mjs   (Neon: only when the engine ships)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dried-abalone-transfer');
if (!def) throw new Error('dried-abalone-transfer not found');

const rosterIdx = def.sections.findIndex((s) => s.kind === 'roster');
const roster = def.sections[rosterIdx];
roster.extraJson = {
  quickEntry: { addLabel: '+ Add crate' },
  jobNumbered: { column: 'crateNumber', jobField: 'jobNo', jobColumn: 'jobNo', rowTitle: 'Crate', source: 'dried-abalone-transfer' },
};

const crate = def.fields.find((f) => f.key === 'crateNumber');
crate.type = 'digits';
crate.readOnly = true;
crate.required = false;

const col = (key, label, type, extra) => ({
  key, label, type, required: false, readOnly: true, unit: null, options: null, group: null,
  sectionIndex: rosterIdx, parentFieldKey: '@roster', position: 0,
  computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
  extraJson: Object.assign({ hidden: true }, extra || {}),
});
const add = [
  col('jobNo', 'Job number', 'text'),
  col('crateNoOld', 'Crate number (old)', 'text', { legacy: true }),
  col('voided', 'Voided', 'yesno'),
  col('voidReason', 'Void reason', 'text'),
  col('voidedBy', 'Voided by', 'text'),
  col('voidedAt', 'Voided at', 'timestamp'),
];
for (const f of add) if (!def.fields.some((x) => x.key === f.key && x.parentFieldKey === '@roster')) def.fields.push(f);
def.fields.forEach((f, i) => { f.position = i; });

def.extraJson = Object.assign({}, def.extraJson, { crateTrace: true });

fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('dried-abalone-transfer: crateNumber -> read-only digits; roster fields:', def.fields.filter((f) => f.parentFieldKey).map((f) => f.key).join(', '));
