-- REC 7.4.0 temporary entry flow: OOSW kg typed by the operator on the parent row (NULL on old rows; no data touched).
-- Replaced by the REC 7.1.5 lookup once that record is submitted for the job.
ALTER TABLE "sub_dry_cooking" ADD COLUMN IF NOT EXISTS "ooswKg" DOUBLE PRECISION;
