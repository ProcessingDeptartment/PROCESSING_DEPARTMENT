-- Append-only audit trail for KeyValue (2026-09-25): before/after of every write and delete.
-- Purely additive: one new table.

-- CreateTable
CREATE TABLE "KeyValueHistory" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "actor" TEXT,
    "role" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyValueHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeyValueHistory_key_at_idx" ON "KeyValueHistory"("key", "at");

-- Make the trail append-only at the database level: no UPDATE or DELETE on history rows.
CREATE FUNCTION keyvalue_history_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'KeyValueHistory is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER keyvalue_history_no_change
  BEFORE UPDATE OR DELETE ON "KeyValueHistory"
  FOR EACH ROW EXECUTE FUNCTION keyvalue_history_immutable();
