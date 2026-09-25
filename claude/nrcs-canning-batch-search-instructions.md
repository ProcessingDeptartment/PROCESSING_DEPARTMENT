# Instruction file for Claude Code

**Task:** Add real, working batch/job search to the "Production Information NRCS (Canning)"
record so it actually pulls in the real records filed against that job — the same way
REC 8.1.6 (Traceability & Mock Recall Checklist for Canned Abalone) already does it — instead
of the current setup, which only lets someone hand-type record names into a blank roster table.

Do not invent a new mechanism. This codebase already has a working "search by job number and
pick from the real filed records" feature (`type: 'jobsearch'` + `roster` column
`type: 'recordpick', source: 'jobtrace'`, backed by `window.TracedRecords` /
`public/lib/traceability.js` / `public/records/batch-trace.html`). This task wires the NRCS
Canning page into that existing system. No new libraries, no new UI components.

---

## File 1 of 2: `public/records/Production-Information-NRCS-(Canning)-production-information-nrcs.html`

### Problem

Today this file has no job-number field at all (`productionCode` and `nrcsAgCode` are plain
free-text fields), and its `roster` table has a `recordName` column of `type: 'text'` — meaning
whoever fills this form in has to manually type out record names and REC codes from memory. There
is no link to the actual submitted records for that job, and nothing here participates in the
traceability index.

### Fix

Replace the entire `<script>(function () { FormRecord.init({ ... }) })();</script>` block with
the version below. Changes made, and why each one is needed:

1. **Add a `jobNo` field** (`type: 'jobsearch'`) to "Batch details", in the same style as REC 8.1.6
   uses `jobNo`. This is the actual search box that looks up real job numbers (format
   `3CP`/`3DP`/`CPR`/`DPR` + digits) from `abalone-receiving` job intake data, exactly like every
   other traced record already does. Without this field there is nothing to search *by*.
2. **Add `batchField: 'jobNo'` and `stage: 'nrcs-canning'`** at the top level of the config. This
   is what lets this record itself be indexed into the traceability system once someone fills it
   in (so a later mock recall / batch-trace lookup on this job also finds this NRCS record).
