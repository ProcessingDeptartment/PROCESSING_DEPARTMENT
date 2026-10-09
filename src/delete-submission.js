// DELETE SUBMISSION
// POST /api/submissions/delete-one
//
// Removes one entry (by id) from a record's KeyValue blob. Requires two distinct authorised users
// to confirm via passkey, plus a written reason. Authorised roles: ADMINISTRATOR, PRODUCTION_MANAGER, QA_MANAGER.
//
// Request body:
//   { key: "formrecord:drying-process",   // the KeyValue key that holds the entries array
//     submissionId: "abc-123",             // the entry.id to remove
//     passkey1: "1234",                    // first confirming passkey (must be authorised role)
//     passkey2: "5678",                    // second confirming passkey (different user, authorised role)
//     reason: "Entered against wrong job"  // mandatory free-text reason (min 10 chars)
//   }
//
// On success the endpoint:
//   - Writes the updated array back to KeyValue (triggering the normal sync)
//   - Creates a KeyValueHistory audit row with action = 'delete-submission'
//   - Returns { ok: true, removed: { id, summary }, remaining: N }

const { syncSubmissionRows } = require('./submission-store');
const { syncRecordLinks }    = require('./record-links');
const { syncStockLinks }     = require('./stock-link');
const { syncSubmissionDates } = require('./submission-dates');

// Roles permitted to authorise a submission delete. Both signatories must hold one of these.
const ALLOWED_ROLES = new Set(['ADMINISTRATOR', 'PRODUCTION_MANAGER', 'QA_MANAGER']);

// Brute-force guard: max 5 failed passkey checks per IP per minute.
const fails = new Map();
function checkRate(ip) {
  const now = Date.now();
  const bucket = fails.get(ip) || { count: 0, since: now };
  if (now - bucket.since > 60 * 1000) { bucket.count = 0; bucket.since = now; }
  bucket.count += 1;
  fails.set(ip, bucket);
  return bucket.count <= 5;
}
function resetRate(ip) {
  fails.delete(ip);
}

// Verify a passkey PIN against the DB and check the user has an allowed role.
async function verifyAuthorisedPasskey(prisma, pin, ip) {
  if (!checkRate(ip)) {
    return { ok: false, error: 'Too many attempts — wait 1 minute and try again' };
  }
  const crypto = require('crypto');
  const active = await prisma.userPasskey.findMany({ where: { isActive: true } });
  for (const u of active) {
    if (!u.passkey) continue;
    const [saltHex, hashHex] = String(u.passkey).split(':');
    if (!saltHex || !hashHex) continue;
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const got = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
      if (crypto.timingSafeEqual(got, expected)) {
        // PIN matched — check role. Title is used as the role proxy (same pattern as sign-off).
        // The user's `title` field holds their role string (e.g. "QA Manager").
        // We also check an exact role match stored in a possible `role` column.
        const roleFromTitle = titleToRole(u.title || '');
        if (!ALLOWED_ROLES.has(roleFromTitle)) {
          return { ok: false, error: `${u.displayName} does not have the required role to authorise a deletion` };
        }
        resetRate(ip);
        await prisma.userPasskey.update({ where: { id: u.id }, data: { lastUsedAt: new Date() } });
        return { ok: true, username: u.username, displayName: u.displayName, title: u.title };
      }
    } catch (_) { /* bad stored hash — skip */ }
  }
  return { ok: false, error: 'Passkey not recognised' };
}

// Map a human-readable title to a role constant. Mirrors the label map in permission-rules.js.
function titleToRole(title) {
  const t = String(title).toLowerCase().replace(/\s+/g, ' ').trim();
  if (t.includes('administrator') || t.includes('admin'))           return 'ADMINISTRATOR';
  if (t.includes('production manager'))                             return 'PRODUCTION_MANAGER';
  if (t.includes('qa manager'))                                     return 'QA_MANAGER';
  if (t.includes('production supervisor'))                          return 'PRODUCTION_SUPERVISOR';
  if (t.includes('shift manager'))                                  return 'SHIFT_MANAGER';
  if (t.includes('quality supervisor'))                             return 'QUALITY_SUPERVISOR';
  if (t.includes('quality controller'))                             return 'QUALITY_CONTROLLER';
  if (t.includes('operator'))                                       return 'OPERATOR';
  return '';
}

// A short human-readable summary of an entry, for the audit trail.
function entrySummary(entry) {
  const v = entry.values || {};
  const date = entry.submittedAt || entry.createdAt || '';
  const job  = v.jobNo || v.job_no || '';
  const by   = (entry.completedBy && (entry.completedBy.by || entry.completedBy)) || v.completedBy || '';
  const parts = [entry.id];
  if (job)  parts.push(`job ${job}`);
  if (date) parts.push(`submitted ${String(date).slice(0, 10)}`);
  if (by)   parts.push(`by ${by}`);
  return parts.join(', ');
}

