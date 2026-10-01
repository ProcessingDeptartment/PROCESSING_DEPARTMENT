// Storage API for the facility records system. Implements the exact contract expected by
// public/lib/api-backend.js (see BACKEND_INTEGRATION.md): get/set/remove by key, and
// getByPrefix in one round trip. Backed by Postgres (Neon) via Prisma.
//
// Any key written under the 'formrecord:' or 'monitoring_log:' prefix (see
// public/lib/form-record.js and public/lib/monitoring-log.js -- each key holds the whole array of
// entries for one record) also gets its date fields pulled out into SubmissionDateField, using
// data/date-field-classification.csv for the field label/classification and
// data/record-key-map.json to resolve which actual record the key came from (several forms share
// field keys like "date" or "receivingDate", so the field key alone can't identify the record).
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const dateFieldMap = require('./date-field-map');
const recordKeyMap = require('./record-key-map');
const { assembleRecordConfig } = require('./record-def');
const { validateWrite, ENFORCE: VALIDATE_ENFORCE } = require('./validate-submission');
const { syncRecordLinks } = require('./record-links');
const { syncSubmissionRows } = require('./submission-store');
const { syncStockLinks } = require('./stock-link');
const { syncClosedBoxes } = require('./closed-box');
const { syncSubmissionDates } = require('./submission-dates');
const { syncGovernanceKey, isGovernanceKey } = require('./governance-store');
const dryGuard = require('./drying-process-guard');

// Query events feed the status page's query counter (src/status-page.js); emit:'event' logs nothing.
const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
const dateFields = dateFieldMap.load();
const recordKeys = recordKeyMap.load();
const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

/* ---------------------------------------------------------------------------------------------
 * Shared-key auth.
 *
 * Set API_KEY in the Render dashboard to turn this on. It is deliberately tolerant of being
 * unset: the client ships the header before the key is configured, so enabling it is a one-step
 * dashboard change that never leaves the site briefly broken between two deploys.
 *
 * WHAT THIS IS AND ISN'T: this is a device-level shared secret, not user identity. It stops the
 * API being read or wiped by anyone who simply has the URL. It does NOT stop someone who can
 * already use the site from reading the key out of their own browser. Real per-user auth needs
 * Entra ID, and until that exists there is nothing server-side to bind a request to a person --
 * auth.js is a client-side shared password and permission-rules.js is a client-side role picker,
 * so neither can be enforced here. Treat this as a lock on the front door, not an audit trail.
 * ------------------------------------------------------------------------------------------- */
const API_KEY = process.env.API_KEY || '';
if (!API_KEY) {
  console.warn('*** API_KEY is not set — the API is running UNPROTECTED. Set API_KEY in the Render dashboard to require a key. ***');
}

function tokenMatches(token) {
  if (!token || token.length !== API_KEY.length) return false; // length check first: timingSafeEqual throws on a mismatch
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(API_KEY));
}

app.use('/api', (req, res, next) => {
  if (!API_KEY) return next();                    // not configured yet
  if (req.method === 'OPTIONS') return next();    // CORS preflight carries no Authorization header
  if (req.path === '/health') return next();      // uptime probes must stay reachable
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (tokenMatches(token)) return next();
  return res.status(401).json({ ok: false, error: 'unauthorised' });
});

// Status dashboard at GET / plus request/query timing for it. Mounted before the routes so the
// timing middleware sees every request.
require('./status-page').mount(app, prisma, {
  version: require('../package.json').version,
  authOn: !!API_KEY,
  validateEnforce: VALIDATE_ENFORCE,
  siteUrl: process.env.SITE_URL || '',
});

app.get('/api/storage/key/:key', async (req, res) => {
  try {
    const row = await prisma.keyValue.findUnique({ where: { key: req.params.key } });
    // Missing key is normal (pages probe optional keys like doc_header:*), so answer 200 with a
    // null value rather than 404 -- browsers log every 404 as a console error, which buries real ones.
    if (!row) return res.json({ value: null });
    res.json({ value: row.value });
  } catch (e) {
    console.error('GET key failed', e);
    res.status(500).json(null);
  }
});