3. **Add an `autofill` block** watching `jobNo` against the `abalone-receiving` record (matching
   REC 8.1.6's pattern) so the operator doesn't have to re-key data that's already on the intake
   record. Left empty (`fill: {}`) unless you want specific fields auto-populated — see "Optional
   enhancement" below.
4. **Change the roster's `recordName` column from `type: 'text'` to a real `recordpick` column**
   (`type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', fillCode: 'recordCode', fillName:
   'recordName'`), copying the exact working pattern from REC 8.1.6's roster. This is the actual
   fix requested: once a job number is chosen in "Batch details", each roster row's picker will
   only offer records that were **actually filed under that job number** (pulled live from
   `window.TracedRecords` + the batch index), and picking one auto-fills the REC code and record
   name columns. With no job number chosen, it falls back to the full Master Index list (same
   fallback behavior as REC 8.1.6) — so the picker is never empty even before a job is chosen.
5. **Add an `instructions` block** (same idea as REC 8.1.6) telling operators: choose the job
   number first, then each roster row picks from the records actually filed against that job.
6. Keep the existing `listColumns: ['productionCode', 'nrcsAgCode']` — no change needed there.

Replace the script block with:

```html
<script>(function () {
  FormRecord.init({
    mount: '#frRoot',
    recordKey: 'production-information-nrcs',
    docCode: 'Production Information NRCS (Canning)',
    title: 'Production Information NRCS (Canning)',
    docRevisionStart: 1,
    batchField: 'jobNo',
    stage: 'nrcs-canning',
    listColumns: ['productionCode', 'nrcsAgCode'],
    instructions: [
      { label: 'How to fill this in', text: 'Choose the job number first — each row in the records table below then picks from the records actually filed against that job, linking the exact submission rather than just the record type. With no job number chosen the picker falls back to the full Master Index list.' }
    ],
    autofill: [
      { watch: 'jobNo', source: 'abalone-receiving', matchField: 'jobNo', fill: { } }
    ],
    sections: [
      { title: 'Batch details', fields: [
        { key: 'jobNo', label: 'Job no.', type: 'jobsearch' },
        { key: 'receivingDate', label: 'Receiving date', type: 'date', required: true },
        { key: 'dateOfInspection', label: 'Date of inspection', type: 'date' },
        { key: 'productionCode', label: 'Production code', type: 'text' },
        { key: 'nrcsAgCode', label: 'NRCS AG code', type: 'text' },
        { key: 'productDescription', label: 'Product description', type: 'text' }
      ]},
      { title: 'Sign-off', fields: [
        { key: 'checkedByQC', label: 'Checked by (QC)', type: 'text', required: true },
        { key: 'verificationBy', label: 'Verification by', type: 'text' }
      ]}
    ],
    roster: {
      title: 'Records included — Abalone Receiving (7.1.2), Basket Removal/Shucking/Gutting (7.1.1), Bleeding & Salting Checklist (7.1.3), Washing Control Sheet (7.1.4), Chiller Batch Control (7.8.1), Beak Cutting & Scrubbing (7.1.6), Precooking Check Sheet (7.2.3), Retort Inspection Reports (7.2.9), Cans Produced (7.2.7), Seamer Inspection (7.8.4), Incoming Inspection for Cans & Lids (7.8.6), Double Seam Inspection Report (7.2.12), Retort reports, Temperature probe reports, Production figure (cans produced)',
      columns: [
        { key: 'submissionRef', label: 'Record for this job', type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', fillCode: 'recordCode', fillName: 'recordName' },
        { key: 'recordCode', label: 'REC code', type: 'text' },
        { key: 'recordName', label: 'Record name', type: 'text' },
        { key: 'included', label: 'Included', type: 'select', options: ['Yes', 'No', 'N/A'] }
      ]
    }
  });
})();
</script>
```

Do not change anything else in the file (the `<head>`, script tag versions/order, or
`record-shell.js` include at the bottom).

**Note on script includes:** REC 8.1.6 also loads `../lib/traceability.js?v=6` and
`../lib/batch-validation.js?v=1` before `form-record.js`, which this NRCS file currently does not
load. Add these two `<script>` tags in the same position (right before
`<script src="../lib/form-record.js?v=34"></script>`) so job-number format validation and
traceability indexing work identically to every other traced record:

```html
<script src="../lib/traceability.js?v=6"></script>
<script src="../lib/batch-validation.js?v=1"></script>
```

---

## File 2 of 2: `public/lib/traced-records.js`

### Problem

`window.TracedRecords` is the master list that both (a) the "jobtrace" `recordpick` picker reads
from to know which record types/pages exist, and (b) the trace/batch-trace lookup page reads to
resolve links. `production-information-nrcs` is **not currently in this list**. Once this record
gets a `jobNo` field and starts saving job-linked submissions (per File 1's changes), it needs an
entry here so:
- `batch-trace.html` includes it in a job's timeline,
- other traced records' `recordpick` pickers can offer it as a real filed record for a job.

### Fix

Add a new entry to the `window.TracedRecords` array. Insert it alphabetically/logically near the
other NRCS-canning-adjacent entries — e.g. right after the `"cans-produced"` entry (around line
228, before `"retorting-control-sheet"`) — with:

```json
  {
    "recordKey": "production-information-nrcs",
    "pageFile": "Production-Information-NRCS-(Canning)-production-information-nrcs.html",
    "docCode": "Production Information NRCS (Canning)",
    "title": "Production Information NRCS (Canning)",
    "batchField": "jobNo",
    "batchDateField": null,
    "stage": "nrcs-canning",
    "extraBatchFields": [],
    "store": "formrecord:production-information-nrcs"
  },
```

Field values must match File 1 exactly:
- `"batchField": "jobNo"` — matches the field key added in File 1.
- `"store": "formrecord:production-information-nrcs"` — matches `recordKey` prefixed with
  `formrecord:`, the same convention used by every other `FormRecord`-based (non
  `monitoring_log`-based) record in this file (e.g. `abalone-receiving`, `qc-report`,
  `cans-produced`).
- `"stage": "nrcs-canning"` — matches File 1's new `stage` value; this is just a free-form label
  used for grouping in trace output, doesn't need to match any other record's stage name.

Do not remove, reorder, or edit any other entries in this file — this is an additive change only.

---

## Why this is the right fix (not a rebuild)

- The "search and add the actual relevant records based on the batch detail search" requirement
  in the task is **exactly** what `recordpick` + `source: 'jobtrace'` already does elsewhere in
  this app (REC 8.1.6, 8.1.6a, 8.1.6b, 8.1.7). This change brings the NRCS Canning page in line
  with that existing, working feature rather than building a parallel search mechanism.
- `Traceability.indexSubmission()` (called automatically by `form-record.js` on every save, per
  `TRACEABILITY.md`) will start indexing this record's submissions the moment it has a declared
  `batchField` — no other wiring is needed beyond what's in Files 1 and 2 above.
- `batch-trace.html` (the job-number lookup page linked from the records hub) needs no changes —
  it already reads from `window.TracedRecords`, so File 2's addition is sufficient for this record
  to show up in any job's traceability timeline.

## Testing checklist for whoever applies this (manual, in the live app)

1. Open Production Information NRCS (Canning), start a new entry, and confirm a "Job no." search
   field appears in Batch details and validates the `3CP`/`3DP`/`CPR`/`DPR` + digits format.
2. Enter a job number that already has other records filed against it (e.g. an existing
   `abalone-receiving` job used for testing). Confirm the roster's "Record for this job" picker
   now lists only the real records filed against that job, and selecting one fills in REC code
   and record name automatically.
3. Save with no job number chosen, and confirm the picker falls back to showing the full Master
   Index list rather than being empty or erroring.
4. Save a completed entry, then open `records/batch-trace.html`, search that same job number, and
   confirm "Production Information NRCS (Canning)" now appears in the timeline.

## Optional enhancement (not required, flagging for a decision)

The `autofill` block above is currently empty (`fill: {}`), matching REC 8.1.6's own pattern —
REC 8.1.6 relies entirely on the roster picker rather than pulling receiving-record fields
directly onto the form. If you'd instead like `receivingDate` or `productDescription` to
auto-populate from the matched `abalone-receiving` record when a job number is chosen (the way
REC 7.2.11 QC Report and REC 7.3.6 Brine Mixing Report do), that requires knowing the exact field
keys on the `abalone-receiving` record and adding entries to the `fill: {}` object, e.g.
`{ productDescription: 'productDescription' }`. This is a separate, optional decision and not
required for the batch-search fix requested here.
