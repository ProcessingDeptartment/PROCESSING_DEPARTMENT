# Drying Report — Data Source Fix: pull cooking data from REC 7.4.0

**Status:** Instructions only, no code written. For Claude Code.
**Date:** 2026-10-09
**Raised by:** Michaela — "the info is not pulling through to the drying reports"
**Scope:** `public/pages/drying-report.html` data source fix only. No layout changes, no new sections, no changes to any record form.
**Relates to:** `drying-report-spec.md` (the original build spec), `MD/rec-7.4.0-temporary-entry-flow-instructions.md` (the temporary entry flow)

---

## 1. The problem

The drying report spec (`drying-report-spec.md`) was written to pull cooking data — cooking date, cooking weight, steam dates — from **REC 7.4.1 (Drying Process)**. But in practice, REC 7.4.1 is not being filled in first. The cooking data (job number, cooking weight, cooking date) is going directly into **REC 7.4.0 (Dry Cooking)**. Because the report only looks at 7.4.1, it shows blanks for everything cooking-related.

---

## 2. What needs to change in the drying report

### 2.1 Cooking weight — read from REC 7.4.0, not 7.4.1

**Current:** `cookingWeight` is read from REC 7.4.1 (`drying-process` record, field `cookingWeight`).

**Fix:** Read cooking weight from REC 7.4.0 submissions instead, using the same lookup pattern already used elsewhere in the system (`window.Traceability.trace(jobNo)` / `job_no` match):

- Query all **submitted** REC 7.4.0 entries for the job.
- If `dry_cooking_pot` child table exists: sum `abalone_kg` where `process = 'Cooking'` across all submitted pot rows for the job. This is the full build path.
- If `dry_cooking_pot` does NOT exist yet (data stored as JSON blob in parent row): sum `abaloneKg` from the `submission_json` blob across all submitted 7.4.0 entries for the job, reading only pot entries where `process = 'Cooking'` (or where the data is in the cooking section of the old layout). Fall back to the parent row's total `abaloneKg` if no process distinction is available.
- If no 7.4.0 entries exist for the job: check 7.4.1 as a fallback (keep the old path as fallback only). If neither has data: show dash with note "No cooking weight found — enter REC 7.4.0".

**Label on report:** "Cooking weight (kg)" — unchanged.

### 2.2 Cooking date — read from REC 7.4.0, not 7.4.1

**Current:** `cookingDate` is read from REC 7.4.1 field `cookingDate`.

**Fix:** Read from REC 7.4.0 instead:

- Use `record_date` from the submitted REC 7.4.0 entry for the job (the date the entry was completed — this is the cooking date per the temporary entry flow spec).
- If the job has multiple 7.4.0 entries (multiple cooking runs): use the **earliest** `record_date` as the primary cooking date, and show a note "Cooked over N dates" if more than one.
- Fallback: if no 7.4.0, check 7.4.1 `cookingDate`. If neither: show dash.

**Label on report:** "Cooking date" — unchanged.

### 2.3 OOSW weight — add to the report (new, from temporary entry flow)

The temporary entry flow (`MD/rec-7.4.0-temporary-entry-flow-instructions.md`) captures `oosw_kg_manual` on the REC 7.4.0 parent row. Show this in the drying report's yield summary section (section 2 of the report):

- **OOSW weight (kg):** `oosw_kg_manual` from the job's REC 7.4.0 entry.
- If null/empty: show dash with note "Not recorded on REC 7.4.0".
- This is a temporary display. When REC 7.1.5 is properly submitted, this field will come from there. Leave a code comment: `// TODO: replace oosw_kg_manual with lookup from REC 7.1.5 when available`.

### 2.4 Steam dates, movement dates — still from REC 7.4.1

These are NOT changing. Steam dates and movement dates come from REC 7.4.1 as the spec says. If 7.4.1 hasn't been filled in, those sections show their existing "No data yet" blanks. Do not attempt to read these from 7.4.0.

### 2.5 Everything else — unchanged

All other data sources in the drying report stay exactly as `drying-report-spec.md` specifies:
- Job header: `abalone-receiving`
- Grading breakdown: REC 7.4.3.1
- Yield summary (dry weight, yield %): REC 7.4.3.1 / 7.4.1 fallback

---

## 3. Lookup pattern to use

Use the same job-data lookup the rest of the system uses. Do not build a new data path. The existing `window.Traceability.trace(jobNo)` or equivalent server-side query already returns all submissions for a job. Filter to `recordKey = 'dry-cooking'` (or whatever the REC 7.4.0 key is — check the record definition) and `status = 'submitted'`.

**Check the actual recordKey** for REC 7.4.0 in `public/data/record-defs/dry-cooking.json` (or `record-definitions.json`) before writing the query. Do not assume — the key used in storage may differ from the display name.

---

## 4. Fallback hierarchy (summary)

For each field that is changing, the fallback order is:

| Field | Primary source | Fallback | If neither |
|-------|---------------|----------|------------|
| Cooking weight | REC 7.4.0 (pot rows or JSON) | REC 7.4.1 `cookingWeight` | Dash + note |
| Cooking date | REC 7.4.0 `record_date` | REC 7.4.1 `cookingDate` | Dash + note |
| OOSW weight | REC 7.4.0 `oosw_kg_manual` | *(none yet)* | Dash + note |

---

## 5. Testing checklist

Run on the live site at https://processing-department.onrender.com:

1. Open drying-report.html and select a DPR job that has a submitted REC 7.4.0 entry but NO submitted REC 7.4.1. Confirm: cooking weight and cooking date now populate from 7.4.0 (not blank).
2. Select a DPR job that has both 7.4.0 and 7.4.1 submitted. Confirm: cooking weight and date come from 7.4.0 (primary source), not 7.4.1.
3. Select a DPR job with 7.4.0 data that has `oosw_kg_manual` set. Confirm: OOSW weight shows in the yield summary.
4. Select a DPR job with NO 7.4.0 and HAS 7.4.1. Confirm: cooking weight and date fall back to 7.4.1 (not blank).
5. Select a DPR job with no cooking records at all. Confirm: dash shown with the "No cooking weight found" note — no error thrown.
6. Steam dates section: confirm it still reads from 7.4.1 and is unaffected by this change.
7. Grading section: confirm it still reads from 7.4.3.1 and is unaffected.

---

## 6. Do NOT change

- The drying report layout, section order or styling
- Any record form (7.4.0, 7.4.1, 7.4.3.1 forms are untouched)
- The grading data source (stays 7.4.3.1)
- The steam/movement data source (stays 7.4.1)
- The job number prefix filter (DPR/3DP only — keep as is)
- The CSV export column names or structure
