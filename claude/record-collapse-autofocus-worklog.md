# Record collapse / Job-info auto-collapse / job auto-focus — work log (2026-10-01)

Brief: `Claude outputs/record-sections-collapse-and-job-autofocus-instructions.md`.
UI behaviour only — no field, validation rule, calculation, DB call, autofill mapping, CSV or print-sheet change.

## What changed
- **form-record.js v65** — every section (incl. rosters, entry-log panels, the Completed-by block) is a `<details class="fr-section-collapsible" open>`; `collapsible:false` opts out. Job-info summary = `Job <no> · <agCode> · Intake <d Mon>` (default for any section holding the jobsearch; `summaryFields` overrides). "Collapse all / Expand all" link. Save/Submit failures expand the section, scroll to and focus the first invalid field (first missing field now drives both toast and focus). Print/PDF opens everything (`beforeprint`/`afterprint`). New Entry focuses the job picker, or the prefix dropdown for a `jobnumber` field (REC 7.1.2).
- **monitoring-log.js v39** — every group (heading + its fields) becomes a `<details class="ml-section-collapsible">` with an inner `ml-grid-2` body; stage "Edit" button inside a heading no longer folds the block; same summary, Collapse/Expand all, validation reveal, print expand, auto-focus. Completed-by block wrapped.
- **job-picker.js v5** — after Confirm: collapse the enclosing section, then focus the next empty editable field. Re-opening an existing record/draft no longer auto-collapses (stays open). `jp-compact`/"Job no. X" label removed (the header summary replaces it). New `focus()` API with retry (the record shell re-parents the form and drops focus).
- **record-chrome.js v24** — sign-off blocks (`fr-signoff-block`, `ml-signoff-block`) keep the "Sign off" rail label and bubble styling; `jumpToProblem` opens collapsed ancestors; ml auto-fold-on-complete limited to `data-autofold` sections (Job info) so ml pages behave as before.
- **REC 7.2.12** (wrap only): Header open by default; stage tabs + measurement panel, Comments, Completed by wrapped in details; Job no. focused on a new entry.
- **Dry NRCS packs**: attachments-checklist code now hides the whole section block (was hiding the title/grid siblings).
- Version strings bumped on all pages: form-record 65 (80 pages), monitoring-log 39 (51), record-chrome 24 (132), job-picker 5 (engine loaders).

## Test results (local dev server; API 401s are the missing access key, unrelated)
| # | Check | Result |
|---|---|---|
| 1 | 7.1.3.1, 7.8.1 (ml), 7.1.2 (roster), 7.2.12, Dry NRCS: all sections open on New Entry | pass |
| 1 | Job picker focused (Can/Dry toggle or search with list open); 7.1.2 prefix focused; 7.2.12 job input focused | pass |
| 2 | Pick + Confirm job → Job info closes, header shows `— Job 3CP2026-0412`, focus lands on next empty field (Date) | pass |
| 4 | Collapse all / Expand all (7.1.3.1) | pass |
| 5 | Submit with required field empty in collapsed sections → Batch info opens, Date focused, toast shown | pass |
| 6 | Existing record/draft stays open (picker no longer collapses on reopen) | by code (no data locally) |
| 7 | `beforeprint` opens all, `afterprint` restores | pass (event simulated) |
| 3 | Re-open Job info after pick; re-pick collapses again | by code (only `choose()` collapses) |
| 8 | Tablet portrait/landscape tap sizes (44px summaries via CSS) | not run on a device |
| 9 | Keyboard toggle — native `<summary>` | by design, not run |

## Not done / notes
- "Incomplete" red tag in a collapsed header: skipped — record-chrome already shows "n of m fields done" in every header.
- No height animation (instant open/close) so reduced-motion is satisfied trivially.
- record-chrome already auto-folds a form-record section when its last field is completed (Tablet UI v2 C2/C3). Unchanged; flag if Michaela wants that off now that every section is collapsible.
- Pages not on the tablet shell and the PC layout (`rt-pc`) were not visually checked.
