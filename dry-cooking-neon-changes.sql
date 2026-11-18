-- REC 7.4.0 Dry Cooking: make the Neon definition match public/data/record-defs/dry-cooking.json
-- (Job info = 4 standard fields; new Summary section after the Pots roster; cooked weight = job total so far).
-- Run in the Neon SQL editor. Safe to re-run. Roster (Pots) columns are not touched.
-- Afterwards:  node scripts/export-record-defs.mjs  -> public/data/record-defs/dry-cooking.json should come out unchanged.
DO $$
DECLARE ri int;
BEGIN
  SELECT t.idx INTO ri FROM (
    SELECT kind, row_number() OVER (ORDER BY position) - 1 AS idx
    FROM "RecordSectionDef" WHERE "recordKey" = 'dry-cooking') t
  WHERE t.kind = 'roster';
  IF ri IS NULL THEN RAISE EXCEPTION 'dry-cooking has no roster section - nothing changed'; END IF;

  DELETE FROM "RecordFieldDef" WHERE "recordKey" = 'dry-cooking' AND "sectionIndex" IS NOT NULL AND "sectionIndex" <> ri;
  DELETE FROM "RecordSectionDef" WHERE "recordKey" = 'dry-cooking' AND kind = 'fields';
  UPDATE "RecordSectionDef" SET position = 1 WHERE "recordKey" = 'dry-cooking' AND kind = 'roster';
  UPDATE "RecordFieldDef" SET "sectionIndex" = 1 WHERE "recordKey" = 'dry-cooking' AND "sectionIndex" = ri;
  -- live job cooked-weight figure feeds the Summary field
  UPDATE "RecordSectionDef" SET "extraJson" = jsonb_set(COALESCE("extraJson", '{}'::jsonb), '{jobWeights,cookedField}', '"cookedWeightKg"')
    WHERE "recordKey" = 'dry-cooking' AND kind = 'roster';

  INSERT INTO "RecordSectionDef" (id, "recordKey", title, kind, position, "extraJson")
  VALUES (gen_random_uuid()::text, 'dry-cooking', 'Job info', 'fields', 0, $j${"collapsible":true,"summaryFields":["jobNo","harvestFarm",{"key":"jiIntakeWeight","suffix":" kg"},{"key":"ooswKg","label":"OOSW:","suffix":" kg"}]}$j$::jsonb);
  INSERT INTO "RecordSectionDef" (id, "recordKey", title, kind, position, "extraJson")
  VALUES (gen_random_uuid()::text, 'dry-cooking', 'Summary', 'fields', 2, $j${"printSummaryTable":true,"cols":4,"summaryFields":[{"key":"ooswPct","label":"OOSW","suffix":" %"},{"key":"cookedWeightKg","label":"Cooked:","suffix":" kg"}]}$j$::jsonb);

  INSERT INTO "RecordFieldDef" (id, "recordKey", "sectionIndex", "parentFieldKey", key, label, type, required, "readOnly", unit, options, "group", position, "extraJson") VALUES
  (gen_random_uuid()::text, 'dry-cooking', 0, NULL, 'jobNo', 'Job number', 'jobsearch', true, false, NULL, '{}'::text[], NULL, 0, $j${"route":"Dried"}$j$::jsonb),
  (gen_random_uuid()::text, 'dry-cooking', 0, NULL, 'harvestFarm', 'Harvest farm', 'text', false, true, NULL, '{}'::text[], NULL, 1, NULL),
  (gen_random_uuid()::text, 'dry-cooking', 0, NULL, 'intakeDate', 'Intake date', 'date', false, true, NULL, '{}'::text[], NULL, 2, NULL),
  (gen_random_uuid()::text, 'dry-cooking', 0, NULL, 'jiIntakeWeight', 'Whole weight (Kg)', 'text', false, true, NULL, '{}'::text[], NULL, 3, NULL),
  (gen_random_uuid()::text, 'dry-cooking', 2, NULL, 'ooswKg', 'OOSW (kg)', 'text', false, true, NULL, '{}'::text[], NULL, 0, $j${"printFallback":"jiOoswKg"}$j$::jsonb),
  (gen_random_uuid()::text, 'dry-cooking', 2, NULL, 'ooswPct', 'OOSW %', 'number', false, true, NULL, '{}'::text[], NULL, 1, $j${"deriveFormula":{"expr":"ooswKg / jiIntakeWeight * 100","round":1}}$j$::jsonb),
  (gen_random_uuid()::text, 'dry-cooking', 2, NULL, 'cookedWeightKg', 'Cooked weight (kg)', 'number', false, true, 'kg', '{}'::text[], NULL, 2, NULL),
  (gen_random_uuid()::text, 'dry-cooking', 2, NULL, 'cookingDate', 'Cooking date', 'date', false, true, NULL, '{}'::text[], NULL, 3, $j${"recordDate":true}$j$::jsonb);
END $$;

-- check: expect Job info (0), Pots roster (1), Summary (2); 4 + 4 fields
SELECT kind, position, title FROM "RecordSectionDef" WHERE "recordKey" = 'dry-cooking' ORDER BY position;
SELECT "sectionIndex", position, key, type, "readOnly" FROM "RecordFieldDef" WHERE "recordKey" = 'dry-cooking' AND "parentFieldKey" IS NULL AND "sectionIndex" IS NOT NULL ORDER BY "sectionIndex", position;
