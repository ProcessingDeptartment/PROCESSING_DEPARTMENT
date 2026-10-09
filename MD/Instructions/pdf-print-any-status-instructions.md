# PDF Print — Any Status (Submissions & Verifications Logs)

**Date:** 2026-10-09  
**Files changed:** `public/lib/monitoring-log.js`

---

## What changed

The submissions and verifications logs now show a **PDF button on every row, regardless of entry status** (draft, submitted, or verified). Previously:

| View | Before | After |
|---|---|---|
| Job list — job with only drafts | No PDF button | ✓ PDF button on the job row |
| Expanded stages — submitted stage | No PDF button | ✓ PDF button alongside View / JSON |
| Expanded stages — draft stage | No PDF button | ✓ PDF button alongside Edit |
| Entry-level table (`renderTable`) | PDF on all rows ✓ | Unchanged |
| `form-record.js` submissions log | PDF on all rows ✓ | Unchanged |

---

## Why

Operators need to be able to print the paper form at any point in the workflow — including from a draft that is still being filled in or from a submitted record awaiting verification. Blocking the PDF button by status prevented this.

---

## How it works

`monitoring-log.js` builds the job list and expanded stage rows in HTML strings.  
Three places were missing a `data-pdf` button:

1. **Job row (draft-only job)** — `else` branch of `if (last)` in the job table builder  
2. **Submitted stage in expanded sub-table** — `subs.forEach()` loop  
3. **Draft stage in expanded sub-table** — `drafts.forEach()` loop  

All three now emit:
```html
<button class="ml-btn ml-btn-flat ml-btn-sm" data-pdf="${e.id}" title="Print…">PDF</button>
```

The existing `tableWrap.querySelectorAll('[data-pdf]')` event-binding already wires every `data-pdf` button to `printEntry()`, so no JS logic needed to change — just the HTML templates.

`printEntry()` itself has no status gate; it renders and prints whatever entry ID it receives.

---

## No version bump needed

`monitoring-log.js` is loaded by the record HTML pages with a `?v=N` cache-bust.  
Check which HTML files reference it before deploying:

```bash
grep -rl "monitoring-log.js" public/records/
```

If any HTML file caches the old version, bump its `?v=N` for `monitoring-log.js`.
