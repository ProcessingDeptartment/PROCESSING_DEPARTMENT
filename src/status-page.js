// GET / -- the API's status dashboard, so the bare URL shows something useful instead of
// "Cannot GET /". It sits outside the /api auth gate, so it deliberately shows ONLY health,
// performance and aggregate counts: no keys, job numbers, names or record contents.
//
// Performance is counted in memory per UTC hour and flushed to ApiMetricHour every minute, so the
// 24 h chart survives the free tier sleeping/restarting (at most the last minute is lost). The
// latest archive comes from BackupRun, which scripts/backup.js writes -- the API can't see the
// backup folder itself. The dashboard's own requests and /api/health probes are not counted as
// traffic, so the chart shows real use rather than people looking at the chart.
const STARTED = new Date();
const FLUSH_MS = 60 * 1000;

let pending = new Map(); // hour ISO -> { requests, errors, totalMs, maxMs, dbQueries }
let queriesSinceStart = 0;

function hourKey(d = new Date()) {
  const h = new Date(d); h.setUTCMinutes(0, 0, 0); return h.toISOString();
}
function bucket() {
  const k = hourKey();
  if (!pending.has(k)) pending.set(k, { requests: 0, errors: 0, totalMs: 0, maxMs: 0, dbQueries: 0 });
  return pending.get(k);
}

