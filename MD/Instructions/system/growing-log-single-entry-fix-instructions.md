# Growing Log Records — Single-Entry Submission Fix

**Status:** Instructions only, no code written.  
**Date:** 2026-10-16  
**Applies to:** REC 7.4.1 (Drying Process) and any other record flagged as an entry log per job (`batchField: jobNo` with multi-submission intent). Check REC 7.4.2 (Dry Monitoring) for the same pattern.  
**Companion doc:** `claude/drying-process-refinement-instructions.md`

---

## 1. The Problem

Records like 7.4.1 are **entry logs**: one job has many submissions over many days. The current behaviour is wrong:

- Every new submission stores a **full snapshot of all previous entries** inside the new record.
- This means submission 5 for a job contains entries 1 through 5.
- Every version of the record is PDF-printable, so the same historical data appears on many separate printable documents.
- The submissions log shows multiple "full" records that overlap, making audit and traceability confusing.

**What should happen instead:**  
Each submission stores **only what happened in that entry**. The full job history is assembled by querying all entries for the same `job_no` — it is never stored inside a single submission.

---

## 2. Root Cause to Find in the Code

Before fixing, locate exactly where the old data is being included. Check these three places:

1. **Form pre-fill on load** — when the operator picks a job, the form may be loading all previous submission data into the editable fields. It should load only into the **read-only "Job so far" panel** and the prefill fields listed in the record definition (trolley count, cooked weight). Everything else starts blank.

2. **Submit payload** — when the form is submitted, check the JSON body sent to the API. It must contain **only the current entry's fields**, not a merged object of all prior entries' fields.

3. **Server/API merge logic** — the server may be merging new data on top of old data before saving. This is correct for records like 7.4.6 (Dry Stock Control) which explicitly use progressive snapshot logic; it is **wrong** for entry logs. The server must save each submission as its own independent row.

---

## 3. The Correct Data Model

Each entry log record must follow this structure:

```
Parent table: one row per submitted entry
  - id, submission_id, job_no
  - submitted_by, submitted_at (server-stamped)
  - Fields for THIS entry only (movements answered today, steams done today, trolley count today)
  - NOT a copy of all earlier data

Child tables (if any): rows linked to this entry's submission_id
  e.g. dry_process_steam — one row per steam done in THIS entry only
```

Job-level aggregates (total steams, current stage, drying days, yield) are computed in **database views** (`v_dry_job_progress`) by joining all entries for the job. They are never stored on a single entry.

---

## 4. Form Behaviour Fix

### On job pick / load
- Call the API to fetch all prior entries for the job.
- Render them **read-only** in the "Job so far" panel.
- Prefill only the explicitly listed autofill fields (trolley count from last entry, cooked weight from 7.4.0).
- Every other editable field starts **blank or defaulted** — it does not carry the previous submission's values.

### On submit
The payload sent to the server must include:
- `job_no` (the linking key)
- Fields filled in **this entry only**
- Sign-off for this entry
- `warning_ack` / `warning_note` if overrides were confirmed

It must **not** include a re-submission of all earlier entries' fields.

### Client-side guard
Before submitting, assert in code that the payload does not contain data sourced from earlier submissions (other than the explicitly listed autofill fields). Log a console warning if any prior-submission value has leaked into a writable field.

---

## 5. Server / API Fix

For entry-log records:

1. **Do not merge** the incoming payload with any previous row for the same job.
2. Insert a **new row** in the entry table.
3. Insert child rows (steams etc.) linked to this entry's id only.
4. Return the new entry id and the updated job-level summary (from the view).

The progressive snapshot / carry-forward merge pattern (used by 7.4.6) must **not** be applied to entry logs. If there is a shared submission handler, add a flag in the record definition (e.g. `"submissionMode": "entry-log"` vs `"submissionMode": "progressive-snapshot"`) to branch the logic.

---

## 6. PDF Print Fix

### Current wrong behaviour
Each submission generates a printable PDF that includes all prior entries, creating many overlapping printable documents.

### Correct behaviour
There are two legitimate printable outputs for an entry log:

| Print | Contents | When used |
|---|---|---|
| **Single-entry print** | This entry only: job info header, entry date, movements answered, steams, trolley count, sign-off. Useful for a physical daily docket. | "Print this entry" button on the submission detail view. |
| **Job history print** | All entries for the job in date order, built from the database view. Job-level summary at the top (stage, total steams, drying days, yield). | "Print job history" button on the job's aggregated view / drying report. |

### Implementation
- The single-entry print renders only the row where `submission_id = X`.
- The job history print queries `v_dry_job_progress` and all child rows for `job_no = Y`, renders them chronologically, and stamps the print with the generated date/time.
- Remove any print path that merges earlier submission data into the current submission's print template — that is what produces the duplicate/overlapping records.
- Old (pre-fix) submissions that were saved as full snapshots: their print view should render the data as stored, with a banner "Legacy record — saved as full snapshot before [date of fix]". Do not alter stored data.

---

## 7. Submissions Log Display

The submissions log for an entry-log record must show:
- One row per submission (one entry per day).
- Columns: Date submitted, Submitted by, Movements answered (e.g. "Into dry room ✓"), Steams this entry, Trolleys.
- **Not** a row that expands to show "all previous entries re-listed".
- Actions: View (this entry only), Print this entry, Print job history.

---

## 8. Records to Check for the Same Pattern

Any record with `batchField: jobNo` and intended multi-day use should be audited:

| REC | Record name | Expected mode |
|---|---|---|
| 7.4.1 | Drying Process | Entry log — fix required |
| 7.4.2 | Dry Monitoring | Entry log — verify same fix applies |
| 7.4.0 | Dry Cooking Pots Roster | Entry log (one entry per cook pot per cooking run) — verify |
| 7.4.6 | Dry Stock Control | Progressive snapshot (intentional carry-forward) — do NOT apply this fix |

For each: open a live job in the submissions log, count the entries, open the second entry and confirm it does not contain the first entry's data in its editable fields or payload.

---

## 9. Migration / Legacy Data

Do **not** alter any stored submission data. Legacy submissions that contain full snapshots stay as-is in the database. Flag them with a column `legacy_full_snapshot BOOLEAN DEFAULT false` set to `true` on any row inserted before the fix date. Use this flag to:
- Show the "Legacy record" banner on their print/view.
- Exclude them from view logic that expects a single-entry row (or handle the extra fields gracefully).

---

## 10. Build Order

1. Identify and document (in a short work log) exactly where the full-snapshot merge is happening (form load, submit payload, or server handler).
2. Add the `submissionMode` flag to affected record definitions.
3. Fix the server handler to branch on `submissionMode`.
4. Fix the form to not carry prior submission data into editable fields.
5. Fix the print templates (single-entry vs job-history).
6. Fix the submissions log display.
7. Mark legacy rows with `legacy_full_snapshot = true`.
8. Test: submit entry 1 for a job, submit entry 2, confirm entry 2's stored row contains only entry 2's data, confirm the job history view assembles both correctly, confirm both print options work.
