// Micro Testing Record — routes for the microbiological testing schedule.
// Uses the shared fsms_category / fsms_year / fsms_event tables so data lives alongside
// the FSMS calendar and clone-year functionality works automatically.
//
// Category names are prefixed with "MT:" to distinguish them from general FSMS events.
// Notes field stores JSON: { samples: string[], preparedBy: string, labRef: string }

const MICRO_TESTS = [
  {
    key: 'hand-swabs',
    name: 'MT: Hand swabs ×4',
    shortName: 'Hand swabs ×4',
    determinant: 'Staphylococcus Aureus, Enterobacteriaceae / Faecal Coliforms',
    suggestedArea: 'Any four (4) personnel, no repetition',
    freq: 'monthly',
    count: 4,
    label: 'Personnel name',
    color: '#c2693c',
    sortOrder: 50,
  },
  {
    key: 'surface-swabs',
    name: 'MT: Surface swabs ×4',
    shortName: 'Surface swabs ×4',
    determinant: 'Total Microbial Activity (TMA)',
    suggestedArea:
      'Scrubbing table 1, Scrubbing table 2, Canning table 1, Canning table 2, Grader conveyor belt, Canning table conveyor, Trolley trays, Aprons, White trays & brushes, Wishy washer',
    freq: 'monthly',
    count: 4,
    label: 'Surface / area',
    color: '#2e7d47',
    sortOrder: 51,
  },
  {
    key: 'env-monitoring',
    name: 'MT: Environmental monitoring ×2',
    shortName: 'Environmental ×2',
    determinant: 'Listeria Monocytogenes',
    suggestedArea:
      'Drain shucking area, Washing area, Scrubbing area, Canning area, Chiller, Retort, Dry cooking',
    freq: 'monthly',
    count: 2,
    label: 'Drain / area',
    color: '#1f6fa0',
    sortOrder: 52,
  },
  {
    key: 'fresh-water',
    name: 'MT: Fresh water ×1',
    shortName: 'Fresh water ×1',
    determinant:
      'Total Microbial Activity (TMA), Escherichia coli, Coliforms, Clostridium spp (excl. C. botulinum)',
    suggestedArea: 'Sampling point 1–5',
    freq: 'monthly',
    count: 1,
    label: 'Sampling point',
    color: '#137566',
    sortOrder: 53,
  },
  {
    key: 'sea-water',
    name: 'MT: Sea water ×2',
    shortName: 'Sea water ×2',
    determinant:
      'Escherichia coli, Coliforms, Clostridium spp (excl. C. botulinum)',
    suggestedArea: 'Always Live tank + Sampling point 1–4',
    freq: 'monthly',
    count: 2,
    label: 'Sampling point',
    color: '#6b3594',
    sortOrder: 54,
  },
  {
    key: 'live-abalone',
    name: 'MT: Live abalone ×1',
    shortName: 'Live abalone ×1',
    determinant: 'Escherichia coli 0157 (present / absent)',
    suggestedArea: 'From Live Holding Tank',
    freq: 'monthly',
    count: 1,
    label: 'Sample',
    color: '#a33028',
    sortOrder: 55,
  },
  {
    key: 'airplates',
    name: 'MT: Airplates ×3',
    shortName: 'Airplates ×3',
    determinant: 'Total Microbial Activity (TMA)',
    suggestedArea:
      'Scrubbing / Debeaking area, Dry cooking area, Canning area / Salting area',
    freq: 'quarterly',
    count: 3,
    label: 'Area',
    color: '#c48a00',
    sortOrder: 56,
  },
  {
    key: 'heavy-metals',
    name: 'MT: Heavy metals (annual)',
    shortName: 'Heavy metals',
    determinant:
      'Arsenic, cadmium, mercury, lead & copper',
    suggestedArea: 'Live / frozen abalone from Live Holding Tank',
    freq: 'annually',
    count: 1,
    label: 'Sample description',
    color: '#5a6475',
    sortOrder: 57,
  },
  {
    key: 'sans241',
    name: 'MT: SANS 241 water (annual)',
    shortName: 'SANS 241 water',
    determinant: 'Full SANS 241 (chemistry & micro)',
    suggestedArea: 'Fresh water sampling points 1–5',
    freq: 'annually',
    count: 1,
    label: 'Sampling point',
    color: '#5a6475',
    sortOrder: 58,
  },
  {
    key: 'com-sterility',
    name: 'MT: Commercial sterility (annual)',
    shortName: 'Commercial sterility',
    determinant: 'Aerobic microbial growth',
    suggestedArea: 'FG02 cans — 2 cans',
    freq: 'annually',
    count: 2,
    label: 'Can / batch ref',
    color: '#5a6475',
    sortOrder: 59,
  },
  {
    key: 'allergen',
    name: 'MT: Allergen verification (annual)',
    shortName: 'Allergen verification',
    determinant: 'Soya, Gluten and Sulphites',
    suggestedArea: '',
    freq: 'annually',
    count: 1,
    label: 'Sample description',
    color: '#5a6475',
    sortOrder: 60,
  },
  {
    key: 'nutritional',
    name: 'MT: Nutritional analysis (annual)',
    shortName: 'Nutritional analysis',
    determinant: 'Full nutritional profile',
    suggestedArea: '',
    freq: 'annually',
    count: 1,
    label: 'Sample description',
    color: '#5a6475',
    sortOrder: 61,
  },
];