async function flush(prisma) {
  if (!pending.size) return;
  const batch = pending; pending = new Map();
  for (const [hour, b] of batch) {
    try {
      // maxMs can't be a plain increment, so GREATEST() it in SQL; one statement per hour bucket.
      await prisma.$executeRaw`
        INSERT INTO "ApiMetricHour" ("hour","requests","errors","totalMs","maxMs","dbQueries")
        VALUES (${new Date(hour)}, ${b.requests}, ${b.errors}, ${b.totalMs}, ${b.maxMs}, ${b.dbQueries})
        ON CONFLICT ("hour") DO UPDATE SET
          "requests"  = "ApiMetricHour"."requests"  + EXCLUDED."requests",
          "errors"    = "ApiMetricHour"."errors"    + EXCLUDED."errors",
          "totalMs"   = "ApiMetricHour"."totalMs"   + EXCLUDED."totalMs",
          "maxMs"     = GREATEST("ApiMetricHour"."maxMs", EXCLUDED."maxMs"),
          "dbQueries" = "ApiMetricHour"."dbQueries" + EXCLUDED."dbQueries"`;
    } catch (e) {
      console.error('metrics flush failed', e.message.split('\n')[0]);
    }
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ago(d) {
  if (!d) return '—';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
function dur(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
}
const n = x => Number(x).toLocaleString('en-ZA');

// 24 hourly slots ending with the current hour; DB rows plus whatever hasn't been flushed yet.
function series(rows) {
  const byHour = new Map(rows.map(r => [new Date(r.hour).toISOString(), { ...r }]));
  for (const [h, b] of pending) {
    const r = byHour.get(h) || { requests: 0, errors: 0, totalMs: 0, maxMs: 0, dbQueries: 0 };
    byHour.set(h, { requests: r.requests + b.requests, errors: r.errors + b.errors, totalMs: r.totalMs + b.totalMs,
      maxMs: Math.max(r.maxMs, b.maxMs), dbQueries: r.dbQueries + b.dbQueries });
  }
  const now = new Date(hourKey()).getTime();
  const out = [];
  for (let i = 23; i >= 0; i--) {
    const h = new Date(now - i * 3600000);
    const r = byHour.get(h.toISOString()) || { requests: 0, errors: 0, totalMs: 0, maxMs: 0, dbQueries: 0 };
    out.push({ hour: h, ...r, avg: r.requests ? Math.round(r.totalMs / r.requests) : null });
  }
  return out;
}

// Bars = requests per hour, line = average response time. Plain inline SVG, no libraries.
function chart(s) {
  const W = 820, H = 200, L = 44, R = 44, T = 12, B = 26;
  const iw = W - L - R, ih = H - T - B, bw = iw / s.length;
  const maxReq = Math.max(1, ...s.map(x => x.requests));
  const maxAvg = Math.max(1, ...s.map(x => x.avg || 0));
  const bars = s.map((x, i) => {
    const h = (x.requests / maxReq) * ih;
    const hh = String((x.hour.getUTCHours() + 2) % 24).padStart(2, '0'); // SAST
    return `<rect class="bar" x="${(L + i * bw + 2).toFixed(1)}" y="${(T + ih - h).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${hh}:00 · ${n(x.requests)} requests · ${x.avg == null ? 'no traffic' : x.avg + ' ms avg, ' + x.maxMs + ' ms max'} · ${n(x.dbQueries)} queries</title></rect>`
      + (i % 3 === 0 ? `<text class="ax" x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${hh}:00</text>` : '');
  }).join('');
  const pts = s.map((x, i) => x.avg == null ? null : `${(L + i * bw + bw / 2).toFixed(1)},${(T + ih - (x.avg / maxAvg) * ih).toFixed(1)}`);
  const segs = []; let cur = [];
  for (const p of pts) { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } }
  if (cur.length) segs.push(cur);
  const line = segs.map(g => g.length > 1 ? `<polyline class="ln" points="${g.join(' ')}"/>` : `<circle class="dt" cx="${g[0].split(',')[0]}" cy="${g[0].split(',')[1]}" r="3"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Requests and average response time per hour, last 24 hours">
<line class="grid" x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}"/>
<text class="ax" x="${L - 6}" y="${T + 8}" text-anchor="end">${n(maxReq)}</text><text class="ax" x="${L - 6}" y="${T + ih}" text-anchor="end">0</text>
<text class="ax acc" x="${W - R + 6}" y="${T + 8}">${n(maxAvg)} ms</text><text class="ax acc" x="${W - R + 6}" y="${T + ih}">0</text>
${bars}${line}</svg>`;
}

async function gather(prisma) {
  const t0 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbMs = Date.now() - t0;
  const since = new Date(new Date(hourKey()).getTime() - 23 * 3600000);
  const [rows, backup, keys, openJobs, records] = await Promise.all([
    prisma.apiMetricHour.findMany({ where: { hour: { gte: since } } }),
    prisma.backupRun.findFirst({ orderBy: { takenAt: 'desc' } }),
    prisma.keyValue.count(),
    prisma.jobStatus.count({ where: { status: 'open' } }),
    prisma.recordDefinition.count(),
  ]);
  return { dbMs, rows, backup, keys, openJobs, records };
}

function mount(app, prisma, info) {
  // Count every Prisma query (the client is built with log: query events in index.js).
  prisma.$on('query', () => { queriesSinceStart++; bucket().dbQueries++; });

  // Time every request except the dashboard itself and health probes.
  app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/api/health' || req.method === 'OPTIONS') return next();
    const t = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number((process.hrtime.bigint() - t) / 1000000n);
      const b = bucket();
      b.requests++; b.totalMs += ms; if (ms > b.maxMs) b.maxMs = ms;
      if (res.statusCode >= 500) b.errors++;
    });
    next();
  });

  setInterval(() => flush(prisma), FLUSH_MS).unref();
  for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => flush(prisma).finally(() => process.exit(0)));

  app.get('/', async (req, res) => {
    let d = null, dbError = null;
    try { d = await gather(prisma); } catch (e) { dbError = e.message.split('\n')[0]; console.error('status page DB check failed', e); }

    const s = series(d ? d.rows : []);
    const req24 = s.reduce((a, x) => a + x.requests, 0);
    const ms24 = s.reduce((a, x) => a + x.totalMs, 0);
    const err24 = s.reduce((a, x) => a + x.errors, 0);
    const q24 = s.reduce((a, x) => a + x.dbQueries, 0);
    const max24 = Math.max(0, ...s.map(x => x.maxMs));
    const activeHrs = s.filter(x => x.requests).length;
    const bk = d && d.backup;
    const bkAgeH = bk ? (Date.now() - new Date(bk.takenAt).getTime()) / 3600000 : Infinity;
    const bkFresh = bk && bk.ok && bkAgeH < 26;

    const yn = (ok, label, detail, warn) =>
      `<tr><td>${esc(label)}</td><td><span class="yn ${ok ? 'y' : warn ? 'w' : 'n'}">${ok ? 'Y' : 'N'}</span></td><td class="det">${esc(detail)}</td></tr>`;
    const tile = (label, value, sub = '') =>
      `<div class="tile"><div class="lbl">${esc(label)}</div><div class="val">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="60">
<title>Processing Department API</title>
<style>
:root{--bg:#f5f6f4;--card:#fff;--ink:#1d2320;--mute:#66706b;--line:#e1e4e0;--ok:#2e8b57;--bad:#c0392b;--warn:#c98a12;--acc:#1f5f5b;--bar:#9fc5c1}
@media (prefers-color-scheme:dark){:root{--bg:#141816;--card:#1d2320;--ink:#e8ece9;--mute:#9aa49f;--line:#2c3430;--acc:#e0a34a;--bar:#3f6f6b;--ok:#4caf7d;--bad:#e06656}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:880px;margin:0 auto;padding:32px 16px}
h1{font-size:22px;margin:0}header p{margin:4px 0 24px;color:var(--mute)}h2{font-size:15px;margin:0 0 10px}
.banner{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:10px;background:var(--card);border:1px solid var(--line);margin-bottom:16px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
.tile,.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.card{margin-bottom:16px}
.lbl{color:var(--mute);font-size:13px}.val{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}.sub{color:var(--mute);font-size:12px}
table{width:100%;border-collapse:collapse}td{padding:8px 0;border-top:1px solid var(--line)}tr:first-child td{border-top:0}td:nth-child(2){width:48px;text-align:center}
.det{color:var(--mute);font-size:13px;text-align:right}
.yn{display:inline-block;width:26px;height:26px;line-height:26px;border-radius:6px;font-weight:700;color:#fff}.y{background:var(--ok)}.n{background:var(--bad)}.w{background:var(--warn)}
.dot{width:10px;height:10px;border-radius:50%;flex:none}.ok{background:var(--ok)}.bad{background:var(--bad)}
svg{width:100%;height:auto;display:block}.bar{fill:var(--bar)}.ln{fill:none;stroke:var(--acc);stroke-width:2}.dt{fill:var(--acc)}
.grid line,.grid{stroke:var(--line)}.ax{font-size:11px;fill:var(--mute)}.ax.acc{fill:var(--acc)}
.key{display:flex;gap:16px;font-size:12px;color:var(--mute);margin-top:6px}.key i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:12px;font-size:13px}.stats b{display:block;font-size:17px;font-variant-numeric:tabular-nums}
a{color:var(--acc)}footer{color:var(--mute);font-size:12px}
</style></head><body><main>
<header><h1>Processing Department API</h1><p>Storage and traceability backend for the Abagold FSMS record system.</p></header>
<div class="banner"><span class="dot ${dbError ? 'bad' : 'ok'}"></span>${dbError ? 'Degraded: database unreachable' : 'All systems operational'}</div>

<div class="grid">
${tile('Server uptime', dur(Date.now() - STARTED.getTime()), `since ${STARTED.toISOString().slice(0, 16).replace('T', ' ')} UTC`)}
${tile('Queries run (24 h)', n(q24), `${n(queriesSinceStart)} since restart`)}
${tile('Requests (24 h)', n(req24), `${err24} server errors`)}
${tile('Latest archive', bk ? ago(bk.takenAt) : 'none', bk ? `${bk.ok ? 'verified' : 'FAILED'} · ${bk.sizeKb} KB` : 'no backup logged yet')}
</div>

<div class="card"><h2>Status</h2><table>
${yn(true, 'Server up', `v${info.version} · up ${dur(Date.now() - STARTED.getTime())}`)}
${yn(!dbError, 'Database (Neon) reachable', dbError || `responded in ${d.dbMs} ms`)}
${yn(info.authOn, 'Access key required', info.authOn ? 'on every /api request' : 'NOT SET: API is unprotected')}
${yn(info.validateEnforce, 'Write validation enforced', info.validateEnforce ? 'invalid saves rejected (422)' : 'report-only: invalid saves logged, not blocked', true)}
${yn(!!bkFresh, 'Backup in last 24 h', bk ? `${bk.file} · ${new Date(bk.takenAt).toISOString().slice(0, 16).replace('T', ' ')} UTC` : 'no backup logged yet', !!bk)}
</table></div>

<div class="card"><h2>Server performance, last 24 hours</h2>
${chart(s)}
<div class="key"><span><i style="background:var(--bar)"></i>Requests per hour</span><span><i style="background:var(--acc)"></i>Avg response time</span><span>Times SAST · hover a bar for detail</span></div>
<div class="stats">
<div>Avg response<b>${req24 ? Math.round(ms24 / req24) + ' ms' : '—'}</b></div>
<div>Slowest request<b>${max24 ? n(max24) + ' ms' : '—'}</b></div>
<div>Error rate<b>${req24 ? ((err24 / req24) * 100).toFixed(1) + '%' : '—'}</b></div>
<div>Active hours<b>${activeHrs} / 24</b></div>
</div></div>

${d ? `<div class="grid">${tile('Open jobs', n(d.openJobs))}${tile('Record definitions', n(d.records))}${tile('Stored keys', n(d.keys))}</div>` : ''}
${info.siteUrl ? `<p><a href="${esc(info.siteUrl)}">Open the records site →</a></p>` : ''}
<footer>Refreshes every minute · Health probe: <a href="/api/health">/api/health</a> · Free tier sleeps after 15 min idle, so quiet hours are expected · ${esc(new Date().toISOString().replace('T', ' ').slice(0, 16))} UTC</footer>
</main></body></html>`;
    res.type('html').send(html);
  });
}

module.exports = { mount };
