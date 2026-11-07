// Renders deterministic frames of a title (straight alpha).
import { drawFrame, totalDuration, holdTime } from '../renderer/core.js';
import type { ExportSettings, ThemeDef, TitleItem } from '../types';

export interface RenderAssets {
  logo?: HTMLImageElement;
}

export async function loadAssets(theme: ThemeDef): Promise<RenderAssets> {
  const assets: RenderAssets = {};
  if (theme.logoData && theme.identity.markStyle === 'image') {
    assets.logo = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = theme.logoData!;
    });
  }
  return assets;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

async function canvasPNG(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

export function frameCount(settings: ExportSettings): number {
  return Math.max(1, Math.round(totalDuration(settings) * settings.fps));
}

/** Render the mid-hold frame (for still PNG export). */
export async function renderStill(
  item: TitleItem,
  theme: ThemeDef,
  settings: ExportSettings,
  assets: RenderAssets,
): Promise<Uint8Array> {
  const canvas = makeCanvas(settings.width, settings.height);
  const ctx = canvas.getContext('2d')!;
  drawFrame(ctx, holdTime(settings), item, theme, { ...settings, assets });
  return canvasPNG(canvas);
}

/** Render every frame of the in/hold/out timeline as PNG bytes (browser encoder path). */
export async function renderFrames(
  item: TitleItem,
  theme: ThemeDef,
  settings: ExportSettings,
  assets: RenderAssets,
  onProgress?: (done: number, total: number) => void,
  isCancelled?: () => boolean,
): Promise<Uint8Array[]> {
  const total = frameCount(settings);
  const canvas = makeCanvas(settings.width, settings.height);
  const ctx = canvas.getContext('2d')!;
  const frames: Uint8Array[] = [];
  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) throw new Error('cancelled');
    const t = i / settings.fps;
    drawFrame(ctx, t, item, theme, { ...settings, assets });
    frames.push(await canvasPNG(canvas));
    if (i % 5 === 0 || i === total - 1) onProgress?.(i + 1, total);
    if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0)); // keep UI alive
  }
  return frames;
}

/**
 * Stream every frame as raw RGBA bytes (desktop encoder path — the bytes are
 * piped straight into a native ffmpeg, no PNG round-trip).
 */
export async function forEachFrameRGBA(
  item: TitleItem,
  theme: ThemeDef,
  settings: ExportSettings,
  assets: RenderAssets,
  fn: (rgba: Uint8Array, index: number, total: number) => Promise<void>,
  isCancelled?: () => boolean,
): Promise<void> {
  const total = frameCount(settings);
  const canvas = makeCanvas(settings.width, settings.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) throw new Error('cancelled');
    drawFrame(ctx, i / settings.fps, item, theme, { ...settings, assets });
    const img = ctx.getImageData(0, 0, settings.width, settings.height);
    await fn(new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength), i, total);
  }
}

/** Render every frame as PNG bytes one at a time (desktop PNG-sequence path). */
export async function forEachFramePNG(
  item: TitleItem,
  theme: ThemeDef,
  settings: ExportSettings,
  assets: RenderAssets,
  fn: (png: Uint8Array, index: number, total: number) => Promise<void>,
  isCancelled?: () => boolean,
): Promise<void> {
  const total = frameCount(settings);
  const canvas = makeCanvas(settings.width, settings.height);
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) throw new Error('cancelled');
    drawFrame(ctx, i / settings.fps, item, theme, { ...settings, assets });
    await fn(await canvasPNG(canvas), i, total);
  }
}
