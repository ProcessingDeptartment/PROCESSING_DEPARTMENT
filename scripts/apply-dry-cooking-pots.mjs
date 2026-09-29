// REC 7.4.0 Dry Cooking: turn the single-pot entry into a Pots roster (one row per pot, each with a
// Blanching / Cooking / Both process). Edits data/record-definitions.json in place; idempotent.
//
//   node scripts/apply-dry-cooking-pots.mjs
//   node scripts/seed-definitions.mjs          (load into Neon)
//   node scripts/export-record-defs.mjs        (refresh public/data/record-defs/*.json snapshots)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-cooking');

const BLANCH = { field: 'process', in: ['Blanching', 'Both'] };
const COOK = { field: 'process', in: ['Cooking', 'Both'] };

const col = (key, label, type, group, extra = {}) => ({
  key, label, type,
  required: !!extra.required, readOnly: !!extra.readOnly,
  unit: null, options: extra.options || null, group,
  sectionIndex: 1, parentFieldKey: '@roster',
  position: 0,
  computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
  ...(extra.extraJson ? { extraJson: extra.extraJson } : {}),
});
const when = (showWhen, more = {}) => ({ extraJson: { showWhen, ...more } });

const columns = [
  col('process', 'Process', 'segmented', 'Pot', {
    required: true,
    options: ['Blanching', 'Cooking', 'Both'],
    extraJson: { optionLabels: { Blanching: 'Blanching only', Cooking: 'Cooking only', Both: 'Blanching then cooking' } },
  }),
  col('potNumber', 'Pot number', 'text', 'Pot', { required: true }),
  col('cookingDate', 'Cooking date', 'date', 'Pot', when(COOK, { requiredWhen: COOK })),
  col('abaloneKg', 'Abalone (kg)', 'number', 'Pot', { required: true }),

  col('blanchSeaWater', '100 Lt sea water used?', 'yesno', 'Blanching', when(BLANCH)),
  col('blanchSeaWaterLitres', 'Blanch sea water (old entry, litres)', 'number', 'Blanching', { readOnly: true, extraJson: { showWhen: { nonEmpty: true }, legacy: true } }),
  col('blanchPh', 'Blanch pH', 'number', 'Blanching', when(BLANCH)),
  col('blanchSaltKg', 'Blanch salt (kg)', 'number', 'Blanching', when(BLANCH)),
  col('blanchTemp', 'Blanch temp', 'number', 'Blanching', when(BLANCH)),
  col('cookingTime', 'Cooking time', 'text', 'Blanching', when(BLANCH)),
  col('blanchBatchNumber', 'Blanch batch number', 'text', 'Blanching', when(BLANCH, { carryOnAdd: true })),

  col('startTime', 'Start time', 'time', 'Cooking', when(COOK)),
  col('startingTemp', 'Starting temp', 'number', 'Cooking', when(COOK)),
  col('temp20MinAfter', 'Temp 20 min after', 'number', 'Cooking', when(COOK)),
  col('endOfCookingTemp', 'End of cooking temp', 'number', 'Cooking', when(COOK)),
  col('timeOut', 'Time out', 'time', 'Cooking', when(COOK)),
  col('totalCookingTime', 'Total cooking time', 'text', 'Cooking', when(COOK)),
  col('cookSeaWater', '100 Lt sea water used?', 'yesno', 'Cooking', when(COOK)),
  col('cookSeaWaterLitres', 'Cook sea water (old entry, litres)', 'number', 'Cooking', { readOnly: true, extraJson: { showWhen: { nonEmpty: true }, legacy: true } }),
  col('cookPh', 'Cook pH', 'number', 'Cooking', when(COOK)),
  col('saltKg', 'Salt (kg)', 'number', 'Cooking', when(COOK)),
  col('saltBatchNumber', 'Salt batch number', 'text', 'Cooking', when(COOK, { carryOnAdd: true })),

  col('sugarKg', 'Sugar (kg)', 'number', 'Additives (optional)', when(COOK)),
  col('sugarBatchNumber', 'Sugar batch number', 'text', 'Additives (optional)', when(COOK, { carryOnAdd: true })),
  col('vinegarKg', 'Vinegar (kg)', 'number', 'Additives (optional)', when(COOK)),
  col('vinegarBatchNumber', 'Vinegar batch number', 'text', 'Additives (optional)', when(COOK, { carryOnAdd: true })),
];

const jobFields = def.fields.filter((f) => f.sectionIndex === 0);
columns.forEach((c, i) => { c.position = jobFields.length + i; });

def.sections = [
  def.sections[0],
  {
    title: 'Pots',
    kind: 'roster',
    position: 1,
    extraJson: {
      cardRows: true,
      collapseRows: false,
      rowTitle: 'Pot',
      addLabel: '+ Add pot',
      minRows: 1,
      enforceRequired: true,
      dupWarn: { column: 'potNumber', within: 'process', message: 'This pot number is already used for the same process in this entry.' },
      totals: [
        { label: 'Pots', count: true },
        { label: 'Blanching kg', sum: 'abaloneKg', where: { process: ['Blanching', 'Both'] } },
        { label: 'Cooking kg', sum: 'abaloneKg', where: { process: ['Cooking', 'Both'] } },
      ],
    },
  },
];
def.fields = [...jobFields, ...columns];
def.extraJson = { ...(def.extraJson || {}), listColumns: ['intakeDate', 'jobNo', 'roster:potNumber'] };

fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('dry-cooking now has', def.fields.length, 'fields:', jobFields.length, 'job +', columns.length, 'pot columns');
