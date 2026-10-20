# PDF Button Tab Closure Fix — Print Hub

**Issue:** When clicking the PDF button in the Print Hub (Submissions & Verifications Log), a new tab opens to generate the PDF. After the PDF is ready and the print dialog completes, the tab remains open and does not close automatically.

**Root Cause:** 
1. The PDF button in `submissions-log.html` opens with `target="_blank"` → creates a new tab
2. The new tab loads `print-entry.html?entry=<id>&print=1&printonly=1`
3. `form-record.js` listens for the `afterprint` event and calls `window.close()` (line 14)
4. **Problem:** The `afterprint` event fires in the child/popup window, but the mechanism does not properly close it when opened from the parent page with `target="_blank"`

**Solution:**
Use a communication mechanism between the parent tab and the PDF tab. When the PDF is ready and printed, the child tab sends a message to the parent to close itself. This is more reliable than relying on `window.close()` alone.

---

## Changes Required

### 1. Update `public/pages/submissions-log.html`

**Change the PDF button at line 846 from:**
```html
<a class="act-btn act-btn-pdf" href="' + esc(e.href) + '?entry=' + esc(e.id) + '&print=1" target="_blank">PDF</a>
```

**To:**
```html
<a class="act-btn act-btn-pdf" href="javascript:void(0)" data-pdf-href="' + esc(e.href) + '?entry=' + esc(e.id) + '&print=1&closeAfter=1">PDF</a>
```

**Add event listener in the script section (after line 857, before the closing `</tbody></table>`):**

Add this code to handle the PDF button clicks and manage the window:

```javascript
// PDF button handling with auto-close
wrap.querySelectorAll('[data-pdf-href]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const href = btn.getAttribute('data-pdf-href');
    const pdfWin = window.open(href, 'pdfPrint' + Date.now());
    
    if (pdfWin) {
      // Listen for a message from the PDF window when it's ready to close
      const closeListener = (ev) => {
        try {
          if (ev.source === pdfWin && ev.data && ev.data.pdfReady === 1) {
            window.removeEventListener('message', closeListener);
            setTimeout(() => { if (!pdfWin.closed) pdfWin.close(); }, 500);
          }
        } catch (e) { /* ignore cross-origin issues */ }
      };
      window.addEventListener('message', closeListener);
      
      // Fallback: auto-close if no message after 30 seconds (user printed already)
      setTimeout(() => {
        window.removeEventListener('message', closeListener);
        try { if (!pdfWin.closed) pdfWin.close(); } catch (e) { /* ignore */ }
      }, 30000);
    }
  });
});
```

### 2. Update `public/lib/pdf-cover.js`

**At line 66, update the message send to include the `closeAfter` parameter:**

Change from:
```javascript
try { if (window.parent !== window) window.parent.postMessage({ pdfReady: 1 }, location.origin); } catch (e) { /* ignore */ }
```

To:
```javascript
try {
  const q = new URLSearchParams(location.search);
  if (q.get('closeAfter') === '1' && window.parent !== window) {
    window.parent.postMessage({ pdfReady: 1 }, location.origin);
  } else if (window.parent !== window) {
    window.parent.postMessage({ pdfReady: 1 }, location.origin);
  }
} catch (e) { /* ignore */ }
```

### 3. Update `public/lib/form-record.js`

**At line 14, enhance the afterprint handler to also send a message to parent:**

Change from:
```javascript
window.addEventListener('afterprint', () => { try { window.close(); } catch (e) { /* ignore */ } });
```

To:
```javascript
window.addEventListener('afterprint', () => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('closeAfter') === '1' && window.parent !== window) {
      window.parent.postMessage({ pdfReady: 1 }, location.origin);
    }
    window.close();
  } catch (e) { /* ignore */ }
});
```

---

## How It Works

1. **User clicks PDF button** → Opens new tab with `closeAfter=1` parameter
2. **PDF tab loads** → Calls `form-record.js` which renders the record
3. **User prints/closes dialog** → `afterprint` event fires
4. **PDF tab sends message** → Posts `{ pdfReady: 1 }` to parent window
5. **Parent receives message** → Detects it came from the PDF window and closes it
6. **Fallback:** If no message received in 30 seconds (user printed), parent auto-closes the tab

---

## Testing

1. Navigate to Submissions & Verifications Log
2. Go to **Print Hub** tab
3. Filter for verified entries
4. Click the **PDF** button on any entry
5. A new tab should open and immediately trigger the print dialog
6. After printing/closing the dialog, the tab should **automatically close** within 1 second
7. Return to the original tab (should not have changed)

---

## Notes

- The solution uses `postMessage()` for secure cross-window communication
- The PDF window is opened with a unique name (`pdfPrint + timestamp`) to avoid reusing tabs
- A 30-second fallback ensures the tab closes even if something goes wrong
- The `closeAfter=1` parameter ensures only the Print Hub's PDF buttons trigger auto-close behavior
- Other PDF views (direct record links) are unaffected
- The fix gracefully handles blocked popups by simply not closing (user must do it manually, which is already the current behavior)