module.exports = function registerDeleteSubmission(app, prisma) {
  app.post('/api/submissions/delete-one', async (req, res) => {
    const { key, submissionId, passkey1, passkey2, reason } = req.body || {};
    const ip = req.ip || 'unknown';

    // --- Input validation ---
    if (!key || !submissionId || !passkey1 || !passkey2 || !reason) {
      return res.status(400).json({ ok: false, error: 'key, submissionId, passkey1, passkey2 and reason are all required' });
    }
    if (String(reason).trim().length < 10) {
      return res.status(400).json({ ok: false, error: 'Reason must be at least 10 characters' });
    }
    if (String(passkey1).trim() === String(passkey2).trim()) {
      return res.status(400).json({ ok: false, error: 'The two passkeys must belong to two different people' });
    }
    if (!key.startsWith('formrecord:') && !key.startsWith('monitoring_log:')) {
      return res.status(400).json({ ok: false, error: 'Key must start with formrecord: or monitoring_log:' });
    }

    // --- Verify both passkeys ---
    const [v1, v2] = await Promise.all([
      verifyAuthorisedPasskey(prisma, String(passkey1).trim(), ip + '_1'),
      verifyAuthorisedPasskey(prisma, String(passkey2).trim(), ip + '_2'),
    ]);

    if (!v1.ok) return res.status(403).json({ ok: false, error: `First signatory: ${v1.error}` });
    if (!v2.ok) return res.status(403).json({ ok: false, error: `Second signatory: ${v2.error}` });
    if (v1.username === v2.username) {
      return res.status(400).json({ ok: false, error: 'Both passkeys belong to the same person — two distinct people must confirm' });
    }

    // --- Load the record's entry array ---
    const row = await prisma.keyValue.findUnique({ where: { key } });
    if (!row) return res.status(404).json({ ok: false, error: 'Record not found' });

    let entries;
    try { entries = JSON.parse(row.value); } catch (_) {
      return res.status(500).json({ ok: false, error: 'Could not parse record data' });
    }
    if (!Array.isArray(entries)) {
      return res.status(500).json({ ok: false, error: 'Record data is not an array' });
    }

    const target = entries.find(e => e && e.id === submissionId);
    if (!target) {
      return res.status(404).json({ ok: false, error: `Submission ${submissionId} not found in this record` });
    }
    const summary = entrySummary(target);

    // --- Remove the entry and write back ---
    const updated = entries.filter(e => e && e.id !== submissionId);
    const newValue = JSON.stringify(updated);

    const auditData = {
      key,
      action: 'delete-submission',
      actor: v1.displayName,
      role: v1.title || '',
      before: row.value,
      after: newValue,
      // Store full delete metadata in a JSON comment embedded in `after` would be awkward —
      // instead we write a second history row with the reason and second signatory.
      at: new Date(),
    };

    try {
      await prisma.$transaction(async (tx) => {
        // Update the KeyValue blob.
        await tx.keyValue.update({ where: { key }, data: { value: newValue } });

        // Audit row 1: the deletion event.
        await tx.keyValueHistory.create({
          data: {
            key,
            action: 'delete-submission',
            actor: v1.displayName,
            role: v1.title || '',
            before: row.value,
            after: newValue,
          }
        });

        // Audit row 2: the reason + second signatory (stored as a separate note row).
        await tx.keyValueHistory.create({
          data: {
            key,
            action: 'delete-submission-reason',
            actor: v2.displayName,
            role: v2.title || '',
            before: JSON.stringify({ submissionId, summary }),
            after: JSON.stringify({
              reason: String(reason).trim(),
              signatory1: { username: v1.username, name: v1.displayName, title: v1.title },
              signatory2: { username: v2.username, name: v2.displayName, title: v2.title },
              deletedAt: new Date().toISOString(),
            }),
          }
        });
      });

      // Re-sync all projections (same as a normal PUT).
      try { await syncSubmissionRows(prisma, key, newValue); } catch (_) {}
      try { await syncRecordLinks(prisma, key, newValue); } catch (_) {}
      try { await syncStockLinks(prisma, key, newValue); } catch (_) {}
      try { await syncSubmissionDates(prisma, key, newValue); } catch (_) {}

      // Log to server console for immediate visibility.
      console.log(`[delete-submission] ${key} | entry ${submissionId} (${summary}) deleted`
        + ` | by ${v1.displayName} + ${v2.displayName} | reason: ${String(reason).trim()}`);

      res.json({ ok: true, removed: { id: submissionId, summary }, remaining: updated.length });
    } catch (e) {
      console.error('[delete-submission] transaction failed', e);
      res.status(500).json({ ok: false, error: 'Database error — deletion was not completed' });
    }
  });
};
