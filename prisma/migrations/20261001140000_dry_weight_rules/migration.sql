-- REC 7.4.0 Dry Cooking weight rules: Blanching vs OOSW (R2), Cooking vs Blanching (R3).
--   1. roster flag legacyNoBlanching (migrated cooking-only cards; left out of R3 / "available to cook")
--   2. dry_cooking_pot view gets the flag (appended last, so CREATE OR REPLACE keeps existing columns)
--   3. dry_weight_override: one row per rule an operator overrode (R1/R2/R3), rebuilt on every sync
--   4. v_dry_job_weights: per job OOSW / blanched / cooked / available kg (submitted entries only), plain SQL
ALTER TABLE "sub_dry_cooking_row" ADD COLUMN IF NOT EXISTS "legacyNoBlanching" TEXT;

CREATE OR REPLACE VIEW "dry_cooking_pot" AS
SELECT r."id", r."parentId" AS "submissionId", p."jobNo", r."potNo", r."position" + 1 AS "rowNo",
       p."cookingDate" AS "recordDate", p."status", p."submittedAt",
       r."process", r."abaloneKg",
       r."blanchSeaWater", r."blanchSaltKg", r."blanchBatchNumber", r."blanchStartTime", r."blanchStartingTemp",
       r."blanchPh", r."blanchEndTime", r."blanchEndTemp", r."cookingTime" AS "blanchTotalTime",
       r."cookSeaWater", r."saltKg", r."saltBatchNumber", r."startTime", r."startingTemp", r."cookPh",
       r."temp20MinAfter", r."timeOut", r."endOfCookingTemp", r."totalCookingTime",
       r."sugarKg", r."sugarBatchNumber", r."vinegarKg", r."vinegarBatchNumber",
       r."potNumberOld", r."cookingDateOld", r."blanchTempOld", r."blanchSeaWaterLtOld", r."cookSeaWaterLtOld",
       p."createdAt", p."updatedAt",
       r."legacyNoBlanching"
FROM "sub_dry_cooking_row" r JOIN "sub_dry_cooking" p ON p."id" = r."parentId";

CREATE TABLE IF NOT EXISTS "dry_weight_override" (
    "id" SERIAL NOT NULL,
    "submission_id" TEXT NOT NULL,
    "job_no" TEXT,
    "rule" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "signed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dry_weight_override_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dry_weight_override_job_no_idx" ON "dry_weight_override"("job_no");
CREATE INDEX IF NOT EXISTS "dry_weight_override_submission_id_idx" ON "dry_weight_override"("submission_id");

CREATE OR REPLACE VIEW "v_dry_job_weights" AS
WITH oosw AS (
  SELECT p."jobNo" AS job_no, SUM(r."weight") AS oosw_kg
  FROM "sub_salting_oosw" p JOIN "sub_salting_oosw_row" r ON r."parentId" = p."id"
  WHERE p."status" = 'submitted' AND p."jobNo" IS NOT NULL
  GROUP BY p."jobNo"
), pots AS (
  SELECT "jobNo" AS job_no,
         SUM(CASE WHEN "process" = 'Blanching' THEN "abaloneKg" ELSE 0 END) AS blanched_kg,
         SUM(CASE WHEN "process" = 'Cooking' AND LOWER(COALESCE("legacyNoBlanching", '')) NOT IN ('yes', 'true', '1')
                  THEN "abaloneKg" ELSE 0 END) AS cooked_kg,
         MAX("recordDate") AS last_record_date
  FROM "dry_cooking_pot"
  WHERE "status" = 'submitted' AND "jobNo" IS NOT NULL
  GROUP BY "jobNo"
)
SELECT p.job_no, o.oosw_kg, p.blanched_kg, p.cooked_kg,
       o.oosw_kg - p.blanched_kg AS available_to_blanch_kg,
       p.blanched_kg - p.cooked_kg AS available_to_cook_kg,
       p.last_record_date
FROM pots p LEFT JOIN oosw o ON o.job_no = p.job_no;
