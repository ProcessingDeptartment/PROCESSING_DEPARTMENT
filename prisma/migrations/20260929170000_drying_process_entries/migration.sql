-- REC 7.4.1 Drying Process becomes an ENTRY LOG per job: one submission = one entry (movements, steams,
-- trolley count as at that time); all entries for a job number add up to the drying history.
--   sub_drying_process       one row per entry (job_no is the thread)
--   sub_drying_process_row   one row per steam done in that entry
-- Old single-record columns are kept as *Old columns (renamed, never deleted); the movement dates and
-- steam1..14 dates leave the table and are re-created by scripts/migrate-drying-process-entries.mjs from the
-- KeyValue blob (movement stamps + steam rows). Nothing is lost: KeyValue and every row's rawJson keep the
-- originals. Production held no 7.4.1 entries when this was written.
-- Run order: migrate-drying-process-entries.mjs (dry run) -> prisma migrate deploy -> seed-definitions ->
-- migrate-drying-process-entries.mjs --apply.
-- There is deliberately NO trolley loading guide (decision 2026-09-29): no loading-status columns.

-- 1. Old typed columns -> *Old ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('wholeWeight','wholeWeightOld'), ('cookingDate','cookingDateOld'), ('cookingWeight','cookingWeightOld'),
    ('removedFromTrolleysDate','removedFromTrolleysDateOld'), ('dateDeString','deStringDateOld'),
    ('dateGraded','gradedDateOld'), ('totalDryingTimeDays','totalDryingDaysOld'), ('dryWeight','dryWeightOld'),
    ('estimateYield','estimateYieldPctOld')) AS t(a, b)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sub_drying_process' AND column_name = r.a) THEN
      EXECUTE format('ALTER TABLE "sub_drying_process" RENAME COLUMN %I TO %I', r.a, r.b);
    END IF;
  END LOOP;
END $$;

ALTER TABLE "sub_drying_process"
  DROP COLUMN IF EXISTS "movementToDryRoom1Date", DROP COLUMN IF EXISTS "movementToContainerDate",
  DROP COLUMN IF EXISTS "movementToGradingRoomDate",
  DROP COLUMN IF EXISTS "steam1Date", DROP COLUMN IF EXISTS "steam2Date", DROP COLUMN IF EXISTS "steam3Date",
  DROP COLUMN IF EXISTS "steam4Date", DROP COLUMN IF EXISTS "steam5Date", DROP COLUMN IF EXISTS "steam6Date",
  DROP COLUMN IF EXISTS "steam7Date", DROP COLUMN IF EXISTS "steam8Date", DROP COLUMN IF EXISTS "steam9Date",
  DROP COLUMN IF EXISTS "steam10Date", DROP COLUMN IF EXISTS "steam11Date", DROP COLUMN IF EXISTS "steam12Date",
  DROP COLUMN IF EXISTS "steam13Date", DROP COLUMN IF EXISTS "steam14Date";

-- 2. New entry columns -----------------------------------------------------------------------------------
ALTER TABLE "sub_drying_process"
  ADD COLUMN IF NOT EXISTS "entryDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cookedWeight" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "cookedWeightSourceIds" TEXT,
  ADD COLUMN IF NOT EXISTS "noOfTrolleys" INTEGER,
  ADD COLUMN IF NOT EXISTS "trolleyChangeReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cookLossPct" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "movedIntoDryRoom" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "dateIntoDryRoomAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "movedIntoDryContainer" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "dateIntoDryContainerAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "movedIntoGradingRoom" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "dateIntoGradingRoomAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stampSource" TEXT,
  ADD COLUMN IF NOT EXISTS "movementReversedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "movementReversedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "movementReversedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "steamCount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "warningAck" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "warningNote" TEXT,
  ADD COLUMN IF NOT EXISTS "calculatedByMigration" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "dateRawJson" TEXT;

ALTER TABLE "sub_drying_process" DROP CONSTRAINT IF EXISTS "sub_drying_process_trolleys_positive";
ALTER TABLE "sub_drying_process" ADD CONSTRAINT "sub_drying_process_trolleys_positive"
  CHECK ("noOfTrolleys" IS NULL OR "noOfTrolleys" > 0);

