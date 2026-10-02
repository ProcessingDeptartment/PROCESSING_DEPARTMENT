-- REC 7.4.10 crate numbering: go-live SQL for the Neon SQL editor (project ep-long-pond-aydj6pgg, database neondb).
-- The table migration already ran with the deploy. This does the two data steps in ONE statement (all or nothing):
--   A. removes the three test entries (backup copies go to bak_removed_20261001_* tables first)
--   B. updates the stored record definition: Crate number becomes a read-only whole number, the roster is flagged
--      jobNumbered, and the hidden roster columns are added
-- Real entry sub_1790863554534_mn673 (DPR00001) is not touched. Safe to run twice.
-- Paste the whole DO block (from DO to the closing $go$;) and run it once. Then paste the CHECK query.

DO $go$
DECLARE
  ids text[] := ARRAY['sub_1790072078264_ahfgt','sub_1790339188073_owh23','sub_1790339800051_d4sv4'];
  links text[] := ARRAY[
    'batch_link:3CP22222:dried-abalone-transfer:sub_1790339188073_owh23',
    'batch_link:3DP55555:dried-abalone-transfer:sub_1790072078264_ahfgt',
    'batch_link:DPR001998:dried-abalone-transfer:sub_1790339800051_d4sv4'];
BEGIN
  ---------------------------------------------------------------- A. remove the test entries
  IF EXISTS (SELECT 1 FROM sub_dried_abalone_transfer WHERE id = ANY(ids)) THEN
    CREATE TABLE IF NOT EXISTS bak_removed_20261001_sub     AS SELECT * FROM sub_dried_abalone_transfer WHERE id = ANY(ids);
    CREATE TABLE IF NOT EXISTS bak_removed_20261001_rows    AS SELECT * FROM sub_dried_abalone_transfer_row WHERE "parentId" = ANY(ids);
    CREATE TABLE IF NOT EXISTS bak_removed_20261001_kv      AS SELECT * FROM "KeyValue"
      WHERE key IN ('formrecord:dried-abalone-transfer','verification_log:dried-abalone-transfer') OR key = ANY(links);
    CREATE TABLE IF NOT EXISTS bak_removed_20261001_datefld AS SELECT * FROM "SubmissionDateField" WHERE "submissionId" = ANY(ids);
    CREATE TABLE IF NOT EXISTS bak_removed_20261001_vev     AS SELECT * FROM "VerificationEvent"
      WHERE id IN (SELECT "eventId" FROM "VerificationEventEntry" WHERE "submissionId" = ANY(ids));
    CREATE TABLE IF NOT EXISTS bak_removed_20261001_vee     AS SELECT * FROM "VerificationEventEntry" WHERE "submissionId" = ANY(ids);

    -- audit trail (before-values)
    INSERT INTO "KeyValueHistory"(key, action, before, after, actor, role)
    SELECT key, CASE WHEN key = ANY(links) THEN 'delete' ELSE 'set' END, value, NULL, 'cleanup-sql', 'admin'
    FROM "KeyValue"
    WHERE key IN ('formrecord:dried-abalone-transfer','verification_log:dried-abalone-transfer') OR key = ANY(links);

    UPDATE "KeyValue" SET value = (
      SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)::text
      FROM jsonb_array_elements(value::jsonb) e WHERE NOT (e->>'id' = ANY(ids))
    ), "updatedAt" = now()
    WHERE key = 'formrecord:dried-abalone-transfer';

    UPDATE "KeyValue" SET value = (
      SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)::text
      FROM jsonb_array_elements(value::jsonb) e
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(e->'entryIds') x WHERE NOT (x = ANY(ids)))
    ), "updatedAt" = now()
    WHERE key = 'verification_log:dried-abalone-transfer';

    DELETE FROM "KeyValue" WHERE key = ANY(links);
    DELETE FROM "VerificationEvent" WHERE id IN (SELECT id FROM bak_removed_20261001_vev);
    DELETE FROM "SubmissionDateField" WHERE "submissionId" = ANY(ids);
    DELETE FROM sub_dried_abalone_transfer_row WHERE "parentId" = ANY(ids);
    DELETE FROM sub_dried_abalone_transfer WHERE id = ANY(ids);
  END IF;

  ---------------------------------------------------------------- B. record definition
  UPDATE "RecordFieldDef" SET type = 'digits', "readOnly" = true, required = false
  WHERE "recordKey" = 'dried-abalone-transfer' AND key = 'crateNumber' AND "parentFieldKey" = '@roster';

  INSERT INTO "RecordFieldDef"(id, "recordKey", "sectionIndex", "parentFieldKey", key, label, type, required, "readOnly",
                               options, position, "extraJson")
  SELECT gen_random_uuid()::text, 'dried-abalone-transfer', 3, '@roster', v.key, v.label, v.type, false, true,
         ARRAY[]::text[], v.pos, v.extra::jsonb
  FROM (VALUES
    ('jobNo',      'Job number',             'text',      10, '{"hidden":true}'),
    ('crateNoOld', 'Crate number (old)',     'text',      11, '{"hidden":true,"legacy":true}'),
    ('voided',     'Voided',                 'yesno',     12, '{"hidden":true}'),
    ('voidReason', 'Void reason',            'text',      13, '{"hidden":true}'),
    ('voidedBy',   'Voided by',              'text',      14, '{"hidden":true}'),
    ('voidedAt',   'Voided at',              'timestamp', 15, '{"hidden":true}')
  ) AS v(key, label, type, pos, extra)
  WHERE NOT EXISTS (SELECT 1 FROM "RecordFieldDef" f
                    WHERE f."recordKey" = 'dried-abalone-transfer' AND f.key = v.key AND f."parentFieldKey" = '@roster');

  UPDATE "RecordSectionDef"
  SET "extraJson" = '{"quickEntry":{"addLabel":"+ Add crate"},"jobNumbered":{"column":"crateNumber","jobField":"jobNo","jobColumn":"jobNo","rowTitle":"Crate","source":"dried-abalone-transfer"}}'::jsonb
  WHERE "recordKey" = 'dried-abalone-transfer' AND kind = 'roster';

  -- bump the version once so running pages pick up the new definition
  UPDATE "RecordDefinition" SET version = version + 1, "updatedAt" = now()
  WHERE "recordKey" = 'dried-abalone-transfer';
