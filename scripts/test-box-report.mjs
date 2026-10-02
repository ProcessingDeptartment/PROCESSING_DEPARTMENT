// Pure tests for src/box-report.js (no database). Run: node scripts/test-box-report.mjs
import { createRequire } from 'module';
import assert from 'assert';
const { buildReport } = createRequire(import.meta.url)('../src/box-report.js');

const box = (boxCode, jobNo, extra = {}) => ({ boxCode, sizeGrade: boxCode.replace(/-\d+$/, ''), jobNo, nettKg743: 10, sourceStatus: 'submitted', closedAt: '2026-09-30T08:00:00Z', inspectionSubmissionId: null, approved: null, nettKg: null, ...extra });
const edge = (toKey, fromKey, weightKg, occurredOn = '2026-09-29') => ({ toKey, fromKey, weightKg, occurredOn, status: 'submitted' });

// 1. blended box lists both jobs, weights kept per job, null weight stays null
{
  const r = buildReport({
    closed: [box('8G-10G-2', '3CP1')], edges: [edge('8G-10G-2', '3CP1', 10), edge('8G-10G-2', '3CP2', null)], labelling: [], legacy: [],
  });
  const b = r.boxes[0];
  assert.strictEqual(b.blended, true);
  assert.deepStrictEqual(b.jobs.map((j) => [j.jobNo, j.weightKg]), [['3CP1', 10], ['3CP2', null]]);
  assert.strictEqual(b.status, 'Boxed');
  assert.strictEqual(b.dateGraded, '2026-09-29');
}
// 2. status: inspected+approved = In stock; on submitted 7.4.8 = Shipped (with AG code); draft 7.4.8 = Labelled (draft)
{
  const closed = [
    box('A-1', '3CP1', { inspectionSubmissionId: 'x', approved: true, nettKg: 10 }),
    box('A-2', '3CP1', { inspectionSubmissionId: 'x', approved: true, nettKg: 9.5 }),
    box('A-3', '3CP1'),
  ];
  const labelling = [
    { id: 'l1', status: 'submitted', values: { customer: 'HK Co' }, roster: [{ boxCode: ' a-2 ', agCode: 'AG123' }] },
    { id: 'l2', status: 'draft', values: {}, roster: [{ binCode: 'A-3', agCode: 'AG9' }] },
  ];
  const r = buildReport({ closed, edges: [], labelling, legacy: [] });
  const by = Object.fromEntries(r.boxes.map((b) => [b.boxCode, b]));
  assert.strictEqual(by['A-1'].status, 'In stock');
  assert.strictEqual(by['A-2'].status, 'Shipped');
  assert.strictEqual(by['A-2'].agCode, 'AG123');
  assert.strictEqual(by['A-2'].balanceKg, -0.5);
  assert.strictEqual(by['A-3'].status, 'Labelled (draft)');
}
// 3. warnings: open bin with no box; labelled box with no grading record
{
  const r = buildReport({
    closed: [box('A-1', '3CP1')], edges: [edge('B-5', '3CP9', null)],
    labelling: [{ id: 'l', status: 'submitted', values: {}, roster: [{ boxCode: 'Z-9' }] }], legacy: [],
  });
  assert.deepStrictEqual(r.warnings.map((w) => w.type).sort(), ['box-no-grading', 'graded-no-box']);
}
// 4. legacy submissions pass through read-only
{
  const r = buildReport({ closed: [], edges: [], labelling: [], legacy: [{ id: 'o1', values: { binCode: 'A-1', jobNumbersInBin: '3CP1, 3CP2', dateCreated: '2026-09-01' } }] });
  assert.strictEqual(r.legacy[0].jobNumbersInBin, '3CP1, 3CP2');
  assert.strictEqual(r.legacy[0].status, 'submitted');
}
console.log('box-report: all tests passed');
