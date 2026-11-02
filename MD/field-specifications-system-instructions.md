# Field Specification & Enforcement System — Instructions

**Date:** 2026-10-13 (updated 2026-11-02)
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

This applies to **all record types**: numeric fields (temperature, pH, weight) and Y/N or select fields (operating status, condition checks, pass/fail). The admin decides per-field what counts as "bad" — neither Y nor N is inherently non-conforming.

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

  -- Specification for text/select/Y-N fields
  allowed_values      TEXT,            -- NULL = not used; comma-separated GOOD values e.g. 'Y' or 'Pass,Accept'
  bad_values          TEXT,            -- NULL = not used; comma-separated BAD values e.g. 'N' or 'Fail'
  -- Use allowed_values OR bad_values, not both, for the same field.
  -- allowed_values: anything NOT in this list is out of spec.
  -- bad_values:     anything IN this list is out of spec. Clearer for Y/N fields where only one answer is bad.

  -- Visual feedback when out of spec
  highlight_red       BOOLEAN NOT NULL DEFAULT FALSE,
  show_warning_bubble BOOLEAN NOT NULL DEFAULT FALSE,

  -- Gate behaviour when out of spec
  gate_mode           TEXT NOT NULL DEFAULT 'none',
  -- 'none'         = record, do not block
  -- 'warn_submit'  = pop-up warning at submission; operator can continue
  -- 'double_sign'  = requires TWO passkeys at submission to accept out-of-spec value
  -- 'hard_block'   = submission is refused; value must be corrected

  -- NC behaviour
  auto_nc             BOOLEAN NOT NULL DEFAULT FALSE,
  nc_category         TEXT,
  nc_severity         TEXT DEFAULT 'minor', -- 'minor' | 'major' | 'critical'
  nc_optional_skip    BOOLEAN NOT NULL DEFAULT TRUE,

  -- Metadata
  label_override      TEXT,
  notes               TEXT,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (record_key, field_key)
);

CREATE INDEX IF NOT EXISTS idx_fspecs_record ON field_specs (record_key);
CREATE INDEX IF NOT EXISTS idx_fspecs_active  ON field_specs (record_key, active);

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

