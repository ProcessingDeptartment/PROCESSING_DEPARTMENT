# Business rules registry

Every cross-record business rule — "a value on this record can't exceed/must match a value
already saved on another record for the same job" — lives as **data**, in one file:

- Registry: `public/data/business-rules.json`
- Engine (reads the registry, runs the checks): `public/lib/form-record.js`
  (`fetchBusinessRules` / `runBusinessRules` / one `checkXxx` function per rule `type`)

## Why this exists

These little cross-record rules were multiplying, each built a different way, scattered across
record definitions and form code. Going forward:

- **Adding a rule that fits an existing `type`** = one new object in `business-rules.json`.
  No code change, no html change, no touching a record's own definition.
- **A genuinely new kind of check** = one new `case` in `runBusinessRules` (form-record.js).
  Should be rare — check the list of types below first.
- Record definitions under `public/data/record-defs/*.json` are **generated snapshots**
  (see `scripts/export-record-defs.mjs`) — never hand-edit them for a rule; they'd be
  silently overwritten on the next export.

## Registry file shape

`public/data/business-rules.json` is a flat array. Every entry needs at least:

```json
{
  "recordKey": "<the record this rule runs on, e.g. \"dry-cooking\">",
  "type": "<one of the types below>",
  "label": "<short human name for this rule>",
  "why": "<plain-English reason, for whoever reads this file next>"
}
```

Everything else in the entry is parameters for that `type`.

## Rule types

### `capAgainstOtherRecord`

This record's own numeric field, **totalled across every previously-submitted entry for the
same job** (plus the value being saved right now), must not exceed a total already recorded on
another record for that job.

- Soft gate: at finalize, if the total would exceed the cap, the operator sees a confirm dialog
  and must explicitly click OK to override — declining aborts the save.
- If overridden, the record is stamped with `oosWarningAck` / `oosWarningNote`, which then shows
  as a standing red warning line both when viewing the submitted record and on the printed/PDF
  sheet.

Parameters:

| key | meaning |
|---|---|
| `ownJobField` | this record's own field holding the job number |
| `ownWeightField` | this record's own numeric field to total |
| `source` | `recordKey` of the record holding the cap |
| `matchField` | that record's job-number field |
| `sumColumn` | the roster column on that record to sum for the cap |
| `message` | the warning line shown on override / view / print |

Example (first rule of this kind — REC 7.4.0 Dry Cooking vs REC 7.1.5 OOSW):

```json
{
  "recordKey": "dry-cooking",
  "type": "capAgainstOtherRecord",
  "label": "Dry cooking batch weight vs OOSW",
  "why": "Abalone processed for dry cooking cannot exceed the OOSW weight recorded for the job on REC 7.1.5 - a higher total means batches from different jobs got mixed.",
  "ownJobField": "jobNumber",
  "ownWeightField": "abaloneKg",
  "source": "salting-oosw",
  "matchField": "jobNo",
  "sumColumn": "weight",
  "message": "Batch weight exceeding OOSW - possible batch mix"
}
```

## How it runs (for reference, not something you normally need to touch)

1. On finalize (`saveForm`, form-record.js), `runBusinessRules(config, values, editingId)` fetches
   the registry (`/data/business-rules.json`, cached after first load) and filters to rules whose
   `recordKey` matches the current record.
2. Each matching rule runs through a `switch (rule.type)`, dispatching to the matching `checkXxx`
   function.
3. `/api/lookup/:recordKey/:field/:value` (src/index.js) is what supplies the numbers each check
   needs:
   - `__rosterSums` — per-column totals across a *single* matched entry's roster rows (used for
     the cap side, e.g. REC 7.1.5's `weight` roster column).
   - `__matchValueSums` — sum of a numeric top-level field across every *other submitted* entry
     matching the same job (`?excludeId=` skips the record currently being edited) — used for the
     "own total across many separate batch submissions" side.
