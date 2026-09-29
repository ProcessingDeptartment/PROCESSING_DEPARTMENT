# Replace the Left Sidebar with a Top-Right Hamburger Dropdown — Every Record, All UI

**Date:** 2026-09-29
**Raised by:** Michaela — "all UI, every record. When open, the menu tab on the left should minimise to a 3-line button in the top right corner and open as a drop-down menu on the right."
**Type:** Navigation shell change only. **No change** to fields, validation, calculations, DB calls, CSV/print output.
**Supersedes:** the "persistent left sidebar (200px) → bottom tab bar below ~800px" rule in `claude/layout-redesign-instructions.md` §3, and sidebar item G (contrast) in `claude/record-page-field-alignment-fix-instructions.md`. Everything else in those two docs still stands (tokens, 4/2/1 column system, Trend removal, etc.).
**Use in:** Claude Code (build) — or Claude Design (mock the two states first, see §8).

---

## 1. What the user sees

| State | Behaviour |
|---|---|
| **Page loads / record opened** | No left sidebar. Content spans the full width. A **3-line (hamburger) button** sits at the far right of the navy top bar. |
| **Tap hamburger** | A **dropdown panel drops down from the top-right**, directly under the button, right-aligned to the screen edge. The rest of the page dims slightly behind it. The 3 lines change to an **✕**. |
| **Tap a menu item** | Navigates as today; panel closes. |
| **Tap ✕, tap the dim area, press Esc, or scroll-lock release** | Panel closes, focus returns to the button. |

"Minimise" = the whole menu collapses into that one button. The menu is **closed by default on every page load** (do not remember an open state).

---

## 2. Scope — "all UI, every record"

Apply the same top bar + hamburger + dropdown to **every page that currently shows the left sidebar or a category navigation**:

1. **All ~131 Record List record pages** (every page containing `.rt-shell` / `.rt-sidebar`), including monitoring logs, form records, NRCS packs, REC 7.2.12 (custom body), Mortalities Log, Quick Abalone Receiving.
2. **All other app pages** (Home/Dashboard, Trends, Record List index, Job Status, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, Canning/Drying reports).

**Important — this widens the 2026-09-09 scope.** Those earlier docs said the out-of-scope pages must stay pixel-identical. Michaela's "all UI" overrides that **for navigation only**. Therefore on the non-record pages:

- Change **only the navigation control** (their current header nav/links → same hamburger + dropdown). Do **not** restyle their tables, tiles, filters, report layouts or print views.
- If one of those pages has no sidebar today and only a header link row (e.g. "← Job status"), keep that link where it is and **add** the hamburger at the far right; do not remove page-specific action buttons.
- Roll out in two waves (§9) so the record pages are reviewed before the rest.

---

## 3. One shared component (build once, reuse everywhere)

Create a single shared nav component — do **not** paste the markup into 130+ pages.

- **One source for the menu items** (a single JS/JSON list or the existing sidebar builder). The hamburger dropdown and any remaining consumer read from it, so adding a menu item later is a one-line change.
- **One shared stylesheet** for the top bar + button + panel (extend `record-theme.css`, all rules under `.rt-shell` / `.rt-topbar` so nothing leaks). For the non-record pages that don't load `record-theme.css`, load a small `nav-menu.css` containing **only** the top-bar-button + dropdown rules, scoped to `.nm-*` classes.
- **One shared script** (`nav-menu.js`) that injects the button, builds the panel from the item list, and handles open/close/keyboard. Pages just include the script; the engine files (`monitoring-log.js`, `form-record.js`) are not touched beyond removing the sidebar mount.
- Delete/hide the old sidebar markup and its CSS **only after** confirming (ask Michaela) that nothing else uses `.rt-sidebar` (e.g. `job-status.html` also loads `record-theme.css`).

---

## 4. Top bar

