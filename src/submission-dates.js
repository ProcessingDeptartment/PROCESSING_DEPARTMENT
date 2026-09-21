// Extract the date fields of a formrecord:/monitoring_log: key into SubmissionDateField, so dates
// can be queried across records without parsing every JSON blob (GET /api/dates).
//
// Each row identifies its record two ways, both always set:
//   recordKey   canonical id, from the storage key ('cans-produced') -- filter/join on this
//   recordName  display name: the record's definition title, then the legacy record-key-map name,
//               then the key. (It used to come only from record-key-map.json, which covers 77 of
//               the 131 records, so newer records showed their raw key while older ones showed a
//               title.)
// and, when the key holds an array of submissions, `submissionId` -- the entry the date belongs to
// (null only for a payload that is not an array of entries).
//
// Replace-on-write, like the other derived tables: a key holds the WHOLE array, so every write
// deletes and re-inserts that key's rows, which keeps deletions and edits in sync.
const recordKeyMap = require('./record-key-map');

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Walks a payload (which may contain repeating rows/rosters) and pulls out every value whose key
// is a known date field. Doesn't assume a fixed shape -- just recurses.
function extractDateFields(obj, dateFields, found) {
  if (Array.isArray(obj)) {
    for (const item of obj) extractDateFields(item, dateFields, found);
    return;
  }
  if (!isPlainObject(obj)) return;
  for (const [key, value] of Object.entries(obj)) {
    if (dateFields.has(key) && (typeof value === 'string' || value === null)) {
      found.push({ fieldKey: key, rawValue: value });
    }
    if (isPlainObject(value) || Array.isArray(value)) extractDateFields(value, dateFields, found);
  }
}

async function displayName(prisma, recordKey, legacyMap) {
  const def = await prisma.recordDefinition.findUnique({ where: { recordKey }, select: { title: true } });
  return (def && def.title) || (legacyMap[recordKey] && legacyMap[recordKey].recordName) || recordKey;
}

// deps: { dateFields: Map (date-field-map.load()), recordKeys: legacy record-key-map.load() }
async function syncSubmissionDates(prisma, key, value, deps) {
  if (!recordKeyMap.hasKnownPrefix(key)) return;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return; // not JSON -- nothing to extract
  }

  const recordKey = recordKeyMap.recordKeyFromStorageKey(key);
  const recordName = await displayName(prisma, recordKey, deps.recordKeys);

  const found = []; // { submissionId, fieldKey, rawValue }
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  for (const entry of entries) {
    const hits = [];
    extractDateFields(entry, deps.dateFields, hits);
    const submissionId = isPlainObject(entry) && entry.id != null ? String(entry.id) : null;
    for (const h of hits) found.push({ submissionId, ...h });
  }

  const data = found.map(({ submissionId, fieldKey, rawValue }) => {
    const meta = deps.dateFields.get(fieldKey);
    return {
      submissionKey: key,
      recordKey,
      recordName,
      submissionId,
      fieldKey,
      fieldLabel: meta.fieldLabel,
      recordClass: meta.recordClass,
      dateValue: rawValue && !isNaN(Date.parse(rawValue)) ? new Date(rawValue) : null,
      rawValue,
    };
  });

  await prisma.$transaction([
    prisma.submissionDateField.deleteMany({ where: { submissionKey: key } }),
    ...(data.length ? [prisma.submissionDateField.createMany({ data })] : []),
  ]);
}

module.exports = { syncSubmissionDates };
