// REC 7.4.0 Dry Cooking: pot cards -> pot SLIDES (spec: MD_PROJECT_ONLY/rec-7.4.0-pot-slides-blanching-stage-instructions.md).
//   - roster option `slides: true` (engine form-record.js >= v71): one slide at a time, numbered chip bar, Next button
//   - Blanching slide: 5 fields only (sea water, temperature C, time, salt kg, salt batch). No pot number, no abalone kg.
//   - Cooking slide: all fields required; Salt / Sugar / Vinegar become optional additions (tick + pop-up)
//   - old blanching fields stay as legacy columns (shown only when an old entry holds a value)
//   - weight rules: R1 stays; R2/R3 are removed from business-rules.json by this script; "available to cook" = OOSW - cooked
// Edits data/record-definitions.json in place; idempotent.
//
//   node scripts/apply-dry-cooking-slides.mjs
//   node scripts/snapshot-one-def.mjs dry-cooking     (offline snapshot) or export-record-defs.mjs
//   prisma migrate deploy  ->  node scripts/seed-definitions.mjs   (new columns must exist before the definition is seeded)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const RULES = path.join(ROOT, 'public', 'data', 'business-rules.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-cooking');

const B = { field: 'process', in: ['Blanching'] };
const C = { field: 'process', in: ['Cooking'] };
const NONEMPTY = { nonEmpty: true };
const KG = 'kg';
const DEGC = '°C';

const col = (key, label, type, o = {}) => ({
  key, label, type,
  required: !!o.required, readOnly: !!o.readOnly,
  unit: o.unit || null, options: null, group: null,
  sectionIndex: 1, parentFieldKey: '@roster', position: 0,
  computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
  extraJson: { ...(o.extra || {}) },
});
const legacy = (key, label, type, layoutRow, extra = {}) =>
  col(key, label, type, { readOnly: true, extra: { layoutRow, showWhen: NONEMPTY, legacy: true, ...extra } });
const addition = (add, role, label, type, extra = {}) =>
  col(add + (role === 'kg' ? 'Kg' : 'BatchNumber'), label, type, {
    unit: role === 'kg' ? KG : null,
    extra: { addition: add, additionRole: role, showWhen: C, ...extra },
  });

