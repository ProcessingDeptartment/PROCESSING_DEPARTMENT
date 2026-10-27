// Non-Conformance Log: table nc_log (spec: Claude outputs/nc-log-page-instructions.md).
//
// raisedBy / closedBy are client-asserted names (see the auth note in index.js), so they record
// who said they did it, not a verified identity.
//
// Email alert: every NC, from any record, is mailed to NC_EMAIL_RECIPIENTS.
// Needs SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / NC_EMAIL_FROM on the API service; when
// SMTP_HOST is unset the alert is skipped with a log line and the NC still saves.
const nodemailer = require('nodemailer');

const STATUSES = ['open', 'in_progress', 'ready_to_close', 'closed'];
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

// Source record of an open NC was amended: tell the NC recipients to review it.
async function sendNCRecordUpdateAlert(nc, updatedBy, updatedAt) {
  const to = (process.env.NC_EMAIL_RECIPIENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const t = mailer();
  if (!t || !to.length) { console.warn(`NC record-update alert for ${nc.ncRef} skipped: SMTP_HOST or NC_EMAIL_RECIPIENTS not set`); return; }
  const link = `${SITE_URL}/pages/nc-log.html?nc=${encodeURIComponent(nc.ncRef)}`;
  const rows = [['NC Reference', nc.ncRef], ['Record', nc.recordRef || '—'], ['Job number', nc.jobNumber || '—'],
    ['Updated by', updatedBy], ['Updated at', fmtDate(updatedAt)]];
  const text = 'A record linked to an open NC has been updated.\n\n'
    + rows.map(([k, v]) => `${(k + ':').padEnd(14)} ${v}`).join('\n')
    + `\n\nThe record correction may resolve this NC.\nPlease review and close the NC if the issue is resolved.\n\nView NC: ${link}\n\n---\nAbagold Processing Facility — Automated Alert\n`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = '<p>A record linked to an open NC has been updated.</p><table cellpadding="3">'
    + rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')
    + `</table><p>The record correction may resolve this NC. Please review and close the NC if the issue is resolved.</p>`
    + `<p><a href="${link}">View NC</a></p><hr><p style="color:#666">Abagold Processing Facility — Automated Alert</p>`;
  await t.sendMail({
    from: process.env.NC_EMAIL_FROM || process.env.SMTP_USER, to,
    subject: `🔄 Record Updated — Review NC ${nc.ncRef} [${nc.recordRef || 'record'} / Job: ${nc.jobNumber || '—'}]`,
    text, html,
  });
}

async function sendNCReadyToCloseAlert(nc, resolvedBy, resolvedAt) {
  const to = (process.env.NC_EMAIL_RECIPIENTS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const t = mailer();
  if (!t || !to.length) { console.warn(`NC ready-to-close alert for ${nc.ncRef} skipped: SMTP_HOST or NC_EMAIL_RECIPIENTS not set`); return; }
  const link = `${SITE_URL}/pages/nc-log.html?status=ready_to_close`;
  const rows = [
    ['NC Reference', nc.ncRef], ['Record', nc.recordRef || '—'], ['Job number', nc.jobNumber || '—'],
    ['Original issue', nc.description ? nc.description.slice(0, 120) : '—'],
    ['Resolution detected', fmtDate(resolvedAt) + (resolvedBy ? ' by ' + resolvedBy : '')],
  ];
  const text = 'Non-conformance is ready to close.\n\n'
    + rows.map(([k, v]) => `${(k + ':').padEnd(22)} ${v}`).join('\n')
    + `\n\nA new check shows the issue is resolved.\nReview the NC log, confirm the corrective action taken, and close this NC.\nYou only need to add a brief comment about what was actually done.\n\nView NC: ${link}\n\n---\nAbagold Processing Facility — Automated Alert\n`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = '<p>Non-conformance is ready to close.</p><table cellpadding="3">'
    + rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')
    + '</table><p>A new check shows the issue is resolved.</p>'
    + '<p>Review the NC log, confirm the corrective action taken, and close this NC.<br>You only need to add a brief comment about what was actually done.</p>'
    + `<p><a href="${link}">View NC log (ready to close)</a></p><hr><p style="color:#666">Abagold Processing Facility — Automated Alert</p>`;
  await t.sendMail({
    from: process.env.NC_EMAIL_FROM || process.env.SMTP_USER, to,
    subject: `✓ NC Ready to close — ${nc.ncRef} [${nc.jobNumber || '—'}]`,
    text, html,
  });
}

function mount(app, prisma) {
  const T = prisma.ncLog;

  app.get('/api/nc/count-open', async (req, res) => {
    try { res.json({ openNCs: await T.count({ where: { status: { in: ['open', 'in_progress', 'ready_to_close'] } } }) }); }
    catch (e) { console.error('GET nc count failed', e); res.status(500).json({ ok: false }); }
  });

  app.get('/api/nc', async (req, res) => {
    const q = req.query;
    const where = {};
    if (q.status && q.status !== 'all') where.status = String(q.status);
    if (q.submission_id) where.submissionId = String(q.submission_id).trim();
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

  app.get('/api/nc/:id/history', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ ok: false, error: 'bad id' });
    try { res.json(await prisma.ncAudit.findMany({ where: { ncId: id }, orderBy: { createdAt: 'desc' } })); }
    catch (e) { console.error('GET nc history failed', e); res.status(500).json({ ok: false }); }
  });

  // Called by the record form after a submitted record linked to NCs is amended. Open NCs move to
  // in_progress, get stamped with who/when, an audit row, and an email. Never closes an NC itself.
  app.post('/api/nc/record-updated', async (req, res) => {
    const b = req.body || {};
    const submissionId = str(b.submission_id, 80);
    if (!submissionId) return res.status(400).json({ ok: false, error: 'submission_id is required' });
    const by = str(b.updated_by, 120) || 'Unknown';
    const at = new Date();
    try {
      const ncs = await T.findMany({ where: { submissionId, status: { in: ['open', 'in_progress'] } } });
      for (const nc of ncs) {
        await T.update({ where: { id: nc.id }, data: { lastRecordUpdateAt: at, lastRecordUpdateBy: by, status: 'in_progress' } });
        await prisma.ncAudit.create({ data: { ncId: nc.id, action: 'record_updated', actor: by,
          note: `Record ${nc.recordRef || ''} (submission ${submissionId}) was updated — review if NC is resolved.`, createdAt: at } });
        sendNCRecordUpdateAlert(nc, by, at).catch((e) => console.error(`NC record-update alert for ${nc.ncRef} failed`, e));
      }
      res.json({ ok: true, updated: ncs.map((n) => n.ncRef) });
    } catch (e) { console.error('POST nc record-updated failed', e); res.status(500).json({ ok: false }); }
  });

  // Called after a record submission succeeds. Checks if any open NCs for the same job/record are now
  // resolved based on the ncResolutionCondition in the record definition. Updates matching NCs to
  // ready_to_close, fires an email alert, and returns the list for the frontend notification banner.
  app.post('/api/nc/check-resolution', async (req, res) => {
    const b = req.body || {};
    const recordRef = normRecord(b.record_ref);
    const jobNumber = str(b.job_number, 40);
    const submissionId = str(b.submission_id, 80);
    const values = b.values && typeof b.values === 'object' ? b.values : {};
    if (!recordRef) return res.status(400).json({ ok: false, error: 'record_ref is required' });

    // Load resolution condition from static record-def JSON
    let resolutionCondition = null;
    try {
      const path = require('path');
      const fs = require('fs');
      // recordRef is like 'REC-7.4.2'; map to recordKey by reading the JSON files
      const defsDir = path.join(__dirname, '..', 'public', 'data', 'record-defs');
      const files = fs.readdirSync(defsDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const def = JSON.parse(fs.readFileSync(path.join(defsDir, file), 'utf8'));
          if (def.docCode && normRecord(def.docCode) === recordRef && def.ncResolutionCondition) {
            resolutionCondition = def.ncResolutionCondition;
            break;
          }
        } catch { /* skip unreadable file */ }
      }
    } catch (e) { console.error('check-resolution: could not load record defs', e); }

    if (!resolutionCondition) {
      return res.json({ ncsReady: [], message: 'No resolution condition defined for this record.' });
    }

    // Evaluate: for dry monitoring, triggerField = 'batchStatus', resolved when value = 'Green'
    const triggerField = resolutionCondition.triggerField;
    const resolvedWhen = (resolutionCondition.resolvedWhen || '').toLowerCase();
    const fieldValue = String(values[triggerField] || '');
    // Parse resolved condition: supports "field = value" (case-insensitive value match)
    const resolvedMatch = resolvedWhen.match(/=\s*(.+)/);
    const resolvedValue = resolvedMatch ? resolvedMatch[1].trim() : null;
    const isResolved = resolvedValue ? fieldValue.toLowerCase() === resolvedValue.toLowerCase() : false;

    if (!isResolved) {
      return res.json({ ncsReady: [], message: `Condition not met (${triggerField} = ${fieldValue}).` });
    }

    try {
      const where = { status: { in: ['open', 'in_progress'] }, recordRef };
      if (jobNumber) where.jobNumber = jobNumber;
      const openNcs = await T.findMany({ where });
      if (!openNcs.length) return res.json({ ncsReady: [] });

      const now = new Date();
      const resolvedBy = str(req.get('x-user'), 120) || str(b.submitted_by, 120) || 'System';
      const readyNcs = [];
      for (const nc of openNcs) {
        await T.update({ where: { id: nc.id }, data: {
          status: 'ready_to_close',
          readyToCloseAt: now,
          resolutionCheckSubmittedId: submissionId || null,
          resolutionTriggerField: triggerField || null,
          readyToCloseNotes: `Auto-detected: ${triggerField} = ${fieldValue} on ${fmtDate(now)}${resolvedBy !== 'System' ? ' by ' + resolvedBy : ''}.`,
        } });
        await prisma.ncAudit.create({ data: {
          ncId: nc.id, action: 'status_changed', actor: 'System',
          note: `Status ${nc.status} → ready_to_close. ${triggerField} = ${fieldValue} detected on new submission (${submissionId || 'unknown'}).`,
          createdAt: now,
        } });
        sendNCReadyToCloseAlert(nc, resolvedBy !== 'System' ? resolvedBy : null, now)
          .catch((e) => console.error(`NC ready-to-close alert for ${nc.ncRef} failed`, e));
        readyNcs.push({
          nc_id: nc.id,
          nc_ref: nc.ncRef,
          job_number: nc.jobNumber,
          original_issue: (nc.description || '').slice(0, 200),
          current_status: `${triggerField} = ${fieldValue} — resolved`,
          message: `${triggerField} is now ${fieldValue}. This NC is ready to close.`,
        });
      }
      res.json({ ncsReady: readyNcs });
    } catch (e) { console.error('POST nc check-resolution failed', e); res.status(500).json({ ok: false }); }
  });

  app.post('/api/nc', async (req, res) => {
    const b = req.body || {};
    const sourceFieldKey = str(b.source_field_key, 120) || null;
    const data = {
      jobNumber: str(b.job_number, 40),
      recordRef: normRecord(b.record_ref),
      submissionId: str(b.submission_id, 80),
      raisedBy: str(b.raised_by, 120),
      category: str(b.category, 80),
      description: str(b.description, 4000),
      carRequired: yesNo(b.car_required),
      correctiveAction: str(b.corrective_action, 4000),
      sourceFieldKey,
    };
    if (!data.raisedBy || !data.category || !data.description) {
      return res.status(400).json({ ok: false, error: 'raised_by, category and description are required' });
    }
    if (data.carRequired === null) return res.status(400).json({ ok: false, error: 'car_required is required (yes or no)' });
    try {
      // Duplicate guard for ncOnYes auto-raises: one minor NC per (submissionId, sourceFieldKey).
      if (data.submissionId && sourceFieldKey) {
        const existing = await T.findFirst({ where: { submissionId: data.submissionId, sourceFieldKey, status: { not: 'closed' } } });
        if (existing) {
          console.log(`[nc] duplicate guard: NC ${existing.ncRef} already exists for submission ${data.submissionId} / field ${sourceFieldKey}`);
          return res.status(200).json({ ...existing, duplicate: true });
        }
      }
      const [{ n }] = await prisma.$queryRaw`SELECT nextval('nc_ref_seq')::int AS n`;
      data.ncRef = `NC-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
      const nc = await T.create({ data });
      prisma.ncAudit.create({ data: { ncId: nc.id, action: 'raised', actor: nc.raisedBy, note: 'NC opened.' } }).catch((e) => console.error('nc audit failed', e));
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
      // closing a ready_to_close NC: require corrective_action
      if (data.status === 'closed' && cur.status === 'ready_to_close') {
        const ca = 'corrective_action' in b ? str(b.corrective_action, 4000) : cur.correctiveAction;
        if (!ca) return res.status(400).json({ ok: false, error: 'corrective_action is required when closing this NC' });
      }
      const upd = await T.update({ where: { id }, data });
      if (data.status && data.status !== cur.status) {
        const actor = (data.status === 'closed' ? data.closedBy : null) || str(req.get('x-user'), 120) || 'Unknown';
        prisma.ncAudit.create({ data: { ncId: id, action: data.status === 'closed' ? 'closed' : 'status_changed', actor,
          note: `Status ${cur.status} → ${data.status}.` } }).catch((e) => console.error('nc audit failed', e));
      }
      res.json(upd);
    } catch (e) { console.error('PATCH nc failed', e); res.status(500).json({ ok: false }); }
  });
}

module.exports = { mount, sendNCAlert, sendNCRecordUpdateAlert, sendNCReadyToCloseAlert };
