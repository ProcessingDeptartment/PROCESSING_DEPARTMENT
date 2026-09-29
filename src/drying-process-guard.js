// REC 7.4.1 Drying Process is an entry log per job (see scripts/apply-drying-process-entries.mjs). Some of
// its facts must not be decided by the browser, so every write to formrecord:drying-process passes through
// here first, on the server:
//   - the entry date and each movement's date stamp are the SERVER clock at the moment an entry is submitted
//     (a wrong tablet clock cannot back-date them; drafts carry no stamp)
//   - a submitted entry is locked: its movement answers, stamps and entry date can no longer change
//     (a stale device that still holds an older copy of the record cannot undo or drop them)
//   - a movement can be answered Yes once per job, and only in order (dry room -> container -> grading room)
//   - steam numbers run per job: this entry's steams continue from the highest earlier steam number
//   - steam dates are not in the future and not before the stamped date into the dry room
// Pure functions, no database: the caller passes the stored JSON and the incoming JSON.

const KEY = 'formrecord:drying-process';

const MOVES = [
  { key: 'dryRoom', flag: 'movedIntoDryRoom', stamp: 'dateIntoDryRoomAt', label: 'Move into drying rooms', requires: null },
  { key: 'dryContainer', flag: 'movedIntoDryContainer', stamp: 'dateIntoDryContainerAt', label: 'Move into dry container', requires: 'dryRoom', notAfter: ['gradingRoom'] },
  { key: 'gradingRoom', flag: 'movedIntoGradingRoom', stamp: 'dateIntoGradingRoomAt', label: 'Move into grading room', requires: 'dryRoom', notWithInEntry: ['dryContainer'] },
];
// values that belong to the entry as a whole once submitted
const LOCKED_VALUE_KEYS = ['entryDate', 'stampSource', 'movementReversedBy', 'movementReversedAt', 'movementReversedReason']
  .concat(MOVES.reduce((a, m) => a.concat([m.flag, m.stamp]), []));

const isDraft = (e) => e.status === 'draft';
const vals = (e) => (e.values || (e.values = {}));
const job = (e) => String(vals(e).jobNo || '').trim();
const blank = (v) => v == null || String(v).trim() === '';
// South African calendar day of an instant (UTC+2, no daylight saving)
const sastDay = (d) => new Date(new Date(d).getTime() + 2 * 3600 * 1000).toISOString().slice(0, 10);
const fmtDay = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

function reject(status, error) { return { ok: false, status, error }; }

