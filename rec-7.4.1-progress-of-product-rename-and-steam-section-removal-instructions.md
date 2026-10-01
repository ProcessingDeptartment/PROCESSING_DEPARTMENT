# REC 7.4.1 Drying Process: rename "Job so far", remove the Steams section

Date: 2026-10-01. Small UI change. Builds on `drying-process-refinement-instructions.md` (sections 2.1 and 4.1). For Claude Code or Claude Design. No other record changes.

## 1. Rename "Job so far" to "Progress of product"

On REC 7.4.1 (the read-only panel shown as soon as the job is picked):

- Change the panel heading **"Job so far"** to **"Progress of product"**.
- Change every place that heading text appears: on screen, in print (the print heading is also "Job so far" today), in the view/read-only page of a submitted entry, and in any tooltip, empty-state or aria-label.
- Empty state: "First entry for this job" stays as is.
- Contents of the panel do not change (stage strip, counts, earlier entries, trolleys now).
- Do not rename database objects. `v_dry_job_progress` keeps its name. Display label only.
- Search the repo for the string "Job so far" and "jobs so far" (case-insensitive) in the 7.4.1 record definition, the JS that builds the panel, the print CSS/template and the Drying Report, and change the label in each. Leave code comments and variable names alone.

## 2. Remove the "Steams" section from the form

The Steams section (section F, steam roster) contains only the **"+ Add steam"** button, so it is removed from the form.

- Remove the whole section from screen, print and the read-only view: heading, "+ Add steam" button, the empty roster, and the "Last steam: ..." summary line that sits above it.
- Remove the tablet-width and tap-target handling that exists only for that button.
- Re-letter the remaining sections so there is no gap (sign-off becomes F). Order on screen and print: A, B, C, D, E, F.
- Submit checks that read the steam roster no longer run on new entries: steam dates against date into dry room (check 6), and "steam" wording in correction rules. Keep the movement date checks.
- The calculated field `steamCount` is not shown on new entries.

### Keep, do not delete

- **Database stays as it is.** Table `dry_process_steam`, `steam_no`, `steam_no_old` and all existing rows are untouched. No drop, no migration, no data loss. Traceability depends on this (`TRACEABILITY.md`).
- **Existing steam data stays visible, read-only,** for any job that already has steam rows: show them inside "Progress of product" as a compact read-only list (steam no., date, temperature, time, start time, done by), labelled "Steams recorded earlier". If a job has no steam rows, show nothing (no empty heading).
- `v_dry_job_progress`, `v_dry_steam_profile`, the Drying Report timeline and the CSV export keep reading `dry_process_steam`. They simply show blanks for jobs with no steams.
- Checked-in `drying-process.json` and `scripts/export-record-defs.mjs`: remove the steam roster field from the record definition and regenerate the snapshot with the script. Do not hand-edit the generated snapshot. Confirm the export script still writes `dry_process_steam` to CSV.

## 3. Confirm with Michaela before building

One consequence to confirm: with the Steams section gone, the form can no longer record new steams (temperature, time, start time). If steams are still being recorded somewhere else, or are no longer needed, the plan above is complete. If they are still needed, say so and the roster should be moved rather than deleted (for example into the Progress of product panel as an "Add steam" action).

## 4. Testing checklist

1. Pick a job with no entries: panel reads "Progress of product", "First entry for this job" shows, no Steams section anywhere.
2. Pick a job with earlier entries: panel heading is "Progress of product" and the content is unchanged.
3. Print preview and a submitted entry's read-only page: no "Job so far" text left, no Steams heading, sections lettered A to F with no gap.
4. A job that already has steam rows: "Steams recorded earlier" appears read-only inside the panel with the right values; a job with none shows no steam heading.
5. Submit and draft save work with no steam fields; no errors from the removed roster in the console.
6. Drying Report and `v_dry_job_progress` still render for an old job (steam columns populated) and a new job (blank steam columns).
7. Search the repo for "Job so far": no user-visible matches remain.
8. Tablet width still reads cleanly after the section removal.
