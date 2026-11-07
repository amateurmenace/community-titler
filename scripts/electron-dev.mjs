// Runs the Vite dev server and opens the Electron shell against it, so the
// desktop app hot-reloads while you work.  `npm run app`
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electronPath from 'electron';

const server = await createServer({ configFile: 'vite.config.ts', server: { port: 5173, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`[electron-dev] vite at ${url}`);

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});
child.on('exit', async () => {
  await server.close();
  process.exit(0);
});
