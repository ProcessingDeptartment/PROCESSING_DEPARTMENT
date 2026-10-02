// REC 7.4.6 Dry Stock Control is one stock record per job that grows over several submissions (spec:
// claude/rec-7.4.6-dry-stock-control-merge-job-info-instructions.md, section 4). Every write to
// monitoring_log:dry-stock-control passes through here first, on the server, because some facts must
// not be decided by the browser:
//   - a submitted entry is an immutable STAGE: whatever a stale or edited client sends, the stored copy wins
//     (only the verification stamp may be added later)
//   - stage_no, previous stage, status, submitted by/at are set here, per job, in order
//   - signoff_required is computed here from the saved values (any trigger field has a value; 0 counts),
//     never trusted from the browser, and when it is true both sign-offs must be complete or the write is refused
//   - a Complete job takes no further stages
// The trigger list and completion fields live in the record definition (signOffTrigger / completionFields);
// the defaults below only apply if a definition is missing them. Pure functions, no database.

const KEY = 'monitoring_log:dry-stock-control';

const DEFAULT_TRIGGER = ['weightIn', 'countInFactory', 'countInFinance', 'weightOut', 'countOutFactory', 'countOutFinance'];
const DEFAULT_COMPLETION = ['weightIn', 'dateIn', 'countInFactory', 'countInFinance', 'weightOut', 'dateOut', 'countOutFactory', 'countOutFinance'];

const isDraft = (e) => e && e.status === 'draft';
const vals = (e) => (e.values || (e.values = {}));
const job = (e) => String(vals(e).jobNo || '').trim().toUpperCase();
const has = (v) => v != null && String(v).trim() !== '';   // 0 is a value, '' is not

function config(cfg) {
  cfg = cfg || {};
  return {
    trigger: Array.isArray(cfg.signOffTrigger) && cfg.signOffTrigger.length ? cfg.signOffTrigger : DEFAULT_TRIGGER,
    completion: Array.isArray(cfg.completionFields) && cfg.completionFields.length ? cfg.completionFields : DEFAULT_COMPLETION,
  };
}

// rule `anyHasValue`: the sign-off rules apply as soon as one trigger field holds a value
function signoffRequired(values, cfg) {
  return config(cfg).trigger.some((k) => has((values || {})[k]));
}
function filledCount(values, cfg) { return config(cfg).completion.filter((k) => has((values || {})[k])).length; }
function completionStatus(values, cfg) {
  const c = config(cfg).completion;
  return c.every((k) => has((values || {})[k])) ? 'complete' : 'in_progress';
}

const blockComplete = (b) => !!(b && typeof b === 'object' && has(b.by) && has(b.title) && has(b.date) && has(b.signature));
const missingBlocks = (e) => {
  const m = [];
  if (!blockComplete(e.completedBy)) m.push('Completed by');
  if (!blockComplete(e.financeRep)) m.push('Finance representative');
  return m;
};

function reject(status, error) { return { ok: false, status, error }; }

