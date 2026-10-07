# Canning Records, Canning Report, Job Status and NRCS

Canning production record, canning report, job status/details and NRCS canning roster work.

_Consolidated from 13 original files. Cross-references inside the text to old file names refer to the original files; see `00_INDEX.md` for where each one now lives._

## Contents

1. [Canning Production Record — Design & Layout Instructions](#canning-production-record--design--layout-instructions) — `claude/canning-production-record-design-instructions.md`
2. [Canning Production Record — Technical Specification for Implementation](#canning-production-record--technical-specification-for-implementation) — `claude/canning-production-record-technical-spec.md`
3. [Canning Report — Correct Layout Spec (source of truth: CPR02170)](#canning-report--correct-layout-spec-source-of-truth-cpr02170) — `claude/canning-report-layout-spec.md`
4. [Canning Report — Improvement Brief for Claude Design](#canning-report--improvement-brief-for-claude-design) — `claude/canning-report-design-improvements-brief.md`
5. [Canning Report — Data Improvement Suggestions (based on CPR02170)](#canning-report--data-improvement-suggestions-based-on-cpr02170) — `claude/canning-report-data-improvement-suggestions.md`
6. [Canning Report — Three Fixes Requested by Michaela (2026-09-17)](#canning-report--three-fixes-requested-by-michaela-2026-09-17) — `claude/canning-report-fixes-2026-09-17.md`
7. [Canning Report / Job Status changes — 2026-09-11](#canning-report--job-status-changes--2026-09-11) — `Claude outputs/canning-report-and-job-status-changes.md`
8. [Job Details Entry — Brief for Claude Design (updated 2026-09-11)](#job-details-entry--brief-for-claude-design-updated-2026-09-11) — `claude/job-details-modal-design-brief.md`
9. [Job Status — Job Details bugs and corrected rule (updated 2026-09-11)](#job-status--job-details-bugs-and-corrected-rule-updated-2026-09-11) — `claude/job-status-bugfix-brief.md`
10. [Instruction file for Claude Code](#instruction-file-for-claude-code) — `claude/nrcs-canning-production-codes-roster-instructions.md`
11. [Instruction file for Claude Code](#instruction-file-for-claude-code) — `claude/nrcs-canning-batch-search-instructions.md`
12. [Instruction file for Claude Code](#instruction-file-for-claude-code) — `claude/nrcs-canning-add-view-verify-gate-instructions.md`
13. [Testing checklist — NRCS Canning roster Add → View → Verify flow](#testing-checklist--nrcs-canning-roster-add--view--verify-flow) — `claude/nrcs-canning-roster-verification-testing-checklist.md`

---

## Canning Production Record — Design & Layout Instructions

> **Source:** `claude/canning-production-record-design-instructions.md`

**Record Type:** REC-7.3.X Canning Production (Cans Produced)  
**Status:** Design specification — v2 (updated with field refinements)  
**Date:** 2026-09-18

---

### Overview

This is a **new data-entry record** for capturing production details as cans move through the canning process. It replaces manual paper logging with structured form input, feeding data into the Canning Report and enabling traceability back to trolley/batch/retort.

Unlike the Canning Report (`canning-report.html`), which is read-only and summarizes submitted records, this form is where operators enter production data in real-time.

---

### 1. Form Structure — Layout Order

The form consists of **two semantic groups** that repeat, with damage/comments at the end.

#### Group A: Trolley & Retort Info (single-row, once per trolley)
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

#### Group B: Can Batch (repeating rows — multiple batches per trolley)
Once trolley info is entered, operator logs one or more can batches from that trolley.  
Each batch row captures one physical batch of cans cooked together.

##### Row Structure (repeating, one per batch):
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

#### Group C: Damage Report (below all can batches)
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

#### Group D: Comments (below damage report)
Free-text field for notes.

| Field | Type | Required | Notes |
|---|---|---|---|
| Comments | textarea | No | Free text, no character limit (or 500–1000 char soft limit for UI). |

**Visual layout:**
- Full-width textarea, 3–4 lines tall (expandable on mobile).
- Labeled "Comments" or "Additional Notes."
- Optional — form can be submitted blank.

---

### 2. Overall Form Submission Flow

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

### 3. Data Storage & Linkage

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

### 4. UI/UX Patterns (following the Processing Department standard)

- **Theme:** Use `record-theme.css` (tablet-friendly, side-by-side layouts on desktop, stacked on tablet/mobile).
- **Toolbar:** AG Code selector (like Canning Report), plus Submit button.
- **Validation messages:** inline error labels (red text) under failed fields, plus an error banner at the top of form if submit is clicked with errors.
- **Success feedback:** toast notification ("Production record saved") + form clears for next entry. No redirect.
- **Print/Export:** not needed for data-entry forms (this is input, not output like reports).

---

### 5. Mobile & Accessibility

- **Responsive:** fields stack vertically on tablet (<768px) and phone widths. Desktop shows horizontal flex layout.
- **Touch-friendly:** buttons ≥44px tall, 16px+ font for inputs.
- **Keyboard:** Tab order follows Group A → Group B (row by row) → Group C → Group D.
- **Date/time inputs:** use native `<input type="datetime-local">` (browser picker), with **timestamp button next to Time Trolley In** to auto-fill current time.
- **Dropdowns:** use native `<select>` for all fixed-list fields (Retort Code, Retort Number, Can Size, Cooking Method, Drain Weight). No complex autocomplete.

---

### 6. Spacer Items for Developer (JS Configuration)

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

### 7. Open Questions / Notes for Implementation

- **AG Code source:** Confirm exact record type to pull AG codes from (Double Seam Inspection assumed; verify).
- **Cooking times:** Is the list `11 min`, `15 min`, `24 min` complete, or are there more options (including braised-specific times)?
- **Can Pieces for Mince:** Is the 1–50 range correct for mince pieces per can? Should this enforce the range or just warn?
- **Retort serial vs. code:** Is Retort Number (L1, R1, etc.) truly fixed, or is it a secondary field that should allow free entry?
- **Sauce Batch field:** How is Cooking Method / Medium linked? Is it based on a fixed Cooking Method value, or a separate Medium dropdown?

---

### 8. Future Enhancements (out of scope for v1)

- **Barcode scanning:** Trolley ID / AG code QR codes to auto-fill fields.
- **Scale integration:** Direct input from a digital scale for Drain Weight.
- **Offline mode:** cache submitted records if network drops.
- **Intelligent agent role-out:** Workflow spec for scaling this form design pattern to other production records across the facility (see separate `intelligent-agent-role-out-template.md`).
- **Real-time dashboard:** live monitoring of production rate (cans/hour, trolleys completed) by retort/cooking method.

---

### 9. Design Notes

- **Can Size once per trolley:** All batches from a trolley share the same Can Size category (Unit or Mince), set in Group A. This mirrors real-world production (a trolley is dedicated to one can type).
- **Medium moved to trolley scope:** Cooking Method (which determines if Sauce Batch is needed) is set once per trolley, not per batch. This simplifies validation and aligns with how trolleys are used in practice.
- **Edit & Delete:** Both actions available on each batch row for flexibility if data entry errors occur.
- **Total Cans counter:** Running sum visible to operator to catch data-entry mistakes immediately.
- **No redirect on submit:** Form stays open and clears so operators can log the next trolley without navigation delays. Improves throughput.

---

## Canning Production Record — Technical Specification for Implementation

> **Source:** `claude/canning-production-record-technical-spec.md`

**Record Type:** REC-7.3.X Canning Production (Cans Produced)  
**Target File:** `public/pages/canning-production.html`  
**Status:** Ready to implement  
**Date:** 2026-09-17

---

### 1. File Structure & Entry Point

**File:** `public/pages/canning-production.html`

**Required dependencies (all existing in the project):**
- `public/lib/data-store.js` — storage adapter (`window.storage.get/set/remove`)
- `public/lib/common.js` — utility functions (DOM manipulation, validation, formatting)
- `public/lib/traceability.js` — optional, for linking records to job/batch
- `public/lib/api-backend.js` — backend connectivity

**External dependencies:** None beyond what's already in `public/lib/`.

---

### 2. HTML Structure & Form Elements

#### 2.1 Toolbar (top of page)
```html
<div class="toolbar">
  <h1>Canning Production Record</h1>
  <div class="toolbar-controls">
    <!-- Production Code Selector -->
    <label for="productionCodeSelect">Production Code:</label>
    <select id="productionCodeSelect" required>
      <option value="">-- Select Job --</option>
      <!-- populated from abalone-receiving records -->
    </select>
    
    <!-- Submit Button -->
    <button id="submitBtn" type="button" class="btn btn-primary">Submit</button>
  </div>
</div>

<!-- Error Banner (hidden by default) -->
<div id="errorBanner" class="error-banner hidden" role="alert">
  <!-- error messages appended here -->
</div>
```

#### 2.2 Form Container
```html
<form id="productionForm" class="production-form">
  <!-- Group A: Trolley Info -->
  <fieldset id="trolleyGroup" class="form-group trolley-info">
    <legend>Trolley & Retort Information</legend>
    
    <div class="form-row">
      <!-- Production Code (from toolbar, or redundant local field) -->
      <div class="form-field">
        <label for="productionCode">Production Code *</label>
        <input type="text" id="productionCode" name="productionCode" required readonly />
      </div>
      
      <!-- Time Trolley In -->
      <div class="form-field">
        <label for="timeTrolleyIn">Time Trolley In *</label>
        <input type="datetime-local" id="timeTrolleyIn" name="timeTrolleyIn" required />
      </div>
      
      <!-- Retort Code -->
      <div class="form-field">
        <label for="retortCode">Retort Code *</label>
        <input type="text" id="retortCode" name="retortCode" list="retortCodeList" required />
        <datalist id="retortCodeList">
          <!-- populated with known retort codes -->
        </datalist>
      </div>
      
      <!-- Retort Number -->
      <div class="form-field">
        <label for="retortNumber">Retort Number *</label>
        <input type="number" id="retortNumber" name="retortNumber" min="1" required />
      </div>
      
      <!-- Cooking Method -->
      <div class="form-field">
        <label for="cookingMethod">Cooking Method *</label>
        <select id="cookingMethod" name="cookingMethod" required>
          <option value="">-- Select Method --</option>
          <option value="Retort (steam)">Retort (steam)</option>
          <option value="Retort (water)">Retort (water)</option>
          <option value="Water bath">Water bath</option>
          <option value="Other">Other</option>
        </select>
      </div>
    </div>
  </fieldset>

  <!-- Group B: Can Batches (repeating) -->
  <fieldset id="batchesGroup" class="form-group batches-section">
    <legend>Can Batches from This Trolley</legend>
    
    <div id="batchesContainer">
      <!-- Batch rows inserted here by JS -->
      <!-- Template: see Section 2.3 below -->
    </div>
    
    <button type="button" id="addBatchBtn" class="btn btn-secondary">+ Add Batch</button>
  </fieldset>

  <!-- Group C: Damage Report -->
  <fieldset id="damageGroup" class="form-group damage-section">
    <legend>Damage Report</legend>
    
    <div class="form-row">
      <div class="form-field">
        <label for="xSmallDamaged">X-Small Damaged Cans *</label>
        <input type="number" id="xSmallDamaged" name="xSmallDamaged" min="0" required />
        <small class="error-message" id="xSmallDamagedError"></small>
      </div>
      
      <div class="form-field">
        <label for="otherSizesDamaged">Damaged Cans (Other Sizes) *</label>
        <input type="number" id="otherSizesDamaged" name="otherSizesDamaged" min="0" required />
        <small class="error-message" id="otherSizesDamagedError"></small>
      </div>
    </div>
  </fieldset>

  <!-- Group D: Comments -->
  <fieldset id="commentsGroup" class="form-group comments-section">
    <legend>Additional Notes</legend>
    
    <div class="form-field">
      <label for="comments">Comments</label>
      <textarea id="comments" name="comments" rows="4" placeholder="Optional notes..."></textarea>
    </div>
  </fieldset>
</form>
```

#### 2.3 Batch Row Template (repeating, inserted by JS)
```html
<!-- Template (not rendered initially, cloned for each row): -->
<template id="batchRowTemplate">
  <div class="batch-row" data-batch-index="0">
    <div class="batch-fields">
      <!-- Can Pieces -->
      <div class="form-field">
        <label for="canPieces-0">Can Pieces (size) *</label>
        <input type="text" class="canPieces" name="canPieces-0" list="canPiecesList" required />
        <datalist id="canPiecesList">
          <option value="213g"></option>
          <option value="340g"></option>
          <option value="500g"></option>
        </datalist>
      </div>
      
      <!-- Drain Weight -->
      <div class="form-field">
        <label for="drainWeight-0">Drain Weight (g) *</label>
        <input type="number" class="drainWeight" name="drainWeight-0" step="0.1" min="0" required />
      </div>
      
      <!-- Medium (dropdown) -->
      <div class="form-field">
        <label for="medium-0">Medium *</label>
        <select class="medium" name="medium-0" required>
          <option value="">-- Select Medium --</option>
          <option value="Brine">Brine</option>
          <option value="Braised">Braised</option>
          <option value="Other">Other</option>
        </select>
      </div>
      
      <!-- Number of Cans -->
      <div class="form-field">
        <label for="numberOfCans-0">Number of Cans *</label>
        <input type="number" class="numberOfCans" name="numberOfCans-0" min="1" required />
      </div>
      
      <!-- Sauce Batch (conditional, hidden by default) -->
      <div class="form-field sauce-batch-field" style="display: none;">
        <label for="sauceBatch-0">Sauce Batch *</label>
        <input type="text" class="sauceBatch" name="sauceBatch-0" />
        <small class="error-message" id="sauceBatchError-0"></small>
      </div>
    </div>
    
    <!-- Delete Button -->
    <button type="button" class="deleteBatchBtn btn btn-icon" title="Delete this batch row" aria-label="Delete batch row">×</button>
  </div>
</template>
```

---

### 3. JavaScript Logic & Event Handlers

#### 3.1 Initialization
```javascript
// On page load:
document.addEventListener('DOMContentLoaded', async () => {
  await loadProductionCodeOptions();
  initializeFormHandlers();
  addInitialBatchRow();
  loadRetortCodes();
});

// Populate Production Code dropdown from abalone-receiving records
async function loadProductionCodeOptions() {
  const records = await window.storage.getByPrefix('abalone-receiving');
  const codes = [...new Set(Object.values(records).map(r => JSON.parse(r).productionCode))];
  const select = document.getElementById('productionCodeSelect');
  codes.forEach(code => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    select.appendChild(option);
  });
}

// Load known retort codes (could be from a config, or hardcoded)
function loadRetortCodes() {
  const datalist = document.getElementById('retortCodeList');
  const knownRetorts = ['R1', 'R2', 'R3', 'R4'];
  knownRetorts.forEach(code => {
    const option = document.createElement('option');
    option.value = code;
    datalist.appendChild(option);
  });
}
```

#### 3.2 Production Code Selection
```javascript
// When user selects a production code from toolbar
document.getElementById('productionCodeSelect').addEventListener('change', (e) => {
  const code = e.target.value;
  document.getElementById('productionCode').value = code;
  
  // Optional: pre-fill other fields from job metadata
  // fetchJobMetadata(code).then(metadata => {
  //   document.getElementById('cookingMethod').value = metadata.cookingMethod || '';
  // });
});
```

#### 3.3 Batch Row Management
```javascript
// Add a new batch row
function addBatchRow() {
  const template = document.getElementById('batchRowTemplate');
  const clone = template.content.cloneNode(true);
  const index = document.querySelectorAll('.batch-row').length;
  
  // Update data attribute and field names with unique index
  const batchRow = clone.querySelector('.batch-row');
  batchRow.dataset.batchIndex = index;
  
  clone.querySelectorAll('[name]').forEach(field => {
    field.name = field.name.replace('-0', `-${index}`);
    field.id = field.id.replace('-0', `-${index}`);
  });
  
  // Setup conditional Sauce Batch visibility
  const mediumSelect = clone.querySelector('.medium');
  const sauceBatchField = clone.querySelector('.sauce-batch-field');
  mediumSelect.addEventListener('change', (e) => {
    sauceBatchField.style.display = e.target.value === 'Braised' ? 'block' : 'none';
    if (e.target.value !== 'Braised') {
      clone.querySelector('.sauceBatch').value = ''; // clear if hidden
    }
  });
  
  // Setup delete button
  clone.querySelector('.deleteBatchBtn').addEventListener('click', () => {
    batchRow.remove();
  });
  
  document.getElementById('batchesContainer').appendChild(clone);
}

// Initial batch row on load
function addInitialBatchRow() {
  addBatchRow();
}

// Add row button handler
document.getElementById('addBatchBtn').addEventListener('click', addBatchRow);
```

#### 3.4 Conditional Sauce Batch Field
```javascript
// Attach to each batch row's Medium dropdown
function setupSauceBatchVisibility(mediumSelect, sauceBatchField, sauceBatchInput) {
  mediumSelect.addEventListener('change', (e) => {
    const isBraised = e.target.value === 'Braised';
    sauceBatchField.style.display = isBraised ? 'block' : 'none';
    
    // Mark as required/optional
    sauceBatchInput.required = isBraised;
    
    // Clear if hidden
    if (!isBraised) {
      sauceBatchInput.value = '';
      document.getElementById(`sauceBatchError-${sauceBatchInput.name.match(/\d+/)}`).textContent = '';
    }
  });
}
```

#### 3.5 Form Validation
```javascript
function validateForm() {
  const errors = {};
  
  // Group A: Trolley Info
  const productionCode = document.getElementById('productionCode').value.trim();
  const timeTrolleyIn = document.getElementById('timeTrolleyIn').value;
  const retortCode = document.getElementById('retortCode').value.trim();
  const retortNumber = document.getElementById('retortNumber').value;
  const cookingMethod = document.getElementById('cookingMethod').value;
  
  if (!productionCode) errors['productionCode'] = 'Production Code is required.';
  if (!timeTrolleyIn) errors['timeTrolleyIn'] = 'Time Trolley In is required.';
  if (!retortCode) errors['retortCode'] = 'Retort Code is required.';
  if (!retortNumber || retortNumber <= 0) errors['retortNumber'] = 'Retort Number must be a positive integer.';
  if (!cookingMethod) errors['cookingMethod'] = 'Cooking Method is required.';
  
  // Group B: Batches
  const batchRows = document.querySelectorAll('.batch-row');
  if (batchRows.length === 0) {
    errors['batches'] = 'At least one batch is required.';
  } else {
    batchRows.forEach((row, i) => {
      const canPieces = row.querySelector('.canPieces').value.trim();
      const drainWeight = parseFloat(row.querySelector('.drainWeight').value);
      const medium = row.querySelector('.medium').value;
      const numberOfCans = parseInt(row.querySelector('.numberOfCans').value);
      const sauceBatch = row.querySelector('.sauceBatch');
      
      if (!canPieces) errors[`batch-${i}-canPieces`] = 'Can Pieces is required.';
      if (!drainWeight || drainWeight <= 0) errors[`batch-${i}-drainWeight`] = 'Drain Weight must be > 0.';
      if (!medium) errors[`batch-${i}-medium`] = 'Medium is required.';
      if (!numberOfCans || numberOfCans <= 0) errors[`batch-${i}-numberOfCans`] = 'Number of Cans must be > 0.';
      
      if (medium === 'Braised' && (!sauceBatch.value.trim())) {
        errors[`batch-${i}-sauceBatch`] = 'Sauce Batch is required for Braised medium.';
      }
    });
  }
  
  // Group C: Damage Report
  const xSmallDamaged = document.getElementById('xSmallDamaged').value;
  const otherSizesDamaged = document.getElementById('otherSizesDamaged').value;
  
  if (xSmallDamaged === '' || xSmallDamaged === null) errors['xSmallDamaged'] = 'X-Small Damaged Cans value is required.';
  if (otherSizesDamaged === '' || otherSizesDamaged === null) errors['otherSizesDamaged'] = 'Damaged Cans (Other Sizes) value is required.';
  
  return errors;
}

function displayValidationErrors(errors) {
  const errorBanner = document.getElementById('errorBanner');
  errorBanner.innerHTML = '';
  
  if (Object.keys(errors).length === 0) {
    errorBanner.classList.add('hidden');
    return false;
  }
  
  const errorList = document.createElement('ul');
  Object.values(errors).forEach(msg => {
    const li = document.createElement('li');
    li.textContent = msg;
    errorList.appendChild(li);
  });
  
  errorBanner.appendChild(errorList);
  errorBanner.classList.remove('hidden');
  return true;
}
```

#### 3.6 Form Submission
```javascript
document.getElementById('submitBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  
  const errors = validateForm();
  if (displayValidationErrors(errors)) {
    document.getElementById('errorBanner').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  
  // Build payload
  const payload = {
    productionCode: document.getElementById('productionCode').value,
    timeIn: document.getElementById('timeTrolleyIn').value,
    retortCode: document.getElementById('retortCode').value,
    retortNumber: parseInt(document.getElementById('retortNumber').value),
    cookingMethod: document.getElementById('cookingMethod').value,
    batches: [],
    damage: {
      xSmallDamaged: parseInt(document.getElementById('xSmallDamaged').value),
      otherSizesDamaged: parseInt(document.getElementById('otherSizesDamaged').value)
    },
    comments: document.getElementById('comments').value || null,
    submittedAt: new Date().toISOString(),
    submittedBy: window.currentUser || 'unknown' // from global context
  };
  
  // Collect batch rows
  document.querySelectorAll('.batch-row').forEach(row => {
    const batch = {
      canPieces: row.querySelector('.canPieces').value,
      drainWeight: parseFloat(row.querySelector('.drainWeight').value),
      medium: row.querySelector('.medium').value,
      numberOfCans: parseInt(row.querySelector('.numberOfCans').value)
    };
    
    if (batch.medium === 'Braised') {
      batch.sauceBatch = row.querySelector('.sauceBatch').value;
    }
    
    payload.batches.push(batch);
  });
  
  // Save to storage
  const key = `canning-production:${payload.productionCode}:${payload.timeIn}`;
  try {
    await window.storage.set(key, JSON.stringify(payload));
    
    // Show success feedback
    showSuccessToast('Production record saved successfully.');
    
    // Clear form or redirect
    setTimeout(() => {
      // Option 1: Reset form for next trolley
      document.getElementById('productionForm').reset();
      addInitialBatchRow();
      
      // Option 2: Redirect to Canning Report (uncomment if preferred)
      // window.location.href = `canning-report.html?job=${payload.productionCode}`;
    }, 1500);
  } catch (error) {
    console.error('Error saving record:', error);
    displayError('Failed to save record. Please try again.');
  }
});

function showSuccessToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function displayError(message) {
  const errorBanner = document.getElementById('errorBanner');
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
  errorBanner.scrollIntoView({ behavior: 'smooth' });
}
```

---

### 4. CSS Styling (in `record-theme.css` or inline `<style>`)

Key classes and patterns:

```css
/* Toolbar */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  flex-wrap: wrap;
  gap: 1rem;
}

.toolbar-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

/* Form Groups */
.form-group {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fafafa;
}

.form-group legend {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #333;
}

/* Form Rows & Fields */
.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
}

.form-field label {
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.form-field input,
.form-field select,
.form-field textarea {
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

/* Batch Rows */
.batch-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 0.75rem;
  align-items: flex-start;
}

.batch-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.sauce-batch-field {
  grid-column: 1 / -1;
}

.deleteBatchBtn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0;
  align-self: center;
}

.deleteBatchBtn:hover {
  background: #c82333;
}

/* Buttons */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

/* Error & Success Messages */
.error-banner {
  background: #f8d7da;
  color: #721c24;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  border: 1px solid #f5c6cb;
}

.error-banner.hidden {
  display: none;
}

.error-message {
  color: #dc3545;
  font-size: 0.85rem;
  margin-top: 0.25rem;
  display: block;
}

.toast {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  padding: 1rem 1.5rem;
  background: #28a745;
  color: white;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1000;
}

.toast.show {
  opacity: 1;
}

/* Responsive */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .batch-row {
    grid-template-columns: 1fr;
  }
  
  .batch-fields {
    grid-template-columns: 1fr;
  }
  
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .toolbar-controls {
    width: 100%;
    flex-direction: column;
  }
  
  .toolbar-controls select,
  .toolbar-controls button {
    width: 100%;
  }
}
```

---

### 5. Integration Checklist

Before handing to Claude Code:

- [ ] Confirm storage backend is `window.storage` (from `api-backend.js`).
- [ ] Confirm user context is available (e.g., `window.currentUser`).
- [ ] Confirm production code list source (query `abalone-receiving` records or fetch from API).
- [ ] Confirm retort codes list (hardcoded, config file, or from database).
- [ ] Confirm can sizes list (hardcoded or from database).
- [ ] Confirm time zone for datetime-local input (page already uses user's local TZ, no conversion needed).
- [ ] Confirm traceability linkage (should this record auto-link to job/batch, or is that manual post-submit?).
- [ ] Confirm redirect behavior on success (reset form or redirect to report?).

---

### 6. Testing Checklist

- [ ] **Trolley group:** Fill all 5 fields, verify non-empty on submit.
- [ ] **Batch group:** Add 2 rows, delete 1, re-add 1. Verify all fields required.
- [ ] **Sauce Batch conditional:** Select "Braised," verify Sauce Batch field appears and is required. Select "Brine," verify it hides and clears.
- [ ] **Damage group:** Leave both empty, attempt submit, verify error. Enter 0 for both, submit succeeds.
- [ ] **Comments:** Leave blank, submit succeeds. Enter text, submit succeeds.
- [ ] **Validation:** Attempt submit with missing Production Code, Time, etc. Verify error banner lists all failures.
- [ ] **Data persistence:** Submit record, verify it appears in storage with correct key format and structure.
- [ ] **Mobile:** Open on phone/tablet, verify fields stack, buttons are touch-sized, no overflow.
- [ ] **Accessibility:** Tab through form, verify logical order. Test screen reader with ARIA labels.

---

## Canning Report — Correct Layout Spec (source of truth: CPR02170)

> **Source:** `claude/canning-report-layout-spec.md`

**Purpose:** Michaela confirmed sheet `CPR02170` in `NEW CANNING REPORTS.xlsx` is the exact
layout the live Canning Report page must match. The current `public/pages/canning-report.html`
is missing / differs from several fields and sections below. This doc is the authoritative field
list and formula logic for Claude Code to bring `canning-report.html` in line — **do not use this
doc to build the Drying Report**, that is a separate, deliberately different layout (see
`claude/drying-report-spec.md`).

### Section-by-section spec (from CPR02170, row references are from the source workbook, for logic reference only — not literal spreadsheet cells to render)

#### 1. Title
`CANNING JOB` + job number (e.g. `CPR02170`) as the page heading — canning-report.html already
has this via the job selector; keep it, just confirm the label reads "Canning Job" not something
generic.

#### 2. JOB DETAILS (currently missing fields — canning-report.html does NOT show these today)
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

#### 3. REPORT SUMMARY (partially present today — needs target columns added)
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

#### 4. CAN SUMMARY (already present as "can breakdown" — check column parity)
Workbook columns: Production code | Quantity | D/W (drained weight) | Medium | NRCS AG code |
Additional NRCS cans, with a TOTAL row (`SUBTOTAL` over quantity).
canning-report.html's current can breakdown table: Production code | Quantity | Drained weight |
Medium | NRCS AG code — **missing the "Additional NRCS cans" column**. Add it.

#### 5. HARVEST BREAKDOWN (already present, matches)
Receiving date | Size range | Whole weight | Animals | Weight per animal — canning-report.html
already renders this with a TOTAL row. No changes needed here.

#### 6. PROCESSING MEASURES + EFFICIENCY INDICATORS (currently only half-built)
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

#### 7. CAN BREAKDOWN (stock-code level detail — this table is MISSING ENTIRELY from
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

### What canning-report.html gets RIGHT already (no change needed)
- Harvest breakdown table and its TOTAL row
- Can Summary table's core columns (just needs "Additional NRCS cans" added)
- Processing measures (out of salt / clean / precook weight + %)
- Target yield constant (105), actual yield formula, target cans formula, 213g equiv constant
  (213g)
- CSV export / Print / job selector toolbar pattern — reuse as-is

### Summary of concrete changes needed to `public/pages/canning-report.html`
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

### Open questions for Michaela before Claude Code builds items 1, 2, and 4b (Canning efficiency)
- Where do GRN No., PO No., Cost per Kg, Delivery note no., and Comments get captured today (is
  there an existing intake/receiving form field, or do these need a new field added somewhere
  upstream)?
- What is "Canning efficiency" supposed to be calculated from? CPR02170's own formula cell was
  blank, so the source workbook doesn't define it either.

### Status
Ready to hand to Claude Code for the concrete, unambiguous items (3, 5, 6). Items 1, 2, and the
"Canning efficiency" formula in item 4 need a quick answer from Michaela first — Claude Code can
build the field slots but should not guess a data source or formula for them.

---

## Canning Report — Improvement Brief for Claude Design

> **Source:** `claude/canning-report-design-improvements-brief.md`

**Purpose:** Michaela is running this through Claude Design next, to improve both the printed/PDF
report layout and the on-screen (view) layout of the Canning Report — alongside the data
additions already suggested in `claude/canning-report-data-improvement-suggestions.md`. This doc
consolidates both into one brief a design pass can work from directly.

### ⚠️ Confirmed scope limit (2026-09-11): PC/desktop layout only, no tablet redesign

**This report keeps its current desktop page structure.** No sidebar, no bottom tab bar, no
tablet/touch-target sizing, no collapse-to-mobile breakpoint. The tablet redesign
(`claude/layout-redesign-instructions.md`) applies only to record-*entry* pages and was never
meant to extend here — Michaela has now explicitly confirmed that. Whatever comes out of this
design pass should still look and behave like a normal wide desktop page: multi-column tables,
mouse-hover states are fine to use, no need to design for a narrow viewport or touch input.

What "improve the layout" means for this doc is refining the *visual hierarchy, grouping, and
print treatment* of the existing desktop page — not restructuring it into the app's tablet shell.
Reuse the shared color/type tokens (Section 3 of `claude/layout-redesign-instructions.md`) for
visual consistency with the rest of the app, but do not bring in the sidebar/topbar shell, the
44px tap-target sizing rules, or the responsive collapse behavior that spec defines for record
pages — none of that applies here.

**Use alongside, not instead of:**
- `claude/canning-report-layout-spec.md` — the exact field/section list from CPR02170 that the
  report must contain (functional completeness)
- `claude/canning-report-data-improvement-suggestions.md` — the new data points suggested (SYSPRO
  Yield/Deviation, Canning Efficiency, damaged cans, comments, stock code reference table)
- `claude/layout-redesign-instructions.md` — **tokens only** (colors, fonts), per the scope limit
  above. Do not pull in its sidebar/shell/responsive rules.

---

### 0. What the live page actually looks like today (verified 2026-09-11)

Viewed live at `processing-department.onrender.com/pages/canning-report.html` (could not load an
actual job's data — this session's device isn't authorised with the facility's records-database
access key, separate from the site login password, so the job dropdown stayed empty; the
structural/toolbar layout below is confirmed directly, the populated-report content below that is
based on the page source and the CPR02170 reference spreadsheet, not a live screenshot).

Confirmed on screen:
- Dark navy top bar: "PRODUCTION" doc-code + "Canning Report" title on the left, a "← Job status"
  button on the right.
- Below that, a loose, uncontained toolbar: "Job no." label + dropdown, then a "Refresh" button,
  then (wrapping to a second line at this viewport width) "Export CSV" and "Print / PDF" buttons,
  floating directly on the page background with no card/panel boundary around them.
- A separate "Loading…" status line sits under the toolbar with no visual grouping to the controls
  above it.
- Below that, a second, separate white panel just says "Pick a job number." — this is where the
  actual report content renders once a job is selected.
- No breadcrumb or persistent job identifier once scrolled past the top — if the report content
  grows long (as it will once the new sections are added), there's currently nothing reminding the
  viewer which job they're looking at without scrolling back up.

This confirms and sharpens two points already in this brief (Section 2): the page reads as
several unrelated floating elements rather than one coherent document, and there's no visual
container tying the toolbar together. Added as a concrete new point below (Section 2, first
bullet) since it's visible even before any job data loads.

---

### 1. What's wrong with the current view/print layout today

`public/pages/canning-report.html` is functional but visually flat: plain bordered tables stacked
top to bottom, minimal visual hierarchy between "the one number you care about" (actual yield,
actual cans) and supporting detail (harvest breakdown, can-level detail). Print output is the same
HTML with a few `@media print` rules (hide toolbar, white background) — it isn't designed as a
print document, it's a webpage that happens to still be legible when printed.

Two different documents want two different treatments, both still desktop-only:
- **On-screen (view) layout**: can use interactive affordances — collapsible sections, sortable
  tables, hover states, color-coded status. Normal mouse/desktop interaction, not touch.
- **Print/PDF layout**: needs to be a clean, scannable document — clear section breaks, no
  wasted whitespace, works on A4, doesn't rely on hover or color alone to convey status (some
  people print in black & white).

### 2. Suggested view-layout improvements (screen, desktop only)

- **Contain the toolbar in its own card, and stop it wrapping loosely.** Confirmed live (Section
  0): Job no. / Refresh / Export CSV / Print currently float directly on the page background and
  wrap onto a second row at normal desktop widths with no visual grouping. Put the whole toolbar
  row in one bordered/card panel with consistent button alignment (e.g. selector + Refresh on the
  left, Export/Print grouped on the right, same row, no wrap until well below typical desktop
  width). This is a real, visible issue today, not just a hypothetical.
- **Add a persistent job identifier once a report is loaded** — e.g. the selected job number and
  "Processed for" pinned near the top (or in a light sticky sub-header) so it's still visible after
  scrolling into a long report, especially once the new stock-code Can Breakdown table adds
  significant page length.
- **Lead with the summary.** Right now Report Summary is a small table partway down. Promote
  Actual Yield, Actual Cans, and (once added) SYSPRO Deviation into 3–4 stat cards/tiles at the
  very top, same visual language as the dashboard's KPI tiles (`public/index.html` already has
  this pattern — reuse it rather than inventing a new one). Target vs actual shown as a small
  delta badge (green if on/above target, red/amber if below), same convention the dashboard
  already uses.
- **Group job details and processing measures into a compact two-column header card** instead of
  stacked full-width tables — Job Details (Processed for, GRN, PO, Cost/kg, Delivery note) on the
  left, Report Summary stats on the right, so the top of the page reads as "one card, everything
  you need to identify this job" rather than three separate tables. This is still a fixed
  desktop-width layout, not a responsive grid that needs to reflow to a single column on small
  screens.
- **Collapsible detail tables.** Can Summary, Harvest Breakdown, and the stock-code-level Can
  Breakdown table are all useful but secondary to the summary. On screen, consider making these
  collapsible/expandable (open by default is fine) so the page doesn't read as one long wall of
  tables — matches the "Entries" collapsible pattern already used on record pages (visual pattern
  only — no need to match its tablet sizing).
  Print output should always render them expanded regardless of screen state.
- **Visual separation between "Can Summary" (by production/AG code) and "Can Breakdown" (by stock
  code)** — these are easy to confuse since they're both about cans. Give them distinct headers,
  maybe a subtitle clarifying the grouping ("by production code" / "by stock code"), and enough
  vertical space between them that they don't read as one continuous table.
- **Comments, once added**, should sit near the top summary (it's context for interpreting the
  numbers), not buried at the bottom.
- **Status color coding**: once SYSPRO Deviation and Canning Efficiency exist, use the shared
  token colors consistently — green (`#15803D`) for on/above target, gold or amber for a
  cautionary deviation range, and reserve a clear red only for a hard miss — matching how the
  dashboard tiles already signal status.

### 3. Suggested print/PDF-specific improvements

- **Design a real print stylesheet, not a "hide the toolbar" one.** Set explicit page size (A4),
  margins, and page-break rules: `break-inside: avoid` on every table row (already present, keep
  it) plus explicit `break-before` on each major section so a section header never lands as the
  last line on a page with its table starting on the next.
- **A proper print header/footer**: job number, "Canning Report" title, and generation
  date/time repeated at the top of every printed page (not just page 1) if the report can run to
  multiple pages once the new stock-code Can Breakdown table is added — that table can have many
  rows. Consider a running footer with page number ("Page 2 of 3") for anyone handing around a
  printed copy.
- **Don't rely on color alone for status in print.** Add a text/icon indicator alongside any
  color-coded deviation or efficiency flag (e.g. "▲ above target" / "▼ below target") so it still
  reads correctly on a black & white printer or scanned copy.
- **Collapsed sections must force-expand for print** — verify the `@media print` rules explicitly
  override any `display:none`/collapsed state from the on-screen collapsible treatment above.
- **Consider a condensed print variant vs. full print variant** if the report grows with all the
  new sections (Job Details, Report Summary, Can Summary, Harvest Breakdown, Processing
  Measures/Efficiency Indicators, Can Breakdown) — a "Summary only" print option (top stat cards +
  key tables) alongside the existing full print, for cases where someone just needs the yield
  number on paper, not the full stock-code breakdown.

### 4. Data additions to design around (from the separate data-improvement doc)

Design should leave room for these fields even before they're wired to real data, so the layout
doesn't need rework when they land:
- SYSPRO Yield + Deviation (stat tile + delta badge, see above)
- Canning Efficiency (once its formula is defined — stat tile alongside Actual Yield)
- Comments (free-text block near the top summary)
- Damaged cans (likely a stat tile or a row in Processing Measures — ties to the dashboard's
  existing "Can damage rate" tile)
- Job Details additions: GRN No., PO No., Cost per Kg, Delivery note no. (header card, section 2
  above)

### 5. What NOT to change in this design pass
- **No tablet/responsive redesign of this page — desktop layout stays as the target form factor.**
  Do not add a sidebar, bottom tab bar, touch-target sizing, or a mobile/tablet breakpoint. This
  is the explicit scope limit confirmed 2026-09-11, stated first in this doc for visibility.
- No change to what data is calculated or where it comes from — that's the layout-spec and
  data-improvement docs' job, not this one.
- Don't touch `canning-report.html`'s underlying storage/record logic — this brief is purely
  about visual/layout treatment of data that's either already there or already scoped elsewhere.
- Keep the job-number-prefix filtering rule (`3CP`/`CPR` only in this report's job selector,
  documented in `claude/drying-report-spec.md`) — a design pass shouldn't remove or bypass that
  filter.
- Reuse the existing shared color/type tokens only (Section 3 palette in
  `claude/layout-redesign-instructions.md`) — not its shell, sizing, or responsive rules.

### 6. Verification gap — flag before Claude Design starts
This session could not view a fully populated report (e.g. `?job=CPR002045`) because the browser
session isn't authorised with the facility's records-database access key (a separate credential
from the site login password — see `/pages/api-key.html` on the live site). Everything in
Sections 1–4 about the *populated* report's table layout is based on the page source and the
CPR02170 reference workbook, not a live screenshot with real data in every table. Section 0's
toolbar/empty-state observations are from a live, authenticated (logged-in) view and are solid.
If exact pixel-level fidelity matters before design work starts, get the real access key entered
on a device Michaela controls and grab a screenshot of a fully populated job (e.g. CPR002045) to
attach to this brief.

### 7. Suggested next step
Feed this brief, `claude/canning-report-layout-spec.md`, and
`claude/canning-report-data-improvement-suggestions.md` into Claude Design together, referencing
the existing `Abagold Processing UI.dc.html` canvas for **color/type token** consistency only, not
its tablet shell. Once a design draft exists, it comes back here for Michaela's review before
anything is handed to Claude Code for implementation.

---

## Canning Report — Data Improvement Suggestions (based on CPR02170)

> **Source:** `claude/canning-report-data-improvement-suggestions.md`

Michaela asked what data could be added, based on the reference layout in CPR02170. These are
suggestions, not committed scope — pick which ones to actually build and I'll fold the approved
ones into `claude/canning-report-layout-spec.md` for Claude Code.

### 1. SYSPRO Yield + Deviation (highest-value addition, not yet in any spec)

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

### 2. Canning Efficiency — needs a real definition
Flagged already in the layout spec as blank in the source workbook. Worth deciding now while
you're looking at what to add: is this meant to be cans-per-labour-hour, cans-per-shift,
percentage of target cans achieved, or something else? Once defined it's a real, trackable KPI
worth keeping on the report.

### 3. Stock code → description consistency check
The `DATA_ALWAYS REFRESH` sheet holds a full stock-code-to-description lookup (hundreds of rows,
e.g. `CAAB1001` → "CANNED ABALONE 425G NW 213 DW ABAGOLD P1"). The report's stock-code-level Can
Breakdown table currently just has a free-text "Description" column. If that lookup list were
brought into the database as a proper stock-code reference table, the report could auto-fill and
validate the description from stock code instead of relying on manual entry — reduces typos and
keeps stock codes and descriptions in sync automatically. This is a bigger structural change
(a new reference table), not a quick field addition — worth flagging as a separate project-level
decision (ties into your "database must have clear structure, easy to move to another format"
requirement).

### 4. Damaged cans as its own tracked field
The stock-code lookup includes a `DAM 150 g` / "DAMAGED 750G NW 150G DW" entry, implying damage is
already tracked somewhere as its own stock-code line. If damaged cans aren't currently broken out
as a distinct field on the job report (separate from the main Can Breakdown), consider adding a
"Damaged cans" count/weight row — useful for a damage-rate KPI over time (you already show a
"Can damage rate" tile on the dashboard, per `public/index.html`, so having it sourced cleanly per
job would make that dashboard number traceable back to individual jobs).

### 5. Target vs Actual, consistently, everywhere
CPR02170 already computes both Target Cans and Actual Cans, Target Yield and Actual Yield. Since
you're adding SYSPRO Yield as a third comparison point (#1 above), it may be worth standardizing
a single "Target / Actual / External(SYSPRO) / Deviation" row pattern across all three yield-type
metrics, rather than scattering them. Purely a presentation/consistency suggestion, not new data.

### 6. Job-level notes/comments, properly wired
Already flagged in the layout spec as missing a data source. Worth calling out again here because
it's genuinely useful data to capture, not just a cosmetic field — comments on the source workbook
jobs likely explain irregular results (delays, damaged batches, etc.) and without a comments field
in the live system, that context gets lost once someone moves off spreadsheets.

### Suggested priority if you want to move on these
1. SYSPRO Yield + Deviation — highest value, directly catches discrepancies
2. Comments field — cheap to add, preserves institutional knowledge
3. Canning Efficiency definition — decide the formula, then it's trivial to add
4. Damaged cans as a distinct field — ties into an existing dashboard metric
5. Stock code reference table — bigger lift, but pays off for your "clear, structured, easy to
   manipulate" database goal; good candidate for a dedicated follow-up task rather than bundling
   into the report fix

### Status
Awaiting your call on which of these to greenlight. Once you pick, I'll update
`claude/canning-report-layout-spec.md` with the approved additions so Claude Code has one clean
spec to build from.

---

## Canning Report — Three Fixes Requested by Michaela (2026-09-17)

> **Source:** `claude/canning-report-fixes-2026-09-17.md`

**Target file:** `public/pages/canning-report.html`
**Context:** Feedback given after test-entering job CPR02229 through the live app and viewing
`canning-report.html?job=CPR02229`. Builds on `claude/canning-report-layout-spec.md` (the
section-by-section field spec) — this doc is three focused, unambiguous fixes on top of that,
not a replacement for it.

### 1. Date format fix

**Problem:** Dates render as raw ISO strings pulled straight from the DB value, e.g. the Job
Details block currently does:
```js
<dt>Receiving date</dt><dd>${esc(h.receivingDate || '—')}</dd>
```
This prints `2026-08-07` verbatim instead of a human-readable date.

**Fix:** Add a `formatDate()` helper (or reuse one if it already exists elsewhere in the repo,
e.g. shared in `record-theme.js`/similar) and run every date value on the report through it
before display. Use `DD/MM/YYYY` (South African convention, matches how dates are written
elsewhere on the paper forms, e.g. "07/08/2026") — confirm this format with Michaela if any other
date format is already established as the house style elsewhere in the app, but default to
`DD/MM/YYYY` if unsure.

Apply to every date field on the report, not just Receiving date — check the Harvest Breakdown
table's `Receiving date` column (currently `${r.date}`, likely the same raw-string problem) and
any other date value rendered on the page. Grep the file for date-shaped values before treating
this as done.

Do **not** reformat the `Generated ${new Date().toLocaleString()}` timestamp in the header — that
one is already using a locale-aware formatter and is fine as-is.

### 2. Percentages must be genuinely calculated, not static

Michaela's note: "intake weight and whole is the same all % needs to be calculated figures."

**Read as two things:**

a) **Intake weight and whole (mass) weight are the same underlying figure.** The report already
   treats them this way in the code (`totalMass` is used consistently as the "whole weight" input
   to every percentage), so there's likely no bug here — but audit for it explicitly: make sure
   nowhere on the report a *different* weight field (e.g. a raw `intakeWeight` from a submission
   record, if that name differs from `totalMass`/`wholeMass` used elsewhere) sneaks in and creates
   a second, potentially-divergent "whole weight" source. There should be exactly one whole-weight
   figure feeding every % calculation on this report.

b) **Every percentage shown must be a live calculation off real submitted data — never a
   hardcoded or stale number.** Today's `pct()` helper already does this correctly:
   ```js
   const pct = (w) => (w != null && totalMass) ? (w / totalMass * 100) : null;
   ```
   and is used for Out of salt %, Clean %, Precook %. Confirm this stays true when adding any new
   fields from `claude/canning-report-layout-spec.md` (e.g. Canning Efficiency, once a formula is
   defined) — no new % field should ever be typed in or left as a static number. If a % can't be
   calculated because its inputs are missing, show `—`, not a guessed or leftover value.

**Verification step before calling this done:** open the report for CPR02229 (or any job with
data in all four source records) and manually recompute each displayed % by hand from the raw kg
figures shown next to it, confirming they match.

### 3. Move CAN BREAKDOWN to be the last section on the report

**Current order** (top to bottom):
1. Job Details / Report Summary (job header + yield stats)
2. **Can Breakdown** (production-code-level table)
3. Harvest Breakdown
4. Processing Measures / Efficiency Indicators (side by side)
5. NRCS AG Codes

**Required order:**
1. Job Details / Report Summary
2. Harvest Breakdown
3. Processing Measures / Efficiency Indicators
4. NRCS AG Codes
5. **Can Breakdown** (moved to last)

This applies to the on-screen render order in `render()`'s template string, **and** to the
`downloadCsv()` export order (currently CSV pushes `CAN BREAKDOWN` first, then `HARVEST
BREAKDOWN`, then `PROCESSING MEASURES` — reorder to match) so the printed/exported report matches
the screen.

Note: this doc's "Can Breakdown" refers to the **existing** production-code-level table already
on the page (Production code | Quantity | Drained weight | Medium | NRCS AG code). If/when the
separate stock-code-level "Can Breakdown" table from `claude/canning-report-layout-spec.md`
section 7 is built, that new table should also land at the very end, after (or merged with) this
one — check with Michaela on whether the two "Can Breakdown" tables should be combined or kept as
two distinct end-of-report sections once section 7 is implemented.

### Status
All three items are concrete and unambiguous — ready for Claude Code to implement directly, no
open questions blocking these specifically. (Open questions from the original layout spec — GRN
No./PO No./Cost per Kg/Delivery note source, and the Canning Efficiency formula — remain separate
and unresolved; not part of this fix set.)

---

## Canning Report / Job Status changes — 2026-09-11

> **Source:** `Claude outputs/canning-report-and-job-status-changes.md`

### Background

`CPR02170` in `NEW CANNING REPORTS.xlsx` was confirmed as the source-of-truth layout for the Canning Report page. Comparing it against the live `canning-report.html` surfaced six gaps, three of which (Additional NRCS cans column, stock-code Can Breakdown table, GRN/PO/cost/delivery-note/comments/canning-efficiency fields) had no existing data source anywhere in the system — same "don't invent data" issue already flagged for the Drying Report.

### What was built

#### 1. Job-prefix filter on report pickers
- `canning-report.html` job list restricted to jobs starting `3CP`/`CPR`.
- Matches the existing pattern already used on `drying-report.html` (`3DP`/`DPR`).

#### 2. New per-job input fields (Job Status Updates page)
Per Michaela's direction, these are captured on `job-status.html` (not on a form record), since they're per-job metadata entered while reviewing a job, not tied to a specific record submission:

- GRN No.
- PO No.
- Cost per Kg
- Delivery note no.
- Canning efficiency
- Comments
- NRCS AG codes — independent list (a job can have more than one)
- Additional NRCS cans — a single job-level quantity, independent of the AG code list (see Bug 2 below)

Implementation:
- `job-status.js`: added `JobStatus.saveDetails(jobNo, patch)` — merges new fields into the existing `job_status:<jobNo>` storage row without disturbing status/close data.
- `job-status.html`: added a "Details" button per job row opening a modal with the fields above.

#### 3. Canning Report now displays the above
- New **Job Details** section: Processed for, GRN No., PO No., Cost per Kg, Delivery note no.
- **Comments** field added to Report Summary.
- **Processing Measures** and **Efficiency Indicators** split into two panels (previously "Whole mass per can" lived awkwardly inside Processing Measures). Efficiency Indicators now shows Whole mass per can, Canning efficiency (from Job Status), and Actual yield.
- New **NRCS AG codes** table listing each AG code, plus the job's Additional NRCS cans total.
- CSV export updated to include all of the above.

#### 4. Job Status Updates is now the single search/entry point
- Removed the separate job-picker dropdowns from `canning-report.html` and `drying-report.html`.
- `job-status.html`'s Reports column now shows only the relevant link per job: Canning link only for `3CP`/`CPR` jobs, Drying link only for `3DP`/`DPR` jobs (a dash otherwise).
- Both report pages now read `?job=` from the URL (as passed by the link from Job Status) and render that job directly, with a "No job specified — open from Job Status Updates" fallback if loaded without one.

#### 5. Print / PDF layout
- Canning Report print styles tightened (smaller fonts, reduced padding, `@page{ size:A4; margin:10mm }`) so the current report content — Job Details, Report Summary, Can breakdown, Harvest breakdown, Processing Measures/Efficiency Indicators, NRCS AG codes — targets a single printed page.
- A `.page2-start` CSS hook (`break-before:page` in print) is in place for the future stock-code-level Can Breakdown table (see below) so that table starts cleanly on page 2 once it's built, instead of competing with page 1 for space.
- Not fully verified against a real, data-heavy job — a job with an unusually large number of harvest rows or can-breakdown rows could still overflow one page. Worth a print/PDF check against a real job (e.g. CPR002045) once device access allows it.

### Bugs found and fixed while testing (2026-09-11)

Found live while Michaela filled in job details for CPR002045 to verify the layout.

#### Bug 1 — corrected: Job Details is now its own action, and IS required before closing
The first pass at this (see git history / earlier version of this doc) had the rule backwards — assumed Job Details should never block closing. Michaela corrected this same day: a job **must** have Job Details added before it can be closed, and adding them needed to be a deliberate, separate action rather than bundled into a generic "view" click.

Required-field subset confirmed by Michaela: **GRN No., PO No., Cost per Kg, Delivery note no., Comments, and at least one NRCS AG code.** Canning efficiency is deliberately excluded from the gate — it has no defined formula yet, so requiring it would block every job from ever closing until that formula exists.

Built:
- Renamed the row action from "Details" to **"Add Job Details"** — an explicit, deliberate data-entry step, not a passive view.
- Each row shows a completion indicator next to it: "✓ complete" or "incomplete".
- `hasRequiredJobDetails(row)` in `job-status.html` checks the six required fields above (using the migrated NRCS shape from Bug 2, so it works against both old and new saved data).
- **Close job is disabled** (greyed out, `title="Add Job Details before closing this job."`) on any row that doesn't pass the check — Reopen is never gated, only Close.
- Defense-in-depth: `toggleJob()` also checks `hasRequiredJobDetails` directly and shows an alert with the same message if a close is ever attempted with a stale/bypassed render (confirmed via direct test — the native `disabled` attribute blocks the click first; the JS check catches it if that's bypassed).

Confirmed: a job with no Job Details saved cannot be closed (button disabled, clear tooltip; direct-call guard also blocks it with an alert). A job with all six required fields saved closes normally.

Also carried over from the original (incorrect-framing) investigation, and still valid: `JobStatus.close()`/`reopen()` were overwriting the whole job-status row instead of merging, which would have silently wiped GRN No./PO No./etc. on every close/reopen. That fix (merge via `get(jobNo)` first, same pattern as `saveDetails`) stays in place regardless of the gating rule.

#### Bug 2 — NRCS AG code and Additional NRCS cans were wrongly paired
Previously stored as `nrcsEntries: [{ agCode, additionalCans }]` — one paired row per entry, added/removed together. Per the layout spec, these are two independent data points: a job can have multiple NRCS AG codes, and Additional NRCS cans is a separate job-level quantity, not tied one-to-one to a single code.

Fixed:
- Data shape changed to two independent fields: `nrcsAgCodes` (array of strings) and `additionalNrcsCans` (single value).
- `job-status.html` modal UI split accordingly — a repeatable AG-code-only list, and one separate "Additional NRCS cans" input.
- **Migration**: existing paired data (e.g. CPR002045's `AG1`/`100`) is not dropped. A `migrateNrcsShape()` helper (duplicated identically in `job-status.html` and `canning-report.html`, since both read job-status rows independently) detects the old `nrcsEntries` shape when no new-shape data is present yet, and derives: all `agCode`s collected into the AG codes list, and all `additionalCans` values summed into the single Additional NRCS cans total. Nothing is saved back in the old shape going forward — the next Save from either page writes the new shape.

### Job Details UI restyle (2026-09-11, per Claude Design brief)

Rebuilt `job-status.html`'s table and modal against the supplied design brief (Artboard 2 + Artboard 6), with one deliberate deviation confirmed with Michaela: the brief marked Canning efficiency and Additional NRCS cans as required-to-close; both stay **optional**, matching the required set already confirmed above (GRN No., PO No., Cost per Kg, Delivery note no., Comments, ≥1 NRCS AG code). Canning efficiency specifically still has no defined formula, so it can't gate closing.

- **Status column**: now shows the Open/Closed pill plus a second line — green "Details: ✓ Complete" or gold "Details needed" — with a gold left-border accent on rows still missing details.
- **Action column**: "Add Job Details" and "Close job"/"Reopen" now sit side by side in one row, fixing the stacked layout that didn't look right.
- **Helper text** added under the table description: "Click a job row, then 'Add Job Details' to enter required information before closing."
- **Modal redesigned** to spec: header + subheader, four sectioned blocks with divider lines (Reference details — 2-column grid; Report notes; NRCS AG codes — alternating row backgrounds; Additional NRCS cans), gold asterisks only on the six actually-required fields, footer with off-white background and gold Save / white Cancel buttons, 700px width, palette colors and shadow per brief.

### Still blocked / open

- **Stock-code level Can Breakdown table** (Stock code | Cans | Pcs/can | N/W | D/W | Description | 213g equiv.): blocked on "Werner's stock code list" — confirmed not yet digitized anywhere. Cannot build the lookup until that list exists as a file or system Claude can read. The print layout has a `.page2-start` hook ready for it.
- **Existing latent gap, not introduced by this work**: the Can Summary table's "NRCS AG code" column reads `v.nrcsAgCode` from the `cans-produced` record (REC 7.2.7), but that field doesn't exist on that record — it's always been blank in production. NRCS AG codes are now captured at the job level instead (see above), so this per-row column stays unresolved; flagging in case it should eventually be reconciled or removed.

---

## Job Details Entry — Brief for Claude Design (updated 2026-09-11)

> **Source:** `claude/job-details-modal-design-brief.md`

**Purpose:** design the "Add Job Details" entry point and form on Job Status Updates, alongside
the Canning Report work already briefed in `claude/canning-report-design-improvements-brief.md`.
This is where GRN No., PO No., Cost per Kg, Delivery note no., Canning efficiency, Comments, and
NRCS AG codes get entered — the same fields that then surface read-only on the Canning Report's
Job Details / Efficiency Indicators / NRCS AG Codes sections. Confirmed live 2026-09-11 against
job CPR002045.

**Correction from an earlier version of this brief:** the first draft had the intended behavior
backwards. The corrected rule, confirmed directly by Michaela, is below — design against this
version only.

### Two confirmed rules the design must reflect (not yet built in code — see `claude/job-status-bugfix-brief.md`)

1. **"Add Job Details" is its own separate action, not an auto-popup tied to viewing a job.**
   Today, clicking the job row's Details button opens this form directly as part of viewing the
   job. That's changing: viewing a job and adding its details become two distinct actions. Design
   a clearly separate **"Add Job Details"** button/entry point on the job row (or job view),
   independent from however the plain view action works — it should never pop up automatically
   just because someone opened the job.
2. **A job cannot be closed until Job Details have been added.** This is the opposite of what an
   earlier version of this brief said. Design the Close job control (and/or the job row's status
   area) so it's visually clear when a job is blocked from closing because details are missing —
   e.g. a disabled/greyed Close job button with a tooltip or inline note ("Add Job Details before
   closing"), or a small status indicator on the job row itself ("Details needed" / "Details
   added ✓"). **Which exact fields count as "added" is still an open question for Michaela**
   (flagged in the bugfix brief — likely GRN/PO/Cost per Kg/Delivery note as the hard requirement,
   with Canning efficiency/Comments/NRCS AG codes possibly staying optional since Canning
   efficiency has no defined formula yet). Design should accommodate either answer — don't hard-
   code "all seven fields shown as required" without checking back once that's resolved.

### 1. What the form looks like today (confirmed live)

A centered white modal, title "Job details — {job no.}", fields stacked full-width top to bottom
in this order: GRN No. (text), PO No. (text), Cost per Kg (text), Delivery note no. (text),
Canning efficiency (text), Comments (textarea, ~3 rows), then "NRCS AG codes (a job may have more
than one)" — a repeating row of [AG code text input] [Additional cans number input] [✕ remove]
with a "+ Add NRCS AG code" button below the list, then Cancel / Save buttons bottom-right.

No section grouping, no visual hierarchy — every field carries equal visual weight. No indication
today of which fields are actually required to close the job, since the modal auto-opens as part
of viewing rather than existing as its own deliberate step.

### 2. Suggested layout improvements

- **Move this out of an auto-opening modal into its own dedicated view or a clearly-separate
  modal reached only via "Add Job Details"** — not something that appears just from clicking to
  view a job. If it stays a modal (vs. a full page), it should visually read as a distinct task
  ("you are now adding job details"), not a details/info popup.
- **Group into two labeled sections**: "Reference details" (GRN No., PO No., Cost per Kg,
  Delivery note no.) as a compact 2-column grid, and "Report notes" (Canning efficiency, Comments)
  below it.
- **Mark the actually-required fields clearly once that list is confirmed** — standard required-
  field treatment (asterisk or similar) on whichever subset gates job closing, once Michaela
  answers the open question in the bugfix brief. Don't guess this before that's resolved.
- **Split the NRCS section into two independent list sections**, matching the Bug 2 fix in the
  bugfix brief — these remain a data-modeling fix independent of the required/optional question:
  - "NRCS AG codes" — a simple repeatable list of AG code values only (text input + ✕ + "+ Add AG
    code"), no paired second field.
  - "Additional NRCS cans" — its own repeatable list or a single quantity field (check the
    corrected data model from Claude Code's Bug 2 resolution before finalizing this part of the
    layout), visually separate from the AG codes list.
- **A visible save confirmation and a way to tell, from the job row, whether details have been
  added** — e.g. a small "Details added" badge/checkmark on the Job Status Updates table once
  saved, so it's clear at a glance which jobs are still blocked from closing.
- **Keep this desktop-scale** — same scope limit as the Canning Report brief: no tablet/touch
  redesign, no sidebar, no responsive collapse. Admin/PC-only screen, same audience as Job Status
  Updates itself.
- **Reuse the shared token palette** (Section 3 of `claude/layout-redesign-instructions.md`) for
  colors/type only — not its shell or tap-target rules.

### 3. What NOT to change

- No change to what data is calculated, where it's stored, or the underlying save payload shape —
  that's Claude Code's job per `claude/job-status-bugfix-brief.md`, not this design pass.
- Don't design around the current buggy paired AG-code/cans behavior — design for the corrected
  two-list model described above, even though the code fix hasn't shipped yet.
- No tablet/responsive treatment (see above).
- Don't touch the rest of Job Status Updates (the jobs table, toolbar) beyond adding the new "Add
  Job Details" entry point and any "details added" status indicator on the row.

### 4. Suggested next step

Feed this brief to Claude Design alongside `claude/canning-report-design-improvements-brief.md`
(same session ideally, since these fields reappear read-only on the Canning Report). Get
Michaela's answer on the required-field subset (bugfix brief, Bug 1 open question) before
finalizing which fields show required-field styling — everything else in this brief can proceed
without waiting on that.

### Status
Ready to hand to Claude Design, with one open dependency (required-field subset) flagged above.
Corresponding code-side work tracked in `claude/job-status-bugfix-brief.md` — not yet built.

---

## Job Status — Job Details bugs and corrected rule (updated 2026-09-11)

> **Source:** `claude/job-status-bugfix-brief.md`

**Source:** found live on `job-status.html` while filling in job details for CPR002045 to verify
the Canning Report layout. **Correction (2026-09-11, same day):** Michaela clarified the intended
rule is the reverse of what was first written up below — see Bug 1 (Corrected) before building
anything. Hand this directly to Claude Code — all items here are concrete, scoped fixes.

### Bug 1 (CORRECTED) — Job Details must become its own separate action, and IS required before a job can be closed

**Original (wrong) framing, kept here so Claude Code doesn't build the reverse of what's
needed:** an earlier version of this brief said Job Details fields should never block closing a
job. That was based on a misread of what Michaela wants — the actual, confirmed rule is the
opposite in one respect and different in another. Read this section only; ignore the old framing
below.

**Corrected behavior needed:**
1. **Stop the Job Details modal from auto-opening as part of viewing a job.** Today, clicking
   **Details** on a job row opens the Job Details modal directly — that modal should no longer be
   reached this way. Split it into its own separate, clearly-labeled action — e.g. an
   **"Add Job Details"** button, distinct from viewing the job — so filling in these fields is a
   deliberate, separate step, not something bundled into a generic "view/details" click.
2. **A job can only be closed once Job Details have been added.** This reverses the original
   framing entirely: **Close job** should be disabled/blocked until GRN No., PO No., Cost per Kg,
   Delivery note no. (and whichever of Canning efficiency / Comments / NRCS AG codes Michaela
   confirms are actually required — clarify exact required subset before building, since
   "Job Details have been added" may not mean literally every field is mandatory; at minimum GRN,
   PO, Cost per Kg, and Delivery note no. are the clear candidates) have been saved via the new
   "Add Job Details" action.
3. **Fix needed:** add a real validation gate on `Close job` (wherever that lives — `job-status.js`
   `window.JobStatus.close(...)` or inline in `job-status.html`) that checks whether Job Details
   have been saved for that job, and blocks/disables Close job with a clear message if not (e.g.
   "Add Job Details before closing this job."). Add the separate "Add Job Details" entry point
   (button on the job row, alongside — not replacing — whatever plain view action exists). Confirm
   after the fix: a job with no Job Details saved cannot be closed via Close job (clear error or
   disabled state, not a silent no-op), and a job with Job Details saved closes normally.
4. **Open question for Michaela before this is built:** which exact fields count as "added" for
   the close-gate check? All seven (GRN, PO, Cost per Kg, Delivery note no., Canning efficiency,
   Comments, NRCS AG codes), or a smaller required subset (e.g. just GRN/PO/Cost per
   Kg/Delivery note, leaving Canning efficiency/Comments/NRCS AG codes genuinely optional even
   after the gate)? Canning efficiency in particular has no defined formula yet
   (`claude/canning-report-layout-spec.md`), so making it a hard requirement to close a job would
   block every job indefinitely until that formula exists — flag this specific conflict back to
   Michaela before building the gate.

### Bug 2 — NRCS AG code and Additional NRCS cans are two separate data points, not a pair

**Current behavior:** the Job Details entry form's "NRCS AG codes" section renders each row as a
linked pair: one text input for the AG code (e.g. `AG1`) sitting next to one number input
labelled "Additional cans" (e.g. `100`), added/removed together as a single row via **+ Add NRCS
AG code** / the ✕ button. This treats them as one combined record.

**Should be:** per `claude/canning-report-layout-spec.md` section 4 (Can Summary table), *NRCS AG
code* and *Additional NRCS cans* are two independent columns in the source workbook — a job can
have multiple NRCS AG codes, and "Additional NRCS cans" is a separate quantity that is not
inherently tied one-to-one to a single AG code. Coupling them into one input pair is a modeling
error inherited into the UI, not a deliberate design choice — confirmed directly by Michaela.

**Fix needed:**
1. Confirm how these two fields are actually stored today (single array of `{agCode,
   additionalCans}` objects, most likely, given the paired-row UI) — check the job-details save
   payload in `job-status.html` / wherever the modal's Save handler lives.
2. Decide the corrected data shape with Claude Code before changing the UI blindly — likely two
   independent lists (an NRCS AG codes list, and a separate Additional NRCS cans quantity/list),
   matching how `canning-report.html`'s Can Summary table already treats "NRCS AG code" as a
   per-row breakdown column distinct from "Additional NRCS cans" per the layout spec.
3. Migration note: at least one live job (CPR002045) already has an existing paired entry
   (`AG1` / `100`) saved under the current coupled shape — the fix needs a plan for what happens
   to existing saved data (e.g. treat existing paired rows as one AG code entry + one legacy
   "additional cans" total, rather than silently dropping data), not just a fix for new entries.

### Status
Not yet built. Bug 1 needs Michaela's answer on the exact required-field subset (see question
above) before Claude Code builds the close-gate — building it against "all seven fields required"
without resolving the Canning efficiency conflict would likely block every job from ever closing.
Bug 2 needs a quick look at the current save payload shape before deciding the corrected data
model (step 1), then the UI and any migration follow from that.

---

## Instruction file for Claude Code

> **Source:** `claude/nrcs-canning-production-codes-roster-instructions.md`

**Task:** On the "Production Information NRCS (Canning)" record, add a roster (repeating table)
that lists every Production code / NRCS AG code already logged against the chosen job number in
Cans Produced (REC 7.2.7) — so the operator doesn't retype data that's already captured — instead
of leaving Production code / NRCS AG code / Product description as single free-text fields with
nothing behind them.

This is a follow-up to `claude/nrcs-canning-batch-search-instructions.md` (already applied) and
its supersession note in `claude/nrcs-canning-batch-search-instructions.md`'s "job number isn't
populating the other cells" fix (also already applied — `receivingDate` now autofills from
`abalone-receiving`). This task covers only Production code / NRCS AG code / Product description.

### Why this needs a roster, not more single-value autofill (read before building)

A canning job routinely has **more than one** Cans Produced (REC 7.2.7) submission — one per can
run/production code (confirmed by reading `public/pages/canning-report.html`'s `buildReport()`,
which already renders a per-job Can Breakdown table from potentially many `cans-produced` rows,
each carrying its own `productionCode` and `nrcsAgCode`/`agCode`). A single text field on the NRCS
Canning page can only ever hold one value, so autofilling it from "the matching record" would
silently drop every code after the first. Michaela confirmed: build this as a roster, not a
single-value autofill.

### Correction: `brineOrBraised` on Cans Produced IS the product description field

An earlier draft of this instruction assumed `brineOrBraised` was only a Brine/Braised medium
indicator and that no product description existed upstream — Michaela corrected this: on
`cans-produced`, `brineOrBraised` **is** the product description field (e.g. "Braised" / "Brine"
describes the product itself, not a separate processing medium). Treat it as the real source for
NRCS Canning's existing "Product description" field — do not leave that field unmapped.

Given that, this task:
- Pulls **Production code**, **NRCS AG code**, and **Product description** (`brineOrBraised`) for
  real, from `cans-produced`, into a new roster.
- Maps the roster's description column to the page's existing top-level **Product description**
  field's meaning — see the roster/fillMap spec below, labelled "Product description" (not
  "Medium").

---

### Engine change (small, general-purpose): let `recordpick` fill more than two columns

Today `recordpick`/`jobtrace` (`wireRecordPick` in `public/lib/form-record.js`, ~line 415) can
only fill exactly two hardcoded target columns per picked row (`fillCode`, `fillName`), and
`jobTraceOptions()` (~line 392) only returns index metadata (`record_key`, `submission_id`,
`stage`, `href`) — never the picked submission's actual field values. This is the reason the
Production code / AG code table can't just reuse the existing roster's `recordpick` column
as-is: there's nowhere for the extra values to come from or go to.

Do not build a parallel one-off mechanism just for this page. Extend the existing, generic
`recordpick` machinery so any record can use it this way in future:

#### 1. `jobTraceOptions()` — carry the submission's own values along with each option

`window.Traceability.trace(jobNo)` already resolves to specific submissions
(`record_key` + `submission_id`) per `public/lib/traceability.js`. Extend `jobTraceOptions()` to
also fetch and attach that submission's `values` object to each returned option (e.g. as
`values: r.values || {}` — check what `Traceability.trace()` already returns before adding a new
lookup; if it doesn't currently include the submission body, extend it to, since the index already
knows which submission each row is — don't add a second independent fetch path).

#### 2. `recordpick` field config — support an arbitrary fill map, not just `fillCode`/`fillName`

Add a new optional column config key, e.g. `fillMap: { targetColumnKey: 'sourceValueKey', ... }`.
In `wireRecordPick`'s `change` handler (~line 445), after the existing `fillName`/`fillCode`
handling, also apply `fillMap`: for each `[targetColumnKey, sourceValueKey]` pair, look up
`opt.dataset` (extend the `<option>` rendering at ~line 438 to also serialize the needed
`values` entries into `data-*` attributes, the same pattern already used for `data-code`/
`data-name`) and write into the matching roster-row cell, same as the existing two fills do.
Keep `fillCode`/`fillName` working unchanged — this is additive, not a replacement.

#### 3. Filter jobtrace options to only `cans-produced` submissions, on this one roster column

The existing `jobtrace` picker (already used by the "Records for this job" roster column on this
same page) intentionally shows every record type filed against the job. This **new** roster needs
only `cans-produced` entries. Add an optional column config key, e.g. `sourceRecordKey:
'cans-produced'`, and in `jobTraceOptions()`/`wireRecordPick`, when a column declares it, filter
`opts` to `r.record_key === column.sourceRecordKey` before rendering. This keeps the general
`jobtrace` mechanism reusable for any single-record-type picker in future, not just this page.

---

### File 1 of 1 (page config): `public/records/Production-Information-NRCS-(Canning)-production-information-nrcs.html`

Add a second roster block for Production codes, right after the existing "Records included"
roster. `FormRecord.init` currently only supports one `roster` key — check whether it already
supports multiple named rosters (search for other records with more than one roster block in
`public/records/*.html` or in `data/record-definitions.json`); if not, this needs one more small,
general engine change: accept `rosters: [{ key, title, columns, ... }, ...]` alongside (or
replacing) the single `roster` key, rendering each as its own repeating table. Do not special-case
"a second table" just for this page — make the engine support N rosters generally, since other
records will likely want the same pattern later (e.g. the stock-code-level Can Breakdown table
already planned for `canning-report.html` per `claude/canning-report-layout-spec.md` §7).

New roster to add:

```js
{
  key: 'productionCodes',
  title: 'Production codes for this job — pulled from Cans Produced (REC 7.2.7) records filed against the job number above',
  columns: [
    { key: 'submissionRef', label: 'Cans Produced record', type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', sourceRecordKey: 'cans-produced', fillMap: { productionCode: 'productionCode', nrcsAgCode: 'nrcsAgCode', productDescription: 'brineOrBraised' } },
    { key: 'productionCode', label: 'Production code', type: 'text' },
    { key: 'nrcsAgCode', label: 'NRCS AG code', type: 'text' },
    { key: 'productDescription', label: 'Product description', type: 'text' }
  ]
}
```

Notes on the mapping above:
- `nrcsAgCode` on `cans-produced` — confirm the exact stored key before wiring; `canning-report.html`
  reads it defensively as `v.nrcsAgCode || v.agCode`, meaning different submissions may have used
  either key historically. Map `fillMap` from whichever key is actually present on the matched
  submission (mirror that same `||` fallback when reading `values` in step 1 above, don't assume
  only one key name).
- `productDescription` on the roster row is sourced from `brineOrBraised` on the matched
  `cans-produced` submission — confirmed by Michaela to be the real product description field,
  despite its field-key name suggesting otherwise. Don't relabel or second-guess this mapping.

#### The top-level "Product description" field (Batch details section)

This page already has a single top-level `productDescription` text field (added originally, still
present). Since a job can have multiple `cans-produced` rows with potentially different
descriptions (e.g. different production runs described differently), the roster is the correct
place for per-row descriptions — do not try to also autofill the single top-level field from
multiple roster rows (same reasoning as Production code / NRCS AG code: one field can't hold many
values). Leave the top-level field as manual free text, OR, if Michaela wants it removed now that
the roster covers this per-row, flag that as an open question rather than deleting it
unilaterally — it's a page layout decision, not implied by this task.

Also add one line to the page's existing `instructions` array explaining the new table, e.g.:

```js
{ label: 'Production codes table', text: 'Each row here picks a specific Cans Produced (REC 7.2.7) submission for this job number and pulls in its production code, NRCS AG code, and product description automatically. Add one row per can run.' }
```

---

### Testing checklist

1. Open a job with two or more existing Cans Produced submissions (different production codes).
   Enter that job number in NRCS Canning's "Job no." field.
2. In the new Production codes roster, add a row, open the "Cans Produced record" picker, and
   confirm it lists only the `cans-produced` submissions for that job (not other record types).
3. Pick one — confirm Production code, NRCS AG code, and Product description fill in automatically
   on that row, and that the existing "Records for this job" roster (the other picker on this same
   page) is unaffected by this change.
4. Add a second row and pick the other Cans Produced submission — confirm both rows hold correct,
   distinct values (this is the case a single-field autofill could not have handled).
5. Confirm the standalone top-level "Product description" field still behaves as plain free text —
   no autofill attempted, no error (see the open question above on whether it should stay).
6. Save the record and confirm both rosters persist correctly on reopen.

---

## Instruction file for Claude Code

> **Source:** `claude/nrcs-canning-batch-search-instructions.md`

**Task:** Add real, working batch/job search to the "Production Information NRCS (Canning)"
record so it actually pulls in the real records filed against that job — the same way
REC 8.1.6 (Traceability & Mock Recall Checklist for Canned Abalone) already does it — instead
of the current setup, which only lets someone hand-type record names into a blank roster table.

Do not invent a new mechanism. This codebase already has a working "search by job number and
pick from the real filed records" feature (`type: 'jobsearch'` + `roster` column
`type: 'recordpick', source: 'jobtrace'`, backed by `window.TracedRecords` /
`public/lib/traceability.js` / `public/records/batch-trace.html`). This task wires the NRCS
Canning page into that existing system. No new libraries, no new UI components.

---

### File 1 of 2: `public/records/Production-Information-NRCS-(Canning)-production-information-nrcs.html`

#### Problem

Today this file has no job-number field at all (`productionCode` and `nrcsAgCode` are plain
free-text fields), and its `roster` table has a `recordName` column of `type: 'text'` — meaning
whoever fills this form in has to manually type out record names and REC codes from memory. There
is no link to the actual submitted records for that job, and nothing here participates in the
traceability index.

#### Fix

Replace the entire `<script>(function () { FormRecord.init({ ... }) })();</script>` block with
the version below. Changes made, and why each one is needed:

1. **Add a `jobNo` field** (`type: 'jobsearch'`) to "Batch details", in the same style as REC 8.1.6
   uses `jobNo`. This is the actual search box that looks up real job numbers (format
   `3CP`/`3DP`/`CPR`/`DPR` + digits) from `abalone-receiving` job intake data, exactly like every
   other traced record already does. Without this field there is nothing to search *by*.
2. **Add `batchField: 'jobNo'` and `stage: 'nrcs-canning'`** at the top level of the config. This
   is what lets this record itself be indexed into the traceability system once someone fills it
   in (so a later mock recall / batch-trace lookup on this job also finds this NRCS record).
3. **Add an `autofill` block** watching `jobNo` against the `abalone-receiving` record (matching
   REC 8.1.6's pattern) so the operator doesn't have to re-key data that's already on the intake
   record. Left empty (`fill: {}`) unless you want specific fields auto-populated — see "Optional
   enhancement" below.
4. **Change the roster's `recordName` column from `type: 'text'` to a real `recordpick` column**
   (`type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', fillCode: 'recordCode', fillName:
   'recordName'`), copying the exact working pattern from REC 8.1.6's roster. This is the actual
   fix requested: once a job number is chosen in "Batch details", each roster row's picker will
   only offer records that were **actually filed under that job number** (pulled live from
   `window.TracedRecords` + the batch index), and picking one auto-fills the REC code and record
   name columns. With no job number chosen, it falls back to the full Master Index list (same
   fallback behavior as REC 8.1.6) — so the picker is never empty even before a job is chosen.
5. **Add an `instructions` block** (same idea as REC 8.1.6) telling operators: choose the job
   number first, then each roster row picks from the records actually filed against that job.
6. Keep the existing `listColumns: ['productionCode', 'nrcsAgCode']` — no change needed there.

Replace the script block with:

```html
<script>(function () {
  FormRecord.init({
    mount: '#frRoot',
    recordKey: 'production-information-nrcs',
    docCode: 'Production Information NRCS (Canning)',
    title: 'Production Information NRCS (Canning)',
    docRevisionStart: 1,
    batchField: 'jobNo',
    stage: 'nrcs-canning',
    listColumns: ['productionCode', 'nrcsAgCode'],
    instructions: [
      { label: 'How to fill this in', text: 'Choose the job number first — each row in the records table below then picks from the records actually filed against that job, linking the exact submission rather than just the record type. With no job number chosen the picker falls back to the full Master Index list.' }
    ],
    autofill: [
      { watch: 'jobNo', source: 'abalone-receiving', matchField: 'jobNo', fill: { } }
    ],
    sections: [
      { title: 'Batch details', fields: [
        { key: 'jobNo', label: 'Job no.', type: 'jobsearch' },
        { key: 'receivingDate', label: 'Receiving date', type: 'date', required: true },
        { key: 'dateOfInspection', label: 'Date of inspection', type: 'date' },
        { key: 'productionCode', label: 'Production code', type: 'text' },
        { key: 'nrcsAgCode', label: 'NRCS AG code', type: 'text' },
        { key: 'productDescription', label: 'Product description', type: 'text' }
      ]},
      { title: 'Sign-off', fields: [
        { key: 'checkedByQC', label: 'Checked by (QC)', type: 'text', required: true },
        { key: 'verificationBy', label: 'Verification by', type: 'text' }
      ]}
    ],
    roster: {
      title: 'Records included — Abalone Receiving (7.1.2), Basket Removal/Shucking/Gutting (7.1.1), Bleeding & Salting Checklist (7.1.3), Washing Control Sheet (7.1.4), Chiller Batch Control (7.8.1), Beak Cutting & Scrubbing (7.1.6), Precooking Check Sheet (7.2.3), Retort Inspection Reports (7.2.9), Cans Produced (7.2.7), Seamer Inspection (7.8.4), Incoming Inspection for Cans & Lids (7.8.6), Double Seam Inspection Report (7.2.12), Retort reports, Temperature probe reports, Production figure (cans produced)',
      columns: [
        { key: 'submissionRef', label: 'Record for this job', type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', fillCode: 'recordCode', fillName: 'recordName' },
        { key: 'recordCode', label: 'REC code', type: 'text' },
        { key: 'recordName', label: 'Record name', type: 'text' },
        { key: 'included', label: 'Included', type: 'select', options: ['Yes', 'No', 'N/A'] }
      ]
    }
  });
})();
</script>
```

Do not change anything else in the file (the `<head>`, script tag versions/order, or
`record-shell.js` include at the bottom).

**Note on script includes:** REC 8.1.6 also loads `../lib/traceability.js?v=6` and
`../lib/batch-validation.js?v=1` before `form-record.js`, which this NRCS file currently does not
load. Add these two `<script>` tags in the same position (right before
`<script src="../lib/form-record.js?v=34"></script>`) so job-number format validation and
traceability indexing work identically to every other traced record:

```html
<script src="../lib/traceability.js?v=6"></script>
<script src="../lib/batch-validation.js?v=1"></script>
```

---

### File 2 of 2: `public/lib/traced-records.js`

#### Problem

`window.TracedRecords` is the master list that both (a) the "jobtrace" `recordpick` picker reads
from to know which record types/pages exist, and (b) the trace/batch-trace lookup page reads to
resolve links. `production-information-nrcs` is **not currently in this list**. Once this record
gets a `jobNo` field and starts saving job-linked submissions (per File 1's changes), it needs an
entry here so:
- `batch-trace.html` includes it in a job's timeline,
- other traced records' `recordpick` pickers can offer it as a real filed record for a job.

#### Fix

Add a new entry to the `window.TracedRecords` array. Insert it alphabetically/logically near the
other NRCS-canning-adjacent entries — e.g. right after the `"cans-produced"` entry (around line
228, before `"retorting-control-sheet"`) — with:

```json
  {
    "recordKey": "production-information-nrcs",
    "pageFile": "Production-Information-NRCS-(Canning)-production-information-nrcs.html",
    "docCode": "Production Information NRCS (Canning)",
    "title": "Production Information NRCS (Canning)",
    "batchField": "jobNo",
    "batchDateField": null,
    "stage": "nrcs-canning",
    "extraBatchFields": [],
    "store": "formrecord:production-information-nrcs"
  },
```

Field values must match File 1 exactly:
- `"batchField": "jobNo"` — matches the field key added in File 1.
- `"store": "formrecord:production-information-nrcs"` — matches `recordKey` prefixed with
  `formrecord:`, the same convention used by every other `FormRecord`-based (non
  `monitoring_log`-based) record in this file (e.g. `abalone-receiving`, `qc-report`,
  `cans-produced`).
- `"stage": "nrcs-canning"` — matches File 1's new `stage` value; this is just a free-form label
  used for grouping in trace output, doesn't need to match any other record's stage name.

Do not remove, reorder, or edit any other entries in this file — this is an additive change only.

---

### Why this is the right fix (not a rebuild)

- The "search and add the actual relevant records based on the batch detail search" requirement
  in the task is **exactly** what `recordpick` + `source: 'jobtrace'` already does elsewhere in
  this app (REC 8.1.6, 8.1.6a, 8.1.6b, 8.1.7). This change brings the NRCS Canning page in line
  with that existing, working feature rather than building a parallel search mechanism.
- `Traceability.indexSubmission()` (called automatically by `form-record.js` on every save, per
  `TRACEABILITY.md`) will start indexing this record's submissions the moment it has a declared
  `batchField` — no other wiring is needed beyond what's in Files 1 and 2 above.
- `batch-trace.html` (the job-number lookup page linked from the records hub) needs no changes —
  it already reads from `window.TracedRecords`, so File 2's addition is sufficient for this record
  to show up in any job's traceability timeline.

### Testing checklist for whoever applies this (manual, in the live app)

1. Open Production Information NRCS (Canning), start a new entry, and confirm a "Job no." search
   field appears in Batch details and validates the `3CP`/`3DP`/`CPR`/`DPR` + digits format.
2. Enter a job number that already has other records filed against it (e.g. an existing
   `abalone-receiving` job used for testing). Confirm the roster's "Record for this job" picker
   now lists only the real records filed against that job, and selecting one fills in REC code
   and record name automatically.
3. Save with no job number chosen, and confirm the picker falls back to showing the full Master
   Index list rather than being empty or erroring.
4. Save a completed entry, then open `records/batch-trace.html`, search that same job number, and
   confirm "Production Information NRCS (Canning)" now appears in the timeline.

### Optional enhancement (not required, flagging for a decision)

The `autofill` block above is currently empty (`fill: {}`), matching REC 8.1.6's own pattern —
REC 8.1.6 relies entirely on the roster picker rather than pulling receiving-record fields
directly onto the form. If you'd instead like `receivingDate` or `productDescription` to
auto-populate from the matched `abalone-receiving` record when a job number is chosen (the way
REC 7.2.11 QC Report and REC 7.3.6 Brine Mixing Report do), that requires knowing the exact field
keys on the `abalone-receiving` record and adding entries to the `fill: {}` object, e.g.
`{ productDescription: 'productDescription' }`. This is a separate, optional decision and not
required for the batch-search fix requested here.

---

## Instruction file for Claude Code

> **Source:** `claude/nrcs-canning-add-view-verify-gate-instructions.md`

**Task:** Change how roster rows work on "Production Information NRCS (Canning)" so each row goes
through an explicit **Add record → View record → verification status shown** flow, and make the
NRCS record itself impossible to finalize/submit while any required record is missing or its
verification status is not "Verified."

This is a follow-up to the two prior instruction files already applied to this page
(`claude/nrcs-canning-batch-search-instructions.md` and
`claude/nrcs-canning-production-codes-roster-instructions.md`). Read those first — this task
builds directly on the `recordpick`/`jobtrace` roster columns they added (the "Records for this
job" roster and the new "Production codes" roster).

### What "verified" already means in this codebase — use it, don't invent a new status

Checked `public/lib/monitoring-log.js` and `public/lib/form-record.js`: a submission is not simply
"submitted" or "not submitted" — a **separately signed verification** (`sub.verification`, an
object with `verifiedBy`/`verifiedSig`/`verifiedDate`/`verifiedSignature`) is applied after
submission, by a second person, tracked per entry:
- `isSubmitted(sub)` (`form-record.js` ~line 928) — true once submitted/finalized.
- `!sub.verification` — true while it is still awaiting verification, per
  `pendingForVerification()` in `monitoring-log.js` and the `verification-queue.html` /
  `verifier-assignments.html` pages that already surface this exact "waiting for verification"
  state org-wide.

So "note if not verified" means: **submitted but `sub.verification` is falsy** — not "not yet
submitted at all" (that's a separate, more basic missing state). Both states need to be shown
distinctly on each roster row, because they mean different things to the person filling in NRCS
Canning:
- **Not attached** — no record picked for this row yet.
- **Attached, not submitted** — picked, but the underlying record is still a draft.
- **Attached, submitted, not verified** — the actual "note if not verified" case.
- **Attached, submitted, verified** — the only state that should count toward "all needed records
  are attached and verified."

Do not build a new verification concept for this page. Read the real status off the actual picked
submission (see engine change below) and reuse the codebase's existing three-state model above.

---

### Engine change 1: `jobTraceOptions()` / the trace index must expose submission status

Confirmed in `public/lib/traceability.js`: the trace index row (`baseRow` in `indexSubmission()`)
currently stores only `record_key`, `submission_id`, `stage`, `occurred_on`, `href`, `summary` —
**no status or verification flag**. Status lives on the actual submission object in its own
`formrecord:*`/`monitoring_log:*` store, not in the trace index.

Extend `indexSubmission()`'s `baseRow` to also carry:
```js
status: isSubmitted(sub) ? 'submitted' : 'draft',
verified: !!(sub.verification),
verifiedDate: (sub.verification && sub.verification.verifiedDate) || null
```
(`isSubmitted` already exists in `form-record.js` — reuse the same logic, don't reimplement it;
`monitoring-log.js`'s controls have their own equivalent, reuse whichever applies to the record
being indexed.) This keeps the index as the single place both this feature and anything else
built later can read status from, instead of every consumer having to separately fetch full
submissions just to know verification state.

Re-index existing data: `indexSubmission()` runs automatically on every future save, but rows
already in the index from before this change won't have the new fields until they're resaved.
Check `public/pages/backfill-traceability.html` (already exists in the repo) — if it re-runs
`indexSubmission()` over existing submissions, use it to backfill the new fields after this change
ships; if it doesn't cover this, extend it to, rather than leaving old rows silently missing
`status`/`verified` (they'd otherwise read as "not verified," which happens to be a safe default,
but should be confirmed, not accidental).

### Engine change 2: roster rows need an explicit Add → View → Status lifecycle, not just a picker

Today's `recordpick` column is a single `<select>` — picking a value both "adds" and "views" in
one motion (the roster row's cells fill in), with no separate view step and no visible status.
Change the roster column rendering for `type: 'recordpick'` (in `wireRecordPick`/the field-render
function `form-record.js` ~line 415 area, and the field-HTML-building function that currently
emits `<select id="${id}" data-recordpick="1">...</select>`) to render three things per row
instead of one:

1. **Add / change button** — opens the existing picker (`<select>`, or a small modal listing the
   same `jobtrace` options if a dropdown reads as too cramped for this — reuse whichever pattern
   this codebase already uses elsewhere for "pick one of several items," don't invent a new picker
   UI). Behavior on pick is unchanged from today: still fills whatever `fillCode`/`fillName`/
   `fillMap` columns are configured (per the production-codes-roster instructions).
2. **View link** — once a row has a value, show a "View" link/button using the option's `href`
   (already present in `jobTraceOptions()`'s returned `href` field) that opens the actual picked
   record in a new tab, exactly the way `verification-queue.html`'s "Record" column already links
   out (`<a class="rec" href="...">`) — reuse that same link pattern, don't build a new one.
3. **Status note** — a small inline label/badge next to the row reading exactly one of: "Not
   attached" (no value picked), "Draft — not yet submitted", "Awaiting verification", or
   "Verified (12/03/2026)" (using the new `verifiedDate` from engine change 1). Style it using
   whatever this codebase's existing status-badge classes already are (`submissions-log.html` has
   `.badge-warn`/`.badge-ok`/`.badge-muted`/`.badge-info` — reuse those classes and their existing
   color meaning: warn = awaiting verification, ok = verified, muted = not attached, info = draft,
   rather than inventing new colors).

Add a `required: true` option on a roster column config (e.g. `{ key: 'submissionRef', type:
'recordpick', ..., required: true }`) so each roster (the "Records for this job" roster and the
"Production codes" roster) can independently declare whether it's mandatory for this record. Set
it `true` on both existing recordpick roster columns on this page, since Michaela's instruction is
that NRCS Canning cannot be submitted until all needed records are attached and verified.

### Engine change 3: block finalize/submit until every required roster row is attached + verified

In `saveForm(finalize)` (`form-record.js` ~line 1446), alongside the existing `finalize`-gated
checks (`missingRequired`, `invalidJobNumber`, `routeConflict` — see the existing pattern at
~lines 1451–1473), add an equivalent roster-completeness check:

```js
let rosterIncomplete = null;
(config.rosters || (config.roster ? [config.roster] : [])).forEach(r => {
  (r.columns || []).forEach(col => {
    if (col.type !== 'recordpick' || !col.required) return;
    // read every rendered row's stored status for this column
    const rows = rosterRowsFor(r.key || 'roster'); // use whatever the engine's existing roster-row
                                                     // accessor is called — don't add a second one
    const bad = rows.find(row => {
      const val = row[col.key];
      if (!val) return true;                         // not attached
      const meta = row['__' + col.key + '_meta'];     // wherever the picked option's status data
                                                        // ends up stored per row — wire this to
                                                        // match however fillMap/fillCode already
                                                        // persist per-row data today
      return !(meta && meta.verified);
    });
    if (bad) rosterIncomplete = r.title || 'a required record';
  });
});
if (rosterIncomplete && finalize) {
  toast(`All records in "${rosterIncomplete}" must be attached and verified before this can be submitted.`);
  return;
}
```

Treat the pseudocode above as intent, not literal code to paste — match it to this engine's real
internal names for "the rendered roster rows" and "where a recordpick column's picked-option
status is stored per row" (follow whatever pattern `fillCode`/`fillName`/`fillMap` already use to
persist values from the picked option onto the row, and extend it to also persist `verified`/
`status` the same way, rather than inventing a separate storage path).

Critically: this check must only block **finalize** (the actual Submit action), exactly like the
existing `missingRequired`/`routeConflict` checks — a plain "Save draft" must still work with
incomplete or unverified rosters, since the whole point of a draft is to save partial progress
while waiting on other records to be filed and verified. Confirm this by testing both buttons (see
checklist below).

---

### File to update: `public/records/Production-Information-NRCS-(Canning)-production-information-nrcs.html`

Add `required: true` to the `submissionRef` column on both existing rosters on this page:

```js
roster: {
  title: 'Records included — ...',
  columns: [
    { key: 'submissionRef', label: 'Record for this job', type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', fillCode: 'recordCode', fillName: 'recordName', required: true },
    ...
  ]
}
```

and on the Production codes roster added in the prior instruction file:

```js
{
  key: 'productionCodes',
  title: 'Production codes for this job — ...',
  columns: [
    { key: 'submissionRef', label: 'Cans Produced record', type: 'recordpick', source: 'jobtrace', jobField: 'jobNo', sourceRecordKey: 'cans-produced', fillMap: { productionCode: 'productionCode', nrcsAgCode: 'nrcsAgCode', productDescription: 'brineOrBraised' }, required: true },
    ...
  ]
}
```

Also update the page's `instructions` array to state the new rule plainly for whoever fills this
in, e.g.:

```js
{ label: 'Submitting this record', text: 'Every row in the records tables below must be attached (a specific record picked, not just a record type) and show "Verified" before this NRCS record can be submitted. You can still save a draft at any point while records are still being filed or verified elsewhere.' }
```

---

### Testing checklist

1. Start a new NRCS Canning entry, enter a job number with at least one record already filed but
   **not yet verified** against it. Add that row via the picker. Confirm the row shows "Awaiting
   verification" (not "Verified", not blank).
2. Try to Submit (finalize). Confirm it is blocked with a clear message naming which table is
   incomplete, and no partial data is lost.
3. Click "Save draft" in the same state. Confirm the draft saves successfully — drafts must not be
   blocked by this rule.
4. Go verify that underlying record (via the existing verification queue / sign-off flow), then
   reopen the NRCS Canning draft. Confirm the row's status now reads "Verified" with a date.
5. With every required roster row now verified, confirm Submit succeeds.
6. Test the "not attached at all" case (a required roster with zero rows, or a row with no value
   picked) — confirm it blocks Submit with an appropriate message, distinct from the "attached but
   unverified" case.
7. Confirm the "View" link on an attached row opens the correct underlying record in a new tab.
8. Re-run one of the already-applied prior fixes' test steps (from
   `claude/nrcs-canning-production-codes-roster-instructions.md`) to confirm this change didn't
   regress the fillMap/fillCode auto-population behavior.

---

## Testing checklist — NRCS Canning roster Add → View → Verify flow

> **Source:** `claude/nrcs-canning-roster-verification-testing-checklist.md`

Covers the changes from `nrcs-canning-roster-verification-instructions.md`:
- `public/lib/traceability.js` (v7) — trace index rows now carry `status`/`verified`/`verifiedDate`
- `public/lib/form-record.js` (v35) — recordpick roster columns render Add/change → View → status badge; `saveForm(finalize)` blocks Submit when a required recordpick row isn't attached+verified
- `public/pages/backfill-traceability.html` — re-indexes rows missing the new fields
- `Production-Information-NRCS-(Canning)-production-information-nrcs.html` — single "Records included" roster's `submissionRef` column marked `required: true`; the separate "Production codes" roster was merged into this same roster as extra columns (`productionCode`, `nrcsAgCode`, `productDescription`), filled via `fillMap` whenever the picked record is a Cans Produced (REC 7.2.7) submission

**Blocker found during automated testing:** the Job No. field (`type: 'jobsearch'`) only
accepts values from `window.JobStatus.openJobNumbers()` — any value not in that list is
silently cleared, including a value set directly on the underlying input via JS. So this
checklist needs a **real open job number** that already exists in your job list; it can't
be exercised with a fabricated job number in an empty/local environment.

### Setup
Pick (or create) a real open job number, call it `JOBNO`, that has:
- At least one record already filed against it in the trace index (any record type),
  submitted but **not yet verified**.

### Steps

1. **Open a new NRCS Canning entry**, enter `JOBNO` as Job no.
2. In the "Records included" roster, click the Add/change control and pick the row for
   the already-filed, not-yet-verified record.
   - [ ] Row shows badge **"Awaiting verification"** (not "Verified", not blank/muted).
   - [ ] A "View record" link appears and opens the correct underlying record in a new tab.
3. Click **Submit** (finalize) with that row still unverified.
   - [ ] Blocked with a message naming the incomplete roster (e.g. `All records in "Records
     included — ..." must be attached and verified before this can be submitted.`)
   - [ ] No data is lost — form fields remain filled after the blocked attempt.
4. Click **Save draft** in the same state.
   - [ ] Draft saves successfully — drafts are never blocked by the roster-completeness rule.
5. Go verify the underlying record via the existing verification queue / sign-off flow,
   then reopen the NRCS Canning draft.
   - [ ] The row's badge now reads **"Verified (DD/MM/YYYY)"** with the correct date,
     without needing to re-pick the row.
6. With every required row in the roster now verified, click **Submit**.
   - [ ] Submission succeeds.
7. Test the "not attached" case: start a fresh entry with `JOBNO`, leave the roster with
   zero rows or a row with no value picked, click Submit.
   - [ ] Blocked with an appropriate message — distinct in effect (not necessarily wording)
     from the "attached but unverified" case; the row shows badge "Not attached".
8. Confirm "View record" links open the correct record for a couple of different rows
   (not just the first one tested).
9. **Regression — Cans Produced auto-fill (prior change, now merged into this roster):**
   add another row in the same "Records included" roster and pick a "Cans Produced"
   (REC 7.2.7) submission for it.
   - [ ] `Production code`, `NRCS AG code`, `Product description` (from `brineOrBraised`)
     auto-populate on that row, while `REC code`/`Record name` still populate as before —
     confirms both `fillCode`/`fillName` and `fillMap` apply together on one column.
10. **Cache check:** hard-refresh (Ctrl+Shift+R) the NRCS Canning page and confirm no
    console errors and the roster still renders with badges/links — confirms the
    `?v=` bumps on `traceability.js`/`form-record.js` took effect everywhere this page
    loads them from.

### Notes for whoever runs this
- The 4 badge states to look for: `Not attached` (muted), `Draft — not yet submitted`
  (info), `Awaiting verification` (warn), `Verified (DD/MM/YYYY)` (ok).
- If old trace-index rows (filed before this change) show "Not attached" or an odd
  status on a record you know is filed, run `public/pages/backfill-traceability.html`
  to re-index them — it now also picks up rows missing the new `status` field.

---