-- Add bad_values column if upgrading from earlier version
ALTER TABLE field_specs ADD COLUMN IF NOT EXISTS bad_values TEXT;
```

### 2b. Column explanations

| Column | Meaning |
|---|---|
| `record_key` | Matches the record's short key, e.g. `rec-7.9.3.1` |
| `field_key` | Matches a `key` value inside the record's field definitions |
| `spec_min` / `spec_max` | Numeric bounds; NULL = unbounded on that side |
| `allowed_values` | CSV of **good** values — anything else is out of spec |
| `bad_values` | CSV of **bad** values — anything in this list is out of spec. Use instead of `allowed_values` when it's simpler to say what's bad (e.g. `bad_values = 'N'` means only N is flagged, Y is fine) |
| `highlight_red` | Field value turns red when out of spec |
| `show_warning_bubble` | Inline amber banner/tooltip appears next to the field |
| `gate_mode` | Controls what happens at submission |
| `auto_nc` | If true, NC is auto-raised when out-of-spec value is submitted |
| `nc_optional_skip` | If true, operator may skip the NC (skip is logged) |

### 2c. Y/N and select field spec logic

For a Y/N field (or any select/text field), the admin chooses **one** of two approaches:

**Option A — `bad_values`** (recommended for Y/N):
- `bad_values = 'N'` → N is flagged, Y is fine
- `bad_values = 'Y'` → Y is flagged, N is fine
- `bad_values = 'N/A,Fail'` → multiple bad values on a select field

**Option B — `allowed_values`** (recommended for multi-option selects):
- `allowed_values = 'Pass,Accept'` → only Pass and Accept are good; anything else is out of spec

Never set both `bad_values` and `allowed_values` on the same field — the system rejects it with a validation error.

If **neither** is set on a Y/N or select field, no spec is enforced (any value is acceptable). This is the default.

---

## 3. API routes — `server/routes/specs.js`

Mount at `/api/specs`.

### 3a. Routes

```
GET    /api/specs/:recordKey            → all active specs for that record
GET    /api/specs/:recordKey/:fieldKey  → single spec
POST   /api/specs                       → create spec
PATCH  /api/specs/:id                   → update spec
DELETE /api/specs/:id                   → soft delete (set active=false)
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
    "bad_values": null,
    "highlight_red": true,
    "show_warning_bubble": true,
    "gate_mode": "double_sign",
    "auto_nc": true,
    "nc_category": "Temperature out of spec",
    "nc_severity": "major",
    "nc_optional_skip": false,
    "label_override": "Dry Room Temperature"
  },
  {
    "id": 18,
    "record_key": "rec-7.8.9.1",
    "field_key": "chillerOperating",
    "spec_min": null,
    "spec_max": null,
    "allowed_values": null,
    "bad_values": "N",
    "highlight_red": true,
    "show_warning_bubble": true,
    "gate_mode": "warn_submit",
    "auto_nc": false,
    "nc_category": null,
    "nc_severity": "minor",
    "nc_optional_skip": true,
    "label_override": "Chiller Unit Operating"
  }
]
```

### 3c. POST `/api/specs` — create

Required body fields: `record_key`, `field_key`. All others optional (defaults apply).

Validation:
- `record_key` must exist in `RecordDefinition`.
- `field_key` must exist in that record's fields.
- `gate_mode` must be one of `none | warn_submit | double_sign | hard_block`.
- `nc_severity` must be one of `minor | major | critical`.
- Only one spec per `(record_key, field_key)` pair — return 409 if duplicate.
- **`allowed_values` and `bad_values` cannot both be set** — return 400 if both are provided.

### 3d. PATCH `/api/specs/:id`

Partial update. Same mutual-exclusion validation as POST.

### 3e. DELETE `/api/specs/:id`

Soft delete: set `active = false`. Return 200 with `{ deleted: true }`.

---

## 4. Record-def pipeline — include specs in JSON export

### 4a. `src/record-def.js` — `assembleRecordConfig()`

```js
field.spec = {
  min: spec.spec_min,
  max: spec.spec_max,
  allowed: spec.allowed_values ? spec.allowed_values.split(',').map(s => s.trim()) : null,
  bad:     spec.bad_values     ? spec.bad_values.split(',').map(s => s.trim())     : null,
  highlightRed: spec.highlight_red,
  showWarningBubble: spec.show_warning_bubble,
  gateMode: spec.gate_mode,
  autoNc: spec.auto_nc,
  ncCategory: spec.nc_category,
  ncSeverity: spec.nc_severity,
  ncOptionalSkip: spec.nc_optional_skip,
  labelOverride: spec.label_override
};
```

If no spec exists for a field, `field.spec` is `null`.

### 4b. `scripts/export-record-defs.mjs`

No change needed — `assembleRecordConfig()` embeds `spec` (including `bad`) inside each field, so the JSON snapshot picks it up automatically. Re-run after any spec is added or changed:

```bash
node scripts/export-record-defs.mjs
```

---

## 5. `form-record.js` — spec enforcement engine

### 5a. On page load — fetch with cache-buster (GLOBAL FIX — all records)

**Always** fetch the record definition JSON with a cache-buster so stale cached files are never served. Apply this to `form-record.js` AND `monitoring-log.js`:

```js
// Before:
const res = await fetch(`/data/record-defs/${recordKey}.json`);

// After:
const res = await fetch(`/data/record-defs/${recordKey}.json?v=${Date.now()}`);
```

This fixes the issue where editing a template or setting a spec and then refreshing still shows the old version. It applies to every record, not just individual ones.

### 5b. Build spec map

```js
const specMap = {};
for (const section of recordDef.sections) {
  for (const field of section.fields) {
    if (field.spec) specMap[field.key] = field.spec;
  }
}
```

### 5c. `checkSpec(fieldKey, rawValue)`

```
checkSpec(fieldKey, rawValue):
  spec = specMap[fieldKey]
  if (!spec) return { ok: true }

  outOfSpec = false
  reason = ''

  -- Numeric check
  if spec.min != null and Number(rawValue) < spec.min:
    outOfSpec = true; reason = `Below minimum (spec: ${spec.min}–${spec.max})`
  if spec.max != null and Number(rawValue) > spec.max:
    outOfSpec = true; reason = `Above maximum (spec: ${spec.min}–${spec.max})`

  -- bad_values check (Y/N and select fields)
  if spec.bad and spec.bad.includes(String(rawValue).trim()):
    outOfSpec = true; reason = `Value "${rawValue}" is not acceptable for this field`

  -- allowed_values check
  if spec.allowed and not spec.allowed.includes(String(rawValue).trim()):
    outOfSpec = true; reason = `Value "${rawValue}" is outside allowed values (${spec.allowed.join(', ')})`

  return { ok: !outOfSpec, reason }
