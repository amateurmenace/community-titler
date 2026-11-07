// Bridge to the Electron desktop shell (electron/preload.cjs). When the app
// runs in a plain browser `desktop` is null and everything falls back to the
// browser-only code paths (File System Access API, downloads, ffmpeg.wasm).

export interface EncodeOpts {
  path: string;
  width: number;
  height: number;
  fps: number;
  format: 'prores' | 'webm';
}

export interface DesktopBridge {
  version: string;
  platform: string;
  /** folder passed with --autoexport=<folder>, or null */
  autoExport: string | null;
  capture(path: string): Promise<void>;
  quit(): Promise<void>;
  pickFolder(): Promise<string | null>;
  saveFileDialog(opts: { defaultName: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null>;
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  openPath(path: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  ffmpegAvailable(): Promise<boolean>;
  encodeStart(opts: EncodeOpts): Promise<string>;
  encodeFrame(id: string, rgba: Uint8Array): Promise<void>;
  encodeEnd(id: string): Promise<{ ok: boolean; error?: string }>;
  encodeAbort(id: string): Promise<void>;
}

declare global {
  interface Window {
    titler?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | null =
  typeof window !== 'undefined' && window.titler ? window.titler : null;

export const isDesktop = !!desktop;

export function joinPath(dir: string, name: string): string {
  const sep = desktop?.platform === 'win32' ? '\\' : '/';
  return dir.replace(/[\\/]+$/, '') + sep + name;
}

export function openLink(url: string): void {
  if (desktop) void desktop.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}
