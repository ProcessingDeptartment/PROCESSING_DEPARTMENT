# Verification Preview — Salting OOSW Fields (REC 7.1.5)

**Date:** 2026-10-21  
**Raised by:** Michaela — "OOSW count is irrelevant; need OOSW kg and % in verification preview"  
**File:** `public/data/record-defs/salting-oosw.json`  
**Related:** `public/pages/awaiting-verification.html` (uses `listColumns` for preview display)

---

## 1. Problem

The verification preview for REC 7.1.5 (Salting OOSW) currently shows:
- Individual roster rows with raw field keys
- OOSW count (number of roster entries) — **no longer needed**

What is needed:
- **OOSW weight (kg)** — total weight from all roster rows
- **OOSW %** — percentage relative to the whole weight received

---

## 2. What to change

### 2.1 Add calculated fields to the record definition

In `public/data/record-defs/salting-oosw.json`, add two new derived/summary fields in the main form section:

```json
{
  "name": "Salting — OOSW",
  "key": "salting-oosw",
  "type": "form",
  "sections": [
    {
      "key": "top",
      "title": "Record header",
      "fields": [
        { "key": "jobNo", "label": "Job No.", "type": "text", "required": true },
        { "key": "timestamp", "label": "Timestamp", "type": "timestamp" },
        // ... existing fields ...
        
        // ✅ NEW: Summary fields (derived from roster)
        {
          "key": "totalOoswKg",
          "label": "Total OOSW (kg)",
          "type": "number",
          "readonly": true,
          "helpText": "Sum of all OOSW weight values from roster rows below"
        },
        {
          "key": "ooswPercent",
          "label": "OOSW (%)",
          "type": "number",
          "readonly": true,
          "helpText": "OOSW weight as % of whole weight received"
        }
      ]
    }
  ],
  "roster": {
    "title": "Size range breakdown",
    "columns": [
      { "key": "sizeRange", "label": "Size range", "type": "text" },
      { "key": "wholeWeight", "label": "Whole weight (kg)", "type": "number" },
      { "key": "weight", "label": "OOSW weight (kg)", "type": "number" }
    ]
  },
  "listColumns": [
    "jobNo",
    "totalOoswKg",
    "ooswPercent",
    "roster:count"
  ]
}
```

**Key changes:**
- Added `totalOoswKg` — read-only field that displays the sum of roster `weight` values
- Added `ooswPercent` — read-only field that displays the OOSW as a percentage
- Set `listColumns` to show only the summary fields + roster row count (not individual rows)
- Removed the concept of "OOSW count" — replaced with `roster:count` which shows number of size-range rows

---

### 2.2 Populate the summary fields on form save

In the form HTML (`public/pages/form-record.html`), add a pre-submit hook that calculates these values:

```javascript
// Before form submit, calculate OOSW summary fields
form.on('beforesubmit', function(e) {
  var record = form.record || {};
  var roster = record.roster || [];
  
  // Calculate total OOSW kg
  var totalOoswKg = 0;
  roster.forEach(function(row) {
    var weight = parseFloat(row.weight) || 0;
    totalOoswKg += weight;
  });
  record.totalOoswKg = totalOoswKg;
  
  // Calculate OOSW as percentage of whole weight
  // Sum of whole weight from roster
  var totalWholeWeight = 0;
  roster.forEach(function(row) {
    var whole = parseFloat(row.wholeWeight) || 0;
    totalWholeWeight += whole;
  });
  
  if (totalWholeWeight > 0) {
    record.ooswPercent = Math.round((totalOoswKg / totalWholeWeight) * 100 * 100) / 100;
  } else {
    record.ooswPercent = null;
  }
});
```

**Or**, if using form-record.js's field calculation system:

Add computed fields to the form definition:

```json
{
  "key": "totalOoswKg",
  "computed": "sum(roster[*].weight)",
  "readonly": true
},
{
  "key": "ooswPercent",
  "computed": "(totalOoswKg / sum(roster[*].wholeWeight)) * 100",
  "readonly": true,
  "precision": 2
}
```

---

## 3. How verification preview renders this

In `public/pages/awaiting-verification.html`, when the verifier clicks **Preview** on a REC 7.1.5 entry:

1. The preview loads the record definition for `salting-oosw`
2. It reads `listColumns`: `["jobNo", "totalOoswKg", "ooswPercent", "roster:count"]`
3. It renders:
   ```
   Job No.              JXB-2024-1001
   Total OOSW (kg)      24.5
   OOSW (%)             18.2
   Size range entries   4 rows
   ```

The individual roster rows are **not** shown in the preview (only the count), which keeps the preview concise.

---

## 4. Testing checklist

1. **Submit a REC 7.1.5 (Salting OOSW)** with:
   - Job number: JXB-2024-1001
   - Roster with 3 size ranges:
     - Size A: 10 kg whole, 2 kg OOSW
     - Size B: 15 kg whole, 3 kg OOSW
     - Size C: 12 kg whole, 2 kg OOSW
   
   Expected summary:
   - Total OOSW (kg) = 7 kg
   - OOSW (%) = 7 / (10+15+12) × 100 = 18.92%

2. Go to **Awaiting Verification** → find the REC 7.1.5 entry → click **Preview**
   - [ ] Preview shows: Job No., Total OOSW (kg), OOSW (%), Size range entries (3 rows)
   - [ ] No raw roster rows displayed
   - [ ] Percentage is correct (18.92%)

3. Open the **full submission form** (via "Open full record →")
   - [ ] `totalOoswKg` field shows 7
   - [ ] `ooswPercent` field shows 18.92
   - [ ] Fields are read-only (greyed out, not editable)

4. Open **Drying Report** for the same job
   - [ ] OOSW weight pulls correctly as 7 kg from the salting record
   - [ ] No console errors

---

## 5. Commit

```bash
git add public/data/record-defs/salting-oosw.json public/pages/form-record.html
git commit -m "feat: verification preview for salting OOSW — show kg and % instead of count

- Add totalOoswKg and ooswPercent summary fields to salting-oosw definition
- Remove OOSW count from relevant displays (use roster:count instead)
- Configure listColumns to show summary fields and row count only
- Calculate OOSW % relative to total whole weight received
- Update form to populate summaries on save
- Verification preview now shows: Job No., Total OOSW (kg), OOSW (%), row count

Fixes: salting record preview missing kg and % fields

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TjK1BdgzPgUWQVCpihUM7P\"
git push origin main
```

---

## 6. Additional notes

### Why `ooswPercent` is needed

The percentage shows at a glance whether the OOSW (unsaleable/off-size weight) is within acceptable range for the batch. If OOSW is unusually high (e.g., >25%), the verifier can flag the batch for investigation without doing mental math.

### Storage in database

Once calculated and submitted, both `totalOoswKg` and `ooswPercent` are stored with the record. This means:
- The drying report can optionally pull these summaries directly (faster than re-calculating)
- Historical records retain the exact ooswPercent at the time of submission
- Trends over time can be tracked

### If form-record.js doesn't support computed fields

If `computed` is not supported, the pre-submit hook approach (in section 2.2, first code block) is the fallback — no schema changes needed, just JavaScript logic.
