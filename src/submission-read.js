// Read API over the per-record sub_* tables, so pages can ask "submitted OOSW for job X" instead of
// downloading the whole formrecord:<key> blob and filtering in the browser.
//
//   GET /api/submissions/:recordKey?jobNo=3CP123&status=submitted&limit=50&full=1
//
// Read-only. Every row carries `id`, which opens the entry in its form: <record page>?entry=<id>.
// `full=1` adds the stored entry (values + roster + signOffs) parsed from rawJson.

const { getSchema, toTable } = require('./submission-store');

// The record's entries rebuilt from the table, in saved-list order (position), as the array the blob holds.
// Returns null when the table has no position column yet or any entry lacks a position (caller keeps using the blob).
async function entriesInOrder(prisma, recordKey) {
  const schema = await getSchema(prisma, recordKey);
  if (!schema || !schema.hasPosition) return null;
  const rows = await prisma.$queryRawUnsafe(`SELECT "rawJson", "position" FROM "${toTable(recordKey)}" ORDER BY "position" ASC NULLS LAST, "createdAt" ASC`);
  if (rows.some((r) => r.position == null || r.rawJson == null)) return null;
  try { return rows.map((r) => JSON.parse(r.rawJson)); } catch (e) { return null; }
}

module.exports = function mount(app, prisma) {
  app.get('/api/submissions/:recordKey', async (req, res) => {
    try {
      const recordKey = String(req.params.recordKey || '');
      if (!/^[a-z0-9][a-z0-9-]*$/.test(recordKey)) return res.status(400).json({ ok: false, error: 'bad recordKey' });
      const schema = await getSchema(prisma, recordKey);
      if (!schema) return res.status(404).json({ ok: false, error: 'unknown record' });

      const where = [];
      const params = [];
      const jobNo = req.query.jobNo != null ? String(req.query.jobNo).trim() : '';
      if (jobNo) {
        const jc = schema.topCols.find((c) => c.key === 'jobNo');
        if (!jc) return res.status(400).json({ ok: false, error: 'record has no jobNo field' });
        params.push(jobNo);
        where.push(`"${jc.col}" = $${params.length}`);
      }
      const status = req.query.status != null ? String(req.query.status) : '';
      if (status) {
        if (!['draft', 'submitted'].includes(status)) return res.status(400).json({ ok: false, error: 'bad status' });
        params.push(status);
        where.push(`"status" = $${params.length}`);
      }
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
      const full = req.query.full === '1';

      const rows = await prisma.$queryRawUnsafe(
        `SELECT "id", "status", "submittedAt", "createdAt", "updatedAt"${schema.hasPosition ? ', "position"' : ''}${full ? ', "rawJson"' : ''} FROM "${toTable(recordKey)}"` +
        (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
        (req.query.order === 'position' && schema.hasPosition ? ` ORDER BY "position" ASC LIMIT ${limit}` : ` ORDER BY COALESCE("submittedAt", "createdAt") DESC LIMIT ${limit}`),
        ...params
      );
      res.json({
        ok: true,
        recordKey,
        rows: rows.map((r) => {
          const o = { id: r.id, status: r.status, submittedAt: r.submittedAt, createdAt: r.createdAt, updatedAt: r.updatedAt, position: r.position == null ? null : r.position };
          if (full) { try { o.entry = JSON.parse(r.rawJson); } catch { o.entry = null; } }
          return o;
        }),
      });
    } catch (e) {
      console.error('GET submissions failed', e);
      res.status(500).json({ ok: false });
    }
  });
};
module.exports.entriesInOrder = entriesInOrder;
