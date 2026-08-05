// Simple static file server for front-end development
// This serves all files from the `public` directory
// When ready to add a backend, replace this with Express and add API routes

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

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
  '.woff2': 'font/woff2'
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

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}

server.listen(PORT, () => {
  console.log(`📄 Processing Department front-end server running at http://localhost:${PORT}`);
  console.log(`\n🔧 BACKEND INTEGRATION NOTES:`);
  console.log(`   - All HTML/CSS/JS files are in the 'public' folder`);
  console.log(`   - Front-end uses localStorage for data storage (see public/lib/data-store.js)`);
  console.log(`   - When ready to add a backend, implement the API in public/lib/api-backend.js`);
  console.log(`   - Then load api-backend.js AFTER data-store.js on pages that need it`);
  console.log(`   - See BACKEND_INTEGRATION.md for full details\n`);
});
