# Dry Export Pack Front Page — auto-populated Attachment Checklist (instructions for Claude Code)

**Requested by:** Michaela, 2026-09-22
**Target file:** `public/records/Dry-Export-Pack-Front-Page-dry-export-pack-front-page.html`
**Do not code this in chat/Claude Design — hand this file to Claude Code as-is.**

## What Michaela asked for

On the Dry Export Pack Front Page, replace the current manual "Attachments checklist" (five
plain yes/no toggles the operator fills in by hand) with a checklist backed by the actual
records, not a self-reported tick — exactly the pattern already built for NRCS Canning (see
`claude/nrcs-canning-add-view-verify-gate-instructions.md`):

1. **Auto-adds the records** — once a job number is entered, every record required for that job
   is found and listed automatically, the same way the NRCS Canning "Records for this job"
   roster already works (see `claude/nrcs-canning-add-view-verify-gate-instructions.md` and the
   `recordpick`/`jobtrace` pattern used on REC 8.1.6b and REC 8.1.7 — this codebase already has
   this exact mechanism, it just isn't wired up on this page yet).
2. **User must approve** — auto-added rows are not silently treated as done. Approval here means
   the same thing it means on the NRCS Canning gate: the row's status reflects whether the real,
   linked record has actually been completed and verified (Not attached / Draft — not yet
   submitted / Awaiting verification / Verified), not a plain yes/no checkbox the preparer ticks
   by hand. The person filling in the form must confirm each row against the real record's status
   before it counts as attached — see "What to build" below, which replaces the earlier
   "Approved by preparer: yesno" idea with this same verified-status gate.
3. **All required records must be listed, and all must be attached, based on job number** — the
   checklist is not just the 5 legacy REC codes hardcoded today; it must include every record
   type that SOP-56 (Dry Export) and the traceability roster already say belongs to a dry export
   job (see the full list on REC 8.1.7's roster description below), and the front page must not
   allow marking the pack complete until every one of those is attached.

## Current state (what exists today)

The live page ships as a set of 5 static yes/no fields:

```js
{ title: 'Attachments checklist', fields: [
  { key: 'rec747Attached', label: 'REC 7.4.7 Labelling of Dry Boxes attached?', type: 'yesno' },
  { key: 'rec748Attached', label: 'REC 7.4.8 Dry Labelling List attached?', type: 'yesno' },
  { key: 'rec749Attached', label: 'REC 7.4.9 Dry Stock Transfers attached?', type: 'yesno' },
  { key: 'signedPackingListsAttached', label: 'Signed packing lists attached?', type: 'yesno' },
  { key: 'healthCertificatesAttached', label: 'Health certificates attached?', type: 'yesno' }
]}
```

This is a manual checkbox list — nothing looks up whether the record actually exists for this
job, and nothing stops the operator ticking "yes" on a record that was never filed. That's the
gap this change closes.

The mechanism to fix it already exists elsewhere in the codebase and must be reused, not
reinvented:

- `recordpick` / `source: 'jobtrace'` roster columns (`wireRecordPick` in `public/lib/form-record.js`)
  — given a job number field, offers a dropdown of only the records actually filed against that
  job number, and can auto-fill other columns from the picked record (`fillCode`, `fillName`, or
  the newer generic `fillMap`).
- `window.Traceability.trace(jobNo)` (`public/lib/traceability.js`) — resolves a job number to
  the specific submissions filed against it.
- The verify-gate roster pattern from `claude/nrcs-canning-add-view-verify-gate-instructions.md`
  — a `required: true` flag on a roster column, a status badge per row
  (Not attached / Draft — not yet submitted / Awaiting verification / Verified (date)), and a
  finalize-time block (`saveForm(finalize)` in `form-record.js`) that refuses to submit until
  every required roster row is attached **and** verified. Draft saves are never blocked by this.
- REC 8.1.7 (Traceability Mock Recall — Dried Abalone) already lists, in its roster title, the
  full set of record types that belong to a dry-line job: Dry Cooking (7.4.0), Drying Process
  (7.4.1), Dry Monitoring (7.4.2), Grading Production Log (7.4.3.1/7.4.3.2), Grading & Boxing
  Traceability (7.4.4), Boxing & Labelling (7.4.5), Dry Stock Control (7.4.6), Labelling of Dry
  Boxes (7.4.7), Dry Labelling List (7.4.8), Dry Stock Transfers (7.4.9), Dried Abalone Transfer
  (7.4.10), plus incoming/COA and cleaning/hygiene records. This is the reference list for "all
  required records" on a dry export job — use it as the starting checklist, not the 5 legacy
  fields currently on the front page.

## Bigger structural issue found while scoping this: bin code, not job number, is the real link

Before the REC 7.4.8 wrinkle below, a more fundamental gap surfaced and was confirmed with
Michaela: **a single dry export shipment is packed from bins that blend stock from multiple job
numbers.** Grading splits one job's dried output across several physical bins
(`REC-7.4.3.1-grading-production-log-cultivated.html` and
`REC-7.4.3.2-grading-production-log-ranched.html` each carry a job number on the record itself,
plus a "Collection bins" roster of `{ binCode, binWeightStart, fullBoxWeight, finalBinWeight,
gradedWeight }` rows — i.e. one job's graded stock gets divided into multiple named bins). At
packing/export time, boxes are filled by pulling from whichever bins are on hand, which may carry
stock originally graded under different job numbers. So "attach records for this job number" is
the wrong model for the checklist as a whole, not just for REC 7.4.8: a job-number-only lookup on
the Dry Export Pack Front Page will systematically miss records tied to the *other* job numbers
whose bins fed this shipment.

**What exists today vs. what's missing:**
- Bin codes already exist as data, but only as a roster sub-field on REC 7.4.3.1/7.4.3.2 — there
  is no top-level `bin-code → job number(s)` index anywhere in the codebase.
  `Traceability.trace()` only accepts a job number as input; it has no reverse lookup from bin
  code to job number, and `TRACEABILITY.md` explicitly notes today's indexing is "one entry per
  job number" — a roster sub-field like `binCode` is not currently indexed at all (see
  `TRACEABILITY.md`'s own note: "where `jobNumber` is a per-row roster/log column rather than one
  value for the whole submission, indexing needs a small extension").
- No downstream record (Dry Labelling List, Dry Stock Transfers, Dry Export Pack Front Page)
  currently captures which bin code(s) were used to fill a given shipment/box, so even once a
  bin→job index exists, something has to capture "these bin codes went into this shipment" at
  labelling/packing time for the chain to be walkable end to end.

**Build decision — do this in two parts, sequenced, not as a single change to the front page:**

1. **Engine change (do first, separately, low risk):** extend `Traceability` with a bin-code
   index. When REC 7.4.3.1/7.4.3.2 save, in addition to today's whole-submission job-number
   indexing, also write one `bin_link:<binCode> → { jobNumber, recordKey, submissionId }` entry
   per collection-bin roster row (mirrors the existing `batch_link:<job>:<record>:<submission>`
   pattern in `TRACEABILITY.md`, just keyed by bin code instead of job number). Expose a lookup
   function, e.g. `Traceability.jobsForBin(binCode)` returning the job number(s) that bin's stock
   came from — a bin could in principle be topped up from more than one job's grading run, so this
   should return an array, not assume one job per bin.
2. **Capture bin codes on the shipment itself.** **Confirmed with Michaela: this belongs on REC
   7.4.8 Dry Labelling List**, not the Dry Export Pack Front Page — that's the record where box
   code and NRCS AG code are already assigned per box at labelling time, and bin code is the same
   kind of per-box/per-shipment detail known at that point. Add a bin code field/column to REC
   7.4.8's roster (alongside Box No./Grade Range/Box code/NRCS AG Code) to record which bin
   code(s) fed each box. Without this, there is nothing to resolve bin→job against for a *given*
   shipment.
3. **Only then** can the front page's attachment checklist auto-populate correctly: resolve the
   shipment's bin code(s) → the set of job number(s) via `Traceability.jobsForBin()` → run the
   existing `jobtrace` auto-match roster once per resolved job number, unioning the required
   records found across all of them (a required record type is satisfied once any of the
   contributing jobs has it attached+approved — confirm this "satisfied by any one job" logic
   with Michaela, since a stricter read might require it per job).

**Resolved:** bin code capture goes on REC 7.4.8 Dry Labelling List (see point 2 above) — the same
record where box code and NRCS AG code are already assigned per box at labelling time. This is
now settled, not an open question.

## Correction: sales sends templates *into* this system for production to complete — not just reference files

**Confirmed with Michaela (2026-09-22):** the sales department's own online application produces
the labelling list and packing list per shipment (see the `export-manager` folder structure
below), and **sends these to production, where production fills in its own required columns and
saves the completed record within this processing system** — the same way REC 7.4.8 works today
(sales/Abagold's labelling-list template comes in with Box No./Grade Range pre-populated, and
production fills in Box code + NRCS AG Code before saving/signing). The packing list works the
same way: sales' packlist is the starting point, and production's completed version is what gets
saved and filed here, not left as a standalone spreadsheet in a network folder.

**This changes what "attach the record" means for these two items:** REC 7.4.8 (Dry Labelling
List) and the packing list are not external documents the checklist needs to somehow verify exist
on a file share — they are **records that get created and saved inside this same system**, by
production, using sales' data as the starting template. So the correct build is not "read the
sales network folder to confirm a file exists" — it is: (a) sales' data needs a way to get into
this system as the starting point for the record (e.g. an import/starting-values step, scoped
separately — see open question below), and (b) once production completes and saves it, it is a
normal filed submission like any other, so it participates in the roster/`recordpick`/verify-gate
mechanism used throughout this spec exactly like every other required record. Do not design the
checklist around "check whether a file exists in a folder" — design it around "has production
completed and saved this record in the system yet," which is the same Verified-status gate
already specified above.

**Open question to confirm with Michaela before Claude Code builds any import step:** how should
sales' data (from the `export-manager` folder, or from wherever sales' online application outputs
land) actually get into this system as the starting point for production's REC 7.4.8 / packing
list entry — a manual copy-paste by whoever starts the record, an upload of the sales-provided
file, or an automated pull from the `export-manager` folder? This is a real scoping decision
(reading an arbitrary Windows file share from a browser-based app is a different capability than
anything in this system today) and should not be assumed — flag it as a separate follow-up rather
than building it as part of this checklist change.

## Reference: the sales export number (`EXP-####`) as a shipment-level identifier

Michaela shared the sales department's own file store — `export-manager` (a folder tree the sales
team's online application writes to, organized `<customer name>/EXP-####/...`). This shows a
shipment-level identifier that already threads through every document sales produces, independent
of job number, bin code, or AG code — useful as a reference number, per the correction above, not
as a file-existence check to build a checklist against.

**Confirmed folder pattern** (checked across three different customers — Ocean Treasure, Grand
Seafood, Hai Tung — all consistent):

```
<customer name>/
  EXP-4910/
    EXP-4910_2026-09-16_<customer>_AMI_Invoice.xlsx / .pdf
    EXP-4910_2026-09-16_<customer>_BF60A_Health_Cert.docx
    EXP-4910_2026-09-16_<customer>_Packlist.xlsx / .pdf
    EXP-4910_2026-09-16_<customer>_Packlist_Summary.xlsx / .pdf
    EXP-4910_2026-09-16_<customer>_Standard_Invoice.xlsx / .pdf
    EXP-4910_2026-09-16_<customer>_IDN.xlsx                      (present on some shipments)
    EXP-4910_2026-09-16_<customer>_Picking_List.xlsx / .pdf      (present on some shipments)
    20260916 - <customer> - REC 7.4.6 Dry Labelling list - 4910.docx   (Abagold's own filename,
                                                                         not sales' naming — this
                                                                         is the labelling-list
                                                                         template Abagold fills in
                                                                         and returns; see note below)
    AWB & HC.pdf / COO.pdf / HC.pdf                              (loose, hand-added scans — AWB,
                                                                   health cert, certificate of
                                                                   origin — inconsistent naming,
                                                                   added manually per shipment,
                                                                   not part of the automated set)
```

Every `EXP-####` folder is the complete paper trail for one shipment: sales-generated invoice/
packlist/health-cert/picking-list documents, plus the labelling list that comes back from
Abagold once boxed and signed, plus loose freight/compliance scans added along the way.
`EXP-####` is the number sales' own system uses as its record key, and it's the one already
printed on the labelling list docx Abagold fills in (see "INV. NO. 4910" in the earlier
Ocean Treasure example) — so it is a naturally occurring, always-present field on the paperwork
already, unlike bin code or job number.

**What this changes about the plan above:** this doesn't replace the bin-code/job-number
traceability work above — REC records inside Abagold's own system are still keyed by job number
(and bin code, once that's wired up), because that's what NRCS/food-safety traceability requires.
**The only change needed here is a plain field**: add an **Export/Invoice no. (`EXP-####`)** text
field to the relevant records (Dry Export Pack Front Page and/or REC 7.4.8), simply storing the
number as printed on the sales paperwork for this shipment. That is the entire scope of this
item — just capture the number on the record. Per the correction above, do **not** build any
folder-reading, file-existence-checking, or cross-referencing mechanism against the
`export-manager` network share — that is out of scope and not something to build here.

**Do not treat this as solving the bin-code/job-number matching problem.** The `EXP-####` number
is a sales/invoice-side key; it is not tied 1:1 to job number (confirmed earlier in this document)
and it is not a food-safety traceability key NRCS would recognize — it's an additional,
reliably-present reference number worth surfacing on the front page, not a replacement for the
job-number/bin-code work above.

**Forward-looking note (confirmed with Michaela, not in scope now):** the `export-manager` folder
is itself generated by sales' own online application, not a manually-maintained file share. That
means a future direct system-to-system integration between sales' application and this processing
system is plausible (e.g. sales' app pushing shipment data — customer, invoice number, packlist
contents — directly into this system via an API, rather than production re-keying it from a
folder or file). Capturing the plain `EXP-####` field now is a small, low-risk step that would
also make a later integration easier to key against — but no integration work should be assumed
or built as part of this checklist change; it's a separate, future project to scope explicitly
with Michaela if and when it becomes a priority.

## Resolved wrinkle: REC 7.4.8 (Dry Labelling List) cannot be auto-matched — confirmed with Michaela

`dry-labelling-list` (REC 7.4.8) is indexed by `agCode`, not `jobNo`
(`public/lib/traced-records.js`: `"batchField": "agCode"`). Every other record in the dry chain
is indexed by `jobNo`/`jobNumber`, so a plain `jobtrace` lookup keyed on job number surfaces all
of them automatically — except this one.

**Confirmed with Michaela (2026-09-22):** there is no fixed mapping between a sales invoice/order
number and Abagold's job number — a job can span multiple invoices or vice versa — so there is no
reliable key to auto-resolve REC 7.4.8 submissions from the job number. The AG code itself is only
assigned when production fills in and signs the labelling list per box, starting from the
packing-instruction/packlist and labelling-list templates sales sends per invoice (see real
example: `EXP-4910` invoice, 38 cartons, sizes `DRYJ1720`–`DRYJ3639`, boxed then labelled with
Box code + NRCS AG Code before sign-off). Per the correction above, production completes and saves
both the packing list and the labelling list **within this processing system**, using sales' data
as the starting template — that completed, signed labelling list is filed as a permanent REC 7.4.8
record; it is not a pass-through/reference document, so it must be traceable and searchable like
every other filed record.

**Build decision:** do NOT try to auto-populate REC 7.4.8 into the checklist via `jobtrace`.
Instead:
1. Keep REC 7.4.8 as a **required roster row** on the Dry Export Pack Front Page checklist
   (see roster below — `sourceRecordKey: 'dry-labelling-list'`), but let the `recordpick` picker
   for that one row **fall back to the full Master Index / dry-labelling-list list** (not
   filtered by job number) so the preparer can manually find and pick the specific labelling
   list submission(s) that belong to this shipment — the same fallback behavior `recordpick`
   already has today when no job number match exists (see `wireRecordPick` in `form-record.js`:
   `if (!opts.length) opts = masterIndexOptions();`).
2. This row therefore behaves like the other checklist rows for approval/verification purposes
   (still gates Submit, still needs to reach "Verified" status via the real record's own
   verification flow) but differs in that it is never silently auto-added — it must always be a
   deliberate pick, and the UI/instructions text should say so explicitly (e.g. "Dry Labelling
   List (REC 7.4.8) is not linked by job number — search and pick the specific submission for
   this shipment.").
3. No changes needed to `Traceability.trace()` or `traced-records.js` for this — this is a UI/UX
   accommodation on the checklist roster, not an engine change.

**Cross-reference:** REC 7.4.8 is also where the bin code field from "Bigger structural issue"
above gets added (point 2 in that section) — Box No./Grade Range/Box code/NRCS AG Code/bin code
are all captured together per box on this same record, at the same labelling step.

## What to build

1. **Replace the "Attachments checklist" section** with a `roster` block (same shape as REC
   8.1.7 / REC 8.1.6b), keyed off the page's existing `jobNumber` field:

   ```js
   roster: {
     title: 'Attachment checklist — records required for this dry export job',
     columns: [
       { key: 'submissionRef', label: 'Record', type: 'recordpick', source: 'jobtrace',
         jobField: 'jobNumber', fillCode: 'recordCode', fillName: 'recordName', required: true }
       // no separate yes/no "approved" column — see below: status is read from the real record
     ]
   }
   ```

   **Do not add a plain yes/no "Approved by preparer" column.** Per the correction above, this
   must work exactly like the NRCS Canning "Add / View / Verify" gate
   (`claude/nrcs-canning-add-view-verify-gate-instructions.md`): each row's status badge
   (Not attached / Draft — not yet submitted / Awaiting verification / Verified (date)) is read
   from the real linked record's own save/verify state — not from a checkbox on this page. Reuse
   that gate's exact mechanism: the `verifiedDate` it introduces, the same status-badge classes
   (`.badge-warn`/`.badge-ok`/`.badge-muted`/`.badge-info`), and the "View" link pattern to open
   the actual record. "Approved" on this checklist means the linked record itself has reached
   Verified status via its own normal sign-off flow — never a separate rubber-stamp tick added to
   this roster.

   The REC 7.4.8 (Dry Labelling List) row is the one exception in this roster: it does not use
   job-number auto-matching (see "Resolved wrinkle" above) — its `recordpick` column should
   declare `sourceRecordKey: 'dry-labelling-list'` and rely on the existing fallback-to-Master-
   Index behavior so the preparer searches and picks it manually. Every other required row uses
   the standard `jobtrace` auto-match. Once picked, it is held to the same Verified-status
   requirement as every other row — picking it is not itself enough to satisfy the checklist.

2. **Auto-populate rows on job number entry.** When `jobNumber` is filled in (or changed), call
   the same `jobTraceOptions()`/`Traceability.trace()` path used elsewhere to fetch every
   submission filed against that job, and pre-create one roster row per required record type
   found — not just leave the roster empty for the operator to add rows one at a time. This is
   the "auto add the records" behaviour Michaela asked for; today's `recordpick` only offers
   choices in a dropdown when a row already exists, it doesn't proactively create rows. This is
   new behaviour needed on top of the existing mechanism — check whether any other page already
   auto-creates roster rows from a fixed required-list (the NRCS Canning "Production codes"
   roster is the closest precedent) before building it from scratch.

3. **Required-set definition.** Hardcode the required record-type list for this page (the REC
   8.1.7 list above, trimmed/confirmed with Michaela if some of those don't actually apply to
   "export pack" as opposed to production — e.g. does the export pack need Dry Cooking/Drying
   Process records, or only the packing/labelling/transfer/health-cert end of the chain?). Flag
   this open question back to Michaela before finalizing the required list — do not silently
   guess which subset applies.

3a. **Sequencing note:** steps 1–3 above (the roster, auto-populate, required-set) all assume a
    single job number resolves every required record. Per "Bigger structural issue" above, that
    assumption is false for a real shipment spanning multiple bins/jobs. Build and ship the
    bin-code traceability extension (bin index + bin-code capture point) as its own separate,
    prior change; only wire the front page's auto-populate step to resolve *all* contributing job
    numbers via bin code once that groundwork exists. Do not ship a version of this checklist that
    silently only checks the one job number typed into "Shipment details" — that would recreate
    the exact traceability gap this whole request is meant to close.

4. **Finalize-time gate.** Reuse the exact `saveForm(finalize)` roster-completeness check from
   `claude/nrcs-canning-add-view-verify-gate-instructions.md` engine change 3: block Submit
   (not Save draft) until every required roster row is both attached (a specific record picked)
   and Verified (per the real record's own status, not a checkbox on this page). Show a clear
   message naming which record(s) are missing or still unverified.

5. **Status badges.** Reuse the existing badge classes and meanings from the NRCS Canning gate
   exactly (`.badge-muted` = Not attached, `.badge-info` = Draft — not yet submitted, `.badge-warn`
   = Awaiting verification, `.badge-ok` = Verified (date)) — do not invent a separate "Approved"
   state for this page.

## Testing checklist

1. Enter a job number with several dry-line records already filed. Confirm the roster
   auto-populates one row per required record type, each linked to the actual filed submission
   (not just the record type name).
2. Confirm an auto-added row whose linked record is only in draft shows "Draft — not yet
   submitted" or "Awaiting verification" as appropriate — never a pre-ticked/approved state.
3. Go verify the underlying linked record via its own normal verification flow; reopen this
   checklist and confirm the row's status now reads "Verified (date)" — not because anything was
   ticked here, but because the real record changed status.
4. Try Submit with at least one required row not yet Verified or not attached — confirm it's
   blocked with a message naming the missing/unverified record(s).
5. Save as draft in the same incomplete state — confirm draft save is not blocked.
6. Verify all required rows' underlying records, confirm Submit now succeeds.
7. Confirm the REC 7.4.8 row is present as a required checklist item but is never auto-filled —
   confirm the preparer can search and manually pick the correct Dry Labelling List submission
   for this shipment, and that it is held to the same Verified-status gate as every auto-matched
   row (picking it alone does not satisfy the checklist).
8. Confirm the "View" link on an attached row opens the underlying record in a new tab (reuse
   the existing pattern from `verification-queue.html` / the NRCS Canning gate).

## Status
Not yet built. This document is the spec handoff — build directly against
`public/records/Dry-Export-Pack-Front-Page-dry-export-pack-front-page.html`,
`public/lib/form-record.js`, and `public/lib/traceability.js`.
