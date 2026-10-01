// REC 7.4.5 tests, no database and no browser. Run: node scripts/test-box-inspection.mjs
//  - client rules (public/lib/box-inspection.js): started rows, nett match, comment rule, warn-then-allow
//  - server (src/box-inspection.js): awaiting list, submit applies inspection to the SAME closed_box row,
//    packing date stamped by the server in SA time and never changed, drafts write nothing
import { createRequire } from 'module';
import assert from 'assert';
const require = createRequire(import.meta.url);
globalThis.window = {};
const BI = require('../public/lib/box-inspection.js');
const { awaitingBoxes, syncBoxInspections, sastDate } = require('../src/box-inspection.js');
const { syncStockLinks } = require('../src/stock-link.js');
const { syncClosedBoxes } = require('../src/closed-box.js');

const ticks = (v) => Object.fromEntries(BI.CHECKS.map((k) => [k, v]));
const row = (code, over = {}) => ({ boxCode: code, nettKg743: '10.00', ...over });

// ---------- client ----------
{
  // untouched row is outstanding, not started
  const e = BI.evaluate([row('A-1'), row('A-2', { tareKg: '1', nettKg: '10', ...ticks('Yes') })]);
  assert.deepStrictEqual(e.outstanding, ['A-1']);
  assert.strictEqual(e.started.length, 1);
  assert.strictEqual(e.problem, null);
}
{
  // all ticked, valid -> no problem; a started row needs tare and nett
  assert.match(BI.evaluate([row('A-1', { nettKg: '10', ...ticks('Yes') })]).problem, /tare weight is required/);
  assert.match(BI.evaluate([row('A-1', { tareKg: '1', ...ticks('Yes') })]).problem, /nett weight is required/);
}
{
  // nett must equal the 7.4.3 value
  const p = BI.evaluate([row('A-1', { tareKg: '1', nettKg: '10.01', ...ticks('Yes') })]).problem;
  assert.match(p, /does not match 7\.4\.3 \(7\.4\.3: 10\.00 kg\)/);
  assert.strictEqual(BI.evaluate([row('A-1', { tareKg: '1', nettKg: '10.00', ...ticks('Yes') })]).problem, null);
}
{
  // an unticked check needs a comment; with one it is allowed
  const base = { tareKg: '1', nettKg: '10', ...ticks('Yes'), frillsPresent: '' };
  assert.match(BI.evaluate([row('A-1', base)]).problem, /comment is required.*Frills present/);
  assert.strictEqual(BI.evaluate([row('A-1', { ...base, comment: 'frills trimmed' })]).problem, null);
}
{
  // beforeSave: draft drops untouched rows in place and never blocks; submit warns then allows
  const toasts = [];
  const rows = [row('A-1'), row('A-2', { tareKg: '1' })];            // A-2 started but incomplete
  assert.strictEqual(await BI.beforeSave({ finalize: false, values: {}, rows, toast: (m) => toasts.push(m) }), true);
  assert.deepStrictEqual(rows.map((r) => r.boxCode), ['A-2'], 'draft keeps only started rows');

  const sub = [row('B-1'), row('B-2', { tareKg: '1', nettKg: '10', ...ticks('Yes') })];
  const vals = {};
  globalThis.window.confirm = () => false;                            // Go back
  assert.strictEqual(await BI.beforeSave({ finalize: true, values: vals, rows: sub, toast: () => {} }), false);
  assert.strictEqual(sub.length, 2, 'Go back changes nothing');
  globalThis.window.confirm = () => true;                             // Submit anyway
  assert.strictEqual(await BI.beforeSave({ finalize: true, values: vals, rows: sub, toast: () => {} }), true);
  assert.deepStrictEqual(sub.map((r) => r.boxCode), ['B-2'], 'untouched box is not saved');
  assert.match(vals.outstandingNote, /Submitted with 1 boxes outstanding: B-1/);
}

