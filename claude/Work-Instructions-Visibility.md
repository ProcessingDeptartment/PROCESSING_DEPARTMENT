# Work Instructions Field — Visibility Note

**Status:** Requirement captured during the field inventory audit, then implemented (2026-08-31).

## Required Behaviour

On REC records the **Work Instructions** panel must be **hidden by default** on every viewport, revealed on demand via a **"Show"** button in the panel header (button then reads "Hide"). Do not show Work Instructions expanded by default.

## Implementation (2026-08-31)

Previously this was only true on narrow screens (≤768px) for `monitoring-log.js` records, and never for `form-record.js` records — on desktop the panel was always expanded.

Changed:

| File | Change | Cache bump |
|---|---|---|
| `public/lib/form-record.js` | Added `fr-instr-panel` wrapper, a `#fr_instrToggle` Show/Hide button, collapse CSS (all viewports), and the toggle click handler. | `?v=14` → `?v=15` (78 pages) |
| `public/lib/monitoring-log.js` | Moved the collapse rules out of the `@media (max-width:768px)` block so they apply on all viewports. Toggle button and JS were already present. | `?v=10` → `?v=11` (51 pages), `?v=18` → `?v=19` (1 page: REC 7.1) |

Verified live: on both a `form-record` page (REC 7.6.1) and a `monitoring-log` page (REC 7.9.1) the panel body is `display:none` on load, the button reads "Show", and clicking toggles body visibility and the button label.

## Relevance to Field Inventory

Because this panel is collapsed until triggered, any future data-extraction or audit pass must expand it (or read the source `config.instructions` array) — a plain page read will miss it.

**Content already extracted (2026-08-31):** pulled directly from each record's `config.instructions` array. 52 of 120 records carry a Work Instructions block; the other 68 have none. Full text in [Work-Instructions-Content-Extract.md](Work-Instructions-Content-Extract.md). Section 6 item 1 of the [Field Inventory](Processing-Department-Field-Inventory.md) is closed.
