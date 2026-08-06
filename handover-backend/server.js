// Standalone handover data service using MongoDB Atlas (free tier).
// Runs independently of the Processing Department static site — its own
// process, its own container, its own database.
//
// Responsibility: receive a handover record when a user clicks "Generate PDF"
// on the front-end, and persist it into MongoDB (append/update, not a one-off download).
//
// Requires: MONGODB_URI env var (get from MongoDB Atlas free tier)

const http = require('http');
const { MongoClient } = require('mongodb');
const ExcelJS = require('exceljs');

const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MONGODB_URI = process.env.MONGODB_URI;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB safety cap per record

if (!MONGODB_URI) {
  console.error('MONGODB_URI env var is required');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);
let db = null;
let collection = null;

async function connectMongo() {
  try {
    await client.connect();
    db = client.db('handover-data');
    collection = db.collection('records');
    await collection.createIndex({ id: 1 }, { unique: true });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection failed', err);
    process.exit(1);
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(data);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function handleCreateOrUpdate(req, res) {
  try {
    const record = await readJsonBody(req);
    if (!record || typeof record.id !== 'string' || !record.id) {
      sendJson(res, 400, { error: 'Missing required field: id' });
      return;
    }

    const now = Date.now();
    const doc = {
      id: record.id,
      page: record.page || null,
      pageLabel: record.pageLabel || null,
      date: record.date || null,
      shift: record.shift || null,
      ownerName: record.ownerName || null,
      status: record.status || 'submitted',
      updatedAt: record.updatedAt || now,
      submittedAt: record.submittedAt || now,
      receivedAt: now,
      payload: JSON.stringify(record.payload || {})
    };

    await collection.updateOne(
      { id: record.id },
      { $set: doc },
      { upsert: true }
    );

    sendJson(res, 200, { ok: true, id: record.id, receivedAt: now });
  } catch (err) {
    const status = err.message === 'Payload too large' ? 413 : 400;
    sendJson(res, status, { error: err.message });
  }
}

async function handleList(req, res) {
  try {
    const rows = await collection
      .find({})
      .sort({ date: -1, shift: 1 })
      .toArray();

    const records = rows.map(row => ({
      id: row.id,
      page: row.page,
      pageLabel: row.pageLabel,
      date: row.date,
      shift: row.shift,
      ownerName: row.ownerName,
      status: row.status,
      updatedAt: row.updatedAt,
      submittedAt: row.submittedAt,
      receivedAt: row.receivedAt
    }));

    sendJson(res, 200, { records });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

async function handleGetOne(req, res, id) {
  try {
    const row = await collection.findOne({ id });
    if (!row) {
      sendJson(res, 404, { error: 'Record not found' });
      return;
    }

    sendJson(res, 200, {
      id: row.id,
      page: row.page,
      pageLabel: row.pageLabel,
      date: row.date,
      shift: row.shift,
      ownerName: row.ownerName,
      status: row.status,
      updatedAt: row.updatedAt,
      submittedAt: row.submittedAt,
      receivedAt: row.receivedAt,
      payload: JSON.parse(row.payload || '{}')
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

async function handleExport(req, res) {
  try {
    const rows = await collection.find({}).sort({ date: -1, shift: 1 }).toArray();
    if (!rows.length) {
      sendJson(res, 404, { error: 'No records to export' });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Handovers');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Shift', key: 'shift', width: 10 },
      { header: 'Page', key: 'page', width: 15 },
      { header: 'Manager', key: 'ownerName', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Updated', key: 'updatedAt', width: 20 },
      { header: 'Submitted', key: 'submittedAt', width: 20 }
    ];

    rows.forEach(row => {
      worksheet.addRow({
        date: row.date,
        shift: row.shift,
        page: row.page,
        ownerName: row.ownerName,
        status: row.status,
        updatedAt: new Date(row.updatedAt).toLocaleString(),
        submittedAt: row.submittedAt ? new Date(row.submittedAt).toLocaleString() : 'N/A'
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

    const buffer = await workbook.xlsx.writeBuffer();
    const week = getWeekRange();
    const filename = `productionhandover_${week.start}_${week.end}.xlsx`;

    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    res.end(buffer);
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);

  if (url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'handover-backend' });
    return;
  }

  if (parts[0] === 'api' && parts[1] === 'handovers') {
    if (parts.length === 3 && parts[2] === 'export' && req.method === 'GET') {
      handleExport(req, res);
      return;
    }
    if (parts.length === 2 && req.method === 'POST') {
      handleCreateOrUpdate(req, res);
      return;
    }
    if (parts.length === 2 && req.method === 'GET') {
      handleList(req, res);
      return;
    }
    if (parts.length === 3 && req.method === 'GET') {
      handleGetOne(req, res, decodeURIComponent(parts[2]));
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

connectMongo().then(() => {
  server.listen(PORT, () => {
    console.log(`Handover backend listening on port ${PORT}`);
  });
});
