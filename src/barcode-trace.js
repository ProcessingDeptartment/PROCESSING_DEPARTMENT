'use strict';
// Barcode lifecycle API (MD/barcode-job-lifecycle-traceability-instructions.md, phases 1-2 + split).
//   POST /api/traceability/link    link a barcode to a job at a stage (creates the barcode if new)
//   POST /api/traceability/scan    log a stage scan, returns job + history
//   POST /api/traceability/split   parent -> status 'split', children created 'active'
//   GET  /api/traceability/history/:barcodeValue   full chain (inherits parent history)
// Barcodes are never deleted; only status changes. Scans are additive.

const STAGES = ['intake', 'cooking', 'drying', 'qc', 'grading', 'packing', 'dispatch'];
const SPLIT_STAGES = ['grading'];

const clean = (v) => String(v == null ? '' : v).trim();
const bcVal = (v) => clean(v).toUpperCase();
const bad = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });
const notActive = (bc) => (bc.status === 'split'
  ? 'This barcode has been split - scan a child barcode.'
  : 'This barcode is retired.');

async function loadChain(prisma, bc) {
  const [jobLinks, stageEvents, children] = await Promise.all([
    prisma.barcodeJobLink.findMany({ where: { barcodeId: bc.id }, orderBy: { linkedAt: 'asc' } }),
    prisma.barcodeStageEvent.findMany({ where: { barcodeId: bc.id }, orderBy: { scannedAt: 'asc' } }),
    prisma.traceBarcode.findMany({ where: { parentId: bc.id }, orderBy: { id: 'asc' } }),
  ]);
  return { jobLinks, stageEvents, children };
}

// Walk up to the root (nearest parent first) so a child inherits its parents' history.
async function ancestry(prisma, bc) {
  const out = [];
  let cur = bc;
  for (let i = 0; cur.parentId && i < 20; i++) {
    cur = await prisma.traceBarcode.findUnique({ where: { id: cur.parentId } });
    if (!cur) break;
    out.push(cur);
  }
  return out;
}