- Navy `#1B2330`, same doc identity as today on the left: doc code · title · Rev · rev date.
- Right side, left to right: existing action buttons (Refresh / CSV / Print / "← Job status" — whatever the page already has), then the **hamburger as the rightmost item**, always in the same spot on every page.
- Top bar stays visible while scrolling (`position: sticky; top: 0`) so the menu is always one tap away.
- Hamburger button: **48×48px** (tap target ≥44px), 3 white lines 22px wide × 2px, 5px gap, rounded 8px hit area, subtle `rgba(255,255,255,.08)` hover/pressed fill, gold `#A9763A` focus ring. Accessible name **"Menu"**; `aria-expanded` true/false; `aria-controls` points at the panel.
- Hide the hamburger and dropdown in **print** (`@media print`) and in CSV/print sheets. Print output must be unchanged.

---

## 5. Dropdown panel

- **Anchored top-right**: opens directly below the hamburger, right edge aligned to the screen edge (with 8px gap), sliding/fading down ~150ms. Respect `prefers-reduced-motion` (no animation).
- **Width**: 320px on PC/tablet; on phones (<560px) full width minus 16px margins. **Max height** `100vh – top bar – 16px`, scrolls internally if the list is longer.
- **Look**: background `#1D2B38` (same as old sidebar), 12px rounded bottom corners, soft shadow. Items are full-width rows, **min 48px tall**, 16px text, left icon (if the old sidebar had icons keep them) + label. Text colour **`#E6EBEF`** (never the old `#5C6771` — contrast ≥ 4.5:1 required). Hover/pressed: `#26384A`. **Current page** row: gold `#A9763A` left bar + white bold text.
- **Contents**: exactly the same items, same order, same links as the old left sidebar (the 8 categories). Add nothing and remove nothing. If the old sidebar had a user/role label or Log out control, keep it at the bottom of the panel, separated by a divider.
- **Dim layer**: full-screen scrim `rgba(0,0,0,.35)` under the panel and over the page. Tap closes.
- **Sub-items**: if any category expands to a sub-list today, use an inline accordion inside the panel (tap row to expand, one open at a time). Do not open a second flyout.

---

## 6. Behaviour rules

1. Closed by default on every load; opening does not change the URL and does not reload or move page content (no layout shift, form scroll position preserved).
2. **Never lose entered data**: opening/closing the menu must not clear, blur-validate, or submit the form. Tapping a menu link while a form has unsaved input shows the app's **existing** unsaved-changes behaviour if it has one; if it has none, do not add one — just navigate as the old sidebar did.
3. Keyboard: Enter/Space toggles; Esc closes; Tab cycles within the panel while open (focus trap); focus returns to the button on close. Arrow Up/Down move between items.
4. While open, lock body scroll (page behind must not move); unlock on close.
5. Close automatically on navigation, on window resize across a breakpoint, and on browser Back.
6. Works identically with touch (tablet on the floor), mouse (PC) and keyboard. No hover-only behaviour.
7. Same button position and behaviour at every width. **No bottom tab bar, no left sidebar at any width** — remove the ≤800px bottom-tab-bar rule.

---

## 7. Layout consequences (check, don't redesign)

- With the 200px sidebar gone, the content area is 200px wider. The 4 / 2 / 1 form-grid and 8 / 4 / 1 roster-grid rules from the alignment doc stay exactly as written; breakpoints are still based on content width, so verify each page lands in the intended column count (e.g. a 1280px screen is now ≥1100px content → 4 columns).
- Remove any left padding/margin reserved for the sidebar (`margin-left:200px`, grid `200px 1fr` shell, etc.). Content should have even left/right gutters (16px phone, 24px tablet/PC).
- Sticky top bar height must be accounted for in any `scroll-margin` / sticky sub-toolbars (e.g. REC 7.2.12 stage tabs) so nothing hides under it.
- PC mode (`body.rt-pc`): same hamburger; only the density (36px inputs) differs.

---

## 8. If you mock it first in Claude Design

Ask for **two frames** of one record page (Mortalities Log) at 1280px and 768px, and one at 390px:

1. Menu closed — full-width content, hamburger top-right in navy bar.
2. Menu open — dropdown top-right, dimmed page behind, ✕ in place of the hamburger, current item highlighted.

