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

function checkValueSet(fields, values, rowLabel, violations) {
  for (const f of fields) {
    if (!f || !f.key) continue;
    const v = values ? values[f.key] : undefined;

    if (f.required && isBlank(v)) {
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
async function validateWrite(prisma, key, value) {
  const prefix = prefixOf(key);
  if (!prefix) return { ok: true, status: 200, violations: [] };

  let entries;
  try { entries = JSON.parse(value); } catch { return { ok: true, status: 200, violations: [] }; }
  if (!Array.isArray(entries)) return { ok: true, status: 200, violations: [] };

  const recordKey = key.slice(prefix.length);
  let assembled;
  try { assembled = await assembleRecordConfig(prisma, recordKey); }
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

module.exports = { validateWrite, ENFORCE };
