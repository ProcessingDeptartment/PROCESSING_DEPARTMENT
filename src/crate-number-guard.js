// REC 7.4.10 Dried Abalone Transfer: crate numbers are automatic. They run 1, 2, 3 per JOB and continue across
// every transfer entry of that job; the browser never decides them. Every write to formrecord:dried-abalone-transfer
// passes through here on the server:
//   - a draft shows provisional numbers (the client's own guess); drafts carry no job copy on their rows, so they
//     sit outside the database rule UNIQUE (jobNo, crateNumber)
//   - when an entry is submitted, its crates are numbered from the highest crate number already used by the job
//     (submitted entries, voided crates included) + 1, whatever the client sent
//   - a submitted entry is locked: its crate numbers, job copy, old value and void details are put back as stored
//     (a stale device still holding an older copy cannot change them, and cannot drop a submitted crate)
// The caller (src/index.js) runs this inside a transaction holding an advisory lock on the key, so two tablets
// submitting for the same job queue up and cannot get the same numbers.
// Pure functions, no database: the caller passes the stored JSON and the incoming JSON.

const KEY = 'formrecord:dried-abalone-transfer';

// roster keys that belong to the crate once it is submitted
const PROTECTED = ['crateNumber', 'jobNo', 'crateNoOld', 'voided', 'voidReason', 'voidedBy', 'voidedAt'];

const isDraft = (e) => e && e.status === 'draft';
const vals = (e) => (e.values || (e.values = {}));
const job = (e) => String(vals(e).jobNo || '').trim().toUpperCase();
const rosterOf = (e) => (Array.isArray(e.roster) ? e.roster : []);

function reject(status, error) { return { ok: false, status, error }; }

function maxCrate(entries) {
  let max = 0;
  entries.forEach((o) => rosterOf(o).forEach((r) => { const n = parseInt(r && r.crateNumber, 10); if (n > max) max = n; }));
  return max;
}

// prevValue: stored JSON string or null; incomingValue: JSON string the client is writing.
// Returns { ok, value, ranges } where ranges maps each newly submitted entry id to [first, last] crate numbers.
function guardWrite(prevValue, incomingValue) {
  let inc;
  try { inc = JSON.parse(incomingValue); } catch (e) { return { ok: true, value: incomingValue, ranges: {} }; }
  if (!Array.isArray(inc)) return { ok: true, value: incomingValue, ranges: {} };
  let prev = [];
  try { prev = prevValue ? JSON.parse(prevValue) : []; } catch (e) { prev = []; }
  if (!Array.isArray(prev)) prev = [];
  const prevById = new Map(prev.filter((e) => e && e.id).map((e) => [e.id, e]));

  const out = [];
  const seen = new Set();
  const fresh = [];   // entries submitted in this write
  for (const e of inc) {
    if (!e || !e.id) { out.push(e); continue; }
    seen.add(e.id);
    const p = prevById.get(e.id);
    if (p && !isDraft(p)) {
      // locked: crate facts come back as stored; a submitted crate cannot be dropped or added to
      const stored = rosterOf(p);
      const sent = rosterOf(e);
      e.roster = stored.map((sr, i) => {
        const row = Object.assign({}, sent[i] || sr);
        PROTECTED.forEach((k) => { if (sr && k in sr) row[k] = sr[k]; else delete row[k]; });
        return row;
      });
      out.push(e);
    } else {
      out.push(e);
      if (!isDraft(e)) fresh.push(e);
      else rosterOf(e).forEach((r) => { if (r) { r.jobNo = ''; r.crateNoOld = ''; r.voided = ''; r.voidReason = ''; r.voidedBy = ''; r.voidedAt = ''; } });
    }
  }
  // a submitted entry that the client no longer sends (a stale copy of the record) is put back
  for (const p of prev) if (p && p.id && !isDraft(p) && !seen.has(p.id)) out.push(p);

  const ranges = {};
  for (const e of fresh) {
    const j = job(e);
    if (!j) return reject(422, 'Pick the job number before submitting: crate numbers run per job.');
    const earlier = out.filter((o) => o && o !== e && o.id && !isDraft(o) && (!fresh.includes(o) || fresh.indexOf(o) < fresh.indexOf(e)) && job(o) === j);
    let n = maxCrate(earlier);
    const rows = rosterOf(e);
    rows.forEach((r) => {
      if (!r) return;
      r.crateNumber = String(++n);   // whatever the client sent is ignored
      r.jobNo = String(vals(e).jobNo || '').trim();
      r.crateNoOld = ''; r.voided = ''; r.voidReason = ''; r.voidedBy = ''; r.voidedAt = '';
    });
    if (rows.length) ranges[e.id] = [n - rows.length + 1, n];
  }
  return { ok: true, value: JSON.stringify(out), ranges };
}

module.exports = { KEY, guardWrite };
