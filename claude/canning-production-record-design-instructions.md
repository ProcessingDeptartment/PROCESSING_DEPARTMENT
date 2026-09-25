# Canning Production Record — Design & Layout Instructions

**Record Type:** REC-7.3.X Canning Production (Cans Produced)  
**Status:** Design specification — v2 (updated with field refinements)  
**Date:** 2026-09-18

---

## Overview

This is a **new data-entry record** for capturing production details as cans move through the canning process. It replaces manual paper logging with structured form input, feeding data into the Canning Report and enabling traceability back to trolley/batch/retort.

Unlike the Canning Report (`canning-report.html`), which is read-only and summarizes submitted records, this form is where operators enter production data in real-time.

---

## 1. Form Structure — Layout Order

The form consists of **two semantic groups** that repeat, with damage/comments at the end.

### Group A: Trolley & Retort Info (single-row, once per trolley)
Captured at the moment a trolley enters a retort. All fields on one row.

| Field | Type | Required | Notes |
|---|---|---|---|
| Production Code | text / select | Yes | AG code (permanent fixture): e.g., `AG000001`, `AG000042` — 2-letter prefix + 6 digits. Pulled from Double Seam Inspection record AG codes. |
| Time Trolley In | datetime | Yes | When trolley entered retort (hour + minute). **Timestamp button available** to auto-fill with current time. |
| Retort Code | dropdown | Yes | Known retort codes dropdown (e.g., `R1`, `R2`, etc.). Fixed list. |
| Retort Number | dropdown | Yes | Retort serial number/identifier (e.g., `L1`, `R1`, etc.). Fixed list matching facility equipment. |
| Can Size | dropdown | Yes | Can size category (same dropdown as Double Seam Inspection record). Options: `Unit`, `Mince`. Applies to **all batches in this trolley**. |
| Cooking Method | dropdown | Yes | **Spacer for cooking times** — JS file holds list: `11 minutes`, `15 minutes`, `24 minutes`, + others. Developer to define full list. |

**Visual layout:** One row, 6 fields (wrapped on tablet and mobile). Fields stack vertically on screens <768px.

**Validation:**
- Production Code: must match existing AG code from Double Seam Inspection records (autocomplete/dropdown, filter to active codes).
- Time Trolley In: cannot be in future. Timestamp button sets to current time.
- Retort Code: dropdown selection only (fixed list).
- Retort Number: dropdown selection only (fixed list — `L1`, `R1`, etc.).
- Can Size: dropdown selection only. This applies to all batches under this trolley.
- Cooking Method: dropdown selection only. Times loaded from JS spacer configuration.

---

### Group B: Can Batch (repeating rows — multiple batches per trolley)
Once trolley info is entered, operator logs one or more can batches from that trolley.  
Each batch row captures one physical batch of cans cooked together.

#### Row Structure (repeating, one per batch):
| Field | Type | Required | Notes |
|---|---|---|---|
| Can Pieces | number | Yes | Count of pieces per can. **Range: 1–50 pieces allowed. Mince only** — dropdown/input must enforce this range. |
| Drain Weight | number | Yes | Weight in grams. **Pre-defined list (not free-entry):** `213g`, `80g`, `150g`, `238g`, `180g`, `200g`. User selects from dropdown. |
| Number of Cans | number | Yes | Integer count (1, 2, 3, ..., 1000+). |
| **Conditional:** Sauce Batch *(if Cooking Method = "Braised")* | text | **Yes if braised** | Sauce batch ID / code (e.g., `SB-2026-0917-001`). Appears/hides based on Cooking Method selection. |

**Visual layout:**
- Each batch is one row (4 columns, or 5 if Sauce Batch visible).
- Below Group A trolley row, indented or in a sub-section labeled "Can batches from this trolley."
- Each row has **two action buttons** (right side):
  - **Edit button** (pencil icon) — inline edit of the batch row fields.
  - **Delete button** (X icon) — removes batch row.
- At the end of the batch list: **+ Add Row button** (prominent, secondary color) — adds a new blank batch row.
- **Below all batch rows: TOTAL CANS counter** — sum of all "Number of Cans" values across all rows, displayed as `Total Cans: XXX`.

