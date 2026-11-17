# Fix: Standardise sign-off date format in `form-record.js`

## Problem

In `public/lib/form-record.js`, the **Completed by** date and the **Verified by** date in the printed sign-off table are formatted differently:

| Row | Current code | Output |
|-----|-------------|--------|
| Completed by — Date | `window.DocHeader.fmtDate(cb.date)` | "17 Nov 2026" ✓ |
| Verified by — Date | `esc(sub.verification.verifiedDate)` | "2026-11-17" ✗ |

The verified-by date is printed as the raw ISO string stored by the HTML `type="date"` input. It should use the same formatted display as the completed-by date.

---

## Fix — one change in `sheetSignHtml`

**File:** `public/lib/form-record.js`  
**Function:** `sheetSignHtml` (around line 4787)

### Find (exact line):
```js
            <td class="fr-sheet-lbl">Date:</td><td>${esc(sub.verification ? sub.verification.verifiedDate : '')}</td>
```

### Replace with:
```js
            <td class="fr-sheet-lbl">Date:</td><td>${esc(sub.verification && sub.verification.verifiedDate ? window.DocHeader.fmtDate(sub.verification.verifiedDate) : '')}</td>
```

`window.DocHeader.fmtDate` accepts an ISO date string (same as it does on line 4772 for `cb.date`) and returns a formatted string like "17 Nov 2026".

---

## After the change

1. Bump the `?v=N` cache-buster in every HTML file that loads `form-record.js`:
   ```bash
   grep -rl "form-record.js" public/records/
   ```
   Increment the version number in each file found.

2. Commit and push to `main`. Render will auto-deploy within ~30–60 s.

---

## No record-def or DB changes needed

This is a pure JS display fix — no JSON export, no Neon changes.
