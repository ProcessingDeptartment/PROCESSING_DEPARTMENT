# REC-7.8.9.1 — LHA Water Monitoring: Full Rebuild Instructions

**Date:** 2026-11-02
**Raised by:** Michaela
**Type:** Record fix + DB setup + spec wiring
**Use in:** Claude Code (build)
**Files to create/edit:**

- `public/records/REC-7.8.9.1-lha-water-monitoring.html` — remove wrong fields, add Now button, fix chiller Y/N
- `public/data/record-defs/rec-7.8.9.1.json` — update field definitions
- `server/routes/specs.js` — ensure Y/N spec logic is wired (see field-specifications-system-instructions.md update)
- DB — confirm `sub_lha_water_monitoring` table structure matches below
- `public/pages/spec-admin.html` — Y/N bad-value selection (see field-specifications-system-instructions.md)

---

## 1. What this record is

**REC 7.8.9.1 — LHA Water Monitoring**
- Scope: Live Holding Area (LHA) chiller unit water temperature
- Frequency: Twice per shift
- Parameter: Temperature must be 12–18°C
- This is **separate** from REC 7.8.9 (general water monitoring)
- "Chiller unit operating" is an informational field only — **N does NOT mean bad or non-conforming**

---

## 2. Fields to REMOVE

Remove the following fields entirely from the record. They are not part of the work instruction for this record:

| Field | Key | Reason |
|---|---|---|
| Month | `month` | Not required — date is auto-stamped |
| Date | `date` | Not required — entry date is auto-stamped |
| Shift | `shift` | Not required per spec |
| Checked by | `checkedBy` | Not required — Completed By block handles sign-off |

Do not replace them with anything. The Completed By block (already at the bottom) is the only sign-off needed.

---

## 3. Fields to KEEP / ADD

The record should contain exactly these fields, in this order:

### 3a. Time — NOW button

Replace any manual time input with a "Now" button pattern, identical to the timestamp-now pattern used on other records (see `MD/global-timestamp-field-standard-instructions.md` and `MD/rec-7.4.0-timestamp-now-button-fix-instructions.md`).

```js
{
  key: 'entryTime',
  label: 'Time',
  type: 'time',           // stored as HH:MM
  required: true,
  nowButton: true,        // renders the "Now" button next to the field
  autoFillOnOpen: false   // operator taps Now when they are actually doing the check
}
```

The "Now" button fills the field with the current local time (HH:MM) on click. The field remains editable in case of a correction. The button label is "Now".

**Do NOT include Date, Month, or Shift.** The `entry_date` is always auto-stamped server-side from `NOW()` at save time, same as every other record.

---

### 3b. Temperature

```js
{
  key: 'temperature',
  label: 'Temperature (°C)',
  type: 'number',
  step: 0.1,
  required: true,
  placeholder: '12–18'
}
```

Spec: min 12, max 18 — enforced via the field-specs system (see Section 5).

---

### 3c. Chiller Unit Operating

```js
{
  key: 'chillerOperating',
  label: 'Chiller unit operating?',
  type: 'select',
  options: ['Y', 'N'],
  required: true
}
```

**Critical:** N on this field does NOT mean bad or non-conforming. This is a status observation field. Whether N is out-of-spec is configurable by the admin in the spec admin UI (see Section 5 and `MD/field-specifications-system-instructions.md`). By default, **no spec is set** on this field — neither Y nor N triggers any gate or NC unless the admin explicitly configures it.

---

### 3d. Comments

```js
{
  key: 'comments',
  label: 'Comments',
  type: 'textarea',
  required: false,
  rows: 2
}
```

---

### 3e. Completed By block

Keep the existing Completed By block at the bottom (unchanged). It uses the standard `window.SignOffBlock.completedByHtml(...)` pattern. This is the only sign-off block. Do not add a separate "Checked by" field.

---

## 4. Database — `sub_lha_water_monitoring`

### 4a. Correct table structure

Run this in the Neon SQL Editor to ensure the table has the right columns. Safe to re-run (`IF NOT EXISTS` / `IF EXISTS` guards throughout):

```sql
-- Confirm table exists (it should already)
CREATE TABLE IF NOT EXISTS sub_lha_water_monitoring (
  id              SERIAL PRIMARY KEY,
  submission_id   INTEGER REFERENCES "Submission"(id) ON DELETE CASCADE,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_time      TIME,
  temperature     NUMERIC(5,1),
  chiller_operating CHAR(1),          -- 'Y' or 'N'
  comments        TEXT,
  "completedBy"   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add any columns that may be missing from an earlier version
ALTER TABLE sub_lha_water_monitoring ADD COLUMN IF NOT EXISTS entry_time TIME;
ALTER TABLE sub_lha_water_monitoring ADD COLUMN IF NOT EXISTS chiller_operating CHAR(1);
ALTER TABLE sub_lha_water_monitoring ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE sub_lha_water_monitoring ADD COLUMN IF NOT EXISTS "completedBy" TEXT;

-- Drop obsolete columns if they exist
-- (Only run these if the columns are confirmed present — check first)
-- ALTER TABLE sub_lha_water_monitoring DROP COLUMN IF EXISTS month;
-- ALTER TABLE sub_lha_water_monitoring DROP COLUMN IF EXISTS shift;
-- ALTER TABLE sub_lha_water_monitoring DROP COLUMN IF EXISTS checked_by;
-- ALTER TABLE sub_lha_water_monitoring DROP COLUMN IF EXISTS "checkedBy";
```