app.put('/api/storage/key/:key', async (req, res) => {
  try {
    let { value } = req.body;
    if (typeof value !== 'string') return res.status(400).json({ ok: false });

    // REC 7.4.1 Drying Process: server-side stamps, locks, one Yes per movement, per-job steam numbers.
    if (req.params.key === dryGuard.KEY) {
      const prevRow = await prisma.keyValue.findUnique({ where: { key: req.params.key } });
      const g = dryGuard.guardWrite(prevRow ? prevRow.value : null, value);
      if (!g.ok) {
        console.warn('PUT', req.params.key, 'REFUSED by drying-process guard:', g.error);
        return res.status(g.status).json({ ok: false, guard: true, error: g.error });
      }
      value = g.value;
    }

    // Layer 2: validate the submission against its record definition. Report-only unless
    // VALIDATE_WRITES=enforce, in which case a submitted-and-invalid entry is rejected 422.
    let violations = [];
    try {
      const verdict = await validateWrite(prisma, req.params.key, value);
      violations = verdict.violations;
      if (!verdict.ok) {
        console.warn('PUT', req.params.key, 'REJECTED —', violations.length, 'violation(s):', violations);
        return res.status(422).json({ ok: false, error: 'validation failed', violations });
      }
      if (violations.length) {
        console.warn('PUT', req.params.key, '— stored with', violations.length, 'validation warning(s):', violations);
      }
    } catch (e) {
      console.error('validateWrite threw (write allowed)', e);
    }

    await prisma.$transaction(async (tx) => {
      const prev = await tx.keyValue.findUnique({ where: { key: req.params.key } });
      await tx.keyValue.upsert({
        where: { key: req.params.key },
        create: { key: req.params.key, value },
        update: { value }
      });
      if (!prev || prev.value !== value) {
        await tx.keyValueHistory.create({ data: { ...who(req), key: req.params.key, action: 'set', before: prev ? prev.value : null, after: value } });
      }
    });
    await syncSubmissionDates(prisma, req.params.key, value, { dateFields, recordKeys });
    try { await syncRecordLinks(prisma, req.params.key, value); }
    catch (e) { console.error('syncRecordLinks failed (write succeeded)', e); }
    try { await syncSubmissionRows(prisma, req.params.key, value); }
    catch (e) { console.error('syncSubmissionRows failed (write succeeded)', e); }
    try { await syncStockLinks(prisma, req.params.key, value); }
    catch (e) { console.error('syncStockLinks failed (write succeeded)', e); }
    try { await syncClosedBoxes(prisma, req.params.key, value); }
    catch (e) { console.error('syncClosedBoxes failed (write succeeded)', e); }
    if (isGovernanceKey(req.params.key)) {
      try { await syncGovernanceKey(prisma, req.params.key, value); }
      catch (e) { console.error('syncGovernanceKey failed (write succeeded)', e); }
    }
    res.json({ ok: true, warnings: violations });
  } catch (e) {
    console.error('PUT key failed', e);
    res.status(500).json({ ok: false });
  }
});

// Who the client says made the change -- recorded in KeyValueHistory, not verified (see auth note).
function who(req) {
  const clip = (v) => (v ? String(v).slice(0, 120) : null);
  return { actor: clip(req.get('x-user')), role: clip(req.get('x-role')) };
}

// Audit trail for one key, newest first.
app.get('/api/history/:key', async (req, res) => {
  try {
    const rows = await prisma.keyValueHistory.findMany({ where: { key: req.params.key }, orderBy: { at: 'desc' }, take: 200 });
    res.json({ ok: true, rows });
  } catch (e) {
    console.error('GET history failed', e);
    res.status(500).json({ ok: false });
  }
});

app.delete('/api/storage/key/:key', async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      const prev = await tx.keyValue.findUnique({ where: { key: req.params.key } });
      if (!prev) return;
      await tx.keyValueHistory.create({ data: { ...who(req), key: req.params.key, action: 'delete', before: prev.value, after: null } });
      await tx.keyValue.delete({ where: { key: req.params.key } });
    });
    await prisma.submissionDateField.deleteMany({ where: { submissionKey: req.params.key } });
    // Clear submission + link rows (pass empty array → deletes everything for this record)
    try { await syncSubmissionRows(prisma, req.params.key, '[]'); } catch (_) {}
    try { await syncRecordLinks(prisma, req.params.key, '[]'); } catch (_) {}
    try { await syncStockLinks(prisma, req.params.key, '[]'); } catch (_) {}
    try { await syncClosedBoxes(prisma, req.params.key, '[]'); } catch (_) {}
    if (isGovernanceKey(req.params.key)) {
      try { await syncGovernanceKey(prisma, req.params.key, null); } catch (_) {}
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE key failed', e);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/storage/prefix/:prefix', async (req, res) => {
  try {
    const rows = await prisma.keyValue.findMany({
      where: { key: { startsWith: req.params.prefix } }
    });
    const out = {};
    for (const row of rows) out[row.key] = row.value;
    res.json(out);
  } catch (e) {
    console.error('GET prefix failed', e);
    res.status(500).json({});
  }
});

