-- SubmissionDateField: identify the record and the submission consistently (2026-09-21).
-- recordName was filled from record-key-map.json, which covers 77 of the 131 records, so some rows
-- carried a display title and others the raw key. Add the canonical key and the submission id;
-- recordName is now always the display name (definition title), filled by the API on write.
-- recordKey is nullable HERE on purpose: the API build on Render runs this migration before the new
-- code is live, and the old code does not set the column. A follow-up migration makes it NOT NULL
-- once the new API is deployed. Purely additive.

-- AlterTable
ALTER TABLE "SubmissionDateField"
  ADD COLUMN "recordKey" TEXT,
  ADD COLUMN "submissionId" TEXT;

-- Backfill the canonical key from the storage key ('formrecord:cans-produced' -> 'cans-produced').
UPDATE "SubmissionDateField"
SET "recordKey" = substring("submissionKey" from position(':' in "submissionKey") + 1)
WHERE "recordKey" IS NULL AND position(':' in "submissionKey") > 0;

-- CreateIndex
CREATE INDEX "SubmissionDateField_recordKey_idx" ON "SubmissionDateField"("recordKey");
CREATE INDEX "SubmissionDateField_submissionId_idx" ON "SubmissionDateField"("submissionId");
