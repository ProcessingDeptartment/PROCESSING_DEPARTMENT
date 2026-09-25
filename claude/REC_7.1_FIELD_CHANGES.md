# Instructions: REC 7.1 (Incubator Cans Log) field changes

Repo: `PROCESSING_DEPARTMENT` (Render-hosted app)
File to edit: `public/records/REC-7.1-incubator-cans-log.html`

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

## 1. Merge "Date in" + "Time" into one datetime field

Check what field `type`s `public/lib/monitoring-log.js` supports in its field renderer
(search for `type === 'date'` handling in `makeLogController`). If a `datetime-local`
type isn't supported yet, add one (HTML `<input type="datetime-local">`) to the shared
field renderer in `monitoring-log.js` — do this once there, since other records may
want to adopt it too.

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

## 2. Production code — enforce "AG" + 6 digits

Add validation to the `productionCode` field. Two options:
- **Pattern-constrained text input**: add `pattern: '^AG\\d{6}$'` (or equivalent) support
  to the field renderer, with `title`/error text like "Format: AG123456".
- **Prefix + fixed-width number**: render "AG" as a fixed, non-editable prefix and a
  6-digit numeric input beside it, concatenating on save.

Check `public/records/REC-01-cans-released-form.html` first — it already has an
"AG code" field. Reuse whatever pattern/logic it uses if one exists, rather than
inventing a new validation approach.

```js
{ key: 'productionCode', label: 'Production code', type: 'text', pattern: '^AG\\d{6}$', required: true },
```

## 3. "Pieces" → richer description field

Change from a bare number to a longer text/textarea field so it can describe what the
pieces are, not just a count:
```js
{ key: 'pieces', label: 'Pieces', type: 'textarea' },
```
Keep `quantity` unchanged — user confirmed it's correct as-is.

## 4. Add "Job number" field

Add near the top of `entryFields` (right after `dateIn`, before `productionCode`):
```js
{ key: 'jobNo', label: 'Job number', type: 'text', required: true },
```
Purpose: acts as the lookup key so that when this record is reopened later to fill in
`dateOutForMicro` / `dateCleared` against an existing entry, the correct row can be found
by job number rather than by manually scanning the log. Check whether the log's entry
search (`ml_filterSearch` in `monitoring-log.js`) already searches all field values —
if so, Job No. is searchable automatically with no extra work. If there's a dedicated
"find entry to continue" flow anywhere in `monitoring-log.js`, wire Job No. into it as
the primary lookup key.

## 5. Mobile / tablet layout

Check `public/styles/responsive.css` — REC-7.1 already loads `responsive.css?v=1`.
Audit the grid used for `entryFields` at small viewport widths (likely a CSS grid class
like `ml-grid ml-grid-4` in `monitoring-log.js`). After the field changes above
(added Job No., merged datetime field), verify the field grid drops to 1–2 columns
under ~600px and that date/datetime inputs are full-width and easy to tap on a phone
or tablet. Test in an actual mobile/tablet viewport, not just desktop devtools if possible.

## 6. Remove required verification section

`monitoring-log.js` already supports a per-record opt-out:
`config.showVerificationStrip !== false`. Add this line to the REC 7.1 config object:
```js
showVerificationStrip: false,
```
This removes the entire "Verification" panel (Verified by / Title / Date / Signature,
plus its overdue-verification nagging banner) from REC 7.1 only. No changes needed
to `monitoring-log.js` itself for this — it's already a per-record opt-out flag.

---

**Not in scope:** no database/schema design, no changes to any other REC record's
fields unless requested separately.
