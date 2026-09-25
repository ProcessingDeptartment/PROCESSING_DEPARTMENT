# Job Status — Job Details bugs and corrected rule (updated 2026-09-11)

**Source:** found live on `job-status.html` while filling in job details for CPR002045 to verify
the Canning Report layout. **Correction (2026-09-11, same day):** Michaela clarified the intended
rule is the reverse of what was first written up below — see Bug 1 (Corrected) before building
anything. Hand this directly to Claude Code — all items here are concrete, scoped fixes.

## Bug 1 (CORRECTED) — Job Details must become its own separate action, and IS required before a job can be closed

**Original (wrong) framing, kept here so Claude Code doesn't build the reverse of what's
needed:** an earlier version of this brief said Job Details fields should never block closing a
job. That was based on a misread of what Michaela wants — the actual, confirmed rule is the
opposite in one respect and different in another. Read this section only; ignore the old framing
below.

**Corrected behavior needed:**
1. **Stop the Job Details modal from auto-opening as part of viewing a job.** Today, clicking
   **Details** on a job row opens the Job Details modal directly — that modal should no longer be
   reached this way. Split it into its own separate, clearly-labeled action — e.g. an
   **"Add Job Details"** button, distinct from viewing the job — so filling in these fields is a
   deliberate, separate step, not something bundled into a generic "view/details" click.
2. **A job can only be closed once Job Details have been added.** This reverses the original
   framing entirely: **Close job** should be disabled/blocked until GRN No., PO No., Cost per Kg,
   Delivery note no. (and whichever of Canning efficiency / Comments / NRCS AG codes Michaela
   confirms are actually required — clarify exact required subset before building, since
   "Job Details have been added" may not mean literally every field is mandatory; at minimum GRN,
   PO, Cost per Kg, and Delivery note no. are the clear candidates) have been saved via the new
   "Add Job Details" action.
3. **Fix needed:** add a real validation gate on `Close job` (wherever that lives — `job-status.js`
   `window.JobStatus.close(...)` or inline in `job-status.html`) that checks whether Job Details
   have been saved for that job, and blocks/disables Close job with a clear message if not (e.g.
   "Add Job Details before closing this job."). Add the separate "Add Job Details" entry point
   (button on the job row, alongside — not replacing — whatever plain view action exists). Confirm
   after the fix: a job with no Job Details saved cannot be closed via Close job (clear error or
   disabled state, not a silent no-op), and a job with Job Details saved closes normally.
4. **Open question for Michaela before this is built:** which exact fields count as "added" for
   the close-gate check? All seven (GRN, PO, Cost per Kg, Delivery note no., Canning efficiency,
   Comments, NRCS AG codes), or a smaller required subset (e.g. just GRN/PO/Cost per
   Kg/Delivery note, leaving Canning efficiency/Comments/NRCS AG codes genuinely optional even
   after the gate)? Canning efficiency in particular has no defined formula yet
   (`claude/canning-report-layout-spec.md`), so making it a hard requirement to close a job would
   block every job indefinitely until that formula exists — flag this specific conflict back to
   Michaela before building the gate.

## Bug 2 — NRCS AG code and Additional NRCS cans are two separate data points, not a pair

**Current behavior:** the Job Details entry form's "NRCS AG codes" section renders each row as a
linked pair: one text input for the AG code (e.g. `AG1`) sitting next to one number input
labelled "Additional cans" (e.g. `100`), added/removed together as a single row via **+ Add NRCS
AG code** / the ✕ button. This treats them as one combined record.

**Should be:** per `claude/canning-report-layout-spec.md` section 4 (Can Summary table), *NRCS AG
code* and *Additional NRCS cans* are two independent columns in the source workbook — a job can
have multiple NRCS AG codes, and "Additional NRCS cans" is a separate quantity that is not
inherently tied one-to-one to a single AG code. Coupling them into one input pair is a modeling
error inherited into the UI, not a deliberate design choice — confirmed directly by Michaela.

**Fix needed:**
1. Confirm how these two fields are actually stored today (single array of `{agCode,
   additionalCans}` objects, most likely, given the paired-row UI) — check the job-details save
   payload in `job-status.html` / wherever the modal's Save handler lives.
2. Decide the corrected data shape with Claude Code before changing the UI blindly — likely two
   independent lists (an NRCS AG codes list, and a separate Additional NRCS cans quantity/list),
   matching how `canning-report.html`'s Can Summary table already treats "NRCS AG code" as a
   per-row breakdown column distinct from "Additional NRCS cans" per the layout spec.
3. Migration note: at least one live job (CPR002045) already has an existing paired entry
   (`AG1` / `100`) saved under the current coupled shape — the fix needs a plan for what happens
   to existing saved data (e.g. treat existing paired rows as one AG code entry + one legacy
   "additional cans" total, rather than silently dropping data), not just a fix for new entries.

## Status
Not yet built. Bug 1 needs Michaela's answer on the exact required-field subset (see question
above) before Claude Code builds the close-gate — building it against "all seven fields required"
without resolving the Canning efficiency conflict would likely block every job from ever closing.
Bug 2 needs a quick look at the current save payload shape before deciding the corrected data
model (step 1), then the UI and any migration follow from that.
