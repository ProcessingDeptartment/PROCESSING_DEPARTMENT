-- Refine REC 7.2.7 Canning Production per facility clarification (2026-09-18):
--  - Retort code is actually "L or N" + a digit, split into two fields instead of the earlier
--    guessed R1-R4 / L1-L2-R1-R2 dropdowns.
--  - Can size goes back to free text (matching REC 7.2.12's Can size field, which is also free
--    text — there is no fixed can-size list anywhere in this app to "match").
--  - Can pieces (roster) becomes a single field offering digits 1-50 or "Mince", replacing the
--    earlier plain 1-50 number input.
-- Existing values in dropped/retyped columns are not migrated (same convention as prior
-- 20260914061741_type_submission_columns and 20260918072341_cans_produced_roster migrations).

-- AlterTable
ALTER TABLE "sub_cans_produced"
  DROP COLUMN "retortCode",
  DROP COLUMN "retortNo",
  ADD COLUMN     "retortCodePrefix" TEXT,
  ADD COLUMN     "retortCodeDigit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "sub_cans_produced_row"
  DROP COLUMN "canPieces",
  ADD COLUMN     "canPieces" TEXT;
