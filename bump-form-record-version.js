// Run from the repo root:
//   node bump-form-record-version.js
// Bumps form-record.js?v=108 → ?v=109 in every HTML file under public/records/

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'records');
const FROM = 'form-record.js?v=108';
const TO   = 'form-record.js?v=109';

let count = 0;
fs.readdirSync(dir).forEach(name => {
  if (!name.endsWith('.html')) return;
  const file = path.join(dir, name);
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes(FROM)) return;
  fs.writeFileSync(file, src.replaceAll(FROM, TO), 'utf8');
  console.log('bumped:', name);
  count++;
});
console.log(`\nDone — bumped ${count} file(s).`);
