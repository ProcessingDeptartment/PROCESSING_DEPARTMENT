-- Exact entry order for the per-record submission tables. The saved list is an ordered array and some server rules
-- and pages depend on that order, but the sub_* tables had no way to keep it (createdAt is not enough: an
-- imported or back-dated entry can sit out of creation order). position = the entry's index in the list.
-- Added to every parent sub_* table (those carrying rawJson, not the _row children). Additive and safe to re-run.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name LIKE 'sub\_%' AND c.table_name NOT LIKE '%\_row' AND c.column_name = 'rawJson'
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "position" integer', t);
  END LOOP;
END $$;
