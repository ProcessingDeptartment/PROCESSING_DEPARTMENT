# REC 7.4.3.1 and 7.4.3.2: grading records separated by job prefix (instructions for Claude Code)

**Date:** 2026-10-01
**Raised by:** Michaela: "7.4.3.1 = all DPR jobs only. 7.4.3.2 all 3DP jobs only."
**Confirmed by Michaela (2026-10-01):** a DPR job is never graded on 7.4.3.2 and a 3DP job is never graded on 7.4.3.1. **All other parts of a job are the same** for DPR and 3DP (receiving, cooking, drying, monitoring, boxing, stock, transfers, reports). **Only grading is separated.**
**Scope:** the two grading records only. Every other record keeps accepting both `DPR` and `3DP` (dry jobs). No change to fields, keys, calculations, DB columns, CSV or print layout. No coding was done in writing this; this file is the brief.
**Related:** `drying-report-spec.md` (drying = `3DP` or `DPR`), `rec-7.4.3-totals-section-start-collapsed-instructions.md`, `rec-7.4.4-replace-form-with-report-instructions.md`.

## 1. Rule

| Record | Allowed job numbers | Excluded |
|---|---|---|
| **REC 7.4.3.1** Grading Production Log (`REC-7.4.3.1-grading-production-log-cultivated.html`) | prefix **`DPR`** only | `3DP`, `3CP`, `CPR` and anything else |
| **REC 7.4.3.2** Grading Production Log (`REC-7.4.3.2-grading-production-log-ranched.html`) | prefix **`3DP`** only | `DPR`, `3CP`, `CPR` and anything else |

Case-insensitive prefix check. A job number that does not match is excluded, never guessed.

**Do not apply this to anything else.** The drying report, job status, receiving, dry cooking (7.4.0), drying process (7.4.1), dry monitoring (7.4.2), boxing (7.4.5), dry stock (7.4.6), labelling (7.4.7, 7.4.8), transfers (7.4.9, 7.4.10) and traceability keep treating `DPR` and `3DP` as one dry process. Check that no other record or page picks up the new restriction through shared code.

## 2. Where it applies

1. **Job picker / type-ahead on each grading record**: list only matching jobs.
2. **Typed or pasted job numbers**: validate on entry and on Save/Submit. Message: "REC 7.4.3.1 is for DPR jobs only" / "REC 7.4.3.2 is for 3DP jobs only". Draft save is also blocked for a wrong-prefix job (it could never be submitted).
3. **Server side**: the API rejects a 7.4.3.1 submission whose job number is not `DPR` and a 7.4.3.2 submission whose job number is not `3DP`. Do not rely on the form alone.
4. **Grading step in job views**: a `DPR` job's grading is read from 7.4.3.1, a `3DP` job's from 7.4.3.2. Where a view already reads both grading records, leave it as it is.
5. **Implementation**: hold the allowed prefix in the record definition (`allowedJobPrefixes: ["DPR"]` on 7.4.3.1, `["3DP"]` on 7.4.3.2) and read it in one shared check. Records without the setting accept every valid job prefix as today. Reuse an existing prefix helper if one exists.

## 3. Existing data (check before enforcing)

Run a read-only check and report to Michaela before turning on the server check:

```sql
SELECT 'cultivated' AS rec, job_no, count(*) FROM sub_grading_production_log_cultivated
WHERE upper(job_no) NOT LIKE 'DPR%' GROUP BY job_no
UNION ALL
SELECT 'ranched', job_no, count(*) FROM sub_grading_production_log_ranched
WHERE upper(job_no) NOT LIKE '3DP%' GROUP BY job_no;
```

(Confirm the real table and column names first.) Entries that break the rule are listed, not changed or deleted. Old entries still open, print and export as before. The rule applies to new entries and edits only.

## 4. Test

1. New entry on 7.4.3.1: picker lists only `DPR` jobs. On 7.4.3.2: only `3DP` jobs.
2. Type `3DP01156` on 7.4.3.1: refused with the message. Type `dpr01156` on 7.4.3.1: accepted. Same the other way round on 7.4.3.2.
3. Send a wrong-prefix submission straight to the API: rejected.
4. **Other records unchanged:** on receiving, 7.4.0, 7.4.1, 7.4.2, 7.4.5, 7.4.6, 7.4.9 and 7.4.10 both a `DPR` and a `3DP` job can still be picked. The drying report lists both.
5. Open an existing entry of either grading record: opens, prints, exports unchanged.
6. Collection bins roster, `fixedGroups` and `sources` still read both grading records and continue bins across jobs.
7. Traceability: `stock_link` edges and bin lookup still resolve for both record types.
8. Bump the `?v=` script strings on both grading record pages.

## 5. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.3-job-prefix-scope-instructions.md` and follow it. Only grading is separated by job prefix: REC 7.4.3.1 accepts `DPR` job numbers only and REC 7.4.3.2 accepts `3DP` job numbers only (case-insensitive). Every other record and page keeps accepting both `DPR` and `3DP`. Filter each grading record's job picker, validate typed job numbers on save, hold the allowed prefix in the record definition (`allowedJobPrefixes`) and enforce it in the API as well. Run the read-only data check in section 3 first and report existing entries that break the rule without changing them. Do not change fields, calculations, DB columns or exports. Bump the `?v=` strings, run section 4 and write a short work log.