// prevValue: stored JSON string or null; incomingValue: JSON string the client is writing; now: Date.
function guardWrite(prevValue, incomingValue, now) {
  now = now || new Date();
  let inc;
  try { inc = JSON.parse(incomingValue); } catch (e) { return { ok: true, value: incomingValue }; }
  if (!Array.isArray(inc)) return { ok: true, value: incomingValue };
  let prev = [];
  try { prev = prevValue ? JSON.parse(prevValue) : []; } catch (e) { prev = []; }
  if (!Array.isArray(prev)) prev = [];
  const prevById = new Map(prev.filter((e) => e && e.id).map((e) => [e.id, e]));

  const out = [];
  const seen = new Set();
  const fresh = []; // entries being submitted in this write
  for (const e of inc) {
    if (!e || !e.id) { out.push(e); continue; }
    seen.add(e.id);
    const p = prevById.get(e.id);
    if (p && !isDraft(p)) {
      // locked: put the entry-level facts back as stored, whatever the client sent
      const v = vals(e), pv = vals(p);
      LOCKED_VALUE_KEYS.forEach((k) => { if (k in pv) v[k] = pv[k]; else delete v[k]; });
      out.push(e);
    } else {
      out.push(e);
      if (!isDraft(e)) fresh.push(e);
      else { const v = vals(e); MOVES.forEach((m) => { v[m.stamp] = ''; }); v.entryDate = ''; }
    }
  }
  // a submitted entry that the client no longer sends (a stale copy of the record) is put back
  for (const p of prev) if (p && p.id && !isDraft(p) && !seen.has(p.id)) out.push(p);

  const today = sastDay(now);
  const nowIso = now.toISOString();
  for (const e of fresh) {
    const v = vals(e);
    const j = job(e);
    const others = out.filter((o) => o && o !== e && o.id && !isDraft(o) && !fresh.includes(o) && job(o) === j);
    // entries of this write that were processed before this one count as earlier entries too
    const earlierFresh = fresh.slice(0, fresh.indexOf(e)).filter((o) => job(o) === j);
    const earlier = others.concat(earlierFresh);
    const doneBy = {};
    MOVES.forEach((m) => { doneBy[m.key] = earlier.find((o) => vals(o)[m.flag] === 'Yes'); });

    // movements
    for (const m of MOVES) {
      const answer = v[m.flag];
      if (doneBy[m.key]) {
        if (answer === 'Yes') return reject(409, `"${m.label}" was already answered Yes for job ${j} (${fmtDay(sastDay(vals(doneBy[m.key])[m.stamp] || now))}).`);
        v[m.flag] = ''; v[m.stamp] = '';
        continue;
      }
      if (answer === 'Yes') {
        if (m.requires) {
          const req = MOVES.find((x) => x.key === m.requires);
          if (!doneBy[req.key] && v[req.flag] !== 'Yes') return reject(422, `"${m.label}" needs "${req.label}" first.`);
        }
        // the grading room is the final room: nothing can be moved into another room after it
        for (const k of (m.notAfter || [])) {
          const o = MOVES.find((x) => x.key === k);
          if (doneBy[k] || v[o.flag] === 'Yes') return reject(422, `"${m.label}" is not possible: the job is ${doneBy[k] ? 'already' : 'going'} into the ${o.label.replace('Move into ', '')}, the final room.`);
        }
        for (const k of (m.notWithInEntry || [])) {
          const o = MOVES.find((x) => x.key === k);
          if (v[o.flag] === 'Yes') return reject(422, `"${m.label}" and "${o.label}" cannot both be answered Yes in one entry; log the ${o.label.replace('Move into ', '')} first.`);
        }
        v[m.stamp] = nowIso; v.stampSource = 'system';
      } else {
        v[m.stamp] = '';
      }
    }
    if (!MOVES.some((m) => v[m.flag] === 'Yes')) { if (v.stampSource === 'system') v.stampSource = ''; }
    v.entryDate = nowIso;

    // steams: numbered per job
    let max = 0;
    earlier.forEach((o) => (o.roster || []).forEach((r) => { const n = parseInt(r && r.steamNo, 10); if (n > max) max = n; }));
    const rows = Array.isArray(e.roster) ? e.roster : [];
    max = Math.max(max, 0);
    rows.forEach((r) => { if (r) r.steamNo = String(++max); });   // numbers start at 1, never blank or 0
    v.steamCount = String(rows.length);

    // no steaming once the job is in the grading room (or is being moved into it in this entry)
    if (rows.some((r) => r) && (doneBy.gradingRoom || v[MOVES[2].flag] === 'Yes')) {
      return reject(422, 'No steaming is possible once the job is moved into the grading room.');
    }

    // the trolley count is set ONCE (first entry that has one); every later entry carries it unchanged
    const setCount = earlier.map((o) => parseInt(vals(o).noOfTrolleys, 10)).filter((n) => n > 0)[0];
    if (setCount) v.noOfTrolleys = String(setCount);

    // the trolley count must be set before steaming: this entry's count, or one from an earlier entry
    if (rows.some((r) => r) && !(parseInt(v.noOfTrolleys, 10) > 0) && !earlier.some((o) => parseInt(vals(o).noOfTrolleys, 10) > 0)) {
      return reject(422, 'Enter the No. of trolleys before steaming.');
    }

    // the steam date is never typed: every steam of a newly submitted entry is dated with the server's day
    rows.forEach((r) => { if (r) r.steamDate = today; });

    // steam dates
    const dryStamp = doneBy.dryRoom ? vals(doneBy.dryRoom)[MOVES[0].stamp] : (v[MOVES[0].flag] === 'Yes' ? v[MOVES[0].stamp] : '');
    const dryDay = dryStamp ? sastDay(dryStamp) : '';
    for (const r of rows) {
      if (!r || blank(r.steamDate)) continue;
      const d = String(r.steamDate).slice(0, 10);
      if (d > today) return reject(422, `Steam ${r.steamNo} is dated ${fmtDay(d)}, which is in the future (today is ${fmtDay(today)}).`);
      if (dryDay && d < dryDay) return reject(422, `Steam ${r.steamNo} is dated ${fmtDay(d)}, before the date into the dry room (${fmtDay(dryDay)}).`);
    }
  }
  return { ok: true, value: JSON.stringify(out), changed: fresh.length > 0 };
}

// Admin reversal of a wrongly answered Yes. Returns { ok, value, audit } or { ok:false, status, error }.
// The movement goes back to an open question; it can only be reversed while no later movement is Done.
function reverseMovement(prevValue, { jobNo, movement, reason, name }, now) {
  now = now || new Date();
  const m = MOVES.find((x) => x.key === movement);
  if (!m) return reject(400, 'Unknown movement.');
  if (blank(reason) || blank(name)) return reject(400, 'A reason and your name are required.');
  let entries;
  try { entries = JSON.parse(prevValue || '[]'); } catch (e) { return reject(500, 'Stored record unreadable.'); }
  const j = String(jobNo || '').trim();
  const live = entries.filter((e) => e && !isDraft(e) && job(e) === j);
  const target = live.find((e) => vals(e)[m.flag] === 'Yes');
  if (!target) return reject(404, `No "${m.label}" Yes recorded for job ${j}.`);
  const blocking = MOVES.find((x) => x.requires === m.key && live.some((e) => vals(e)[x.flag] === 'Yes'));
  if (blocking) return reject(409, `"${blocking.label}" is already Done for this job; reverse that one first.`);
  const v = vals(target);
  const audit = { jobNo: j, movement: m.key, entryId: target.id, oldStamp: v[m.stamp] || null, reversedBy: String(name).trim(), reason: String(reason).trim(), at: now.toISOString() };
  v[m.flag] = ''; v[m.stamp] = '';
  v.movementReversedBy = audit.reversedBy; v.movementReversedAt = audit.at; v.movementReversedReason = `${m.label}: ${audit.reason}`;
  return { ok: true, value: JSON.stringify(entries), audit };
}

module.exports = { KEY, MOVES, guardWrite, reverseMovement, sastDay };
