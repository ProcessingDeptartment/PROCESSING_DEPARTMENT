# REC 7.1.5 OOSW — Duplicate Submission Warning (Instructions for Claude Code)

**Date:** 2026-10-19
**Raised by:** Michaela — "oosw warning if second record in same job. show notification that record has already been submitted also show OOSW (kg) and OOSW (%)"
**Scope:** `public/lib/entry-flow.js` only (the `oosw()` function). No change to form-record.js, storage keys, DB schema, validation rules, CSV/print output, or any other record.
**Related docs:** `claude/rec-7.1.5-oosw-entry-flow-instructions.md`, `claude/hard-rule-one-user-per-form-and-job-instructions.md`.

---

## 1. What is wanted

When the OOSW form is opened for a job that **already has a submitted OOSW record**, the operator must see a clear warning banner immediately — before they enter anything — showing:

- A message that a record has already been submitted for this job.
- The **total OOSW weight (kg)** from the existing submission.
- The **OOSW % of the job whole weight** from the existing submission (OOSW total ÷ intake weight × 100 %).

The warning does **not** block submission. The operator can still proceed and create a second record (there are legitimate reasons, e.g. corrections with admin oversight). It is a notification, not a gate.

---

## 2. When to show the warning

Show the warning whenever **all** of the following are true:

1. The current form has a confirmed job number (`fr_f_jobNo` has a non-empty value and `jiIntakeDate` or another required autofill field is populated — i.e. the job gate has been passed).
2. The current record is **not** itself already submitted/locked (i.e. `isLocked()` is false — the form is still in new-entry or draft mode, not viewing a submitted record).
3. The API returns **at least one submitted** `salting-oosw` record for the same job number.

Do **not** show the warning on a submitted / view-mode form (locked = true) — the operator is already looking at one of the submissions.

---

## 3. Fetching existing submissions

### 3.1 Storage key prefix

Submitted OOSW records are stored by form-record.js under the key prefix:

```
submission:salting-oosw:<jobNo>
```

(where `<jobNo>` is the raw value from `fr_f_jobNo`, trimmed, exactly as stored.)

Use `FacilityApi.fetch` (already available on the page) to call:

```
GET /api/storage/prefix/submission:salting-oosw:<encodedJobNo>
```

This returns an object `{ "submission:salting-oosw:<jobNo>:<timestamp>": { value: <recordJson> }, … }`.

**Important:** verify the exact prefix by checking what form-record.js writes on submit (look for `'submission:' + recordKey` or equivalent). If the prefix differs, use whatever form-record.js actually writes. Do not hard-code the prefix without checking.

### 3.2 Parsing OOSW totals from an existing submission

Each submission's `value` is a JSON object. The relevant fields are:

- `value.roster` (array of rows) — each row has `sizeRange` (string) and `weight` (string or number, kg). Sum all `weight` values to get the total OOSW kg.
- `value.jiIntakeWeight` (number or string) — the job's intake weight in kg, used to calculate the OOSW %. If absent, fall back to the current form's `fr_f_jiIntakeWeight` value (autofilled from the job).

Calculate:
```
ooswKg  = sum of roster row weights from the existing submission
ooswPct = (jiIntakeWeight > 0) ? (ooswKg / jiIntakeWeight * 100) : null
```

If multiple submissions exist (edge case), use the **most recent** one (highest timestamp key or latest `value.submittedAt`).

### 3.3 When to fetch

Fetch once per job number, **after** the job number is confirmed (autofill fields populated). Re-fetch if the job number changes.

Cache the result in-memory so repeated `render()` calls do not fire repeated API requests for the same job. Use a simple `{ jobNo: '…', result: … }` object. Clear the cache when the job number changes.

Fetch is async. Show nothing until the result is back; if the fetch fails or times out (≥ 5 s), show nothing silently (do not block the form or show an error).

---

## 4. The warning banner

### 4.1 Placement

Insert the warning banner **directly above the `#ef_oosw` entry panel** (the size-range buttons / weight entry UI). It must be visible without scrolling when the operator lands on the entry panel.

### 4.2 Content (when a submitted record is found)

```
⚠  A record has already been submitted for this job.
   OOSW: 1 234.56 kg  ·  81.23 % of job weight
   Submitted: 15 Oct 2026, 09:32
```

- Heading line (bold): "A record has already been submitted for this job."
- Data line: `OOSW: <total kg> kg · <pct> % of job weight` (2 decimal places each). If the intake weight is unknown and the percentage cannot be calculated, omit the percentage: `OOSW: 1 234.56 kg`.
- Submitted date/time: from the existing submission's `submittedAt` field or the key timestamp. Format: `d MMM yyyy, HH:mm` in local time. If unavailable, omit this line.

