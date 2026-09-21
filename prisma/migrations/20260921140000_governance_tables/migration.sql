-- Governance data projected into typed tables (2026-09-21): specs, verification, verifier
-- assignments and job status. The KeyValue blobs stay the source of truth (the pages read and write
-- them); src/governance-store.js projects each write into these tables, like the sub_* tables.
-- Purely additive: new tables only.

-- CreateTable
CREATE TABLE "SpecProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecVersion" (
    "specKey" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "recordKey" TEXT,
    "changeReason" TEXT,
    "publishedBy" TEXT,
    "changedByTitle" TEXT,
    "publishedAt" TIMESTAMP(3),
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecVersion_pkey" PRIMARY KEY ("specKey","versionNumber")
);

-- CreateTable
CREATE TABLE "VerificationEvent" (
    "id" SERIAL NOT NULL,
    "recordKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "verifiedBy" TEXT,
    "verifiedTitle" TEXT,
    "verifiedDate" DATE,
    "verifiedSignature" TEXT,
    "loggedAt" TIMESTAMP(3),

    CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationEventEntry" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "VerificationEventEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifierAssignment" (
    "recordKey" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VerifierAssignment_pkey" PRIMARY KEY ("recordKey","role")
);

-- CreateTable
CREATE TABLE "JobStatus" (
    "jobNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "grnNo" TEXT,
    "poNo" TEXT,
    "deliveryNoteNo" TEXT,
    "costPerKg" DOUBLE PRECISION,
    "canningEfficiency" DOUBLE PRECISION,
    "additionalNrcsCans" DOUBLE PRECISION,
    "comments" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedBy" TEXT,
    "previouslyClosedAt" TIMESTAMP(3),
    "previouslyClosedBy" TEXT,
    "note" TEXT,
    "extraJson" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStatus_pkey" PRIMARY KEY ("jobNo")
);

-- CreateTable
CREATE TABLE "JobNrcsAgCode" (
    "id" SERIAL NOT NULL,
    "jobNo" TEXT NOT NULL,
    "agCode" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobNrcsAgCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecVersion_recordKey_idx" ON "SpecVersion"("recordKey");

-- CreateIndex
CREATE INDEX "SpecVersion_specKey_status_idx" ON "SpecVersion"("specKey", "status");

-- CreateIndex
CREATE INDEX "VerificationEvent_recordKey_idx" ON "VerificationEvent"("recordKey");

-- CreateIndex
CREATE INDEX "VerificationEventEntry_eventId_idx" ON "VerificationEventEntry"("eventId");

-- CreateIndex
CREATE INDEX "VerificationEventEntry_submissionId_idx" ON "VerificationEventEntry"("submissionId");

-- CreateIndex
CREATE INDEX "JobNrcsAgCode_jobNo_idx" ON "JobNrcsAgCode"("jobNo");

-- CreateIndex
CREATE INDEX "JobNrcsAgCode_agCode_idx" ON "JobNrcsAgCode"("agCode");

-- AddForeignKey
ALTER TABLE "VerificationEventEntry" ADD CONSTRAINT "VerificationEventEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "VerificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNrcsAgCode" ADD CONSTRAINT "JobNrcsAgCode_jobNo_fkey" FOREIGN KEY ("jobNo") REFERENCES "JobStatus"("jobNo") ON DELETE CASCADE ON UPDATE CASCADE;

