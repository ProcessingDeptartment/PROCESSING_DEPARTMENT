# Canning Report — Data Improvement Suggestions (based on CPR02170)

Michaela asked what data could be added, based on the reference layout in CPR02170. These are
suggestions, not committed scope — pick which ones to actually build and I'll fold the approved
ones into `claude/canning-report-layout-spec.md` for Claude Code.

## 1. SYSPRO Yield + Deviation (highest-value addition, not yet in any spec)

The workbook's `Monthly Summary` sheet pulls a **"SYSPRO Yield"** figure per job and computes
`Deviation = SYSPRO Yield − Actual Yield`. This doesn't exist anywhere in the current
canning-report.html spec. SYSPRO is presumably your accounting/stock system's own yield number —
having the live report show the app's calculated Actual Yield *next to* what SYSPRO recorded, and
flag the deviation, would catch data-entry mismatches or stock discrepancies between the shop
floor record and the accounting system before they compound. Worth adding as:
- SYSPRO Yield (manually entered per job, since it comes from an external system) — needs a home
  in the job/receiving record, or a small field on the report itself
- Deviation = SYSPRO Yield − Actual Yield, shown with a flag/color if it exceeds a tolerance
  (e.g. ±2%)

## 2. Canning Efficiency — needs a real definition
Flagged already in the layout spec as blank in the source workbook. Worth deciding now while
you're looking at what to add: is this meant to be cans-per-labour-hour, cans-per-shift,
percentage of target cans achieved, or something else? Once defined it's a real, trackable KPI
worth keeping on the report.

## 3. Stock code → description consistency check
The `DATA_ALWAYS REFRESH` sheet holds a full stock-code-to-description lookup (hundreds of rows,
e.g. `CAAB1001` → "CANNED ABALONE 425G NW 213 DW ABAGOLD P1"). The report's stock-code-level Can
Breakdown table currently just has a free-text "Description" column. If that lookup list were
brought into the database as a proper stock-code reference table, the report could auto-fill and
validate the description from stock code instead of relying on manual entry — reduces typos and
keeps stock codes and descriptions in sync automatically. This is a bigger structural change
(a new reference table), not a quick field addition — worth flagging as a separate project-level
decision (ties into your "database must have clear structure, easy to move to another format"
requirement).

## 4. Damaged cans as its own tracked field
The stock-code lookup includes a `DAM 150 g` / "DAMAGED 750G NW 150G DW" entry, implying damage is
already tracked somewhere as its own stock-code line. If damaged cans aren't currently broken out
as a distinct field on the job report (separate from the main Can Breakdown), consider adding a
"Damaged cans" count/weight row — useful for a damage-rate KPI over time (you already show a
"Can damage rate" tile on the dashboard, per `public/index.html`, so having it sourced cleanly per
job would make that dashboard number traceable back to individual jobs).

## 5. Target vs Actual, consistently, everywhere
CPR02170 already computes both Target Cans and Actual Cans, Target Yield and Actual Yield. Since
you're adding SYSPRO Yield as a third comparison point (#1 above), it may be worth standardizing
a single "Target / Actual / External(SYSPRO) / Deviation" row pattern across all three yield-type
metrics, rather than scattering them. Purely a presentation/consistency suggestion, not new data.

## 6. Job-level notes/comments, properly wired
Already flagged in the layout spec as missing a data source. Worth calling out again here because
it's genuinely useful data to capture, not just a cosmetic field — comments on the source workbook
jobs likely explain irregular results (delays, damaged batches, etc.) and without a comments field
in the live system, that context gets lost once someone moves off spreadsheets.

## Suggested priority if you want to move on these
1. SYSPRO Yield + Deviation — highest value, directly catches discrepancies
2. Comments field — cheap to add, preserves institutional knowledge
3. Canning Efficiency definition — decide the formula, then it's trivial to add
4. Damaged cans as a distinct field — ties into an existing dashboard metric
5. Stock code reference table — bigger lift, but pays off for your "clear, structured, easy to
   manipulate" database goal; good candidate for a dedicated follow-up task rather than bundling
   into the report fix

## Status
Awaiting your call on which of these to greenlight. Once you pick, I'll update
`claude/canning-report-layout-spec.md` with the approved additions so Claude Code has one clean
spec to build from.