// Distinct recent values of one field in a record, most recent first -- backs the job-number
// search-select so a user can pick from what's actually been received instead of typing blind.
app.get('/api/values/:recordKey/:field', async (req, res) => {
  try {
    const { recordKey, field } = req.params;
    const seen = new Map(); // value -> most recent timestamp seen for it
    for (const prefix of ['formrecord:', 'monitoring_log:']) {
      const row = await prisma.keyValue.findUnique({ where: { key: prefix + recordKey } });
      if (!row) continue;
      let entries;
      try { entries = JSON.parse(row.value); } catch { continue; }
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const values = entry.values || entry;
        const v = values[field];
        if (!v) continue;
        const stamp = entry.submittedAt || entry.updatedAt || entry.createdAt || 0;
        if (!seen.has(v) || stamp > seen.get(v)) seen.set(v, stamp);
      }
    }
    const sorted = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v).slice(0, 200);
    res.json(sorted);
  } catch (e) {
    console.error('GET values failed', e);
    res.status(500).json([]);
  }
});

// Last recorded value of a roster column for a physical item, across one or more records -- e.g. a
// grading collection bin's final weight on the latest earlier grading log, which becomes that bin's
// start weight on the next job. Rows match on `match`=`value`; entries are ordered by their own
// `dateField` (falling back to save time) and only those dated on/before `before` are considered.
//   GET /api/roster-last/:column?sources=a,b&match=binCode&value=8g-10g-1&dateField=gradingDate&before=2026-09-25&excludeId=...
app.get('/api/roster-last/:column', async (req, res) => {
  try {
    const column = req.params.column;
    const sources = String(req.query.sources || '').split(',').map(s => s.trim()).filter(Boolean);
    const match = String(req.query.match || '');
    const needle = String(req.query.value || '').trim().toUpperCase();
    const dateField = req.query.dateField ? String(req.query.dateField) : null;
    const before = req.query.before ? String(req.query.before) : null;
    const excludeId = req.query.excludeId ? String(req.query.excludeId) : null;
    if (!sources.length || !match || !needle) return res.json(null);
    let best = null;
    for (const recordKey of sources) {
      for (const prefix of ['formrecord:', 'monitoring_log:']) {
        const row = await prisma.keyValue.findUnique({ where: { key: prefix + recordKey } });
        if (!row) continue;
        let entries;
        try { entries = JSON.parse(row.value); } catch { continue; }
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          if (excludeId && entry.id === excludeId) continue;
          const values = entry.values || entry;
          const date = dateField ? String(values[dateField] || '') : '';
          if (before && date && date > before) continue;
          const stamp = entry.submittedAt || entry.updatedAt || entry.createdAt || 0;
          const rows = Array.isArray(entry.roster) ? entry.roster : [];
          // Last matching row within the entry wins (the bin's most recent use in that job).
          let hit = null;
          for (const r of rows) {
            if (String((r || {})[match] || '').trim().toUpperCase() !== needle) continue;
            const v = String(r[column] == null ? '' : r[column]).trim();
            if (v) hit = v;
          }
          if (hit == null) continue;
          if (!best || date > best.date || (date === best.date && stamp > best.stamp)) {
            best = {
              date, stamp, value: hit, recordKey,
              jobNumber: values.jobNumber || values.jobNo || '',
              status: entry.status || 'submitted'
            };
          }
        }
      }
    }
    if (!best) return res.json(null);
    res.json({ value: best.value, recordKey: best.recordKey, jobNumber: best.jobNumber, date: best.date, status: best.status });
  } catch (e) {
    console.error('GET roster-last failed', e);
    res.status(500).json(null);
  }
});

