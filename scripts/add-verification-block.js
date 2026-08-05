// One-off migration: adds the Verification panel (HTML + JS) to the 28 bespoke
// record pages that use neither FormRecord.init() nor MonitoringLog.init() (those
// two shared engines already got the block via lib/form-record.js and already had
// it in lib/monitoring-log.js). Run once with: node scripts/add-verification-block.js
const fs = require('fs');
const path = require('path');

const RECORDS_DIR = path.join(__dirname, '..', 'public', 'records');

const FILES = [
  'REC-7.1.1-basket-removal-shucking-gutting.html',
  'REC-7.1.2-abalone-receiving.html',
  'REC-7.1.3-salting-and-tumbling.html',
  'REC-7.1.3.1-bleeding-and-salting.html',
  'REC-7.1.4-washing-control-sheet.html',
  'REC-7.1.5-salting-oosw.html',
  'REC-7.2.11-qc-report.html',
  'REC-7.2.12-double-seam-inspection-report.html',
  'REC-7.2.13-rework-log.html',
  'REC-7.2.14-product-label-checklist.html',
  'REC-7.2.15-labelling-of-cans.html',
  'REC-7.2.16-stock-transfers.html',
  'REC-7.2.3-precooking-check-sheet.html',
  'REC-7.2.4-abalone-packing-specification.html',
  'REC-7.2.5-can-packing-control-sheet.html',
  'REC-7.2.6-can-filling-and-printing.html',
  'REC-7.2.6.1-printing-control-sheet.html',
  'REC-7.2.7-cans-produced.html',
  'REC-7.2.8-retorting-control-sheet.html',
  'REC-7.2.9-retort-inspection-report.html',
  'REC-7.3.1-broth-cooking.html',
  'REC-7.3.2-ingredient-weighing.html',
  'REC-7.3.3-sauce-mixing.html',
  'REC-7.3.4-final-sauce-mix.html',
  'REC-7.3.5-sauce-batch-coding.html',
  'REC-7.3.6-brine-mixing-report.html',
  'REC-7.4.0-dry-cooking.html',
  'REC-7.4.4-grading-boxing-traceability.html'
];

const PANEL_HTML = `
    <div class="panel no-print">
      <div class="panel-head"><h2>Verification</h2></div>
      <div class="panel-body">
        <div class="muted" style="margin-bottom:6px; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em;">Entries to verify</div>
        <div id="verifySelect" style="margin-bottom:10px;"></div>
        <div class="grid grid-3" style="margin-bottom:8px;">
          <label class="field">Verified by<input id="v_verifiedBy"></label>
          <label class="field">Signature (type name to sign)<input id="v_verifiedSig"></label>
          <label class="field">Date<input id="v_verifiedDate" type="date"></label>
        </div>
        <div class="actions no-print" style="justify-content:flex-start; margin-top:0;">
          <button class="btn btn-primary" id="logVerificationBtn">Log verification</button>
        </div>
        <div class="muted" style="margin:10px 0 4px; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em;">Verification history</div>
        <div id="verificationHistory"></div>
      </div>
    </div>
`;

