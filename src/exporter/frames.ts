// Renders deterministic frames of a title to PNG bytes (straight alpha).
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

/** Render every frame of the in/hold/out timeline as PNG bytes. */
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
