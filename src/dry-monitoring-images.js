// REC 7.4.2 Dry Monitoring: photos attached to problem answers (table sub_dry_monitoring_images).
//
// submissionId is the entry's text id ("entry_..."). The client allocates it when the form opens,
// so photos can be uploaded before the first Save Draft; a row in sub_dry_monitoring is therefore
// not required (and could not be: that table is rebuilt on every save, see the migration).
//
// Who may delete: the X-User/X-Role headers are client-asserted (see the auth note in index.js),
// so this is a guard against slips, not a security boundary.
const crypto = require('crypto');
const { assembleRecordConfig } = require('./record-def');

const RECORD_KEY = 'dry-monitoring';
const MAX_BYTES = 2 * 1024 * 1024;     // base64 length; over this is refused
const WARN_BYTES = 1400000;            // ~1 MB binary after base64 overhead
const MAX_PER_FIELD = 10;
const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const SUPERVISOR_ROLE = /SUPERVISOR|MANAGER|ADMIN/i;
const ID_RE = /^[A-Za-z0-9_\-]{1,80}$/;

// Local archive agent (scripts/image-archive-agent.mjs). Its routes need ARCHIVE_API_KEY in the
// X-Archive-Key header; with the key unset they are closed (503), never open.
const ARCHIVE_API_KEY = process.env.ARCHIVE_API_KEY || '';
const MAX_ARCHIVE_ATTEMPTS = 5;
const ARCHIVE_PATHS = /^\/dry-monitoring\/images\/(pending-archive|archive-request|\d+\/mark-archived|\d+\/archive-error)$/;
function archiveKeyOk(req) {
  const k = req.get('x-archive-key') || '';
  if (!ARCHIVE_API_KEY || k.length !== ARCHIVE_API_KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ARCHIVE_API_KEY));
}
// used by the /api auth middleware (req.path there is relative to /api)
function isArchiveRequest(req) { return ARCHIVE_PATHS.test(req.path) && archiveKeyOk(req); }
function requireArchiveKey(req, res, next) {
  if (!ARCHIVE_API_KEY) return res.status(503).json({ ok: false, error: 'archive key not configured' });
  if (!archiveKeyOk(req)) return res.status(401).json({ ok: false, error: 'unauthorised' });
  next();
}

let fieldCache = { at: 0, keys: null };
async function yesNoKeys(prisma, fresh) {
  if (!fresh && fieldCache.keys && Date.now() - fieldCache.at < 5 * 60 * 1000) return fieldCache.keys;
  const out = await assembleRecordConfig(prisma, RECORD_KEY);
  const cfg = out && (out.config || out);   // { engine, version, config }
  const keys = new Set(((cfg && cfg.entryFields) || []).filter((f) => (f.type === 'yesno' && f.redPrompt) || (f.type === 'scored-select' && f.showPhotoWhenAbove != null)).map((f) => f.key));
  fieldCache = { at: Date.now(), keys };
  return keys;
}

const shape = (r, withData) => ({
  id: r.id, submissionId: r.submissionId, fieldKey: r.fieldKey,
  ...(withData ? { imageData: r.imageData } : {}),
  fileName: r.fileName, caption: r.caption, uploadedBy: r.uploadedBy,
  uploadedAt: r.uploadedAt, sortOrder: r.sortOrder,
});