```

Call on every `input`, `change`, and `blur` event for any field that has a spec.

### 5d. Visual feedback (on blur)

When `checkSpec` returns `ok: false`:
1. `highlightRed: true` → add class `is-out-of-spec` to field wrapper
2. `showWarningBubble: true` → render amber banner below field: `⚠ Out of spec — {reason}`

Remove both when value returns in-spec. Neither blocks the operator from moving to the next field.

### 5e. Track out-of-spec state

```js
const outOfSpecFields = new Set();
const outOfSpecDetails = {};
// outOfSpecDetails[fieldKey] = { label, value, reason, spec }
```

### 5f. On submit — gate enforcement

Call `runSpecGate()` before any passkey or submission API call.

```
runSpecGate():
  if outOfSpecFields is empty → pass through

  strictest gate across all out-of-spec fields:
    priority: hard_block > double_sign > warn_submit > none

  hard_block  → HARD BLOCK modal (section 6a); return false
  double_sign → DOUBLE SIGN modal (section 6b); return true/false
  warn_submit → WARN modal (section 6c); return true/false
  none        → pass through (log only)
```

### 5g. NC handling at submission

After a successful submission, for each out-of-spec field with `autoNc: true`:
- Raise NC with pre-filled category, severity, description.
- `ncOptionalSkip: false` → NC is mandatory; operator cannot dismiss it.
- `ncOptionalSkip: true` → operator can skip; `nc_skipped: true` stamped on submission.

---

## 6. `public/lib/spec-gate.js` — SpecGate modal

Exposes `SpecGate.run(outOfSpecDetails)` → Promise<boolean>.

### 6a. HARD BLOCK mode

- Title: `⛔ Submission Blocked — Value Out of Spec`
- Lists each blocking field with current value and spec.
- One button: `Go Back and Correct`. No way to proceed.

### 6b. DOUBLE SIGN mode

- Title: `⚠ Out-of-Spec Value — Authorisation Required`
- Two sequential passkey inputs (must be different people; same passkey rejected).
- `Confirm and Submit` active only after both passkeys verified.
- Stamps `out_of_spec_accepted_by: [user1, user2]` on payload.

### 6c. WARN mode

- Title: `⚠ Out-of-Spec Value Detected`
- Two buttons: `Cancel` and `Continue Anyway`.
- Stamps `out_of_spec_acknowledged: true` on payload.

---

## 7. Submission payload stamping

```json
{
  "out_of_spec_fields": [
    {
      "field_key": "temperature",
      "label": "Temperature (°C)",
      "value": 20,
      "spec_min": 12,
      "spec_max": 18,
      "gate_mode": "warn_submit"
    },
    {
      "field_key": "chillerOperating",
      "label": "Chiller Unit Operating",
      "value": "N",
      "bad_values": ["N"],
      "gate_mode": "warn_submit"
    }
  ],
  "out_of_spec_accepted_by": ["Maria D", "Rowan P"],
  "out_of_spec_acknowledged": true,
  "nc_skipped": false
}
```

---

## 8. Admin UI — `public/pages/spec-admin.html`

### 8a. Purpose

Allows the admin to add, edit, and deactivate field specifications for **any record** without touching code or the DB directly.

### 8b. Access

Gate behind a passkey with `admin` role. Not visible to general operators.

### 8c. Layout and flow

**Step 1 — Select a record**
Dropdown from `GET /api/record-defs`. All active records by name + key.

**Step 2 — Select a field**
Dropdown of every field in the record. Show: label, key, type, spec status badge ("Spec set" green / "No spec" grey).

**Step 3 — Edit specification** — four panels:

---

#### Panel A — Specification limits

| UI element | Type | Maps to | Notes |
|---|---|---|---|
| Min value | Number | `spec_min` | Leave blank = no lower bound. Numeric fields only. |
| Max value | Number | `spec_max` | Leave blank = no upper bound. Numeric fields only. |
| **Bad values** | Text (comma-separated) | `bad_values` | For Y/N and select fields. Enter the value(s) that mean something is wrong — e.g. `N` or `Fail,N/A`. Anything in this list is out of spec; everything else is fine. |
| **Allowed values** | Text (comma-separated) | `allowed_values` | Alternative to bad values. Enter what is acceptable — anything not in this list is out of spec. Do not fill both. |
| Label override | Text | `label_override` | How the field is named in warning messages. |
| Admin notes | Textarea | `notes` | Internal only. |

**UI logic for Bad values / Allowed values:**
- Show both inputs side by side.
- If the user types in one, grey out and clear the other.
- Show note: "Use Bad values OR Allowed values — not both. Bad values: list what's wrong (e.g. `N`). Allowed values: list what's acceptable (e.g. `Y`, `Pass`)."
- For Y/N fields: auto-show tip — "Tip: for a Y/N field, enter `N` in Bad values if N means a problem."
- On save: validate not both populated; show error if they are.

At least one of min/max, bad values, or allowed values must be set before saving.

---

#### Panel B — Visual feedback

| Checkbox | Label | Maps to |
|---|---|---|
| ☐ | Highlight field in red | `highlight_red` |
| ☐ | Show inline warning bubble | `show_warning_bubble` |

Both independent. Neither blocks the operator. When neither is ticked, out-of-spec is tracked internally but no visual cue is shown.

---

#### Panel C — Gate mode at submission

Radio buttons (one selection). Default: None.

| Radio | Label | `gate_mode` |
|---|---|---|
| ◉ | None — record and continue | `'none'` |
| ○ | Warn at submission | `'warn_submit'` |
| ○ | Double sign-off required | `'double_sign'` |
| ○ | Hard block — must correct | `'hard_block'` |

When multiple out-of-spec fields are present, the strictest gate mode wins at submission.

---

#### Panel D — Non-Conformance (NC) handling

Master toggle: `Auto-raise NC` — OFF by default.

When ON:

| UI element | Type | Maps to |
|---|---|---|
| NC category | Text | `nc_category` |
| NC severity | Dropdown (Minor / Major / Critical) | `nc_severity` |
| Operator can skip the NC | Toggle (ON default) | `nc_optional_skip` |

When `nc_optional_skip` is OFF: operator must raise the NC; cannot finalise the form without doing so.

---

**Save / Update button** — POST (new) or PATCH (existing). Toast: "Spec saved. Run the export script and push to update the live site."

**Deactivate this spec** — Toggle at the bottom. Soft-deletes (`active = false`). Still visible in summary table with "Inactive" badge + Reactivate option.

---

**Step 4 — Spec summary table** (all specs for selected record)

| Field label | Field key | Type | Spec | Visual | Gate | NC | Status |
|---|---|---|---|---|---|---|---|
| Dry Room Temp | dryRoomTemp | Number | 25–32°C | Red + Bubble | Double sign | Major / mandatory | Active |
| Chiller Operating | chillerOperating | Y/N | Bad: N | Red | Warn | None | Active |
| pH value | phValue | Number | 6.8–7.2 | Red | Warn | Minor / skippable | Active |

**Spec column** shows: for numeric, the range; for Y/N/select with `bad_values`, "Bad: N"; for `allowed_values`, "Allowed: Y, Pass".

Each row has an **Edit** button that pre-fills all four panels.

### 8d. After saving a spec

Show notice: "Re-run the record-def export and push to update the live site."

```bash
node scripts/export-record-defs.mjs && git add public/data/record-defs/ && git commit -m "chore: export record defs with updated specs" && git push
```

---

## 9. Template edit + spec tab cache/refresh fix (ALL records)

### The problem

When you edit a template in the Template Editor or set a spec in spec-admin, the change is saved to the DB but **the JSON cache files are not automatically regenerated**. The record page loads from the cache, so:
- The page shows the old template after reload (the change is NOT lost — it's in the DB; the cache is stale).
- Spec admin settings don't appear on the live form for the same reason.

This affects **every record** in the system.

### Fix A — Cache-buster on JSON fetch (apply globally)

In `form-record.js` AND `monitoring-log.js`, wherever the record-def JSON is fetched:

```js
// Before:
const res = await fetch(`/data/record-defs/${recordKey}.json`);

