-- REC 7.4.4 report brief, step 1: job -> bin edges fed from REC 7.4.3.1 / 7.4.3.2 (and legacy 7.4.4).
CREATE TABLE "stock_link" (
    "id" SERIAL NOT NULL,
    "from_type" TEXT NOT NULL,
    "from_key" TEXT NOT NULL,
    "to_type" TEXT NOT NULL,
    "to_key" TEXT NOT NULL,
    "record_key" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "occurred_on" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_link_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "stock_link_record_key_submission_id_slot_key" ON "stock_link"("record_key", "submission_id", "slot");
CREATE INDEX "stock_link_from_type_from_key_idx" ON "stock_link"("from_type", "from_key");
CREATE INDEX "stock_link_to_type_to_key_idx" ON "stock_link"("to_type", "to_key");
CREATE INDEX "stock_link_record_key_submission_id_idx" ON "stock_link"("record_key", "submission_id");