function mount(app, prisma) {
  const T = prisma.subDryMonitoringImage;

  // counts per entry for the list column: { "<submissionId>": n }
  app.get('/api/dry-monitoring/images/counts', async (req, res) => {
    try {
      const rows = await T.groupBy({ by: ['submissionId'], _count: { _all: true } });
      const out = {};
      rows.forEach((r) => { out[r.submissionId] = r._count._all; });
      res.json(out);
    } catch (e) { console.error('image counts failed', e); res.status(500).json({ ok: false }); }
  });

  /* ---- local archive ---- */
  // oldest first, max 50; everything not yet archived (not "since last run"), so an agent that was
  // offline catches up on its next poll
  app.get('/api/dry-monitoring/images/pending-archive', requireArchiveKey, async (req, res) => {
    try {
      const since = req.query.since ? new Date(String(req.query.since)) : null;
      const rows = await T.findMany({
        where: { archivedLocally: false, archiveFailed: false, ...(since && !isNaN(since) ? { uploadedAt: { gte: since } } : {}) },
        orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }], take: 50,
      });
      res.json(rows.map((r) => ({ id: r.id, submissionId: r.submissionId, fieldKey: r.fieldKey, imageData: r.imageData,
        fileName: r.fileName, mimeType: r.mimeType, uploadedAt: r.uploadedAt, archiveAttempts: r.archiveAttempts })));
    } catch (e) { console.error('pending-archive failed', e); res.status(500).json({ ok: false }); }
  });

  app.post('/api/dry-monitoring/images/:imageId/mark-archived', requireArchiveKey, async (req, res) => {
    const id = Number(req.params.imageId);
    const path = String((req.body || {}).archivedPath || '').slice(0, 1000);
    if (!Number.isInteger(id) || !path) return res.status(400).json({ ok: false, error: 'imageId and archivedPath required' });
    try {
      await T.update({ where: { id }, data: { archivedLocally: true, archivedAt: new Date(), archivedPath: path } });
      res.json({ ok: true });
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ ok: false });
      console.error('mark-archived failed', e); res.status(500).json({ ok: false });
    }
  });

  app.post('/api/dry-monitoring/images/:imageId/archive-error', requireArchiveKey, async (req, res) => {
    const id = Number(req.params.imageId);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false });
    try {
      const row = await T.update({ where: { id }, data: { archiveAttempts: { increment: 1 } }, select: { archiveAttempts: true } });
      const failed = row.archiveAttempts >= MAX_ARCHIVE_ATTEMPTS;
      if (failed) await T.update({ where: { id }, data: { archiveFailed: true } });
      console.warn(`photo ${id} archive attempt ${row.archiveAttempts} failed: ${String((req.body || {}).error || '').slice(0, 300)}`);
      res.json({ ok: true, attempts: row.archiveAttempts, failed });
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ ok: false });
      console.error('archive-error failed', e); res.status(500).json({ ok: false });
    }
  });

  // "Archive now" (Home banner, administrator only). The flag lives in memory: if the API restarts
  // before the agent picks it up the click is simply lost, and the banner still shows the backlog.
  // The agent in --on-request mode polls GET (no DB hit) and archives when it sees a request.
  let archiveRequest = null;   // { at, by }
  let agentSeenAt = null;
  app.post('/api/dry-monitoring/images/archive-request', (req, res) => {
    if (!/ADMIN/i.test(req.get('x-role') || '')) return res.status(403).json({ ok: false, error: 'Administrator only.' });
    archiveRequest = { at: new Date(), by: String(req.get('x-user') || '').slice(0, 120) || null };
    res.json({ ok: true, requestedAt: archiveRequest.at, agentSeenAt });
  });
  app.get('/api/dry-monitoring/images/archive-request', requireArchiveKey, (req, res) => {
    agentSeenAt = new Date();
    const r = archiveRequest; archiveRequest = null;   // consumed: one click, one pass
    res.json({ requested: !!r, requestedAt: r ? r.at : null, by: r ? r.by : null });
  });

  // for the Home banner: is the agent keeping up?
  app.get('/api/dry-monitoring/images/archive-status', async (req, res) => {
    try {
      const [pending, failed, last] = await Promise.all([
        T.count({ where: { archivedLocally: false, archiveFailed: false } }),
        T.count({ where: { archiveFailed: true } }),
        T.findFirst({ where: { archivedLocally: true }, orderBy: { archivedAt: 'desc' }, select: { archivedAt: true } }),
      ]);
      res.json({ pending, failed, lastArchivedAt: last ? last.archivedAt : null,
        requestedAt: archiveRequest ? archiveRequest.at : null, agentSeenAt });
    } catch (e) { console.error('archive-status failed', e); res.status(500).json({ ok: false }); }
  });

  // admin: put failed photos back in the queue
  app.post('/api/dry-monitoring/images/archive-reset', async (req, res) => {
    if (!SUPERVISOR_ROLE.test(req.get('x-role') || '')) return res.status(403).json({ ok: false, error: 'Supervisor or manager only.' });
    try {
      const r = await T.updateMany({ where: { archiveFailed: true }, data: { archiveFailed: false, archiveAttempts: 0 } });
      res.json({ ok: true, reset: r.count });
    } catch (e) { console.error('archive-reset failed', e); res.status(500).json({ ok: false }); }
  });

  app.get('/api/dry-monitoring/:submissionId/images', async (req, res) => {
    const sid = String(req.params.submissionId || '');
    if (!ID_RE.test(sid)) return res.status(400).json({ ok: false, error: 'bad submission id' });
    try {
      const rows = await T.findMany({ where: { submissionId: sid }, orderBy: [{ fieldKey: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] });
      const out = {};
      rows.forEach((r) => { (out[r.fieldKey] = out[r.fieldKey] || []).push(shape(r, true)); });
      res.json(out);
    } catch (e) { console.error('image list failed', e); res.status(500).json({ ok: false }); }
  });

  app.post('/api/dry-monitoring/:submissionId/images', async (req, res) => {
    const sid = String(req.params.submissionId || '');
    const b = req.body || {};
    if (!ID_RE.test(sid)) return res.status(400).json({ ok: false, error: 'bad submission id' });
    try {
      let keys = await yesNoKeys(prisma);
      // a field missing from the cached list may be new (definition re-seeded): re-read it once before refusing
      if (!keys.has(String(b.fieldKey))) keys = await yesNoKeys(prisma, true);
      if (!keys.has(String(b.fieldKey))) return res.status(400).json({ ok: false, error: 'unknown field' });
      const data = String(b.imageData || '');
      if (!data.startsWith('data:image/')) return res.status(400).json({ ok: false, error: 'imageData must be a data:image/ URI' });
      if (data.length > MAX_BYTES) return res.status(413).json({ ok: false, error: 'image too large (max 2 MB)' });
      if (data.length > WARN_BYTES) console.warn(`dry-monitoring image for ${sid}/${b.fieldKey} is ${data.length} chars (over ~1 MB)`);
      const mime = String(b.mimeType || data.slice(5, data.indexOf(';'))).toLowerCase();
      if (!MIME_OK.includes(mime)) return res.status(400).json({ ok: false, error: 'unsupported image type' });
      const n = await T.count({ where: { submissionId: sid, fieldKey: b.fieldKey } });
      if (n >= MAX_PER_FIELD) return res.status(422).json({ ok: false, error: `Maximum ${MAX_PER_FIELD} photos per check` });
      const clip = (v, len) => (v == null || v === '' ? null : String(v).slice(0, len));
      const row = await T.create({ data: {
        submissionId: sid, fieldKey: b.fieldKey, imageData: data, mimeType: mime,
        fileName: clip(b.fileName, 200),
        fileSizeBytes: Number.isFinite(Number(b.fileSizeBytes)) ? Math.round(Number(b.fileSizeBytes)) : null,
        caption: clip(b.caption, 500),
        uploadedBy: clip(b.uploadedBy || req.get('x-user'), 120),
        sortOrder: n,
      } });
      res.status(201).json(shape(row, false));
    } catch (e) { console.error('image upload failed', e); res.status(500).json({ ok: false }); }
  });

  app.patch('/api/dry-monitoring/images/:imageId', async (req, res) => {
    const id = Number(req.params.imageId);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false });
    const b = req.body || {}, data = {};
    if ('caption' in b) data.caption = b.caption == null ? null : String(b.caption).slice(0, 500);
    if ('sortOrder' in b && Number.isInteger(Number(b.sortOrder))) data.sortOrder = Number(b.sortOrder);
    try {
      const row = await T.update({ where: { id }, data });
      res.json(shape(row, false));
    } catch (e) {
      if (e.code === 'P2025') return res.status(404).json({ ok: false });
      console.error('image patch failed', e); res.status(500).json({ ok: false });
    }
  });

  app.delete('/api/dry-monitoring/images/:imageId', async (req, res) => {
    const id = Number(req.params.imageId);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false });
    try {
      const row = await T.findUnique({ where: { id }, select: { uploadedBy: true } });
      if (!row) return res.status(404).json({ ok: false });
      const user = req.get('x-user') || '', role = req.get('x-role') || '';
      const own = !row.uploadedBy || (user && user === row.uploadedBy);
      if (!own && !SUPERVISOR_ROLE.test(role)) {
        return res.status(403).json({ ok: false, error: 'Only the person who added this photo or a supervisor can delete it.' });
      }
      await T.delete({ where: { id } });
      res.status(204).end();
    } catch (e) { console.error('image delete failed', e); res.status(500).json({ ok: false }); }
  });
}

module.exports = { mount, isArchiveRequest };
