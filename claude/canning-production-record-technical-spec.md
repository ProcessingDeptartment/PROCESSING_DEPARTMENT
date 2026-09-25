# Canning Production Record — Technical Specification for Implementation

**Record Type:** REC-7.3.X Canning Production (Cans Produced)  
**Target File:** `public/pages/canning-production.html`  
**Status:** Ready to implement  
**Date:** 2026-09-17

---

## 1. File Structure & Entry Point

**File:** `public/pages/canning-production.html`

**Required dependencies (all existing in the project):**
- `public/lib/data-store.js` — storage adapter (`window.storage.get/set/remove`)
- `public/lib/common.js` — utility functions (DOM manipulation, validation, formatting)
- `public/lib/traceability.js` — optional, for linking records to job/batch
- `public/lib/api-backend.js` — backend connectivity

**External dependencies:** None beyond what's already in `public/lib/`.

---

## 2. HTML Structure & Form Elements

### 2.1 Toolbar (top of page)
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

### 2.2 Form Container
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

### 2.3 Batch Row Template (repeating, inserted by JS)
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

## 3. JavaScript Logic & Event Handlers

### 3.1 Initialization
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

### 3.2 Production Code Selection
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

### 3.3 Batch Row Management
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

### 3.4 Conditional Sauce Batch Field
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

### 3.5 Form Validation
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

### 3.6 Form Submission
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

## 4. CSS Styling (in `record-theme.css` or inline `<style>`)

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

## 5. Integration Checklist

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

## 6. Testing Checklist

- [ ] **Trolley group:** Fill all 5 fields, verify non-empty on submit.
- [ ] **Batch group:** Add 2 rows, delete 1, re-add 1. Verify all fields required.
- [ ] **Sauce Batch conditional:** Select "Braised," verify Sauce Batch field appears and is required. Select "Brine," verify it hides and clears.
- [ ] **Damage group:** Leave both empty, attempt submit, verify error. Enter 0 for both, submit succeeds.
- [ ] **Comments:** Leave blank, submit succeeds. Enter text, submit succeeds.
- [ ] **Validation:** Attempt submit with missing Production Code, Time, etc. Verify error banner lists all failures.
- [ ] **Data persistence:** Submit record, verify it appears in storage with correct key format and structure.
- [ ] **Mobile:** Open on phone/tablet, verify fields stack, buttons are touch-sized, no overflow.
- [ ] **Accessibility:** Tab through form, verify logical order. Test screen reader with ARIA labels.
