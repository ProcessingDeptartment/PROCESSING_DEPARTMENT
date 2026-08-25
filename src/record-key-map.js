// Loads data/record-key-map.json (built by scripts/build-record-map.js from every page's
// FormRecord.init/MonitoringLog.init call) so a submission key can be resolved to the record it
// actually came from, instead of guessing off a field key that may be shared across many forms.
const fs = require('fs');
const path = require('path');

const MAP_PATH = path.join(__dirname, '..', 'data', 'record-key-map.json');
const PREFIXES = ['formrecord:', 'monitoring_log:'];

function load() {
  return JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
}

// 'formrecord:abalone-receiving' -> 'abalone-receiving'
function recordKeyFromStorageKey(key) {
  for (const prefix of PREFIXES) {
    if (key.startsWith(prefix)) return key.slice(prefix.length);
  }
  return null;
}

function hasKnownPrefix(key) {
  return PREFIXES.some((p) => key.startsWith(p));
}

module.exports = { load, recordKeyFromStorageKey, hasKnownPrefix };
