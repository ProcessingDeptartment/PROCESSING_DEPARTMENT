# Fix: dried-abalone-transfer crate edit flashes and can't be selected

## File
`public/lib/form-record.js`

## Bug
On the Dried Abalone Transfer form, when a crate is added via the quickEntry bar ("+ Add crate"):

1. The new row appears briefly then immediately collapses (**flash**).
2. Clicking **Edit** on that collapsed row opens it but it immediately collapses again, preventing the weight field from being interacted with (**can't select**).

## Root causes

### Bug 1 — `_importRows` collapses the new row immediately

Around line 3632, `_importRows` adds ALL rows (including the newly added one) to `collapsedRows` before calling `applyCollapse`. The new row should not be collapsed on add.

**Current code (~line 3638):**
```js
  if (canCollapse) {
    rows.forEach((_, i) => { if (rowHasData(i)) collapsedRows.add(i); });
    applyCollapse();
  }
```

**Replace with:**
```js
  if (canCollapse) {
    rows.forEach((_, i) => { if (i < existingCount && rowHasData(i)) collapsedRows.add(i); });
    applyCollapse();
  }
```

Also add `const existingCount = rows.length;` before the `rows = rows.concat(newRows);` line (~line 3635).

The full `_importRows` block after the fix:
```js
      container._importRows = (newRows) => {
        rows = rows.map((_, i) => readRow(i))
          .filter(r => roster.columns.some(c => String(r[c.key] || '').trim() !== ''));
        const existingCount = rows.length;
        rows = rows.concat(newRows);
        draw();

        if (canCollapse) {
          rows.forEach((_, i) => { if (i < existingCount && rowHasData(i)) collapsedRows.add(i); });
          applyCollapse();
        }
      };
```

### Bug 2 — `focusin` on the Edit button clears `pinnedOpen` before the button is removed from DOM

When the user clicks Edit on a collapsed row, `focusin` fires on the Edit button first (before `click`). The current handler sees `n !== pinnedOpen` and sets `pinnedOpen = -1`, then calls `collapseAllExcept(n)` which removes the Edit button from the DOM. Focus then moves to `<body>`. On some browsers `click` never fires on the now-detached button, so `pinnedOpen` is never set to `n`. The row stays open but is not pinned, so the first focusout (or any subsequent focusin on a different target) can collapse it again.

**Fix:** in the `focusin` listener (~line 3100), detect when focus lands on the Edit button (a `[data-roster-edit]` element) and **pin the row immediately** instead of clearing `pinnedOpen`.

**Current code (~line 3100):**
```js
      container.addEventListener('focusin', (e) => {
        if (!canCollapse) return;
        const rowEl = e.target.closest && e.target.closest('.fr-roster-row');
        if (!rowEl) return;
        const n = Number(rowEl.dataset.rosterRow);
        if (n !== pinnedOpen) pinnedOpen = -1;   // focus moved to a different row: the pin is released
        collapseAllExcept(n);
      });
```

**Replace with:**
```js
      container.addEventListener('focusin', (e) => {
        if (!canCollapse) return;
        const rowEl = e.target.closest && e.target.closest('.fr-roster-row');
        if (!rowEl) return;
        const n = Number(rowEl.dataset.rosterRow);
        // If focus landed on the Edit button, pin the row immediately.
        // The button is about to be removed from the DOM (applyCollapse strips the summary),
        // so click may not fire on some browsers — the pin must be set here, not in the click handler.
        const editBtn = e.target.closest && e.target.closest('[data-roster-edit]');
        if (editBtn) pinnedOpen = n;
        else if (n !== pinnedOpen) pinnedOpen = -1;   // focus moved to a different row: the pin is released
        collapseAllExcept(n);
      });
```

## After editing
1. Bump `?v=N` on `form-record.js` in every HTML file that references it:
   ```
   grep -rl "form-record.js" public/records/
   ```
2. Commit and push to `main`.
