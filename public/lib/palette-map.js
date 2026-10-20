(function () {
  // Fixed colour dot per category — shown in the submissions list beside the record name.
  // Do NOT assign a theme/palette to the whole page; this map is colour-dot only.
  var CATEGORY_COLOURS = {
    'sauce':             '#e05c2a',   // orange-red
    'dry':               '#c9832b',   // amber
    'cleaning/hygiene':  '#2a7fc1',   // blue
    'traceability':      '#6b47c4',   // purple
    'quality_general':   '#2f6b3a',   // green
    'canning':           '#a3352d',   // red
  };

  // Map recordKey (or page filename) → category.
  // Keys are the recordKey string (e.g. 'drying-process') or the HTML filename without extension
  // (e.g. 'rec-7.4.1-drying-process'). Lower-case, exact match.
  var RECORD_CATEGORIES = {
    // Fill these in — one line per record:
    // 'drying-process': 'dry',
    // 'rec-7.4.1-drying-process': 'dry',
  };

  function categoryFor(recordKeyOrFile) {
    var k = String(recordKeyOrFile || '').toLowerCase().replace(/\.html$/, '');
    return RECORD_CATEGORIES[k] || '';
  }

  function dotColourFor(recordKeyOrFile) {
    var cat = categoryFor(recordKeyOrFile);
    return cat ? (CATEGORY_COLOURS[cat] || '') : '';
  }

  window.PaletteMap = {
    CATEGORY_COLOURS: CATEGORY_COLOURS,
    RECORD_CATEGORIES: RECORD_CATEGORIES,
    categoryFor: categoryFor,
    dotColourFor: dotColourFor,
  };
})();
