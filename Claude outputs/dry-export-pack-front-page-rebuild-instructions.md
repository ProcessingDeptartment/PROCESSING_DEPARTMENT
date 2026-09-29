# Dry Export Pack Front Page — rebuild from the paper form (instructions for Claude Code)

**Requested by:** Michaela, 2026-09-29
**Base document:** `Dry Export pack front page.docx` (the paper form is the base for what the online record requires)
**Target page:** `public/records/Dry-Export-Pack-Front-Page-dry-export-pack-front-page.html` (record key `dry-export-pack-front-page`)
**Supersedes:** the checklist section of `claude/dry-export-pack-attachment-checklist-instructions.md`. Keep that document's bin-code background; ignore its required-record list and its roster/recordpick build.

## 1. Read this first: things that are not what they seem

1. **The live database definition for this record has drifted from `data/record-definitions.json`.** Different field types were seen live than the JSON holds, and the page has flipped between a cached older layout and a newer one. Do not run the full `seed-definitions.mjs` until the JSON is brought back in line with the live tables, or it will overwrite live pages. Before building, export the live definition for this record (`GET /api/record-def/dry-export-pack-front-page`) and compare it with the JSON and with `public/data/record-defs/dry-export-pack-front-page.json`.
2. **A job number cannot identify an export pack.** Boxes are filled from bins that mix stock from several jobs. The link is bin code, not job number (see section 4).
3. **Possible leftovers from an aborted attempt on 2026-09-29.** A job-number-driven checklist was briefly deployed to this page, and a SQL script added six `cmt7xx` comment fields and set six record pickers to `required = false`. An undo script (`revert-dry-export-pack.sql`) was provided. Check the live table `RecordFieldDef` for `recordKey = 'dry-export-pack-front-page'` and remove any `cmt745`…`cmt7410` fields left over before adding new ones. Check the page file does not still contain the old `attachmentsChecklist` script.
4. **Numbering conflict to confirm with Michaela.** The paper form says "REC 7.4.6 Labelling list attached?". In the system, the dry labelling list is REC 7.4.8 (`dry-labelling-list`) and REC 7.4.6 is Dry Stock Control (`dry-stock-control`). This spec treats the paper form's labelling list as `dry-labelling-list` and labels the row "Dry Labelling List". Confirm, and correct the paper form's code if it is a typo.

## 2. The form, as on paper

Shipment details: **Packing date**, **No. of boxes exported**.

Attachments (each "attached?"):

| Row | Record | System key | Kind |
|---|---|---|---|
| 1 | Dry Labelling List (paper form: "REC 7.4.6 Labelling list") | `dry-labelling-list` | Filed record, picked by hand |
| 2 | REC 7.4.7 Labelling of Dry Boxes | `labelling-of-dry-boxes` | Filed record, found automatically |
| 3 | REC 7.4.9 Dry Stock Transfer | `dry-stock-transfers` | Filed record, found automatically |
| 4 | Signed packing lists | (file) | Upload |
| 5 | Health certificates | (file) | Upload |

Sign-off block: Completed by (Supervisor), Checked by (QC), Verification by, each with Signature and Date. Use the standard "Completed by" block the other pages now use; keep Verification by working as it does today.

Not required on this page: REC 7.4.5, 7.4.6 (Dry Stock Control), 7.4.10, and the earlier long list. Do not add them.

## 3. Layout (copy the Dry NRCS Packs checklist)

Reference implementation: the inline script at the bottom of `public/records/Production-Information-NRCS-(Dry)-dry-nrcs-packs.html` (element `#attachmentsChecklist`) and its fields in `data/record-definitions.json`. Reuse its look and structure:

- One table titled ATTACHMENTS CHECKLIST with columns **Record**, **Attached**, **Submissions**, **Comments**.
- **Attached** is Yes / No / Incomplete, computed, never typed. Rule: at least one record must exist, and every record that exists must be completed (submitted or verified, not draft). Any draft = Incomplete. Rows that are No or Incomplete are shaded red; complete but unverified rows are amber.
- **Submissions** lists every linked submission with date and status and links to it. When a record has many submissions (10 of one type is normal), show one summary line ("10 submissions · 8 verified · 2 awaiting verification") that expands to the full list. Rows with drafts expand by default.
- **Comments** is a normal text form field per row (`cmtLabelling`, `cmt747`, `cmt749`, `cmtPackingLists`, `cmtHealthCerts`), saved with the submission.
- A summary banner above the table: red "Not complete … (n of 5)" naming what is missing, or green when all are attached and completed. A note counts attached-but-unverified submissions.
- **Block Submit (not Save draft)** while any row is No or Incomplete, with a message naming the row(s). This was requested for this page specifically.

## 4. How records are found (the important part)

