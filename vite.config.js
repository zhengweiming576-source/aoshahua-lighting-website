import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

// Emit real static files for the legal pages, so each one resolves both on
// hosts that serve a directory index (…/privacy-policy/index.html) and on
// hosts that only fall back to the SPA entry. The public URL stays clean.
const LEGAL_DIRS = ['privacy-policy', 'terms-of-service', 'data-deletion', 'admin'];

function emitLegalPages() {
  return {
    name: 'aoshahua-emit-legal-pages',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(projectRoot, 'dist');
      const entry = path.join(outDir, 'index.html');
      if (!fs.existsSync(entry)) return;
      const html = fs.readFileSync(entry, 'utf8');
      for (const dir of LEGAL_DIRS) {
        const target = path.join(outDir, dir);
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(path.join(target, 'index.html'), html);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), emitLegalPages()],
  server: {
    host: '127.0.0.1'
  }
});
