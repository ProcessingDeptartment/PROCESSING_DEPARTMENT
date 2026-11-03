# OOSW Manual Field Removal — Code Implementation Instructions
## For Claude Code Execution

**Date:** 2026-10-21  
**Status:** Ready for implementation  
**Scope:** Detailed step-by-step instructions for removing manual OOSW field and implementing rules R2 & R3

---

## Overview

Remove the manual `ooswKg` input field from REC 7.4.0 Dry Cooking. Replace with a read-only field that pulls from REC 7.1.5. Implement weight rules R2 and R3 to enforce blanching and cooking capacity limits.

**Estimated effort:** 4–5 days (Phases 1–3)

---

## Phase 1: Database (Days 1–2)

### 1.1 Create view v_dry_job_weights

**File to create:** `database/migrations/v_dry_job_weights.sql`

```sql
-- Migration: Create v_dry_job_weights view
-- Purpose: Job-level weight summary for trends and reporting
-- Date: 2026-10-21
-- Portable: Standard SQL only

CREATE VIEW v_dry_job_weights AS
SELECT
  dc.job_no,
  coalesce(sor.total_oosw_kg, 0) AS oosw_kg,
  coalesce(
    sum(CASE WHEN dc.process = 'Blanching' AND dc.status = 'submitted' THEN dc.abalone_kg ELSE 0 END), 
    0
  ) AS blanched_kg,
  coalesce(
    sum(CASE WHEN dc.process = 'Cooking' AND dc.status = 'submitted' THEN dc.abalone_kg ELSE 0 END), 
    0
  ) AS cooked_kg,
  coalesce(sor.total_oosw_kg, 0) - coalesce(
    sum(CASE WHEN dc.process = 'Blanching' AND dc.status = 'submitted' THEN dc.abalone_kg ELSE 0 END), 
    0
  ) AS available_to_blanch_kg,
  coalesce(
    sum(CASE WHEN dc.process = 'Blanching' AND dc.status = 'submitted' THEN dc.abalone_kg ELSE 0 END), 
    0
  ) - coalesce(
    sum(CASE WHEN dc.process = 'Cooking' AND dc.status = 'submitted' THEN dc.abalone_kg ELSE 0 END), 
    0
  ) AS available_to_cook_kg,
  max(dc.record_date) AS last_record_date,
  count(DISTINCT CASE WHEN dc.status = 'submitted' THEN dc.submission_id END) AS entry_count
FROM dry_cooking dc
LEFT JOIN salting_oosw_roster sor ON dc.job_no = sor.job_no AND sor.status = 'submitted'
GROUP BY dc.job_no, sor.total_oosw_kg
HAVING count(dc.job_no) > 0;

-- Test query:
-- SELECT * FROM v_dry_job_weights WHERE job_no = 'DPR01168';
```

**Deploy to Neon:**
1. Go to https://console.neon.tech → your processing_system database
2. Open SQL Editor
3. Paste and execute the CREATE VIEW statement
4. Verify with test query above

---

### 1.2 Verify oosw_kg_manual data

**Run this query in Neon SQL Editor:**

```sql
SELECT
  dc.job_no,
  dc.oosw_kg_manual,
  sor.total_oosw_kg,
  abs(dc.oosw_kg_manual - sor.total_oosw_kg) AS difference
FROM dry_cooking dc
LEFT JOIN salting_oosw_roster sor ON dc.job_no = sor.job_no AND sor.status = 'submitted'
WHERE dc.oosw_kg_manual IS NOT NULL
  AND dc.status = 'submitted'
ORDER BY difference DESC;
```

**Document findings:**
- Count rows with `difference > 0.01` (material discrepancy)
- If major discrepancies exist, discuss with Michaela before proceeding
- If none or minor (<0.5%), safe to proceed to Phase 2

---

## Phase 2: Backend API & Business Rules (Days 2–3)

### 2.1 Extend job lookup API endpoint

