# Type the submission tables — build spec for Claude Code

**Context:** the 175 `sub_*` submission tables in the live Neon database store every field as
`String?`, regardless of what kind of data it actually is. This was written by an earlier Claude
session (commit `0a001f0`, "relational layer 2," 2026-09-10, one day before this was reviewed) as
a design choice made *while building the relational layer* — not a decision made by anyone at
Abagold, and not something that's been load-bearing long enough to be risky to change. Now that
the project's near-term goal is reconciling this data against ERPNext (which will hand back typed
values), it's worth fixing properly instead of working around it with cast-at-query-time
documentation. See `claude/erp-reconciliation-prep.md` for the original field-by-field reference
this spec supersedes with a real fix, and `claude/erpnext-integration-spec.md` for the broader
integration this unblocks.

**The good news:** the information needed to type every field correctly already exists and is
already the system's own source of truth for field metadata — `data/record-definitions.json` (and
its database mirror, `RecordFieldDef.type`) declares a `type` per field:

| type | count | Prisma column type |
|---|---|---|
| `text` | 687 | `String?` (unchanged) |
| `number` | 292 | `Float?` |
| `yesno` | 282 | `Boolean?` |
| `date` | 227 | `DateTime?` (date-only) |
| `select` | 152 | `String?` (unchanged — options are strings) |
| `textarea` | 96 | `String?` (unchanged) |
| `jobsearch` | 47 | `String?` (unchanged — this is the job-number reconciliation key, see the open question in `claude/erp-reconciliation-prep.md` section 2; do not change its type even though it identifies numbers) |
| `computed` | 9 | follow the type of what it computes (check `computeFn` in `RecordFieldDef`; most are numeric) |
| `month` | 5 | `String?` (unchanged — `<input type="month">` value, e.g. `"2026-09"`, not a real date) |
| `recordpick` | 4 | `String?` (unchanged — references another record) |
| `timestamp` | 3 | `DateTime?` |
| `digits` | 3 | `Int?` |
| `derived` | 3 | follow the type of what it derives from |
| `time` | 2 | `String?` (unchanged — `HH:MM`, not worth a DateTime for two fields) |
| `jobnumber` | 1 | `String?` (unchanged — same reasoning as `jobsearch`) |
| `batchseq` | 1 | `String?` (unchanged — a sequence code, not numeric) |

So this is **not** a hand-picked allowlist of "ERP-relevant fields" — it's a mechanical mapping
driven by metadata the system already declares for every one of its ~1800 fields, run uniformly.
That's both more correct and lower-risk than picking fields by hand, since it can't miss a field
or apply inconsistent judgement.

## Why this needs to be three coordinated changes, not one

Changing `prisma/schema.prisma` alone will break every future submission. Here's why, and what
each piece needs:

### 1. `scripts/generate-submission-schema.mjs` — read `type` from the definition, emit the right Prisma type
Currently every field becomes `String?` unconditionally (line ~93: `` `${col.padEnd(24)} String?` ``).
Change this to look up the field's `type` from `def.fields` (already in scope as `f.type`) and emit
the mapped Prisma type per the table above. Apply the same change to the roster/child-table loop.

Keep `rawJson` on every table exactly as-is — it's the existing safety net (full JSON blob per
row) and should stay regardless of this change, so nothing is ever unrecoverable even if a cast
goes wrong somewhere.

### 2. `src/submission-store.js` — stop force-stringifying every value
This is the actual blocking risk. Line 112 currently does:
```js
params.push(v != null ? String(v) : null);
```
for **every** column, unconditionally, before a raw SQL `INSERT`. Once the target column is
`Float?`/`Int?`/`Boolean?`/`DateTime?` instead of `String?`, this needs to convert per the column's
real type instead of always stringifying — and, critically, **handle the case where the input is
not cleanly convertible** (empty string, stray text, inconsistent decimal formatting from a
half-filled paper form) without throwing and killing the whole transaction for that record.

Concretely: `getSchema()` already loads `RecordFieldDef` rows per record key — extend the cached
schema object to carry each column's target type alongside its key/col name, and add a
`coerce(value, type)` helper:
- `number`/`digits` → `parseFloat`/`parseInt`; on `NaN`, write `null` (not throw) and log a
  warning naming the record key, field, and raw value, so bad data is visible but never blocks a
  submission
- `yesno` → map the field's actual stored vocabulary (check what values the yesno inputs actually
  write today — likely `"Yes"`/`"No"` strings, possibly `"true"`/`"false"` in some records; confirm
  by sampling live data before assuming) to `true`/`false`/`null`
- `date`/`timestamp` → `new Date(v)`; on `Invalid Date`, write `null` and log the same warning
  shape
- everything else → unchanged `String(v)`

This preserves the existing "never let a storage failure break a form mid-shift" principle from
`BACKEND_INTEGRATION.md` — a bad value degrades to `null` in the typed column (recoverable from
`rawJson`) rather than failing the write.

### 3. A migration that doesn't lose or corrupt existing data
There are only 35 live submission rows total as of 2026-09-14 (per `claude/neon-db-live-audit.md`)
— small enough to migrate by regenerating rather than needing an in-place `ALTER COLUMN ... USING`
cast, which is the safer choice here anyway given point 2's coercion logic needs to run in
application code, not raw SQL:

1. Run `scripts/generate-submission-schema.mjs` (updated per step 1) to produce the new
   `prisma/submission-models.prisma`.
2. Before applying: back up the 35 existing rows (the existing `scripts/backup.js` compliance
   backup already does this — confirm a fresh backup exists, or run one, before migrating).
3. Apply the schema change as a new Prisma migration (`npx prisma migrate dev --name type_submission_columns`)
   — this will `DROP` and recreate the affected columns, so existing data in those columns is lost
   at the schema level. That's acceptable here because:
   - `KeyValue` remains the actual source of truth (per `submission-store.js`'s own comment: "The
     KeyValue blob is still the source of truth; this is an additive projection for queries") —
     nothing is lost from the system, only from the projection.
   - `rawJson` on each row is also about to be dropped and recreated by the same migration, so
     after migrating, **re-run the dual-write sync for all 35 existing `formrecord:`/`monitoring_log:`
     keys** (a one-off script reading every such key from `KeyValue` and calling
     `syncSubmissionRows` again) to repopulate the typed columns from the source of truth. Do not
     skip this step — otherwise the 9 populated tables go back to 0 rows and stay there until
     someone resubmits.
4. Verify: re-run the same row-count query used in the Neon audit
   (`select relname, n_live_tup from pg_stat_user_tables where relname like 'sub_%'`) and confirm
   the same 9 tables show the same row counts as before (3/3/3/2/2/1/1/6/14), now with typed
   columns populated instead of stringified text.

## What NOT to change in this pass
- `KeyValue` and `SubmissionDateField` — untouched, they're a separate layer and this doesn't
  affect either.
- `jobsearch`/`jobnumber`/`recordpick`/`batchseq`/`month`/`time` fields — deliberately left as
  `String?` per the table above; these are identifiers or formats where a string is the correct
  type, not a typing gap.
- The generator's overall shape (one table per record, `_Row` children, `rawJson` safety net) —
  none of that changes, only the per-field column type.

## Status
Ready to build. No open questions block this — the type mapping is mechanical (driven by existing
`record-definitions.json` metadata), the risk (submission-store.js's blind stringify) is identified
with a concrete fix, and the data volume (35 rows) is small enough that a full re-sync after
migration is the safe path rather than a risky in-place cast.
