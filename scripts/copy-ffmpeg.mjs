// Copies the ffmpeg.wasm core (single-threaded build) from node_modules into
// public/ffmpeg so the app can load it same-origin — works offline and on
// static hosts like GitHub Pages without cross-origin isolation headers.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const dst = join(root, 'public', 'ffmpeg');

if (!existsSync(src)) {
  console.warn('[copy-ffmpeg] @ffmpeg/core not installed yet; run npm install first.');
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  cpSync(join(src, f), join(dst, f));
}
console.log('[copy-ffmpeg] copied ffmpeg core to public/ffmpeg');
