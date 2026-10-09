# REC 7.4.2 Dry Monitoring: 4-column layout (instructions for Claude Code)

**Date:** 2026-10-05
**Raised by:** Michaela — "7.4.2 have top job info section, below that have the fields required. all to be in 4 columns"
**Scope:** REC 7.4.2 only (`dry-monitoring`). Layout change only — no new fields, no DB changes, no calculation changes.
**Builds on:** `rec-7.4.2-job-info-section-split-instructions.md` and `rec-7.4.2-dry-monitoring-field-changes-instructions.md`. Both must be applied first (or applied together with this file). This file adds the grid layout rule on top of those changes.

---

## 1. Layout intent

The record page has two visual zones:

**Zone 1 — Job info bar (top)**
A single collapsible header bar that spans the full page width. On load it shows the job number picker only. After the job is confirmed it collapses to one line: `JOB INFO · <job no>` with a small "Change" link. This is unchanged from the split instructions.

**Zone 2 — Fields area (below the Job info bar)**
Every section below Job info — Dry room details, Checks, Comments, Sign off — renders its fields in a **4-column grid**. All four sections share the same grid so the columns are visually aligned across sections.

---

## 2. Grid specification

```
┌──────────────────────────────────────────────────────────────────┐
│  JOB INFO  ·  DPR01167                              [▲ collapse]  │  ← Full-width bar
└──────────────────────────────────────────────────────────────────┘

── DRY ROOM DETAILS ───────────────────────────────────────────────
│ Entry date (r/o)  │ Cooking date (r/o)│ Est. drying date (r/o)│ Dry room area ▾ │
│ No. of trolleys(r/o)│               │                       │                 │

── CHECKS ─────────────────────────────────────────────────────────
│ Trolleys marked   │ Mould visible     │ White salt            │ Case hardening  │
│ Surface shine     │ Foot damage       │ Corrective action     │                 │

── COMMENTS ───────────────────────────────────────────────────────
│ Comments (colspan 4)                                            │

── SIGN OFF ───────────────────────────────────────────────────────
│ Completed by      │ Title             │ Date                  │ Signature       │
└──────────────────────────────────────────────────────────────────┘
```

### Rules

- **Desktop (≥ 900 px):** 4 equal columns, `grid-template-columns: repeat(4, 1fr)`.
- **Tablet (600 – 899 px):** 2 columns, `repeat(2, 1fr)`. Fields flow in reading order.
- **Mobile (< 600 px):** 1 column, stacked.
- **Section headers** (Dry room details, Checks, Comments, Sign off) span all 4 columns as full-width collapsible bars, same style as Job info. Font, height and collapse behaviour match the existing section header component.
- **Multi-line fields** (Comments, Corrective action textarea) span all 4 columns (`grid-column: 1 / -1`).
- **Read-only fields** (Entry date, Cooking date, Est. drying date, No. of trolleys) are visually distinct: light grey background, lock icon or read-only label, same cell size as editable fields so the grid stays even.
- **Yes/No buttons** (Checks section): each question and its Yes/No buttons sit in one cell. The question label above, the two buttons below side by side. The cell is tall enough to hold both rows without overflow.
- **Completed by block** (Sign off): Completed by · Title · Date · Signature each get one column. Signature cell holds the canvas/pad element; it may be taller than the other three and the row stretches to fit.
- **Field labels** are above the input (label-on-top layout), consistent with the existing record style.
- **Gap:** 12 px column gap, 16 px row gap. No outer horizontal scroll at any breakpoint.
- **Old-value fields** (`date_old`, `qc_check_old`, `supervisor_old`) — shown only on old entries that have a value. They appear as an extra row at the bottom of the relevant section, spanning all 4 columns, styled muted/italics and labelled `(old)`.

---

## 2b. Header fix

The section header bars (Job info, Dry room details, Checks, Comments, Sign off) must match the existing site header style exactly:

- Same font size, weight, colour, background and height as the other record section headers in the app.
- If the current 7.4.2 implementation uses a custom or overridden header style, remove the override and let the shared component's default styles apply.
- The collapse chevron/arrow is right-aligned in the bar, same as all other records.
- Do not introduce a new header style for this record — reuse the shared one unchanged.

