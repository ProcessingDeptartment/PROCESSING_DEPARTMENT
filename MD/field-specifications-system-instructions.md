# Field Specification & Enforcement System — Instructions

**Date:** 2026-10-13  
**Raised by:** Michaela  
**Type:** New feature — field-level specification management  
**Use in:** Claude Code (build)  
**Files to create/edit:**

- `public/data/record-defs/<key>.json` — add `spec` object per field  
- `src/record-def.js` — extend `assembleRecordConfig()` to include specs  
- `public/lib/form-record.js` — enforce specs at input, blur, and submit time  
- `public/lib/spec-gate.js` — new: shared spec-gate modal + double-passkey logic  
- `public/pages/spec-admin.html` — new: admin UI to set/edit specs per field  
- `server/routes/specs.js` — new: CRUD API for field specs  
- `scripts/export-record-defs.mjs` — include `spec` data in JSON export  
- DB migration — add `field_specs` table  
- `public/styles/record-theme.css` — add spec highlight styles  

---

## 1. Purpose

Allow an administrator to attach a specification to any field in any record definition. When a user enters a value that falls outside the specification, the system enforces a configurable response — from a visual warning through to a hard block — and optionally raises a Non-Conformance (NC) automatically.

---

## 2. Database — `field_specs` table

### 2a. Migration SQL

```sql
CREATE TABLE IF NOT EXISTS field_specs (
  id                  SERIAL PRIMARY KEY,

  -- What record/field this spec belongs to
  record_key          TEXT NOT NULL,   -- e.g. 'rec-7.9.3.1'
  field_key           TEXT NOT NULL,   -- must match a field's `key` in the record def

  -- Specification limits (numeric fields)
  spec_min            NUMERIC,         -- NULL = no lower bound
  spec_max            NUMERIC,         -- NULL = no upper bound

  -- Specification for text/select fields (exact allowed values, comma-separated)
  allowed_values      TEXT,            -- NULL = not used; e.g. 'Pass,Accept'

  -- Visual feedback when out of spec
  highlight_red       BOOLEAN NOT NULL DEFAULT FALSE,  -- turn field text red
  show_warning_bubble BOOLEAN NOT NULL DEFAULT FALSE,  -- show inline warning tooltip/banner

  -- Gate behaviour when out of spec
  gate_mode           TEXT NOT NULL DEFAULT 'none',
  -- 'none'         = record, do not block
  -- 'warn_submit'  = pop-up warning at submission; operator can continue
  -- 'double_sign'  = requires TWO passkeys at submission to accept out-of-spec value
  -- 'hard_block'   = submission is refused; value must be corrected

  -- NC behaviour
  auto_nc             BOOLEAN NOT NULL DEFAULT FALSE,   -- auto-raise NC if out of spec
  nc_category         TEXT,            -- pre-fill NC category, e.g. 'Temperature out of spec'
  nc_severity         TEXT DEFAULT 'minor', -- 'minor' | 'major' | 'critical'
  nc_optional_skip    BOOLEAN NOT NULL DEFAULT TRUE,    -- operator can skip NC (nc_skipped stamped)

  -- Metadata
  label_override      TEXT,            -- optional: override the field label in warnings
  notes               TEXT,            -- admin notes; not shown to operators
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (record_key, field_key)
);

CREATE INDEX IF NOT EXISTS idx_fspecs_record ON field_specs (record_key);
CREATE INDEX IF NOT EXISTS idx_fspecs_active  ON field_specs (record_key, active);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trg_fspecs_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_field_specs_updated
BEFORE UPDATE ON field_specs
FOR EACH ROW EXECUTE FUNCTION trg_fspecs_updated();
```

### 2b. Column explanations

| Column | Meaning |
|---|---|
| `record_key` | Matches the record's short key, e.g. `rec-7.9.3.1` |
| `field_key` | Matches a `key` value inside the record's field definitions |
| `spec_min` / `spec_max` | Numeric bounds; NULL = unbounded on that side |
| `allowed_values` | For select/text fields: CSV of valid values |
| `highlight_red` | Field value turns red when out of spec |
| `show_warning_bubble` | Inline amber banner/tooltip appears next to the field |
| `gate_mode` | Controls what happens at submission (see section 5) |
| `auto_nc` | If true, NC is auto-raised when out-of-spec value is submitted |
| `nc_optional_skip` | If true, operator may skip the NC (skip is logged) |

