# SOP Online Update Instructions
**Date:** 2026-10-07  
**Prepared by:** Michaela (via Claude)  
**Purpose:** Update the online processing system at `https://processing-department.onrender.com` to reflect all new and updated SOPs from the `2. SOP's` folder.

---

## Summary of what needs to change

The SOP folder has been updated with new documents and revision changes. This instruction tells Claude Code exactly what to add, update, and fix in the repo at `https://github.com/ProcessingDeptartment/PROCESSING_DEPARTMENT`.

There are **three types of work**:
1. **New SOP HTML pages** — create new files in `public/sops/`
2. **Updated `sop-index-data.js`** — add new rows and update revision numbers
3. **SOP numbering conflict resolution** — the Dry section has been renumbered; old files need renaming/redirecting

---

## Part 1: SOP numbering conflicts — Dry section renumbered

The dry processing SOPs have been renumbered. The **old** numbers are now used for different procedures. Claude Code must rename the existing HTML files and update all references.

### Old → New mapping (rename these HTML files)

| Old file | Old SOP | Old title | Action |
|---|---|---|---|
| `public/sops/SOP-53-dry-product-stock-control.html` | SOP 53 | Dry Product Stock Control | **Rename** — see new SOP 53 below |
| `public/sops/SOP-55-dry-boxing.html` | SOP 55 | Dry Boxing | **Rename** — see new SOP 55 below |
| `public/sops/SOP-56-dry-export.html` | SOP 56 | Dry Export | **Rename** — see new SOP 56 below |
| `public/sops/SOP-57-dry-steamer-cleaning.html` | SOP 57 | Dry Steamer Cleaning | **Rename** — see new SOP 57 below |

### How to handle the renames

The dry SOPs have been restructured. The old content stays valid — it just lives at a new SOP number now. For each old file:

1. **Copy** the old file to its new name (see table below)
2. Update the `sopNo`, `name`, and `recordKey` inside the `SopDoc.mount({...})` call to match the new number
3. **Delete** the old file (the old URL will 404 — that's fine, these weren't linked externally)
4. Update `sop-index-data.js` accordingly (see Part 3)

#### Rename table for existing dry SOPs

| Old file | New filename | New `sopNo` | New `name` | New `recordKey` |
|---|---|---|---|---|
| `SOP-53-dry-product-stock-control.html` | `SOP-58-dry-product-fg02-stock-take.html` | `SOP 58` | `Dry Product FG02 Stock Take` | `sop-58-dry-product-fg02-stock-take` |
| `SOP-55-dry-boxing.html` | `SOP-56-dry-boxing.html` | `SOP 56` | `Dry Boxing` | `sop-56-dry-boxing` |
| `SOP-56-dry-export.html` | `SOP-57-dry-export.html` | `SOP 57` | `Dry Export` | `sop-57-dry-export` |
| `SOP-57-dry-steamer-cleaning.html` | Keep as-is — see note below | — | — | — |

> **Note on SOP 57 Dry Steamer Cleaning:** The new folder has a file `SOP 57 Dry Steamer Cleaning_rev 1.docx`. This matches the existing online SOP 57. No rename needed — just verify the revision is correct (Rev 1 ✓).

> **Note on SOP 53:** The old `SOP 53 Dry Product Stock Control` content has been superseded. The new SOP 53 is `Stringing and Hanging` (a new procedure). The old content moves to SOP 58 `Dry Product FG02 Stock Take` which is the updated version of stock control.

---

## Part 2: New SOP HTML pages to create

For each SOP below, create a new file in `public/sops/` using the standard `SopDoc.mount({...})` template (same structure as all existing SOP pages).

