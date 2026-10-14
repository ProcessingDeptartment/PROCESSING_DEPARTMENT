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

1. Create the schema on the new host: `npx prisma migrate deploy` (with `DATABASE_URL` pointing at it).
2. Build the SQL from the archive (works with Neon switched off):
   ```bash
   node scripts/archive-to-sql.js --out restore.sql
   ```
   For the data as it stood at a past moment: `--as-of 2026-10-01T00:00:00Z`.
3. Load it: `psql "<new connection string>" -f restore.sql`
4. Point the API at the new host (`DATABASE_URL` in the Render dashboard and local `.env`).
5. Verify row counts against the latest `backup.js` file (its `counts` section).

The SQL uses `json_populate_recordset` (types come from the target schema) and switches foreign-key checks off for the load (`session_replication_role = replica`, which needs a privileged role). **The rebuild SQL has not yet been loaded into a real database — do a trial restore into a scratch database before relying on it.**

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
- **Photos:** archived separately by `scripts/image-archive-agent.mjs` into `PROCESSING_DEPARTMENT\Images`. No purge of Neon image data was built.
- **Host:** both tasks run on Michaela's PC. They must move to the file server with the site (see the site-migration note).
- **Trial restore** into a scratch database (see §3).