**File:** `routes/api/lookup/job.js` (or equivalent)

**Add to the response object:**

```javascript
// After fetching base job info, add these:

// 1. Fetch OOSW from REC 7.1.5 (NEW)
const oosw = await db.query(
  `SELECT coalesce(sum(weight_kg), 0) as total_oosw_kg
   FROM salting_oosw_roster
   WHERE job_no = $1 AND status = 'submitted'`,
  [jobNo]
);

// 2. Fetch per-process totals from submitted REC 7.4.0 entries (NEW)
let processQuery = `
  SELECT 
    process,
    coalesce(sum(abalone_kg), 0) as total_kg
  FROM dry_cooking_pot
  WHERE job_no = $1 AND status = 'submitted'
`;

let queryParams = [jobNo];

if (excludeId) {
  processQuery += ` AND submission_id != $2`;
  queryParams.push(excludeId);
}

processQuery += ` GROUP BY process`;

const processData = await db.query(processQuery, queryParams);

// 3. Return combined response
return res.json({
  // ... existing fields ...
  oosw_kg: oosw.rows[0].total_oosw_kg || null,
  blanched_kg: processData.rows.find(r => r.process === 'Blanching')?.total_kg || 0,
  cooked_kg: processData.rows.find(r => r.process === 'Cooking')?.total_kg || 0,
  oosw_not_recorded: !oosw.rows[0].total_oosw_kg
});
```

**Test endpoint:**
```bash
# Test with a real job
curl "http://localhost:3000/api/lookup/job/DPR01168"

# Expected response includes:
# "oosw_kg": 1519,
# "blanched_kg": 300,
# "cooked_kg": 250,
# "oosw_not_recorded": false
```

---

### 2.2 Update business-rules.json with R2 and R3

**File:** `public/data/business-rules.json`

**Add these two objects to the rules array:**

```json
{
  "id": "blanching_weight_vs_oosw",
  "name": "R2: Blanching weight must not exceed OOSW",
  "recordType": "dry-cooking",
  "type": "capAgainstExternalRecord",
  "column": "abalone_kg",
  "rowFilter": "process = 'Blanching'",
  "externalTable": "salting_oosw_roster",
  "joinOn": "job_no",
  "externalColumn": "total_oosw_kg",
  "gate": "soft",
  "message": "Blanching pot weight exceeding OOSW - possible batch mix"
},
{
  "id": "cooking_weight_vs_blanching",
  "name": "R3: Cooking weight must not exceed blanching weight",
  "recordType": "dry-cooking",
  "type": "capRowsAgainstRows",
  "column": "abalone_kg",
  "rowFilter": "process = 'Cooking'",
  "capRowsFilter": "process = 'Blanching'",
  "gate": "soft",
  "message": "Cooking weight exceeds blanched weight - cooked more than was blanched"
}
```

---

## Phase 2: Frontend (Days 2–4)

### 3.1 Remove manual OOSW input field from form HTML

**File:** `public/pages/form-record.html` (REC 7.4.0 section)

**Find and remove:**
```html
<!-- REMOVE THESE LINES: -->
<label>OOSW weight (kg)
  <input type="number" id="ooswKg" placeholder="e.g., 1519" step="0.01" min="0" />
</label>
<div id="availableToCookWarning" class="info-line"></div>
```

**Replace with:**
```html
<!-- NEW: Read-only OOSW from REC 7.1.5 -->
<label>OOSW (kg):
  <span id="ooswKg" class="read-only-field"></span>
  <em id="ooswSource" class="field-note"></em>
</label>
```

**Add CSS:**
```css
.read-only-field {
  display: inline-block;
  padding: 4px 8px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-family: monospace;
  cursor: default;
  user-select: none;
}

.field-note {
  display: block;
  font-size: 0.85em;
  color: #999;
  margin-top: 2px;
}
```

---

### 3.2 Update form JavaScript

**File:** `public/js/form-record.js`

**Update the job autofill function:**

