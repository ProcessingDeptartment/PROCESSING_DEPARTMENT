/* ========================================================================
   PALETTE MAP

   The one place a record page is assigned a colour palette.

   Two ways a record gets themed, in priority order:

   1. A per-record override chosen in the Category column on the Master
      Record Index (REC 01). That page writes it to shared storage under
      the key `record_category:<file-name.html>` (lower-cased), which lands
      in localStorage under data-store.js's `facility_records:` prefix.
      This ALWAYS wins over the static list below, including an explicit
      choice of "Default" (stored as an empty string) — that is how the
      index un-assigns a record that used to be hard-coded here.

   2. The static PALETTES list below, unchanged from before the Category
      column existed. Add the page's file name to a list here and nothing
      else is needed — no attribute on the page, no new stylesheet. A page
      that matches neither an override nor an entry here gets the default
      slate/amber palette.

   The palettes themselves (the --palette-* tokens) live in record-theme.css.
   Adding a name here that has no matching palette there does nothing, so
   add the palette block first.

   This file is loaded from <head>, before the page renders, so the theme is
   in place on first paint — there is no flash of the default colours. Keep
   it that way: don't move the <script> tag into <body> or defer it. Because
   of that, the override lookup reads localStorage directly and synchronously
   rather than going through the async window.storage API (which isn't even
   guaranteed to exist yet this early) — fine today since localStorage IS the
   backend. Once a real backend is registered (see data-store.js), a page
   opened on a device that has never synced that record's override will fall
   through to the static list until something repopulates this device's
   localStorage cache -- there is no seam for that yet, so re-check this if a
   backend ever lands.
   ======================================================================== */

(function () {
  var PALETTES = {

    /*Sauce records*/
    sauce: [
      'REC-7.3.1-broth-cooking.html',
      'REC-7.3.2-ingredient-weighing.html',
      'REC-7.3.3-sauce-mixing.html',
      'REC-7.3.4-final-sauce-mix.html',
      'REC-7.3.5-sauce-batch-coding.html',
      'REC-7.3.6-brine-mixing-report.html',
    ],

    /*Dry records*/
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

    /*Cleaning records*/
    'cleaning/hygiene': [
      'REC-7.6.8-allergen-cleaning-verification.html',
      'REC-7.6.1-daily-cleaning-inspection.html',
      'REC-7.6.1.1-deep-cleaning-record-weekly.html',
      'REC-7.6.2.2-dispatch-cleaning-inspection.html',
      'REC-7.6.2-weekly-cleaning-record.html',
    ],

    /*Traceability records */
    traceability: [
      'REC-8.1.3-disposition-investigation-record.html',
      'REC-8.1.5-traceability.html',
      'REC-8.1.6-traceability-mock-recall-canned-abalone.html',
      'REC-8.1.6-a-traceability-mock-recall-canned-braised-abalone.html',
      'REC-8.1.7-traceability-mock-recall-dried-abalone.html',
      'REC-8.1.8-traceability-mock-recall-live-abalone.html',
      'REC-8.1.4-withdrawal-mock-recall-record.html',
    ],
    /*General Quality records */
    'quality_general': [
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

  };

  // The record-category override written by the Master Record Index, if any, for the
  // given file name. Returns null when nobody has ever touched the Category selector
  // for this record -- distinct from '', which means "explicitly set to Default".
  function overrideFor(file) {
    try {
      return window.localStorage.getItem('facility_records:record_category:' + file);
    } catch (e) {
      return null;
    }
  }

  // Static-list lookup only (the pre-Category-column behaviour). '' if no match.
  function staticCategoryFor(file) {
    for (var name in PALETTES) {
      if (!Object.prototype.hasOwnProperty.call(PALETTES, name)) continue;
      for (var i = 0; i < PALETTES[name].length; i++) {
        if (PALETTES[name][i].toLowerCase() === file) return name;
      }
    }
    return '';
  }

  // The effective category for a file name: override wins (even an explicit ''),
  // otherwise fall back to the static list. Exposed so the Master Record Index can
  // show the record's current palette in its Category dropdown.
  function categoryFor(file) {
    file = String(file || '').toLowerCase();
    if (!file) return '';
    var override = overrideFor(file);
    return override !== null ? override : staticCategoryFor(file);
  }

  window.PaletteMap = { PALETTES: PALETTES, categoryFor: categoryFor };

  var root = document.documentElement;

  /* An explicit data-palette on the page wins — the escape hatch for a
     one-off page that shouldn't be listed above. Nothing uses it today. */
  if (root.getAttribute('data-palette')) return;

  var file = (location.pathname.split('/').pop() || '').toLowerCase();
  if (!file) return;

  var cat = categoryFor(file);
  if (cat) root.setAttribute('data-palette', cat);
})();
