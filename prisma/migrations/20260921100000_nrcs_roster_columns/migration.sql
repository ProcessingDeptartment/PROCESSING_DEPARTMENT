-- REC Production Information NRCS (Canning): its page declares `rosters: [...]` (plural), which the
-- definition extractor now understands (first roster -> roster section, persisted to sub.roster).
-- The child table predates the page's move to a record picker, so add the missing columns.
-- Purely additive.

-- AlterTable
ALTER TABLE "sub_production_information_nrcs_row"
  ADD COLUMN "submissionRef" TEXT,
  ADD COLUMN "productionCode" TEXT,
  ADD COLUMN "nrcsAgCode" TEXT,
  ADD COLUMN "productDescription" TEXT;