// After:
const res = await fetch(`/data/record-defs/${recordKey}.json?v=${Date.now()}`);
```

Forces the browser past its local cache on every page load. One small JSON file — negligible performance impact.

### Fix B — Run export after every template edit or spec change

```bash
node scripts/export-record-defs.mjs && git add public/data/record-defs/ && git commit -m "chore: export record defs" && git push
```

Render deploys in ~30 seconds. After that, any page refresh picks up the latest definition.

### Fix C (optional but ideal) — Server-side export trigger

Add `POST /api/admin/export-record-defs` (admin-only) that shells out to `node scripts/export-record-defs.mjs`. Call from both the Template Editor `onSave` and the spec-admin save:

```js
onSave: async () => {
  await fetch('/api/admin/export-record-defs', { method: 'POST' });
  location.reload();  // now guaranteed to get fresh JSON
}
```

This makes the edit → see-change cycle seamless with no manual terminal step.

---

## 10. Styles — `record-theme.css` additions

```css
.fr-field.is-out-of-spec input,
.fr-field.is-out-of-spec select,
.fr-field.is-out-of-spec textarea {
  color: #DC2626;
  border-color: #DC2626;
}

.fr-spec-warn {
  display: flex; align-items: flex-start; gap: 6px;
  color: #B45309; background: #FEF3C7;
  border: 1px solid #F59E0B; border-radius: 4px;
  padding: 4px 8px; font-size: 13px; margin-top: 4px; line-height: 1.4;
}

