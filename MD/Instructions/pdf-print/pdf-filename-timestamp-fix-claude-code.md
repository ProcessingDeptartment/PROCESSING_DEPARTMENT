# Task: Fix PDF filename to include timestamp on single-submission print

## Context

In `public/lib/form-record.js`, the `printSubmission()` function names the PDF using only a date. The required format is:

```
REC-X.X.X_JobNo_YYYY-MM-DD_HH-MM
```

## Step 1 — Edit form-record.js

Find the `printSubmission` function. It looks like this:

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

Replace it with:

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

## Step 2 — Bump the version in all record HTML files

Check the current version number used in the record HTML files:

```bash
grep -m1 "form-record.js?v=" public/records/REC-7.4.1-drying-process.html
```

Then update `bump-form-record-version.js` at the repo root — set `FROM` to the current version and `TO` to current + 1. Run:

```bash
node bump-form-record-version.js
```

## Step 3 — Commit and push

```bash
git add public/lib/form-record.js bump-form-record-version.js public/records/
git commit -m "Fix PDF filename to include submission time

PDF filenames for individual submissions now follow the format:
  REC-X.X.X_JobNo_YYYY-MM-DD_HH-MM

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TWZgo3KTeaKV3c48sBdH3G"
git push
```

Render auto-deploys within ~30 seconds of the push.

## Expected result

PDF saved from the Submissions & Verifications Log will be named like:

```
REC-7.4.1_J2024-001_2026-11-03_09-15.pdf
```