const columns = [
  col('process', 'Process', 'text', { extra: { hidden: true } }),
  col('potNo', 'Pot no.', 'digits', { extra: { hidden: true } }),
  col('legacyNoBlanching', 'Legacy (no blanching recorded)', 'text', { extra: { hidden: true } }),

  // ---- Blanching slide (new entries): exactly these five, in this order -------------------------------------------
  col('blanchSeaWater', '100 Lt sea water used?', 'yesno', { required: true, extra: { layoutRow: 1, showWhen: B, noNone: true } }),
  col('blanchTempC', 'Temperature (°C)', 'number', { required: true, unit: DEGC, extra: { layoutRow: 1, showWhen: B } }),
  col('blanchTime', 'Time', 'time', { required: true, extra: { layoutRow: 1, showWhen: B, nowButton: true } }),
  col('blanchSaltKg', 'Salt weight (kg)', 'number', { required: true, unit: KG, extra: { layoutRow: 2, showWhen: B } }),
  col('blanchBatchNumber', 'Salt batch code', 'text', { required: true, extra: { layoutRow: 2, showWhen: B, carryOnAdd: true, carryGroup: 'salt' } }),

  // ---- Cooking slide ------------------------------------------------------------------------------------------------
  // abaloneKg is also shown on OLD blanching cards that hold a value (orNonEmpty); never asked on a new blanching slide.
  col('abaloneKg', 'Abalone weight (kg)', 'number', { required: true, unit: KG, extra: { layoutRow: 1, showWhen: { ...C, orNonEmpty: true } } }),
  col('cookSeaWater', '100 Lt sea water used?', 'yesno', { required: true, extra: { layoutRow: 1, showWhen: C, noNone: true } }),
  col('startTime', 'Start time', 'time', { required: true, extra: { layoutRow: 2, showWhen: C } }),
  col('startingTemp', 'Start temp (°C)', 'number', { required: true, unit: DEGC, extra: { layoutRow: 2, showWhen: C } }),
  col('cookPh', 'pH', 'number', { required: true, extra: { layoutRow: 2, showWhen: C } }),
  col('temp20MinAfter', 'Temp 20 min after (°C)', 'number', { required: true, unit: DEGC, extra: { layoutRow: 3, showWhen: C } }),
  col('timeOut', 'End time', 'time', { required: true, extra: { layoutRow: 3, showWhen: C } }),
  col('endOfCookingTemp', 'End temp (°C)', 'number', { required: true, unit: DEGC, extra: { layoutRow: 3, showWhen: C } }),
  col('totalCookingTime', 'Total time (hh:mm)', 'text', { readOnly: true, extra: { layoutRow: 4, showWhen: C, deriveDuration: { from: 'startTime', to: 'timeOut' } } }),

  // ---- Optional additions (Cooking only): tick -> pop-up for weight + batch code ------------------------------------
  addition('salt', 'kg', 'Salt weight (kg)', 'number'),
  addition('salt', 'batch', 'Salt batch code', 'text', { carryOnAdd: true, carryGroup: 'salt' }),
  addition('sugar', 'kg', 'Sugar weight (kg)', 'number'),
  addition('sugar', 'batch', 'Sugar batch code', 'text', { carryOnAdd: true, carryGroup: 'sugar' }),
  addition('vinegar', 'kg', 'Vinegar weight (kg)', 'number'),
  addition('vinegar', 'batch', 'Vinegar batch code', 'text', { carryOnAdd: true, carryGroup: 'vinegar' }),

  // ---- Old blanching fields: kept for history, shown read-only only when an old entry holds a value ----------------
  legacy('blanchStartTime', 'Start time (old)', 'time', 6),
  legacy('blanchStartingTemp', 'Start temp (old)', 'number', 6),
  legacy('blanchPh', 'pH (old)', 'number', 6),
  legacy('blanchEndTime', 'End time (old)', 'time', 7),
  legacy('blanchEndTemp', 'End temp (old)', 'number', 7),
  legacy('cookingTime', 'Total time (old)', 'text', 7),
  legacy('potNoOld', 'Pot number (previous numbering)', 'digits', 8),
  legacy('potNumberOld', 'Pot number (old)', 'text', 8),
  legacy('cookingDateOld', 'Cooking date (old)', 'date', 8),
  legacy('blanchTempOld', 'Blanch temp (old)', 'number', 8),
  legacy('blanchSeaWaterLtOld', 'Sea water (Lt)', 'number', 8),
  legacy('cookSeaWaterLtOld', 'Sea water (Lt)', 'number', 8),
];

// Keep the existing field entry (position bookkeeping) but take the new attributes.
const roster = def.sections.find((s) => s.kind === 'roster');
const sorted = [...def.fields].sort((a, b) => a.position - b.position);
const firstRoster = sorted.findIndex((f) => f.parentFieldKey === '@roster');
const others = sorted.filter((f) => f.parentFieldKey !== '@roster');
const before = sorted.slice(0, firstRoster).filter((f) => f.parentFieldKey !== '@roster');
const after = others.slice(before.length);
columns.forEach((c) => { c.sectionIndex = roster.position; });
def.fields = [...before, ...columns, ...after].map((f, i) => ({ ...f, position: i }));

roster.extraJson = {
  ...roster.extraJson,
  slides: true,
  rowTitle: 'Pot',
  minProcess: { Cooking: 1 },
  totals: [
    { label: 'Pots', count: true, where: { process: ['Cooking'] } },
    { label: 'Cooking kg', sum: 'abaloneKg', where: { process: ['Cooking'] } },
  ],
  jobWeights: { ...roster.extraJson.jobWeights, cookFromOosw: true },
};
delete roster.extraJson.addLabel;

fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');

// R2 (blanching vs OOSW) and R3 (cooking vs blanching) are gone; R1 stays. Idempotent.
const rules = JSON.parse(fs.readFileSync(RULES, 'utf8'));
const kept = rules.filter((r) => !(r.recordKey === 'dry-cooking' && (r.id === 'R2' || r.id === 'R3')));
if (kept.length !== rules.length) fs.writeFileSync(RULES, JSON.stringify(kept, null, 2) + '\n');
console.log(`dry-cooking: ${columns.length} roster columns, slides on; business rules ${rules.length} -> ${kept.length}`);