.spec-gate-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  z-index: 9000; display: flex; align-items: center; justify-content: center;
}
.spec-gate-modal {
  background: #fff; border-radius: 8px; padding: 24px;
  max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.spec-gate-modal h2 { margin-top: 0; font-size: 18px; }
.spec-gate-field-list { margin: 12px 0; }
.spec-gate-field-list li { padding: 4px 0; font-size: 14px; }
.spec-gate-passkey-row { display: flex; gap: 8px; margin-top: 8px; }
.spec-gate-passkey-row input { flex: 1; }

@media (prefers-color-scheme: dark) {
  .spec-gate-modal { background: #1e1e1e; color: #f5f5f5; }
  .fr-spec-warn { background: #3B2500; border-color: #92400E; color: #FDE68A; }
  .fr-field.is-out-of-spec input,
  .fr-field.is-out-of-spec select { border-color: #F87171; color: #F87171; }
}
```

---

## 11. Index / nav link

Add a link to `spec-admin.html` in the admin section of `public/index.html`. Label: `Field Specifications`.

---

## 12. Implementation order

1. Run DB migration SQL (include `bad_values` column — `ALTER TABLE field_specs ADD COLUMN IF NOT EXISTS bad_values TEXT`).
2. Add API routes (`server/routes/specs.js`), mount in main server file.
3. Update `src/record-def.js` to include `bad` (from `bad_values`) in assembled field spec.
4. Apply cache-buster fix to JSON fetch in `form-record.js` AND `monitoring-log.js` (Fix A — all records).
5. Re-run export script; commit JSON updates.
6. Build `public/lib/spec-gate.js`.
7. Update `form-record.js`: load specs, call `checkSpec` (numeric + bad_values + allowed_values), apply visual feedback, call `runSpecGate()` on submit, stamp payload, trigger NC.
8. Add CSS to `record-theme.css`.
9. Build `public/pages/spec-admin.html` (Bad values / Allowed values with mutual-exclusion UI).
10. Add nav link in `index.html`.
11. (Optional) Add `POST /api/admin/export-record-defs` endpoint (Fix C).
12. Test end-to-end.

---

## 13. Testing checklist

- [ ] Admin can add a spec to a numeric field; range enforces on the live form.
- [ ] Admin can set `bad_values = 'N'` on a Y/N field; selecting N shows red + bubble; Y does not.
- [ ] Admin can set `bad_values = 'Y'` on a Y/N field; selecting Y shows red + bubble; N does not.
- [ ] Admin can set `allowed_values = 'Pass,Accept'`; Fail triggers out-of-spec; Pass does not.
- [ ] Setting both bad_values and allowed_values is rejected with an error in the UI and API.
- [ ] Export script picks up `bad` (from `bad_values`) in the record JSON.
- [ ] Field turns red when out of spec; bubble appears. Both clear when value returns in-spec.
- [ ] `warn_submit` gate: modal appears at submit; operator can cancel or continue.
- [ ] `double_sign` gate: both passkeys required; same passkey twice is rejected.
- [ ] `hard_block` gate: no way to proceed; focus returns to bad field.
- [ ] `auto_nc` with `ncOptionalSkip: false`: NC cannot be skipped.
- [ ] `auto_nc` with `ncOptionalSkip: true`: NC skipped is stamped on submission.
- [ ] All out-of-spec details (including bad_values fields) written to submission `data` JSON.
- [ ] Multiple out-of-spec fields: strictest gate mode wins.
- [ ] Deactivating a spec removes enforcement from the live form (after export + deploy).
- [ ] After editing a template in the Template Editor, refreshing the record page shows the change immediately (cache-buster fix).
- [ ] After setting a spec in spec-admin, refreshing the record page shows spec enforcement active (cache-buster fix).
- [ ] Y/N field with NO spec set: neither Y nor N triggers any warning or gate.
