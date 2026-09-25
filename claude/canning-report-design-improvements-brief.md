# Canning Report — Improvement Brief for Claude Design

**Purpose:** Michaela is running this through Claude Design next, to improve both the printed/PDF
report layout and the on-screen (view) layout of the Canning Report — alongside the data
additions already suggested in `claude/canning-report-data-improvement-suggestions.md`. This doc
consolidates both into one brief a design pass can work from directly.

## ⚠️ Confirmed scope limit (2026-09-11): PC/desktop layout only, no tablet redesign

**This report keeps its current desktop page structure.** No sidebar, no bottom tab bar, no
tablet/touch-target sizing, no collapse-to-mobile breakpoint. The tablet redesign
(`claude/layout-redesign-instructions.md`) applies only to record-*entry* pages and was never
meant to extend here — Michaela has now explicitly confirmed that. Whatever comes out of this
design pass should still look and behave like a normal wide desktop page: multi-column tables,
mouse-hover states are fine to use, no need to design for a narrow viewport or touch input.

What "improve the layout" means for this doc is refining the *visual hierarchy, grouping, and
print treatment* of the existing desktop page — not restructuring it into the app's tablet shell.
Reuse the shared color/type tokens (Section 3 of `claude/layout-redesign-instructions.md`) for
visual consistency with the rest of the app, but do not bring in the sidebar/topbar shell, the
44px tap-target sizing rules, or the responsive collapse behavior that spec defines for record
pages — none of that applies here.

**Use alongside, not instead of:**
- `claude/canning-report-layout-spec.md` — the exact field/section list from CPR02170 that the
  report must contain (functional completeness)
- `claude/canning-report-data-improvement-suggestions.md` — the new data points suggested (SYSPRO
  Yield/Deviation, Canning Efficiency, damaged cans, comments, stock code reference table)
- `claude/layout-redesign-instructions.md` — **tokens only** (colors, fonts), per the scope limit
  above. Do not pull in its sidebar/shell/responsive rules.

---

## 0. What the live page actually looks like today (verified 2026-09-11)

Viewed live at `processing-department.onrender.com/pages/canning-report.html` (could not load an
actual job's data — this session's device isn't authorised with the facility's records-database
access key, separate from the site login password, so the job dropdown stayed empty; the
structural/toolbar layout below is confirmed directly, the populated-report content below that is
based on the page source and the CPR02170 reference spreadsheet, not a live screenshot).

Confirmed on screen:
- Dark navy top bar: "PRODUCTION" doc-code + "Canning Report" title on the left, a "← Job status"
  button on the right.
- Below that, a loose, uncontained toolbar: "Job no." label + dropdown, then a "Refresh" button,
  then (wrapping to a second line at this viewport width) "Export CSV" and "Print / PDF" buttons,
  floating directly on the page background with no card/panel boundary around them.
- A separate "Loading…" status line sits under the toolbar with no visual grouping to the controls
  above it.
- Below that, a second, separate white panel just says "Pick a job number." — this is where the
  actual report content renders once a job is selected.
- No breadcrumb or persistent job identifier once scrolled past the top — if the report content
  grows long (as it will once the new sections are added), there's currently nothing reminding the
  viewer which job they're looking at without scrolling back up.

This confirms and sharpens two points already in this brief (Section 2): the page reads as
several unrelated floating elements rather than one coherent document, and there's no visual
container tying the toolbar together. Added as a concrete new point below (Section 2, first
bullet) since it's visible even before any job data loads.

---

## 1. What's wrong with the current view/print layout today

`public/pages/canning-report.html` is functional but visually flat: plain bordered tables stacked
top to bottom, minimal visual hierarchy between "the one number you care about" (actual yield,
actual cans) and supporting detail (harvest breakdown, can-level detail). Print output is the same
HTML with a few `@media print` rules (hide toolbar, white background) — it isn't designed as a
print document, it's a webpage that happens to still be legible when printed.

Two different documents want two different treatments, both still desktop-only:
- **On-screen (view) layout**: can use interactive affordances — collapsible sections, sortable
  tables, hover states, color-coded status. Normal mouse/desktop interaction, not touch.
- **Print/PDF layout**: needs to be a clean, scannable document — clear section breaks, no
  wasted whitespace, works on A4, doesn't rely on hover or color alone to convey status (some
  people print in black & white).

## 2. Suggested view-layout improvements (screen, desktop only)

- **Contain the toolbar in its own card, and stop it wrapping loosely.** Confirmed live (Section
  0): Job no. / Refresh / Export CSV / Print currently float directly on the page background and
  wrap onto a second row at normal desktop widths with no visual grouping. Put the whole toolbar
  row in one bordered/card panel with consistent button alignment (e.g. selector + Refresh on the
  left, Export/Print grouped on the right, same row, no wrap until well below typical desktop
  width). This is a real, visible issue today, not just a hypothetical.
- **Add a persistent job identifier once a report is loaded** — e.g. the selected job number and
  "Processed for" pinned near the top (or in a light sticky sub-header) so it's still visible after
  scrolling into a long report, especially once the new stock-code Can Breakdown table adds
  significant page length.
- **Lead with the summary.** Right now Report Summary is a small table partway down. Promote
  Actual Yield, Actual Cans, and (once added) SYSPRO Deviation into 3–4 stat cards/tiles at the
  very top, same visual language as the dashboard's KPI tiles (`public/index.html` already has
  this pattern — reuse it rather than inventing a new one). Target vs actual shown as a small
  delta badge (green if on/above target, red/amber if below), same convention the dashboard
  already uses.
