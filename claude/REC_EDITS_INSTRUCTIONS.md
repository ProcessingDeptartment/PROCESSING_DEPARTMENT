# Instructions: REC 7.1 field changes + "Edit Template" relocation

Repo: `PROCESSING_DEPARTMENT` (Render-hosted app)
Target branch: work off `main` (or your current working branch) and commit when done.

This file has two independent parts. Part A only touches one record. Part B is a
system-wide change touching the shared rendering libraries (`monitoring-log.js`,
`form-record.js`) and the index page — test carefully since it affects every REC record.

---

## PART A — REC 7.1 (Incubator Cans Log) field changes

File: `public/records/REC-7.1-incubator-cans-log.html`

Current `entryFields` config (inside the `<script>` block, passed to `MonitoringLog.init`):

```js
entryFields: [
  { key: 'dateIn', label: 'Date in', type: 'date', required: true },
  { key: 'time', label: 'Time', type: 'text' },
  { key: 'productionCode', label: 'Production code', type: 'text' },
  { key: 'pieces', label: 'Pieces', type: 'number' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'dateOutForMicro', label: 'Date out for micro', type: 'date' },
  { key: 'checkedBy', label: 'Checked by', type: 'text', required: true },
  { key: 'dateCleared', label: 'Date cleared', type: 'date' },
  { key: 'clearedByName', label: 'Cleared by — name', type: 'text' },
  { key: 'clearedByDate', label: 'Cleared by — date', type: 'date' }
],
```

### 1. Merge "Date in" + "Time" into one datetime field
Check what field `type`s `monitoring-log.js` / `form-record.js` support (search for
`type === 'date'` and `type === 'datetime'` handling in `makeLogController` /
the field-renderer function). If a `datetime-local` type isn't supported yet, add one
(HTML `<input type="datetime-local">`) to the shared field renderer — do this once
in `monitoring-log.js`, since other records may want to migrate to it too.

Then change:
```js
{ key: 'dateIn', label: 'Date in', type: 'date', required: true },
{ key: 'time', label: 'Time', type: 'text' },
```
to:
```js
{ key: 'dateIn', label: 'Date in', type: 'datetime', required: true },
```
Remove the standalone `time` field entirely.

⚠️ Migration note: existing stored entries have separate `dateIn` (date-only) and
`time` (free text) values. Decide whether to write a one-time migration script that
combines old records' `dateIn` + `time` into a single ISO datetime string, or leave
historical rows as-is and only apply the new single field going forward. Flag this
to Michaela before running any data migration — do NOT silently transform stored data.

### 2. Production code — enforce "AG" + 6 digits
Add validation to the `productionCode` field. Two options:
- **Pattern-constrained text input**: add `pattern: '^AG\\d{6}$'` (or equivalent) support
  to the field renderer, with `title`/error text like "Format: AG123456".
- **Prefix + fixed-width number**: render "AG" as a fixed, non-editable prefix and a
  6-digit numeric input beside it, concatenating on save.
Pick whichever matches how other AG-code fields are already handled elsewhere in the
codebase (search for `agCode` / `AG` prefix logic in `form-record.js` and
`monitoring-log.js` — REC 01 has an `AG code` field, reuse that pattern if it exists).

```js
{ key: 'productionCode', label: 'Production code', type: 'text', pattern: '^AG\\d{6}$', required: true },
```

