// Aoshahua site content editor — local helper server (no dependencies).
// Start from the project root:  npm run editor
// Then open: http://localhost:3456/editor.html
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd(); // project root (npm run editor runs there)
const EDITOR_DIR = path.join(__dirname);
const CONTENT_FILE = path.join(ROOT, 'src', 'content.json');
const IMAGE_BASE = path.join(ROOT, 'public', 'assets', 'images');
const ASSETS_BASE = path.join(ROOT, 'public', 'assets');
const ALLOWED_DIRS = ['products', 'factory', 'logo', 'process', 'projects'];
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
const PORT = process.env.PORT || 3456;
// Default to localhost only (safe). Set HOST=0.0.0.0 to also accept the LAN:
//   Windows:  set HOST=0.0.0.0 && npm run editor
// then other devices on the same Wi‑Fi can open  http://<本机局域网IP>:3456/editor.html
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(body);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  try {
    // ---- API ----
    if (url === '/api/content' && req.method === 'GET') {
      const raw = fs.readFileSync(CONTENT_FILE, 'utf8');
      JSON.parse(raw); // validate before sending
      return send(res, 200, raw);
    }
    if (url === '/api/content' && req.method === 'PUT') {
      const body = await readBody(req, 20 * 1024 * 1024);
      const data = JSON.parse(body.toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('content must be an object');
      JSON.stringify(data); // ensure serializable
      const tmp = CONTENT_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
      fs.renameSync(tmp, CONTENT_FILE);
      return send(res, 200, JSON.stringify({ ok: true }));
    }
    if (url.startsWith('/api/imglist')) {
      const dir = (url.split('/').pop() || '').trim();
      if (!ALLOWED_DIRS.includes(dir)) return send(res, 400, JSON.stringify({ error: 'bad dir' }));
      const base = path.join(IMAGE_BASE, dir);
      if (!fs.existsSync(base)) return send(res, 200, JSON.stringify({ files: [] }));
      const files = fs.readdirSync(base).filter((f) => ALLOWED_EXT.includes(path.extname(f).toLowerCase()));
      const list = files.map((f) => ({
        name: f,
        size: Math.round(fs.statSync(path.join(base, f)).size / 1024),
        url: '/assets/images/' + dir + '/' + encodeURIComponent(f),
      }));
      return send(res, 200, JSON.stringify({ dir, files: list }));
    }
    if (url === '/api/upload' && req.method === 'POST') {
      const body = await readBody(req, 12 * 1024 * 1024);
      const { dir, file, data } = JSON.parse(body.toString('utf8'));
      if (!ALLOWED_DIRS.includes(dir)) return send(res, 400, JSON.stringify({ error: 'bad dir' }));
      const name = path.basename(file || '');
      if (!ALLOWED_EXT.includes(path.extname(name).toLowerCase())) return send(res, 400, JSON.stringify({ error: 'bad extension' }));
      const buf = Buffer.from(data, 'base64');
      if (!buf.length) return send(res, 400, JSON.stringify({ error: 'empty file' }));
      fs.writeFileSync(path.join(IMAGE_BASE, dir, name), buf);
      return send(res, 200, JSON.stringify({ ok: true, url: '/assets/images/' + dir + '/' + encodeURIComponent(name) }));
    }
    // ---- editor static ----
    if (url === '/' || url === '/editor') {
      res.writeHead(302, { Location: '/editor.html' });
      return res.end();
    }
    if (url === '/editor.html') {
      return send(res, 200, fs.readFileSync(path.join(EDITOR_DIR, 'editor.html')), MIME['.html']);
    }
    // ---- images + other project static (for thumbnails) ----
    if (url.startsWith('/assets/')) {
      let rel = path.normalize(url.slice('/assets/'.length));
      if (rel.startsWith('..')) return send(res, 403, 'forbidden');
      const p = path.join(ASSETS_BASE, rel);
      if (!p.startsWith(ASSETS_BASE)) return send(res, 403, 'forbidden');
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return send(res, 200, fs.readFileSync(p), MIME[path.extname(p).toLowerCase()] || 'application/octet-stream');
      }
      return send(res, 404, 'not found');
    }
    return send(res, 404, 'not found');
  } catch (e) {
    return send(res, 400, JSON.stringify({ error: String((e && e.message) || e) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('====================================================');
  console.log(' 澳沙华网站·内容编辑器 已启动');
  console.log(' 请打开浏览器访问:  http://localhost:' + PORT + '/editor.html');
  console.log(' (按 Ctrl+C 停止)');
  console.log('====================================================');
});
