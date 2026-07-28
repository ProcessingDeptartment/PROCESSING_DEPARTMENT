/*
 * Batch/Job number validation for the Abagold facility.
 *
 * Enforces that batch numbers match one of the facility's four product codes:
 *   3CP  Canned Product
 *   3DP  Dried Product
 *   CPR  Canned Product (third party)
 *   DPR  Dried Product (third party)
 * Each code is followed by a string of digits (4-8 digits).
 *
 * Use in a record's form config to validate the batchField on blur/save.
 */
(function () {
  const BATCH_PATTERNS = {
    '3CP': { regex: /^3CP\d{4,8}$/, label: 'Canned Product ( Third party : 3CP + digits)' },
    '3DP': { regex: /^3DP\d{4,8}$/, label: 'Dried Product ( Third party : : 3DP + digits)' },
    'CPR': { regex: /^CPR\d{4,8}$/, label: 'Canned Product (CPR + digits)' },
    'DPR': { regex: /^DPR\d{4,8}$/, label: 'Dried Product (DPR + digits)' }
  };

  function isValidBatchNumber(value) {
    if (!value || typeof value !== 'string') return false;
    value = value.trim().toUpperCase();
    for (const key in BATCH_PATTERNS) {
      if (BATCH_PATTERNS[key].regex.test(value)) return true;
    }
    return false;
  }

  function getValidBatchFormats() {
    return Object.keys(BATCH_PATTERNS);
  }

  function getPatternLabel(prefix) {
    return BATCH_PATTERNS[prefix] ? BATCH_PATTERNS[prefix].label : null;
  }

  function formatError() {
    const examples = ['3CP000001', '3DP000001', 'CPR000001', 'DPR000001'];
    return 'Batch number must start with 3CP, 3DP, CPR, or DPR followed by digits (e.g., ' + examples.join(', ') + ')';
  }

  window.BatchValidation = {
    isValid: isValidBatchNumber,
    getFormats: getValidBatchFormats,
    getPatternLabel: getPatternLabel,
    formatError: formatError
  };
})();