---

## 2c. Field label and answer typography

Inside every field cell in the grid:

- **Question / field label:** `font-weight: 600` (semi-bold). One line above the input.
- **Answer / input:** `font-weight: 400` (normal). This applies to:
  - Typed text inputs and textareas
  - Dropdown selected value
  - Read-only value text
  - Yes/No button text (the button label itself, not the question)
- The contrast between the bold label and the normal-weight answer makes the form quicker to scan on a tablet.
- Apply via the existing field-label class (`font-weight: 600`) and the existing input/answer class (`font-weight: 400`). Scoped to 7.4.2 if the shared style differs elsewhere.

---

## 3. Section order (unchanged from split instructions)

1. **Job info** — full-width bar, top of page, job number picker → collapses after confirm.
2. **Dry room details** — Entry date (r/o), Cooking date (r/o), Est. drying date (r/o), Dry room area (dropdown), No. of trolleys (r/o).
3. **Checks** — Trolleys clearly marked, Mould visible, White salt on surface, Case hardening, Surface shine, Foot damage, Comment / corrective action.
4. **Comments** — Comments (full-width textarea).
5. **Sign off** — Completed by block (Completed by, Title, Date, Signature).

All sections are collapsible; all open on load. Only Job info auto-collapses after job is confirmed.

---

## 4. Implementation notes for Claude Code

1. **CSS grid on the section body wrapper.** The section body `<div>` (whatever class the renderer uses for the area below the section header) gets `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 12px;` via a scoped class, e.g. `.rec-7-4-2-section-body`.
2. **Do not change the shared section component** for other records. Apply the 4-column class only on the 7.4.2 page (or by a per-record flag in the record definition, e.g. `"layout": "4col"`).
3. **Responsive via CSS** (media queries), not JS. The grid collapses to 2-col at tablet and 1-col at mobile breakpoints as above.
4. **Job info bar stays full width.** It is outside the grid container.
5. **Progress counter** (x of y fields done) sits in the section header bar, not in a grid cell.
6. **Bump `?v=`** on all scripts and stylesheets loaded by the 7.4.2 page after these changes.

---

## 5. Test checklist (layout)

1. Desktop: all field sections show 4 columns, no overflow.
2. Tablet (≈ 768 px wide): all sections show 2 columns.
3. Mobile (≈ 375 px): single column, all fields visible.
4. Job info bar is full width at every breakpoint.
5. Yes/No cells display question + two buttons without clipping.
6. Comments and Corrective action textareas span full width.
7. Completed by block: 4 cells, signature canvas renders correctly in its cell.
8. Old-value row (if old entry): spans full width, muted style.
9. Print: use the existing print stylesheet; ensure 4-col grid collapses gracefully to print (print stylesheet may use 2-col for readability — match existing print layout from `rec-7.4.0-print-layout-instructions.md`).
10. No horizontal scroll at any tested width.
11. Section headers match the shared site header style — no custom overrides, chevron right-aligned.
12. Every field cell: label is bold (600), input/answer text is normal weight (400). Yes/No button labels are normal weight.

---

## 6. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.2-layout-4col-instructions.md` and apply it to REC 7.4.2. Three changes together:
>
> 1. **Layout — 4-column grid.** Two zones: (a) a full-width Job info bar at the top (job number picker, collapses after confirm); (b) all sections below — Dry room details, Checks, Comments, Sign off — in a 4-column CSS grid (`repeat(4, 1fr)`). Responsive: 2-col at tablet (< 900 px), 1-col at mobile (< 600 px). Multi-line fields and section headers span all 4 columns. Scoped CSS class on the 7.4.2 page only, no changes to shared components.
>
> 2. **Header fix.** Remove any custom header-bar overrides on 7.4.2 section headers. Use the shared section-header component style unchanged (same font, height, background, chevron position as all other records).
>
> 3. **Typography.** Field labels bold (`font-weight: 600`); all answer/input text normal weight (`font-weight: 400`), including Yes/No button labels and read-only values.
>
> Bump `?v=` on all scripts and stylesheets. Run the test checklist in section 5 and report pass/fail per item.
