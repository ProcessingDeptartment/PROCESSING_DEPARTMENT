-- Align two submission tables with their current definitions (2026-09-21). Found while reseeding
-- the definition layer: the definitions had moved on, the tables had not.
--  - dry-export-pack-front-page: REC 7.4.7 / 7.4.8 / 7.4.9 "attached?" are record pickers
--    (Claude outputs/export-batch-linking-spec.md), not yes/no. Table holds 0 rows, so retyping is safe.
--  - production-information-nrcs: the page now lists jobNo as a top-level field. Additive.
--    (The old sub_production_information_nrcs_row child table is left in place, unused.)

-- AlterTable
ALTER TABLE "sub_dry_export_pack_front_page"
  ALTER COLUMN "rec747Attached" TYPE TEXT USING "rec747Attached"::text,
  ALTER COLUMN "rec748Attached" TYPE TEXT USING "rec748Attached"::text,
  ALTER COLUMN "rec749Attached" TYPE TEXT USING "rec749Attached"::text;

-- AlterTable
ALTER TABLE "sub_production_information_nrcs" ADD COLUMN "jobNo" TEXT;
