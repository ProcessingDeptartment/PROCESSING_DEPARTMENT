# Mobile & Tablet Font Responsiveness — Work Done

**Date:** 2026-09-07
**Scope:** All record pages in the Processing Department system
**Files changed:**

- `public/styles/responsive.css` (shared responsive layer, loaded last on every page)
- `public/lib/form-record.js` (form-record engine — injected `<style>` block)
- `public/lib/monitoring-log.js` (monitoring-log engine — injected `<style>` block)

`public/styles/record-theme.css` was **not** changed — its `--form-fs-*` type-scale
variables are the desktop/print baseline and are now overridden per breakpoint from
`responsive.css`.

---

## Problem

Record forms used an 11–12px type scale everywhere. On phones and tablets that is
unreadable without pinch-zooming, and touch targets (buttons, checkboxes, table
controls) were below the 44px minimum for reliable finger input.

There are three rendering paths for record pages, each with its own typography:

| Path | Count | Typography source |
|---|---|---|
| `monitoring-log.js` engine | ~many | `.ml-*` classes in the engine's injected `<style>` |
| `form-record.js` engine | ~many | `.fr-*` classes in the engine's injected `<style>` |
| Bespoke hand-written pages (7.1.x–7.4.4) | ~28 | inline `<style>`, ideally via `--form-fs-*` vars |

All three had to be addressed.

---

## Changes

### 1. `public/styles/responsive.css`

**`@media (max-width: 1024px)` — tablets**

- Bumped the bespoke type-scale custom properties:
  `--form-fs-root: 15px`, `--form-fs-input: 16px`, `--form-fs-button: 15px`,
  `--form-fs-small: 13px`, `--form-fs-label: 14px`, `--form-fs-hint: 13px`,
  `--form-fs-panel-head: 14px`.
- `.btn, .ml-btn, .fr-btn, button { min-height: 44px }` — tablets are touch devices
  even though the layout does not yet collapse to one column.
- `input[type=checkbox]`, `input[type=radio]`: `min-width/height: 22px`, `margin: 8px`.

**`@media (max-width: 768px)` — phones / small tablets**

- Type-scale vars raised to the readable-without-zoom minimum:
  `--form-fs-root / --form-fs-input / --form-fs-label: 16px`,
  `--form-fs-button: 16px`, `--form-fs-panel-head: 15px`,
  `--form-fs-small / --form-fs-hint: 14px`.
- Form controls: `font-size: 16px !important` (stops iOS Safari zoom-on-focus),
  `min-height: 44px`. Data-table inputs are exempted (`table input { min-height: 0 }`)
  and stay at 13px — those tables scroll horizontally instead.
- Hand-written page text: `.field` / labels / `.panel-body` (without a table) →
  16px; `.panel-head h2/h3` → 15px; `.hint, .field-hint, small` → 14px.
- Checkbox / radio: 24px box, 10px margin, and a wrapping
  `label:has(> input[type=checkbox])` gets `min-height: 44px` + inline-flex centring
  so the whole label is one 44px tap target.
- Buttons: primary `min-height: 44px` / 16px / `padding: 10px 16px`;
  small buttons keep a compact label but still get `min-height: 44px` via padding;
  buttons **inside table cells** are the deliberate exception — `min-height: 36px`
  so table rows don't blow out.
- `.report-link` (hub navigation): 16px, `min-height: 44px`.

**`@media (max-width: 480px)`** — unchanged except inherited var values; grids already
collapse to a single column here.

**`@media print`**

- Re-pins every `--form-fs-*` var back to 12px. A4 content width (~726px) overlaps the
  768px breakpoint, so without this the mobile scale would leak onto printed PDFs.
- Re-pins `.field` / labels / hints / `.panel-body` to `12px !important` and clears
  button `min-height`, so controlled-copy printouts keep their exact 12px layout.

### 2. `public/lib/form-record.js` (engine `<style>`)

**`@media (max-width: 1024px)`** — new tablet type scale:
`.fr-app` 14px, `.fr-field` 13.5px, `.fr-field span.hint` 12px,
`.fr-panel-head h2` 13.5px; `.fr-app input/select/textarea` 15px + `min-height: 44px`
(table inputs held at 13px / `min-height: 0`); `.fr-btn` `min-height: 44px`.

**`@media (max-width: 768px)`** — phone bump added on top of the existing input rule:
`.fr-app` 15px, `.fr-field` 14px, `.fr-field span.hint` 12.5px,
`.fr-panel-head h2` 14px, `.fr-section-title` 13px,
`.fr-instructions .instr-item strong` 12.5px;
inputs `min-height: 44px`; `.fr-btn` `min-height: 44px` / 14px.

### 3. `public/lib/monitoring-log.js` (engine `<style>`)

Same treatment as form-record with `.ml-*` selectors:

**`@media (max-width: 1024px)`** — `.ml-app` 14px, `.ml-field` 13.5px,
`.ml-field span.hint` 12px, `.ml-panel-head h2` 13.5px, inputs 15px + `min-height: 44px`,
`.ml-btn` `min-height: 44px`.

**`@media (max-width: 768px)`** — `.ml-app` 15px, `.ml-field` 14px,
`.ml-field span.hint` 12.5px, `.ml-panel-head h2` 14px, `.ml-grouphead` 13px,
`.ml-instructions .instr-item strong` 12.5px, inputs `min-height: 44px`,
`.ml-btn` `min-height: 44px` / 14px.

Both engines swap the on-screen body for a separate `.fr-sheet` / `.ml-sheet` layout
when printing, so none of these screen bumps reach printed records.

---

## Acceptance criteria

| Criterion | Status |
|---|---|
| Readable without zooming on phones (≥16px base) | Met — vars + label/input rules at 16px on `≤768px` |
| Field values scale for touch; tap targets ≥44px | Met — inputs, buttons, checkbox labels at 44px |
| Section titles stay visually distinct at all sizes | Met — panel heads scale but keep uppercase + letter-spacing + colour |
| Inputs accommodate mobile keyboards without horizontal scroll | Met — grids collapse progressively; 16px inputs prevent iOS zoom |
| Roster/batch rows navigable on phones | Met — engine roster rows stack; wide data tables scroll with visible scrollbar |
| Interactive elements sized/spaced for finger input | Met — 44px buttons, 24px checkboxes with 10px margin |

---

## Verification

Tested in the browser preview (`frontend-dev`, localhost:3000) via DevTools device
emulation:

- **Phone (375×812):** `REC-7.3.3` (form-record engine), `REC-7.9.1` (monitoring-log
  engine), `REC-7.2.4` (bespoke, uses `--form-fs-*`). Labels large and readable,
  inputs tall, Y/N buttons finger-sized, section headers distinct, wide table scrolls
  with a visible indicator, no body horizontal scroll.
- **Tablet (768×1024):** `REC-7.3.3`, `REC-7.9.1`. Clean single/two-column layout,
  44px targets, readable type.
- Console: only expected 401s from the unauthorised records database; no CSS errors.

Print output not re-tested on paper — guarded by the `@media print` re-pin rules and
the engine sheet-swap; behaviour is unchanged by construction.
