// Seeded end-to-end test of the recall chain, with NO database: saves are pushed through the real
// syncStockLinks + syncClosedBoxes, then the real boxesForJob answers the recall question.
// Run: node scripts/test-recall-boxes.mjs
import { createRequire } from 'module';
import assert from 'assert';
const require = createRequire(import.meta.url);
const { syncStockLinks } = require('../src/stock-link.js');
const { syncClosedBoxes } = require('../src/closed-box.js');
const { boxesForJob } = require('../src/recall-boxes.js');

// ---- minimal in-memory stand-in for the Prisma calls these modules use ----
function fakePrisma() {
  const stock = [], boxes = [];
  let id = 1;
  const match = (row, where = {}) => Object.entries(where).every(([k, v]) =>
    v && typeof v === 'object' && 'in' in v ? v.in.includes(row[k]) : row[k] === v);
  const table = (rows, defaults = () => ({})) => ({
    findMany: async ({ where } = {}) => rows.filter((r) => match(r, where)).map((r) => ({ ...r })),
    findUnique: async ({ where }) => { const r = rows.find((x) => match(x, where)); return r ? { ...r } : null; },
    create: async ({ data }) => { rows.push({ id: id++, ...defaults(), ...data }); },
    createMany: async ({ data }) => { data.forEach((d) => rows.push({ id: id++, ...defaults(), ...d })); },
    update: async ({ where, data }) => { Object.assign(rows.find((x) => match(x, where)), data); },
    delete: async ({ where }) => { rows.splice(rows.findIndex((x) => match(x, where)), 1); },
    deleteMany: async ({ where }) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1); },
  });
  return {
    stockLink: table(stock),
    closedBox: table(boxes, () => ({ closedAt: new Date(), changedAfterInspection: false, inspectionSubmissionId: null, approved: null, packingDate: null, tareKg: null, nettKg: null })),
    $transaction: async (ops) => Promise.all(ops),
    _boxes: boxes, _stock: stock,
  };
}

const KEY = 'formrecord:grading-production-log-cultivated';
const save = async (p, entries) => { const v = JSON.stringify(entries); await syncStockLinks(p, KEY, v); await syncClosedBoxes(p, KEY, v); };
const entry = (id, job, roster, extra = {}) => ({ id, values: { jobNo: job, gradingDate: '2026-10-01' }, roster, ...extra });
const row = (grade, binNo, boxes, final) => ({ sizeGrade: grade, binNo, fullBoxWeight: boxes, finalBinWeight: final });

const p = fakePrisma();

// Seed: job A closes 3 boxes of 8g-10g (counter ends at 4) and has 2kg left in bin -4.
// Job B then tops up that same open bin -4 and closes it as one more box (counter -> 5).
const a = entry('s1', '3CP100', [row('8g-10g', 4, '10 + 12.5 + 11', '2'), row('14g-16g', 2, '9.5', '')]);
await save(p, [a]);
let r = await boxesForJob(p, '3cp100');
assert.deepStrictEqual(r.boxes.map(b => b.boxCode), ['8G-10G-1', '8G-10G-2', '8G-10G-3', '8G-10G-4', '14G-16G-1']);
assert.strictEqual(r.boxes.find(b => b.boxCode === '8G-10G-2').state, 'closed');
assert.strictEqual(r.boxes.find(b => b.boxCode === '8G-10G-4').state, 'open bin', 'unfinished bin is listed, not hidden');
assert.strictEqual(p._boxes.length, 4, 'one row per closed box, open bin is not a box');

const b = entry('s2', '3DP200', [row('8g-10g', 5, '8', '')]);
await save(p, [a, b]);
r = await boxesForJob(p, '3CP100');
const blended = r.boxes.find(x => x.boxCode === '8G-10G-4');
assert.deepStrictEqual(blended.jobs, ['3CP100', '3DP200'], 'blended bin shows both jobs');
assert.strictEqual(blended.state, 'closed', 'now closed by job B');

// Recalling job B finds the blended box too, but not job A's other boxes.
r = await boxesForJob(p, '3DP200');
assert.deepStrictEqual(r.boxes.map(x => x.boxCode), ['8G-10G-4']);

// Re-save is idempotent.
const before = [p._boxes.length, p._stock.length];
await save(p, [a, b]); await save(p, [a, b]);
assert.deepStrictEqual([p._boxes.length, p._stock.length], before, 'no duplicates on re-save');

// Unknown job -> empty list, not an error.
assert.strictEqual((await boxesForJob(p, '3CP999')).count, 0);

// Inspection data lands on the SAME row and survives a re-save of 7.4.3.
Object.assign(p._boxes.find(x => x.boxCode === '8G-10G-1'), { inspectionSubmissionId: 'i1', approved: true, packingDate: '2026-10-02', tareKg: 1.2, nettKg: 10 });
await save(p, [a, b]);
r = await boxesForJob(p, '3CP100');
assert.strictEqual(r.boxes.find(x => x.boxCode === '8G-10G-1').inspection.approved, true, 'inspection survives re-sync');
assert.strictEqual(r.boxes.find(x => x.boxCode === '8G-10G-2').inspection, null, 'uninspected box has no inspection');

// Undo last box of an UNINSPECTED row -> its row is deleted.
const aUndo = entry('s1', '3CP100', [row('8g-10g', 3, '10 + 12.5', '2'), row('14g-16g', 2, '9.5', '')]);
await save(p, [aUndo, b]);
assert.ok(!p._boxes.some(x => x.boxCode === '8G-10G-3' && x.sourceSubmissionId === 's1'), 'undone uninspected box removed');

// Weight edited on an INSPECTED box -> kept and flagged.
const aEdit = entry('s1', '3CP100', [row('8g-10g', 3, '10.4 + 12.5', '2'), row('14g-16g', 2, '9.5', '')]);
await save(p, [aEdit, b]);
const edited = p._boxes.find(x => x.boxCode === '8G-10G-1');
assert.strictEqual(edited.changedAfterInspection, true, 'edit after inspection is flagged');
assert.strictEqual(edited.approved, true, 'inspection itself is not altered');

// Draft record is listed and badged.
await save(p, [aEdit, b, entry('s3', '3CP300', [row('B-grade', 2, '5', '')], { status: 'draft' })]);
assert.strictEqual((await boxesForJob(p, '3CP300')).boxes[0].fromDraft, true);

console.log('recall-boxes: all tests passed');
