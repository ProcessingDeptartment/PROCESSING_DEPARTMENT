# Harvest Farm & Intake Date — Read-Only on All Downstream Records

**Date:** 2026-10-27

---

## Rule

`harvestFarm` and `intakeDate` must be **read-only** on every record that autofills them from `abalone-receiving`. These values come from the abalone receiving record and must not be editable downstream.

---

## Static JSON files already updated

The following `public/data/record-defs/` files have been patched (both fields set to `readOnly: true`, `required` removed where present):

| File | Fields fixed |
|------|-------------|
| `basket-removal-shucking-gutting.json` | `intakeDate` |
| `cans-produced.json` | `intakeDate` |
| `dried-abalone-transfer.json` | `intakeDate` |
| `dry-cooking.json` | `harvestFarm`, `intakeDate` |
| `grading-production-log-cultivated.json` | `intakeDate` |
| `grading-production-log-ranched.json` | `intakeDate` |
| `salting-and-tumbling.json` | `intakeDate`, `harvestFarm` |
| `salting-oosw.json` | `intakeDate`, `harvestFarm` |

Commit and push these files — Render will auto-deploy within ~30 seconds.

---

## DB changes required (Neon console)

Run the following in `console.neon.tech` to keep the DB in sync with the static JSON.

### 1 — Make harvestFarm and intakeDate read-only in all affected records

```sql
-- Set readOnly = true for harvestFarm and intakeDate
-- in every record that has an autofill rule from abalone-receiving
UPDATE "RecordFieldDef" rfd
SET "readOnly" = true
WHERE rfd.key IN ('harvestFarm', 'intakeDate')
AND EXISTS (
  SELECT 1 FROM "RecordAutofillDef" rad
  WHERE rad."recordKey" = rfd."recordKey"
  AND rad."sourceRecordKey" = 'abalone-receiving'
);
```

### 2 — Remove required from these fields (they can't be manually filled)

```sql
UPDATE "RecordFieldDef"
SET required = false
WHERE key IN ('harvestFarm', 'intakeDate')
AND "readOnly" = true
AND EXISTS (
  SELECT 1 FROM "RecordAutofillDef" rad
  WHERE rad."recordKey" = "RecordFieldDef"."recordKey"
  AND rad."sourceRecordKey" = 'abalone-receiving'
);
```

### 3 — Verify the result

```sql
SELECT rfd."recordKey", rfd.key, rfd."readOnly", rfd.required
FROM "RecordFieldDef" rfd
WHERE rfd.key IN ('harvestFarm', 'intakeDate')
AND EXISTS (
  SELECT 1 FROM "RecordAutofillDef" rad
  WHERE rad."recordKey" = rfd."recordKey"
  AND rad."sourceRecordKey" = 'abalone-receiving'
)
ORDER BY rfd."recordKey", rfd.key;
```

Expected: all rows show `readOnly = true`, `required = false`.

---

## Re-export static JSON (after DB changes)

```bash
node scripts/export-record-defs.mjs
git add public/data/record-defs/
git commit -m "harvestFarm + intakeDate read-only on all records autofilled from abalone-receiving"
git push
```

---

## Future records

Any new record that autofills `harvestFarm` or `intakeDate` from `abalone-receiving` must declare those fields with `"readOnly": true` in the record definition from the start.

---

## Why required is removed

When a field is `readOnly`, the user cannot type into it. Marking it `required` would block form submission if the autofill didn't fire (e.g. jobNo not yet picked). Instead, the autofill itself ensures the value is populated when a valid job is selected.
