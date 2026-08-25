-- CreateTable
CREATE TABLE "KeyValue" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyValue_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SubmissionDateField" (
    "id" SERIAL NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "recordName" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "recordClass" TEXT NOT NULL,
    "dateValue" TIMESTAMP(3),
    "rawValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionDateField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionDateField_submissionKey_idx" ON "SubmissionDateField"("submissionKey");

-- CreateIndex
CREATE INDEX "SubmissionDateField_fieldKey_idx" ON "SubmissionDateField"("fieldKey");

-- CreateIndex
CREATE INDEX "SubmissionDateField_dateValue_idx" ON "SubmissionDateField"("dateValue");