**Template reminder:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
<link rel="preconnect" href="https://processing-department-api.onrender.com" crossorigin>
<link rel="dns-prefetch" href="https://processing-department-api.onrender.com">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="../lib/palette-map.js"></script>
<link rel="stylesheet" href="../styles/record-theme.css">
<link rel="stylesheet" href="../styles/responsive.css">
<title>SOP [NUMBER] [TITLE]</title>
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#A9763A">
</head>
<body>
<div id="sop-root"></div>
<script src="../lib/doc-header.js?v=5"></script>
<script src="../lib/master-index-data.js?v=4"></script>
<script src="../lib/data-store.js?v=5"></script>
<script src="../lib/api-backend.js?v=18"></script>
<script src="../lib/auth.js?v=2"></script>
<script src="../lib/login-ui.js?v=3"></script>
<script src="../lib/permission-rules.js?v=6"></script>
<script src="../lib/document-revision.js?v=3"></script>
<script src="../lib/sop-doc.js?v=2"></script>
<script>SopDoc.mount({
  recordKey: '[recordKey]',
  sopNo: '[SOP XX]',
  name: '[Title]',
  area: '[Area]',
  startRev: [N],
  baselineDate: '[DD/MM/YYYY]',
  sections: {
    objective: '[Objective text]',
    roles: '<ul><li>Abagold Processing Management is responsible for the implementation and review of this procedure and linked work instructions and training of staff.</li><li>Abagold Processing Staff are responsible for working in accordance with documented procedures and work instructions and the reporting on unsafe equipment and conditions.</li></ul>',
    process: '<ol>[steps]</ol>',
    review: 'This procedure is reviewed to ensure compliance with safety standards, customer as well as legislative requirements.'
  },
  relatedDocs: [],
  baselineHistory: [{"rev": [N], "reason": "[reason]", "date": "[DD/MM/YYYY]"}]
});
</script>
</body>
</html>
```

### New SOPs to create — read the source .docx files for content

For each SOP below, **read the corresponding `.docx` file** from the source folder to extract the objective, process steps, related documents, and revision history. Then create the HTML file.

---

#### SOP 20 Dry Washing
- **Source file:** `SOP 20 Dry Washing.docx`
- **New filename:** `public/sops/SOP-20-dry-washing.html`
- **`recordKey`:** `sop-20-dry-washing`
- **`sopNo`:** `SOP 20` _(Note: there are TWO SOP 20s — "Code Application" and "Dry Washing". These are separate procedures in different areas. Both must exist online.)_
- **`area`:** `Dry`
- **Note:** The existing `SOP-20-code-application.html` stays at its current URL. This is a separate additional SOP that happens to share the same number — keep both, add this as a new entry in the index.

---

#### SOP 46 Can Filling – Sauce
- **Source file:** `SOP 46 Can filling - sauce.docx`
- **New filename:** `public/sops/SOP-46-can-filling-sauce.html`
- **`recordKey`:** `sop-46-can-filling-sauce`
- **`sopNo`:** `SOP 46`
- **`area`:** `Precook & Grading`

---

#### SOP 51.1 Dry Salting – Cultivated
- **Source file:** `SOP 51.1 Dry salting cultivated.docx`
- **New filename:** `public/sops/SOP-51.1-dry-salting-cultivated.html`
- **`recordKey`:** `sop-51-1-dry-salting-cultivated`
- **`sopNo`:** `SOP 51.1`
- **`area`:** `Dry`

---

#### SOP 51.2 Dry Salting – Ranched or Wild
- **Source file:** `SOP 51.2 Dry salting - Ranched or Wild.docx`
- **New filename:** `public/sops/SOP-51.2-dry-salting-ranched-or-wild.html`
- **`recordKey`:** `sop-51-2-dry-salting-ranched-or-wild`
- **`sopNo`:** `SOP 51.2`
- **`area`:** `Dry`

---

#### SOP 52.2 Dry Cooking – Ranched or Wild
- **Source file:** `SOP 52.2 Dry Cooking Ranched or Wild.docx` _(use the newer date: 1791363395076)_
- **New filename:** `public/sops/SOP-52.2-dry-cooking-ranched-or-wild.html`
- **`recordKey`:** `sop-52-2-dry-cooking-ranched-or-wild`
- **`sopNo`:** `SOP 52.2`
- **`area`:** `Dry`

---

#### SOP 53 Stringing and Hanging
- **Source file:** `SOP 53 Stringing and hanging.docx`
- **New filename:** `public/sops/SOP-53-stringing-and-hanging.html`
- **`recordKey`:** `sop-53-stringing-and-hanging`
- **`sopNo`:** `SOP 53`
- **`area`:** `Dry`
- **Note:** The old `SOP-53-dry-product-stock-control.html` is being moved to SOP 58 (see Part 1). This new file takes the SOP 53 slot.

---

#### SOP 54 Steaming and Drying
- **Source file:** `SOP 54 Steaming and drying.docx`
- **New filename:** `public/sops/SOP-54-steaming-and-drying.html`
- **`recordKey`:** `sop-54-steaming-and-drying`
- **`sopNo`:** `SOP 54`
- **`area`:** `Dry`

---

#### SOP 55 De-String and Grading
- **Source file:** `SOP 55 De-String and grading.docx`
- **New filename:** `public/sops/SOP-55-de-string-and-grading.html`
- **`recordKey`:** `sop-55-de-string-and-grading`
- **`sopNo`:** `SOP 55`
- **`area`:** `Dry`
- **Note:** The old `SOP-55-dry-boxing.html` is being moved to `SOP-56-dry-boxing.html` (see Part 1). This new file takes the SOP 55 slot.

---

#### SOP 56 Dry Boxing
- **Source file:** `SOP 56 Dry Boxing.docx` _(newer file, mtimeMs 1791363489404)_
- **New filename:** `public/sops/SOP-56-dry-boxing.html`
- **`recordKey`:** `sop-56-dry-boxing`
- **`sopNo`:** `SOP 56`
- **`area`:** `Dry`
- **Note:** This replaces the renamed old SOP 55 Dry Boxing file at this new number. Read the `.docx` for updated content.

---

#### SOP 57 Dry Export
- **Source file:** `SOP 57 Dry Export .docx` _(newer file, mtimeMs 1777395539000)_
- **New filename:** `public/sops/SOP-57-dry-export.html`
- **`recordKey`:** `sop-57-dry-export`
- **`sopNo`:** `SOP 57`
- **`area`:** `Dry`
- **Note:** This replaces the renamed old SOP 56 Dry Export file at this new number.

---

#### SOP 58 Dry Product FG02 Stock Take
- **Source file:** `SOP 58 Dry product FG02 Stock take_rev 1.docx`
- **New filename:** `public/sops/SOP-58-dry-product-fg02-stock-take.html`
- **`recordKey`:** `sop-58-dry-product-fg02-stock-take`
- **`sopNo`:** `SOP 58`
- **`area`:** `Dry`
- **Note:** This is the updated stock control procedure, formerly at SOP 53. The old SOP 53 content is the starting point — update it with any changes from this `.docx`.

---

## Part 3: Update `public/lib/sop-index-data.js`

Replace the entire contents of `public/lib/sop-index-data.js` with the updated version below. Key changes from current version:

- **Removed:** Old SOP 53 Dry Product Stock Control (moved to SOP 58)
- **Removed:** Old SOP 55 Dry Boxing (moved to SOP 56)
- **Removed:** Old SOP 56 Dry Export (moved to SOP 57)
- **Updated:** SOP 20 Code Application — bump revision to 3 (source: `SOP 20 Code Application_Rev 3.docx`)
- **Added:** SOP 20 Dry Washing (new — separate from Code Application)
- **Added:** SOP 46 Can Filling – Sauce
- **Added:** SOP 51.1 Dry Salting – Cultivated
- **Added:** SOP 51.2 Dry Salting – Ranched or Wild
- **Added:** SOP 52.2 Dry Cooking – Ranched or Wild
- **Added:** SOP 53 Stringing and Hanging (new at this number)
- **Added:** SOP 54 Steaming and Drying
- **Added:** SOP 55 De-String and Grading (new at this number)
- **Added:** SOP 56 Dry Boxing (renumbered from old 55)
- **Added:** SOP 57 Dry Export (renumbered from old 56)
- **Added:** SOP 58 Dry Product FG02 Stock Take

```js
window.SopIndexData = {
  rows: [
    {sopNo:'SOP New', name: 'Create New SOP', area: 'New SOP', revision: 0, recordKey: 'sop-new-create-new-sop', href: 'SOP-Create.html'},
    { sopNo: 'SOP 2', name: 'Basket Receiving', area: 'Receiving & Sorting', revision: 3, recordKey: 'sop-02-basket-receiving', href: 'SOP-02-basket-receiving.html' },
    { sopNo: 'SOP 3', name: 'Sorting Procedure', area: 'Receiving & Sorting', revision: 5, recordKey: 'sop-03-sorting-procedure', href: 'SOP-03-sorting-procedure.html' },
    { sopNo: 'SOP 4', name: 'Remove Animals from Basket', area: 'Receiving & Sorting', revision: 3, recordKey: 'sop-04-remove-animals-from-basket', href: 'SOP-04-remove-animals-from-basket.html' },
    { sopNo: 'SOP 5', name: 'Record Weight & Count of Basket', area: 'Receiving & Sorting', revision: 3, recordKey: 'sop-05-record-weight-count-of-basket', href: 'SOP-05-record-weight-count-of-basket.html' },
    { sopNo: 'SOP 5.1', name: 'Record Weight & Count (Lwandle Fishing)', area: 'Receiving & Sorting', revision: 1, recordKey: 'sop-05-1-record-weight-count-lwandle-fishing', href: 'SOP-05.1-record-weight-count-lwandle-fishing.html' },
    { sopNo: 'SOP 6', name: 'Shucking', area: 'Receiving & Sorting', revision: 2, recordKey: 'sop-06-shucking', href: 'SOP-06-shucking.html' },
    { sopNo: 'SOP 7', name: 'Gutting and Cutting of Heads', area: 'Receiving & Sorting', revision: 3, recordKey: 'sop-07-gutting-and-cutting-of-heads', href: 'SOP-07-gutting-and-cutting-of-heads.html' },
    { sopNo: 'SOP 8', name: 'Salting and Tumbling', area: 'Receiving & Sorting', revision: 3, recordKey: 'sop-08-salting-and-tumbling', href: 'SOP-08-salting-and-tumbling.html' },
    { sopNo: 'SOP 9', name: 'Scrubbing', area: 'Receiving & Sorting', revision: 2, recordKey: 'sop-09-scrubbing', href: 'SOP-09-scrubbing.html' },
    { sopNo: 'SOP 10', name: 'Precooking', area: 'Precook & Grading', revision: 3, recordKey: 'sop-10-precooking', href: 'SOP-10-precooking.html' },
    { sopNo: 'SOP 11', name: 'Calibrate Weight Grader', area: 'Precook & Grading', revision: 2, recordKey: 'sop-11-calibrate-weight-grader', href: 'SOP-11-calibrate-weight-grader.html' },
    { sopNo: 'SOP 12', name: 'First Grading', area: 'Precook & Grading', revision: 2, recordKey: 'sop-12-first-grading', href: 'SOP-12-first-grading.html' },
    { sopNo: 'SOP 13', name: 'Second Grading', area: 'Precook & Grading', revision: 2, recordKey: 'sop-13-second-grading', href: 'SOP-13-second-grading.html' },
    { sopNo: 'SOP 14', name: 'Empty Can Loading', area: 'Precook & Grading', revision: 2, recordKey: 'sop-14-empty-can-loading', href: 'SOP-14-empty-can-loading.html' },
    { sopNo: 'SOP 15', name: 'Freshwater Management', area: 'Precook & Grading', revision: 1, recordKey: 'sop-15-freshwater-management', href: 'SOP-15-freshwater-management.html' },
    { sopNo: 'SOP 16', name: 'Can Water Filling', area: 'Precook & Grading', revision: 2, recordKey: 'sop-16-can-water-filling', href: 'SOP-16-can-water-filling.html' },
    { sopNo: 'SOP 17', name: 'Load Clean Lids', area: 'Precook & Grading', revision: 2, recordKey: 'sop-17-load-clean-lids', href: 'SOP-17-load-clean-lids.html' },
    { sopNo: 'SOP 18', name: 'Packing and Weighing', area: 'Precook & Grading', revision: 2, recordKey: 'sop-18-packing-and-weighing', href: 'SOP-18-packing-and-weighing.html' },
    { sopNo: 'SOP 19', name: 'Seaming', area: 'Precook & Grading', revision: 3, recordKey: 'sop-19-seaming', href: 'SOP-19-seaming.html' },
    { sopNo: 'SOP 20', name: 'Code Application', area: 'Canning', revision: 3, recordKey: 'sop-20-code-application', href: 'SOP-20-code-application.html' },
    { sopNo: 'SOP 20', name: 'Dry Washing', area: 'Dry', revision: 1, recordKey: 'sop-20-dry-washing', href: 'SOP-20-dry-washing.html' },
    { sopNo: 'SOP 21', name: 'Basket Loading', area: 'Canning', revision: 2, recordKey: 'sop-21-basket-loading', href: 'SOP-21-basket-loading.html' },
    { sopNo: 'SOP 22', name: 'Retort Operation (Powering Up and Switching Off)', area: 'Canning', revision: 2, recordKey: 'sop-22-retort-operation-powering-up-and-switching-off', href: 'SOP-22-retort-operation-powering-up-and-switching-off.html' },
    { sopNo: 'SOP 23', name: 'Retort Preheat Cycle', area: 'Canning', revision: 2, recordKey: 'sop-23-retort-preheat-cycle', href: 'SOP-23-retort-preheat-cycle.html' },
    { sopNo: 'SOP 24', name: 'Basket Unloading', area: 'Canning', revision: 2, recordKey: 'sop-24-basket-unloading', href: 'SOP-24-basket-unloading.html' },
    { sopNo: 'SOP 25', name: 'Assembling of Boxes', area: 'Canning', revision: 2, recordKey: 'sop-25-assembling-of-boxes', href: 'SOP-25-assembling-of-boxes.html' },
    { sopNo: 'SOP 26', name: 'Transfers to FG01', area: 'Canning', revision: 2, recordKey: 'sop-26-transfers-to-fg01', href: 'SOP-26-transfers-to-fg01.html' },
    { sopNo: 'SOP 27', name: 'Mincing - Brine', area: 'Mincing', revision: 1, recordKey: 'sop-27-mincing-brine', href: 'SOP-27-mincing-brine.html' },
    { sopNo: 'SOP 28', name: 'Mincing - Braised', area: 'Mincing', revision: 1, recordKey: 'sop-28-mincing-braised', href: 'SOP-28-mincing-braised.html' },
    { sopNo: 'SOP 33', name: 'Mincing - Braised (duplicate of SOP 28)', area: 'Mincing', revision: 1, recordKey: 'sop-33-mincing-braised-duplicate-of-sop-28', href: 'SOP-33-mincing-braised-duplicate-of-sop-28.html' },
    { sopNo: 'SOP 36', name: 'Waste Removal', area: 'Waste & Facilities', revision: 2, recordKey: 'sop-36-waste-removal', href: 'SOP-36-waste-removal.html' },
    { sopNo: 'SOP 40', name: 'Superior Sauce Broth Cooking', area: 'Sauce', revision: 3, recordKey: 'sop-40-superior-sauce-broth-cooking', href: 'SOP-40-superior-sauce-broth-cooking.html' },
    { sopNo: 'SOP 41', name: 'Superior Sauce Mixing', area: 'Sauce', revision: 3, recordKey: 'sop-41-superior-sauce-mixing', href: 'SOP-41-superior-sauce-mixing.html' },
    { sopNo: 'SOP 42', name: 'Superior Sauce Ingredient Weighing', area: 'Sauce', revision: 3, recordKey: 'sop-42-superior-sauce-ingredient-weighing', href: 'SOP-42-superior-sauce-ingredient-weighing.html' },
    { sopNo: 'SOP 43', name: 'Superior Sauce Broth Cooking SCSF', area: 'Sauce', revision: 2, recordKey: 'sop-43-superior-sauce-broth-cooking-scsf', href: 'SOP-43-superior-sauce-broth-cooking-scsf.html' },
    { sopNo: 'SOP 44', name: 'Scallop Prep and Fillet', area: 'Sauce', revision: 2, recordKey: 'sop-44-scallop-prep-and-fillet', href: 'SOP-44-scallop-prep-and-fillet.html' },
    { sopNo: 'SOP 45', name: 'Preparation of Brine Solution', area: 'Sauce', revision: 1, recordKey: 'sop-45-preparation-of-brine-solution', href: 'SOP-45-preparation-of-brine-solution.html' },
    { sopNo: 'SOP 46', name: 'Can Filling – Sauce', area: 'Precook & Grading', revision: 1, recordKey: 'sop-46-can-filling-sauce', href: 'SOP-46-can-filling-sauce.html' },
    { sopNo: 'SOP 51', name: 'Dry Salting', area: 'Dry', revision: 2, recordKey: 'sop-51-dry-salting', href: 'SOP-51-dry-salting.html' },
    { sopNo: 'SOP 51.1', name: 'Dry Salting – Cultivated', area: 'Dry', revision: 1, recordKey: 'sop-51-1-dry-salting-cultivated', href: 'SOP-51.1-dry-salting-cultivated.html' },
    { sopNo: 'SOP 51.2', name: 'Dry Salting – Ranched or Wild', area: 'Dry', revision: 2, recordKey: 'sop-51-2-dry-salting-ranched-or-wild', href: 'SOP-51.2-dry-salting-ranched-or-wild.html' },
    { sopNo: 'SOP 52', name: 'Dry Cooking', area: 'Dry', revision: 2, recordKey: 'sop-52-dry-cooking', href: 'SOP-52-dry-cooking.html' },
    { sopNo: 'SOP 52.2', name: 'Dry Cooking – Ranched or Wild', area: 'Dry', revision: 1, recordKey: 'sop-52-2-dry-cooking-ranched-or-wild', href: 'SOP-52.2-dry-cooking-ranched-or-wild.html' },
    { sopNo: 'SOP 53', name: 'Stringing and Hanging', area: 'Dry', revision: 1, recordKey: 'sop-53-stringing-and-hanging', href: 'SOP-53-stringing-and-hanging.html' },
    { sopNo: 'SOP 54', name: 'Steaming and Drying', area: 'Dry', revision: 1, recordKey: 'sop-54-steaming-and-drying', href: 'SOP-54-steaming-and-drying.html' },
    { sopNo: 'SOP 55', name: 'De-String and Grading', area: 'Dry', revision: 1, recordKey: 'sop-55-de-string-and-grading', href: 'SOP-55-de-string-and-grading.html' },
    { sopNo: 'SOP 56', name: 'Dry Boxing', area: 'Dry', revision: 1, recordKey: 'sop-56-dry-boxing', href: 'SOP-56-dry-boxing.html' },
    { sopNo: 'SOP 57', name: 'Dry Export', area: 'Dry', revision: 1, recordKey: 'sop-57-dry-export', href: 'SOP-57-dry-export.html' },
    { sopNo: 'SOP 57', name: 'Dry Steamer Cleaning', area: 'Dry', revision: 1, recordKey: 'sop-57-dry-steamer-cleaning', href: 'SOP-57-dry-steamer-cleaning.html' },
    { sopNo: 'SOP 58', name: 'Dry Product FG02 Stock Take', area: 'Dry', revision: 1, recordKey: 'sop-58-dry-product-fg02-stock-take', href: 'SOP-58-dry-product-fg02-stock-take.html' },
    { sopNo: 'SOP 60', name: 'Live Receiving', area: 'Live', revision: 2, recordKey: 'sop-60-live-receiving', href: 'SOP-60-live-receiving.html' },
    { sopNo: 'SOP 61', name: 'Live Packing Preparation', area: 'Live', revision: 2, recordKey: 'sop-61-live-packing-preparation', href: 'SOP-61-live-packing-preparation.html' },
    { sopNo: 'SOP 63', name: 'Receiving and Processing of Live Leftovers', area: 'Live', revision: 2, recordKey: 'sop-63-receiving-and-processing-of-live-leftovers', href: 'SOP-63-receiving-and-processing-of-live-leftovers.html' },
    { sopNo: 'SOP 64', name: 'Live Box Loading', area: 'Live', revision: 2, recordKey: 'sop-64-live-box-loading', href: 'SOP-64-live-box-loading.html' },
    { sopNo: 'SOP 65', name: 'Packing Underweight Boxes', area: 'Live', revision: 1, recordKey: 'sop-65-packing-underweight-boxes', href: 'SOP-65-packing-underweight-boxes.html' },
    { sopNo: 'SOP 70', name: 'Receiving Returned Boxes', area: 'Live', revision: 1, recordKey: 'sop-70-receiving-returned-boxes', href: 'SOP-70-receiving-returned-boxes.html' },
    { sopNo: 'SOP 71', name: 'Incubation of Cans', area: 'Canning', revision: 1, recordKey: 'sop-71-incubation-of-cans', href: 'SOP-71-incubation-of-cans.html' },
    { sopNo: 'SOP 72', name: 'LHA - Stock Take Implementation Phase', area: 'Live', revision: 1, recordKey: 'sop-72-lha-stock-take-implementation-phase', href: 'SOP-72-lha-stock-take-implementation-phase.html' },
    { sopNo: 'SOP 73', name: 'Weekend Duty LHA Tank Cleaning and Checks', area: 'Live', revision: 1, recordKey: 'sop-73-weekend-duty-lha-tank-cleaning-and-checks', href: 'SOP-73-weekend-duty-lha-tank-cleaning-and-checks.html' },
    { sopNo: 'SOP 74', name: 'Live Sorting Procedure (same as SOP 3)', area: 'Live', revision: 5, recordKey: 'sop-74-live-sorting-procedure-same-as-sop-3', href: 'SOP-74-live-sorting-procedure-same-as-sop-3.html' },
    { sopNo: 'SOP 75', name: 'Live Sorting Procedure - Smaller Sizes', area: 'Live', revision: 5, recordKey: 'sop-75-live-sorting-procedure-smaller-sizes', href: 'SOP-75-live-sorting-procedure-smaller-sizes.html' },
    { sopNo: 'SOP 76', name: 'Live Orders Arrangements and Writing of IDNs', area: 'Live', revision: 3, recordKey: 'sop-76-live-orders-arrangements-and-writing-of-idns', href: 'SOP-76-live-orders-arrangements-and-writing-of-idns.html' },
    { sopNo: 'SOP 77', name: 'Line Start Up & Change Over', area: 'Canning', revision: 1, recordKey: 'sop-77-line-start-up-change-over', href: 'SOP-77-line-start-up-change-over.html' }
  ]
};
```

---

## Part 4: How to read the .docx files for content

Claude Code cannot open `.docx` files directly. Use this approach:

```bash
# Install docx2txt if not present
pip install python-docx

