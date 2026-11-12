// Orchestrates single and bulk exports — in the browser (ffmpeg.wasm, File
// System Access API or downloads) and in the desktop app (native ffmpeg,
// straight into a chosen folder).
import { itemFileBase } from '../shared/csv.js';
import type { ExportSettings, ThemeDef, TitleItem } from '../types';
import { desktop, joinPath } from '../desktop';
import { forEachFramePNG, forEachFrameRGBA, loadAssets, renderFrames, renderStill } from './frames';
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

export type ExportDestination =
  | { kind: 'folder'; path: string } // desktop
  | { kind: 'browser-dir'; handle: DirHandle } // Chrome / Edge
  | { kind: 'downloads' }; // everything else

export async function exportItems(
  items: TitleItem[],
  allItems: TitleItem[], // the whole project list, so file names stay unique
  theme: ThemeDef,
  settings: ExportSettings,
  dest: ExportDestination,
  onProgress: (p: JobProgress) => void,
  ctl: ExportController,
): Promise<{ done: number; failed: string[] }> {
  const assets = await loadAssets(theme);
  let done = 0;
  const failed: string[] = [];
  const isCancelled = () => ctl.cancelled;

  const put = async (name: string, data: Uint8Array) => {
    if (dest.kind === 'folder') {
      await desktop!.writeFile(joinPath(dest.path, name), data);
    } else if (dest.kind === 'browser-dir') {
      await saveToDirectory(dest.handle, name, data);
    } else {
      downloadBlob(name, data);
    }
  };

  for (let i = 0; i < items.length; i++) {
    if (ctl.cancelled) break;
    const item = items[i];
    const base = itemFileBase(item, allItems);
    const report = (phase: JobProgress['phase'], progress: number, message?: string) =>
      onProgress({ itemIndex: i, itemCount: items.length, label: base, phase, progress, message });

    try {
      if (settings.format === 'png') {
        report('render', 0.3);
        const png = await renderStill(item, theme, settings, assets);
        report('save', 0.9);
        await put(`${base}.png`, png);
      } else if (settings.format === 'pngseq') {
        if (dest.kind === 'folder') {
          // desktop: a real folder of numbered PNGs (what CasparCG and NLEs want)
          await forEachFramePNG(item, theme, settings, assets, async (png, f, total) => {
            await desktop!.writeFile(joinPath(joinPath(dest.path, base), `${base}_${String(f).padStart(5, '0')}.png`), png);
            if (f % 5 === 0 || f === total - 1) report('render', (f + 1) / total);
          }, isCancelled);
        } else {
          const frames = await renderFrames(item, theme, settings, assets, (d, t) => report('render', d / t), isCancelled);
          report('save', 0.9);
          await put(`${base}.zip`, zipFrames(base, frames));
        }
      } else if (dest.kind === 'folder' && desktop && (await desktop.ffmpegAvailable())) {
        // desktop: stream raw frames into native ffmpeg — fast
        const dk = desktop;
        const outPath = joinPath(dest.path, `${base}.${containerExt(settings.format)}`);
        const id = await dk.encodeStart({
          path: outPath, width: settings.width, height: settings.height, fps: settings.fps,
          format: settings.format,
        });
        try {
          await forEachFrameRGBA(item, theme, settings, assets, async (rgba, f, total) => {
            await dk.encodeFrame(id, rgba);
            if (f % 3 === 0 || f === total - 1) report('render', (f + 1) / total);
          }, isCancelled);
          report('encode', 0.98);
          const res = await dk.encodeEnd(id);
          if (!res.ok) throw new Error(res.error ?? 'ffmpeg failed');
        } catch (e) {
          await dk.encodeAbort(id).catch(() => {});
          throw e;
        }
      } else {
        const frames = await renderFrames(item, theme, settings, assets, (d, t) => report('render', d / t), isCancelled);
        const data = await encodeVideo(frames, settings.format, settings.fps, (p) => report('encode', p), isCancelled);
        frames.length = 0;
        report('save', 0.95);
        await put(`${base}.${containerExt(settings.format)}`, data);
      }
      done++;
      report('done', 1);
    } catch (e: any) {
      if (String(e?.message).includes('cancelled')) { report('error', 1, 'cancelled'); break; }
      console.error('export failed for', base, e);
      failed.push(base);
      report('error', 1, String(e?.message ?? e));
    }
  }
  return { done, failed };
}