**Validation:**
- Can Pieces: integer 1–50, required.
- Drain Weight: must match one of the pre-defined options (`213g`, `80g`, `150g`, `238g`, `180g`, `200g`).
- Number of Cans: positive integer, > 0.
- Sauce Batch: **appears only if Cooking Method (from Group A) = one of the braised options**, and **is required if shown** (validated on submit, not on row add).

**Delete & Edit behavior:**
- Delete (X): removes that row immediately (no confirmation, since user can re-add).
- Edit (pencil): opens inline edit mode for that row; user can modify fields in place or cancel.
- If all rows are deleted, the trolley info remains and "+ Add Row" button is still available.

---

### Group C: Damage Report (below all can batches)
Captured once per trolley (not per batch).

| Field | Type | Required | Notes |
|---|---|---|---|
| X-Small Damaged Cans | number | **Yes** | Count of damaged cans in the X-small size for this trolley. |
| Damaged Cans (other sizes) | number | **Yes** | Count of damaged cans in other sizes for this trolley. |

**Visual layout:**
- Labeled section "Damage Report" with horizontal rule or light background.
- Two fields, side-by-side (or stacked on mobile).
- Both are **mandatory**: form cannot be submitted if either is missing or blank (even if value is 0, operator must enter 0 explicitly).

**Validation:**
- Both fields: non-negative integer only.
- Cannot submit if both are empty (at least one value required, even if 0).

---

### Group D: Comments (below damage report)
Free-text field for notes.

| Field | Type | Required | Notes |
|---|---|---|---|
| Comments | textarea | No | Free text, no character limit (or 500–1000 char soft limit for UI). |

**Visual layout:**
- Full-width textarea, 3–4 lines tall (expandable on mobile).
- Labeled "Comments" or "Additional Notes."
- Optional — form can be submitted blank.

---

## 2. Overall Form Submission Flow

1. **User fills Group A (trolley info)** — all 6 fields mandatory.
   - **Can Size set here applies to all batches in this trolley** (single medium type per production record).
2. **User adds Group B rows (can batches)** — minimum 1 row required before submit.
   - Each row must have Can Pieces, Drain Weight, Number of Cans.
   - If Cooking Method (from Group A) = braised, Sauce Batch is also required for that row.
3. **User views running total of cans** — sum of Number of Cans across all batch rows.
4. **User fills Group C (damage report)** — both fields mandatory (even if 0).
5. **User optionally adds Group D (comments)**.
6. **User clicks Submit** — form validates all groups, submits if clean, shows error banner if any group fails validation.

**On successful submit:**
- Record is saved as a new `canning-production:<production-code>:<timestamp>` namespaced key (following the existing KeyValue pattern).
- **No page redirect.** Form clears and shows confirmation toast ("Production record saved").
- User can immediately add another trolley's data (form is ready for fresh input).

---

## 3. Data Storage & Linkage

Each submitted production record becomes one entry in the `KeyValue` table:

**Key format:** `canning-production:<production-code>:<trolley-in-time-ISO8601>`  
**Value:** JSON object containing:
```json
{
  "productionCode": "AG000001",
  "timeIn": "2026-09-18T09:30:00Z",
  "retortCode": "R1",
  "retortNumber": "L1",
  "canSize": "Unit",
  "cookingMethod": "15 minutes",
  "batches": [
    {
      "canPieces": 25,
      "drainWeight": "213g",
      "numberOfCans": 50
    },
    {
      "canPieces": 30,
      "drainWeight": "238g",
      "numberOfCans": 30,
      "sauceBatch": "SB-2026-0918-001"
    }
  ],
  "damage": {
    "xSmallDamaged": 2,
    "otherSizesDamaged": 1
  },
  "comments": "Minor temperature spike at 11:15, corrected.",
  "submittedAt": "2026-09-18T11:45:00Z",
  "submittedBy": "michaela@abagold.co.za"
}
```

