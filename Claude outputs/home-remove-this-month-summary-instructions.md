# Home Page — Remove the "Production — this month" Summary

**Date:** 2026-10-01
**Raised by:** Michaela — "when opening the index page, at the top there is a summary of what is happening this month — remove that."
**Type:** Removal only. **No change** to data, database calls, record pages, CSV/print, or any other page.
**Use in:** Claude Code (build).

---

## 1. What to remove

On `public/index.html` (Home), the block at the very top headed **"Production — this month"**. It contains:

- the heading and the **month selector** (shows "Loading…" while it fetches)
- the monthly metrics area, including the note "Reported monthly but not captured in any record yet" and its items (dry room occupancy, labour / overtime / absenteeism, rework batch flagging)
- any KPI tiles, "Harvest by stream" figures or delta badges that sit inside this block and are fed by the month selector

When the page opens, the first thing the user sees should be the **Categories** table (and the normal page header / navigation above it).

## 2. How to do it

1. Open `public/index.html` and find the section by its heading text "Production — this month". Remove the whole wrapping container (heading, selector, tiles, notes), not just the visible text.
2. Remove the JS that only serves that block: the month-selector change handler, the month data load, and the render function(s) for the tiles and metrics. Search for the selector's id and any render function names to make sure nothing is left calling a missing element.
3. Remove CSS used only by that block. Do **not** delete shared styles (tiles, badges) if any other page uses them. Check with a search first, e.g. `public/pages/canning-report.html` reuses the dashboard KPI tile pattern.
4. Do **not** delete any shared library function (for example in `data-store.js` or `api-backend.js`) that other pages use. Only remove code that becomes unused inside `index.html`.
5. Leave the Categories table and everything below it exactly as it is.

## 3. What must NOT change

- `pages/dashboard.html` and the **Trends** page. This is the home of all trend and month views.
- Record List, Job Status, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, canning and drying reports.
- Any database table, API route or stored data. This is a display removal only, and no data is deleted.
- If the home page's top-bar / hamburger navigation exists (see `claude/hamburger-dropdown-menu-instructions.md`), leave it as it is.

## 4. Checks before finishing

- [ ] Home loads with no "Production — this month" heading, no month selector, no "Loading…" text.
- [ ] The Categories table is the first content block and all 12 links still work.
- [ ] Browser console shows **no errors** on Home (no "cannot read property of null" from removed elements).
- [ ] Network tab: Home no longer fires the monthly summary requests, or at least nothing breaks if it still does.
- [ ] Dashboard → Trends still loads and shows data (regression check).
- [ ] Home looks right at tablet width and on a PC (no leftover empty gap or margin at the top).
- [ ] Hard refresh (Ctrl+F5) and re-test, since Render serves static files with caching.

## 5. Open item (only if Michaela wants it)

The removed block mentioned three monthly metrics "not captured in any record yet" (dry room occupancy, labour / overtime / absenteeism, rework batch flags). Removing the block does not capture them anywhere. If they are still wanted, they need a new record type and are a separate task. Do not build anything for this now.
