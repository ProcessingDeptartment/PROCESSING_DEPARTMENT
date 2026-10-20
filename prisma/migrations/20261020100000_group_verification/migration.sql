-- Migration: group_verification
-- Adds submission grouping columns to all sub_* parent tables and creates
-- the submissions_group_verification table.
-- Grouping columns (all nullable so existing rows are unaffected):
--   submissionGroupId TEXT          -- shared ID for all submissions of same type on same day
--   submissionDate    DATE          -- server-local calendar date (Africa/Johannesburg) at submit time
--   recordType        TEXT          -- the record key (e.g. 'dry-room-temp-humidity-log')
--   verifiedGroupAt   TIMESTAMPTZ   -- set when the group is verified; NULL = unverified
--
-- Backfill: submissionDate is set from createdAt for all existing rows.
-- submissionGroupId and recordType are backfilled by scripts/backfill-group-ids.mjs after deploy.

-- ============================================================
-- 1. Add columns to all sub_* parent tables (idempotent)
-- ============================================================

ALTER TABLE "sub_dry_export_pack_front_page"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_live_leftovers_log"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_master_cleaning_checklist"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_master_cleaning_plan"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_mortalities_log"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_mortality_counts_by_customer"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_production_information_nrcs"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dry_nrcs_packs"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_production_information_nrcs_rework"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_qa1_damaged_cans_and_lids"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_cans_released_form"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_gonad_inspection_report"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_training_register"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_incubator_cans_log"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_fixed_reader_checks"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_basket_removal_shucking_gutting"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_abalone_receiving"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_salting_and_tumbling"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_bleeding_and_salting"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_washing_control_sheet"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_salting_oosw"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_scrubbing_check_supervisor"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_ph_verification"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_thermometer_verification"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_thermometer_correction_factors"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_sampling_log"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_stock_loading"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_qc_report"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_double_seam_inspection_report"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_rework_log"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_product_label_checklist"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_labelling_of_cans"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_stock_transfers"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_scrubbing_checklist_qc"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_precooking_check_sheet"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_abalone_packing_specification"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_can_packing_control_sheet"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_can_filling_and_printing"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_printing_control_sheet"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_cans_produced"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_retorting_control_sheet"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_retort_inspection_report"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_broth_cooking"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_ingredient_weighing"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_sauce_mixing"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_final_sauce_mix"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_sauce_batch_coding"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_brine_mixing_report"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dry_cooking"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_drying_process"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dried_abalone_transfer"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dry_monitoring"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_grading_production_log_cultivated"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_grading_production_log_ranched"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_grading_boxing_traceability"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_boxing_and_labelling"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dry_stock_control"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_labelling_of_dry_boxes"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dry_labelling_list"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dry_stock_transfers"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_live_production_pack"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_live_pack_checklist"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_live_packing_bag_quality_check"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_individual_abalone_weight_checks"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_receiving_live_returns"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_production_areas_cleaning_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_live_product_areas_cleaning_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_personnel_facilities_cleaning_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_daily_cleaning_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_deep_cleaning_record_weekly"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_weekly_cleaning_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dispatch_cleaning_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_facility_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_facility_inspection_nc_report"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_chemical_stock_issue_register"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_internal_pest_sightings_log"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_pest_inspection_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_staff_hygiene_inspection_weekends"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_staff_hygiene_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_allergen_cleaning_verification"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_daily_equipment_checklist"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_glass_plastic_equipment_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_glass_breakage_clearance_certificate"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_utensil_issue_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_safety_glass_register"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_goggles_register"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_knife_register"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_glove_issuing_register"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_plaster_dressing_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_first_aid_checklist_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_salt_issuing_register"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_chiller_batch_control"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dry_chiller_batch_control"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_maintenance_job_card"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_water_tank_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_factory_maintenance_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_equipment_checklist_roof"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_daily_waste_removal"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_boiler_inspection_report"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_seamer_inspection_report"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_incoming_ppe_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_incoming_goods_inspection_log"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_cans_incoming_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_lids_incoming_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_lids_incoming_inspection_internal"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_incoming_goods_inspection"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dispatch_loading_inspection_checklist"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dispatch_receiving_checklist"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_water_monitoring"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_lha_water_monitoring"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_chiller_temperature_monitoring"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_incubator_temperature_check"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dry_room_temp_humidity_log"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_grading_room_temp_humidity_log"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_internal_car"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_disposition_investigation_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_withdrawal_mock_recall_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_traceability"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_traceability_mock_recall_canned_braised_abalone"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_traceability_mock_recall_canned_abalone"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_traceability_mock_recall_canned_minced_abalone"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_traceability_mock_recall_dried_abalone"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_traceability_mock_recall_live_abalone"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_supplier_questionnaire"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_supplier_approval_record"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_rapid_food_handler_medicals"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_rfh_medical_result"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_emergency_evacuation_attendance_register"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_handling_of_emergencies_and_incidences"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_daily_factory_feedback_meeting"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_rtw_medical_questionnaire"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

ALTER TABLE "sub_dry_monitoring_images"
  ADD COLUMN IF NOT EXISTS "submissionGroupId" TEXT,
  ADD COLUMN IF NOT EXISTS "submissionDate"    DATE,
  ADD COLUMN IF NOT EXISTS "recordType"        TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedGroupAt"   TIMESTAMPTZ;