END
$go$;

-- CHECK (run after the block above). Expect: entries 1, crate_rows 2, links 1, store_entries 1, fields_ok 8,
-- crate_type digits, crate_read_only true, roster_flag true.
SELECT (SELECT count(*) FROM sub_dried_abalone_transfer)                                         AS entries,
       (SELECT count(*) FROM sub_dried_abalone_transfer_row)                                     AS crate_rows,
       (SELECT count(*) FROM "KeyValue" WHERE key LIKE 'batch_link:%:dried-abalone-transfer:%')  AS links,
       (SELECT jsonb_array_length(value::jsonb) FROM "KeyValue" WHERE key = 'formrecord:dried-abalone-transfer') AS store_entries,
       (SELECT count(*) FROM "RecordFieldDef" WHERE "recordKey" = 'dried-abalone-transfer' AND "parentFieldKey" = '@roster') AS fields_ok,
       (SELECT type FROM "RecordFieldDef" WHERE "recordKey" = 'dried-abalone-transfer' AND key = 'crateNumber')           AS crate_type,
       (SELECT "readOnly" FROM "RecordFieldDef" WHERE "recordKey" = 'dried-abalone-transfer' AND key = 'crateNumber')     AS crate_read_only,
       (SELECT "extraJson" ? 'jobNumbered' FROM "RecordSectionDef" WHERE "recordKey" = 'dried-abalone-transfer' AND kind = 'roster') AS roster_flag;
