-- Migration: Create v_dry_job_weights view
-- Purpose: Job-level weight summary for trends and reporting
-- Date: 2026-10-22
-- Run in Neon SQL Editor (console.neon.tech)
--
-- Table names use Prisma's actual mapped names:
--   sub_dry_cooking        (REC 7.4.0 header rows)
--   sub_dry_cooking_row    (REC 7.4.0 pot-card rows; "process" = 'Blanching'|'Cooking')
--   sub_salting_oosw       (REC 7.1.5 header rows)
--   sub_salting_oosw_row   (REC 7.1.5 roster rows; "weight" = per-size-range kg)
-- All column names are camelCase and require double-quoting in PostgreSQL.

DROP VIEW IF EXISTS v_dry_job_weights;

CREATE VIEW v_dry_job_weights AS
SELECT
  dc."jobNo"                                                                  AS job_no,
  coalesce(oosw."total_oosw_kg", 0)                                          AS oosw_kg,
  coalesce(sum(CASE WHEN r.process = 'Blanching' THEN r."abaloneKg" ELSE 0 END), 0) AS blanched_kg,
  coalesce(sum(CASE WHEN r.process = 'Cooking'   THEN r."abaloneKg" ELSE 0 END), 0) AS cooked_kg,
  coalesce(oosw."total_oosw_kg", 0)
    - coalesce(sum(CASE WHEN r.process = 'Blanching' THEN r."abaloneKg" ELSE 0 END), 0)
                                                                              AS available_to_blanch_kg,
  coalesce(sum(CASE WHEN r.process = 'Blanching' THEN r."abaloneKg" ELSE 0 END), 0)
    - coalesce(sum(CASE WHEN r.process = 'Cooking'   THEN r."abaloneKg" ELSE 0 END), 0)
                                                                              AS available_to_cook_kg,
  max(dc."cookingDate")                                                       AS last_record_date,
  count(DISTINCT dc.id)                                                       AS entry_count
FROM sub_dry_cooking dc
LEFT JOIN sub_dry_cooking_row r
       ON r."parentId" = dc.id
      AND dc.status = 'submitted'
LEFT JOIN (
  SELECT so."jobNo", sum(sr."weight") AS total_oosw_kg
  FROM sub_salting_oosw so
  JOIN sub_salting_oosw_row sr ON sr."parentId" = so.id
  WHERE so.status = 'submitted'
  GROUP BY so."jobNo"
) oosw ON oosw."jobNo" = dc."jobNo"
GROUP BY dc."jobNo", oosw."total_oosw_kg"
HAVING count(dc.id) > 0;

-- Test query:
-- SELECT * FROM v_dry_job_weights WHERE job_no = 'DPR01168';
