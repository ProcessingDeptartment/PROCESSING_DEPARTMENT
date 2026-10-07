-- NC log: severity is retired in favour of the question "Raise a CAR?".
-- car_required: NULL = not answered (rows raised before this change), TRUE = a CAR must be raised and referenced
-- before the NC can be closed, FALSE = no CAR. severity stays on old rows and is no longer read or written.
-- Safe to re-run.
ALTER TABLE "nc_log" ADD COLUMN IF NOT EXISTS "car_required" BOOLEAN;
ALTER TABLE "nc_log" ADD COLUMN IF NOT EXISTS "car_ref" TEXT;
