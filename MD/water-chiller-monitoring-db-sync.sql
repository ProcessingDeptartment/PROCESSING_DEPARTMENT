-- DB sync for water & chiller monitoring field changes
-- Matches the JSON edits committed 2026-11-10
-- Run in Neon console (console.neon.tech) against the production database.
-- After running, verify with: SELECT key FROM "RecordFieldDef" WHERE "recordKey" IN
--   ('water-monitoring','lha-water-monitoring','chiller-temperature-monitoring')
--   ORDER BY "recordKey", position;

-- ─────────────────────────────────────────────────────────────
-- REC 7.8.9  water-monitoring
-- Remove: month, date, checkedBy
-- ─────────────────────────────────────────────────────────────
DELETE FROM "RecordFieldDef"
WHERE "recordKey" = 'water-monitoring'
  AND key IN ('month', 'date', 'checkedBy')
  AND "parentFieldKey" IS NULL;

-- ─────────────────────────────────────────────────────────────
-- REC 7.8.9.1  lha-water-monitoring
-- Remove: month, date, timeOfCheck, checkedBy
-- ─────────────────────────────────────────────────────────────
DELETE FROM "RecordFieldDef"
WHERE "recordKey" = 'lha-water-monitoring'
  AND key IN ('month', 'date', 'timeOfCheck', 'checkedBy')
  AND "parentFieldKey" IS NULL;

-- ─────────────────────────────────────────────────────────────
-- REC 7.9.1  chiller-temperature-monitoring
-- Remove: date, shift, checkedBy, chiller1DialTemp, chiller1ProductTemp,
--         chiller2DialTemp, chiller2ProductTemp, freezerDialTemp
-- Add:    chillerUnit (select), dialTemp (number), productTemp (number)
-- Update: timeOfCheck — keep but its label is now just "Time" (already correct)
-- ─────────────────────────────────────────────────────────────
DELETE FROM "RecordFieldDef"
WHERE "recordKey" = 'chiller-temperature-monitoring'
  AND key IN ('date', 'shift', 'checkedBy',
              'chiller1DialTemp', 'chiller1ProductTemp',
              'chiller2DialTemp', 'chiller2ProductTemp',
              'freezerDialTemp')
  AND "parentFieldKey" IS NULL;

-- Re-sequence remaining fields 0..N so positions are clean after the deletes above,
-- then append chillerUnit / dialTemp / productTemp at the end (before correctiveAction).
-- This avoids any assumption about what positions exist in the DB right now.

-- Step 1: compact remaining fields into a clean 0-based sequence
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY position) - 1 AS new_pos
  FROM "RecordFieldDef"
  WHERE "recordKey" = 'chiller-temperature-monitoring'
    AND "parentFieldKey" IS NULL
)
UPDATE "RecordFieldDef" f
SET position = o.new_pos
FROM ordered o
WHERE f.id = o.id;

-- Step 2: insert new fields after the last surviving field
-- (correctiveAction should be last; we insert before it by shifting it up)
UPDATE "RecordFieldDef"
SET position = position + 3
WHERE "recordKey" = 'chiller-temperature-monitoring'
  AND "parentFieldKey" IS NULL
  AND key = 'correctiveAction';

INSERT INTO "RecordFieldDef"
  ("id", "recordKey", "sectionIndex", "parentFieldKey", key, label, type, options, position,
   required, "readOnly", unit, "group")
SELECT
  gen_random_uuid(),
  'chiller-temperature-monitoring', NULL, NULL,
  v.key, v.label, v.type, v.options::text[],
  (SELECT position FROM "RecordFieldDef"
   WHERE "recordKey" = 'chiller-temperature-monitoring'
     AND "parentFieldKey" IS NULL
     AND key = 'correctiveAction') - (3 - v.offset),
  false, false, v.unit, NULL
FROM (VALUES
  ('chillerUnit', 'Unit',         'select', '{"Chiller 1","Chiller 2","Freezer"}', NULL, 2),
  ('dialTemp',    'Dial temp',    'number', '{}',                                  '°C', 1),
  ('productTemp', 'Product temp', 'number', '{}',                                  '°C', 0)
) AS v(key, label, type, options, unit, offset);

-- Link productTemp spec key (chillerTemp) via extraJson
UPDATE "RecordFieldDef"
SET "extraJson" = jsonb_set(COALESCE("extraJson"::jsonb, '{}'::jsonb), '{specKey}', '"chillerTemp"')
WHERE "recordKey" = 'chiller-temperature-monitoring'
  AND key IN ('dialTemp', 'productTemp')
  AND "parentFieldKey" IS NULL;

-- Update ncThresholds on RecordDefinition to reference new productTemp field
-- (removes the two old chiller1ProductTemp / chiller2ProductTemp thresholds)
UPDATE "RecordDefinition"
SET "extraJson" = jsonb_set(
  COALESCE("extraJson"::jsonb, '{}'::jsonb),
  '{ncThresholds}',
  '[{"max":10,"min":0,"field":"productTemp","label":"Product temperature","category":"Temperature out of spec","severity":"major","description":"Product temperature {value}°C — outside accepted range 0–10°C."}]'::jsonb
)
WHERE "recordKey" = 'chiller-temperature-monitoring';

-- Bump version on all three RecordDefinitions so the engine cache-busts
UPDATE "RecordDefinition"
SET version = version + 1
WHERE "recordKey" IN (
  'water-monitoring',
  'lha-water-monitoring',
  'chiller-temperature-monitoring'
);
