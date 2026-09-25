# Canning Report — Correct Layout Spec (source of truth: CPR02170)

**Purpose:** Michaela confirmed sheet `CPR02170` in `NEW CANNING REPORTS.xlsx` is the exact
layout the live Canning Report page must match. The current `public/pages/canning-report.html`
is missing / differs from several fields and sections below. This doc is the authoritative field
list and formula logic for Claude Code to bring `canning-report.html` in line — **do not use this
doc to build the Drying Report**, that is a separate, deliberately different layout (see
`claude/drying-report-spec.md`).

## Section-by-section spec (from CPR02170, row references are from the source workbook, for logic reference only — not literal spreadsheet cells to render)

### 1. Title
`CANNING JOB` + job number (e.g. `CPR02170`) as the page heading — canning-report.html already
has this via the job selector; keep it, just confirm the label reads "Canning Job" not something
generic.

### 2. JOB DETAILS (currently missing fields — canning-report.html does NOT show these today)
- Processed for
- GRN No.
- PO No.
- Cost per Kg
- Delivery note no.

These four (GRN No., PO No., Cost per Kg, Delivery note no.) are **not currently rendered** on
canning-report.html and must be added. Source: same `abalone-receiving` / job header record used
for "Processed for" today — if GRN/PO/cost-per-kg/delivery-note aren't already captured anywhere
in the receiving record, flag that as a gap (same pattern as the Drying Report spec: don't invent
data, surface the gap for a decision).

### 3. REPORT SUMMARY (partially present today — needs target columns added)
- Actual yield % = `Actual cans / Total whole weight * 100` (workbook formula: `B11/C37*100`,
  i.e. `213g equiv cans / harvest total whole weight * 100`)
- **Target yield** = 105 (this is a fixed constant in the workbook, matches
  `TARGET_YIELD = 105.00` already defined in canning-report.html — good, already correct)
- 213g equiv cans (actual) — already computed in canning-report.html as `equivCans`
- **Target cans** = `Harvest total whole weight * Target yield / 100` (workbook: `C37*E10/100`)
  — canning-report.html already computes `rep.targetCans` the same way. Confirm it's displayed;
  if only used internally, surface it in the Report Summary panel same as the workbook.
- Actual cans (already shown)
- **Comments** field (free text) — not currently on canning-report.html. This is a data-entry
  field on the source record, not something the report page itself edits; if there's no comments
  field anywhere upstream, flag as a gap rather than adding an editable field to a report page.

### 4. CAN SUMMARY (already present as "can breakdown" — check column parity)
Workbook columns: Production code | Quantity | D/W (drained weight) | Medium | NRCS AG code |
Additional NRCS cans, with a TOTAL row (`SUBTOTAL` over quantity).
canning-report.html's current can breakdown table: Production code | Quantity | Drained weight |
Medium | NRCS AG code — **missing the "Additional NRCS cans" column**. Add it.

### 5. HARVEST BREAKDOWN (already present, matches)
Receiving date | Size range | Whole weight | Animals | Weight per animal — canning-report.html
already renders this with a TOTAL row. No changes needed here.

### 6. PROCESSING MEASURES + EFFICIENCY INDICATORS (currently only half-built)
Two side-by-side blocks in the workbook:

**Processing measures** (canning-report.html already has this part):
- Out of salt weight: weight (kg) + % of harvest total whole weight
- Clean weight: weight (kg) + %
- Precook weight: weight (kg) + %

**Efficiency indicators** (missing from canning-report.html today — add as a second block next to
Processing Measures):
- Whole mass per can = `Harvest total whole weight / 213g equiv cans` (workbook: `C37/B11`) —
  canning-report.html already computes `massPerCan` this way but currently renders it as a single
  row inside the Processing Measures table ("Whole mass per can" total row). The workbook treats
  it as part of a separate "Efficiency Indicators" panel alongside two more metrics — reposition
  it there.
- Canning efficiency — present as a label in the workbook but the formula cell is blank in
  CPR02170 (no data yet in the source job). Add the row/label; leave value blank until there's a
  defined formula. Flag as open question: what is "Canning efficiency" calculated from? Not
  derivable from CPR02170 alone (empty in the sample) — ask Michaela before inventing a formula.
- Actual yield (repeated here in the workbook, same value as Report Summary's actual yield —
  `B11/C37*100`) — just display the same computed value in this panel too, don't recompute
  differently.

### 7. CAN BREAKDOWN (stock-code level detail — this table is MISSING ENTIRELY from
canning-report.html today; it currently only has "Can breakdown" as an alias for what the
workbook calls "Can summary" — see section 4 above. The workbook has a SEPARATE, second table
further down called "Can breakdown" with different, more detailed columns)

Columns: Stock code | Cans | Pcs/can | N/W (net weight) | D/W (drained weight) | Description |
213g equiv.
- 213g equiv. per row = `Cans * D/W / 213` (workbook: `=IF(B=="","",B*E/213)`)
- TOTAL row: sum of Cans, N/W, D/W, Description(?), 213g equiv columns (workbook sums B, D, E, F,
  G — note F "Description" being summed in the workbook is likely a spreadsheet artifact/blank
  column with SUM(blank)=0, not meaningful; canning-report.html should just sum the numeric
  columns: Cans, N/W, D/W, 213g equiv, and leave Description out of the total)

This is a **genuinely new table** to add to canning-report.html — it does not exist there today
in this stock-code-level form (as distinct from the Can Summary table in section 4, which is
keyed by production code / AG code, not stock code).

## What canning-report.html gets RIGHT already (no change needed)
- Harvest breakdown table and its TOTAL row
- Can Summary table's core columns (just needs "Additional NRCS cans" added)
- Processing measures (out of salt / clean / precook weight + %)
- Target yield constant (105), actual yield formula, target cans formula, 213g equiv constant
  (213g)
- CSV export / Print / job selector toolbar pattern — reuse as-is

## Summary of concrete changes needed to `public/pages/canning-report.html`
1. Add Job Details fields: GRN No., PO No., Cost per Kg, Delivery note no. (flag as a data-source
   gap if not captured anywhere upstream yet)
2. Add a Comments field to Report Summary (flag as a data-source gap if no upstream field exists)
3. Add "Additional NRCS cans" column to the existing Can Summary table
4. Split "Whole mass per can" out of Processing Measures into its own Efficiency Indicators panel,
   and add Canning Efficiency (formula TBD — ask Michaela) and a repeated Actual Yield row there
5. Add the entirely new stock-code-level Can Breakdown table (Stock code | Cans | Pcs/can | N/W |
   D/W | Description | 213g equiv.) with its own TOTAL row
6. Apply the job-number-prefix filter from `claude/drying-report-spec.md` (`3CP`/`CPR` only in
   this report's job dropdown) — already documented there, just confirming it applies here too

## Open questions for Michaela before Claude Code builds items 1, 2, and 4b (Canning efficiency)
- Where do GRN No., PO No., Cost per Kg, Delivery note no., and Comments get captured today (is
  there an existing intake/receiving form field, or do these need a new field added somewhere
  upstream)?
- What is "Canning efficiency" supposed to be calculated from? CPR02170's own formula cell was
  blank, so the source workbook doesn't define it either.

## Status
Ready to hand to Claude Code for the concrete, unambiguous items (3, 5, 6). Items 1, 2, and the
"Canning efficiency" formula in item 4 need a quick answer from Michaela first — Claude Code can
build the field slots but should not guess a data source or formula for them.
