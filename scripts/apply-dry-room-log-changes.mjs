// REC 7.9.3.1 Dry Room Temp & Humidity Log: one reading per entry (2026-10-02).
//   - Week, Shift, Date, Checked by removed; the six shift readings collapse to one Temperature + one Humidity
//   - Entry date + Entry time: read-only, stamped by the system on every entry
//   - Room: dropdown of the three areas (same list as REC 7.4.1 / 7.4.2)
//   - REC 7.9.3.2 Grading Room merged in (Room = location); entry stamp hidden (CSV export only)
//   - Previous 10 logs shown beside the form; out-of-range reading pops a warning (thresholds stay on the spec page)
//   - Nothing is deleted: old values stay in the entry and show labelled "(old)" via legacyFrom
//   node scripts/apply-dry-room-log-changes.mjs     then   node scripts/export-record-defs.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'record-definitions.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const def = doc.definitions.find((d) => d.recordKey === 'dry-room-temp-humidity-log');
// Room = the location. Same names the two old records already carried as their Room default. Edit this list (and
// the field options) to add a location; no code change.
const AREAS = ['Dry Room', 'Grading Room'];
const fld = (key, label, type, o = {}) => ({
  key, label, type, required: !!o.required, readOnly: !!o.readOnly, unit: o.unit || null, options: o.options || null,
  group: null, sectionIndex: null, parentFieldKey: null, position: 0, computeFn: null, computeArgs: null,
  recordPickSource: null, linkField: null, linkRelation: null, validateJson: null, ...(o.extra ? { extraJson: o.extra } : {}),
});
const legacy = (k, l, t, from, unit) => fld(k, l, t, { readOnly: true, unit, extra: { legacy: true, legacyFrom: from, showWhen: { nonEmpty: true } } });
def.fields = [
  // automatic stamp: stored on every log line, hidden on screen/print/list, included in the CSV export only
  fld('entryDate', 'Entry date', 'date', { readOnly: true, extra: { serverStamp: true, timeZone: 'Africa/Johannesburg', hidden: true, exportCsv: true } }),
  fld('entryTime', 'Entry time', 'timestamp', { readOnly: true, extra: { hidden: true, exportCsv: true } }),
  fld('room', 'Room', 'select', { required: true, options: AREAS }),
  fld('temperature', 'Temperature', 'number', { required: true, unit: '°C', extra: { specKey: 'roomTemp' } }),
  fld('humidity', 'Humidity', 'number', { required: true, unit: '% rH', extra: { specKey: 'roomHumidity' } }),
  fld('correctiveAction', 'Corrective action', 'textarea'),
  legacy('weekOld', 'Week (old)', 'text', 'week'),
  legacy('shiftOld', 'Shift (old)', 'text', 'shift'),
  legacy('dateOld', 'Date (old)', 'date', 'date'),
  legacy('checkedByOld', 'Checked by (old)', 'text', 'checkedBy'),
  legacy('startShiftTempOld', 'Start shift, temp (old)', 'number', 'startShiftTemp', '°C'),
  legacy('startShiftHumidityOld', 'Start shift, humidity (old)', 'number', 'startShiftHumidity', '% rH'),
  legacy('duringProdTempOld', 'During production, temp (old)', 'number', 'duringProdTemp', '°C'),
  legacy('duringProdHumidityOld', 'During production, humidity (old)', 'number', 'duringProdHumidity', '% rH'),
  legacy('endShiftTempOld', 'End shift, temp (old)', 'number', 'endShiftTemp', '°C'),
  legacy('endShiftHumidityOld', 'End shift, humidity (old)', 'number', 'endShiftHumidity', '% rH'),
];
def.fields.forEach((f, i) => { f.position = i; });
def.title = 'Room Temp/Humidity Log';
def.extraJson = {
  ...(def.extraJson || {}), recentEntries: 10, warnOutOfSpec: true, roomAreas: AREAS,
  instructions: [{ label: 'Check', text: 'Check temperature and relative humidity on the dial inside the room selected. Temperature should be 25 to 32 degrees C; any deviation must be reported.' }],
  mergedFrom: ['grading-room-temp-humidity-log'],
};
// REC 7.9.3.2 is retired: definition and old table stay, marked merged
const old = doc.definitions.find((d) => d.recordKey === 'grading-room-temp-humidity-log');
old.extraJson = { ...(old.extraJson || {}), retired: true, mergedInto: 'dry-room-temp-humidity-log', mergedNote: 'Merged into REC 7.9.3.1' };
if (typeof def.version === 'number') def.version += 1;
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log('dry-room-temp-humidity-log:', def.fields.length, 'fields; version', def.version ?? '(n/a)');
