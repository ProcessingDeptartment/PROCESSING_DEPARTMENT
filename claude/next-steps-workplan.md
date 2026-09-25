# Processing Department — Next Steps Work Plan

**Status:** Active  
**Date:** 2026-09-18  
**Owner:** Michaela  
**Tracks:** Option A (Ship Fast) + Option C (Design Pipeline)

---

## Track A: Ship Fast (Canning Production + Drying Report)

### A1. Canning Production Record Implementation
**Status:** Ready to build  
**Input:** `claude/canning-production-record-technical-spec.md`  
**Deliverable:** `public/pages/canning-production.html`  
**Owner:** Claude Code  
**Timeline:** Start immediately, 4–6 hours  
**Approval:** [Pending Claude Code completion]

**Testing before live:**
- [ ] Form renders correctly on desktop, tablet, mobile
- [ ] All validation rules work (required fields, ranges, conditional Sauce Batch)
- [ ] Batch rows add/edit/delete correctly
- [ ] Total Cans counter updates on each row add/delete
- [ ] Timestamp button sets current time correctly
- [ ] Submit saves to KeyValue table with correct schema
- [ ] Error messages display on validation failure
- [ ] Success toast appears and form clears
- [ ] Dropdowns match specified lists (Retort Code, Retort Number, Can Size, Cooking Method, Drain Weight)

**Staging deployment:** Once built, test on staging before production push.

---

### A2. Drying Report Implementation
**Status:** Ready to build  
**Input:** `claude/drying-report-spec.md`  
**Deliverable:** `public/pages/drying-report.html`  
**Owner:** Claude Code  
**Timeline:** Start after Canning Production, 3–4 hours  
**Approval:** [Pending Claude Code completion]

**Testing before live:**
- [ ] Report loads and displays data correctly
- [ ] CSV export works with correct columns
- [ ] Print preview renders cleanly
- [ ] Job dropdown filters to 3CP/CPR prefix only
- [ ] All computed fields (yield %, target cans, etc.) calculate correctly
- [ ] Mobile layout is readable (tables may scroll horizontally)

**Staging deployment:** Once built, test on staging before production push.

---

## Track C: Design Pipeline (Next Production Records)

### C1. Sauce Batch Preparation Record (REC-7.4.X)

**Why now?** Feeds into Canning Production; core to braised workflow.

