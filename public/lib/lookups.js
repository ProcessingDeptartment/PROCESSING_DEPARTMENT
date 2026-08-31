/*
 * Shared field lookups + validation for the Abagold facility.
 *
 * One place for every "the operator must pick from a preset list" field
 * (size range, harvest farm, processing for, job prefix, ...) and for the
 * validation rules that go with them (batch/job number format).
 *
 * Adding a farm or a size range = edit LISTS below. Nothing else changes.
 *
 * Usage
 *   <script src="../lib/lookups.js?v=1"></script>
 *
 *   // form-record.js / monitoring-log.js configs:
 *   window.Lookups.field({ key: 'harvestFarm', label: 'Harvest farm', list: 'farms' })
 *
 *   // hand-rolled record pages:
 *   Lookups.fill('h_sizeRange', 'sizeRanges', { selected: state.sizeRange });
 *   Lookups.upgrade('h_harvestFarm', 'farms');   // in wire(), before bindInputs()
 *   Lookups.setValue('h_harvestFarm', 'farms', state.harvestFarm);  // in render
 *
 *   // validation:
 *   Lookups.batch.isValid('3CP000123')   -> true
 *   Lookups.isValid('farms', value)      -> value is in the preset list
 *
 * Back-compat: this file also defines window.SizeRanges and
 * window.BatchValidation, so existing pages keep working unchanged.
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- lists */

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

    // Harvest farms / suppliers. Add the names here — every record's farm
    // field is already wired to this list and switches from a free-text box
    // to a dropdown the moment there is at least one entry. Nothing else to
    // edit. Farms already captured on old records stay readable even if you
    // later remove the name from this list.
    farms: ['Bergsig', 'Sulamanzi', 'Seaview', 'Third Party', 'FACTORY'],

    processingFor: ['Can', 'Dried', 'Live', 'Other'],

    areas: ['Area 1', 'Area 2', 'Area 3', 'Area 4', 'Area 5', 'Area 6', 'Area 7', 'Area 8', 'Area 9', 'Area 10'],

    equipment: ['Equipment 1', 'Equipment 2', 'Equipment 3', 'Equipment 4', 'Equipment 5', 'Equipment 6', 'Equipment 7', 'Equipment 8', 'Equipment 9', 'Equipment 10'],

    allergens: ['Molluscs', 'Crustaceans', 'Fish', 'Egg', 'Milk', 'Soy', 'Gluten', 'Tree nuts', 'Peanuts', 'Sulphites', 'Other'],

    // Product descriptions for the incubator cans log (REC 7.1). The list itself is
    // still to be supplied -- while it is empty the field renders as a free-text box
    // and becomes a dropdown the moment the first entry is added here, exactly like
    // `farms` above. Values already captured as text stay readable either way.
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

  /* ----------------------------------------------- batch/job number rules */

  /*
   * Batch numbers are one of the facility's four product codes followed by
   * 4-8 digits:
   *   3CP  Canned Product (third party)
   *   3DP  Dried Product (third party)
   *   CPR  Canned Product
   *   DPR  Dried Product
   */
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

  /* -------------------------------------------------------------- helpers */

  function get(name) {
    return (LISTS[name] || []).slice();
  }

  function has(name) {
    return Array.isArray(LISTS[name]) && LISTS[name].length > 0;
  }

  // True when `value` is one of the preset choices (case-insensitive).
  // Empty values pass — use the field's own `required` flag for presence.
  function isValid(name, value) {
    if (value == null || String(value).trim() === '') return true;
    const v = String(value).trim().toLowerCase();
    return (LISTS[name] || []).some(o => String(o).toLowerCase() === v);
  }

  /*
   * Populate a <select> from a list.
   * el       - element or element id
   * name     - list name in LISTS
   * options  - { selected, placeholder ('—'), allowOther (adds 'Other') }
   * Returns false (and leaves the element untouched) when the list is empty
   * or the element is missing, so callers can fall back to free text.
   */
  function fill(el, name, options) {
    const opts = options || {};
    const sel = typeof el === 'string' ? document.getElementById(el) : el;
    if (!sel || !has(name)) return false;

    const values = get(name);
    if (opts.allowOther && values.indexOf('Other') === -1) values.push('Other');
    // Keep a stored value that is no longer in the list (e.g. an option that
    // was since renamed) so old records still show what was captured.
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

  /*
   * Field descriptor for the config-driven engines (form-record.js /
   * monitoring-log.js). Renders as a dropdown once the list has entries and
   * as a plain text box while it is still empty, so a half-populated list
   * never traps the operator in a dropdown with nothing to pick.
   *
   *   Lookups.field({ key: 'harvestFarm', label: 'Harvest farm', list: 'farms' })
   *
   * Any extra keys (required, width, ...) are passed straight through.
   */
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

  /*
   * Turn a plain <input> into a <select> once the list has entries; no-op
   * while the list is empty, so the field stays free text until then.
   * Call BEFORE binding change listeners — the element is replaced, and a
   * <select> fires the same 'input'/'change' events the <input> did.
   */
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

  /*
   * Write a stored value into a field that may be either the text box or the
   * upgraded dropdown. On a <select> an unrecognised value (a farm since
   * removed from the list) is added back so old records still read correctly.
   */
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

  /* --------------------------------------------------------------- export */

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
      formatError: batchFormatError
    }
  };

  // Back-compat aliases for pages written before this module existed.
  window.SizeRanges = { ranges: LISTS.sizeRanges };
  window.BatchValidation = window.Lookups.batch;
})();
