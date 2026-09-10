// Populate the RecordLink table when a formrecord:/monitoring_log: key is written. Reads the
// record's RecordFieldDef rows to discover which fields are link-fields (jobNo, rmLot,
// exportBatch, agCode, person, ...), then upserts one RecordLink row per distinct (linkValue,
// linkField, recordName, recordId, relation) tuple.
//
// Called from PUT /api/storage/key/:key AFTER the write succeeds. This is an indexing
// operation, not a gate: if it fails, the submission is still saved and the links retry on the
// next write for this key. Because a key holds the WHOLE array of entries, we DELETE + re-INSERT
// every link for this record name on every write, keeping the index in sync with deletions.

const PREFIXES = { 'formrecord:': 'form-record', 'monitoring_log:': 'monitoring-log' };

function prefixOf(key) {
  for (const p of Object.keys(PREFIXES)) if (key.startsWith(p)) return p;
  return null;
}

async function syncRecordLinks(prisma, key, value) {
  const prefix = prefixOf(key);
  if (!prefix) return;

  const recordKey = key.slice(prefix.length);

  // Discover which fields are link-fields from the definition layer.
  const linkFields = await prisma.recordFieldDef.findMany({
    where: { recordKey, linkField: { not: null } },
  });
  if (!linkFields.length) return;

  let entries;
  try { entries = JSON.parse(value); } catch { return; }
  if (!Array.isArray(entries)) return;

  // Build the full set of link rows this key SHOULD have.
  const rows = [];
  const seen = new Set(); // dedup key

  for (const entry of entries) {
    if (!entry || !entry.id) continue;
    const values = entry.values || entry;

    for (const lf of linkFields) {
      const raw = values[lf.key];
      if (raw == null || String(raw).trim() === '') continue;
      const linkValue = String(raw).trim().toUpperCase();
      const linkFieldName = lf.linkField;
      const relation = lf.linkRelation || 'self';
      const dedup = `${linkValue}|${linkFieldName}|${recordKey}|${entry.id}|${relation}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      rows.push({ linkValue, linkField: linkFieldName, recordName: recordKey, recordId: entry.id, relation });
    }

    // Roster rows: some roster columns are also link fields (e.g. batchseq, rmLot on a line).
    if (Array.isArray(entry.roster)) {
      for (const row of entry.roster) {
        if (!row) continue;
        for (const lf of linkFields) {
          const raw = row[lf.key];
          if (raw == null || String(raw).trim() === '') continue;
          const linkValue = String(raw).trim().toUpperCase();
          const linkFieldName = lf.linkField;
          const relation = lf.linkRelation || 'self';
          const dedup = `${linkValue}|${linkFieldName}|${recordKey}|${entry.id}|${relation}`;
          if (seen.has(dedup)) continue;
          seen.add(dedup);
          rows.push({ linkValue, linkField: linkFieldName, recordName: recordKey, recordId: entry.id, relation });
        }
      }
    }
  }

  // Atomic replace: delete everything for this record key, then bulk insert the new set.
  await prisma.$transaction([
    prisma.recordLink.deleteMany({ where: { recordName: recordKey } }),
    ...rows.map(r => prisma.recordLink.create({ data: r })),
  ]);
}

module.exports = { syncRecordLinks };
