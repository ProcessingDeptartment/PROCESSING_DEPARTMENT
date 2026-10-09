-- REC 7.4.2 Dry Monitoring: QC manual alignment (spec 9 Oct 2026). Additive only -- nothing is dropped.
--   1. ten scored signs + computed worstScore / totalScore / batchStatus + the NC reference
--   2. "(old)" archive columns for the five removed Yes/No checks (the original Boolean columns stay as they are)
--   3. nc_log: notify_sent / notify_at reserved for the email API (not used yet)
--   4. v_dry_monitoring_scores: trend view
-- Column names are the camelCase field keys (sub_* tables are generated from the record definition, see
-- scripts/generate-submission-schema.mjs), not snake_case.
ALTER TABLE "sub_dry_monitoring"
  ADD COLUMN IF NOT EXISTS "skinScore"         INTEGER,
  ADD COLUMN IF NOT EXISTS "coreScore"         INTEGER,
  ADD COLUMN IF NOT EXISTS "frillsScore"       INTEGER,
  ADD COLUMN IF NOT EXISTS "shapeScore"        INTEGER,
  ADD COLUMN IF NOT EXISTS "colourScore"       INTEGER,
  ADD COLUMN IF NOT EXISTS "wrinklesScore"     INTEGER,
  ADD COLUMN IF NOT EXISTS "stickyScore"       INTEGER,
  ADD COLUMN IF NOT EXISTS "mouldScore"        INTEGER,
  ADD COLUMN IF NOT EXISTS "odourScore"        INTEGER,
  ADD COLUMN IF NOT EXISTS "steamTimingScore"  INTEGER,
  ADD COLUMN IF NOT EXISTS "worstScore"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "totalScore"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "batchStatus"       TEXT,
  ADD COLUMN IF NOT EXISTS "ncEntryId"         TEXT,
  ADD COLUMN IF NOT EXISTS "mouldVisibleOld"         TEXT,
  ADD COLUMN IF NOT EXISTS "whiteSaltOnSurfaceOld"   TEXT,
  ADD COLUMN IF NOT EXISTS "caseHardeningOld"        TEXT,
  ADD COLUMN IF NOT EXISTS "surfaceShineOld"         TEXT,
  ADD COLUMN IF NOT EXISTS "footDamageOld"           TEXT;

-- keep what the five removed checks held on existing rows (Boolean -> 'Yes' / 'No')
UPDATE "sub_dry_monitoring" SET
  "mouldVisibleOld"       = CASE WHEN "mouldVisible"       IS NULL THEN NULL WHEN "mouldVisible"       THEN 'Yes' ELSE 'No' END,
  "whiteSaltOnSurfaceOld" = CASE WHEN "whiteSaltOnSurface" IS NULL THEN NULL WHEN "whiteSaltOnSurface" THEN 'Yes' ELSE 'No' END,
  "caseHardeningOld"      = CASE WHEN "caseHardening"      IS NULL THEN NULL WHEN "caseHardening"      THEN 'Yes' ELSE 'No' END,
  "surfaceShineOld"       = CASE WHEN "surfaceShine"       IS NULL THEN NULL WHEN "surfaceShine"       THEN 'Yes' ELSE 'No' END,
  "footDamageOld"         = CASE WHEN "footDamage"         IS NULL THEN NULL WHEN "footDamage"         THEN 'Yes' ELSE 'No' END
WHERE "mouldVisibleOld" IS NULL AND "whiteSaltOnSurfaceOld" IS NULL AND "caseHardeningOld" IS NULL
  AND "surfaceShineOld" IS NULL AND "footDamageOld" IS NULL;

ALTER TABLE "nc_log"
  ADD COLUMN IF NOT EXISTS "notify_sent" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "notify_at"   TIMESTAMPTZ(6);

CREATE OR REPLACE VIEW "v_dry_monitoring_scores" AS
SELECT m."id", m."jobNo" AS job_no, m."dryRoomArea" AS dry_room_area,
       (COALESCE(m."submittedAt", m."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date AS entry_date,
       m."skinScore" AS skin_score, m."coreScore" AS core_score, m."frillsScore" AS frills_score, m."shapeScore" AS shape_score,
       m."colourScore" AS colour_score, m."wrinklesScore" AS wrinkles_score, m."stickyScore" AS sticky_score,
       m."mouldScore" AS mould_score, m."odourScore" AS odour_score, m."steamTimingScore" AS steam_timing_score,
       m."worstScore" AS worst_score, m."totalScore" AS total_score, m."batchStatus" AS batch_status, m."ncEntryId" AS nc_entry_id,
       COALESCE(m."mouldScore", 0) >= 2        AS mould_flag,
       COALESCE(m."steamTimingScore", 0) = 3   AS missed_steam_flag,
       COALESCE(m."worstScore", 0) = 3         AS critical_flag,
       (COALESCE(m."skinScore",0) + COALESCE(m."coreScore",0) + COALESCE(m."frillsScore",0)
          + COALESCE(m."shapeScore",0) + COALESCE(m."colourScore",0)) > 0                         AS overdrying_signs,
       (COALESCE(m."stickyScore",0) >= 2 OR COALESCE(m."mouldScore",0) >= 2 OR COALESCE(m."odourScore",0) >= 1) AS underdrying_signs
FROM "sub_dry_monitoring" m
WHERE COALESCE(m."status", 'submitted') <> 'draft'
  AND m."batchStatus" IS NOT NULL;
