-- Undo the earlier Dry Export Pack change: remove the six Comments fields and make the six
-- record pickers required again (their original setting). Safe to run even if the earlier script
-- was never run.
BEGIN;
DELETE FROM "RecordFieldDef" WHERE "recordKey"='dry-export-pack-front-page'
  AND "key" IN ('cmt745','cmt746','cmt747','cmt748','cmt749','cmt7410');
UPDATE "RecordFieldDef" SET "required"=true WHERE "recordKey"='dry-export-pack-front-page'
  AND "key" IN ('rec745Attached','rec746Attached','rec747Attached','rec748Attached','rec749Attached','rec7410Attached');
UPDATE "RecordDefinition" SET "version"="version"+1,"updatedAt"=now() WHERE "recordKey"='dry-export-pack-front-page';
COMMIT;

-- Check: no cmt rows, and the six rec74x pickers show required = true
SELECT "key","required","position" FROM "RecordFieldDef" WHERE "recordKey"='dry-export-pack-front-page' ORDER BY "position";