---

## 3. API routes — `server/routes/specs.js`

Mount at `/api/specs`.

### 3a. Routes

```
GET    /api/specs/:recordKey            → all active specs for that record
GET    /api/specs/:recordKey/:fieldKey  → single spec
POST   /api/specs                       → create spec
PATCH  /api/specs/:id                   → update spec
DELETE /api/specs/:id                   → hard delete (or set active=false)
```

### 3b. GET `/api/specs/:recordKey`

Returns an array of spec objects. Used by `form-record.js` on page load.

Response shape:

```json
[
  {
    "id": 12,
    "record_key": "rec-7.9.3.1",
    "field_key": "dryRoomTemp",
    "spec_min": 25,
    "spec_max": 32,
    "allowed_values": null,
    "highlight_red": true,
    "show_warning_bubble": true,
    "gate_mode": "double_sign",
    "auto_nc": true,
    "nc_category": "Temperature out of spec",
    "nc_severity": "major",
    "nc_optional_skip": false,
    "label_override": "Dry Room Temperature"
  }
]
```

### 3c. POST `/api/specs` — create

Required body fields: `record_key`, `field_key`. All others optional (defaults apply).

Validation:
- `record_key` must exist in `RecordDefinition`.
- `field_key` must exist in that record's fields (check via `RecordFieldDef` or the exported JSON).
- `gate_mode` must be one of `none | warn_submit | double_sign | hard_block`.
- `nc_severity` must be one of `minor | major | critical`.
- Only one spec per `(record_key, field_key)` pair — return 409 if duplicate.

### 3d. PATCH `/api/specs/:id`

Partial update. Apply only the fields supplied in the body. Always update `updated_at`.

### 3e. DELETE `/api/specs/:id`

Soft delete: set `active = false`. Return 200 with `{ deleted: true }`.

---

## 4. Record-def pipeline — include specs in JSON export

### 4a. `src/record-def.js` — `assembleRecordConfig()`

After assembling sections and fields, query `field_specs` for the record and attach each spec to its matching field object under a `spec` key:

```js
// In the assembled field object, add:
field.spec = {
  min: spec.spec_min,          // number | null
  max: spec.spec_max,          // number | null
  allowed: spec.allowed_values ? spec.allowed_values.split(',') : null,
  highlightRed: spec.highlight_red,
  showWarningBubble: spec.show_warning_bubble,
  gateMode: spec.gate_mode,    // 'none' | 'warn_submit' | 'double_sign' | 'hard_block'
  autoNc: spec.auto_nc,
  ncCategory: spec.nc_category,
  ncSeverity: spec.nc_severity,
  ncOptionalSkip: spec.nc_optional_skip,
  labelOverride: spec.label_override
};
```

If no spec exists for a field, `field.spec` is `null` (omit the key).

### 4b. `scripts/export-record-defs.mjs`

No change to the export script's structure — because `assembleRecordConfig()` now embeds `spec` inside each field, the JSON snapshot picks it up automatically. Re-run after any spec is added or changed:

```bash
node scripts/export-record-defs.mjs
```

Commit and push the updated JSON files.

---

## 5. `form-record.js` — spec enforcement engine

### 5a. On page load

After loading the record definition JSON, build a lookup map:

```js
const specMap = {};  // fieldKey → spec object
for (const section of recordDef.sections) {
  for (const field of section.fields) {
    if (field.spec) specMap[field.key] = field.spec;
  }
}
```

### 5b. On field input / blur — `checkSpec(fieldKey, value)`

Call `checkSpec` on every `input`, `change`, and `blur` event for any field that has a spec.

