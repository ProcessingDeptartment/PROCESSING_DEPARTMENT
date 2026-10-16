# REC 7.4.2 Dry Monitoring — Colour Fixes

**Date:** 16 October 2026 · Michaela (Abagold)  
**Scope:** `dry-monitoring` record (REC 7.4.2) only.  
**Two fixes:** (1) Warning/Amber status colour → yellow. (2) PDF print — batch status block colours render correctly instead of all red.

---

## Fix 1 — Warning colour is yellow, not amber

Anywhere the batch status `Amber` or score label `Warning` is shown with a colour, use **yellow**, not amber/orange.

### Colour tokens to use

| Status | Screen colour | Print colour | CSS hex |
|--------|--------------|--------------|---------|
| Green | `#16a34a` background / `#fff` text | same | — |
| Amber (Warning) | `#eab308` background / `#000` text | `#eab308` | yellow-500 |
| Red | `#dc2626` background / `#fff` text | `#dc2626` | — |
| Critical | `#991b1b` background / `#fff` text | `#991b1b` | — |

`#eab308` is a saturated yellow that prints clearly and does not read as orange.

### Where to apply

Every place the score or status drives a colour:

1. **Score buttons** — the selected score button on the form:
   - Score 0 selected → neutral / green tint
   - Score 1 selected → `#eab308` background (yellow), black text
   - Score 2 or 3 selected → `#dc2626` background (red), white text

2. **Batch status badge** on the form (large label after the 10 signs):
   - `Green` → green badge
   - `Amber` → yellow badge (`#eab308`)
   - `Red` → red badge
   - `Critical` → dark red badge

3. **Action pop-up** status badge at the top of the modal:
   - Same mapping — Amber = yellow.

4. **Submitted entry view** — the batch status shown on the saved/printed entry:
   - Same mapping.

5. **NC log row** — if the dry monitoring NC log colours the severity by batch status:
   - Amber row highlight → `#fefce8` (light yellow background), not amber.

6. **Row highlighting in any list or log**:
   - Amber/Warning → `#fefce8` (very light yellow) full row background.
   - Do NOT use `#fffbeb` (that is amber-tinted). Use the yellow-50 equivalent.

---

## Fix 2 — PDF print: block colours render as actual colours

### Problem

When the user prints the dry monitoring entry sheet to PDF, all coloured status blocks print as red (or a single flat colour) regardless of the actual status. This is caused by browsers suppressing background colours in print mode by default.

### Fix — CSS print-color-adjust

Add the following to the print stylesheet for the dry monitoring page (and any other record that uses coloured status blocks):

```css
@media print {
  /* Force browsers to print background colours exactly as shown on screen */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
}
```

Place this in the `<style>` block that already contains `@media print` rules for the 7.4.2 page. If there is no existing print stylesheet block, add it inside `<style>` in the `<head>` of the page.

### Also ensure each status class carries an explicit background-color

The coloured elements must have their background colour set as a plain CSS `background-color` (not via a CSS `filter`, `opacity` trick, or JS-injected `style`). Example:

```css
.status-badge.green    { background-color: #16a34a; color: #fff; }
.status-badge.amber    { background-color: #eab308; color: #000; }
.status-badge.red      { background-color: #dc2626; color: #fff; }
.status-badge.critical { background-color: #991b1b; color: #fff; }

.score-btn.selected-1  { background-color: #eab308; color: #000; }
.score-btn.selected-2,
.score-btn.selected-3  { background-color: #dc2626; color: #fff; }
```

If the colours are applied via Tailwind utility classes (e.g. `bg-yellow-500`), add `print-color-adjust: exact` to the element directly:

```html
<span class="bg-yellow-500 text-black ..." style="-webkit-print-color-adjust:exact; print-color-adjust:exact;">
  Amber
</span>
```

Or, more cleanly, add a single rule in the print block:

```css
@media print {
  [class*="bg-"] {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
```

### Test

1. Open a submitted dry monitoring entry with status Amber.
2. Print → Save as PDF (Chrome or Edge).
3. The batch status badge must print yellow.
4. Open a submitted entry with status Red.
5. Print → Save as PDF.
6. The badge must print red.
7. Open a submitted entry with status Green.
8. Print → Save as PDF.
9. The badge must print green.
10. Score buttons in the print layout must also show correct colour per score value.

---

## Files to change

| File | What changes |
|------|-------------|
| `public/pages/rec-7.4.2.html` or equivalent | Add `print-color-adjust` CSS in `@media print` block |
| `public/css/record-form.css` or equivalent | Update status badge and score button colour classes to use the hex values above |
| `public/js/form-record.js` | If status colour is applied by JS class name, update class list to match new `.amber` = yellow |
| Any shared print stylesheet | Add `print-color-adjust: exact` |

No database changes. No record definition changes. CSS and JS only.

---

## Summary of colour rules (canonical)

```
worstScore 0 → Green  → #16a34a bg, white text
worstScore 1 → Amber  → #eab308 bg, BLACK text  ← yellow, not orange
worstScore 2 → Red    → #dc2626 bg, white text
worstScore 3 → Critical → #991b1b bg, white text

Print: add print-color-adjust: exact to force these colours into PDF
```
