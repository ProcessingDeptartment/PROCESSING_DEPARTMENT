# Navigation: Back Button + Hamburger Menu on Every Page

## What was changed

### 1. Post-submission pop-up (`public/lib/post-submit-prompt.js`)

The pop-up that appears after a record is submitted now shows **four buttons** in order:

| Button | Action |
|--------|--------|
| **New submission** (primary, dark background) | Resets the form for another entry |
| **Return to record list** | Navigates to `records/record-list.html` |
| **Return to home** | Navigates to `index.html` |
| **Log out** (red text) | Logs the user out and returns to home |

### 2. Back button position on record pages (`public/lib/record-shell.js`)

The back (←) button has been moved to the **right side** of the top bar, placed immediately to the **left of the hamburger menu**. The pair `[← Back] [≡]` now sit together at the far right on every record form page.

### 3. New script: `public/lib/page-nav.js`

A new lightweight script that injects a sticky dark nav bar at the top of **non-record pages**. The bar contains:

```
[← Back]  [AB]  [Page title]  ─────────────  [≡ Menu]
```

- **Back button** — returns to the previous same-origin page, or to home if no history
- **Hamburger** — opens the same shared `nav-menu.js` panel used by record pages
- Respects `@media print` (hidden in print/PDF)

---

## How to add `page-nav.js` to every non-record page

Add this **one script tag** near the **top of `<body>`** (before other scripts) on each page listed below:

```html
<script src="/lib/page-nav.js?v=1"></script>
```

> Use `/lib/page-nav.js` (absolute path from root) for pages in `public/pages/` and `public/records/`.  
> Use `lib/page-nav.js` (relative) for `public/index.html`.

### Pages to update

#### `public/index.html`
```html
<body>
<script src="lib/page-nav.js?v=1"></script>   <!-- ADD THIS LINE -->
<div class="brand-bar">...
```

#### `public/records/record-list.html`
```html
<body>
<script src="/lib/page-nav.js?v=1"></script>   <!-- ADD THIS LINE -->
```

#### `public/pages/` — add to ALL of:
- `admin-passkeys.html`
- `awaiting-verification.html`
- `backfill-traceability.html`
- `canning-report.html`
- `dashboard.html`
- `devices.html`
- `drying-report.html`
- `fsms-calendar.html`
- `fsms.html`
- `handovers.html`
- `job-status.html`
- `nc-log.html`
- `production-dashboard.html`
- `quality-trends.html`
- `spec-admin.html`
- `specifications.html`
- `submissions-log.html`
- `verification-queue.html`
- `verifier-assignments.html`

In each of those pages, the script tag goes at the very top of `<body>`:
```html
<body>
<script src="/lib/page-nav.js?v=1"></script>   <!-- ADD -->
```

---

## Files changed / created

| File | Change |
|------|--------|
| `public/lib/post-submit-prompt.js` | 4 buttons (new submission, record list, home, log out) |
| `public/lib/record-shell.js` | Back button moved to right side, next to hamburger |
| `public/lib/page-nav.js` | **New** — sticky nav bar for non-record pages |
| `MD/nav-back-button-every-page-instructions.md` | This file |

---

## Version bump

After copying the changed JS files, bump the `?v=` parameter in any HTML that already references `record-shell.js`:

```bash
grep -rl "record-shell.js" public/records/ public/pages/
```

Replace `?v=11` (current) with `?v=12` in all matches.

`post-submit-prompt.js` is loaded dynamically by `record-shell.js` — no HTML files reference it directly, so no version bump needed there.

`page-nav.js` is new; use `?v=1` as its initial version.
