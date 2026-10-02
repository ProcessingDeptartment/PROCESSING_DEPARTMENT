-- REC 7.4.6 Dry Stock Control: backfill + dry run for the progressive-stage columns.
-- Run AFTER prisma/migrations/20261002190000_dry_stock_control_stages has been applied (prisma migrate deploy).
-- BACKUP FIRST: node scripts/backup.js   (or a Neon branch / point-in-time restore point).
-- Plain SQL, safe to re-run: it only fills the NEW columns, and only on rows where stage_no is still NULL.
-- Old rows get NO finance sign-off (financeRep stays NULL, shown as "Not recorded (before finance sign-off was
-- added)"); signoff_required is set by the rule for information only and never blocks anything.
--
-- NOTE: the table is also re-projected from the stored record on every save (src/submission-store.js numbers old
-- submissions the same way), so this script only matters for the period before the first save after deploy.

-- 1. DRY RUN (read-only): what would change.
SELECT 'rows' AS what, COUNT(*) AS n FROM "sub_dry_stock_control"
UNION ALL SELECT 'submitted rows without stage_no (will become stages)', COUNT(*) FROM "sub_dry_stock_control"
  WHERE COALESCE("status", 'submitted') <> 'draft' AND "stage_no" IS NULL
UNION ALL SELECT 'jobs with more than one submission', COUNT(*) FROM (
  SELECT "jobNo" FROM "sub_dry_stock_control" WHERE COALESCE("status", 'submitted') <> 'draft' AND "stage_no" IS NULL
  GROUP BY "jobNo" HAVING COUNT(*) > 1) j;

-- Jobs where the numbering may be wrong: two submissions on the same day (their order is a guess).
SELECT "jobNo", COUNT(*) AS submissions, COALESCE("submittedAt", "createdAt")::date AS day
FROM "sub_dry_stock_control"
WHERE COALESCE("status", 'submitted') <> 'draft' AND "stage_no" IS NULL
GROUP BY "jobNo", COALESCE("submittedAt", "createdAt")::date HAVING COUNT(*) > 1;

-- 2. BACKFILL (one transaction)
BEGIN;
WITH ranked AS (
  SELECT "id", "jobNo",
         ROW_NUMBER() OVER (PARTITION BY "jobNo" ORDER BY COALESCE("submittedAt", "createdAt"), "id") AS rn,
         LAG("id") OVER (PARTITION BY "jobNo" ORDER BY COALESCE("submittedAt", "createdAt"), "id") AS prev_id,
         COUNT(*) OVER (PARTITION BY "jobNo") AS total
  FROM "sub_dry_stock_control"
  WHERE COALESCE("status", 'submitted') <> 'draft' AND "stage_no" IS NULL AND "jobNo" IS NOT NULL
)
UPDATE "sub_dry_stock_control" s SET
  "stage_no" = r.rn,
  "previous_submission_id" = r.prev_id,
  "is_latest" = (r.rn = r.total),
  "submitted_at" = COALESCE(s."submittedAt", s."createdAt"),
  "fields_filled" = (CASE WHEN s."weightIn" IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN s."dateIn" IS NOT NULL THEN 1 ELSE 0 END
    + CASE WHEN s."countInFactory" IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN s."countInFinance" IS NOT NULL THEN 1 ELSE 0 END
    + CASE WHEN s."weightOut" IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN s."dateOut" IS NOT NULL THEN 1 ELSE 0 END
    + CASE WHEN s."countOutFactory" IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN s."countOutFinance" IS NOT NULL THEN 1 ELSE 0 END),
  "signoff_required" = (s."weightIn" IS NOT NULL OR s."countInFactory" IS NOT NULL OR s."countInFinance" IS NOT NULL
                        OR s."weightOut" IS NOT NULL OR s."countOutFactory" IS NOT NULL OR s."countOutFinance" IS NOT NULL)
FROM ranked r WHERE s."id" = r."id";

UPDATE "sub_dry_stock_control" SET "completion_status" =
  CASE WHEN "fields_filled" = 8 THEN 'complete' ELSE 'in_progress' END
WHERE "stage_no" IS NOT NULL AND "completion_status" IS NULL;
COMMIT;

-- 3. AFTER: counts must match the dry run; no old value was touched (only the new columns were written).
SELECT 'stages' AS what, COUNT(*) AS n FROM "sub_dry_stock_control" WHERE "stage_no" IS NOT NULL
UNION ALL SELECT 'latest', COUNT(*) FROM "sub_dry_stock_control" WHERE "is_latest" IS TRUE
UNION ALL SELECT 'flagged by v_dry_stock_unsigned (expected: old rows)', COUNT(*) FROM "v_dry_stock_unsigned";

-- Check query from the spec:
SELECT "jobNo", "stage_no", "completion_status", "signoff_required", "completedBy", "financeRep", "submitted_by"
FROM "sub_dry_stock_control" ORDER BY "jobNo", "stage_no";
