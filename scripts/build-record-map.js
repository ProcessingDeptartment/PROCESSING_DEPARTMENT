// Scans every page for its FormRecord.init({...}) call and builds a recordKey -> {recordName,
// docCode} lookup, so the API can label dates by the record they actually came from instead of
// guessing off a shared field key. Re-run this whenever a record page's recordKey/title/docCode
// changes, or a new record page is added.
const fs = require('fs');
const path = require('path');

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.html')) files.push(full);
  }
}

const files = [];
walk(path.join(__dirname, '..', 'public'), files);

const map = {};
let count = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const initMatch = text.match(/(?:FormRecord|MonitoringLog)\.init\(\{([\s\S]{0,1500}?)\}\);?/);
  if (!initMatch) continue;
  const block = initMatch[1];
  const keyMatch = block.match(/recordKey:\s*'([^']*)'/);
  const titleMatch = block.match(/title:\s*'([^']*)'/);
  const docMatch = block.match(/docCode:\s*'([^']*)'/);
  if (!keyMatch || !keyMatch[1]) continue;
  map[keyMatch[1]] = {
    recordName: titleMatch ? titleMatch[1] : keyMatch[1],
    docCode: docMatch ? docMatch[1] : null
  };
  count++;
}

const outPath = path.join(__dirname, '..', 'data', 'record-key-map.json');
fs.writeFileSync(outPath, JSON.stringify(map, null, 2));
console.log('records mapped:', count, '->', outPath);
