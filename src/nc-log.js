// Non-Conformance Log: table nc_log (spec: Claude outputs/nc-log-page-instructions.md).
//
// raisedBy / closedBy are client-asserted names (see the auth note in index.js), so they record
// who said they did it, not a verified identity.
//
// Email alert: every NC, from any record, is mailed to NC_EMAIL_RECIPIENTS.
// Needs SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / NC_EMAIL_FROM on the API service; when
// SMTP_HOST is unset the alert is skipped with a log line and the NC still saves.
const nodemailer = require('nodemailer');

const STATUSES = ['open', 'in_progress', 'closed'];
const SITE_URL = (process.env.SITE_URL || 'https://processing-department.onrender.com').replace(/\/$/, '');

const str = (v, max) => {
  const s = v == null ? '' : String(v).trim();
  return s ? s.slice(0, max || 2000) : null;
};
// "REC 7.4.2", "rec-7.4.2" -> "REC-7.4.2" so the trigger list matches however it was typed
// "Raise a CAR?" answer: true/false/'yes'/'no'; anything else -> null (not answered)
const yesNo = (v) => (v === true || /^(yes|true|y)$/i.test(String(v)) ? true : v === false || /^(no|false|n)$/i.test(String(v)) ? false : null);
const normRecord = (v) => { const s = str(v, 40); return s ? s.toUpperCase().replace(/^REC[\s_-]*/, 'REC-') : null; };

function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  const z = new Date(new Date(d).toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
  return `${p(z.getDate())}/${p(z.getMonth() + 1)}/${z.getFullYear()} ${p(z.getHours())}:${p(z.getMinutes())}`;
}

