# Date Format — Abbreviated Month Instructions

**File:** `public/lib/form-record.js`
**Scope:** Change all user-visible date display to `D Mon YYYY` format (e.g. `5 Oct 2026`)
**No change to:** ISO date values stored in the database or HTML `<input type="date">` values — those stay as `YYYY-MM-DD` internally

---

## Why

Dates currently display as `DD/MM/YYYY` (e.g. `05/10/2026`) in form labels and badges, and as `YYYY-MM-DD HH:MM` in submission timestamps. The new standard format across the system is `D Mon YYYY` (e.g. `5 Oct 2026`), matching the roster card title style already in use on line 2005.

---

## Changes required in `public/lib/form-record.js`

### 1. Replace `fmtDDMMYYYY` (line ~491)

**Current:**
```js
function fmtDDMMYYYY(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const pad = n => String(n).padStart(2, '0');
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
}
```

**Replace with:**
```js
function fmtDDMMYYYY(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}
```

> **Note:** The function name `fmtDDMMYYYY` is kept so no call sites need updating — only the output changes.

---

### 2. Replace `fmtSubmittedAt` (line ~1843)

**Current:**
```js
function fmtSubmittedAt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return '—';
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
```

**Replace with:**
```js
function fmtSubmittedAt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d)) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const p = n => String(n).padStart(2, '0');
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
```

> Example output: `5 Oct 2026 14:30`

---

### 3. Fix the locked-submission banner (line ~3313)

**Current:**
```js
? ' on ' + new Date(existing.submittedAt).toLocaleString() : ''
```

**Replace with:**
```js
? ' on ' + (function(ts){ const d = new Date(ts); const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; const p = n => String(n).padStart(2,'0'); return d.getDate()+' '+mo[d.getMonth()]+' '+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes()); })(existing.submittedAt) : ''
```

> Or better: extract a shared helper (see below).

---

## Optional: add a shared helper at the top of `fmtDDMMYYYY`'s block

If preferred, replace the three separate implementations above with a single shared helper defined once near `fmtDDMMYYYY`, then call it from all three sites:

```js
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateAbbr(iso) {
  // Returns "D Mon YYYY", e.g. "5 Oct 2026". Input may be ISO date or timestamp.
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

function fmtDateTimeAbbr(iso) {
  // Returns "D Mon YYYY HH:MM", e.g. "5 Oct 2026 14:30".
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = n => String(n).padStart(2, '0');
  return fmtDateAbbr(iso) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// Keep old name as alias so no call sites break:
function fmtDDMMYYYY(iso) { return fmtDateAbbr(iso); }
```

Then update:
- `fmtSubmittedAt` → call `fmtDateTimeAbbr(ts)`
- The `toLocaleString()` in the locked-submission banner → call `fmtDateTimeAbbr(existing.submittedAt)`

---

## Roster card title — no change needed

Line ~2005 already produces `D Mon` (without year) for roster card headings, e.g. `Steam 3 · 5 Oct`. This is correct and intentional — leave it as-is.

---

## After editing `form-record.js`

1. Bump the `?v=N` cache-bust version in every HTML file that loads `form-record.js`:
   ```bash
   grep -rl "form-record.js" public/records/
   ```
   Increment the version number by 1 in each result.

2. Commit and push to `main`:
   ```bash
   git add public/lib/form-record.js public/records/
   git commit -m "Change date display to D Mon YYYY format (e.g. 5 Oct 2026)"
   git push
   ```

3. Render auto-deploys in ~30 seconds. Hard-refresh the browser (`Ctrl+Shift+R`) to confirm.

---

## What does NOT change

| Item | Stays as-is |
|------|-------------|
| `<input type="date">` field values | `YYYY-MM-DD` (browser native) |
| Database stored values | ISO format — no change |
| `recordDate` auto-stamp values | `YYYY-MM-DD` (internal) |
| Roster `batchseq` codes | Unchanged — separate logic |
| Export JSON `exportedAt` | ISO timestamp — internal use |
