# Processing Department — Tablet Record-Entry Redesign Instructions for Claude Code

## Purpose
Redesign the **tablet record-completion experience only** — the individual record pages that
staff open from Record List to fill in and submit data on the processing floor. This is a
**layout/shell change limited to that one part of the system.** Do not change any data logic,
field names, database calls, calculations, or CSV/print export logic on any page.

**Everything else in the system is explicitly OUT OF SCOPE and must be left exactly as it is**,
because it continues to be used by admin and PC users on desktop screens: Home/Dashboard,
Record List (the index/finder page), Job Status Updates, Batch Traceability, Submissions &
Verifications Log, FSMS, and **Handovers** (explicitly confirmed: leave Handovers alone). Do not
add a sidebar, restyle, or otherwise touch any of these pages. Their headers, tables, and layouts
stay pixel-identical to today.

---

## 1. Scope — confirmed boundary (2026-09-09)

**IN SCOPE (gets the tablet redesign):**
- The individual record pages reached by opening an entry from **Record List**
  (`records/record-list.html` → clicking a row opens e.g.
  `records/Mortalities-Log-mortalities-log.html`). This is the "New Entry" form + Entries panel +
  Verification panel pattern confirmed live on the Mortalities Log page, and applies to all
  ~130 records listed there.

**OUT OF SCOPE (leave exactly as-is, no shell, no restyling):**
- Home page / Dashboard (`index.html`, `pages/dashboard.html`) — KPI tiles, Harvest by stream,
  Categories table, the **Trends dashboard** (`pages/dashboard.html` → "Trends"), all stay as
  today.
- **Record List index page itself** (`records/record-list.html`) — the filter box + 130-row table
  stays exactly as today. (Only the pages it links *to* are in scope — not the finder page.)
- Job Status Updates
- Batch Traceability
- Submissions & Verifications Log
- FSMS
- **Handovers** — explicitly confirmed out of scope, leave alone even though it's a data-entry
  flow, because it is used differently from the Record List forms.
- Login modal — no longer in scope for this pass (superseded by the scope narrowing below;
  revisit only if Michaela asks for it separately).

**Needs clarification before Claude Code builds — do not guess:**
- **Quick Abalone Receiving**: is this one of the ~130 records reachable from Record List (→ in
  scope), or is it a separate top-level flow like Handovers (→ possibly out of scope, same as
  Handovers)? Confirm which before applying the redesign to it.
- If any of the 130 Record List entries are themselves things like "Job Status" sub-records or
  traceability-linked forms that overlap with the out-of-scope pages above, flag those specific
  cases back to Michaela rather than assuming they're in scope.

**Shell scope:** The new sidebar/topbar shell from the design artboards appears **only on the
in-scope record pages**. It must not be added to any out-of-scope page. Out-of-scope pages keep
their current header/navigation entirely untouched.

---

## 2. Current state of in-scope pages (confirmed live, e.g. Mortalities Log)

Dark bar header (doc code + title + rev) → **"New Entry" white panel** with a 2-column field grid
(label above input, plain bordered inputs) → Clear / Save draft / Submit buttons (gold Submit) →
collapsed "Entries" panel with a "View entries" toggle → collapsed "Verification" panel with a
"View verification" toggle. No sidebar. No stat tiles. No status dots. No card styling.

Some records (e.g. REC 7.2.12 Double Seam Inspection Report) also carry a **per-record "Trend"
link** next to their "Manage specs" control, and a "Header" sub-section inside the New Entry form
carrying that record's own job/batch identification fields (job no., AG code, date, etc.). See
Section 9 for the redesign treatment of both.

## 3. Target state for in-scope record pages (from the approved design canvas)

Reference: `Abagold Processing UI.dc.html` (OneDrive: `20. Paperless/Abagold Processing Interface
Design/`), specifically **artboard 5 (Data Entry Form)** as the primary pattern, with artboard 4
(Report Detail) elements borrowed for the read-only Verification panel if useful.

- **Persistent left sidebar** (200px, dark `#1d2b38`) with the 8 category items, present only on
  these in-scope pages, collapsing to a bottom tab bar below ~800px viewport width (provisional
  breakpoint — tune once actual tablet model is confirmed).