let transport = null;
function mailer() {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

async function sendNCAlert(nc) {
  const to = (process.env.NC_EMAIL_RECIPIENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const t = mailer();
  if (!t || !to.length) { console.warn(`NC alert for ${nc.ncRef} skipped: SMTP_HOST or NC_EMAIL_RECIPIENTS not set`); return; }
  const link = `${SITE_URL}/pages/nc-log.html`;
  const rows = [
    ['NC Reference', nc.ncRef], ['Record', nc.recordRef || '—'], ['Job number', nc.jobNumber || '—'], ['Date/Time', fmtDate(nc.raisedAt)],
    ['Raised by', nc.raisedBy], ['Category', nc.category], ['CAR required', nc.carRequired ? 'YES — a CAR must be raised' : 'No'],
  ];
  const ca = nc.correctiveAction || '(none yet — update the NC log when resolved)';
  const text = 'Non-Conformance raised on Dry Monitoring record.\n\n'
    + rows.map(([k, v]) => `${(k + ':').padEnd(14)} ${v}`).join('\n')
    + `\nDescription:\n  ${nc.description}\n\nCorrective action logged:\n  ${ca}\n\n`
    + `View the NC log: ${link}\n\n---\nAbagold Processing Facility — Automated Alert\n`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = '<p>Non-Conformance raised.</p><table cellpadding="3">'
    + rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')
    + `</table><p><b>Description:</b><br>${esc(nc.description)}</p>`
    + `<p><b>Corrective action logged:</b><br>${esc(ca)}</p>`
    + `<p><a href="${link}">View the NC log</a></p><hr><p style="color:#666">Abagold Processing Facility — Automated Alert</p>`;
  await t.sendMail({
    from: process.env.NC_EMAIL_FROM || process.env.SMTP_USER, to,
    subject: `⚠ NC Raised${nc.carRequired ? ' (CAR REQUIRED)' : ''} — ${nc.recordRef || 'record'} [Job: ${nc.jobNumber || '—'}] — ${nc.ncRef}`,
    text, html,
  });
}

function mount(app, prisma) {
  const T = prisma.ncLog;

  app.get('/api/nc/count-open', async (req, res) => {
    try { res.json({ openNCs: await T.count({ where: { status: { not: 'closed' } } }) }); }
    catch (e) { console.error('GET nc count failed', e); res.status(500).json({ ok: false }); }
  });

  app.get('/api/nc', async (req, res) => {
    const q = req.query;
    const where = {};
    if (q.status && q.status !== 'all') where.status = String(q.status);
    if (q.ref) where.ncRef = { in: String(q.ref).split(',').map((x) => x.trim()).filter(Boolean) };
    if (q.job) where.jobNumber = { contains: String(q.job).trim(), mode: 'insensitive' };
    if (q.record) where.recordRef = { contains: String(q.record).trim(), mode: 'insensitive' };
    const from = q.from ? new Date(q.from) : null;
    const to = q.to ? new Date(q.to) : null;
    if (to && !isNaN(to)) to.setUTCHours(23, 59, 59, 999); // inclusive of the "to" day
    if ((from && !isNaN(from)) || (to && !isNaN(to))) {
      where.raisedAt = {};
      if (from && !isNaN(from)) where.raisedAt.gte = from;
      if (to && !isNaN(to)) where.raisedAt.lte = to;
    }
    const take = Math.min(Math.max(parseInt(q.limit, 10) || 100, 1), 1000);
    const skip = Math.max(parseInt(q.offset, 10) || 0, 0);
    try { res.json(await T.findMany({ where, orderBy: { raisedAt: 'desc' }, take, skip })); }
    catch (e) { console.error('GET nc list failed', e); res.status(500).json({ ok: false }); }
  });

  app.post('/api/nc', async (req, res) => {
    const b = req.body || {};
    const data = {
      jobNumber: str(b.job_number, 40),
      recordRef: normRecord(b.record_ref),
      submissionId: str(b.submission_id, 80),
      raisedBy: str(b.raised_by, 120),
      category: str(b.category, 80),
      description: str(b.description, 4000),
      carRequired: yesNo(b.car_required),
      correctiveAction: str(b.corrective_action, 4000),
    };
    if (!data.raisedBy || !data.category || !data.description) {
      return res.status(400).json({ ok: false, error: 'raised_by, category and description are required' });
    }
    if (data.carRequired === null) return res.status(400).json({ ok: false, error: 'car_required is required (yes or no)' });
    try {
      const [{ n }] = await prisma.$queryRaw`SELECT nextval('nc_ref_seq')::int AS n`;
      data.ncRef = `NC-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
      const nc = await T.create({ data });
      sendNCAlert(nc).catch((e) => console.error(`NC alert for ${nc.ncRef} failed`, e)); // never block the save on mail
      res.status(201).json(nc);
    } catch (e) { console.error('POST nc failed', e); res.status(500).json({ ok: false }); }
  });

  app.patch('/api/nc/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ ok: false, error: 'bad id' });
    const b = req.body || {};
    const data = {};
    if ('corrective_action' in b) data.correctiveAction = str(b.corrective_action, 4000);
    if ('notes' in b) data.notes = str(b.notes, 4000);
    if ('car_required' in b) { data.carRequired = yesNo(b.car_required); if (data.carRequired === null) return res.status(400).json({ ok: false, error: 'invalid car_required' }); }
    if ('car_ref' in b) data.carRef = str(b.car_ref, 80);
    if ('closed_by' in b) data.closedBy = str(b.closed_by, 120);
    if ('status' in b) {
      if (!STATUSES.includes(b.status)) return res.status(400).json({ ok: false, error: 'invalid status' });
      data.status = b.status;
    }
    try {
      const cur = await T.findUnique({ where: { id } });
      if (!cur) return res.status(404).json({ ok: false, error: 'not found' });
      // the more severe process: an NC that needs a CAR cannot be closed until the CAR is referenced
      const carNeeded = 'carRequired' in data ? data.carRequired : cur.carRequired;
      const carRef = 'carRef' in data ? data.carRef : cur.carRef;
      if (data.status === 'closed' && carNeeded && !carRef) return res.status(400).json({ ok: false, error: 'a CAR is required: enter the CAR reference before closing this NC' });
      if (data.status === 'closed' && cur.status !== 'closed') data.closedAt = new Date();
      if (data.status && data.status !== 'closed') { data.closedAt = null; data.closedBy = null; }
      res.json(await T.update({ where: { id }, data }));
    } catch (e) { console.error('PATCH nc failed', e); res.status(500).json({ ok: false }); }
  });
}

module.exports = { mount, sendNCAlert };
