# Field Spec Live Enforcement — Fix Spec Not Flowing Into Record

**Date:** 2026-10-20  
**Raised by:** Michaela  
**Issue:** Spec rules set in the admin UI (e.g. blanching temperature min/max) do not appear in the record form when an operator is completing it.  
**Root cause:** The current pipeline bakes specs into a static JSON snapshot at export time. If the export script is not re-run after a spec is saved, the live form never sees the new spec. `form-record.js` also does not call `/api/specs/:recordKey` directly — it only reads `field.spec` from the pre-exported JSON, so any spec added or changed after the last export is invisible to the form.  
**Type:** Bug fix + architecture patch. Instructions only, no code written. For Claude Code.

---

## 1. What needs to change (summary)

| Layer | Current behaviour | Required behaviour |
|---|---|---|
| `form-record.js` | Reads `field.spec` from the static JSON only | Also fetches `/api/specs/:recordKey` on page load and merges live specs over the JSON |
| `spec-admin.html` (save) | Shows "re-run export script" notice | Notice stays, but form enforcement no longer depends on it |
| `assembleRecordConfig()` | Joins specs into JSON at export time | Keep as-is (JSON still has specs after export); this is now a fallback only |
| `scripts/export-record-defs.mjs` | Must be run manually after spec changes | Still useful for offline/print use; no longer the sole enforcement path |

The export script and the JSON snapshots are **kept as-is**. The JSON spec values become the **fallback** (used if the API call fails). The live API call becomes the **primary** source.

---

## 2. Files to edit

- `public/lib/form-record.js` — add live spec fetch and merge  
- `server/routes/specs.js` — verify the GET route is correct (likely already exists)  
- `public/pages/spec-admin.html` — update save notice wording  

No DB changes. No new files.

---

## 3. `form-record.js` — live spec fetch on page load

### 3a. Where to add the fetch

Find the section in `form-record.js` where the record definition JSON is loaded (look for `fetch('/data/record-defs/...')` or similar). After the JSON is parsed and `specMap` is built from `field.spec` values in the JSON, immediately fire a live fetch of `/api/specs/:recordKey`.

**Important:** the record key used in the API call must match exactly what is stored in `field_specs.record_key` (e.g. `rec-7.9.3.1`). This value should already be available as part of the loaded record definition — look for `recordDef.key` or `recordDef.record_key`.

### 3b. Merge strategy

```
After building specMap from the JSON:

  1. Fire GET /api/specs/{recordKey}
     - On success: for each spec object returned, set specMap[spec.field_key] = buildSpec(spec)
       This overwrites the JSON-derived value for that field (live wins over snapshot).
     - On network error or non-200: leave specMap unchanged (JSON snapshot is the fallback).
       Log a console warning: "Spec API unavailable — using cached spec values from JSON."
  2. After the merge (or on fetch failure), continue with normal form initialisation.
     Do not await the fetch before rendering the form — render first, then apply spec
     state once the fetch resolves. This prevents a blank screen if the API is slow.
```

### 3c. `buildSpec(apiRow)` helper

Convert the API row (snake_case DB fields) to the camelCase spec object that the rest of `form-record.js` already uses:

```js
function buildSpec(row) {
  return {
    min:              row.spec_min ?? null,
    max:              row.spec_max ?? null,
    allowed:          row.allowed_values ? row.allowed_values.split(',').map(s => s.trim()) : null,
    highlightRed:     row.highlight_red,
    showWarningBubble: row.show_warning_bubble,
    gateMode:         row.gate_mode,
    autoNc:           row.auto_nc,
    ncCategory:       row.nc_category,
    ncSeverity:       row.nc_severity,
    ncOptionalSkip:   row.nc_optional_skip,
    labelOverride:    row.label_override ?? null,
  };
}
```

This is the same shape already used when reading `field.spec` from the JSON, so no downstream changes are needed in `checkSpec`, `runSpecGate`, or the visual feedback logic.

### 3d. Re-apply visual state after merge