# Then run a Python snippet to extract content from each .docx
python3 - <<'EOF'
from docx import Document
doc = Document("SOP 46 Can filling - sauce.docx")
for para in doc.paragraphs:
    print(para.style.name, '|', para.text)
EOF
```

The `.docx` files are stored at:
`T:\Abagold Processing Facility\20. Paperless\Online system\2. SOP's\`

Use the device bash tool to run the extraction on the user's computer, then use the extracted text to populate the `sections.objective`, `sections.process`, `relatedDocs`, and `baselineHistory` fields in each new HTML file.

For the `process` steps: the docx files contain numbered procedure steps — convert them to `<ol><li>...</li></ol>` HTML. Preserve all temperatures, measurements, and specific values exactly as written.

For `relatedDocs`: look for references to other documents (e.g. "REC 7.x.x") in the docx body and add them as `[{"code": "REC X.X.X", "name": ""}]`.

For `baselineHistory`: look for a revision history table or footer in the docx. If no history is found, use `[{"rev": 1, "reason": "New document", "date": "[date from file]"}]`.

---

## Part 5: Checklist — what to commit

After all changes are made, the following files should be changed/added:

**Modified:**
- [ ] `public/lib/sop-index-data.js` — full replacement per Part 3

**Renamed (copy + update content + delete old):**
- [ ] `SOP-53-dry-product-stock-control.html` → `SOP-58-dry-product-fg02-stock-take.html`
- [ ] `SOP-55-dry-boxing.html` → `SOP-56-dry-boxing.html`
- [ ] `SOP-56-dry-export.html` → `SOP-57-dry-export.html`