// Latest value of :column for EVERY group at once, e.g. each size grade's current bin number:
//   GET /api/roster-last-by-group/binNo?sources=a,b&match=sizeGrade&dateField=gradingDate&before=...&excludeId=...
// -> { "8g-10g": { value: "3", date, jobNumber, status }, ... }. Same "latest" rule as roster-last.
app.get('/api/roster-last-by-group/:column', async (req, res) => {
  try {
    const column = req.params.column;
    const sources = String(req.query.sources || '').split(',').map(s => s.trim()).filter(Boolean);
    const match = String(req.query.match || '');
    const dateField = req.query.dateField ? String(req.query.dateField) : null;
    const before = req.query.before ? String(req.query.before) : null;
    const excludeId = req.query.excludeId ? String(req.query.excludeId) : null;
    if (!sources.length || !match) return res.json({});
    const best = {};
    for (const recordKey of sources) {
      for (const prefix of ['formrecord:', 'monitoring_log:']) {
        const row = await prisma.keyValue.findUnique({ where: { key: prefix + recordKey } });
        if (!row) continue;
        let entries;
        try { entries = JSON.parse(row.value); } catch { continue; }
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          if (excludeId && entry.id === excludeId) continue;
          const values = entry.values || entry;
          const date = dateField ? String(values[dateField] || '') : '';
          if (before && date && date > before) continue;
          const stamp = entry.submittedAt || entry.updatedAt || entry.createdAt || 0;
          const hits = {};
          for (const r of (Array.isArray(entry.roster) ? entry.roster : [])) {
            const g = String((r || {})[match] || '').trim();
            const v = String(r[column] == null ? '' : r[column]).trim();
            if (g && v) hits[g] = v;
          }
          for (const [g, value] of Object.entries(hits)) {
            const b = best[g];
            if (!b || date > b.date || (date === b.date && stamp > b.stamp)) {
              best[g] = { date, stamp, value, jobNumber: values.jobNumber || values.jobNo || '', status: entry.status || 'submitted' };
            }
          }
        }
      }
    }
    res.json(best);
  } catch (e) {
    console.error('GET roster-last-by-group failed', e);
    res.status(500).json({});
  }
});

