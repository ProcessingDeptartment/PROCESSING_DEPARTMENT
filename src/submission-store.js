// Dual-write layer: when a formrecord:/monitoring_log: key is written, decompose the JSON
// array of entries into rows in the per-record submission table (and its roster child table).
// The KeyValue blob is still the source of truth; this is an additive projection for queries.
//
// Uses raw SQL ($executeRawUnsafe / $queryRawUnsafe) because the 131 submission models are
// generated and there's no Prisma model name we can reference at runtime — the table name
// comes from the record key.

const { jobSnapshotKeys } = require('./job-snapshot');
const { syncDryWeightOverrides } = require('./dry-weight-override');
const { fillLegacyStages } = require('./dry-stock-guard');

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
    case 'scored-select':   // REC 7.4.2 QC sign scores: whole numbers
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
  if (['id', 'status', 'source', 'createdAt', 'updatedAt', 'submittedAt', 'rawJson', 'inSpec', 'position', 'submissionGroupId', 'submissionDate', 'recordType', 'verifiedGroupAt'].includes(col)) {
    col = 'val_' + col;
  }
  return col;
}

// The COMPLETED BY block on every form-record page saves as entry.completedBy =
// { by, title, date, signature } (not as a field in entry.values). Its name goes into the
// submission table's single `completedBy` TEXT column; title/date/signature stay in rawJson.
// Falls back to a legacy values.completedBy so rows migrated from the old Sign-off fields
// survive a rewrite of the table.
function completedByText(entry, values) {
  const cb = entry && entry.completedBy;
  const by = cb && typeof cb === 'object' ? cb.by : cb;
  const name = (by != null && String(by).trim() !== '') ? by : (values && values.completedBy);
  return name == null || String(name).trim() === '' ? null : String(name).trim();
}

// REC 7.4.6 per-stage columns, read from the entry's server-set `stage` block (src/dry-stock-guard.js).
// is_latest: true on the newest SUBMITTED stage of the job, worked out over the whole array being written.
function stockExtraColumns() {
  const jobOf = (e) => String(((e && e.values) || {}).jobNo || '').trim().toUpperCase();
  const st = (e) => (e && e.stage) || null;
  const submitted = (e) => e && e.status !== 'draft';
  const blockDate = (b) => (b && b.date && !Number.isNaN(new Date(b.date).getTime()) ? new Date(b.date) : null);
  return [
    { col: 'stage_no', get: (e) => (st(e) && Number.isInteger(st(e).no) ? st(e).no : null) },
    { col: 'previous_submission_id', get: (e) => (st(e) && st(e).previousId) || null },
    { col: 'completion_status', get: (e) => (st(e) && st(e).status) || null },
    { col: 'signoff_required', get: (e) => (st(e) && typeof st(e).signoffRequired === 'boolean' ? st(e).signoffRequired : null) },
    { col: 'submitted_by', get: (e) => (st(e) && st(e).submittedBy) || null },
    { col: 'submitted_at', get: (e) => (st(e) && st(e).submittedAt ? new Date(st(e).submittedAt) : null) },
    { col: 'fields_filled', get: (e) => (st(e) && Number.isInteger(st(e).fieldsFilled) ? st(e).fieldsFilled : null) },
    { col: 'is_latest', get: (e, all) => {
      if (!st(e) || !submitted(e)) return false;
      const j = jobOf(e);
      const mine = (x) => submitted(x) && st(x) && jobOf(x) === j;
      return !(all || []).some((o) => o !== e && mine(o) && o.stage.no > e.stage.no);
    } },
    { col: 'financeRep', get: (e) => (e.financeRep && e.financeRep.by && String(e.financeRep.by).trim()) || null },
    { col: 'financeRepDate', get: (e) => blockDate(e.financeRep) },
  ];
}

// Discover which columns belong to the parent and which to the child (roster) table, using the
// RecordFieldDef rows in Neon. Cached per record key for the lifetime of the process.
// Entries expire after a minute so a re-seeded definition (seed-definitions.mjs) takes effect without restarting the API.
const schemaCache = new Map();
const SCHEMA_TTL_MS = 60 * 1000;

