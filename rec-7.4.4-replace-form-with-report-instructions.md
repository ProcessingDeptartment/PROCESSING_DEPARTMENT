# REC 7.4.4 Grading, Boxing & Traceability: replace the input form with a report (instructions for Claude Code)

**Decision (Michaela, 2026-10-01):** the data already sits in other records, so REC 7.4.4 does not need to be a typed form. Keep REC 7.4.4 as a **report** that is generated from the existing records. No coding was done in writing this; this file is the brief.

## 1. Why the form is redundant

Live definition of `grading-boxing-traceability` (REC 7.4.4): job no. (+ receiving date, farm, processing for, whole weight), date created, bin code, size grade, and a free-text "Job numbers in bin".

Everything in it is held elsewhere:

| 7.4.4 content | Already captured in |
|---|---|
| Job no., receiving date, farm, processing for, whole weight | Receiving (REC 7.1.2) via the job lookup |
| Bin code, size grade (one bin per size grade) | REC 7.4.3.1 / 7.4.3.2 "Collection bins" roster (`binCode`, `sizeGrade`, `binNo`) |
| Which jobs are in a bin (blending) | REC 7.4.3.1 / 7.4.3.2. The roster's `fixedGroups` setting reads both grading logs (`sources`) and continues the bin per size grade across jobs, so a topped-up bin carries the same bin code in each job's log. **Confirmed by Michaela: topping up with several jobs is carried through by the 7.4.3 format.** |
| Bin to box | REC 7.4.8 (box code, NRCS AG code, weight, `binCode` per box); REC 7.4.5 (`binCode`, size range, nett weight) |

The "Job numbers in bin" free text is the weakest field in the system (cannot be joined or filtered) and is duplicated information.

## 2. Hard dependency: do NOT hide the 7.4.4 form first

The current bin index (`bin_link`, `Traceability.jobsForBin`) is fed by REC 7.4.4 (`binField: binCode`, `binJobsField: jobNumbersInBin`). Removing the form first breaks bin-to-job lookups. Build in this order, as separate changes:

1. **Feed the index from 7.4.3.1 and 7.4.3.2.** On save, write one `job -> bin` edge per Collection bins roster row into `stock_link` (schema in `claude/dry-export-pack-front-page-rebuild-instructions.md` section 9.3), written by the API in the same transaction as the submission. Replace that submission's edges on every save so a re-save creates no duplicates. A bin code that appears under two jobs yields two edges, which is how blending shows up.
2. **Backfill.** One script under `scripts/`: build `stock_link` from existing 7.4.3.1/7.4.3.2 submissions, and also from existing 7.4.4 submissions (split the free-text "Job numbers in bin" on commas/spaces/new lines; validate each against `^(3CP|3DP|CPR|DPR)\d+$`). Report rows created per record type, and list every submission that could not be linked (missing or malformed key) for Michaela to review. Do not guess.
3. **Reconcile.** For every bin that exists in 7.4.4 data, check that the 7.4.3 edges give the same set of jobs. Output a mismatch list. Resolve mismatches before step 5.
4. **Build the report** (section 3).
5. **Then** hide the 7.4.4 entry form (section 4).

## 3. The report

Title: **REC 7.4.4 Grading, Boxing & Traceability (report)**. Read-only, generated from `stock_link` plus the proving submissions. One API call per view, no per-row lookups in the browser.

**Inputs (any one):** job number, bin code, box code, NRCS AG code, export/invoice no. Direction is automatic (forward and backward).

**Layout, one row per bin:**

| Column | Source |
|---|---|
| Bin code | 7.4.3.x roster |
| Size grade | 7.4.3.x roster |
| Job number(s) in bin | all `job -> bin` edges for that bin (one per contributing job) |
| Graded weight per job (kg) | `gradedWeight` on the roster row |
| Date graded | `gradingDate` |
| Box codes + NRCS AG code(s) | 7.4.8 rows where `binCode` matches |
| Export / invoice no. | 7.4.8 header, via the box-to-export edge |
| Source record links | link to each proving submission (7.4.3.x, 7.4.5, 7.4.8) with status (draft / submitted / verified) |

Show a blended bin clearly (for example a "2 jobs" badge, expandable to the per-job weights). Show a warning row where a bin has boxes but no grading edge, or a grading bin with no boxes yet (still in stock).

**Optional mass balance per bin:** weight in (sum of graded weights) against weight out (sum of box weights), with a tolerance and a flag. Show it on the report only.

**Output:** on-screen table, print layout (A4 landscape, header with generated-on date/time, user, and the query used), and CSV export. The print is the audit evidence for a mock recall, so it must carry the "generated on" stamp.

## 3a. Box code = bin code (confirmed by Michaela, 2026-10-01)

The physical bin and the box are the same unit: once the abalone is sealed, the bin code becomes the box code. So there is **no separate bin-to-box link to build**. The chain is `job -> bin/box code -> export invoice`.

