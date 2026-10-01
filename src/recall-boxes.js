// Mock recall: every box / bin a job's stock went into, with the other jobs sharing each box and
// the REC 7.4.5 inspection on the box's own closed_box row. Box code = bin code. Read-only.
// Served by GET /api/recall/job/:job/boxes; kept apart from index.js so it can be tested.

const { norm } = require('./stock-link');

async function boxesForJob(prisma, jobNo) {
  const job = norm(jobNo);
  const edges = await prisma.stockLink.findMany({ where: { fromType: 'job', fromKey: job, toType: 'bin' } });
  const codes = [...new Set(edges.map((e) => e.toKey))];
  const [shared, closed] = codes.length
    ? await Promise.all([
        prisma.stockLink.findMany({ where: { toType: 'bin', toKey: { in: codes } }, select: { fromKey: true, toKey: true } }),
        prisma.closedBox.findMany({ where: { boxCode: { in: codes } } }),
      ])
    : [[], []];
  const jobsByBin = new Map();
  for (const s of shared) {
    if (!jobsByBin.has(s.toKey)) jobsByBin.set(s.toKey, new Set());
    jobsByBin.get(s.toKey).add(s.fromKey);
  }
  const closedByCode = new Map(closed.map((c) => [c.boxCode, c]));
  const boxes = codes.map((code) => {
    const c = closedByCode.get(code);
    const mine = edges.filter((e) => e.toKey === code);
    return {
      boxCode: code,
      state: c ? 'closed' : 'open bin', // open bin = stock still in a bin, no box closed yet
      sizeGrade: c ? c.sizeGrade : null,
      nettKg: c ? c.nettKg743 : (mine.find((e) => e.weightKg != null) || {}).weightKg ?? null,
      closedAt: c ? c.closedAt : null,
      jobs: [...(jobsByBin.get(code) || [])].sort(),
      fromDraft: mine.some((e) => e.status === 'draft'),
      inspection: c && c.inspectionSubmissionId
        ? { approved: c.approved === true, packingDate: c.packingDate, tareKg: c.tareKg, nettKg: c.nettKg, changedAfterInspection: c.changedAfterInspection }
        : null,
    };
  }).sort((a, b) => a.boxCode.localeCompare(b.boxCode, undefined, { numeric: true }));
  return { job, count: boxes.length, boxes };
}

module.exports = { boxesForJob };
