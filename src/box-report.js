// REC 7.4.4 Grading, Boxing & Traceability: a read-only report, no entry form and nothing stored.
// One call (GET /api/report/boxes) returns every box closed with "+ Full box" in REC 7.4.3.1 /
// 7.4.3.2, joined to what is already recorded elsewhere:
//   closed_box   box code (= bin code), size grade, nett kg, date, REC 7.4.5 inspection
//   stock_link   the job(s) whose stock is in the bin, and each job's weight where known
//   REC 7.4.8    NRCS AG code, shipment details (a box on a submitted labelling list is "Shipped")
//   legacy 7.4.4 old-form submissions, returned untouched for display at the foot of the page
// Filtering, print and CSV happen in the browser on this one payload.
// The export invoice no. lives on the Dry Export Pack front page, which carries no box list and no
// shipment key, so a box cannot be joined to it without guessing: `exportInvoiceNo` is always null
// until the pack gets a link to the labelling list (see work log).

const { norm } = require('./stock-link');

const LABELLING_KEY = 'formrecord:dry-labelling-list';
const LEGACY_KEY = 'formrecord:grading-boxing-traceability';
const isSubmitted = (e) => e && (e.status == null || e.status === 'submitted');
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const byCode = (a, b) => a.localeCompare(b, undefined, { numeric: true });

async function readEntries(prisma, key) {
  const row = await prisma.keyValue.findUnique({ where: { key } });
  try { const v = row ? JSON.parse(row.value) : []; return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// Pure: rows from the four sources -> { boxes, warnings, legacy }.
function buildReport({ closed, edges, labelling, legacy }) {
  // 7.4.8: one record per box code, from submitted and draft labelling lists alike (a draft is
  // reported as "Labelled (draft)", never as shipped).
  const labelled = new Map();
  for (const entry of labelling) {
    if (!entry) continue;
    const v = entry.values || entry;
    for (const r of Array.isArray(entry.roster) ? entry.roster : []) {
      if (!r) continue;
      for (const code of [norm(r.boxCode), norm(r.binCode)].filter(Boolean)) {
        const prev = labelled.get(code);
        if (prev && prev.submitted && !isSubmitted(entry)) continue; // keep the submitted one
        labelled.set(code, {
          submitted: isSubmitted(entry), agCode: String(r.agCode || '').trim() || null,
          customer: v.customer || null, flight: v.flight || null, airwaybillNr: v.airwaybillNr || null, etd: v.etd || null,
          labellingId: String(entry.id || ''),
        });
      }
    }
  }

  const edgesByBin = new Map();
  for (const e of edges) {
    if (!edgesByBin.has(e.toKey)) edgesByBin.set(e.toKey, []);
    edgesByBin.get(e.toKey).push(e);
  }

  const boxes = closed.map((c) => {
    const es = edgesByBin.get(c.boxCode) || [];
    const jobMap = new Map();
    for (const e of es) {
      const j = jobMap.get(e.fromKey) || { jobNo: e.fromKey, weightKg: null };
      // Only the "box" edge of the closing job carries a weight; open-bin / legacy edges are null.
      if (e.weightKg != null) j.weightKg = (j.weightKg || 0) + e.weightKg;
      jobMap.set(e.fromKey, j);
    }
    if (!jobMap.has(c.jobNo)) jobMap.set(c.jobNo, { jobNo: c.jobNo, weightKg: c.nettKg743 });
    const jobs = [...jobMap.values()].sort((a, b) => byCode(a.jobNo, b.jobNo));
    const dates = es.map((e) => e.occurredOn).filter(Boolean).sort();
    const lab = labelled.get(c.boxCode) || null;
    const inspected = !!c.inspectionSubmissionId;
    const status = lab && lab.submitted ? 'Shipped'
      : lab ? 'Labelled (draft)'
      : inspected && c.approved === true ? 'In stock' : 'Boxed';
    const gradedKg = jobs.reduce((s, j) => s + (j.weightKg || 0), 0);
    const nettOut = c.nettKg;
    return {
      boxCode: c.boxCode, sizeGrade: c.sizeGrade, jobs, blended: jobs.length > 1,
      dateGraded: dates[0] || (c.closedAt ? new Date(c.closedAt).toISOString().slice(0, 10) : null),
      agCode: lab ? lab.agCode : null,
      shipment: lab ? { customer: lab.customer, flight: lab.flight, airwaybillNr: lab.airwaybillNr, etd: lab.etd } : null,
      exportInvoiceNo: null,
      status,
      fromDraft: c.sourceStatus === 'draft',
      inspection: inspected ? { approved: c.approved === true, packingDate: c.packingDate, nettKg: c.nettKg, changedAfterInspection: c.changedAfterInspection } : null,
      // Mass balance: weight graded into the box (7.4.3) vs nett weighed at inspection (7.4.5).
      gradedKg: gradedKg || null, nettKg: nettOut,
      balanceKg: nettOut != null && gradedKg ? Math.round((nettOut - gradedKg) * 100) / 100 : null,
    };
  }).sort((a, b) => (b.dateGraded || '').localeCompare(a.dateGraded || '') || byCode(a.boxCode, b.boxCode));

  const closedCodes = new Set(closed.map((c) => c.boxCode));
  const warnings = [];
  // Stock in a bin that has not been closed into a box yet.
  const open = new Map();
  for (const e of edges) {
    if (closedCodes.has(e.toKey)) continue;
    if (!open.has(e.toKey)) open.set(e.toKey, new Set());
    open.get(e.toKey).add(e.fromKey);
  }
  for (const [code, jobs] of [...open].sort((a, b) => byCode(a[0], b[0]))) {
    warnings.push({ type: 'graded-no-box', boxCode: code, jobs: [...jobs].sort(), message: 'Graded into bin ' + code + ' but no box closed yet' });
  }
  // A box on a labelling list that has no grading record behind it.
  for (const [code, lab] of [...labelled].sort((a, b) => byCode(a[0], b[0]))) {
    if (!closedCodes.has(code)) warnings.push({ type: 'box-no-grading', boxCode: code, jobs: [], message: 'Box ' + code + ' is on REC 7.4.8 but has no grading record' });
  }
  for (const b of boxes) {
    if (b.fromDraft) warnings.push({ type: 'draft-source', boxCode: b.boxCode, jobs: b.jobs.map((j) => j.jobNo), message: 'Box ' + b.boxCode + ' comes from a grading log that is still a draft' });
  }

  const legacyRows = legacy.map((e) => {
    const v = e.values || e;
    return { id: String(e.id || ''), status: isSubmitted(e) ? 'submitted' : 'draft', binCode: v.binCode || '', jobNumbersInBin: v.jobNumbersInBin || '', dateCreated: v.dateCreated || '', values: v };
  });
  return { boxes, warnings, legacy: legacyRows };
}

async function boxReport(prisma) {
  const [closed, edges, labelling, legacy] = await Promise.all([
    prisma.closedBox.findMany(),
    prisma.stockLink.findMany({ where: { fromType: 'job', toType: 'bin' } }),
    readEntries(prisma, LABELLING_KEY),
    readEntries(prisma, LEGACY_KEY),
  ]);
  return buildReport({ closed, edges, labelling, legacy });
}

module.exports = { boxReport, buildReport };
