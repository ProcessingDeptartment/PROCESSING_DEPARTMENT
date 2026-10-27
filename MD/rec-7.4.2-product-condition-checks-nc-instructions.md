# REC 7.4.2 Dry Monitoring — Product Condition Checks (NC auto-raise)

**Date:** 27 October 2026 · Michaela (Abagold)  
**Scope:** `dry-monitoring` record (REC 7.4.2) only — table `sub_dry_monitoring`.  
**Purpose:** Add three new Yes/No quality checks for product condition during drying. Any Yes answer is a problem and automatically raises a **minor NC**.

---

## 1. New fields

Add these three Yes/No fields to REC 7.4.2 in the order shown:

| # | Field label | Field key | Yes = ? | NC severity |
|---|-------------|-----------|---------|-------------|
| 1 | Foot damage? | `footDamage` | Bad (red) | Minor |
| 2 | Muscle damage? | `muscleDamage` | Bad (red) | Minor |
| 3 | Presence of guts? | `presenceOfGuts` | Bad (red) | Minor |

All three follow the existing `yesIsBad: true` rule already in place for this record (see `rec-7.4.2-dry-monitoring-field-changes-instructions.md`, Change 7). No exceptions — Yes is always bad on all three.

---

## 2. Form placement

Place the three new fields as a labelled group — **"Product condition"** — inserted after the existing physical condition checks (mould, pest activity, moisture) and before the "Trolleys clearly marked" field. If a section separator already exists between those groups, keep it; otherwise add a thin divider labelled "Product condition".

```
[ existing checks: mould, pest, moisture, etc. ]
────────────── Product condition ────────────────
  Foot damage?         [ Yes ]  [ No ]
  Muscle damage?       [ Yes ]  [ No ]
  Presence of guts?    [ Yes ]  [ No ]
──────────────────────────────────────────────────
[ Trolleys clearly marked ]
[ Completed by block ]
```

---

## 3. Yes/No colouring (inherit existing rule)

These three fields are standard problem checks — apply exactly the same visual treatment as the other `yesIsBad: true` fields already on 7.4.2:

- **Yes selected → button turns red**, bold text, small warning mark (⚠ or similar).
- **No selected → neutral** (calm green tick, same as existing).
- Applies on the form, the saved entry view, the entry list, and the print sheet.
- Old entries (answered before this change) show red where Yes was saved — no stored data change needed.

---

## 4. NC auto-raise on Yes answer

When any of the three new fields is answered **Yes** at Submit, the system must automatically raise a **Non-Conformance (NC)** record linked to that submission.

### 4.1 NC details

| NC attribute | Value |
|---|---|
| Severity | **Minor** |
| Category | `dry-monitoring` (or the existing NC category for dry room issues — use the same category key the rest of the system uses; do not invent a new one) |
| Source record | `dry-monitoring` |
| Source submission ID | the submission ID of the REC 7.4.2 entry |
| Job number | the job number on the entry |
| Raised by | the operator passkey on the entry |
| Raised at | server timestamp at Submit |
| Description | Auto-generated — see section 4.2 |
| Status | `open` on creation |

### 4.2 Auto-generated NC description

Use a short, clear template per field:

| Field | NC description |
|---|---|
| `footDamage` | `"Foot damage observed during dry room check — Job [job_no], Entry date [entry_date]"` |
| `muscleDamage` | `"Muscle damage observed during dry room check — Job [job_no], Entry date [entry_date]"` |
| `presenceOfGuts` | `"Presence of guts observed during dry room check — Job [job_no], Entry date [entry_date]"` |

Replace `[job_no]` and `[entry_date]` with the actual values at creation time.

### 4.3 When to create the NC

**On Submit only** — not on answer selection — so that a user who accidentally taps Yes and corrects it before submitting does not create a spurious NC.

