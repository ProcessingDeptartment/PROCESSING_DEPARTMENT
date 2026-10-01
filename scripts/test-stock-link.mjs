// Pure tests for src/stock-link.js edge extraction (no database). Run: node scripts/test-stock-link.mjs
import { createRequire } from 'module';
import assert from 'assert';
const { extractEdges } = createRequire(import.meta.url)('../src/stock-link.js');

const grading = (id, job, roster, extra = {}) => ({ id, values: { jobNo: job, gradingDate: '2026-09-30' }, roster, ...extra });

// 1. three boxes on grade 8g-10g, counter now at 4 -> boxes are -1, -2, -3; open bin is -4
{
  const { edges, skipped } = extractEdges('grading-production-log-cultivated', [
    grading('a', '3cp101', [{ sizeGrade: '8g-10g', binNo: 4, fullBoxWeight: '10+12.5, 11', finalBinWeight: '3' }]),
  ]);
  assert.deepStrictEqual(edges.map(e => e.toKey), ['8G-10G-1', '8G-10G-2', '8G-10G-3', '8G-10G-4']);
  assert.deepStrictEqual(edges.map(e => e.weightKg), [10, 12.5, 11, null]);
  assert.strictEqual(edges[0].fromKey, '3CP101');
  assert.strictEqual(skipped.length, 0);
}
// 2. blending: two jobs under the same bin code give two edges on that bin
{
  const rows = [
    ...extractEdges('grading-production-log-ranched', [grading('a', 'DPR7', [{ sizeGrade: '200g+', binNo: 2, fullBoxWeight: '20', finalBinWeight: '4' }])]).edges,
    ...extractEdges('grading-production-log-ranched', [grading('b', 'DPR8', [{ sizeGrade: '200g+', binNo: 2, fullBoxWeight: '', finalBinWeight: '6' }])]).edges,
  ];
  const open = rows.filter(e => e.toKey === '200G+-2');
  assert.deepStrictEqual(open.map(e => e.fromKey).sort(), ['DPR7', 'DPR8']);
}
// 3. malformed / missing job -> skipped, never guessed
{
  const { edges, skipped } = extractEdges('grading-production-log-cultivated', [
    grading('a', 'XYZ1', [{ sizeGrade: '8g-10g', binNo: 2, fullBoxWeight: '5' }]),
    grading('b', '', [{ sizeGrade: '8g-10g', binNo: 2, fullBoxWeight: '5' }]),
  ]);
  assert.strictEqual(edges.length, 0);
  assert.strictEqual(skipped.length, 2);
}
// 4. legacy 7.4.4: free-text split on comma/space/newline, one bad job reported, good ones kept
{
  const { edges, skipped } = extractEdges('grading-boxing-traceability', [
    { id: 'l1', values: { binCode: ' 8g-10g-3 ', jobNumbersInBin: '3cp1, 3cp2\nBAD9 3dp3', dateCreated: '2026-09-01' } },
  ]);
  assert.deepStrictEqual(edges.map(e => e.fromKey), ['3CP1', '3CP2', '3DP3']);
  assert.ok(edges.every(e => e.toKey === '8G-10G-3'));
  assert.strictEqual(skipped.length, 1);
}
// 5. same input twice yields identical slots (the replace-per-record sync then cannot duplicate)
{
  const e = [grading('a', '3CP1', [{ sizeGrade: 'B-grade', binNo: 2, fullBoxWeight: '5' }])];
  const a = extractEdges('grading-production-log-cultivated', e).edges.map(x => x.slot);
  const b = extractEdges('grading-production-log-cultivated', e).edges.map(x => x.slot);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(new Set(a).size, a.length);
}
// 6. drafts are indexed and flagged
{
  const { edges } = extractEdges('grading-production-log-cultivated', [
    grading('a', '3CP1', [{ sizeGrade: 'B-grade', binNo: 2, fullBoxWeight: '5' }], { status: 'draft' }),
  ]);
  assert.strictEqual(edges[0].status, 'draft');
}
console.log('stock-link: all tests passed');
