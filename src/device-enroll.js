// Device enrolment: a user proves who they are with their passkey PIN, and the server hands back
// the facility API key so that phone/tablet can save records. Public route (the device has no key
// yet) -- the passkey is the credential. Any active user may enrol a device; no role needed.
//
//   POST /api/auth/device-enroll   { passkey, deviceId, label }  ->  { ok, key, displayName }
//   POST /api/admin/devices/list    (admin)  every enrolled device
//   POST /api/admin/devices/remove  (admin)  { deviceId } forget a device (list only; the shared key is unchanged)
// Devices are kept as KeyValue rows under the __device__: prefix.
//
// Brute-force guard: 5 failed attempts per IP per minute. Every success is logged.
const crypto = require('crypto');

const fails = new Map();
function allow(ip) {
  const now = Date.now();
  const b = fails.get(ip) || { count: 0, since: now };
  if (now - b.since > 60 * 1000) { b.count = 0; b.since = now; }
  b.count += 1;
  fails.set(ip, b);
  return b.count <= 5;
}

const PREFIX = '__device__:';
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const isAdmin = req => (req.get('x-role') || '') === 'ADMINISTRATOR';

async function recordDevice(prisma, body, u, ip) {
  const id = String((body || {}).deviceId || '');
  if (!ID_RE.test(id)) return; // old clients / odd input: enrolment still works, just not listed
  const key = PREFIX + id;
  const now = new Date().toISOString();
  let prev = {};
  try { const r = await prisma.keyValue.findUnique({ where: { key } }); if (r) prev = JSON.parse(r.value); } catch (_) {}
  const rec = {
    deviceId: id,
    label: String((body || {}).label || '').slice(0, 300),
    username: u.username, displayName: u.displayName,
    ip: ip || '',
    firstEnrolled: prev.firstEnrolled || now,
    lastEnrolled: now,
    count: (prev.count || 0) + 1
  };
  const value = JSON.stringify(rec);
  await prisma.keyValue.upsert({ where: { key }, update: { value }, create: { key, value } });
}

module.exports = function registerDeviceEnroll(app, prisma, apiKey) {
  app.post('/api/admin/devices/list', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    try {
      const rows = await prisma.keyValue.findMany({ where: { key: { startsWith: PREFIX } } });
      const devices = rows.map(r => { try { return JSON.parse(r.value); } catch (_) { return null; } }).filter(Boolean)
        .sort((a, b) => String(b.lastEnrolled).localeCompare(String(a.lastEnrolled)));
      res.json({ success: true, count: devices.length, devices });
    } catch (e) { console.error('[device-enroll] list failed', e); res.status(500).json({ error: 'Could not load devices' }); }
  });

  app.post('/api/admin/devices/remove', async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });
    const id = String((req.body || {}).deviceId || '');
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'Bad device id' });
    try { await prisma.keyValue.deleteMany({ where: { key: PREFIX + id } }); res.json({ success: true }); }
    catch (e) { console.error('[device-enroll] remove failed', e); res.status(500).json({ error: 'Could not remove device' }); }
  });

  app.post('/api/auth/device-enroll', async (req, res) => {
    if (!apiKey) return res.status(503).json({ ok: false, error: 'No access key is configured on the server' });
    const pin = String((req.body || {}).passkey || '').trim();
    if (!pin) return res.status(400).json({ ok: false, error: 'Enter your passkey' });
    if (!allow(req.ip)) return res.status(429).json({ ok: false, error: 'Too many attempts — wait 1 minute and try again' });
    try {
      const active = await prisma.userPasskey.findMany({ where: { isActive: true } });
      for (const u of active) {
        const [saltHex, hashHex] = String(u.passkey || '').split(':');
        if (!saltHex || !hashHex) continue;
        try {
          const expected = Buffer.from(hashHex, 'hex');
          const got = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
          if (crypto.timingSafeEqual(got, expected)) {
            fails.delete(req.ip);
            await recordDevice(prisma, req.body, u, req.ip);
            console.log(`[device-enroll] ${u.username} enrolled a device (${req.ip})`);
            return res.json({ ok: true, key: apiKey, displayName: u.displayName });
          }
        } catch (_) { /* bad stored hash — skip */ }
      }
      return res.status(401).json({ ok: false, error: 'Passkey not recognised' });
    } catch (e) {
      console.error('[device-enroll] failed', e);
      return res.status(500).json({ ok: false, error: 'Server error' });
    }
  });
};
