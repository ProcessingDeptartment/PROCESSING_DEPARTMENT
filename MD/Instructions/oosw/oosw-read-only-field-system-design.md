# OOSW Read-Only Field System Design
## Removing Manual Entry and Linking to Cooking Weight Rules

**Date:** 2026-10-21  
**Status:** Design & Outline (no code written)  
**Author:** Claude Haiku 4.5  
**Scope:** REC 7.4.0 (Dry Cooking) — OOSW field transformation from manual input to read-only linked field  
**Project:** Processing System  
**Database:** Neon PostgreSQL (free tier)

---

## 1. Executive Summary

The OOSW (Out-Of-Shell Weight) field on the REC 7.4.0 Dry Cooking form is currently a **manual typed input** field (`ooswKg`) in the Job Info section. This change removes that manual entry capability and replaces it with a **read-only field that pulls from REC 7.1.5 (Salting OOSW) and applies business rules** based on cooking and blanching weight data.

**Key changes:**
- Remove the manual `ooswKg` input field from the Job Info section.
- Replace with a read-only OOSW display field that fetches the total from REC 7.1.5.
- Link the read-only field to three weight-checking rules (R1, R2, R3) that are applied during entry and finalization.
- Remove the temporary database column `oosw_kg_manual`.
- Build database views to show job-level weight traceability and trends.

---

## 2. Current State Analysis

### 2.1 What exists today

**REC 7.4.0 Dry Cooking form:**
- Job Info section with autofilled fields (job number, processing for, whole weight, harvest farm, intake date).
- Manual `ooswKg` input field (numeric, decimal allowed, not required).
- "Available to cook" display line (calculated as `ooswKg − sum of cooked kg` across submitted entries).
- Two-pot entry system (Blanching and Cooking cards) with per-pot weight fields.
- Database column `oosw_kg_manual` (NUMERIC) — temporary scaffolding.

**REC 7.1.5 Salting OOSW:**
- Operator submits total OOSW weight broken down by size ranges (0–50 g, 50–100 g, etc.).
- Each submission is a roster with total OOSW available for a job.
- Already in use; operators are actively submitting these records.

**Weight rules:**
- **R1** (Cooking vs OOSW): `sum(Cooking kg) ≤ OOSW` — prevents cooking more than OOSW.
- Implemented as a soft gate at Finalize (confirm dialog to override).

### 2.2 Problem statement

1. **Dual source of truth:** OOSW is manually typed on REC 7.4.0 *and* formally recorded on REC 7.1.5. If the values don't match, there is confusion and data integrity risk.
2. **Operator error:** Manual typing introduces transcription errors. Operators may misread the paper record or type the wrong figure.
3. **Traceability:** It is unclear whether OOSW came from the formal REC 7.1.5 submission or was guessed from a draft.
4. **Incomplete rules:** The blanching weight rule (R2) and blanching-vs-cooking rule (R3) are designed but not yet live, and they lack the infrastructure to pull OOSW reliably.
5. **Database scaffolding:** The `oosw_kg_manual` column is temporary and must be cleaned up once the proper lookup is in place.

---

## 3. System Design

### 3.1 Data flow architecture

```
REC 7.1.5 Salting Record (submitted)
    ↓
    └─→ Fetch OOSW total (sum of all size-range weights)
        ↓
        └─→ Store in cache at job-lookup time
            ↓
            ├─→ Display in Job Info section (read-only)
            │
            ├─→ Apply to Weight Rule R1 (Cooking ≤ OOSW)
            │
            ├─→ Apply to Weight Rule R2 (Blanching ≤ OOSW)
            │
            └─→ Calculate "Available to blanch" and "Available to cook"
                ├─→ Show on screen (grey tally line)
                ├─→ Show per-card (under weight field)
                └─→ Update live as operator types
```

### 3.2 Key design decisions

