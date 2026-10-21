-- Migration: nc_auto_close
-- Adds ready_to_close status support to nc_log:
--   status gains a new value 'ready_to_close' (still a TEXT column, no enum change needed)
--   ready_to_close_at        TIMESTAMPTZ  — when the system detected resolution
--   ready_to_close_notes     TEXT         — system note on detection
--   resolution_check_submitted_id TEXT   — submission_id of the entry that triggered ready_to_close
--   resolution_trigger_field TEXT        — which field's change indicated resolution (e.g. 'batchStatus')

ALTER TABLE "nc_log"
  ADD COLUMN IF NOT EXISTS "ready_to_close_at"              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "ready_to_close_notes"           TEXT,
  ADD COLUMN IF NOT EXISTS "resolution_check_submitted_id"  TEXT,
  ADD COLUMN IF NOT EXISTS "resolution_trigger_field"       TEXT;

-- Backfill: existing rows with a closed_at should already be 'closed'; anything else stays 'open' or 'in_progress'.
-- (status column already exists from the prior migration; this is a no-op on well-migrated DBs)
UPDATE "nc_log" SET "status" = 'closed'    WHERE "closed_at" IS NOT NULL AND "status" <> 'closed';
UPDATE "nc_log" SET "status" = 'open'      WHERE "closed_at" IS NULL     AND "status" NOT IN ('open','in_progress','ready_to_close');
