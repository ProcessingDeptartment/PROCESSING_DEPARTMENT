# PDF Print Revision Date & Number — Sync with Master Index

**Date:** 27 October 2026  
**Raised by:** Michaela (Abagold)  
**Issue:** Revision dates and revision numbers shown in PDF print outputs do not match the correct values listed on the master record index.  
**Type:** Bug fix — document control integrity. No new fields, no DB changes.  
**Scope:** All record pages that render a revision number/date in their PDF footer or header.

---

## 1. Root Cause (likely)

Revision numbers and dates are currently **hardcoded** in two separate places:

| Location | What it controls |
|---|---|
| `public/lib/master-index-data.js` (or `record-definitions.json`) | What the master record index *displays* |
| Each record page HTML / print stylesheet footer | What the PDF footer *prints* |

These two sources are not linked. When a record is revised and the master index is updated, the PDF footer on the record page is often **not updated at the same time**, causing the mismatch.

---

## 2. Fix Strategy — Single Source of Truth

All revision data must flow from **one place only**: `master-index-data.js` (or the equivalent records manifest). The PDF footer must read from that source dynamically, never from a hardcoded string on the record page.

---

## 3. Step-by-Step Instructions

### Step 1 — Audit the current state

Run this search to find every place a revision number or revision date is hardcoded in a record page or print stylesheet:

```bash
grep -rn "Rev\.\s*[0-9]\|revision.*[0-9]\|rev_no\|revisionDate\|docRevision\|docRevisionStart" \
  public/ --include="*.html" --include="*.js" --include="*.css" | grep -v "master-index-data\|record-definitions"
```

Also check the print layout instruction files already written (REC 7.4.0, 7.4.2, etc.) — they each specify a hardcoded `Rev. N` in the footer. Those values must be replaced with dynamic lookups.

---

### Step 2 — Confirm the data structure in `master-index-data.js`

Open `public/lib/master-index-data.js`. Each record entry should already have (or must gain) these two fields:

```js
{
  recordKey: 'dry-cooking',         // unique identifier
  docNo: 'REC 7.4.0',
  title: 'Dry Cooking',
  revisionNo: 7,                    // ← integer, e.g. 7
  revisionDate: '2026-09-15',       // ← ISO date string (YYYY-MM-DD)
  // ... other fields
}
```

**If `revisionNo` and `revisionDate` fields do not exist yet**, add them to every record entry in `master-index-data.js` now, using the values currently shown on the master record index page. This is the authoritative update.

> **Important:** The values in `master-index-data.js` become the single source of truth. The master index page already reads from here — confirm this by checking how the index table renders its "Rev." column. If it reads from this file, both the index display and the PDF footer will be in sync after this fix.

---

### Step 3 — Expose revision data to record pages

Each record page's HTML config block already has access to its own `recordKey`. The record page must look up its revision data from `master-index-data.js` at load time.

**In `monitoring-log.js` and `form-record.js`** (the two record engines), add a utility function near the top:

```js
function getRecordRevision(recordKey) {
  // masterIndexData is the global exported from master-index-data.js
  // (already loaded on every record page via <script src="../lib/master-index-data.js">)
  const entry = (window.masterIndexData || []).find(r => r.recordKey === recordKey);
  if (!entry) return { revisionNo: '—', revisionDate: '—' };
  const date = entry.revisionDate
    ? new Date(entry.revisionDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  return { revisionNo: entry.revisionNo ?? '—', revisionDate: date };
}
```

Ensure `master-index-data.js` is loaded **before** the record engine script on every record page. Check the `<script>` load order in the HTML template shared by both engines.

---

### Step 4 — Replace hardcoded revision values in PDF footers

The PDF footer is typically rendered as an injected DOM element (or a CSS `@page` rule) when `?print=1` is active, or it is baked into the record page HTML.

**Find the footer render code** in `monitoring-log.js` and `form-record.js`. It will look something like:

```js
// BEFORE (hardcoded — wrong)
`<div class="print-footer">REC 7.4.0  |  Rev. 7  |  Printed: ${today}  |  Page X of Y</div>`
```

**Replace with a dynamic lookup:**

```js
// AFTER (dynamic — correct)
const rev = getRecordRevision(config.recordKey);
`<div class="print-footer">${config.docNo}  |  Rev. ${rev.revisionNo}  |  ${rev.revisionDate}  |  Printed: ${today}  |  Page X of Y</div>`
```

> **Note:** `config.docNo` is the record's document number (e.g. `REC 7.4.0`). If this field is not already on the config, add it from `master-index-data.js` in the same lookup.

---

### Step 5 — Remove all other hardcoded revision references

After the dynamic footer is in place, search for and remove any remaining hardcoded `Rev. N` strings from:

- Individual record page HTML files (`public/pages/*.html` or `public/records/*.html`)
- Inline `<style>` blocks containing `content: "Rev. N"` in `@page` or `@media print` rules
- Any `docRevisionStart` config value that was only used to feed the old hardcoded footer (leave it if it serves another purpose)

Replace each with the dynamic value or remove it entirely if the footer now handles it centrally.

---

### Step 6 — Update the master index display

Verify that `public/records/master-record-index.html` (or the JS that generates its table) renders the **Rev. No.** and **Rev. Date** columns directly from `master-index-data.js`. If it reads from a separate data source, consolidate both to `master-index-data.js`.

---

### Step 7 — Document control process (procedure going forward)

Add a comment block at the top of `master-index-data.js`:

```js
/**
 * MASTER RECORD INDEX DATA — Single source of truth for all record metadata.
 *
 * REVISION CONTROL:
 * When a record is revised:
 *   1. Update `revisionNo` and `revisionDate` in THIS file for that record.
 *   2. That's all. The master index page and every PDF footer read from here automatically.
 *   3. Never update revision numbers anywhere else (record page HTML, print footers, etc.)
 *
 * Last updated: 2026-10-27
 */
```

---

## 4. Files to change

| File | Change |
|---|---|
| `public/lib/master-index-data.js` | Add `revisionNo` + `revisionDate` to every record entry; add doc-control comment block |
| `public/lib/monitoring-log.js` | Add `getRecordRevision()` utility; replace hardcoded footer strings with dynamic lookup |
| `public/lib/form-record.js` | Same as above |
| `public/pages/*.html` / `public/records/*.html` | Remove any remaining hardcoded `Rev. N` strings |
| `public/records/master-record-index.html` | Confirm/fix Rev. columns to read from `master-index-data.js` |

No database changes. No new API routes. No new pages.

---

## 5. Test checklist

1. Open `master-record-index.html` — note the revision number and date shown for **REC 7.4.0**.
2. Open REC 7.4.0, print to PDF (`?print=1`).
3. PDF footer shows the **same** Rev. number and Rev. date as the master index. ✓
4. Repeat for at least three other records (e.g. REC 7.1.2, REC 7.4.2, REC 7.2.11).
5. In `master-index-data.js`, increment `revisionNo` for one test record by 1. Reload both the index and the record's PDF — both now show the new number. ✓ Revert after test.
6. Confirm no record page shows a `Rev. —` (missing lookup) in its footer — if so, that record's entry in `master-index-data.js` is missing the fields added in Step 2.

---

## 6. Commit message template

```
fix: sync PDF footer revision data to master-index single source of truth

- master-index-data.js: add revisionNo + revisionDate fields to all entries
- monitoring-log.js + form-record.js: getRecordRevision() utility; footer now
  reads rev no. and rev date dynamically from master-index-data
- Remove hardcoded Rev. N strings from record page HTML and print footers
- Master record index Rev. columns confirmed to read from master-index-data.js

Resolves: PDF prints showing wrong revision number / date vs. master index

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TWZgo1gXMZdwzEBATi7Jug
```