1. **No manual OOSW field:** The input field is removed entirely. If no REC 7.1.5 record exists for the job, show "OOSW not recorded" in a muted style (same as other missing job info).
2. **Fetch once, compute locally:** The job lookup returns OOSW and per-process totals from submitted entries. The form then recomputes all figures in JavaScript without polling the server on every keystroke.
3. **All weight rules share the same OOSW:** R1, R2, and R3 all reference the same read-only OOSW figure fetched from REC 7.1.5. This ensures consistency.
4. **Soft gates remain:** All three rules are confirm-on-override at Finalize; drafts are never blocked.
5. **Database view for trends:** A new read-only view `v_dry_job_weights` makes it trivial to query job-level summaries, overrides, and available capacity.

---

## 4. Database Changes

### 4.1 Remove temporary scaffolding

**Column to remove:**
- `dry_cooking.oosw_kg_manual` (NUMERIC) — no longer needed.

**Migration plan:**
- Data already captured in REC 7.1.5 submissions.
- Run a verification query before drop: count non-NULL values in `oosw_kg_manual` and confirm they match (or are reasonably close to) the REC 7.1.5 roster totals for the same jobs.
- Document any discrepancies.
- Drop the column.

### 4.2 Create read-only view for job-level weight summary

**View name:** `v_dry_job_weights`  
**Scope:** One row per unique `job_no` in `dry_cooking` (submitted entries only).

**Columns:**
```sql
CREATE VIEW v_dry_job_weights AS
SELECT
  dc.job_no,
  coalesce(sor.total_oosw_kg, 0) AS oosw_kg,
  coalesce(sum(CASE WHEN dc.process = 'Blanching' THEN dc.abalone_kg ELSE 0 END), 0) AS blanched_kg,
  coalesce(sum(CASE WHEN dc.process = 'Cooking' THEN dc.abalone_kg ELSE 0 END), 0) AS cooked_kg,
  coalesce(sor.total_oosw_kg, 0) - coalesce(sum(CASE WHEN dc.process = 'Blanching' THEN dc.abalone_kg ELSE 0 END), 0) AS available_to_blanch_kg,
  coalesce(sum(CASE WHEN dc.process = 'Blanching' THEN dc.abalone_kg ELSE 0 END), 0) - coalesce(sum(CASE WHEN dc.process = 'Cooking' THEN dc.abalone_kg ELSE 0 END), 0) AS available_to_cook_kg,
  max(dc.record_date) AS last_record_date
FROM dry_cooking dc
LEFT JOIN salting_oosw_roster sor ON dc.job_no = sor.job_no
WHERE dc.status = 'submitted'
GROUP BY dc.job_no, sor.total_oosw_kg;
```

**Purpose:**
- Single source of truth for job-level weight summaries.
- Used by reports, dashboards, and queries to detect capacity, overrides, and trends.
- Easy to chart: "Available to cook per job per day", "Jobs with stock uncooked", etc.

**No-vendor-SQL requirement:** Uses only standard PostgreSQL (no CTEs or window functions where unnecessary) so it can be ported to any other database without rewrite.

### 4.3 Optional: Override tracking table

**Table name:** `dry_weight_override`  
**Purpose:** Audit trail of weight rule overrides at finalization.

**Columns:**
```sql
CREATE TABLE dry_weight_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES dry_cooking(submission_id),
  job_no VARCHAR(20) NOT NULL,
  rule_code VARCHAR(10) NOT NULL, -- 'R1', 'R2', 'R3'
  rule_message TEXT,
  overridden_by VARCHAR(255), -- username or operator ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, rule_code)
);
```

**Filled by:** Finalize flow when operator confirms an override.  
**Queried by:** Reports and dashboards to show "Which jobs ever went over, and who signed off".

---

## 5. User Interface & Workflow

### 5.1 Job Info section (read-only OOSW display)

**Location:** At the top of REC 7.4.0, in the Job Info header.

**Current layout:**
```
JOB INFO
─────────────────────────────────────────
Job number         DPR01168
Processing for     [farm name]
Whole weight       1 600 kg
Harvest farm       Farm A
Intake date        2026-10-20
```

**New layout (with read-only OOSW):**
```
JOB INFO
─────────────────────────────────────────
Job number         DPR01168
Processing for     [farm name]
Whole weight       1 600 kg
Harvest farm       Farm A
Intake date        2026-10-20
OOSW (kg)          1 519 kg          [read-only]
```