```
checkSpec(fieldKey, value):
  spec = specMap[fieldKey]
  if (!spec) return { ok: true }

  outOfSpec = false
  reason = ''

  if spec.min != null and value < spec.min:
    outOfSpec = true
    reason = `Below minimum (${spec.min})`
  if spec.max != null and value > spec.max:
    outOfSpec = true
    reason = `Above maximum (${spec.max})`
  if spec.allowed != null and value not in spec.allowed:
    outOfSpec = true
    reason = `Value not in allowed list`

  return { ok: !outOfSpec, reason }
```

### 5c. Visual feedback (immediate, on blur)

When `checkSpec` returns `ok: false`:

1. **`highlightRed: true`** — add class `is-out-of-spec` to the field's input element.  
   CSS in `record-theme.css`:  
   ```css
   .fr-field.is-out-of-spec input,
   .fr-field.is-out-of-spec select { color: #DC2626; border-color: #DC2626; }
   ```
   Remove the class when the value returns in-spec.

2. **`showWarningBubble: true`** — render an inline amber warning banner directly below the field input (not a modal). Content: `⚠ Out of spec — {reason}`. Class `fr-spec-warn`. Remove when value returns in-spec.
   ```css
   .fr-spec-warn { color: #B45309; background: #FEF3C7; border: 1px solid #F59E0B;
                   border-radius: 4px; padding: 4px 8px; font-size: 13px; margin-top: 4px; }
   ```

Both feedback types can be active simultaneously. They do not block the operator from moving to the next field.

### 5d. Track out-of-spec state

Maintain a set of all field keys currently out of spec:

```js
const outOfSpecFields = new Set();  // add/remove as values change
```

Also maintain a map of out-of-spec details for submission-time messaging:

```js
const outOfSpecDetails = {};
// outOfSpecDetails[fieldKey] = { label, value, reason, spec }
```

### 5e. On submit / finalise — gate enforcement

Before any passkey or submission API call, call `runSpecGate()`.

```
runSpecGate():
  if outOfSpecFields is empty → pass through, no gate

  gather all out-of-spec field specs
  determine the strictest gate_mode across all out-of-spec fields:
    priority: hard_block > double_sign > warn_submit > none

  if strictest == 'hard_block':
    show SpecGate modal in HARD BLOCK mode (section 6a)
    return false  ← prevent submission

  if strictest == 'double_sign':
    show SpecGate modal in DOUBLE SIGN mode (section 6b)
    await user action
    if user cancels → return false
    if user completes both passkeys → return true

  if strictest == 'warn_submit':
    show SpecGate modal in WARN mode (section 6c)
    await user action
    if user cancels → return false
    if user confirms → return true

  if strictest == 'none':
    pass through (specs are logged but no gate)
```

After gate resolves with `true`, proceed to normal submission (passkey sign-off, API call).

### 5f. NC handling at submission

After a successful submission, if any out-of-spec field has `autoNc: true`:

1. Collect all out-of-spec fields where `autoNc: true`.
2. Call the existing NC modal/trigger logic (from `nc-record-trigger-instructions.md`) with:
   - Category: the field's `ncCategory`
   - Severity: the field's `ncSeverity` (use the highest severity across all triggering fields)
   - Description: auto-generated list of all out-of-spec fields, their values, and the spec range
   - Pre-linked to the submission ID and job number
3. If `ncOptionalSkip: false` — operator **must** submit the NC; cannot dismiss it.
4. If `ncOptionalSkip: true` — operator can skip; `nc_skipped: true` is stamped on the submission.

If multiple out-of-spec fields trigger NC with different categories, raise one NC per unique `ncCategory` value.

---

## 6. `public/lib/spec-gate.js` — SpecGate modal

New shared module. Exposes `SpecGate.run(outOfSpecDetails)` → returns a Promise that resolves `true` (proceed) or `false` (abort).

### 6a. HARD BLOCK mode

**Trigger:** Any out-of-spec field has `gate_mode: 'hard_block'`.

Modal content:
- Title: `⛔ Submission Blocked — Value Out of Spec`
- Body: List each blocking field with its label, current value, and spec range.  
  e.g. `Dry Room Temperature: 36°C — Spec: 25–32°C`