Use the tokens in `claude/layout-redesign-instructions.md` §3. Approve the mock before Claude Code builds.

---

## 9. Build order (Claude Code)

1. Branch `feat/hamburger-menu`. Screenshot before-state of: Mortalities Log, REC 7.2.12, REC 7.1.3, one NRCS pack page, Home, Record List index, Job Status, Batch Traceability, at 1280 / 1024 / 768 / 390px. Save to `Claude outputs/menu-before/`.
2. Locate where the sidebar is built/mounted (search `.rt-sidebar`, `.rt-shell`, the 8-category list). Report the file list and how many pages load it — **before changing anything**.
3. Build the shared component (`nav-menu.js` + styles) reading the existing item list. Test on a throwaway page.
4. **Wave 1 — record pages:** switch the shell (`rt-shell`) so it renders the top bar + hamburger instead of the sidebar. Because the shell is shared this should change all records at once. Show Michaela Mortalities Log + REC 7.2.12 + REC 7.1.3 open/closed at 1280 and 768. **Stop for review.**
5. **Wave 2 — all other pages:** add the same hamburger to Home, Trends, Record List index, Job Status, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, Canning/Drying reports (navigation only — §2).
6. Remove the dead sidebar CSS/markup/bottom-tab-bar rules (after §3 check).
7. Run acceptance checks (§10) on all 131 Record List pages + every other page.
8. Print-preview 3 records and 2 reports: must match the pre-change PDFs.
9. Write `claude/hamburger-menu-worklog.md`: pages changed, pages that needed exceptions, before/after screenshots.

---

## 10. Acceptance checks

**Visual (Michaela signs off):**
- [ ] No left sidebar and no bottom tab bar on any page at any width.
- [ ] Hamburger visible top-right, same position on every page, ≥44px.
- [ ] Tap → dropdown opens under it on the right; page dims; icon becomes ✕.
- [ ] Menu items identical to the old sidebar, same order, all readable, current page highlighted.
- [ ] Closes on ✕, outside tap, Esc, and after choosing an item.
- [ ] Form content and scroll position unchanged by opening/closing; nothing typed is lost.
- [ ] Content uses the freed width; alignment checks from the alignment doc still return `[]`.
- [ ] Nothing hides under the sticky top bar (REC 7.2.12 tabs, anchors).
- [ ] Print and CSV output unchanged; menu absent from print.

**Automated (Playwright, all pages, 1280 / 1024 / 768 / 390):**
- `.rt-sidebar` count = 0; hamburger exists exactly once; `aria-expanded` toggles; panel bounding box right edge ≤ viewport width and does not overflow; no horizontal page scroll; tab order enters and leaves the panel correctly.
- Put a pass/fail table in the work log.

---

## 11. Do NOT change

No field, validation, calculation, DB call, `values` key, export column, print sheet or `@media print` output. On non-record pages, no table/tile/filter/report restyling — navigation control only. Do not delete `double-seam-trend.html` or any existing page. Do not add menu items.

---

## 12. Paste-ready prompt for Claude Code

> Read `claude/hamburger-dropdown-menu-instructions.md` and follow it exactly. Replace the left sidebar (and the ≤800px bottom tab bar) on every record page with a 48px hamburger button at the far right of the sticky navy top bar that opens a dropdown panel from the top right (320px wide, dimmed page behind, ✕ to close, Esc/outside-tap closes, keyboard + focus trap, closed on every load). Menu items must be exactly the existing sidebar items in the same order with readable contrast. Build it once as a shared component (`nav-menu.js` + scoped styles) and roll it out in two waves: record pages first (stop and show me Mortalities Log, REC 7.2.12 and REC 7.1.3 open/closed at 1280 and 768), then the navigation control only on all other pages. Do not change any field, validation, calculation, DB call, export or print output, and do not restyle non-record pages beyond their nav control. Take before screenshots first, confirm what else uses `.rt-sidebar` before deleting it, and finish with the §10 checks and a work log at `claude/hamburger-menu-worklog.md`.
