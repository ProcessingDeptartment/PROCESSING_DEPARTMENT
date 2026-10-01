// REC 7.4.2 Dry Monitoring: Entry date and Dry room area come from REC 7.4.1 (2026-10-01).
//   - Entry date: read-only, pulled from the job's first submitted REC 7.4.1 entry (server-stamped at submit only if there is none)
//   - Dry room area: pre-filled from the job's current REC 7.4.1 room movement, still editable, and a new
//     "Confirm location" tick (dryRoomAreaConfirmed, required) must be ticked on 7.4.2. dryRoomAreaSourceId keeps the 7.4.1 entry it came from.
// Idempotent.
//   node scripts/apply-dry-monitoring-pull-from-741.mjs
//   node scripts/snapshot-one-def.mjs dry-monitoring
//   node scripts/seed-definitions-only.mjs dry-monitoring     (Neon)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-monitoring');
const byKey = Object.fromEntries(def.fields.map((f) => [f.key, f]));

const base = (key, label, type, o = {}) => ({
  key, label, type, required: !!o.required, readOnly: false, unit: null, options: null, group: 'Dry room details',
  sectionIndex: null, parentFieldKey: null, position: 0,
  computeFn: null, computeArgs: null, recordPickSource: null, linkField: null, linkRelation: null, validateJson: null,
  extraJson: o.extra || {},
});

byKey.entryDate.extraJson = { ...byKey.entryDate.extraJson, fromRecord: {
  source: 'drying-entry-date', note: 'From REC 7.4.1',
  missing: 'No submitted REC 7.4.1 entry for this job yet. Today\'s date is used when you submit.' } };
byKey.dryRoomArea.extraJson = { ...byKey.dryRoomArea.extraJson, fromRecord: {
  source: 'drying-location', prefill: true, confirmField: 'dryRoomAreaConfirmed', idsField: 'dryRoomAreaSourceId',
  note: 'From REC 7.4.1. Tick Confirm location below.',
  missing: 'REC 7.4.1 has no room movement for this job yet. Choose the area, then tick Confirm location.' } };

if (!byKey.dryRoomAreaConfirmed) def.fields.push(base('dryRoomAreaConfirmed', 'Confirm location', 'yesno',
  { required: true, extra: { tick: true, tickText: 'The dry room area above is correct' } }));
if (!byKey.dryRoomAreaSourceId) def.fields.push(base('dryRoomAreaSourceId', 'Dry room area source entry', 'text',
  { extra: { hidden: true } }));
Object.assign(byKey, Object.fromEntries(def.fields.map((f) => [f.key, f])));
// dryRoomAreaConfirmed straight after dryRoomArea; the source id with the other hidden bookkeeping fields
const order = def.fields.filter((f) => !['dryRoomAreaConfirmed', 'dryRoomAreaSourceId'].includes(f.key));
order.splice(order.findIndex((f) => f.key === 'dryRoomArea') + 1, 0, byKey.dryRoomAreaConfirmed);
order.splice(order.findIndex((f) => f.key === 'trolleysTypedManually') + 1, 0, byKey.dryRoomAreaSourceId);
order.forEach((f, i) => { f.position = i; });
def.fields = order;
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('ok,', order.length, 'fields');