const JS_FUNCTIONS = `
  function _vEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function pendingVerification(){
    return (state.status === 'submitted' && !state.verification) ? [state] : [];
  }

  function renderVerifySelect(){
    const target = $('verifySelect');
    if(!target) return;
    const pending = pendingVerification();
    if(!pending.length){
      target.innerHTML = '<div class="muted" style="font-size:11px;">No submitted entries are waiting to be verified.</div>';
      return;
    }
    target.innerHTML = pending.map(function(s){
      return '<div style="font-size:11px;padding:4px 0;">' + _vEsc(s.id || '(unsaved)') +
        (s.updatedAt ? ' &middot; saved ' + new Date(s.updatedAt).toLocaleString() : '') + '</div>';
    }).join('');
  }

  async function renderVerificationHistory(){
    const raw = await storeGet('verification_log:' + window.RecordDoc.recordKey, true);
    let hist = [];
    try{ hist = raw ? JSON.parse(raw) : []; }catch(e){ hist = []; }
    renderVerifySelect();
    const target = $('verificationHistory');
    if(!target) return;
    if(!hist.length){ target.innerHTML = '<div class="muted" style="font-size:11px;">No verification logged yet.</div>'; return; }
    target.innerHTML = hist.slice().reverse().map(function(v){
      return '<div style="font-size:11px;padding:4px 0;border-top:1px solid var(--line-soft);">' +
        _vEsc(v.verifiedDate || '(no date)') + ' &middot; ' + _vEsc(v.verifiedBy) +
        ' <span class="muted">(signed: ' + _vEsc(v.verifiedSig) + ')</span></div>';
    }).join('');
  }

  async function logVerification(){
    const verifiedBy = $('v_verifiedBy').value.trim();
    const verifiedSig = $('v_verifiedSig').value.trim();
    const verifiedDate = $('v_verifiedDate').value;
    if(!verifiedBy || !verifiedSig || !verifiedDate){ toast('Verified by, signature and date are all required.'); return; }
    const record = { verifiedBy: verifiedBy, verifiedSig: verifiedSig, verifiedDate: verifiedDate, loggedAt: Date.now() };
    const pending = pendingVerification();
    if(pending.length){
      state.verification = record;
      await storeSet('record:'+state.id, JSON.stringify(state), true);
    }
    const raw = await storeGet('verification_log:' + window.RecordDoc.recordKey, true);
    let hist = [];
    try{ hist = raw ? JSON.parse(raw) : []; }catch(e){ hist = []; }
    hist.push(Object.assign({ entryId: pending.length ? state.id : null }, record));
    await storeSet('verification_log:' + window.RecordDoc.recordKey, JSON.stringify(hist), true);
    toast('Verification logged.');
    $('v_verifiedBy').value=''; $('v_verifiedSig').value=''; $('v_verifiedDate').value='';
    renderAll();
    renderVerificationHistory();
  }

`;

let changed = 0, skipped = [];

for (const name of FILES) {
  const file = path.join(RECORDS_DIR, name);
  let html = fs.readFileSync(file, 'utf8');

  if (html.includes('id="logVerificationBtn"')) { skipped.push(name + ' (already has verification block)'); continue; }

  // 1) HTML panel: insert right before dc-body's closing </div>, which is always
  // immediately followed by a blank line and the toast div.
  const anchorHtml = '  </div>\n\n  <div class="toast no-print" id="toast"></div>';
  if (!html.includes(anchorHtml)) { skipped.push(name + ' (HTML anchor not found)'); continue; }
  html = html.replace(anchorHtml, PANEL_HTML + '  </div>\n\n  <div class="toast no-print" id="toast"></div>');

  // 2) JS: insert the verification functions right before `function wire(){`
  const wireDeclMatch = html.match(/\n(\s*)function wire\(\)\{/);
  if (!wireDeclMatch) { skipped.push(name + ' (wire() not found)'); continue; }
  html = html.replace(/\nfunction wire\(\)\{/, '\n' + JS_FUNCTIONS + 'function wire(){');

  // 3) JS: wire the button inside wire()
  html = html.replace(/function wire\(\)\{/, "function wire(){\n\$('logVerificationBtn').addEventListener('click', logVerification);");

  // 4) JS: refresh verification history on boot, alongside the existing wire()/renderAll() call
  const bootAnchor = /wire\(\);\s*\n\s*renderAll\(\);\s*\n\}\)\(\);/;
  if (!bootAnchor.test(html)) { skipped.push(name + ' (boot sequence not found)'); continue; }
  html = html.replace(bootAnchor, 'wire();\n  renderAll();\n  renderVerificationHistory();\n})();');

  fs.writeFileSync(file, html, 'utf8');
  changed++;
  console.log('updated:', name);
}

console.log('\nDone.', changed, 'files updated,', skipped.length, 'skipped.');
if (skipped.length) skipped.forEach(s => console.log('  SKIP:', s));