- **Top bar**: doc code + title + rev (as today) restyled into the navy `#1b2330` bar, plus
  Refresh/CSV/Print-style action buttons if the record has export/print functions already. The
  top bar carries only document identity (doc code, title, rev, rev date) — it must never
  duplicate the record's own job/batch fields (see Job header info block below and Section 9).
- **Job header info block**: this is the record's *own* job/batch identification fields — e.g. on
  REC 7.2.12 that's job no., AG code, date, can size, date produced, Fujian batch codes,
  micrometer serial/verification — laid out as a proper labelled field grid (label above input,
  consistent column widths, no run-on wrapping of label text into the next field) inside a white
  card with a colored left border. This block is **the single source of job/batch identity for
  that record** — do not add a second, separate "record id / date-time / logged-by" summary card
  that repeats the same information in a different shape. If a record's current "Header" or
  equivalent section already has these fields, restyle that section into this pattern rather than
  building a second one alongside it.
- **Repeating-row records** (auto-classified — see Section 5): the current field-grid "New Entry"
  form is replaced by an **inline add-row bar** (ID input / notes input / value input / gold "Add"
  button, all ≥44px tall) plus a **running-tally stat row** (count / total / average tiles) above
  the entries list. Entries render as a table with a small "✕" remove button per row (≥36px tap
  target).
- **Single-submission records**: keep the current field-grid form layout exactly as it is
  (same fields, same order, same validation) — only the surrounding shell (sidebar, top bar,
  card container, button styling, spacing) changes, matching the design tokens. This includes
  measurement-heavy forms like REC 7.2.12 (see Section 9) — the measurement tables keep their
  fields/columns/validation, only the visual layout and grouping are cleaned up.
- **Verification panel**: stays functionally the same (toggle to view), restyled as a card
  consistent with the new shell.
- Clear / Save draft / Submit → restyle as `.btn--outline` / `.btn--outline` / `.btn--primary`
  (gold fill) using the shared tokens below, no functional change.
- **No per-record trend/analytics controls.** Any "Trend" link, button, or chart embedded on an
  individual record page is removed as part of this redesign (see Section 9) — trend viewing for
  all records lives exclusively in the Dashboard → Trends page (`pages/dashboard.html`), which is
  out of scope and already exists.

### Shared design tokens (confirmed against the live brand palette)
```
--navy-primary:   #1B2330   (top bar, active sidebar state)
--navy-secondary: #1D2B38   (sidebar background)
--slate:          #5C6771   (secondary text, inactive nav)
--border:         #E2E4E3   (dividers, table borders)
--bg:             #F4F1E8   (page background, zebra stripe)
--gold:           #A9763A   (primary action buttons, active accents, brand)
--green:          #15803D   (success/active/on-target status)
--purple:         #7C3AED   (category/tag accent)
--blue:           #1D4ED8   (info/links)
--white:          #FFFFFF
font: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
min tap target: 44px (36px acceptable only for small inline icon buttons like row-delete)
```

---

## 4. What changes and what does NOT change

**Changes (visual shell, in-scope record pages only):**
- Add the sidebar + navy top bar shell to in-scope record pages only.
- Restyle the "New Entry" panel per the repeating-row vs. single-submission classification below.
- Restyle each record's own job/batch "Header" fields into the shared labelled-grid pattern
  (Section 3) — fixing cramped/overlapping label-input layout — without removing or duplicating
  any of those fields.
- Remove any per-record "Trend" link/control (Section 9) — trend viewing only happens on the
  Dashboard → Trends page.
- Restyle Clear/Save draft/Submit buttons to the token button styles.
- Restyle the Entries/Verification toggle panels as cards consistent with the new shell.
- Add status dots/colors where a status concept already exists in that record's data.

**Does NOT change, anywhere in the system:**
- No new fields, no new database columns, no new record types.
- No change to what data is calculated, submitted, validated, or exported.
- No change to record file names, routes, or the record-key → source-table mapping.
- No change to CSV export content/column order — visual button style only, and only on in-scope
  pages.
- **No change whatsoever** to Home/Dashboard (including the Trends page), Record List index, Job
  Status Updates, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, or the
  login modal.

---

## 5. Record classification rule (auto-detect, confirmed)

