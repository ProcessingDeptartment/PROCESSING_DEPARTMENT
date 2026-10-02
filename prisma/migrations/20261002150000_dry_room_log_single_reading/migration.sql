-- REC 7.9.3.1 Dry Room Temp & Humidity Log: one Temperature + one Humidity per entry; Week, Shift, Date, Checked by
-- removed; system Entry date / Entry time added. NOTHING IS DELETED: the old columns stay, and their values are
-- copied to the "...Old" columns that the page shows labelled "(old)". Safe to re-run. Run in the Neon SQL Editor.

BEGIN;

-- 0. backups (kept; not overwritten on re-run)
CREATE TABLE IF NOT EXISTS "bak_20261002_sub_dry_room_temp_humidity_log" AS SELECT * FROM "sub_dry_room_temp_humidity_log";
CREATE TABLE IF NOT EXISTS "bak_20261002_RecordFieldDef_dry_room_log" AS
  SELECT * FROM "RecordFieldDef" WHERE "recordKey" = 'dry-room-temp-humidity-log';

-- 1. new columns
ALTER TABLE "sub_dry_room_temp_humidity_log"
  ADD COLUMN IF NOT EXISTS "entryDate"             DATE,
  ADD COLUMN IF NOT EXISTS "entryTime"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "temperature"           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "humidity"              DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "weekOld"               TEXT,
  ADD COLUMN IF NOT EXISTS "shiftOld"              TEXT,
  ADD COLUMN IF NOT EXISTS "dateOld"               DATE,
  ADD COLUMN IF NOT EXISTS "checkedByOld"          TEXT,
  ADD COLUMN IF NOT EXISTS "startShiftTempOld"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "startShiftHumidityOld" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "duringProdTempOld"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "duringProdHumidityOld" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "endShiftTempOld"       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "endShiftHumidityOld"   DOUBLE PRECISION;

-- 2. copy the old values across (only into empty cells)
UPDATE "sub_dry_room_temp_humidity_log" SET
  "weekOld"               = COALESCE("weekOld", "week"),
  "shiftOld"              = COALESCE("shiftOld", "shift"),
  "dateOld"               = COALESCE("dateOld", "date"),
  "checkedByOld"          = COALESCE("checkedByOld", "checkedBy"),
  "startShiftTempOld"     = COALESCE("startShiftTempOld", "startShiftTemp"),
  "startShiftHumidityOld" = COALESCE("startShiftHumidityOld", "startShiftHumidity"),
  "duringProdTempOld"     = COALESCE("duringProdTempOld", "duringProdTemp"),
  "duringProdHumidityOld" = COALESCE("duringProdHumidityOld", "duringProdHumidity"),
  "endShiftTempOld"       = COALESCE("endShiftTempOld", "endShiftTemp"),
  "endShiftHumidityOld"   = COALESCE("endShiftHumidityOld", "endShiftHumidity");

-- 3. backfill Entry date: the old typed Date where there is one, else the day the entry was submitted/created
--    (facility time). No guessing. Entry time is left empty on old entries (it was never recorded).
UPDATE "sub_dry_room_temp_humidity_log" SET
  "entryDate" = COALESCE("date",
    (COALESCE("submittedAt", "createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date)
WHERE "entryDate" IS NULL;

COMMIT;

-- 4. checks: row counts must match; list old entries that had NO typed Date (their Entry date came from createdAt)
SELECT (SELECT count(*) FROM "bak_20261002_sub_dry_room_temp_humidity_log") AS rows_before,
       (SELECT count(*) FROM "sub_dry_room_temp_humidity_log")              AS rows_after,
       (SELECT count(*) FROM "sub_dry_room_temp_humidity_log" WHERE "entryDate" IS NULL) AS rows_without_entry_date,
       (SELECT count(*) FROM "sub_dry_room_temp_humidity_log" WHERE "date" IS NULL)       AS old_entries_without_typed_date;
SELECT "id", "createdAt", "rawJson"::text AS raw FROM "sub_dry_room_temp_humidity_log" WHERE "date" IS NULL ORDER BY "createdAt";