**Gather requirements (by tomorrow):**
- [ ] Interview kitchen staff: What info is captured when a sauce batch is started?
- [ ] What ingredients go in? (sugar, water, spices — what's the list?)
- [ ] How long does mixing take? (minutes range?)
- [ ] What QA checks happen? (smell, color, pH range?)
- [ ] How is the batch ID formatted? (SB-2026-0918-001 assumed — confirm)
- [ ] Do batches link forward to Canning Production records? (yes, via sauceBatch field)
- [ ] Link backward to inventory? (yes, ingredient stock levels)

**Design brief for Claude (template provided):**
```
Record: REC-7.4.X Sauce Batch Preparation
Process: Kitchen staff prep sauce batches for braised canning
Users: Kitchen staff, 2–3 batches per shift
Fields to capture:
  - Batch ID, Date Started, Chef Name
  - Ingredients (sugar kg, water L, spices list)
  - Process (mixing duration min, final temp °C)
  - Quality checks (pH, smell OK, appearance notes)
  - Comments

Validation:
  - Batch ID unique, matches format SB-YYYY-MM-DD-###
  - Mixing duration 0–180 min
  - Final temp 60–100°C
  - pH 2.5–4.5
  - Comments optional

Reference: Canning Production Record design pattern
```

**Deliverables from Claude:**
- Design & Layout Instructions (markdown)
- Technical Specification (markdown)

**Timeline:** Design Thursday–Friday (2 days), ready to code next week.

---

### C2. Quality Sampling Record (REC-7.5.X)

**Why now?** Lab data needed for compliance; high visibility.

**Gather requirements (by end of week):**
- [ ] Interview lab tech: What gets sampled and when?
- [ ] What measurements are taken? (pH, weight, appearance, microbiology results?)
- [ ] How often? (per batch, per trolley, per day?)
- [ ] Does it link to a canning batch? (yes, via batch/trolley)
- [ ] What pass/fail criteria? (pH > 3.5 = pass, etc.?)
- [ ] Who approves results? (lab manager signature/sign-off?)

**Design brief for Claude:**
```
Record: REC-7.5.X Quality Sampling
Process: Lab tech records QA measurements on product samples
Users: Lab technician, 5–10 samples per shift
Fields to capture:
  - Sample ID, Batch/Trolley Link, Date Sampled
  - Measurements (pH, weight g, appearance notes)
  - Microbiology (if applicable)
  - Pass/Fail Status
  - Reviewed By (lab manager)
  - Comments

Validation:
  - Sample ID unique
  - pH 2.5–4.5 (or per product type)
  - Weight > 0
  - Pass/Fail required
  - Reviewed By required if Fail

Reference: Canning Production Record design pattern
```

**Deliverables from Claude:**
- Design & Layout Instructions (markdown)
- Technical Specification (markdown)

**Timeline:** Design next week (Mon–Tue), ready to code by Wednesday.

---

### C3. Waste Tracking Record (REC-7.6.X)

**Status:** Optional, lower priority  
**Timing:** Design following week if bandwidth allows

**Why?** Operational insight (trim, damaged goods, off-grade product). Not blocking anything.

**Gather requirements (async):**
- [ ] What waste types? (damaged, off-grade, trim, other?)
- [ ] How measured? (count, weight kg, volume L?)
- [ ] When logged? (end of batch, end of shift, continuous?)
- [ ] Does it link to a batch? (yes)
- [ ] Reason codes? (yes, dropdown)

---

## Recommended Timeline

| Week | Track A (Coding) | Track C (Design) | Blockers | Handoff |
|---|---|---|---|---|
| W1 (Sep 18–22) | Canning Production build + test | Sauce Batch requirements + design brief | None | Canning Prod → staging test |
| W2 (Sep 25–29) | Drying Report build + test | Quality Sampling requirements + design brief | None | Both → production if tests pass |
| W3 (Oct 2–6) | Regression testing on staging | Sauce Batch + Quality Sampling approve & hand to Claude Code | None | Sauce Batch implementation |
| W4 (Oct 9–13) | Deploy to production | Quality Sampling implementation | None | Quality Sampling deploy |

---

## How to Brief Claude

### For Track A (Claude Code builds):

**Canning Production:**
```
Implement public/pages/canning-production.html

Technical spec: claude/canning-production-record-technical-spec.md

Reference: public/pages/canning-report.html (for style patterns)

Required:
- Self-contained HTML (no separate CSS/JS files)
- Data stored via window.storage adapter
- All validation per spec
- Mobile-responsive (tested on tablet/phone)

Testing: [checklist above]
Timeline: This week
```

**Drying Report:**
```
Implement public/pages/drying-report.html

Spec: claude/drying-report-spec.md

Reference: public/pages/canning-report.html (same pattern)

Required:
- Self-contained HTML
- CSV export button
- Print button
- Job dropdown filters to 3CP/CPR only
- All formulas per spec

Testing: [checklist above]
Timeline: After Canning Production
```

### For Track C (Claude Design):

**Sauce Batch Preparation:**
```
Design REC-7.4.X Sauce Batch Preparation record

Use: claude/intelligent-agent-role-out-template.md (briefing guide)

Deliverables:
1. Design & Layout Instructions (markdown)
2. Technical Specification (markdown)

Context: Feeds into Canning Production (braised medium)
Reference: Canning Production Record specs (follow same pattern)

Timeline: By Friday Sep 20
```

---

## Decision Points

### Before implementing Canning Production:
- [ ] Retort Code list confirmed (R1, R2, R3, ... how many?)
- [ ] Retort Number list confirmed (L1, R1, ... complete list?)
- [ ] Can Size options confirmed (Unit, Mince, or others?)
- [ ] Cooking Method times confirmed (11/15/24 min, others?)
- [ ] Drain Weight list confirmed (213g, 80g, 150g, 238g, 180g, 200g — any others?)
- [ ] AG Code source confirmed (Double Seam Inspection record — verified?)

### Before designing Sauce Batch:
- [ ] Requirements gathered from kitchen staff
- [ ] Batch ID format locked in (SB-YYYY-MM-DD-### assumed)
- [ ] Ingredient list finalized (sugar, water, spices — complete?)
- [ ] pH/temp/mixing ranges confirmed

### Before designing Quality Sampling:
- [ ] Requirements gathered from lab tech
- [ ] Measurement types locked in (pH, weight, appearance, microbiology?)
- [ ] Pass/fail criteria documented per product type

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Retort/can lists incomplete | Form rejects valid entries | Confirm full lists before Claude codes |
| Canning Production delays | Drying Report can't start | Build in parallel if possible |
| Requirements gathering slow | Design pipeline stalls | Start interviews this week |
| Integration with Double Seam Inspection fails | AG Code lookup broken | Verify data structure in existing record |

---

## Success Criteria

**Track A (Week 1–2):**
- [ ] Canning Production + Drying Report deployed to production
- [ ] Operations team logging data successfully
- [ ] Zero critical bugs in first 48 hours live

**Track C (Week 1–4):**
- [ ] Sauce Batch record designed, approved, and handed to Claude Code
- [ ] Quality Sampling record designed, approved, and handed to Claude Code
- [ ] Both implemented and tested by end of week 4

---

## Next Immediate Actions

**By EOD today (Sep 18):**
1. [ ] Confirm all Canning Production field lists (Retort Code, Can Size, Cooking Method, Drain Weight)
2. [ ] Confirm AG Code source (Double Seam Inspection record)
3. [ ] Schedule kitchen staff interview for tomorrow (Sauce Batch)
4. [ ] Schedule lab tech interview for tomorrow (Quality Sampling)

**Tomorrow (Sep 19):**
1. [ ] Hand Canning Production spec to Claude Code
2. [ ] Interview kitchen staff → document requirements
3. [ ] Interview lab tech → document requirements

**Friday (Sep 20):**
1. [ ] Canning Production in staging (test)
2. [ ] Brief Claude on Sauce Batch design
3. [ ] Brief Claude on Quality Sampling design

**Next week:**
1. [ ] Canning Production → production (if tests pass)
2. [ ] Drying Report → staging (test)
3. [ ] Review Sauce Batch + Quality Sampling designs
4. [ ] Hand approved designs to Claude Code for implementation
