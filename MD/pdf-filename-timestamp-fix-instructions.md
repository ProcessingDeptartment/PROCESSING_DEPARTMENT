# PDF Filename Timestamp Fix — Submissions & Verifications Log

## What to fix

In `public/lib/form-record.js`, the `printSubmission()` function builds the PDF filename for single-submission prints. It currently uses only the date (`YYYY-MM-DD`). Change it to include the time (`HH-MM`) so the filename format becomes:

```
REC-X.X.X_JobNo_YYYY-MM-DD_HH-MM
```

## The change

Find this function in `form-record.js` (search for `function printSubmission`):

```js
function printSubmission(id) {
  const sub = submissions.find(s => s.id === id);
  if (!sub) return;
  const jobNo = safeKey(String((config.batchField && sub.values && sub.values[config.batchField]) || ''));
  const submitDate = sub.submittedAt
    ? new Date(sub.submittedAt).toISOString().slice(0, 10)
    : (dateOf(sub.values) || new Date(sub.createdAt).toISOString().slice(0, 10));
  const parts = [safeKey(config.docCode), jobNo, submitDate].filter(Boolean);
  printSheets([sub], parts.join('_'));
}
```

Replace with:

```js
function printSubmission(id) {
  const sub = submissions.find(s => s.id === id);
  if (!sub) return;
  const jobNo = safeKey(String((config.batchField && sub.values && sub.values[config.batchField]) || ''));
  const tsSource = sub.submittedAt || sub.createdAt;
  const submitTs = tsSource
    ? (() => {
        const d = new Date(tsSource);
        const date = d.toISOString().slice(0, 10);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return date + '_' + hh + '-' + mm;
      })()
    : (dateOf(sub.values) || new Date().toISOString().slice(0, 10));
  const parts = [safeKey(config.docCode), jobNo, submitTs].filter(Boolean);
  printSheets([sub], parts.join('_'));
}
```

## After editing form-record.js

Bump the version number in all record HTML files. Update `bump-form-record-version.js` at the repo root — change `FROM` and `TO` to the current and next version numbers, then run:

```
node bump-form-record-version.js
```

Then commit and push:

```
git add public/lib/form-record.js bump-form-record-version.js public/records/
git commit -m "Fix PDF filename to include time on single-submission print"
git push
```

## Result

PDF filenames from the Submissions & Verifications Log will now include the submission time, e.g.:

```
REC-7.4.1_J2024-001_2026-11-03_09-15.pdf
```
