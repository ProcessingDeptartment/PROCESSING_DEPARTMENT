-- REC 7.4.0 Dry Cooking, second revision: a pot is a Blanching OR a Cooking card (no "Both"), with an
-- automatic pot number, a fixed field layout, blanching start/end fields, and the cooking date taken from
-- the day the entry is completed (parent cookingDate). Old typed values move to *Old columns.
-- Nothing is lost: KeyValue / rawJson keep the originals, and migrate-dry-cooking-pots-v2.mjs re-splits
-- the stored entries and re-projects them.
DROP VIEW IF EXISTS "dry_cooking_pot";
ALTER TABLE "sub_dry_cooking" ADD COLUMN IF NOT EXISTS "cookingDate" DATE;
DROP INDEX IF EXISTS "sub_dry_cooking_row_process_cookingDate_idx";
DROP INDEX IF EXISTS "sub_dry_cooking_row_potNumber_idx";
ALTER TABLE "sub_dry_cooking_row"
  DROP COLUMN IF EXISTS "potNumber", DROP COLUMN IF EXISTS "cookingDate", DROP COLUMN IF EXISTS "blanchTemp",
  DROP COLUMN IF EXISTS "blanchSeaWaterLitres", DROP COLUMN IF EXISTS "cookSeaWaterLitres",
  ADD COLUMN "potNo" INTEGER, ADD COLUMN "blanchStartTime" TIME, ADD COLUMN "blanchStartingTemp" DOUBLE PRECISION,
  ADD COLUMN "blanchEndTime" TIME, ADD COLUMN "blanchEndTemp" DOUBLE PRECISION,
  ADD COLUMN "potNumberOld" TEXT, ADD COLUMN "cookingDateOld" DATE, ADD COLUMN "blanchTempOld" DOUBLE PRECISION,
  ADD COLUMN "blanchSeaWaterLtOld" DOUBLE PRECISION, ADD COLUMN "cookSeaWaterLtOld" DOUBLE PRECISION;
CREATE INDEX "sub_dry_cooking_row_parentId_potNo_idx" ON "sub_dry_cooking_row"("parentId", "potNo");
CREATE INDEX "sub_dry_cooking_row_process_idx" ON "sub_dry_cooking_row"("process");

CREATE VIEW "dry_cooking_pot" AS
SELECT r."id", r."parentId" AS "submissionId", p."jobNo", r."potNo", r."position" + 1 AS "rowNo",
       p."cookingDate" AS "recordDate", p."status", p."submittedAt",
       r."process", r."abaloneKg",
       r."blanchSeaWater", r."blanchSaltKg", r."blanchBatchNumber", r."blanchStartTime", r."blanchStartingTemp",
       r."blanchPh", r."blanchEndTime", r."blanchEndTemp", r."cookingTime" AS "blanchTotalTime",
       r."cookSeaWater", r."saltKg", r."saltBatchNumber", r."startTime", r."startingTemp", r."cookPh",
       r."temp20MinAfter", r."timeOut", r."endOfCookingTemp", r."totalCookingTime",
       r."sugarKg", r."sugarBatchNumber", r."vinegarKg", r."vinegarBatchNumber",
       r."potNumberOld", r."cookingDateOld", r."blanchTempOld", r."blanchSeaWaterLtOld", r."cookSeaWaterLtOld",
       p."createdAt", p."updatedAt"
FROM "sub_dry_cooking_row" r JOIN "sub_dry_cooking" p ON p."id" = r."parentId";