- In `stock_link`, do not create a separate `box` node type for this. Treat `box` and `bin` as the same key (a box lookup is a bin lookup). This supersedes the separate bin and box steps in section 9.1/9.5 of `dry-export-pack-front-page-rebuild-instructions.md`.
- REC 7.4.8 has both `boxCode` and `binCode` per box. They must hold the same value. Preferred: keep `boxCode` (it is the label name) and make `binCode` read-only, auto-filled from it, or drop the extra column. If both stay, add a check that flags any row where they differ. Decide with Michaela; do not delete existing data.
- Validate on save that every 7.4.8 box code exists as a bin code in a 7.4.3.1/7.4.3.2 grading record. Warn (not block) when it does not: this catches typos and boxes with no grading record.
- REC 7.4.5 `binCode` is already the box code, so no change. Show it on the report as "Bin / box code".
- Report column "Box codes" becomes "Bin / box code", and the box lookup input is the same field as the bin lookup.
- Add to the tests: a 7.4.8 box code that matches no grading bin is flagged; a box code typed with different case or spacing is normalised (trim, upper-case) before matching, both in the index and the lookup.
- Weight check: a sealed box is one bin, so the box nett weight (7.4.5 / 7.4.8) can be compared directly with the bin's graded weight for the mass balance in section 3.

## 3b. Per-shipment snapshot via the Dry Export Pack (confirmed by Michaela, 2026-10-01)

The saved copy of the report belongs to the export pack, not to a separate form.

- On the Dry Export Pack Front Page, when the pack is **submitted**, the system generates the trace report for that shipment's export/invoice no. and stores it with the submission as an immutable snapshot (JSON of the rows plus a rendered print/PDF copy). Saving a draft does not freeze it; the draft shows the live report.
- Snapshot content: invoice no., generated-on date/time, generated-by, the exact rows shown (bin/box code, size grade, jobs and weights, 7.4.8 AG codes, source submission ids and their status at that moment), and any warnings (unmatched box codes, weight differences).
- Store it in a table such as `export_trace_snapshot (id, export_no, submission_id, generated_at, generated_by, rows_json, pdf_ref)`, linked to the export pack submission. Plain SQL, exportable. A re-submitted or corrected pack creates a **new** snapshot; old ones are kept, never overwritten.
- The pack's attachments checklist gets a read-only line "Trace report (REC 7.4.4)" showing the snapshot date and a link to it. It is generated by the system, so it is not typed and not an upload.
- A snapshot taken while the report has warnings shows them. Whether warnings block Submit is for Michaela to decide; default is warn only.
- The live report stays available for any job, bin or invoice at any time. The snapshot is the evidence of what was true when the shipment was packed.
- Test: submit a pack, then change a source record; the snapshot is unchanged and the live report shows the change. Re-submit the pack; a second snapshot is created.

## 4. Retiring the entry form

- Do not delete the record definition or any submission. Old 7.4.4 submissions stay readable and are shown on the report as a "legacy 7.4.4" source.
- Remove 7.4.4 from the "new entry" list and point its menu entry to the report. Keep the REC number and title so the master record index, REC 8.1.7 (Traceability Mock Recall, Dried Abalone) and any controlled-document list still resolve.
- Update REC 8.1.7's wording if it implies a filled-in 7.4.4 form is attached.
- **Controlled-document status (confirmed by Michaela, 2026-10-01):** REC 7.4.4 is a controlled document, but because the records around it (7.4.3.x, 7.4.5, 7.4.8) are controlled, the FSMS traceability requirement is met without 7.4.4 as a stand-alone form. Retire it as a form: mark it "withdrawn / superseded by system report" in the document register using the normal document-change process, keeping the REC number for the history. Make sure the surrounding controlled records stay locked after submission and carry an audit trail, since they are now the evidence.
- Update `data/record-definitions.json`, `public/data/record-defs/` and the live definition tables together, and bump the definition version. Do not run `seed-definitions.mjs` against a stale JSON (known drift, see the front-page instructions).

## 5. Database and portability

- Plain SQL table `stock_link`, no vendor-specific features, so it exports to CSV or moves to another database (Neon free tier today).
- Required indexes: `(from_type, from_key)`, `(to_type, to_key)`, `(record_key, submission_id)`.
- Target: 95th percentile under 300 ms on a warm system with 100,000 edges. Add an `EXPLAIN` test.
- Keep Neon compute from suspending in working hours and keep the API warm, otherwise the first request each morning is slow regardless of query tuning.

## 6. Testing checklist

1. Job with three size grades: the report shows three bins with their weights.
2. Bin topped up by two jobs: both jobs appear on that bin, with per-job weights.
3. Start from a box code in 7.4.8: it walks back to the bin and every contributing job.
4. Start from invoice 4910: all 38 boxes, their bins, and all contributing jobs.
5. A submission saved twice creates no duplicate edges.
6. Backfilled legacy 7.4.4 data matches the 7.4.3 edges, or appears on the mismatch list.
7. A bin with boxes but no grading record is flagged, not hidden.
8. Printout shows the generated-on stamp, user and query; CSV matches the screen.
9. Old 7.4.4 submissions still open read-only.
10. Timing test with a large seeded table.

## 7. Open questions for Michaela

1. ~~Controlled document?~~ Resolved: yes, controlled, but not needed as a form for FSMS because the surrounding records are controlled (section 4). Still needed: whoever owns the document register raises the change.
2. ~~Box code vs bin code?~~ Resolved: the box code **is** the bin code, renamed because the abalone is sealed in the box (section 3a).
3. ~~Snapshot per shipment?~~ Resolved: yes, saved through the Dry Export Pack front page (section 3b).
