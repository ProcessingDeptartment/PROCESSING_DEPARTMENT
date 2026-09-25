# Canning Report — Three Fixes Requested by Michaela (2026-09-17)

**Target file:** `public/pages/canning-report.html`
**Context:** Feedback given after test-entering job CPR02229 through the live app and viewing
`canning-report.html?job=CPR02229`. Builds on `claude/canning-report-layout-spec.md` (the
section-by-section field spec) — this doc is three focused, unambiguous fixes on top of that,
not a replacement for it.

## 1. Date format fix

**Problem:** Dates render as raw ISO strings pulled straight from the DB value, e.g. the Job
Details block currently does:
```js
<dt>Receiving date</dt><dd>${esc(h.receivingDate || '—')}</dd>
```
This prints `2026-08-07` verbatim instead of a human-readable date.

**Fix:** Add a `formatDate()` helper (or reuse one if it already exists elsewhere in the repo,
e.g. shared in `record-theme.js`/similar) and run every date value on the report through it
before display. Use `DD/MM/YYYY` (South African convention, matches how dates are written
elsewhere on the paper forms, e.g. "07/08/2026") — confirm this format with Michaela if any other
date format is already established as the house style elsewhere in the app, but default to
`DD/MM/YYYY` if unsure.

Apply to every date field on the report, not just Receiving date — check the Harvest Breakdown
table's `Receiving date` column (currently `${r.date}`, likely the same raw-string problem) and
any other date value rendered on the page. Grep the file for date-shaped values before treating
this as done.

Do **not** reformat the `Generated ${new Date().toLocaleString()}` timestamp in the header — that
one is already using a locale-aware formatter and is fine as-is.

## 2. Percentages must be genuinely calculated, not static

Michaela's note: "intake weight and whole is the same all % needs to be calculated figures."

**Read as two things:**

a) **Intake weight and whole (mass) weight are the same underlying figure.** The report already
   treats them this way in the code (`totalMass` is used consistently as the "whole weight" input
   to every percentage), so there's likely no bug here — but audit for it explicitly: make sure
   nowhere on the report a *different* weight field (e.g. a raw `intakeWeight` from a submission
   record, if that name differs from `totalMass`/`wholeMass` used elsewhere) sneaks in and creates
   a second, potentially-divergent "whole weight" source. There should be exactly one whole-weight
   figure feeding every % calculation on this report.

b) **Every percentage shown must be a live calculation off real submitted data — never a
   hardcoded or stale number.** Today's `pct()` helper already does this correctly:
   ```js
   const pct = (w) => (w != null && totalMass) ? (w / totalMass * 100) : null;
   ```
   and is used for Out of salt %, Clean %, Precook %. Confirm this stays true when adding any new
   fields from `claude/canning-report-layout-spec.md` (e.g. Canning Efficiency, once a formula is
   defined) — no new % field should ever be typed in or left as a static number. If a % can't be
   calculated because its inputs are missing, show `—`, not a guessed or leftover value.

**Verification step before calling this done:** open the report for CPR02229 (or any job with
data in all four source records) and manually recompute each displayed % by hand from the raw kg
figures shown next to it, confirming they match.

## 3. Move CAN BREAKDOWN to be the last section on the report

**Current order** (top to bottom):
1. Job Details / Report Summary (job header + yield stats)
2. **Can Breakdown** (production-code-level table)
3. Harvest Breakdown
4. Processing Measures / Efficiency Indicators (side by side)
5. NRCS AG Codes

**Required order:**
1. Job Details / Report Summary
2. Harvest Breakdown
3. Processing Measures / Efficiency Indicators
4. NRCS AG Codes
5. **Can Breakdown** (moved to last)

This applies to the on-screen render order in `render()`'s template string, **and** to the
`downloadCsv()` export order (currently CSV pushes `CAN BREAKDOWN` first, then `HARVEST
BREAKDOWN`, then `PROCESSING MEASURES` — reorder to match) so the printed/exported report matches
the screen.

Note: this doc's "Can Breakdown" refers to the **existing** production-code-level table already
on the page (Production code | Quantity | Drained weight | Medium | NRCS AG code). If/when the
separate stock-code-level "Can Breakdown" table from `claude/canning-report-layout-spec.md`
section 7 is built, that new table should also land at the very end, after (or merged with) this
one — check with Michaela on whether the two "Can Breakdown" tables should be combined or kept as
two distinct end-of-report sections once section 7 is implemented.

## Status
All three items are concrete and unambiguous — ready for Claude Code to implement directly, no
open questions blocking these specifically. (Open questions from the original layout spec — GRN
No./PO No./Cost per Kg/Delivery note source, and the Canning Efficiency formula — remain separate
and unresolved; not part of this fix set.)
