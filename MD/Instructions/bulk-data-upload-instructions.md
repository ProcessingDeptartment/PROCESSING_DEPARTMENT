# Bulk data upload: receiving, OOSW and cooking weight (Sep 1 to Oct 6 2026)

**Purpose:** load the abalone receiving records (33 jobs, 2,187 basket rows), the OOSW records (5 jobs) and the 3DP00199 cooking weight into the Neon database.
**Database:** Neon project `gentle-bird-25990158`, database `neondb`, branch `production`.
**Who runs it:** a person, in the Neon SQL editor. Claude writes and checks the SQL but does not run any INSERT.

## Files (run in this order)

| Step | File | Writes to | Expected result |
|---|---|---|---|
| 1 | `abalone_receiving_upload.sql` | `sub_abalone_receiving`, `sub_abalone_receiving_row` | 33 jobs, 2,187 basket rows |
| 2 | `oosw_and_cooking_upload.sql` | `sub_salting_oosw`, `sub_salting_oosw_row`, `sub_dry_cooking`, `sub_dry_cooking_row` | 5 OOSW records, 1 cooking record |

Run step 2 only after step 1 has committed. The OOSW file copies the farm name from the receiving records.

## Before you start

1. Open the Neon SQL editor: `https://console.neon.tech/app/projects/gentle-bird-25990158/branches/br-sweet-silence-ayop6pkp/sql-editor?database=neondb`
2. Confirm the database is `neondb` and the branch is `production`.
3. Run this check. Every count should be 0 on a clean database:

```sql
SELECT count(*) FROM sub_abalone_receiving WHERE source = 'bulk-import';
SELECT count(*) FROM sub_salting_oosw WHERE source = 'bulk-import';
SELECT count(*) FROM sub_dry_cooking WHERE source = 'bulk-import';
```

If any count is above 0, stop. The upload uses fixed IDs (`abr-<jobNo>`, `oosw-<jobNo>`, `dc-<jobNo>`), so existing rows with the same ID cause a duplicate key error.

## Steps

1. Open `abalone_receiving_upload.sql`, copy the whole file and paste it into an empty editor tab.
2. Click Run. The file is one transaction (`BEGIN` to `COMMIT`), so either everything loads or nothing does.
3. Run the step 1 checks below.
4. Repeat for `oosw_and_cooking_upload.sql`, then run the step 2 checks.

## Checks after step 1

```sql
SELECT count(*) AS jobs FROM sub_abalone_receiving WHERE source = 'bulk-import';              -- 33
SELECT count(*) AS basket_rows FROM sub_abalone_receiving_row WHERE "parentId" LIKE 'abr-%';  -- 2187
SELECT "jobNo", "toBeProcessedFor", "receivedFrom", "receivingDate", "intakeWeight"
FROM sub_abalone_receiving WHERE source = 'bulk-import' ORDER BY "receivingDate", "jobNo";
```

## Checks after step 2

```sql
SELECT count(*) FROM sub_salting_oosw WHERE source = 'bulk-import';      -- 5
SELECT count(*) FROM sub_salting_oosw_row WHERE "parentId" LIKE 'oosw-%'; -- 5
SELECT count(*) FROM sub_dry_cooking WHERE source = 'bulk-import';       -- 1
SELECT p."jobNo", r."sizeRange", r."wholeWeight", r.weight AS oosw_kg
FROM sub_salting_oosw p JOIN sub_salting_oosw_row r ON r."parentId" = p.id
WHERE p.source = 'bulk-import' ORDER BY p."jobNo";
```

Expected OOSW values:

| Job | Size range | Whole weight kg | OOSW kg |
|---|---|---|---|
| DPR01184 | 300-350g | 1643.436 | 463.78 |
| DPR01185 | 300-350g | 1161.55 | 295.50 |
| DPR01186 | 350-400g | 1502.37 | 413.60 |
| DPR01188 | 350-400g | 1557.691 | 417.31 |
| DPR01189 | 350-400g | 1415.640 | 393.12 |

3DP00199 has a cooking weight of 25.72 kg (`sub_dry_cooking_row.abaloneKg`) and no OOSW.

## If something fails

- **"Failed transaction: ROLLBACK required":** click the Rollback button (or run `ROLLBACK;`). Nothing was saved. Then read the error text.
- **"duplicate key value violates unique constraint":** rows with these IDs already exist. Run the "Before you start" check, then either delete the leftover bulk-import rows or ask Claude for a version with new IDs.
- **"column ... does not exist":** the table layout differs from what the file expects. Run the schema query below and send the output to Claude.

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('sub_salting_oosw','sub_salting_oosw_row','sub_dry_cooking','sub_dry_cooking_row')
ORDER BY table_name, ordinal_position;
```

## Removing the upload (only if it must be redone)

Deleting needs a deliberate decision. Run it as one transaction, and check the counts match what you expect before you commit:

```sql
BEGIN;
DELETE FROM sub_salting_oosw_row WHERE "parentId" LIKE 'oosw-%';
DELETE FROM sub_salting_oosw WHERE source = 'bulk-import';
DELETE FROM sub_dry_cooking_row WHERE "parentId" LIKE 'dc-%';
DELETE FROM sub_dry_cooking WHERE source = 'bulk-import';
DELETE FROM sub_abalone_receiving_row WHERE "parentId" LIKE 'abr-%';
DELETE FROM sub_abalone_receiving WHERE source = 'bulk-import';
-- check counts, then COMMIT; or ROLLBACK;
```

## Data rules used

- **Date range:** 1 Sep to 6 Oct 2026. Job numbers are split by date and by production type (CPR = canning, DPR = drying), using the job table in `build_import.py`.
- **Size range:** taken from the intake size on each row. Blank or "unknown" becomes 300-350g. 3DP00199 is 450g+.
- **Weights:** whole weights are in kg (grams divided by 1000, rounded to 3 decimals). Job `intakeWeight` is the sum of its basket whole weights.
- **OOSW %:** the OOSW percentage is of the whole weight, not of the intake weight or the cooking weight. The OOSW kg figures above come from those percentages.
- **Traceability:** every uploaded record has `source = 'bulk-import'`, so it can always be found or removed as a group. `completedBy` is "Michaela Cook" on all records.

## Assumptions to confirm

- In `sub_salting_oosw_row`, `wholeWeight` is the whole weight and `weight` is the OOSW kg.
- `sub_dry_cooking_row.process` is left blank for the 3DP00199 cooking row, because its valid values are not known.
- Receiving records use status `submitted` and `inSpec = true`.
- The cooking weight and OOSW figures were supplied by Michaela from the scanned OOSW sheets; the earlier OCR values were not used.
