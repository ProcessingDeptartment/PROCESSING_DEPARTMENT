CREATE TABLE "BarcodeMember" (
  "id" SERIAL PRIMARY KEY,
  "barcodeId" INTEGER NOT NULL,
  "submissionId" TEXT NOT NULL,
  "memberValue" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "sizeRange" TEXT,
  "weight" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BarcodeMember_barcodeId_memberValue_key" ON "BarcodeMember"("barcodeId", "memberValue");
CREATE INDEX "BarcodeMember_memberValue_idx" ON "BarcodeMember"("memberValue");
ALTER TABLE "BarcodeMember" ADD CONSTRAINT "BarcodeMember_barcodeId_fkey" FOREIGN KEY ("barcodeId") REFERENCES "TraceBarcode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
