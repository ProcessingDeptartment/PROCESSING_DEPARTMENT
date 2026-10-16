# REC 7.4.0 — Multi-Cook Rule (One or Two Cooking Runs per Job)

**Status:** Instructions only, no code written.  
**Date:** 2026-10-16  
**Applies to:** REC 7.4.0 Dry Cooking Pots Roster (`dry-cooking-pots`, `batchField: jobNo`)

---

## 1. The Rule

A drying job normally has **one cooking run**. Occasionally it has **two**. The system must support both without any special configuration or workaround.

- **One cook:** the standard case. One set of pot entries for the job, one total cooked weight.
- **Two cooks:** a second cooking run is done on the same job at a later date. This produces a second set of pot entries, a second partial cooked weight, and a combined total cooked weight for the job.

There is no hard limit at two — the system must not block a third entry if it ever occurs — but two is the realistic maximum and the case to design for.

---

## 2. What This Means in the Form

- Picking a job that already has a submitted cooking entry must **not** block a new entry. The form opens fresh for the new cook.
- The "Job so far" panel (or equivalent) shows all prior cooking entries for the job — date, pots, cooked weight — read-only, so the operator can see what was already cooked.
- Each cooking entry stores its own pot roster and its own partial cooked weight (`cookedWeightThisEntry`).
- The **total cooked weight for the job** is the sum of `cookedWeightThisEntry` across all submitted entries for that `job_no`. This is computed at query time (or in a view), not stored on any single entry.

---

## 3. What This Means in REC 7.4.1 (Drying Process)

REC 7.4.1 reads cooked weight from 7.4.0. With multiple cooks:

- `cookedWeight` shown in 7.4.1 = **sum of all submitted cooking entries for the job** (already the stated behaviour in `drying-process-refinement-instructions.md` section 2.3).
- Each time a new 7.4.1 entry is opened for the job, it re-reads the current sum from 7.4.0 so it picks up any second cook that was added since the last 7.4.1 entry.
- The note shown to the operator reflects the actual count: "From REC 7.4.0 — 2 cooking runs, 6 pots total".

---

## 4. What This Means in the Database

No schema change required if 7.4.0 already stores one row per entry per job. Confirm:

- The cooking entry table has `job_no` as a non-unique column (multiple rows per job allowed).
- There is **no unique constraint** on `(job_no)` alone — unique only on `submission_id`.
- The view or query that produces `cookedWeight` for a job uses `SUM(cooked_weight_kg) WHERE job_no = X AND status = 'submitted'`.

If a unique constraint on `job_no` exists, drop it.

---

## 5. Submissions Log Display for 7.4.0

The submissions log for a job with two cooking runs shows **two rows**, each with:

- Date of that cook
- Number of pots in that entry
- Cooked weight for that entry
- Submitted by

A **total row** at the bottom: combined cooked weight across all entries for the job.

---

## 6. Print

### Single-entry print
Prints one cooking run only — its date clearly in the header, its pot roster, its subtotal weight, its sign-off. This is the standard print for any individual submission. Used when a physical docket for that specific cook is needed.

### Job cooking summary print (multiple cooks)
When a job has more than one cooking run, the job cooking summary print produces **one page per cooking run**, in chronological order.

- Each page is self-contained: cooking date prominent in the header, pot roster, subtotal cooked weight for that run, sign-off for that run.
- Cooking dates differ between runs and must be unambiguous — they are never merged onto one page.
- A **cover/summary page** precedes the individual run pages (or follows, if preferred): job number, job info, total cooked weight (sum of all runs), number of runs, date range (first cook date to last cook date). This page has no pot detail.
- Page numbers show run context: "Cook 1 of 2", "Cook 2 of 2".
- For a single-cook job, the summary print is identical to the single-entry print (no cover page needed, no "Cook 1 of 1" label required).

Accessed from the job view or drying report via a "Print all cooks" button.

---

## 7. No Gate on Second Entry

Do not add any confirmation dialog or warning when a second cooking entry is started for a job that already has one. It is a normal operation. The "Job so far" panel showing the prior cook is sufficient context for the operator.
