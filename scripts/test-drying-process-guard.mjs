// Tests for src/drying-process-guard.js (REC 7.4.1 server rules). No database.
//   node scripts/test-drying-process-guard.mjs
import { createRequire } from 'module';
import assert from 'assert';
const { guardWrite, reverseMovement } = createRequire(import.meta.url)('../src/drying-process-guard.js');

let n = 0, failed = 0;
const t = (name, fn) => { n++; try { fn(); console.log('  ok  ', name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', e.message); } };
const entry = (id, status, values, roster) => ({ id, status, values: { jobNo: 'DPR0001', ...values }, roster: roster || [] });
const send = (prev, inc, now) => guardWrite(prev ? JSON.stringify(prev) : null, JSON.stringify(inc), now);
const D1 = new Date('2026-09-10T06:00:00Z'), D2 = new Date('2026-09-11T06:30:00Z'), D3 = new Date('2026-09-12T07:00:00Z');
const parse = (r) => JSON.parse(r.value);

t('submit stamps entry date and a Yes movement from the server clock, ignoring client values', () => {
  const r = send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes', dateIntoDryRoomAt: '2020-01-01T00:00:00Z', entryDate: '2020-01-01' })], D1);
  assert(r.ok); const v = parse(r)[0].values;
  assert.strictEqual(v.dateIntoDryRoomAt, D1.toISOString()); assert.strictEqual(v.entryDate, D1.toISOString());
  assert.strictEqual(v.stampSource, 'system'); assert.strictEqual(v.dateIntoDryContainerAt, '');
});
t('a draft carries no stamp', () => {
  const r = send(null, [entry('e1', 'draft', { movedIntoDryRoom: 'Yes', dateIntoDryRoomAt: '2020-01-01T00:00:00Z' })], D1);
  assert.strictEqual(parse(r)[0].values.dateIntoDryRoomAt, ''); assert.strictEqual(parse(r)[0].values.movedIntoDryRoom, 'Yes');
});
t('a draft kept for days is stamped on the day it is submitted', () => {
  const draft = [entry('e1', 'draft', { movedIntoDryRoom: 'Yes' })];
  const saved = parse(send(null, draft, D1));
  const sub = saved.map((e) => ({ ...e, status: 'submitted' }));
  assert.strictEqual(parse(send(saved, sub, D3))[0].values.dateIntoDryRoomAt, D3.toISOString());
});
t('a submitted entry is locked: stamps, answers and entry date cannot be edited or re-dated', () => {
  const s1 = parse(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes' })], D1));
  const tamper = JSON.parse(JSON.stringify(s1)); tamper[0].values.dateIntoDryRoomAt = '2026-01-01T00:00:00Z'; tamper[0].values.movedIntoDryRoom = 'No'; tamper[0].values.entryDate = '2026-01-01T00:00:00Z';
  const v = parse(send(s1, tamper, D2))[0].values;
  assert.strictEqual(v.movedIntoDryRoom, 'Yes'); assert.strictEqual(v.dateIntoDryRoomAt, D1.toISOString()); assert.strictEqual(v.entryDate, D1.toISOString());
});
t('a submitted No is locked and cannot be turned into a back-dated Yes', () => {
  const s1 = parse(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'No' })], D1));
  const tamper = JSON.parse(JSON.stringify(s1)); tamper[0].values.movedIntoDryRoom = 'Yes'; tamper[0].values.dateIntoDryRoomAt = '2026-09-01T00:00:00Z';
  const v = parse(send(s1, tamper, D2))[0].values;
  assert.strictEqual(v.movedIntoDryRoom, 'No'); assert.strictEqual(v.dateIntoDryRoomAt, '');
});
t('N -> Y in a new entry is stamped with that day', () => {
  const s1 = parse(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'No' })], D1));
  const s2 = parse(send(s1, [...s1, entry('e2', 'submitted', { movedIntoDryRoom: 'Yes' })], D2));
  assert.strictEqual(s2[1].values.dateIntoDryRoomAt, D2.toISOString());
});
t('a second Yes for the same movement on a job is refused', () => {
  const s1 = parse(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes' })], D1));
  const r = send(s1, [...s1, entry('e2', 'submitted', { movedIntoDryRoom: 'Yes' })], D2);
  assert(!r.ok && r.status === 409, JSON.stringify(r));
});
t('the same movement on a different job is fine', () => {
  const s1 = parse(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes' })], D1));
  assert(send(s1, [...s1, entry('e2', 'submitted', { jobNo: 'DPR0002', movedIntoDryRoom: 'Yes' })], D2).ok);
});
t('container / grading room need the earlier movement Done or Yes in the same entry', () => {
  assert(!send(null, [entry('e1', 'submitted', { movedIntoDryContainer: 'Yes' })], D1).ok);
  assert(!send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes', movedIntoGradingRoom: 'Yes' })], D1).ok);
  assert(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes', movedIntoDryContainer: 'Yes' })], D1).ok);
});
t('a stale device that drops a submitted entry does not delete it', () => {
  const s1 = parse(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes' })], D1));
  const r = parse(send(s1, [entry('e9', 'draft', {})], D2));
  assert(r.some((e) => e.id === 'e1' && e.values.movedIntoDryRoom === 'Yes') && r.some((e) => e.id === 'e9'));
});
t('steam numbers continue per job across entries; steamCount is set', () => {
  const s1 = parse(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes' }, [{ steamNo: '1', steamDate: '2026-09-10' }, { steamNo: '9', steamDate: '2026-09-10' }])], D1));
  assert.deepStrictEqual(s1[0].roster.map((r) => r.steamNo), ['1', '2']);
  const s2 = parse(send(s1, [...s1, entry('e2', 'submitted', {}, [{ steamDate: '2026-09-11' }]), entry('e3', 'submitted', { jobNo: 'DPR0002' }, [{ steamDate: '2026-09-11' }])], D2));
  assert.strictEqual(s2[1].roster[0].steamNo, '3'); assert.strictEqual(s2[1].values.steamCount, '1'); assert.strictEqual(s2[2].roster[0].steamNo, '1');
});
t('a steam dated before the stamped dry-room date, or in the future, is refused naming both dates', () => {
  const s1 = parse(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes' })], D1));
  const early = send(s1, [...s1, entry('e2', 'submitted', {}, [{ steamDate: '2026-09-09' }])], D2);
  assert(!early.ok && /09\/09\/2026/.test(early.error) && /10\/09\/2026/.test(early.error), early.error);
  const late = send(s1, [...s1, entry('e2', 'submitted', {}, [{ steamDate: '2026-09-20' }])], D2);
  assert(!late.ok && /future/.test(late.error), late.error);
  assert(send(s1, [...s1, entry('e2', 'submitted', {}, [{ steamDate: '2026-09-11' }])], D2).ok);
});
t('a migrated (typed, midnight SAST) dry-room stamp is honoured for steam dates', () => {
  const mig = [{ ...entry('m1', 'submitted', { movedIntoDryRoom: 'Yes', dateIntoDryRoomAt: '2026-09-02T00:00:00+02:00' }), calculatedByMigration: true }];
  assert(!send(mig, [...mig, entry('e2', 'submitted', {}, [{ steamDate: '2026-09-01' }])], D2).ok);
  assert(send(mig, [...mig, entry('e2', 'submitted', {}, [{ steamDate: '2026-09-02' }])], D2).ok);
});
t('admin reversal puts the movement back to an open question, needs reason and name, and respects order', () => {
  const s1 = parse(send(null, [entry('e1', 'submitted', { movedIntoDryRoom: 'Yes', movedIntoDryContainer: 'Yes' })], D1));
  assert(!reverseMovement(JSON.stringify(s1), { jobNo: 'DPR0001', movement: 'dryRoom', reason: 'x', name: 'M' }).ok, 'container blocks dry-room reversal');
  assert(!reverseMovement(JSON.stringify(s1), { jobNo: 'DPR0001', movement: 'dryContainer', reason: '', name: 'M' }).ok);
  const r = reverseMovement(JSON.stringify(s1), { jobNo: 'DPR0001', movement: 'dryContainer', reason: 'tapped by mistake', name: 'Michaela' });
  assert(r.ok); const v = JSON.parse(r.value)[0].values;
  assert.strictEqual(v.movedIntoDryContainer, ''); assert.strictEqual(v.dateIntoDryContainerAt, ''); assert.strictEqual(r.audit.oldStamp, D1.toISOString());
  // and afterwards it can be answered again, in a new entry
  const s2 = parse(send(JSON.parse(r.value), [...JSON.parse(r.value), entry('e2', 'submitted', { movedIntoDryContainer: 'Yes' })], D2));
  assert.strictEqual(s2[1].values.dateIntoDryContainerAt, D2.toISOString());
});
console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
