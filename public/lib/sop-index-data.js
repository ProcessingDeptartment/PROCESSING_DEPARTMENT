/*
 * Baseline data for the SOP list, transcribed from the docx files in
 * "2. SOP's" (paper/Word originals). Revision numbers here are the PAPER
 * baseline only -- the live current revision of any row that has a `recordKey`
 * comes from document-revision.js at render time, same convention as
 * master-index-data.js for records.
 *
 * "Archived" subfolder is intentionally excluded -- only current SOPs are listed.
 * Regenerate rather than hand-edit when SOPs are added, renumbered, or reissued.
 */
window.SopIndexData = {
  rows: [
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
    { sopNo: 'SOP 51', name: 'Dry Salting', area: 'Dry', revision: 2, recordKey: 'sop-51-dry-salting', href: 'SOP-51-dry-salting.html' },
    { sopNo: 'SOP 52', name: 'Dry Cooking', area: 'Dry', revision: 2, recordKey: 'sop-52-dry-cooking', href: 'SOP-52-dry-cooking.html' },
    { sopNo: 'SOP 53', name: 'Dry Product Stock Control', area: 'Dry', revision: 1, recordKey: 'sop-53-dry-product-stock-control', href: 'SOP-53-dry-product-stock-control.html' },
    { sopNo: 'SOP 55', name: 'Dry Boxing', area: 'Dry', revision: 1, recordKey: 'sop-55-dry-boxing', href: 'SOP-55-dry-boxing.html' },
    { sopNo: 'SOP 56', name: 'Dry Export', area: 'Dry', revision: 2, recordKey: 'sop-56-dry-export', href: 'SOP-56-dry-export.html' },
    { sopNo: 'SOP 57', name: 'Dry Steamer Cleaning', area: 'Dry', revision: 1, recordKey: 'sop-57-dry-steamer-cleaning', href: 'SOP-57-dry-steamer-cleaning.html' },
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
