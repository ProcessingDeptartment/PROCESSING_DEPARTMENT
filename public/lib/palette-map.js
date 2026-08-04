(function () {
  var PALETTES = {

    /*Sauce records*/
    sauce: [],

    /*Dry records*/
    dry: [],

    /*Cleaning records*/
    'cleaning/hygiene': [],

    /*Traceability records */
    traceability: [],

    /*General Quality records */
    'quality_general': [],

    /*canning*/
    'canning': [],
  };

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
