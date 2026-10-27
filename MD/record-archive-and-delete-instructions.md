# Master Index — Archive Records & Delete Added Rows

**Date:** 27 October 2026  
**Raised by:** Michaela (Abagold)  
**Type:** Feature addition — no DB changes, no new API routes.  
**Scope:** `public/records/master-record-index.html`, `public/records/record-list.html`

---

## What this adds

1. **Archive** — Admins can archive any row on the master index. Archived rows are hidden from normal users searching in `record-list.html`. Admins can still see them (filtered view) and can restore them.
2. **Delete added rows** — Rows that were added online (via "Add new record") can be permanently deleted by an admin. This is the mechanism to remove document **10.2.2**.

---

## 1. `public/records/master-record-index.html`

### 1a. CSS — add inside the existing `<style>` block, after the existing `.tag-sop` rule

```css
/* Archive column */
body.no-archive-col .col-archive { display: none; }
td.c-archive { vertical-align: middle; white-space: nowrap; }

/* Archived row appearance */
tr.row-archived td { color: #9ca3af !important; }
tr.row-archived td.c-name a { color: #9ca3af; pointer-events: none; text-decoration: none; }
tr.row-archived td.c-yn select,
tr.row-archived td.c-cat select { opacity: .5; }

/* Archive / Restore / Delete buttons */
.btn-archive, .btn-del {
  font-size: 10.5px; padding: 2px 8px; background: none;
  border: 1px solid #d0d5db; border-radius: 3px; cursor: pointer;
  color: #6b7280; font-family: inherit; display: block; width: 100%;
  margin-bottom: 3px; text-align: center;
}
.btn-archive:hover { border-color: #b45309; color: #b45309; }
.btn-restore { border-color: var(--palette-ok); color: var(--palette-ok); }
.btn-restore:hover { background: var(--palette-ok-bg); }
.btn-del { border-color: #fca5a5; color: #dc2626; }
.btn-del:hover { background: #fef2f2; border-color: #dc2626; }

/* Tag */
.tag-archived { background: #fee2e2; color: #991b1b; }
```

---

### 1b. Table header — add the Archive column header

In the `<thead>` `<tr>`, **after** the existing `col-edit-template` `<th>`, add:

```html
<th class="col-archive" style="width:96px;">Archive</th>
```

---

### 1c. JS — inside the `(function () { ... })();` block

#### Step 1 — add storage key constant (after the existing `SOP_LINKS_BY_SOP` line)

```js
const ARCHIVE_PREFIX = 'record_archived:';
```

#### Step 2 — add archive state variable (after the existing `let sopLinks = {};` line)

```js
let archived = {};
```

#### Step 3 — add `loadArchived()` and `setArchived()` functions (after the existing `loadSopLinks()` function)

```js
async function loadArchived() {
  archived = {};
  try {
    const raw = await window.storage.getByPrefix(ARCHIVE_PREFIX, true);
    for (const k in raw) {
      if (raw[k] === 'true') archived[k.slice(ARCHIVE_PREFIX.length)] = true;
    }
  } catch (e) { archived = {}; }
}

async function setArchived(id, val) {
  if (val) archived[id] = true; else delete archived[id];
  await window.storage.set(ARCHIVE_PREFIX + id, val ? 'true' : '', true);
}
```

#### Step 4 — update `render()` to stamp archive state + add Archive column cell

Find the line inside `render()` that builds the `<tr>` opening tag. It currently looks like:

```js
html += `<tr class="${online || isDoc ? '' : 'not-digitised'}" data-section=...`
```

Change it to also include `data-archived` and the `row-archived` class:

```js
const isArchived = !!archived[id];
html += `<tr class="${(online || isDoc ? '' : 'not-digitised') + (isArchived ? ' row-archived' : '')}" data-section="${esc(sectionOf(r))}" data-id="${esc(id)}" data-archived="${isArchived}" data-online="${online}" data-bumped="${!!l.bumped}" data-unlisted="${!!r.notOnIndexList}" data-added="${!!r.addedId}">`
```

Then at the **end** of the same `html +=` block, just before the closing `` `</tr>` ``, add the archive column cell. The cell goes after the existing `c-edit-template` column cell:

```js
+ `<td class="c-archive col-archive">`
+ (canEdit
    ? `<button class="btn-archive${isArchived ? ' btn-restore' : ''}" data-row="${esc(id)}">${isArchived ? 'Restore' : 'Archive'}</button>`
    : '')
+ (canEdit && r.addedId
    ? `<button class="btn-del" data-added-id="${esc(r.addedId)}">Delete</button>`
    : '')
+ `</td>`
```

#### Step 5 — update `filter()` to hide archived rows by default

