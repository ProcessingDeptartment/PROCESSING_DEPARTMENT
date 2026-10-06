# Instruction: Show "View Submissions" Before Job Number Entry

**Applies to:** All record forms (`public/records/*.html`)  
**Files to change:** `public/lib/job-picker.js` and `public/lib/form-record.js`

---

## What to do

When a form first opens, the job-picker gate hides everything on the page until a job number is selected. The Submissions panel (containing the "View entries" button) must be **exempt** from this gate — it should always be visible, even before a job number is typed.

---

## Change 1 — `public/lib/job-picker.js`

Find this line inside the `makeGate` function (search for `jp-gate-back`):

```js
const keep = (n) => path.indexOf(n) >= 0 || n.tagName === 'SUMMARY' || n.classList.contains('jp-gate-back');
```

Add `jp-gate-exempt` to the keep check:

```js
const keep = (n) => path.indexOf(n) >= 0 || n.tagName === 'SUMMARY' || n.classList.contains('jp-gate-back') || n.classList.contains('jp-gate-exempt');
```

---

## Change 2 — `public/lib/form-record.js`

Find the Submissions panel div (search for `<h2>Submissions</h2>`):

```js
<div class="fr-panel no-print">
  <div class="fr-panel-head">
    <h2>Submissions</h2>
```

Add `jp-gate-exempt` to the outer div's class:

```js
<div class="fr-panel no-print jp-gate-exempt">
  <div class="fr-panel-head">
    <h2>Submissions</h2>
```

---

## Change 3 — bump version numbers

Inside `form-record.js`, find the dynamic load of job-picker and bump its version:
```js
loadLib('job-picker.js?v=10', 'JobPicker')
```
→ change to `?v=11`

In every `public/records/*.html` file, bump `form-record.js?v=86` → `?v=87`.

Quick command to do all HTML files at once:
```bash
sed -i 's/form-record\.js?v=86/form-record.js?v=87/g' public/records/*.html
```

---

## After making changes

```bash
git add public/lib/job-picker.js public/lib/form-record.js public/records/
git commit -m "Show Submissions panel before job number is entered"
git push
```

Render auto-deploys in ~30 seconds.
