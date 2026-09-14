// one-shot smoke test for the editor server (run: node site-editor/smoke.js)
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const srv = spawn('node', ['site-editor/server.cjs'], { cwd: process.cwd(), stdio: 'ignore' });
const results = {};
function get(path, key, done) {
  http.get({ host: '127.0.0.1', port: 3456, path }, (r) => {
    let n = 0;
    r.on('data', (c) => (n += c.length));
    r.on('end', () => { results[key] = r.statusCode + ' (' + n + 'B)'; done(); });
  }).on('error', () => { results[key] = 'ERR'; done(); });
}
setTimeout(() => {
  let left = 3;
  const done = () => { if (--left === 0) { console.log(results); srv.kill(); process.exit(0); } };
  get('/api/content', 'api/content', done);
  get('/api/imglist/products', 'api/imglist/products', done);
  get('/editor.html', 'editor.html', done);
}, 1500);
setTimeout(() => { console.log(results); srv.kill(); process.exit(1); }, 9000);
