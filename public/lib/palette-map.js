(function () {
  var PALETTES = {


    sauce: [],


    dry: [],


    'cleaning/hygiene': [],


    traceability: [],


    'quality_general': [],


    'canning': [],
  };

  function overrideFor(file) {
    try {
      return window.localStorage.getItem('facility_records:record_category:' + file);
    } catch (e) {
      return null;
    }
  }


  function staticCategoryFor(file) {
    for (var name in PALETTES) {
      if (!Object.prototype.hasOwnProperty.call(PALETTES, name)) continue;
      for (var i = 0; i < PALETTES[name].length; i++) {
        if (PALETTES[name][i].toLowerCase() === file) return name;
      }
    }
    return '';
  }


  function categoryFor(file) {
    file = String(file || '').toLowerCase();
    if (!file) return '';
    var override = overrideFor(file);
    return override !== null ? override : staticCategoryFor(file);
  }

  window.PaletteMap = { PALETTES: PALETTES, categoryFor: categoryFor };

  var root = document.documentElement;


  if (root.getAttribute('data-palette')) return;

  var file = (location.pathname.split('/').pop() || '').toLowerCase();
  if (!file) return;

  var cat = categoryFor(file);
  if (cat) root.setAttribute('data-palette', cat);
})();
