(function () {
  'use strict';

  const LISTS = {
    sizeRanges: [
      '0-50g',
      '50-100g',
      '100-150g',
      '150-200g',
      '200-250g',
      '250-300g',
      '300-350g',
      '350-400g',
      '400-450g',
      '450g+'
    ],

    saltingStandardTimes: {
      '0-50g': '',
      '50-100g': '',
      '100-150g': '',
      '150-200g': '',
      '200-250g': '',
      '250-300g': '',
      '300-350g': '',
      '350-400g': '',
      '400-450g': '',
      '450g+': ''
    },

    farms: ['Bergsig', 'Sulamanzi', 'Seaview', 'Third Party', 'FACTORY'],

    processingFor: ['Can', 'Dried', 'Live', 'Other'],

    areas: ['Area 1', 'Area 2', 'Area 3', 'Area 4', 'Area 5', 'Area 6', 'Area 7', 'Area 8', 'Area 9', 'Area 10'],

    equipment: ['Equipment 1', 'Equipment 2', 'Equipment 3', 'Equipment 4', 'Equipment 5', 'Equipment 6', 'Equipment 7', 'Equipment 8', 'Equipment 9', 'Equipment 10'],

    allergens: ['Molluscs', 'Crustaceans', 'Fish', 'Egg', 'Milk', 'Soy', 'Gluten', 'Tree nuts', 'Peanuts', 'Sulphites', 'Other'],

    productDescriptions: [],

    jobPrefixes: ['3CP', '3DP', 'CPR', 'DPR'],

    palettes: [
      'sauce',
      'dry',
      'cleaning/hygiene',
      'traceability',
      'quality_general',
      'canning',
      'live',
      'technical/maintenance',
      'warehouse/stock_management',
      "SOP's",
      'unknowns',
      'periwinkle',
      'lilac',
      'seafoam-green',
      'buttercream',
      'apricot',
      'coral',
      'cherry-blossom-pink',
      'pale-violet',
      'terracotta'
    ]
  };

  const BATCH_PATTERNS = {
    '3CP': { regex: /^3CP\d{4,8}$/, label: 'Canned Product (third party: 3CP + digits)' },
    '3DP': { regex: /^3DP\d{4,8}$/, label: 'Dried Product (third party: 3DP + digits)' },
    'CPR': { regex: /^CPR\d{4,8}$/, label: 'Canned Product (CPR + digits)' },
    'DPR': { regex: /^DPR\d{4,8}$/, label: 'Dried Product (DPR + digits)' }
  };

  function isValidBatchNumber(value) {
    if (!value || typeof value !== 'string') return false;
    const v = value.trim().toUpperCase();
    for (const key in BATCH_PATTERNS) {
      if (BATCH_PATTERNS[key].regex.test(v)) return true;
    }
    return false;
  }

  function getValidBatchFormats() {
    return Object.keys(BATCH_PATTERNS);
  }

  function getPatternLabel(prefix) {
    return BATCH_PATTERNS[prefix] ? BATCH_PATTERNS[prefix].label : null;
  }

  function batchFormatError() {
    const examples = ['3CP000001', '3DP000001', 'CPR000001', 'DPR000001'];
    return 'Batch number must start with 3CP, 3DP, CPR, or DPR followed by digits (e.g., ' +
      examples.join(', ') + ')';
  }

  const PREFIX_ROUTE = { '3CP': 'Can', 'CPR': 'Can', '3DP': 'Dried', 'DPR': 'Dried' };
  function batchPrefix(value) {
    const v = String(value == null ? '' : value).trim().toUpperCase();
    for (const p in PREFIX_ROUTE) if (v.indexOf(p) === 0) return p;
    return '';
  }
  function routeForBatch(value) {
    const p = batchPrefix(value);
    return p ? PREFIX_ROUTE[p] : null;
  }

  function routeMatches(batch, processingFor) {
    const want = routeForBatch(batch);
    if (!want || !processingFor) return true;
    return String(processingFor).trim().toLowerCase() === want.toLowerCase();
  }
  function routeError(batch) {
    const want = routeForBatch(batch);
    return want
      ? `Job ${batchPrefix(batch)} must be processed for ${want === 'Can' ? 'canning' : 'dry'} — check "Processing for".`
      : '';
  }

  function get(name) {
    return (LISTS[name] || []).slice();
  }

  function has(name) {
    return Array.isArray(LISTS[name]) && LISTS[name].length > 0;
  }

  function isValid(name, value) {
    if (value == null || String(value).trim() === '') return true;
    const v = String(value).trim().toLowerCase();
    return (LISTS[name] || []).some(o => String(o).toLowerCase() === v);
  }

  function fill(el, name, options) {
    const opts = options || {};
    const sel = typeof el === 'string' ? document.getElementById(el) : el;
    if (!sel || !has(name)) return false;

    const values = get(name);
    if (opts.allowOther && values.indexOf('Other') === -1) values.push('Other');

    if (opts.selected && values.indexOf(opts.selected) === -1) values.push(opts.selected);

    sel.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = opts.placeholder || '—';
    sel.appendChild(blank);

    values.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });

    if (opts.selected != null) sel.value = opts.selected;
    return true;
  }

  function field(spec) {
    const out = {};
    for (const k in spec) if (k !== 'list') out[k] = spec[k];
    if (has(spec.list)) {
      out.type = 'select';
      out.options = get(spec.list);
    } else {
      out.type = spec.fallbackType || 'text';
    }
    return out;
  }

  function upgrade(el, name) {
    const node = typeof el === 'string' ? document.getElementById(el) : el;
    if (!node || !has(name)) return false;
    if (node.tagName === 'SELECT') { fill(node, name, { selected: node.value }); return true; }

    const sel = document.createElement('select');
    sel.id = node.id;
    sel.className = node.className;
    if (node.disabled) sel.disabled = true;
    node.parentNode.replaceChild(sel, node);
    fill(sel, name, { selected: node.value });
    return true;
  }

  function setValue(el, name, value) {
    const node = typeof el === 'string' ? document.getElementById(el) : el;
    if (!node) return false;
    const v = value == null ? '' : value;
    if (node.tagName === 'SELECT') {
      const known = [...node.options].some(o => o.value === v);
      if (v !== '' && !known) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        node.appendChild(o);
      }
    }
    node.value = v;
    return true;
  }

  window.Lookups = {
    lists: LISTS,
    get: get,
    has: has,
    isValid: isValid,
    fill: fill,
    field: field,
    upgrade: upgrade,
    setValue: setValue,
    batch: {
      isValid: isValidBatchNumber,
      getFormats: getValidBatchFormats,
      getPatternLabel: getPatternLabel,
      formatError: batchFormatError,
      route: routeForBatch,
      routeMatches: routeMatches,
      routeError: routeError
    }
  };

  window.SizeRanges = { ranges: LISTS.sizeRanges };
  window.BatchValidation = window.Lookups.batch;
})();
