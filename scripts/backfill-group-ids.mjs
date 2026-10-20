#!/usr/bin/env node
// Backfills submissionGroupId and recordType for all existing sub_* rows that don't have them.
//
// Logic:
//   recordType  = the recordKey from RecordDefinition matching the table name
//   submissionDate = already set by the migration SQL (createdAt AT TIME ZONE 'Africa/Johannesburg')
//   submissionGroupId = one stable ID per (recordType, submissionDate) pair
//                      = 'sub_group_<recordKey>_<YYYY-MM-DD>_<first row id truncated>'
//
// This is safe to run multiple times (idempotent: only touches rows where recordType IS NULL).
// Run after deploying migration 20261020100000_group_verification.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TABLE_TO_RECORD_KEY = {
  sub_dry_export_pack_front_page: 'dry-export-pack-front-page',
  sub_live_leftovers_log: 'live-leftovers-log',
  sub_master_cleaning_checklist: 'master-cleaning-checklist',
  sub_master_cleaning_plan: 'master-cleaning-plan',
  sub_mortalities_log: 'mortalities-log',
  sub_mortality_counts_by_customer: 'mortality-counts-by-customer',
  sub_production_information_nrcs: 'production-information-nrcs',
  sub_dry_nrcs_packs: 'dry-nrcs-packs',
  sub_production_information_nrcs_rework: 'production-information-nrcs-rework',
  sub_qa1_damaged_cans_and_lids: 'qa1-damaged-cans-and-lids',
  sub_cans_released_form: 'cans-released-form',
  sub_gonad_inspection_report: 'gonad-inspection-report',
  sub_training_register: 'training-register',
  sub_incubator_cans_log: 'incubator-cans-log',
  sub_fixed_reader_checks: 'fixed-reader-checks',
  sub_basket_removal_shucking_gutting: 'basket-removal-shucking-gutting',
  sub_abalone_receiving: 'abalone-receiving',
  sub_salting_and_tumbling: 'salting-and-tumbling',
  sub_bleeding_and_salting: 'bleeding-and-salting',
  sub_washing_control_sheet: 'washing-control-sheet',
  sub_salting_oosw: 'salting-oosw',
  sub_scrubbing_check_supervisor: 'scrubbing-check-supervisor',
  sub_ph_verification: 'ph-verification',
  sub_thermometer_verification: 'thermometer-verification',
  sub_thermometer_correction_factors: 'thermometer-correction-factors',
  sub_sampling_log: 'sampling-log',
  sub_stock_loading: 'stock-loading',
  sub_qc_report: 'qc-report',
  sub_double_seam_inspection_report: 'double-seam-inspection-report',
  sub_rework_log: 'rework-log',
  sub_product_label_checklist: 'product-label-checklist',
  sub_labelling_of_cans: 'labelling-of-cans',
  sub_stock_transfers: 'stock-transfers',
  sub_scrubbing_checklist_qc: 'scrubbing-checklist-qc',
  sub_precooking_check_sheet: 'precooking-check-sheet',
  sub_abalone_packing_specification: 'abalone-packing-specification',
  sub_can_packing_control_sheet: 'can-packing-control-sheet',
  sub_can_filling_and_printing: 'can-filling-and-printing',
  sub_printing_control_sheet: 'printing-control-sheet',
  sub_cans_produced: 'cans-produced',
  sub_retorting_control_sheet: 'retorting-control-sheet',
  sub_retort_inspection_report: 'retort-inspection-report',
  sub_broth_cooking: 'broth-cooking',
  sub_ingredient_weighing: 'ingredient-weighing',
  sub_sauce_mixing: 'sauce-mixing',
  sub_final_sauce_mix: 'final-sauce-mix',
  sub_sauce_batch_coding: 'sauce-batch-coding',
  sub_brine_mixing_report: 'brine-mixing-report',
  sub_dry_cooking: 'dry-cooking',
  sub_drying_process: 'drying-process',
  sub_dried_abalone_transfer: 'dried-abalone-transfer',
  sub_dry_monitoring: 'dry-monitoring',
  sub_grading_production_log_cultivated: 'grading-production-log-cultivated',
  sub_grading_production_log_ranched: 'grading-production-log-ranched',
  sub_grading_boxing_traceability: 'grading-boxing-traceability',
  sub_boxing_and_labelling: 'boxing-and-labelling',
  sub_dry_stock_control: 'dry-stock-control',
  sub_labelling_of_dry_boxes: 'labelling-of-dry-boxes',
  sub_dry_labelling_list: 'dry-labelling-list',
  sub_dry_stock_transfers: 'dry-stock-transfers',
  sub_live_production_pack: 'live-production-pack',
  sub_live_pack_checklist: 'live-pack-checklist',
  sub_live_packing_bag_quality_check: 'live-packing-bag-quality-check',
  sub_individual_abalone_weight_checks: 'individual-abalone-weight-checks',
  sub_receiving_live_returns: 'receiving-live-returns',
  sub_production_areas_cleaning_record: 'production-areas-cleaning-record',
  sub_live_product_areas_cleaning_record: 'live-product-areas-cleaning-record',
  sub_personnel_facilities_cleaning_record: 'personnel-facilities-cleaning-record',
  sub_daily_cleaning_inspection: 'daily-cleaning-inspection',
  sub_deep_cleaning_record_weekly: 'deep-cleaning-record-weekly',
  sub_weekly_cleaning_record: 'weekly-cleaning-record',
  sub_dispatch_cleaning_inspection: 'dispatch-cleaning-inspection',
  sub_facility_inspection: 'facility-inspection',
  sub_facility_inspection_nc_report: 'facility-inspection-nc-report',
  sub_chemical_stock_issue_register: 'chemical-stock-issue-register',
  sub_internal_pest_sightings_log: 'internal-pest-sightings-log',
  sub_pest_inspection_record: 'pest-inspection-record',
  sub_staff_hygiene_inspection_weekends: 'staff-hygiene-inspection-weekends',
  sub_staff_hygiene_inspection: 'staff-hygiene-inspection',
  sub_allergen_cleaning_verification: 'allergen-cleaning-verification',
  sub_daily_equipment_checklist: 'daily-equipment-checklist',
  sub_glass_plastic_equipment_inspection: 'glass-plastic-equipment-inspection',
  sub_glass_breakage_clearance_certificate: 'glass-breakage-clearance-certificate',
  sub_utensil_issue_record: 'utensil-issue-record',
  sub_safety_glass_register: 'safety-glass-register',
  sub_goggles_register: 'goggles-register',
  sub_knife_register: 'knife-register',
  sub_glove_issuing_register: 'glove-issuing-register',
  sub_plaster_dressing_inspection: 'plaster-dressing-inspection',
  sub_first_aid_checklist_record: 'first-aid-checklist-record',
  sub_salt_issuing_register: 'salt-issuing-register',
  sub_chiller_batch_control: 'chiller-batch-control',
  sub_dry_chiller_batch_control: 'dry-chiller-batch-control',
  sub_maintenance_job_card: 'maintenance-job-card',
  sub_water_tank_inspection: 'water-tank-inspection',
  sub_factory_maintenance_inspection: 'factory-maintenance-inspection',
  sub_equipment_checklist_roof: 'equipment-checklist-roof',
  sub_daily_waste_removal: 'daily-waste-removal',
  sub_boiler_inspection_report: 'boiler-inspection-report',
  sub_seamer_inspection_report: 'seamer-inspection-report',
  sub_incoming_ppe_inspection: 'incoming-ppe-inspection',
  sub_incoming_goods_inspection_log: 'incoming-goods-inspection-log',
  sub_cans_incoming_inspection: 'cans-incoming-inspection',
  sub_lids_incoming_inspection: 'lids-incoming-inspection',
  sub_lids_incoming_inspection_internal: 'lids-incoming-inspection-internal',
  sub_incoming_goods_inspection: 'incoming-goods-inspection',
  sub_dispatch_loading_inspection_checklist: 'dispatch-loading-inspection-checklist',
  sub_dispatch_receiving_checklist: 'dispatch-receiving-checklist',
  sub_water_monitoring: 'water-monitoring',
  sub_lha_water_monitoring: 'lha-water-monitoring',
  sub_chiller_temperature_monitoring: 'chiller-temperature-monitoring',
  sub_incubator_temperature_check: 'incubator-temperature-check',
  sub_dry_room_temp_humidity_log: 'dry-room-temp-humidity-log',
  sub_grading_room_temp_humidity_log: 'grading-room-temp-humidity-log',
  sub_internal_car: 'internal-car',
  sub_disposition_investigation_record: 'disposition-investigation-record',
  sub_withdrawal_mock_recall_record: 'withdrawal-mock-recall-record',
  sub_traceability: 'traceability',
  sub_traceability_mock_recall_canned_braised_abalone: 'traceability-mock-recall-canned-braised-abalone',
  sub_traceability_mock_recall_canned_abalone: 'traceability-mock-recall-canned-abalone',
  sub_traceability_mock_recall_canned_minced_abalone: 'traceability-mock-recall-canned-minced-abalone',
  sub_traceability_mock_recall_dried_abalone: 'traceability-mock-recall-dried-abalone',
  sub_traceability_mock_recall_live_abalone: 'traceability-mock-recall-live-abalone',
  sub_supplier_questionnaire: 'supplier-questionnaire',
  sub_supplier_approval_record: 'supplier-approval-record',
  sub_rapid_food_handler_medicals: 'rapid-food-handler-medicals',
  sub_rfh_medical_result: 'rfh-medical-result',
  sub_emergency_evacuation_attendance_register: 'emergency-evacuation-attendance-register',
  sub_handling_of_emergencies_and_incidences: 'handling-of-emergencies-and-incidences',
  sub_daily_factory_feedback_meeting: 'daily-factory-feedback-meeting',
  sub_rtw_medical_questionnaire: 'rtw-medical-questionnaire',
  sub_dry_monitoring_images: 'dry-monitoring-images',
};