```javascript
async function autofillJobInfo(jobNo, currentSubmissionId) {
  // Fetch with excludeId param (avoids double-counting on edit)
  const url = `/api/lookup/job/${jobNo}` + (currentSubmissionId ? `?excludeId=${currentSubmissionId}` : '');
  const response = await fetch(url);
  const job = await response.json();
  
  // Store globally for weight rule checks
  window.currentJobData = job;
  
  // Display basic job info (unchanged)
  document.getElementById('jobNumber').textContent = job.job_no;
  document.getElementById('processingFor').textContent = job.farm_name;
  // ... other fields ...
  
  // NEW: Display read-only OOSW
  const ooswSpan = document.getElementById('ooswKg');
  const ooswSource = document.getElementById('ooswSource');
  
  if (job.oosw_not_recorded) {
    ooswSpan.textContent = 'Not recorded';
    ooswSpan.style.color = '#999';
    ooswSource.textContent = '(from REC 7.1.5 - no record found)';
  } else {
    ooswSpan.textContent = (job.oosw_kg || 0).toFixed(2) + ' kg';
    ooswSpan.style.color = '#333';
    ooswSource.textContent = '(from REC 7.1.5)';
  }
  
  // Recalculate capacity displays
  updateCapacityDisplays();
}
```

**Add function to calculate available capacity:**

```javascript
function updateCapacityDisplays() {
  if (!window.currentJobData) return;
  
  const jobData = window.currentJobData;
  const oosw = jobData.oosw_kg || 0;
  const blanched = jobData.blanched_kg || 0;
  const cooked = jobData.cooked_kg || 0;
  
  // Add current cards (not yet submitted)
  const currentBlanched = getTotalFromCurrentCards('Blanching');
  const currentCooked = getTotalFromCurrentCards('Cooking');
  
  const totalBlanched = blanched + currentBlanched;
  const totalCooked = cooked + currentCooked;
  
  const availableToBlanch = oosw - totalBlanched;
  const availableToCook = totalBlanched - totalCooked;
  
  // Update tally line and per-card displays
  updateTallyLine(oosw, availableToBlanch, availableToCook);
  updatePerCardCapacity(availableToBlanch, availableToCook);
}

function getTotalFromCurrentCards(process) {
  const cards = document.querySelectorAll(`.pot-card[data-process="${process}"]`);
  let total = 0;
  cards.forEach(card => {
    const weightInput = card.querySelector('input[data-field="abalone_kg"]');
    if (weightInput && weightInput.value) {
      total += parseFloat(weightInput.value) || 0;
    }
  });
  return total;
}

function updateTallyLine(oosw, availableToBlanch, availableToCook) {
  const tallyLine = document.getElementById('tallyLine');
  if (!tallyLine) return;
  
  const format = (num) => Math.abs(num).toFixed(2);
  const styleToBlanch = availableToBlanch < 0 ? 'color: red;' : '';
  const styleToCook = availableToCook < 0 ? 'color: red;' : '';
  
  tallyLine.innerHTML = `
    <strong>Capacity:</strong><br/>
    <span>OOSW: ${oosw.toFixed(2)} kg</span> |
    <span style="${styleToBlanch}">Available to blanch: ${availableToBlanch < 0 ? '−' : ''}${format(availableToBlanch)} kg</span> |
    <span style="${styleToCook}">Available to cook: ${availableToCook < 0 ? '−' : ''}${format(availableToCook)} kg</span>
  `;
}

function updatePerCardCapacity(availableToBlanch, availableToCook) {
  document.querySelectorAll('.pot-card').forEach(card => {
    const process = card.getAttribute('data-process');
    let capacityDisplay = card.querySelector('.capacity-display');
    
    if (!capacityDisplay) {
      capacityDisplay = document.createElement('div');
      capacityDisplay.className = 'capacity-display';
      const weightInput = card.querySelector('input[data-field="abalone_kg"]');
      if (weightInput) weightInput.parentNode.insertBefore(capacityDisplay, weightInput.nextSibling);
    }
    
    if (process === 'Blanching') {
      const style = availableToBlanch < 0 ? 'color: red;' : '';
      capacityDisplay.innerHTML = `<em style="${style}">Available to blanch: ${availableToBlanch < 0 ? '−' : ''}${Math.abs(availableToBlanch).toFixed(2)} kg</em>`;
    } else if (process === 'Cooking') {
      const style = availableToCook < 0 ? 'color: red;' : '';
      capacityDisplay.innerHTML = `<em style="${style}">Available to cook: ${availableToCook < 0 ? '−' : ''}${Math.abs(availableToCook).toFixed(2)} kg</em>`;
    }
  });
}

// Hook into weight input changes
document.addEventListener('change', (e) => {
  if (e.target.matches('input[data-field="abalone_kg"]')) updateCapacityDisplays();
});

document.addEventListener('keyup', (e) => {
  if (e.target.matches('input[data-field="abalone_kg"]')) updateCapacityDisplays();
});
```

