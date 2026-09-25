# Record Pages — Field Alignment & Layout Fix (Instructions for Claude Code)

**Date:** 2026-09-25
**Raised by:** Michaela — "layout of UI pages is scrambled, fields are not in line in rows"
**Type:** CSS / layout-only fix. **No change** to fields, field names, order, validation, calculations, DB calls, CSV/print output.
**Related docs:** `claude/layout-redesign-instructions.md` (the 2026-09-09 tablet shell brief), `claude/repo/mobile-tablet-font-responsiveness.md` (2026-09-07 font/tap-target work).

---

## 1. What is wrong (confirmed on the live site, 1280px desktop, 2026-09-25)

| # | Symptom | Where seen | Root cause |
|---|---|---|---|
| A | **Whole page scrambled** — stage tabs, can tabs, measurement table, Comments and Completed-by sit side by side as tall skinny 258px columns | REC 7.2.12 Double Seam Inspection Report | `record-theme.css` forces `.rt-content .ml-grid-2 { grid-template-columns: repeat(auto-fit, minmax(220px,1fr)) }`. The engine's entry container `#ml_p_modalFields` carries `ml-grid ml-grid-2`, and REC 7.2.12 uses a **custom body renderer** (`customBody.render`) that fills that container with full-width blocks (toolbar, tabs, panels). Each block became one grid cell. |
| B | **Columns don't line up between sections** — Job info has 5–6 columns, the roster has 8, Sign-off has 3 narrow fields, Completed-by has 4 wide fields; none share column edges | REC 7.1.3, 7.1.5, 7.8.1 and most engine records | Every grid uses `auto-fit` / `auto-fill` with `minmax(...)`, so the column count depends on how many fields a section has and how wide the screen is. There is no shared column system. |
| C | **Inputs in the same row sit at different heights** | Job no. (the "Change" link sits between label and input), fields with a hint line e.g. "Chiller temp (°C)", two-line labels e.g. "Size-range whole weight (kg)" | Field = label → (extra line) → input, stacked top-down, grid `align-items` is stretch/start. Anything extra above an input pushes only that input down. |
| D | **Job info fields stacked one per full-width row** on some records while the next section is 6-across | REC 7.8.1 Chiller Batch Control | That section's fields aren't inside a grid wrapper (or the wrapper has no column rule), so each field is a full-width block. |
| E | **Two input sizes on one form** — header inputs 54px tall/16px bold, roster inputs ~30px/13px | All engine records with rosters | `.rt-content .fr-field input {min-height:54px}` vs `.rt-content .fr-roster-row input {min-height:0; padding:6px 8px}` |
| F | Minor: "Spec profile" label wraps to two lines; **Trend link still on REC 7.2.12** (should have been removed per 09-09 brief §9); Completed-by inputs squashed | REC 7.2.12 | Inline `flex-direction:row` on the label; brief not fully applied |
| G | Minor: sidebar nav text is hard to read | All shell pages | `--rt-slate #5C6771` on `#1D2B38` ≈ 2.4:1 contrast (needs ≥4.5:1) |
| H | Inconsistent section headings — "JOB INFO" is a styled header with caret, "SIGN-OFF" / "COMPLETED BY" are tiny grey text | Engine records | Three different heading classes (`fr-section-title`, `ml-grouphead`, sign-off sub-label) styled differently |

**Automated scan (not logged in, default/collapsed state, so treat as a minimum):** 42 of 131 Record List pages had at least one row with misaligned inputs or mixed input heights: Live Leftovers Log, Mortalities Log, QA-01, REC-1, 7.2, 7.2.4, 7.2.10, 7.2.12, 7.2.13, 7.4.1, 7.4.2, 7.4.3.1, 7.4.3.2, 7.4.5, 7.4.6, 7.4.7, 7.5.1, 7.5.2, 7.6.2.2, 7.6.5, 7.6.6, 7.6.7, 7.6.7-a, 7.6.8, 7.6.8-a, 7.7.1, 7.7.4, 7.7.5, 7.7.6, 7.8.1 (canning + dry), 7.8.3, 7.8.7, 7.8.8, 7.8.9, 7.9.1, 7.9.2, 7.9.3.1, 7.9.3.2, 7.10.2, 7.10.3, 7.10.4, 8.1.1. REC 7.1.3 / 7.1.5 were missed by the scan but visibly have problem C (Job no.).

---

## 2. The rule to build to — one column system for every record form

Every field grid inside `.rt-content` uses the **same fixed column tracks**, so field edges line up down the whole page.