In `filter()`, find the block that handles status filters:

```js
if (status === 'online') ok = ok && online;
else if (status === 'paper') ok = ok && !online;
else if (status === 'bumped') ok = ok && bumped;
else if (status === 'unlisted') ok = ok && unlisted;
else if (status === 'added') ok = ok && added;
```

Replace with:

```js
const isArchived = row.dataset.archived === 'true';
if (status === 'online')    ok = ok && online && !isArchived;
else if (status === 'paper')    ok = ok && !online && !isArchived;
else if (status === 'bumped')   ok = ok && bumped && !isArchived;
else if (status === 'unlisted') ok = ok && unlisted && !isArchived;
else if (status === 'added')    ok = ok && added && !isArchived;
else if (status === 'archived') ok = ok && isArchived;
else /* 'all' */                ok = ok && !isArchived;
```

> **Note:** When `status === 'all'` (the default "All records" option), archived rows are **hidden**. Only the explicit "Archived" filter reveals them to admins.

#### Step 6 — add "Archived" option to the status filter `<select>`

In the HTML `<select id="statusFilter">`, add as the **last** `<option>`:

```html
<option value="archived">Archived records</option>
```

#### Step 7 — add event listeners for Archive and Delete buttons

After the existing `tableBody.addEventListener('change', ...)` blocks (the ones for Y/N selects and category selects), add a new click listener:

```js
tableBody.addEventListener('click', async (e) => {
  if (!canEdit) return;

  // ---- Archive / Restore button ----
  const archBtn = e.target.closest('.btn-archive');
  if (archBtn) {
    const id = archBtn.dataset.row;
    const nowArchived = !archived[id];
    const rowData = ROWS.find(r => rowId(r) === id);
    const label = rowData ? (rowData.docNo + ' — ' + rowData.name) : id;
    if (nowArchived) {
      if (!confirm(`Archive "${label}"?\n\nIt will be hidden from the Record List for users but visible to admins on this index using the "Archived records" filter. You can restore it at any time.`)) return;
    }
    $('saveState').textContent = 'Saving…';
    try {
      await setArchived(id, nowArchived);
      $('saveState').textContent = nowArchived ? 'Archived' : 'Restored';
      setTimeout(() => { $('saveState').textContent = ''; }, 2000);
      render();
    } catch (err) {
      $('saveState').textContent = 'Error: ' + err.message;
      $('saveState').style.color = 'var(--palette-fail)';
    }
    return;
  }

  // ---- Delete button (added rows only) ----
  const delBtn = e.target.closest('.btn-del');
  if (delBtn) {
    const addedId = delBtn.dataset.addedId;
    const row = addedRows.find(r => r.addedId === addedId);
    if (!row) return;
    if (!confirm(`Permanently delete "${row.docNo} — ${row.name}" from the index?\n\nThis cannot be undone.`)) return;
    $('saveState').textContent = 'Deleting…';
    try {
      addedRows = addedRows.filter(r => r.addedId !== addedId);
      const idx = ROWS.findIndex(r => r.addedId === addedId);
      if (idx >= 0) ROWS.splice(idx, 1);
      await saveAddedRows();
      // Clean up any archived flag stored for this row
      try { await window.storage.set(ARCHIVE_PREFIX + addedId, '', true); } catch (_) {}
      $('saveState').textContent = 'Deleted';
      setTimeout(() => { $('saveState').textContent = ''; }, 2000);
      render();
    } catch (err) {
      $('saveState').textContent = 'Error: ' + err.message;
      $('saveState').style.color = 'var(--palette-fail)';
    }
    return;
  }
});
```

> **Note:** `addedRows` must be declared with `let` (it already is) because the delete handler reassigns it with `.filter()`.

#### Step 8 — add `loadArchived()` to the init Promise.all

Find the existing line inside `init()`:

```js
await withTimeout(Promise.all([loadControl(), loadLive(), loadCategories(),
                               loadRecordNumbers(), loadAddedRows(), loadSopLinks()]));
```

Replace with:

```js
await withTimeout(Promise.all([loadControl(), loadLive(), loadCategories(),
                               loadRecordNumbers(), loadAddedRows(), loadSopLinks(), loadArchived()]));
```

#### Step 9 — hide the archive column from non-admins

In `init()`, after the existing line:

```js
document.body.classList.toggle('no-manage-templates', !isAdmin);
```

Add:

```js
document.body.classList.toggle('no-archive-col', !isAdmin);
```

---

## 2. `public/records/record-list.html`

### Changes to the inline `<script>` block

#### Step 1 — add archive prefix constant (before the existing `const RECORDS = ...` line)

