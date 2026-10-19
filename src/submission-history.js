// Per-entry audit trail for formrecord:* / monitoring_log:* records.
//
// KeyValueHistory stores the WHOLE list before and after every save, so it grows with (saves x list size).
// SubmissionHistory stores only the entries that actually changed: one row per added / changed / removed entry,
// with that entry's JSON before and after. It is written in the same transaction as the save (inside a savepoint,
// so a problem here can never fail or roll back the save itself) and does nothing until its table exists.
//
//   GET /api/submissions/:recordKey/:id/history   -> that entry's changes, newest first

const PREFIXES = ['formrecord:', 'monitoring_log:'];
const isRecordKey = (key) => PREFIXES.some((p) => String(key).startsWith(p));

function parse(value) {
  if (value == null) return [];
  try { const a = JSON.parse(value); return Array.isArray(a) ? a : null; } catch (e) { return null; }
}

// [{ entryId, action: 'add'|'change'|'remove', before, after }] -- before/after are the entry's JSON strings.
function diffEntries(prevValue, newValue) {
  const prev = parse(prevValue), next = parse(newValue);
  if (prev === null || next === null) return [];
  const prevById = new Map(prev.filter((e) => e && e.id).map((e) => [e.id, JSON.stringify(e)]));
  const out = [];
  const seen = new Set();
  for (const e of next) {
    if (!e || !e.id) continue;
    seen.add(e.id);
    const after = JSON.stringify(e);
    if (!prevById.has(e.id)) out.push({ entryId: e.id, action: 'add', before: null, after });
    else if (prevById.get(e.id) !== after) out.push({ entryId: e.id, action: 'change', before: prevById.get(e.id), after });
  }
  for (const [id, before] of prevById) if (!seen.has(id)) out.push({ entryId: id, action: 'remove', before, after: null });
  return out;
}

let availCache = { at: 0, ok: false };
async function available(db) {
  if (Date.now() - availCache.at < 60000) return availCache.ok;
  let ok = false;
  try { ok = (await db.$queryRawUnsafe(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'SubmissionHistory' LIMIT 1`)).length > 0; }
  catch (e) { ok = false; }
  availCache = { at: Date.now(), ok };
  return ok;
}

// db: a Prisma transaction client (or the client). who: { actor, role }. event: 'set' | 'delete' | 'delete-submission' | ...
async function recordEntryHistory(db, key, prevValue, newValue, who, event) {
  try {
    if (!isRecordKey(key)) return 0;
    const changes = diffEntries(prevValue, newValue);
    if (!changes.length || !(await available(db))) return 0;
    const recordKey = key.slice(PREFIXES.find((p) => key.startsWith(p)).length);
    const params = [];
    const rows = changes.map((c) => {
      const i = params.length;
      params.push(key, recordKey, c.entryId, c.action, event || 'set', c.before, c.after, (who && who.actor) || null, (who && who.role) || null);
      return `($${i + 1},$${i + 2},$${i + 3},$${i + 4},$${i + 5},$${i + 6},$${i + 7},$${i + 8},$${i + 9})`;
    });
    await db.$executeRawUnsafe('SAVEPOINT sub_hist');
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "SubmissionHistory" ("key","recordKey","entryId","action","event","before","after","actor","role") VALUES ${rows.join(',')}`,
        ...params);
      await db.$executeRawUnsafe('RELEASE SAVEPOINT sub_hist');
      return changes.length;
    } catch (e) {
      await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sub_hist');
      console.error('SubmissionHistory insert failed (save unaffected)', e.message);
      return 0;
    }
  } catch (e) {
    console.error('recordEntryHistory failed (save unaffected)', e.message);
    return 0;
  }
}

function mount(app, prisma) {
  app.get('/api/submissions/:recordKey/:id/history', async (req, res) => {
    try {
      const recordKey = String(req.params.recordKey || '');
      if (!/^[a-z0-9][a-z0-9_-]*$/.test(recordKey)) return res.status(400).json({ ok: false, error: 'bad recordKey' });
      if (!(await available(prisma))) return res.json({ ok: true, rows: [], note: 'history table not created yet' });
      const full = req.query.full === '1';
      const rows = await prisma.$queryRawUnsafe(
        `SELECT "id","action","event","actor","role","at"${full ? ',"before","after"' : ''} FROM "SubmissionHistory" WHERE "recordKey" = $1 AND "entryId" = $2 ORDER BY "at" DESC, "id" DESC LIMIT 200`,
        recordKey, String(req.params.id));
      res.json({ ok: true, rows });
    } catch (e) {
      console.error('GET entry history failed', e);
      res.status(500).json({ ok: false });
    }
  });
}

module.exports = { diffEntries, recordEntryHistory, available, mount };