| Content width | Form field grids (job info, sign-off, completed-by, verification, general fields) | Roster rows (repeating batches) |
|---|---|---|
| ≥ 1100px (PC) | **4 equal columns** | **8 equal columns** (each = half a form column, so edges still line up) |
| 700–1099px (tablet landscape/portrait) | **2 columns** | **4 columns** |
| < 700px (phone) | **1 column** | **1 column** (stacked card, as today) |

Additional rules:

1. **Tracks are fixed, not auto-fit.** Use `repeat(N, minmax(0, 1fr))`. A section with 3 fields leaves the 4th column empty — that is correct; it keeps edges aligned with the sections above and below.
2. **Wide fields span the full row**: textareas (Comments, Process deviation, Corrective action), any `.fr-field.wide` / `.ml-field.wide`, custom blocks (tables, tab strips, panels, toolbars).
3. **Inputs bottom-align in every row.** Each field is a flex column with `justify-content: flex-end`; each grid has `align-items: end`. Labels can wrap to two lines; the input still sits on the shared baseline.
4. **Nothing sits between a label and its input.** Helper links ("Change" on Job no.) move onto the label line, right-aligned. Hints ("°C", "tol ±0.02mm", "record only") go *below* the input in small text, or in brackets at the end of the label.
5. **One input height per density mode**:
   - Tablet/floor default: **48px** tall, 16px text — header fields AND roster fields.
   - PC mode (`body.rt-pc`): **36px**, 14px — both.
   - Only inputs **inside real `<table>` cells** (measurement tables, entries tables) stay compact (32px).
6. **One section-heading style** for all sub-sections (Job info, Salting batches, Sign-off, Completed by, Verification): 12px, bold, uppercase, slate, bottom border, 16px space above. Collapsible ones add the gold caret.

---

## 3. Changes, file by file

### 3.1 `public/styles/record-theme.css` (ENGINE RESKIN block — everything stays under `.rt-content`)

1. **Replace** the current field-grid rule (the one listing `.rt-content .fr-grid … .ml-grid-4` with `repeat(auto-fit, minmax(220px,1fr))`) with a fixed-track rule:
   - `.rt-content .fr-grid, .ml-grid, .fr-grid-2/3/4, .ml-grid-2/3/4` → `display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px 18px; align-items: end;`
   - Use a CSS custom property `--rt-form-cols` (4 / 2 / 1 at the breakpoints in §2) so there is one place to change it.
2. **Custom-body container must not be a grid.** Add a rule that neutralises the grid when a record draws its own body:
   - `.rt-content .ml-grid.ml-custom-body, .rt-content .fr-grid.fr-custom-body { display:block; }` (class added by the engine — see 3.3), **and** as a belt-and-braces fallback:
   - `.rt-content .ml-grid > :not(.ml-field):not(.fr-field)`, `.rt-content .fr-grid > :not(.fr-field):not(.ml-field)` → `grid-column: 1 / -1;` (any non-field child — toolbar, tabs, panel, table wrapper, details — spans the full row).
3. **Field alignment**: `.rt-content .fr-field, .ml-field, .cr-field` → `display:flex; flex-direction:column; justify-content:flex-end; min-width:0;`. Make textareas and `.wide` fields `grid-column: 1 / -1`.
4. **Roster rows**: change `.rt-content .fr-roster-row` from `repeat(auto-fill, minmax(170px,1fr))` to `repeat(var(--rt-roster-cols, 8), minmax(0,1fr))` with `align-items:end`; `--rt-roster-cols` = 8 / 4 / 1 at the §2 breakpoints. Keep the remove (✕) button on its own line, right-aligned, as today.
5. **Input sizes**: set header inputs to `min-height:48px; padding:12px 14px; font-size:16px` (was 54px / 15px 16px). Change the roster override (`.rt-content .fr-roster-row input/select`) to the **same** 48px / 16px — remove `min-height:0; padding:6px 8px; font-size:13px` for roster rows. Keep the compact override only for `.rt-content table input/select/textarea`.
6. **PC mode** (`body.rt-pc` block): update its grid rule to `repeat(4, minmax(0,1fr))` (not auto-fill 200px) and make roster inputs the same 36px as header inputs. Leave the existing "roster as a table" behaviour otherwise untouched.
7. **Section headings**: add the sign-off / completed-by sub-heading class the engines emit (check the actual class in `signoff-block.js` — likely a small label div above `completedByHtml` / `verifyFieldsHtml`) to the existing `.fr-grouphead, .ml-grouphead …` heading rule so all section headings look the same.
8. **Sidebar contrast**: change `.rt-sidebar a` colour from `var(--rt-slate)` to `#B9C3CC` (the existing `--palette-dark-muted` value; ≈ 8:1 on the sidebar). Active/hover stay white.
9. Delete the now-redundant `@media (max-width:560px)` grid override inside this block once the custom-property breakpoints cover it (keep the roster remove-button full-width rule).

