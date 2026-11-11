# REC 7.4.2 Dry Monitoring — Product Condition Checks (restore + 5% threshold)

**Date:** 11 November 2026 · Michaela (Abagold)
**Scope:** `dry-monitoring` record (REC 7.4.2) only — table `sub_dry_monitoring`.
**Purpose:** Restore the three product condition checks that have gone missing from the form, and add a percentage-threshold sub-question. If Yes, the operator picks < 5% or > 5%. If > 5%, a comment is **required** before Submit.

Supersedes: `rec-7.4.2-product-condition-checks-nc-instructions.md` (27 Oct 2026).

---

## 1. The three checks (restore these)

| # | Field label | Field key | Yes = ? |
|---|-------------|-----------|---------|
| 1 | Foot damage? | `footDamage` | Bad (red) |
| 2 | Muscle damage? | `muscleDamage` | Bad (red) |
| 3 | Presence of guts? | `presenceOfGuts` | Bad (red) |

These fields were added previously but have disappeared from the form. Check `data/record-defs/dry-monitoring.json` and `RecordFieldDef` in Neon — if the rows are gone, re-add them following section 4 below. If the rows exist but the form does not render them, check the section placement (section 2) and the cache-buster.

---

## 2. Form placement

Group label: **"Product condition"**. Position: after the existing environmental checks (mould, pest activity, moisture) and before "Trolleys clearly marked".

```
[ mould / pest / moisture checks ]
────────── Product condition ──────────
  Foot damage?        [ Yes ]  [ No ]
  Muscle damage?      [ Yes ]  [ No ]
  Presence of guts?   [ Yes ]  [ No ]
────────────────────────────────────────
[ Trolleys clearly marked ]
[ Completed by block ]
```

---

## 3. Yes/No + percentage sub-question (new behaviour)

### 3.1 Answer flow per check

```
Foot damage?
  [ Yes ]  [ No ]

  ↓ revealed only when Yes is selected

  How much affected?
    [ < 5% ]   [ > 5% ]

  ↓ revealed only when > 5% is selected

  Comment (required):
  [ _____________________________ ]
```

Apply this same three-level pattern to all three checks. When the answer changes back to No, collapse the sub-question and comment box and clear their values.

### 3.2 Percentage field

| Property | Value |
|---|---|
| Field key suffix | `...Pct` — e.g. `footDamagePct`, `muscleDamagePct`, `presenceOfGutsPct` |
| Type | Radio toggle: two options only |
| Options | `"lt5"` label `"< 5%"` and `"gt5"` label `"> 5%"` |
| Shown | Only when parent Yes/No = Yes |
| Stored value | `"lt5"` or `"gt5"` (NULL if parent = No) |

### 3.3 Comment field

| Property | Value |
|---|---|
| Field key suffix | `...Comment` — e.g. `footDamageComment`, `muscleDamageComment`, `gutsComment` |
| Type | Textarea, max 500 chars |
| Shown | Only when percentage = `"gt5"` |
| Required | **Hard block at Submit** when percentage = `"gt5"` and comment is empty |
| Error message | `"Comment required when > 5% [field label] is recorded."` |

### 3.4 Colouring (inherit existing `yesIsBad: true` rule)

- Yes button → red, bold, ⚠ mark. No button → neutral.
- The percentage toggle and comment box inherit neutral styling (sub-fields of a bad answer, not independently bad).
- On print: Yes prints bold with a border. The percentage value and comment print indented below it.

---

## 4. Database

Do **not** run `prisma migrate` or `prisma db push`. Run SQL in the Neon SQL Editor.

### 4.1 Columns to add (safe to re-run)

```sql
BEGIN;

ALTER TABLE sub_dry_monitoring
  ADD COLUMN IF NOT EXISTS foot_damage              BOOLEAN,
  ADD COLUMN IF NOT EXISTS foot_damage_pct          TEXT,
  ADD COLUMN IF NOT EXISTS foot_damage_comment      TEXT,

  ADD COLUMN IF NOT EXISTS muscle_damage            BOOLEAN,
  ADD COLUMN IF NOT EXISTS muscle_damage_pct        TEXT,
  ADD COLUMN IF NOT EXISTS muscle_damage_comment    TEXT,

  ADD COLUMN IF NOT EXISTS presence_of_guts         BOOLEAN,
  ADD COLUMN IF NOT EXISTS presence_of_guts_pct     TEXT,
  ADD COLUMN IF NOT EXISTS guts_comment             TEXT;

COMMIT;
```

