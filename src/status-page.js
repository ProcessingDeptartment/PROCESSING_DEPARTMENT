// GET / -- a small status dashboard for the API, so the bare URL shows something useful instead
// of "Cannot GET /". It sits outside the /api auth gate, so it deliberately shows ONLY health and
// aggregate counts: no keys, job numbers, names or record contents. Anything more belongs behind
// API_KEY on the site itself.
const STARTED = new Date();

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

async function gatherStats(prisma) {
  const t0 = Date.now();
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [keys, lastWrite, writes24h, records, openJobs, closedJobs, links] = await Promise.all([
    prisma.keyValue.count(),
    prisma.keyValue.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    prisma.keyValueHistory.count({ where: { at: { gte: since } } }),
    prisma.recordDefinition.count(),
    prisma.jobStatus.count({ where: { status: 'open' } }),
    prisma.jobStatus.count({ where: { status: 'closed' } }),
    prisma.recordLink.count(),
  ]);
  return { keys, lastWrite: lastWrite && lastWrite.updatedAt, writes24h, records, openJobs, closedJobs, links, dbMs: Date.now() - t0 };
}

function mount(app, prisma, info) {
  app.get('/', async (req, res) => {
    let stats = null, dbError = null;
    try { stats = await gatherStats(prisma); } catch (e) { dbError = e.message.split('\n')[0]; console.error('status page DB check failed', e); }

    const up = Math.round((Date.now() - STARTED.getTime()) / 60000);
    const tile = (label, value, sub = '') =>
      `<div class="tile"><div class="lbl">${esc(label)}</div><div class="val">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;
    const check = (ok, label, detail) =>
      `<li><span class="dot ${ok ? 'ok' : 'bad'}"></span><b>${esc(label)}</b><span class="det">${esc(detail)}</span></li>`;

    const tiles = stats ? [
      tile('Open jobs', stats.openJobs, `${stats.closedJobs} closed`),
      tile('Record definitions', stats.records, 'loaded in database'),
      tile('Writes (24 h)', stats.writes24h, `last write ${ago(stats.lastWrite)}`),
      tile('Stored keys', stats.keys, `${stats.links} traceability links`),
    ].join('') : '';

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="60">
<title>Processing Department API</title>
<style>
:root{--bg:#f5f6f4;--card:#fff;--ink:#1d2320;--mute:#66706b;--line:#e1e4e0;--ok:#2e8b57;--bad:#c0392b;--acc:#1f5f5b}
@media (prefers-color-scheme:dark){:root{--bg:#141816;--card:#1d2320;--ink:#e8ece9;--mute:#9aa49f;--line:#2c3430;--acc:#6fb7b1}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:880px;margin:0 auto;padding:32px 16px}
h1{font-size:22px;margin:0}header p{margin:4px 0 24px;color:var(--mute)}
.banner{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:10px;background:var(--card);border:1px solid var(--line);margin-bottom:20px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}
.tile,.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.lbl{color:var(--mute);font-size:13px}.val{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}.sub{color:var(--mute);font-size:12px}
.card h2{font-size:15px;margin:0 0 8px}ul{list-style:none;margin:0;padding:0}li{display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}li:first-child{border-top:0}
.det{margin-left:auto;color:var(--mute);font-size:13px;text-align:right}
.dot{width:10px;height:10px;border-radius:50%;flex:none}.ok{background:var(--ok)}.bad{background:var(--bad)}
a{color:var(--acc)}footer{margin-top:20px;color:var(--mute);font-size:12px}
</style></head><body><main>
<header><h1>Processing Department API</h1><p>Storage and traceability backend for the Abagold FSMS record system.</p></header>
<div class="banner"><span class="dot ${dbError ? 'bad' : 'ok'}"></span>${dbError ? 'Degraded: database unreachable' : 'All systems operational'}</div>
${tiles ? `<div class="grid">${tiles}</div>` : ''}
<div class="card"><h2>Checks</h2><ul>
${check(true, 'API server', `up ${up < 60 ? up + ' min' : Math.round(up / 60) + ' h'} · v${info.version}`)}
${check(!dbError, 'Database (Neon)', dbError ? dbError : `responded in ${stats.dbMs} ms`)}
${check(info.authOn, 'Access key', info.authOn ? 'required on /api' : 'NOT SET: API is unprotected')}
${check(true, 'Write validation', info.validateEnforce ? 'enforced' : 'report-only')}
</ul></div>
${info.siteUrl ? `<p style="margin-top:20px"><a href="${esc(info.siteUrl)}">Open the records site →</a></p>` : ''}
<footer>Refreshes every minute · Health probe: <a href="/api/health">/api/health</a> · ${esc(new Date().toISOString().replace('T', ' ').slice(0, 16))} UTC</footer>
</main></body></html>`;
    res.type('html').send(html);
  });
}

module.exports = { mount };
