-- REC 7.4.2 photos, stage 2: local archive tracking (scripts/image-archive-agent.mjs).
-- The agent polls pending rows, writes each to the local file server, then marks it archived.
-- After 5 failed attempts archive_failed is set and the row is skipped until an admin resets it.
-- Safe to re-run.
ALTER TABLE "sub_dry_monitoring_images"
  ADD COLUMN IF NOT EXISTS "archived_locally" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "archived_at"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "archived_path"    TEXT,
  ADD COLUMN IF NOT EXISTS "archive_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "archive_failed"   BOOLEAN NOT NULL DEFAULT FALSE;
