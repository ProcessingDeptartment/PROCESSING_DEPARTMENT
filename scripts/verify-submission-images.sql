-- Verify migration 20261014090000_submission_images. Read-only: run each block in the Neon SQL editor.

-- 1. Row counts. old_rows must equal copied_rows, and missing must be 0.
SELECT
  (SELECT COUNT(*) FROM sub_dry_monitoring_images)                                   AS old_rows,
  (SELECT COUNT(*) FROM submission_images WHERE record_key = 'dry-monitoring')       AS copied_rows,
  (SELECT COUNT(*) FROM sub_dry_monitoring_images o
    WHERE NOT EXISTS (SELECT 1 FROM submission_images n
                       WHERE n.record_key = 'dry-monitoring' AND n.legacy_id = o.id)) AS missing;

-- 2. Any old photo that did not copy (should return no rows).
SELECT o.id, o.submission_id, o.field_key, o.uploaded_at
FROM sub_dry_monitoring_images o
WHERE NOT EXISTS (SELECT 1 FROM submission_images n
                   WHERE n.record_key = 'dry-monitoring' AND n.legacy_id = o.id);

-- 3. Copied values match the originals (all four counts should be 0).
SELECT
  COUNT(*) FILTER (WHERE n.submission_id <> o.submission_id)                 AS submission_mismatch,
  COUNT(*) FILTER (WHERE n.field_key <> o.field_key)                         AS field_mismatch,
  COUNT(*) FILTER (WHERE n.image_data IS DISTINCT FROM o.image_data)         AS image_mismatch,
  COUNT(*) FILTER (WHERE n.archived_locally <> o.archived_locally
                      OR n.archived_path IS DISTINCT FROM o.archived_path)   AS archive_state_mismatch
FROM sub_dry_monitoring_images o
JOIN submission_images n ON n.record_key = 'dry-monitoring' AND n.legacy_id = o.id;

-- 4. Job numbers: how many copied photos have one. Rows without a job_no belong to entries that were
--    never saved; the API fills them in the first time the archive agent polls after the entry exists.
SELECT COUNT(*) AS total,
       COUNT(job_no) AS with_job_no,
       COUNT(*) - COUNT(job_no) AS without_job_no
FROM submission_images WHERE record_key = 'dry-monitoring';

-- 5. Photos with no job_no, and whether their entry exists yet (entry_exists = true would be unexpected:
--    the migration should already have filled it).
SELECT n.id, n.submission_id, n.field_key, n.uploaded_at,
       EXISTS (SELECT 1 FROM sub_dry_monitoring s WHERE s.id = n.submission_id) AS entry_exists
FROM submission_images n
WHERE n.record_key = 'dry-monitoring' AND n.job_no IS NULL
ORDER BY n.uploaded_at;

-- 6. Constraints and indexes are in place (expect 7 rows).
SELECT indexname FROM pg_indexes
WHERE tablename = 'submission_images'
ORDER BY indexname;

-- 7. Archive backlog by record, as the Home banner will see it.
SELECT record_key, record_no,
       COUNT(*) FILTER (WHERE archived_locally = FALSE AND archive_failed = FALSE AND image_data IS NOT NULL) AS pending,
       COUNT(*) FILTER (WHERE archive_failed)                                                               AS failed,
       COUNT(*)                                                                                             AS total
FROM submission_images
GROUP BY record_key, record_no;

-- 8. Field labels: migrated rows only carry the field key until the entry's next upload.
--    Lists the distinct keys so labels can be set by hand if wanted.
SELECT field_key, field_label, COUNT(*) AS photos
FROM submission_images
WHERE record_key = 'dry-monitoring' AND field_label = field_key
GROUP BY field_key, field_label
ORDER BY field_key;
