// 预览白屏一键修复。
//
// 症状：http://localhost:5173 打开是整页白板，控制台却一条报错都没有。
// 原因：Vite 的「依赖预构建缓存」node_modules/.vite 丢失或损坏。这时 Vite 对
//       react 等依赖会返回 504 Outdated Optimize Dep，整个模块图加载失败，
//       React 从来没挂载到 #root —— 所以页面是空的，而且不报错。
// 做法：查健康 → 不健康就把 5173 上的 node 预览进程停掉 → 删掉 .vite 缓存
//       → 重新拉起预览（Vite 会自动重新预构建依赖）。
//
// 用法：双击 fix-preview.cmd，或 node site-editor/fix-preview.cjs
'use strict';
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEPS = path.join(ROOT, 'node_modules', '.vite', 'deps');
const PORT = 5173;

function alive(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1500 }, (r) => {
      r.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
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

// 依赖预构建缓存是否就位（react.js 是必有的一个）
function depsReady() {
  try {
    return fs.existsSync(path.join(DEPS, 'react.js'));
  } catch {
    return false;
  }
}

// 找出占用 5173 的 PID，只杀 node.exe，避免误伤别的程序
function killPreview() {
  let out = '';
  try {
    out = execSync(`netstat -ano -p tcp | findstr :${PORT}`, { encoding: 'utf8' });
  } catch {
    return '没有找到占用 5173 的进程';
  }
  const pids = new Set();
  out.split('\n').forEach((line) => {
    const m = line.trim().match(new RegExp(`:${PORT}\\s+\\S+\\s+LISTENING\\s+(\\d+)`));
    if (m) pids.add(m[1]);
  });
  const killed = [];
  for (const pid of pids) {
    let image = '';
    try {
      image = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' });
    } catch {}
    if (!/node\.exe/i.test(image)) continue; // 不是 node 就不动它
    try {
      execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' });
      killed.push(pid);
    } catch {}
  }
  return killed.length ? `已停止旧的预览进程（PID ${killed.join(', ')}）` : '没有可停止的 node 预览进程';
}

(async () => {
  console.log('=== 澳沙华照明 · 本地预览体检 ===');
  const up = await alive(PORT);
  const deps = depsReady();
  console.log(`预览服务(${PORT})：${up ? '在跑' : '没在跑'}`);
  console.log(`依赖预构建缓存：${deps ? '正常' : '缺失 ← 这就是白屏的原因'}`);

  if (up && deps) {
    console.log('\n✅ 预览是正常的，没有动任何东西。');
    console.log('   如果浏览器里还是白板，按 Ctrl+Shift+R 强制刷新一次即可。');
    process.exit(0);
  }

  console.log('\n开始修复……');
  if (up) console.log(killPreview());
  // 缓存目录整个删掉是安全的：Vite 下次启动会自己重新生成
  try {
    fs.rmSync(path.join(ROOT, 'node_modules', '.vite'), { recursive: true, force: true });
    console.log('已清掉旧的依赖缓存（node_modules/.vite）');
  } catch (e) {
    console.log('清理缓存失败：' + e.message);
  }

  const out = fs.openSync(path.join(ROOT, '.accio', 'logs', 'vite.log'), 'a');
  const child = spawn('node', [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  child.unref();
  console.log('已重新拉起预览，正在等它把依赖预构建好……');

  const ok = await wait(PORT, 30000);
  const deps2 = depsReady();
  if (ok && deps2) {
    console.log('\n✅ 修复完成：http://localhost:5173 （依赖缓存已重建）');
    console.log('   回去刷新一下预览页就能看到网站了。');
  } else if (ok) {
    console.log('\n⚠️ 服务起来了但依赖缓存还没生成，等 10 秒再刷新一次；仍不行请看 .accio/logs/vite.log');
  } else {
    console.log('\n❌ 预览没能拉起来，请看 .accio/logs/vite.log 的最后几行');
  }
  process.exit(ok && deps2 ? 0 : 1);
})();
