/*
 * Central registry of default spec thresholds (min/max) for monitoring-log records.
 * Each record's specFields pulls its defaults from here via Thresholds.get(recordKey, fieldKey)
 * instead of hardcoding numbers inline, so all thresholds live in one place.
 *
 * These are only the starting defaults shown the first time a document opens -- users can
 * still edit them per-document through the Thresholds modal (see monitoring-log.js), which
 * saves its own values separately and does not write back here.
 */
(function () {
  const REGISTRY = {
    'water-monitoring': {
      freshPh: { min: null, max: null },
      seaSalt: { min: null, max: null },
      seaPh: { min: null, max: null }
    },
    'lha-water-monitoring': {
      lhaTemp: { min: 12, max: 18 }
    },
    'chiller-temperature-monitoring': {
      chillerTemp: { min: 0, max: 10 },
      freezerTemp: { min: null, max: null }
    },
    'incubator-temperature-check': {
      incubatorTemp: { min: 36.1, max: 37.8 }
    },
    'dry-room-temp-humidity-log': {
      roomTemp: { min: 25, max: 32 },
      roomHumidity: { min: null, max: null }
    },
    'grading-room-temp-humidity-log': {
      roomTemp: { min: 25, max: 32 },
      roomHumidity: { min: null, max: null }
    },
    'ph-verification': {
      buffer4: { min: 3.9, max: 4.1 },
      buffer7: { min: 6.9, max: 7.1 },
      buffer10: { min: 9.9, max: 10.1 }
    },
    'thermometer-verification': {
      coldRange: { min: 0, max: 5 },
      hotRange: { min: 85, max: 95 },
      diffTolerance: { min: -0.5, max: 0.5 }
    },
    'thermometer-correction-factors': {
      diffTolerance: { min: -0.5, max: 0.5 }
    }
  };

  function get(recordKey, fieldKey) {
    const rec = REGISTRY[recordKey];
    if (!rec || !rec[fieldKey]) return { min: null, max: null };
    return rec[fieldKey];
  }

  // Seeded from "3. Production/3. CAN/73 dia. double seam inspection report.xls".
  // That sheet only gave one dataset, so EOA and NEO start identical -- use Specs ->
  // Edit to enter the real NEO-specific tolerances when known. Seam length, cover hook,
  // internal and tightness% weren't specified there either, so they're left as
  // "record only" rather than guessed; the seam-thickness cell in that sheet (0.19/0.03)
  // matches the Free space row exactly and looks like a copy-paste artifact, so it was
  // NOT carried over -- fill it in via Specs -> Edit once confirmed.
  const DOUBLE_SEAM_DEFAULT_SPEC_EOA = {
    name: 'Fujian 73x119mm EOA',
    vacuum: { op: 'gt', value: -10, label: '>-10 kPa' },
    seamLength: null,
    seamThickness: null,
    bodyHook: { min: 1.83, max: 2.23 },
    coverHook: null,
    overlapPctMin: 45,
    bhbPct: { min: 70, max: 100 },
    actualOverlapMin: 1,
    freespace: { min: 0.03, max: 0.19 },
    internal: null,
    tightnessPctMin: null,
    plateThicknessEnd: null,
    plateThicknessBody: null,
    countersinkDepth: { min: 4.73, max: 4.97 },
    gauge121Target: 1.21,
    gauge300Target: 3.00,
    gaugeTolerance: 0.02
  };
  const DOUBLE_SEAM_DEFAULT_SPEC_NEO = Object.assign({}, DOUBLE_SEAM_DEFAULT_SPEC_EOA, { name: 'Fujian 73x119mm NEO' });

  window.Thresholds = {
    REGISTRY,
    get,
    DOUBLE_SEAM_DEFAULT_SPEC_EOA,
    DOUBLE_SEAM_DEFAULT_SPEC_NEO
  };
})();
