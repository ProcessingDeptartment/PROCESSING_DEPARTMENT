# REC 7.4.6 Click Routes to REC 8.1.6 — Fix Instructions

**Date:** 2026-10-20  
**Raised by:** Michaela — "rec 7.4.6 click goes to rec 8.1.6 click error"  
**Type:** Bug fix — navigation routing only. No field, validation, DB or print changes.  
**Scope:** The link/route for REC 7.4.6 (Dry Stock Control) in any navigation surface (home page blocks, hamburger menu, master record index, sidebar) points to the wrong page (REC 8.1.6). Identify and correct the href.

---

## 1. What is wrong

Clicking **REC 7.4.6** from any navigation surface (home blocks, hamburger dropdown, master record index) navigates to **REC 8.1.6** instead of the Dry Stock Control page (`dry-stock-control`).

This is a wrong `href` — either the `href` attribute on the `<a>` tag, the `data-url` / `data-href` on a button or block, or the route string in a JS navigation array is set to the 8.1.6 path instead of the 7.4.6 path.

---

## 2. Where to look

Check every place REC 7.4.6 is referenced for navigation. Search the codebase:

```bash
# Find all references to 7.4.6 in HTML and JS files
grep -rn "7.4.6\|7\.4\.6\|dry-stock-control" public/ --include="*.html" --include="*.js" --include="*.json"
```

Typical locations:

| File | What to check |
|---|---|
| `public/index.html` | Home page block `<a href="...">` for REC 7.4.6 |
| `public/records/master-record-index.html` | Table row link for REC 7.4.6 |
| `public/lib/nav-menu.js` (or `nav-menu.js`) | Hamburger menu items array — the entry for 7.4.6 |
| `public/lib/master-index-data.js` | Record manifest — the `url` or `href` field for the 7.4.6 record |
| Any sidebar config JSON | Record list nav config |

---

## 3. What the correct href must be

REC 7.4.6 is **Dry Stock Control** (`dry-stock-control`).

The correct page URL follows the same pattern as the other dry records. Check what the actual HTML file is named:

```bash
find public/ -iname "*7.4.6*" -o -iname "*dry-stock-control*"
```

The `href` for REC 7.4.6 must point to **that file**, not to any file named `8.1.6` or similar.

---

## 4. Fix

### 4a. If the error is in a nav array or data file

Find the object/entry for REC 7.4.6 in `nav-menu.js`, `master-index-data.js`, or a similar config and correct the `url`/`href`/`path` field:

```js
// BEFORE (wrong)
{ label: 'REC 7.4.6 Dry Stock Control', href: '...8.1.6...' }

// AFTER (correct)
{ label: 'REC 7.4.6 Dry Stock Control', href: '/records/REC-7.4.6-dry-stock-control.html' }
// (use the actual filename found by the find command above)
```

### 4b. If the error is in static HTML

Find the `<a>` tag, block link, or button with `data-href` for REC 7.4.6 and correct the attribute value to the correct page path.

### 4c. Check all navigation surfaces

After fixing, verify the correct href is present in:
- [ ] Home page blocks (`index.html`)
- [ ] Hamburger menu dropdown (nav-menu component)
- [ ] Master record index (`master-record-index.html` or generated from `master-index-data.js`)

---

## 5. Also check: REC 8.1.6

Confirm REC 8.1.6 **also has its own correct link** pointing to its own page — the fix for 7.4.6 must not break 8.1.6's navigation.

```bash
grep -rn "8.1.6\|8\.1\.6" public/ --include="*.html" --include="*.js"
```

---

## 6. Test

1. From the home page, click the REC 7.4.6 block/link → lands on the **Dry Stock Control** page (title says "REC 7.4.6" or "Dry Stock Control", NOT 8.1.6).
2. From the hamburger menu, tap REC 7.4.6 → same result.
3. From the master record index, click REC 7.4.6 → same result.
4. Click REC 8.1.6 from any surface → lands on **its own** correct page, not 7.4.6.
5. Bump `?v=` cache-bust strings on any changed JS or HTML files.

---

## 7. Root cause note for work log

The most likely cause is that in the nav config array or master index data, the entries for 7.4.6 and 8.1.6 were ordered adjacently and the href values were swapped or one was copy-pasted with the wrong target. Document which file contained the error in the work log.
