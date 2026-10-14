-- Central photo table for every image-enabled record (replaces sub_dry_monitoring_images).
-- submission_id is the entry's TEXT id ("entry_..."); no FK, because the sub_* tables are rebuilt
-- on every save. The old table is copied across and LEFT IN PLACE: drop it by hand once the
-- archive agent has run against submission_images (see MD/central-image-archive-instructions.md).
-- Safe to re-run.
CREATE TABLE IF NOT EXISTS "submission_images" (
  "id"               SERIAL PRIMARY KEY,
  "record_key"       TEXT        NOT NULL,
  "record_no"        TEXT        NOT NULL,
  "submission_id"    TEXT        NOT NULL,
  "job_no"           TEXT,
  "field_key"        TEXT        NOT NULL,
  "field_label"      TEXT,
  "image_data"       TEXT,
  "file_name"        TEXT,
  "file_size_bytes"  INTEGER,
  "mime_type"        TEXT,
  "caption"          TEXT,
  "uploaded_by"      TEXT,
  "uploaded_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "sort_order"       INTEGER     NOT NULL DEFAULT 0,
  "archived_locally" BOOLEAN     NOT NULL DEFAULT FALSE,
  "archived_at"      TIMESTAMPTZ,
  "archived_path"    TEXT,
  "archive_attempts" INTEGER     NOT NULL DEFAULT 0,
  "archive_failed"   BOOLEAN     NOT NULL DEFAULT FALSE,
  "legacy_id"        INTEGER
);
-- image_data is nullable on purpose: the monthly purge nulls it once the file is archived locally.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_si_legacy"   ON "submission_images"("record_key", "legacy_id") WHERE "legacy_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_si_record"      ON "submission_images"("record_key", "submission_id");
CREATE INDEX IF NOT EXISTS "idx_si_field"       ON "submission_images"("record_key", "submission_id", "field_key");
CREATE INDEX IF NOT EXISTS "idx_si_job"         ON "submission_images"("job_no");
CREATE INDEX IF NOT EXISTS "idx_si_uploaded_at" ON "submission_images"("uploaded_at");
CREATE INDEX IF NOT EXISTS "idx_si_pending"     ON "submission_images"("uploaded_at")
  WHERE "archived_locally" = FALSE AND "archive_failed" = FALSE;

-- Copy existing dry-monitoring photos (idempotent via legacy_id). Job number comes from the
-- entry's sub_dry_monitoring row when it exists; the API fills any gap lazily.
INSERT INTO "submission_images" (
  "record_key", "record_no", "submission_id", "job_no", "field_key", "field_label",
  "image_data", "file_name", "file_size_bytes", "mime_type", "caption", "uploaded_by",
  "uploaded_at", "sort_order", "archived_locally", "archived_at", "archived_path",
  "archive_attempts", "archive_failed", "legacy_id")
SELECT 'dry-monitoring', '742', i."submission_id", s."jobNo", i."field_key", i."field_key",
  i."image_data", i."file_name", i."file_size_bytes", i."mime_type", i."caption", i."uploaded_by",
  i."uploaded_at", i."sort_order", i."archived_locally", i."archived_at", i."archived_path",
  i."archive_attempts", i."archive_failed", i."id"
FROM "sub_dry_monitoring_images" i
LEFT JOIN "sub_dry_monitoring" s ON s."id" = i."submission_id"
ON CONFLICT DO NOTHING;