### 3.2 Engine `<style>` blocks — `public/lib/monitoring-log.js` and `public/lib/form-record.js`

- Their own `.ml-grid-2/3/4` and `.fr-grid-2/3/4` column rules and `@media (max-width:900px)` collapse rules are fine for **non-shell** rendering; leave them, because the `.rt-content` rules in record-theme.css override them inside the shell.
- Add `.ml-field.wide` (mirror of the existing `.fr-field.wide { grid-column:1/-1 }`) if it doesn't already exist.

### 3.3 Engine JS — custom body flag (`monitoring-log.js`, and `form-record.js` if it has the same hook)

- In `openForm` where `if (customBody) { container.innerHTML = ''; … customBody.render(container, …) }` runs (monitoring-log.js ~line 1087), add `container.classList.add('ml-custom-body')` before `render`, and `container.classList.remove('ml-custom-body')` in the non-custom branch (the same container is reused).
- No other logic change.

### 3.4 Job-number picker ("Change" link) — find where the job-no field is built (`public/lib/job-picker.js` and/or the `fr-jobnumber` builder in form-record.js)

- Move the "Change" link out of the space between the label and the input: render it **inside the label line**, right-aligned (label becomes `display:flex; justify-content:space-between`). The input then sits on the row baseline like its neighbours.
- Do not change what the link does.

### 3.5 Hints / units under labels

- Where an engine field definition has a `hint` (e.g. Chiller temp "(°C)"), render the hint **after** the input (small, 12px, slate) instead of between label and input. If moving it is risky in one engine, append it to the label text in brackets instead — either way nothing sits between label and input.

### 3.6 Sections without a grid wrapper (problem D)

- Find why REC 7.8.1's Job info fields render one per full-width row (fields not wrapped in `fr-grid`/`ml-grid`, or the collapsible section body lacks the class). Wrap them in the standard grid so they follow the 4/2/1 rule. Check every record whose Job info section is collapsible — the same builder is probably shared.

### 3.7 REC 7.2.12 Double Seam (`public/records/REC-7.2.12-double-seam-inspection-report.html`) — layout only

1. After 3.1/3.3 the page stacks vertically again. Then:
2. **Remove the Trend link** (`<a class="ds-btn-flat" href="double-seam-trend.html">Trend</a>`, ~line 417) — outstanding from the 09-09 brief §9. Do not delete `double-seam-trend.html` itself without asking Michaela.
3. Spec profile label: drop the inline `flex-direction:row` so it is a normal label-above-select field; toolbar becomes one row: [Spec profile ▾] [Manage specs] [spec-breach status].
4. `.ds-grid` (header fields and Completed-by): make it follow the same 4-column fixed-track rule (`repeat(4, minmax(0,1fr))`, 2 / 1 at the breakpoints, `align-items:end`). Header grouping from the 09-09 brief: row 1 Job no. / AG code / Date / Can size; row 2 Date produced / Fujian batch (cans) / Fujian batch (can ends); row 3 Micrometer serial / Micrometer verified / 1.21mm reading / 3.00mm reading.
5. Stage tabs + Can tabs: one horizontal row of tabs each (natural height, not stretched), then the measurement panel full width, then Comments full width, then Completed by full width.

### 3.8 Pages that don't use the shell yet

- The scan suggests a number of records from REC 7.4.9 onward may still render without the `.rt-shell` (results were timing-sensitive, so **verify logged in**). Do **not** batch-apply the shell to them in this task. Just list, in the work log, which Record List pages have no `.rt-content` so Michaela can decide on a follow-up. The alignment rules in this doc only apply inside `.rt-content`.

---

## 4. Do NOT change

- No field added, removed, renamed or re-ordered. No change to validation, calculations, `values` keys, DB writes, CSV/JSON export columns, print sheet (`.fr-sheet` / `.ml-sheet`) or `@media print` rules.
- Out-of-scope pages from the 09-09 brief stay pixel-identical: Home, Dashboard/Trends, Record List index, Job Status, Batch Traceability, Submissions & Verifications Log, FSMS, Handovers, login modal. `job-status.html` also loads record-theme.css — that is why every new rule must stay under `.rt-content` / `.rt-shell`.
- `public/styles/responsive.css` — leave as is unless a rule is proven to fight the new grid (if so, scope the fix, note it in the work log).

---

## 5. Build order

