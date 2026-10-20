-- CreateTable: ProductData (product catalogue for canning QC REC 7.2.11)
CREATE TABLE "ProductData" (
    "id"                 SERIAL PRIMARY KEY,
    "agCode"             TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "canSize"            TEXT NOT NULL,
    "containerType"      TEXT NOT NULL DEFAULT 'tin',
    "nettWeightMin"      DOUBLE PRECISION,
    "drainWeightMin"     DOUBLE PRECISION,
    "phMin"              DOUBLE PRECISION,
    "brixMin"            DOUBLE PRECISION,
    "saltMin"            DOUBLE PRECISION,
    "notes"              TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ProductData_agCode_key" ON "ProductData"("agCode");
CREATE INDEX "ProductData_agCode_idx" ON "ProductData"("agCode");
