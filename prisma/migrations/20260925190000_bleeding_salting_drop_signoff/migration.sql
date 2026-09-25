-- REC 7.1.3.1 Bleeding and Salting: the Sign-off section (Quality controller, Process deviation) is
-- removed from the form — the engine's standard Completed by / Verification blocks cover sign-off.
-- The table had no rows when this was written; rawJson would keep any values regardless.
ALTER TABLE "sub_bleeding_and_salting" DROP COLUMN IF EXISTS "qualityController";
ALTER TABLE "sub_bleeding_and_salting" DROP COLUMN IF EXISTS "processDeviation";
