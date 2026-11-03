# Fix: print-entry.html Missing Scripts (Preview Broken on Record Edits)

## Problem

`public/pages/print-entry.html` is missing two scripts from its `formOnly` array.  
Records that use `entryLog` (e.g. drying-process) or computed fields render blank sections in the PDF preview because `window.EntryLog` and `window.ComputeRegistry` are undefined when `form-record.js` runs.

## File to edit

```
public/pages/print-entry.html
```

## Change required

Find the `formOnly` array (around line 31):

```js
var formOnly = ['lookups.js?v=4', 'auth.js?v=5', 'login-ui.js?v=6', 'document-revision.js?v=3', 'traceability.js?v=11',
  'signoff-block.js?v=8', 'permission-rules.js?v=8', 'nc-raise.js?v=5', 'delete-submission-modal.js?v=1',
  'time-picker.js?v=2', 'spec-gate.js?v=4', 'form-record.js?v=123'];
```

Replace with (add `compute/registry.js?v=1` and `entry-log.js?v=3` **before** `form-record.js`):

```js
var formOnly = ['lookups.js?v=4', 'auth.js?v=5', 'login-ui.js?v=6', 'document-revision.js?v=3', 'traceability.js?v=11',
  'signoff-block.js?v=8', 'permission-rules.js?v=8', 'nc-raise.js?v=5', 'delete-submission-modal.js?v=1',
  'time-picker.js?v=2', 'spec-gate.js?v=4', 'compute/registry.js?v=1', 'entry-log.js?v=3', 'form-record.js?v=123'];
```

## Why this order matters

The load order must match the individual record HTML pages (e.g. `REC-7.4.1-drying-process.html`):

```
compute/registry.js  →  entry-log.js  →  form-record.js
```

`form-record.js` checks `window.EntryLog` and `window.ComputeRegistry` at runtime — they must exist before it initialises.

## Commit

```bash
git add public/pages/print-entry.html
git commit -m "fix: add missing compute/registry.js and entry-log.js to print-entry.html formOnly"
git push origin main
```

Render auto-deploys within ~30 seconds of the push.