-- 3. Steam child table -----------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "sub_drying_process_row" (
    "id" SERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "steamNo" INTEGER,
    "steamDate" DATE,
    "steamingTempC" DOUBLE PRECISION,
    "steamingTimeMin" INTEGER,
    "startTime" TIME,
    "doneBy" TEXT,
    "steamNoOld" INTEGER,
    CONSTRAINT "sub_drying_process_row_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sub_drying_process_row_parentId_idx" ON "sub_drying_process_row"("parentId");
CREATE INDEX IF NOT EXISTS "sub_drying_process_row_steamDate_idx" ON "sub_drying_process_row"("steamDate");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sub_drying_process_row_parentId_fkey') THEN
    ALTER TABLE "sub_drying_process_row" ADD CONSTRAINT "sub_drying_process_row_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "sub_drying_process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Indexes + one Yes per movement per job (database backstop; the API guard rejects it first) -----------
CREATE INDEX IF NOT EXISTS "sub_drying_process_jobNo_entryDate_idx" ON "sub_drying_process"("jobNo", "entryDate");
CREATE UNIQUE INDEX IF NOT EXISTS "sub_drying_process_one_dry_room" ON "sub_drying_process"("jobNo")
  WHERE "movedIntoDryRoom" IS TRUE AND COALESCE("status", 'submitted') <> 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS "sub_drying_process_one_dry_container" ON "sub_drying_process"("jobNo")
  WHERE "movedIntoDryContainer" IS TRUE AND COALESCE("status", 'submitted') <> 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS "sub_drying_process_one_grading_room" ON "sub_drying_process"("jobNo")
  WHERE "movedIntoGradingRoom" IS TRUE AND COALESCE("status", 'submitted') <> 'draft';

-- 5. Admin reversal of a wrongly answered Yes: every reversal is kept as a row here ----------------------
CREATE TABLE IF NOT EXISTS "dry_process_movement_audit" (
    "id" SERIAL NOT NULL,
    "job_no" TEXT NOT NULL,
    "movement" TEXT NOT NULL,            -- dryRoom | dryContainer | gradingRoom
    "entry_id" TEXT,
    "old_stamp" TIMESTAMP(3),
    "reversed_by" TEXT NOT NULL,
    "reversed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    CONSTRAINT "dry_process_movement_audit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dry_process_movement_audit_job_no_idx" ON "dry_process_movement_audit"("job_no");

-- 6. Views -----------------------------------------------------------------------------------------------
-- Plain SQL so they survive a move to another database. "Submitted" = anything that is not a draft.
-- Timestamps are stored as UTC; dates are the South African calendar day (dry_local_date).
CREATE OR REPLACE FUNCTION dry_local_date(ts TIMESTAMP) RETURNS DATE LANGUAGE sql IMMUTABLE AS
$$ SELECT ((ts AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Johannesburg')::date $$;

CREATE OR REPLACE VIEW "dry_process_entry" AS
SELECT p."id", p."id" AS submission_id, p."jobNo" AS job_no,
       dry_local_date(p."entryDate") AS entry_date, p."entryDate" AS entry_at,
       p."completedBy" AS submitted_by, p."submittedAt" AS submitted_at, p."status",
       j."receivedFrom" AS received_from, j."processingFor" AS processing_for, j."intakeWeight" AS whole_weight_kg,
       p."noOfTrolleys" AS no_of_trolleys, p."trolleyChangeReason" AS trolley_change_reason,
       p."cookedWeight" AS cooked_weight_kg, p."cookedWeightSourceIds" AS cooked_weight_source_ids,
       p."cookLossPct" AS cook_loss_pct,
       p."movedIntoDryRoom" AS moved_into_dry_room, p."dateIntoDryRoomAt" AS date_into_dry_room_at,
       dry_local_date(p."dateIntoDryRoomAt") AS date_into_dry_room,
       p."movedIntoDryContainer" AS moved_into_dry_container, p."dateIntoDryContainerAt" AS date_into_dry_container_at,
       dry_local_date(p."dateIntoDryContainerAt") AS date_into_dry_container,
       p."movedIntoGradingRoom" AS moved_into_grading_room, p."dateIntoGradingRoomAt" AS date_into_grading_room_at,
       dry_local_date(p."dateIntoGradingRoomAt") AS date_into_grading_room,
       p."stampSource" AS stamp_source, p."movementReversedBy" AS movement_reversed_by,
       p."movementReversedAt" AS movement_reversed_at, p."movementReversedReason" AS movement_reversed_reason,
       p."steamCount" AS steam_count, p."warningAck" AS warning_ack, p."warningNote" AS warning_note,
       p."wholeWeightOld" AS whole_weight_kg_old, p."cookingDateOld" AS cooking_date_old,
       p."cookingWeightOld" AS cooking_weight_kg_old, p."removedFromTrolleysDateOld" AS removed_from_trolleys_date_old,
       p."deStringDateOld" AS de_string_date_old, p."gradedDateOld" AS graded_date_old,
       p."totalDryingDaysOld" AS total_drying_days_old, p."dryWeightOld" AS dry_weight_kg_old,
       p."estimateYieldPctOld" AS estimate_yield_pct_old, p."calculatedByMigration" AS calculated_by_migration,
       p."dateRawJson" AS date_raw_json, p."createdAt" AS created_at, p."updatedAt" AS updated_at
FROM "sub_drying_process" p
LEFT JOIN "job_info" j ON j."jobNo" = p."jobNo";

CREATE OR REPLACE VIEW "dry_process_steam" AS
SELECT r."id", r."parentId" AS entry_id, r."parentId" AS submission_id, p."jobNo" AS job_no,
       r."position" + 1 AS row_no, r."steamNo" AS steam_no, r."steamNoOld" AS steam_no_old,
       r."steamDate" AS steam_date, r."steamingTempC" AS steaming_temp_c, r."steamingTimeMin" AS steaming_time_min,
       r."startTime" AS start_time, r."doneBy" AS done_by, p."status", p."submittedAt" AS submitted_at,
       p."createdAt" AS created_at
FROM "sub_drying_process_row" r JOIN "sub_drying_process" p ON p."id" = r."parentId";

-- The job-level picture built from all of a job's entries.
-- Grading: the latest non-draft record per grading table (cultivated / ranched) per job; a job with both
-- has their dried weights added. An old (migrated) dry weight is only a fallback, flagged in
-- dried_weight_source.
CREATE OR REPLACE VIEW "v_dry_job_progress" AS
WITH e AS (
  SELECT * FROM "sub_drying_process"
  WHERE COALESCE("status", 'submitted') <> 'draft' AND "jobNo" IS NOT NULL AND "jobNo" <> ''
), mv AS (
  SELECT "jobNo", count(*)::int AS entries, max("entryDate") AS last_entry_at,
         min("dateIntoDryRoomAt") FILTER (WHERE "movedIntoDryRoom") AS dry_room_at,
         min("dateIntoDryContainerAt") FILTER (WHERE "movedIntoDryContainer") AS container_at,
         min("dateIntoGradingRoomAt") FILTER (WHERE "movedIntoGradingRoom") AS grading_room_at,
         max("dryWeightOld") AS dry_weight_old
  FROM e GROUP BY "jobNo"
), st AS (
  SELECT p."jobNo", count(*)::int AS steams, min(r."steamDate") AS first_steam, max(r."steamDate") AS last_steam
  FROM "sub_drying_process_row" r JOIN e p ON p."id" = r."parentId" GROUP BY p."jobNo"
), tr AS (
  SELECT DISTINCT ON ("jobNo") "jobNo", "noOfTrolleys" FROM e WHERE "noOfTrolleys" IS NOT NULL
  ORDER BY "jobNo", "entryDate" DESC NULLS LAST, "submittedAt" DESC NULLS LAST
), ck AS (
  SELECT DISTINCT ON ("jobNo") "jobNo", "cookedWeight" FROM e WHERE "cookedWeight" IS NOT NULL
  ORDER BY "jobNo", "entryDate" DESC NULLS LAST, "submittedAt" DESC NULLS LAST
), g AS (
  SELECT * FROM (
    SELECT DISTINCT ON ("jobNo") "jobNo", "actualDriedWeight", "dateIntoGradingRoom", "gradingDate"
    FROM "sub_grading_production_log_cultivated" WHERE COALESCE("status", 'submitted') <> 'draft' AND "jobNo" IS NOT NULL
    ORDER BY "jobNo", "updatedAt" DESC
  ) c
  UNION ALL
  SELECT * FROM (
    SELECT DISTINCT ON ("jobNo") "jobNo", "actualDriedWeight", "dateIntoGradingRoom", "gradingDate"
    FROM "sub_grading_production_log_ranched" WHERE COALESCE("status", 'submitted') <> 'draft' AND "jobNo" IS NOT NULL
    ORDER BY "jobNo", "updatedAt" DESC
  ) r
), gr AS (
  SELECT "jobNo", sum("actualDriedWeight") AS dried_kg, min("dateIntoGradingRoom") AS date_in, max("gradingDate") AS graded
  FROM g GROUP BY "jobNo"
), base AS (
  SELECT mv."jobNo" AS job_no, ji."receivedFrom" AS received_from, ji."processingFor" AS processing_for,
         ji."intakeWeight" AS whole_weight_kg, ck."cookedWeight" AS cooked_weight_kg, mv.entries,
         COALESCE(st.steams, 0) AS steams_so_far, st.first_steam AS first_steam_date, st.last_steam AS last_steam_date,
         tr."noOfTrolleys" AS current_trolleys,
         dry_local_date(mv.dry_room_at) AS date_into_dry_room,
         dry_local_date(mv.container_at) AS date_into_dry_container,
         dry_local_date(mv.grading_room_at) AS date_into_grading_room,
         CASE WHEN mv.grading_room_at IS NOT NULL THEN 'In grading room'
              WHEN mv.container_at IS NOT NULL THEN 'In container'
              WHEN mv.dry_room_at IS NOT NULL THEN 'In dry room'
              ELSE 'Loaded' END AS current_stage,
         CASE WHEN mv.dry_room_at IS NOT NULL AND mv.grading_room_at IS NULL
              THEN CURRENT_DATE - dry_local_date(mv.dry_room_at) END AS days_in_dry_room_so_far,
         COALESCE(gr.dried_kg, mv.dry_weight_old) AS dried_weight_kg,
         CASE WHEN gr.dried_kg IS NOT NULL THEN '7.4.3 grading'
              WHEN mv.dry_weight_old IS NOT NULL THEN 'old 7.4.1 entry' END AS dried_weight_source,
         gr.graded AS graded_date,
         COALESCE(dry_local_date(mv.grading_room_at), gr.date_in, gr.graded) AS grading_room_date_used,
         mv.last_entry_at
  FROM mv
  LEFT JOIN st ON st."jobNo" = mv."jobNo" LEFT JOIN tr ON tr."jobNo" = mv."jobNo"
  LEFT JOIN ck ON ck."jobNo" = mv."jobNo" LEFT JOIN gr ON gr."jobNo" = mv."jobNo"
  LEFT JOIN "job_info" ji ON ji."jobNo" = mv."jobNo"
)
SELECT base.*,
       round((100 * dried_weight_kg / NULLIF(whole_weight_kg, 0))::numeric, 2) AS yield_pct,
       round((100 * (cooked_weight_kg - dried_weight_kg) / NULLIF(cooked_weight_kg, 0))::numeric, 2) AS drying_loss_pct,
       round((100 * (whole_weight_kg - cooked_weight_kg) / NULLIF(whole_weight_kg, 0))::numeric, 2) AS cook_loss_pct,
       CASE WHEN date_into_dry_room IS NOT NULL AND grading_room_date_used IS NOT NULL
            THEN grading_room_date_used - date_into_dry_room END AS drying_days,
       COALESCE(graded_date, grading_room_date_used) AS finished_date
FROM base;

-- Weighted yield = sum of dried kg / sum of whole kg. It is NOT the average of the per-job yields.
CREATE OR REPLACE VIEW "v_dry_yield_by_month" AS
SELECT date_trunc('month', finished_date)::date AS month, count(*)::int AS jobs,
       sum(whole_weight_kg) AS total_whole_kg, sum(dried_weight_kg) AS total_dried_kg,
       round((100 * sum(dried_weight_kg) / NULLIF(sum(whole_weight_kg), 0))::numeric, 2) AS weighted_yield_pct,
       round(avg(drying_days)::numeric, 1) AS avg_drying_days
FROM "v_dry_job_progress"
WHERE finished_date IS NOT NULL AND dried_weight_kg IS NOT NULL AND whole_weight_kg IS NOT NULL
GROUP BY 1;

-- Weighted yield = sum of dried kg / sum of whole kg. It is NOT the average of the per-job yields.
CREATE OR REPLACE VIEW "v_dry_yield_by_farm" AS
SELECT received_from AS farm, count(*)::int AS jobs,
       sum(whole_weight_kg) AS total_whole_kg, sum(dried_weight_kg) AS total_dried_kg,
       round((100 * sum(dried_weight_kg) / NULLIF(sum(whole_weight_kg), 0))::numeric, 2) AS weighted_yield_pct,
       round(avg(drying_days)::numeric, 1) AS avg_drying_days
FROM "v_dry_job_progress"
WHERE finished_date IS NOT NULL AND dried_weight_kg IS NOT NULL AND whole_weight_kg IS NOT NULL
GROUP BY 1;

-- Trolleys per job (latest count) with kg per trolley for trends. Reporting only: no loading guide.
CREATE OR REPLACE VIEW "v_dry_trolley_loading" AS
SELECT job_no, date_trunc('month', COALESCE(date_into_dry_room, first_steam_date, last_entry_at::date))::date AS month,
       current_trolleys AS trolleys,
       round((whole_weight_kg / NULLIF(current_trolleys, 0))::numeric, 1) AS whole_kg_per_trolley,
       round((cooked_weight_kg / NULLIF(current_trolleys, 0))::numeric, 1) AS cooked_kg_per_trolley,
       drying_days, yield_pct
FROM "v_dry_job_progress" WHERE current_trolleys IS NOT NULL;

CREATE OR REPLACE VIEW "v_dry_steam_profile" AS
SELECT s.job_no, count(*)::int AS steams,
       round(avg(s.steaming_temp_c)::numeric, 1) AS avg_steaming_temp_c,
       round(avg(s.steaming_time_min)::numeric, 1) AS avg_steaming_time_min,
       sum(s.steaming_time_min) AS total_steaming_time_min,
       round(((max(s.steam_date) - min(s.steam_date))::numeric / NULLIF(count(*) - 1, 0)), 1) AS avg_days_between_steams,
       p.drying_days, p.yield_pct
FROM "dry_process_steam" s
LEFT JOIN "v_dry_job_progress" p ON p.job_no = s.job_no
WHERE COALESCE(s.status, 'submitted') <> 'draft'
GROUP BY s.job_no, p.drying_days, p.yield_pct;

-- The live floor view: jobs between "into dry room" and "into grading room".
CREATE OR REPLACE VIEW "v_dry_jobs_in_dry_room" AS
SELECT job_no, received_from, processing_for, current_stage, date_into_dry_room, days_in_dry_room_so_far,
       steams_so_far, last_steam_date, current_trolleys
FROM "v_dry_job_progress"
WHERE date_into_dry_room IS NOT NULL AND date_into_grading_room IS NULL;

-- REC 7.4.2 entries whose trolley count differs from the job's count (latest 7.4.1 entry with a count on or
-- before the monitoring date).
CREATE OR REPLACE VIEW "v_dry_monitoring_trolley_check" AS
SELECT m."id" AS monitoring_id, m."jobNo" AS job_no, m."date" AS monitoring_date,
       m."noOfTrolleys" AS monitoring_trolleys, e."noOfTrolleys" AS job_trolleys, e."id" AS drying_entry_id
FROM "sub_dry_monitoring" m
LEFT JOIN LATERAL (
  SELECT d."id", d."noOfTrolleys" FROM "sub_drying_process" d
  WHERE d."jobNo" = m."jobNo" AND d."noOfTrolleys" IS NOT NULL AND COALESCE(d."status", 'submitted') <> 'draft'
    AND (m."date" IS NULL OR dry_local_date(d."entryDate") <= m."date")
  ORDER BY d."entryDate" DESC NULLS LAST LIMIT 1
) e ON TRUE
WHERE m."noOfTrolleys" IS DISTINCT FROM e."noOfTrolleys";
