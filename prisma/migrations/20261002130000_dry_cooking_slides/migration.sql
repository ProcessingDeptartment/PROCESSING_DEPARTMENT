-- REC 7.4.0 Dry Cooking pot SLIDES (spec: MD_PROJECT_ONLY/rec-7.4.0-pot-slides-blanching-stage-instructions.md).
--   1. sub_dry_cooking_row: blanchTempC (the single blanching temperature), blanchTime (the single blanching time),
--      potNoOld (the pot number old entries carried before Cooking-only numbering). Nothing is dropped.
--      potNo is now filled for Cooking slides only (NULL for Blanching; it was already nullable).
--   2. slide order = existing "position" column; exposed in the dry_cooking_pot view as "seqNo" (= rowNo)
--   3. dry_cooking_pot view: new columns appended last, so CREATE OR REPLACE keeps the existing ones
--   4. v_dry_job_weights reduced: no blanched / available-to-blanch; available_to_cook_kg = oosw_kg - cooked_kg
--      (all Cooking kg counts, migrated cooking-only cards included, same as business rule R1)
ALTER TABLE "sub_dry_cooking_row"
  ADD COLUMN IF NOT EXISTS "blanchTempC" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "blanchTime" TIME,
  ADD COLUMN IF NOT EXISTS "potNoOld" INTEGER;
CREATE INDEX IF NOT EXISTS "sub_dry_cooking_row_parentId_position_idx" ON "sub_dry_cooking_row"("parentId", "position");

DROP VIEW IF EXISTS "v_dry_job_weights";

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
       r."legacyNoBlanching",
       r."position" + 1 AS "seqNo", r."blanchTempC", r."blanchTime", r."potNoOld"
FROM "sub_dry_cooking_row" r JOIN "sub_dry_cooking" p ON p."id" = r."parentId";

CREATE VIEW "v_dry_job_weights" AS
WITH oosw AS (
  SELECT p."jobNo" AS job_no, SUM(r."weight") AS oosw_kg
  FROM "sub_salting_oosw" p JOIN "sub_salting_oosw_row" r ON r."parentId" = p."id"
  WHERE p."status" = 'submitted' AND p."jobNo" IS NOT NULL
  GROUP BY p."jobNo"
), pots AS (
  SELECT "jobNo" AS job_no,
         SUM(CASE WHEN "process" = 'Cooking' THEN "abaloneKg" ELSE 0 END) AS cooked_kg,
         MAX("recordDate") AS last_record_date
  FROM "dry_cooking_pot"
  WHERE "status" = 'submitted' AND "jobNo" IS NOT NULL
  GROUP BY "jobNo"
)
SELECT p.job_no, o.oosw_kg, p.cooked_kg,
       o.oosw_kg - p.cooked_kg AS available_to_cook_kg,
       p.last_record_date
FROM pots p LEFT JOIN oosw o ON o.job_no = p.job_no;