If multiple submissions exist for the same job, show the most recent one's values and add a sub-line: `(+N more submission(s) for this job)`.

### 4.3 Styling

- Background: amber/warning — use `--warn-bg` CSS custom property if defined in `record-theme.css`; otherwise `#fff3cd` (light amber).
- Left border: 4 px solid `--warn-border` or `#e6a817`.
- Text colour: `--warn-text` or `#664d03` (dark amber, readable on light amber).
- Icon: ⚠ (unicode, no external image).
- Padding: 12 px 16 px.
- Border-radius: 6 px.
- Margin-bottom: 12 px (gap before the entry panel).
- Font weight: bold on the heading line; normal on the data and date lines.
- Does **not** have a close/dismiss button. It stays visible the whole time the form is open. The operator should always be aware they are creating a second record.
- Class: `ef-dup-warning` (for targeting in CSS if needed).
- `role="alert"` so screen readers announce it when it appears.

### 4.4 Disappears when

- The form is submitted (lock = true) — remove or hide the banner.
- The job number is cleared / changed — remove the banner immediately (before the new fetch completes).
- The fetch returns no existing submissions — banner is absent.

---

## 5. Implementation location

All changes are in `public/lib/entry-flow.js`, inside the `oosw(opts)` function.

### 5.1 New state

Add to the `S` state object:

```js
var S = {
  sel: '', pref: false, sig: '',
  opts: FALLBACK_OOSW.slice(),
  dupCache: null   // { jobNo: string, result: {found, ooswKg, ooswPct, submittedAt, count} | null } | null
};
```

### 5.2 New helper: `checkDuplicate(jobNo, onResult)`

```js
function checkDuplicate(jobNo, onResult) {
  if (!jobNo) { onResult(null); return; }
  if (S.dupCache && S.dupCache.jobNo === jobNo) { onResult(S.dupCache.result); return; }
  S.dupCache = { jobNo: jobNo, result: null };   // mark in-flight
  var prefix = 'submission:salting-oosw:' + jobNo;
  var timer = setTimeout(function () { onResult(null); }, 5000);
  window.FacilityApi.fetch('/api/storage/prefix/' + encodeURIComponent(prefix))
    .then(function (res) {
      clearTimeout(timer);
      if (!res.ok) { onResult(null); return; }
      return res.json().then(function (data) {
        var keys = Object.keys(data || {});
        if (!keys.length) { S.dupCache.result = { found: false }; onResult(S.dupCache.result); return; }
        // Pick most recent (sort descending by key — keys embed timestamp).
        keys.sort().reverse();
        var latest = data[keys[0]];
        var val = latest && latest.value ? latest.value : latest;
        var roster = Array.isArray(val && val.roster) ? val.roster : [];
        var ooswKg = roster.reduce(function (s, r) {
          var w = parseFloat(String(r.weight || 0).replace(',', '.')); return s + (isNaN(w) ? 0 : w);
        }, 0);
        var intake = parseFloat(String(val && val.jiIntakeWeight || 0));
        var ooswPct = (intake > 0 && ooswKg > 0) ? (ooswKg / intake * 100) : null;
        var submittedAt = (val && val.submittedAt) || null;
        var result = { found: true, ooswKg: ooswKg, ooswPct: ooswPct, submittedAt: submittedAt, count: keys.length };
        S.dupCache.result = result;
        onResult(result);
      });
    })
    .catch(function () { clearTimeout(timer); onResult(null); });
}
```

### 5.3 New helper: `renderDupBanner(result)`

Renders (or removes) the `#ef_dup_warn` banner element. Call this in `render()` after the panel exists.

