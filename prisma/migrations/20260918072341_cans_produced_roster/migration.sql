-- Redesign REC 7.2.7 Canning Production (cans-produced) into a trolley-info parent row plus a
-- repeating can-batch roster, per the Canning Production design spec (2026-09-18).
--
-- Per-batch fields (canPieces, drainWeight, numberOfCans, sauceBatch) move to a new child table.
-- Old damage fields (damagedCans, reasonForDamage, totalDamagedCans) are replaced by the spec's
-- two mandatory damage counts. timeTrolleyIn becomes a real time-of-day column. Existing values in
-- dropped columns are not migrated (matches the DROP+ADD convention used by the prior
-- 20260914061741_type_submission_columns migration).

-- AlterTable
ALTER TABLE "sub_cans_produced"
  DROP COLUMN "timeTrolleyIn",
  ADD COLUMN     "timeTrolleyIn" TIME,
  DROP COLUMN "canPieces",
  DROP COLUMN "drainWeight",
  DROP COLUMN "sauceBatch",
  DROP COLUMN "numberOfCans",
  DROP COLUMN "damagedCans",
  DROP COLUMN "reasonForDamage",
  DROP COLUMN "totalDamagedCans",
  ADD COLUMN     "canSize" TEXT,
  ADD COLUMN     "xSmallDamagedCans" DOUBLE PRECISION,
  ADD COLUMN     "otherSizeDamagedCans" DOUBLE PRECISION,
  ADD COLUMN     "comments" TEXT;

-- CreateTable
CREATE TABLE "sub_cans_produced_row" (
    "id" SERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "canPieces" DOUBLE PRECISION,
    "drainWeight" TEXT,
    "numberOfCans" DOUBLE PRECISION,
    "sauceBatch" TEXT,
    CONSTRAINT "sub_cans_produced_row_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sub_cans_produced_row_parentId_idx" ON "sub_cans_produced_row"("parentId");
ALTER TABLE "sub_cans_produced_row" ADD CONSTRAINT "sub_cans_produced_row_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sub_cans_produced"("id") ON DELETE CASCADE ON UPDATE CASCADE;
