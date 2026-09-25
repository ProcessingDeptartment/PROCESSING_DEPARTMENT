# Intelligent Agent Role-Out Template — Production Record Design Pattern

**Purpose:** Standardized workflow for Claude to design and specify new production records across the facility, following the pattern established by the Canning Production Record (REC-7.3.X).

**Date:** 2026-09-18  
**Status:** Template  
**Used for:** Rolling out data-entry forms for new production stages, equipment, or processes.

---

## Overview

This document describes how to brief Claude (Claude Code or Claude Design agent) to design new production records that follow Processing Department standards. Each new record should result in:

1. **Design & Layout Instructions** (markdown) — user-facing spec, clear layout, field definitions, validation rules.
2. **Technical Specification** (markdown) — implementation-ready HTML/JS/CSS structure, data storage schema, testing checklist.
3. **Completed page** (HTML) — coded, tested, and ready to deploy.

The template below is a **checklist and briefing framework** for Claude to follow every time a new production record is needed.

---

## Part 1: Gather Requirements (Before briefing Claude)

### 1.1 Understand the Process
- What stage of production does this record capture? (e.g., intake, processing, packaging, QA)
- Who are the users? (e.g., floor operators, supervisors, lab technicians)
- What equipment or actions trigger a record entry? (e.g., trolley entering retort, batch completed, sample drawn)
- How often is this record used? (dozens times/day, once/week, etc.)

### 1.2 Identify Core Data Fields
- **Grouping:** Do fields naturally cluster into sections? (e.g., equipment info, batch details, quality measurements, comments)
- **Required vs. optional:** Which fields must always be filled? Which are conditional?
- **Relationships:** Does this record link to another existing record type? (e.g., a batch record links to a job, a sample links to a batch)
- **Dropdowns vs. free-entry:** Which fields should use fixed lists (dropdowns) vs. allow new values?

