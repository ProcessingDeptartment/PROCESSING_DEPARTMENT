// REC 7.4.0 Dry Cooking: single-pot entry -> list of pot cards (Blanching OR Cooking per card).
// Edits data/record-definitions.json in place; idempotent.
//
//   node scripts/apply-dry-cooking-pots.mjs
//   node scripts/snapshot-one-def.mjs dry-cooking     (offline snapshot) or export-record-defs.mjs
//   node scripts/seed-definitions.mjs                  (load into Neon)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-cooking');

const B = { field: 'process', in: ['Blanching'] };
const C = { field: 'process', in: ['Cooking'] };
const NONEMPTY = { nonEmpty: true };

const col = (key, label, type, o = {}) => ({
  key, label, type,
  required: !!o.required, readOnly: !!o.readOnly,
  unit: null, options: o.options || null, group: null,
  sectionIndex: 1, parentFieldKey: '@roster', position: 0,
  computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
  extraJson: { ...(o.extra || {}) },
});
const at = (layoutRow, showWhen, extra = {}) => ({ layoutRow, ...(showWhen ? { showWhen } : {}), ...extra });
const legacy = (key, label, type) => col(key, label, type, { readOnly: true, extra: at(6, NONEMPTY, { legacy: true }) });

const columns = [
  col('process', 'Process', 'text', { extra: { hidden: true } }),
  col('potNo', 'Pot no.', 'digits', { extra: { hidden: true } }),

  // row 1
  col('abaloneKg', 'Abalone weight (kg)', 'number', { required: true, extra: at(1, null, {
    carryFromPrevProcess: { process: 'Blanching', into: 'Cooking' } }) }),
  col('blanchSeaWater', '100 Lt sea water used?', 'yesno', { required: true, extra: at(1, B, { noNone: true }) }),
  col('cookSeaWater', '100 Lt sea water used?', 'yesno', { required: true, extra: at(1, C, { noNone: true }) }),
  col('blanchSaltKg', 'Salt weight (kg)', 'number', { extra: at(1, B) }),
  col('saltKg', 'Salt weight (kg)', 'number', { extra: at(1, C) }),
  col('blanchBatchNumber', 'Salt batch code', 'text', { extra: at(1, B, { carryOnAdd: true, carryGroup: 'salt' }) }),
  col('saltBatchNumber', 'Salt batch code', 'text', { extra: at(1, C, { carryOnAdd: true, carryGroup: 'salt' }) }),

  // row 2
  col('blanchStartTime', 'Start time', 'time', { extra: at(2, B) }),
  col('startTime', 'Start time', 'time', { extra: at(2, C) }),
  col('blanchStartingTemp', 'Start temp', 'number', { extra: at(2, B) }),
  col('startingTemp', 'Start temp', 'number', { extra: at(2, C) }),
  col('blanchPh', 'pH', 'number', { extra: at(2, B) }),
  col('cookPh', 'pH', 'number', { extra: at(2, C) }),

  // row 3 (Temp 20 min after is a greyed-out placeholder on Blanching cards)
  col('temp20MinAfter', 'Temp 20 min after', 'number', { extra: at(3, null, { naWhen: B }) }),
  col('blanchEndTime', 'End time', 'time', { extra: at(3, B) }),
  col('timeOut', 'End time', 'time', { extra: at(3, C) }),
  col('blanchEndTemp', 'End temp', 'number', { extra: at(3, B) }),
  col('endOfCookingTemp', 'End temp', 'number', { extra: at(3, C) }),

  // row 4: calculated total time
  col('cookingTime', 'Total time', 'text', { readOnly: true, extra: at(4, B, { deriveDuration: { from: 'blanchStartTime', to: 'blanchEndTime' } }) }),
  col('totalCookingTime', 'Total time', 'text', { readOnly: true, extra: at(4, C, { deriveDuration: { from: 'startTime', to: 'timeOut' } }) }),

  // row 5: Cooking additives (optional)
  col('sugarKg', 'Sugar (kg)', 'number', { extra: at(5, C) }),
  col('sugarBatchNumber', 'Sugar batch code', 'text', { extra: at(5, C, { carryOnAdd: true }) }),
  col('vinegarKg', 'Vinegar (kg)', 'number', { extra: at(5, C) }),
  col('vinegarBatchNumber', 'Vinegar batch code', 'text', { extra: at(5, C, { carryOnAdd: true }) }),

  // old-entry values, read-only, shown only when present
  legacy('potNumberOld', 'Pot number (old)', 'text'),
  legacy('cookingDateOld', 'Cooking date (old)', 'date'),
  legacy('blanchTempOld', 'Blanch temp (old)', 'number'),
  legacy('blanchSeaWaterLtOld', 'Sea water (Lt)', 'number'),
  legacy('cookSeaWaterLtOld', 'Sea water (Lt)', 'number'),
];

const jobFields = def.fields.filter((f) => f.sectionIndex === 0 && f.key !== 'cookingDate');
jobFields.push({
  key: 'cookingDate', label: 'Cooking date', type: 'date', required: false, readOnly: true,
  unit: null, options: null, group: null, sectionIndex: 0, parentFieldKey: null, position: 0,
  computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
  extraJson: { recordDate: true },
});
jobFields.forEach((f, i) => { f.position = i; });
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
      startEmpty: true,
      rowTitle: 'Pot',
      addLabel: '+ Add pot',
      processChoice: { column: 'process', options: ['Blanching', 'Cooking'] },
      autoNumber: 'potNo',
      minRows: 1,
      enforceRequired: true,
      totals: [
        { label: 'Pots', count: true },
        { label: 'Blanching kg', sum: 'abaloneKg', where: { process: ['Blanching'] } },
        { label: 'Cooking kg', sum: 'abaloneKg', where: { process: ['Cooking'] } },
      ],
    },
  },
];
def.fields = [...jobFields, ...columns];
def.extraJson = { ...(def.extraJson || {}), listColumns: ['intakeDate', 'jobNo', 'roster:count'] };

fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('dry-cooking:', jobFields.length, 'job fields +', columns.length, 'pot columns');
