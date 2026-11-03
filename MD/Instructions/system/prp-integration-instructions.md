# PRP Integration Instructions

**Date:** 2026-10-28  
**Raised by:** Michaela — "the PRPs need to come into system"  
**Status:** Instructions only, no code written. For Claude Code.  
**Scope:** Bring all PRO 8.2.x Prerequisite Programme procedures, the PRO 8.8 / 8.8a Verification Plan documents, and the REC 8.8a PRP Verification record form into the online processing system.

---

## Overview

The system already has:
- `public/prps/prp-list.html` — list page (reads from `prp-index-data.js`)
- `public/prps/PRP-Create.html` — shell demonstrating the mount pattern
- `public/lib/prp-doc.js` — document engine (edit-in-browser, revision history)
- `public/lib/prp-index-data.js` — currently has only the Create stub

What needs to be done:
1. Create one HTML page per PRP in `public/prps/`
2. Replace `public/lib/prp-index-data.js` with the full list
3. Create `REC-8.8a-prp-verification.html` as a proper record form (separate section below)
4. Bump version strings on any files that reference `prp-index-data.js`

---

## Part 1 — HTML pages for each PRP

### Template pattern

Copy `PRP-Create.html` for each new page. The only thing that changes is the `PrpDoc.mount({…})` call at the bottom. All other script/style references stay identical.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<link rel="preconnect" href="https://processing-department-api.onrender.com" crossorigin>
<link rel="dns-prefetch" href="https://processing-department-api.onrender.com">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="../lib/palette-map.js?v=2"></script>
<link rel="stylesheet" href="../styles/record-theme.css">
<link rel="stylesheet" href="../styles/responsive.css">
<title>PRO 8.2.1 Facility &amp; Premises Control</title>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#A9763A">
</head>
<body>
<script src="/lib/page-nav.js?v=1"></script>
<div id="prp-root"></div>
<script src="../lib/doc-header.js?v=5"></script>
<script src="../lib/master-index-data.js?v=4"></script>
<script src="../lib/data-store.js?v=5"></script>
<script src="../lib/api-backend.js?v=18"></script>
<script src="../lib/auth.js?v=5"></script>
<script src="../lib/login-ui.js?v=6"></script>
<script src="../lib/nc-login-alert.js?v=1"></script>
<script src="../lib/permission-rules.js?v=8"></script>
<script src="../lib/document-revision.js?v=3"></script>
<script src="../lib/prp-doc.js?v=1"></script>
<script>PrpDoc.mount({
  recordKey: 'pro-8.2.1-facility-premises-control',
  prpNo: 'PRO 8.2.1',
  name: 'Facility & Premises Control',
  area: 'Facilities',
  startRev: 9,
  baselineDate: '',
  sections: {
    objective: '',
    roles: '',
    process: '',
    review: ''
  },
  relatedDocs: []
});
</script>
</body>
</html>
```

**Sections start empty** — `prp-doc.js` supports in-browser editing by users with the `managePRPs` permission. Content from the Word documents can be pasted in via the Edit button on each page after deployment. Do not try to extract Word file content programmatically; the source files are `.docx` and may not parse cleanly.

### Files to create

Create each file in `public/prps/`. Use the metadata table below exactly — `recordKey`, `prpNo`, `name`, `area`, `startRev` come from the filenames in `T:\Abagold Processing Facility\20. Paperless\Online system\3. PRP___ISO TS 22002-1\Procedures`.

| Filename | recordKey | prpNo | name | area | startRev |
|----------|-----------|-------|------|------|----------|
| `PRO-8.2-prerequisite-programs.html` | `pro-8.2-prerequisite-programs` | `PRO 8.2` | `Prerequisite Programs` | `Management` | `13` |
| `PRO-8.2.1-facility-premises-control.html` | `pro-8.2.1-facility-premises-control` | `PRO 8.2.1` | `Facility & Premises Control` | `Facilities` | `9` |
| `PRO-8.2.2-utility-supply.html` | `pro-8.2.2-utility-supply` | `PRO 8.2.2` | `Utility Supply` | `Utilities` | `9` |
| `PRO-8.2.3-waste-management.html` | `pro-8.2.3-waste-management` | `PRO 8.2.3` | `Waste Management` | `Hygiene` | `10` |
| `PRO-8.2.4-maintenance.html` | `pro-8.2.4-maintenance` | `PRO 8.2.4` | `Maintenance` | `Maintenance` | `7` |
| `PRO-8.2.5-cleaning-disinfection.html` | `pro-8.2.5-cleaning-disinfection` | `PRO 8.2.5` | `Cleaning & Disinfection` | `Hygiene` | `6` |
| `PRO-8.2.5.1-master-cleaning-schedule.html` | `pro-8.2.5.1-master-cleaning-schedule` | `PRO 8.2.5.1` | `Master Cleaning Schedule` | `Hygiene` | `8` |
| `PRO-8.2.6-pest-control.html` | `pro-8.2.6-pest-control` | `PRO 8.2.6` | `Pest Control` | `Pest Control` | `7` |
| `PRO-8.2.7-supplier-management.html` | `pro-8.2.7-supplier-management` | `PRO 8.2.7` | `Management of Suppliers & Services` | `Procurement` | `8` |
| `PRO-8.2.8-personnel-hygiene.html` | `pro-8.2.8-personnel-hygiene` | `PRO 8.2.8` | `Personnel Hygiene Code of Conduct` | `Personnel` | `8` |
| `PRO-8.2.9-prevention-of-contamination.html` | `pro-8.2.9-prevention-of-contamination` | `PRO 8.2.9` | `Prevention of Contamination` | `Hygiene` | `7` |
| `PRO-8.2.10-glass-breakage.html` | `pro-8.2.10-glass-breakage` | `PRO 8.2.10` | `Glass Breakage Procedure` | `Food Safety` | `7` |
| `PRO-8.2.11-rework.html` | `pro-8.2.11-rework` | `PRO 8.2.11` | `Rework` | `Production` | `6` |
| `PRO-8.2.12-warehousing-distribution.html` | `pro-8.2.12-warehousing-distribution` | `PRO 8.2.12` | `Warehousing & Distribution` | `Logistics` | `5` |
| `PRO-8.2.13-product-information.html` | `pro-8.2.13-product-information` | `PRO 8.2.13` | `Product Information & Customer Awareness` | `Quality` | `4` |
| `PRO-8.2.14-food-defence.html` | `pro-8.2.14-food-defence` | `PRO 8.2.14` | `Food Defence, Biovigilance & Bioterrorism` | `Food Safety` | `1` |
| `PRO-8.2.15-allergen-management.html` | `pro-8.2.15-allergen-management` | `PRO 8.2.15` | `Allergen Management` | `Food Safety` | `8` |
| `PRO-8.2.16-micro-sampling-plan.html` | `pro-8.2.16-micro-sampling-plan` | `PRO 8.2.16` | `Microbiology Sampling Plan` | `Microbiology` | `6` |
| `PRO-8.2.17-microbiology-testing.html` | `pro-8.2.17-microbiology-testing` | `PRO 8.2.17` | `Microbiology Testing Procedure` | `Microbiology` | `2` |
| `PRO-8.2.18-incoming-goods-sampling.html` | `pro-8.2.18-incoming-goods-sampling` | `PRO 8.2.18` | `Incoming Goods Sampling Plan` | `Procurement` | `5` |
| `PRO-8.8-verification-plan.html` | `pro-8.8-verification-plan` | `PRO 8.8` | `Verification Plan` | `Verification` | `14` |
| `PRO-8.8a-prp-verification-frequencies.html` | `pro-8.8a-prp-verification-frequencies` | `PRO 8.8a` | `PRP Verification Frequencies` | `Verification` | `5` |

**Note on PRO 8.2.14:** The source file has no revision suffix in the filename. `startRev: 1` is a safe default — it will be updated via the Edit modal once the page is live.

---

## Part 2 — Replace `public/lib/prp-index-data.js`

Replace the entire file with the full list. Each row needs: `prpNo`, `name`, `area`, `revision` (matches `startRev`), `recordKey`, `href` (path to the HTML page created above).

```js
window.PrpIndexData = {
  rows: [
    { prpNo: 'PRO 8.2',    name: 'Prerequisite Programs',                       area: 'Management',   revision: 13, recordKey: 'pro-8.2-prerequisite-programs',           href: 'PRO-8.2-prerequisite-programs.html' },
    { prpNo: 'PRO 8.2.1',  name: 'Facility & Premises Control',                 area: 'Facilities',   revision: 9,  recordKey: 'pro-8.2.1-facility-premises-control',      href: 'PRO-8.2.1-facility-premises-control.html' },
    { prpNo: 'PRO 8.2.2',  name: 'Utility Supply',                              area: 'Utilities',    revision: 9,  recordKey: 'pro-8.2.2-utility-supply',                 href: 'PRO-8.2.2-utility-supply.html' },
    { prpNo: 'PRO 8.2.3',  name: 'Waste Management',                            area: 'Hygiene',      revision: 10, recordKey: 'pro-8.2.3-waste-management',               href: 'PRO-8.2.3-waste-management.html' },
    { prpNo: 'PRO 8.2.4',  name: 'Maintenance',                                 area: 'Maintenance',  revision: 7,  recordKey: 'pro-8.2.4-maintenance',                    href: 'PRO-8.2.4-maintenance.html' },
    { prpNo: 'PRO 8.2.5',  name: 'Cleaning & Disinfection',                     area: 'Hygiene',      revision: 6,  recordKey: 'pro-8.2.5-cleaning-disinfection',           href: 'PRO-8.2.5-cleaning-disinfection.html' },
    { prpNo: 'PRO 8.2.5.1',name: 'Master Cleaning Schedule',                    area: 'Hygiene',      revision: 8,  recordKey: 'pro-8.2.5.1-master-cleaning-schedule',      href: 'PRO-8.2.5.1-master-cleaning-schedule.html' },
    { prpNo: 'PRO 8.2.6',  name: 'Pest Control',                                area: 'Pest Control', revision: 7,  recordKey: 'pro-8.2.6-pest-control',                   href: 'PRO-8.2.6-pest-control.html' },
    { prpNo: 'PRO 8.2.7',  name: 'Management of Suppliers & Services',          area: 'Procurement',  revision: 8,  recordKey: 'pro-8.2.7-supplier-management',             href: 'PRO-8.2.7-supplier-management.html' },
    { prpNo: 'PRO 8.2.8',  name: 'Personnel Hygiene Code of Conduct',           area: 'Personnel',    revision: 8,  recordKey: 'pro-8.2.8-personnel-hygiene',               href: 'PRO-8.2.8-personnel-hygiene.html' },
    { prpNo: 'PRO 8.2.9',  name: 'Prevention of Contamination',                 area: 'Hygiene',      revision: 7,  recordKey: 'pro-8.2.9-prevention-of-contamination',     href: 'PRO-8.2.9-prevention-of-contamination.html' },
    { prpNo: 'PRO 8.2.10', name: 'Glass Breakage Procedure',                    area: 'Food Safety',  revision: 7,  recordKey: 'pro-8.2.10-glass-breakage',                 href: 'PRO-8.2.10-glass-breakage.html' },
    { prpNo: 'PRO 8.2.11', name: 'Rework',                                      area: 'Production',   revision: 6,  recordKey: 'pro-8.2.11-rework',                         href: 'PRO-8.2.11-rework.html' },
    { prpNo: 'PRO 8.2.12', name: 'Warehousing & Distribution',                  area: 'Logistics',    revision: 5,  recordKey: 'pro-8.2.12-warehousing-distribution',       href: 'PRO-8.2.12-warehousing-distribution.html' },
    { prpNo: 'PRO 8.2.13', name: 'Product Information & Customer Awareness',    area: 'Quality',      revision: 4,  recordKey: 'pro-8.2.13-product-information',             href: 'PRO-8.2.13-product-information.html' },
    { prpNo: 'PRO 8.2.14', name: 'Food Defence, Biovigilance & Bioterrorism',   area: 'Food Safety',  revision: 1,  recordKey: 'pro-8.2.14-food-defence',                   href: 'PRO-8.2.14-food-defence.html' },
    { prpNo: 'PRO 8.2.15', name: 'Allergen Management',                         area: 'Food Safety',  revision: 8,  recordKey: 'pro-8.2.15-allergen-management',             href: 'PRO-8.2.15-allergen-management.html' },
    { prpNo: 'PRO 8.2.16', name: 'Microbiology Sampling Plan',                  area: 'Microbiology', revision: 6,  recordKey: 'pro-8.2.16-micro-sampling-plan',             href: 'PRO-8.2.16-micro-sampling-plan.html' },
    { prpNo: 'PRO 8.2.17', name: 'Microbiology Testing Procedure',              area: 'Microbiology', revision: 2,  recordKey: 'pro-8.2.17-microbiology-testing',            href: 'PRO-8.2.17-microbiology-testing.html' },
    { prpNo: 'PRO 8.2.18', name: 'Incoming Goods Sampling Plan',                area: 'Procurement',  revision: 5,  recordKey: 'pro-8.2.18-incoming-goods-sampling',         href: 'PRO-8.2.18-incoming-goods-sampling.html' },
    { prpNo: 'PRO 8.8',    name: 'Verification Plan',                           area: 'Verification', revision: 14, recordKey: 'pro-8.8-verification-plan',                  href: 'PRO-8.8-verification-plan.html' },
    { prpNo: 'PRO 8.8a',   name: 'PRP Verification Frequencies',                area: 'Verification', revision: 5,  recordKey: 'pro-8.8a-prp-verification-frequencies',      href: 'PRO-8.8a-prp-verification-frequencies.html' },
  ]
};
```

After replacing the file, bump the `?v=` query string on all `<script src="../lib/prp-index-data.js">` references. Check:
```bash
grep -rl "prp-index-data.js" public/
```
The current version is `?v=1`; bump to `?v=2`.

---

## Part 3 — REC 8.8a PRP Verification (record form, not a doc page)

`REC 8.8 a PRP Verification.docx` is a **fill-in record form**, not a procedure document. It belongs in `public/records/` as a proper record shell, not in `public/prps/`.

### What the record tracks

This record is used to log and verify that each PRP is operating effectively. It is a periodic verification log — completed by a QC/QA person at set frequencies (per PRO 8.8a).

### Minimum fields for the record

The form needs the following fields at minimum (add to the record definition in Neon DB and export via `export-record-defs.mjs`):

| Field key | Label | Type | Notes |
|-----------|-------|------|-------|
| `verificationDate` | Verification Date | date | Required |
| `verifiedBy` | Verified By | text | Staff name |
| `prpReference` | PRP Reference | select | PRO 8.2.1 … PRO 8.8a (dropdown of all PRPs) |
| `verificationMethod` | Method of Verification | select | Observation / Document Review / Measurement / Interview |
| `finding` | Finding | select | Conforming / Minor NC / Major NC |
| `evidence` | Evidence / Observations | textarea | Free text |
| `correctiveAction` | Corrective Action Required | textarea | Leave blank if conforming |
| `followUpDate` | Follow-up Date | date | Required only if NC |
| `followUpBy` | Follow-up By | text | |
| `closeOutDate` | Close-out Date | date | |
| `closeOutBy` | Closed Out By | text | |

### HTML shell

Create `public/records/REC-8.8a-prp-verification.html` following the same pattern as other record shells in `public/records/`. Set `docCode: "REC 8.8a"` and `title: "PRP Verification"`.

### Index data

Add to `public/lib/master-index-data.js` under the appropriate section (Quality / Verification):
```js
{ code: 'REC 8.8a', name: 'PRP Verification', href: '/records/REC-8.8a-prp-verification.html', area: 'Verification' }
```

---

## Part 4 — Navigation / index.html

Check `public/index.html` — if there is already a "PRPs" tile or link in the main navigation, confirm it points to `/prps/prp-list.html`. If it is missing, add a tile in the same style as the existing Procedures tile:

```html
<a class="nav-tile" href="/prps/prp-list.html">
  <span class="tile-icon">📋</span>
  <span class="tile-label">PRPs</span>
  <span class="tile-sub">Pre-Requisite Programmes</span>
