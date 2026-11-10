// Save real PDFs into the PROCESSING ARCHIVE -- the same PDF a user gets when printing online
// (MD/10_Archive-System.md). One local command; nothing else needs to be running:
//
//   node scripts/archive-pdfs.mjs [--type completed-record|policy|procedure|sop|prp] [--record <key>] [--limit N]
//                                 [--force] [--workers N] [--archive-out "<path>"]
//
// For every archived record entry and controlled document it opens the site's OWN print page in headless
// Chrome/Edge and saves what the browser would print:
//   records    -> pages/print-entry.html?rec=..&entry=..&print=1&printonly=1  (the engine's print sheet)
//   documents  -> the policy / procedure / SOP / PRP page itself, with its print stylesheet
// PDFs land in <archive>\pdf\<same path as the page>.pdf and are listed on the item in index.json (pdfPaths).
// Run archive-completed-records.mjs and archive-documents.mjs first: this script works from what they archived.
//
// How it gets the data without the online API: for the duration of the run only, it starts
//   - a private copy of the API code on 127.0.0.1-only traffic, protected by a random one-time key, with the hourly
//     "unverified records" e-mail job switched off (no e-mails are sent), and
//   - a small local web server for public\ that forwards READ requests (GET) to it and refuses everything else,
// so the run cannot change the database. Both are stopped when the script ends. Needs DATABASE_URL.

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
const onlyEntry = opt('--entry');            // one submission id (troubleshooting)
if (opt('--archive-out')) process.env.ARCHIVE_OUT = opt('--archive-out');