1. Branch: `fix/record-field-alignment`.
2. Before touching code: screenshot REC 7.2.12, 7.1.3, 7.1.5, 7.8.1, Mortalities Log, one PC-mode record (`body.rt-pc`, e.g. an NRCS pack page) at **1280px, 1024px, 768px, 390px**, logged in, all collapsible sections open. Save to `Claude outputs/alignment-before/`.
3. Do 3.1 + 3.3 (grid system + custom-body fix). Re-screenshot REC 7.2.12 and 7.1.3 — **stop and show Michaela.**
4. Do 3.4, 3.5, 3.6 (Change link, hints, missing grid wrappers).
5. Do 3.7 (REC 7.2.12 clean-up) and 3.1 items 5–8 (input size, headings, sidebar contrast).
6. Run the alignment check (§6) on all 131 Record List pages; fix what it flags.
7. Regression screenshots of every out-of-scope page — must be unchanged.
8. Print-preview 3 records (REC 7.2.12, 7.1.3, one monitoring log) — must match the pre-change PDF.
9. Write `claude/record-field-alignment-worklog.md` (what changed, before/after screenshots, pages still without the shell).

---

## 6. Acceptance checks

**Visual (Michaela signs off):**
- [ ] REC 7.2.12 reads top-to-bottom: toolbar → job & equipment info → stage tabs → can tabs → measurement table → comments → completed by. No side-by-side skinny columns.
- [ ] On any record at 1280px, the left edges of fields in Job info, the roster, Sign-off and Completed-by line up on the same 4 (or 8) column lines.
- [ ] In every row, all input boxes sit at the same height and are the same size (Job no. included).
- [ ] Tablet 768–1024px: 2 fields per row, roster 4 per row, nothing overlaps. Phone 390px: 1 per row, no sideways page scroll.
- [ ] All section headings look the same.
- [ ] Sidebar nav text is readable.
- [ ] Trend link gone from REC 7.2.12.
- [ ] Printed PDFs unchanged.

**Automated alignment check** — run in the browser console on each record page (logged in, sections expanded). It must return `[]` on every page:

```js
(() => {
  const bad = [];
  document.querySelectorAll('.rt-content *').forEach(g => {
    if (getComputedStyle(g).display !== 'grid' || g.closest('table')) return;
    const rows = {};
    [...g.children].filter(c => c.offsetParent).forEach(c => {
      const t = Math.round(c.getBoundingClientRect().top);
      (rows[t] = rows[t] || []).push(c);
    });
    Object.values(rows).forEach(cells => {
      const inputs = cells.map(c => c.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select'))
                          .filter(i => i && i.offsetParent);
      if (inputs.length < 2) return;
      const bottoms = inputs.map(i => Math.round(i.getBoundingClientRect().bottom));
      const heights = inputs.map(i => Math.round(i.getBoundingClientRect().height));
      if (Math.max(...bottoms) - Math.min(...bottoms) > 3 || Math.max(...heights) - Math.min(...heights) > 3)
        bad.push((g.id || g.className) + ' bottoms=' + bottoms.join(',') + ' heights=' + heights.join(','));
    });
    // full-width blocks squeezed into a grid column
    [...g.children].forEach(c => {
      if (c.querySelector('table, .ds-panel, .ml-panel, .fr-panel') && c.getBoundingClientRect().width < g.getBoundingClientRect().width * 0.9)
        bad.push('block-in-grid: ' + (g.id || g.className));
    });
  });
  return bad;
})();
```

Claude Code can loop this over all Record List links with Playwright (Chromium is pre-installed) at 1280 / 1024 / 768 / 390 widths and put the pass/fail table in the work log.

---

## 7. Paste-ready prompt for Claude Code

> Read `claude/record-page-field-alignment-fix-instructions.md` and follow it exactly. This is a CSS/layout-only fix for record-entry pages inside `.rt-content`: introduce one fixed column system (form grids 4/2/1, roster rows 8/4/1), bottom-align inputs in every row, one input height per density mode, stop the monitoring-log custom-body container from being a grid (REC 7.2.12 is currently scrambled because of it), move the Job no. "Change" link and field hints out from between label and input, wrap unwrapped Job info sections in the standard grid, unify section headings, raise sidebar text contrast, and remove the Trend link from REC 7.2.12. Do not change any field, validation, calculation, DB call, export or print output, and do not touch the out-of-scope pages listed in §4. Take the §5 step-2 before screenshots first, stop after step 3 to show me REC 7.2.12 and REC 7.1.3, then continue. Finish with the §6 alignment check across all Record List pages and a work log at `claude/record-field-alignment-worklog.md`.