// Finds the most recent entry in a record whose field matches value, for cross-record autofill
// (e.g. selecting a job number on one record pulls in details already captured on another).
// Checks both storage prefixes since callers don't know which one a given record uses.
app.get('/api/lookup/:recordKey/:field/:value', async (req, res) => {
  try {
    const { recordKey, field, value } = req.params;
    const needle = value.trim().toUpperCase();
    const excludeId = req.query.excludeId ? String(req.query.excludeId) : null;
    let best = null;
    // Sum of each numeric top-level field across every OTHER submitted entry that matches this
    // job (e.g. total kg already cooked in earlier dry-cooking batches for the same job number).
    // Excludes drafts (not yet committed) and excludeId (the record currently being edited),
    // so a form re-checking its own in-progress total doesn't double-count itself.
    const matchValueSums = {};
    const matchNumericOk = {};
    let matchRosterSum = 0;
    for (const prefix of ['formrecord:', 'monitoring_log:']) {
      const row = await prisma.keyValue.findUnique({ where: { key: prefix + recordKey } });
      if (!row) continue;
      let entries;
      try { entries = JSON.parse(row.value); } catch { continue; }
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const values = { ...(entry.values || entry) };
        // Roster-based records (e.g. Abalone Receiving's baskets) keep their real weight/count
        // data as per-row roster entries, not a top-level value. Expose per-column totals under
        // a namespaced `__rosterSums` key so a caller that wants "total whole weight received
        // for this job" can read it explicitly -- never as bare top-level fields, which a
        // fillMap could silently pick up. Two columns can't be told apart by value alone
        // (basketNr 1,2,3 sums to 6 just as validly as wholeWeight does), so leaving these
        // namespaced keeps the guess out of the autofill namespace.
        if (Array.isArray(entry.roster) && entry.roster.length) {
          // Strict numeric test (not parseFloat): parseFloat('100-150g') is 100, so a size-range
          // column would otherwise produce a bogus total. A column is dropped the moment any
          // non-empty cell fails to be a clean number.
          const sums = {};
          const numericCol = {};
          for (const row of entry.roster) {
            for (const [k, v] of Object.entries(row || {})) {
              const text = String(v == null ? '' : v).trim();
              if (!text || numericCol[k] === false) continue;
              if (/^-?\d+(\.\d+)?$/.test(text)) {
                numericCol[k] = true;
                sums[k] = (sums[k] || 0) + parseFloat(text);
              } else {
                numericCol[k] = false;
                delete sums[k];
              }
            }
          }
          const rosterSums = {};
          for (const [k, sum] of Object.entries(sums)) {
            if (numericCol[k]) rosterSums[k] = String(sum);
          }
          if (Object.keys(rosterSums).length) values.__rosterSums = rosterSums;
          // Distinct text values per roster column, e.g. the size ranges actually received on
          // this job. Downstream forms use it to narrow their own size-range picker to what the
          // job contains, so a grader can't pick a size that was never received. Capped so a
          // free-text column (comments) can't turn into a thousand-entry payload -- over the cap
          // the column is dropped, and the client falls back to the full preset list.
          const distinct = {};
          for (const row of entry.roster) {
            for (const [k, v] of Object.entries(row || {})) {
              const text = String(v == null ? '' : v).trim();
              if (!text) continue;
              (distinct[k] = distinct[k] || new Set()).add(text);
            }
          }
          const options = {};
          for (const [k, set] of Object.entries(distinct)) {
            if (set.size <= 50) options[k] = [...set];
          }
          values.__rosterOptions = options;
          // Per-group subtotals: for each text column with <=50 distinct values, sum every clean
          // numeric column within each group. Lets a downstream form ask "whole weight received
          // for size range 100-150g on this job" without re-fetching the whole roster.
          const groupSums = {};
          for (const [gk, gset] of Object.entries(distinct)) {
            if (gset.size > 50) continue;
            for (const r of entry.roster) {
              const gval = String((r || {})[gk] == null ? '' : r[gk]).trim();
              if (!gval) continue;
              for (const [nk, nv] of Object.entries(r || {})) {
                const ntext = String(nv == null ? '' : nv).trim();
                if (!ntext || !/^-?\d+(\.\d+)?$/.test(ntext)) continue;
                const bucket = (groupSums[gk] = groupSums[gk] || {});
                const cell = (bucket[gval] = bucket[gval] || {});
                cell[nk] = (cell[nk] || 0) + parseFloat(ntext);
              }
            }
          }
          if (Object.keys(groupSums).length) values.__rosterGroupSums = groupSums;
        }
        if (String(values[field] || '').trim().toUpperCase() !== needle) continue;
        // Drafts are matched on purpose: a job number is created on Abalone Receiving at the start
        // of a shift and downstream records legitimately start before it's finished. But a value
        // read off an unfinished record is PROVISIONAL -- intake weight in particular keeps rising
        // as baskets are weighed -- so say which it is rather than handing back a number that looks
        // final. `__` prefixed so it can't collide with a real field key.
        values.__status = entry.status || 'submitted';
        values.__updatedAt = entry.updatedAt || entry.submittedAt || entry.createdAt || null;
        const stamp = entry.submittedAt || entry.updatedAt || entry.createdAt || 0;
        if (!best || stamp > best.stamp) best = { stamp, values };

        if (entry.status === 'submitted' && entry.id !== excludeId && req.query.rosterCol && Array.isArray(entry.roster)) {
          // Sum of one roster column over the matching rows (e.g. kg of pots that were cooked),
          // optionally only rows whose filterCol is one of the comma-separated filterIn values.
          const fc = String(req.query.filterCol || '');
          const fin = String(req.query.filterIn || '').split(',').filter(Boolean);
          for (const row of entry.roster) {
            if (!row) continue;
            if (fc && fin.indexOf(String(row[fc] == null ? '' : row[fc])) === -1) continue;
            const n = parseFloat(row[req.query.rosterCol]);
            if (!Number.isNaN(n)) matchRosterSum += n;
          }
        }
        if (entry.status === 'submitted' && entry.id !== excludeId) {
          const rawValues = entry.values || entry;
          for (const [k, v] of Object.entries(rawValues)) {
            if (k.startsWith('__')) continue;
            const text = String(v == null ? '' : v).trim();
            if (!text || matchNumericOk[k] === false) continue;
            if (/^-?\d+(\.\d+)?$/.test(text)) {
              matchNumericOk[k] = true;
              matchValueSums[k] = (matchValueSums[k] || 0) + parseFloat(text);
            } else {
              matchNumericOk[k] = false;
              delete matchValueSums[k];
            }
          }
        }
      }
    }
    if (best && req.query.rosterCol) best.values.__matchRosterSum = String(matchRosterSum);
    if (best && Object.keys(matchValueSums).length) {
      best.values.__matchValueSums = {};
      for (const [k, sum] of Object.entries(matchValueSums)) {
        if (matchNumericOk[k]) best.values.__matchValueSums[k] = String(sum);
      }
    }
    res.json(best ? best.values : null);
  } catch (e) {
    console.error('GET lookup failed', e);
    res.status(500).json(null);
  }
});