Any in-scope record whose current page has an "Entries" panel expecting **more than one row per
period** (a repeating log, e.g. Mortalities Log) gets the inline-add-row + running-tally pattern.
Any in-scope record that is a **single-submission form** (one set of fields, submit once per
period) keeps its current field-grid layout, only gaining the new shell, spacing, and button
styling.

Claude Code must output the classification list (which of the ~130 in-scope records fall into
each bucket) before batch-applying, so Michaela can spot-check it.

---

## 6. Build order

1. **Confirm scope edge cases first**: get Michaela's answer on whether Quick Abalone Receiving is
   in scope, and flag any Record List entries that overlap with out-of-scope pages (Job Status,
   Traceability, etc.) before writing any code.
2. **Design tokens + shared shell components**, isolated to a new/extended CSS file (e.g.
   `record-theme.css`), built and visually verified on one throwaway test page before touching a
   real record page. Do not let this CSS leak into out-of-scope pages' existing stylesheets.
3. **One representative repeating-row record** (e.g. Mortalities Log) — rebuild fully to the
   target pattern. Review with Michaela.
4. **One representative single-submission record** — shell + spacing only. Review with Michaela.
   (REC 7.2.12 is a good second single-submission example to check against, since it also
   exercises the job-header-field-grid fix and the Trend-removal rule — see Section 9.)
5. **Batch-apply** the approved patterns to the rest of the in-scope records, grouped by
   classification bucket. As part of batch-apply, scan every in-scope record for any per-record
   "Trend" link/control and remove it (Section 9) — REC 7.2.12 is confirmed to have one; check
   the rest rather than assuming it's the only one.
6. **Responsive check**: verify the sidebar → bottom-tab-bar collapse at ~800px on a resized
   browser window or actual tablet.
7. **Regression check**: confirm every out-of-scope page (Home, Dashboard/Trends, Record List
   index, Job Status Updates, Batch Traceability, Submissions & Verifications Log, FSMS,
   Handovers, login modal) is visually unchanged — diff before/after screenshots if possible.
8. **Final pass** on the in-scope pages only: consistent status-dot coloring, button styling,
   spacing. Cross-check nothing in CSV export / data submission changed.

---

## 7. Instruction to give Claude Code (ready to paste as the task prompt)

> Redesign only the individual record-entry pages reached from Record List (the "New Entry" +
> Entries + Verification pattern seen on pages like Mortalities Log), using the design reference
> `Abagold Processing UI.dc.html` (artboard 5, Data Entry Form, as the primary pattern) and the
> token palette in Section 3 of this document.
>
> **Do not touch any other page in the system.** Home/Dashboard (including the Trends page), the
> Record List index page itself, Job Status Updates, Batch Traceability, Submissions &
> Verifications Log, FSMS, Handovers, and the login modal must remain pixel-identical to their
> current state — no sidebar, no restyling, no shared CSS bleed. This is a visual/layout-only
> change on the in-scope pages — do not alter any database calls, field names, calculations,
> validation, or CSV/print export content anywhere.
>
> Before writing code: confirm with Michaela whether Quick Abalone Receiving is in scope (reached
> via Record List) or out of scope (separate flow like Handovers), and flag any Record List entry
> that overlaps with an out-of-scope page.
>
> Each record's own job/batch identification fields (its "Header" section — job no., date, batch
> codes, etc.) stay on that record's page and get restyled into a clean labelled field grid; do
> not remove them and do not add a second, separate summary card that duplicates the same fields
> in another shape. Remove any per-record "Trend" link or embedded trend control you find (REC
> 7.2.12 has one, confirmed) — all trend viewing lives exclusively on the Dashboard → Trends page,
> which you must not modify.
>
> Follow the build order in Section 6, stopping after step 4 for review before batch-applying to
> the rest of the in-scope records. Classify every in-scope record as repeating-row or
> single-submission per Section 5's rule, and list the classification for review before batch
> application.
>
> Create/extend a shared theme CSS file scoped to the in-scope record pages only — do not import
> or apply it to any out-of-scope page's stylesheet. Confirm before deleting or renaming any
> existing CSS file or class currently in use.

---

## 8. Files referenced
- Design source: `OneDrive - Abagold/20. Paperless/Abagold Processing Interface Design/Abagold Processing UI.dc.html`
- Live system: https://processing-department.onrender.com/ (password-gated; role-based login)
- Related project doc: `claude/drying-report-spec.md` (drying-report.html build spec — if/when
  that page is built, it is itself a Record List entry, so it should follow whichever pattern
  this redesign settles on for its record type)

