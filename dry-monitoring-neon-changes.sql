BEGIN;

-- 1. Columns for the new Cooked weight field (REC 7.4.2 stores what it pulls)
ALTER TABLE "sub_dry_monitoring"
  ADD COLUMN IF NOT EXISTS "cookedWeight" NUMERIC,
  ADD COLUMN IF NOT EXISTS "cookedWeightSourceIds" TEXT,
  ADD COLUMN IF NOT EXISTS "cookedWeightTypedManually" TEXT;

-- 2. Remove the scoring block (NC/status rules) from the definition
UPDATE "RecordDefinition" SET "extraJson" = "extraJson" - 'scoring'
  WHERE "recordKey" = 'dry-monitoring';

-- 3. Remove score-number fields and the Confirm location tick
DELETE FROM "RecordFieldDef"
  WHERE "recordKey" = 'dry-monitoring'
    AND "key" IN ('worstScore', 'totalScore', 'overdryingWorst', 'overdryingTotal', 'underdryingWorst', 'underdryingTotal', 'batchStatus', 'dryRoomAreaConfirmed');

-- 4. Current location: read-only text, pulled from REC 7.4.1
UPDATE "RecordFieldDef"
  SET "type" = 'text', "readOnly" = true, "options" = '{}',
      "extraJson" = jsonb_set(COALESCE("extraJson", '{}'::jsonb), '{fromRecord}',
        '{"note":"From REC 7.4.1","source":"drying-location","missing":"REC 7.4.1 has no room movement for this job yet. Record it in REC 7.4.1 first","idsField":"dryRoomAreaSourceId"}'::jsonb)
  WHERE "recordKey" = 'dry-monitoring' AND "key" = 'dryRoomArea';

-- 5. Cooked weight field (locked, never unlocks). Delete first so re-running this file cannot duplicate rows.
DELETE FROM "RecordFieldDef" WHERE "recordKey" = 'dry-monitoring' AND "key" IN ('cookedWeight','cookedWeightSourceIds','cookedWeightTypedManually');
INSERT INTO "RecordFieldDef"
  ("id","recordKey","sectionIndex","key","label","type","readOnly","unit","options","group","position",
   "computeFn","computeArgs","recordPickSource","linkField","linkRelation","validateJson","extraJson")
VALUES
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'cookedWeight', 'Cooked weight (kg)', 'number', true, 'kg', '{}', 'Summary', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"fromRecord":{"note":"Total cooked weight from REC 7.4.0","source":"dry-cooked-weight","pick":"latest","field":"cookedWeight","matchField":"jobNo","submittedOnly":true,"idsField":"cookedWeightSourceIds","manualFlag":"cookedWeightTypedManually","missing":"No REC 7.4.0 cooking weight for this job. Fill in REC 7.4.0 first"}}'::jsonb),
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'cookedWeightSourceIds', 'Cooked weight source entries', 'text', true, NULL, '{}', 'Summary', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"hidden":true}'::jsonb),
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'cookedWeightTypedManually', 'Cooked weight typed manually', 'yesno', true, NULL, '{}', 'Summary', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"hidden":true}'::jsonb)
;

-- 6. Summary group: move fields and labels
UPDATE "RecordFieldDef" SET "group" = 'Summary'
  WHERE "recordKey" = 'dry-monitoring' AND "key" IN ('cookedWeight', 'cookingDate', 'noOfTrolleys', 'entryDate', 'estimatedDryDate', 'dryRoomArea', 'cookingDateSourceIds', 'cookingDateTypedManually', 'trolleysSourceSubmissionId', 'trolleysTypedManually', 'dryRoomAreaSourceId', 'dateOld', 'qcCheckOld', 'supervisorOld', 'cookedWeightSourceIds', 'cookedWeightTypedManually');
UPDATE "RecordFieldDef" SET "label" = 'Date into drying room'
  WHERE "recordKey" = 'dry-monitoring' AND "key" = 'entryDate';
