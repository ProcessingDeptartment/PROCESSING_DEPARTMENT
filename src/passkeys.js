// Admin-managed numeric passkeys (PINs) used in place of typed signatures.
//   POST /api/admin/passkeys/create   (admin)  create or reset a user's passkey
//   POST /api/admin/passkeys/list     (admin)  list users (never returns the PIN or hash)
//   POST /api/admin/passkeys/update   (admin)  edit name/title and optionally reset passkey
//   POST /api/admin/passkeys/disable  (admin)  deactivate a user's passkey
//   POST /api/admin/passkeys/enable   (admin)  re-activate a disabled user
//   POST /api/passkey/verify          (any)    PIN -> { username, displayName, title }; logged to passkey_logs
// PINs are stored as scrypt hashes (node:crypto, no extra dependency). Because verify identifies the person
// from the PIN alone, two active users cannot share the same PIN -- create rejects a duplicate.
// Admin check trusts the X-Role header (same trust level as the rest of this API until Entra ID exists).
const crypto = require('crypto');

const PIN_RE = /^\d{4,8}$/;
const MAX_FAILS = 5, WINDOW_MS = 60 * 1000; // brute-force guard on verify: 5 misses / minute / IP
const fails = new Map();

function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, 32);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
function checkPin(pin, stored) {
  const [saltHex, hashHex] = String(stored).split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const got = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(got, expected);
}
const isAdmin = req => (req.get('x-role') || '') === 'ADMINISTRATOR';
const actor = req => (req.get('x-user') || 'admin').slice(0, 100);

module.exports = function registerPasskeys(app, prisma) {
  app.post('/api/admin/passkeys/create', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    const { username, displayName, title, passkey } = req.body || {};
    if (!username || !displayName || !passkey) return res.status(400).json({ error: 'username, displayName and passkey are required' });
    if (!PIN_RE.test(String(passkey))) return res.status(400).json({ error: 'Passkey must be 4-8 digits' });
    try {
      const others = await prisma.userPasskey.findMany({ where: { isActive: true, NOT: { username } } });
      if (others.some(o => checkPin(String(passkey), o.passkey))) {
        return res.status(409).json({ error: 'That passkey is already in use by another person - choose a different one' });
      }
      const data = { displayName, title: title || null, passkey: hashPin(String(passkey)), isActive: true, lastResetAt: new Date() };
      await prisma.userPasskey.upsert({
        where: { username },
        update: data,
        create: Object.assign({ username, createdBy: actor(req) }, data)
      });
      res.json({ success: true, username, displayName });
    } catch (e) { console.error('passkey create failed', e); res.status(500).json({ error: 'Could not save passkey' }); }
  });

  app.post('/api/admin/passkeys/list', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    try {
      const passkeys = await prisma.userPasskey.findMany({
        select: { id: true, username: true, displayName: true, title: true, isActive: true, createdAt: true, lastResetAt: true, lastUsedAt: true },
        orderBy: { displayName: 'asc' }
      });
      res.json({ success: true, count: passkeys.length, passkeys });
    } catch (e) { console.error('passkey list failed', e); res.status(500).json({ error: 'Could not load passkeys' }); }
  });

  // Update name, title, and optionally reset passkey — called by the Edit modal
  app.post('/api/admin/passkeys/update', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    const { username, displayName, title, passkey } = req.body || {};
    if (!username || !displayName) return res.status(400).json({ error: 'username and displayName are required' });
    try {
      const data = { displayName, title: title || null };
      if (passkey) {
        if (!PIN_RE.test(String(passkey))) return res.status(400).json({ error: 'Passkey must be 4-8 digits' });
        // Ensure no other active user shares this PIN
        const others = await prisma.userPasskey.findMany({ where: { isActive: true, NOT: { username } } });
        if (others.some(o => checkPin(String(passkey), o.passkey))) {
          return res.status(409).json({ error: 'That passkey is already in use by another person - choose a different one' });
        }
        data.passkey = hashPin(String(passkey));
        data.lastResetAt = new Date();
      }
      await prisma.userPasskey.update({ where: { username }, data });
      res.json({ success: true, username, displayName });
    } catch (e) { console.error('passkey update failed', e); res.status(500).json({ error: 'Could not update passkey' }); }
  });

  app.post('/api/admin/passkeys/enable', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username required' });
    try {
      await prisma.userPasskey.update({ where: { username }, data: { isActive: true } });
      res.json({ success: true });
    } catch (e) { console.error('passkey enable failed', e); res.status(500).json({ error: 'Could not enable passkey' }); }
  });

  app.post('/api/admin/passkeys/disable', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username required' });
    try {
      await prisma.userPasskey.update({ where: { username }, data: { isActive: false } });
      res.json({ success: true });
    } catch (e) { console.error('passkey disable failed', e); res.status(500).json({ error: 'Could not disable passkey' }); }
  });

  app.post('/api/passkey/verify', async (req, res) => {
    const ip = req.ip || 'unknown', now = Date.now();
    const f = (fails.get(ip) || []).filter(t => now - t < WINDOW_MS);
    if (f.length >= MAX_FAILS) return res.status(429).json({ error: 'Too many wrong attempts - wait a minute and try again' });
    const pin = String((req.body || {}).passkey || '');
    if (!PIN_RE.test(pin)) return res.status(400).json({ error: 'Passkey must be 4-8 digits' });
    try {
      const users = await prisma.userPasskey.findMany({ where: { isActive: true } });
      const user = users.find(u => checkPin(pin, u.passkey));
      if (!user) { f.push(now); fails.set(ip, f); return res.status(401).json({ error: 'Passkey not recognised' }); }
      fails.delete(ip);
      await prisma.passkeyLog.create({ data: { username: user.username, recordKey: req.get('x-record-key') || null } });
      await prisma.userPasskey.update({ where: { username: user.username }, data: { lastUsedAt: new Date() } });
      res.json({ success: true, username: user.username, displayName: user.displayName, title: user.title || null });
    } catch (e) { console.error('passkey verify failed', e); res.status(500).json({ error: 'Could not verify passkey' }); }
  });
};
