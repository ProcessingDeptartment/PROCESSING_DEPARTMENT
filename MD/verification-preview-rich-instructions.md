# Verification Queue — Rich Preview Instructions

**File:** `public/pages/awaiting-verification.html`  
**No other file changes required** (no JS lib changes, no version bumps elsewhere).  
**Problem:** The "Preview" panel on each row dumps every raw field key as a flat key→value list. A verifier cannot confirm a record is correct without opening it. The fix is to load the record definition's `listColumns` + field labels and render a proper summary — the same fields the Record List uses for its table columns.

---

## What to change

### 1 — Load record-def JSON files when the queue loads

After `scan()` finishes (it already collects `recordKey` for each row), fetch the record-def JSON for every unique `recordKey` that has awaiting rows. Store the defs in a module-level map.

Add a module-level variable at the top of the IIFE, alongside `STATE`:

```js
var DEFS = {};   // recordKey → parsed record-def object (or null if unavailable)
```

Add a new async function `loadDefs()` that fetches each unique record key's def file:

```js
async function loadDefs(recordKeys) {
  var unique = recordKeys.filter(function (k, i, a) { return a.indexOf(k) === i && !DEFS[k]; });
  await Promise.all(unique.map(async function (rk) {
    try {
      var res = await fetch('../data/record-defs/' + encodeURIComponent(rk) + '.json', { cache: 'default' });
      if (res.ok) DEFS[rk] = await res.json();
      else DEFS[rk] = null;
    } catch (e) {
      DEFS[rk] = null;
    }
  }));
}
```

Call `loadDefs()` at the end of `scan()`, after `STATE.rows = rows;`:

```js
// After:  STATE.rows = rows;
// Add:
var keys = rows.map(function (r) { return r.recordKey; });
await loadDefs(keys);
```

Because `scan()` is already `async`, this is safe.

---

### 2 — Replace `valuesDl()` with `previewDl()`

Remove the existing `valuesDl()` function entirely. Replace it with `previewDl(row)` which uses the def when available:

```js
function previewDl(row) {
  var def = DEFS[row.recordKey];
  var values = row.values || {};

  // ── A. Build a label map from the def ──────────────────────────────────────
  var labelMap = {};   // fieldKey → human label string
  if (def) {
    (def.sections || []).forEach(function (sec) {
      (sec.fields || []).forEach(function (f) {
        if (f.key && f.label) labelMap[f.key] = f.label;
      });
    });
    // Also include roster column labels
    if (def.roster && def.roster.columns) {
      def.roster.columns.forEach(function (c) {
        if (c.key && c.label) labelMap[c.key] = c.label;
      });
    }
  }

  // ── B. Decide which fields to show ─────────────────────────────────────────
  var cols = [];   // [{key, label}]
  if (def && def.listColumns && def.listColumns.length) {
    def.listColumns.forEach(function (col) {
      if (col === 'roster:count') {
        // special token — show how many roster rows exist
        var rosterTitle = (def.roster && def.roster.title) || 'Roster';
        cols.push({ key: '__roster_count', label: rosterTitle + ' entries' });
      } else {
        cols.push({ key: col, label: labelMap[col] || humanLabel(col) });
      }
    });
  } else {
    // fallback: show up to 8 scalar fields, preferring those with a known label
    var shown = 0;
    Object.keys(values).forEach(function (k) {
      if (shown >= 8) return;
      var v = values[k];
      if (v == null || v === '' || typeof v === 'object') return;
      cols.push({ key: k, label: labelMap[k] || humanLabel(k) });
      shown++;
    });
  }

  // ── C. Resolve each column's value ─────────────────────────────────────────
  var pairs = cols.map(function (col) {
    var v;
    if (col.key === '__roster_count') {
      // count roster rows stored in values (arrays under roster-keyed arrays)
      // roster entries live in values[rosterKey] as an array, or in entry.roster
      var rosterKey = def.roster && def.roster.columns && def.roster.columns[0] && def.roster.columns[0].key;
      // find any array value — the roster is stored as an array in values
      var arr = null;
      Object.keys(values).forEach(function (k) { if (Array.isArray(values[k])) arr = values[k]; });
      v = arr ? arr.length + '' : '—';
    } else {
      var raw = values[col.key];
      if (raw == null || raw === '') { v = '—'; }
      else if (typeof raw === 'object') { v = JSON.stringify(raw); }
      else { v = String(raw); }
    }
    return { label: col.label, value: v };
  }).filter(function (p) { return p.value !== '—' || cols.length <= 4; });
  // (keep '—' entries only when there aren't many cols, so blanks are informative)

  if (!pairs.length) {
    return '<span style="color:#8a939b;font-size:12px;">No field values captured on this entry.</span>';
  }

  // ── D. Render as a definition list ─────────────────────────────────────────
  return '<dl class="vals">' +
    pairs.map(function (p) {
      return '<dt>' + esc(p.label) + '</dt><dd>' + esc(p.value) + '</dd>';
    }).join('') +
    '</dl>';
}
```

