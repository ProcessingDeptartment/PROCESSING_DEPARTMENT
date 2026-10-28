// API routes for the document cross-reference registry.
// GET  /api/refs/by-source?type=sop&key=SOP-7.4.1   — targets this source references
// GET  /api/refs/by-target?type=record&key=REC-7.4.1 — sources that reference this target
// POST /api/refs/sync                                 — replace all refs for a source (on save)
// POST /api/refs/rescan-all                           — rescan all SOPs (admin, rate-limited)

const express = require('express');

let lastRescan = 0;
const RESCAN_COOLDOWN_MS = 60 * 1000;

module.exports = function mountRefsRoutes(app, prisma, { canManage } = {}) {
  // GET /api/refs/by-source?type=sop&key=SOP-7.4.1
  app.get('/api/refs/by-source', async (req, res) => {
    const { type, key } = req.query;
    if (!type || !key) return res.status(400).json({ error: 'type and key required' });
    try {
      const rows = await prisma.documentReference.findMany({
        where: { sourceType: type, sourceKey: key },
        orderBy: { targetKey: 'asc' },
        select: { targetType: true, targetKey: true, targetLabel: true, contextText: true }
      });
      res.json(rows);
    } catch (e) {
      console.error('GET /api/refs/by-source failed', e);
      res.status(500).json([]);
    }
  });

  // GET /api/refs/by-target?type=record&key=REC-7.4.1
  app.get('/api/refs/by-target', async (req, res) => {
    const { type, key } = req.query;
    if (!type || !key) return res.status(400).json({ error: 'type and key required' });
    try {
      const rows = await prisma.documentReference.findMany({
        where: { targetType: type, targetKey: key },
        orderBy: { sourceKey: 'asc' },
        select: { sourceType: true, sourceKey: true, sourceTitle: true, contextText: true }
      });
      res.json(rows);
    } catch (e) {
      console.error('GET /api/refs/by-target failed', e);
      res.status(500).json([]);
    }
  });

  // POST /api/refs/sync — replaces all refs for one source atomically
  // Body: { sourceType, sourceKey, sourceTitle, refs: [{targetType, targetKey, targetLabel, contextText}] }
  app.post('/api/refs/sync', async (req, res) => {
    if (canManage && !canManage(req)) return res.status(403).json({ ok: false, error: 'forbidden' });
    const { sourceType, sourceKey, sourceTitle, refs } = req.body || {};
    if (!sourceType || !sourceKey || !Array.isArray(refs)) {
      return res.status(400).json({ ok: false, error: 'sourceType, sourceKey and refs[] required' });
    }
    try {
      const rows = refs.map(r => ({
        sourceType,
        sourceKey,
        sourceTitle: sourceTitle || null,
        targetType:  r.targetType,
        targetKey:   r.targetKey,
        targetLabel: r.targetLabel || null,
        contextText: r.contextText || null,
        updatedAt:   new Date()
      }));
      await prisma.$transaction([
        prisma.documentReference.deleteMany({ where: { sourceType, sourceKey } }),
        ...(rows.length ? [prisma.documentReference.createMany({ data: rows })] : [])
      ]);
      res.json({ ok: true, count: rows.length });
    } catch (e) {
      console.error('POST /api/refs/sync failed', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/refs/rescan-all — admin, rate-limited to 1/min
  // Triggers a fresh extraction for all SOPs stored as sop_doc: keys
  app.post('/api/refs/rescan-all', async (req, res) => {
    if (canManage && !canManage(req)) return res.status(403).json({ ok: false, error: 'forbidden' });
    const now = Date.now();
    if (now - lastRescan < RESCAN_COOLDOWN_MS) {
      return res.status(429).json({ ok: false, error: 'Rate limited — wait 1 minute between rescans' });
    }
    lastRescan = now;

    // Fire async; respond immediately so the client doesn't wait
    res.json({ ok: true, message: 'Rescan started — check back in a few seconds' });

    try {
      const { extractReferences } = await import('../public/lib/ref-extractor.js');
      const sopRows = await prisma.keyValue.findMany({
        where: { key: { startsWith: 'sop_doc:' } }
      });
      let count = 0;
      for (const row of sopRows) {
        const sourceKey = row.key.replace(/^sop_doc:/, '');
        let doc;
        try { doc = JSON.parse(row.value); } catch { continue; }
        const text = [
          doc.sections?.objective, doc.sections?.roles,
          doc.sections?.process, doc.sections?.review
        ].filter(Boolean).join(' ');
        const rawRefs = extractReferences(text);
        const refs = rawRefs.map(r => ({
          targetType: r.targetType, targetKey: r.targetKey,
          targetLabel: r.targetKey, contextText: r.contextText
        }));
        await prisma.$transaction([
          prisma.documentReference.deleteMany({ where: { sourceType: 'sop', sourceKey } }),
          ...(refs.length ? [prisma.documentReference.createMany({
            data: refs.map(r => ({ sourceType: 'sop', sourceKey, ...r, updatedAt: new Date() }))
          })] : [])
        ]);
        count++;
      }
      console.log(`refs rescan-all complete: ${count} SOPs processed`);
    } catch (e) {
      console.error('refs rescan-all failed', e);
    }
  });

  // POST /api/refs/flag-review — mark refs needing review when a record def changes
  // Called internally from the record-def save path; body: { targetType, targetKey }
  app.post('/api/refs/flag-review', async (req, res) => {
    if (canManage && !canManage(req)) return res.status(403).json({ ok: false, error: 'forbidden' });
    const { targetType, targetKey } = req.body || {};
    if (!targetType || !targetKey) return res.status(400).json({ ok: false });
    try {
      const result = await prisma.documentReference.updateMany({
        where: { targetType, targetKey },
        data: { needsReview: true, updatedAt: new Date() }
      });
      res.json({ ok: true, updated: result.count });
    } catch (e) {
      console.error('POST /api/refs/flag-review failed', e);
      res.status(500).json({ ok: false });
    }
  });
};
