// Offline test of the per-entry save in form-record.js and monitoring-log.js: pulls the real persist() text out of each
// file and runs it against a scripted fake server (200 / 500 / network error / 422 refusal / 404 / offline / id-less entry).
// Writes nothing anywhere.   node scripts/test-persist-fallback.cjs
const fs = require('fs');
function extract(file, listName) {
  const s = fs.readFileSync(file, 'utf8');
  const a = s.indexOf('const synced = new Map();');
  const b = s.indexOf('return ok;', s.indexOf('async function persist()', a));
  const end = s.indexOf('}', b) + 1;
  return s.slice(a, end);
}
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); };
async function run(file, listName, key, getKeyExpr) {
  console.log('==', file);
  const body = extract(file, listName);
  const mk = (list, opts = {}) => {
    const calls = { puts: [], blob: [], storeGets: 0 };
    const win = { FacilityApi: { lastReject: null, fetch: async (url, o) => {
      if (o && o.method === 'PUT') { calls.puts.push(url); const r = opts.respond ? opts.respond(url, calls.puts.length) : { ok: true, status: 200 }; if (r === 'throw') throw new Error('net'); return Object.assign({ json: async () => r.body || {} }, r); }
      return { ok: true, status: 200, json: async () => ({ value: JSON.stringify(list) }) };
    } } };
    const nav = { onLine: opts.online !== false };
    const factory = new Function('window', 'navigator', 'list', 'storeSet', 'storeGet', 'config', 'storageKey', 'encodeURIComponent',
      `let ${listName} = list; ${body}; return { persist, load, markSynced, set: (l) => { ${listName} = l; }, get: () => ${listName}, isBlobOnly: () => blobOnly };`);
    const api = factory(win, nav, list, async (k, v) => { calls.blob.push(JSON.parse(v).length); return opts.storeOk !== false; }, async () => { calls.storeGets++; return JSON.stringify(list); }, { recordKey: 'rec-x' }, key, encodeURIComponent);
    api.markSynced();
    return { api, calls, win };
  };
  const E = (id, v) => ({ id, values: { v: v || 0 } });
  let t;
  t = mk([E('a'), E('b')]); ok(await t.api.persist() === true && !t.calls.puts.length && !t.calls.blob.length, '1 no change: no calls');
  t = mk([E('a'), E('b')]); t.api.get()[0].values.v = 9; ok(await t.api.persist() === true && t.calls.puts.length === 1 && !t.calls.blob.length, '2 one changed: one PUT, no blob');
  ok(t.calls.puts[0].includes('/api/submissions/rec-x/a'), '2b url'); await t.api.persist(); ok(t.calls.puts.length === 1, '2c second persist: nothing resent');
  t = mk([E('a'), E('b')], { respond: () => ({ ok: false, status: 500 }) }); t.api.get()[0].values.v = 9;
  ok(await t.api.persist() === true && t.calls.blob.length === 1 && t.calls.blob[0] === 2 && t.api.isBlobOnly(), '3 500: falls back to whole list (2 entries)');
  t.api.get()[1].values.v = 5; await t.api.persist(); ok(t.calls.puts.length === 1 && t.calls.blob.length === 2, '3b stays blob-only afterwards');
  t = mk([E('a')], { respond: () => 'throw' }); t.api.get()[0].values.v = 9; ok(await t.api.persist() === true && t.calls.blob.length === 1, '4 network throw: falls back');
  t = mk([E('a')], { respond: () => ({ ok: false, status: 422, body: { error: 'Steam 2 already exists' } }) }); t.api.get()[0].values.v = 9;
  ok(await t.api.persist() === false && !t.calls.blob.length && t.win.FacilityApi.lastReject === 'Steam 2 already exists', '5 422 refusal: false, message kept, NO fallback write');
  t = mk([E('a')], { respond: () => ({ ok: false, status: 404 }) }); t.api.get()[0].values.v = 9; ok(await t.api.persist() === true && t.calls.blob.length === 1, '6 404 (older API): falls back');
  t = mk([E('a')], { online: false }); t.api.get()[0].values.v = 9; ok(await t.api.persist() === true && !t.calls.puts.length && t.calls.blob.length === 1, '7 offline: straight to whole-list write (queues)');
  t = mk([E('a'), { values: { v: 1 } }]); t.api.get()[0].values.v = 9; ok(await t.api.persist() === true && !t.calls.puts.length && t.calls.blob.length === 1, '8 entry without id: whole-list write');
  t = mk([E('a'), E('b')], { respond: (u, n) => n === 1 ? { ok: true, status: 200 } : { ok: false, status: 500 } }); t.api.get()[0].values.v = 9; t.api.get()[1].values.v = 9;
  ok(await t.api.persist() === true && t.calls.puts.length === 2 && t.calls.blob.length === 1 && t.calls.blob[0] === 2, '9 2nd of 2 fails: whole list sent, nothing lost');
  t = mk([E('a')], { respond: () => ({ ok: false, status: 401 }) }); t.api.get()[0].values.v = 9; ok(await t.api.persist() === true && t.calls.blob.length === 1, '10 401: falls back (blob path handles auth/queue)');
  t = mk([E('a')], { storeOk: false, respond: () => 'throw' }); t.api.get()[0].values.v = 9; ok(await t.api.persist() === false, '11 fallback write also fails: reports failure');
  t = mk([E('a')]); t.api.get().push(E('new')); ok(await t.api.persist() === true && t.calls.puts.length === 1 && t.calls.puts[0].endsWith('/new'), '12 new entry: PUT by its id');
}
(async () => {
  await run('public/lib/form-record.js', 'submissions', 'formrecord:rec-x');
  await run('public/lib/monitoring-log.js', 'entries', 'monitoring_log:rec-x');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
