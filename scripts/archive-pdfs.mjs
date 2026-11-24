// Save real PDFs into the PROCESSING ARCHIVE -- the same PDF a user gets when printing online
// (MD/10_Archive-System.md). One local command; nothing else needs to be running:
//
//   node scripts/archive-pdfs.mjs [--type completed-record|record-def|policy|procedure|sop|prp] [--record <key>] [--limit N]
//                                 [--force] [--workers N] [--archive-out "<path>"]
//
// For every archived record entry and controlled document it opens the site's OWN print page in headless
// Chrome/Edge and saves what the browser would print:
//   records    -> pages/print-entry.html?rec=..&entry=..&print=1&printonly=1  (the engine's print sheet)
//   documents  -> the policy / procedure / SOP / PRP page itself, with its print stylesheet
//   templates  -> the same print page as a record, given ONE blank entry, so the PDF is the empty form exactly as it
//                 prints online. Every archived version of a template (current and superseded) gets its own PDF,
//                 drawn from that version's own archived definition -- not from today's.
// PDFs land in <archive>\pdf\<same path as the page>.pdf and are listed on the item in index.json (pdfPaths).
// Run archive-completed-records.mjs and archive-documents.mjs first: this script works from what they archived.
//
// How it works for records: a private local API + web server serve the data while Chrome renders the print page.
// The form engine's __pdfSameTab function is replaced before pdf-cover.js runs: instead of calling document.open()
// the captured print-sheet HTML is POSTed to the local server, which serves it back as a clean page for printing.
// Entry data is pre-fetched before Chrome starts so the form engine never waits on Supabase.
//
// Needs DATABASE_URL in env.

import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null; };
const onlyType = opt('--type'), onlyRecord = opt('--record');
const limit = Number(opt('--limit')) || Infinity;
const workers = Math.max(1, Math.min(6, Number(opt('--workers')) || 3));
const force = args.includes('--force');
const onlyEntry = opt('--entry');
if (opt('--archive-out')) process.env.ARCHIVE_OUT = opt('--archive-out');

