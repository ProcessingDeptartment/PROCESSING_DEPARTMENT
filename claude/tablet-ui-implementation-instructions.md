# Tablet UI Implementation Instructions (for Claude Code)

**Source of truth:** `claude/tablet-ui-optimisation-brief.md` (Sections 4, 5, 7, 8) and the visual reference `Dry Cooking Record.dc.html` (design project). This file is the ordered work list.

**Scope:** record-entry pages only (`form-record.js` `.fr-*`, `monitoring-log.js` `.ml-*`, bespoke 7.x pages). Do NOT touch Home, Trends, Job Status, Traceability, Submissions Log, FSMS, Handovers, Canning Report, login modal.

**Never change:** field names/order, validation, calculations, DB calls, storage keys, CSV/print output, routes. `@media print` rules stay exactly as they are.

**Guardrails**
- `job-status.html` also loads `record-theme.css`. Every new rule is nested under `.rt-shell` (or `.fr-app` / `.ml-app` inside the engines). No bare element selectors.
- Pilot first: Phase A on a throwaway test page, then `Mortalities Log` only. Stop for review before rolling out.
- Before deleting `--palette-*` or any `data-palette` block, list every file that uses it and wait for confirmation.

---

## Phase A — Tokens and type scale (one change, three consumers)

### A1. Token set in `public/styles/record-theme.css`
Add inside the existing `:root` block (keep old `--rt-*` names as aliases so nothing breaks):

```css
--bg:#F4F1E8; --surface:#FFFFFF; --ink:#1B2330; --ink-2:#54606B;
--line:#E2E4E3; --field-line:#8A949C; --field-ro:#EEF1F0;
--chrome:#1B2330; --chrome-2:#1D2B38;
--action:#96652B; --action-press:#7C5222;
--ok:#15803D; --ok-tint:#E8F3EC;
--warn:#B45309; --warn-tint:#FBF0DC;
--fail:#A3352D; --fail-tint:#FBE8E6;
--info:#1D4ED8;
--fs-title:18px; --fs-section:18px; --fs-label:15px; --fs-value:18px;
--fs-hint:14px; --fs-btn:17px; --fs-table:16px; --fs-th:14px;
--tap:48px; --tap-primary:56px; --tap-row:40px; --gap-min:8px;
--field-border:1.5px solid var(--field-line); --field-radius:8px;
```
Alias: `--rt-gold` -> `var(--action)`, `--rt-gold-hover` -> `var(--action-press)`, `--rt-border` -> `var(--line)`. Do the same for `--palette-primary`, `--palette-primary-hover`, `--palette-primary-text` (set to `#fff`), `--palette-border`, `--palette-focus` (= `var(--action)`).

### A2. Touch query instead of width
In `record-theme.css`, `responsive.css`, and the STYLE strings of `form-record.js` and `monitoring-log.js`:

- Wrap tablet sizing in `@media (pointer: coarse), (max-width: 1099px) { ... }`.
- Keep ONE narrow breakpoint: `@media (max-width: 700px)` = single column.
- Delete intermediate breakpoints (`1099`, `1024`, `900`, `800`, `768`, `699`, `560`, `480`) only after checking each rule is either folded into the two above or unneeded. List the removed ones in the report.
- Desktop mouse users keep the compact `rt-pc` density.

### A3. Type scale (coarse pointer)
Replace hard-coded sizes in `.fr-*`, `.ml-*` and `responsive.css --form-fs-*`:

| Element | px | Weight |
|---|---|---|
| Top bar title | 18 | 700 |
| Section heading (`.fr-panel-head h2`, `.fr-section-title`) | 18, sentence case, no all-caps | 700 |
| Field label (`.fr-field`) | 15 | 600 |
| Input/select/textarea value | 18 | 500 |
| Hint / unit (`span.hint`, `.fr-upload-info`) | 14 | 400 |
| Buttons | 17 | 700 |
| Table body / roster inputs | 16 | 500 |
| Table th | 14 | 700 |

Remove every on-screen 10/10.5/11/11.5/12/12.5/13px declaration (badges, `.fr-btn-sm`, `.instr-item strong`, etc. -> 14px min). Print re-pins stay.

### A4. Touch targets
- `input, select, textarea, .fr-btn, .ml-yesno button`: `min-height:48px`.
- Primary Submit: `min-height:56px`.
- Checkbox/radio: 28px box, whole label row 48px tappable.
- Row delete `✕` and in-table buttons: 40px.
- 8px minimum gap between neighbours; 16px between field groups; 24px between sections.
- Inputs inside `table.fr-table` get 16px font and `min-height:40px` (currently `min-height:0`).

### A5. Field styling
```css
.fr-app input,.fr-app select,.fr-app textarea{border:var(--field-border);border-radius:var(--field-radius);font-size:var(--fs-value);min-height:var(--tap);padding:10px 12px}
.fr-app input:focus,.fr-app select:focus,.fr-app textarea:focus{outline:3px solid var(--action);outline-offset:1px}
.fr-app input[readonly],.fr-app input:disabled{background:var(--field-ro)}
.fr-field.invalid input{border-color:var(--fail)} /* message below in plain words */
```
Keep `.fr-provisional` but recolour to `--warn` / `--warn-tint`.

---

## Phase B — Colour restraint

