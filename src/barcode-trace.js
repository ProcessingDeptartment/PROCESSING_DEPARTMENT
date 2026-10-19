'use strict';
// Barcode lifecycle API (MD/barcode-job-lifecycle-traceability-instructions.md, phases 1-2 + split).
//   POST /api/traceability/link    link a barcode to a job at a stage (creates the barcode if new)
//   POST /api/traceability/scan    log a stage scan, returns job + history
//   POST /api/traceability/split   parent -> status 'split', children created 'active'
//   GET  /api/traceability/history/:barcodeValue   full chain (inherits parent history)
// Barcodes are never deleted; only status changes. Scans are additive.

// Stages are open-ended: more are added over time, so the API accepts any well-formed stage name. STAGES is only the
// suggested display order for the timeline (unknown stages sort after these); it is never used to reject a scan.
const STAGES = ['intake', 'cooking', 'drying', 'qc', 'grading', 'packing', 'dispatch'];
// Splits are not tied to a stage: the person at the record decides when a barcode splits (POST /split works anywhere).
const STAGE_RE = /^[a-z][a-z0-9-]{1,31}$/;

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

// Barcode functions are administrator-only for now. The role comes from the X-Role header the app sends (the same
// convention as the drying-process reverse-movement route), so this is a UI-level restriction, not strong auth.
function adminOnly(req, res, next) {
  if (String(req.get('x-role') || '').toUpperCase() === 'ADMINISTRATOR') return next();
  return res.status(403).json({ ok: false, error: 'Barcode functions are restricted to the administrator.' });
}

function mount(app, prisma) {
  app.use('/api/traceability', adminOnly);

  app.post('/api/traceability/link', async (req, res) => {
    const b = req.body || {};
    const value = bcVal(b.barcodeValue);
    if (!value) return bad(res, 'barcodeValue required');
    if (value.length > 40) return bad(res, 'barcodeValue max 40 characters');
    if (!STAGE_RE.test(clean(b.stage))) return bad(res, 'stage must be lowercase letters, digits or hyphens');
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
    if (!STAGE_RE.test(clean(b.stage))) return bad(res, 'stage must be lowercase letters, digits or hyphens');
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

  // Which main barcode(s) hold this basket barcode (newest first).
  app.get('/api/traceability/member/:value', async (req, res) => {
    try {
      const mv = bcVal(req.params.value);
      const rows = await prisma.barcodeMember.findMany({ where: { memberValue: mv }, include: { barcode: true }, orderBy: { id: 'desc' } });
      res.json({ ok: true, memberValue: mv, mains: rows.map((m) => ({
        barcode: m.barcode.barcodeValue, status: m.barcode.status, submissionId: m.submissionId, sizeRange: m.sizeRange, weight: m.weight })) });
    } catch (e) { console.error('traceability member failed', e); bad(res, 'member lookup failed', 500); }
  });

  // Batch-trace page: every main barcode on a job with its stage scans, baskets and children. :value is a job number,
  // or a barcode (then the job(s) it is linked to are resolved first and viaBarcode says so).
  app.get('/api/traceability/job/:value', async (req, res) => {
    try {
      const raw = clean(req.params.value);
      let jobNos = [raw];
      let links = await prisma.barcodeJobLink.findMany({ where: { jobNo: { equals: raw, mode: 'insensitive' } }, select: { barcodeId: true, jobNo: true } });
      let viaBarcode = null;
      if (!links.length) {
        const bc = await prisma.traceBarcode.findUnique({ where: { barcodeValue: bcVal(raw) } });
        if (bc) {
          // a child barcode has no link of its own: walk up to the barcode that does
          let root = bc;
          for (let i = 0; i < 20 && root; i++) {
            const l = await prisma.barcodeJobLink.findMany({ where: { barcodeId: root.id }, select: { barcodeId: true, jobNo: true } });
            if (l.length) { links = l; break; }
            root = root.parentId ? await prisma.traceBarcode.findUnique({ where: { id: root.parentId } }) : null;
          }
          viaBarcode = bc.barcodeValue;
          jobNos = [...new Set(links.map((l) => l.jobNo).filter(Boolean))];
        }
      }
      const ids = [...new Set(links.map((l) => l.barcodeId))];
      const barcodes = [];
      for (const id of ids) {
        const bc = await prisma.traceBarcode.findUnique({ where: { id } });
        const [chain, members] = await Promise.all([loadChain(prisma, bc),
          prisma.barcodeMember.findMany({ where: { barcodeId: id }, orderBy: [{ submissionId: 'asc' }, { position: 'asc' }] })]);
        barcodes.push({
          value: bc.barcodeValue, status: bc.status, createdAt: bc.createdAt,
          stageEvents: chain.stageEvents.map((e) => ({ stage: e.stage, recordKey: e.recordKey, submissionId: e.submissionId, scannedAt: e.scannedAt, scannedByUser: e.scannedByUser, locationNote: e.locationNote, weight: e.weight })),
          children: chain.children.map((c) => ({ value: c.barcodeValue, status: c.status })),
          members: members.map((m) => ({ value: m.memberValue, sizeRange: m.sizeRange, weight: m.weight })),
        });
      }
      res.json({ ok: true, jobNos, viaBarcode, barcodes });
    } catch (e) { console.error('traceability job failed', e); bad(res, 'job lookup failed', 500); }
  });

  app.get('/api/traceability/history/:barcodeValue', async (req, res) => {
    try {
      const bc = await prisma.traceBarcode.findUnique({ where: { barcodeValue: bcVal(req.params.barcodeValue) } });
      if (!bc) return bad(res, 'Unknown barcode', 404);
      const [own, ancestors, members] = await Promise.all([loadChain(prisma, bc), ancestry(prisma, bc),
        prisma.barcodeMember.findMany({ where: { barcodeId: bc.id }, orderBy: [{ submissionId: 'asc' }, { position: 'asc' }] })]);
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
        members: members.map((m) => ({ value: m.memberValue, submissionId: m.submissionId, sizeRange: m.sizeRange, weight: m.weight })),
      });
    } catch (e) { console.error('traceability history failed', e); bad(res, 'history failed', 500); }
  });
}

