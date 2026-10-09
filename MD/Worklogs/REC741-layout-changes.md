# REC 7.4.1 Layout Changes — Instruction File

**Files to edit:**
- `data/record-definitions.json` — field/section config (JSON)
- `public/lib/form-record.js` — rendering engine (JS)

---

## 1 · Job info section — 4 columns × 3 rows

**Goal:** The Job info block on screen AND on the PDF print must render as a
4-column, 3-row grid (12 slots).

**Current fields (5 only):**

| Key | Label |
|-----|-------|
| jobNo | Job number |
| jiReceivingDate | Receiving date |
| jiReceivedFrom | Received from (farm) |
| jiProcessingFor | Processing for |
| jiIntakeWeight | Whole weight (kg) |

5 fields in a 4-col grid gives 2 rows, not 3.
**Action needed — one of:**
- (a) Confirm which additional fields to add to Job info to reach 9-12 visible fields, OR
- (b) Confirm that the 5 fields stay but the 3rd row should be blank/spacer.

Candidate fields already in the record (currently in "Cooked weight" section):
- `entryDate` — Entry date (read-only, server stamp)
- `noOfTrolleys` — No. of trolleys (see section 2 below)

**JSON change — once field list is confirmed:**
In `record-definitions.json`, for the `drying-process` record:
```json
// Job info section extraJson already has:
{ "collapsible": true, "summaryField": ["jobNo","jiProcessingFor"], "cols": 4 }
// cols:4 is already set — just confirm the field list is complete.
```
Move any additional fields into the Job info section by changing their
`sectionIndex` to `0` (Job info is index 0).

**Print layout:**
`sheetOneSectionHtml` currently renders sections as a 2-col label/value table.
To match 4-col on the PDF, add `"printCols": 4` to the Job info `extraJson`
and update `sheetOneSectionHtml` to read `sec.printCols` and emit
`<td class="fr-sheet-lbl">` + `<td>` pairs in groups of `printCols/2` per row.

---

## 2 · Trolleys line — between Job info and Steams

**Goal:** After the Job info block, show a clearly spaced standalone line:

```
No. of trolleys:  5
```

This is NOT inside the field grid — it is a full-width display line, visually
separated with top/bottom margin so it stands out.

**Field:** `noOfTrolleys` — already in the record (currently in section index 2,
"Cooked weight"). The value is set by the server guard when the first steam is
submitted, and is carried unchanged on all later entries for the same job.

**Implementation options:**

### Option A — Banner section (recommended)
Create a new `fields` section in the DB/JSON between Job info (pos 1) and
the Steams roster (pos 3), with `extraJson`:
```json
{
  "trolleyBanner": true,
  "bannerField": "noOfTrolleys",
  "bannerLabel": "No. of trolleys"
}
```
In `form-record.js` `renderSection`, detect `sec.trolleyBanner` and render:
```html
<div class="fr-trolley-banner">
  <span class="fr-trolley-lbl">No. of trolleys</span>
  <span class="fr-trolley-val">{value}</span>
</div>
```
Add CSS:
```css
.fr-trolley-banner { display:flex; gap:16px; align-items:baseline;
  padding:10px 0; border-top:1px solid #d0d3d6; border-bottom:1px solid #d0d3d6;
  margin:12px 0; font-size:15px; font-weight:600; }
.fr-trolley-lbl { color:#54606b; font-weight:400; }
.fr-trolley-val { font-size:20px; font-weight:700; }
```
On the PDF (`sheetOneSectionHtml`), render as a single full-width table row.

### Option B — Simpler: add noOfTrolleys to Job info + style it as a span
Move `noOfTrolleys` into Job info section, set `extraJson.span = 4` on the
field so it takes the full row, and style it larger. Less clean but fewer
engine changes.

---

## 3 · Steams — tabulated (already done)

`roster.printTable: true` is already set in `record-definitions.json`.
`sheetOneRosterHtml` already renders a flat table when `printTable` is true.
No further changes needed for the steams table.

---

## 4 · "All in a table" — PDF

The user wants the full print (job info + trolleys line + steams) to read as
a single coherent document, not separate floating sections.
The `fr-sheet-compact` print CSS (already applied via `printCompact:true`)
tightens spacing. If the print sections need an explicit outer border/box,
add `border: 1px solid #000` to `.fr-sheet.fr-sheet-compact .fr-sheet-page`.

---

## Summary of pending actions

| # | What | Where | Status |
|---|------|--------|--------|
| 1 | Confirm Job info field list (9-12 fields for 4×3) | Michaela to confirm | ⏳ |
| 2 | 4-col print layout for Job info section | `form-record.js` `sheetOneSectionHtml` | 🔧 |
| 3 | Trolleys banner between Job info and Steams | `form-record.js` + `record-definitions.json` | 🔧 |
| 4 | Steams flat table on PDF | Done | ✅ |
| 5 | Compact single-page print | Done | ✅ |
