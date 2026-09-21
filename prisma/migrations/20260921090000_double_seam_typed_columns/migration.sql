-- REC 7.2.12 Double Seam Inspection Report: give its submission table the same typed shape as
-- every other record (2026-09-21).
-- The page draws its own body (customBody), so its columns come from the definition in
-- data/record-definitions.json, not from an entryFields list: header fields mirrored top-level,
-- plus a child table with one row per stage x can x point (emitted by read() as values.roster).
-- Purely additive. The table held no typed data before (only the base columns + rawJson).

-- AlterTable
ALTER TABLE "sub_double_seam_inspection_report"
  ADD COLUMN "jobNo" TEXT,
  ADD COLUMN "agCode" TEXT,
  ADD COLUMN "reportDate" DATE,
  ADD COLUMN "canSize" TEXT,
  ADD COLUMN "dateProduced" DATE,
  ADD COLUMN "batchCans" TEXT,
  ADD COLUMN "batchEnds" TEXT,
  ADD COLUMN "microSerial" TEXT,
  ADD COLUMN "microVerified" BOOLEAN,
  ADD COLUMN "gauge121" DOUBLE PRECISION,
  ADD COLUMN "gauge300" DOUBLE PRECISION,
  ADD COLUMN "specProfileId" TEXT,
  ADD COLUMN "specProfileName" TEXT,
  ADD COLUMN "specVersionAtSave" DOUBLE PRECISION,
  ADD COLUMN "completedBy" TEXT,
  ADD COLUMN "completedDate" DATE;

-- CreateTable
CREATE TABLE "sub_double_seam_inspection_report_row" (
    "id" SERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT,
    "can" TEXT,
    "point" INTEGER,
    "vacuum" DOUBLE PRECISION,
    "seamLength" DOUBLE PRECISION,
    "seamThickness" DOUBLE PRECISION,
    "bodyHook" DOUBLE PRECISION,
    "coverHook" DOUBLE PRECISION,
    "bhbPct" DOUBLE PRECISION,
    "freespace" DOUBLE PRECISION,
    "internal" DOUBLE PRECISION,
    "tightnessPct" DOUBLE PRECISION,
    "plateThicknessEnd" DOUBLE PRECISION,
    "plateThicknessBody" DOUBLE PRECISION,
    "countersinkDepth" DOUBLE PRECISION,

    CONSTRAINT "sub_double_seam_inspection_report_row_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sub_double_seam_inspection_report_row_parentId_idx" ON "sub_double_seam_inspection_report_row"("parentId");

-- AddForeignKey
ALTER TABLE "sub_double_seam_inspection_report_row" ADD CONSTRAINT "sub_double_seam_inspection_report_row_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sub_double_seam_inspection_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
