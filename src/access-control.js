// Access control configuration API
// Stores per-role page visibility rules in the KV store (key: 'access-control:config').
// Administrator only.
//
//   GET  /api/admin/access-control          returns { config: { roleKey: { [pageId]: true|false } } }
//   POST /api/admin/access-control          body: { config } — full replacement save
//   GET  /api/access-control/public         no auth — returns the same config for client-side hiding

const CONFIG_KEY = 'access-control:config';

// We re-use the existing KV table (StoredValue) that the rest of the app uses.
// prisma model: StoredValue { key String @unique; value String; ... }

// Some clients and passkey flows identify the same permission as ADMIN, ADMINISTRATOR or PPICM.
// Header values are not always sent in a single canonical case/format, so normalise before checking.
const ADMIN_ROLE_VALUES = new Set(['ADMIN', 'ADMINISTRATOR', 'PPICM']);
const isAdmin = req => {
  const role = String(req.get('x-role') || '').trim().toUpperCase();
  return ADMIN_ROLE_VALUES.has(role);
};

module.exports = function registerAccessControl(app, prisma) {

  async function getConfig() {
    const row = await prisma.storedValue.findUnique({ where: { key: CONFIG_KEY } });
    if (!row) return {};
    try { return JSON.parse(row.value); } catch { return {}; }
  }

  // Admin: read full config
  app.get('/api/admin/access-control', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    try {
      res.json({ config: await getConfig() });
    } catch (e) {
      console.error('access-control get failed', e);
      res.status(500).json({ error: 'Could not load config' });
    }
  });

  // Admin: save full config
  app.post('/api/admin/access-control', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    const { config } = req.body || {};
    if (!config || typeof config !== 'object') return res.status(400).json({ error: 'config object required' });
    try {
      const value = JSON.stringify(config);
      await prisma.storedValue.upsert({
        where: { key: CONFIG_KEY },
        update: { value },
        create: { key: CONFIG_KEY, value }
      });
      res.json({ success: true });
    } catch (e) {
      console.error('access-control save failed', e);
      res.status(500).json({ error: 'Could not save config' });
    }
  });

  // Public (all authenticated clients): lightweight read for client-side hiding
  app.get('/api/access-control/public', async (req, res) => {
    try {
      res.json({ config: await getConfig() });
    } catch (e) {
      res.status(500).json({ error: 'Could not load config' });
    }
  });
};