- If any of the three fields is `true` at Submit time → create the NC(s) as part of the submit transaction.
- One NC per offending field — if all three are Yes, three separate NCs are raised.
- If the user edits a submitted entry and changes a Yes back to No → **do not automatically close** the NC. The NC lifecycle is managed by the NC module in the normal way. Add a comment to the NC: `"Answer changed to No on edit — review and close manually if resolved."`

### 4.4 Duplicate guard

Before creating a new NC on Submit:

1. Check whether a `minor` NC already exists for this `source_submission_id` + `source_field_key`.
2. If yes → do not create a duplicate. Log a server-side note.
3. If no → create it.

This prevents re-submitting an edited entry from raising duplicate NCs.

### 4.5 Inline NC prompt on the form

When a Yes answer is selected on any of the three fields, show a small inline amber banner directly below that field:

```
⚠  A minor NC will be raised for this check on Submit.
   Add a note below (optional but recommended):
   [ free-text comment box, max 500 chars ]
```

This comment is stored on the NC as the initial note. It is optional — Submit is never blocked by an empty comment.

If the user changes the answer back to No before submitting, dismiss the banner.

---

## 5. Database

Do **not** run `prisma migrate` or `prisma db push`. Use a SQL file for the Neon SQL Editor, one transaction, safe to re-run.

### 5.1 Columns to add to `sub_dry_monitoring`

```sql
ALTER TABLE sub_dry_monitoring
  ADD COLUMN IF NOT EXISTS foot_damage            BOOLEAN,
  ADD COLUMN IF NOT EXISTS muscle_damage           BOOLEAN,
  ADD COLUMN IF NOT EXISTS presence_of_guts        BOOLEAN,
  ADD COLUMN IF NOT EXISTS foot_damage_comment     TEXT,
  ADD COLUMN IF NOT EXISTS muscle_damage_comment   TEXT,
  ADD COLUMN IF NOT EXISTS guts_comment            TEXT;
```

- Store `TRUE` for Yes, `FALSE` for No, `NULL` for unanswered (NULL is distinguishable from a deliberate No in trend queries).
- Comment columns hold the optional inline note from the operator (section 4.5).

### 5.2 NC linkage columns

The NC table should already carry `source_submission_id`. Add `source_field_key` if it does not already exist — confirm against the actual table before running:

```sql
ALTER TABLE non_conformances
  ADD COLUMN IF NOT EXISTS source_field_key        TEXT,
  ADD COLUMN IF NOT EXISTS source_submission_id    INTEGER;
```

Do not duplicate columns that already exist.

### 5.3 Reporting view update

Extend the existing `v_dry_monitoring_flags` view to include the three new fields:

```sql
CREATE OR REPLACE VIEW v_dry_monitoring_flags AS
  -- existing rows for other yes-is-bad fields ...
  UNION ALL
  SELECT job_no, entry_date, dry_room_area, 'footDamage'     AS field_key, 'yes' AS answer
    FROM sub_dry_monitoring WHERE foot_damage      = TRUE
  UNION ALL
  SELECT job_no, entry_date, dry_room_area, 'muscleDamage'   AS field_key, 'yes' AS answer
    FROM sub_dry_monitoring WHERE muscle_damage     = TRUE
  UNION ALL
  SELECT job_no, entry_date, dry_room_area, 'presenceOfGuts' AS field_key, 'yes' AS answer
    FROM sub_dry_monitoring WHERE presence_of_guts  = TRUE;
```

Adjust column names to match the actual table (`entry_date` vs `"createdAt"`, etc.).

---

## 6. Record definition

In `data/record-definitions.json` and `dry-monitoring.json`, add the three fields inside the "Product condition" group. Follow the existing field definition schema exactly:

