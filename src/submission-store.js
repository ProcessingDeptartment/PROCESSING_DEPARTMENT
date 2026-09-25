// Dual-write layer: when a formrecord:/monitoring_log: key is written, decompose the JSON
// array of entries into rows in the per-record submission table (and its roster child table).
// The KeyValue blob is still the source of truth; this is an additive projection for queries.
//
// Uses raw SQL ($executeRawUnsafe / $queryRawUnsafe) because the 131 submission models are
// generated and there's no Prisma model name we can reference at runtime — the table name
// comes from the record key.

const { jobSnapshotKeys, jobFieldKey, JOB_COL } = require('./job-snapshot');

const PREFIXES = { 'formrecord:': 'form-record', 'monitoring_log:': 'monitoring-log' };

function prefixOf(key) {
  for (const p of Object.keys(PREFIXES)) if (key.startsWith(p)) return p;
  return null;
}

function toTable(recordKey) {
  return 'sub_' + recordKey.replace(/-/g, '_');
}

// Mirrors scripts/generate-submission-schema.mjs's FIELD_TYPE_TO_PRISMA — the column kind each
// RecordFieldDef.type coerces to when written into a submission table.
function columnKind(fieldType) {
  switch (fieldType) {
    case 'number':
    case 'computed':
    case 'derived':
      return 'float';
    case 'digits':
      return 'int';
    case 'yesno':
      return 'boolean';
    case 'date':
    case 'timestamp':
      return 'date';
    case 'month':
      return 'month';
    case 'time':
      return 'time';
    default:
      return 'string';
  }
}

const YES_VALUES = new Set(['yes', 'y', 'true']);
const NO_VALUES = new Set(['no', 'n', 'false']);

// The store rewrites a record's whole table on every save, so one stale value (say a free-text
// entry from before a field became a time) would log the same warning on every save of that record.
// Warn once per distinct (record, field, value, kind) per process; the value is still stored as null
// and stays recoverable from rawJson. Bounded so a stream of different bad values cannot grow it.
const warned = new Set();
function warnOnce(kind, recordKey, fieldKey, value, what) {
  const id = `${recordKey}|${fieldKey}|${kind}|${String(value)}`;
  if (warned.has(id)) return;
  if (warned.size >= 1000) warned.clear();
  warned.add(id);
  console.warn(`[submission-store] ${recordKey}.${fieldKey}: cannot parse "${value}" as ${what}, storing null`);
}

// Converts a raw form value to the type its submission column expects. Never throws: an
// unconvertible value degrades to null (recoverable from rawJson) so one bad field can't fail
// the whole write — see BACKEND_INTEGRATION.md's "never let a storage failure break a form
// mid-shift" principle.
function coerce(value, kind, recordKey, fieldKey) {
  if (value == null || value === '') return null;
  switch (kind) {
    case 'float': {
      const n = parseFloat(value);
      if (Number.isNaN(n)) {
        warnOnce('number', recordKey, fieldKey, value, 'number');
        return null;
      }
      return n;
    }
    case 'int': {
      const n = parseInt(value, 10);
      if (Number.isNaN(n)) {
        warnOnce('integer', recordKey, fieldKey, value, 'integer');
        return null;
      }
      return n;
    }
    case 'boolean': {
      const s = String(value).trim().toLowerCase();
      if (YES_VALUES.has(s)) return true;
      if (NO_VALUES.has(s)) return false;
      warnOnce('yes-no', recordKey, fieldKey, value, 'yes/no');
      return null;
    }
    case 'date': {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        warnOnce('date', recordKey, fieldKey, value, 'date');
        return null;
      }
      return d;
    }
    case 'month': {
      // <input type="month"> value, e.g. "2026-09" — store as the 1st of that month, UTC so the
      // stored date doesn't shift with the server's local timezone.
      if (!/^\d{4}-\d{2}$/.test(value)) {
        warnOnce('month', recordKey, fieldKey, value, 'month');
        return null;
      }
      const d = new Date(`${value}-01T00:00:00Z`);
      if (Number.isNaN(d.getTime())) {
        warnOnce('month', recordKey, fieldKey, value, 'month');
        return null;
      }
      return d;
    }
    case 'time': {
      // "HH:MM" — parsed as UTC so the stored time-of-day doesn't shift with the server's local
      // timezone; the @db.Time column drops the date part anyway.
      if (!/^\d{2}:\d{2}$/.test(value)) {
        warnOnce('time', recordKey, fieldKey, value, 'time');
        return null;
      }
      const d = new Date(`1970-01-01T${value}:00Z`);
      if (Number.isNaN(d.getTime())) {
        warnOnce('time', recordKey, fieldKey, value, 'time');
        return null;
      }
      return d;
    }
    default:
      return String(value);
  }
}

