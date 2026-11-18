BEGIN;

-- Restore the NC auto-close rule: when batchStatus = Green on a new entry, open NCs for this record/job become ready to close
UPDATE "RecordDefinition"
  SET "extraJson" = jsonb_set(COALESCE("extraJson", '{}'::jsonb), '{ncResolutionCondition}',
        '{"triggerField":"batchStatus","resolvedWhen":"= Green"}'::jsonb)
  WHERE "recordKey" = 'dry-monitoring';

COMMIT;
