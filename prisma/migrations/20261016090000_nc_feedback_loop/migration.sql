-- NC <-> record update feedback loop. Safe to re-run.
ALTER TABLE "nc_log" ADD COLUMN IF NOT EXISTS "last_record_update_at" TIMESTAMPTZ(6);
ALTER TABLE "nc_log" ADD COLUMN IF NOT EXISTS "last_record_update_by" TEXT;
CREATE TABLE IF NOT EXISTS "nc_audit" (
  "id" SERIAL PRIMARY KEY,
  "nc_id" INTEGER NOT NULL REFERENCES "nc_log"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_nc_audit_nc_id" ON "nc_audit" ("nc_id");
