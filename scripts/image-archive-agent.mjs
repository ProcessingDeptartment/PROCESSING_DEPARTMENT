#!/usr/bin/env node
// Local archive agent for REC 7.4.2 photos. Runs on the factory file server (Node 18+, no npm deps).
// Polls the API for photos not yet archived, writes each to ARCHIVE_ROOT\YYYY\MM\, then marks it
// archived. It always asks for everything still unarchived, so after downtime it simply catches up.
//
// Config: scripts/.env (beside this file, git-ignored) or real environment variables:
//   API_BASE=https://processing-department-api.onrender.com
//   ARCHIVE_API_KEY=<same value as ARCHIVE_API_KEY on the Render API service>
//   ARCHIVE_ROOT=T:\Abagold Processing Facility\20. Paperless\PROCESSING_DEPARTMENT\Images
//   POLL_INTERVAL_SECONDS=60
//
// Run:      node scripts/image-archive-agent.mjs
// One pass: node scripts/image-archive-agent.mjs --once
// Service:  pm2 start scripts/image-archive-agent.mjs --name image-archive && pm2 save
//           (or a Task Scheduler task "At startup" running the Run line above)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnv(path.join(HERE, '.env'));

const API_BASE = (process.env.API_BASE || 'https://processing-department-api.onrender.com').replace(/\/+$/, '');
const KEY = process.env.ARCHIVE_API_KEY || '';
const ROOT = process.env.ARCHIVE_ROOT || '';
const POLL_MS = Math.max(10, Number(process.env.POLL_INTERVAL_SECONDS) || 60) * 1000;
const ONCE = process.argv.includes('--once');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

function log(msg) {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  console.log(`[${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}] ${msg}`);
}

async function api(method, p, body) {
  const r = await fetch(API_BASE + p, {
    method,
    headers: { 'X-Archive-Key': KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000), // Render cold starts can take a while
  });
  if (!r.ok) throw new Error(`${method} ${p} -> HTTP ${r.status}`);
  return r.json();
}

// DM_<submissionId>_<fieldKey>_<YYYYMMDD>_<imageId>.<ext>, filed under <ROOT>\<YYYY>\<MM>
function targetPath(img) {
  const d = new Date(img.uploadedAt);
  const y = String(d.getFullYear()), mo = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  const mime = String(img.mimeType || (img.imageData.match(/^data:([^;]+);/) || [])[1] || 'image/jpeg').toLowerCase();
  const safe = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '');
  const name = `DM_${safe(img.submissionId)}_${safe(img.fieldKey)}_${y}${mo}${day}_${img.id}.${EXT[mime] || 'jpg'}`;
  return path.join(ROOT, y, mo, name);
}

async function archiveOne(img) {
  const file = targetPath(img);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) {
      const b64 = img.imageData.slice(img.imageData.indexOf(',') + 1);
      const tmp = file + '.part';
      fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
      fs.renameSync(tmp, file);
    }
    await api('POST', `/api/dry-monitoring/images/${img.id}/mark-archived`, { archivedPath: file });
    log(`Archived image ${img.id} → ${file}`);
    return true;
  } catch (e) {
    log(`FAILED image ${img.id}: ${e.message}`);
    try {
      const r = await api('POST', `/api/dry-monitoring/images/${img.id}/archive-error`, { error: e.message });
      if (r.failed) log(`Image ${img.id} gave up after ${r.attempts} attempts (archive_failed set)`);
    } catch (e2) { log(`  could not report the failure: ${e2.message}`); }
    return false;
  }
}

async function pass() {
  let total = 0;
  for (;;) {
    const batch = await api('GET', '/api/dry-monitoring/images/pending-archive');
    if (!batch.length) break;
    let okCount = 0;
    for (const img of batch) if (await archiveOne(img)) okCount++;
    total += okCount;
    if (!okCount) break; // everything in this batch failed: wait for the next poll
  }
  return total;
}

async function main() {
  if (!KEY || !ROOT) { console.error('ARCHIVE_API_KEY and ARCHIVE_ROOT must be set (scripts/.env).'); process.exit(1); }
  log(`Image archive agent started: ${API_BASE} → ${ROOT}, every ${POLL_MS / 1000}s`);
  for (;;) {
    try { const n = await pass(); if (n) log(`Pass done: ${n} archived`); }
    catch (e) { log(`Poll failed: ${e.message}`); }
    if (ONCE) return;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
