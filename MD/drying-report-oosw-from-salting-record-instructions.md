# Drying Report — Pull OOSW from REC 7.1.5 Salting Record

**Date:** 2026-10-20
**Raised by:** Michaela — "OOSW on salting record is not pulling into job report"
**File:** `public/pages/drying-report.html`
**Scope:** `drying-report.html` only. No changes to form-record.js, DB schema, any record HTML, or any other page.

---

## 1. Root cause

`drying-report.html` currently reads OOSW from the manually-typed `ooswKg` field on REC 7.4.0 (Dry Cooking). That was a temporary placeholder — a `// TODO` comment on line 235 acknowledges this. Now that operators are submitting REC 7.1.5 (Salting OOSW), the report must pull from the real source.

Relevant lines in the current file:

```js
// line 235
// TODO: replace oosw_kg_manual with lookup from REC 7.1.5 when available
const ooswKg = sumNum(cooking, 'ooswKg');

// line 316 (label in the rendered table)
<tr><td>OOSW weight (REC 7.4.0)</td><td ...>
```

---

## 2. What to change

### 2.1 Load `salting-oosw` submissions alongside the other records

In `loadAll()` (around line 181), add `salting-oosw` to the parallel fetch:

**Before:**
```js
async function loadAll() {
  const [receiving, drying, grading, gradingRanched, cooking] = await Promise.all([
    getRecord('formrecord:abalone-receiving'),
    getRecord('formrecord:drying-process'),
    getRecord('formrecord:grading-production-log-cultivated'),
    getRecord('formrecord:grading-production-log-ranched'),
    getRecord('formrecord:dry-cooking')
  ]);
  CACHE = { receiving, drying, grading, gradingRanched, cooking };
}
```

**After:**
```js
async function loadAll() {
  const [receiving, drying, grading, gradingRanched, cooking, saltingOosw] = await Promise.all([
    getRecord('formrecord:abalone-receiving'),
    getRecord('formrecord:drying-process'),
    getRecord('formrecord:grading-production-log-cultivated'),
    getRecord('formrecord:grading-production-log-ranched'),
    getRecord('formrecord:dry-cooking'),
    getRecord('formrecord:salting-oosw')
  ]);
  CACHE = { receiving, drying, grading, gradingRanched, cooking, saltingOosw };
}
```

### 2.2 Calculate OOSW from REC 7.1.5 roster, fall back to REC 7.4.0 manual entry

In `buildReport()`, replace the TODO block (around line 235):

**Before:**
```js
// TODO: replace oosw_kg_manual with lookup from REC 7.1.5 when available
const ooswKg = sumNum(cooking, 'ooswKg');
```

**After:**
```js
// OOSW from REC 7.1.5 submissions (sum of all roster weight rows for this job).
// Falls back to the manually-typed ooswKg on REC 7.4.0 if no 7.1.5 records exist.
const saltingOoswForJob = submitted(forJob(CACHE.saltingOosw, jobNo));
let ooswKg = null;
let ooswSource = '7.1.5';
if (saltingOoswForJob.length) {
  // Each submission has a roster of size-range rows; sum the 'weight' column across all of them.
  saltingOoswForJob.forEach((s) => {
    (s.roster || []).forEach((r) => {
      const n = num(r.weight);
      if (n != null) ooswKg = (ooswKg || 0) + n;
    });
  });
}
if (ooswKg == null) {
  // Fallback: manually-typed value from REC 7.4.0 (Dry Cooking)
  ooswKg = sumNum(cooking, 'ooswKg');
  ooswSource = '7.4.0';
}
```

Also add `ooswSource` to the object returned from `buildReport()`:

**Before:**
```js
return {
  jobNo, harvest, totalMass, totalAnimals,
  wholeWeight, cookedWeight, ooswKg, trolleys, driedWeight, driedSource, actualYield, dryingLoss,
  ...
```

**After:**
```js
return {
  jobNo, harvest, totalMass, totalAnimals,
  wholeWeight, cookedWeight, ooswKg, ooswSource, trolleys, driedWeight, driedSource, actualYield, dryingLoss,
  ...
```

### 2.3 Update the label and fallback message in the rendered table

In the `render()` function, update the OOSW table row (around line 316):

**Before:**
```js
<tr><td>OOSW weight (REC 7.4.0)</td><td class="num">${rep.ooswKg == null ? '— <span class="muted">Not recorded on REC 7.4.0</span>' : fmt(rep.ooswKg) + ' kg'}</td></tr>
```

**After:**
```js
<tr><td>OOSW weight (REC 7.1.5${rep.ooswSource === '7.4.0' ? ' — fallback from REC 7.4.0' : ''})</td><td class="num">${rep.ooswKg == null ? '— <span class="muted">No OOSW record found (REC 7.1.5 or REC 7.4.0)</span>' : fmt(rep.ooswKg) + ' kg'}</td></tr>
```

This shows:
- `OOSW weight (REC 7.1.5)` — when real data from the salting record is available
- `OOSW weight (REC 7.1.5 — fallback from REC 7.4.0)` — when only the manual entry exists
- `— No OOSW record found` — when neither source has data

---

## 3. No version bump needed

`drying-report.html` loads no external JS that needs cache-busting — all logic is inline in this one file. No other file changes.

---

## 4. Testing checklist

1. **Job with a submitted REC 7.1.5:** open drying report → OOSW shows correct kg total from the salting roster. Label reads "OOSW weight (REC 7.1.5)".
2. **Job with multiple REC 7.1.5 submissions:** OOSW is summed correctly across all submissions.
3. **Job with no REC 7.1.5 but with `ooswKg` on REC 7.4.0:** report shows the 7.4.0 value with label "OOSW weight (REC 7.1.5 — fallback from REC 7.4.0)".
4. **Job with neither source:** OOSW cell shows "— No OOSW record found".
5. **No console errors** during load or render.
6. All other fields on the drying report are unaffected.

---

## 5. Key field mapping (REC 7.1.5 `salting-oosw`)

From `public/data/record-defs/salting-oosw.json`:

```json
"roster": {
  "columns": [
    { "key": "sizeRange", ... },
    { "key": "wholeWeight", ... },
    { "key": "weight", "label": "OOSW weight (kg)", "type": "number" }
  ]
}
```

Each submitted `salting-oosw` record stores its roster rows under `s.roster[]`. Sum `r.weight` across all rows of all submissions for the job.

The job number field is `jobNo` (matches `forJob()` which checks `v.jobNo || v.jobNumber`).
