// Community Titler — Electron main process.
// Serves the built web app from an app:// scheme (so fetch() of fonts and the
// wasm encoder works), and gives the renderer a tiny native toolkit over IPC:
// folder / save dialogs, file writes, and a raw-RGBA → ffmpeg encode pipeline.
const { app, BrowserWindow, dialog, ipcMain, shell, Menu, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const DIST = path.join(__dirname, '..', 'dist');
// `--autoexport=<folder>`: open, export the first two sample titles (PNG +
// ProRes) into that folder, save a screenshot, quit. Used by the release
// smoke test — and handy for scripting.
const AUTO_EXPORT = (process.argv.find((a) => a.startsWith('--autoexport=')) ?? '').slice('--autoexport='.length);
const REPO_URL = 'https://github.com/amateurmenace/community-titler';

// ----------------------------------------------------------------- ffmpeg ---

function ffmpegPath() {
  try {
    let p = require('ffmpeg-static');
    if (!p) return null;
    if (p.includes('app.asar')) p = p.replace('app.asar', 'app.asar.unpacked');
    return fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

function fpsToRational(fps) {
  if (Math.abs(fps - 29.97) < 0.02) return '30000/1001';
  if (Math.abs(fps - 59.94) < 0.02) return '60000/1001';
  if (Math.abs(fps - 23.976) < 0.02) return '24000/1001';
  return String(fps);
}

function encodeArgs({ width, height, fps, format, path: out }) {
  const input = ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', fpsToRational(fps), '-i', '-'];
  if (format === 'prores') {
    return [...input, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', '-an', out];
  }
  if (format === 'webm') {
    return [...input, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '28', '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1', '-auto-alt-ref', '0', '-an', out];
  }
  throw new Error(`unsupported format ${format}`);
}

/** id → { proc, stderr, done: Promise<number>, failed: Error|null } */
const encoders = new Map();
let nextId = 1;

ipcMain.handle('encode:start', async (_e, opts) => {
  const bin = ffmpegPath();
  if (!bin) throw new Error('ffmpeg is not bundled with this build');
  await fsp.mkdir(path.dirname(opts.path), { recursive: true });
  const proc = spawn(bin, encodeArgs(opts), { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  const entry = { proc, stderr: '', failed: null };
  proc.stderr.on('data', (d) => {
    entry.stderr += d;
    if (entry.stderr.length > 60000) entry.stderr = entry.stderr.slice(-30000);
  });
  proc.stdin.on('error', (err) => { entry.failed = err; });
  entry.done = new Promise((resolve) => {
    proc.on('close', (code) => resolve(code ?? 1));
    proc.on('error', (err) => { entry.failed = err; resolve(1); });
  });
  const id = String(nextId++);
  encoders.set(id, entry);
  return id;
});

ipcMain.handle('encode:frame', async (_e, id, data) => {
  const entry = encoders.get(id);
  if (!entry) throw new Error('unknown encoder');
  if (entry.failed) throw new Error(`ffmpeg stopped: ${entry.stderr.slice(-600)}`);
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (!entry.proc.stdin.write(buf)) {
    await Promise.race([once(entry.proc.stdin, 'drain'), entry.done]);
  }
});

ipcMain.handle('encode:end', async (_e, id) => {
  const entry = encoders.get(id);
  if (!entry) throw new Error('unknown encoder');
  encoders.delete(id);
  entry.proc.stdin.end();
  const code = await entry.done;
  if (code !== 0 || entry.failed) {
    return { ok: false, error: `ffmpeg exited ${code}${entry.failed ? ` (${entry.failed.message})` : ''}\n${entry.stderr.slice(-800)}` };
  }
  return { ok: true };
});

ipcMain.handle('encode:abort', async (_e, id) => {
  const entry = encoders.get(id);
  if (!entry) return;
  encoders.delete(id);
  try { entry.proc.stdin.destroy(); } catch { /* ignore */ }
  try { entry.proc.kill(); } catch { /* ignore */ }
});

ipcMain.handle('ffmpeg:available', () => !!ffmpegPath());

// ------------------------------------------------------------ files & dialogs ---

ipcMain.handle('dialog:pickFolder', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose an export folder',
    buttonLabel: 'Use this folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  return r.canceled ? null : (r.filePaths[0] ?? null);
});

ipcMain.handle('dialog:saveFile', async (e, { defaultName, filters }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), defaultName || 'file'),
    filters: filters ?? [],
  });
  return r.canceled ? null : (r.filePath ?? null);
});

ipcMain.handle('fs:writeFile', async (_e, p, data) => {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  const buf = typeof data === 'string' ? data : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  await fsp.writeFile(p, buf);
});

ipcMain.handle('shell:openPath', async (_e, p) => { await shell.openPath(p); });
ipcMain.handle('shell:openExternal', async (_e, url) => {
  if (/^https?:\/\//i.test(url)) await shell.openExternal(url);
});
ipcMain.on('app:info', (e) => {
  e.returnValue = { version: app.getVersion(), platform: process.platform, autoExport: AUTO_EXPORT || null };
});
ipcMain.handle('app:capture', async (e, p) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const img = await win.webContents.capturePage();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, img.toPNG());
});
ipcMain.handle('app:quit', () => { app.quit(); });

// ------------------------------------------------------------------ window ---

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

function serveDist() {
  protocol.handle('app', (req) => {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    if (!p || p === '/') p = '/index.html';
    const file = path.normalize(path.join(DIST, p));
    if (!file.startsWith(DIST)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: (_i, w) => w?.webContents.reload() },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Community Titler on GitHub', click: () => shell.openExternal(REPO_URL) },
        { label: 'OBS and key/fill setup guide', click: () => shell.openExternal(`${REPO_URL}#exporting-alpha-for-obs-and-keyfill`) },
        { label: 'Report a problem', click: () => shell.openExternal(`${REPO_URL}/issues`) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#FDF9F0',
    title: 'Community Titler',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: process.platform === 'win32',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadURL('app://local/index.html');
  if (AUTO_EXPORT) win.webContents.on('console-message', (_e, _l, msg) => console.log('[renderer]', msg));
  return win;
}

app.whenReady().then(() => {
  if (!DEV_URL) serveDist();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  for (const e of encoders.values()) { try { e.proc.kill(); } catch { /* ignore */ } }
  if (process.platform !== 'darwin') app.quit();
});