- **Group job details and processing measures into a compact two-column header card** instead of
  stacked full-width tables — Job Details (Processed for, GRN, PO, Cost/kg, Delivery note) on the
  left, Report Summary stats on the right, so the top of the page reads as "one card, everything
  you need to identify this job" rather than three separate tables. This is still a fixed
  desktop-width layout, not a responsive grid that needs to reflow to a single column on small
  screens.
- **Collapsible detail tables.** Can Summary, Harvest Breakdown, and the stock-code-level Can
  Breakdown table are all useful but secondary to the summary. On screen, consider making these
  collapsible/expandable (open by default is fine) so the page doesn't read as one long wall of
  tables — matches the "Entries" collapsible pattern already used on record pages (visual pattern
  only — no need to match its tablet sizing).
  Print output should always render them expanded regardless of screen state.
- **Visual separation between "Can Summary" (by production/AG code) and "Can Breakdown" (by stock
  code)** — these are easy to confuse since they're both about cans. Give them distinct headers,
  maybe a subtitle clarifying the grouping ("by production code" / "by stock code"), and enough
  vertical space between them that they don't read as one continuous table.
- **Comments, once added**, should sit near the top summary (it's context for interpreting the
  numbers), not buried at the bottom.
- **Status color coding**: once SYSPRO Deviation and Canning Efficiency exist, use the shared
  token colors consistently — green (`#15803D`) for on/above target, gold or amber for a
  cautionary deviation range, and reserve a clear red only for a hard miss — matching how the
  dashboard tiles already signal status.

## 3. Suggested print/PDF-specific improvements

- **Design a real print stylesheet, not a "hide the toolbar" one.** Set explicit page size (A4),
  margins, and page-break rules: `break-inside: avoid` on every table row (already present, keep
  it) plus explicit `break-before` on each major section so a section header never lands as the
  last line on a page with its table starting on the next.
- **A proper print header/footer**: job number, "Canning Report" title, and generation
  date/time repeated at the top of every printed page (not just page 1) if the report can run to
  multiple pages once the new stock-code Can Breakdown table is added — that table can have many
  rows. Consider a running footer with page number ("Page 2 of 3") for anyone handing around a
  printed copy.
- **Don't rely on color alone for status in print.** Add a text/icon indicator alongside any
  color-coded deviation or efficiency flag (e.g. "▲ above target" / "▼ below target") so it still
  reads correctly on a black & white printer or scanned copy.
- **Collapsed sections must force-expand for print** — verify the `@media print` rules explicitly
  override any `display:none`/collapsed state from the on-screen collapsible treatment above.
- **Consider a condensed print variant vs. full print variant** if the report grows with all the
  new sections (Job Details, Report Summary, Can Summary, Harvest Breakdown, Processing
  Measures/Efficiency Indicators, Can Breakdown) — a "Summary only" print option (top stat cards +
  key tables) alongside the existing full print, for cases where someone just needs the yield
  number on paper, not the full stock-code breakdown.

## 4. Data additions to design around (from the separate data-improvement doc)

Design should leave room for these fields even before they're wired to real data, so the layout
doesn't need rework when they land:
- SYSPRO Yield + Deviation (stat tile + delta badge, see above)
- Canning Efficiency (once its formula is defined — stat tile alongside Actual Yield)
- Comments (free-text block near the top summary)
- Damaged cans (likely a stat tile or a row in Processing Measures — ties to the dashboard's
  existing "Can damage rate" tile)
- Job Details additions: GRN No., PO No., Cost per Kg, Delivery note no. (header card, section 2
  above)

## 5. What NOT to change in this design pass
- **No tablet/responsive redesign of this page — desktop layout stays as the target form factor.**
  Do not add a sidebar, bottom tab bar, touch-target sizing, or a mobile/tablet breakpoint. This
  is the explicit scope limit confirmed 2026-09-11, stated first in this doc for visibility.
- No change to what data is calculated or where it comes from — that's the layout-spec and
  data-improvement docs' job, not this one.
- Don't touch `canning-report.html`'s underlying storage/record logic — this brief is purely
  about visual/layout treatment of data that's either already there or already scoped elsewhere.
- Keep the job-number-prefix filtering rule (`3CP`/`CPR` only in this report's job selector,
  documented in `claude/drying-report-spec.md`) — a design pass shouldn't remove or bypass that
  filter.
- Reuse the existing shared color/type tokens only (Section 3 palette in
  `claude/layout-redesign-instructions.md`) — not its shell, sizing, or responsive rules.

## 6. Verification gap — flag before Claude Design starts
This session could not view a fully populated report (e.g. `?job=CPR002045`) because the browser
session isn't authorised with the facility's records-database access key (a separate credential
from the site login password — see `/pages/api-key.html` on the live site). Everything in
Sections 1–4 about the *populated* report's table layout is based on the page source and the
CPR02170 reference workbook, not a live screenshot with real data in every table. Section 0's
toolbar/empty-state observations are from a live, authenticated (logged-in) view and are solid.
If exact pixel-level fidelity matters before design work starts, get the real access key entered
on a device Michaela controls and grab a screenshot of a fully populated job (e.g. CPR002045) to
attach to this brief.

## 7. Suggested next step
Feed this brief, `claude/canning-report-layout-spec.md`, and
`claude/canning-report-data-improvement-suggestions.md` into Claude Design together, referencing
the existing `Abagold Processing UI.dc.html` canvas for **color/type token** consistency only, not
its tablet shell. Once a design draft exists, it comes back here for Michaela's review before
anything is handed to Claude Code for implementation.
