# REC 7.4.0 Dry Cooking — Temporary Entry Flow (DB-capturing MVP)

**Status:** Instructions only, no code written. For Claude Code.
**Date:** 2026-10-07
**Raised by:** Michaela — "need to start using the DPR jobs now; DB must still be capturing this data"
**Scope:** Temporary stabilisation of REC 7.4.0 so DPR job data is captured correctly in the database **today**, before the full pot-card UX is complete. This is a stepping stone, not a rewrite. No final UX changes, no print layout changes.
**Superseded by:** `dry-cooking-pots-roster-instructions.md` (full build — apply that over the top of this once ready)

---

## 1. The problem

The full pot-card system (`dry-cooking-pots-roster-instructions.md`) is the correct target but is not yet deployed. In the meantime, DPR jobs are running and data needs to be captured now. The current form may have UX issues (sections collapsing, pot number still typed, etc.) but the **database must capture every pot correctly** so no data is lost or needs to be re-entered later.

---

## 2. What this instruction covers (MVP only)

The goal is the minimum changes to make the form **reliably usable** and **reliably saving to the database**, without touching anything that the full build will change anyway. Do not add polish, do not restructure layouts, do not change print output.

### 2.1 Job Info section — must work on load

The Job Info section is the **entry point** for every DPR job. It must work cleanly:

1. **Job number picker** — operator types or selects the DPR job number (e.g. `DPR01168`). This is already implemented; confirm it is working and not broken.
2. **Autofill from REC 7.1.2** — once a job number is confirmed, the following fields populate read-only from the submitted REC 7.1.2 record for that job:
   - `jiProcessingFor` (Processing for)
   - `jiIntakeWeight` (Whole weight kg)
   - `harvestFarm` (Harvest farm)
   - `intakeDate` (Intake date)
3. **If no 7.1.2 exists for the job:** show an amber note "No receiving record found for this job. Fields must be filled manually." and unlock those four fields for manual entry. Do NOT block the form — the operator must be able to proceed.
4. **Cooking date** — shown read-only, auto-set to today's date (the date the form is opened). Label: "Cooking date (today)". Operator cannot change it. This matches the final spec where the cooking date is the record date.
5. **Job Info collapses after confirmation** — once job number is confirmed and autofill has run, the Job Info section collapses to a single summary line: `JOB INFO — DPR01168 · [farm] · [intake weight] kg`. A small "Edit" link re-expands it if needed. This behaviour already exists in the system; confirm it works on the dry cooking form.

**If any of the above is broken:** fix only the broken part. Do not restructure the section.

### 2.2 OOSW field — typed input in the Job Info section

**Context:** REC 7.1.5 (OOSW) will not have been submitted before the operator starts REC 7.4.0. The OOSW total kg is known from the paper record, so the operator types it directly into the Dry Cooking form as part of job setup.

Add a single numeric input field immediately below the existing job info autofill fields:

```
OOSW weight (kg)  [ ____________ ]
```

- **Field key:** `ooswKg`
- **Label:** "OOSW weight (kg)"
- **Type:** numeric, decimal allowed, must be > 0 if entered
- **Required:** No — do not block Draft or Submit if empty. Show a soft warning only: "OOSW weight not entered — cooking weight cap cannot be checked." (amber, inline, dismissed on entry)
- **Editable:** always, even after job info autofill runs. The operator types the full batch OOSW kg from the paper record.
- **This is a temporary field.** When REC 7.1.5 is submitted for the job, the final build will replace this typed value with a lookup. For now, the typed value is the source of truth for the cap check on this entry.

**Cap display (read-only, below the input field):**

Once `ooswKg` is entered, show a single read-only line beneath it:

```
Available to cook: 1 088.32 kg
```

Calculated as: `ooswKg − sum of abalone_kg from all submitted REC 7.4.0 Cooking entries for this job already in the database`. If negative, show in red: "OVER by X kg". This line updates as the operator types. If `ooswKg` is empty, hide the line.

**Collapses with Job Info section:** the OOSW kg is included in the collapsed summary line after job confirmation: `JOB INFO — DPR01168 · [farm] · [intake weight] kg · OOSW: 1 519 kg · Available: 1 088 kg`.

**Database:** add `oosw_kg_manual` (NUMERIC) to the parent submission row. Store the typed value there on every save (draft and submit). This column is temporary scaffolding — the full build's migration can read it when wiring up the 7.1.5 lookup. Do not store it only in `submission_json`; it needs its own column so a query can check "was an OOSW weight entered?" across all jobs.

---

### 2.3 Pot entry — keep the current form working, ensure DB saves

The current form likely has one pot per entry (the old layout). For the temporary period:

- **Do not change the pot entry fields.** Whatever is on the form now stays.
- **Confirm the submit/save path writes to the database.** Check that a submitted entry appears in the database (Neon) with `job_no`, `intake_date`, and at least `abalone_kg` / the blanching and cooking fields.
- **If pot data is stored as a JSON blob** rather than as proper child rows: that is acceptable for now, BUT leave a comment in the code: `// TODO: migrate to dry_cooking_pot child table per dry-cooking-pots-roster-instructions.md`. Do not break what is currently saving.
- **Draft saves must work.** An operator must be able to save a draft mid-entry and return to it. Confirm this is not broken.
- **Finalize (Submit) must write all fields.** Check the submission handler sends every pot field to the database endpoint, not just the job info.

### 2.3 Minimum required fields before Submit is allowed

Do not add new required fields. Keep whatever is currently required. The only check to add if missing:

- `job_no` must be present (non-empty) — block Submit if it is empty, with message "Job number is required."
- At least one pot must have `abalone_kg` entered — block Submit if all pots have 0 or empty kg, with message "Enter abalone weight for at least one pot."

These are the two fields essential for database traceability. No others are added to required.

---

## 3. Database — what must be in every submission row

Check the following are being written on every Save/Submit (not just in the JSON blob but as proper columns the queries can read):

| Column | Source | Notes |
|--------|--------|-------|
| `job_no` | Job number picker | TEXT, indexed. **Critical for traceability.** |
| `intake_date` | Autofilled from 7.1.2 | DATE |
| `record_date` | Today's date (auto) | DATE — this becomes the cooking date in the final build |
| `oosw_kg_manual` | Typed by operator | NUMERIC — the full batch OOSW kg. Own column, not JSON only. Null if not entered. |
| `status` | `submitted` or `draft` | Must be `submitted` after finalize |
| `created_by` | Current user (passkey/name) | TEXT |
| `submission_json` | Full form state | JSONB — audit copy, keep it |

**If `oosw_kg_manual` column does not exist on the table:** add it with a migration (`ALTER TABLE ... ADD COLUMN oosw_kg_manual NUMERIC`). Check before/after that existing rows are unaffected (column defaults to NULL for old rows — that is correct).

If `dry_cooking_pot` child table already exists: write one row per pot card on Submit, with `submission_id`, `job_no`, `record_date`, `process`, `abalone_kg`. Remaining fields can be null for now if not yet in the schema.

If `dry_cooking_pot` does NOT yet exist: keep everything in the parent row's `submission_json`. Leave the `// TODO` comment. Do not attempt to create the table here — that migration is part of the full build.

---

## 4. What NOT to change in this temporary pass

- Do not change any print/PDF output
- Do not add pot cards (that is the full build)
- Do not change field labels or order
- Do not change the collapse/expand logic of sections other than Job Info
- Do not touch REC 7.4.1, 7.4.2, or any other record
- Do not change the OOSW business rule
- Do not change the record definition JSON structure (unless a field is simply missing from the DB write)

---

## 5. Testing checklist (temporary MVP)

Run these on the live site at https://processing-department.onrender.com before marking done:

1. Open REC 7.4.0. Enter a job number that has a submitted REC 7.1.2. Confirm: farm, intake weight, intake date autofill and are read-only.
2. Enter a job number with no 7.1.2. Confirm: amber warning shown, four fields editable, form not blocked.
3. Confirm cooking date shows today's date, read-only.
4. Confirm Job Info section collapses after job confirmation to the summary line.
5. Enter an OOSW kg value. Confirm the "Available to cook" line appears and calculates correctly.
6. Leave OOSW kg empty. Confirm amber warning shows but form is not blocked. Confirm "Available to cook" line is hidden.
7. Enter pot data (minimum: abalone kg). Save as Draft. Close and reopen. Confirm draft values are restored — including the OOSW kg field.
8. Submit the entry. Check Neon database: `job_no`, `record_date`, `oosw_kg_manual`, `status = submitted` are all set on the row as proper columns (not only in the JSON blob).
9. Try to Submit with no job number. Confirm it is blocked.
10. Try to Submit with no abalone kg on any pot. Confirm it is blocked.
11. Confirm a second entry for the same DPR job number can be created (the form is not locked per job).

---

## 6. Handover note for the full build

When `dry-cooking-pots-roster-instructions.md` is implemented:
- The `dry_cooking_pot` migration script reads from `submission_json` (the blob saved here) and splits it into child rows. This is why the full JSON must be kept intact.
- The cooking date column on child rows (`record_date`) will come from the parent row's `record_date`, which is being set correctly in this temporary pass.
- Job Info autofill and Job Info collapse behaviour carry over unchanged.
- No data entered during the temporary period will be lost, provided `submission_json` is intact and `job_no` + `record_date` are on the parent row.