// Months where each frequency fires
const MONTHLY_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const QUARTERLY_MONTHS = [1, 4, 7, 10]; // Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
const ANNUAL_MONTHS = [1]; // default January; can be moved in the calendar

function monthsFor(freq) {
  if (freq === 'monthly') return MONTHLY_MONTHS;
  if (freq === 'quarterly') return QUARTERLY_MONTHS;
  return ANNUAL_MONTHS;
}

const toYear = (v) => { const y = parseInt(v, 10); return y >= 2000 && y <= 2100 ? y : null; };
const NAMES = MICRO_TESTS.map((t) => t.name);

function mount(app, prisma) {
  const C = prisma.fsmsCategory, Y = prisma.fsmsYear, E = prisma.fsmsEvent;
  const fail = (res, what, e) => { console.error(what + ' failed', e); res.status(500).json({ ok: false, error: String(e.message) }); };

  // Return test-type definitions (no DB needed — static config)
  app.get('/api/micro-testing/config', (_req, res) => {
    res.json({ testTypes: MICRO_TESTS });
  });

  // Upsert all micro-testing categories and return them with their DB ids.
  // Called by the frontend on load so categories always exist before setup.
  app.post('/api/micro-testing/categories/sync', async (_req, res) => {
    try {
      const cats = [];
      for (const t of MICRO_TESTS) {
        const cat = await C.upsert({
          where: { name: t.name },
          update: { color: t.color, sortOrder: t.sortOrder },
          create: { name: t.name, color: t.color, sortOrder: t.sortOrder },
        });
        cats.push({ ...cat, key: t.key, freq: t.freq, count: t.count, label: t.label,
                    shortName: t.shortName, determinant: t.determinant, suggestedArea: t.suggestedArea });
      }
      res.json({ ok: true, categories: cats });
    } catch (e) { fail(res, 'POST micro categories sync', e); }
  });

  // Get micro-testing data for a year (categories + events filtered to MT: prefix)
  app.get('/api/micro-testing/years/:year', async (req, res) => {
    const year = toYear(req.params.year);
    if (!year) return res.status(400).json({ ok: false, error: 'bad year' });
    try {
      const cats = await C.findMany({
        where: { name: { in: NAMES } },
        orderBy: { sortOrder: 'asc' },
      });
      const catMap = {};
      cats.forEach((c) => { catMap[c.id] = c; });

      const y = await Y.findUnique({ where: { year } });
      const events = y
        ? await E.findMany({
            where: { yearId: y.id, categoryId: { in: cats.map((c) => c.id) } },
            orderBy: [{ month: 'asc' }, { id: 'asc' }],
          })
        : [];

      // Enrich categories with static config
      const enriched = cats.map((c) => {
        const t = MICRO_TESTS.find((t) => t.name === c.name) || {};
        return { ...c, key: t.key, freq: t.freq, count: t.count, label: t.label,
                 shortName: t.shortName, determinant: t.determinant, suggestedArea: t.suggestedArea };
      });

      res.json({
        year,
        readOnly: year < new Date().getFullYear(),
        categories: enriched,
        events,
        hasYear: !!y,
      });
    } catch (e) { fail(res, 'GET micro year', e); }
  });

  // List years that have micro-testing events
  app.get('/api/micro-testing/years', async (_req, res) => {
    try {
      const cats = await C.findMany({ where: { name: { in: NAMES } } });
      const catIds = cats.map((c) => c.id);
      const rows = await E.groupBy({
        by: ['yearId'],
        where: { categoryId: { in: catIds } },
        _count: { id: true },
      });
      const yearIds = rows.map((r) => r.yearId);
      const years = await Y.findMany({ where: { id: { in: yearIds } }, orderBy: { year: 'desc' } });
      const countById = {};
      rows.forEach((r) => { countById[r.yearId] = r._count.id; });
      res.json(years.map((y) => ({ id: y.id, year: y.year, events: countById[y.id] || 0 })));
    } catch (e) { fail(res, 'GET micro years', e); }
  });

  // Set up a new year — creates one event per test-type per frequency-month.
  // Idempotent check: fails with 409 if this year already has MT events.
  app.post('/api/micro-testing/years/:year/setup', async (req, res) => {
    const year = toYear(req.params.year);
    if (!year) return res.status(400).json({ ok: false, error: 'bad year' });
    try {
      // Upsert categories
      const cats = [];
      for (const t of MICRO_TESTS) {
        const cat = await C.upsert({
          where: { name: t.name },
          update: { color: t.color, sortOrder: t.sortOrder },
          create: { name: t.name, color: t.color, sortOrder: t.sortOrder },
        });
        cats.push({ ...cat, freq: t.freq });
      }

      const y = await Y.upsert({ where: { year }, update: {}, create: { year } });

      const catIds = cats.map((c) => c.id);
      const existing = await E.count({ where: { yearId: y.id, categoryId: { in: catIds } } });
      if (existing > 0) {
        return res.status(409).json({ ok: false, error: `${year} already has micro testing events. Delete them first or clone from another year.` });
      }

      const toCreate = [];
      for (const cat of cats) {
        const months = monthsFor(cat.freq);
        for (const m of months) {
          toCreate.push({ yearId: y.id, categoryId: cat.id, month: m, title: cat.name.replace(/^MT: /, '') });
        }
      }
      await E.createMany({ data: toCreate });
      res.status(201).json({ ok: true, year, created: toCreate.length });
    } catch (e) { fail(res, 'POST micro setup year', e); }
  });
}

module.exports = { mount, MICRO_TESTS };
