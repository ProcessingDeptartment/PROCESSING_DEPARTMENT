-- REC 7.4.1: the trolley count is set once (asked in a pop-up on the first steam), so "reason trolley count changed"
-- goes. v_dry_job_progress selects every column of the table, so the whole view chain is dropped and re-created.
DROP VIEW IF EXISTS "v_dry_steam_profile", "v_dry_jobs_in_dry_room", "v_dry_trolley_loading", "v_dry_yield_by_farm",
                    "v_dry_yield_by_month", "v_dry_job_progress", "dry_process_entry";
ALTER TABLE "sub_drying_process" DROP COLUMN IF EXISTS "trolleyChangeReason";

CREATE OR REPLACE VIEW "dry_process_entry" AS
SELECT p."id", p."id" AS submission_id, p."jobNo" AS job_no,
       dry_local_date(p."entryDate") AS entry_date, p."entryDate" AS entry_at,
       p."completedBy" AS submitted_by, p."submittedAt" AS submitted_at, p."status",
       j."receivedFrom" AS received_from, j."processingFor" AS processing_for, j."intakeWeight" AS whole_weight_kg,
       p."noOfTrolleys" AS no_of_trolleys,
       p."cookedWeight" AS cooked_weight_kg, p."cookedWeightSourceIds" AS cooked_weight_source_ids,
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
