-- REC 7.4.2 Dry Monitoring — Product Condition Checks (NC auto-raise)
-- Adds muscle_damage, presence_of_guts, and comment columns to sub_dry_monitoring.
-- foot_damage (stored as "footDamage") already exists as a BOOLEAN column.
-- Adds source_field_key to nc_log for duplicate-guard queries.
-- Safe to re-run (IF NOT EXISTS guards throughout).

BEGIN;

-- 1. New columns on sub_dry_monitoring
ALTER TABLE sub_dry_monitoring
  ADD COLUMN IF NOT EXISTS "muscleDamage"      BOOLEAN,
  ADD COLUMN IF NOT EXISTS "presenceOfGuts"    BOOLEAN,
  ADD COLUMN IF NOT EXISTS "footDamageComment" TEXT,
  ADD COLUMN IF NOT EXISTS "muscleDamageComment" TEXT,
  ADD COLUMN IF NOT EXISTS "gutsComment"       TEXT;

-- 2. source_field_key on nc_log (for duplicate guard)
ALTER TABLE nc_log
  ADD COLUMN IF NOT EXISTS source_field_key TEXT;

-- 3. Extend v_dry_monitoring_flags to include the three new product-condition fields
--    The existing view covers old boolean columns; this adds the new ones using the
--    CROSS JOIN LATERAL (VALUES ...) pattern already in the view.
CREATE OR REPLACE VIEW "v_dry_monitoring_flags" AS
SELECT m."id" AS monitoring_id, m."jobNo" AS job_no,
       (COALESCE(m."submittedAt", m."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date AS entry_date,
       m."dryRoomArea" AS dry_room_area, f.field_key, f.answer
FROM "sub_dry_monitoring" m
CROSS JOIN LATERAL (VALUES
  ('mouldVisible',          m."mouldVisible",          TRUE),
  ('whiteSaltOnSurface',    m."whiteSaltOnSurface",    TRUE),
  ('caseHardening',         m."caseHardening",         TRUE),
  ('surfaceShine',          m."surfaceShine",          TRUE),
  ('footDamage',            m."footDamage",            TRUE),
  ('muscleDamage',          m."muscleDamage",          TRUE),
  ('presenceOfGuts',        m."presenceOfGuts",        TRUE),
  ('trolleysClearlyMarked', m."trolleysClearlyMarked", FALSE)
) AS f(field_key, answer, yes_is_bad)
WHERE COALESCE(m."status", 'submitted') <> 'draft'
  AND f.answer IS NOT NULL
  AND f.answer = f.yes_is_bad;

COMMIT;
