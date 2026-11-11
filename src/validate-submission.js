// Server-side validation for record submissions (Layer 2 of the relational plan -- the "PUT
// validates payload vs definition" piece). Additive and, by default, REPORT-ONLY: it returns a
// list of violations for the API to log/return as warnings but does NOT block the write. Set
// VALIDATE_WRITES=enforce to make a submitted entry with violations return 422 instead.
//
// Why report-only first: the client (public/lib/api-backend.js) treats any non-2xx PUT as a
// transient failure and retries it forever from an offline queue. Flipping straight to hard
// reject would turn a genuinely-invalid record into an infinite retry loop on the tablet. We
// watch the warnings in the API logs for a while, fix the real offenders, then enforce.
//
// Scope: only 'formrecord:<key>' and 'monitoring_log:<key>' values, which are JSON arrays of
// entries. Only entries that are actually submitted are checked -- drafts are allowed to be
// incomplete, matching the client, which only enforces required fields on finalize.

const { assembleRecordConfig } = require('./record-def');
const compute = require('./compute-registry');

const ENFORCE = (process.env.VALIDATE_WRITES || '').toLowerCase() === 'enforce';

const PREFIXES = { 'formrecord:': 'form-record', 'monitoring_log:': 'monitoring-log' };

function prefixOf(key) {
  for (const p of Object.keys(PREFIXES)) if (key.startsWith(p)) return p;
  return null;
}

function isSubmitted(entry) {
  return entry && (entry.status === 'submitted' || !!entry.submittedAt);
}

