#!/usr/bin/env node
// REC 7.4.1 Drying Process: convert the old single big records into ENTRIES of the new per-job entry log.
// Each old record becomes exactly ONE new entry (entry date = its completion date) and the old data goes
// to its new home or to a read-only *Old field. The original blob is left untouched:
//   read:   monitoring_log:drying-process  (old engine)   -- and formrecord:drying-process entries that still have old keys
//   write:  formrecord:drying-process      (new engine)   -- entries already converted (same id) are skipped
//
// Mapping (spec section 9):
//   steam1Date..steam14Date  -> one steam row per filled date, numbered 1..N in old field order, old position in steamNoOld
//   movementToDryRoom1Date / movementToContainerDate / movementToGradingRoomDate
//                            -> movedInto* = Yes + date*At stamp (midnight SAST), stampSource 'migrated_typed';
//                               no date -> left EMPTY (unknown), never No
//   wholeWeight, cookingDate, cookingWeight, removedFromTrolleysDate, dateDeString, dateGraded,
//   totalDryingTimeDays, dryWeight, estimateYield
//                            -> wholeWeightOld, cookingDateOld, cookingWeightOld, removedFromTrolleysDateOld,
//                               deStringDateOld, gradedDateOld, totalDryingDaysOld, dryWeightOld, estimateYieldPctOld
//   cookedWeight, noOfTrolleys left empty (a backfill of trolleys from REC 7.4.2 is NOT run without approval)
//   unusable dates: kept as raw text in dateRawJson, typed field left empty, listed in the output. Nothing is guessed.
//
//   node scripts/migrate-drying-process-entries.mjs                    dry run against the database (report + verification)
//   node scripts/migrate-drying-process-entries.mjs --file old.json    dry run on a JSON file (an array of old entries), no database
//   node scripts/migrate-drying-process-entries.mjs --apply            write formrecord:drying-process + re-project sub_drying_process(_row)
// Run order: dry run -> `prisma migrate deploy` -> seed-definitions -> --apply.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD_KEYS = ['monitoring_log:drying-process', 'formrecord:drying-process'];
const NEW_KEY = 'formrecord:drying-process';
const fileArg = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : null;
const apply = process.argv.includes('--apply');

const blank = (v) => v == null || String(v).trim() === '';
const OLD_MAP = {
  wholeWeight: 'wholeWeightOld', cookingDate: 'cookingDateOld', cookingWeight: 'cookingWeightOld',
  removedFromTrolleysDate: 'removedFromTrolleysDateOld', dateDeString: 'deStringDateOld', dateGraded: 'gradedDateOld',
  totalDryingTimeDays: 'totalDryingDaysOld', dryWeight: 'dryWeightOld', estimateYield: 'estimateYieldPctOld',
};
const MOVES = [
  ['movementToDryRoom1Date', 'movedIntoDryRoom', 'dateIntoDryRoomAt'],
  ['movementToContainerDate', 'movedIntoDryContainer', 'dateIntoDryContainerAt'],
  ['movementToGradingRoomDate', 'movedIntoGradingRoom', 'dateIntoGradingRoomAt'],
];
const OLD_KEYSET = new Set([...Object.keys(OLD_MAP), ...MOVES.map((m) => m[0]),
  ...Array.from({ length: 14 }, (_, i) => `steam${i + 1}Date`)]);

