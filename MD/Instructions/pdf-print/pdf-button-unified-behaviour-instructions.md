# Unified PDF Button Behaviour — Print Hub & Verifications Tab

**File:** `MD/pdf-button-unified-behaviour-instructions.md`  
**Date:** 2026-10-27  

---

## Goal

Both PDF entry points must work identically:

| Location | Element | Current behaviour |
|---|---|---|
| Submissions Log → **Print Hub** tab | `[PDF]` button per row | Opens new tab `?print=1&closeAfter=1`, auto-closes after print (postMessage mechanism) |
| Submissions Log → **Verifications** tab (all tabs that list verified entries) | `[PDF]` button per row | Opens new tab `?print=1` — **no auto-close**, tab stays open |

**Target:** Both use the same `closeAfter=1` + `window.open()` + postMessage flow so the tab closes automatically after the user prints or dismisses the dialog.

---

## Shared helper — extract into one place

To avoid duplicating the open-and-listen logic, add a **single reusable helper function** in `submissions-log.html` (inside its `<script>` block, near the top, before `renderTable` / `renderGroup`):

```javascript
/**
 * openPdfTab(href)
 * Opens a PDF print tab and closes it automatically once the user
 * prints or dismisses the dialog (via postMessage from form-record.js).
 * Falls back to a 30-second timeout if no message arrives.
 */
function openPdfTab(href) {
  const url = href.includes('?')
    ? href + '&closeAfter=1'
    : href + '?closeAfter=1';

  const pdfWin = window.open(url, 'pdfPrint' + Date.now());
  if (!pdfWin) return; // popup blocked — user must handle manually

  const closeListener = (ev) => {
    try {
      if (ev.source === pdfWin && ev.data && ev.data.pdfReady === 1) {
        window.removeEventListener('message', closeListener);
        clearTimeout(fallbackTimer);
        setTimeout(() => { if (!pdfWin.closed) pdfWin.close(); }, 500);
      }
    } catch (_) { /* ignore cross-origin */ }
  };
  window.addEventListener('message', closeListener);

  const fallbackTimer = setTimeout(() => {
    window.removeEventListener('message', closeListener);
    try { if (!pdfWin.closed) pdfWin.close(); } catch (_) { /* ignore */ }
  }, 30000);
}
```

---

## Change 1 — Print Hub tab PDF buttons

The Print Hub already has `data-pdf-href` attributes wired to a click listener. Update that listener to call the shared helper instead of its own inline `window.open` block:

**Find** the existing click handler in the Print Hub section (introduced in `pdf-button-tab-closure-fix-instructions.md`):

```javascript
btn.addEventListener('click', (e) => {
  e.preventDefault();
  const href = btn.getAttribute('data-pdf-href');
  const pdfWin = window.open(href, 'pdfPrint' + Date.now());
  if (pdfWin) {
    const closeListener = (ev) => { ... };
    window.addEventListener('message', closeListener);
    setTimeout(() => { ... }, 30000);
  }
});
```

**Replace with:**

```javascript
btn.addEventListener('click', (e) => {
  e.preventDefault();
  openPdfTab(btn.getAttribute('data-pdf-href'));
});
```

The `data-pdf-href` attribute should still have `closeAfter=1` baked in (as before). The `openPdfTab` helper will not double-add it because it checks for `?` presence — but to keep it clean, you can strip `&closeAfter=1` from the `data-pdf-href` value and let the helper append it, keeping the attribute as just `?entry=<id>&print=1`.

---

## Change 2 — Verifications tab PDF buttons

The Verifications tab renders a `[PDF]` button (or link) that currently opens `href + '?entry=' + id + '&print=1'` directly as an anchor with `target="_blank"`.

**Find** the PDF action in the Verifications tab render loop. It will look like one of:

```html
<!-- anchor form -->
<a class="act-btn act-btn-pdf" href="' + esc(e.href) + '?entry=' + esc(e.id) + '&print=1" target="_blank">PDF</a>

<!-- button form -->
<button class="act-btn act-btn-pdf" data-pdf-href="' + esc(e.href) + '?entry=' + esc(e.id) + '&print=1">PDF</button>
```

