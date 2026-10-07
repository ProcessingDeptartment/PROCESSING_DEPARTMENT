// FSMS annual calendar: tables fsms_year / fsms_category / fsms_event (spec: MD/fsms-calendar-instructions.md).
//
// A year is a grid of categories x 12 months; each cell holds zero or more events. completedBy is a
// client-asserted name (see the auth note in index.js), so it records who said they did it.
// Past years are read-only for structure (add/edit/delete); status can still be marked.
const STATUSES = ['pending', 'done', 'skipped'];

const str = (v, max) => {
  const s = v == null ? '' : String(v).trim();
  return s ? s.slice(0, max || 2000) : null;
};
const toMonth = (v) => { const m = parseInt(v, 10); return m >= 1 && m <= 12 ? m : null; };
const toYear = (v) => { const y = parseInt(v, 10); return y >= 2000 && y <= 2100 ? y : null; };

function mount(app, prisma) {
  const Y = prisma.fsmsYear, E = prisma.fsmsEvent, C = prisma.fsmsCategory;
  const fail = (res, what, e) => { console.error(what + ' failed', e); res.status(500).json({ ok: false }); };
  const isPast = (year) => year < new Date().getFullYear();

  app.get('/api/fsms/categories', async (req, res) => {
    try { res.json(await C.findMany({ orderBy: { sortOrder: 'asc' } })); }
    catch (e) { fail(res, 'GET fsms categories', e); }
  });

  app.get('/api/fsms/years', async (req, res) => {
    try {
      const rows = await Y.findMany({ orderBy: { year: 'desc' }, include: { _count: { select: { events: true } } } });
      res.json(rows.map((r) => ({ id: r.id, year: r.year, notes: r.notes, events: r._count.events })));
    } catch (e) { fail(res, 'GET fsms years', e); }
  });

  app.get('/api/fsms/years/:year', async (req, res) => {
    const year = toYear(req.params.year);
    if (!year) return res.status(400).json({ ok: false, error: 'bad year' });
    try {
      const y = await Y.findUnique({ where: { year } });
      if (!y) return res.status(404).json({ ok: false, error: 'year not set up' });
      const [categories, events] = await Promise.all([
        C.findMany({ orderBy: { sortOrder: 'asc' } }),
        E.findMany({ where: { yearId: y.id }, orderBy: [{ month: 'asc' }, { id: 'asc' }] }),
      ]);
      res.json({ year: y.year, notes: y.notes, readOnly: isPast(y.year), categories, events });
    } catch (e) { fail(res, 'GET fsms year', e); }
  });

  app.post('/api/fsms/years', async (req, res) => {
    const year = toYear((req.body || {}).year);
    if (!year) return res.status(400).json({ ok: false, error: 'year required' });
    try {
      if (await Y.findUnique({ where: { year } })) return res.status(409).json({ ok: false, error: `${year} already exists` });
      res.status(201).json(await Y.create({ data: { year } }));
    } catch (e) { fail(res, 'POST fsms year', e); }
  });

  // "Set up next year": copy every event from sourceYear into year (created if missing), reset to pending.
  app.post('/api/fsms/years/:year/clone', async (req, res) => {
    const year = toYear(req.params.year), sourceYear = toYear((req.body || {}).sourceYear);
    if (!year || !sourceYear || year === sourceYear) return res.status(400).json({ ok: false, error: 'year and a different sourceYear required' });
    try {
      const src = await Y.findUnique({ where: { year: sourceYear } });
      if (!src) return res.status(404).json({ ok: false, error: `${sourceYear} not found` });
      const dest = await Y.upsert({ where: { year }, update: {}, create: { year } });
      if (await E.count({ where: { yearId: dest.id } })) return res.status(409).json({ ok: false, error: `${year} already has events; clone only into an empty year` });
      const events = await E.findMany({ where: { yearId: src.id } });
      await E.createMany({ data: events.map((e) => ({ yearId: dest.id, categoryId: e.categoryId, month: e.month, title: e.title, notes: e.notes })) });
      res.status(201).json({ ok: true, year, copied: events.length });
    } catch (e) { fail(res, 'POST fsms clone', e); }
  });

  app.post('/api/fsms/events', async (req, res) => {
    const b = req.body || {};
    const year = toYear(b.year), month = toMonth(b.month), categoryId = parseInt(b.categoryId, 10), title = str(b.title, 300);
    if (!year || !month || !categoryId || !title) return res.status(400).json({ ok: false, error: 'year, categoryId, month and title are required' });
    if (isPast(year)) return res.status(403).json({ ok: false, error: 'past years are read-only' });
    try {
      const y = await Y.findUnique({ where: { year } });
      if (!y) return res.status(404).json({ ok: false, error: 'year not set up' });
      res.status(201).json(await E.create({ data: { yearId: y.id, categoryId, month, title, notes: str(b.notes, 4000) } }));
    } catch (e) { fail(res, 'POST fsms event', e); }
  });

  app.patch('/api/fsms/events/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ ok: false, error: 'bad id' });
    const b = req.body || {};
    try {
      const cur = await E.findUnique({ where: { id }, include: { year: true } });
      if (!cur) return res.status(404).json({ ok: false, error: 'not found' });
      const data = {};
      if ('status' in b) {
        if (!STATUSES.includes(b.status)) return res.status(400).json({ ok: false, error: 'invalid status' });
        data.status = b.status;
        if (b.status === 'pending') { data.completedAt = null; data.completedBy = null; }
        else {
          const who = str(b.completedBy, 120);
          if (!who) return res.status(400).json({ ok: false, error: 'completedBy is required' });
          data.completedBy = who;
          data.completedAt = b.completedAt ? new Date(b.completedAt) : new Date();
        }
      }
      if (['title', 'notes', 'month', 'categoryId'].some((k) => k in b)) {
        if (isPast(cur.year.year)) return res.status(403).json({ ok: false, error: 'past years are read-only; only status can change' });
        if ('title' in b) { data.title = str(b.title, 300); if (!data.title) return res.status(400).json({ ok: false, error: 'title required' }); }
        if ('notes' in b) data.notes = str(b.notes, 4000);
        if ('month' in b) { data.month = toMonth(b.month); if (!data.month) return res.status(400).json({ ok: false, error: 'bad month' }); }
        if ('categoryId' in b) data.categoryId = parseInt(b.categoryId, 10);
      }
      res.json(await E.update({ where: { id }, data }));
    } catch (e) { fail(res, 'PATCH fsms event', e); }
  });

  app.delete('/api/fsms/events/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ ok: false, error: 'bad id' });
    try {
      const cur = await E.findUnique({ where: { id }, include: { year: true } });
      if (!cur) return res.status(404).json({ ok: false, error: 'not found' });
      if (isPast(cur.year.year)) return res.status(403).json({ ok: false, error: 'past years are read-only' });
      await E.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) { fail(res, 'DELETE fsms event', e); }
  });

  // Events are month-granular, so "within N days" means every month the window touches (this month
  // included, so anything outstanding now shows). Pending only, soonest month first.
  app.get('/api/fsms/upcoming', async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 366);
    try {
      const now = new Date(), end = new Date(now.getTime() + days * 864e5);
      const months = [];
      for (let d = new Date(now.getFullYear(), now.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
      const rows = await E.findMany({
        where: { status: 'pending', OR: months.map((x) => ({ month: x.m, year: { year: x.y } })) },
        include: { year: true, category: true },
      });
      res.json(rows.map((e) => ({ id: e.id, year: e.year.year, month: e.month, title: e.title, notes: e.notes, category: e.category.name, color: e.category.color }))
        .sort((a, b) => (a.year - b.year) || (a.month - b.month) || a.category.localeCompare(b.category)));
    } catch (e) { fail(res, 'GET fsms upcoming', e); }
  });
}

module.exports = { mount };
