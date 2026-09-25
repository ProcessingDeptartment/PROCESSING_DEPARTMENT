-- One name for the job number. Every sub_* table now calls its job-number column "jobNo" (the
-- name REC 7.1.2 and job_info use), so any record joins the same way:
--   JOIN job_info j ON j."jobNo" = s."jobNo"
-- Only the DB column changes. Form field keys (jobNumber on these records), autofill and the saved
-- JSON (rawJson / KeyValue) keep the form name; src/submission-store.js maps it via src/job-snapshot.js.
-- Safe to run more than once (e.g. by hand in the Neon SQL Editor, then again by the Render build).

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sub_dry_export_pack_front_page',
    'sub_dry_nrcs_packs',
    'sub_qc_report',
    'sub_precooking_check_sheet',
    'sub_cans_produced',
    'sub_retorting_control_sheet',
    'sub_brine_mixing_report',
    'sub_dry_cooking',
    'sub_drying_process',
    'sub_dried_abalone_transfer',
    'sub_dry_monitoring',
    'sub_grading_production_log_cultivated',
    'sub_grading_production_log_ranched',
    'sub_live_production_pack',
    'sub_dispatch_receiving_checklist']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'jobNumber')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'jobNo') THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', t, 'jobNumber', 'jobNo');
    END IF;
    IF to_regclass(format('public.%I', t || '_jobNumber_idx')) IS NOT NULL THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', t || '_jobNumber_idx', t || '_jobNo_idx');
    END IF;
  END LOOP;
END $$;