async function getSchema(prisma, recordKey) {
  const hit = schemaCache.get(recordKey);
  if (hit && Date.now() - hit.at < SCHEMA_TTL_MS) return hit.schema;

  const def = await prisma.recordDefinition.findUnique({
    where: { recordKey },
    include: { sections: true, fields: true, autofills: true },
  });
  if (!def) { schemaCache.set(recordKey, { at: Date.now(), schema: null }); return null; }

  // Job-level copies (receiving date, farm, ...) are not stored per record — see job-snapshot.js.
  const skip = jobSnapshotKeys(def);
  const topCols = [];
  const rosterCols = [];
  for (const f of def.fields) {
    if (skip.has(f.key)) continue;
    const sec = def.sections.find(s => {
      const idx = def.sections.indexOf(s);
      return idx === f.sectionIndex;
    });
    const col = toCol(f.key);
    const kind = columnKind(f.type);
    if (sec && sec.kind === 'roster') {
      rosterCols.push({ key: f.key, col, kind });
    } else {
      topCols.push({ key: f.key, col, kind, legacyFrom: (f.extraJson && f.extraJson.legacyFrom) || null });
    }
  }

  const schema = {
    table: toTable(recordKey),
    childTable: rosterCols.length ? toTable(recordKey) + '_row' : null,
    topCols,
    rosterCols,
    blockCompletedBy: false,
  };
  // form-record and monitoring-log pages carry the COMPLETED BY block. When the record has no completedBy field of
  // its own, fill the table's completedBy column from the block -- but only if the column exists
  // (checked once per record), so a table without it can never break the sync.
  if ((def.engine === 'form-record' || def.engine === 'monitoring-log') && !topCols.some((c) => c.col === 'completedBy')) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'completedBy' LIMIT 1`,
        schema.table
      );
      schema.blockCompletedBy = Array.isArray(rows) && rows.length > 0;
    } catch { schema.blockCompletedBy = false; }
  }
  // REC 7.4.6 progressive stages: stage_no, previous_submission_id, completion_status, signoff_required,
  // submitted_by/at, is_latest, fields_filled, financeRep/financeRepDate. Server-set (src/dry-stock-guard.js),
  // so they are not RecordFieldDef fields. Each is written only if the column exists (checked once), so
  // deploying before the migration can never break saving.
  schema.extraCols = [];
  if (recordKey === 'dry-stock-control') {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, schema.table);
      const have = new Set(rows.map((r) => r.column_name));
      schema.extraCols = stockExtraColumns().filter((c) => have.has(c.col));
    } catch { schema.extraCols = []; }
  }
  // position = the entry's index in the saved list (exact order). Written only if the column exists (checked once),
  // so deploying this code before the migration can never break saving.
  schema.hasPosition = false;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'position' LIMIT 1`, schema.table);
    schema.hasPosition = Array.isArray(rows) && rows.length > 0;
  } catch { schema.hasPosition = false; }
  // submissionGroupId / submissionDate / recordType — added by group_verification migration.
  schema.hasGroupCols = false;
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'submissionGroupId' LIMIT 1`, schema.table);
    schema.hasGroupCols = Array.isArray(rows) && rows.length > 0;
  } catch { schema.hasGroupCols = false; }
  // Only write columns the table really has (checked once per record). A field added to a record definition before its
  // migration has run is left to rawJson for now, instead of failing every save of that record.
  try {
    const cols = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, schema.table);
    const have = new Set(cols.map((r) => r.column_name));
    const missing = schema.topCols.filter((c) => !have.has(c.col)).map((c) => c.col);
    if (missing.length && have.size) {
      console.warn('submission store: ' + schema.table + ' has no column(s) ' + missing.join(', ') + ' - skipped until migrated');
      schema.topCols = schema.topCols.filter((c) => have.has(c.col));
    }
    if (schema.childTable) {
      const rcols = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, schema.childTable);
      const rhave = new Set(rcols.map((r) => r.column_name));
      const rmissing = schema.rosterCols.filter((c) => !rhave.has(c.col)).map((c) => c.col);
      if (rmissing.length && rhave.size) {
        console.warn('submission store: ' + schema.childTable + ' has no column(s) ' + rmissing.join(', ') + ' - skipped until migrated');
        schema.rosterCols = schema.rosterCols.filter((c) => rhave.has(c.col));
      }
    }
  } catch { /* leave the schema as built */ }
  schemaCache.set(recordKey, { at: Date.now(), schema });
  return schema;
}

// Returns a map of entry.id → { groupId, submissionDate: 'YYYY-MM-DD' } for every entry.
// Rules:
//   - Entries that already have a group ID keep it (even if the group is verified — the entry was
//     already part of that group; only NEW entries after verification get a new group).
//   - New entries share one group ID per calendar day (Africa/Johannesburg, UTC+2) unless the
//     existing group for that day is verified, in which case they start a fresh group (Q7 Option B).
function buildGroupAssignments(entries, recordKey, groupSnapshot, verifiedGroupIds) {
  const assignments = new Map();
  const dateToGroupId = new Map(); // date → group ID assigned for new entries this batch

  for (const entry of entries) {
    if (!entry || !entry.id) continue;

    // Reuse existing group
    const prev = groupSnapshot.get(entry.id);
    if (prev && prev.groupId) {
      assignments.set(entry.id, { groupId: prev.groupId, submissionDate: prev.date });
      continue;
    }

    // New entry: derive the calendar date in Africa/Johannesburg (UTC+2)
    const ts = entry.createdAt ? new Date(entry.createdAt) : new Date();
    const localMs = ts.getTime() + 2 * 60 * 60 * 1000;
    const date = new Date(localMs).toISOString().slice(0, 10);

    // Use an already-assigned group for this date in this batch
    if (dateToGroupId.has(date)) {
      assignments.set(entry.id, { groupId: dateToGroupId.get(date), submissionDate: date });
      continue;
    }

    // Look for an existing non-verified group on this date (from snapshot — surviving entries)
    let existingGroup = null;
    for (const [, info] of groupSnapshot) {
      if (info.date === date && info.groupId && !verifiedGroupIds.has(info.groupId)) {
        existingGroup = info.groupId;
        break;
      }
    }

    const groupId = existingGroup || `sub_group_${recordKey}_${date}_${entry.id.slice(0, 8)}`;
    dateToGroupId.set(date, groupId);
    assignments.set(entry.id, { groupId, submissionDate: date });
  }

  return assignments;
}

// opts.incremental (live saves only): touch only the submissions whose stored entry changed, were added or
// were removed, instead of deleting and re-inserting the whole table. Anything that is not a plain per-entry
// projection (dry-stock-control derives columns from OTHER entries) and every script/backfill call keeps the
// full rewrite, so a stale or drifted table is always healed by a normal full sync.
async function syncSubmissionRows(prisma, key, value, opts) {
  const prefix = prefixOf(key);
  if (!prefix) return;

  const recordKey = key.slice(prefix.length);
  const schema = await getSchema(prisma, recordKey);
  if (!schema) return; // no definition → no submission table

  let entries;
  try { entries = JSON.parse(value); } catch { return; }
  if (!Array.isArray(entries)) return;
  if (recordKey === 'dry-stock-control') fillLegacyStages(entries);   // projection only: old submissions become stage 1..n

  // Snapshot existing group assignments before any deletes so we can preserve them on re-insert.
  // Also fetch which group IDs are already verified so Q7 (new group after verification) is enforced.
  let groupSnapshot = new Map(); // id → { groupId, submissionDate: 'YYYY-MM-DD' }
  let verifiedGroupIds = new Set();
  if (schema.hasGroupCols) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT "id", "submissionGroupId", "submissionDate"::text AS sd FROM "${schema.table}" WHERE "submissionGroupId" IS NOT NULL`
      );
      groupSnapshot = new Map(rows.map(r => [r.id, { groupId: r.submissionGroupId, date: r.sd ? r.sd.slice(0, 10) : null }]));
      const vrows = await prisma.$queryRawUnsafe(
        `SELECT "submissionGroupId" FROM "submissions_group_verification" WHERE "recordType" = $1`, recordKey
      );
      verifiedGroupIds = new Set(vrows.map(r => r.submissionGroupId));
    } catch { /* columns not yet available; group writes are skipped */ }
  }

  // Assign a group ID to every entry. All entries on the same calendar day (Africa/Johannesburg)
  // share one group ID, unless the existing group for that day is already verified (Q7 = Option B:
  // post-verification entries get a fresh group). Entries that already have a group ID keep it.
  const groupAssignments = schema.hasGroupCols
    ? buildGroupAssignments(entries, recordKey, groupSnapshot, verifiedGroupIds)
    : null;

  // Atomic: one transaction. Full mode deletes every existing row for this record then re-inserts;
  // incremental mode deletes/re-inserts only the ids that differ.
  const stmts = [];
  const incremental = !!(opts && opts.incremental) && !(schema.extraCols && schema.extraCols.length);
  let existing = null;   // id -> stored rawJson (incremental only)

  const deleteIds = (ids) => {
    // Delete child rows first (FK constraint), then parents.
    if (schema.childTable) {
      stmts.push(prisma.$executeRawUnsafe(`DELETE FROM "${schema.childTable}" WHERE "parentId" = ANY($1::text[])`, ids));
    }
    stmts.push(prisma.$executeRawUnsafe(`DELETE FROM "${schema.table}" WHERE "id" = ANY($1::text[])`, ids));
  };

  if (incremental) {
    const cur = await prisma.$queryRawUnsafe(`SELECT "id", "rawJson" FROM "${schema.table}"`);
    existing = new Map(cur.map((r) => [r.id, r.rawJson]));
    const keep = new Set(entries.filter((e) => e && e.id).map((e) => e.id));
    const gone = [...existing.keys()].filter((id) => !keep.has(id));
    if (gone.length) deleteIds(gone);
  } else {
    if (schema.childTable) {
      stmts.push(prisma.$executeRawUnsafe(
        `DELETE FROM "${schema.childTable}" WHERE "parentId" IN (SELECT "id" FROM "${schema.table}")`
      ));
    }
    stmts.push(prisma.$executeRawUnsafe(`DELETE FROM "${schema.table}"`));
  }

  // Insert each entry as a parent row.
  for (const [pos, entry] of entries.entries()) {
    if (!entry || !entry.id) continue;
    if (incremental && existing.has(entry.id)) {
      if (existing.get(entry.id) === JSON.stringify(entry)) continue;   // unchanged: leave its rows alone
      deleteIds([entry.id]);                                           // changed: replace just this submission
    }
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
    if (schema.hasPosition) { cols.push('"position"'); params.push(pos); }

    if (groupAssignments) {
      const ga = groupAssignments.get(entry.id);
      if (ga) {
        cols.push('"submissionGroupId"', '"submissionDate"', '"recordType"');
        params.push(ga.groupId, new Date(ga.submissionDate + 'T00:00:00Z'), recordKey);
      }
    }

    for (const { key: fk, col, kind, legacyFrom } of schema.topCols) {
      // an "(old)" field (extraJson.legacyFrom) archives the value its removed field held on older entries
      const v = (values[fk] == null || values[fk] === '') && legacyFrom ? values[legacyFrom] : values[fk];
      cols.push(`"${col}"`);
      params.push(coerce(v, kind, recordKey, fk));
    }

    if (schema.blockCompletedBy) {
      cols.push('"completedBy"');
      params.push(completedByText(entry, values));
    }

    for (const { col, get } of (schema.extraCols || [])) {
      cols.push(`"${col}"`);
      params.push(get(entry, entries));
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

  // incremental: an add/remove/reorder shifts the index of entries we left alone -- refresh just those, one statement
  if (incremental && schema.hasPosition) {
    const moved = [];
    entries.forEach((e, pos) => { if (e && e.id && existing.has(e.id) && existing.get(e.id) === JSON.stringify(e)) moved.push([e.id, pos]); });
    if (moved.length) {
      const ps = [];
      const vals = moved.map(([id, pos]) => { ps.push(id, pos); return `($${ps.length - 1}::text, $${ps.length}::int)`; });
      stmts.push(prisma.$executeRawUnsafe(
        `UPDATE "${schema.table}" t SET "position" = v.pos FROM (VALUES ${vals.join(',')}) AS v(id, pos) WHERE t."id" = v.id AND t."position" IS DISTINCT FROM v.pos`, ...ps));
    }
  }

  // Run all statements in a single transaction.
  // opts.inTx: `prisma` is already a transaction client (the save's own transaction), so the statements run in order
  // inside it and any failure propagates -- the save and its table rows commit or roll back together.
  if (stmts.length) {
    if (opts && opts.inTx) { for (const st of stmts) await st; }
    else await prisma.$transaction(stmts);
  }
  if (recordKey === 'dry-cooking') await syncDryWeightOverrides(prisma, entries, completedByText);
}

module.exports = { syncSubmissionRows, getSchema, toTable };