// REC 7.4.2 Dry Monitoring autofill: what the rest of the system already knows about a job, read from the
// relational projections (submitted entries only, drafts ignored). Keyed by source record so the form's
// `fromRecord.source` picks its own answer.
//   'dry-cooking'    -> latest REC 7.4.0 Cooking-card date (Blanching cards never count) + the entries it came from
//   'drying-process' -> current trolley count = the latest submitted REC 7.4.1 entry that has one
app.get('/api/dry-monitoring/job-facts/:jobNo', async (req, res) => {
  const jobNo = String(req.params.jobNo || '').trim();
  const out = { 'dry-cooking': null, 'drying-process': null };
  if (!jobNo) return res.json(out);
  try {
    const cook = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "submissionId", to_char("recordDate", 'YYYY-MM-DD') AS d FROM "dry_cooking_pot"
       WHERE UPPER("jobNo") = UPPER($1) AND "process" = 'Cooking' AND "recordDate" IS NOT NULL
         AND COALESCE("status", 'submitted') <> 'draft'`, jobNo);
    if (cook.length) {
      const dates = [...new Set(cook.map((r) => r.d))].sort();
      const latest = dates[dates.length - 1];
      out['dry-cooking'] = { value: latest, ids: cook.filter((r) => r.d === latest).map((r) => r.submissionId), dates };
    }
  } catch (e) { console.error('job-facts cooking failed', e.message); }
  try {
    const dry = await prisma.$queryRawUnsafe(
      `SELECT "id", "noOfTrolleys" FROM "sub_drying_process"
       WHERE UPPER("jobNo") = UPPER($1) AND "noOfTrolleys" IS NOT NULL AND COALESCE("status", 'submitted') <> 'draft'
       ORDER BY "entryDate" DESC NULLS LAST LIMIT 1`, jobNo);
    if (dry.length) out['drying-process'] = { value: String(dry[0].noOfTrolleys), ids: [dry[0].id] };
  } catch (e) { console.error('job-facts trolleys failed', e.message); }
  res.json(out);
});

// Read-only view over the extracted date fields, for reporting/audits.
app.get('/api/dates', async (req, res) => {
  try {
    const { recordClass, from, to, recordKey } = req.query;
    const where = {};
    if (recordClass) where.recordClass = recordClass;
    if (recordKey) where.recordKey = recordKey;
    if (from || to) {
      where.dateValue = {};
      if (from) where.dateValue.gte = new Date(from);
      if (to) where.dateValue.lte = new Date(to);
    }
    const rows = await prisma.submissionDateField.findMany({ where, orderBy: { dateValue: 'desc' } });
    res.json(rows);
  } catch (e) {
    console.error('GET dates failed', e);
    res.status(500).json([]);
  }
});

// Relational batch trace: every record touchpoint for one batch/job/lot number, plus the
// one-up/one-down genealogy (batches consumed INTO this one, and produced FROM it). Mirrors the
// client-side prefix scan in public/lib/traceability.js but runs it in Postgres so a recall query
// does not depend on the querying device having synced. Keys are
// 'batch_link:<encodeURIComponent(batch)>:<record>:<submission>' -- match that encoding exactly.
const subTable = (recordKey) => 'sub_' + String(recordKey).replace(/-/g, '_');

// Mutates `records` (trace rows: {record_key, submission_id, ...}) in place, adding
// `status`: 'draft' | 'submitted' | 'verified'. Reads the per-record sub_<key> projection
// (dual-written by syncSubmissionRows) rather than the KeyValue blob so this is one indexed
// query per distinct record, not a full-array parse per record.
async function attachSubmissionStatus(records) {
  const byKey = new Map();
  for (const r of records) {
    if (!r.record_key || !r.submission_id) continue;
    if (!byKey.has(r.record_key)) byKey.set(r.record_key, new Set());
    byKey.get(r.record_key).add(r.submission_id);
  }
  await Promise.all([...byKey.entries()].map(async ([recordKey, idSet]) => {
    const ids = [...idSet];
    let rows;
    try {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id, status, "rawJson" FROM "${subTable(recordKey)}" WHERE id = ANY($1::text[])`,
        ids,
      );
    } catch (e) {
      return; // table may not exist for this record yet -- leave status unset
    }
    const byId = new Map();
    for (const row of rows) {
      let verified = false;
      if (row.rawJson) {
        try { verified = !!JSON.parse(row.rawJson).verification; } catch (e) { /* ignore */ }
      }
      byId.set(row.id, verified ? 'verified' : (row.status === 'draft' ? 'draft' : 'submitted'));
    }
    for (const r of records) {
      if (r.record_key === recordKey && byId.has(r.submission_id)) r.status = byId.get(r.submission_id);
    }
  }));
}

