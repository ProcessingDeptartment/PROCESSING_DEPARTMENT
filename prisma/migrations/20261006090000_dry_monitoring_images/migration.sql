-- REC 7.4.2 Dry Monitoring: photos on problem answers (spec: rec-7.4.2 image upload, stage 1).
-- Images live in their own table, base64 data URIs, one row per photo.
-- submission_id is the entry's TEXT id ("entry_..."). There is deliberately NO foreign key to
-- sub_dry_monitoring: that table is wiped and re-inserted on every save (src/submission-store.js),
-- so ON DELETE CASCADE would delete every photo each time anyone saved. Photos are removed
-- explicitly instead. Also sets extraJson.imageUploadFields on the dry-monitoring definition.
-- Safe to re-run.
CREATE TABLE IF NOT EXISTS "sub_dry_monitoring_images" (
  "id"              SERIAL PRIMARY KEY,
  "submission_id"   TEXT        NOT NULL,
  "field_key"       TEXT        NOT NULL,
  "image_data"      TEXT        NOT NULL,
  "file_name"       TEXT,
  "file_size_bytes" INTEGER,
  "mime_type"       TEXT,
  "caption"         TEXT,
  "uploaded_by"     TEXT,
  "uploaded_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "sort_order"      INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "idx_sdmi_submission" ON "sub_dry_monitoring_images"("submission_id");
CREATE INDEX IF NOT EXISTS "idx_sdmi_field"      ON "sub_dry_monitoring_images"("submission_id", "field_key");

UPDATE "RecordDefinition"
   SET "extraJson" = COALESCE("extraJson", '{}'::jsonb) || '{"imageUploadFields": true}'::jsonb,
       "version"   = "version" + 1
 WHERE "recordKey" = 'dry-monitoring'
   AND NOT COALESCE(("extraJson" ->> 'imageUploadFields')::boolean, false);
