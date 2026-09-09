# Definition-extraction report (report-only)

**Date:** 2026-09-09
**Command:** `node scripts/extract-definitions.mjs` (writes nothing)
**Raw output:** `Claude outputs/definition-extraction-report.txt`, `definition-extraction.json`
**Purpose:** size the manual-review backlog for moving record definitions into the DB
(the one open unknown in `relational-all-records-plan.md`).

---

## Headline

| | count |
|---|---:|
| record pages scanned | 131 (7 non-record pages excluded) |
| **map cleanly, zero manual work** | **124** |
| flagged for review | 7 |
| unparseable / no init call | 0 |
| records using declarative autofill | 45 — fully handled by `RecordAutofillDef` |
| engines | 78 form-record · 53 monitoring-log |

**~95% of records are pure declarative** — field list, types, required, options, sections,
rosters, autofill — and lift into `RecordDefinition` + children with no human involvement.

## Field types in use (all safe to map 1:1 to a column)

`text` 686 · `number` 293 · `yesno` 282 · `date` 227 · `select` 121 · `textarea` 96 ·
`jobsearch` 47 · `computed` 9 · `month` 5 · `recordpick` 4 · `timestamp` 3 · `digits` 3 ·
`derived` 2 · `time` 2 · `jobnumber` 1 · `batchseq` 1

`month` → `<input type=month>` / `String`; `timestamp` → `DateTime`; `digits` → integer.
Trivial additions to the generator's type map — not blockers.

## The 7 flagged records — all the same root cause

Every flag is a **computed / derived field backed by a JS function**. That's the one
mechanism that isn't declarative today and needs a home in the definition model.

| Record | Computed/derived fields | Also bespoke? |
|---|---|---|
| REC 7.1.2 Abalone Receiving | `intakeWeight` (sum of roster whole-weights) | **yes** — ~300 lines barcode + scale (`window.Rec*`) |
| REC 7.1.3 Salting & Tumbling | `standardSaltingTime`, `totalTumblingTime` | no |
| REC 7.10.3 Thermometer Verification | `coldDeviation`, `hotDeviation` | no |
| REC 7.10.4 Thermometer Correction Factors | `difference` | no |
| REC 7.2.4 Abalone Packing Specification | `cookoutPct`, `newMinIngo`, `newMaxIngo` | **yes** — `deriveInto` hook |
| REC 7.2.12 Double Seam Inspection | (fields built in `customBody`) | **yes** — `customBody` hook |
| REC 7.5.1 Live Production Pack | `purgeDays`, `purgeLoss` | no |

~15 formulas total. Shapes seen: roster-column sums, `a - b`, `round(x * frac, 2)`,
`ceil(spec / cookoutFrac)`. Small and regular.

## What the backlog actually is

1. **A `computeExpr` mechanism** — one decision. Either a tiny expression DSL
   (`sum(roster.wholeWeight)`, `round(minSpec / cookoutFrac, 2)`) evaluated on the server
   and mirrored client-side, or a named-function registry (`computeExpr: 'cookoutPct'`
   → a function in `public/lib/compute/`). DSL is more "definition is data"; registry is
   less work and keeps the 15 existing functions almost as-is. **Recommend the registry
   first**, DSL later if the list grows.
2. **3 `clientHook` records** — 7.1.2, 7.2.4, 7.2.12 keep their bespoke JS, but as a
   named hook the definition points to, not inline page script. 7.1.2's scale/barcode
   integration is inherently client code and stays that way.
3. **4 field-type variants** (`month`, `timestamp`, `datetime`, `digits`) added to the
   generator's type map — an hour.

Nothing here changes the plan. It confirms the tail is ~7 records and one small design
choice, not a long slog.

## Non-record pages excluded

`_shell-test`, `batch-trace`, `double-seam-trend`, `master-record-index`,
`quick-abalone-receiving`, `record-list`, `seam-quick-calculator` — tools/indexes, no
`.init()` call, not part of the migration.
