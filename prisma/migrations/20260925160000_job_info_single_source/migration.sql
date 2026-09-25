-- Job-level facts live once. Receiving date, received-from farm, processing-for and intake weight
-- belong to the job: REC 7.1.2 Abalone Receiving (sub_abalone_receiving) holds them, and the job_info
-- view below exposes them by job number. Downstream records autofill them read-only for display, so
-- their sub_* tables stop keeping a copy (see src/job-snapshot.js). Nothing is lost: each row keeps
-- the full submission in rawJson, and the KeyValue blob is unchanged.
--
-- To get them on any record: JOIN job_info j ON j."jobNo" = <record>."<its job-number column>"

CREATE OR REPLACE VIEW "job_info" AS
SELECT DISTINCT ON (r."jobNo")
  r."jobNo",
  r."receivingDate",
  r."receivedFrom",
  r."toBeProcessedFor" AS "processingFor",
  r."intakeWeight",
  r."status" AS "receivingStatus",
  r."id" AS "receivingId",
  COALESCE(js."status", 'open') AS "jobStatus"
FROM "sub_abalone_receiving" r
LEFT JOIN "JobStatus" js ON js."jobNo" = r."jobNo"
WHERE r."jobNo" IS NOT NULL AND r."jobNo" <> ''
ORDER BY r."jobNo", (r."status" = 'submitted') DESC, r."updatedAt" DESC;

ALTER TABLE "sub_basket_removal_shucking_gutting"
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_bleeding_and_salting"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_brine_mixing_report"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_broth_cooking"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_can_filling_and_printing"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_can_packing_control_sheet"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_cans_incoming_inspection"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_cans_produced"
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_chiller_batch_control"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_chiller_temperature_monitoring"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_dispatch_loading_inspection_checklist"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_dispatch_receiving_checklist"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_dried_abalone_transfer"
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor";

ALTER TABLE "sub_dry_chiller_batch_control"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_dry_cooking"
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_dry_monitoring"
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor";

ALTER TABLE "sub_dry_stock_control"
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_drying_process"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_gonad_inspection_report"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_grading_boxing_traceability"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_grading_production_log_cultivated"
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_grading_production_log_ranched"
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_ingredient_weighing"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_live_production_pack"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_precooking_check_sheet"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_qc_report"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_retort_inspection_report"
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_retorting_control_sheet"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_rework_log"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_salting_and_tumbling"
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_salting_oosw"
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_sampling_log"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_sauce_mixing"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_scrubbing_check_supervisor"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_scrubbing_checklist_qc"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_seamer_inspection_report"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_stock_loading"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_stock_transfers"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";

ALTER TABLE "sub_washing_control_sheet"
  DROP COLUMN IF EXISTS "jiReceivingDate",
  DROP COLUMN IF EXISTS "jiReceivedFrom",
  DROP COLUMN IF EXISTS "jiProcessingFor",
  DROP COLUMN IF EXISTS "jiIntakeWeight";
