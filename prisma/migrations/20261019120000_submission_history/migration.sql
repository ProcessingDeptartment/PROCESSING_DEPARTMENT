-- Per-entry audit trail for formrecord:* / monitoring_log:* records (src/submission-history.js).
-- One row per entry added / changed / removed by a save, holding just that entry's JSON before and after,
-- instead of KeyValueHistory's whole-list snapshot. Additive, safe to re-run, and nothing reads it until it exists.
CREATE TABLE IF NOT EXISTS "SubmissionHistory" (
  "id"        SERIAL PRIMARY KEY,
  "key"       TEXT NOT NULL,          -- full storage key, e.g. formrecord:dry-cooking
  "recordKey" TEXT NOT NULL,          -- dry-cooking
  "entryId"   TEXT NOT NULL,
  "action"    TEXT NOT NULL,          -- 'add' | 'change' | 'remove'
  "event"     TEXT NOT NULL,          -- 'set' | 'delete' | 'delete-submission' | 'reverse-movement'
  "before"    TEXT,
  "after"     TEXT,
  "actor"     TEXT,
  "role"      TEXT,
  "at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SubmissionHistory_recordKey_entryId_at_idx" ON "SubmissionHistory" ("recordKey", "entryId", "at");
CREATE INDEX IF NOT EXISTS "SubmissionHistory_key_at_idx" ON "SubmissionHistory" ("key", "at");