async function backfillTable(tableName, recordKey) {
  // Assign recordType to rows that are missing it
  const setType = await prisma.$executeRawUnsafe(
    `UPDATE "${tableName}" SET "recordType" = $1 WHERE "recordType" IS NULL`,
    recordKey
  );

  // For each (recordType, submissionDate) pair without a group ID, generate one from the
  // first row's id in that group (stable: same result on re-run).
  // Group ID format: sub_group_<recordKey>_<YYYY-MM-DD>_<firstId>
  const groups = await prisma.$queryRawUnsafe(`
    SELECT "submissionDate"::TEXT AS date, MIN("id") AS first_id
    FROM "${tableName}"
    WHERE "submissionGroupId" IS NULL AND "submissionDate" IS NOT NULL
    GROUP BY "submissionDate"
  `);

  let updated = 0;
  for (const g of groups) {
    const groupId = `sub_group_${recordKey}_${g.date}_${g.first_id.slice(0, 8)}`;
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "${tableName}" SET "submissionGroupId" = $1 WHERE "submissionDate" = $2 AND "submissionGroupId" IS NULL`,
      groupId,
      new Date(g.date)
    );
    updated += Number(n);
  }

  if (setType > 0 || updated > 0) {
    console.log(`  ${tableName}: recordType=${setType} rows, groupId=${updated} rows (${groups.length} groups)`);
  }
}

async function main() {
  console.log('Backfilling submissionGroupId and recordType...');
  for (const [table, key] of Object.entries(TABLE_TO_RECORD_KEY)) {
    try {
      await backfillTable(table, key);
    } catch (e) {
      console.error(`  ERROR on ${table}:`, e.message);
    }
  }
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
