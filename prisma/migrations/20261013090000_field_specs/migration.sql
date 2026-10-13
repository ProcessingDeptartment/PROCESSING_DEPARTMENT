-- Field specifications (spec: MD/field-specifications-system-instructions.md).
-- One row per (record_key, field_key): limits, visual feedback, submit gate and auto-NC behaviour.
-- record_key matches RecordDefinition.recordKey (e.g. 'dry-room-temp-humidity-log'); field_key matches a field
-- or roster-column key in that record. Safe to re-run.
CREATE TABLE IF NOT EXISTS "field_specs" (
  "id"                  SERIAL PRIMARY KEY,
  "record_key"          TEXT        NOT NULL,
  "field_key"           TEXT        NOT NULL,
  "spec_min"            NUMERIC,
  "spec_max"            NUMERIC,
  "allowed_values"      TEXT,
  "highlight_red"       BOOLEAN     NOT NULL DEFAULT FALSE,
  "show_warning_bubble" BOOLEAN     NOT NULL DEFAULT FALSE,
  "gate_mode"           TEXT        NOT NULL DEFAULT 'none',
  "auto_nc"             BOOLEAN     NOT NULL DEFAULT FALSE,
  "nc_category"         TEXT,
  "nc_severity"         TEXT        DEFAULT 'minor',
  "nc_optional_skip"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "label_override"      TEXT,
  "notes"               TEXT,
  "active"              BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "field_specs_gate_mode_chk" CHECK ("gate_mode" IN ('none','warn_submit','double_sign','hard_block')),
  CONSTRAINT "field_specs_nc_severity_chk" CHECK ("nc_severity" IN ('minor','major','critical'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "field_specs_record_key_field_key_key" ON "field_specs" ("record_key", "field_key");
CREATE INDEX IF NOT EXISTS "idx_fspecs_record" ON "field_specs" ("record_key");
CREATE INDEX IF NOT EXISTS "idx_fspecs_active" ON "field_specs" ("record_key", "active");

CREATE OR REPLACE FUNCTION trg_fspecs_updated() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_field_specs_updated ON "field_specs";
CREATE TRIGGER trg_field_specs_updated BEFORE UPDATE ON "field_specs"
  FOR EACH ROW EXECUTE FUNCTION trg_fspecs_updated();