// 'YYYY-MM-DD' or 'DD/MM/YYYY' -> 'YYYY-MM-DD'; anything else (or an impossible date) -> null
function isoDate(raw) {
  const s = String(raw).trim();
  let y, m, d;
  let x = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (x) { y = +x[1]; m = +x[2]; d = +x[3]; }
  else if ((x = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) { d = +x[1]; m = +x[2]; y = +x[3]; }
  else return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
// midnight South African time as an ISO instant (stored as UTC by the projection)
const midnightSast = (iso) => new Date(`${iso}T00:00:00+02:00`).toISOString();
const dayOfMs = (ms) => {
  const d = new Date(new Date(ms).getTime() + 2 * 3600 * 1000); // SAST calendar day
  return d.toISOString().slice(0, 10);
};

function isOld(entry) {
  const v = entry.values || entry;
  return [...OLD_KEYSET].some((k) => !blank(v[k])) || (blank(v.entryDate) && !blank(v.jobNo) && !entry.calculatedByMigration);
}

function convert(entry, report) {
  const v = entry.values || entry;
  const nv = {};
  const raw = {};
  const notes = [];
  for (const k of ['jobNo', 'jiReceivingDate', 'jiReceivedFrom', 'jiProcessingFor', 'jiIntakeWeight']) if (!blank(v[k])) nv[k] = v[k];

  const stampMs = entry.submittedAt || entry.createdAt || null;
  if (stampMs) nv.entryDate = new Date(stampMs).toISOString();
  else notes.push('no completion/created time: entryDate left empty');

  for (const [oldK, newK] of Object.entries(OLD_MAP)) {
    if (blank(v[oldK])) continue;
    nv[newK] = String(v[oldK]);
    if (/Date$/.test(oldK) && isoDate(v[oldK]) == null) { raw[oldK] = String(v[oldK]); notes.push(`${oldK} "${v[oldK]}" not a usable date (kept as text)`); }
  }
  for (const [oldK, flagK, stampK] of MOVES) {
    if (blank(v[oldK])) continue;
    const iso = isoDate(v[oldK]);
    if (iso == null) { raw[oldK] = String(v[oldK]); notes.push(`${oldK} "${v[oldK]}" not a usable date (movement left unknown)`); continue; }
    nv[flagK] = 'Yes';
    nv[stampK] = midnightSast(iso);
    nv.stampSource = 'migrated_typed';
  }

  const steams = [];
  for (let k = 1; k <= 14; k++) {
    const rawD = v[`steam${k}Date`];
    if (blank(rawD)) continue;
    const iso = isoDate(rawD);
    if (iso == null) { raw[`steam${k}Date`] = String(rawD); notes.push(`steam${k}Date "${rawD}" not a usable date (no steam row)`); continue; }
    steams.push({ steamNo: String(steams.length + 1), steamDate: iso, steamNoOld: String(k) });
  }
  nv.steamCount = String(steams.length);
  nv.calculatedByMigration = 'Yes';
  if (Object.keys(raw).length) nv.dateRawJson = JSON.stringify(raw);

  const out = { ...entry, values: nv, roster: steams, calculatedByMigration: true };
  if (!entry.values) { for (const k of Object.keys(entry)) if (OLD_KEYSET.has(k)) delete out[k]; }
  report.push({ id: entry.id, job: v.jobNo, steams: steams.length, notes });
  return out;
}

// Every old value must be in its new home. Returns a list of problems (empty = clean).
function verify(oldEntries, newEntries) {
  const problems = [];
  const byId = new Map(newEntries.map((e) => [e.id, e]));
  for (const o of oldEntries) {
    const n = byId.get(o.id);
    if (!n) { problems.push(`entry ${o.id}: missing after conversion`); continue; }
    const ov = o.values || o, nv = n.values;
    for (const [oldK, newK] of Object.entries(OLD_MAP)) if (!blank(ov[oldK]) && nv[newK] !== String(ov[oldK])) problems.push(`entry ${o.id}: ${oldK} -> ${newK} differs`);
    const raw = nv.dateRawJson ? JSON.parse(nv.dateRawJson) : {};
    for (const [oldK, flagK, stampK] of MOVES) {
      if (blank(ov[oldK])) { if (!blank(nv[flagK])) problems.push(`entry ${o.id}: ${oldK} empty but ${flagK} set`); continue; }
      const iso = isoDate(ov[oldK]);
      if (iso == null) { if (raw[oldK] !== String(ov[oldK])) problems.push(`entry ${o.id}: unusable ${oldK} not kept as raw text`); continue; }
      if (nv[flagK] !== 'Yes' || dayOfMs(nv[stampK]) !== iso) problems.push(`entry ${o.id}: ${oldK} stamp does not equal ${iso}`);
    }
    for (let k = 1; k <= 14; k++) {
      const d = ov[`steam${k}Date`];
      if (blank(d)) continue;
      const iso = isoDate(d);
      const row = (n.roster || []).find((r) => r.steamNoOld === String(k));
      if (iso == null) { if (raw[`steam${k}Date`] !== String(d) || row) problems.push(`entry ${o.id}: unusable steam${k}Date handled wrongly`); }
      else if (!row || row.steamDate !== iso) problems.push(`entry ${o.id}: steam${k}Date -> steam row differs`);
    }
    const nSteams = Array.from({ length: 14 }, (_, i) => ov[`steam${i + 1}Date`]).filter((d) => !blank(d) && isoDate(d) != null).length;
    if ((n.roster || []).length !== nSteams) problems.push(`entry ${o.id}: steam row count ${(n.roster || []).length} != ${nSteams}`);
    if (!blank(nv.cookedWeight) || !blank(nv.noOfTrolleys)) problems.push(`entry ${o.id}: cookedWeight/noOfTrolleys must stay empty on migrated entries`);
  }
  return problems;
}

async function main() {
  let prisma = null;
  let oldEntries = [], srcKey = null, targetEntries = [], targetRow = null;
  if (fileArg) {
    oldEntries = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
    srcKey = fileArg;
  } else {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    for (const k of OLD_KEYS) {
      const row = await prisma.keyValue.findUnique({ where: { key: k } });
      if (!row) continue;
      if (k === NEW_KEY) targetRow = row;
      let arr; try { arr = JSON.parse(row.value); } catch { continue; }
      if (!Array.isArray(arr)) continue;
      const old = arr.filter((e) => e && e.id && isOld(e));
      if (k === NEW_KEY) targetEntries = arr;
      if (old.length && k !== NEW_KEY) { oldEntries = oldEntries.concat(old); srcKey = k; }
    }
    if (!targetRow) targetRow = await prisma.keyValue.findUnique({ where: { key: NEW_KEY } });
    if (targetRow && !targetEntries.length) { try { targetEntries = JSON.parse(targetRow.value); } catch { targetEntries = []; } }
  }
  if (!oldEntries.length) { console.log('No old REC 7.4.1 entries found - nothing to migrate.'); if (prisma) await prisma.$disconnect(); return; }

  const done = new Set(targetEntries.map((e) => e && e.id));
  const todo = oldEntries.filter((e) => !done.has(e.id));
  const report = [];
  const converted = todo.map((e) => convert(e, report));
  console.log(`${oldEntries.length} old entries from ${srcKey}; ${todo.length} to convert (${oldEntries.length - todo.length} already converted)`);
  let unusable = 0;
  for (const r of report) {
    console.log(`  entry ${r.id} job ${r.job || '(none)'}: 1 entry, ${r.steams} steam row(s)` + (r.notes.length ? '\n     ! ' + r.notes.join('\n     ! ') : ''));
    unusable += r.notes.length;
  }
  const problems = verify(todo, converted);
  console.log(`before/after: ${todo.length} old records -> ${converted.length} entries, ${converted.reduce((a, e) => a + e.roster.length, 0)} steam rows; ` +
    `${unusable} unusable/unknown date note(s); verification: ${problems.length ? problems.length + ' PROBLEM(S)' : 'every old value found in its new home'}`);
  problems.forEach((p) => console.log('  PROBLEM', p));
  if (problems.length) { console.error('Verification failed - aborting.'); process.exit(1); }
  if (!apply) { console.log('Dry run only.'); if (prisma) await prisma.$disconnect(); return; }
  if (fileArg) { console.error('--apply needs the database (drop --file).'); process.exit(1); }

  const dir = path.join(ROOT, 'data', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(dir, `drying-process.before-entries.${stamp}.json`), JSON.stringify({ source: srcKey, oldEntries, previousTarget: targetRow ? targetRow.value : null }));
  const value = JSON.stringify([...targetEntries, ...converted]);
  const { syncSubmissionRows } = require('../src/submission-store');
  await prisma.$transaction(async (tx) => {
    await tx.keyValue.upsert({ where: { key: NEW_KEY }, create: { key: NEW_KEY, value }, update: { value } });
    await tx.keyValueHistory.create({ data: { key: NEW_KEY, action: 'set', before: targetRow ? targetRow.value : null, after: value, actor: 'migrate-drying-process-entries', role: 'script' } });
  });
  await syncSubmissionRows(prisma, NEW_KEY, value);
  console.log(await prisma.$queryRawUnsafe('SELECT (SELECT count(*)::int FROM "sub_drying_process") AS entries, (SELECT count(*)::int FROM "sub_drying_process_row") AS steams'));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
