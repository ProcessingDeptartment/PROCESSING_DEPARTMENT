// Field specifications: table field_specs (spec: MD/field-specifications-system-instructions.md).
//   GET    /api/record-defs                 [{ record_key, doc_code, title }] for the admin record picker
//   GET    /api/specs/:recordKey            all active specs for a record (?all=1 includes deactivated, for the admin page)
//   GET    /api/specs/:recordKey/:fieldKey  one spec
//   GET    /api/specs/:id/versions          version history, newest first
//   POST   /api/specs                       create   (admin)
//   PATCH  /api/specs/:id                   update   (admin)
//   DELETE /api/specs/:id                   soft delete: active = false (admin)
// Every write must carry change_reason, published_by and changed_by_title (as the old SpecRegistry required). Each write
// bumps version_number and stores a field_spec_versions row; the previous PUBLISHED version becomes OBSOLETE.
// Writes need X-Role ADMINISTRATOR or QA_MANAGER (same trust level as src/passkeys.js). After any change, re-run
// scripts/export-record-defs.mjs so the static record-def snapshots carry the new `spec` objects.
const GATES = ['none', 'warn_submit', 'double_sign', 'hard_block'];
const SEVERITIES = ['minor', 'major', 'critical'];

// same people who could edit the old Specifications page
const EDIT_ROLES = ['ADMINISTRATOR', 'QA_MANAGER'];
const isAdmin = (req) => EDIT_ROLES.includes(req.get('x-role') || '');
const str = (v, max) => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, max || 500) : null; };
const num = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

// who/why for a write (required, like SpecRegistry.proposeVersion). Throws Error(message).
function parseMeta(b) {
  const m = { changeReason: str(b.change_reason, 1000), publishedBy: str(b.published_by, 200), changedByTitle: str(b.changed_by_title, 200) };
  if (!m.changeReason) throw new Error('A change reason is required.');
  if (!m.publishedBy) throw new Error('Your name is required.');
  if (!m.changedByTitle) throw new Error('Your title is required.');
  return m;
}

// DB row -> API shape (snake_case, numbers not Decimals)
const out = (r) => ({
  id: r.id, record_key: r.recordKey, field_key: r.fieldKey,
  spec_min: r.specMin == null ? null : Number(r.specMin), spec_max: r.specMax == null ? null : Number(r.specMax),
  allowed_values: r.allowedValues, highlight_red: r.highlightRed, show_warning_bubble: r.showWarningBubble,
  gate_mode: r.gateMode, auto_nc: r.autoNc, nc_category: r.ncCategory, nc_severity: r.ncSeverity,
  nc_optional_skip: r.ncOptionalSkip, label_override: r.labelOverride, notes: r.notes, active: r.active,
  version_number: r.versionNumber, created_at: r.createdAt, updated_at: r.updatedAt,
});

// Body -> Prisma data. Only keys present in the body are returned (so PATCH is partial). Throws Error(message) on bad input.
function parseBody(b) {
  const d = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  for (const [k, col] of [['spec_min', 'specMin'], ['spec_max', 'specMax']]) {
    if (!has(k)) continue;
    const n = num(b[k]);
    if (Number.isNaN(n)) throw new Error(k + ' must be a number');
    d[col] = n;
  }
  if (d.specMin != null && d.specMax != null && d.specMin > d.specMax) throw new Error('spec_min cannot be greater than spec_max');
  if (has('allowed_values')) d.allowedValues = str(b.allowed_values, 2000);
  for (const [k, col] of [['highlight_red', 'highlightRed'], ['show_warning_bubble', 'showWarningBubble'], ['auto_nc', 'autoNc'],
    ['nc_optional_skip', 'ncOptionalSkip'], ['active', 'active']]) if (has(k)) d[col] = b[k] === true || b[k] === 'true' || b[k] === 1;
  if (has('gate_mode')) { if (!GATES.includes(b.gate_mode)) throw new Error('gate_mode must be one of ' + GATES.join(' | ')); d.gateMode = b.gate_mode; }
  if (has('nc_severity')) { if (!SEVERITIES.includes(b.nc_severity)) throw new Error('nc_severity must be one of ' + SEVERITIES.join(' | ')); d.ncSeverity = b.nc_severity; }
  if (has('nc_category')) d.ncCategory = str(b.nc_category, 120);
  if (has('label_override')) d.labelOverride = str(b.label_override, 200);
  if (has('notes')) d.notes = str(b.notes, 4000);
  return d;
}

// every field / roster-column key in an assembled record config
function configFieldKeys(cfg) {
  const keys = new Set();
  const add = (list) => (list || []).forEach((f) => { if (f && f.key) keys.add(f.key); });
  add(cfg.fields); add(cfg.entryFields);
  (cfg.sections || []).forEach((s) => add(s.fields));
  if (cfg.roster) add(cfg.roster.columns);
  (cfg.rosters || []).forEach((r) => add(r.columns));
  return keys;
}

const versionOut = (v) => ({ id: v.id, spec_id: v.specId, version_number: v.versionNumber, status: v.status, snapshot: v.snapshot,
  change_reason: v.changeReason, published_by: v.publishedBy, changed_by_title: v.changedByTitle, published_at: v.publishedAt });

