// Dual-write layer: when a formrecord:/monitoring_log: key is written, decompose the JSON
// array of entries into rows in the per-record submission table (and its roster child table).
// The KeyValue blob is still the source of truth; this is an additive projection for queries.
//
// Uses raw SQL ($executeRawUnsafe / $queryRawUnsafe) because the 131 submission models are
// generated and there's no Prisma model name we can reference at runtime — the table name
// comes from the record key.

const PREFIXES = { 'formrecord:': 'form-record', 'monitoring_log:': 'monitoring-log' };

function prefixOf(key) {
  for (const p of Object.keys(PREFIXES)) if (key.startsWith(p)) return p;
  return null;
}

function toTable(recordKey) {
  return 'sub_' + recordKey.replace(/-/g, '_');
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
    include: { sections: true, fields: true },
  });
  if (!def) { schemaCache.set(recordKey, null); return null; }

  const topCols = [];
  const rosterCols = [];
  for (const f of def.fields) {
    const sec = def.sections.find(s => {
      const idx = def.sections.indexOf(s);
      return idx === f.sectionIndex;
    });
    const col = toCol(f.key);
    if (sec && sec.kind === 'roster') {
      rosterCols.push({ key: f.key, col });
    } else {
      topCols.push({ key: f.key, col });
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

    for (const { key: fk, col } of schema.topCols) {
      const v = values[fk];
      cols.push(`"${col}"`);
      params.push(v != null ? String(v) : null);
    }

    const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
    stmts.push(prisma.$executeRawUnsafe(
      `INSERT INTO "${schema.table}" (${cols.join(', ')}) VALUES (${placeholders})`,
      ...params
    ));

    // Insert roster rows.
    if (schema.childTable && Array.isArray(entry.roster)) {
      entry.roster.forEach((row, position) => {
        if (!row) return;
        const childCols = ['"parentId"', '"position"'];
        const childParams = [entry.id, position];

        for (const { key: fk, col } of schema.rosterCols) {
          const v = row[fk];
          childCols.push(`"${col}"`);
          childParams.push(v != null ? String(v) : null);
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