function mount(app, prisma) {
  app.post('/api/traceability/link', async (req, res) => {
    const b = req.body || {};
    const value = bcVal(b.barcodeValue);
    if (!value) return bad(res, 'barcodeValue required');
    if (value.length > 40) return bad(res, 'barcodeValue max 40 characters');
    if (!STAGES.includes(b.stage)) return bad(res, 'unknown stage');
    if (!clean(b.recordKey) || !clean(b.submissionId)) return bad(res, 'recordKey and submissionId required');
    try {
      let bc = await prisma.traceBarcode.findUnique({ where: { barcodeValue: value } });
      if (bc && bc.status !== 'active') return bad(res, notActive(bc), 409);
      const user = clean(b.user) || null;
      if (!bc) bc = await prisma.traceBarcode.create({ data: { barcodeValue: value, createdByUser: user } });
      const stamp = { barcodeId: bc.id, stage: b.stage, recordKey: clean(b.recordKey), submissionId: clean(b.submissionId) };
      await prisma.$transaction([
        prisma.barcodeJobLink.create({ data: { ...stamp, jobNo: clean(b.jobNo) || null, linkedByUser: user, notes: clean(b.notes) || null } }),
        prisma.barcodeStageEvent.create({ data: { ...stamp, scannedByUser: user } }),
      ]);
      res.json({ ok: true, barcodeId: bc.id, status: bc.status, message: 'Barcode linked to ' + b.stage + ' job' });
    } catch (e) { console.error('traceability link failed', e); bad(res, 'link failed', 500); }
  });

  app.post('/api/traceability/scan', async (req, res) => {
    const b = req.body || {};
    const value = bcVal(b.barcodeValue);
    if (!value) return bad(res, 'barcodeValue required');
    if (!STAGES.includes(b.stage)) return bad(res, 'unknown stage');
    try {
      const bc = await prisma.traceBarcode.findUnique({ where: { barcodeValue: value } });
      if (!bc) return bad(res, 'Unknown barcode - link it at intake first.', 404);
      if (bc.status !== 'active') return bad(res, notActive(bc), 409);
      const w = Number(b.weight);
      await prisma.barcodeStageEvent.create({ data: {
        barcodeId: bc.id, stage: b.stage, scannedByUser: clean(b.user) || null,
        locationNote: clean(b.locationNote) || null, weight: b.weight != null && Number.isFinite(w) ? w : null,
      } });
      const chain = await loadChain(prisma, bc);
      const jobNo = (chain.jobLinks.find((l) => l.jobNo) || {}).jobNo || null;
      res.json({ ok: true, barcodeId: bc.id, jobNo, status: bc.status, stageHistory: chain.stageEvents });
    } catch (e) { console.error('traceability scan failed', e); bad(res, 'scan failed', 500); }
  });

  app.post('/api/traceability/split', async (req, res) => {
    const b = req.body || {};
    const value = bcVal(b.parentBarcodeValue);
    const kids = Array.isArray(b.children) ? b.children : [];
    if (!value || !kids.length) return bad(res, 'parentBarcodeValue and children required');
    if (!clean(b.splitReason)) return bad(res, 'splitReason required');
    const childVals = kids.map((k) => bcVal(k && k.barcodeValue));
    if (childVals.some((v) => !v || v.length > 40) || new Set(childVals).size !== childVals.length) {
      return bad(res, 'child barcodes must be unique, non-empty, max 40 characters');
    }
    try {
      const parent = await prisma.traceBarcode.findUnique({ where: { barcodeValue: value } });
      if (!parent) return bad(res, 'Unknown parent barcode', 404);
      if (parent.status !== 'active') return bad(res, 'Only an active barcode can be split.', 409);
      const clash = await prisma.traceBarcode.findMany({ where: { barcodeValue: { in: childVals } }, select: { barcodeValue: true } });
      if (clash.length) return bad(res, 'Already exists: ' + clash.map((c) => c.barcodeValue).join(', '), 409);
      const user = clean(b.user) || null;
      const recordKey = clean(b.recordKey) || null;
      const submissionId = clean(b.submissionId) || null;
      const result = await prisma.$transaction(async (tx) => {
        // Conditional flip so two concurrent splits cannot both succeed.
        const flipped = await tx.traceBarcode.updateMany({ where: { id: parent.id, status: 'active' }, data: { status: 'split' } });
        if (flipped.count !== 1) throw Object.assign(new Error('already split'), { conflict: true });
        const ev = await tx.barcodeSplitEvent.create({ data: { parentId: parent.id, splitByUser: user, splitReason: clean(b.splitReason), recordKey, submissionId } });
        const created = [];
        for (let i = 0; i < kids.length; i++) {
          const c = await tx.traceBarcode.create({ data: { barcodeValue: childVals[i], parentId: parent.id, createdByUser: user } });
          const w = Number(kids[i].weight);
          await tx.barcodeStageEvent.create({ data: {
            barcodeId: c.id, stage: 'grading', recordKey, submissionId, scannedByUser: user,
            locationNote: clean(kids[i].label) || null, weight: kids[i].weight != null && Number.isFinite(w) ? w : null } });
          created.push({ id: c.id, barcodeValue: c.barcodeValue });
        }
        return { splitEventId: ev.id, children: created };
      }, { timeout: 30000 });
      res.json({ ok: true, parentId: parent.id, ...result });
    } catch (e) {
      if (e.conflict) return bad(res, 'Barcode was split by someone else.', 409);
      console.error('traceability split failed', e); bad(res, 'split failed', 500);
    }
  });

  app.get('/api/traceability/history/:barcodeValue', async (req, res) => {
    try {
      const bc = await prisma.traceBarcode.findUnique({ where: { barcodeValue: bcVal(req.params.barcodeValue) } });
      if (!bc) return bad(res, 'Unknown barcode', 404);
      const [own, ancestors] = await Promise.all([loadChain(prisma, bc), ancestry(prisma, bc)]);
      const inherited = await Promise.all(ancestors.map((a) => loadChain(prisma, a)));
      const all = (k) => [...inherited.slice().reverse().flatMap((a) => a[k]), ...own[k]];
      res.json({
        ok: true,
        barcode: { id: bc.id, value: bc.barcodeValue, status: bc.status },
        parent: ancestors[0] ? { id: ancestors[0].id, value: ancestors[0].barcodeValue, status: ancestors[0].status } : null,
        ancestors: ancestors.map((a) => ({ id: a.id, value: a.barcodeValue, status: a.status })),
        children: own.children.map((c) => ({ id: c.id, value: c.barcodeValue, status: c.status })),
        stageEvents: all('stageEvents'),
        jobLinks: all('jobLinks'),
      });
    } catch (e) { console.error('traceability history failed', e); bad(res, 'history failed', 500); }
  });
}

module.exports = { mount, STAGES, SPLIT_STAGES };
