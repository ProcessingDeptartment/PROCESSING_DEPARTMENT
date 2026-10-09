# Certifications & Legislation Index

**Facility:** Abagold Processing Facility  
**Maintained by:** michaela@abagold.co.za  
**Last reviewed:** 2026-10-09  
**Machine-readable version:** `certifications.json` (same folder — read this for agent tasks)

---

## How to use this index

- **For agents:** Read `certifications.json` — it contains structured fields (`affectedRecords`, `nextAction`, `status`, `sourceFiles`) for automated compliance checks and scheduling tasks.  
- **For humans:** Use this file. Each standard links to its source PDF in `1. Food Safety Management System/FSSC 22000/14. Legislation and Guidelines/`.  
- **Status meanings:** `active` = current obligation · `monitoring` = track for changes/promulgation · `expired` = superseded.

---

## 1. Food Safety Management System

| ID | Standard | Version | Status | Notes |
|----|----------|---------|--------|-------|
| FSSC-22000 | **FSSC 22000** Food Safety System Certification | V7 | active | All records. Annual surveillance + 3-year re-cert. |
| ISO-22000 | **ISO 22000:2018** FSMS Requirements | Ed 2 | active | Underpins FSSC 22000. All records. |
| ISO-TS-22002-1 | **ISO/TS 22002-1:2009** PRPs for Food Manufacturing | 2009 | active | Cleaning, hygiene, pest, allergen PRPs. |
| SANS-10049 | **SANS 10049** PRPs for Food Safety (SA) | Current | active | SA companion to ISO/TS 22002-1. |
| HACCP-SANS10330 | **SANS 10330** HACCP System Requirements | Current | active | Annual review; CCPs = temps, micro. |
| MICRO-GUIDELINES | **Microbiological Guidelines for Food** | Current | active | Sets micro limits; monthly FSMS calendar testing. |

---

## 2. Product Standards (SANS / NRCS)

| ID | Standard | Scope | Status | Affected Records |
|----|----------|-------|--------|-----------------|
| SANS-2329 | **SANS 2329:2019** Dried Abalone | Dried abalone grades, moisture, labelling | active | REC 7.4.1, 7.4.3–7.4.6, 7.4.10 |
| SANS-587 | **SANS 587:2017** Canned Aquatic Products | Canned abalone (braised, minced, natural) | active | REC 7.1, REC 01 |
| SANS-729 | **SANS 729:2018** Live Aquaculture Products | Live abalone — hold, pack, transport | active | REC 7.5.3 |
| SANS-585 | **SANS 585** Frozen Aquatic Products | Frozen abalone | active | Confirm if frozen line active |

---

## 3. Compulsory Specifications (NRCS — Letter of Authority required)

| ID | Spec | Scope | Status | Notes |
|----|------|-------|--------|-------|
| VC-9108 | **VC 9108:2025** Canned Abalone | Canned product — LoA mandatory | active | Updated 2025. REC 7.1, REC 01. |
| VC-8014 | **VC 8014** Canned Fish & Marine Molluscs | Canned marine products | active | May apply alongside VC 9108. |
| VC-9001 | **VC 9001** (verify scope) | TBC from document | active | Review document to confirm exact product scope. |

> ⚠️ **No product may be sold without a valid NRCS Letter of Authority** for each applicable compulsory spec.

---

## 4. South African Legislation

| ID | Act / Regulation | Scope | Status | Notes |
|----|-----------------|-------|--------|-------|
| FOODSTUFFS-ACT | **Foodstuffs, Cosmetics & Disinfectants Act 54 of 1972** | All food manufacture & sale | active | Reviewed 02.2026. Umbrella food law. |
| AGRI-PRODUCTS-ACT | **Agricultural Product Standards Act 119 of 1990** | Grading, packing, marking | active | Reviewed 02.2026. Links to NRCS VC specs. |
| NATIONAL-HEALTH-ACT | **National Health Act 61 of 2003** | Occupational health, env health, medicals | active | Governs employee medicals (REC 8.2.8.1). |
| R638 | **R638** General Hygiene Requirements for Food Premises | Premises & staff hygiene | active | Core compliance for factory floor. |
| R638-LABELLING | **R146 (current) + Draft R3337 (2023)** | All pre-packed food labelling | monitoring | R3337 not yet promulgated. Watch gazette. |
| SANS-241 | **SANS 241** Drinking Water Quality | Processing water | active | Monthly micro + annual chem (SANS 241). |

---

## 5. Fisheries & Aquaculture

| ID | Standard | Scope | Status | Notes |
|----|----------|-------|--------|-------|
| DFFE-PERMIT | **DFFE Aquaculture Permit + PST Control** | Harvest permit; PST season monitoring | active | PST testing required per DFFE schedule. |
| AMFFSP | **Aquaculture Management Food Safety Programme** | Export food safety programme | active | Signed Nov 2025. DFFE administered. Required for EU + other markets. |

---

## 6. Export Market Requirements

| ID | Market | Requirement | Status | Notes |
|----|--------|------------|--------|-------|
| GACC-CHINA | China | GACC Registration + GB 2762 contaminant limits | active | Abagold Ltd registered. DFFE is competent authority. |
| HONG-KONG-CAP132 | Hong Kong | Food Safety Ordinance CAP 132 | monitoring | Check contaminant & labelling clauses for abalone. |
| CANADA-LABELLING | Canada | CFIA Labelling Regulations | monitoring | Bilingual labelling required. |

---

## 7. Codex / International Reference Standards

| ID | Standard | Scope | Status |
|----|----------|-------|--------|
| CODEX-CXS-312 | **CXS 312** Dried Abalone (Codex) | International dried abalone standard | active |
| CODEX-CXS-192 | **CXS 192** General Standard for Food Additives | Permissible additives & max levels | monitoring |

---

## 8. Auditing

| ID | Standard | Use | Status |
|----|----------|-----|--------|
| ISO-19011 | **ISO 19011:2018** Guidelines for Auditing Management Systems | Internal audit programme design | active |

---

## Compliance calendar summary

Tracked in **FSMS Calendar** (`MD/fsms-calendar-instructions.md`). Key recurring obligations:

| Frequency | Obligation |
|-----------|-----------|
| Monthly | Water micro testing (SANS 241), swabs, abalone micro, airplates |
| Per season | PST testing (DFFE control periods) |
| Annual | Internal audit, HACCP review, FSSC 22000 surveillance, calibrations, mock recalls |
| Per batch | NRCS VC spec compliance, AMFFSP food safety programme, GACC compliance |
| Per 3 years | FSSC 22000 re-certification |
| Ongoing | R3337 labelling regulations — monitor gazette for promulgation |

---

## Agent deployment notes

An agent reading this repo should:
1. Parse `certifications.json` for structured data.
2. Cross-reference `affectedRecords` field with active REC records in the DB.
3. Check `nextAction` field — null means no date set yet; populate from FSMS Calendar events.
4. Flag any `status: "monitoring"` items where an update may require system changes (esp. R3337 labelling).
5. Source files are relative to `T:\Abagold Processing Facility\1. Food Safety Management System\FSSC 22000\14. Legislation and Guidelines\`.