- Message: `This field must be within specification before the record can be submitted. Correct the value and try again.`
- One button: `Go Back and Correct` (closes modal, returns focus to first out-of-spec field)
- **No way to proceed** past this modal.

### 6b. DOUBLE SIGN mode

**Trigger:** Strictest gate is `double_sign` (no hard_block fields present).

Modal content:
- Title: `⚠ Out-of-Spec Value — Authorisation Required`
- Body: List each out-of-spec field.
- Message: `Submitting with an out-of-spec value requires authorisation from two people. Both must enter their passkeys.`
- Step 1 label: `First passkey — person accepting the out-of-spec value`  
  Passkey input + `Verify` button → calls `/api/passkey/verify`; stores `passkey1_user`.
- Step 2 label: `Second passkey — supervisor sign-off`  
  Passkey input + `Verify` button → calls `/api/passkey/verify`; stores `passkey2_user`.  
  Must be a **different** passkey from step 1; reject with inline error if same.
- Once both verified: `Confirm and Submit` button becomes active.
- `Cancel` button → resolves `false`.
- On confirm: resolve `true`; stamp `out_of_spec_accepted_by: [passkey1_user, passkey2_user]` on the submission payload.

### 6c. WARN mode

**Trigger:** Strictest gate is `warn_submit`.

Modal content:
- Title: `⚠ Out-of-Spec Value Detected`
- Body: List each out-of-spec field.
- Message: `You are about to submit a record containing a value outside specification. Do you want to continue?`
- Two buttons: `Cancel` (resolves `false`) and `Continue Anyway` (resolves `true`).
- On continue: stamp `out_of_spec_acknowledged: true` on the submission payload.

---

## 7. Submission payload stamping

All spec-related decisions must be captured in the submission's `data` JSON so they are auditable. Add the following keys to the submission payload when applicable:

```json
{
  "out_of_spec_fields": [
    {
      "field_key": "dryRoomTemp",
      "label": "Dry Room Temperature",
      "value": 36,
      "spec_min": 25,
      "spec_max": 32,
      "gate_mode": "double_sign"
    }
  ],
  "out_of_spec_accepted_by": ["Maria D", "Rowan P"],
  "out_of_spec_acknowledged": true,
  "nc_skipped": false
}
```

These fields are `null` / absent when not applicable. They appear in the submission record in the DB and are visible on record review.

---

## 8. Admin UI — `public/pages/spec-admin.html`

### 8a. Purpose

Allows Michaela (admin) to add, edit, and deactivate field specifications without touching code or the DB directly.

### 8b. Access

Gate this page behind a passkey that has the `admin` role, using the existing passkey/role system. Do not expose to general operators.

### 8c. Layout and flow

**Step 1 — Select a record**  
Dropdown populated from `GET /api/record-defs` (existing endpoint). Shows all active records by name + key.

**Step 2 — Select a field**  
Once a record is chosen, fetch its definition and populate a second dropdown with every field in that record (all sections, in order). Show: field label, field key, field type, current spec status (badge: "Spec set" in green, or "No spec" in grey).

**Step 3 — Edit specification for the selected field**  
A form panel appears with all spec options:

| UI element | Maps to |
|---|---|
| Min value (number input) | `spec_min` |
| Max value (number input) | `spec_max` |
| Allowed values (text, comma-separated) | `allowed_values` |
| Highlight field red (toggle) | `highlight_red` |
| Show warning bubble (toggle) | `show_warning_bubble` |
| Gate mode (radio: None / Warn at submit / Double sign / Hard block) | `gate_mode` |
| Auto-raise NC (toggle) | `auto_nc` |
| NC category (text input, shown when auto_nc on) | `nc_category` |
| NC severity (dropdown: Minor / Major / Critical, shown when auto_nc on) | `nc_severity` |
| Operator can skip NC (toggle, shown when auto_nc on) | `nc_optional_skip` |
| Admin notes (textarea) | `notes` |
| Deactivate spec (toggle) | `active` |

**Save button** — POST (new) or PATCH (existing). Show success toast.

**Step 4 — Spec summary table**  
Below the editor, show a read-only table of all specs for the selected record:

| Field label | Field key | Min | Max | Gate mode | NC | Active |
|---|---|---|---|---|---|---|

Each row has an **Edit** button that pre-fills the form with that spec.

### 8d. After saving a spec

Show a notice: "Re-run the record-def export and push to update the live site."

Command to run:
```bash
node scripts/export-record-defs.mjs && git add public/data/record-defs/ && git commit -m "chore: export record defs with updated specs" && git push
```

---

## 9. Styles — `record-theme.css` additions

Add these classes (do not modify existing rules):

```css
/* Out-of-spec field highlighting */
.fr-field.is-out-of-spec input,
.fr-field.is-out-of-spec select,
.fr-field.is-out-of-spec textarea {
  color: #DC2626;
  border-color: #DC2626;
}

/* Inline warning bubble below field */
.fr-spec-warn {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: #B45309;
  background: #FEF3C7;
  border: 1px solid #F59E0B;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  margin-top: 4px;
  line-height: 1.4;
}

/* SpecGate modal overlay (reuse existing modal styles where possible) */
.spec-gate-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
}
.spec-gate-modal {
  background: #fff; border-radius: 8px;
  padding: 24px; max-width: 480px; width: 90%;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.spec-gate-modal h2 { margin-top: 0; font-size: 18px; }
.spec-gate-field-list { margin: 12px 0; }
.spec-gate-field-list li { padding: 4px 0; font-size: 14px; }
.spec-gate-passkey-row { display: flex; gap: 8px; margin-top: 8px; }
.spec-gate-passkey-row input { flex: 1; }
```

Dark-mode overrides:
```css
@media (prefers-color-scheme: dark) {
  .spec-gate-modal { background: #1e1e1e; color: #f5f5f5; }
  .fr-spec-warn { background: #3B2500; border-color: #92400E; color: #FDE68A; }
}
```

---

## 10. Index / nav link

Add a link to `spec-admin.html` in the admin section of `public/index.html` (alongside the NC log and other admin tools). Label: `Field Specifications`.

---

## 11. DB export / portability note

`field_specs` is a standard Postgres table. It is included in any `pg_dump` export of the Neon database. When migrating to another provider, dump with:

```bash
pg_dump $DATABASE_URL --table=field_specs --data-only -F plain > field_specs_export.sql
```

Or export as CSV from Neon console → Table editor → Export. The table has no exotic types; it will import cleanly into any Postgres-compatible system.

---

## 12. Implementation order

1. Run the DB migration SQL to create `field_specs`.
2. Add API routes (`server/routes/specs.js`), mount in the main server file.
3. Update `src/record-def.js` to join specs into field objects.
4. Re-run export script; commit JSON updates.
5. Build `public/lib/spec-gate.js`.
6. Update `form-record.js` to load specs, call `checkSpec`, apply visual feedback, call `runSpecGate()` on submit, stamp payload, trigger NC.
7. Add CSS to `record-theme.css`.
8. Build `public/pages/spec-admin.html`.
9. Add nav link in `index.html`.
10. Test end-to-end: set a spec via admin UI → export → verify field highlights, gate, double-sign, NC on the live form.

---

## 13. Testing checklist

- [ ] Admin can add a spec to a field; it appears in the spec table.
- [ ] Export script picks up the new spec in the record JSON.
- [ ] Field turns red when out of spec; bubble appears.
- [ ] Both clear when value returns to spec.
- [ ] `warn_submit` gate: modal appears at submit; operator can cancel or continue.
- [ ] `double_sign` gate: both passkeys required; same passkey twice is rejected.
- [ ] `hard_block` gate: no way to proceed; focus returns to bad field.
- [ ] `auto_nc` with `ncOptionalSkip: false`: NC cannot be skipped.
- [ ] `auto_nc` with `ncOptionalSkip: true`: NC skipped is stamped on submission.
- [ ] All out-of-spec details written to submission `data` JSON.
- [ ] Multiple out-of-spec fields: strictest gate mode wins.
- [ ] Deactivating a spec in admin removes enforcement from the live form (after export + deploy).
