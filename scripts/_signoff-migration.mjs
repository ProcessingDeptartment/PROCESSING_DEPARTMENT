// Targeted, data-preserving migration for the Sign-off -> "Completed by" consolidation.
// Scoped ONLY to sign-off columns on the 39 affected sub_* tables. Does NOT touch the
// unrelated schema drift (time-column type changes, dry-export-pack-front-page extra
// fields) that showed up in `prisma migrate diff` - that drift predates this change and
// is out of scope here.
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const env = fs.readFileSync('.env', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const prisma = new PrismaClient();

// table -> { source: column to copy into completedBy (or null if none), drop: [columns to drop] }
const TABLES = {
  sub_dry_export_pack_front_page: { source: 'completedBySupervisor', drop: ['completedBySupervisor', 'checkedByQC', 'verificationBy'] },
  sub_production_information_nrcs: { source: 'checkedByQC', drop: ['checkedByQC', 'verificationBy'] },
  sub_dry_nrcs_packs: { source: 'checkedByQC', drop: ['checkedByQC', 'verificationBy'] },
  sub_production_information_nrcs_rework: { source: 'checkedByQC', drop: ['checkedByQC', 'verificationBy'] },
  sub_salting_and_tumbling: { source: 'qualityController', drop: ['qualityController', 'processDeviation'] },
  sub_washing_control_sheet: { source: 'qcOnline', drop: ['qcOnline', 'processDeviation'] },
  sub_salting_oosw: { source: 'supervisor', drop: ['supervisor', 'supervisorTitle', 'supervisorDate', 'comments'] },
  sub_rework_log: { source: 'checkedByQC', drop: ['checkedByQC'] },
  sub_product_label_checklist: { source: 'receivedBy', drop: ['receivedBy', 'comments'] },
  sub_scrubbing_checklist_qc: { source: 'checkedBy', drop: ['checkedBy', 'processDeviation'] },
  sub_can_packing_control_sheet: { source: 'qcOnline', drop: ['qcOnline', 'processDeviation'] },
  sub_broth_cooking: { source: 'cookedBy', drop: ['cookedBy', 'comments'] },
  sub_ingredient_weighing: { source: 'weighedBy', drop: ['weighedBy', 'comments'] },
  sub_sauce_batch_coding: { source: 'supervisor', drop: ['supervisor', 'comments'] },
  sub_dry_cooking: { source: 'cooker', drop: ['cooker', 'comments'] },
  sub_grading_production_log_cultivated: { source: 'supervisor', drop: ['nameOfGraders', 'supervisor', 'verifiedBy'] },
  sub_grading_production_log_ranched: { source: 'supervisor', drop: ['nameOfGraders', 'supervisor', 'verifiedBy'] },
  sub_grading_boxing_traceability: { source: 'supervisor', drop: ['supervisor'] },
  sub_dry_labelling_list: { source: 'abagoldEmployee', drop: ['salesDept', 'driverFromFreightCo', 'abagoldEmployee'] },
  sub_live_packing_bag_quality_check: { source: 'supervisorProcessing', drop: ['additionalComments', 'supervisorFarm', 'supervisorProcessing', 'qcProcessing', 'verifiedBy'] },
  sub_individual_abalone_weight_checks: { source: 'checkedByQC', drop: ['checkedByQC', 'qaVerification'] },
  sub_production_areas_cleaning_record: { source: 'inspectedBy', drop: ['inspectedBy', 'verifiedBy'] },
  sub_live_product_areas_cleaning_record: { source: 'inspectedBy', drop: ['inspectedBy', 'verifiedBy'] },
  sub_personnel_facilities_cleaning_record: { source: 'inspectedBy', drop: ['inspectedBy', 'verifiedBy'] },
  sub_weekly_cleaning_record: { source: 'checkedBy', drop: ['checkedBy', 'supervisor'] },
  sub_pest_inspection_record: { source: 'inspectedBy', drop: ['inspectedBy', 'verifiedBy'] },
  sub_staff_hygiene_inspection_weekends: { source: 'verifiedBy', drop: ['verifiedBy'] },
  sub_staff_hygiene_inspection: { source: 'verifiedBy', drop: ['verifiedBy'] },
  sub_daily_equipment_checklist: { source: 'checkedBy', drop: ['checkedBy', 'deviations', 'verifiedBy'] },
  sub_glass_plastic_equipment_inspection: { source: 'inspectorInitials', drop: ['inspectorInitials', 'verifiedBy'] },
  sub_utensil_issue_record: { source: 'checkedBy', drop: ['correctiveActionComment', 'checkedBy', 'verifiedBy'] },
  sub_safety_glass_register: { source: 'verifiedBy', drop: ['verifiedBy'] },
  sub_goggles_register: { source: 'verifiedBy', drop: ['verifiedBy'] },
  sub_knife_register: { source: 'verifiedBy', drop: ['verifiedBy'] },
  sub_factory_maintenance_inspection: { source: 'checkedBy', drop: ['checkedBy', 'verifiedBy'] },
  sub_equipment_checklist_roof: { source: 'checkedBy', drop: ['checkedBy', 'verifiedBy'] },
  sub_supplier_questionnaire: { source: 'completedByName', drop: ['completedByName', 'completedByPosition', 'completedByPhone', 'completedByDate', 'sqaApprovalName', 'sqaApprovalPosition', 'sqaApprovalDate', 'provisionalApproval'] },
  sub_emergency_evacuation_attendance_register: { source: 'safetyOfficer', drop: ['notesComments', 'safetyOfficer', 'management'] },
  // completedBy already exists here with the right name/type - no add, no copy, just drop the extras.
  sub_handling_of_emergencies_and_incidences: { source: null, drop: ['completedDate', 'verifiedBy', 'verifiedDate'] },
};

const dryRun = process.argv.includes('--dry-run');

(async () => {
  const statements = [];
  for (const [table, cfg] of Object.entries(TABLES)) {
    if (table !== 'sub_handling_of_emergencies_and_incidences') {
      statements.push({ phase: 1, sql: `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "completedBy" TEXT` });
    }
    if (cfg.source) {
      statements.push({ phase: 2, sql: `UPDATE "${table}" SET "completedBy" = "${cfg.source}" WHERE "${cfg.source}" IS NOT NULL AND "completedBy" IS NULL` });
    }
    for (const col of cfg.drop) {
      statements.push({ phase: 3, sql: `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${col}"` });
    }
  }
  statements.sort((a, b) => a.phase - b.phase);

  if (dryRun) {
    statements.forEach((s) => console.log(s.sql + ';'));
    console.log(`\n-- ${statements.length} statements (dry run, nothing executed)`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const s of statements) {
      await tx.$executeRawUnsafe(s.sql);
    }
  }, { timeout: 300000, maxWait: 15000 });
  console.log(`Applied ${statements.length} statements.`);
})()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