1. The preparer **picks the shipment's Dry Labelling List** (row 1). It is the one record that cannot be looked up automatically: the AG code is only assigned when production completes it, and there is no fixed mapping from a sales invoice to a job number. Keep the existing `recordpick` for `dry-labelling-list` (falls back to the full list of that record's submissions, not filtered by job). Show it inside row 1's Submissions cell. Row 1 is Attached = Yes only when the picked submission is completed.
2. Read the **bin codes** from the picked labelling list (roster column `binCode`, added to that record's boxes roster by `scripts/apply-dry-export-checklist.mjs`; confirm it is also in the live tables, and that the picked option exposes roster values — `recordSubmissionOptions` currently returns top-level `values` only, so this may need extending).
3. Resolve bin codes to jobs with `Traceability.jobsForBin(binCode)` (returns an array; a bin can be topped up from more than one job). Union the results into the shipment's set of job numbers.
4. For rows 2 and 3, run `Traceability.trace(jobNo)` for **every** job in that set and merge, de-duplicating by `record_key|submission_id`. Show all found submissions for each row, grouped, with the job number on each so it is clear which job supplied it.
5. The completion rule in section 3 applies to the merged set. Confirm with Michaela whether a required record must exist **for every contributing job** (stricter) or **for the shipment as a whole** (satisfied once any job has it). Default to the whole-shipment reading and show per-job counts in the row's expanded list so the gap is visible either way.
6. Rows 4 and 5 are uploads (see section 5). They do not use tracing.

`labelling-of-dry-boxes` and `dry-stock-transfers` were given a `Job no.` field and `batchField: 'jobNo'` by `scripts/apply-dry-export-checklist.mjs`. Verify this is live in the database and in their submission tables before relying on it. Older submissions filed before the field existed will not be found by job — decide whether to backfill.

If the labelling list has no bin codes, or `jobsForBin` returns nothing, show a clear message on the page ("No bin codes found on this labelling list — cannot find linked records") and keep rows 2 and 3 as No. Do not silently fall back to the typed job number.

## 5. Packing lists and health certificates

The paper form treats these as "attached?". Decide with Michaela: a file upload each (the earlier live version used upload fields, which give real evidence), or Yes/No. Default: **upload, required**, Attached = Yes once a file is present. Sales' packing list is the starting point that production completes in this system, per the earlier spec; do not build anything that reads the sales `export-manager` folder. Optionally capture the sales **Export/Invoice no. (`EXP-####`)** as a plain text field on this page, per the earlier spec — no lookups.

## 6. Data and database

- Keep everything in the existing `RecordDefinition` / `RecordSectionDef` / `RecordFieldDef` tables and mirror it into `data/record-definitions.json` and `public/data/record-defs/dry-export-pack-front-page.json`. Update these together, then bump the definition `version`.
- Fields: `jobNo` (keep, optional — no longer the driver), `packingDate` (required date), `noOfBoxesExported` (number), `labellingListPick` (recordpick, `dry-labelling-list`), the five comment fields, the two upload fields, and the standard Completed by block. Remove the six old `rec74xAttached` pickers once no saved submission needs them; check existing submissions first, do not orphan their data.
- The submission tables (`sub_dry_export_pack_front_page`) need columns for new fields. Use `scripts/generate-submission-schema.mjs` and a migration; do not run `prisma db push` or `migrate dev` (there is known unrelated drift, see `SIGNOFF_MIGRATION_TODO.md`).
- If the database is edited by SQL rather than the seed script, record it in a script under `scripts/` so the JSON and the database stay identical.

## 7. Testing checklist

1. Pick a labelling list with bin codes fed by two different jobs. Confirm both jobs are found and rows 2 and 3 list records from both.
2. A record with several submissions collapses to one summary line and expands to all of them.
3. A draft anywhere in a row makes it Incomplete (red), lists the draft, and names it in the banner.
4. Missing 7.4.7 or 7.4.9 for the shipment: banner names it; Submit is refused; Save draft works.
5. Complete and verify everything, attach both files: banner turns green and Submit succeeds.
6. Comments save, reopen and print correctly; the sign-off block prints as on the paper form.
7. Reload after saving a draft: the picked labelling list and all rows repopulate.
8. Confirm no other page changed and `seed-definitions.mjs` was not run against a stale JSON.

## 8. Open questions for Michaela

1. Labelling list is REC 7.4.8 in the system but 7.4.6 on the paper form — which is right?
2. Must each required record exist for every contributing job, or once for the whole shipment?
3. Packing lists and health certificates: upload or Yes/No?
4. Can one shipment have more than one labelling list? If so row 1 needs several picks.
5. Backfill: should older 7.4.7 / 7.4.9 submissions without a job number be linked to jobs?