function isBlank(v) {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

// Every field the engine would render for this record, flattened to {key,label,type,required,
// options,validate,computeFn,computeArgs}. Roster columns are returned separately.
function flattenFields(config) {
  const out = [];
  const push = (arr) => { if (Array.isArray(arr)) out.push(...arr); };
  push(config.fields);
  push(config.entryFields);
  for (const s of config.sections || []) push(s.fields);
  return out;
}

// Roster column showWhen (same rules as the client's rowCond): a column the row's process does not
// use (e.g. blanching fields on a Cooking slide) is not "required but empty".
function colVisible(f, values) {
  const w = f.showWhen;
  if (!w) return true;
  const own = values ? values[f.key] : undefined;
  if (w.nonEmpty) return !isBlank(own);
  if (w.orNonEmpty && !isBlank(own)) return true;
  const cur = values && values[w.field] != null ? String(values[w.field]) : '';
  return (w.in || []).includes(cur);
}

function checkValueSet(fields, values, rowLabel, violations) {
  for (const f of fields) {
    if (!f || !f.key) continue;
    const v = values ? values[f.key] : undefined;

    if (f.required && isBlank(v) && colVisible(f, values)) {
      violations.push(`${rowLabel}: "${f.label || f.key}" is required but empty`);
      continue;
    }
    if (isBlank(v)) continue;

    if (Array.isArray(f.options) && f.options.length && !f.options.includes(String(v))) {
      violations.push(`${rowLabel}: "${f.label || f.key}" = ${JSON.stringify(v)} is not one of the allowed options`);
    }

    if ((f.type === 'number' || f.type === 'integer') && isNaN(parseFloat(v))) {
      violations.push(`${rowLabel}: "${f.label || f.key}" = ${JSON.stringify(v)} is not a number`);
    }

    const rules = f.validate && typeof f.validate === 'object' ? f.validate : null;
    if (rules) {
      const n = parseFloat(v);
      if (rules.min != null && !isNaN(n) && n < rules.min) {
        violations.push(`${rowLabel}: "${f.label || f.key}" = ${n} is below minimum ${rules.min}`);
      }
      if (rules.max != null && !isNaN(n) && n > rules.max) {
        violations.push(`${rowLabel}: "${f.label || f.key}" = ${n} is above maximum ${rules.max}`);
      }
      if (rules.pattern) {
        try {
          if (!new RegExp(rules.pattern).test(String(v))) {
            violations.push(`${rowLabel}: "${f.label || f.key}" = ${JSON.stringify(v)} does not match the required format`);
          }
        } catch (_) { /* a bad pattern in the definition is not the submitter's problem */ }
      }
    }

    // Recompute derived fields and flag a mismatch. We report only (never silently overwrite):
    // the definition may name a formula the client resolved with extra context the server lacks.
    if (f.computeFn && compute.has(f.computeFn)) {
      const expected = compute.run(f.computeFn, f.computeArgs || {}, values || {});
      if (!isBlank(expected) && String(expected) !== String(v)) {
        violations.push(`${rowLabel}: "${f.label || f.key}" = ${JSON.stringify(v)} but ${f.computeFn}(...) gives ${JSON.stringify(String(expected))}`);
      }
    }
  }
}

// prisma: PrismaClient (for the definition lookup). key/value: the write being attempted.
// Returns { ok, status, violations } -- status 200 (allow) or 422 (block, only when ENFORCE).
const defCache = new Map();
// the record definition is ~5 queries to assemble and changes only when an admin edits it: reuse it for 60 s
async function definitionFor(prisma, recordKey) {
  const hit = defCache.get(recordKey);
  if (hit && Date.now() - hit.at < 60000) return hit.assembled;
  const assembled = await assembleRecordConfig(prisma, recordKey);
  defCache.set(recordKey, { at: Date.now(), assembled });
  return assembled;
}

// requiredWhen { field, equals } (+ requiredMessage): a field that must be filled while another answer holds,
// e.g. REC 7.4.2's comment when "> 5%" is picked. Unlike the report-only checks above this one is a HARD rule:
// the form blocks it too, so a submitted entry that breaks it only arrives when the form's check was bypassed.
// Only entries whose answers for the rule are new or changed in this write are checked, so an older submitted
// entry (saved before the rule existed) can never block later saves of the same record.
// loadPrev: async () => the stored list (JSON string) or null. Returns the message to refuse with, or null.
function condHolds(w, values) {
  const have = String(values && values[w.field] != null ? values[w.field] : '').trim();
  return Array.isArray(w.equals) ? w.equals.includes(have) : have === w.equals;
}
async function requiredWhenRefusal(prisma, key, value, loadPrev) {
  const prefix = prefixOf(key);
  if (!prefix) return null;
  let entries;
  try { entries = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(entries)) return null;

  const assembled = await definitionFor(prisma, key.slice(prefix.length));
  if (!assembled) return null;
  const rules = flattenFields(assembled.config).filter((f) => f && f.key && f.requiredWhen && f.requiredWhen.field);
  if (!rules.length) return null;

  const prev = new Map();
  try {
    const stored = JSON.parse((await loadPrev()) || '[]');
    if (Array.isArray(stored)) stored.forEach((e) => { if (e && e.id) prev.set(e.id, e); });
  } catch (_) { /* no readable previous list: every submitted entry counts as new */ }

  const same = (a, b) => String(a == null ? '' : a) === String(b == null ? '' : b);
  for (const entry of entries) {
    if (!isSubmitted(entry)) continue;
    const v = entry.values || entry;
    const was = prev.get(entry.id);
    const pv = was && isSubmitted(was) ? (was.values || was) : null;
    for (const f of rules) {
      const w = f.requiredWhen;
      if (pv && same(pv[f.key], v[f.key]) && same(pv[w.field], v[w.field])) continue;   // already stored like this
      if (f.showWhen && f.showWhen.field && !condHolds(f.showWhen, v)) continue;        // the field is not on the form
      if (condHolds(w, v) && isBlank(v[f.key])) return f.requiredMessage || `"${f.label || f.key}" is required.`;
    }
  }
  return null;
}

async function validateWrite(prisma, key, value) {
  const prefix = prefixOf(key);
  if (!prefix) return { ok: true, status: 200, violations: [] };

  let entries;
  try { entries = JSON.parse(value); } catch { return { ok: true, status: 200, violations: [] }; }
  if (!Array.isArray(entries)) return { ok: true, status: 200, violations: [] };

  const recordKey = key.slice(prefix.length);
  let assembled;
  try { assembled = await definitionFor(prisma, recordKey); }
  catch (e) { console.error('validateWrite: definition lookup failed for', recordKey, e); return { ok: true, status: 200, violations: [] }; }
  if (!assembled) return { ok: true, status: 200, violations: [] }; // no definition -> nothing to check against

  const config = assembled.config;
  const topFields = flattenFields(config);
  const rosterCols = config.roster && Array.isArray(config.roster.columns) ? config.roster.columns : null;

  const violations = [];
  entries.forEach((entry, i) => {
    if (!isSubmitted(entry)) return;
    const label = `entry ${i + 1}`;
    checkValueSet(topFields, entry.values || entry, label, violations);
    if (rosterCols && Array.isArray(entry.roster)) {
      entry.roster.forEach((row, r) => checkValueSet(rosterCols, row, `${label} roster row ${r + 1}`, violations));
    }
  });

  if (violations.length && ENFORCE) {
    return { ok: false, status: 422, violations };
  }
  return { ok: true, status: 200, violations };
}

module.exports = { validateWrite, requiredWhenRefusal, ENFORCE };
