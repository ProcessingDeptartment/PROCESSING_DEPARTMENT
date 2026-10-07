-- Migration: 20261007120000_seam_test_run
-- Creates the seam_test_run table to log seam calculator submissions.

CREATE TABLE IF NOT EXISTS "seam_test_run" (
  "id"              SERIAL PRIMARY KEY,
  "recorded_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "operator"        TEXT,
  "job_no"          TEXT,
  "can_size"        TEXT,
  "seamer_no"       TEXT,
  "end_type"        TEXT,  -- 'manufacturer' | 'production'
  "notes"           TEXT,

  -- raw measurements (mm)
  "seam_length"     DOUBLE PRECISION NOT NULL,
  "seam_thickness"  DOUBLE PRECISION NOT NULL,
  "body_hook"       DOUBLE PRECISION NOT NULL,
  "cover_hook"      DOUBLE PRECISION NOT NULL,
  "plate_end"       DOUBLE PRECISION NOT NULL,
  "plate_body"      DOUBLE PRECISION NOT NULL,

  -- computed results
  "overlap"         DOUBLE PRECISION,
  "overlap_pct"     DOUBLE PRECISION,
  "bh_butting"      DOUBLE PRECISION,
  "free_space"      DOUBLE PRECISION,

  -- pass / fail per result
  "pass_overlap"    BOOLEAN,
  "pass_overlap_pct" BOOLEAN,
  "pass_bh_butting" BOOLEAN,
  "pass_free_space" BOOLEAN,

  -- overall pass (all four pass)
  "all_pass"        BOOLEAN
);

CREATE INDEX IF NOT EXISTS "idx_seam_test_run_recorded_at" ON "seam_test_run" ("recorded_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_seam_test_run_job_no"      ON "seam_test_run" ("job_no");
