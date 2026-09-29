-- REC 7.4.0 Dry Cooking becomes a Pots roster: one row per pot (process Blanching / Cooking / Both).
-- The pot-level columns leave sub_dry_cooking and live in the roster child table sub_dry_cooking_row
-- (the same parent/child shape every roster record uses). Nothing is lost by the DROP: KeyValue and
-- each row's rawJson keep the original values, and scripts/migrate-dry-cooking-pots.mjs converts the
-- stored entries to one "Both" pot each and re-projects them into the new table.
-- Run order: migrate-dry-cooking-pots.mjs (dry run) -> prisma migrate deploy -> migrate-dry-cooking-pots.mjs --apply.

ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "cookingDate";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "potNumber";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "abaloneKg";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "blanchSeaWater";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "blanchPh";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "blanchSaltKg";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "blanchTemp";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "cookingTime";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "blanchBatchNumber";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "startTime";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "startingTemp";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "temp20MinAfter";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "endOfCookingTemp";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "timeOut";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "totalCookingTime";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "cookSeaWater";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "cookPh";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "saltKg";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "saltBatchNumber";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "sugarKg";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "sugarBatchNumber";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "vinegarKg";
ALTER TABLE "sub_dry_cooking" DROP COLUMN IF EXISTS "vinegarBatchNumber";

CREATE TABLE "sub_dry_cooking_row" (
    "id" SERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "process" TEXT,
    "potNumber" TEXT,
    "cookingDate" DATE,
    "abaloneKg" DOUBLE PRECISION,
    "blanchSeaWater" BOOLEAN,
    "blanchSeaWaterLitres" DOUBLE PRECISION,
    "blanchPh" DOUBLE PRECISION,
    "blanchSaltKg" DOUBLE PRECISION,
    "blanchTemp" DOUBLE PRECISION,
    "cookingTime" TEXT,
    "blanchBatchNumber" TEXT,
    "startTime" TIME,
    "startingTemp" DOUBLE PRECISION,
    "temp20MinAfter" DOUBLE PRECISION,
    "endOfCookingTemp" DOUBLE PRECISION,
    "timeOut" TIME,
    "totalCookingTime" TEXT,
    "cookSeaWater" BOOLEAN,
    "cookSeaWaterLitres" DOUBLE PRECISION,
    "cookPh" DOUBLE PRECISION,
    "saltKg" DOUBLE PRECISION,
    "saltBatchNumber" TEXT,
    "sugarKg" DOUBLE PRECISION,
    "sugarBatchNumber" TEXT,
    "vinegarKg" DOUBLE PRECISION,
    "vinegarBatchNumber" TEXT,
    CONSTRAINT "sub_dry_cooking_row_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sub_dry_cooking_row_parentId_idx" ON "sub_dry_cooking_row"("parentId");
CREATE INDEX "sub_dry_cooking_row_process_cookingDate_idx" ON "sub_dry_cooking_row"("process", "cookingDate");
CREATE INDEX "sub_dry_cooking_row_potNumber_idx" ON "sub_dry_cooking_row"("potNumber");
ALTER TABLE "sub_dry_cooking_row" ADD CONSTRAINT "sub_dry_cooking_row_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sub_dry_cooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Query view: one row per pot with the job number and entry status repeated on every row, so trends
-- (kg per pot per month, salt batch by job, ...) and trace lookups need no join.
CREATE VIEW "dry_cooking_pot" AS
SELECT r."id", r."parentId" AS "submissionId", p."jobNo", r."position" + 1 AS "rowNo", p."status", p."submittedAt",
       r."process", r."potNumber", r."cookingDate", r."abaloneKg",
       r."blanchSeaWater", r."blanchSeaWaterLitres", r."blanchPh", r."blanchSaltKg", r."blanchTemp", r."cookingTime", r."blanchBatchNumber",
       r."startTime", r."startingTemp", r."temp20MinAfter", r."endOfCookingTemp", r."timeOut", r."totalCookingTime",
       r."cookSeaWater", r."cookSeaWaterLitres", r."cookPh", r."saltKg", r."saltBatchNumber",
       r."sugarKg", r."sugarBatchNumber", r."vinegarKg", r."vinegarBatchNumber"
FROM "sub_dry_cooking_row" r JOIN "sub_dry_cooking" p ON p."id" = r."parentId";
