# Data Archiving — Neon Postgres to Local Server

**Purpose:** Keep a permanent copy of all processing system data on the local company server, so nothing depends on Neon alone. Updated 2026-10-14 to describe what is actually built (this replaces the earlier `pg_dump` plan).

**Rules:** nothing is ever pruned or deleted. Unchanged data is never stored twice.

---

## 1. What runs

| Task (Windows Task Scheduler, Michaela's PC) | Time | Script | Output |
|---|---|---|---|
| Abagold FSMS Daily Backup | daily 19:00 | `scripts/backup.js` | `..\RECORD BACKUPS\records-backup-<stamp>.json` — full snapshot, verified after writing |
| Abagold FSMS Change Archive | daily 19:30 | `scripts/archive-changes.js` | `..\DB ARCHIVE\changes\<table>\` and `..\DB EXPORTS\<table>\` |

Both run with `StartWhenAvailable`, so a night the PC was off is caught up. Both read `DATABASE_URL` from `.env` and need nothing installed beyond the project's own `node_modules`.

`..` is `T:\Abagold Processing Facility\20. Paperless\`. Override with `ARCHIVE_DIR` / `EXPORT_DIR` / `BACKUP_DIR` in `.env`, or `--out "<folder>"`.

## 2. The change archive

`archive-changes.js` reads every public table (except `_prisma_migrations`) in one consistent snapshot. Tables are discovered from `information_schema`, so **new `sub_*` tables are picked up automatically — nothing to edit when a record is added.**

For each table it replays that table's log and compares:
- row new → written (`op: put`)
- row content changed → written (`op: put`)
- row gone from the database → `op: del`
- row identical → nothing written

An unchanged night writes nothing. Each run verifies itself by replaying the logs and comparing to what it read; it exits non-zero on a mismatch.

```
DB ARCHIVE\
  README.txt
  changes\<table>\<table>_YYYY-MM.jsonl     append-only, one file per month; never edit or delete
DB EXPORTS\
  <table>\<table>_<stamp>.csv               readable full copy, only when that table changed
```

Primary keys identify rows; a table with no primary key uses the row content as its identity.

## 3. Restore / leaving Neon

1. Create the schema on the new host from `schema.prisma` (**not** `prisma migrate deploy` — the migrations cannot be replayed on an empty database; later ones assume tables created outside them):
   ```bash
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output schema.sql
   psql "<new connection string>" -f schema.sql
   ```
   This needs no database connection. It does not create views, triggers or the 5 tables listed under §6.
2. Build the SQL from the archive (works with Neon switched off):
   ```bash
   node scripts/archive-to-sql.js --out restore.sql
   ```
   For the data as it stood at a past moment: `--as-of 2026-10-01T00:00:00Z`.
3. Load it: `psql "<new connection string>" -f restore.sql`
4. Point the API at the new host (`DATABASE_URL` in the Render dashboard and local `.env`).
5. Verify row counts against the latest `backup.js` file (its `counts` section).

The SQL uses `json_populate_recordset` (types come from the target schema) and switches foreign-key checks off for the load (`session_replication_role = replica`, which needs a privileged role).

**Trial restore, 2026-10-14:** schema built from `schema.prisma`, `restore.sql` loaded into an empty in-memory Postgres (PGlite, scratch only), row counts compared with live Neon. Result: **214 of 214 schema tables restored with identical row counts** (4,583 rows; re-run after `dry_process_movement_audit` was added to the schema). Only 2 statements failed, both for the `bak_*` tables below. Not tested: a real Postgres 18 server, views/triggers, or the app running against the restored database.

For the app's own restore path use `scripts/restore.js` with a `backup.js` file (KeyValue only; the other tables are derived).

## 4. What Neon does and does not hold

- Neon holds the live data and, in `KeyValueHistory`, an append-only audit trail of every record version.
- Neon's point-in-time restore window is **6 hours** — an undo buffer, not an archive. Anything older than that can only be recovered from the files on T:.
- If the Neon project or account were lost, the T: files are the only copy.

## 5. Monitoring

- Task Scheduler → each task → History tab (enable it) shows success/failure. `LastTaskResult` 0 = success.
- `archive-changes.js` prints a summary each run: tables changed, rows new/changed/removed, or "no changes since last run".
- Spot check: row counts in the latest `backup.js` file against Neon.

## 6. Not built / open items

- **`pg_dump` binary dumps:** not installed — `get.enterprisedb.com` returned 403 to `winget`. Neon is Postgres 18.6, so the client tools must be v18+. If IT allows that host, a `pg_dump -Fc` job can be added on top (it would also give a one-command `pg_restore`).
- **Photos:** all record photos live in the central table `submission_images` (replaces `sub_dry_monitoring_images`, which is left in place until dropped by hand). `scripts/image-archive-agent.mjs` copies them to `PROCESSING_DEPARTMENT\Images\<recNo>\YYYY\MM\` as `<recNo>_<job>_<submissionId>_<fieldKey>_<date>_<id>.<ext>`; see `central-image-archive-instructions.md`. `archive-changes.js` picks `submission_images` up automatically but **leaves out the base64 `image_data` column** (`EXCLUDE_COLUMNS` in the script), because the files in `Images\` are the copy. A restore loads those rows with `image_data` NULL; the photos are then only the files on disk. Add another table or column to `EXCLUDE_COLUMNS` only if the column is nullable. No purge of Neon image data was built: the 90-day purge SQL in the central-image-archive doc (`SET image_data = NULL` where `archived_locally`) is not scheduled.
- **Host:** both tasks run on Michaela's PC. They must move to the file server with the site (see the site-migration note).
- **Tables not in `schema.prisma`** (5): the `bak_20261002*` manual backup copies. Their rows are in the archive, but a restore skips them with an error unless their tables are created by hand first. (`dry_process_movement_audit` was added to the schema 2026-10-14.)
- **Trial restore on a real Postgres server** (the 2026-10-14 trial used PGlite).
