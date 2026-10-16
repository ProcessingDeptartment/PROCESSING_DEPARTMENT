# Job Picker — No Auto-Drop on Open

**File:** `public/lib/job-picker.js`
**Also bump version:** `form-record.js` line ~1208 → `job-picker.js?v=13`, and every HTML that loads `form-record.js` (bump its `?v=N`).

---

## Problem

When a new record form opens, `focusPicker()` auto-focuses the job-number search input.  
Because `job-picker.js` has:

```js
input.addEventListener('focus', drawList);   // line 515
```

…the dropdown list opens immediately without the operator doing anything.  
The user must be required to **click** (or start typing) before the list appears.

---

## Fix — `public/lib/job-picker.js`

### Remove the `focus → drawList` listener

**Find** (around line 515):
```js
    input.addEventListener('focus', drawList);
    input.addEventListener('click', () => { if (list.hidden) drawList(); });
```

**Replace with** (remove the focus line, keep click):
```js
    input.addEventListener('click', () => { if (list.hidden) drawList(); });
```

That is the only change needed in `job-picker.js`.

---

## What this changes

| Event | Before | After |
|-------|--------|-------|
| Form auto-focuses search box on open | List drops open automatically | Cursor in box, list stays closed |
| Operator clicks the search box | List opens | List opens ✓ |
| Operator types in the search box | List opens | List opens ✓ |
| Arrow-down key | Opens list | Opens list ✓ |
| After jobs finish loading (`drawList` call in form-record.js) | Refreshes if input is active | Unchanged — that call already guards `document.activeElement === input` |

The gate (hiding the rest of the form until a job is picked) is unaffected — it releases only after the operator confirms a job, not on focus.

---

## Version bumps

After saving `job-picker.js`:

1. In `public/lib/form-record.js` find:
   ```
   loadLib('job-picker.js?v=12', 'JobPicker')
   ```
   Change to `?v=13`.

2. Bump the `?v=N` on `form-record.js` itself in every HTML that loads it:
   ```bash
   grep -rl "form-record.js" public/records/
   ```
   Increment each `?v=N` by 1.

3. Commit and push to `main`. Render auto-deploys within ~60 s.
