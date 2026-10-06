// REC 7.4.2 Dry Monitoring: photos attached to problem answers (table sub_dry_monitoring_images).
//
// submissionId is the entry's text id ("entry_..."). The client allocates it when the form opens,
// so photos can be uploaded before the first Save Draft; a row in sub_dry_monitoring is therefore
// not required (and could not be: that table is rebuilt on every save, see the migration).
//
// Who may delete: the X-User/X-Role headers are client-asserted (see the auth note in index.js),
// so this is a guard against slips, not a security boundary.
const { assembleRecordConfig } = require('./record-def');

const RECORD_KEY = 'dry-monitoring';
const MAX_BYTES = 2 * 1024 * 1024;     // base64 length; over this is refused
const WARN_BYTES = 1400000;            // ~1 MB binary after base64 overhead
const MAX_PER_FIELD = 10;
const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const SUPERVISOR_ROLE = /SUPERVISOR|MANAGER|ADMIN/i;
const ID_RE = /^[A-Za-z0-9_\-]{1,80}$/;

let fieldCache = { at: 0, keys: null };
async function yesNoKeys(prisma) {
  if (fieldCache.keys && Date.now() - fieldCache.at < 5 * 60 * 1000) return fieldCache.keys;
  const cfg = await assembleRecordConfig(prisma, RECORD_KEY);
  const keys = new Set(((cfg && cfg.entryFields) || []).filter((f) => f.type === 'yesno' && f.redPrompt).map((f) => f.key));
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
      const keys = await yesNoKeys(prisma);
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

module.exports = { mount };
