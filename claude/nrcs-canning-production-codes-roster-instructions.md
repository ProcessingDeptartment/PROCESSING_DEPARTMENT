# Instruction file for Claude Code

**Task:** On the "Production Information NRCS (Canning)" record, add a roster (repeating table)
that lists every Production code / NRCS AG code already logged against the chosen job number in
Cans Produced (REC 7.2.7) — so the operator doesn't retype data that's already captured — instead
of leaving Production code / NRCS AG code / Product description as single free-text fields with
nothing behind them.

This is a follow-up to `claude/nrcs-canning-batch-search-instructions.md` (already applied) and
its supersession note in `claude/nrcs-canning-batch-search-instructions.md`'s "job number isn't
populating the other cells" fix (also already applied — `receivingDate` now autofills from
`abalone-receiving`). This task covers only Production code / NRCS AG code / Product description.

## Why this needs a roster, not more single-value autofill (read before building)

A canning job routinely has **more than one** Cans Produced (REC 7.2.7) submission — one per can
run/production code (confirmed by reading `public/pages/canning-report.html`'s `buildReport()`,
which already renders a per-job Can Breakdown table from potentially many `cans-produced` rows,
each carrying its own `productionCode` and `nrcsAgCode`/`agCode`). A single text field on the NRCS
Canning page can only ever hold one value, so autofilling it from "the matching record" would
silently drop every code after the first. Michaela confirmed: build this as a roster, not a
single-value autofill.

## Correction: `brineOrBraised` on Cans Produced IS the product description field

An earlier draft of this instruction assumed `brineOrBraised` was only a Brine/Braised medium
indicator and that no product description existed upstream — Michaela corrected this: on
`cans-produced`, `brineOrBraised` **is** the product description field (e.g. "Braised" / "Brine"
describes the product itself, not a separate processing medium). Treat it as the real source for
NRCS Canning's existing "Product description" field — do not leave that field unmapped.

Given that, this task:
- Pulls **Production code**, **NRCS AG code**, and **Product description** (`brineOrBraised`) for
  real, from `cans-produced`, into a new roster.
- Maps the roster's description column to the page's existing top-level **Product description**
  field's meaning — see the roster/fillMap spec below, labelled "Product description" (not
  "Medium").

---

## Engine change (small, general-purpose): let `recordpick` fill more than two columns

Today `recordpick`/`jobtrace` (`wireRecordPick` in `public/lib/form-record.js`, ~line 415) can
only fill exactly two hardcoded target columns per picked row (`fillCode`, `fillName`), and
`jobTraceOptions()` (~line 392) only returns index metadata (`record_key`, `submission_id`,
`stage`, `href`) — never the picked submission's actual field values. This is the reason the
Production code / AG code table can't just reuse the existing roster's `recordpick` column
as-is: there's nowhere for the extra values to come from or go to.

Do not build a parallel one-off mechanism just for this page. Extend the existing, generic
`recordpick` machinery so any record can use it this way in future:

### 1. `jobTraceOptions()` — carry the submission's own values along with each option

`window.Traceability.trace(jobNo)` already resolves to specific submissions
(`record_key` + `submission_id`) per `public/lib/traceability.js`. Extend `jobTraceOptions()` to
also fetch and attach that submission's `values` object to each returned option (e.g. as
`values: r.values || {}` — check what `Traceability.trace()` already returns before adding a new
lookup; if it doesn't currently include the submission body, extend it to, since the index already
knows which submission each row is — don't add a second independent fetch path).

### 2. `recordpick` field config — support an arbitrary fill map, not just `fillCode`/`fillName`

Add a new optional column config key, e.g. `fillMap: { targetColumnKey: 'sourceValueKey', ... }`.
In `wireRecordPick`'s `change` handler (~line 445), after the existing `fillName`/`fillCode`
handling, also apply `fillMap`: for each `[targetColumnKey, sourceValueKey]` pair, look up
`opt.dataset` (extend the `<option>` rendering at ~line 438 to also serialize the needed
`values` entries into `data-*` attributes, the same pattern already used for `data-code`/
`data-name`) and write into the matching roster-row cell, same as the existing two fills do.
Keep `fillCode`/`fillName` working unchanged — this is additive, not a replacement.

### 3. Filter jobtrace options to only `cans-produced` submissions, on this one roster column