-- ============================================================
-- 2. Create group verification log table
-- ============================================================

CREATE TABLE IF NOT EXISTS "submissions_group_verification" (
  "id"                TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "recordType"        TEXT        NOT NULL,
  "submissionGroupId" TEXT        NOT NULL,
  "submissionDate"    DATE        NOT NULL,
  "verifiedBy"        TEXT        NOT NULL,
  "verifiedTitle"     TEXT        NOT NULL,
  "verifiedSignature" TEXT        NOT NULL,
  "verifiedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "recordCount"       INT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "submissions_group_verification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_group_verification" UNIQUE ("recordType", "submissionGroupId")
);

CREATE INDEX IF NOT EXISTS "sgv_recordType_submissionDate_idx"
  ON "submissions_group_verification" ("recordType", "submissionDate");

-- ============================================================
-- 3. Backfill submissionDate from createdAt for existing rows
-- ============================================================

UPDATE "sub_dry_export_pack_front_page" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_live_leftovers_log" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_master_cleaning_checklist" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_master_cleaning_plan" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_mortalities_log" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_mortality_counts_by_customer" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_production_information_nrcs" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dry_nrcs_packs" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_production_information_nrcs_rework" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_qa1_damaged_cans_and_lids" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_cans_released_form" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_gonad_inspection_report" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_training_register" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_incubator_cans_log" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_fixed_reader_checks" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_basket_removal_shucking_gutting" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_abalone_receiving" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_salting_and_tumbling" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_bleeding_and_salting" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_washing_control_sheet" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_salting_oosw" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_scrubbing_check_supervisor" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_ph_verification" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_thermometer_verification" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_thermometer_correction_factors" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_sampling_log" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_stock_loading" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_qc_report" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_double_seam_inspection_report" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_rework_log" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_product_label_checklist" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_labelling_of_cans" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_stock_transfers" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_scrubbing_checklist_qc" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_precooking_check_sheet" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_abalone_packing_specification" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_can_packing_control_sheet" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_can_filling_and_printing" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_printing_control_sheet" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_cans_produced" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_retorting_control_sheet" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_retort_inspection_report" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_broth_cooking" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_ingredient_weighing" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_sauce_mixing" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_final_sauce_mix" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_sauce_batch_coding" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_brine_mixing_report" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dry_cooking" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_drying_process" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dried_abalone_transfer" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dry_monitoring" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_grading_production_log_cultivated" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_grading_production_log_ranched" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_grading_boxing_traceability" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_boxing_and_labelling" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dry_stock_control" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_labelling_of_dry_boxes" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dry_labelling_list" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dry_stock_transfers" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_live_production_pack" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_live_pack_checklist" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_live_packing_bag_quality_check" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_individual_abalone_weight_checks" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_receiving_live_returns" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_production_areas_cleaning_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_live_product_areas_cleaning_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_personnel_facilities_cleaning_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_daily_cleaning_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_deep_cleaning_record_weekly" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_weekly_cleaning_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dispatch_cleaning_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_facility_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_facility_inspection_nc_report" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_chemical_stock_issue_register" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_internal_pest_sightings_log" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_pest_inspection_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_staff_hygiene_inspection_weekends" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_staff_hygiene_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_allergen_cleaning_verification" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_daily_equipment_checklist" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_glass_plastic_equipment_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_glass_breakage_clearance_certificate" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_utensil_issue_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_safety_glass_register" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_goggles_register" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_knife_register" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_glove_issuing_register" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_plaster_dressing_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_first_aid_checklist_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_salt_issuing_register" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_chiller_batch_control" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dry_chiller_batch_control" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_maintenance_job_card" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_water_tank_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_factory_maintenance_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_equipment_checklist_roof" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_daily_waste_removal" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_boiler_inspection_report" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_seamer_inspection_report" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_incoming_ppe_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_incoming_goods_inspection_log" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_cans_incoming_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_lids_incoming_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_lids_incoming_inspection_internal" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_incoming_goods_inspection" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dispatch_loading_inspection_checklist" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dispatch_receiving_checklist" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_water_monitoring" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_lha_water_monitoring" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_chiller_temperature_monitoring" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_incubator_temperature_check" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dry_room_temp_humidity_log" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_grading_room_temp_humidity_log" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_internal_car" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_disposition_investigation_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_withdrawal_mock_recall_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_traceability" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_traceability_mock_recall_canned_braised_abalone" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_traceability_mock_recall_canned_abalone" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_traceability_mock_recall_canned_minced_abalone" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_traceability_mock_recall_dried_abalone" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_traceability_mock_recall_live_abalone" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_supplier_questionnaire" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_supplier_approval_record" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_rapid_food_handler_medicals" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_rfh_medical_result" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_emergency_evacuation_attendance_register" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_handling_of_emergencies_and_incidences" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_daily_factory_feedback_meeting" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_rtw_medical_questionnaire" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;
UPDATE "sub_dry_monitoring_images" SET "submissionDate" = ("createdAt" AT TIME ZONE 'Africa/Johannesburg')::DATE WHERE "submissionDate" IS NULL;