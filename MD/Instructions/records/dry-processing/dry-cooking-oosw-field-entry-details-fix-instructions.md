# Dry Cooking — Remove "Entry details" section + Add OOSW weight to Job info

**Record:** `dry-cooking` (REC 7.4.0)  
**Date:** 2026-10-27

---

## What changed and why

The live form was showing an **"Entry details"** section that shouldn't be there — OOSW weight information belongs under **Job info** as a read-only field pulled from the salting OOSW record.

Two fixes:
1. Remove the "Entry details" section from the DB for `dry-cooking`
2. Add `ooswKg` as a read-only field in the "Job info" section, autofilled from `salting-oosw.totalOoswKg`

The static JSON snapshot has already been updated (see below). The DB must also be updated to stay in sync.

---

## Step 1 — Remove "Entry details" section from the DB

Run in Neon console (`console.neon.tech`):

```sql
-- Find the section first to confirm it exists
SELECT id, title, position, kind
FROM "RecordSectionDef"
WHERE "recordKey" = 'dry-cooking';
```

You should see a row with `title = 'Entry details'` (or similar). Note its `id`.

```sql
-- Delete any fields belonging to that section (match by sectionIndex = its position)
-- First find the section's position:
SELECT id, position FROM "RecordSectionDef"
WHERE "recordKey" = 'dry-cooking' AND title ILIKE '%entry%';

-- Then delete fields in that section (replace <position> with the value found above):
DELETE FROM "RecordFieldDef"
WHERE "recordKey" = 'dry-cooking' AND "sectionIndex" = <position>;

-- Then delete the section itself:
DELETE FROM "RecordSectionDef"
WHERE "recordKey" = 'dry-cooking' AND title ILIKE '%entry%';
```

> **Note:** If the "Entry details" section held the `ooswKg` field, that field will be re-added properly in Step 2. Do NOT keep it in the deleted section.

---

## Step 2 — Add `ooswKg` field to the Job info section in the DB

Find the "Job info" section's index:

```sql
SELECT id, position FROM "RecordSectionDef"
WHERE "recordKey" = 'dry-cooking' AND title = 'Job info';
```

Find the next available position within that section (check current fields):

```sql
SELECT key, position FROM "RecordFieldDef"
WHERE "recordKey" = 'dry-cooking' AND "sectionIndex" = <job_info_position>
ORDER BY position;
```

Insert `ooswKg` after `jiIntakeWeight` (position 2 in Job info, so insert at position 3 and shift the rest):

```sql
-- Shift existing fields from position 3 onward up by 1
UPDATE "RecordFieldDef"
SET position = position + 1
WHERE "recordKey" = 'dry-cooking'
  AND "sectionIndex" = <job_info_position>
  AND position >= 3;

-- Insert the new ooswKg field at position 3
INSERT INTO "RecordFieldDef"
  ("recordKey", "sectionIndex", position, key, label, type, "readOnly", "extraJson")
VALUES
  ('dry-cooking', <job_info_position>, 3, 'ooswKg', 'OOSW weight (kg)', 'text', true, '{}');
```

---

## Step 3 — Add autofill rule from `salting-oosw`

The `ooswKg` field is populated by watching `jobNo` and fetching `totalOoswKg` from the matching salting-oosw record.

```sql
INSERT INTO "RecordAutofillDef"
  ("recordKey", "watchKey", "sourceRecordKey", "matchField", "fillMap", "extraJson")
VALUES
  ('dry-cooking', 'jobNo', 'salting-oosw', 'jobNo', '{"ooswKg":"totalOoswKg"}', '{}');
```

> The `totalOoswKg` field in `salting-oosw` is a computed sum of the roster `weight` column. It is saved into the record's values on submission, so autofill will read it correctly.

---

## Step 4 — Re-export the static JSON

After all DB changes, run the export script:

```bash
node scripts/export-record-defs.mjs
```

> **Note:** The static JSON at `public/data/record-defs/dry-cooking.json` has already been manually updated to match the intended final state (OOSW field added to Job info, autofill added). After running the export script it will be overwritten with the DB version — confirm they match. If you skip the export script, commit the manually updated JSON directly.

---

## Step 5 — Commit and push

```bash
git add public/data/record-defs/dry-cooking.json
git commit -m "REC 7.4.0: add OOSW weight to Job info, remove Entry details section"
git push
```

Render auto-deploys within ~30 seconds.

---

## What the form looks like after this change

**Job info section** will show:
- Job number
- Processing for *(read-only, autofilled)*
- Whole weight (kg) *(read-only, autofilled from abalone-receiving)*
- **OOSW weight (kg)** *(read-only, autofilled from salting-oosw)* ← NEW
- Harvest farm
- Intake date
- Cooking date

The "Entry details" section is gone. The OOSW value already appears in the Job info section summary line (it was already in `summaryFields`) — now it also appears as a labelled field in the expanded section.

---

## Troubleshooting

**OOSW weight shows blank:** The salting-oosw record for this job may not yet be submitted, or `totalOoswKg` wasn't saved in an older submission. The field stays blank until a matching submitted salting-oosw record exists.

**Entry details section still showing:** The form may have cached the API response. Hard-refresh (`Ctrl+Shift+R`) and confirm the static JSON export was committed and deployed.
