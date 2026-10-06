# REC 7.4.2 Dry Monitoring: print/PDF layout (instructions for Claude Code)

**Date:** 2026-10-05
**Raised by:** Michaela — "7.4.2 have top job info section, below that have the fields required. all to be in 4 columns"
**Clarification:** These changes apply to the **printed PDF only**. The on-screen UI is unchanged.
**Scope:** REC 7.4.2 only (`dry-monitoring`). Print stylesheet / PDF output changes only — no new fields, no DB changes, no calculation changes, no UI layout changes.
**Builds on:** `rec-7.4.2-job-info-section-split-instructions.md` and `rec-7.4.2-dry-monitoring-field-changes-instructions.md`. Both must be applied first (or applied together with this file).

---

## 1. Print layout intent

When REC 7.4.2 is printed or exported to PDF, the sheet must have two zones:

**Zone 1 — Job info block (top of page)**
A clearly delineated header block spanning the full page width, showing the job number and any key job details (pulled from the confirmed job). This sits at the very top of the printed sheet, above all other fields.

**Zone 2 — Fields area (below job info block)**
All record fields — Dry room details, Checks, Comments, Sign off — are laid out in a **4-column grid** on the printed page. The goal is a compact, scan-friendly A4 sheet.

---

## 2. Print grid specification

```
┌─────────────────────────────────────────────────────────────────┐
│  JOB INFO  ·  DPR01167  ·  [key job details]                    │  ← Full-width header block
└─────────────────────────────────────────────────────────────────┘

DRY ROOM DETAILS
│ Entry date        │ Cooking date      │ Est. drying date  │ Dry room area    │
│ No. of trolleys   │                   │                   │                  │

CHECKS
│ Trolleys marked   │ Mould visible     │ White salt        │ Case hardening   │
│ Surface shine     │ Foot damage       │ Corrective action (colspan 2)        │

COMMENTS
│ Comments (colspan 4)                                            │

SIGN OFF
│ Completed by      │ Title             │ Date              │ Signature        │
```

### Print rules

- **4 equal columns** across the full printable width using a CSS grid or table layout inside the print stylesheet (`@media print`).
- **Section headings** (Dry room details, Checks, Comments, Sign off) span all 4 columns as a full-width bold label row with a bottom border.
- **Multi-line fields** (Comments textarea, Corrective action) span all 4 columns (`grid-column: 1 / -1` or `colspan="4"`).
- **Field label** printed **bold** (font-weight 600) above the value.
- **Field value** printed in normal weight (font-weight 400) below the label.
- **Read-only fields** (Entry date, Cooking date, Est. drying date, No. of trolleys) print identically to editable fields — no special styling needed in print.
- **Yes/No answers** print as the word Yes or No in bold, with the red/green colour rule from `rec-7.4.2-dry-monitoring-field-changes-instructions.md` applied in colour print and as bold + border on black-and-white.
- **Signature cell** (Sign off row) prints as a blank box of sufficient height for a handwritten signature.
- **Font:** match `rec-7.4.0-print-layout-instructions.md` — 9.5 px compact print size if `printCompact: true` is set, 8 mm margins.
- **Fits on one A4 page.** If the content overflows, reduce row heights and font size before adding a second page.
- **Old-value fields** (`date_old`, `qc_check_old`, `supervisor_old`) — print only when the entry has a value in them. Shown at the bottom of the relevant section spanning all 4 columns, labelled `(old)`, italic.

---

## 3. Implementation notes for Claude Code

1. **Print stylesheet only.** All changes go inside `@media print` rules (or the existing `.fr-print` / `.fr-sheet` print classes used by `form-record.js`). Do not touch any screen layout.
2. **Reference `rec-7.4.0-print-layout-instructions.md`** for the existing print class names, font sizes and margin values — match them exactly so 7.4.2 feels consistent with other records.
3. The 4-column print layout can be implemented as either a CSS grid (`display: grid; grid-template-columns: repeat(4, 1fr)`) or an HTML table rendered only in print — whichever is simpler given the existing print template structure in `form-record.js`.
4. **Job info print block:** the existing job info confirmation data (job number, farm, processing for, etc.) should print as a clearly separated header block at the top. Check how REC 7.4.0 or 7.4.1 renders job info in print and match that pattern.
5. **Bump `?v=`** on all scripts loaded by the 7.4.2 HTML page after any `form-record.js` change.
6. **Do not change** any screen-facing CSS, grid, flexbox or layout rules. Screen UI is unchanged.

---

## 4. Test checklist (print only)

1. Print preview (Ctrl+P / Cmd+P) of a saved 7.4.2 entry shows the job info block full-width at the top.
2. All fields below print in 4 columns.
3. Section headings span full width.
4. Comments and Corrective action span full width.
5. Sign off row: 4 cells, Signature cell has a blank box.
6. Field labels are bold; field values are normal weight.
7. Fits on one A4 page.
8. Black-and-white print: Yes/No answers distinguishable without colour (bold + border).
9. Old-value fields print only on entries that have them.
10. Screen UI is **unchanged** — 4-column layout does NOT appear on screen.

---

## 5. Paste-ready prompt for Claude Code

> Read `claude/rec-7.4.2-layout-4col-instructions.md` and apply it to REC 7.4.2. **Print/PDF only — do not change the screen UI.**
>
> In the print stylesheet (`@media print`) for REC 7.4.2:
> 1. **Job info block** — full-width header at the top of the printed sheet showing job number and key job details.
> 2. **4-column grid** — all sections below job info (Dry room details, Checks, Comments, Sign off) print in 4 equal columns. Section headings, Comments and Corrective action span all 4 columns.
> 3. **Typography** — field labels bold (600), field values normal weight (400).
> 4. Fits on one A4 page. Match font size and margins from `rec-7.4.0-print-layout-instructions.md`.
>
> No changes to screen layout, CSS grid, flexbox or any on-screen styles. Bump `?v=` on scripts. Run the test checklist in section 4 and report pass/fail per item.