**Behavior:**
- Fetched when the job number is set (autofill).
- If REC 7.1.5 has a record for the job: display the sum of all size-range weights.
- If no REC 7.1.5 record exists: display "Not recorded" in muted text (lighter grey, no interactive hint).
- Not editable (no cursor, no keyboard input).
- Updates on page reload (no live polling).
- Included in the Job Info summary line when collapsed: `JOB INFO — DPR01168 · [farm] · [intake weight] kg · OOSW: 1 519 kg`

### 5.2 Pots area: tally line with available-weight data

**Location:** Below the pot cards area, in the grey on-screen summary.

**Current tally line:**
```
2 pots / 300 kg blanching / 250 kg cooking
```

**New tally line (with available figures):**
```
OOSW: 1 519 kg  |  Available to blanch: 1 219 kg  |  Available to cook: 969 kg
2 pots / 300 kg blanching / 250 kg cooking
```

**Updates:**
- Recalculated on every keystroke (weight field change).
- Available figures turn red with a minus sign if negative (e.g. "Available to cook: -50 kg").
- Helps operator see capacity headroom at a glance.

### 5.3 Per-card available-weight display

**Blanching card:**
```
┌─────────────────────────────────────┐
│ POT 1 — Blanching                   │
├─────────────────────────────────────┤
│ Abalone (kg)        [ 300_________ ] │
│ Available to blanch:  1 219 kg       │
│ Batch code          [ ____________ ] │
│ ...other fields...                   │
└─────────────────────────────────────┘
```

**Cooking card:**
```
┌─────────────────────────────────────┐
│ POT 2 — Cooking                     │
├─────────────────────────────────────┤
│ Abalone (kg)        [ 250_________ ] │
│ Available to cook:    969 kg         │
│ ...other fields...                   │
└─────────────────────────────────────┘
```

**Behavior:**
- Shown immediately below the weight input field.
- Updated live as operator types kg value.
- Shows red with minus sign if negative.
- Helps operator see if adding another pot will exceed available stock.

---

## 6. Weight Rules (R1, R2, R3)

### 6.1 Rule definitions

| Rule | Applies to | Condition | Message | Gate |
|------|-----------|-----------|---------|------|
| **R1** | Cooking | `sum(Cooking kg) ≤ OOSW` | "Cooking pot weight exceeding OOSW - possible batch mix" | Soft (confirm at Finalize) |
| **R2** | Blanching | `sum(Blanching kg) ≤ OOSW` | "Blanching pot weight exceeding OOSW - possible batch mix" | Soft (confirm at Finalize) |
| **R3** | Cooking vs Blanching | `sum(Cooking kg) ≤ sum(Blanching kg)` | "Cooking weight exceeds blanched weight - cooked more than was blanched" | Soft (confirm at Finalize) |

### 6.2 Evaluation scope

- Per job (all submitted entries + current entry's cards).
- Only submitted entries count toward totals (drafts of other entries are ignored).
- Current entry being edited is included (live computation).
- Exclude the entry being edited from "other entries" via `excludeId` (no double-counting on update).

### 6.3 Draft behavior

- Drafts are **never blocked** by any weight rule.
- No error message shown on draft save.
- Warning messages and override confirmation only appear at **Finalize** (submit).

### 6.4 Override handling

- Operator confirms override at Finalize.
- Confirmation stamped on the record as `oosWarningAck` and `oosWarningNote`.
- If multiple rules fail, each rule adds its own line to the note (e.g. "R1 override by [user]. R3 override by [user].").
- Override data optionally logged to `dry_weight_override` table for audit.

---

## 7. Success Criteria

1. ✓ Manual OOSW field removed; no blank field on the form.
2. ✓ Read-only OOSW displayed correctly (from REC 7.1.5 lookup).
3. ✓ Weight rules R1, R2, R3 all fire correctly based on read-only OOSW.
4. ✓ "Available to blanch/cook" figures displayed and updated live.
5. ✓ No production data lost; `oosw_kg_manual` values archived before column drop.
6. ✓ View `v_dry_job_weights` can be queried for trends and reports.
7. ✓ Operators trained; no confusion about where OOSW comes from.
8. ✓ All existing jobs still finalize; no regressions.
