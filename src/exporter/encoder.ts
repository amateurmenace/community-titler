// In-browser encoding via ffmpeg.wasm (single-threaded core, served
// same-origin from public/ffmpeg — no special headers needed, works offline).
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { ExportFormat } from '../types';

let ffmpegPromise: Promise<FFmpeg> | null = null;

export function fpsToRational(fps: number): string {
  if (Math.abs(fps - 29.97) < 0.02) return '30000/1001';
  if (Math.abs(fps - 59.94) < 0.02) return '60000/1001';
  if (Math.abs(fps - 23.976) < 0.02) return '24000/1001';
  return String(fps);
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const base = `${import.meta.env.BASE_URL}ffmpeg`;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })();
    ffmpegPromise.catch(() => (ffmpegPromise = null));
  }
  return ffmpegPromise;
}

export function containerExt(format: ExportFormat): string {
  return format === 'prores' ? 'mov' : format === 'webm' ? 'webm' : 'png';
}

function encodeArgs(format: ExportFormat, fps: number, out: string): string[] {
  const rate = fpsToRational(fps);
  if (format === 'prores') {
    return [
      '-framerate', rate, '-i', 'f%05d.png',
      '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
      '-vendor', 'apl0', '-an', out,
    ];
  }
  if (format === 'webm') {
    // VP8 + alpha. Note: this wasm libvpx build crashes on -deadline /
    // -cpu-used / "-b:v 0" constant-quality flags — keep these args minimal.
    // (VP8 is ~2x faster than VP9 here; the CLI renders VP9 natively.)
    return [
      '-framerate', rate, '-i', 'f%05d.png',
      '-c:v', 'libvpx', '-pix_fmt', 'yuva420p',
      '-b:v', '6M', '-crf', '12', '-auto-alt-ref', '0',
      '-an', out,
    ];
  }
  throw new Error(`not a video format: ${format}`);
}

/**
 * Encode PNG frames into ProRes 4444 (.mov) or VP9+alpha (.webm).
 * Frames are written into ffmpeg's in-memory FS, encoded, then cleaned up.
 */
export async function encodeVideo(
  frames: Uint8Array[],
  format: ExportFormat,
  fps: number,
  onProgress?: (p: number) => void,
  isCancelled?: () => boolean,
): Promise<Uint8Array> {
  const ffmpeg = await getFFmpeg();
  const out = `out.${containerExt(format)}`;
  const names: string[] = [];
  try {
    for (let i = 0; i < frames.length; i++) {
      if (isCancelled?.()) throw new Error('cancelled');
      const name = `f${String(i).padStart(5, '0')}.png`;
      names.push(name);
      // copy — writeFile transfers the buffer to the worker, detaching ours
      await ffmpeg.writeFile(name, new Uint8Array(frames[i]));
    }
    const onProg = ({ progress }: { progress: number }) => {
      onProgress?.(Math.max(0, Math.min(1, progress)));
    };
    ffmpeg.on('progress', onProg);
    try {
      const code = await ffmpeg.exec(encodeArgs(format, fps, out));
      if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    } finally {
      ffmpeg.off('progress', onProg);
    }
    const data = (await ffmpeg.readFile(out)) as Uint8Array;
    return data;
  } finally {
    for (const n of names) {
      try { await ffmpeg.deleteFile(n); } catch { /* ignore */ }
    }
    try { await ffmpeg.deleteFile(out); } catch { /* ignore */ }
  }
}
