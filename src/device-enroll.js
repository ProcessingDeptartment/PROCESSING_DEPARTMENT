// Device enrolment: a user proves who they are with their passkey PIN, and the server hands back
// the facility API key so that phone/tablet can save records. Public route (the device has no key
// yet) -- the passkey is the credential. Any active user may enrol a device; no role needed.
//
//   POST /api/auth/device-enroll   { passkey }  ->  { ok, key, displayName }
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

module.exports = function registerDeviceEnroll(app, prisma, apiKey) {
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
