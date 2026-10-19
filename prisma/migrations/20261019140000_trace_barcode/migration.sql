CREATE TABLE "TraceBarcode" (
  "id" SERIAL PRIMARY KEY,
  "barcodeValue" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUser" TEXT,
  "parentId" INTEGER
);
CREATE UNIQUE INDEX "TraceBarcode_barcodeValue_key" ON "TraceBarcode"("barcodeValue");
CREATE INDEX "TraceBarcode_parentId_idx" ON "TraceBarcode"("parentId");
ALTER TABLE "TraceBarcode" ADD CONSTRAINT "TraceBarcode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TraceBarcode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BarcodeJobLink" (
  "id" SERIAL PRIMARY KEY,
  "barcodeId" INTEGER NOT NULL,
  "recordKey" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "jobNo" TEXT,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linkedByUser" TEXT,
  "stage" TEXT NOT NULL,
  "notes" TEXT
);
CREATE INDEX "BarcodeJobLink_barcodeId_idx" ON "BarcodeJobLink"("barcodeId");
CREATE INDEX "BarcodeJobLink_jobNo_idx" ON "BarcodeJobLink"("jobNo");
ALTER TABLE "BarcodeJobLink" ADD CONSTRAINT "BarcodeJobLink_barcodeId_fkey" FOREIGN KEY ("barcodeId") REFERENCES "TraceBarcode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BarcodeStageEvent" (
  "id" SERIAL PRIMARY KEY,
  "barcodeId" INTEGER NOT NULL,
  "stage" TEXT NOT NULL,
  "recordKey" TEXT,
  "submissionId" TEXT,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scannedByUser" TEXT,
  "locationNote" TEXT,
  "weight" DOUBLE PRECISION
);
CREATE INDEX "BarcodeStageEvent_barcodeId_idx" ON "BarcodeStageEvent"("barcodeId");
ALTER TABLE "BarcodeStageEvent" ADD CONSTRAINT "BarcodeStageEvent_barcodeId_fkey" FOREIGN KEY ("barcodeId") REFERENCES "TraceBarcode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BarcodeSplitEvent" (
  "id" SERIAL PRIMARY KEY,
  "parentId" INTEGER NOT NULL,
  "splitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "splitByUser" TEXT,
  "splitReason" TEXT NOT NULL,
  "recordKey" TEXT,
  "submissionId" TEXT
);
CREATE INDEX "BarcodeSplitEvent_parentId_idx" ON "BarcodeSplitEvent"("parentId");
ALTER TABLE "BarcodeSplitEvent" ADD CONSTRAINT "BarcodeSplitEvent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TraceBarcode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
