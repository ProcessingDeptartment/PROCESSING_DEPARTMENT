# Testing checklist — NRCS Canning roster Add → View → Verify flow

Covers the changes from `nrcs-canning-roster-verification-instructions.md`:
- `public/lib/traceability.js` (v7) — trace index rows now carry `status`/`verified`/`verifiedDate`
- `public/lib/form-record.js` (v35) — recordpick roster columns render Add/change → View → status badge; `saveForm(finalize)` blocks Submit when a required recordpick row isn't attached+verified
- `public/pages/backfill-traceability.html` — re-indexes rows missing the new fields
- `Production-Information-NRCS-(Canning)-production-information-nrcs.html` — single "Records included" roster's `submissionRef` column marked `required: true`; the separate "Production codes" roster was merged into this same roster as extra columns (`productionCode`, `nrcsAgCode`, `productDescription`), filled via `fillMap` whenever the picked record is a Cans Produced (REC 7.2.7) submission

**Blocker found during automated testing:** the Job No. field (`type: 'jobsearch'`) only
accepts values from `window.JobStatus.openJobNumbers()` — any value not in that list is
silently cleared, including a value set directly on the underlying input via JS. So this
checklist needs a **real open job number** that already exists in your job list; it can't
be exercised with a fabricated job number in an empty/local environment.

## Setup
Pick (or create) a real open job number, call it `JOBNO`, that has:
- At least one record already filed against it in the trace index (any record type),
  submitted but **not yet verified**.

## Steps

1. **Open a new NRCS Canning entry**, enter `JOBNO` as Job no.
2. In the "Records included" roster, click the Add/change control and pick the row for
   the already-filed, not-yet-verified record.
   - [ ] Row shows badge **"Awaiting verification"** (not "Verified", not blank/muted).
   - [ ] A "View record" link appears and opens the correct underlying record in a new tab.
3. Click **Submit** (finalize) with that row still unverified.
   - [ ] Blocked with a message naming the incomplete roster (e.g. `All records in "Records
     included — ..." must be attached and verified before this can be submitted.`)
   - [ ] No data is lost — form fields remain filled after the blocked attempt.
4. Click **Save draft** in the same state.
   - [ ] Draft saves successfully — drafts are never blocked by the roster-completeness rule.
5. Go verify the underlying record via the existing verification queue / sign-off flow,
   then reopen the NRCS Canning draft.
   - [ ] The row's badge now reads **"Verified (DD/MM/YYYY)"** with the correct date,
     without needing to re-pick the row.
6. With every required row in the roster now verified, click **Submit**.
   - [ ] Submission succeeds.
7. Test the "not attached" case: start a fresh entry with `JOBNO`, leave the roster with
   zero rows or a row with no value picked, click Submit.
   - [ ] Blocked with an appropriate message — distinct in effect (not necessarily wording)
     from the "attached but unverified" case; the row shows badge "Not attached".
8. Confirm "View record" links open the correct record for a couple of different rows
   (not just the first one tested).
9. **Regression — Cans Produced auto-fill (prior change, now merged into this roster):**
   add another row in the same "Records included" roster and pick a "Cans Produced"
   (REC 7.2.7) submission for it.
   - [ ] `Production code`, `NRCS AG code`, `Product description` (from `brineOrBraised`)
     auto-populate on that row, while `REC code`/`Record name` still populate as before —
     confirms both `fillCode`/`fillName` and `fillMap` apply together on one column.
10. **Cache check:** hard-refresh (Ctrl+Shift+R) the NRCS Canning page and confirm no
    console errors and the roster still renders with badges/links — confirms the
    `?v=` bumps on `traceability.js`/`form-record.js` took effect everywhere this page
    loads them from.

## Notes for whoever runs this
- The 4 badge states to look for: `Not attached` (muted), `Draft — not yet submitted`
  (info), `Awaiting verification` (warn), `Verified (DD/MM/YYYY)` (ok).
- If old trace-index rows (filed before this change) show "Not attached" or an odd
  status on a record you know is filed, run `public/pages/backfill-traceability.html`
  to re-index them — it now also picks up rows missing the new `status` field.