This structure allows:
- **Traceability:** batch → retort → trolley → AG code → Double Seam Inspection record → job.
- **Trends:** query by `timeIn` range, by cooking method/time, by can size, by medium type.
- **Integration:** Canning Report aggregates these records by `productionCode` to build summaries.

---

## 4. UI/UX Patterns (following the Processing Department standard)

- **Theme:** Use `record-theme.css` (tablet-friendly, side-by-side layouts on desktop, stacked on tablet/mobile).
- **Toolbar:** AG Code selector (like Canning Report), plus Submit button.
- **Validation messages:** inline error labels (red text) under failed fields, plus an error banner at the top of form if submit is clicked with errors.
- **Success feedback:** toast notification ("Production record saved") + form clears for next entry. No redirect.
- **Print/Export:** not needed for data-entry forms (this is input, not output like reports).

---

## 5. Mobile & Accessibility

- **Responsive:** fields stack vertically on tablet (<768px) and phone widths. Desktop shows horizontal flex layout.
- **Touch-friendly:** buttons ≥44px tall, 16px+ font for inputs.
- **Keyboard:** Tab order follows Group A → Group B (row by row) → Group C → Group D.
- **Date/time inputs:** use native `<input type="datetime-local">` (browser picker), with **timestamp button next to Time Trolley In** to auto-fill current time.
- **Dropdowns:** use native `<select>` for all fixed-list fields (Retort Code, Retort Number, Can Size, Cooking Method, Drain Weight). No complex autocomplete.

---

## 6. Spacer Items for Developer (JS Configuration)

The following fields have placeholder lists that must be developed/completed:

1. **Cooking Method times:**
   - Current spacer: `11 minutes`, `15 minutes`, `24 minutes`
   - Developer to confirm: Are there other cooking times? Any braised-specific times?
   - Store in a JS config object (e.g., `COOKING_METHODS` array or similar) so it's easy to update.

2. **Retort Codes & Retort Numbers:**
   - Current assumption: Fixed lists (R1, R2, etc. for Retort Code; L1, R1, etc. for Retort Number).
   - Developer to pull from facility config or database if those exist.

3. **Can Sizes:**
   - Match the dropdown from Double Seam Inspection record.
   - Confirm size options: `Unit`, `Mince`, or others?

---

## 7. Open Questions / Notes for Implementation

- **AG Code source:** Confirm exact record type to pull AG codes from (Double Seam Inspection assumed; verify).
- **Cooking times:** Is the list `11 min`, `15 min`, `24 min` complete, or are there more options (including braised-specific times)?
- **Can Pieces for Mince:** Is the 1–50 range correct for mince pieces per can? Should this enforce the range or just warn?
- **Retort serial vs. code:** Is Retort Number (L1, R1, etc.) truly fixed, or is it a secondary field that should allow free entry?
- **Sauce Batch field:** How is Cooking Method / Medium linked? Is it based on a fixed Cooking Method value, or a separate Medium dropdown?

---

## 8. Future Enhancements (out of scope for v1)

- **Barcode scanning:** Trolley ID / AG code QR codes to auto-fill fields.
- **Scale integration:** Direct input from a digital scale for Drain Weight.
- **Offline mode:** cache submitted records if network drops.
- **Intelligent agent role-out:** Workflow spec for scaling this form design pattern to other production records across the facility (see separate `intelligent-agent-role-out-template.md`).
- **Real-time dashboard:** live monitoring of production rate (cans/hour, trolleys completed) by retort/cooking method.

---

## 9. Design Notes

- **Can Size once per trolley:** All batches from a trolley share the same Can Size category (Unit or Mince), set in Group A. This mirrors real-world production (a trolley is dedicated to one can type).
- **Medium moved to trolley scope:** Cooking Method (which determines if Sauce Batch is needed) is set once per trolley, not per batch. This simplifies validation and aligns with how trolleys are used in practice.
- **Edit & Delete:** Both actions available on each batch row for flexibility if data entry errors occur.
- **Total Cans counter:** Running sum visible to operator to catch data-entry mistakes immediately.
- **No redirect on submit:** Form stays open and clears so operators can log the next trolley without navigation delays. Improves throughput.