```js
const ARCHIVE_PREFIX = 'record_archived:';
let archived = {};
```

#### Step 2 — add `loadArchived()` function (after the `function filterRecords() { ... }` block)

```js
async function loadArchived() {
  try {
    const raw = await window.storage.getByPrefix(ARCHIVE_PREFIX, true);
    for (const k in raw) {
      if (raw[k] === 'true') archived[k.slice(ARCHIVE_PREFIX.length)] = true;
    }
  } catch (e) { archived = {}; }
}
```

#### Step 3 — add archive filtering to `render()`

Find the `render()` function. It currently iterates `RECORDS.forEach(r => { ... })`.  
Add a filter at the top of `render()` before the `forEach`:

```js
function render() {
  let html = '';
  const visible = RECORDS.filter(r => {
    const id = r.recordKey || ('doc:' + (r.docNo || ''));
    return !archived[id];
  });
  visible.forEach(r => {
    // ... rest of existing render body unchanged, but using r from the visible array
    const baseline = r.revision || 1;
    const hit = latest[r.recordKey];
    const live = hit ? hit.revisionNumber : baseline;
    const moved = live !== baseline ? `<span class="bumped">was Rev ${baseline}</span>` : '';
    html += `<tr>`
      + `<td class="doc-code">${esc(r.docNo)}</td>`
      + `<td class="title"><a href="${esc(r.href)}">${esc(r.name)}</a></td>`
      + `<td class="revision">Rev ${live}${moved}</td>`
      + `</tr>`;
  });
  tableBody.innerHTML = html;
  totalCount.textContent = visible.length;
  filterRecords();
}
```

> The only change from the existing `render()` is:
> - `const visible = RECORDS.filter(...)` replaces `RECORDS.forEach` as the outer loop
> - `totalCount.textContent = visible.length` replaces `RECORDS.length`

#### Step 4 — add `loadArchived()` to the async IIFE

Find the existing async IIFE at the bottom:

```js
(async function() {
  render();
  try { latest = await window.DocumentRevision.latestAll(); } catch (e) { latest = {}; }
  render();
})();
```

Replace with:

```js
(async function() {
  render();
  try { latest = await window.DocumentRevision.latestAll(); } catch (e) { latest = {}; }
  try { await loadArchived(); } catch (e) { archived = {}; }
  render();
})();
```

> `window.storage` is already available at this point because `api-backend.js` is loaded before this script on `record-list.html`.

---

## 3. Deleting document 10.2.2 specifically

Once the code above is deployed:

1. Open `https://processing-department.onrender.com/records/master-record-index.html`
2. Log in as an **admin**.
3. Find document **10.2.2** in the table (search for it in the toolbar).
4. Click the red **Delete** button that now appears in the Archive column.
5. Confirm the deletion prompt.

The row is removed from the stored `master_index_added_rows` JSON and disappears from both the master index and the record list.

---

## 4. Test checklist

**Archive behaviour:**
- [ ] Admin sees "Archive" button on every row in the index.
- [ ] Non-admin sees no Archive column at all.
- [ ] Clicking Archive on a row prompts for confirmation.
- [ ] After archiving, the row disappears from the default "All records" view.
- [ ] Selecting "Archived records" from the Status filter reveals the row with the `ARCHIVED` tag and a "Restore" button.
- [ ] Clicking Restore brings the row back to the default view.
- [ ] Archived row does **not** appear in `record-list.html` for any user (admin or otherwise).
- [ ] After restoring, the record reappears in `record-list.html`.

**Delete behaviour:**
- [ ] Delete button only appears on dynamically-added rows (tagged "added online") — not on static master-index-data.js rows.
- [ ] Clicking Delete prompts for confirmation with the document name.
- [ ] After confirming, the row is permanently removed from the index and cannot be found by search.
- [ ] The deletion persists after a page refresh (the row is gone from stored data).

---

## 5. Commit message template

```
feat: archive records from master index; delete added rows; hide archived from record list

- master-record-index.html:
    - loadArchived() / setArchived() using 'record_archived:' prefix key (mirrors loadCategories())
    - Archive/Restore button per row (admin-only col-archive column)
    - Delete button for added rows only (admin only)
    - filter(): archived rows hidden by default in all status views; new 'archived' filter shows them
    - CSS: row-archived greyed-out style, btn-archive, btn-restore, btn-del, tag-archived
- record-list.html:
    - loadArchived() reads same storage keys
    - render() filters out archived records before building table
    - async IIFE calls loadArchived() after latestAll()

To delete doc 10.2.2: log in as admin → master index → search '10.2.2' → Delete.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TWZgo3xX6Sjx1AVSdMX7bR
```
