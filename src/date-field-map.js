// Loads data/date-field-classification.csv into a lookup keyed by field key (the HTML id used in
// each form, e.g. "packingDate"), so the API can label and classify dates without guessing.
// Source: DATE_FIELDS_ALL_RECORDS.csv, a manual audit of every date field across the record forms.
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'date-field-classification.csv');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function load() {
  const map = new Map();
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  for (const line of lines.slice(1)) {
    const [recNo, recordName, fieldLabel, fieldKey, inputType, , , recordClass] = parseCsvLine(line);
    if (!fieldKey || inputType !== 'date') continue;
    if (!map.has(fieldKey)) {
      map.set(fieldKey, { recordName, fieldLabel, recordClass: recordClass || 'B - Line-item event' });
    }
  }
  return map;
}

module.exports = { load };