---

### 3.3 Update form submission

**In the `buildSubmissionPayload()` function, remove:**

```javascript
// DELETE THIS LINE:
ooswKg: document.getElementById('ooswKg').value,
```

The OOSW field is now read-only and not submitted.

---

## Phase 3: Testing (Days 4–5)

### 4.1 Test database view

```sql
-- Query the view for a sample job
SELECT * FROM v_dry_job_weights WHERE job_no = 'DPR01168';

-- Verify columns are populated correctly:
-- oosw_kg, blanched_kg, cooked_kg, available_to_blanch_kg, available_to_cook_kg
```

---

### 4.2 Test API endpoint

```bash
curl "http://localhost:3000/api/lookup/job/DPR01168"

# Verify response has all fields:
# oosw_kg, blanched_kg, cooked_kg, oosw_not_recorded
```

---

### 4.3 Manual UAT Checklist

- [ ] Load a job with REC 7.1.5 OOSW record → displays correctly (read-only)
- [ ] Load a job WITHOUT REC 7.1.5 record → shows "Not recorded"
- [ ] Add blanching pot 300 kg → "Available to blanch" updates (red if negative)
- [ ] Add cooking pot 250 kg → "Available to cook" updates (red if negative)
- [ ] Rule R1 fires at Finalize (Cooking > OOSW)
- [ ] Rule R2 fires at Finalize (Blanching > OOSW)
- [ ] Rule R3 fires at Finalize (Cooking > Blanching)
- [ ] Override confirmation works; message saved to record
- [ ] Form save without manual OOSW input field
- [ ] No regressions on existing submitted jobs

---

## Phase 4: Deployment

### 5.1 Pre-deployment checklist

- [ ] Database backup created (Neon)
- [ ] All tests pass
- [ ] Code review completed
- [ ] UAT sign-off obtained

### 5.2 Deployment steps

1. Commit and push to `main`
2. Render auto-deploys (~30–60s)
3. Verify form loads without errors
4. Monitor for API errors (24h)
5. Train operators

### 5.3 Post-go-live (1–2 weeks after)

- [ ] Run: `node scripts/export-record-defs.mjs` to save record state
- [ ] Archive `oosw_kg_manual` data (optional)
- [ ] Drop `oosw_kg_manual` column from `dry_cooking` table

```sql
ALTER TABLE dry_cooking DROP COLUMN IF EXISTS oosw_kg_manual CASCADE;
```

---

## Success Criteria

✓ Manual OOSW input field removed  
✓ Read-only OOSW displays (from REC 7.1.5)  
✓ Rules R1, R2, R3 fire correctly  
✓ "Available to blanch/cook" updates live  
✓ All 12 test scenarios pass  
✓ No regressions  
✓ Operators trained  

---

**Next:** Hand to Claude Code with this file. Follow Phases 1–4 sequentially.
