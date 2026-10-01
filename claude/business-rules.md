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
| `ownWeightField` | this record's own numeric field to total. If it is a column of the record's roster, the roster column is totalled across all rows (this entry's rows plus earlier submitted entries' rows) |
| `ownRowFilter` | optional `{ "column": "process", "equals": "Cooking" }` (or `"in": [...]` for several values) - with a roster column, count only rows whose `column` matches |
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
  "ownJobField": "jobNo",
  "ownWeightField": "abaloneKg",
  "ownRowFilter": { "column": "process", "equals": "Cooking" },
  "source": "salting-oosw",
  "matchField": "jobNo",
  "sumColumn": "weight",
  "message": "Cooking pot weight exceeding OOSW - possible batch mix"
}
```

### `capRowsAgainstRows`

The total of this record's roster rows matching `rowFilter`, **across every submitted entry for the
job plus the rows being saved now**, must not exceed the total of the rows matching `capFilter`.
Both are totals of the same roster column, compared as whole-job totals (equal passes), so card
order and which entry a card was saved on do not matter. Soft gate with the same override stamp as
`capAgainstOtherRecord`: each overridden rule adds its own line to `oosWarningNote` (one line per
rule), shown red on screen and on the printed sheet.

| key | meaning |
|---|---|
| `ownJobField` | this record's own field holding the job number |
| `column` | the roster column to total |
| `capFilter` | `{ "column": "process", "equals": "Blanching" }` - the rows that form the cap |
| `rowFilter` | `{ "column": "process", "equals": "Cooking" }` - the rows that must stay within it. Must use the same `column` as `capFilter` (the server groups by that column) |
| `legacyColumn` | optional roster column; rows where it is Yes/true are left out of the `rowFilter` side (REC 7.4.0 migrated cooking-only cards, `legacyNoBlanching`) |
| `message` | the warning line shown on override / view / print |

Worked example (REC 7.4.0, R3 - cannot cook more than was blanched):

```json
{
  "recordKey": "dry-cooking",
  "type": "capRowsAgainstRows",
  "ownJobField": "jobNo",
  "column": "abaloneKg",
  "capFilter": { "column": "process", "equals": "Blanching" },
  "rowFilter": { "column": "process", "equals": "Cooking" },
  "legacyColumn": "legacyNoBlanching",
  "message": "Cooking weight exceeds blanched weight - cooked more than was blanched"
}
```

REC 7.4.0 therefore runs three rules: R1 Cooking vs OOSW and R2 Blanching vs OOSW (both
`capAgainstOtherRecord`, differing only in `ownRowFilter`) and R3 Cooking vs Blanching.

The live "Available to blanch / Available to cook" figures on that record are not a rule; they
come from the roster's `jobWeights` setting (see `scripts/apply-dry-cooking-weights.mjs`) and use
the same server numbers.

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
   - `__matchRosterSum` - when the request carries `?rosterCol=&filterCol=&filterIn=a,b`, the sum of that
     roster column over the other submitted entries' rows whose `filterCol` value is in `filterIn`
     (REC 7.4.0: kg of Cooking pot cards).
   - `__matchRosterGroupSums` / `__matchRosterGroupLegacy` - when the request also carries
     `&groupCol=process&legacyCol=legacyNoBlanching`: the roster-column total per value of
     `groupCol` over the other submitted entries (REC 7.4.0: kg per process), and the part of it
     on rows whose `legacyCol` flag is Yes. Feeds `capRowsAgainstRows` and the live figures.
   - `__matchValueSums` — sum of a numeric top-level field across every *other submitted* entry
     matching the same job (`?excludeId=` skips the record currently being edited) — used for the
     "own total across many separate batch submissions" side.
