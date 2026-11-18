BEGIN;

-- 1. Put the scoring logic back (it drives auto NC). It is hidden from the form and PDF via the score output fields below.
UPDATE "RecordDefinition"
  SET "extraJson" = jsonb_set(COALESCE("extraJson",'{}'::jsonb), '{scoring}', '{"over":["skinScore","coreScore","frillsScore","shapeScore","colourScore"],"ncRef":"ncEntryId","signs":["skinScore","coreScore","frillsScore","shapeScore","colourScore","wrinklesScore","stickyScore","mouldScore","odourScore"],"steps":{"over":["Overdrying signs: add an extra steam, reduce wind, rotate the trolley."],"under":["Underdrying signs: steam now, move to the Pre-drying room with maximum airflow, remove and isolate mould pieces."]},"total":"totalScore","under":[{"key":"stickyScore","min":1},{"key":"mouldScore","min":2},{"key":"odourScore","min":1}],"worst":"worstScore","autoNc":true,"status":"batchStatus","actions":{"Red":["Start the intervention plan immediately.","Notify the production & export manager and QA manager now.","Recheck every 2 hours."],"Amber":["Find the cause (steam timing, airflow, orientation, loading).","Start an intervention plan.","Notify the dry supervisor and shift manager.","Recheck within 4 hours."],"Critical":["Ring fence the trolley and tag it.","Do not move it to the grading room before management inspection.","Notify the production & export manager, QA manager and shift manager immediately, with photos."]},"maxTotal":23,"statuses":["Green","Amber","Red","Critical"],"ncCategory":"Product quality","interpretation":{"both":"Possible overdrying and underdrying signs present — check trolley carefully","over":"Possible overdrying (case hardening)","under":"Possible underdrying"}}'::jsonb)
  WHERE "recordKey" = 'dry-monitoring';

-- 2. Score outputs: stored but hidden (no form or PDF display)
DELETE FROM "RecordFieldDef"
  WHERE "recordKey" = 'dry-monitoring' AND "key" IN ('worstScore', 'totalScore', 'overdryingWorst', 'overdryingTotal', 'underdryingWorst', 'underdryingTotal', 'batchStatus');
INSERT INTO "RecordFieldDef"
  ("id","recordKey","sectionIndex","key","label","type","readOnly","unit","options","group","position",
   "computeFn","computeArgs","recordPickSource","linkField","linkRelation","validateJson","extraJson")
VALUES
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'worstScore', 'Worst score', 'number', true, NULL, '{}', 'Checks', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"scoreOutput":"worst","hidden":true}'::jsonb),
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'totalScore', 'Total score', 'number', true, NULL, '{}', 'Checks', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"scoreOutput":"total","hidden":true}'::jsonb),
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'overdryingWorst', 'Overdrying worst score', 'number', true, NULL, '{}', 'Checks', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"scoreOutput":"overWorst","hidden":true}'::jsonb),
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'overdryingTotal', 'Overdrying total score', 'number', true, NULL, '{}', 'Checks', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"scoreOutput":"overTotal","hidden":true}'::jsonb),
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'underdryingWorst', 'Underdrying worst score', 'number', true, NULL, '{}', 'Checks', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"scoreOutput":"underWorst","hidden":true}'::jsonb),
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'underdryingTotal', 'Underdrying total score', 'number', true, NULL, '{}', 'Checks', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"scoreOutput":"underTotal","hidden":true}'::jsonb),
  (gen_random_uuid()::text, 'dry-monitoring', NULL, 'batchStatus', 'Batch status', 'text', true, NULL, '{}', 'Checks', 0, NULL, NULL, NULL, NULL, NULL, NULL, '{"scoreOutput":"status","hidden":true}'::jsonb);

-- 3. Hide the NC reference too
UPDATE "RecordFieldDef" SET "extraJson" = COALESCE("extraJson",'{}'::jsonb) || '{"hidden": true}'::jsonb
  WHERE "recordKey" = 'dry-monitoring' AND "key" = 'ncEntryId';

COMMIT;
