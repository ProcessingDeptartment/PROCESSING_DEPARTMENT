-- Add the single completedBy TEXT column to every monitoring-log submission table.
-- Safe to re-run (IF NOT EXISTS). Run in the Neon SQL Editor BEFORE deploying the code change.
BEGIN;
ALTER TABLE "sub_live_leftovers_log" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- Live Leftovers Log
ALTER TABLE "sub_mortalities_log" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- Mortalities Log
ALTER TABLE "sub_qa1_damaged_cans_and_lids" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- QA1
ALTER TABLE "sub_cans_released_form" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 01
ALTER TABLE "sub_gonad_inspection_report" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 1
ALTER TABLE "sub_incubator_cans_log" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.1
ALTER TABLE "sub_fixed_reader_checks" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.1.00
ALTER TABLE "sub_scrubbing_check_supervisor" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.1.6
ALTER TABLE "sub_ph_verification" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.10.2
ALTER TABLE "sub_thermometer_verification" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.10.3
ALTER TABLE "sub_thermometer_correction_factors" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.10.4
ALTER TABLE "sub_sampling_log" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.2
ALTER TABLE "sub_stock_loading" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.2.10
ALTER TABLE "sub_double_seam_inspection_report" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.2.12
ALTER TABLE "sub_abalone_packing_specification" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.2.4
ALTER TABLE "sub_drying_process" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.4.1
ALTER TABLE "sub_dry_monitoring" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.4.2
ALTER TABLE "sub_boxing_and_labelling" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.4.5
ALTER TABLE "sub_dry_stock_control" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.4.6
ALTER TABLE "sub_labelling_of_dry_boxes" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.4.7
ALTER TABLE "sub_dry_stock_transfers" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.4.9
ALTER TABLE "sub_live_production_pack" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.5.1
ALTER TABLE "sub_live_pack_checklist" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.5.2
ALTER TABLE "sub_receiving_live_returns" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.5.5
ALTER TABLE "sub_dispatch_cleaning_inspection" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.6.2.2
ALTER TABLE "sub_chemical_stock_issue_register" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.6.4
ALTER TABLE "sub_internal_pest_sightings_log" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.6.5
ALTER TABLE "sub_allergen_cleaning_verification" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.6.8
ALTER TABLE "sub_glove_issuing_register" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.7.5
ALTER TABLE "sub_plaster_dressing_inspection" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.7.6
ALTER TABLE "sub_first_aid_checklist_record" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.7.6a
ALTER TABLE "sub_salt_issuing_register" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.7.7
ALTER TABLE "sub_chiller_batch_control" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.1
ALTER TABLE "sub_dry_chiller_batch_control" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.1
ALTER TABLE "sub_water_tank_inspection" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.11
ALTER TABLE "sub_daily_waste_removal" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.2
ALTER TABLE "sub_boiler_inspection_report" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.3
ALTER TABLE "sub_seamer_inspection_report" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.4
ALTER TABLE "sub_incoming_ppe_inspection" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.5
ALTER TABLE "sub_incoming_goods_inspection_log" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.5.1
ALTER TABLE "sub_cans_incoming_inspection" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.6
ALTER TABLE "sub_lids_incoming_inspection" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.6.1
ALTER TABLE "sub_lids_incoming_inspection_internal" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.6.2
ALTER TABLE "sub_incoming_goods_inspection" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.7
ALTER TABLE "sub_dispatch_loading_inspection_checklist" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.8
ALTER TABLE "sub_dispatch_receiving_checklist" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.8.1
ALTER TABLE "sub_water_monitoring" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.9
ALTER TABLE "sub_lha_water_monitoring" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.8.9.1
ALTER TABLE "sub_chiller_temperature_monitoring" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.9.1
ALTER TABLE "sub_incubator_temperature_check" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.9.2
ALTER TABLE "sub_dry_room_temp_humidity_log" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.9.3.1
ALTER TABLE "sub_grading_room_temp_humidity_log" ADD COLUMN IF NOT EXISTS "completedBy" TEXT; -- REC 7.9.3.2
COMMIT;
