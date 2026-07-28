/* ========================================================================
   PALETTE MAP

   The one place a record page is assigned a colour palette.

   To theme a record: find the palette below and add the page's file name
   to its list. Nothing else — no attribute on the page, no new stylesheet.
   A page that appears in no list gets the default slate/amber palette.

   The palettes themselves (the --palette-* tokens) live in record-theme.css.
   Adding a name here that has no matching palette there does nothing, so
   add the palette block first.

   This file is loaded from <head>, before the page renders, so the theme is
   in place on first paint — there is no flash of the default colours. Keep
   it that way: don't move the <script> tag into <body> or defer it.
   ======================================================================== */

(function () {
  var PALETTES = {

    /* ---- Sauce records,(warm brown) ---- */
    sauce: [
      'REC-7.3.1-broth-cooking.html',
      'REC-7.3.2-ingredient-weighing.html',
      'REC-7.3.3-sauce-mixing.html',
      'REC-7.3.4-final-sauce-mix.html',
      'REC-7.3.5-sauce-batch-coding.html',
      'REC-7.3.6-brine-mixing-report.html',
    ],

    /* ---- Dry records, (muted sage green) ---- */
    dry: [
      'REC-7.4.0-dry-cooking.html',
      'REC-7.4.1-drying-process.html',
      'REC-7.4.2-dry-monitoring.html',
      'REC-7.4.3.1-grading-production-log-cultivated.html',
      'REC-7.4.3.2-grading-production-log-ranched.html',
      'REC-7.4.4-grading-boxing-traceability.html',
      'REC-7.4.6-dry-stock-control.html',
      'REC-7.4.10-dried-abalone-transfer.html',
    ],

    /* ---- Cleaning records, REC 7.6.x (muted teal) ---- */
    cleaning: [
      'REC-7.6.8-allergen-cleaning-verification.html',
      'REC-7.6.1-daily-cleaning-inspection.html',
      'REC-7.6.1.1-deep-cleaning-record-weekly.html',
      'REC-7.6.2.2-dispatch-cleaning-inspection.html',
      'REC-7.6.2-weekly-cleaning-record.html',
    ],

    /* ---- Traceability records, REC 8.1.x (muted mauve) ---- */
    traceability: [
      'REC-8.1.3-disposition-investigation-record.html',
      'REC-8.1.5-traceability.html',
      'REC-8.1.6-traceability-mock-recall-canned-abalone.html',
      'REC-8.1.6-a-traceability-mock-recall-canned-braised-abalone.html',
      'REC-8.1.7-traceability-mock-recall-dried-abalone.html',
      'REC-8.1.8-traceability-mock-recall-live-abalone.html',
      'REC-8.1.4-withdrawal-mock-recall-record.html',
    ],
    /* ---- Quality records, REC 8.2.x (warm burnt orange) ---- */
    quality: [
      'REC-7.1.1-basket-removal-shucking-gutting.html',
      'REC-7.1.3-salting-and-tumbling.html',
      'REC-7.1.3.1-bleeding-and-salting.html',
      'REC-7.1.4-washing-control-sheet.html',
      'REC-7.2.2-scrubbing-checklist-qc.html',
      'REC-7.2.5-can-packing-control-sheet.html',
      'REC-7.2.6-can-filling-and-printing.html',
      'REC-7.2.8-retorting-control-sheet.html',
      'REC-7.2.11-qc-report.html',
      'REC-7.4.5-boxing-and-labelling.html',
    ],

    /* ---- The six palettes below are designed and registered but not yet
       assigned. Add a file name to a list to theme that record; nothing else
       is needed. Left empty deliberately — the records these were drawn up
       for either don't exist yet or already carry another classification,
       and moving an existing record between palettes changes what colour
       staff associate with it. ---- */

  
  
  var root = document.documentElement;

  /* An explicit data-palette on the page wins — the escape hatch for a
     one-off page that shouldn't be listed above. Nothing uses it today. */
  if (root.getAttribute('data-palette')) return;

  var file = (location.pathname.split('/').pop() || '').toLowerCase();
  if (!file) return;

  for (var name in PALETTES) {
    if (!Object.prototype.hasOwnProperty.call(PALETTES, name)) continue;
    for (var i = 0; i < PALETTES[name].length; i++) {
      if (PALETTES[name][i].toLowerCase() === file) {
        root.setAttribute('data-palette', name);
        return;
      }
    }
  }
})();
