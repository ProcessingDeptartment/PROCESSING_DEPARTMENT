# Delete All Submission Data — dry-monitoring, drying-process, dry-cooking

**⚠️ DESTRUCTIVE — this permanently deletes all submission data for three records.**
**Take a Neon snapshot/backup before running.**

---

## Records targeted

| Record | Record key | DB tables |
|--------|-----------|-----------|
| Dry Monitoring | `dry-monitoring` | `sub_dry_monitoring` |
| Drying Process | `drying-process` | `sub_drying_process`, `sub_drying_process_row` |
| Dry Cooking | `dry-cooking` | `sub_dry_cooking`, `sub_dry_cooking_row` |

---

## Step 1 — Take a Neon snapshot (backup)

1. Go to [console.neon.tech](https://console.neon.tech)
2. Open the project → **Branches**
3. Click **Create branch** → name it `backup-before-dry-delete` → confirm
4. This creates a point-in-time copy you can restore from if needed

---

## Step 2 — Verify counts before deleting

Run these in the Neon SQL editor to confirm what will be deleted:

```sql
-- How many submissions in each record?
SELECT 'dry-monitoring'  AS record, COUNT(*) FROM sub_dry_monitoring;
SELECT 'drying-process'  AS record, COUNT(*) FROM sub_drying_process;
SELECT 'dry-cooking'     AS record, COUNT(*) FROM sub_dry_cooking;

-- How many roster rows (steam rows / pot rows)?
SELECT 'drying-process rows' AS record, COUNT(*) FROM sub_drying_process_row;
SELECT 'dry-cooking rows'    AS record, COUNT(*) FROM sub_dry_cooking_row;

-- How many KeyValue entries (the raw JSON blobs)?
SELECT COUNT(*) FROM "KeyValue" WHERE key LIKE 'formrecord:dry-monitoring:%';
SELECT COUNT(*) FROM "KeyValue" WHERE key LIKE 'formrecord:drying-process:%';
SELECT COUNT(*) FROM "KeyValue" WHERE key LIKE 'formrecord:dry-cooking:%';

-- How many SubmissionDateField index rows?
SELECT COUNT(*) FROM "SubmissionDateField" WHERE "recordKey" = 'dry-monitoring';
SELECT COUNT(*) FROM "SubmissionDateField" WHERE "recordKey" = 'drying-process';
SELECT COUNT(*) FROM "SubmissionDateField" WHERE "recordKey" = 'dry-cooking';
```

Review these counts and confirm they match your expectation before proceeding.

---

## Step 3 — Delete the data

Run the following in the Neon SQL editor. **Order matters** — delete child rows before parents, and index tables before KeyValue.

```sql
-- ── 1. Roster / child rows (must go before parents) ──────────────────────────

DELETE FROM sub_drying_process_row
WHERE "parentId" IN (SELECT id FROM sub_drying_process);

DELETE FROM sub_dry_cooking_row
WHERE "parentId" IN (SELECT id FROM sub_dry_cooking);

-- ── 2. Main submission tables ─────────────────────────────────────────────────

DELETE FROM sub_dry_monitoring;
DELETE FROM sub_drying_process;
DELETE FROM sub_dry_cooking;

-- ── 3. SubmissionDateField index rows ─────────────────────────────────────────

DELETE FROM "SubmissionDateField"
WHERE "recordKey" IN ('dry-monitoring', 'drying-process', 'dry-cooking');

-- ── 4. KeyValue blobs (raw JSON stored by the browser/API) ───────────────────

DELETE FROM "KeyValue" WHERE key LIKE 'formrecord:dry-monitoring:%';
DELETE FROM "KeyValue" WHERE key LIKE 'formrecord:drying-process:%';
DELETE FROM "KeyValue" WHERE key LIKE 'formrecord:dry-cooking:%';

-- Also delete the entry-log list keys (the index of submission IDs per record):
DELETE FROM "KeyValue" WHERE key = 'formrecord:dry-monitoring';
DELETE FROM "KeyValue" WHERE key = 'formrecord:drying-process';
DELETE FROM "KeyValue" WHERE key = 'formrecord:dry-cooking';
```

---

## Step 4 — Verify counts after deleting

```sql
-- All of these should return 0:
SELECT COUNT(*) FROM sub_dry_monitoring;
SELECT COUNT(*) FROM sub_drying_process;
SELECT COUNT(*) FROM sub_drying_process_row;
SELECT COUNT(*) FROM sub_dry_cooking;
SELECT COUNT(*) FROM sub_dry_cooking_row;

SELECT COUNT(*) FROM "KeyValue"
WHERE key LIKE 'formrecord:dry-monitoring%'
   OR key LIKE 'formrecord:drying-process%'
   OR key LIKE 'formrecord:dry-cooking%';

SELECT COUNT(*) FROM "SubmissionDateField"
WHERE "recordKey" IN ('dry-monitoring', 'drying-process', 'dry-cooking');
```

---

## Step 5 — Clear browser caches (optional but recommended)

The browser caches the submission list in `localStorage`. After deleting from the DB, operators should hard-refresh (`Ctrl+Shift+R`) on any device that was open on one of these forms so the local cache doesn't show stale entries.

---

## Notes

- The record **definitions** (form structure, field config) are NOT deleted — only the submission data.
- Images attached to dry-monitoring entries are tracked in the central table `submission_images` (`record_key = 'dry-monitoring'`). If you also want to delete those:
  ```sql
  DELETE FROM submission_images WHERE record_key = 'dry-monitoring';
  ```
  Note: this deletes only the DB rows. Photos already copied by the archive agent stay on the file server under `Images\742\`. Until `sub_dry_monitoring_images` is dropped, its old copies remain too; delete them separately if wanted.
- No code changes or redeployment needed — data deletion takes effect immediately.
