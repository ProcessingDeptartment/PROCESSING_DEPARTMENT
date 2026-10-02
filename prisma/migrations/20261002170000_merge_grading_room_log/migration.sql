-- REC 7.9.3.2 Grading Room Temp/Humidity Log merged into REC 7.9.3.1 (Room = location).
-- NOTHING IS DELETED. The old grading table stays as it is; its rows are COPIED into the 7.9.3.1 table with
-- Room = their own Room (else 'Grading Room'), sourceRecord = '7.9.3.2' and sourceRowId = the original row id.
-- Old Week / Shift / Date / Checked by / six readings go to the "...Old" columns (shown labelled "(old)").
-- Safe to re-run. Review first, then run in the Neon SQL Editor.

-- DRY RUN (read only): counts before
SELECT (SELECT count(*) FROM "sub_dry_room_temp_humidity_log")     AS dry_rows_before,
       (SELECT count(*) FROM "sub_grading_room_temp_humidity_log") AS grading_rows_before;

BEGIN;

-- 0. backups of both tables and both records' field definitions (kept; not overwritten on re-run)
CREATE TABLE IF NOT EXISTS "bak_20261002b_sub_dry_room_temp_humidity_log"     AS SELECT * FROM "sub_dry_room_temp_humidity_log";
CREATE TABLE IF NOT EXISTS "bak_20261002b_sub_grading_room_temp_humidity_log" AS SELECT * FROM "sub_grading_room_temp_humidity_log";
CREATE TABLE IF NOT EXISTS "bak_20261002b_RecordFieldDef_room_logs" AS
  SELECT * FROM "RecordFieldDef" WHERE "recordKey" IN ('dry-room-temp-humidity-log', 'grading-room-temp-humidity-log');

-- 1. traceability columns
ALTER TABLE "sub_dry_room_temp_humidity_log"
  ADD COLUMN IF NOT EXISTS "sourceRecord" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceRowId"  TEXT;

-- 2. copy the old grading-room lines across (ids kept; a re-run skips lines already copied)
INSERT INTO "sub_dry_room_temp_humidity_log"
  ("id", "status", "source", "submittedAt", "createdAt", "updatedAt", "rawJson", "inSpec", "room", "correctiveAction", "completedBy",
   "week", "shift", "date", "checkedBy", "startShiftTemp", "startShiftHumidity", "duringProdTemp", "duringProdHumidity", "endShiftTemp", "endShiftHumidity",
   "weekOld", "shiftOld", "dateOld", "checkedByOld", "startShiftTempOld", "startShiftHumidityOld", "duringProdTempOld", "duringProdHumidityOld", "endShiftTempOld", "endShiftHumidityOld",
   "entryDate", "sourceRecord", "sourceRowId")
SELECT g."id", g."status", g."source", g."submittedAt", g."createdAt", g."updatedAt", g."rawJson", g."inSpec",
       COALESCE(NULLIF(g."room", ''), 'Grading Room'), g."correctiveAction", g."completedBy",
       g."week", g."shift", g."date", g."checkedBy", g."startShiftTemp", g."startShiftHumidity", g."duringProdTemp", g."duringProdHumidity", g."endShiftTemp", g."endShiftHumidity",
       g."week", g."shift", g."date", g."checkedBy", g."startShiftTemp", g."startShiftHumidity", g."duringProdTemp", g."duringProdHumidity", g."endShiftTemp", g."endShiftHumidity",
       COALESCE(g."date", (COALESCE(g."submittedAt", g."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date),
       '7.9.3.2', g."id"
FROM "sub_grading_room_temp_humidity_log" g
WHERE NOT EXISTS (SELECT 1 FROM "sub_dry_room_temp_humidity_log" d WHERE d."sourceRecord" = '7.9.3.2' AND d."sourceRowId" = g."id")
ON CONFLICT ("id") DO NOTHING;

-- 3. old 7.9.3.1 lines that still have no Room get the old default
UPDATE "sub_dry_room_temp_humidity_log" SET "room" = 'Dry Room' WHERE "room" IS NULL AND "sourceRecord" IS NULL;

COMMIT;

-- 4. checks: dry_after must equal dry_before + grading_rows; grading table untouched
SELECT (SELECT count(*) FROM "bak_20261002b_sub_dry_room_temp_humidity_log")     AS dry_before,
       (SELECT count(*) FROM "bak_20261002b_sub_grading_room_temp_humidity_log") AS grading_before,
       (SELECT count(*) FROM "sub_dry_room_temp_humidity_log")                   AS dry_after,
       (SELECT count(*) FROM "sub_grading_room_temp_humidity_log")               AS grading_after,
       (SELECT count(*) FROM "sub_dry_room_temp_humidity_log" WHERE "sourceRecord" = '7.9.3.2') AS copied_from_grading,
       (SELECT count(*) FROM "sub_dry_room_temp_humidity_log" WHERE "entryDate" IS NULL)        AS rows_without_entry_date;
-- old lines with no typed Date (their Entry date came from createdAt) so they can be fixed by hand
SELECT "id", "createdAt", "sourceRecord" FROM "sub_dry_room_temp_humidity_log"
WHERE "date" IS NULL AND ("weekOld" IS NOT NULL OR "checkedByOld" IS NOT NULL OR "sourceRecord" IS NOT NULL) ORDER BY "createdAt";