**New files created:**
- [ ] `public/sops/SOP-20-dry-washing.html`
- [ ] `public/sops/SOP-46-can-filling-sauce.html`
- [ ] `public/sops/SOP-51.1-dry-salting-cultivated.html`
- [ ] `public/sops/SOP-51.2-dry-salting-ranched-or-wild.html`
- [ ] `public/sops/SOP-52.2-dry-cooking-ranched-or-wild.html`
- [ ] `public/sops/SOP-53-stringing-and-hanging.html`
- [ ] `public/sops/SOP-54-steaming-and-drying.html`
- [ ] `public/sops/SOP-55-de-string-and-grading.html`
- [ ] `public/sops/SOP-56-dry-boxing.html`
- [ ] `public/sops/SOP-57-dry-export.html`
- [ ] `public/sops/SOP-58-dry-product-fg02-stock-take.html`

**Commit message:**
```
Add new dry SOPs (51.1, 51.2, 52.2, 53-58) and SOP 20 Dry Washing, SOP 46

- Add 11 new SOP pages for new/renumbered dry processing procedures
- Renumber dry SOP sequence: 53→58, 55→56, 56→57
- New SOPs: 51.1 Cultivated Dry Salting, 51.2 Ranched/Wild Dry Salting,
  52.2 Ranched/Wild Dry Cooking, 53 Stringing & Hanging, 54 Steaming & Drying,
  55 De-String & Grading, 56 Dry Boxing, 57 Dry Export, 58 FG02 Stock Take
- Add SOP 20 Dry Washing (separate from SOP 20 Code Application)
- Add SOP 46 Can Filling – Sauce
- Update sop-index-data.js with all new entries and revised structure

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E3ie4NnKPYzzzhnAFq6S4y
```

---

## Part 6: Open questions / confirm before building

1. **SOP 20 numbering clash** — there are now two SOP 20s (Code Application and Dry Washing). Both are listed in the index above. Confirm this is correct or if Dry Washing should get a different number.

2. **SOP 57 clash** — there are now two SOP 57s (Dry Export and Dry Steamer Cleaning). Both listed. Confirm if Steamer Cleaning should be renumbered (e.g. SOP 57.1 or SOP 59).

3. **SOP 53 old content** — old `SOP 53 Dry Product Stock Control` HTML page content: confirm whether to migrate it to SOP 58 as-is, or use only the new `.docx` content.

4. **Revision numbers for new SOPs** — revision numbers above are inferred from the `.docx` filenames (e.g. `rev2`, `rev 1`). Claude Code should verify these match the revision history table inside each document.
