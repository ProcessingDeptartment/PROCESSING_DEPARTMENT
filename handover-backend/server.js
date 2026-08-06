// Standalone handover data service.
// Runs independently of the Processing Department static site — its own
// process, its own container, its own SQLite database file.
//
// Responsibility: receive a handover record when a user clicks "Generate PDF"
// on the front-end, and persist it into a real SQLite database on disk
// (append/update, not a one-off download).

const http = require('http');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'handovers.db');
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB safety cap per record

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS handover_records (
    id TEXT PRIMARY KEY,
    page TEXT,
    page_label TEXT,
    date TEXT,
    shift TEXT,
    owner_name TEXT,
    status TEXT,
    updated_at INTEGER,
    submitted_at INTEGER,
    received_at INTEGER,
    payload TEXT
  );
`);

const upsertStmt = db.prepare(`
  INSERT INTO handover_records
    (id, page, page_label, date, shift, owner_name, status, updated_at, submitted_at, received_at, payload)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    page = excluded.page,
    page_label = excluded.page_label,
    date = excluded.date,
    shift = excluded.shift,
    owner_name = excluded.owner_name,
    status = excluded.status,
    updated_at = excluded.updated_at,
    submitted_at = excluded.submitted_at,
    received_at = excluded.received_at,
    payload = excluded.payload;
`);

const listStmt = db.prepare(`
  SELECT id, page, page_label, date, shift, owner_name, status, updated_at, submitted_at, received_at
  FROM handover_records
  ORDER BY date DESC, shift ASC;
`);

const getStmt = db.prepare(`SELECT * FROM handover_records WHERE id = ?;`);

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

function handleCreateOrUpdate(req, res) {
  readJsonBody(req)
    .then(record => {
      if (!record || typeof record.id !== 'string' || !record.id) {
        sendJson(res, 400, { error: 'Missing required field: id' });
        return;
      }

      const now = Date.now();
      upsertStmt.run(
        record.id,
        record.page || null,
        record.pageLabel || null,
        record.date || null,
        record.shift || null,
        record.ownerName || null,
        record.status || 'submitted',
        record.updatedAt || now,
        record.submittedAt || now,
        now,
        JSON.stringify(record.payload || {})
      );

      sendJson(res, 200, { ok: true, id: record.id, receivedAt: now });
    })
    .catch(err => {
      const status = err.message === 'Payload too large' ? 413 : 400;
      sendJson(res, status, { error: err.message });
    });
}

function handleList(req, res) {
  const rows = listStmt.all().map(row => ({
    id: row.id,
    page: row.page,
    pageLabel: row.page_label,
    date: row.date,
    shift: row.shift,
    ownerName: row.owner_name,
    status: row.status,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    receivedAt: row.received_at
  }));
  sendJson(res, 200, { records: rows });
}

function handleGetOne(req, res, id) {
  const row = getStmt.get(id);
  if (!row) {
    sendJson(res, 404, { error: 'Record not found' });
    return;
  }
  sendJson(res, 200, {
    id: row.id,
    page: row.page,
    pageLabel: row.page_label,
    date: row.date,
    shift: row.shift,
    ownerName: row.owner_name,
    status: row.status,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    receivedAt: row.received_at,
    payload: JSON.parse(row.payload || '{}')
  });
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

server.listen(PORT, () => {
  console.log(`Handover backend listening on port ${PORT}`);
  console.log(`Database file: ${DB_PATH}`);
});
