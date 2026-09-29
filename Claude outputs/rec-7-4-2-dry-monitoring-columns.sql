-- REC 7.4.2 Dry Monitoring: new columns, old-value preservation, views.
-- Run in the Neon SQL Editor BEFORE deploying the code change. One transaction, safe to re-run.
-- Do NOT use prisma migrate / db push (schema drift, see SIGNOFF_MIGRATION_TODO.md).
--
-- Nothing is dropped here. The old "date", "qcCheck" and "supervisor" columns stay until the new code is
-- deployed (old code still writes them); a separate column-drop file follows after deploy.
-- "cookingDate" and "estimatedDryDate" are already DATE, so no *_old copies are needed for them.

BEGIN;

-- 0. Backups (created once; a re-run leaves the first backup untouched) --------------------------------
CREATE TABLE IF NOT EXISTS "bak_sub_dry_monitoring_20260929" AS
  SELECT * FROM "sub_dry_monitoring";
CREATE TABLE IF NOT EXISTS "bak_recordfielddef_dry_monitoring_20260929" AS
  SELECT * FROM "RecordFieldDef" WHERE "recordKey" = 'dry-monitoring';
CREATE TABLE IF NOT EXISTS "bak_recorddefinition_dry_monitoring_20260929" AS
  SELECT * FROM "RecordDefinition" WHERE "recordKey" = 'dry-monitoring';

-- 1. New columns ---------------------------------------------------------------------------------------
ALTER TABLE "sub_dry_monitoring"
  ADD COLUMN IF NOT EXISTS "entryDate"                  DATE,     -- server-stamped submit date (Africa/Johannesburg)
  ADD COLUMN IF NOT EXISTS "dateOld"                    DATE,     -- the removed typed Date
  ADD COLUMN IF NOT EXISTS "qcCheckOld"                 TEXT,     -- removed QC check
  ADD COLUMN IF NOT EXISTS "supervisorOld"              TEXT,     -- removed Supervisor
  ADD COLUMN IF NOT EXISTS "cookingDateSourceIds"       TEXT,     -- REC 7.4.0 entry ids the cooking date came from
  ADD COLUMN IF NOT EXISTS "cookingDateTypedManually"   BOOLEAN,
  ADD COLUMN IF NOT EXISTS "trolleysSourceSubmissionId" TEXT,     -- REC 7.4.1 entry the trolley count came from
  ADD COLUMN IF NOT EXISTS "trolleysTypedManually"      BOOLEAN;

-- 2. Preserve old values (only fills empty targets, so re-running never overwrites) ---------------------
UPDATE "sub_dry_monitoring" SET "dateOld"       = "date"       WHERE "dateOld"       IS NULL AND "date"       IS NOT NULL;
UPDATE "sub_dry_monitoring" SET "qcCheckOld"    = "qcCheck"    WHERE "qcCheckOld"    IS NULL AND "qcCheck"    IS NOT NULL;
UPDATE "sub_dry_monitoring" SET "supervisorOld" = "supervisor" WHERE "supervisorOld" IS NULL AND "supervisor" IS NOT NULL;

-- Old rows get an entry date from when they were saved, so trends and the trolley check still work.
UPDATE "sub_dry_monitoring"
   SET "entryDate" = (COALESCE("submittedAt", "createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date
 WHERE "entryDate" IS NULL;

-- 3. Views ---------------------------------------------------------------------------------------------
-- Trolley check now runs on the entry date instead of the removed typed date.
CREATE OR REPLACE VIEW "v_dry_monitoring_trolley_check" AS
SELECT m."id" AS monitoring_id, m."jobNo" AS job_no, m."entryDate" AS monitoring_date,
       m."noOfTrolleys" AS monitoring_trolleys, e."noOfTrolleys" AS job_trolleys, e."id" AS drying_entry_id
FROM "sub_dry_monitoring" m
LEFT JOIN LATERAL (
  SELECT d."id", d."noOfTrolleys" FROM "sub_drying_process" d
  WHERE d."jobNo" = m."jobNo" AND d."noOfTrolleys" IS NOT NULL AND COALESCE(d."status", 'submitted') <> 'draft'
    AND (m."entryDate" IS NULL OR dry_local_date(d."entryDate") <= m."entryDate")
  ORDER BY d."entryDate" DESC NULLS LAST LIMIT 1
) e ON TRUE
WHERE m."noOfTrolleys" IS DISTINCT FROM e."noOfTrolleys";

-- Overdue / due-this-week list.
CREATE OR REPLACE VIEW "v_dry_monitoring_estimate" AS
SELECT m."id" AS monitoring_id, m."jobNo" AS job_no, m."entryDate" AS entry_date, m."dryRoomArea" AS dry_room_area,
       m."cookingDate" AS cooking_date, m."estimatedDryDate" AS estimated_drying_date,
       (m."estimatedDryDate" - (now() AT TIME ZONE 'Africa/Johannesburg')::date) AS days_to_estimated_drying
FROM "sub_dry_monitoring" m
WHERE COALESCE(m."status", 'submitted') <> 'draft';

-- One row per entry per problem answer, for trends by room and week.
-- Yes is the problem on every check except "Trolleys clearly marked", where No is the problem.
CREATE OR REPLACE VIEW "v_dry_monitoring_flags" AS
SELECT m."id" AS monitoring_id, m."jobNo" AS job_no, m."entryDate" AS entry_date,
       m."dryRoomArea" AS dry_room_area, f.field_key, f.answer
FROM "sub_dry_monitoring" m
CROSS JOIN LATERAL (VALUES
  ('mouldVisible',          m."mouldVisible",          TRUE),
  ('whiteSaltOnSurface',    m."whiteSaltOnSurface",    TRUE),
  ('caseHardening',         m."caseHardening",         TRUE),
  ('surfaceShine',          m."surfaceShine",          TRUE),
  ('footDamage',            m."footDamage",            TRUE),
  ('trolleysClearlyMarked', m."trolleysClearlyMarked", FALSE)
) AS f(field_key, answer, yes_is_bad)
WHERE COALESCE(m."status", 'submitted') <> 'draft'
  AND f.answer IS NOT NULL
  AND f.answer = f.yes_is_bad;

COMMIT;

-- Checks (run after COMMIT) ------------------------------------------------------------------------------
-- SELECT (SELECT count(*) FROM "sub_dry_monitoring")           AS rows_now,
--        (SELECT count(*) FROM "bak_sub_dry_monitoring_20260929") AS rows_backup;
-- SELECT count(*) FILTER (WHERE "date"       IS DISTINCT FROM "dateOld")       AS date_mismatch,
--        count(*) FILTER (WHERE "qcCheck"    IS DISTINCT FROM "qcCheckOld")    AS qc_mismatch,
--        count(*) FILTER (WHERE "supervisor" IS DISTINCT FROM "supervisorOld") AS sup_mismatch,
--        count(*) FILTER (WHERE "entryDate" IS NULL)                            AS no_entry_date
--   FROM "sub_dry_monitoring";             -- all four should be 0
-- SELECT DISTINCT "dryRoomArea" FROM "sub_dry_monitoring" ORDER BY 1;   -- old area text, for mapping
