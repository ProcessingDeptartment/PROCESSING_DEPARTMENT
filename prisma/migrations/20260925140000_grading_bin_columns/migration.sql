-- REC 7.4.3.1 / 7.4.3.2 Grading Production Log: collection bins carry a size grade + bin no.
-- (bin code = grade-no.), a start-weight check, and several full box weights per bin (numlist,
-- e.g. "12.4 + 11.9"), so fullBoxWeight moves from a single number to text.
ALTER TABLE "sub_grading_production_log_cultivated_row"
  ADD COLUMN IF NOT EXISTS "sizeGrade" TEXT,
  ADD COLUMN IF NOT EXISTS "binNo" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "startConfirmed" TEXT,
  ALTER COLUMN "fullBoxWeight" TYPE TEXT USING "fullBoxWeight"::text;

ALTER TABLE "sub_grading_production_log_ranched_row"
  ADD COLUMN IF NOT EXISTS "sizeGrade" TEXT,
  ADD COLUMN IF NOT EXISTS "binNo" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "startConfirmed" TEXT,
  ALTER COLUMN "fullBoxWeight" TYPE TEXT USING "fullBoxWeight"::text;
