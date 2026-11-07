#!/usr/bin/env node
// Community Titler — CLI batch renderer.
// Renders the same pixels as the web app (shared renderer core), but fast:
// frames are piped straight into your local ffmpeg. Great for big batches.
//
//   npm run render -- --csv public/samples/brookline-stm-2026-warrant-articles.csv \
//     --format prores --out exports/stm-2026
//
// Options:
//   --csv <file>         CSV/TSV of titles (same columns as the app import)
//   --sample             use the bundled Brookline STM 2026 sample list
//   --theme <id|file>    big | civic | slate | townhall | minimal, or a .theme.json
//                        exported from the app (default: big)
//   --format <f>         prores | webm | png | pngseq   (default: prores)
//   --out <dir>          output directory                (default: exports)
//   --fps <n>            29.97 | 30 | 59.94 | 60         (default: 30)
//   --size <WxH>         e.g. 1920x1080 (default) or 1280x720
//   --in / --hold / --outdur <seconds>   timing (defaults 1.1 / 6 / 0.9)
//   --logo <file>        PNG logo for themes using an image mark
//   --only <n[,n...]>    render only these 1-based rows
//
// prores/webm need ffmpeg on your PATH (brew install ffmpeg / winget install ffmpeg).

import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawFrame, totalDuration, holdTime } from '../src/renderer/core.js';
import { BUILT_IN_THEMES, normalizeTheme } from '../src/renderer/themes.js';
import { parseCSV, detectDelimiter, rowsToItems, itemFileBase } from '../src/shared/csv.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- args ---
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);

if (has('help') || argv.length === 0) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 27).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

const format = flag('format', 'prores');
const outDir = resolve(flag('out', 'exports'));
const fps = parseFloat(flag('fps', '30'));
const [width, height] = flag('size', '1920x1080').split('x').map(Number);
const settings = {
  width, height, fps,
  inDur: parseFloat(flag('in', '1.1')),
  holdDur: parseFloat(flag('hold', '6')),
  outDur: parseFloat(flag('outdur', '0.9')),
};

// ---------------------------------------------------------------- fonts ---
const fontDir = join(root, 'public', 'fonts');
for (const f of readdirSync(fontDir)) {
  if (/\.(ttf|otf)$/i.test(f)) GlobalFonts.registerFromPath(join(fontDir, f));
}

// ---------------------------------------------------------------- theme ---
let theme;
const themeArg = flag('theme', 'big');
if (themeArg.endsWith('.json')) {
  theme = normalizeTheme(JSON.parse(readFileSync(resolve(themeArg), 'utf8')));
} else {
  theme = BUILT_IN_THEMES.find((t) => t.id === themeArg);
  if (!theme) {
    console.error(`Unknown theme "${themeArg}". Built-ins: ${BUILT_IN_THEMES.map((t) => t.id).join(', ')}`);
    process.exit(1);
  }
  theme = normalizeTheme(theme);
}

// ---------------------------------------------------------------- items ---
let items;
if (has('sample') || !flag('csv', null)) {
  const csv = readFileSync(join(root, 'public', 'samples', 'brookline-stm-2026-warrant-articles.csv'), 'utf8');
  items = rowsToItems(parseCSV(csv));
  if (!has('sample')) console.log('No --csv given — using the bundled Brookline STM 2026 sample.\n');
} else {
  const text = readFileSync(resolve(flag('csv')), 'utf8');
  items = rowsToItems(parseCSV(text, detectDelimiter(text)));
}
const only = flag('only', null);
if (only) {
  const keep = new Set(only.split(',').map((n) => parseInt(n, 10) - 1));
  items = items.filter((_, i) => keep.has(i));
}
if (!items.length) {
  console.error('No titles to render.');
  process.exit(1);
}

// ---------------------------------------------------------------- assets ---
const assets = {};
const logoPath = flag('logo', null);
if (logoPath) {
  assets.logo = await loadImage(resolve(logoPath));
  theme = { ...theme, identity: { ...theme.identity, markStyle: 'image' } };
} else if (theme.logoData?.startsWith('data:')) {
  const b64 = theme.logoData.split(',')[1];
  assets.logo = await loadImage(Buffer.from(b64, 'base64'));
}

// ---------------------------------------------------------------- ffmpeg ---
const needsFfmpeg = format === 'prores' || format === 'webm';
if (needsFfmpeg) {
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('ffmpeg was not found on your PATH. Install it (macOS: `brew install ffmpeg`) or use --format png / pngseq.');
    process.exit(1);
  }
}

const rational = Math.abs(fps - 29.97) < 0.02 ? '30000/1001' : Math.abs(fps - 59.94) < 0.02 ? '60000/1001' : String(fps);

function ffmpegArgs(outFile) {
  const input = ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', rational, '-i', '-'];
  if (format === 'prores') {
    return [...input, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', '-an', outFile];
  }
  return [...input, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '28', '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1', '-auto-alt-ref', '0', '-an', outFile];
}

// ---------------------------------------------------------------- render ---
mkdirSync(outDir, { recursive: true });
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');
const total = Math.max(1, Math.round(totalDuration(settings) * fps));
const t0 = Date.now();

console.log(`Community Titler CLI — ${items.length} title(s) → ${format} @ ${width}x${height}${needsFfmpeg ? ` ${fps}fps` : ''}`);
console.log(`Theme: ${theme.name} · timeline ${settings.inDur}s in / ${settings.holdDur}s hold / ${settings.outDur}s out (${total} frames)\n`);

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const base = itemFileBase(item, i);

  if (format === 'png') {
    drawFrame(ctx, holdTime(settings), item, theme, { ...settings, assets });
    writeFileSync(join(outDir, `${base}.png`), canvas.toBuffer('image/png'));
    console.log(`✓ ${base}.png`);
    continue;
  }

  if (format === 'pngseq') {
    const seqDir = join(outDir, base);
    mkdirSync(seqDir, { recursive: true });
    for (let f = 0; f < total; f++) {
      drawFrame(ctx, f / fps, item, theme, { ...settings, assets });
      writeFileSync(join(seqDir, `${base}_${String(f).padStart(5, '0')}.png`), canvas.toBuffer('image/png'));
    }
    console.log(`✓ ${base}/ (${total} frames)`);
    continue;
  }

  const ext = format === 'prores' ? 'mov' : 'webm';
  const outFile = join(outDir, `${base}.${ext}`);
  const proc = spawn('ffmpeg', ffmpegArgs(outFile), { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  proc.stderr.on('data', (d) => { ffErr += d; if (ffErr.length > 60000) ffErr = ffErr.slice(-30000); });

  const done = new Promise((resolveDone, rejectDone) => {
    proc.on('close', (code) => (code === 0 ? resolveDone() : rejectDone(new Error(`ffmpeg exited ${code}\n${ffErr.slice(-1200)}`))));
    proc.on('error', rejectDone);
  });

  for (let f = 0; f < total; f++) {
    drawFrame(ctx, f / fps, item, theme, { ...settings, assets });
    const { data } = ctx.getImageData(0, 0, width, height);
    const okNow = proc.stdin.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    if (!okNow) await new Promise((r) => proc.stdin.once('drain', r));
  }
  proc.stdin.end();
  await done;
  process.stdout.write(`✓ ${base}.${ext}  [${i + 1}/${items.length}]\n`);
}

console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${outDir}`);