// Record a new version for a spec row inside a transaction: older PUBLISHED versions become OBSOLETE.
async function writeVersion(tx, row, meta) {
  await tx.fieldSpecVersion.updateMany({ where: { specId: row.id, status: 'PUBLISHED' }, data: { status: 'OBSOLETE' } });
  await tx.fieldSpecVersion.create({ data: { specId: row.id, recordKey: row.recordKey, fieldKey: row.fieldKey, versionNumber: row.versionNumber,
    status: 'PUBLISHED', snapshot: out(row), changeReason: meta.changeReason, publishedBy: meta.publishedBy, changedByTitle: meta.changedByTitle } });
}

function mount(app, prisma, assembleRecordConfig) {
  const T = prisma.fieldSpec;
  const fail = (res, what, e) => { console.error(what + ' failed', e); res.status(500).json({ error: what + ' failed' }); };

  // record picker for pages/spec-admin.html
  app.get('/api/record-defs', async (req, res) => {
    try {
      const rows = await prisma.recordDefinition.findMany({ select: { recordKey: true, docCode: true, title: true }, orderBy: { recordKey: 'asc' } });
      res.json(rows.map((r) => ({ record_key: r.recordKey, doc_code: r.docCode, title: r.title })));
    } catch (e) { fail(res, 'GET record-defs', e); }
  });

  app.get('/api/specs/:recordKey', async (req, res) => {
    try {
      const rows = await T.findMany({ where: { recordKey: req.params.recordKey, ...(req.query.all ? {} : { active: true }) }, orderBy: { id: 'asc' } });
      res.json(rows.map(out));
    } catch (e) { fail(res, 'GET specs', e); }
  });

  app.get('/api/specs/:id/versions', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Bad id' });
    try {
      const rows = await prisma.fieldSpecVersion.findMany({ where: { specId: id }, orderBy: { versionNumber: 'desc' } });
      res.json(rows.map(versionOut));
    } catch (e) { fail(res, 'GET spec versions', e); }
  });

  app.get('/api/specs/:recordKey/:fieldKey', async (req, res) => {
    try {
      const r = await T.findUnique({ where: { recordKey_fieldKey: { recordKey: req.params.recordKey, fieldKey: req.params.fieldKey } } });
      if (!r) return res.status(404).json({ error: 'No spec for that field' });
      res.json(out(r));
    } catch (e) { fail(res, 'GET spec', e); }
  });

  app.post('/api/specs', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'QA manager or administrator access required' });
    const b = req.body || {};
    const recordKey = str(b.record_key, 200), fieldKey = str(b.field_key, 200);
    if (!recordKey || !fieldKey) return res.status(400).json({ error: 'record_key and field_key are required' });
    try {
      const built = await assembleRecordConfig(prisma, recordKey);
      if (!built) return res.status(400).json({ error: 'Unknown record_key: ' + recordKey });
      if (!configFieldKeys(built.config).has(fieldKey)) return res.status(400).json({ error: `Field "${fieldKey}" does not exist in record ${recordKey}` });
      let data, meta;
      try { data = parseBody(b); meta = parseMeta(b); } catch (e) { return res.status(400).json({ error: e.message }); }
      if (await T.findUnique({ where: { recordKey_fieldKey: { recordKey, fieldKey } } })) {
        return res.status(409).json({ error: 'A spec already exists for this field - edit it instead' });
      }
      const row = await prisma.$transaction(async (tx) => {
        const r = await tx.fieldSpec.create({ data: { recordKey, fieldKey, ...data, versionNumber: 1 } });
        await writeVersion(tx, r, meta);
        return r;
      });
      res.status(201).json(out(row));
    } catch (e) { fail(res, 'POST spec', e); }
  });

  app.patch('/api/specs/:id', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'QA manager or administrator access required' });
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Bad id' });
    try {
      const cur = await T.findUnique({ where: { id } });
      if (!cur) return res.status(404).json({ error: 'Spec not found' });
      let data, meta;
      try { data = parseBody(req.body || {}); meta = parseMeta(req.body || {}); } catch (e) { return res.status(400).json({ error: e.message }); }
      const min = 'specMin' in data ? data.specMin : (cur.specMin == null ? null : Number(cur.specMin));
      const max = 'specMax' in data ? data.specMax : (cur.specMax == null ? null : Number(cur.specMax));
      if (min != null && max != null && min > max) return res.status(400).json({ error: 'spec_min cannot be greater than spec_max' });
      const row = await prisma.$transaction(async (tx) => {
        const r = await tx.fieldSpec.update({ where: { id }, data: { ...data, versionNumber: cur.versionNumber + 1, updatedAt: new Date() } });
        await writeVersion(tx, r, meta);
        return r;
      });
      res.json(out(row));
    } catch (e) { fail(res, 'PATCH spec', e); }
  });

  app.delete('/api/specs/:id', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'QA manager or administrator access required' });
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Bad id' });
    try {
      const cur = await T.findUnique({ where: { id } });
      if (!cur) return res.status(404).json({ error: 'Spec not found' });
      let meta;
      try { meta = parseMeta(req.body || {}); } catch (e) { return res.status(400).json({ error: e.message }); }
      await prisma.$transaction(async (tx) => {
        const r = await tx.fieldSpec.update({ where: { id }, data: { active: false, versionNumber: cur.versionNumber + 1, updatedAt: new Date() } });
        await writeVersion(tx, r, meta);
      });
      res.json({ deleted: true });
    } catch (e) { fail(res, 'DELETE spec', e); }
  });
}

module.exports = { mount, configFieldKeys };
