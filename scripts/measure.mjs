#!/usr/bin/env node
// Community Titler — layout check.
// Prints what the renderer measured for each title (type size, line count,
// Large or not, right edge, height of the stack) without rendering a pixel,
// so a layout change can be checked against the caption limit in a second.
//
//   node scripts/measure.mjs --sample
//   node scripts/measure.mjs --csv titles.csv --theme civic --date "November 17, 2026"
//
// Options: --csv <file> | --sample, --theme <id|file>, --size <WxH>,
//          --date <text> ("" for the blank OBS slot), --only <n[,n...]>

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureLayout } from '../src/renderer/core.js';
import { BUILT_IN_THEMES, normalizeTheme } from '../src/renderer/themes.js';
import { parseCSV, detectDelimiter, rowsToItems } from '../src/shared/csv.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);

const fontDir = join(root, 'public', 'fonts');
for (const f of readdirSync(fontDir)) if (/\.(ttf|otf)$/i.test(f)) GlobalFonts.registerFromPath(join(fontDir, f));

const themeArg = flag('theme', 'big');
const theme = normalizeTheme(themeArg.endsWith('.json')
  ? JSON.parse(readFileSync(resolve(themeArg), 'utf8'))
  : (BUILT_IN_THEMES.find((t) => t.id === themeArg) ?? BUILT_IN_THEMES[0]));

const csvPath = flag('csv', null) ?? join(root, 'public', 'samples', 'brookline-stm-2026-warrant-articles.csv');
const text = readFileSync(resolve(csvPath), 'utf8');
let items = rowsToItems(parseCSV(text, detectDelimiter(text)));
const only = flag('only', null);
if (only) { const keep = new Set(only.split(',').map((n) => +n - 1)); items = items.filter((_, i) => keep.has(i)); }

const [width, height] = flag('size', '1920x1080').split('x').map(Number);
const settings = {
  width, height, fps: 30, inDur: 1.1, holdDur: 6, outDur: 0.9,
  datePlace: has('date') ? 'sub' : 'off',
  dateText: flag('date', ''),
};
const ctx = createCanvas(width, height).getContext('2d');
const limit = width * (theme.layout.maxWidth ?? 0.75);
const pad = (s, n) => String(s).padEnd(n);
const r0 = (n) => Math.round(n);

console.log(`${theme.name} @ ${width}x${height} · margins ${theme.layout.marginX}/${theme.layout.marginY} · max width ${r0(limit)}px\n`);
let worstRight = 0, tallest = 0;
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const p = measureLayout(ctx, it, theme, settings);
  const right = Math.max(p.bar.x + p.bar.w, p.sub ? p.sub.x + p.sub.w : 0, p.tab ? p.tab.x + p.tab.w : 0, p.url ? p.url.x + p.url.w : 0);
  const top = Math.min(p.bar.y, p.tab ? p.tab.y : Infinity, p.tile ? p.tile.y : Infinity, p.url ? p.url.y : Infinity);
  const h = height - top - (height - (p.stackY + p.stackH));
  worstRight = Math.max(worstRight, right);
  tallest = Math.max(tallest, h);
  const label = it.type === 'article' ? it.badge : it.type;
  const flagStr = `${p.large ? 'LARGE' : 'std  '}${right > limit + 0.5 ? ' OVER' : ''}`;
  console.log(`${pad(i + 1, 3)}${pad(label, 11)}${pad(r0(p.bar.size) + 'px', 6)}${pad(p.bar.lines.length + 'ln', 4)}${flagStr}  right ${pad(r0(right), 5)} top ${pad(r0(top), 5)} h ${pad(r0(h), 4)}${p.url ? ' url ' + r0(p.url.w) + 'w' : ''}${p.tab ? ' tab "' + p.tab.text + '" ' + r0(p.tab.w) + 'w' : ''}${p.sub ? ' sub "' + p.sub.text + '"' : ''}${p.sub && p.sub.slot ? ' slot ' + r0(p.sub.slot.x) + ',' + r0(p.sub.slot.y) + ' ' + r0(p.sub.slot.w) + 'x' + r0(p.sub.slot.h) : ''}`);
}
console.log(`\nfurthest right edge ${r0(worstRight)}px (limit ${r0(limit)}) · tallest stack ${r0(tallest)}px`);
