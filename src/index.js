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
const { PrismaClient } = require('@prisma/client');
const dateFieldMap = require('./date-field-map');
const recordKeyMap = require('./record-key-map');

const prisma = new PrismaClient();
const dateFields = dateFieldMap.load();
const recordKeys = recordKeyMap.load();
const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Walks a submission's JSON payload (which may contain repeating rows/rosters) and pulls out
// every value whose key is a known date field. Doesn't assume a fixed shape -- just recurses.
function extractDateFields(obj, found) {
  if (Array.isArray(obj)) {
    for (const item of obj) extractDateFields(item, found);
    return;
  }
  if (!isPlainObject(obj)) return;
  for (const [key, value] of Object.entries(obj)) {
    if (dateFields.has(key) && (typeof value === 'string' || value === null)) {
      found.push({ fieldKey: key, rawValue: value });
    }
    if (isPlainObject(value) || Array.isArray(value)) {
      extractDateFields(value, found);
    }
  }
}

async function syncSubmissionDates(key, value) {
  if (!recordKeyMap.hasKnownPrefix(key)) return;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return; // not JSON -- nothing to extract
  }

  const found = [];
  extractDateFields(parsed, found);

  const recordKey = recordKeyMap.recordKeyFromStorageKey(key);
  const record = recordKeys[recordKey];
  const recordName = record ? record.recordName : recordKey;

  await prisma.$transaction([
    prisma.submissionDateField.deleteMany({ where: { submissionKey: key } }),
    ...found.map(({ fieldKey, rawValue }) => {
      const meta = dateFields.get(fieldKey);
      const dateValue = rawValue && !isNaN(Date.parse(rawValue)) ? new Date(rawValue) : null;
      return prisma.submissionDateField.create({
        data: {
          submissionKey: key,
          recordName,
          fieldKey,
          fieldLabel: meta.fieldLabel,
          recordClass: meta.recordClass,
          dateValue,
          rawValue
        }
      });
    })
  ]);
}

app.get('/api/storage/key/:key', async (req, res) => {
  try {
    const row = await prisma.keyValue.findUnique({ where: { key: req.params.key } });
    if (!row) return res.status(404).json(null);
    res.json({ value: row.value });
  } catch (e) {
    console.error('GET key failed', e);
    res.status(500).json(null);
  }
});

app.put('/api/storage/key/:key', async (req, res) => {
  try {
    const { value } = req.body;
    if (typeof value !== 'string') return res.status(400).json({ ok: false });
    await prisma.keyValue.upsert({
      where: { key: req.params.key },
      create: { key: req.params.key, value },
      update: { value }
    });
    await syncSubmissionDates(req.params.key, value);
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT key failed', e);
    res.status(500).json({ ok: false });
  }
});

app.delete('/api/storage/key/:key', async (req, res) => {
  try {
    await prisma.keyValue.deleteMany({ where: { key: req.params.key } });
    await prisma.submissionDateField.deleteMany({ where: { submissionKey: req.params.key } });
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

// Read-only view over the extracted date fields, for reporting/audits.
app.get('/api/dates', async (req, res) => {
  try {
    const { recordClass, from, to } = req.query;
    const where = {};
    if (recordClass) where.recordClass = recordClass;
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

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`facility-api listening on ${PORT}, ${dateFields.size} known date fields loaded`);
});