const require = createRequire(import.meta.url);
const { archiveRoot, readIndex } = require('./archive-writer.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const ARCHIVE = archiveRoot();
const WORK = path.join(ARCHIVE, '.pdf-work');   // browser profiles for this run; removed at the end

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

// ---- private API copy -------------------------------------------------------------------------------------------------
const apiPort = await freePort();
const apiKey = crypto.randomBytes(24).toString('hex');
const BOOT = "const p=require.resolve('./src/jobs/unverified-alert');"
  + "require.cache[p]={id:p,filename:p,loaded:true,exports:{runUnverifiedAlert:async()=>{}}};"   // no e-mails from this copy
  + "require('./src/index.js');";
const api = spawn(process.execPath, ['-e', BOOT], { cwd: ROOT, env: { ...process.env, PORT: String(apiPort), API_KEY: apiKey }, stdio: ['ignore', 'pipe', 'pipe'] });
let apiLog = '';
api.stdout.on('data', (d) => { apiLog += d; });
api.stderr.on('data', (d) => { apiLog += d; });

// ---- local web server: public\ + read-only /api ---------------------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
let webPort = 0;
const printed = new Set();   // job tokens whose print sheet was actually written
// Observes (does not change) the print: when the engine hands over its finished print sheet, tell this script.
// Without that signal the page is still the record form -- e.g. the site's print lock (REC 7.4.1 / 7.4.2 cannot be
// printed until REC 7.4.10 is done for the job) -- and no PDF must be saved for it.
const WATCH = "<script>(function(){var o;Object.defineProperty(window,'__pdfSameTab',{configurable:true,set:function(f){o=f},get:function(){return o&&function(){var p=o();var c=p.document.close;p.document.close=function(){try{var x=new XMLHttpRequest();x.open('GET','/__printed?t='+encodeURIComponent(new URLSearchParams(location.search).get('_t')||''),false);x.send()}catch(e){}return c.apply(this,arguments)};return p}}})})();</script>";
const web = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (urlPath === '/__printed') {   // the print page reports that the engine really produced its print sheet
    printed.add(new URLSearchParams(req.url.split('?')[1] || '').get('t') || '');
    res.writeHead(204); res.end(); return;
  }
  if (urlPath.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') { res.writeHead(405); res.end('read-only'); return; }
    const up = http.request({ host: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:' + apiPort, authorization: 'Bearer ' + apiKey } },
      (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => { res.writeHead(502); res.end('api unavailable'); });
    up.end();
    return;
  }
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { rel = '/'; }
  const file = path.join(PUBLIC, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    // Point the page's API calls at this server (same switch server.js uses for DEV_API).
    if (ext === '.html') res.end(data.toString().replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n<script>window.FACILITY_API_BASE=${JSON.stringify('http://127.0.0.1:' + webPort)};</script>` + WATCH));
    else res.end(data);
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

// wait for the API copy to answer
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
const engineOf = (recordKey) => {
  const cfg = readJson(path.relative(ARCHIVE, path.join(PUBLIC, 'data', 'record-defs', encodeURIComponent(recordKey) + '.json'))) || {};
  return /ml/i.test(String(cfg.mount || '')) || cfg.entryFields ? 'log' : 'form';
};
const pdfBase = (e) => 'pdf/' + e.htmlPath.replace(/\.html$/, '');

const pruned = [];   // index items that had PDFs of unverified entries removed
const jobs = [];   // { entry (index item), url, out (relative pdf path) }
for (const e of index) {
  if (onlyType && e.type !== onlyType) continue;
  if (onlyRecord && e.key !== onlyRecord) continue;
  if (e.type !== 'completed-record' && !DOC_TYPES.includes(e.type)) continue;
  const data = readJson(e.jsonPath);
  if (!data) continue;
  // Records: ONLY verified entries get a PDF. An entry that is submitted but not yet verified has none, and any PDF
  // that exists for one is removed. It is made on a later run, once the entry has been verified.
  let ids = [], verifiedIds = [];
  const outOf = (id) => pdfBase(e) + (ids.length > 1 ? '_' + String(id).replace(/[^A-Za-z0-9_-]/g, '') : '') + '.pdf';
  if (e.type === 'completed-record') {
    const entries = (data.entries || []).filter((x) => x && x.id);
    ids = entries.map((x) => x.id);
    verifiedIds = entries.filter((x) => x.status === 'verified' || x.verification).map((x) => x.id);
    const allowed = new Set(verifiedIds.map(outOf));
    const stale = [...new Set([...(e.pdfPaths || []), ...ids.map(outOf)])].filter((p) => !allowed.has(p));
    for (const p of stale) { try { fs.rmSync(path.join(ARCHIVE, p), { force: true }); } catch {} }
    if ((e.pdfPaths || []).some((p) => !allowed.has(p))) {
      e.pdfPaths = e.pdfPaths.filter((p) => allowed.has(p));
      pruned.push(e);
    }
    if (!verifiedIds.length) continue;
  }
  const done = !force && e.pdfSha && e.pdfSha === (e.sha256 || '') && Array.isArray(e.pdfPaths) && e.pdfPaths.length
    && (e.type !== 'completed-record' || verifiedIds.every((id) => e.pdfPaths.includes(outOf(id))))
    && e.pdfPaths.every((p) => fs.existsSync(path.join(ARCHIVE, p)));
  if (done) continue;
  if (e.type === 'completed-record') {
    const engine = engineOf(e.key);
    for (const id of verifiedIds.filter((x) => !onlyEntry || x === onlyEntry)) jobs.push({ entry: e, out: pdfBase(e) + (ids.length > 1 ? '_' + String(id).replace(/[^A-Za-z0-9_-]/g, '') : '') + '.pdf',
      url: `${BASE}/pages/print-entry.html?rec=${encodeURIComponent(e.key)}&engine=${engine}&entry=${encodeURIComponent(id)}&print=1&printonly=1&_t=${jobs.length}`, token: String(jobs.length) });
  } else if (data.sourceFile) {
    jobs.push({ entry: e, out: pdfBase(e) + '.pdf', url: `${BASE}/${data.sourceFile.split('/').map(encodeURIComponent).join('/')}` });
  }
  if (new Set(jobs.map((j) => j.entry)).size >= limit) break;
}
if (pruned.length) {
  const fresh = readIndex(ARCHIVE);
  for (const e of pruned) {
    const item = fresh.find((x) => x.type === e.type && x.key === e.key && x.label === e.label);
    if (!item) continue;
    if (e.pdfPaths.length) item.pdfPaths = e.pdfPaths; else { delete item.pdfPaths; delete item.pdfSha; }
  }
  fs.writeFileSync(path.join(ARCHIVE, 'index.json.tmp'), JSON.stringify(fresh, null, 1));
  fs.renameSync(path.join(ARCHIVE, 'index.json.tmp'), path.join(ARCHIVE, 'index.json'));
  console.log('removed PDFs of unverified entries from ' + pruned.length + ' item(s)');
}
console.log(`archive: ${ARCHIVE}\nbrowser: ${path.basename(browser)}   PDFs to make: ${jobs.length}   workers: ${workers}`);

// ---- browser, driven over the DevTools protocol ----------------------------------------------------------------------
// One headless browser for the whole run, one tab per PDF. Each PDF is saved only when the page is really finished:
//   records    -> the engine has handed over its print sheet (the /__printed signal) and its images have loaded
//   documents  -> the page has loaded and gone quiet (no more requests)
// A fixed wait is not used: an entry with photos can take a while, and saving early gives a page with only the header.
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
const pending = new Map();     // command id -> { res, rej }
const listeners = new Map();   // tab session -> (method, params) => void
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result); }
  else if (m.method && m.sessionId && listeners.has(m.sessionId)) listeners.get(m.sessionId)(m.method, m.params);
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

// Returns { state: 'ready' | 'locked' | 'timeout' | 'error', size }.
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
    await send('Page.navigate', { url: job.url }, sessionId);
    const evalJs = async (expression) => {
      const r = await Promise.race([send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId), sleep(20000).then(() => null)]);
      return r && r.result ? r.result.value : undefined;
    };

    let state = 'timeout';
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      await sleep(250);
      const quiet = Date.now() - lastNet;
      if (job.token) {
        if (printed.has(job.token)) { state = 'ready'; break; }
        // The site's own "cannot print yet" page (print lock on REC 7.4.1 / 7.4.2 until REC 7.4.10 is done for the job).
        if (loaded && quiet > 1500 && /Print not available yet/.test((await evalJs('document.body ? document.body.innerText.slice(0, 400) : ""')) || '')) { state = 'locked'; break; }
      } else if (loaded && quiet > 2000 && (inflight === 0 || quiet > 8000)) { state = 'ready'; break; }
    }
    if (state !== 'ready') return { state, size: 0 };

    // let the finished page settle: fonts and every image (photos, logo) loaded
    await evalJs('Promise.all([document.fonts ? document.fonts.ready : 0].concat(Array.from(document.images).map(function (i) { return i.complete ? 0 : new Promise(function (r) { i.onload = i.onerror = r; }); }))).then(function () { return 1; })');
    await sleep(300);
    // Same as the browser's print dialog with its defaults: A4, no browser header/footer, "Background graphics" off
    // (the print sheets mark their own shading to print regardless), page size / margins from the page's own @page rule.
    const pdf = await send('Page.printToPDF', { printBackground: false, preferCSSPageSize: true, displayHeaderFooter: false, paperWidth: 8.27, paperHeight: 11.69 }, sessionId);
    const buf = Buffer.from(pdf.data, 'base64');
    if (buf.length < 1500) return { state: 'error', size: 0 };
    // Two workers creating the same folder at once can collide on a network drive: retry instead of failing the run.
    for (let i = 0; ; i++) {
      try { fs.mkdirSync(path.dirname(outAbs), { recursive: true }); fs.writeFileSync(outAbs + '.part', buf); fs.renameSync(outAbs + '.part', outAbs); break; }
      catch (e) { if (i >= 5) return { state: 'error', size: 0 }; await sleep(200); }
    }
    return { state: 'ready', size: buf.length };
  } finally {
    if (sessionId) listeners.delete(sessionId);
    await send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

let made = 0, failed = 0, locked = 0, next = 0;
const total = new Map();     // index item -> number of PDFs it needs
for (const j of jobs) total.set(j.entry, (total.get(j.entry) || 0) + 1);
const results = new Map();   // index item -> { paths: [], done: n, ok: bool, saved: bool }

// Record finished items on index.json. Called every so often and at the end, so an interrupted run keeps its progress
// and the next run only makes what is still missing.
function saveProgress() {
  const ready = [...results].filter(([e, r]) => !r.saved && r.done === total.get(e));
  if (!ready.length) return;
  const fresh = readIndex(ARCHIVE);   // re-read: another script may have run meanwhile
  for (const [e, r] of ready) {
    r.saved = true;
    const item = fresh.find((x) => x.type === e.type && x.key === e.key && x.label === e.label);
    if (!item) continue;
    if (!r.paths.length) { delete item.pdfPaths; delete item.pdfSha; continue; }
    item.pdfPaths = r.paths.slice().sort();
    if (r.ok) item.pdfSha = item.sha256 || ''; else delete item.pdfSha;   // incomplete -> retried next run
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
      try { fs.rmSync(path.join(ARCHIVE, job.out), { force: true }); } catch {}   // never leave a stale or partial PDF behind
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
await sleep(1500);   // let the browser let go of its profile folder before it is removed
stopAll();
process.exit(failed ? 1 : 0);
