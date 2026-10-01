// Keep the closed_box table in step with REC 7.4.3.1 / 7.4.3.2: one row per box added with
// "+ Full box". The page keeps showing the weights as "a + b + c" (display only); here each box
// becomes its own row with a numeric weight. The box list is derived from the roster's
// `fullBoxWeight` text with the same code rule as the page (sizeGrade-(binNo - n + k)).
// 7.4.3 columns are refreshed on every save; the inspection columns (REC 7.4.5) are never written
// here. A box that vanishes is deleted if uninspected, or kept and flagged
// `changed_after_inspection` if it already has an inspection.
// An indexing step, not a gate: the caller catches errors.

const { norm } = require('./stock-link');

const GRADING = new Set(['grading-production-log-cultivated', 'grading-production-log-ranched']);
const PREFIX = 'formrecord:';

function extractBoxes(recordKey, entries) {
  const boxes = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || !entry.id) continue;
    const values = entry.values || entry;
    const job = norm(values.jobNo);
    if (!job) continue;
    const status = entry.status == null || entry.status === 'submitted' ? 'submitted' : 'draft';
    for (const r of Array.isArray(entry.roster) ? entry.roster : []) {
      if (!r) continue;
      const grade = String(r.sizeGrade || '').trim();
      const seq = parseInt(r.binNo, 10);
      if (!grade || isNaN(seq)) continue;
      const parts = String(r.fullBoxWeight || '').split(/[+,;\s]+/).filter(Boolean);
      parts.forEach((w, k) => {
        const kg = parseFloat(w);
        boxes.push({
          boxCode: norm(grade + '-' + (seq - parts.length + k)),
          sourceRecordKey: recordKey, sourceSubmissionId: String(entry.id), sourceStatus: status,
          jobNo: job, sizeGrade: grade, nettKg743: isNaN(kg) ? null : kg,
        });
      });
    }
  }
  return boxes;
}

async function syncClosedBoxes(prisma, key, value) {
  if (!key.startsWith(PREFIX)) return null;
  const recordKey = key.slice(PREFIX.length);
  if (!GRADING.has(recordKey)) return null;
  let entries;
  try { entries = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(entries)) return null;

  const seen = new Set();
  const boxes = extractBoxes(recordKey, entries).filter((b) => !seen.has(b.boxCode) && seen.add(b.boxCode)); // first claim wins
  const existing = await prisma.closedBox.findMany({ where: { sourceRecordKey: recordKey } });
  const byCode = new Map(existing.map((e) => [e.boxCode, e]));
  const ops = [];

  for (const b of boxes) {
    const cur = byCode.get(b.boxCode);
    if (!cur) {
      ops.push(prisma.closedBox.create({ data: b }));
    } else {
      const weightChanged = cur.inspectionSubmissionId && cur.nettKg743 != null && b.nettKg743 != null && cur.nettKg743 !== b.nettKg743;
      ops.push(prisma.closedBox.update({
        where: { boxCode: b.boxCode },
        data: { ...b, ...(weightChanged ? { changedAfterInspection: true } : {}) },
      }));
    }
  }
  for (const cur of existing) {
    if (seen.has(cur.boxCode)) continue;
    ops.push(cur.inspectionSubmissionId
      ? prisma.closedBox.update({ where: { boxCode: cur.boxCode }, data: { changedAfterInspection: true } })
      : prisma.closedBox.delete({ where: { boxCode: cur.boxCode } }));
  }
  await prisma.$transaction(ops);
  return { boxes: boxes.length };
}

module.exports = { syncClosedBoxes, extractBoxes };
