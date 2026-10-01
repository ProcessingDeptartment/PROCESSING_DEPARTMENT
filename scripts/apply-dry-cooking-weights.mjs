// REC 7.4.0 Dry Cooking: blanching/cooking weight rules.
//   - Pots roster gets `jobWeights` (live OOSW / available-to-blanch / available-to-cook figures)
//   - hidden roster column legacyNoBlanching (flags migrated cooking-only cards; see migrate-dry-cooking-legacy-flag.mjs)
// Edits data/record-definitions.json in place; idempotent. The rules themselves live in public/data/business-rules.json.
//
//   node scripts/apply-dry-cooking-weights.mjs
//   node scripts/snapshot-one-def.mjs dry-cooking     (offline snapshot) or export-record-defs.mjs
//   prisma migrate deploy  ->  node scripts/seed-definitions.mjs   (column must exist before the definition is seeded)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-cooking');

const pots = def.sections.find((s) => s.kind === 'roster');
pots.extraJson = {
  ...pots.extraJson,
  jobWeights: {
    column: 'abaloneKg', processColumn: 'process', blanch: 'Blanching', cook: 'Cooking',
    capSource: 'salting-oosw', capMatchField: 'jobNo', capSumColumn: 'weight',
    legacyColumn: 'legacyNoBlanching',
  },
};

if (!def.fields.some((f) => f.key === 'legacyNoBlanching')) {
  const last = Math.max(...def.fields.map((f) => f.position));
  def.fields.push({
    key: 'legacyNoBlanching', label: 'Legacy (no blanching recorded)', type: 'text',
    required: false, readOnly: false, unit: null, options: null, group: null,
    sectionIndex: pots.position, parentFieldKey: '@roster', position: last + 1,
    computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
    extraJson: { hidden: true },
  });
}

fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('dry-cooking: jobWeights set, legacyNoBlanching column present');