```js
function renderDupBanner(result) {
  var panel = $('ef_oosw'); if (!panel) return;
  var existing = $('ef_dup_warn');
  var lock = isLocked();
  if (!result || !result.found || lock) {
    if (existing) existing.remove();
    return;
  }
  var kgStr = fmt2(result.ooswKg) + ' kg';
  var pctStr = result.ooswPct != null ? '  ·  ' + fmt2(result.ooswPct) + ' % of job weight' : '';
  var dateStr = '';
  if (result.submittedAt) {
    try {
      var d = new Date(result.submittedAt);
      dateStr = d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
        + ', ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { }
  }
  var extra = result.count > 1 ? '<div class="ef-dup-extra">(+' + (result.count - 1) + ' more submission' + (result.count > 2 ? 's' : '') + ' for this job)</div>' : '';
  var html = '<div class="ef-dup-head">⚠ A record has already been submitted for this job.</div>' +
    '<div class="ef-dup-data">OOSW: ' + esc(kgStr) + esc(pctStr) + '</div>' +
    (dateStr ? '<div class="ef-dup-date">Submitted: ' + esc(dateStr) + '</div>' : '') +
    extra;
  if (!existing) {
    var el = document.createElement('div');
    el.id = 'ef_dup_warn';
    el.className = 'ef-dup-warning no-print';
    el.setAttribute('role', 'alert');
    el.innerHTML = html;
    panel.parentNode.insertBefore(el, panel);
  } else {
    existing.innerHTML = html;
  }
}
```

### 5.4 Changes to `render()`

In the `render(force)` function, after the panel exists and after the sig-comparison, add a job-number check:

```js
// ---- duplicate submission check
var curJob = (function () { var f = $('fr_f_jobNo'); return f ? String(f.value || '').trim() : ''; })();
// Only check if job confirmed (autofill fields populated) and form not locked.
var autofillSettled = !!(curJob && $('fr_f_jiIntakeDate') && $('fr_f_jiIntakeDate').value);
if (!curJob || lock) {
  // No job or locked view: clear cache and banner.
  if (S.dupCache && S.dupCache.jobNo !== curJob) { S.dupCache = null; }
  renderDupBanner(null);
} else if (autofillSettled) {
  if (!S.dupCache || S.dupCache.jobNo !== curJob) {
    // New or changed job: clear banner while we fetch.
    renderDupBanner(null);
    checkDuplicate(curJob, function (result) { renderDupBanner(result); });
  } else if (S.dupCache.result !== null) {
    renderDupBanner(S.dupCache.result);
  }
  // If S.dupCache.result is still null (fetch in flight), banner stays absent; rendered when the fetch resolves.
}
```

### 5.5 CSS to add to `public/styles/responsive.css`

Add these rules in the `.ef-*` block:

```css
/* OOSW duplicate submission warning */
.ef-dup-warning {
  background: var(--warn-bg, #fff3cd);
  border-left: 4px solid var(--warn-border, #e6a817);
  color: var(--warn-text, #664d03);
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 12px;
  font-size: 15px;
  line-height: 1.5;
}
.ef-dup-head {
  font-weight: 700;
  margin-bottom: 4px;
}
.ef-dup-data {
  margin-bottom: 2px;
}
.ef-dup-date,
.ef-dup-extra {
  opacity: 0.8;
  font-size: 13px;
}
```

---

## 6. Version bumps

After editing `entry-flow.js`, bump `?v=N` on the `<script src="../lib/entry-flow.js?v=N">` line in `public/records/REC-7.1.5-salting-oosw.html`.

No other record pages reference `entry-flow.js`. Double-check with:
```bash
grep -rl "entry-flow.js" public/records/
```

After editing `responsive.css`, bump `?v=N` on every `<link rel="stylesheet" href="../styles/responsive.css?v=N">` line in every record HTML file that uses it:
```bash
grep -rl "responsive.css" public/records/
```

---

## 7. Testing checklist

1. **Job with no prior OOSW submission:** open form, confirm job → no banner, form works normally.
2. **Job with one prior submission:** open form, confirm job → amber banner appears above entry panel within a few seconds, showing correct OOSW kg and %. Operator can still enter weights and submit.
3. **Job with two prior submissions:** banner shows most-recent submission's kg/%, plus `(+1 more submission for this job)`.
4. **Intake weight missing from existing record:** OOSW % omitted from banner; kg shown.
5. **API slow/down:** banner never appears; no error shown; form works normally.
6. **Change job after confirmation:** banner disappears immediately, re-fetches for the new job.
7. **Viewing a submitted record (locked):** banner never shown even if duplicates exist.
8. **Print / PDF:** banner does not appear (`.no-print` class).
9. **Banner text is correct:** kg to 2 dp, % to 2 dp, date formatted as `15 Oct 2026, 09:32`.
10. **No console errors** on load or during fetch.
11. Version strings bumped on REC-7.1.5-salting-oosw.html and responsive.css references.

---

## 8. What does not change

- Storage keys, DB schema, validation rules — no change.
- CSV export, print layout — no change.
- The OOSW cap rule on REC 7.4.0 — no change.
- Any other record page — no change.
- form-record.js — no change.
