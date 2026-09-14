// One-shot launcher: starts (if needed) the site preview (5173) and the
// content editor server (3456), then opens the editor in the default browser.
// Children are detached so they keep running after this script exits.
'use strict';
const { spawn, execFile, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const LOG = path.join(ROOT, '.accio', 'logs');
fs.mkdirSync(LOG, { recursive: true });

function alive(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1200 }, (r) => { r.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}
// Vite 的依赖预构建缓存。它丢了的话，5173 端口照样活着、源码也照样返回 200，
// 但 react 等依赖会返回 504 Outdated Optimize Dep —— 表现是整页白屏且控制台不报错。
// 所以「端口活着」不等于「预览健康」，必须连缓存一起查。
const DEPS = path.join(ROOT, 'node_modules', '.vite', 'deps');
function depsReady() {
  try {
    return fs.existsSync(path.join(DEPS, 'react.js'));
  } catch {
    return false;
  }
}
// 停掉占着 5173 的进程；只杀 node.exe，别的程序一律不碰。
function stopStalePreview() {
  let out = '';
  try {
    out = execSync('netstat -ano -p tcp | findstr :5173', { encoding: 'utf8' });
  } catch {
    return;
  }
  const pids = new Set();
  out.split('\n').forEach((line) => {
    const m = line.trim().match(/:5173\s+\S+\s+LISTENING\s+(\d+)/);
    if (m) pids.add(m[1]);
  });
  for (const pid of pids) {
    let image = '';
    try {
      image = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' });
    } catch {}
    if (!/node\.exe/i.test(image)) continue;
    try {
      execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
    } catch {}
  }
}
function wait(port, ms) {
  return new Promise(async (resolve) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await alive(port)) return resolve(true);
      await new Promise((r) => setTimeout(r, 600));
    }
    resolve(false);
  });
}
function detach(cmd, args, logName) {
  const out = fs.openSync(path.join(LOG, logName + '.log'), 'a');
  const child = spawn(cmd, args, { cwd: ROOT, detached: true, stdio: ['ignore', out, out], windowsHide: true });
  child.unref();
  return child;
}
function open(url) {
  execFile('cmd', ['/c', 'start', '', url], { windowsHide: true }, () => {});
}

(async () => {
  const results = {};
  const viteAlive = await alive(5173);
  if (!viteAlive) {
    detach('node', [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], 'vite');
    results.vite = 'started';
  } else if (!depsReady()) {
    // 端口活着但依赖缓存丢了 → 页面是白板，属于坏状态，必须重来一次。
    stopStalePreview();
    await new Promise((r) => setTimeout(r, 1500)); // 等端口释放
    detach('node', [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], 'vite');
    results.vite = 'restarted (依赖缓存丢失，已重建)';
  } else {
    results.vite = 'already running';
  }
  if (!(await alive(3456))) {
    detach('node', [path.join(ROOT, 'site-editor', 'server.cjs')], 'editor');
    results.editor = 'started';
  } else {
    results.editor = 'already running';
  }
  const v = await wait(5173, 15000);
  const e = await wait(3456, 15000);
  console.log(JSON.stringify(results, null, 2));
  console.log('preview  :', v ? 'http://localhost:5173' : 'FAILED');
  console.log('editor   :', e ? 'http://localhost:3456/editor.html' : 'FAILED');
  if (e) open('http://localhost:3456/editor.html');
  process.exit(0);
})();