const require = createRequire(import.meta.url);
const { archiveRoot, readIndex } = require('./archive-writer.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const ARCHIVE = archiveRoot();
const WORK = path.join(ARCHIVE, '.pdf-work');

const BROWSERS = [
  process.env.ARCHIVE_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const browser = BROWSERS.find((b) => fs.existsSync(b));
if (!browser) { console.error('No Chrome or Edge found. Set ARCHIVE_BROWSER to the browser .exe.'); process.exit(1); }

const freePort = () => new Promise((res, rej) => { const s = http.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- private API copy ------------------------------------------------------------------------------------------------
const apiPort = await freePort();
const apiKey = crypto.randomBytes(24).toString('hex');
const BOOT = "const p=require.resolve('./src/jobs/unverified-alert');"
  + "require.cache[p]={id:p,filename:p,loaded:true,exports:{runUnverifiedAlert:async()=>{}}};"
  + "require('./src/index.js');";
const api = spawn(process.execPath, ['-e', BOOT], { cwd: ROOT, env: { ...process.env, PORT: String(apiPort), API_KEY: apiKey }, stdio: ['ignore', 'pipe', 'pipe'] });
let apiLog = '';
api.stdout.on('data', (d) => { apiLog += d; });
api.stderr.on('data', (d) => { apiLog += d; });

// ---- local web server ------------------------------------------------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
let webPort = 0;

// Template (blank form) jobs.
const templates = new Map();
const TEMPLATE_ENTRY = '__template';
const tplOf = (req, own) => { const m = /[?&]_tpl=(\d+)/.exec(own ? req.url : String(req.headers.referer || '')); return m ? templates.get(m[1]) : null; };

// Template job print-readiness: window.print() replaced to freeze the page and signal via flag.
const WATCH_TPL = "<script>(function(){if(!/[?&]_tpl=/.test(location.search))return;var d=0;window.print=function(){if(d)return;d=1;"
  + "['frRoot','mlRoot'].forEach(function(i){var e=document.getElementById(i);if(e)e.style.display=''});"
  + "var h=document.documentElement.outerHTML.replace(/<script[\\s\\S]*?<\\/script>/gi,'');"
  + "setTimeout(function(){document.open();document.write('<!DOCTYPE html>'+h);document.close();"
  + "setTimeout(function(){window.__archivePdfReady=true;},100)},0)};})();</script>";

// Completed-record jobs: replace __pdfSameTab before pdf-cover.js sets it.
// The form engine writes the print-sheet HTML into our fake window; close() POSTs it to /__capture/{token}
// instead of calling document.open(). The server saves it and signals readiness via window.__archivePdfReady.
// Using Object.defineProperty(writable:false) so pdf-cover.js's later assignment silently fails (sloppy mode).
const CAPTURE_SRC = `(function(){
  var t=new URLSearchParams(location.search).get('_t')||'0';
  // Inject a fake API key so LoginUI.ensureAuthenticated() resolves immediately.
  // The proxy overwrites the Authorization header with the real key before hitting the local API.
  try{localStorage.setItem('facility_api_key','archive-session-key');}catch(e){}
  // login-ui.js sets AUTH_GATES_ENABLED=true then ensureAuthenticated shows a login modal.
  // Lock it false so ensureAuthenticated returns Promise.resolve() immediately.
  try{Object.defineProperty(window,'AUTH_GATES_ENABLED',{value:false,writable:false,configurable:false});}catch(e){}
  var buf='';
  var fn=function(){buf='';return{document:{
    write:function(h){buf+=h;},
    close:function(){
      fetch('/__capture/'+t,{method:'POST',headers:{'content-type':'text/html;charset=utf-8'},body:buf})
        .then(function(){window.__archivePdfReady=true;})
        .catch(function(e){window.__archivePdfFail=String(e);});
    }
  }};};
  try{Object.defineProperty(window,'__pdfOnly',{value:true,writable:false,configurable:false})}catch(e){}
  try{Object.defineProperty(window,'__pdfSameTab',{value:fn,writable:false,configurable:false})}catch(e){}
  window.__pdfFail=function(m){window.__archivePdfFail=m||'fail';};
})();`;

// Captured print sheets keyed by token: token -> absolute path of saved HTML file.
const sheets = new Map();

// Pre-fetched entry data served to Chrome instead of Supabase: 'formrecord:KEY:ENTRYID' -> JSON response string.
const entryCache = new Map();

const web = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // Capture POST: form engine sends print-sheet HTML here instead of calling document.open().
  if (urlPath.startsWith('/__capture/') && req.method === 'POST') {
    const token = path.basename(urlPath).replace(/[^0-9a-zA-Z_-]/g, '');
    const sheetFile = path.join(WORK, 'sheets', token + '.html');
    fs.mkdirSync(path.join(WORK, 'sheets'), { recursive: true });
    const chunks = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', () => { fs.writeFileSync(sheetFile, Buffer.concat(chunks)); sheets.set(token, sheetFile); res.writeHead(200); res.end(); });
    return;
  }

  // Serve saved print sheet so Chrome can load and print it cleanly.
  if (urlPath.startsWith('/__sheet/') && req.method === 'GET') {
    const token = path.basename(urlPath).replace(/[^0-9a-zA-Z_-]/g, '');
    const sheetFile = sheets.get(token);
    if (!sheetFile || !fs.existsSync(sheetFile)) { res.writeHead(404); res.end(); return; }
    fs.readFile(sheetFile, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // Template jobs: serve this version's definition + blank entry.
  const tpl = tplOf(req, false);
  if (tpl && req.method === 'GET') {
    let dec = ''; try { dec = decodeURIComponent(urlPath); } catch {}
    if (dec === '/data/record-defs/' + tpl.key + '.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(tpl.def)); return; }
    if (dec === '/api/storage/key/formrecord:' + tpl.key || dec === '/api/storage/key/monitoring_log:' + tpl.key) {
      const now = new Date().toISOString();
      const blank = { id: TEMPLATE_ENTRY, values: {}, rows: [], createdAt: now, updatedAt: now };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ key: dec.slice('/api/storage/key/'.length), value: JSON.stringify([blank]) })); return;
    }
  }

  // Storage intercept: never proxy storage reads to Supabase -- return instantly from cache or as empty.
  // This covers formrecord, monitoring_log, doc-header, document_revision, sign-off, and any other key.
  if (urlPath.startsWith('/api/storage/key/') && (req.method === 'GET' || req.method === 'HEAD')) {
    let dec = ''; try { dec = decodeURIComponent(urlPath.slice('/api/storage/key/'.length)); } catch {}
    let body;
    if (dec.startsWith('formrecord:') || dec.startsWith('monitoring_log:')) {
      const referer = req.headers.referer || '';
      const em = /[?&]entry=([^&]+)/.exec(referer);
      const entryId = em ? decodeURIComponent(em[1]) : null;
      const cached = (entryId && entryId !== TEMPLATE_ENTRY) ? entryCache.get(dec + ':' + entryId) : null;
      body = cached || JSON.stringify({ key: dec, value: '[]' });
    } else {
      body = JSON.stringify({ key: dec, value: null });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(body); return;
  }
  if (urlPath.startsWith('/api/storage/prefix/') && (req.method === 'GET' || req.method === 'HEAD')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ value: null }));
    return;
  }

  // All other API requests: proxy to local API (read-only).
  if (urlPath.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') { res.writeHead(405); res.end('read-only'); return; }
    const up = http.request({ host: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:' + apiPort, authorization: 'Bearer ' + apiKey } },
      (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => { res.writeHead(502); res.end('api unavailable'); });
    up.end();
    return;
  }

  // Static files from public\.
  let rel; try { rel = decodeURIComponent(urlPath); } catch { rel = '/'; }
  const file = path.join(PUBLIC, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    if (ext === '.html') {
      let html = data.toString()
        .replace(/var PRINT_LOCK_RECS = \[[^\]]*\]/, 'var PRINT_LOCK_RECS = []')
        .replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n<script>window.FACILITY_API_BASE=${JSON.stringify('http://127.0.0.1:' + webPort)};</script>` + WATCH_TPL);
      res.end(html);
    } else res.end(data);
  });
});
await new Promise((r) => web.listen(0, '127.0.0.1', r));
webPort = web.address().port;
const BASE = 'http://127.0.0.1:' + webPort;

let stopped = false;
function stop() {
  if (stopped) return; stopped = true;
  try { api.kill(); } catch {}
  try { web.close(); } catch {}
  try { fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch {}
}
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('exit', stop);

// Wait for the API copy to answer.
let up = false;
for (let i = 0; i < 90 && !up; i++) {
  if (api.exitCode != null) break;
  up = await new Promise((res) => { const r = http.get({ host: '127.0.0.1', port: apiPort, path: '/api/health', timeout: 2000 }, (x) => { x.resume(); res(x.statusCode < 500); }); r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); }); });
  if (!up) await sleep(1000);
}
if (!up) { console.error('The local API copy did not start:\n' + apiLog.slice(-1500)); stop(); process.exit(1); }

// ---- what to print ---------------------------------------------------------------------------------------------------
const DOC_TYPES = ['policy', 'procedure', 'sop', 'prp'];
const index = readIndex(ARCHIVE);
const readJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(ARCHIVE, rel), 'utf8')); } catch { return null; } };
const engineOfDef = (cfg) => (/ml/i.test(String((cfg || {}).mount || '')) || (cfg || {}).entryFields ? 'log' : 'form');
const engineOf = (recordKey) => engineOfDef(readJson(path.relative(ARCHIVE, path.join(PUBLIC, 'data', 'record-defs', encodeURIComponent(recordKey) + '.json'))));
const pdfBase = (e) => 'pdf/' + e.htmlPath.replace(/\.html$/, '');

const liveCache = new Map();
const apiGet = (p) => new Promise((res) => {
  const r = http.get({ host: '127.0.0.1', port: apiPort, path: p, timeout: 60000, headers: { authorization: 'Bearer ' + apiKey } }, (x) => {
    let body = ''; x.setEncoding('utf8'); x.on('data', (d) => { body += d; });
    x.on('end', () => { try { res(x.statusCode === 200 ? JSON.parse(body) : undefined); } catch { res(undefined); } });
  });
  r.on('error', () => res(undefined)); r.on('timeout', () => { r.destroy(); res(undefined); });
});
async function liveIds(recordKey) {
  if (liveCache.has(recordKey)) return liveCache.get(recordKey);
  const ids = new Set(); let known = false, failed = false;
  for (const prefix of ['formrecord:', 'monitoring_log:']) {
    const got = await apiGet('/api/storage/key/' + encodeURIComponent(prefix + recordKey));
    if (got === undefined) { failed = true; break; }
    if (got.value == null) continue;
    let data; try { data = JSON.parse(got.value); } catch { failed = true; break; }
    known = true;
    const lists = Array.isArray(data) ? [data] : Object.values(data || {}).filter(Array.isArray);
    for (const list of lists) for (const x of list) if (x && x.id) ids.add(x.id);
  }
  const out = failed || !known ? null : ids;
  liveCache.set(recordKey, out);
  return out;
}

const pruned = [], deletedNow = [];
let skippedDeleted = 0, emptyTemplates = 0;
const jobs = [];
for (const e of index) {
  if (onlyType && e.type !== onlyType) continue;
  if (onlyRecord && e.key !== onlyRecord) continue;
  if (e.type !== 'completed-record' && e.type !== 'record-def' && !DOC_TYPES.includes(e.type)) continue;
  const data = readJson(e.jsonPath);
  if (!data) continue;

  let verifiedIds = [];
  const stablePdf = pdfBase(e) + '.pdf';
  const outOf = () => stablePdf;

  if (e.type === 'completed-record') {
    const entries = (data.entries || []).filter((x) => x && x.id);
    const ids = entries.map((x) => x.id);
    verifiedIds = entries.filter((x) => x.status === 'verified' || x.verification).map((x) => x.id);
    const stale = [...new Set([...(e.pdfPaths || []), ...ids.map((id) => pdfBase(e) + '_' + String(id).replace(/[^A-Za-z0-9_-]/g, '') + '.pdf')])].filter((p) => p !== stablePdf);
    for (const p of stale) { try { fs.rmSync(path.join(ARCHIVE, p), { force: true }); } catch {} }
    if ((e.pdfPaths || []).some((p) => p !== stablePdf)) { e.pdfPaths = e.pdfPaths.filter((p) => p === stablePdf); pruned.push(e); }
    if (!verifiedIds.length) continue;
    const live = await liveIds(e.key);
    if (live) {
      const gone = verifiedIds.filter((id) => !live.has(id));
      if (gone.length) {
        skippedDeleted += gone.length;
        verifiedIds = verifiedIds.filter((id) => live.has(id));
        if (!verifiedIds.length) {
          if (!e.sourceDeleted) { deletedNow.push(e); console.log('skipped: entry deleted from the database -- ' + e.htmlPath); }
          continue;
        }
      }
    }
  }

  const done = !force && e.pdfSha && e.pdfSha === (e.sha256 || '') && Array.isArray(e.pdfPaths) && e.pdfPaths.length
    && e.pdfPaths.includes(stablePdf) && e.pdfPaths.every((p) => fs.existsSync(path.join(ARCHIVE, p)));
  if (done) continue;

  if (e.type === 'completed-record') {
    const engine = engineOf(e.key);
    const printId = verifiedIds.filter((x) => !onlyEntry || x === onlyEntry).at(-1);
    if (printId) jobs.push({ entry: e, out: stablePdf,
      url: `${BASE}/pages/print-entry.html?rec=${encodeURIComponent(e.key)}&engine=${engine}&entry=${encodeURIComponent(printId)}&print=1&printonly=1&_t=${jobs.length}`,
      token: String(jobs.length), isRecord: true });
  } else if (e.type === 'record-def') {
    const hasForm = ['sections', 'fields', 'entryFields', 'rosters'].some((k) => Array.isArray(data[k]) && data[k].length) || data.roster;
    if (!hasForm) { emptyTemplates++; continue; }
    const n = String(jobs.length);
    templates.set(n, { key: e.key, def: data });
    jobs.push({ entry: e, out: pdfBase(e) + '.pdf', token: n, isRecord: true,
      url: `${BASE}/pages/print-entry.html?rec=${encodeURIComponent(e.key)}&engine=${engineOfDef(data)}&entry=${TEMPLATE_ENTRY}&print=1&printonly=1&_t=${n}&_tpl=${n}` });
  } else if (data.sourceFile) {
    jobs.push({ entry: e, out: pdfBase(e) + '.pdf', url: `${BASE}/${data.sourceFile.split('/').map(encodeURIComponent).join('/')}` });
  }
  if (new Set(jobs.map((j) => j.entry)).size >= limit) break;
}

if (pruned.length) {
  const fresh = readIndex(ARCHIVE);
  for (const e of pruned) { const item = fresh.find((x) => x.type === e.type && x.key === e.key && x.label === e.label); if (!item) continue; if (e.pdfPaths.length) item.pdfPaths = e.pdfPaths; else { delete item.pdfPaths; delete item.pdfSha; } }
  fs.writeFileSync(path.join(ARCHIVE, 'index.json.tmp'), JSON.stringify(fresh, null, 1));
  fs.renameSync(path.join(ARCHIVE, 'index.json.tmp'), path.join(ARCHIVE, 'index.json'));
  console.log('removed PDFs of unverified entries from ' + pruned.length + ' item(s)');
}
if (deletedNow.length) {
  const fresh = readIndex(ARCHIVE);
  const today = new Date().toISOString().slice(0, 10);
  for (const e of deletedNow) { const item = fresh.find((x) => x.type === e.type && x.key === e.key && x.label === e.label); if (item) item.sourceDeleted = today; }
  fs.writeFileSync(path.join(ARCHIVE, 'index.json.tmp'), JSON.stringify(fresh, null, 1));
  fs.renameSync(path.join(ARCHIVE, 'index.json.tmp'), path.join(ARCHIVE, 'index.json'));
}
if (emptyTemplates) console.log('templates with no fields (nothing to print), no PDF made: ' + emptyTemplates);
if (skippedDeleted) console.log('entries deleted from the database, no PDF made: ' + skippedDeleted);

// Pre-fetch entry data for completed-record jobs so Chrome never waits on Supabase.
{
  const recordKeys = [...new Set(jobs.filter((j) => j.isRecord && j.entry.type === 'completed-record').map((j) => j.entry.key))];
  for (const rk of recordKeys) {
    const entryIds = new Set(jobs.filter((j) => j.entry.key === rk && j.isRecord && j.entry.type === 'completed-record').map((j) => { const m = /[?&]entry=([^&]+)/.exec(j.url); return m ? decodeURIComponent(m[1]) : null; }).filter(Boolean));
    if (!entryIds.size) continue;
    for (const prefix of ['formrecord:', 'monitoring_log:']) {
      const got = await apiGet('/api/storage/key/' + encodeURIComponent(prefix + rk));
      if (!got || !got.value) continue;
      let all; try { all = JSON.parse(got.value); } catch { continue; }
      if (!Array.isArray(all)) continue;
      for (const id of entryIds) {
        const entry = all.find((x) => x && x.id === id);
        if (entry) entryCache.set(prefix + rk + ':' + id, JSON.stringify({ key: prefix + rk, value: JSON.stringify([entry]) }));
      }
    }
  }
  if (entryCache.size) console.log(`pre-loaded ${entryCache.size} entr${entryCache.size === 1 ? 'y' : 'ies'} for fast serving`);
}

console.log(`archive: ${ARCHIVE}\nbrowser: ${path.basename(browser)}   PDFs to make: ${jobs.length}   workers: ${workers}`);

// ---- browser over CDP ------------------------------------------------------------------------------------------------
try { fs.rmSync(WORK, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch {}
const chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--remote-debugging-port=0', '--user-data-dir=' + path.join(WORK, 'profile'), 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res) => {
  let buf = '';
  const t = setTimeout(() => res(null), 30000);
  chrome.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); res(m[1]); } });
  chrome.on('exit', () => { clearTimeout(t); res(null); });
});
const stopAll = () => { try { chrome.kill(); } catch {} stop(); };
process.on('exit', () => { try { chrome.kill(); } catch {} });
if (!wsUrl) { console.error('The browser did not start.'); stopAll(); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('could not connect to the browser')); });
let seq = 0;
const pending = new Map();
const listeners = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result); }
  else if (m.method && m.sessionId && listeners.has(m.sessionId)) listeners.get(m.sessionId)(m.method, m.params);
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

async function printJob(job) {
  const outAbs = path.join(ARCHIVE, job.out);
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  let sessionId = null;
  try {
    ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
    let inflight = 0, lastNet = Date.now(), loaded = false;
    listeners.set(sessionId, (method) => {
      if (method === 'Network.requestWillBeSent') { inflight++; lastNet = Date.now(); }
      else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') { inflight = Math.max(0, inflight - 1); lastNet = Date.now(); }
      else if (method === 'Page.loadEventFired') loaded = true;
    });
    await send('Page.enable', {}, sessionId);
    await send('Network.enable', {}, sessionId);

    // Inject capture script before any page script for record jobs.
    if (job.isRecord) await send('Page.addScriptToEvaluateOnNewDocument', { source: CAPTURE_SRC }, sessionId);
    await send('Page.navigate', { url: job.url }, sessionId);

    const evalJs = async (expr) => {
      const r = await Promise.race([send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId), sleep(20000).then(() => null)]);
      return r && r.result ? r.result.value : undefined;
    };

    // Wait for readiness signal.
    let state = 'timeout', errMsg = '';
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      await sleep(250);
      const quiet = Date.now() - lastNet;
      if (job.isRecord) {
        if (await evalJs('!!window.__archivePdfReady')) { state = 'ready'; break; }
        const fail = await evalJs('window.__archivePdfFail||""');
        if (fail) { state = 'error'; errMsg = String(fail); break; }
        if (loaded && quiet > 1500 && /Print not available yet/.test((await evalJs('document.body ? document.body.innerText.slice(0,400) : ""')) || '')) { state = 'locked'; break; }
      } else if (loaded && quiet > 2000 && (inflight === 0 || quiet > 8000)) { state = 'ready'; break; }
    }

    if (state !== 'ready') {
      const seen = state === 'timeout' ? String((await evalJs('(document.body ? document.body.innerText : "").replace(/\\s+/g," ").slice(0,160)')) || '') : '';
      return { state, size: 0, err: (errMsg || '') + (seen ? ' page: ' + seen : '') };
    }

    // For record jobs: navigate to the captured print sheet and print that clean page.
    if (job.isRecord && job.token) {
      loaded = false; inflight = 0; lastNet = Date.now();
      await send('Page.navigate', { url: `${BASE}/__sheet/${job.token}` }, sessionId);
      const sheetDeadline = Date.now() + 30000;
      while (Date.now() < sheetDeadline) {
        await sleep(100);
        if (loaded && inflight === 0 && Date.now() - lastNet > 500) break;
      }
    }

    // Fonts and images settled.
    await evalJs('Promise.all([document.fonts?document.fonts.ready:0].concat(Array.from(document.images).map(function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r;})}))).then(function(){return 1;})');
    await sleep(300);

    const pdf = await send('Page.printToPDF', { printBackground: false, preferCSSPageSize: true, displayHeaderFooter: false, paperWidth: 8.27, paperHeight: 11.69 }, sessionId);
    const buf = Buffer.from(pdf.data, 'base64');
    if (buf.length < 1500) return { state: 'error', size: 0 };

    for (let i = 0; ; i++) {
      try { fs.mkdirSync(path.dirname(outAbs), { recursive: true }); fs.writeFileSync(outAbs + '.part', buf); fs.renameSync(outAbs + '.part', outAbs); break; }
      catch { if (i >= 5) return { state: 'error', size: 0 }; await sleep(200); }
    }
    return { state: 'ready', size: buf.length };
  } finally {
    if (sessionId) listeners.delete(sessionId);
    await send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

// ---- worker pool ----------------------------------------------------------------------------------------------------
let made = 0, failed = 0, locked = 0, next = 0;
const total = new Map();
for (const j of jobs) total.set(j.entry, (total.get(j.entry) || 0) + 1);
const results = new Map();

function saveProgress() {
  const ready = [...results].filter(([e, r]) => !r.saved && r.done === total.get(e));
  if (!ready.length) return;
  const fresh = readIndex(ARCHIVE);
  for (const [e, r] of ready) {
    r.saved = true;
    const item = fresh.find((x) => x.type === e.type && x.key === e.key && x.label === e.label);
    if (!item) continue;
    if (!r.paths.length) { delete item.pdfPaths; delete item.pdfSha; continue; }
    item.pdfPaths = r.paths.slice().sort();
    if (r.ok) item.pdfSha = item.sha256 || ''; else delete item.pdfSha;
  }
  const file = path.join(ARCHIVE, 'index.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify(fresh, null, 1));
  fs.renameSync(file + '.tmp', file);
}

await Promise.all(Array.from({ length: workers }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    const res = await printJob(job).catch((e) => ({ state: 'error', size: 0, err: e && e.message }));
    const r = results.get(job.entry) || { paths: [], done: 0, ok: true, saved: false };
    r.done++;
    if (res.size) { made++; r.paths.push(job.out); }
    else {
      r.ok = false;
      try { fs.rmSync(path.join(ARCHIVE, job.out), { force: true }); } catch {}
      if (res.state === 'locked') locked++;
      else { failed++; console.warn('FAILED (' + res.state + (res.err ? ': ' + res.err : '') + ') ' + job.out); }
    }
    results.set(job.entry, r);
    if ((made + failed + locked) % 20 === 0) { console.log(`  ${made + failed + locked}/${jobs.length}`); saveProgress(); }
  }
}));
saveProgress();
console.log(`PDFs saved ${made}` + (locked ? `, not printable online yet (print lock) ${locked}` : '') + (failed ? `, FAILED ${failed}` : ''));
await send('Browser.close').catch(() => {});
await sleep(1500);
stopAll();
process.exit(failed ? 1 : 0);
