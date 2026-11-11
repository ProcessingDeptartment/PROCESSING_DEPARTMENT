-- REC 7.4.2 Dry Monitoring — Product condition checks: restore + "< 5% / > 5%" sub-question (2026-11-11)
-- Run in the Neon SQL Editor. Safe to re-run.
--
-- Why the checks disappeared: the nine field rows were never in "RecordFieldDef" (the 27 Oct change only
-- edited the static snapshot), so the next export-record-defs run (2 Nov) wrote the snapshot without them.
-- This script puts them in Neon, which is what the snapshot is generated from.
--
-- Already in Neon (checked 2026-11-11, nothing to do): sub_dry_monitoring."footDamage" / "muscleDamage" /
-- "presenceOfGuts" (BOOLEAN), "footDamageComment" / "muscleDamageComment" / "gutsComment" (TEXT),
-- and nc_log.source_field_key.

BEGIN;

-- 1. New columns: the percentage answer per check ('lt5' | 'gt5'; NULL when the check is No or unanswered)
ALTER TABLE sub_dry_monitoring
  ADD COLUMN IF NOT EXISTS "footDamagePct"     TEXT,
  ADD COLUMN IF NOT EXISTS "muscleDamagePct"   TEXT,
  ADD COLUMN IF NOT EXISTS "presenceOfGutsPct" TEXT;

-- 2. Field definitions. Remove any earlier copy of the nine rows, and the "Foot damage (old)" row:
--    footDamage is a live field again, so old entries show their answer under "Foot damage?" itself
--    (left in place, the "(old)" row would repeat every new Yes answer a second time).
DELETE FROM "RecordFieldDef"
 WHERE "recordKey" = 'dry-monitoring' AND "parentFieldKey" IS NULL
   AND "key" IN ('footDamage', 'footDamagePct', 'footDamageComment',
                 'muscleDamage', 'muscleDamagePct', 'muscleDamageComment',
                 'presenceOfGuts', 'presenceOfGutsPct', 'gutsComment',
                 'footDamageOld');

-- 3. Make room: everything after "Batch status" moves down to start 10 places after it
--    (Trolleys clearly marked, Comment / corrective action, ... keep their order).
WITH b AS (
  SELECT "position" AS p FROM "RecordFieldDef"
   WHERE "recordKey" = 'dry-monitoring' AND "key" = 'batchStatus' AND "parentFieldKey" IS NULL
), r AS (
  SELECT f."id", b.p + 9 + ROW_NUMBER() OVER (ORDER BY f."position") AS np
    FROM "RecordFieldDef" f, b
   WHERE f."recordKey" = 'dry-monitoring' AND f."parentFieldKey" IS NULL AND f."sectionIndex" IS NULL
     AND f."position" > b.p
)
UPDATE "RecordFieldDef" f SET "position" = r.np FROM r WHERE f."id" = r."id";

-- 4. The nine rows, placed straight after "Batch status" and before "Trolleys clearly marked"
WITH b AS (
  SELECT "position" AS p FROM "RecordFieldDef"
   WHERE "recordKey" = 'dry-monitoring' AND "key" = 'batchStatus' AND "parentFieldKey" IS NULL
), r AS (
  SELECT f."id", b.p + 9 + ROW_NUMBER() OVER (ORDER BY f."position") AS np
    FROM "RecordFieldDef" f, b
   WHERE f."recordKey" = 'dry-monitoring' AND f."parentFieldKey" IS NULL AND f."sectionIndex" IS NULL
     AND f."position" > b.p
)
UPDATE "RecordFieldDef" f SET "position" = r.np FROM r WHERE f."id" = r."id";


-- 5. New definition version (devices refresh their cached copy)
UPDATE "RecordDefinition" SET "version" = "version" + 1 WHERE "recordKey" = 'dry-monitoring';

-- 6. Reporting view: same rows as before, plus a "pct" column at the end
--    ('lt5' | 'gt5' for the three product condition checks, NULL for the other checks and for
--    Yes answers saved before the percentage question existed).
--    The existing columns keep their names and types, so anything already reading the view still works.
CREATE OR REPLACE VIEW "v_dry_monitoring_flags" AS
SELECT m."id" AS monitoring_id, m."jobNo" AS job_no,
       (COALESCE(m."submittedAt", m."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date AS entry_date,
       m."dryRoomArea" AS dry_room_area, f.field_key, f.answer, f.pct
FROM "sub_dry_monitoring" m
CROSS JOIN LATERAL (VALUES
  ('mouldVisible',          m."mouldVisible",          TRUE,  NULL::text),
  ('whiteSaltOnSurface',    m."whiteSaltOnSurface",    TRUE,  NULL::text),
  ('caseHardening',         m."caseHardening",         TRUE,  NULL::text),
  ('surfaceShine',          m."surfaceShine",          TRUE,  NULL::text),
  ('footDamage',            m."footDamage",            TRUE,  m."footDamagePct"),
  ('muscleDamage',          m."muscleDamage",          TRUE,  m."muscleDamagePct"),
  ('presenceOfGuts',        m."presenceOfGuts",        TRUE,  m."presenceOfGutsPct"),
  ('trolleysClearlyMarked', m."trolleysClearlyMarked", FALSE, NULL::text)
) AS f(field_key, answer, yes_is_bad, pct)
WHERE COALESCE(m."status", 'submitted') <> 'draft'
  AND f.answer IS NOT NULL
  AND f.answer = f.yes_is_bad;

COMMIT;

-- Check afterwards (expect the nine rows between batchStatus and trolleysClearlyMarked):
-- SELECT "position", "key", "type", "group" FROM "RecordFieldDef"
--  WHERE "recordKey" = 'dry-monitoring' AND "parentFieldKey" IS NULL ORDER BY "position";
