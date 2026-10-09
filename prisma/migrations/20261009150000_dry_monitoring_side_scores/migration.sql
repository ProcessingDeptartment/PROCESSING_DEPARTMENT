-- REC 7.4.2: per-side Worst / Total scores (overdrying signs, underdrying signs) and a rebuilt trend view.
-- Follow-up to 20261009120000_dry_monitoring_qc_scores (that version was applied before these columns existed).
-- The view is dropped and recreated: CREATE OR REPLACE cannot change a view's column list.
ALTER TABLE "sub_dry_monitoring"
  ADD COLUMN IF NOT EXISTS "overdryingWorst"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "overdryingTotal"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "underdryingWorst"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "underdryingTotal"  DOUBLE PRECISION;

DROP VIEW IF EXISTS "v_dry_monitoring_scores";
CREATE VIEW "v_dry_monitoring_scores" AS
SELECT m."id", m."jobNo" AS job_no, m."dryRoomArea" AS dry_room_area,
       (COALESCE(m."submittedAt", m."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date AS entry_date,
       m."skinScore" AS skin_score, m."coreScore" AS core_score, m."frillsScore" AS frills_score, m."shapeScore" AS shape_score,
       m."colourScore" AS colour_score, m."wrinklesScore" AS wrinkles_score, m."stickyScore" AS sticky_score,
       m."mouldScore" AS mould_score, m."odourScore" AS odour_score,
       m."worstScore" AS worst_score, m."totalScore" AS total_score,
       m."overdryingWorst" AS overdrying_worst, m."overdryingTotal" AS overdrying_total,
       m."underdryingWorst" AS underdrying_worst, m."underdryingTotal" AS underdrying_total,
       m."batchStatus" AS batch_status, m."ncEntryId" AS nc_entry_id,
       COALESCE(m."mouldScore", 0) >= 2        AS mould_flag,
       COALESCE(m."worstScore", 0) = 3         AS critical_flag,
       (COALESCE(m."skinScore",0) + COALESCE(m."coreScore",0) + COALESCE(m."frillsScore",0)
          + COALESCE(m."shapeScore",0) + COALESCE(m."colourScore",0)) > 0 AS overdrying_signs,
       (COALESCE(m."stickyScore",0) >= 1 OR COALESCE(m."mouldScore",0) >= 2 OR COALESCE(m."odourScore",0) >= 1) AS underdrying_signs
FROM "sub_dry_monitoring" m
WHERE COALESCE(m."status", 'submitted') <> 'draft'
  AND m."batchStatus" IS NOT NULL;