1. Buttons: `.fr-btn-primary` = `background:var(--action); color:#fff`. Retire black-text-on-gold variant.
2. Retire purple card-accent stripe (`--rt-purple` usages). Grep `rt-purple|7C3AED|accent-stripe`.
3. Header colour: every record uses `--chrome-2` (navy). Add a category chip in the top bar (text + 10px dot in the old category colour, read from `palette-map.js`). List every file that sets `data-palette` / calls `palette-map.js` first, then wait for confirmation before removing the 20 `data-palette` blocks and `--palette-*` set (~line 856 of `record-theme.css`).
4. Status = colour + icon + word: `.fr-badge-ok` "✓ Pass", `.fr-badge-fail` "✕ Fail", warn "! Attention". Use the `--ok/--warn/--fail` tokens and tints; badge min font 14px.
5. Border colours: card/table dividers stay `--line`; anything that is an input boundary uses `--field-line`.

---

## Phase C — Structure (shared components in both engines)

Build once as small functions in `form-record.js` and reuse in `monitoring-log.js` (or extract to `lib/record-chrome.js` loaded by `record-shell.js`).

### C1. One container level
Remove `.fr-panel` border+radius for form sections: page background -> flat white section (`background:var(--surface)`, hairline divider under heading) -> fields. Remove the per-row card border on `.fr-roster-row` (`border`, `padding`, `radius`) in the phone block.

### C2. Collapsible sections, current one open
The engine already has `<details class="fr-section-collapsible">`. Change behaviour:
- First section with an incomplete required field is `open`; others closed.
- On completing a section (all required filled) show a green `✓` in its summary and open the next.
- Summary row: 48px tall, 18px title, `n of m fields done` in 14px `--ink-2`.
- Do not add JS state to storage; derive from current field values.

### C3. Section rail (only when a record has >= 4 sections)
Sticky under the top bar (`top: var(--rt-topbar-h)`), horizontal scroll strip, one button per section (48px), tick when complete, tap = open that section and scroll to it with `element.scrollTop`-style offset (do NOT use `scrollIntoView`; use `window.scrollTo({top: el.getBoundingClientRect().top + scrollY - offset})`). Active section underlined with `--action`.

### C4. Sticky bottom action bar
Fixed bottom bar: `Clear` (text button), `Save draft` (outline, 48px), `Submit` (filled `--action`, 56px, flex:1 max 320px). Add `padding-bottom: env(safe-area-inset-bottom)`. Add `padding-bottom: 96px` to `.fr-body` so content is never hidden. These call the SAME existing handlers as today's bottom buttons (move the existing DOM nodes or proxy clicks; do not duplicate logic). Hide the bar in `@media print`.

### C5. Save-state chip in top bar
States: `Saved`, `Saving…`, `Draft saved HH:MM`, `Offline — will retry`, `Error — tap to retry`. Hook into the existing save/draft promise chain; no new storage. While saving, disable Submit and show state (prevents double submit).

### C6. Server-wake message
If the first API call takes > 3s show banner: "Connecting to the server… this can take up to a minute after a quiet period" with an indeterminate progress bar. Clear on first response.

### C7. Segmented controls
- `.ml-yesno` and any `select` with <= 4 options (Yes/No, Pass/Fail, shift) render as segmented buttons: min-height 48px, selected = filled + `✓`, unselected = white with `--field-line` border. Underlying `<select>`/value stays the source of truth (hide the select, set its value on click, dispatch `change`) so validation and storage are untouched.

### C8. Hints behind ⓘ
Move `span.hint` under `.fr-field` into a 44px `ⓘ` button beside the label that toggles the hint text. Work-instruction panel button in top bar stays.

### C9. Optional-field marking
Required is the default. Add "(optional)" suffix in `--ink-2` on optional labels; remove asterisk noise where the engine adds one.

### C10. Roster / repeating rows
- Remove per-row card. Sticky table header on landscape.
- Add full-width 56px "+ Add row" under the last row; new row scrolls into view and focuses first input.
- Running count/total strip above the list.
- Row `✕` 40px with 12px gap; deleting shows an Undo toast (5s) instead of instant delete (keep existing delete handler; delay commit until toast expires, or restore from a held copy).

### C11. Entries / Verification bars
Replace the panel cards with slim full-width bars ("Entries (12) ›", 56px) that open the existing content in a full-height sheet (reuse `.fr-modal-overlay`).

### C12. Validation summary
Bottom bar shows "2 fields need attention" (tap = jump to first invalid). Inline message in plain words under the field. Reuse existing validation results; no rule changes.

---

## Phase D — Other rendering paths
1. `monitoring-log.js`: apply A–C (same tokens; `.ml-*` equivalents).
2. Bespoke 7.x pages (~28): adopt tokens via `record-theme.css` first (free), then shared components in batches of ~5.
3. Record List: tap-target-only change (row height 56px, filter input 48px) — only if approved.

---

## Acceptance (report each with script output)
1. No visible on-screen text < 14px (list offenders via `getComputedStyle` scan).
2. Every interactive element >= 48px (>= 40px for row ✕ / in-table), >= 8px gaps (bounding-box scan).
3. Text contrast >= 4.5:1; field borders and icon controls >= 3:1.
4. Hue budget: action + ok/warn/fail + info + neutrals only.
5. No nested card levels.
6. Submit visible without scrolling; section rail present at >= 4 sections.
7. Landscape (1180x820, 1366x1024) and portrait (820x1180) both receive tablet sizing.
8. Greyscale: pass/fail/read-only still distinguishable.
9. Print PDF of 3 records identical to before.
10. Submit same test data before/after on 3 records: stored values and CSV identical.
11. Floor test with 3 operators (Michaela).

## Pilot order
1. Throwaway test page with the tokens + one of each component.
2. Mortalities Log (`fr`).
3. One `ml` record, one bespoke record.
Stop and report after step 2.

## Order of value if time is short
type scale + touch query -> colour tokens -> sticky action bar -> segmented Yes/No -> section rail -> rest.
