-- Non-Conformance Log (spec: Claude outputs/nc-log-page-instructions.md).
-- nc_ref (NC-YYYY-NNNN) is allocated by src/nc-log.js from nc_ref_seq; no trigger needed.
-- Safe to re-run.
CREATE SEQUENCE IF NOT EXISTS "nc_ref_seq" START 1;

CREATE TABLE IF NOT EXISTS "nc_log" (
  "id"                SERIAL PRIMARY KEY,
  "nc_ref"            TEXT        NOT NULL UNIQUE,
  "raised_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "job_number"        TEXT,
  "record_ref"        TEXT,
  "submission_id"     TEXT,
  "raised_by"         TEXT        NOT NULL,
  "category"          TEXT        NOT NULL,
  "description"       TEXT        NOT NULL,
  "severity"          TEXT        NOT NULL DEFAULT 'minor',
  "status"            TEXT        NOT NULL DEFAULT 'open',
  "corrective_action" TEXT,
  "closed_by"         TEXT,
  "closed_at"         TIMESTAMPTZ,
  "notes"             TEXT,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_nc_status"    ON "nc_log" ("status");
CREATE INDEX IF NOT EXISTS "idx_nc_job"       ON "nc_log" ("job_number");
CREATE INDEX IF NOT EXISTS "idx_nc_raised_at" ON "nc_log" ("raised_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_nc_record"    ON "nc_log" ("record_ref");