- `BOOLEAN`: `TRUE` = Yes, `FALSE` = No, `NULL` = not answered.
- `TEXT` for `_pct`: stores `'lt5'` or `'gt5'`; `NULL` when parent = No or unanswered.
- `TEXT` for comment: stores the operator note; `NULL` when not applicable.

### 4.2 NC linkage columns (add if missing)

```sql
ALTER TABLE non_conformances
  ADD COLUMN IF NOT EXISTS source_field_key      TEXT,
  ADD COLUMN IF NOT EXISTS source_submission_id  INTEGER;
```

Confirm the actual NC table name before running. Do not add columns that already exist.

### 4.3 Reporting view — extend `v_dry_monitoring_flags`

```sql
CREATE OR REPLACE VIEW v_dry_monitoring_flags AS
  -- (keep all existing UNION rows intact, then add:)
  UNION ALL
  SELECT job_no, entry_date, dry_room_area,
         'footDamage' AS field_key,
         CASE WHEN foot_damage_pct = 'gt5' THEN 'yes_gt5' ELSE 'yes_lt5' END AS answer
    FROM sub_dry_monitoring WHERE foot_damage = TRUE
  UNION ALL
  SELECT job_no, entry_date, dry_room_area,
         'muscleDamage' AS field_key,
         CASE WHEN muscle_damage_pct = 'gt5' THEN 'yes_gt5' ELSE 'yes_lt5' END AS answer
    FROM sub_dry_monitoring WHERE muscle_damage = TRUE
  UNION ALL
  SELECT job_no, entry_date, dry_room_area,
         'presenceOfGuts' AS field_key,
         CASE WHEN presence_of_guts_pct = 'gt5' THEN 'yes_gt5' ELSE 'yes_lt5' END AS answer
    FROM sub_dry_monitoring WHERE presence_of_guts = TRUE;
```

Adjust column names to match what `sub_dry_monitoring` actually exposes (`entry_date` vs `"createdAt"`, etc.).

---

## 5. Record definition

In `data/record-defs/dry-monitoring.json` (and `RecordFieldDef` rows in Neon), add or restore 9 fields under a "Product condition" section. Follow the existing field definition schema exactly. Example shape:

```json
{
  "sectionTitle": "Product condition",
  "fields": [
    {
      "key": "footDamage",
      "type": "yesno",
      "label": "Foot damage?",
      "yesIsBad": true,
      "ncOnYes": { "severity": "minor" }
    },
    {
      "key": "footDamagePct",
      "type": "radio",
      "label": "How much affected?",
      "showWhen": { "field": "footDamage", "value": "yes" },
      "options": [
        { "value": "lt5", "label": "< 5%" },
        { "value": "gt5", "label": "> 5%" }
      ]
    },
    {
      "key": "footDamageComment",
      "type": "textarea",
      "label": "Comment",
      "maxLength": 500,
      "showWhen": { "field": "footDamagePct", "value": "gt5" },
      "requiredWhen": { "field": "footDamagePct", "value": "gt5" },
      "requiredMessage": "Comment required when > 5% foot damage is recorded."
    },
    {
      "key": "muscleDamage",
      "type": "yesno",
      "label": "Muscle damage?",
      "yesIsBad": true,
      "ncOnYes": { "severity": "minor" }
    },
    {
      "key": "muscleDamagePct",
      "type": "radio",
      "label": "How much affected?",
      "showWhen": { "field": "muscleDamage", "value": "yes" },
      "options": [
        { "value": "lt5", "label": "< 5%" },
        { "value": "gt5", "label": "> 5%" }
      ]
    },
    {
      "key": "muscleDamageComment",
      "type": "textarea",
      "label": "Comment",
      "maxLength": 500,
      "showWhen": { "field": "muscleDamagePct", "value": "gt5" },
      "requiredWhen": { "field": "muscleDamagePct", "value": "gt5" },
      "requiredMessage": "Comment required when > 5% muscle damage is recorded."
    },
    {
      "key": "presenceOfGuts",
      "type": "yesno",
      "label": "Presence of guts?",
      "yesIsBad": true,
      "ncOnYes": { "severity": "minor" }
    },
    {
      "key": "presenceOfGutsPct",
      "type": "radio",
      "label": "How much affected?",
      "showWhen": { "field": "presenceOfGuts", "value": "yes" },
      "options": [
        { "value": "lt5", "label": "< 5%" },
        { "value": "gt5", "label": "> 5%" }
      ]
    },
    {
      "key": "gutsComment",
      "type": "textarea",
      "label": "Comment",
      "maxLength": 500,
      "showWhen": { "field": "presenceOfGutsPct", "value": "gt5" },
      "requiredWhen": { "field": "presenceOfGutsPct", "value": "gt5" },
      "requiredMessage": "Comment required when > 5% presence of guts is recorded."
    }
  ]
}
```

