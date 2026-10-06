// NC from records (2026-10-06): out-of-spec thresholds that prompt an NC at submit (public/lib/nc-raise.js).
// Writes `ncThresholds` (and `ncAlways`) into extraJson of data/record-definitions.json AND straight into the static
// snapshots public/data/record-defs/<key>.json, so no DB access is needed to ship it. Re-seed Neon afterwards so the
// DB agrees (otherwise the next export-record-defs run drops it).
//   node scripts/apply-nc-thresholds.mjs
// Field keys are the REAL entry-field keys (not the names in the brief). Ranges mirror each record's specFields.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = (field, label, min, max, category, severity, unit = '°C') => ({
  field, label, min, max, category, severity,
  description: `${label} {value}${unit} — outside accepted range ${min != null && max != null ? `${min}–${max}` : max != null ? `max ${max}` : `min ${min}`}${unit}.`,
});
const PLAN = {
  'chiller-temperature-monitoring': { ncThresholds: [
    T('chiller1ProductTemp', 'Chiller 1 product temperature', 0, 10, 'Temperature out of spec', 'major'),
    T('chiller2ProductTemp', 'Chiller 2 product temperature', 0, 10, 'Temperature out of spec', 'major')] },
  'incubator-temperature-check': { ncThresholds: [
    T('startShiftTemp', 'Incubator start-of-shift temperature', 36.1, 37.8, 'Temperature out of spec', 'major'),
    T('lunchTemp', 'Incubator lunch temperature', 36.1, 37.8, 'Temperature out of spec', 'major'),
    T('endShiftTemp', 'Incubator end-of-shift temperature', 36.1, 37.8, 'Temperature out of spec', 'major')] },
  // REC 7.9.3.2 Grading Room is merged into this record (Room = Dry Room / Grading Room)
  'dry-room-temp-humidity-log': { ncThresholds: [T('temperature', 'Room temperature', 25, 32, 'Dry room issue', 'major')] },
  'lha-water-monitoring': { ncThresholds: [T('temperature', 'LHA chiller temperature', 12, 18, 'Temperature out of spec', 'major')] },
  'ph-verification': { ncThresholds: [
    T('buffer4Reading', 'pH buffer 4.01 reading', 3.9, 4.1, 'Process deviation', 'minor', ''),
    T('buffer7Reading', 'pH buffer 7.01 reading', 6.9, 7.1, 'Process deviation', 'minor', ''),
    T('buffer10Reading', 'pH buffer 10.01 reading', 9.9, 10.1, 'Process deviation', 'minor', '')] },
  'thermometer-verification': { ncThresholds: [
    T('coldDeviation', 'Cold reference vs test deviation', -0.5, 0.5, 'Equipment failure', 'minor'),
    T('hotDeviation', 'Hot reference vs test deviation', -0.5, 0.5, 'Equipment failure', 'minor')] },
  // every pest sighting is an NC: prompted on every submit, cannot be skipped
  'internal-pest-sightings-log': { ncAlways: true },
};
const FILE = path.join(ROOT, 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
for (const [key, extra] of Object.entries(PLAN)) {
  const def = doc.definitions.find((d) => d.recordKey === key);
  if (!def) { console.warn('no definition for', key); continue; }
  def.extraJson = { ...(def.extraJson || {}), ...extra };
  const snap = path.join(ROOT, 'public', 'data', 'record-defs', encodeURIComponent(key) + '.json');
  if (fs.existsSync(snap)) fs.writeFileSync(snap, JSON.stringify({ ...JSON.parse(fs.readFileSync(snap, 'utf8')), ...extra }));
  else console.warn('no snapshot for', key);
  console.log('ok', key);
}
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2));
