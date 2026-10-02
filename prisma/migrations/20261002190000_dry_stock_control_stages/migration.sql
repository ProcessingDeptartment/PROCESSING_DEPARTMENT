-- REC 7.4.6 Dry Stock Control: progressive submission, one immutable stage row per submit
-- (spec: claude/rec-7.4.6-dry-stock-control-merge-job-info-instructions.md sections 4-6).
--   1. per-stage columns (all server-set, see src/dry-stock-guard.js): stage_no, previous_submission_id,
--      completion_status, signoff_required, submitted_by, submitted_at, is_latest, fields_filled,
--      financeRep, financeRepDate
--   2. audit snapshot of where each autofilled value came from + whether it was typed manually
--   3. unique (jobNo, stage_no), indexes on (jobNo, is_latest) and completion_status
--   4. views: v_dry_stock_control_current, v_dry_stock_balance, v_dry_stock_control_open, v_dry_stock_unsigned
-- Nothing is dropped (Month, Intake date and the job-level copies stay as columns). Safe to re-run.
ALTER TABLE "sub_dry_stock_control"
  ADD COLUMN IF NOT EXISTS "stage_no"                    INTEGER,
  ADD COLUMN IF NOT EXISTS "previous_submission_id"      TEXT,
  ADD COLUMN IF NOT EXISTS "completion_status"           TEXT,
  ADD COLUMN IF NOT EXISTS "signoff_required"            BOOLEAN,
  ADD COLUMN IF NOT EXISTS "submitted_by"                TEXT,
  ADD COLUMN IF NOT EXISTS "submitted_at"                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "is_latest"                   BOOLEAN,
  ADD COLUMN IF NOT EXISTS "fields_filled"               INTEGER,
  ADD COLUMN IF NOT EXISTS "financeRep"                  TEXT,
  ADD COLUMN IF NOT EXISTS "financeRepDate"              DATE,
  ADD COLUMN IF NOT EXISTS "wholeWeightSourceIds"        TEXT,
  ADD COLUMN IF NOT EXISTS "wholeWeightTypedManually"    BOOLEAN,
  ADD COLUMN IF NOT EXISTS "cookingDateSourceIds"        TEXT,
  ADD COLUMN IF NOT EXISTS "cookingDateTypedManually"    BOOLEAN,
  ADD COLUMN IF NOT EXISTS "trolleysSourceSubmissionId"  TEXT,
  ADD COLUMN IF NOT EXISTS "trolleysTypedManually"       BOOLEAN,
  ADD COLUMN IF NOT EXISTS "cookedWeightSourceIds"       TEXT,
  ADD COLUMN IF NOT EXISTS "weightInTypedManually"       BOOLEAN,
  ADD COLUMN IF NOT EXISTS "weightOutSourceIds"          TEXT,
  ADD COLUMN IF NOT EXISTS "weightOutTypedManually"      BOOLEAN;

CREATE UNIQUE INDEX IF NOT EXISTS "sub_dry_stock_control_jobNo_stage_no_key" ON "sub_dry_stock_control"("jobNo", "stage_no");
CREATE INDEX IF NOT EXISTS "sub_dry_stock_control_jobNo_is_latest_idx" ON "sub_dry_stock_control"("jobNo", "is_latest");
CREATE INDEX IF NOT EXISTS "sub_dry_stock_control_completion_status_idx" ON "sub_dry_stock_control"("completion_status");

-- Latest submitted stage per job, with its status.
CREATE OR REPLACE VIEW "v_dry_stock_control_current" AS
SELECT s.*
FROM "sub_dry_stock_control" s
WHERE s."is_latest" IS TRUE AND COALESCE(s."status", 'submitted') <> 'draft';

-- Weight in vs weight out per job (latest stage), with the latest finance representative.
CREATE OR REPLACE VIEW "v_dry_stock_balance" AS
SELECT c."jobNo" AS job_no,
       c."weightIn" AS weight_in,
       c."weightOut" AS weight_out,
       c."weightIn" - c."weightOut" AS difference,
       CASE WHEN c."weightIn" > 0 THEN ROUND((((c."weightIn" - c."weightOut") / c."weightIn") * 100)::numeric, 2) END AS difference_pct,
       c."completion_status" AS status,
       c."financeRep" AS latest_finance_rep,
       c."financeRepDate" AS latest_finance_rep_date,
       (CURRENT_DATE - (SELECT MIN(f."submitted_at")::date FROM "sub_dry_stock_control" f
                        WHERE f."jobNo" = c."jobNo" AND COALESCE(f."status", 'submitted') <> 'draft')) AS days_since_first_stage
FROM "v_dry_stock_control_current" c;

-- Jobs that are not Complete yet, and how long they have been waiting since the last submitted stage.
CREATE OR REPLACE VIEW "v_dry_stock_control_open" AS
SELECT c."jobNo" AS job_no, c."stage_no", c."completion_status" AS status, c."fields_filled",
       c."submitted_by", c."submitted_at",
       (CURRENT_DATE - c."submitted_at"::date) AS days_waiting
FROM "v_dry_stock_control_current" c
WHERE COALESCE(c."completion_status", 'in_progress') <> 'complete';

-- Stages where the sign-off rule applied but a sign-off is empty: catches old or imported data. Old rows from before
-- finance sign-off existed appear here by design; it never blocks anything.
CREATE OR REPLACE VIEW "v_dry_stock_unsigned" AS
SELECT s."id", s."jobNo" AS job_no, s."stage_no", s."signoff_required", s."completedBy", s."financeRep", s."submitted_by", s."submitted_at"
FROM "sub_dry_stock_control" s
WHERE COALESCE(s."status", 'submitted') <> 'draft'
  AND s."signoff_required" IS TRUE
  AND (s."completedBy" IS NULL OR s."financeRep" IS NULL);
