# Category Colour Dot — Remove Palette Picker, Show Dot in Submissions List

## Goal

- **Remove** the ability to change the form colour-palette/theme by category (no more `data-palette` applied to `<html>`, no more localStorage category overrides).
- **Keep** category as a concept but use it only to show a small fixed colour dot next to the record name in the submissions table.
- Category is **selected from a fixed list** — not a colour picker. The colour dot is automatic from the category.

---

## 1. Edit `public/lib/palette-map.js`

Replace the entire file with the simplified version below. It keeps the category→colour map but removes:
- The `overrideFor()` / localStorage read
- Setting `data-palette` on `<html>`

```js
(function () {
  // Fixed colour dot per category — shown in the submissions list beside the record name.
  // Do NOT assign a theme/palette to the whole page; this map is colour-dot only.
  var CATEGORY_COLOURS = {
    'sauce':             '#e05c2a',   // orange-red
    'dry':               '#c9832b',   // amber
    'cleaning/hygiene':  '#2a7fc1',   // blue
    'traceability':      '#6b47c4',   // purple
    'quality_general':   '#2f6b3a',   // green
    'canning':           '#a3352d',   // red
  };

  // Map recordKey (or page filename) → category.
  // Keys are the recordKey string (e.g. 'drying-process') or the HTML filename without extension
  // (e.g. 'rec-7.4.1-drying-process'). Lower-case, exact match.
  var RECORD_CATEGORIES = {
    // Fill these in — one line per record:
    // 'drying-process': 'dry',
    // 'rec-7.4.1-drying-process': 'dry',
  };

  function categoryFor(recordKeyOrFile) {
    var k = String(recordKeyOrFile || '').toLowerCase().replace(/\.html$/, '');
    return RECORD_CATEGORIES[k] || '';
  }

  function dotColourFor(recordKeyOrFile) {
    var cat = categoryFor(recordKeyOrFile);
    return cat ? (CATEGORY_COLOURS[cat] || '') : '';
  }

  window.PaletteMap = {
    CATEGORY_COLOURS: CATEGORY_COLOURS,
    RECORD_CATEGORIES: RECORD_CATEGORIES,
    categoryFor: categoryFor,
    dotColourFor: dotColourFor,
  };
})();
```

> **Note:** Populate `RECORD_CATEGORIES` with every record key and its category. The list of valid categories is the keys of `CATEGORY_COLOURS`. Any record not listed gets no dot (blank category is fine).

---

## 2. Edit `public/lib/form-record.js` — Add colour dot in `renderTable()`

Find the `renderTable()` function. Inside the `<tbody>` row loop, locate where the record title / doc-code is shown in the first `<td>` column of each row. It will look something like:

```js
html += `<tr ...>`;
html += `<td ...>${esc(fmtSubmittedAt(sub.submittedAt))}</td>`;
// ... other columns ...
```

The first column of `listColumns` determines what shows. Find the column rendered for `entryDate` or the first column. The record title / doc-code header row and the row that renders the job number / first column value is where to inject the dot.

### Add a dot helper near the top of the `init()` function (anywhere before `renderTable`):

```js
function categoryDot() {
  if (!window.PaletteMap) return '';
  var colour = window.PaletteMap.dotColourFor(config.recordKey || '');
  if (!colour) return '';
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colour};margin-right:5px;flex-shrink:0;vertical-align:middle;" title="${window.PaletteMap.categoryFor(config.recordKey || '')}"></span>`;
}
```

### Inject the dot into the submissions table header:

Find the table `<thead>` build inside `renderTable()`. It will be something like:
```js
html += `<thead><tr>`;
listColumns.forEach(col => { html += `<th>...</th>`; });
html += `</tr></thead>`;
```

In the first `<th>` (the date or first column), prepend `${categoryDot()}` to the header text, e.g.:
```js
// first th only:
html += `<th>${categoryDot()}${esc(colLabel)}</th>`;
```

This puts the dot once in the column header, clearly marking the record's category at a glance.

---

## 3. Remove `data-palette` CSS variables from `public/styles/record-theme.css`

Search for `[data-palette=` blocks in `record-theme.css`. These are the per-category colour-theme overrides. **Delete all of them.** The base palette variables on `:root` can stay; only the `[data-palette="sauce"]`, `[data-palette="dry"]` etc. override blocks need to go.

```css
/* DELETE blocks like these: */
[data-palette="sauce"] { --palette-dark: ...; --palette-primary: ...; ... }
[data-palette="dry"]   { --palette-dark: ...; --palette-primary: ...; ... }
/* etc. */
```

---

## 4. Record HTML files — Remove `data-palette` attribute (if set inline)

Search across `public/records/` for any `data-palette` attribute set on `<html>` or `<body>` tags and remove them:

```bash
grep -rl "data-palette" public/records/
```

Remove any `data-palette="..."` attribute found.

---

## 5. Category assignment — where to set category per record

Going forward, the category for a record is set in `RECORD_CATEGORIES` in `palette-map.js` (step 1 above). No UI is needed; it is a code-level mapping. Fill it in with every existing record key:

| recordKey | category |
|-----------|----------|
| `drying-process` | `dry` |
| (add all others) | (one of: sauce, dry, cleaning/hygiene, traceability, quality_general, canning) |

---

## 6. Bump version numbers

`palette-map.js` is loaded with no `?v=` param in most record HTML files (just `src="../lib/palette-map.js"`). Because browsers may have cached the old version, add a version param:

```bash
# Find all files loading palette-map.js
grep -rl "palette-map.js" public/
```

Change each reference from:
```html
<script src="../lib/palette-map.js"></script>
```
to:
```html
<script src="../lib/palette-map.js?v=2"></script>
```

---

## 7. Commit

```bash
git add public/lib/palette-map.js \
        public/lib/form-record.js \
        public/styles/record-theme.css \
        public/records/
git commit -m "feat: remove palette colour theme; show category dot in submissions list only"
git push origin main
```

Render auto-deploys within ~30 seconds.