UPDATE "RecordFieldDef" SET "readOnly" = true
  WHERE "recordKey" = 'dry-monitoring' AND "key" IN ('cookedWeight', 'cookingDate', 'noOfTrolleys', 'entryDate', 'estimatedDryDate', 'dryRoomArea', 'cookingDateSourceIds', 'cookingDateTypedManually', 'trolleysSourceSubmissionId', 'trolleysTypedManually', 'dryRoomAreaSourceId', 'dateOld', 'qcCheckOld', 'supervisorOld', 'cookedWeightSourceIds', 'cookedWeightTypedManually');
UPDATE "RecordFieldDef" SET "extraJson" = COALESCE("extraJson", '{}'::jsonb) || '{"hidden": true}'::jsonb
  WHERE "recordKey" = 'dry-monitoring'
    AND "key" IN ('cookingDateSourceIds','cookingDateTypedManually','trolleysSourceSubmissionId','trolleysTypedManually','dryRoomAreaSourceId','cookedWeightSourceIds','cookedWeightTypedManually','ncEntryId');
UPDATE "RecordFieldDef" SET "group" = 'Checks'
  WHERE "recordKey" = 'dry-monitoring' AND "key" = 'ncEntryId';

-- 7. Order every field to match the file
UPDATE "RecordFieldDef" SET "position" = CASE "key"
    WHEN 'jobNo' THEN 0
    WHEN 'jiReceivedFrom' THEN 1
    WHEN 'jiProcessingFor' THEN 2
    WHEN 'intakeWeight' THEN 3
    WHEN 'intakeDate' THEN 4
    WHEN 'cookedWeight' THEN 5
    WHEN 'cookingDate' THEN 6
    WHEN 'noOfTrolleys' THEN 7
    WHEN 'entryDate' THEN 8
    WHEN 'estimatedDryDate' THEN 9
    WHEN 'dryRoomArea' THEN 10
    WHEN 'cookingDateSourceIds' THEN 11
    WHEN 'cookingDateTypedManually' THEN 12
    WHEN 'trolleysSourceSubmissionId' THEN 13
    WHEN 'trolleysTypedManually' THEN 14
    WHEN 'dryRoomAreaSourceId' THEN 15
    WHEN 'dateOld' THEN 16
    WHEN 'qcCheckOld' THEN 17
    WHEN 'supervisorOld' THEN 18
    WHEN 'cookedWeightSourceIds' THEN 19
    WHEN 'cookedWeightTypedManually' THEN 20
    WHEN 'skinScore' THEN 21
    WHEN 'coreScore' THEN 22
    WHEN 'frillsScore' THEN 23
    WHEN 'shapeScore' THEN 24
    WHEN 'colourScore' THEN 25
    WHEN 'wrinklesScore' THEN 26
    WHEN 'stickyScore' THEN 27
    WHEN 'mouldScore' THEN 28
    WHEN 'odourScore' THEN 29
    WHEN 'footDamage' THEN 30
    WHEN 'footDamagePct' THEN 31
    WHEN 'footDamageComment' THEN 32
    WHEN 'muscleDamage' THEN 33
    WHEN 'muscleDamagePct' THEN 34
    WHEN 'muscleDamageComment' THEN 35
    WHEN 'presenceOfGuts' THEN 36
    WHEN 'presenceOfGutsPct' THEN 37
    WHEN 'gutsComment' THEN 38
    WHEN 'trolleysClearlyMarked' THEN 39
    WHEN 'correctiveActions' THEN 40
    WHEN 'ncEntryId' THEN 41
    WHEN 'mouldVisibleOld' THEN 42
    WHEN 'whiteSaltOnSurfaceOld' THEN 43
    WHEN 'caseHardeningOld' THEN 44
    WHEN 'surfaceShineOld' THEN 45
    WHEN 'comments' THEN 46
    ELSE "position" END
  WHERE "recordKey" = 'dry-monitoring';

COMMIT;
