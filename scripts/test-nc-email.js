// Sends one sample NC alert through the real sendNCAlert (src/nc-log.js) so SMTP + recipients can be checked
// without raising an NC. Nothing is written to the database.
//   node scripts/test-nc-email.js            # sends to NC_EMAIL_RECIPIENTS
//   node scripts/test-nc-email.js --dry      # only reports what is / isn't configured
// Reads SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NC_EMAIL_FROM, NC_EMAIL_RECIPIENTS from the environment or .env.
const fs = require('fs');
const path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env: use the real environment */ }

const need = ['SMTP_HOST', 'NC_EMAIL_RECIPIENTS'];
const opt = ['SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'NC_EMAIL_FROM'];
need.concat(opt).forEach((k) => console.log(`${need.includes(k) ? 'required' : 'optional'}  ${k.padEnd(20)} ${process.env[k] ? 'set' : 'NOT SET'}`));
const missing = need.filter((k) => !process.env[k]);
if (missing.length) { console.error('\nMissing: ' + missing.join(', ') + ' — the alert would be skipped.'); process.exit(1); }
if (process.argv.includes('--dry')) process.exit(0);

require('../src/nc-log').sendNCAlert({
  ncRef: 'NC-TEST-0000', recordRef: 'REC-7.9.1', jobNumber: 'TEST-JOB', raisedAt: new Date(), raisedBy: 'Email test',
  category: 'Temperature out of spec', severity: 'major',
  description: 'THIS IS A TEST — no NC was raised. Chiller temperature 12°C — outside accepted range 0–10°C.',
  correctiveAction: null,
}).then(() => console.log('\nSent to ' + process.env.NC_EMAIL_RECIPIENTS)).catch((e) => { console.error('\nSend failed:', e.message); process.exit(1); });
