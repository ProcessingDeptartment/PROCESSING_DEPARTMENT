-- REC 7.4.2 Dry Monitoring: Entry date and Dry room area are now pulled from REC 7.4.1.
--   1. new columns: dryRoomAreaConfirmed (the "Confirm location" tick) and dryRoomAreaSourceId (the 7.4.1 entry the area came from)
--   2. "entryDate" on 7.4.2 now means "when the job entered drying" (same for every monitoring entry of a job), so the
--      three reporting views stop using it as the date of the monitoring entry and use the day the entry was
--      submitted/created (facility time zone) instead -- the same value entryDate used to hold. Column names unchanged.
ALTER TABLE "sub_dry_monitoring"
  ADD COLUMN IF NOT EXISTS "dryRoomAreaConfirmed" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "dryRoomAreaSourceId"  TEXT;

CREATE OR REPLACE VIEW "v_dry_monitoring_trolley_check" AS
SELECT m."id" AS monitoring_id, m."jobNo" AS job_no,
       (COALESCE(m."submittedAt", m."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date AS monitoring_date,
       m."noOfTrolleys" AS monitoring_trolleys, e."noOfTrolleys" AS job_trolleys, e."id" AS drying_entry_id
FROM "sub_dry_monitoring" m
LEFT JOIN LATERAL (
  SELECT d."id", d."noOfTrolleys" FROM "sub_drying_process" d
  WHERE d."jobNo" = m."jobNo" AND d."noOfTrolleys" IS NOT NULL AND COALESCE(d."status", 'submitted') <> 'draft'
    AND dry_local_date(d."entryDate") <= (COALESCE(m."submittedAt", m."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date
  ORDER BY d."entryDate" DESC NULLS LAST LIMIT 1
) e ON TRUE
WHERE m."noOfTrolleys" IS DISTINCT FROM e."noOfTrolleys";

CREATE OR REPLACE VIEW "v_dry_monitoring_estimate" AS
SELECT m."id" AS monitoring_id, m."jobNo" AS job_no,
       (COALESCE(m."submittedAt", m."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Johannesburg')::date AS entry_date,
       m."dryRoomArea" AS dry_room_area,
       m."cookingDate" AS cooking_date, m."estimatedDryDate" AS estimated_drying_date,
       (m."estimatedDryDate" - (now() AT TIME ZONE 'Africa/Johannesburg')::date) AS days_to_estimated_drying
FROM "sub_dry_monitoring" m
WHERE COALESCE(m."status", 'submitted') <> 'draft';

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
  ('trolleysClearlyMarked', m."trolleysClearlyMarked", FALSE)
) AS f(field_key, answer, yes_is_bad)
WHERE COALESCE(m."status", 'submitted') <> 'draft'
  AND f.answer IS NOT NULL
  AND f.answer = f.yes_is_bad;