The existing `jobtrace` picker (already used by the "Records for this job" roster column on this
same page) intentionally shows every record type filed against the job. This **new** roster needs
only `cans-produced` entries. Add an optional column config key, e.g. `sourceRecordKey:
'cans-produced'`, and in `jobTraceOptions()`/`wireRecordPick`, when a column declares it, filter
`opts` to `r.record_key === column.sourceRecordKey` before rendering. This keeps the general
`jobtrace` mechanism reusable for any single-record-type picker in future, not just this page.

---

## File 1 of 1 (page config): `public/records/Production-Information-NRCS-(Canning)-production-information-nrcs.html`

Add a second roster block for Production codes, right after the existing "Records included"
roster. `FormRecord.init` currently only supports one `roster` key — check whether it already
supports multiple named rosters (search for other records with more than one roster block in
`public/records/*.html` or in `data/record-definitions.json`); if not, this needs one more small,
general engine change: accept `rosters: [{ key, title, columns, ... }, ...]` alongside (or
replacing) the single `roster` key, rendering each as its own repeating table. Do not special-case
"a second table" just for this page — make the engine support N rosters generally, since other
records will likely want the same pattern later (e.g. the stock-code-level Can Breakdown table
already planned for `canning-report.html` per `claude/canning-report-layout-spec.md` §7).

New roster to add:

```js
{
  key: 'productionCodes',
  title: 'Production codes for this job — pulled from Cans Produced (REC 7.2.7) records filed against the job number above',
  columns: [
    { key: 'submissionRef', label: 'Cans Produced record', type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', sourceRecordKey: 'cans-produced', fillMap: { productionCode: 'productionCode', nrcsAgCode: 'nrcsAgCode', productDescription: 'brineOrBraised' } },
    { key: 'productionCode', label: 'Production code', type: 'text' },
    { key: 'nrcsAgCode', label: 'NRCS AG code', type: 'text' },
    { key: 'productDescription', label: 'Product description', type: 'text' }
  ]
}
```

Notes on the mapping above:
- `nrcsAgCode` on `cans-produced` — confirm the exact stored key before wiring; `canning-report.html`
  reads it defensively as `v.nrcsAgCode || v.agCode`, meaning different submissions may have used
  either key historically. Map `fillMap` from whichever key is actually present on the matched
  submission (mirror that same `||` fallback when reading `values` in step 1 above, don't assume
  only one key name).
- `productDescription` on the roster row is sourced from `brineOrBraised` on the matched
  `cans-produced` submission — confirmed by Michaela to be the real product description field,
  despite its field-key name suggesting otherwise. Don't relabel or second-guess this mapping.

### The top-level "Product description" field (Batch details section)

This page already has a single top-level `productDescription` text field (added originally, still
present). Since a job can have multiple `cans-produced` rows with potentially different
descriptions (e.g. different production runs described differently), the roster is the correct
place for per-row descriptions — do not try to also autofill the single top-level field from
multiple roster rows (same reasoning as Production code / NRCS AG code: one field can't hold many
values). Leave the top-level field as manual free text, OR, if Michaela wants it removed now that
the roster covers this per-row, flag that as an open question rather than deleting it
unilaterally — it's a page layout decision, not implied by this task.

Also add one line to the page's existing `instructions` array explaining the new table, e.g.:

```js
{ label: 'Production codes table', text: 'Each row here picks a specific Cans Produced (REC 7.2.7) submission for this job number and pulls in its production code, NRCS AG code, and product description automatically. Add one row per can run.' }
```

---

## Testing checklist

1. Open a job with two or more existing Cans Produced submissions (different production codes).
   Enter that job number in NRCS Canning's "Job no." field.
2. In the new Production codes roster, add a row, open the "Cans Produced record" picker, and
   confirm it lists only the `cans-produced` submissions for that job (not other record types).
3. Pick one — confirm Production code, NRCS AG code, and Product description fill in automatically
   on that row, and that the existing "Records for this job" roster (the other picker on this same
   page) is unaffected by this change.
4. Add a second row and pick the other Cans Produced submission — confirm both rows hold correct,
   distinct values (this is the case a single-field autofill could not have handled).
5. Confirm the standalone top-level "Product description" field still behaves as plain free text —
   no autofill attempted, no error (see the open question above on whether it should stay).
6. Save the record and confirm both rosters persist correctly on reopen.