```json
{
  "key": "footDamage",
  "type": "yesno",
  "label": "Foot damage?",
  "yesIsBad": true,
  "ncOnYes": { "severity": "minor" },
  "commentKey": "footDamageComment",
  "commentLabel": "Foot damage note",
  "commentMaxLength": 500
},
{
  "key": "muscleDamage",
  "type": "yesno",
  "label": "Muscle damage?",
  "yesIsBad": true,
  "ncOnYes": { "severity": "minor" },
  "commentKey": "muscleDamageComment",
  "commentLabel": "Muscle damage note",
  "commentMaxLength": 500
},
{
  "key": "presenceOfGuts",
  "type": "yesno",
  "label": "Presence of guts?",
  "yesIsBad": true,
  "ncOnYes": { "severity": "minor" },
  "commentKey": "gutsComment",
  "commentLabel": "Guts note",
  "commentMaxLength": 500
}
```

`ncOnYes` is the signal to the submit handler to auto-raise an NC. If the record definition system does not yet support this property, add it to the field spec parser and the submit handler together.

After updating the JSON:
- Bump `version` on the `dry-monitoring` `RecordDefinition` row.
- Update both Prisma schema files by hand (no migrate).
- Run `node scripts/export-record-defs.mjs` to regenerate the offline cache.
- Raise `?v=` cache-busters on the REC 7.4.2 page scripts.

---

## 7. Submit handler (server-side)

In the REC 7.4.2 submit route, after saving the `sub_dry_monitoring` row, add NC creation logic:

```
FOR EACH field IN [footDamage, muscleDamage, presenceOfGuts]:
  IF submission[field] == true:
    IF no existing minor NC for (source_submission_id, source_field_key):
      CREATE NC:
        severity             = 'minor'
        source_record        = 'dry-monitoring'
        source_submission_id = <saved row id>
        source_field_key     = <field key>
        job_no               = submission.job_no
        raised_by            = submission.operator_passkey_id
        raised_at            = NOW()
        description          = <template from section 4.2>
        initial_note         = submission[fieldCommentKey]  (may be empty)
        status               = 'open'
```

Wrap NC inserts in the same database transaction as the submission save. If the NC module exposes a service/helper function, call that rather than inserting directly.

---

## 8. Testing checklist

1. Open REC 7.4.2 → three new fields appear in the "Product condition" group in the correct order.
2. Select **Yes** on Foot damage → button turns red, ⚠ amber banner appears below field, Submit not blocked without a comment.
3. Change answer back to **No** → button neutral, banner disappears.
4. Submit a record with all three = No → no NCs raised. Confirm NC table has no new rows for this submission.
5. Submit with Foot damage = Yes → one minor NC raised; description contains job number and entry date; status = open.
6. Submit with all three = Yes → three separate minor NCs raised, all open.
7. Edit the submitted entry, change Foot damage from Yes to No, save → NC is **not** closed automatically; NC gains a comment noting the answer was changed.
8. Re-submit the edited entry with Foot damage still Yes → no duplicate NC created.
9. Print the entry sheet → three new fields appear in the "Product condition" group; Yes prints in bold with a border.
10. Entry list and CSV export include `foot_damage`, `muscle_damage`, `presence_of_guts` columns.
11. `SELECT * FROM v_dry_monitoring_flags WHERE field_key IN ('footDamage','muscleDamage','presenceOfGuts');` returns the expected rows.
12. Old entries without these columns open fine — fields show blank, no crash, no forced answer.

---

## 9. Files to change

| File | Change |
|---|---|
| `data/record-definitions.json` | Add three field definitions under `dry-monitoring` |
| `data/dry-monitoring.json` | Same additions |
| `public/pages/rec-7.4.2.html` (or equivalent) | Render "Product condition" group; inline NC amber banners |
| `routes/api/dry-monitoring.js` (or equivalent submit route) | NC auto-raise logic |
| `scripts/migrate-dry-monitoring-product-condition.sql` | `ADD COLUMN IF NOT EXISTS` for six new columns |
| Prisma schema files (×2) | Add six fields by hand, no migrate |
| `v_dry_monitoring_flags` view | Add UNION rows for the three new fields |

No other records, no new pages, no new routes beyond the submit-handler addition.
