// The live-date overlay for OBS.
//
// When the project's date is on but left blank, every title's tag line ends
// in a dot and an empty slot. This builds a small self-contained HTML page
// that prints today's date in exactly that slot, in the look's own type and
// colours, so it can be added in OBS as a Browser Source over the titles.
// Nothing else on the page is painted, so the sub bar in the video shows
// through, and the date updates itself at midnight.

import { measureLayout } from './renderer/core.js';
import { BUNDLED_FONTS, getCustomFonts } from './renderer/fonts';
import type { ExportSettings, ThemeDef, TitleItem } from './types';

export interface SlotBox {
  x: number; y: number; w: number; h: number;
  /** text metrics the renderer used for the sub bar, so the overlay matches a typed date */
  size: number; tracking: number; upper: boolean;
}

/** The blank date slot's box, measured on `item` (the first article, normally). */
export function dateSlotBox(theme: ThemeDef, settings: ExportSettings, item: TitleItem): SlotBox | null {
  const canvas = document.createElement('canvas');
  canvas.width = settings.width;
  canvas.height = settings.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const plan = measureLayout(ctx, item, theme, { ...settings, datePlace: 'sub', dateText: '' });
  const S = plan?.sub;
  if (!S || !S.slot) return null;
  return { x: S.slot.x, y: S.slot.y, w: S.slot.w, h: S.slot.h, size: S.size, tracking: S.tracking, upper: !!S.slot.upper };
}

async function fontDataUrl(family: string, weight: number): Promise<string | null> {
  const custom = getCustomFonts();
  const own = custom.find((f) => f.family === family && f.weight === weight) ?? custom.find((f) => f.family === family);
  if (own) return own.dataUrl;
  const files = BUNDLED_FONTS.filter(([fam]) => fam === family);
  if (!files.length) return null;
  const best = files.reduce((a, b) => (Math.abs(b[1] - weight) < Math.abs(a[1] - weight) ? b : a));
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}fonts/${best[2]}`);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:font/ttf;base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** A complete HTML document for an OBS Browser Source, or null if the slot cannot be measured. */
export async function buildDateOverlayHtml(theme: ThemeDef, settings: ExportSettings, item: TitleItem): Promise<string | null> {
  const box = dateSlotBox(theme, settings, item);
  if (!box) return null;
  const family = theme.fonts.text;
  const weight = theme.fonts.textWeight ?? 600;
  const data = await fontDataUrl(family, weight);
  const color = theme.colors.subText;
  const r = (n: number) => Math.round(n * 100) / 100;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Community Titler — live date overlay</title>
<!--
  Made by Community Titler for the look "${esc(theme.name)}" at ${settings.width}×${settings.height},
  measured on "${esc(item.badge || item.primary)}".

  In OBS: Sources → + → Browser → tick "Local file" and pick this file →
  Width ${settings.width}, Height ${settings.height}. Put it above your title
  sources. It prints today's date in the empty slot at the end of the tag
  line of your exported titles and refreshes itself at midnight.

  To change how the date reads, edit the FORMAT line below — for example
  { weekday: 'long', month: 'long', day: 'numeric' } gives "Tuesday, November 17".
  The slot is sized for a date like "September 30, 2026".
-->
<style>
  ${data ? `@font-face { font-family: "${esc(family)}"; font-weight: ${weight}; src: url("${data}"); }` : ''}
  html, body { margin: 0; width: ${settings.width}px; height: ${settings.height}px; background: transparent; overflow: hidden; }
  #date {
    position: absolute;
    left: ${r(box.x)}px; top: ${r(box.y)}px;
    height: ${r(box.h)}px; line-height: ${r(box.h)}px;
    font-family: "${esc(family)}", "DM Sans", "Inter", Arial, sans-serif;
    font-weight: ${weight};
    font-size: ${r(box.size)}px;
    letter-spacing: ${r(box.tracking)}px;
    ${box.upper ? 'text-transform: uppercase;' : ''}
    color: ${color};
    white-space: nowrap;
    -webkit-font-smoothing: antialiased;
  }
</style>
</head>
<body>
<div id="date"></div>
<script>
  var FORMAT = { month: 'long', day: 'numeric', year: 'numeric' };
  var fmt = new Intl.DateTimeFormat(undefined, FORMAT);
  function tick() { document.getElementById('date').textContent = fmt.format(new Date()); }
  tick();
  setInterval(tick, 30000);
</script>
</body>
</html>
`;
}