// REC 7.4.0 Dry Cooking: attach each pot (process, pot no., record date, kg, salt/sugar/vinegar
// batch numbers) from the dry_cooking_pot view so the trace shows "Pot 2 - Cooking - 120 kg".
async function attachDryCookingPots(records) {
  const ids = [...new Set(records.filter(r => r.record_key === 'dry-cooking' && r.submission_id).map(r => r.submission_id))];
  if (!ids.length) return;
  let rows;
  try {
    rows = await prisma.$queryRawUnsafe(
      `SELECT "submissionId", "rowNo", "potNo", "process", "recordDate", "abaloneKg", "blanchBatchNumber", "saltBatchNumber", "sugarBatchNumber", "vinegarBatchNumber"
       FROM "dry_cooking_pot" WHERE "submissionId" = ANY($1::text[]) ORDER BY "submissionId", "rowNo"`, ids);
  } catch (e) { return; }
  for (const r of records) {
    if (r.record_key !== 'dry-cooking') continue;
    r.pots = rows.filter(x => x.submissionId === r.submission_id).map(x => ({
      rowNo: x.rowNo, potNo: x.potNo || x.rowNo, process: x.process, abaloneKg: x.abaloneKg,
      cookingDate: x.recordDate ? new Date(x.recordDate).toISOString().slice(0, 10) : null,
      batches: { blanch: x.blanchBatchNumber, salt: x.saltBatchNumber, sugar: x.sugarBatchNumber, vinegar: x.vinegarBatchNumber },
    }));
  }
}