### 3. "Pieces" → richer description field
Change from a bare number to a longer text/textarea field so it can describe what the
pieces are, not just a count:
```js
{ key: 'pieces', label: 'Pieces', type: 'textarea' },
```
(Keep `quantity` unchanged — user confirmed it's correct as-is.)

### 4. Add "Job number" field
Add near the top of `entryFields` (right after `dateIn`, before `productionCode`):
```js
{ key: 'jobNo', label: 'Job number', type: 'text', required: true },
```
Purpose: acts as the lookup key so that when this record is reopened later to fill in
`dateOutForMicro` / `dateCleared` against an existing entry, the correct row can be found
by job number rather than by manually scanning the log. Check whether the log's entry
table/search (`ml_filterSearch`) already searches all field values — if so, Job No. is
searchable automatically. If there's a dedicated "find entry to continue" flow anywhere
in `monitoring-log.js`, wire Job No. into it as the primary lookup key.

### 5. Mobile / tablet layout
Check `public/styles/responsive.css` — REC-7.1 already loads `responsive.css?v=1`.
Audit the grid used for `entryFields` at small viewport widths (likely a CSS grid class
like `ml-grid ml-grid-4` in `monitoring-log.js`). For REC 7.1 specifically, given the
added Job No. field and the merged datetime field, verify the field grid drops to
1-2 columns under ~600px and that date/datetime inputs are full-width and easy to tap.
This may already work for other records — just confirm on this one after the field
changes above, on an actual phone/tablet viewport (devtools responsive mode is fine
for a first pass).

### 6. Remove required verification section
`monitoring-log.js` supports `config.showVerificationStrip !== false` to control whether
the Verification panel (Verified by / Title / Date / Signature) renders at all.
Add this line to the REC 7.1 config object:
```js
showVerificationStrip: false,
```
This removes the entire "Verification" panel (and its due-date nagging) from REC 7.1 only.
No changes needed to `monitoring-log.js` for this — it's already a per-record opt-out.

---

## PART B — Move "Edit Template" off record pages into an index section

Currently **every** REC record page shows an "Edit Template" button in its header
(gated by `PermissionRules.can('manageTemplates')`). This exists in two engines:

- `public/lib/monitoring-log.js`
  - button render: ~line 1082 (`ml_editTemplateBtn`)
  - click handler + `TemplateEditor.open(...)` call: ~lines 1253–1275
- `public/lib/form-record.js`
  - button render: ~line 587 (`fr_editTemplateBtn`)
  - click handler + `TemplateEditor.open(...)` call: ~line 1238 onward

Both call `window.TemplateEditor.open({ recordKey, engine, currentConfig, ... })` where
`currentConfig` is pulled from that record's own inline config (`entryFields`,
`specFields`, etc. — data that only exists inside each record's own HTML file).

### Recommended approach (minimal duplication, keeps config always in sync)

1. **In `monitoring-log.js` and `form-record.js`:** remove the visible button from the
   header markup (delete the `${canManageTemplates ? '<button ... Edit Template</button>' : ''}`
   line in both files).

2. Replace the click-handler block in both files with an **auto-open on page load**,
   triggered by a URL query parameter instead of a button click:
   ```js
   // ---------- edit template (opened via ?editTemplate=1 from the index, not a button here) ----------
   if (canManageTemplates && new URLSearchParams(location.search).get('editTemplate') === '1') {
     function doOpen() {
       window.TemplateEditor.open({
         recordKey: config.recordKey,
         engine: 'monitoring-log', // or 'form-record' in form-record.js
         currentConfig: { /* same as before */ },
         inlineConfig: null,
         docRevisionStart: config.docRevisionStart,
         onSave: () => location.reload()
       });
     }
     if (window.TemplateEditor) { doOpen(); }
     else {
       const s = document.createElement('script');
       s.src = '../lib/template-editor.js';
       s.onload = doOpen;
       document.head.appendChild(s);
     }
   }
   ```
   This keeps `currentConfig` correct (still read from the live page config) while the
   entry point moves off the visible record header.

3. **Add an "Edit Records" section**, on `public/index.html` or
   `public/records/master-record-index.html` (master-record-index.html already lists
   every record — probably the better home since it's already the document-control
   register). Add a column/action per row: an "Edit Template" link that navigates to
   that record's page with `?editTemplate=1` appended, e.g.:
   ```html
   <a href="REC-7.1-incubator-cans-log.html?editTemplate=1">Edit Template</a>
   ```
   Gate this column's visibility the same way the old button was gated — check
   `PermissionRules.can('manageTemplates')` client-side before rendering the column
   (or at least before the links are clickable), so non-admin users don't see it.
   If `master-record-index.html` is generated/templated from a records manifest
   (check `public/lib/master-index-data.js`, which looks like the data source), add
   the edit link generation there so it covers all ~120 records in one place rather
   than hand-editing the HTML table.

4. **Test**: confirm the button no longer appears on any record page, and that
   navigating to a record with `?editTemplate=1` (as an admin/manageTemplates user)
   still opens the same Template Editor modal as before, with `onSave` still doing
   `location.reload()` to reflect changes.

### Scope check before starting
Search the whole `public/lib/` folder for any *other* doc engines with the same
pattern (`policy-doc.js`, `procedure-doc.js`, `sop-doc.js`, `prp-doc.js`) — those
render Policies/Procedures/SOPs/PRPs, not REC records, so the user's instruction
("all 'edit template' on **records**") likely does NOT include them. Confirm with
Michaela before touching those four files; leave them alone unless she says otherwise.

---

## Not in scope here
- No database/schema design (per project rules — audit/build phase only until
  explicitly authorized).
- No changes to any other REC record's fields beyond REC 7.1 unless requested.