**Before running the DROP COLUMN lines:** run `SELECT column_name FROM information_schema.columns WHERE table_name = 'sub_lha_water_monitoring';` to confirm which columns exist. Drop only those that are confirmed present and no longer needed. Existing data in those columns is lost on drop — if in doubt, rename to `_old_month`, `_old_shift` etc. rather than dropping immediately.

### 4b. RecordDefinition check

The record key must be `rec-7.8.9.1` and the sub-table key must be `sub_lha_water_monitoring`. Confirm in Neon:

```sql
SELECT id, key, "subTableKey", title
FROM "RecordDefinition"
WHERE key = 'rec-7.8.9.1';
```

If the row is missing, insert it:
```sql
INSERT INTO "RecordDefinition" (key, "subTableKey", title, active)
VALUES ('rec-7.8.9.1', 'sub_lha_water_monitoring', 'LHA Water Monitoring', true)
ON CONFLICT (key) DO NOTHING;
```

---

## 5. Spec wiring

### 5a. Temperature spec (required)

Set this spec via the spec admin UI (`/pages/spec-admin.html`) or directly in the DB:

```sql
INSERT INTO field_specs (record_key, field_key, spec_min, spec_max,
  highlight_red, show_warning_bubble, gate_mode,
  auto_nc, nc_category, nc_severity, nc_optional_skip, label_override)
VALUES (
  'rec-7.8.9.1', 'temperature', 12, 18,
  true, true, 'warn_submit',
  true, 'LHA water temperature out of spec', 'minor', true,
  'LHA Water Temperature'
)
ON CONFLICT (record_key, field_key) DO NOTHING;
```

Adjust `gate_mode`, `nc_severity`, and `nc_optional_skip` to your preference via the admin UI.

### 5b. Chiller Operating spec (default: none)

By default, **no spec is set** for `chillerOperating`. Neither Y nor N triggers any warning or NC.

If you later want N to be flagged (e.g. the chiller not operating is a non-conformance), use the spec admin UI to set:

- **Bad value: N** (see Section 5c of `MD/field-specifications-system-instructions.md` — Y/N bad-value feature)
- Gate mode: your choice
- Auto NC: your choice

Similarly, if you wanted N to be the expected value (unlikely for this field), you could set **bad value: Y**.

The spec admin UI now supports this for any Y/N or select field — see the updated field-specs instructions.

---

## 6. Why the spec tab wasn't working + the template refresh bug

These are the same root cause: **stale cached JSON files**.

### The problem

1. The record page loads its field definitions from a cached JSON file in `public/data/record-defs/rec-7.8.9.1.json`.
2. When you edit a template in the Template Editor, it writes the change to the DB (`RecordFieldDef` / `RecordSectionDef`), but **does not regenerate the JSON cache file**.
3. The `onSave` callback calls `location.reload()` — but the reload fetches the same stale JSON, so the change appears to have been lost. It hasn't been lost in the DB; it's just not in the cache.
4. The same stale cache means the spec admin tab settings are not being picked up by the live form.

### The fix

**A. After any template edit or spec change, always run:**
```bash
node scripts/export-record-defs.mjs
```
Then commit and push. Render redeploys in ~30 seconds. After the deploy, refresh the record page — the change will be there.

**B. For the live-reload fix (so you don't need to refresh manually):**

Add a cache-buster version query param to the JSON fetch in `form-record.js`. Find where the record def JSON is fetched and change it from:

```js
const res = await fetch(`/data/record-defs/${recordKey}.json`);
```

to:

```js
const res = await fetch(`/data/record-defs/${recordKey}.json?v=${Date.now()}`);
```

This forces the browser to bypass its cache on every page load, so after a deploy the latest JSON is always served. The performance cost is negligible (one small JSON file per page open).

This applies to **all records** — it is a global fix in `form-record.js` and `monitoring-log.js`.

**C. Wire the Template Editor `onSave` to also re-fetch the definition:**

In the `onSave` callback passed to `TemplateEditor.open(...)`, instead of just `location.reload()`, also invalidate and re-fetch the record def:

```js
onSave: async () => {
  // Optionally trigger a server-side re-export if you have that endpoint
  // await fetch('/api/admin/export-record-defs', { method: 'POST' });
  location.reload();  // keeps existing behaviour; cache-buster on fetch handles stale JSON
}
```

If you add a `POST /api/admin/export-record-defs` endpoint (admin-only) that runs the export script server-side, you can call it from `onSave` before reloading — then the reload always gets a fresh file. This is optional but would make the edit-and-refresh cycle seamless without a manual deploy step.

---

## 7. Testing checklist

- [ ] Record opens with only: Time (Now button), Temperature, Chiller Unit Operating, Comments, Completed By block
- [ ] No Month, Date, Shift, or Checked By fields visible
- [ ] Tapping "Now" fills the time field with the current time; field is still editable
- [ ] Temperature outside 12–18°C shows red highlight and warning bubble
- [ ] On submit with out-of-spec temperature: warn modal appears; operator can cancel or continue
- [ ] On submit with out-of-spec temperature and continue: NC is raised (or skipped with skip stamped)
- [ ] Selecting N for Chiller Operating shows no warning, no red highlight, no gate (default config)
- [ ] After editing a template in the editor, refreshing the page shows the updated template (no second refresh needed after cache-buster fix)
- [ ] After setting a spec in spec admin, refreshing the record shows the spec enforcement active
- [ ] `sub_lha_water_monitoring` table in Neon has: `id`, `submission_id`, `entry_date`, `entry_time`, `temperature`, `chiller_operating`, `comments`, `completedBy`
- [ ] `entry_date` auto-filled server-side; `entry_time` comes from the Now button
- [ ] Print layout shows: Time, Temperature, Chiller Operating, Comments, Completed By — no old fields
