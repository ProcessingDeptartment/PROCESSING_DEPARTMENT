# Note: "Checked by" vs "Checked by (QC)" — label and key variants

**Status:** Mostly resolved by evidence. Two small inconsistencies worth fixing; one real
question left for QC. Nothing changed.
**Raised by:** Section 4 item 1 of `Processing-Department-Field-Inventory.md`, which flagged
"Checked by" / "Checked by (QC)" / "Checked by QC" as possibly the same role captured
inconsistently.
**Method:** static read of every field config in `PROCESSING_DEPARTMENT/public/records/*.html`.

---

## The short answer

They are **two different fields, and the code already treats them that way.** The storage keys
split cleanly along the same line as the labels:

- `checkedBy` — a general "who checked this" signature, on operational/monitoring logs.
- `checkedByQC` — a QC-role sign-off, on release, inspection and NRCS records.

**No record carries both.** (Verified: no file in `public/records/` contains both
`key: 'checkedBy'` and `checkedByQC`.) So there is no case of one form asking for the same
thing twice — the two keys are used by disjoint sets of records. That is the strongest argument
that the split is intentional rather than accidental drift.

---

## `checkedByQC` — 9 records

| Record | Label | Required |
|---|---|---|
| REC 01 Cans Released | Checked by (QC) | yes |
| QA 01 Damaged Cans & Lids | Checked by (QC) | no |
| Production Information NRCS (Canning) | Checked by (QC) | yes |
| Production Information NRCS (Dry) | Checked by (QC) | yes |
| Production Information NRCS (Rework) | Checked by (QC) | yes |
| Dry Export Pack Front Page | Checked by (QC) | no |
| REC 7.5.1 Live Production Pack | Checked by (QC) | no |
| REC 7.5.4 Individual Abalone Weight Checks | Checked by (QC) | yes |
| REC 7.2.13 Rework Log | **Checked by QC** (no brackets) | no |

These are release gates, NRCS submissions and QC inspections — a QC-specific sign-off makes
sense on all of them.

## `checkedBy` — 20 records

REC 7.1 Incubator Cans Log, 7.2.10 Stock Loading, 7.6.2 Weekly Cleaning, 7.6.2.2 Dispatch
Cleaning Inspection, 7.7.1 Daily Equipment Checklist, 7.7.4 Utensil Issue, 7.8.8 Dispatch
Loading, 7.8.8.1 Dispatch Receiving, 7.8.9 Water Monitoring, 7.8.9.1 LHA Water Monitoring,
7.8.12 Factory Maintenance, 7.8.12.1 Equipment Checklist (Roof), 7.9.1 Chiller Temperature,
7.9.2 Incubator Temperature, 7.9.3.1 Dry Room Temp/Humidity, 7.9.3.2 Grading Room
Temp/Humidity, 7.10.2 pH Verification (twice — once per section), 7.10.3 Thermometer
Verification, 7.10.4 Thermometer Correction Factors.

Cleaning, equipment, temperature and calibration logs — routine monitoring, checked by whoever
is on shift. Almost all are `required: true`.

---

## Three inconsistencies found

### 1. REC 7.2.13 Rework Log — label typo (cosmetic, safe to fix)

```js
{ key: 'checkedByQC', label: 'Checked by QC', type: 'text' }
```

Correct key, correct group — the label is just missing its brackets. The other 8 QC records
all read "Checked by (QC)". This is the third variant the inventory flagged, and it is nothing
more than a typo. **Recommend: relabel to "Checked by (QC)".** No key change, no data impact.

### 2. Two records use a QC label on the non-QC key (needs a decision)

| Record | Key | Label |
|---|---|---|
| REC 1 Gonad Inspection Report | `checkedBy` | QC online — checked by |
| REC 7.2.2 Scrubbing Checklist (QC) | `checkedBy` | QC online — checked by |

Both are explicitly QC activities — 7.2.2 has "QC" in its own record title — but they store
into `checkedBy`, not `checkedByQC`. So the clean key/label split described above has exactly
two exceptions, and they are the two "QC online" records.

This is the one item that is **not** safe to fix unilaterally. Renaming the key to
`checkedByQC` would align them with the other QC records, but any already-saved entries on
these two records store their value under `checkedBy` — changing the key orphans that data
unless it is migrated. Needs a decision before touching, same as the REC 7.1 datetime
migration question.

Also possible that "QC online" is deliberately a *third* role — QC stationed on the line,
distinct from QC signing off a finished batch — in which case the current key is wrong in a
different way and it should be its own field. Worth asking.

### 3. REC 7.8.4 Seamer Inspection — two stage-qualified variants (working as intended)

```js
{ key: 'checkedByBefore', label: 'Before production — checked by' },
{ key: 'checkedByEnd',    label: 'End of day — checked by', required: true },
```

Same person-check captured at two points in the day. These are genuinely two fields, correctly
keyed and clearly labelled. **No action.** Noting it only so it is not mistaken for drift in a
future audit.

---

## Recommended actions

| # | Action | Risk |
|---|---|---|
| 1 | REC 7.2.13: relabel "Checked by QC" → "Checked by (QC)" | None — label only |
| 2 | REC 1 and REC 7.2.2: decide whether "QC online — checked by" should key to `checkedByQC`, stay `checkedBy`, or become its own field | **Data migration** if the key changes |
| 3 | Leave REC 7.8.4 alone | — |

Ask QC: is "QC online" a distinct role from the QC who signs off a release record, or the
same person at a different moment?

**Nothing above has been changed.**
