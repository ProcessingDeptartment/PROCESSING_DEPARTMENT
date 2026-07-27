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

    /* ---- Sauce records, REC 7.3.x (warm brown) ---- */
    sauce: [
      /* Nothing yet — the REC 7.3.x pages still carry their own colours
         inline. Add them here as they move onto the palette tokens. */
    ],

    /* ---- Dry records, REC 7.4.x (muted sage green) ---- */
    dry: [
      'dry-chiller-batch-control.html',
      'dry-cooking.html',
      'dry-export-pack-front-page.html',
      'dry-labelling-list.html',
      'dry-monitoring.html',
      'dry-nrcs-packs.html',
      'dry-room-temp-humidity-log.html',
      'dry-stock-control.html',
      'dry-stock-transfers.html',
      'drying-process.html',
      'labelling-of-dry-boxes.html',
    ],

    /* ---- Cleaning records, REC 7.6.x (muted teal) ---- */
    cleaning: [
      'allergen-cleaning-verification.html',
      'daily-cleaning-inspection.html',
      'deep-cleaning-record-weekly.html',
      'dispatch-cleaning-inspection.html',
      'live-product-areas-cleaning-record.html',
      'master-cleaning-checklist.html',
      'master-cleaning-plan.html',
      'personnel-facilities-cleaning-record.html',
      'production-areas-cleaning-record.html',
      'weekly-cleaning-record.html',
    ],

    /* ---- Traceability records, REC 8.1.x (muted mauve) ---- */
    traceability: [
      'disposition-investigation-record.html',
      'traceability.html',
      'traceability-mock-recall-canned-abalone.html',
      'traceability-mock-recall-canned-braised-abalone.html',
      'traceability-mock-recall-canned-minced-abalone.html',
      'traceability-mock-recall-dried-abalone.html',
      'traceability-mock-recall-live-abalone.html',
      'withdrawal-mock-recall-record.html',
    ],

  };

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
