# OOSW Read-Only Field Implementation Outline
## Visual Overview & Quick Reference

**Date:** 2026-10-21  
**For:** Claude Code team  
**Scope:** Step-by-step implementation guide with diagrams

---

## 1. 4-Phase Roadmap

```
Phase 1: Database (Days 1–2)
├─ Create view v_dry_job_weights
├─ Verify oosw_kg_manual data integrity
└─ Plan column removal (post-testing)

Phase 2: Backend & Frontend (Days 2–4)
├─ Extend /api/lookup/job endpoint
├─ Add R2 and R3 rules to business-rules.json
├─ Remove manual OOSW input from form HTML
├─ Add read-only OOSW display
└─ Implement live capacity calculations

Phase 3: Testing & QA (Days 4–5)
├─ Unit tests (API, view)
├─ Integration tests (form + rules)
├─ UAT with 2–3 operators
├─ Regression tests (existing jobs)
└─ All 12 test scenarios pass

Phase 4: Deployment (Days 5–6)
├─ Smoke test in production
├─ Train operators
├─ Monitor (24–48h)
└─ Post-go-live: Drop oosw_kg_manual column
```

---

## 2. Form Layout: Before & After

### Before (Current)
```
JOB INFO
─────────────────────────────────────
Job number:       DPR01168
Processing for:   Farm A
Whole weight:     1 600 kg
Harvest farm:     Farm A
Intake date:      2026-10-20
OOSW weight (kg): [ 1519.00 ]  ← MANUAL INPUT
Available to cook: 1 088.32 kg
```

### After (New)
```
JOB INFO
─────────────────────────────────────
Job number:       DPR01168
Processing for:   Farm A
Whole weight:     1 600 kg
Harvest farm:     Farm A
Intake date:      2026-10-20
OOSW (kg):        1 519 kg  [READ-ONLY] (from REC 7.1.5)

POTS & CAPACITY
─────────────────────────────────────
OOSW: 1 519 kg │ Available to blanch: 1 219 kg
Available to cook: 969 kg
2 pots / 300 kg blanching / 250 kg cooking
```

---

## 3. Weight Rules at a Glance

| Rule | Definition | Gate |
|------|-----------|------|
| **R1** | Cooking ≤ OOSW | Soft (confirm to override) |
| **R2** | Blanching ≤ OOSW | Soft (confirm to override) |
| **R3** | Cooking ≤ Blanching | Soft (confirm to override) |

**All three:** Soft gates at Finalize; drafts never blocked.

---

## 4. Database View (v_dry_job_weights)

**Purpose:** Job-level weight summary for reports and trends.

**Key columns:**
- `job_no` — Job identifier
- `oosw_kg` — Total from REC 7.1.5
- `blanched_kg` — Sum of blanching entries
- `cooked_kg` — Sum of cooking entries
- `available_to_blanch_kg` — OOSW minus blanched
- `available_to_cook_kg` — Blanched minus cooked

**Used for:** Capacity reports, trend analysis, job summaries.

---

## 5. Code Checklist

### Backend Files
| File | Change | Priority |
|------|--------|----------|
| `routes/api/lookup/job.js` | Extend endpoint to return OOSW + per-process totals | HIGH |
| `public/data/business-rules.json` | Add R2 rule (Blanching cap) | HIGH |
| `public/data/business-rules.json` | Add R3 rule (Cooking vs Blanching) | HIGH |

### Frontend Files
| File | Change | Priority |
|------|--------|----------|
| `public/pages/form-record.html` | Remove manual ooswKg input field | HIGH |
| `public/pages/form-record.html` | Add read-only OOSW display | HIGH |
| `public/js/form-record.js` | Calculate "Available" figures live | HIGH |
| `public/js/form-record.js` | Update tally line on keystroke | MEDIUM |

---

## 6. 12 Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | No REC 7.1.5 record | "Not recorded" shown; R1 & R2 skipped; R3 works |
| 2 | OOSW 500 kg; Blanching 600 kg | R2 fires; "Available to blanch: −100" (red) |
| 3 | Blanching 300 kg; Cooking 350 kg | R3 fires; "Available to cook: −50" (red) |
| 4 | Override R2 + R3 at Finalize | Both override lines saved to record |
| 5 | Multi-entry job (2 entries) | Totals aggregate; excludeId works |
| 6 | Card carry-forward | Cooking pre-fills min(Blanch kg, Available) |
| 7 | Database view | Figures match screen for sample jobs |
| 8 | Existing jobs | No regression; all still work |
| 9 | Form save | ooswKg removed from payload |
| 10 | Drying report | Still pulls OOSW from REC 7.1.5 |
| 11 | Responsive | "Available" displays readable on tablet |
| 12 | Legacy entries | Old warnings still readable |

---

## 7. Risk & Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| OOSW mismatch (prod data) | MEDIUM | Verify all values before go; log discrepancies |
| Missing REC 7.1.5 record | LOW | Document "Not recorded"; train operators |
| View query performance | LOW | Index dry_cooking(job_no, process, status) |
| Override audit loss | LOW | Optional audit table; fallback in oosWarningNote |

---

## 8. Success Criteria

✓ Manual OOSW field removed  
✓ Read-only OOSW from REC 7.1.5  
✓ Rules R1, R2, R3 fire correctly  
✓ "Available to blanch/cook" displayed live  
✓ Database view computes accurately  
✓ All tests pass  
✓ No regressions  
✓ Operators trained  

---

## 9. Next Steps

1. **Review** the system design document (oosw-read-only-field-system-design.md).
2. **Confirm** rule behavior and override handling with Michaela.
3. **Create** database backup (Neon).
4. **Hand to Claude Code** with the code instructions file (claude/oosw-removal-code-instructions.md).
5. **Execute** Phase 1–4 following the checklist.
6. **Deploy** to production.
