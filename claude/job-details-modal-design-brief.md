# Job Details Entry — Brief for Claude Design (updated 2026-09-11)

**Purpose:** design the "Add Job Details" entry point and form on Job Status Updates, alongside
the Canning Report work already briefed in `claude/canning-report-design-improvements-brief.md`.
This is where GRN No., PO No., Cost per Kg, Delivery note no., Canning efficiency, Comments, and
NRCS AG codes get entered — the same fields that then surface read-only on the Canning Report's
Job Details / Efficiency Indicators / NRCS AG Codes sections. Confirmed live 2026-09-11 against
job CPR002045.

**Correction from an earlier version of this brief:** the first draft had the intended behavior
backwards. The corrected rule, confirmed directly by Michaela, is below — design against this
version only.

## Two confirmed rules the design must reflect (not yet built in code — see `claude/job-status-bugfix-brief.md`)

1. **"Add Job Details" is its own separate action, not an auto-popup tied to viewing a job.**
   Today, clicking the job row's Details button opens this form directly as part of viewing the
   job. That's changing: viewing a job and adding its details become two distinct actions. Design
   a clearly separate **"Add Job Details"** button/entry point on the job row (or job view),
   independent from however the plain view action works — it should never pop up automatically
   just because someone opened the job.
2. **A job cannot be closed until Job Details have been added.** This is the opposite of what an
   earlier version of this brief said. Design the Close job control (and/or the job row's status
   area) so it's visually clear when a job is blocked from closing because details are missing —
   e.g. a disabled/greyed Close job button with a tooltip or inline note ("Add Job Details before
   closing"), or a small status indicator on the job row itself ("Details needed" / "Details
   added ✓"). **Which exact fields count as "added" is still an open question for Michaela**
   (flagged in the bugfix brief — likely GRN/PO/Cost per Kg/Delivery note as the hard requirement,
   with Canning efficiency/Comments/NRCS AG codes possibly staying optional since Canning
   efficiency has no defined formula yet). Design should accommodate either answer — don't hard-
   code "all seven fields shown as required" without checking back once that's resolved.

## 1. What the form looks like today (confirmed live)

A centered white modal, title "Job details — {job no.}", fields stacked full-width top to bottom
in this order: GRN No. (text), PO No. (text), Cost per Kg (text), Delivery note no. (text),
Canning efficiency (text), Comments (textarea, ~3 rows), then "NRCS AG codes (a job may have more
than one)" — a repeating row of [AG code text input] [Additional cans number input] [✕ remove]
with a "+ Add NRCS AG code" button below the list, then Cancel / Save buttons bottom-right.

No section grouping, no visual hierarchy — every field carries equal visual weight. No indication
today of which fields are actually required to close the job, since the modal auto-opens as part
of viewing rather than existing as its own deliberate step.

## 2. Suggested layout improvements

- **Move this out of an auto-opening modal into its own dedicated view or a clearly-separate
  modal reached only via "Add Job Details"** — not something that appears just from clicking to
  view a job. If it stays a modal (vs. a full page), it should visually read as a distinct task
  ("you are now adding job details"), not a details/info popup.
- **Group into two labeled sections**: "Reference details" (GRN No., PO No., Cost per Kg,
  Delivery note no.) as a compact 2-column grid, and "Report notes" (Canning efficiency, Comments)
  below it.
- **Mark the actually-required fields clearly once that list is confirmed** — standard required-
  field treatment (asterisk or similar) on whichever subset gates job closing, once Michaela
  answers the open question in the bugfix brief. Don't guess this before that's resolved.
- **Split the NRCS section into two independent list sections**, matching the Bug 2 fix in the
  bugfix brief — these remain a data-modeling fix independent of the required/optional question:
  - "NRCS AG codes" — a simple repeatable list of AG code values only (text input + ✕ + "+ Add AG
    code"), no paired second field.
  - "Additional NRCS cans" — its own repeatable list or a single quantity field (check the
    corrected data model from Claude Code's Bug 2 resolution before finalizing this part of the
    layout), visually separate from the AG codes list.
- **A visible save confirmation and a way to tell, from the job row, whether details have been
  added** — e.g. a small "Details added" badge/checkmark on the Job Status Updates table once
  saved, so it's clear at a glance which jobs are still blocked from closing.
- **Keep this desktop-scale** — same scope limit as the Canning Report brief: no tablet/touch
  redesign, no sidebar, no responsive collapse. Admin/PC-only screen, same audience as Job Status
  Updates itself.
- **Reuse the shared token palette** (Section 3 of `claude/layout-redesign-instructions.md`) for
  colors/type only — not its shell or tap-target rules.

## 3. What NOT to change

- No change to what data is calculated, where it's stored, or the underlying save payload shape —
  that's Claude Code's job per `claude/job-status-bugfix-brief.md`, not this design pass.
- Don't design around the current buggy paired AG-code/cans behavior — design for the corrected
  two-list model described above, even though the code fix hasn't shipped yet.
- No tablet/responsive treatment (see above).
- Don't touch the rest of Job Status Updates (the jobs table, toolbar) beyond adding the new "Add
  Job Details" entry point and any "details added" status indicator on the row.

## 4. Suggested next step

Feed this brief to Claude Design alongside `claude/canning-report-design-improvements-brief.md`
(same session ideally, since these fields reappear read-only on the Canning Report). Get
Michaela's answer on the required-field subset (bugfix brief, Bug 1 open question) before
finalizing which fields show required-field styling — everything else in this brief can proceed
without waiting on that.

## Status
Ready to hand to Claude Design, with one open dependency (required-field subset) flagged above.
Corresponding code-side work tracked in `claude/job-status-bugfix-brief.md` — not yet built.
