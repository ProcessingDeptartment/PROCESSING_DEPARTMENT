# Remove Categories Column — Master Record Index

**Date:** 27 October 2026  
**Raised by:** Michaela (Abagold)  
**Type:** Cleanup — no DB changes, no new API routes.  
**Scope:** `public/records/master-record-index.html`

---

## What this removes

The "Category" column (palette assignment per record) from the master index table. The feature has never been used and the column adds clutter. The orphaned `record_category:` keys already in Neon are harmless — no cleanup needed.

---

## 1. CSS — remove the `.c-cat` rules

Inside the `<style>` block, delete these rules entirely:

```css
td.c-cat select{ font-size:11.5px; font-weight:600; padding:3px 4px; border:1px solid #d0d5db;
          border-radius:3px; background:#fff; color:var(--palette-ink); width:100%; min-width:132px; }
td.c-cat select:disabled{ background:#f3f4f6; color:#6b7280; cursor:not-allowed; }
td.c-cat select.dirty{ border-color:var(--palette-primary); box-shadow:0 0 0 2px rgba(201,131,43,.15); }
td.c-cat .cat-none{ color:var(--palette-label); }
```

---

## 2. Table header — remove the Category `<th>`

In the `<thead>` `<tr>`, delete:

```html
<th style="width:140px;">Category</th>
```

Also update the `colspan` on the section-row `<td>` from `9` to `8` (it spans all columns):

Find:
```js
html += `<tr class="sec-row"><td colspan="9">${esc(sectionOf(r))}</td></tr>`;
```

Replace with:
```js
html += `<tr class="sec-row"><td colspan="8">${esc(sectionOf(r))}</td></tr>`;
```

---

## 3. JS — remove all category-related code

### 3a. Remove constants

Delete:
```js
const CATEGORY_PREFIX = 'record_category:';
```

Delete the `CATEGORIES` array definition:
```js
const CATEGORIES = [['', 'Default']].concat((window.Lookups && window.Lookups.get('palettes') || [])
  .map(p => [p, labelForPalette(p)]));
```

Delete the `labelForPalette` helper function:
```js
function labelForPalette(p) {
  if (!p) return 'Default';
  return String(p).replace(/\//g, ' / ').replace(/[-_]/g, ' ').replace(/\b\w/g, s => s.toUpperCase());
}
```

### 3b. Remove state variable

Delete:
```js
let categories = {};
```

### 3c. Remove `loadCategories()` and `saveCategory()` functions

Delete both functions in their entirety.

### 3d. Remove `currentCategory()` and `categorySelect()` helper functions

Delete both helper functions in their entirety.

### 3e. Remove the category cell from `render()`

In the `render()` function, delete these two lines:

```js
const file = r.href ? String(r.href).toLowerCase() : '';
const catCell = r.href
  ? categorySelect(file, currentCategory(file))
  : '<span class="cat-none">–</span>';
```

And delete the `<td class="c-cat">` cell from the html string:

```js
+ `<td class="c-cat">${catCell}</td>`
```

### 3f. Remove the category `change` event listener

Delete this entire `tableBody.addEventListener('change', ...)` block:

```js
tableBody.addEventListener('change', async (e) => {
  const sel = e.target.closest('select[data-file]');
  if (!sel || !canEdit) return;
  sel.classList.add('dirty');
  await saveCategory(sel.dataset.file, sel.value);
});
```

### 3g. Remove `loadCategories()` from `Promise.all` in `init()`

Find:
```js
await withTimeout(Promise.all([loadControl(), loadLive(), loadCategories(),
                               loadRecordNumbers(), loadAddedRows(), loadSopLinks(), loadArchived()]));
```

Replace with:
```js
await withTimeout(Promise.all([loadControl(), loadLive(),
                               loadRecordNumbers(), loadAddedRows(), loadSopLinks(), loadArchived()]));
```

---

## 4. CSV export — remove the Category column

In the `$('csvBtn').addEventListener('click', ...)` handler, remove `'Category'` from the `head` array:

Find:
```js
const head = ['Document No.', 'Document Name', 'Category', 'Details for change', 'Current revision',
              'Obsolete revision retrieved? Y/N', 'New revision distributed? Y/N', 'New date of issue'];
```

Replace with:
```js
const head = ['Document No.', 'Document Name', 'Details for change', 'Current revision',
              'Obsolete revision retrieved? Y/N', 'New revision distributed? Y/N', 'New date of issue'];
```

The CSV export loops over `row.cells` by index, so removing the column from the table header and cell automatically removes it from the export — no further change needed.

---

## 5. Commit message template

```
feat: remove categories column from master record index

The palette/category assignment column was never used. Removed the
Category <th>, td.c-cat cell, CATEGORY_PREFIX constant, CATEGORIES
array, labelForPalette(), loadCategories(), saveCategory(),
currentCategory(), categorySelect(), and the category change listener.
Orphaned record_category: keys in Neon are harmless — no DB cleanup.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TWZgo3xX6Sjx1AVSdMX7bR
```