// Mock recall: every box / bin a job's stock went into, with the other jobs sharing each box and
// the REC 7.4.5 inspection on the box's own closed_box row. Box code = bin code. Read-only.
app.get('/api/recall/job/:job/boxes', async (req, res) => {
  const job = String(req.params.job || '').trim().toUpperCase();
  if (!job) return res.status(400).json({ ok: false, error: 'job number required' });
  try {
    const edges = await prisma.stockLink.findMany({ where: { fromType: 'job', fromKey: job, toType: 'bin' } });
    const codes = [...new Set(edges.map((e) => e.toKey))];
    const [shared, closed] = codes.length
      ? await Promise.all([
          prisma.stockLink.findMany({ where: { toType: 'bin', toKey: { in: codes } }, select: { fromKey: true, toKey: true } }),
          prisma.closedBox.findMany({ where: { boxCode: { in: codes } } }),
        ])
      : [[], []];
    const jobsByBin = new Map();
    for (const s of shared) {
      if (!jobsByBin.has(s.toKey)) jobsByBin.set(s.toKey, new Set());
      jobsByBin.get(s.toKey).add(s.fromKey);
    }
    const closedByCode = new Map(closed.map((c) => [c.boxCode, c]));
    const boxes = codes.map((code) => {
      const c = closedByCode.get(code);
      const mine = edges.filter((e) => e.toKey === code);
      return {
        boxCode: code,
        state: c ? 'closed' : 'open bin',            // open bin = stock still in a bin, no box closed yet
        sizeGrade: c ? c.sizeGrade : null,
        nettKg: c ? c.nettKg743 : (mine.find((e) => e.weightKg != null) || {}).weightKg ?? null,
        closedAt: c ? c.closedAt : null,
        jobs: [...(jobsByBin.get(code) || [])].sort(),
        fromDraft: mine.some((e) => e.status === 'draft'),
        inspection: c && c.inspectionSubmissionId
          ? { approved: c.approved === true, packingDate: c.packingDate, tareKg: c.tareKg, nettKg: c.nettKg, changedAfterInspection: c.changedAfterInspection }
          : null,
      };
    }).sort((a, b) => a.boxCode.localeCompare(b.boxCode, undefined, { numeric: true }));
    res.json({ ok: true, job, generatedAt: new Date().toISOString(), count: boxes.length, boxes });
  } catch (e) {
    console.error('GET recall boxes failed', e);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/trace/:batch', async (req, res) => {
  const batch = String(req.params.batch || '').trim();
  try {
    const [directRaw, reverseRaw] = await Promise.all([
      // Rows filed under this batch's own prefix: its own record touchpoints, and links where
      // THIS batch is an ingredient/sub-batch of some other batch.
      prisma.keyValue.findMany({ where: { key: { startsWith: 'batch_link:' + encodeURIComponent(batch) + ':' } } }),
      // Rows filed under OTHER batches that name this one as their linked_batch -- i.e. batches
      // that fed into, or were split out of, this one. LIKE scan over the index; fine at this
      // scale (index rows are small and number in the thousands, not millions).
      prisma.keyValue.findMany({ where: { key: { startsWith: 'batch_link:' }, value: { contains: '"linked_batch":"' + batch + '"' } } }),
    ]);
    const parse = (list) => {
      const out = [];
      for (const row of list) {
        try { const v = JSON.parse(row.value); if (v && typeof v === 'object') out.push(v); }
        catch { /* skip unparseable index row */ }
      }
      return out;
    };
    const direct = parse(directRaw);
    const reverse = parse(reverseRaw).filter(r => r.linked_batch === batch); // contains-match can over-match

    // `rel` on a row is the relationship of that row's batch_no to its linked_batch.
    const inputs = new Set(), outputs = new Set();
    for (const r of direct) {
      if (!r.linked_batch || r.linked_batch === batch) continue;
      // queried batch -> linked_batch: consumed-into means linked_batch is downstream (an output)
      (r.rel === 'output' ? inputs : outputs).add(r.linked_batch);
    }
    for (const r of reverse) {
      if (!r.batch_no || r.batch_no === batch) continue;
      // other batch -> queried batch: consumed-into means the other batch is upstream (an input)
      (r.rel === 'output' ? outputs : inputs).add(r.batch_no);
    }

    const records = direct.concat(reverse).sort((a, b) => {
      const da = a.occurred_on || '', db = b.occurred_on || '';
      if (da && db && da !== db) return da < db ? -1 : 1;
      return (a.updated_at || '') < (b.updated_at || '') ? -1 : 1;
    });
    await attachSubmissionStatus(records);
    await attachDryCookingPots(records);
    res.json({ batch, records, inputs: [...inputs], outputs: [...outputs] });
  } catch (e) {
    console.error('GET trace failed', e);
    res.status(500).json({ batch, records: [], inputs: [], outputs: [] });
  }
});

// The record's definition, assembled back into the engine config object it used to declare
// inline. form-record.js / monitoring-log.js call this on load instead of holding the config.
// Source of truth is the RecordDefinition tables (seeded by scripts/seed-definitions.mjs);
// fidelity is gated by scripts/verify-definitions.mjs.
app.get('/api/record-def/:recordKey', async (req, res) => {
  try {
    const out = await assembleRecordConfig(prisma, req.params.recordKey);
    if (!out) return res.status(404).json({ ok: false, error: 'no definition for ' + req.params.recordKey });
    res.set('Cache-Control', 'no-cache');
    res.json(out);
  } catch (e) {
    console.error('GET record-def failed', e);
    res.status(500).json({ ok: false });
  }
});

// Cross-record link query: every record that mentions this value (job number, batch code, AG
// code, lot number, person name, ...). Optionally filter by linkField to scope to one join-key
// type. This is the relational replacement for traceability.js's prefix scan.
app.get('/api/links/:value', async (req, res) => {
  try {
    const linkValue = String(req.params.value || '').trim().toUpperCase();
    if (!linkValue) return res.json([]);
    const where = { linkValue };
    if (req.query.field) where.linkField = req.query.field;
    const rows = await prisma.recordLink.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(rows);
  } catch (e) {
    console.error('GET links failed', e);
    res.status(500).json([]);
  }
});

// REC 7.4.1: an administrator reverses a wrongly answered Yes (reason + name required). The movement goes back
// to an open question; every reversal is also kept as a row in dry_process_movement_audit.
app.post('/api/drying-process/reverse-movement', async (req, res) => {
  try {
    const role = String(req.get('x-role') || '').toUpperCase();
    if (!['ADMINISTRATOR', 'QA_MANAGER'].includes(role)) return res.status(403).json({ ok: false, error: 'Only an administrator or the QA manager can reverse a movement.' });
    const b = req.body || {};
    const key = dryGuard.KEY;
    const prev = await prisma.keyValue.findUnique({ where: { key } });
    const r = dryGuard.reverseMovement(prev ? prev.value : '[]', { jobNo: b.jobNo, movement: b.movement, reason: b.reason, name: b.name });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: r.error });
    await prisma.$transaction(async (tx) => {
      await tx.keyValue.update({ where: { key }, data: { value: r.value } });
      await tx.keyValueHistory.create({ data: { ...who(req), key, action: 'set', before: prev.value, after: r.value } });
      await tx.$executeRawUnsafe(
        'INSERT INTO "dry_process_movement_audit" ("job_no","movement","entry_id","old_stamp","reversed_by","reason") VALUES ($1,$2,$3,$4,$5,$6)',
        r.audit.jobNo, r.audit.movement, r.audit.entryId, r.audit.oldStamp ? new Date(r.audit.oldStamp) : null, r.audit.reversedBy, r.audit.reason);
    });
    try { await syncSubmissionRows(prisma, key, r.value); } catch (e) { console.error('syncSubmissionRows failed (reversal saved)', e); }
    res.json({ ok: true, audit: r.audit });
  } catch (e) {
    console.error('reverse-movement failed', e);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`facility-api listening on ${PORT}, ${dateFields.size} known date fields loaded`
    + ` — write validation ${VALIDATE_ENFORCE ? 'ENFORCED (422 on invalid)' : 'report-only'}`);
});
