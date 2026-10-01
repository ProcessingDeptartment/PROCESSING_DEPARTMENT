// REC 7.4.5 Closed Box Inspection, server side. Two jobs:
//
//  1. awaitingBoxes(): the closed boxes that have no submitted inspection yet, oldest first, for the
//     page's self-filling list. A box in somebody's saved draft is flagged with that draft's id.
//  2. syncBoxInspections(): when a 7.4.5 record is SUBMITTED, write each inspected box's answers onto
//     its own closed_box row (the row REC 7.4.3 created). The server stamps the packing date (South
//     African time) the first time a box is inspected; it is never changed afterwards.
// Drafts write nothing to closed_box. Indexing step, not a gate: the caller catches errors.

const { norm } = require('./stock-link');

const RECORD_KEY = 'closed-box-inspection';
const KEY = 'formrecord:' + RECORD_KEY;
const CHECKS = ['colourUniform', 'sizeGradeCorrect', 'frillsPresent', 'bagSealed', 'boxSealed', 'silicaPresent'];
// Nett weight typed in 7.4.5 must equal the weight set in 7.4.3, to 2 decimals, within this many kg.
const NETT_TOLERANCE_KG = 0.0;

const isSubmitted = (e) => e && (e.status == null || e.status === 'submitted');
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const sameNett = (a, b) => a != null && b != null && Math.abs(Math.round(a * 100) - Math.round(b * 100)) / 100 <= NETT_TOLERANCE_KG + 1e-9;

// Today's date in Africa/Johannesburg as a UTC-midnight Date (for a Postgres DATE column).
function sastDate(now = new Date()) {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return new Date(ymd + 'T00:00:00Z');
}

async function awaitingBoxes(prisma) {
  const boxes = await prisma.closedBox.findMany({ where: { inspectionSubmissionId: null } });
  boxes.sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt) || a.boxCode.localeCompare(b.boxCode, undefined, { numeric: true }));
  const codes = boxes.map((b) => b.boxCode);
  const edges = codes.length ? await prisma.stockLink.findMany({ where: { toType: 'bin', toKey: { in: codes } }, select: { fromKey: true, toKey: true } }) : [];
  const jobs = new Map();
  for (const e of edges) { if (!jobs.has(e.toKey)) jobs.set(e.toKey, new Set()); jobs.get(e.toKey).add(e.fromKey); }

  // Boxes held by a saved (not submitted) 7.4.5 draft.
  const inDraft = new Map();
  const kv = await prisma.keyValue.findUnique({ where: { key: KEY } });
  let entries = [];
  try { entries = kv ? JSON.parse(kv.value) : []; } catch { entries = []; }
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || isSubmitted(e)) continue;
    for (const r of Array.isArray(e.roster) ? e.roster : []) if (r && r.boxCode) inDraft.set(norm(r.boxCode), e.id);
  }

  return boxes.map((b) => ({
    boxCode: b.boxCode,
    sizeGrade: b.sizeGrade,
    closedAt: b.closedAt,
    jobs: [...(jobs.get(b.boxCode) || [])].sort(),
    nettKg743: b.nettKg743,
    fromDraft: b.sourceStatus === 'draft',
    draftSubmissionId: inDraft.get(b.boxCode) || null,
  }));
}

async function syncBoxInspections(prisma, key, value, now = new Date()) {
  if (key !== KEY) return null;
  let entries;
  try { entries = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(entries)) return null;
  const applied = [], skipped = [];
  for (const entry of entries) {
    if (!entry || !entry.id || !isSubmitted(entry)) continue;
    const by = (entry.completedBy && entry.completedBy.by) || null;
    for (const r of Array.isArray(entry.roster) ? entry.roster : []) {
      const code = norm(r && r.boxCode);
      if (!code) continue;
      const cb = await prisma.closedBox.findUnique({ where: { boxCode: code } });
      if (!cb) { skipped.push({ code, reason: 'no such closed box' }); continue; }
      if (cb.inspectionSubmissionId === entry.id) continue;                       // already applied
      if (cb.inspectionSubmissionId) { skipped.push({ code, reason: 'already inspected by ' + cb.inspectionSubmissionId }); continue; }
      const tare = num(r.tareKg), nett = num(r.nettKg);
      if (!(tare > 0) || !(nett > 0)) { skipped.push({ code, reason: 'tare/nett missing' }); continue; }
      if (!sameNett(nett, cb.nettKg743)) { skipped.push({ code, reason: 'nett ' + nett + ' does not match 7.4.3 ' + cb.nettKg743 }); continue; }
      const ticks = {};
      CHECKS.forEach((k) => { ticks[k] = r[k] === 'Yes' || r[k] === true; });
      await prisma.closedBox.update({
        where: { boxCode: code },
        data: {
          inspectionSubmissionId: entry.id, tareKg: tare, nettKg: nett, ...ticks,
          approved: CHECKS.every((k) => ticks[k]),
          comment: String(r.comment || '').trim() || null,
          inspectedBy: by,
          packingDate: cb.packingDate || sastDate(now),   // never changed once set
          packedAt: cb.packedAt || now,
        },
      });
      applied.push(code);
    }
  }
  return { applied, skipped };
}

module.exports = { awaitingBoxes, syncBoxInspections, sastDate, sameNett, KEY, RECORD_KEY, CHECKS };
