-- CreateTable
CREATE TABLE "MasterIndexAuditLog" (
    "id" SERIAL NOT NULL,
    "recordId" TEXT NOT NULL,
    "docNo" TEXT,
    "docName" TEXT,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterIndexAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterIndexAuditLog_recordId_changedAt_idx" ON "MasterIndexAuditLog"("recordId", "changedAt");

-- CreateIndex
CREATE INDEX "MasterIndexAuditLog_changedAt_idx" ON "MasterIndexAuditLog"("changedAt");
