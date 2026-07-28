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
 *   // form-record.js configs:
 *   { key: 'harvestFarm', label: 'Harvest farm', type: 'select',
 *     options: window.Lookups.get('farms') }
 *
 *   // hand-rolled record pages:
 *   Lookups.fill('h_sizeRange', 'sizeRanges', { selected: state.sizeRange });
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

    // TODO: replace with the facility's actual harvest farms / suppliers.
    // While this list is empty, Lookups.fill() leaves the field alone so
    // farm inputs stay free text instead of turning into an empty dropdown.
    farms: [],

    processingFor: ['Can', 'Dried', 'Live sorting', 'Other'],

    jobPrefixes: ['3CP', '3DP', 'CPR', 'DPR']
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

  /* --------------------------------------------------------------- export */

  window.Lookups = {
    lists: LISTS,
    get: get,
    has: has,
    isValid: isValid,
    fill: fill,
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
