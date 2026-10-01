-- One row per closed box (REC 7.4.3.x + Full box), completed in place by REC 7.4.5.
CREATE TABLE "closed_box" (
    "id" SERIAL NOT NULL,
    "box_code" TEXT NOT NULL,
    "source_record_key" TEXT NOT NULL,
    "source_submission_id" TEXT NOT NULL,
    "source_status" TEXT NOT NULL,
    "job_no" TEXT NOT NULL,
    "size_grade" TEXT NOT NULL,
    "nett_kg_7_4_3" DOUBLE PRECISION,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_after_inspection" BOOLEAN NOT NULL DEFAULT false,
    "inspection_submission_id" TEXT,
    "tare_kg" DOUBLE PRECISION,
    "nett_kg" DOUBLE PRECISION,
    "colour_uniform" BOOLEAN,
    "size_grade_correct" BOOLEAN,
    "frills_present" BOOLEAN,
    "bag_sealed" BOOLEAN,
    "box_sealed" BOOLEAN,
    "silica_present" BOOLEAN,
    "approved" BOOLEAN,
    "comment" TEXT,
    "packing_date" DATE,
    "packed_at" TIMESTAMP(3),
    "inspected_by" TEXT,
    CONSTRAINT "closed_box_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "closed_box_box_code_key" ON "closed_box"("box_code");
CREATE INDEX "closed_box_source_submission_id_idx" ON "closed_box"("source_submission_id");
CREATE INDEX "closed_box_closed_at_idx" ON "closed_box"("closed_at");
CREATE INDEX "closed_box_approved_idx" ON "closed_box"("approved");
CREATE INDEX "closed_box_inspection_submission_id_idx" ON "closed_box"("inspection_submission_id");