### 1.3 Define Validation & Constraints
- Date/time fields: any bounds? (e.g., can't be in future, must be after job start)
- Numeric fields: ranges? (e.g., weight > 0, temperature 70–120°C)
- Conditional fields: when do some fields appear/disappear? (e.g., Sauce Batch only if Medium="Braised")
- Field interdependencies: if field A changes, should field B update? (e.g., choosing a different can size should clear a cache)

### 1.4 Confirm Data Output & Storage
- What reports or dashboards will consume this data?
- How should the data be stored? (KeyValue table with namespaced key, or a dedicated schema?)
- Do records need to link for traceability? (e.g., batch → job, sample → batch → trolley)
- Any fields that should generate computed/derived values? (e.g., total weight, yield %, time delta)

### 1.5 Decide on Scope & Schedule
- **MVP scope:** Which fields/features are essential for v1? (e.g., basic data capture, no barcode scanning)
- **Future enhancements:** What would be nice-to-have? (e.g., offline mode, templates, real-time dashboard)
- **Timeline:** When does this record need to be live? (influences breadth of documentation)

---

## Part 2: Brief Claude (Claude Code Agent or Design Agent)

### 2.1 The Design Brief

**Prompt structure for Claude (copy and customize):**

```
I need you to design a new production record for the Processing Department.

**Record Name:** [REC type and human name, e.g., "REC-7.4.X Sauce Batch Preparation"]

**Process Context:**
[1-2 paragraphs describing what this record captures and why. Example: "This record logs the preparation of sauce batches used in braised canning. Operators enter batch ID, ingredients, quantities, and mixing times. The record feeds into the Canning Production Record and Quality Report."]

**Users:**
[Who fills it out and when? Example: "Kitchen staff, 2–3 times per shift"]

**Trigger/Workflow:**
[When/how is this record opened? Example: "When a new sauce batch is started; record completed when batch is ready for use."]

**Core Data Fields:**
[List the fields you want captured, grouped logically. Example:
- **Batch Info:** Batch ID, Date Started, Chef Name
- **Ingredients:** Sugar (kg), Water (L), Spices List
- **Process:** Mixing Duration (minutes), Final Temperature (°C)
- **Quality:** pH Reading, Smell OK (yes/no), Comments
]

**Key Constraints & Validation:**
[Any rules that should be enforced. Example:
- Batch ID must be unique
- Mixing Duration > 0 minutes, < 120 minutes
- Final Temperature must be 60–100°C
- pH must be 2.5–4.5
- Comments are optional
]

**Data Linkage:**
[Does this record link to others? Example: "Batch ID should match a record in the Inventory system. Batches link forward to Canning Production records via Sauce Batch ID."]

**Storage:**
[Where should this go? Example: "KeyValue table, key format: 'sauce-batch:<batch-id>:<date-created>'"]

**Scope & Timeline:**
[What's v1, what's future? Example: "v1: basic form entry, no barcode scanning. Future: scale integration, batch re-use templates."]

**Reference Records:**
[Any existing records to match pattern from? Example: "Follow the layout and validation style of REC-7.3.X Canning Production Record."]

---

**Deliverables:**
1. Design & Layout Instructions (markdown) — user-facing spec with clear field descriptions, layout notes, validation rules
2. Technical Specification (markdown) — implementation guide with HTML structure, JS logic, CSS patterns, data schema, testing checklist
3. (Optional) Implementation if scope permits

**Format:** Both markdown files should follow the same structure as the Canning Production Record instructions (see project docs).
```

### 2.2 Attachments/Context for Claude
- Link to this template in your brief (so Claude knows the expected structure).
- Attach or reference the **Canning Production Record** design and technical specs as examples of the expected format.
- If there are related existing records (e.g., a receiving form that feeds into this), include links.
- Any relevant wireframes, photos of paper forms, or existing spreadsheet layouts that show current process.

---

## Part 3: Review Claude's Output (Quality Gate)

### 3.1 Design & Layout Instructions Checklist

- [ ] **Fields clearly grouped** into logical sections (trolley, batch, quality, comments, etc.)
- [ ] **Each field has:** Type (text/number/dropdown/datetime), Required (Yes/No), Notes (example, constraints, or conditional rules)
- [ ] **Visual layout described:** How wide are fields? Do they wrap on mobile? Are there sub-sections?
- [ ] **Validation rules stated:** Date bounds, numeric ranges, conditional appearance, interdependencies
- [ ] **Data storage schema shown:** JSON example of how the record is stored
- [ ] **UI/UX patterns** reference existing Processing Department styles (record-theme.css, toolbar, buttons)
- [ ] **Open questions called out:** Anything ambiguous is flagged for you to answer before Claude codes
- [ ] **Spacer items noted:** Any fields that need configuration (dropdown lists, compute functions, etc.)

### 3.2 Technical Specification Checklist

- [ ] **HTML structure:** Form groups, field names, ARIA labels, semantic fieldsets
- [ ] **JavaScript:** Event handlers, validation logic, batch row management (add/delete), conditional field visibility
- [ ] **CSS:** Responsive grid, mobile stacking, button sizing, error styling, toast notifications
- [ ] **Data storage logic:** How record is serialized, key format, what fields are included
- [ ] **Integration points:** Where does this connect to existing code (window.storage, API, shared validation)?
- [ ] **Testing checklist:** Specific test cases (form submission, validation failures, mobile layout, accessibility)

### 3.3 Common Issues & Fixes

| Issue | Fix |
|---|---|
| Field descriptions are vague | Ask Claude to add examples and ranges (e.g., "1–50 pieces allowed"). |
| Layout is desktop-only | Ensure **flex-wrap on tablet** is stated; ask for mobile stacking details. |
| Dropdowns are autocomplete | Change to native `<select>` unless there's a strong reason for autocomplete. |
| No total/counter shown | Ask Claude to add running sums or totals if batches/rows are being added. |
| Conditional fields not clearly triggered | Specify exactly which parent field value triggers which child field. |
| Validation too strict or too loose | Review ranges/constraints; adjust and re-brief Claude. |
| Data schema doesn't match existing KeyValue pattern | Align with `<namespace>:<id>:<timestamp>` format used elsewhere in the app. |

---

## Part 4: Iterate & Refine (If Needed)

### 4.1 Review Comments in Claude
- Use Claude's review feature to highlight fields or sections that need changes.
- Keep feedback concise and actionable (e.g., "change to dropdown" or "add timestamp button").

### 4.2 Request Changes
- If major changes are needed, re-brief Claude with updated requirements.
- If minor tweaks, use review comments (faster turnaround).

### 4.3 Finalize & Approve
- Once design and spec are approved, move to implementation (hand to Claude Code).
- Both markdown files become part of the project documentation.

---

## Part 5: Hand Off to Claude Code (If Implementing)

**Brief Claude Code** with the approved technical specification:

```
I have a technical specification for a new production record: REC-7.X.X [Name].
The spec is here: [link to technical-spec markdown]

Please implement this as public/pages/[record-slug].html

Reference records for style/pattern:
- public/pages/canning-production.html (similar batch-row management)
- public/lib/data-store.js (storage adapter)

Deliverables:
1. Completed HTML file (self-contained, no separate CSS/JS files)
2. Test results (manual testing of form, validation, mobile layout)
3. Screenshots of the rendered form

Timeline: [date needed]
```

---

## Part 6: Post-Launch Checklist

- [ ] **Live on staging:** Test with real data from a small batch of users.
- [ ] **Mobile testing:** Verify on tablet and phone; check touch targets and layout.
- [ ] **Data validation:** Do submitted records appear in the database with the correct schema?
- [ ] **Traceability:** Can records be linked forward/backward to related records?
- [ ] **Performance:** Does form load quickly? Any lag on submit?
- [ ] **User feedback:** Are operators comfortable with the data entry flow? Any confusion?
- [ ] **Documentation:** Is the form linked in the main Record List navigation?

---

## Template Variables (Customize Per Record)

When using this template for a new record, fill in:

| Variable | Example | Your Value |
|---|---|---|
| Record Name | REC-7.4.X Sauce Batch Preparation | |
| Process Context | What gets captured and why | |
| Users | Who fills it, how often | |
| Core Fields | Grouped list of fields | |
| Key Constraints | Validation rules, ranges | |
| Data Linkage | Links to other records | |
| Storage Format | KeyValue namespace or schema | |
| Timeline | When needed | |
| Implementation Date | After design approval | |

---

## Examples of Records to Design Next

Candidates for this template (in priority order):

1. **REC-7.4.X Sauce Batch Preparation** — kitchen staff log batch prep, ingredients, mixing times
2. **REC-7.5.X Quality Sampling** — lab tech records sample measurements, pH, appearance
3. **REC-7.6.X Waste Tracking** — log damaged goods, trim, off-grade product
4. **REC-7.7.X Staff Shift Handover** — shift change summary, equipment status, notes for next shift
5. **REC-7.8.X Maintenance Log** — equipment maintenance records, parts replaced, downtime

Each can follow this same template and output structure.

---

## Quick Checklist for Next Record

Before briefing Claude on a new record:

- [ ] I've identified the process this record captures
- [ ] I've listed 8–12 core fields (grouped logically)
- [ ] I know which fields are required vs. optional
- [ ] I know which fields should be dropdowns vs. free-entry
- [ ] I know if this record links to existing records
- [ ] I know the validation rules (ranges, constraints, conditions)
- [ ] I've decided MVP scope vs. future enhancements
- [ ] I have a timeline
- [ ] I have a reference record to match style from (e.g., Canning Production)

**If all boxes are checked:** You're ready to use this template and brief Claude.

**If boxes are unchecked:** Spend 30 min clarifying those details first — it will save Claude time and reduce iteration cycles.

---

## Supporting Files & Links

- **Canning Production Record Design Instructions:** `claude/canning-production-record-design-instructions.md`
- **Canning Production Record Technical Spec:** `claude/canning-production-record-technical-spec.md`
- **Consolidated Plan (system overview):** `claude/consolidated-plan.md`
- **Layout Redesign Instructions (tablet/mobile patterns):** `claude/layout-redesign-instructions.md`
- **Processing Department Data Store Adapter:** `public/lib/data-store.js`
- **Record Theme CSS (styling):** `public/css/record-theme.css`
