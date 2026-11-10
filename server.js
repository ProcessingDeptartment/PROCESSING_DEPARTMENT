// Simple static file server for front-end development
// This serves all files from the `public` directory
// When ready to add a backend, replace this with Express and add API routes

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
// Permanent archive beside the repo (MD/10_Archive-System.md). Browsed by public/pages/archive.html.
const ARCHIVE_DIR = path.resolve(process.env.ARCHIVE_OUT || path.resolve(__dirname, '..', 'PROCESSING ARCHIVE'));

// Simple MIME type mapping
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv'
};

const server = http.createServer((req, res) => {
  // Enable CORS for all requests (helpful for API development later)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Archive: the index, and any file inside ARCHIVE_DIR (read-only).
  const urlPath = req.url.split('?')[0];
  if (urlPath === '/api/archive/index' || urlPath.startsWith('/api/archive/file/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
      return;
    }
    if (urlPath === '/api/archive/index') {
      fs.readFile(path.join(ARCHIVE_DIR, 'index.json'), (err, data) => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(err ? '[]' : data);   // no archive yet -> empty list
      });
      return;
    }
    let rel;
    try { rel = decodeURIComponent(urlPath.slice('/api/archive/file/'.length)); } catch (e) { rel = null; }
    const target = rel == null ? null : path.resolve(ARCHIVE_DIR, rel.replace(/\\/g, '/').replace(/^\/+/, ''));
    // Prevent directory traversal: the resolved path must stay inside the archive.
    if (!target || rel.includes('\0') || !target.startsWith(ARCHIVE_DIR + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    fs.stat(target, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      fs.readFile(target, (err2, data) => {
        if (err2) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Internal server error'); return; }
        const type = mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': /^(text\/|application\/json)/.test(type) ? type + '; charset=utf-8' : type });
        res.end(data);
      });
    });
    return;
  }

  // Strip query string and decode URL, then resolve against PUBLIC_DIR.
  // Without this, `data-store.js?v=4` would be treated as a literal filename.
  const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(PUBLIC_DIR, cleanUrl === '/' ? 'index.html' : cleanUrl);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Try the requested file
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      serveFile(filePath, res);
    } else if (!err && stats.isDirectory()) {
      // If it's a directory, try index.html
      const indexPath = path.join(filePath, 'index.html');
      fs.stat(indexPath, (err2) => {
        if (!err2) {
          serveFile(indexPath, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
});

// Local dev only: point the front-end at a locally-running API instead of the deployed one.
//   DEV_API=http://localhost:3001 npm run dev
// Injected as window.FACILITY_API_BASE, which api-backend.js / the engines already read.
const DEV_API = process.env.DEV_API || '';

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    } else if (ext === '.html' && DEV_API) {
      const html = data.toString().replace(/<head(\s[^>]*)?>/i,
        (m) => `${m}\n<script>window.FACILITY_API_BASE=${JSON.stringify(DEV_API)};</script>`);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(html);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let lanIP = 'unknown';
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) {
        lanIP = net.address;
        break;
      }
    }
    if (lanIP !== 'unknown') break;
  }
  console.log(`\n📄 Processing Department — local server running`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${lanIP}:${PORT}  ← share this with LAN users`);
  console.log(`   Archive: ${ARCHIVE_DIR}\n`);
});