**Change to** (same pattern as Print Hub — use `data-pdf-href`, no `target="_blank"`):

```html
<a class="act-btn act-btn-pdf" href="javascript:void(0)" data-pdf-href="' + esc(e.href) + '?entry=' + esc(e.id) + '&print=1">PDF</a>
```

Then wire the click listener after the Verifications tab's table is rendered (same place as any other delegated listener in that tab's render function):

```javascript
wrap.querySelectorAll('[data-pdf-href]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openPdfTab(btn.getAttribute('data-pdf-href'));
  });
});
```

> **Note:** If `querySelectorAll('[data-pdf-href]')` is already run once for the Print Hub tab, make sure to scope it to the correct container (e.g. `printHubWrap.querySelectorAll(...)` vs `verificationsWrap.querySelectorAll(...)`), or run it once globally after all tabs render if they share a single table container.

---

## Change 3 — Confirm `form-record.js` sends the postMessage

The `afterprint` handler in `public/lib/form-record.js` must already send `{ pdfReady: 1 }` when `closeAfter=1` is in the URL. Verify it reads:

```javascript
window.addEventListener('afterprint', () => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('closeAfter') === '1') {
      // Notify parent window (works whether opened with window.open or target="_blank")
      if (window.opener) window.opener.postMessage({ pdfReady: 1 }, location.origin);
      if (window.parent !== window) window.parent.postMessage({ pdfReady: 1 }, location.origin);
    }
    window.close();
  } catch (e) { /* ignore */ }
});
```

> **Important fix:** The original instruction only used `window.parent`. For tabs opened with `window.open()` (not iframes), the correct reference is `window.opener`. Add **both** to cover all cases. If `window.opener` exists (opened via `window.open`), use that; `window.parent` covers iframe embeds. This is the key fix that makes the postMessage actually reach the right window.

---

## Change 4 — `pdf-cover.js` (if used)

If `public/lib/pdf-cover.js` is also involved in generating the PDF view (for records that use a cover-page route), ensure it also sends to `window.opener`:

**Find:**
```javascript
try {
  if (window.parent !== window) window.parent.postMessage({ pdfReady: 1 }, location.origin);
} catch (e) { /* ignore */ }
```

**Replace with:**
```javascript
try {
  const target = window.opener || (window.parent !== window ? window.parent : null);
  if (target) target.postMessage({ pdfReady: 1 }, location.origin);
} catch (e) { /* ignore */ }
```

---

## Behaviour after this change

| Action | Result |
|---|---|
| Click **PDF** in Print Hub | New tab opens → print dialog fires → tab closes automatically after dismiss |
| Click **PDF** in Verifications tab | Identical — new tab opens → print dialog fires → tab closes automatically |
| Popup blocked | Tab does not open; user sees nothing (existing behaviour — no regression) |
| User closes tab manually before printing | No error; fallback timer clears gracefully |
| User takes > 30 s to print | Fallback timer closes the tab |

---

## Files to edit

| File | Change |
|---|---|
| `public/pages/submissions-log.html` | Add `openPdfTab()` helper; update Print Hub listener; update Verifications tab PDF button attributes and listener |
| `public/lib/form-record.js` | Add `window.opener` alongside `window.parent` in the afterprint handler |
| `public/lib/pdf-cover.js` | Use `window.opener || window.parent` for postMessage target |

---

## Testing checklist

- [ ] Print Hub → PDF button → tab opens, print dialog shows, tab closes after dismiss
- [ ] Verifications tab → PDF button → identical behaviour
- [ ] Both tabs: closing the print dialog without printing → tab still closes
- [ ] Popup blocked in browser settings → no JS error, graceful no-op
- [ ] `form-record.js` afterprint: tab opened from `window.open()` → `window.opener` receives message ✓
- [ ] Tab opened as iframe (if applicable) → `window.parent` receives message ✓
- [ ] Version bump: bump `form-record.js` query-string version in HTML (`?v=N+1`), same for `pdf-cover.js`