// Intake link, driven by the save itself: when a SUBMITTED REC 7.1.2 entry carries a lotBarcode, register the barcode
// and link it to that submission (one scan = identify the job + log the stage; the form needs no second call).
// Idempotent per (barcode, submission, stage), so re-saves add nothing. Never deletes. A code already linked at intake
// to a different submission, or one that is split/retired, is skipped and logged rather than failing the save.
const INTAKE = { key: 'formrecord:abalone-receiving', recordKey: 'abalone-receiving', field: 'lotBarcode' };

async function syncLotBarcodes(prisma, key, value) {
  if (key !== INTAKE.key) return;
  let entries;
  try { entries = JSON.parse(value); } catch (_) { return; }
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || !entry.id || (entry.status != null && entry.status !== 'submitted')) continue;
    const values = entry.values || entry;
    const code = bcVal(values[INTAKE.field]);
    if (!code || code.length > 40) continue;
    const submissionId = String(entry.id);
    let bc = await prisma.traceBarcode.findUnique({ where: { barcodeValue: code } });
    if (bc && bc.status !== 'active') { console.warn('lot barcode ' + code + ' is ' + bc.status + '; not linked to ' + submissionId); continue; }
    if (bc) {
      const prior = await prisma.barcodeJobLink.findFirst({ where: { barcodeId: bc.id, stage: 'intake' } });
      if (prior && prior.submissionId === submissionId) { await syncMembers(prisma, bc.id, submissionId, entry); continue; }
      if (prior) { console.warn('lot barcode ' + code + ' already linked at intake to ' + prior.submissionId + '; not linked to ' + submissionId); continue; }
    } else {
      bc = await prisma.traceBarcode.create({ data: { barcodeValue: code } });
    }
    const stamp = { barcodeId: bc.id, stage: 'intake', recordKey: INTAKE.recordKey, submissionId };
    await prisma.$transaction([
      prisma.barcodeJobLink.create({ data: { ...stamp, jobNo: clean(values.jobNo) || null } }),
      prisma.barcodeStageEvent.create({ data: stamp }),
    ]);
    await syncMembers(prisma, bc.id, submissionId, entry);
  }
}

// The main barcode's list of scanned basket barcodes, mirrored from the submitted roster so other areas can link a
// basket code back to its main barcode (GET /api/traceability/member/:value). The same farm basket code can recur on
// later deliveries, so uniqueness is per (main barcode, basket), and a lookup returns every main barcode holding it.
async function syncMembers(prisma, barcodeId, submissionId, entry) {
  const rows = Array.isArray(entry.roster) ? entry.roster : [];
  const seen = new Set();
  const data = [];
  rows.forEach((r, i) => {
    const v = bcVal(r && r.basketNr);
    if (!v || v.length > 40 || seen.has(v)) return;
    seen.add(v);
    const w = Number(r.wholeWeight);
    data.push({ barcodeId, submissionId, memberValue: v, position: i, sizeRange: clean(r.sizeRange) || null, weight: r.wholeWeight !== '' && r.wholeWeight != null && Number.isFinite(w) ? w : null });
  });
  await prisma.$transaction([
    prisma.barcodeMember.deleteMany({ where: { barcodeId, submissionId, memberValue: { notIn: [...seen] } } }),
    prisma.barcodeMember.createMany({ data, skipDuplicates: true }),
  ]);
}

module.exports = { mount, syncLotBarcodes, STAGES };
