# Note: "Production code" vs "AG code" — are they the same identifier?

**Status:** Open question, with strong evidence they are DIFFERENT. Nothing merged, no
validation applied outside REC 7.1.
**Raised by:** the REC 7.1 field-change work, which added an `^AG[0-9]{6}$` format rule to
`productionCode` on that one record. Before that rule spreads anywhere else, this needs an answer.
**Method:** static read of every `entryFields` / `sections` config in
`PROCESSING_DEPARTMENT/public/records/*.html`. Exact-label counts here match the live audit in
`Processing-Department-Field-Inventory.md` (that doc counts "AG code" on 6 records; so does this),
which is a decent cross-check that nothing was missed.

---

## The evidence that they are NOT the same field

Three records carry **both fields, side by side, in the same section**:

| Record | File |
|---|---|
| Production Information NRCS (Canning) | `Production-Information-NRCS-(Canning)-production-information-nrcs.html` |
| Production Information NRCS (Rework) | `Production-Information-NRCS-(Rework)-production-information-nrcs-rework.html` |
| Production Information NRCS (Dry) | `Production-Information-NRCS-(Dry)-dry-nrcs-packs.html` (AG code only — see below) |

In the Canning and Rework records the "Batch details" section reads:

```js
{ key: 'productionCode', label: 'Production code', type: 'text' },
{ key: 'nrcsAgCode',     label: 'NRCS AG code',    type: 'text' },
```

Two adjacent fields, two different keys, on the same form. An operator filling that record is
being asked for two values. That is hard to explain if they are one identifier under two labels.

**Working conclusion:** they are distinct. The AG code looks like an NRCS-facing
(regulatory / export inspection) identifier; the production code looks like an internal
batch/run identifier. **This needs confirming with QC before it is treated as settled** —
it is inference from form layout, not from anyone who uses the records.

---

## Where each field appears

### "Production code" — exact label, 7 records

| Record | Key | Required |
|---|---|---|
| REC 7.1 Incubator Cans Log | `productionCode` | yes — **and now format-validated** |
| REC 7.2.7 Cans Produced | `productionCode` | no |
| REC 7.2.8 Retorting Control Sheet | `productionCode` | no |
| REC 7.2.11 QC Report | `productionCode` | no |
| REC 8.1.3 Disposition Investigation Record | `productionCode` | no |
| Production Information NRCS (Canning) | `productionCode` | no |
| Production Information NRCS (Rework) | `productionCode` | no |

Plus one compound variant:
- REC 8.1.4 Withdrawal / Mock Recall — `productionCodePackingDate`, label
  "Production code / packing date". Two data items in one text box; worth splitting if this
  identifier ever becomes a lookup key.

### "AG code" — exact label, 6 records

REC 01 Cans Released (`agCode`), REC 7.2.16 Stock Transfers (`agCode`), and the four
traceability mock-recall records — REC 8.1.6 (canned), 8.1.6a (braised), 8.1.6b (minced),
8.1.7 (dried), all `agCode`.

### AG code — label variants, 8 more records

| Record | Key | Label |
|---|---|---|
| Production Information NRCS (Canning) | `nrcsAgCode` | NRCS AG code |
| Production Information NRCS (Dry) | `nrcsAgCode` | NRCS AG code |
| Production Information NRCS (Rework) | `nrcsAgCode` | NRCS AG code |
| REC 7.4.8 Dry Labelling List | `agCode` | NRCS AG code |
| REC 7.2.10 Stock Loading | `agCode` | AG |
| REC 7.2.6 Can Filling & Printing | `printedAgCode` | Printed AG code |
| REC 7.4.7 Labelling of Dry Boxes | `agCodeMatchesInspection` | NRCS AG code matches inspection report? (yes/no — a check, not a capture) |
| REC 7.2 Sampling Log | `productInfo` | Product information (AG code, DW / dry job no. / live tag / ranched incoming date) — free-text catch-all holding an AG code among other things |

Note the key drift inside the AG family alone: `agCode`, `nrcsAgCode`, `printedAgCode`, and one
buried inside `productInfo`. "AG" vs "AG code" vs "NRCS AG code" may be three labels for one
value, or `printedAgCode` may genuinely be *what was printed on the can* as distinct from what
should have been — that distinction matters for REC 7.2.6, which is a verification step.

---

## What this blocks

1. **The `^AG[0-9]{6}$` rule currently exists on exactly one field on one record** (REC 7.1
   `productionCode`). Every other Production code and every AG code field still accepts any text.
   If the format belongs to AG codes rather than production codes, the rule is on the wrong
   field and REC 7.1 is now rejecting valid production codes.
2. **No AG code field is validated anywhere**, including REC 01 Cans Released, which is the
   release gate, and the four mock-recall records, where a mistyped code is exactly the failure
   a mock recall is supposed to catch.
3. Neither identifier is a lookup key anywhere yet — unlike Job no., which is a pick-list from
   open jobs. Both are currently free text on every record.

## Update — partial answer from Michaela (2026-08-31)

While specifying the REC 7.1 staged rework, Michaela referred to that record's **Production code**
field as "the ag code" ("then the ag code, pieces, qty and description must be visible").

So on REC 7.1 at least, Production code *is* the AG code — which supports leaving the
`^AG[0-9]{6}$` rule where it is on that record. It does **not** resolve the wider question: the
NRCS records still carry `productionCode` and `nrcsAgCode` as two separate adjacent fields, so
one of the following must be true and it is not yet known which:

- The two are genuinely different on NRCS records, and REC 7.1's "Production code" is mislabelled
  (it should read "AG code" to match the 6 records that already use that label); or
- They are the same identifier throughout, and the NRCS records are capturing it twice.

Either way one set of labels is wrong. Still needs QC to settle it.

## Questions for QC

1. Are "Production code" and "AG code" two different identifiers? (Form layout says yes.)
2. Which one, if either, has the format `AG` + 6 digits? Is the "AG" prefix literal, or does it
   stand for something that varies?
3. Is "Printed AG code" (REC 7.2.6) the same value as "AG code", or deliberately the
   as-printed value being checked against an expected one?
4. Should "AG" (REC 7.2.10) and "NRCS AG code" be relabelled to match the majority "AG code"?

**Nothing above has been changed.** No labels merged, no keys renamed, no validation added
beyond the single REC 7.1 field.
