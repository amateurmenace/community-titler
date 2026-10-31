// Orchestrates single and bulk exports.
import { itemFileBase } from '../shared/csv.js';
import type { ExportSettings, ThemeDef, TitleItem } from '../types';
import { loadAssets, renderFrames, renderStill } from './frames';
import { containerExt, encodeVideo } from './encoder';
import { downloadBlob, saveToDirectory, zipFrames, type DirHandle } from './save';

export interface JobProgress {
  itemIndex: number;
  itemCount: number;
  label: string;
  phase: 'render' | 'encode' | 'save' | 'done' | 'error';
  progress: number; // 0..1 within the phase
  message?: string;
}

export interface ExportController {
  cancelled: boolean;
}

export async function exportItems(
  items: TitleItem[],
  indexOffset: (item: TitleItem) => number,
  theme: ThemeDef,
  settings: ExportSettings,
  dir: DirHandle | null,
  onProgress: (p: JobProgress) => void,
  ctl: ExportController,
): Promise<{ done: number; failed: string[] }> {
  const assets = await loadAssets(theme);
  let done = 0;
  const failed: string[] = [];
  const isCancelled = () => ctl.cancelled;

  for (let i = 0; i < items.length; i++) {
    if (ctl.cancelled) break;
    const item = items[i];
    const base = itemFileBase(item, indexOffset(item));
    const report = (phase: JobProgress['phase'], progress: number, message?: string) =>
      onProgress({ itemIndex: i, itemCount: items.length, label: base, phase, progress, message });

    try {
      if (settings.format === 'png') {
        report('render', 0.2);
        const png = await renderStill(item, theme, settings, assets);
        report('save', 0.9);
        if (dir) await saveToDirectory(dir, `${base}.png`, png);
        else downloadBlob(`${base}.png`, png);
      } else if (settings.format === 'pngseq') {
        const frames = await renderFrames(item, theme, settings, assets, (d, t) => report('render', d / t), isCancelled);
        report('save', 0.9);
        const zip = zipFrames(base, frames);
        if (dir) await saveToDirectory(dir, `${base}.zip`, zip);
        else downloadBlob(`${base}.zip`, zip);
      } else {
        const frames = await renderFrames(item, theme, settings, assets, (d, t) => report('render', d / t), isCancelled);
        const data = await encodeVideo(frames, settings.format, settings.fps, (p) => report('encode', p), isCancelled);
        frames.length = 0;
        report('save', 0.95);
        const name = `${base}.${containerExt(settings.format)}`;
        if (dir) await saveToDirectory(dir, name, data);
        else downloadBlob(name, data);
      }
      done++;
      report('done', 1);
    } catch (e: any) {
      if (String(e?.message).includes('cancelled')) break;
      console.error('export failed for', base, e);
      failed.push(base);
      report('error', 1, String(e?.message ?? e));
    }
  }
  return { done, failed };
}