function toCol(fieldKey) {
  let col = fieldKey;
  if (/^\d/.test(col)) col = 'f_' + col;
  if (['id', 'status', 'source', 'createdAt', 'updatedAt', 'submittedAt', 'rawJson', 'inSpec'].includes(col)) {
    col = 'val_' + col;
  }
  return col;
}

// Discover which columns belong to the parent and which to the child (roster) table, using the
// RecordFieldDef rows in Neon. Cached per record key for the lifetime of the process.
const schemaCache = new Map();

async function getSchema(prisma, recordKey) {
  if (schemaCache.has(recordKey)) return schemaCache.get(recordKey);

  const def = await prisma.recordDefinition.findUnique({
    where: { recordKey },
    include: { sections: true, fields: true, autofills: true },
  });
  if (!def) { schemaCache.set(recordKey, null); return null; }

  // Job-level copies (receiving date, farm, ...) are not stored per record — see job-snapshot.js.
  const skip = jobSnapshotKeys(def);
  const jobKey = jobFieldKey(def); // stored as "jobNo" whatever the form calls it
  const topCols = [];
  const rosterCols = [];
  for (const f of def.fields) {
    if (skip.has(f.key)) continue;
    const sec = def.sections.find(s => {
      const idx = def.sections.indexOf(s);
      return idx === f.sectionIndex;
    });
    const col = f.key === jobKey ? JOB_COL : toCol(f.key);
    const kind = columnKind(f.type);
    if (sec && sec.kind === 'roster') {
      rosterCols.push({ key: f.key, col, kind });
    } else {
      topCols.push({ key: f.key, col, kind });
    }
  }

  const schema = {
    table: toTable(recordKey),
    childTable: rosterCols.length ? toTable(recordKey) + '_row' : null,
    topCols,
    rosterCols,
  };
  schemaCache.set(recordKey, schema);
  return schema;
}

async function syncSubmissionRows(prisma, key, value) {
  const prefix = prefixOf(key);
  if (!prefix) return;

  const recordKey = key.slice(prefix.length);
  const schema = await getSchema(prisma, recordKey);
  if (!schema) return; // no definition → no submission table

  let entries;
  try { entries = JSON.parse(value); } catch { return; }
  if (!Array.isArray(entries)) return;

  // Atomic: delete all existing rows for this record, then re-insert.
  // This handles edits, deletions, and reordering without diffing.
  const stmts = [];

  // Delete child rows first (FK constraint), then parents.
  if (schema.childTable) {
    stmts.push(prisma.$executeRawUnsafe(
      `DELETE FROM "${schema.childTable}" WHERE "parentId" IN (SELECT "id" FROM "${schema.table}")`
    ));
  }
  stmts.push(prisma.$executeRawUnsafe(`DELETE FROM "${schema.table}"`));

  // Insert each entry as a parent row.
  for (const entry of entries) {
    if (!entry || !entry.id) continue;
    const values = entry.values || entry;

    // Build column list and parameter list.
    const cols = ['"id"', '"status"', '"source"', '"submittedAt"', '"createdAt"', '"updatedAt"', '"rawJson"', '"inSpec"'];
    const params = [
      entry.id,
      entry.status || null,
      entry.source || null,
      entry.submittedAt ? new Date(entry.submittedAt) : null,
      entry.createdAt ? new Date(entry.createdAt) : new Date(),
      entry.updatedAt ? new Date(entry.updatedAt) : new Date(),
      JSON.stringify(entry),
      entry.inSpec != null ? entry.inSpec : null,
    ];

    for (const { key: fk, col, kind } of schema.topCols) {
      const v = values[fk];
      cols.push(`"${col}"`);
      params.push(coerce(v, kind, recordKey, fk));
    }

    const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
    stmts.push(prisma.$executeRawUnsafe(
      `INSERT INTO "${schema.table}" (${cols.join(', ')}) VALUES (${placeholders})`,
      ...params
    ));

    // Insert roster rows. form-record keeps them on the entry; a monitoring-log customBody
    // record (REC 7.2.12) emits them from read(), so they arrive inside `values`.
    const rosterRows = Array.isArray(entry.roster) ? entry.roster : values.roster;
    if (schema.childTable && Array.isArray(rosterRows)) {
      rosterRows.forEach((row, position) => {
        if (!row) return;
        const childCols = ['"parentId"', '"position"'];
        const childParams = [entry.id, position];

        for (const { key: fk, col, kind } of schema.rosterCols) {
          const v = row[fk];
          childCols.push(`"${col}"`);
          childParams.push(coerce(v, kind, recordKey, fk));
        }

        const cp = childParams.map((_, i) => `$${i + 1}`).join(', ');
        stmts.push(prisma.$executeRawUnsafe(
          `INSERT INTO "${schema.childTable}" (${childCols.join(', ')}) VALUES (${cp})`,
          ...childParams
        ));
      });
    }
  }

  // Run all statements in a single transaction.
  await prisma.$transaction(stmts);
}

module.exports = { syncSubmissionRows };
