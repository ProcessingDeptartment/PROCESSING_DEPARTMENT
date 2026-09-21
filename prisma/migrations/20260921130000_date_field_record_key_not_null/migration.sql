-- SubmissionDateField.recordKey becomes NOT NULL (2026-09-21). It was added nullable in
-- 20260921120000 so the old API code could keep writing while the new code deployed; the new API
-- (src/submission-dates.js) is live and sets it on every row, and the rows written before it were
-- rebuilt with scripts/rebuild-derived.js dates.

-- AlterTable
ALTER TABLE "SubmissionDateField" ALTER COLUMN "recordKey" SET NOT NULL;