---

## 9. REC 7.2.12 Double Seam Inspection Report — review feedback (2026-09-09)

Michaela reviewed the live page at
`records/REC-7.2.12-double-seam-inspection-report.html` and flagged four issues. This section
records what was found on the page and the resulting instruction, as a worked example of Section
3's rules for measurement-heavy single-submission records.

**What's on the page today:**
- Top navy bar: doc code (`REC 7.2.12`), title (`Double Seam Inspection Report`), rev (`Rev 11`),
  rev date. Identity only — no job/batch fields here, so there is no overlap to remove at the top
  bar level.
- A "Header" sub-section inside the New Entry form containing this record's own job/batch fields:
  Job no., AG Code, Date, Can size, Date produced, Fujian batch code (cans), Fujian batch code
  (can ends), Micrometer serial number, Micrometer verified (+/-0.02mm) with two tolerance-check
  sub-fields. These labels currently run directly into the next field with no consistent grid —
  e.g. "Date" and "Can size" appear to share a line and wrap unpredictably, and "Fujian batch code
  (can ends)" wraps mid-label before its input box.
- A "Spec profile" selector, "Manage specs" button, and a **"Trend" link** sitting next to it.
- The measurement tables themselves (Can 1 / Can 2, each with Overlap OK, Vacuum kPa, and an
  11-row Measurement × Point 1/2/3 grid), Comments, and Completed by/Title/Date/Signature — dense
  but functionally fine; these just need the shared card/spacing treatment, not a field redesign.
- Confirmed live: Dashboard → Trends (`pages/dashboard.html`) already exists as a separate page
  and is described as covering exactly this kind of trending (it lists chiller/wet storage temps,
  pH, salinity, dry room conditions, canned product pH/salt/brix/vacuum/drained mass, QC issues
  per month, allergen/EMP swabs). This is the intended single home for all trend views.

**Feedback → instruction:**

1. *"The job entry info needs to be here"* — Confirmed: REC 7.2.12's Header fields (job no., AG
   code, date, batch codes, micrometer info) are that record's own data-entry fields, not
   duplicated administrative chrome, so they stay on the page exactly as they are today (same
   fields, same validation) per Section 3/4. Nothing here is removed.
2. *"The header info that overlaps with job entry info can be removed"* — On REC 7.2.12
   specifically, the top navy bar carries no job/batch fields, so there is nothing to remove there
   today. Read as a general rule for the redesign (Section 3): if the new shell's top bar or any
   added summary card ever ends up showing job no. / date / batch identifiers that duplicate the
   record's own Header fields, that duplicate copy is what gets removed — the record's own Header
   section remains the single source. Apply this check on every record during batch-apply, not
   just REC 7.2.12.
3. *"The header fields are not well laid out"* — Rebuild the Header sub-section as a proper
   labelled field grid per Section 3 (label above input, fixed column widths, consistent gap,
   no label text running into the next field or wrapping mid-phrase). Suggested grouping so
   related fields sit together: row 1 — Job no. / AG Code / Date; row 2 — Can size / Date
   produced; row 3 — Fujian batch code (cans) / Fujian batch code (can ends); row 4 — Micrometer
   serial number / Micrometer verified + its two tolerance sub-fields. Exact column count should
   match whatever the shared record-theme grid uses elsewhere — the point is consistency and no
   run-on wrapping, not this specific grouping.
4. *"The trend tab must be removed, trends should be seen only from index home page after login
   on trend dashboard"* — Remove the "Trend" link from REC 7.2.12's New Entry panel entirely (and
   from any other in-scope record found to have the same control during batch-apply). Do not
   replace it with anything on the record page. All trend viewing continues to live only at
   Dashboard → Trends, which is out of scope and must not be touched by this redesign.
5. *"Document not well laid out"* (general) — Apply the standard shell/card treatment from
   Section 3 to the rest of the page: New Entry panel as a card, Spec profile/Manage specs as a
   small toolbar row (with Trend removed per point 4), the Can 1/Can 2 measurement tables and
   Comments/Completed-by block each as their own clearly separated card with consistent spacing —
   without changing which fields exist, their order, validation, or what gets calculated/exported.