// prevValue: stored JSON string or null; incomingValue: JSON string the client is writing;
// opts: { now: Date, user: string, cfg: the record's definition config (signOffTrigger, completionFields) }
function guardWrite(prevValue, incomingValue, opts) {
  opts = opts || {};
  const now = opts.now || new Date();
  const cfg = opts.cfg || {};
  let inc;
  try { inc = JSON.parse(incomingValue); } catch (e) { return { ok: true, value: incomingValue }; }
  if (!Array.isArray(inc)) return { ok: true, value: incomingValue };
  let prev = [];
  try { prev = prevValue ? JSON.parse(prevValue) : []; } catch (e) { prev = []; }
  if (!Array.isArray(prev)) prev = [];
  const prevById = new Map(prev.filter((e) => e && e.id).map((e) => [e.id, e]));

  const out = [];
  const seen = new Set();
  const fresh = [];
  for (const e of inc) {
    if (!e || !e.id) { out.push(e); continue; }
    seen.add(e.id);
    const p = prevById.get(e.id);
    if (p && !isDraft(p)) {
      // an immutable stage: stored copy wins; a verification stamp is the one thing that may be added
      const keep = Object.assign({}, p);
      if (e.verification && !p.verification) keep.verification = e.verification;
      out.push(keep);
    } else if (!isDraft(e)) { out.push(e); fresh.push(e); }
    else out.push(e);
  }
  // a submitted stage the client no longer sends (a stale copy of the record) is put back
  for (const p of prev) if (p && p.id && !isDraft(p) && !seen.has(p.id)) out.push(p);

  const stageNoOf = (e) => (e.stage && Number(e.stage.no)) || 0;
  for (const e of fresh) {
    const j = job(e);
    if (!j) return reject(422, 'Job no. is required to submit.');
    const earlier = out.filter((o) => o && o !== e && o.id && !isDraft(o) && !fresh.includes(o) && job(o) === j)
      .concat(fresh.slice(0, fresh.indexOf(e)).filter((o) => job(o) === j));
    // legacy rows without a stage number are numbered by submit date, oldest first
    const ordered = earlier.slice().sort((a, b) => (stageNoOf(a) - stageNoOf(b)) || ((a.submittedAt || a.createdAt || 0) - (b.submittedAt || b.createdAt || 0)));
    const last = ordered[ordered.length - 1];
    if (last && last.stage && last.stage.status === 'complete') {
      return reject(409, `Job ${vals(e).jobNo} is already Complete (stage ${last.stage.no}). Ask an administrator to reopen it.`);
    }
    const required = signoffRequired(vals(e), cfg);
    if (required) {
      const m = missingBlocks(e);
      if (m.length) return reject(422, `A weight or count is filled in: ${m.join(' and ')} (name, title, date and signature) ${m.length > 1 ? 'are' : 'is'} required to submit.`);
    }
    const no = earlier.reduce((mx, o, i) => Math.max(mx, stageNoOf(o) || (i + 1)), 0) + 1;
    e.stage = {
      no,
      previousId: last ? last.id : null,
      status: completionStatus(vals(e), cfg),
      signoffRequired: required,
      fieldsFilled: filledCount(vals(e), cfg),
      submittedBy: String(opts.user || (e.completedBy && e.completedBy.by) || '').trim() || null,
      submittedAt: now.toISOString(),
    };
    e.submittedAt = now.getTime();
    e.status = 'submitted';
    delete e.previousSubmissionId;
  }
  // drafts carry no server facts
  for (const e of out) if (e && isDraft(e)) delete e.stage;
  return { ok: true, value: JSON.stringify(out), changed: fresh.length > 0 };
}

// Backfill for the table projection (never written back to the stored record): every submitted entry that
// predates stages becomes stage n of its job, numbered by submit date, with status / signoff_required worked out
// by the same rules "for information only" (old rows have no finance sign-off and must never block anything).
function fillLegacyStages(entries, cfg) {
  const byJob = new Map();
  for (const e of entries) {
    if (!e || !e.id || isDraft(e) || e.stage) continue;
    const j = job(e);
    if (!byJob.has(j)) byJob.set(j, []);
    byJob.get(j).push(e);
  }
  const staged = (j) => entries.filter((e) => e && e.id && !isDraft(e) && e.stage && job(e) === j);
  for (const [j, list] of byJob) {
    list.sort((a, b) => ((a.submittedAt || a.createdAt || 0) - (b.submittedAt || b.createdAt || 0)));
    let no = staged(j).reduce((mx, e) => Math.max(mx, Number(e.stage.no) || 0), 0);
    let prevId = null;
    for (const e of list) {
      no += 1;
      e.stage = { no, previousId: prevId, status: completionStatus(vals(e), cfg), signoffRequired: signoffRequired(vals(e), cfg),
        fieldsFilled: filledCount(vals(e), cfg), submittedBy: null,
        submittedAt: e.submittedAt ? new Date(e.submittedAt).toISOString() : null, legacy: true };
      prevId = e.id;
    }
  }
  return entries;
}

module.exports = { KEY, guardWrite, fillLegacyStages, signoffRequired, completionStatus, filledCount, DEFAULT_TRIGGER, DEFAULT_COMPLETION };
