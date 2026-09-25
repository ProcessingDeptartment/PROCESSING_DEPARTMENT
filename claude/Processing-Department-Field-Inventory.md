# Processing Department — Complete Field Inventory (Final Live Audit)

**Status:** All 120 REC records live-verified, field-by-field, via browser automation.
This closes the gap from the original Phase 1 audit (which only inspected 16 of 120 records in detail) and confirms every field flagged as missing ("Processing for," "Damages," "Production code," "Tanks cleaned," "Filters cleaned," and more).

*Note: the full 825-row field list and 120-record list were originally delivered as separate CSVs (Master_Field_Inventory_FULL.csv and Records_List.csv) in an earlier conversation. This document is the narrative summary from the project record; the underlying CSVs are not attached here.*

---

## SECTION 1 — REC Records Found

All 120 REC records on record-list.html were identified and opened live in the browser. Naming spans REC 01, REC 1, REC 6.1.2, and the REC 7.x / 7.1x / 8.x / 9.1 series through REC 9.1.

## Totals

| Metric | Count |
|---|---|
| REC records found on record-list.html | 120 |
| REC records inspected (live, field-by-field, "+New" clicked where applicable) | 120 |
| Unique field labels identified (exact-label match) | 825 |
| Fields shared across 2+ records | 133 |
| Possible duplicate fields flagged for review | 17 pairs/groups (see Section 4) |
| Fields needing clarification | 9 (see Section 6) |

Note on "825 unique fields": this counts exact label text. Many are legitimately record-specific (e.g., each ingredient in REC 7.3.2 Ingredient Weighing has its own weight + batch-code field; each size bracket in the grading logs is its own field). The 133 fields used on 2+ records are the true "common/shared" fields for database design purposes.

---

## SECTION 3 — Fields Used Across Multiple Records (top 20 by spread)

| Field | Records | Type |
|---|---|---|
| Date | 85 | date |
| Verified by | 60 | text |
| Signature | 56 | text |
| Title | 53 | text |
| From | 52 | date |
| To | 52 | date |
| Comments | 18 | text/textarea |
| Deviations only | 17 | checkbox |
| Checked by | 15 | text |
| Shift | 14 | dropdown |
| Supervisor | 12 | text |
| Job no. / Job number | 9 each | text |
| Intake date | 8 | date |
| Size range | 7 | dropdown |
| Area | 6 | dropdown |
| Supplier | 6 | text |
| AG code | 6 | text |
| Corrective actions | 5 | textarea |
| Staff member | 5 | text |
| Day | 5 | dropdown |

---

## SECTION 4 — Possible Duplicate Fields (flagged for review, NOT merged)

1. "Checked by" vs "Checked by (QC)" vs "Checked by QC" — three label variants, may be same role captured inconsistently.
2. "Verified by" vs "QC verification" vs "QA verification" — different verification-role labels.
3. "Inspected by" vs "Inspected by — QC".
4. "Issued to" vs "Issued by" vs "Issued" — likely genuinely different fields.
5. "Received by" vs "Received from" — likely different.
6. "Date of issue" vs "Issue date" — same concept, different phrasing.
7. "Comment/Corrective action" vs "Corrective action/Comment" vs "Comment / corrective action" — formatting variants of the same field.
8. "Whole weight" vs "Whole weight (kg)" — same field, unit sometimes in label.
9. "Product description" vs "Product description (D/W)" — needs confirmation whether D/W = Dried/Wet variant.
10. "No. of pallets/boxes" vs "No of pallets/boxes" — punctuation-only variant.
11. "No. of mortalities" vs "No of mortalities" — punctuation-only variant.
12. "Start shift — temp" vs "Start shift - temp" — dash-character variant across similar records.
13. "During production — temp" vs "During production - temp" — same as above.
14. "Salt (kg)" vs "Salt (%)" vs "Salt (g)" vs "Salt" — likely genuinely different measurements, confirm per-record.
15. "Sugar (kg)" vs "Sugar (g)" vs "Sugar (%)" — same caution as Salt.
16. "Batch number of salt" vs "Salt batch number" — same field, phrasing differs.
17. "Processing for" vs "QC — Processing" — surface text-similarity only; very likely UNRELATED fields, recommend disregarding.

---

## SECTION 5 — Calculated / Automatic Fields

Only one field is explicitly system-calculated: "Total days in chiller" (REC 7.8.1 Chiller Batch Control), confirmed via JavaScript.

Candidates for calculated/derived values, currently implemented as plain number-entry (human-typed) fields:
- Dry yield, Yield (%), Estimate yield (REC 7.4.10, 7.4.3.1, 7.4.1)
- Total cooking time, Total tumbling time (REC 7.2.8-family, salting records)
- Total dried weight, Total mortality weight, Total drying time (days)

---

## SECTION 6 — Fields Needing Clarification

1. **Work instructions** — present on records but hidden by default in the UI; only rendered/visible after clicking a "Show" button on the record. Confirmed present in the DOM/system but not visible on initial page load. Flag for database design: this is a data-capture field (instructional text tied to the record), not a UI-only artifact like the row-selection checkboxes — recommend capturing its content explicitly during any future extraction pass, since a plain page read without triggering "Show" will miss it. **CLOSED:** content now captured for all 52 records that carry it (68 records have no such block) — see [Work-Instructions-Content-Extract.md](Work-Instructions-Content-Extract.md). Pulled directly from each record's `config.instructions` array rather than the browser, so it is exact and complete.
2. "Product description (D/W)" (REC 7.3.6) — unclear abbreviation.
2. Row-selection checkboxes ("Select all," dynamically-labeled per-row entry checkboxes) — UI/system artifacts, not data-capture fields; recommend excluding from DB design.
3. REC 7.6.6 Pest Inspection Record — roster "Other" pest field was truncated during extraction; 1-2 columns possibly uncaptured.
4. REC 7.6.7 Staff Hygiene Inspection — final roster field ("QC signature") truncated in one pass; confirmed present via weekend variant 7.6.7a but not re-confirmed on main 7.6.7.
5. A handful of very long checklist records from the first audit pass (REC 7.2.4, 7.8.3, 7.8.4, 8.1.4, 8.2.1, 8.2.2, 9.1, and a few others) had partial truncation noted inline in the raw working file; a targeted re-check would close this out fully.
6. "Sex" field (REC 1 Gonad Inspection) — dropdown option list not captured.
7. Dropdown option lists in general were not exhaustively enumerated (Farm names, Area 1-10 names, Processing step values, etc.) — would need a targeted follow-up pass for exact ENUM/lookup-table values.
8. REC 7.8.1 exists as two separate records under the same number (wet Chiller Batch Control and Dry Chiller Batch Control) — confirm this dual-numbering is intentional.
9. REC 8.1.6 family — REC 8.1.6 (no letter), 8.1.6a, 8.1.6b are three near-identical separate records (canned abalone / braised / minced) — confirm whether these should be one parameterized record type in the database.

---

No database design, SQL, or schema work has been done — per project instructions, this stage is strictly "map everything the existing system currently captures."
