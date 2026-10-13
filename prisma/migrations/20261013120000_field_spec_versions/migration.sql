-- Version history for field specs (matches the old SpecRegistry: every change has a reason, who and their title,
-- earlier versions are kept and marked OBSOLETE). The live row in field_specs is always the newest version.
-- Safe to re-run.
ALTER TABLE "field_specs" ADD COLUMN IF NOT EXISTS "version_number" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "field_spec_versions" (
  "id"               SERIAL PRIMARY KEY,
  "spec_id"          INTEGER     NOT NULL,
  "record_key"       TEXT        NOT NULL,
  "field_key"        TEXT        NOT NULL,
  "version_number"   INTEGER     NOT NULL,
  "status"           TEXT        NOT NULL DEFAULT 'PUBLISHED',
  "snapshot"         JSONB       NOT NULL,
  "change_reason"    TEXT        NOT NULL,
  "published_by"     TEXT        NOT NULL,
  "changed_by_title" TEXT        NOT NULL,
  "published_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "field_spec_versions_status_chk" CHECK ("status" IN ('PUBLISHED','OBSOLETE'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "field_spec_versions_spec_id_version_number_key" ON "field_spec_versions" ("spec_id", "version_number");
CREATE INDEX IF NOT EXISTS "idx_fspec_versions_record" ON "field_spec_versions" ("record_key", "field_key");
