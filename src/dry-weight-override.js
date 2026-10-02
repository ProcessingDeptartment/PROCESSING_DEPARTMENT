// REC 7.4.0 Dry Cooking: which weight rules an operator overrode (R1 Cooking vs OOSW; retired R2 / R3 history kept), as queryable rows. The entry's oosWarningNote holds one message per
// line; each line is matched to its rule id in public/data/business-rules.json. Rebuilt in full on every
// dry-cooking sync (like the sub_* tables), submitted entries only. Never throws: the table is an
// extra, so a missing table or unreadable registry must not break saving.
const fs = require('fs');
const path = require('path');

function ruleIdsByMessage() {
  const file = path.join(__dirname, '..', 'public', 'data', 'business-rules.json');
  const map = new Map();
  for (const r of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    if (r.recordKey === 'dry-cooking' && r.id && r.message) map.set(r.message, r.id);
  }
  // R2 / R3 were retired with the pot slides; entries that overrode them keep their rule id in the table.
  map.set('Blanching pot weight exceeding OOSW - possible batch mix', 'R2');
  map.set('Cooking weight exceeds blanched weight - cooked more than was blanched', 'R3');
  return map;
}

async function syncDryWeightOverrides(prisma, entries, completedByText) {
  try {
    const ids = ruleIdsByMessage();
    const rows = [];
    for (const entry of entries) {
      if (!entry || !entry.id || entry.status !== 'submitted') continue;
      const values = entry.values || entry;
      if (!values.oosWarningAck) continue;
      const job = String(values.jobNo || '').trim() || null;
      const signedBy = completedByText(entry, values);
      const when = entry.submittedAt ? new Date(entry.submittedAt) : new Date();
      for (const line of String(values.oosWarningNote || '').split('\n').map((l) => l.trim()).filter(Boolean)) {
        rows.push([entry.id, job, ids.get(line) || 'other', line, signedBy, when]);
      }
    }
    await prisma.$transaction([
      prisma.$executeRawUnsafe('DELETE FROM "dry_weight_override"'),
      ...rows.map((r) => prisma.$executeRawUnsafe(
        'INSERT INTO "dry_weight_override" ("submission_id","job_no","rule","message","signed_by","created_at") VALUES ($1,$2,$3,$4,$5,$6)', ...r)),
    ]);
  } catch (e) {
    console.warn('dry_weight_override sync skipped:', e.message);
  }
}

module.exports = { syncDryWeightOverrides };
