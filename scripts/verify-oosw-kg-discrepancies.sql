-- Phase 1.2: Verify ooswKg (manual) vs REC 7.1.5 roster total
-- Run in Neon SQL Editor before deciding whether to drop the "ooswKg" column.
--
-- The "ooswKg" column on sub_dry_cooking held the manually-typed OOSW kg
-- entered on REC 7.4.0 before the field was removed (commit 24e262a, 2026-10-21).
-- This query compares each stored value against the authoritative total from
-- sub_salting_oosw_row for the same job.

SELECT
  dc."jobNo"                                             AS job_no,
  dc."ooswKg"                                           AS manual_oosw_kg,
  coalesce(sum(sr."weight"), 0)                         AS roster_oosw_kg,
  abs(dc."ooswKg" - coalesce(sum(sr."weight"), 0))      AS difference
FROM sub_dry_cooking dc
LEFT JOIN sub_salting_oosw so
       ON so."jobNo" = dc."jobNo"
      AND so.status  = 'submitted'
LEFT JOIN sub_salting_oosw_row sr
       ON sr."parentId" = so.id
WHERE dc."ooswKg" IS NOT NULL
  AND dc.status = 'submitted'
GROUP BY dc.id, dc."jobNo", dc."ooswKg"
ORDER BY difference DESC;

-- Interpretation:
--   difference = 0     → values match exactly
--   difference < 0.5%  → within rounding tolerance; safe to drop column
--   difference > 0     → discuss with Michaela before dropping column
--
-- To drop the column once verified (Phase 5.3, 1-2 weeks after go-live):
--
--   Step 1: Remove "ooswKg" from prisma/schema.prisma (Sub_dry_cooking model)
--   Step 2: npx prisma migrate dev --name drop_dry_cooking_oosw_kg_manual
--   Step 3: npx prisma migrate deploy   (on Render)
