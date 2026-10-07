// REC 7.4.0 temporary entry flow (instructions 2026-10-07): typed OOSW kg on Job info, unlock of the REC 7.1.2
// autofill when no receiving record exists, jobNo required, OOSW kg in the collapsed Job info line.
// Edits data/record-definitions.json + public/data/business-rules.json in place; idempotent.
//   node scripts/apply-dry-cooking-manual-oosw.mjs
//   node scripts/snapshot-one-def.mjs dry-cooking
//   prisma migrate deploy (adds sub_dry_cooking."ooswKg")  ->  node scripts/seed-definitions.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const RULES = path.join(ROOT, 'public', 'data', 'business-rules.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-cooking');

if (!def.fields.some((f) => f.key === 'ooswKg')) {
  const top = def.fields.filter((f) => f.sectionIndex === 0);
  def.fields.push({
    key: 'ooswKg', label: 'OOSW weight (kg)', type: 'number', required: false, readOnly: false, unit: 'kg',
    options: null, group: null, sectionIndex: 0, parentFieldKey: null, position: top.length,
    computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
  });
}
const jobNo = def.fields.find((f) => f.key === 'jobNo');
jobNo.required = true;

const sec = def.sections[0];
sec.extraJson.summaryFields = [
  'jobNo', 'harvestFarm',
  { key: 'jiIntakeWeight', suffix: ' kg' }, { key: 'ooswKg', label: 'OOSW:', suffix: ' kg' },
];
delete sec.extraJson.summaryField;

def.extraJson = { ...(def.extraJson || {}), autofillUnlockOnMiss: true };
const roster = def.sections.find((s) => s.kind === 'roster');
roster.extraJson.jobWeights.manualField = 'ooswKg';

const rules = JSON.parse(fs.readFileSync(RULES, 'utf8'));
const r1 = rules.find((r) => r.id === 'R1');
r1.manualCapField = 'ooswKg';
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
fs.writeFileSync(RULES, JSON.stringify(rules, null, 2) + '\n');
console.log('done');
