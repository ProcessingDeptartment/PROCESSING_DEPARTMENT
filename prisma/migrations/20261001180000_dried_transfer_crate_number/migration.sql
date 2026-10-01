-- REC 7.4.10 Dried Abalone Transfer: the crate number is automatic, running 1,2,3 per job.
--   1. crateNumber Float -> INT; new row columns: jobNo (job copy so the DB can enforce uniqueness), crateNoOld
--      (what was typed before this change), voided / voidReason / voidedBy / voidedAt (a voided crate keeps its number)
--   2. existing submitted crates: crateNoOld = the typed number (all jobs); jobNo copied for CLEAN jobs only
--      (whole numbers, no duplicates inside the job). Jobs that are not clean are left untouched and are listed in
--      v_dry_transfer_crate_review for a decision -- nothing is guessed, renumbered or merged.
--      The same two values are written into the stored JSON blob, because the submission tables are rebuilt from it
--      on every save.
--   3. UNIQUE (jobNo, crateNumber): drafts and unclean old rows carry no jobNo, so they are outside the rule
--   4. views: dried_transfer_crate (one row per crate), v_dry_transfer_crates_by_job, v_dry_transfer_crate_review
ALTER TABLE "sub_dried_abalone_transfer_row"
  ALTER COLUMN "crateNumber" TYPE INTEGER USING round("crateNumber")::integer,
  ADD COLUMN IF NOT EXISTS "jobNo"      TEXT,
  ADD COLUMN IF NOT EXISTS "crateNoOld" TEXT,
  ADD COLUMN IF NOT EXISTS "voided"     BOOLEAN,
  ADD COLUMN IF NOT EXISTS "voidReason" TEXT,
  ADD COLUMN IF NOT EXISTS "voidedBy"   TEXT,
  ADD COLUMN IF NOT EXISTS "voidedAt"   TIMESTAMP(3);

-- Clean jobs: every submitted crate has a whole number > 0 and no number is repeated inside the job.
-- (round() above could have turned 2.5 into 3, so check against the JSON blob's typed text too.)
CREATE TEMP TABLE _crate_clean_jobs AS
SELECT p."jobNo"
FROM "sub_dried_abalone_transfer" p
JOIN "sub_dried_abalone_transfer_row" r ON r."parentId" = p."id"
WHERE COALESCE(p."status", 'submitted') <> 'draft' AND p."jobNo" IS NOT NULL
GROUP BY p."jobNo"
HAVING bool_and(COALESCE(r."crateNumber" > 0, false)) AND count(*) = count(DISTINCT r."crateNumber");

UPDATE "sub_dried_abalone_transfer_row" r
SET "crateNoOld" = COALESCE(r."crateNoOld", r."crateNumber"::text)
FROM "sub_dried_abalone_transfer" p
WHERE p."id" = r."parentId" AND COALESCE(p."status", 'submitted') <> 'draft';

UPDATE "sub_dried_abalone_transfer_row" r
SET "jobNo" = p."jobNo"
FROM "sub_dried_abalone_transfer" p
WHERE p."id" = r."parentId" AND COALESCE(p."status", 'submitted') <> 'draft'
  AND p."jobNo" IN (SELECT "jobNo" FROM _crate_clean_jobs);

-- Same two values into the stored JSON (submitted entries only; the entry keeps every other key untouched).
UPDATE "KeyValue" k
SET "value" = (
  SELECT COALESCE(jsonb_agg(
    CASE WHEN e.elem->>'status' = 'submitted' AND jsonb_typeof(e.elem->'roster') = 'array' THEN
      jsonb_set(e.elem, '{roster}', (
        SELECT COALESCE(jsonb_agg(
          r.row
          || jsonb_build_object('crateNoOld', COALESCE(r.row->>'crateNoOld', r.row->>'crateNumber', ''))
          || CASE WHEN (e.elem->'values'->>'jobNo') IN (SELECT "jobNo" FROM _crate_clean_jobs)
                  THEN jsonb_build_object('jobNo', e.elem->'values'->>'jobNo') ELSE '{}'::jsonb END
        ORDER BY r.ord), '[]'::jsonb)
        FROM jsonb_array_elements(e.elem->'roster') WITH ORDINALITY AS r(row, ord)))
    ELSE e.elem END
  ORDER BY e.ord), '[]'::jsonb)::text
  FROM jsonb_array_elements(k."value"::jsonb) WITH ORDINALITY AS e(elem, ord)
)
WHERE k."key" = 'formrecord:dried-abalone-transfer';

CREATE UNIQUE INDEX IF NOT EXISTS "sub_dried_abalone_transfer_row_job_crate_uq"
  ON "sub_dried_abalone_transfer_row"("jobNo", "crateNumber");
CREATE INDEX IF NOT EXISTS "sub_dried_abalone_transfer_row_jobNo_idx" ON "sub_dried_abalone_transfer_row"("jobNo");

-- One row per crate.
CREATE OR REPLACE VIEW "dried_transfer_crate" AS
SELECT r."id", r."parentId" AS entry_id, r."parentId" AS submission_id,
       COALESCE(r."jobNo", p."jobNo") AS job_no,
       r."position" + 1 AS row_no, r."crateNumber" AS crate_no, r."crateNoOld" AS crate_no_old,
       r."weight" AS weight_kg,
       COALESCE(r."voided", false) AS voided, r."voidReason" AS void_reason, r."voidedBy" AS voided_by, r."voidedAt" AS voided_at,
       p."actualDriedDate" AS transfer_date, p."status", p."submittedAt" AS submitted_at, p."createdAt" AS created_at
FROM "sub_dried_abalone_transfer_row" r JOIN "sub_dried_abalone_transfer" p ON p."id" = r."parentId";

-- Per job: crates, weight, transfers. Submitted entries, voided crates left out.
CREATE OR REPLACE VIEW "v_dry_transfer_crates_by_job" AS
SELECT job_no,
       count(*) AS crate_count,
       sum(weight_kg) AS total_weight_kg,
       round(avg(weight_kg)::numeric, 2) AS avg_crate_weight_kg,
       min(transfer_date) AS first_transfer_date,
       max(transfer_date) AS last_transfer_date,
       count(DISTINCT entry_id) AS transfer_count,
       min(crate_no) AS first_crate_no, max(crate_no) AS last_crate_no
FROM "dried_transfer_crate"
WHERE COALESCE(status, 'submitted') <> 'draft' AND NOT voided AND job_no IS NOT NULL
GROUP BY job_no;
COMMENT ON VIEW "v_dry_transfer_crates_by_job" IS
  'totalDriedWeight of a transfer entry is the sum of weight_kg over its non-voided crates; REC 7.4.6 and REC 7.4.3 keep reading the stored totalDriedWeight (sub_dried_abalone_transfer) unchanged. This view is for trends only.';

-- Submitted crates of jobs that were NOT clean at migration time (duplicates, text, blanks): need a decision.
CREATE OR REPLACE VIEW "v_dry_transfer_crate_review" AS
SELECT p."jobNo" AS job_no, p."id" AS submission_id, r."position" + 1 AS row_no, r."crateNoOld" AS typed_crate_no,
       r."crateNumber" AS crate_no, r."weight" AS weight_kg
FROM "sub_dried_abalone_transfer_row" r JOIN "sub_dried_abalone_transfer" p ON p."id" = r."parentId"
WHERE COALESCE(p."status", 'submitted') <> 'draft' AND r."jobNo" IS NULL;

DROP TABLE _crate_clean_jobs;
