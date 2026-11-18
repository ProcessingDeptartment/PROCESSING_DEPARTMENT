# Task: Versioned record-def snapshots

## Goal

A record's template version is locked to **when the record was first started** (its earliest submission date).
When a template revision is made, only records started on or after the revision date use the new template.
Pre-revision records always render against the template that was in force when they began — even if they are
re-archived later (e.g. after verification or an amendment).

The existing content-hash check (`already` map in `archive-completed-records.mjs`) already skips unchanged
records, so there is no extra "cutoff skip" needed in the archive loop. The only new piece is making the
correct versioned template available when a record is archived or re-archived.

---

## Part 1 — Versioned template snapshots

### New Prisma model

Add to `prisma/schema.prisma`:

```prisma
model RecordDefinitionRevision {
  id         Int      @id @default(autoincrement())
  recordKey  String
  version    Int                       // RecordDefinition.version at snapshot time
  snapshotAt DateTime @default(now()) // when the revision was captured (used to match against record start dates)
  config     Json                      // full assembled config (same content as the .json file)

  definition RecordDefinition @relation(fields: [recordKey], references: [recordKey])
  @@unique([recordKey, version])
}
```

Add the reverse relation to `RecordDefinition`:
```prisma
revisions   RecordDefinitionRevision[]
```

Run `npx prisma migrate dev` (or `prisma db push` for Neon) after adding the model.

### Update `export-record-defs.mjs`

After writing `public/data/record-defs/<key>.json` as usual, also:

1. Write a versioned snapshot file:
   ```
   public/data/record-defs/snapshots/<recordKey>_v<version>.json
   ```

2. Upsert a `RecordDefinitionRevision` row (upsert on `[recordKey, version]` — idempotent):
   ```js
   await prisma.recordDefinitionRevision.upsert({
     where: { recordKey_version: { recordKey, version: out.version } },
     create: { recordKey, version: out.version, config: out.config },
     update: {},  // never overwrite an existing snapshot — snapshotAt is the original capture time
   });
   ```

3. Add `--no-snapshot` flag to suppress DB writes (for check/lint runs that use `RECORD_DEFS_OUT`).

4. Create `public/data/record-defs/snapshots/.gitkeep` so the folder is committed.

The snapshot files are committed to git alongside the main `.json` files so they are served statically.

---

## Part 2 — Template selection by record start date

### New helper in `src/archive-completed-record.js`

```js
// Load all revision snapshots for a record (sorted oldest first).
// Pass these in once per record from the archive script to avoid repeated FS reads.
function loadRevisions(recordKey) {
  const dir = path.join(SNAPSHOTS, 'snapshots');
  try {
    return fs.readdirSync(dir)
      .filter(f => f.startsWith(encodeURIComponent(recordKey) + '_v') && f.endsWith('.json'))
      .map(f => {
        const cfg = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const v = parseInt(f.match(/_v(\d+)\.json$/)?.[1], 10);
        return { version: v, cfg };
      })
      .sort((a, b) => a.version - b.version);
  } catch { return []; }
}

// Pick the config version that was in force on `day` (YYYY-MM-DD).
// Needs the RecordDefinitionRevision rows for this record (from DB, sorted by snapshotAt asc).
// Falls back to the current snapshot if no revision data is available.
function configForDay(recordKey, day, revisionRows) {
  if (!revisionRows || !revisionRows.length) return loadRecordConfig(recordKey);
  // Find the most recent revision whose snapshotAt date is <= the record's start day.
  const match = [...revisionRows]
    .reverse()
    .find(r => r.snapshotAt.toISOString().slice(0, 10) <= day);
  if (!match) return loadRecordConfig(recordKey);  // record pre-dates all known revisions
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(SNAPSHOTS, 'snapshots', encodeURIComponent(recordKey) + '_v' + match.version + '.json'),
        'utf8'
      )
    );
  } catch { return loadRecordConfig(recordKey); }
}
```

Export `configForDay` alongside the existing exports.

### Update `archiveSubmissions`

Add an optional `revisions` array to opts:

```js
function archiveSubmissions(recordKey, entries, { jobNo, name: pageName, date: day, meta, revisions } = {}) {
  // ...
  const config = revisions ? (configForDay(recordKey, day, revisions) || {}) : (loadRecordConfig(recordKey) || {});
  // rest unchanged
}
```

---

## Part 3 — Pass revision rows from the archive script

### Changes to `archive-completed-records.mjs`

1. **Load all revision rows** at the start (after connecting):

```js
const allRevisions = await prisma.recordDefinitionRevision.findMany({
  orderBy: [{ recordKey: 'asc' }, { snapshotAt: 'asc' }],
  select: { recordKey: true, version: true, snapshotAt: true },
});
// Group by recordKey for fast lookup
const revisionsByKey = new Map();
for (const r of allRevisions) {
  if (!revisionsByKey.has(r.recordKey)) revisionsByKey.set(r.recordKey, []);
  revisionsByKey.get(r.recordKey).push(r);
}
```

2. **Determine start date** for each group — the earliest `day` across all entries in the group.
   This is the date that selects the correct template version.

   ```js
   // After g.entries is built, before calling archiveSubmissions:
   const startDay = g.entries
     .map(e => dayOf(e.submissionDate) || dayOf(e.submittedAt) || dayOf(e.createdAt))
     .filter(Boolean)
     .sort()[0] || g.day;
   ```

3. **Pass revisions into archiveSubmissions**:

```js
const entry = archiveSubmissions(recordKey, g.entries, {
  jobNo: g.jobNo,
  name,
  date: g.day,
  meta: { sha256: hash },
  revisions: revisionsByKey.get(recordKey) || [],
  startDay,          // the date used for template selection
});
```

   Update `archiveSubmissions` signature to accept `startDay` (use it in place of `day` when calling `configForDay`).

---

## Migration / first run

- `export-record-defs.mjs` will snapshot all current templates as `v<N>` files and insert `RecordDefinitionRevision` rows.
- On first archive run after the migration, `revisionsByKey` will have entries. Records whose start date pre-dates the first
  snapshot will fall back to `loadRecordConfig` (current template) — the same behaviour as before.
- Going forward, every revision bump captured by `export-record-defs.mjs` creates a new snapshot row, and old records
  automatically use the correct versioned template on any future re-archive.

---

## Files to change

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `RecordDefinitionRevision` model + reverse relation |
| `scripts/export-record-defs.mjs` | Write versioned snapshot files + upsert revision rows |
| `src/archive-completed-record.js` | Add `configForDay`; update `archiveSubmissions` to accept `revisions` + `startDay` |
| `scripts/archive-completed-records.mjs` | Load revision rows; compute `startDay` per group; pass both to `archiveSubmissions` |
| `public/data/record-defs/snapshots/.gitkeep` | Create folder |
