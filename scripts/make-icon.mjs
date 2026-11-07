// Draws the app icon (same artwork as public/favicon.svg) at 1024 px into
// build/icon.png. electron-builder derives .ico / .icns from it.  `npm run icon`
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const S = 1024;
const u = S / 64; // the favicon is drawn on a 64-unit grid

const c = createCanvas(S, S);
const ctx = c.getContext('2d');

function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// macOS-style: leave a little transparent margin so the squircle breathes
const m = 3 * u;
rrect(m, m, S - m * 2, S - m * 2, 14 * u);
ctx.fillStyle = '#052e16';
ctx.fill();

ctx.fillStyle = '#4ade80';
rrect(10 * u, 24 * u, 16 * u, 22 * u, 3.5 * u);
ctx.fill();

ctx.fillStyle = '#FDF9F0';
rrect(29 * u, 24 * u, 25 * u, 12 * u, 2.6 * u);
ctx.fill();

ctx.fillStyle = '#4ade80';
rrect(29 * u, 39.5 * u, 18 * u, 6.5 * u, 2 * u);
ctx.fill();

ctx.strokeStyle = '#052e16';
ctx.lineWidth = 2.6 * u;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.arc(18 * u, 35 * u, 4.5 * u, Math.PI, 0, false);
ctx.stroke();

mkdirSync(join(root, 'build'), { recursive: true });
writeFileSync(join(root, 'build', 'icon.png'), c.toBuffer('image/png'));
console.log('wrote build/icon.png');