If `form-record.js` does not yet support `showWhen` / `requiredWhen`, implement those properties in the field renderer and the submit validator at the same time.

After updating:
- Bump `version` on the `dry-monitoring` `RecordDefinition` row in Neon.
- Update both Prisma schema files by hand (no migrate).
- Run `node scripts/export-record-defs.mjs` to regenerate the static snapshot.
- Raise `?v=` cache-busters on every HTML file that loads `form-record.js`.

---

## 6. Submit-time validation

### Client-side (before POST)

For each check, before submitting:
```
IF footDamage == 'yes' AND footDamagePct == 'gt5' AND footDamageComment is blank
  → show inline error below the comment box
  → block submit
```
Same for `muscleDamage` and `presenceOfGuts`.

### Server-side (API route)

Mirror the same check in the submit handler so the rule is enforced even if client-side checks are bypassed:
```
IF foot_damage == true AND foot_damage_pct == 'gt5' AND foot_damage_comment is empty/null
  → 400: { error: "Comment required when > 5% foot damage is recorded." }
```

---

## 7. NC auto-raise on Yes answer

Raise a **minor NC** on Submit for each field that is Yes. Include the percentage in the auto-generated description:

| Field | NC description (gt5) | NC description (lt5) |
|---|---|---|
| `footDamage` | `"Foot damage (> 5%) observed — Job [job_no], [entry_date]"` | `"Foot damage (< 5%) observed — Job [job_no], [entry_date]"` |
| `muscleDamage` | `"Muscle damage (> 5%) observed — Job [job_no], [entry_date]"` | `"Muscle damage (< 5%) observed — Job [job_no], [entry_date]"` |
| `presenceOfGuts` | `"Presence of guts (> 5%) — Job [job_no], [entry_date]"` | `"Presence of guts (< 5%) — Job [job_no], [entry_date]"` |

All other NC rules unchanged from the original instructions: one NC per field, duplicate guard, no auto-close on edit, NC created inside the same DB transaction as the submission save.

---

## 8. Testing checklist

1. Open REC 7.4.2 → "Product condition" group appears with all three checks in the correct position.
2. Answer **No** on all three → no sub-questions, no comment boxes, Submit not blocked.
3. Select **Yes** on Foot damage → `< 5%` / `> 5%` toggle appears immediately below.
4. Select `< 5%` → comment box hidden, Submit not blocked.
5. Select `> 5%` → comment box appears, Submit **blocked** until comment is entered.
6. Enter comment → Submit unblocks.
7. Change Foot damage back to **No** → toggle and comment box collapse and clear.
8. Submit with Foot damage = Yes / `> 5%` / comment entered → one minor NC raised with `> 5%` in description.
9. Submit with Foot damage = Yes / `< 5%` → one minor NC raised with `< 5%` in description.
10. Submit with all three = Yes / `> 5%` / comments entered → three separate NCs, all open.
11. Direct POST with `> 5%` and empty comment → server returns 400.
12. Print: Yes prints bold/bordered; percentage and comment print indented below.
13. Entry list and CSV include `foot_damage`, `foot_damage_pct`, `foot_damage_comment` (and equivalents).
14. `SELECT foot_damage, foot_damage_pct, foot_damage_comment FROM sub_dry_monitoring ORDER BY id DESC LIMIT 5;` returns expected values.
15. Old entries without these columns open without crashing; fields show blank.

---

## 9. Files to change

| File | Change |
|---|---|
| `data/record-defs/dry-monitoring.json` | Add / restore 9 field definitions under "Product condition" |
| `RecordFieldDef` rows in Neon | Add / restore the same 9 rows; bump `RecordDefinition.version` |
| `public/lib/form-record.js` | Add `showWhen` / `requiredWhen` support if not present |
| All HTML files loading `form-record.js` | Bump `?v=N` |
| `scripts/migrate-dry-monitoring-product-condition.sql` | `ADD COLUMN IF NOT EXISTS` for 9 new columns (safe to re-run) |
| Prisma schema files (×2) | Add 9 fields by hand, no migrate |
| Submit API route for `dry-monitoring` | Server-side `> 5%` comment validation + NC auto-raise |
| `v_dry_monitoring_flags` view | Add / replace UNION rows for the three checks with `_pct` logic |

No other records, no new pages.
