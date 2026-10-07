-- FSMS annual calendar (spec: MD/fsms-calendar-instructions.md). Safe to re-run.
CREATE TABLE IF NOT EXISTS "fsms_year" (
  "id"         SERIAL PRIMARY KEY,
  "year"       INTEGER     NOT NULL UNIQUE,
  "notes"      TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "fsms_category" (
  "id"         SERIAL PRIMARY KEY,
  "name"       TEXT    NOT NULL UNIQUE,
  "color"      TEXT    NOT NULL DEFAULT '#64748b',
  "sort_order" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "fsms_event" (
  "id"           SERIAL PRIMARY KEY,
  "year_id"      INTEGER     NOT NULL REFERENCES "fsms_year"("id") ON DELETE CASCADE,
  "category_id"  INTEGER     NOT NULL REFERENCES "fsms_category"("id"),
  "month"        INTEGER     NOT NULL CHECK ("month" BETWEEN 1 AND 12),
  "title"        TEXT        NOT NULL,
  "notes"        TEXT,
  "status"       TEXT        NOT NULL DEFAULT 'pending',
  "completed_at" TIMESTAMPTZ,
  "completed_by" TEXT,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_fsms_event_year_month" ON "fsms_event" ("year_id", "month");
CREATE INDEX IF NOT EXISTS "idx_fsms_event_year_cat"   ON "fsms_event" ("year_id", "category_id");

INSERT INTO "fsms_category" ("name", "color", "sort_order") VALUES
  ('Audits',                      '#dc2626', 0),
  ('Monthly Testing',             '#2563eb', 1),
  ('Annual Testing/Verification', '#7c3aed', 2),
  ('Calibration',                 '#d97706', 3),
  ('Medicals',                    '#16a34a', 4),
  ('Mock Recalls',                '#0891b2', 5),
  ('GMP',                         '#65a30d', 6),
  ('Training',                    '#9333ea', 7),
  ('Meetings',                    '#475569', 8)
ON CONFLICT ("name") DO NOTHING;
