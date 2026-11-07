// Exposes a small, typed-at-the-other-end bridge as window.titler.
// See src/desktop.ts for the TypeScript side.
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('app:info');

contextBridge.exposeInMainWorld('titler', {
  version: info.version,
  platform: info.platform,
  autoExport: info.autoExport,
  capture: (p) => ipcRenderer.invoke('app:capture', p),
  quit: () => ipcRenderer.invoke('app:quit'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  saveFileDialog: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
  writeFile: (p, data) => ipcRenderer.invoke('fs:writeFile', p, data),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  ffmpegAvailable: () => ipcRenderer.invoke('ffmpeg:available'),
  encodeStart: (opts) => ipcRenderer.invoke('encode:start', opts),
  encodeFrame: (id, rgba) => ipcRenderer.invoke('encode:frame', id, rgba),
  encodeEnd: (id) => ipcRenderer.invoke('encode:end', id),
  encodeAbort: (id) => ipcRenderer.invoke('encode:abort', id),
});