// ---------- server (same in-memory Prisma stand-in as test-recall-boxes) ----------
function fakePrisma() {
  const stock = [], boxes = [], kv = new Map();
  let id = 1;
  const match = (r, w = {}) => Object.entries(w).every(([k, v]) => (v && typeof v === 'object' && 'in' in v ? v.in.includes(r[k]) : r[k] === v));
  const table = (rows, d = () => ({})) => ({
    findMany: async ({ where } = {}) => rows.filter((r) => match(r, where)).map((r) => ({ ...r })),
    findUnique: async ({ where }) => { const r = rows.find((x) => match(x, where)); return r ? { ...r } : null; },
    create: async ({ data }) => { rows.push({ id: id++, ...d(), ...data }); },
    createMany: async ({ data }) => { data.forEach((x) => rows.push({ id: id++, ...d(), ...x })); },
    update: async ({ where, data }) => { Object.assign(rows.find((x) => match(x, where)), data); },
    delete: async ({ where }) => { rows.splice(rows.findIndex((x) => match(x, where)), 1); },
    deleteMany: async ({ where }) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1); },
  });
  return {
    stockLink: table(stock),
    closedBox: table(boxes, () => ({ closedAt: new Date(), changedAfterInspection: false, inspectionSubmissionId: null, approved: null, packingDate: null, packedAt: null })),
    keyValue: { findUnique: async ({ where }) => (kv.has(where.key) ? { key: where.key, value: kv.get(where.key) } : null) },
    $transaction: async (ops) => Promise.all(ops),
    _boxes: boxes, _kv: kv,
  };
}
const GKEY = 'formrecord:grading-production-log-cultivated';
const IKEY = 'formrecord:closed-box-inspection';
const p = fakePrisma();
const grading = [{ id: 'g1', values: { jobNo: '3CP100', gradingDate: '2026-10-01' }, roster: [{ sizeGrade: '8g-10g', binNo: 4, fullBoxWeight: '10 + 12.5 + 11', finalBinWeight: '' }] }];
await syncStockLinks(p, GKEY, JSON.stringify(grading));
await syncClosedBoxes(p, GKEY, JSON.stringify(grading));

let aw = await awaitingBoxes(p);
assert.deepStrictEqual(aw.map((b) => b.boxCode), ['8G-10G-1', '8G-10G-2', '8G-10G-3']);
assert.deepStrictEqual(aw[0].jobs, ['3CP100']);

// a saved draft holds box -1: still listed, flagged with the draft id; nothing written to closed_box
const draft = [{ id: 'i0', status: 'draft', roster: [{ boxCode: '8G-10G-1', tareKg: '1' }] }];
p._kv.set(IKEY, JSON.stringify(draft));
await syncBoxInspections(p, IKEY, JSON.stringify(draft));
aw = await awaitingBoxes(p);
assert.strictEqual(aw.find((b) => b.boxCode === '8G-10G-1').draftSubmissionId, 'i0');
assert.ok(p._boxes.every((b) => !b.inspectionSubmissionId), 'draft writes no inspection');

// submit: boxes -1 (all ticked) and -2 (frills unticked + comment); -3 untouched
const sub = (over = {}) => ({ id: 'i1', status: 'submitted', completedBy: { by: 'Thandi' }, roster: [
  { boxCode: '8g-10g-1', tareKg: '1.2', nettKg: '10', ...ticks('Yes') },
  { boxCode: '8G-10G-2', tareKg: '1.2', nettKg: '12.5', ...ticks('Yes'), frillsPresent: '', comment: 'frills trimmed' },
], ...over });
const t1 = new Date('2026-10-02T22:30:00Z');                       // 00:30 on 3 Oct in SA
const r1 = await syncBoxInspections(p, IKEY, JSON.stringify([sub()]), t1);
assert.deepStrictEqual(r1.applied.sort(), ['8G-10G-1', '8G-10G-2']);
const b1 = p._boxes.find((b) => b.boxCode === '8G-10G-1'), b2 = p._boxes.find((b) => b.boxCode === '8G-10G-2');
assert.strictEqual(b1.approved, true);
assert.strictEqual(b2.approved, false);
assert.strictEqual(b2.comment, 'frills trimmed');
assert.strictEqual(b1.inspectedBy, 'Thandi');
assert.strictEqual(b1.packingDate.toISOString().slice(0, 10), '2026-10-03', 'packing date is the SA date, not UTC');
assert.strictEqual(sastDate(t1).toISOString().slice(0, 10), '2026-10-03');
assert.strictEqual(p._boxes.find((b) => b.boxCode === '8G-10G-3').inspectionSubmissionId, null, 'untouched box stays awaiting');
assert.deepStrictEqual((await awaitingBoxes(p)).map((b) => b.boxCode), ['8G-10G-3']);

// re-sync later: idempotent, packing date never changes
const before = b1.packingDate.toISOString();
await syncBoxInspections(p, IKEY, JSON.stringify([sub()]), new Date('2026-11-01T10:00:00Z'));
assert.strictEqual(p._boxes.find((b) => b.boxCode === '8G-10G-1').packingDate.toISOString(), before);

// a second submission claiming an already-inspected box is refused; a wrong nett is refused
const dup = { id: 'i2', status: 'submitted', roster: [
  { boxCode: '8G-10G-1', tareKg: '1', nettKg: '10', ...ticks('Yes') },
  { boxCode: '8G-10G-3', tareKg: '1', nettKg: '99', ...ticks('Yes') },
] };
const r2 = await syncBoxInspections(p, IKEY, JSON.stringify([sub(), dup]));
assert.strictEqual(r2.applied.length, 0);
assert.strictEqual(r2.skipped.length, 2);
assert.strictEqual(p._boxes.find((b) => b.boxCode === '8G-10G-3').inspectionSubmissionId, null);

console.log('box-inspection: all tests passed');