---

### 3 — Update the detail row to call `previewDl(r)` instead of `valuesDl(r.values)`

In `renderGroup()`, find the line:

```js
var detail = open ? '<tr class="detail"><td></td><td colspan="6">' + valuesDl(r.values) + formLink + '</td></tr>' : '';
```

Replace with:

```js
var detail = open ? '<tr class="detail"><td></td><td colspan="6">' + previewDl(r) + formLink + '</td></tr>' : '';
```

---

### 4 — Add a "View full record" link that pre-opens the specific submission

The existing `formLink` already points to `href + '#' + id`. That is correct — keep it. But improve the link text and style so it is clearly an action, not just a footnote:

In the `formLink` assignment inside `renderGroup()`, change:

```js
var formLink = r.href && r.id
  ? '<div style="margin-top:10px;"><a href="' + esc(r.href) + '#' + encodeURIComponent(r.id) + '" target="_blank" style="font-size:11.5px;color:#1d4ed8;">View submission form &rarr;</a></div>'
  : '';
```

Replace with:

```js
var formLink = r.href && r.id
  ? '<div style="margin-top:10px;">' +
      '<a href="' + esc(r.href) + '#' + encodeURIComponent(r.id) + '" target="_blank" ' +
         'style="font-size:12px;color:#1d4ed8;font-weight:600;text-decoration:none;border:1px solid #c3d4f7;padding:4px 10px;border-radius:4px;background:#f0f5ff;">' +
        'Open full record &rarr;' +
      '</a>' +
    '</div>'
  : '';
```

---

### 5 — Improve the `dl.vals` layout for readability

The existing CSS rule `dl.vals` is defined in the `<style>` block. Update it so labels and values are clearly separated:

Find:
```css
dl.vals{ margin:0; display:grid; grid-template-columns:max-content 1fr; gap:2px 14px; }
dl.vals dt{ color:#5c6771; font-weight:600; }
dl.vals dd{ margin:0; }
```

Replace with:
```css
dl.vals{ margin:0; display:grid; grid-template-columns:max-content 1fr; gap:4px 18px; align-items:baseline; font-size:12px; }
dl.vals dt{ color:#5c6771; font-weight:600; white-space:nowrap; }
dl.vals dd{ margin:0; font-weight:500; color:#1b2330; word-break:break-word; }
```

---

### 6 — Show roster row count in the main table "Ref" column when listColumns includes `roster:count`

This is optional but useful. In the `scan()` loop where `ref: entryRef(entry.values)` is computed, add a fallback that counts roster entries:

Find inside the `list.forEach` block:
```js
ref: entryRef(entry.values),
```

Replace with:
```js
ref: entryRef(entry.values),
rosterCount: (function () {
  // count any array value stored in values — that is the roster
  var arr = null;
  Object.keys(entry.values || {}).forEach(function (k) {
    if (Array.isArray(entry.values[k])) arr = entry.values[k];
  });
  return arr ? arr.length : null;
})(),
```

Then in `renderGroup()`, in the `<td>` that shows `r.ref`, change:

```js
'<td>' + esc(r.ref || '—') + '</td>' +
```

Replace with:

```js
'<td>' + esc(r.ref || '—') + (r.rosterCount != null ? '<br><span style="color:#5c6771;font-size:11px;">' + r.rosterCount + ' rows</span>' : '') + '</td>' +
```

---

## Testing checklist

1. Open `awaiting-verification.html` as a role that has pending verifications.
2. Click **Preview** on any row.
   - [ ] The preview panel shows labelled fields (not raw camelCase keys).
   - [ ] Fields shown match the record's `listColumns` (check against `public/data/record-defs/<recordKey>.json` — look at its `listColumns` array).
   - [ ] If the record has `roster:count` in its `listColumns`, the count of roster rows appears.
   - [ ] "Open full record →" button is visible and opens the record in a new tab, pre-scrolled to the correct submission.
3. For a record type whose def file does not exist (or fetch fails), the preview falls back to showing up to 8 scalar fields — no JS error.
4. Click **Expand all** — all preview panels open; labels are correct across different record types.
5. Select multiple entries across different record types and verify them — the verification flow itself is unchanged.
6. Check the "Ref" column shows `<jobNo>` with `<N> rows` beneath it for records that have roster entries.

---

## Commit

```
git add public/pages/awaiting-verification.html
git commit -m "feat: rich verification preview using record-def listColumns + field labels

- Loads record-def JSON per record type when queue is loaded
- Uses listColumns to show only the key fields in the preview panel
- Renders proper field labels from the def (not raw camelCase)
- roster:count token shows number of roster rows
- Improved 'Open full record →' link styling
- Roster row count shown in Ref column

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019W6FesE1WBUexPbErdjV7S"
git push origin main
```
