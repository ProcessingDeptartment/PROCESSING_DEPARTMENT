-- REC 7.1.1 Basket Removal, Shucking & Gutting: size range moves from Job info to each incoming-
-- check row (one job can hold several size ranges). Existing rows inherit the record's old value
-- before the parent column is dropped; rawJson keeps the original either way.
ALTER TABLE "sub_basket_removal_shucking_gutting_row" ADD COLUMN IF NOT EXISTS "sizeRange" TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'sub_basket_removal_shucking_gutting' AND column_name = 'sizeRange') THEN
    UPDATE "sub_basket_removal_shucking_gutting_row" r
       SET "sizeRange" = p."sizeRange"
      FROM "sub_basket_removal_shucking_gutting" p
     WHERE r."parentId" = p."id" AND r."sizeRange" IS NULL;
    ALTER TABLE "sub_basket_removal_shucking_gutting" DROP COLUMN "sizeRange";
  END IF;
END $$;
