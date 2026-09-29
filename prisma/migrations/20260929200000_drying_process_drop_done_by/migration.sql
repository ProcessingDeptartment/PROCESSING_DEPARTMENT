-- REC 7.4.1: "Done by" is removed from the steam rows (Michaela, 2026-09-29). Column dropped; the two views that
-- exposed it are dropped and re-created without it.
DROP VIEW IF EXISTS "v_dry_steam_profile", "dry_process_steam";
ALTER TABLE "sub_drying_process_row" DROP COLUMN IF EXISTS "doneBy";

CREATE OR REPLACE VIEW "dry_process_steam" AS
SELECT r."id", r."parentId" AS entry_id, r."parentId" AS submission_id, p."jobNo" AS job_no,
       r."position" + 1 AS row_no, r."steamNo" AS steam_no, r."steamNoOld" AS steam_no_old,
       r."steamDate" AS steam_date, r."steamingTempC" AS steaming_temp_c, r."steamingTimeMin" AS steaming_time_min,
       r."startTime" AS start_time, p."status", p."submittedAt" AS submitted_at,
       p."createdAt" AS created_at
FROM "sub_drying_process_row" r JOIN "sub_drying_process" p ON p."id" = r."parentId";

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