After the live spec fetch resolves and `specMap` is updated, call `checkSpec` on every field that currently has a value (in case the operator has already filled in fields before the fetch completed). This ensures the red highlight and warning bubble appear correctly even if the form was filled before the API responded.

```
After specMap is updated from the API:
  for each field in the form that has a current value:
    result = checkSpec(fieldKey, currentValue)
    applyVisualFeedback(fieldKey, result)
```

### 3e. Roster / child-table fields (e.g. dry cooking pots)

Records with repeating row sections (pot cards, basket entries) build their child fields dynamically. The `specMap` is global to the record — it does not need to be rebuilt per row. When a new child row is added, attach `input`/`change`/`blur` listeners that call `checkSpec` using the field key (not the row index). This is the same pattern as other field events in the roster; no change needed beyond ensuring the listeners are attached on row creation as well as on page load.

---

## 4. `server/routes/specs.js` — verify the GET route

Confirm that `GET /api/specs/:recordKey` returns **only active specs** (`active = true`). If it currently returns all specs including inactive ones, add a `WHERE active = true` filter to the query.

Response must be a JSON array (empty array `[]` if no specs exist for that record — not a 404). The form checks `response.ok` and treats a non-200 as a fallback condition, so a 404 on "no specs" would incorrectly suppress specs from the JSON. Return `[]` instead.

---

## 5. `spec-admin.html` — update save notice

Change the notice shown after saving a spec from:

> "Spec saved. Re-run the export script to push changes to the live site."

To:

> "Spec saved. Changes are live immediately — forms now load specs directly from the database. Re-run the export script to update the cached JSON (used as a fallback and for offline/print use)."

No other change to the admin UI.

---

## 6. Dry cooking record — specific example to verify

The reported case is the blanching temperature field on REC 7.4.0. After this fix:

1. Admin opens `spec-admin.html`, selects record `rec-7.4.0`, selects field `blanch_temp_c` (or whatever key is used for blanching temperature in the dry cooking definition), sets min/max, saves.
2. No export script run needed.
3. Operator opens the dry cooking record and enters a temperature. On `blur`, `checkSpec` is called. If the value is outside the spec, the red highlight and/or warning bubble appear immediately.
4. If the operator tries to submit, `runSpecGate()` enforces the configured gate mode.

To confirm the field key: look in `public/data/record-defs/rec-7.4.0.json` (the exported snapshot) for the blanching temperature field and note its `key` value. Use that exact string as `field_key` when setting the spec in the admin UI. The admin UI's field dropdown shows the key alongside the label — confirm the key shown there matches the JSON.

---

## 7. Build order

1. Add `buildSpec()` helper function to `form-record.js` (or a shared utility if preferred).
2. After the existing `specMap` build from JSON, add the live fetch block (section 3b–3d).
3. Confirm `GET /api/specs/:recordKey` returns `[]` (not 404) for records with no specs.
4. Update the save notice in `spec-admin.html` (section 5).
5. Test end-to-end with the dry cooking blanching temperature field (section 6).

---

## 8. Testing checklist

- [ ] Admin saves a new spec for a field — no export script run — operator opens the record and the spec is enforced (red highlight on blur if out of range).
- [ ] Admin changes an existing spec (e.g. tightens the max) — form picks up the new value on next page load without any export or deploy.
- [ ] Admin deactivates a spec — on next page load, enforcement is gone for that field (API returns it filtered out; JSON still has it but live overwrites).
- [ ] API unreachable (simulate with network tab → block the request) — form falls back to JSON spec values; console warning logged; form still works.
- [ ] Field already filled before API responds — visual feedback applies correctly after merge (section 3d).
- [ ] Dry cooking record, blanching temperature field: value below spec → red border + bubble; value in spec → clears; submit with out-of-spec value → gate modal appears per configured gate_mode.
- [ ] Roster record (multiple child rows) — spec check fires for each row's field independently; adding a new row attaches listeners correctly.
- [ ] Empty array response from API (record has no specs) — no errors thrown; `specMap` remains as built from JSON (which would also be empty if no specs were exported).
