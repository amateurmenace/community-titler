// Saving strategies: a chosen output folder (File System Access API, Chrome &
// Edge) or one-at-a-time browser downloads everywhere else.
import { zipSync } from 'fflate';

export type DirHandle = FileSystemDirectoryHandle;

export function supportsFolderExport(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function';
}

export async function pickDirectory(): Promise<DirHandle | null> {
  try {
    return await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    return null; // user cancelled
  }
}

export async function saveToDirectory(dir: DirHandle, name: string, data: Uint8Array | Blob): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data as any);
  await writable.close();
}

export function downloadBlob(name: string, data: Uint8Array | Blob): void {
  const blob = data instanceof Blob ? data : new Blob([data as any]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Zip a PNG sequence (store, no re-compression — PNGs are already packed). */
export function zipFrames(baseName: string, frames: Uint8Array[]): Uint8Array {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  frames.forEach((f, i) => {
    files[`${baseName}/${baseName}_${String(i).padStart(5, '0')}.png`] = [f, { level: 0 }];
  });
  return zipSync(files);
}