</a>
```

Use whatever icon/emoji convention the other tiles use. Match the existing tile markup exactly.

---

## Part 5 — Content population (post-deploy)

Once the pages are live, content can be entered without touching code:

1. Log in as an admin (user with `managePRPs` permission)
2. Navigate to `/prps/prp-list.html` → click a PRP
3. Click **Edit** in the header
4. Paste or type content from the Word document into each section field
5. Click **Save** — revision history is maintained automatically

The four sections on each PRP page map to:
- **Objective** — Purpose/scope from the Word doc
- **Roles & Responsibilities** — Responsibilities section
- **Process / Instructions** — Procedure / Instructions section
- **Review & Related Documents** — Review frequency + related documents table

---

## Summary of files to create / change

| Action | Path |
|--------|------|
| **Create** (×22) | `public/prps/PRO-8.2*.html`, `PRO-8.8*.html` (see table in Part 1) |
| **Replace** | `public/lib/prp-index-data.js` |
| **Bump `?v=`** | Any file referencing `prp-index-data.js` |
| **Create** | `public/records/REC-8.8a-prp-verification.html` |
| **Add row** | `public/lib/master-index-data.js` (REC 8.8a entry) |
| **DB + export** | Add `REC 8.8a` record definition to Neon, run `export-record-defs.mjs`, commit JSON |
| **Check/update** | `public/index.html` — PRPs nav tile |

Push to `main` — Render auto-deploys within ~60 seconds.

---

## Paste-ready prompt for Claude Code

> Read `MD/prp-integration-instructions.md` and follow it. Create all 22 PRP HTML shells in `public/prps/` as described in Part 1, using the exact metadata in the table (filename, recordKey, prpNo, name, area, startRev). Replace `public/lib/prp-index-data.js` with the full rows from Part 2, bump its `?v=` in all referencing files. Create the REC 8.8a record shell in `public/records/` and add it to `master-index-data.js` per Part 3. Check `public/index.html` for the PRPs nav tile per Part 4. Do not extract content from Word documents — leave all `sections` fields as empty strings. Commit all changes to `main` with a short commit message listing what was created.
