# REC 7.4.2 Dry Monitoring — Form Changes

File: `public/data/record-defs/dry-monitoring.json`

Two independent changes:

---

## 1. Restructure sections after Job info

### New layout order (after Job info)
1. **Summary** (new group) — a compact info table
2. **Product condition** (existing group, unchanged)
3. ~~Dry room details~~ — removed as a visible section (see below)
4. **Checks** (existing group, scoring removed per change 2)

---

### Summary group — fields to include

Add a new group named `"Summary"` containing these fields **in this order**:

| Field key | Label | Notes |
|-----------|-------|-------|
| `cookedWeight` | Cooked weight (kg) | **New field** — `fromRecord` dry-cooking, field `cookedWeight`, same pattern as `cookingDate` (pick: latest, matchField: jobNo, submittedOnly: true, unlockWhenMissing: true). Type `number`, unit `kg`, readOnly `true`. Add hidden companion fields `cookedWeightSourceId` and `cookedWeightTypedManually` following the same pattern as cookingDate's companions. |
| `cookingDate` | Cooking date | **Move** from its current position (no group) to group `"Summary"`. No other changes. |
| `noOfTrolleys` | No. of trolleys | **Move** from no group to group `"Summary"`. No other changes. |
| `entryDate` | Date into drying room | **Move** from group `"Dry room details"` to group `"Summary"`. Change label to `"Date into drying room"`. No other changes. |

Also move the hidden companion fields that go with each of these (cookingDateSourceIds, cookingDateTypedManually, trolleysSourceSubmissionId, trolleysTypedManually) to group `"Summary"` so they stay logically co-located — they are `hidden: true` so they won't render.

---

### Remove "Dry room details" section

The following fields currently have `"group": "Dry room details"`. After moving `entryDate` to Summary (above), handle the remaining fields:

| Field key | Action |
|-----------|--------|
| `estimatedDryDate` | Change group to `"Summary"` — keep visible (shows estimated drying date). |
| `dryRoomArea` | Change group to `"Summary"` — keep visible and required (it is a `hardBlock` submitCheck). |
| `dryRoomAreaConfirmed` | Change group to `"Summary"` — keep visible and required. |
| `dryRoomAreaSourceId` | Change group to `"Summary"` — hidden, no visible change. |
| `dateOld` | Change group to `"Summary"` — it is `legacy: true` and `showWhen: { nonEmpty: true }`, so it only appears on old records. |
| `qcCheckOld` | Same as dateOld. |
| `supervisorOld` | Same as dateOld. |

**Result**: no field has `"group": "Dry room details"` any more — the section simply disappears.

---

## 2. Remove scoring from the full record

### Remove the top-level `scoring` block

Delete the entire `"scoring": { ... }` key from the root of the JSON object.

Also remove `"redPrompt"` at the root level (the `{ "field": "correctiveActions", "blocksSubmit": false }` block) if it exists only to support the scoring system. If it is used independently, keep it.

---

### Remove all scored-select fields and their output fields

Delete the following entries from `entryFields` entirely:

**Scored-select check fields** (group: Checks):
- `skinScore`
- `coreScore`
- `frillsScore`
- `shapeScore`
- `colourScore`
- `wrinklesScore`
- `stickyScore`
- `mouldScore`
- `odourScore`

**Score output fields** (group: Checks):
- `worstScore`
- `totalScore`
- `overdryingWorst`
- `overdryingTotal`
- `underdryingWorst`
- `underdryingTotal`
- `batchStatus`
- `ncEntryId`

**Keep** in the Checks group:
- `trolleysClearlyMarked`
- `correctiveActions`
- `mouldVisibleOld` (legacy)
- `whiteSaltOnSurfaceOld` (legacy)
- `caseHardeningOld` (legacy)
- `surfaceShineOld` (legacy)

---

## After editing the JSON

1. Run `node scripts/export-record-defs.mjs` (needs `DATABASE_URL`)
2. Commit and push `public/data/record-defs/dry-monitoring.json`
3. Bump `?v=N` in the HTML shell if `form-record.js` needed changes (it shouldn't for a config-only change)
